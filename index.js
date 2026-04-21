const defaultSettings = {
    apiKey: '',
    model: 'mistralai/voxtral-mini-tts-2603',
    speed: 1.0,
    voiceMap: {}
};

class OpenRouterTtsProvider {
    settings = {};
    voices = [];
    audioElement = document.createElement('audio');

    get settingsHtml() {
        return `
<div class="openrouter-tts-settings">
    <div class="setting-group">
        <label for="openrouter-tts-api-key">OpenRouter API Key:</label>
        <input id="openrouter-tts-api-key" type="password" placeholder="sk-or-v1-..." />
        <small>Your key is stored locally in your browser.</small>
    </div>
    
    <div class="setting-group">
        <label for="openrouter-tts-model">Model ID:</label>
        <input id="openrouter-tts-model" type="text" value="mistralai/voxtral-mini-tts-2603" />
        <small>Default: mistralai/voxtral-mini-tts-2603</small>
    </div>

    <div class="setting-group">
        <label for="openrouter-tts-speed">Speed (Multiplier):</label>
        <div style="display: flex; align-items: center; gap: 10px;">
            <input id="openrouter-tts-speed" type="range" min="0.5" max="2.0" step="0.1" value="1.0" style="flex-grow: 1;" />
            <span id="openrouter-tts-speed-val">1.0</span>
        </div>
    </div>
    <div style="margin-top: 10px; font-size: 0.9em; color: var(--grey70);">
        <b>Note on Voice Cloning:</b> To clone a voice per-character, use the <b>Voice Map</b> block below. When setting a Voice ID, type the URL to your reference audio file (e.g. <code>https://example.com/voice.wav</code>) or type an official Voice ID. OpenRouter will forward this to the selected model.
    </div>
</div>
        `;
    }

    async loadSettings(settings) {
        this.settings = Object.assign({}, defaultSettings, settings);
        
        $('#openrouter-tts-api-key').val(this.settings.apiKey);
        $('#openrouter-tts-model').val(this.settings.model);
        $('#openrouter-tts-speed').val(this.settings.speed);
        $('#openrouter-tts-speed-val').text(this.settings.speed);

        $('#openrouter-tts-api-key').on('input', () => this.onSettingsChange());
        $('#openrouter-tts-model').on('input', () => this.onSettingsChange());
        $('#openrouter-tts-speed').on('input', () => {
            $('#openrouter-tts-speed-val').text($('#openrouter-tts-speed').val());
            this.onSettingsChange();
        });

        await this.checkReady();
    }

    onSettingsChange() {
        this.settings.apiKey = $('#openrouter-tts-api-key').val();
        this.settings.model = $('#openrouter-tts-model').val() || defaultSettings.model;
        this.settings.speed = parseFloat($('#openrouter-tts-speed').val()) || 1.0;
        
        try {
            import('../../tts/index.js').then(module => {
                if (module.saveTtsProviderSettings) module.saveTtsProviderSettings();
            }).catch(() => {});
        } catch (e) {}
    }

    async checkReady() {
        // No heavy validation needed yet
    }

    async onRefreshClick() {
        // No-op
    }

    async getVoice(voiceName) {
        return { name: voiceName, voice_id: voiceName };
    }

    async fetchTtsVoiceObjects() {
        // Provide standard OpenAI voices as placeholders, users can type their own URLs/IDs in ST UI.
        return [
            { name: "alloy", voice_id: "alloy" },
            { name: "echo", voice_id: "echo" },
            { name: "fable", voice_id: "fable" },
            { name: "onyx", voice_id: "onyx" },
            { name: "nova", voice_id: "nova" },
            { name: "shimmer", voice_id: "shimmer" }
        ];
    }

    async previewTtsVoice(_) {
        // No-op
    }

    async generateTts(text, voiceId, characterName = null) {
        if (!this.settings.apiKey) {
            toastr.error("OpenRouter API Key is missing. Check your OpenRouter TTS extension settings.", "TTS Error");
            throw new Error("No API Key");
        }

        console.info(`Generating TTS via OpenRouter for voice_id: ${voiceId}`);
        const requestBody = {
            model: this.settings.model,
            input: text,
            voice: voiceId,
            response_format: 'mp3',
            speed: this.settings.speed
        };

        const response = await fetch("https://openrouter.ai/api/v1/audio/speech", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${this.settings.apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sillytavern.app/",
                "X-Title": "SillyTavern TTS Extension"
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("OpenRouter TTS generation failed:", errText);
            
            if (typeof toastr !== 'undefined') {
                toastr.error(errText, "OpenRouter TTS Generation Failed");
            }
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        return response; // ST expects a standard Fetch Response containing the audio blob/stream
    }
}

// ST loading hook
jQuery(async () => {
    try {
        const ttsModule = await import('../../tts/index.js');
        if (ttsModule.registerTtsProvider) {
            ttsModule.registerTtsProvider('OpenRouter TTS', new OpenRouterTtsProvider());
            console.log("Registered OpenRouter TTS Provider extension!");
        }
    } catch (e) {
        console.error("Failed to register OpenRouter TTS Provider:", e);
    }
});
