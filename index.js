import { saveTtsProviderSettings } from '../tts/index.js';
import { getRequestHeaders } from '../../../../script.js';

export { OpenRouterTtsProvider };

/**
 * OpenRouter TTS Provider for SillyTavern
 * Uses Mistral's Voxtral Mini TTS via OpenRouter's API.
 * Routes through ST's built-in OpenAI-compatible custom TTS proxy to avoid CORS.
 */
class OpenRouterTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'mistralai/voxtral-mini-tts-2603',
        speed: 1,
        available_voices: 'alloy,echo,fable,onyx,nova,shimmer',
    };

    get settingsHtml() {
        let html = `
        <div class="openrouter-tts-settings">
            <h4>🤖 OpenRouter TTS (Voxtral)</h4>
            <hr>
            <div class="flex-container alignItemsBaseline" style="margin-bottom: 10px;">
                <small class="flex1">
                    Uses ST's "OpenAI Compatible" API key slot.<br>
                    Click the key icon to set your <b>OpenRouter API key</b> (sk-or-v1-...).
                </small>
                <div id="openrouter_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_custom_openai_tts">
                    <i class="fa-solid fa-key"></i>
                    <span>API Key</span>
                </div>
            </div>
            <label for="openrouter_tts_model">Model ID:</label>
            <input id="openrouter_tts_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
            <small style="display:block; margin-bottom:8px; color:var(--grey70);">Default: mistralai/voxtral-mini-tts-2603</small>
            <label for="openrouter_tts_voices">Available Voices (comma separated):</label>
            <input id="openrouter_tts_voices" type="text" class="text_pole" value="${this.defaultSettings.available_voices}"/>
            <small style="display:block; margin-bottom:8px; color:var(--grey70);">These appear in the Voice Map dropdown. For voice cloning, add a custom name here and map it to a character.</small>
            <label for="openrouter_tts_speed">Speed: <span id="openrouter_tts_speed_output"></span></label>
            <input type="range" id="openrouter_tts_speed" value="1" min="0.25" max="4" step="0.05">
        </div>
        `;
        return html;
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length == 0) {
            console.info('OpenRouter TTS: Using default settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                console.warn(`OpenRouter TTS: Ignoring unknown setting: ${key}`);
            }
        }

        // Populate the UI with loaded values
        $('#openrouter_tts_model').val(this.settings.model);
        $('#openrouter_tts_model').on('input', () => this.onSettingsChange());

        $('#openrouter_tts_voices').val(this.settings.available_voices);
        $('#openrouter_tts_voices').on('input', () => this.onSettingsChange());

        $('#openrouter_tts_speed').val(this.settings.speed);
        $('#openrouter_tts_speed').on('input', () => this.onSettingsChange());
        $('#openrouter_tts_speed_output').text(this.settings.speed);

        await this.checkReady();
        console.debug('OpenRouter TTS: Settings loaded');
    }

    onSettingsChange() {
        this.settings.model = String($('#openrouter_tts_model').val());
        this.settings.available_voices = String($('#openrouter_tts_voices').val());
        this.settings.speed = Number($('#openrouter_tts_speed').val());
        $('#openrouter_tts_speed_output').text(this.settings.speed);
        saveTtsProviderSettings();
    }

    async checkReady() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.find(v => v.name == voiceName);
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsVoiceObjects() {
        const voiceString = this.settings.available_voices || this.defaultSettings.available_voices;
        return voiceString.split(',').map(v => v.trim()).filter(v => v).map(v => {
            return { name: v, voice_id: v, lang: 'en-US' };
        });
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = 'The quick brown fox jumps over the lazy dog.';
        const response = await this.fetchTtsGeneration(text, voiceId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    /**
     * Calls ST's built-in proxy at /api/openai/custom/generate-voice.
     * This avoids CORS issues by having ST's Node server make the external request.
     * The proxy reads the API key from SECRET_KEYS.CUSTOM_OPENAI_TTS.
     */
    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`OpenRouter TTS: Generating for voice_id ${voiceId}, model ${this.settings.model}`);

        const response = await fetch('/api/openai/custom/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                provider_endpoint: 'https://openrouter.ai/api/v1/audio/speech',
                model: this.settings.model,
                input: inputText,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.settings.speed,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'OpenRouter TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}

// Register this provider with ST's TTS system when the extension loads
jQuery(async () => {
    try {
        // Dynamic import to get registerTtsProvider from the TTS extension
        const { registerTtsProvider } = await import('../tts/index.js');
        registerTtsProvider('OpenRouter TTS', OpenRouterTtsProvider);
        console.log('✅ OpenRouter TTS provider registered successfully');
    } catch (e) {
        console.error('❌ Failed to register OpenRouter TTS Provider:', e);
    }
});
