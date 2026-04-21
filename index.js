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
        <div style="padding: 10px; text-align: center; color: var(--grey70);">
            <b>Settings moved!</b><br>
            Please scroll down the Extensions menu and find the dedicated <b>"OpenRouter TTS"</b> block to change your API Key and Model settings.
        </div>
        `;
    }

    async loadSettings(settings) {
        this.settings = Object.assign({}, defaultSettings, settings);
        
        // Update the dedicated menu inputs to reflect loaded settings
        $('#openrouter-tts-api-key').val(this.settings.apiKey);
        $('#openrouter-tts-model').val(this.settings.model);
        $('#openrouter-tts-speed').val(this.settings.speed);
        $('#openrouter-tts-speed-val').text(this.settings.speed);

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
        return [
            { name: "alloy", voice_id: "alloy" },
            { name: "echo", voice_id: "echo" }
        ];
    }

    async previewTtsVoice(_) {
        // No-op
    }

    async generateTts(text, voiceId, characterName = null) {
        if (!this.settings.apiKey) {
            toastr.error("OpenRouter API Key is missing. Check the OpenRouter TTS Addon menu.", "TTS Error");
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

        return response; 
    }
}

// Dedicated ST Addon Menu HTML
const dedicatedMenuHtml = `
<div class="inline-drawer openrouter-tts-settings-drawer">
    <div class="inline-drawer-toggle inline-drawer-header">
        <b>🤖 OpenRouter TTS (Voxtral)</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
    </div>
    <div class="inline-drawer-content" style="display: none; padding: 10px;">
        <div class="openrouter-tts-settings">
            <div class="setting-group">
                <label for="openrouter-tts-api-key">OpenRouter API Key:</label>
                <input id="openrouter-tts-api-key" type="password" placeholder="sk-or-v1-..." />
                <small>Your key is stored locally in your browser.</small>
            </div>
            
            <div class="setting-group" style="margin-top: 10px;">
                <label for="openrouter-tts-model">Model ID:</label>
                <input id="openrouter-tts-model" type="text" value="mistralai/voxtral-mini-tts-2603" />
                <small>Default: mistralai/voxtral-mini-tts-2603</small>
            </div>

            <div class="setting-group" style="margin-top: 10px;">
                <label for="openrouter-tts-speed">Speed (Multiplier):</label>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input id="openrouter-tts-speed" type="range" min="0.5" max="2.0" step="0.1" value="1.0" style="flex-grow: 1;" />
                    <span id="openrouter-tts-speed-val">1.0</span>
                </div>
            </div>
            
            <div style="margin-top: 15px; font-size: 0.9em; color: var(--grey70); background: var(--black50a); padding: 8px; border-radius: 5px;">
                <b>Note on Voice Cloning:</b> To clone a voice per-character, open the standard <b>TTS Menu</b> above. In the <b>Voice Map</b>, select your character and paste a <b>Reference Audio URL</b> (e.g. <code>https://example.com/voice.wav</code>) into the Voice ID box.
            </div>
        </div>
    </div>
</div>
`;

// Global instance to allow HTML elements to trigger changes
let openRouterTtsInstance = null;

// ST loading hook
jQuery(async () => {
    // Append the dedicated menu to the extensions settings block
    $('#extensions_settings').append(dedicatedMenuHtml);
    
    // Setup toggle logic for the drawer
    $('.openrouter-tts-settings-drawer .inline-drawer-toggle').on('click', function () {
        const content = $(this).siblings('.inline-drawer-content');
        const icon = $(this).find('.inline-drawer-icon');
        content.slideToggle();
        icon.toggleClass('down up');
        icon.toggleClass('fa-circle-chevron-down fa-circle-chevron-up');
    });

    try {
        const ttsModule = await import('../../tts/index.js');
        if (ttsModule.registerTtsProvider) {
            openRouterTtsInstance = new OpenRouterTtsProvider();
            ttsModule.registerTtsProvider('OpenRouter TTS', openRouterTtsInstance);
            console.log("Registered OpenRouter TTS Provider extension!");
            
            // Attach event listeners to our new dedicated menu inputs
            $('#openrouter-tts-api-key').on('input', () => openRouterTtsInstance.onSettingsChange());
            $('#openrouter-tts-model').on('input', () => openRouterTtsInstance.onSettingsChange());
            $('#openrouter-tts-speed').on('input', () => {
                $('#openrouter-tts-speed-val').text($('#openrouter-tts-speed').val());
                openRouterTtsInstance.onSettingsChange();
            });
        }
    } catch (e) {
        console.error("Failed to register OpenRouter TTS Provider:", e);
    }
});
