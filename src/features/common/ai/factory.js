// factory.js

/**
 * @typedef {object} ModelOption
 * @property {string} id 
 * @property {string} name
 */

/**
 * @typedef {object} Provider
 * @property {string} name
 * @property {() => any} handler
 * @property {ModelOption[]} llmModels
 * @property {ModelOption[]} sttModels
 */

/**
 * @type {Object.<string, Provider>}
 */
const PROVIDERS = {
  'openai': {
      name: 'OpenAI',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano 👁 ($0.10/1M — cheapest)' },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini 👁 ($0.15/1M — best value)' },
          { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini 👁 ($0.40/1M)' },
          { id: 'gpt-4.1', name: 'GPT-4.1 👁 ($2/1M — flagship)' },
          { id: 'gpt-4o', name: 'GPT-4o 👁 ($2.50/1M)' },
          { id: 'o4-mini', name: 'o4-mini 🧠 ($1.10/1M — reasoning)' },
      ],
      sttModels: [
          { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe ($0.003/min)' },
          { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe ($0.006/min)' },
      ],
  },

  'openai-glass': {
      name: 'OpenAI (Glass)',
      handler: () => require("./providers/openai"),
      llmModels: [
          { id: 'gpt-4.1-mini-glass', name: 'GPT-4.1 Mini (glass)' },
      ],
      sttModels: [],
  },
  'gemini': {
      name: 'Gemini',
      handler: () => require("./providers/gemini"),
      llmModels: [
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      ],
      sttModels: [
          { id: 'gemini-2.0-flash-live-preview-04-09', name: 'Gemini Live 2.0 Flash' }
      ],
  },
  'anthropic': {
      name: 'Anthropic',
      handler: () => require("./providers/anthropic"),
      llmModels: [
          { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
          { id: 'claude-opus-4-7', name: 'Claude Opus 4.7' },
          { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5' },
      ],
      sttModels: [],
  },
  'deepseek': {
      name: 'DeepSeek',
      handler: () => require("./providers/deepseek"),
      llmModels: [
          { id: 'deepseek-chat', name: 'DeepSeek V3 (cheap, smart)' },
          { id: 'deepseek-reasoner', name: 'DeepSeek R1 (reasoning)' },
      ],
      sttModels: [],
  },
  'xai': {
      name: 'xAI (Grok)',
      handler: () => require("./providers/xai"),
      llmModels: [
          { id: 'grok-3-mini', name: 'Grok 3 Mini (fast, cheap)' },
          { id: 'grok-3', name: 'Grok 3' },
          { id: 'grok-2-vision-1212', name: 'Grok 2 Vision 👁' },
      ],
      sttModels: [],
  },
  'groq': {
      name: 'Groq',
      handler: () => require("./providers/groq"),
      llmModels: [
          { id: 'llama-3.2-90b-vision-preview', name: 'Llama 3.2 90B Vision 👁' },
          { id: 'llama-3.2-11b-vision-preview', name: 'Llama 3.2 11B Vision 👁 (fast)' },
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (text only)' },
          { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (fastest, text only)' },
          { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (text only)' },
      ],
      sttModels: [
          { id: 'whisper-large-v3-turbo', name: 'Whisper Large v3 Turbo (fast)' },
          { id: 'whisper-large-v3', name: 'Whisper Large v3' },
          { id: 'distil-whisper-large-v3-en', name: 'Distil Whisper v3 (EN only)' },
      ],
  },
  'deepgram': {
      name: 'Deepgram',
      handler: () => require("./providers/deepgram"),
      llmModels: [],
      sttModels: [
          { id: 'nova-3', name: 'Nova-3 (best quality)' },
          { id: 'nova-2', name: 'Nova-2 (stable)' },
          { id: 'nova-3-medical', name: 'Nova-3 Medical' },
          { id: 'base', name: 'Base (cheapest)' },
      ],
  },
  'ollama': {
      name: 'Ollama (Local)',
      handler: () => require("./providers/ollama"),
      llmModels: [], // Dynamic models populated from installed Ollama models
      sttModels: [], // Ollama doesn't support STT yet
  },
  'whisper': {
      name: 'Whisper (Local)',
      handler: () => {
          // This needs to remain a function due to its conditional logic for renderer/main process
          if (typeof window === 'undefined') {
              const { WhisperProvider } = require("./providers/whisper");
              return new WhisperProvider();
          }
          // Return a dummy object for the renderer process
          return {
              validateApiKey: async () => ({ success: true }), // Mock validate for renderer
              createSTT: () => { throw new Error('Whisper STT is only available in main process'); },
          };
      },
      llmModels: [],
      sttModels: [
          { id: 'whisper-tiny', name: 'Whisper Tiny (39M)' },
          { id: 'whisper-base', name: 'Whisper Base (74M)' },
          { id: 'whisper-small', name: 'Whisper Small (244M)' },
          { id: 'whisper-medium', name: 'Whisper Medium (769M)' },
      ],
  },
};

function sanitizeModelId(model) {
  return (typeof model === 'string') ? model.replace(/-glass$/, '') : model;
}

function createSTT(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';
  
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createSTT) {
      throw new Error(`STT not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createSTT(opts);
}

function createLLM(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';

  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createLLM) {
      throw new Error(`LLM not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createLLM(opts);
}

function createStreamingLLM(provider, opts) {
  if (provider === 'openai-glass') provider = 'openai';
  
  const handler = PROVIDERS[provider]?.handler();
  if (!handler?.createStreamingLLM) {
      throw new Error(`Streaming LLM not supported for provider: ${provider}`);
  }
  if (opts && opts.model) {
    opts = { ...opts, model: sanitizeModelId(opts.model) };
  }
  return handler.createStreamingLLM(opts);
}

function getProviderClass(providerId) {
    const providerConfig = PROVIDERS[providerId];
    if (!providerConfig) return null;
    
    // Handle special cases for glass providers
    let actualProviderId = providerId;
    if (providerId === 'openai-glass') {
        actualProviderId = 'openai';
    }
    
    // The handler function returns the module, from which we get the class.
    const module = providerConfig.handler();
    
    // Map provider IDs to their actual exported class names
    const classNameMap = {
        'openai': 'OpenAIProvider',
        'anthropic': 'AnthropicProvider',
        'gemini': 'GeminiProvider',
        'deepgram': 'DeepgramProvider',
        'ollama': 'OllamaProvider',
        'whisper': 'WhisperProvider',
        'groq': 'GroqProvider',
        'deepseek': 'DeepSeekProvider',
        'xai': 'XAIProvider',
    };
    
    const className = classNameMap[actualProviderId];
    return className ? module[className] : null;
}

function getAvailableProviders() {
  const stt = [];
  const llm = [];
  for (const [id, provider] of Object.entries(PROVIDERS)) {
      if (provider.sttModels.length > 0) stt.push(id);
      if (provider.llmModels.length > 0) llm.push(id);
  }
  return { stt: [...new Set(stt)], llm: [...new Set(llm)] };
}

module.exports = {
  PROVIDERS,
  createSTT,
  createLLM,
  createStreamingLLM,
  getProviderClass,
  getAvailableProviders,
};