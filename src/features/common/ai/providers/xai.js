const XAI_BASE_URL = 'https://api.x.ai/v1';

class XAIProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid xAI API key format.' };
        }
        try {
            const response = await fetch(`${XAI_BASE_URL}/models`, {
                headers: { 'Authorization': `Bearer ${key}` }
            });
            if (response.ok) return { success: true };
            const err = await response.json().catch(() => ({}));
            return { success: false, error: err.error?.message || `Status: ${response.status}` };
        } catch {
            return { success: false, error: 'Network error during validation.' };
        }
    }
}

function createStreamingLLM({ apiKey, model = 'grok-3-mini', temperature = 0.7, maxTokens = 2048 }) {
    return {
        streamChat: async (messages) => {
            const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`xAI API error: ${response.status} - ${err.error?.message || 'Unknown'}`);
            }
            return response;
        },
    };
}

function createLLM({ apiKey, model = 'grok-3-mini', temperature = 0.7, maxTokens = 2048 }) {
    return {
        chat: async (messages) => {
            const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `xAI error: ${response.status}`);
            }
            const data = await response.json();
            return { content: data.choices[0]?.message?.content || '' };
        },
    };
}

function createSTT() {
    throw new Error('xAI does not support STT. Use Groq Whisper instead.');
}

module.exports = { XAIProvider, createSTT, createLLM, createStreamingLLM };
