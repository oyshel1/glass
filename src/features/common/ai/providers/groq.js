class GroqProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid Groq API key format.' };
        }
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            if (response.ok) {
                return { success: true };
            }
            const errorData = await response.json().catch(() => ({}));
            return { success: false, error: errorData.error?.message || `Status: ${response.status}` };
        } catch (error) {
            return { success: false, error: 'Network error during validation.' };
        }
    }
}

// Build a minimal WAV header for PCM16 mono 16kHz
function pcmToWav(pcmBuffer, sampleRate = 16000, channels = 1, bitDepth = 16) {
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);       // PCM chunk size
    header.writeUInt16LE(1, 20);        // PCM format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

// RMS energy check to skip silent chunks
function hasEnoughEnergy(pcmBuffer, threshold = 300) {
    const samples = pcmBuffer.length / 2;
    let sum = 0;
    for (let i = 0; i < pcmBuffer.length - 1; i += 2) {
        const sample = pcmBuffer.readInt16LE(i);
        sum += sample * sample;
    }
    return Math.sqrt(sum / samples) >= threshold;
}

async function sendToGroq(apiKey, model, wavBuffer, language) {
    // Use native FormData + Blob (available in Electron / Node 18+)
    const form = new FormData();
    form.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', model);
    form.append('response_format', 'json');
    if (language) form.append('language', language);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: form,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Groq API error: ${response.status}`);
    }
    return await response.json();
}

// CHUNK_SECONDS: how many seconds of audio to buffer before sending to Groq
const CHUNK_SECONDS = 3;
const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHUNK_BYTES = CHUNK_SECONDS * SAMPLE_RATE * BYTES_PER_SAMPLE;

function createSTT({ apiKey, model = 'whisper-large-v3-turbo', language = 'uk', callbacks = {} }) {
    let audioBuffer = Buffer.alloc(0);
    let closed = false;
    let processing = false;

    const flush = async () => {
        if (processing || audioBuffer.length < CHUNK_BYTES / 2) return;
        if (!hasEnoughEnergy(audioBuffer)) {
            audioBuffer = Buffer.alloc(0);
            return;
        }

        processing = true;
        const chunk = audioBuffer;
        audioBuffer = Buffer.alloc(0);

        try {
            const wav = pcmToWav(chunk);
            const result = await sendToGroq(apiKey, model, wav, language);
            const text = result.text?.trim();
            if (text) {
                callbacks.onmessage?.({ provider: 'groq', text, isFinal: true });
            }
        } catch (err) {
            console.error('[Groq STT] transcription error:', err.message);
            callbacks.onerror?.(err);
        } finally {
            processing = false;
        }
    };

    // Flush every CHUNK_SECONDS
    const interval = setInterval(() => {
        if (!closed) flush();
    }, CHUNK_SECONDS * 1000);

    return Promise.resolve({
        sendRealtimeInput: (data) => {
            if (closed) return;
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'base64');
            audioBuffer = Buffer.concat([audioBuffer, buf]);
            // Auto-flush if buffer is getting large
            if (audioBuffer.length >= CHUNK_BYTES * 2) flush();
        },
        close: () => {
            closed = true;
            clearInterval(interval);
            if (audioBuffer.length > 0) flush();
            callbacks.onclose?.({ reason: 'closed' });
        },
    });
}

function createLLM({ apiKey, model = 'llama-3.3-70b-versatile', temperature = 0.7, maxTokens = 2048 }) {
    return {
        chat: async (messages) => {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `Groq LLM error: ${response.status}`);
            }
            const data = await response.json();
            return { content: data.choices[0]?.message?.content || '' };
        },
    };
}

function createStreamingLLM({ apiKey, model = 'llama-3.3-70b-versatile', temperature = 0.7, maxTokens = 2048 }) {
    return {
        streamChat: async (messages) => {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`Groq API error: ${response.status} - ${err.error?.message || 'Unknown error'}`);
            }
            return response;
        },
    };
}

module.exports = { GroqProvider, createSTT, createLLM, createStreamingLLM };
