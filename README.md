# OpenRouter TTS Extension for SillyTavern

A Text-to-Speech provider extension that connects SillyTavern to [OpenRouter's TTS API](https://openrouter.ai/), pre-configured for **Mistral Voxtral Mini TTS** (`mistralai/voxtral-mini-tts-2603`).

## Features

- **Voxtral Mini TTS** via OpenRouter — high quality multilingual text-to-speech
- **Per-character voices** — assign different voices to different characters via ST's Voice Map
- **Configurable voices list** — add custom voice names for voice cloning
- **Speed control** — adjust playback speed from 0.25x to 4x
- **No server-side changes needed** — uses ST's built-in OpenAI-compatible proxy

## Installation

### Option 1: SillyTavern Extension Manager
Use the SillyTavern built-in extension installer with this URL:
```
https://github.com/sogyboi/STTTSopenrouter
```

### Option 2: Manual
```bash
cd <your-sillytavern>/public/scripts/extensions/third-party/
git clone https://github.com/sogyboi/STTTSopenrouter.git
```

Restart SillyTavern after installing.

## Setup

1. Open the **Extensions** panel (building blocks icon) → **TTS**
2. In the **Provider** dropdown, select **OpenRouter TTS**
3. Click the **API Key** button and enter your OpenRouter API key (`sk-or-v1-...`)
   - This uses the "OpenAI Compatible" key slot in ST's secret management
4. The model defaults to `mistralai/voxtral-mini-tts-2603` — you can change it to any OpenRouter TTS model
5. Assign voices to your characters in the **Voice Map** section below the settings

## How It Works

The extension registers as a standard TTS provider in SillyTavern. When TTS is triggered:

1. Text is sent through ST's built-in server proxy (`/api/openai/custom/generate-voice`)
2. The proxy forwards the request to `https://openrouter.ai/api/v1/audio/speech`
3. Audio is returned and played in your browser

This proxy approach avoids CORS issues and keeps your API key secure on the server side.

## License

AGPLv3
