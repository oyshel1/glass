// liveQAService.js — auto-answers interviewer questions in real-time

class LiveQAService {
    constructor() {
        this.qaHistory = [];      // { id, questionText, answer, isAnswered, isLoading }
        this.currentViewIndex = -1;
        this.theirBuffer = [];    // accumulate interviewer speech segments
        this.myTurnCount = 0;     // my turns since last question
        this.isAnalyzing = false;
        this.isManualMode = false; // true = collecting, no auto-trigger until 2nd press
        this.debounceTimer = null;
        this.DEBOUNCE_MS = 200;
        this.MY_TURNS_TO_ANSWER = 3;
    }

    addTheirTurn(text) {
        const trimmed = text.trim();
        if (!trimmed) return;

        // If last question already answered, fresh buffer for new question
        const last = this.qaHistory[this.qaHistory.length - 1];
        if (!last || last.isAnswered) {
            this.theirBuffer = [];
        }

        this.myTurnCount = 0;
        this.theirBuffer.push(trimmed);

        if (this.isManualMode) return; // user is collecting manually — no auto-trigger

        clearTimeout(this.debounceTimer);

        const combined = this.theirBuffer.join(' ');
        const looksComplete = /[?!]/.test(combined) || combined.length >= 120;
        const delay = looksComplete ? this.DEBOUNCE_MS : 3000;
        this.debounceTimer = setTimeout(() => this._processBuffer(), delay);
    }

    addMyTurn(text) {
        const trimmed = text.trim();
        if (!trimmed) return;

        this.myTurnCount++;

        const last = this.qaHistory[this.qaHistory.length - 1];
        if (last && !last.isAnswered && this.myTurnCount >= this.MY_TURNS_TO_ANSWER) {
            last.isAnswered = true;
            this._sendUpdate();
        }
    }

    async _processBuffer(force = false) {
        if (this.theirBuffer.length === 0) return;

        // If still analyzing, retry shortly
        if (this.isAnalyzing) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this._processBuffer(), 600);
            return;
        }

        const questionText = this.theirBuffer.join(' ').trim();
        this.theirBuffer = [];

        if (questionText.length < 8) return;

        // Skip if this is the same pending unanswered question
        const last = this.qaHistory[this.qaHistory.length - 1];
        if (last && !last.isAnswered && last.questionText === questionText) return;

        // Question completeness check (skip if forced manually or obviously complete)
        if (!force) {
            const obviouslyComplete = (/[?!]/.test(questionText) && questionText.length >= 25)
                || questionText.length >= 120;

            if (!obviouslyComplete) {
                const complete = await this._classifyQuestion(questionText);
                if (!complete) {
                    // Restore buffer and wait for natural continuation via next STT chunk
                    this.theirBuffer = [questionText];
                    return;
                }
            }
        }

        this.isAnalyzing = true;
        this.myTurnCount = 0;

        const entry = {
            id: Date.now(),
            questionText,
            answer: '',
            isAnswered: false,
            isLoading: true,
        };

        this.qaHistory.push(entry);
        this.currentViewIndex = this.qaHistory.length - 1;
        this._sendUpdate();

        try {
            await this._streamAnswer(entry);
        } catch (err) {
            console.error('[LiveQAService] Error getting answer:', err.message);
            entry.answer = `⚠️ Помилка: ${err.message}`;
            entry.isLoading = false;
            this._sendUpdate();
        } finally {
            this.isAnalyzing = false;
        }
    }

    async _streamAnswer(entry) {
        const { createStreamingLLM, createLLM } = require('../../common/ai/factory');
        const { getSystemPrompt } = require('../../common/prompts/promptBuilder');
        const modelStateService = require('../../common/services/modelStateService');

        const modelInfo = await modelStateService.getCurrentModelInfo('llm');
        if (!modelInfo || !modelInfo.apiKey) {
            throw new Error('AI модель не налаштована');
        }

        // Include last 3 answered Q&A pairs as context
        const recentContext = this.qaHistory
            .filter(q => q.isAnswered && q.answer)
            .slice(-3)
            .map(q => `Питання: ${q.questionText}\nМоя відповідь: ${q.answer.substring(0, 300)}`)
            .join('\n\n');

        const systemPrompt = getSystemPrompt('pickle_glass', recentContext, false);
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Питання від інтерв'юера: "${entry.questionText}"` },
        ];

        try {
            const streamingLLM = createStreamingLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: modelInfo.model,
                temperature: 0.7,
                maxTokens: 600,
                usePortkey: modelInfo.provider === 'openai-glass',
                portkeyVirtualKey: modelInfo.provider === 'openai-glass' ? modelInfo.apiKey : undefined,
            });

            const response = await streamingLLM.streamChat(messages);
            if (response && !response.ok) {
                const errText = await response.text().catch(() => 'HTTP error');
                throw new Error(`LLM ${response.status}: ${errText.substring(0, 200)}`);
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            outer: while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                for (const line of chunk.split('\n')) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.substring(6).trim();
                    if (data === '[DONE]') break outer;
                    try {
                        const json = JSON.parse(data);
                        const token = json.choices?.[0]?.delta?.content || '';
                        if (token) {
                            entry.answer += token;
                            this._sendUpdate();
                        }
                    } catch {}
                }
            }
        } catch (streamErr) {
            // Fallback to non-streaming
            console.warn('[LiveQAService] Streaming failed, using LLM fallback:', streamErr.message);
            const llm = createLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: modelInfo.model,
                temperature: 0.7,
                maxTokens: 600,
            });
            const result = await llm.chat(messages);
            entry.answer = result.content || '';
        }

        entry.isLoading = false;
        this._sendUpdate();
    }

    toggleManualMode() {
        if (this.isManualMode) {
            // Second press — fire everything collected
            this.isManualMode = false;
            clearTimeout(this.debounceTimer);
            this._sendUpdate();
            this._processBuffer(true);
        } else {
            // First press — enter collecting mode, stop any pending auto-trigger
            this.isManualMode = true;
            clearTimeout(this.debounceTimer);
            this._sendUpdate();
        }
    }

    async _classifyQuestion(text) {
        try {
            const { createLLM } = require('../../common/ai/factory');
            const modelStateService = require('../../common/services/modelStateService');
            const modelInfo = await modelStateService.getCurrentModelInfo('llm');
            if (!modelInfo?.apiKey) return true;

            // Always use a cheap fast model for YES/NO classification
            const classifierModel = modelInfo.provider === 'anthropic'
                ? 'claude-haiku-4-5-20251001'
                : modelInfo.provider === 'gemini'
                    ? 'gemini-2.5-flash'
                    : 'gpt-4o-mini'; // default for openai / openai-glass

            const llm = createLLM(modelInfo.provider, {
                apiKey: modelInfo.apiKey,
                model: classifierModel,
                temperature: 0,
                maxTokens: 5,
            });

            const result = await llm.chat([
                {
                    role: 'system',
                    content: 'Reply ONLY with YES or NO. Is the following a complete question or complete thought that deserves a detailed response? If it is a sentence fragment or an incomplete thought, reply NO.',
                },
                { role: 'user', content: text },
            ]);

            return result.content?.trim().toUpperCase().startsWith('YES') ?? true;
        } catch {
            return true; // on error, assume complete and proceed
        }
    }

    navigate(direction) {
        const newIdx = this.currentViewIndex + direction;
        if (newIdx >= 0 && newIdx < this.qaHistory.length) {
            this.currentViewIndex = newIdx;
            this._sendUpdate();
        }
    }

    _sendUpdate() {
        const { windowPool } = require('../../../window/windowManager');
        const win = windowPool?.get('listen');
        if (win && !win.isDestroyed()) {
            win.webContents.send('live-qa-update', {
                history: this.qaHistory,
                currentIndex: this.currentViewIndex,
                isManualMode: this.isManualMode,
            });
        }
    }

    reset() {
        clearTimeout(this.debounceTimer);
        this.qaHistory = [];
        this.currentViewIndex = -1;
        this.theirBuffer = [];
        this.myTurnCount = 0;
        this.isAnalyzing = false;
        this.isManualMode = false;
    }
}

module.exports = LiveQAService;
