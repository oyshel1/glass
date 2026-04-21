const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';

class DeepSeekProvider {
    static async validateApiKey(key) {
        if (!key || typeof key !== 'string') {
            return { success: false, error: 'Invalid DeepSeek API key format.' };
        }
        try {
            const response = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
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

function createStreamingLLM({ apiKey, model = 'deepseek-chat', temperature = 0.7, maxTokens = 2048 }) {
    return {
        streamChat: async (messages) => {
            const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, stream: true }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`DeepSeek API error: ${response.status} - ${err.error?.message || 'Unknown'}`);
            }
            return response;
        },
    };
}

function createLLM({ apiKey, model = 'deepseek-chat', temperature = 0.7, maxTokens = 2048 }) {
    return {
        chat: async (messages) => {
            const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
            });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error?.message || `DeepSeek error: ${response.status}`);
            }
            const data = await response.json();
            return { content: data.choices[0]?.message?.content || '' };
        },
    };
}

function createSTT() {
    throw new Error('DeepSeek does not support STT. Use Groq Whisper instead.');
}

module.exports = { DeepSeekProvider, createSTT, createLLM, createStreamingLLM };
