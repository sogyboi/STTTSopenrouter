import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../../extensions.js';
import { eventSource, event_types } from '../../../../script.js';

// Define the unique key for this extension's settings
const EXTENSION_NAME = 'openrouter_tts_standalone';

// Default settings
const defaultSettings = {
    enabled: false,
    apiKey: '',
    model: 'mistralai/voxtral-mini-tts-2603',
    voice: 'alloy',
    speed: 1.0,
};

// Global audio element
const audioElement = new Audio();

/**
 * Ensures settings are initialized
 */
function loadSettings() {
    if (!extension_settings[EXTENSION_NAME]) {
        extension_settings[EXTENSION_NAME] = {};
    }
    for (const key in defaultSettings) {
        if (extension_settings[EXTENSION_NAME][key] === undefined) {
            extension_settings[EXTENSION_NAME][key] = defaultSettings[key];
        }
    }
}

/**
 * Saves settings and updates UI
 */
function saveSettings() {
    extension_settings[EXTENSION_NAME].enabled = $('#or_tts_enabled').prop('checked');
    extension_settings[EXTENSION_NAME].apiKey = $('#or_tts_api_key').val();
    extension_settings[EXTENSION_NAME].model = $('#or_tts_model').val();
    extension_settings[EXTENSION_NAME].voice = $('#or_tts_voice').val();
    extension_settings[EXTENSION_NAME].speed = parseFloat($('#or_tts_speed').val());
    
    // Trigger global save
    getContext().saveSettings();
}

/**
 * Applies settings to the UI
 */
function applySettingsToUI() {
    const settings = extension_settings[EXTENSION_NAME];
    $('#or_tts_enabled').prop('checked', settings.enabled);
    $('#or_tts_api_key').val(settings.apiKey);
    $('#or_tts_model').val(settings.model);
    $('#or_tts_voice').val(settings.voice);
    $('#or_tts_speed').val(settings.speed);
    $('#or_tts_speed_val').text(settings.speed);
}

/**
 * Generates audio using OpenRouter API and plays it
 */
async function generateAndPlay(text) {
    const settings = extension_settings[EXTENSION_NAME];
    
    if (!settings.apiKey) {
        toastr.error('OpenRouter TTS: API Key is missing. Please add it in the Extensions menu.');
        return;
    }

    try {
        console.log(`[OpenRouter TTS] Generating audio for text: ${text.substring(0, 50)}...`);
        const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://sillytavern.app',
                'X-Title': 'SillyTavern',
            },
            body: JSON.stringify({
                model: settings.model,
                input: text,
                voice: settings.voice,
                response_format: 'mp3',
                speed: settings.speed,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            toastr.error(`Error ${response.status}: ${errText}`, 'OpenRouter TTS Failed');
            return;
        }

        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);

        // Stop current playback
        audioElement.pause();
        audioElement.currentTime = 0;

        // Play new audio
        audioElement.src = url;
        audioElement.play();
        
        // Clean up URL when done
        audioElement.onended = () => URL.revokeObjectURL(url);
    } catch (err) {
        console.error('[OpenRouter TTS] Generation error:', err);
        toastr.error('Failed to generate TTS audio. Check console.', 'OpenRouter TTS Error');
    }
}

/**
 * Replaces message macros and strips markdown for TTS
 */
function cleanTextForTts(text) {
    let cleaned = text.replace(/<[^>]*>?/gm, ''); // Remove HTML
    cleaned = cleaned.replace(/\*[^*]*\*/g, ''); // Remove asterisks (actions)
    cleaned = cleaned.replace(/```[\s\S]*?```/g, ''); // Remove code blocks
    return cleaned.trim();
}

/**
 * Handle new messages
 */
function onMessageReceived(messageId) {
    const settings = extension_settings[EXTENSION_NAME];
    if (!settings.enabled) return;

    const chat = getContext().chat;
    const msg = chat[messageId];

    // Don't narrate system messages or empty messages
    if (!msg || msg.is_system || !msg.mes) return;

    // Only auto-play character messages (not user messages)
    if (msg.is_user) return;

    const textToNarrate = cleanTextForTts(msg.mes);
    if (textToNarrate.length > 0) {
        generateAndPlay(textToNarrate);
    }
}

/**
 * Adds a play button next to messages
 */
function addPlayButtons() {
    // Listen for clicks on the chat container
    $('#chat').on('click', '.or-tts-play-btn', function () {
        const messageId = $(this).closest('.mes').attr('mesid');
        const chat = getContext().chat;
        const msg = chat[messageId];
        
        if (msg && msg.mes) {
            const textToNarrate = cleanTextForTts(msg.mes);
            generateAndPlay(textToNarrate);
        }
    });
}

/**
 * Inject the button when messages are rendered
 */
function injectButtonIntoMessage(messageId) {
    const mesElement = $(`.mes[mesid="${messageId}"]`);
    if (mesElement.length === 0) return;
    
    const extraButtonsContainer = mesElement.find('.extraMesButtons');
    if (extraButtonsContainer.length > 0 && extraButtonsContainer.find('.or-tts-play-btn').length === 0) {
        extraButtonsContainer.prepend(`
            <div class="mes_button or-tts-play-btn fa-solid fa-volume-high" title="Play with OpenRouter TTS"></div>
        `);
    }
}

/**
 * Initialize the extension
 */
jQuery(async () => {
    loadSettings();

    // Load UI HTML
    const html = await renderExtensionTemplateAsync('third-party/STTTSopenrouter', 'index');
    $('#extensions_settings').append(html);

    applySettingsToUI();

    // Add listeners to UI
    $('#or_tts_enabled, #or_tts_api_key, #or_tts_model, #or_tts_voice').on('change input', saveSettings);
    $('#or_tts_speed').on('input', function () {
        $('#or_tts_speed_val').text($(this).val());
        saveSettings();
    });

    // Event listeners for chat
    eventSource.on(event_types.MESSAGE_RECEIVED, (messageId) => {
        onMessageReceived(messageId);
        injectButtonIntoMessage(messageId);
    });

    // Also inject buttons when chat is fully rendered
    eventSource.on(event_types.CHAT_CHANGED, () => {
        const chat = getContext().chat;
        for (let i = 0; i < chat.length; i++) {
            injectButtonIntoMessage(i);
        }
    });

    addPlayButtons();

    console.log('[OpenRouter TTS Standalone] Extension Loaded.');
});
