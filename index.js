import { saveTtsProviderSettings } from '../../tts/index.js';

export { OpenRouterTtsProvider };

/**
 * OpenRouter TTS Provider for SillyTavern
 * Uses Mistral's Voxtral Mini TTS via OpenRouter's API.
 * Makes direct calls to OpenRouter (they support CORS).
 */
class OpenRouterTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        apiKey: '',
        model: 'mistralai/voxtral-mini-tts-2603',
        speed: 1,
        available_voices: 'alloy,echo,fable,onyx,nova,shimmer',
    };

    get settingsHtml() {
        let html = `
        <div class="openrouter-tts-settings">
            <h4>🤖 OpenRouter TTS (Voxtral)</h4>
            <hr>
            <label for="openrouter_tts_api_key">OpenRouter API Key:</label>
            <input id="openrouter_tts_api_key" type="password" class="text_pole" placeholder="sk-or-v1-..." />
            <small style="display:block; margin-bottom:8px; color:var(--grey70);">Stored locally in your SillyTavern settings. Never sent anywhere except OpenRouter.</small>
            <label for="openrouter_tts_model">Model ID:</label>
            <input id="openrouter_tts_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
            <small style="display:block; margin-bottom:8px; color:var(--grey70);">Default: mistralai/voxtral-mini-tts-2603</small>
            <label for="openrouter_tts_voices">Available Voices (comma separated):</label>
            <input id="openrouter_tts_voices" type="text" class="text_pole" value="${this.defaultSettings.available_voices}"/>
            <small style="display:block; margin-bottom:8px; color:var(--grey70);">These appear in the Voice Map dropdown below.</small>
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
        $('#openrouter_tts_api_key').val(this.settings.apiKey);
        $('#openrouter_tts_api_key').on('input', () => this.onSettingsChange());

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
        this.settings.apiKey = String($('#openrouter_tts_api_key').val());
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
     * Makes a direct call to OpenRouter's TTS API.
     * OpenRouter supports CORS, so no server proxy is needed.
     * Required headers: HTTP-Referer and X-Title (OpenRouter policy).
     */
    async fetchTtsGeneration(inputText, voiceId) {
        if (!this.settings.apiKey) {
            toastr.error('Please set your OpenRouter API key in the TTS settings.', 'OpenRouter TTS');
            throw new Error('OpenRouter API key is not set');
        }

        console.info(`OpenRouter TTS: Generating for voice_id ${voiceId}, model ${this.settings.model}`);

        const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.settings.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://sillytavern.app',
                'X-Title': 'SillyTavern',
            },
            body: JSON.stringify({
                model: this.settings.model,
                input: inputText,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.settings.speed,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('OpenRouter TTS generation failed:', response.status, errText);
            toastr.error(`${response.status}: ${errText}`, 'OpenRouter TTS Failed');
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        return response;
    }
}

// Register this provider with ST's TTS system when the extension loads
jQuery(async () => {
    try {
        const { registerTtsProvider } = await import('../../tts/index.js');
        registerTtsProvider('OpenRouter TTS', OpenRouterTtsProvider);
        console.log('✅ OpenRouter TTS provider registered successfully');
    } catch (e) {
        console.error('❌ Failed to register OpenRouter TTS Provider:', e);
    }
});
