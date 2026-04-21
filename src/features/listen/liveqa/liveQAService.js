// liveQAService.js — auto-answers interviewer questions in real-time

class LiveQAService {
    constructor() {
        this.qaHistory = [];      // { id, questionText, answer, isAnswered, isLoading }
        this.currentViewIndex = -1;
        this.theirBuffer = [];    // accumulate interviewer speech segments
        this.myTurnCount = 0;     // my turns since last question
        this.isAnalyzing = false;
        this.debounceTimer = null;
        this.DEBOUNCE_MS = 200; // STT already batches; small extra delay before triggering LLM
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

        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this._processBuffer(), this.DEBOUNCE_MS);
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

    async _processBuffer() {
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
    }
}

module.exports = LiveQAService;
