import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class SttView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
        }

        /* Inherit font styles from parent */

        .transcription-container {
            overflow-y: auto;
            padding: 12px 12px 16px 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-height: 150px;
            max-height: 600px;
            position: relative;
            z-index: 1;
            flex: 1;
        }

        /* Visibility handled by parent component */

        .transcription-container::-webkit-scrollbar {
            width: 8px;
        }
        .transcription-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
            border-radius: 4px;
        }
        .transcription-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
        }
        .transcription-container::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
        }

        .stt-message {
            padding: 8px 12px;
            border-radius: 12px;
            max-width: 80%;
            word-wrap: break-word;
            word-break: break-word;
            line-height: 1.5;
            font-size: 13px;
            margin-bottom: 4px;
            box-sizing: border-box;
        }

        .message-wrapper {
            display: flex;
            align-items: flex-end;
            gap: 6px;
            position: relative;
        }

        .message-wrapper.me {
            flex-direction: row-reverse;
        }

        .message-wrapper.them {
            flex-direction: row;
        }

        .search-btn {
            background: rgba(255, 255, 255, 0.15);
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: opacity 0.15s, background 0.15s;
            color: white;
        }

        .btn-group {
            display: flex;
            flex-direction: column;
            gap: 3px;
            opacity: 0;
            transition: opacity 0.15s;
        }

        .message-wrapper:hover .btn-group {
            opacity: 1;
        }

        .search-btn:hover {
            background: rgba(0, 122, 255, 0.7) !important;
        }

        .screenshot-btn {
            background: rgba(255, 255, 255, 0.15);
            border: none;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            cursor: pointer;
            font-size: 11px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: white;
        }

        .screenshot-btn:hover {
            background: rgba(80, 180, 80, 0.7) !important;
        }

        .stt-message.selected {
            outline: 2px solid rgba(0, 122, 255, 0.8);
            outline-offset: 2px;
        }

        .floating-search {
            display: flex;
            justify-content: center;
            padding: 6px 12px 8px;
        }

        .floating-search-btn {
            background: rgba(0, 122, 255, 0.9);
            color: white;
            border: none;
            border-radius: 16px;
            padding: 6px 16px;
            font-size: 12px;
            cursor: pointer;
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .floating-search-btn:hover {
            background: rgba(0, 100, 220, 1);
        }

        .stt-message.them {
            background: rgba(255, 255, 255, 0.1);
            color: rgba(255, 255, 255, 0.9);
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            margin-right: auto;
        }

        .stt-message.me {
            background: rgba(0, 122, 255, 0.8);
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            margin-left: auto;
        }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            font-style: italic;
        }
    `;

    static properties = {
        sttMessages: { type: Array },
        isVisible: { type: Boolean },
        selectedIds: { type: Object },
    };

    constructor() {
        super();
        this.sttMessages = [];
        this.isVisible = true;
        this.messageIdCounter = 0;
        this._shouldScrollAfterUpdate = false;
        this._recentFinals = []; // deduplication: {speaker, text, ts}
        this.selectedIds = new Set();

        this.handleSttUpdate = this.handleSttUpdate.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        if (window.api) {
            window.api.sttView.onSttUpdate(this.handleSttUpdate);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.api) {
            window.api.sttView.removeOnSttUpdate(this.handleSttUpdate);
        }
    }

    // Handle session reset from parent
    resetTranscript() {
        this.sttMessages = [];
        this.selectedIds = new Set();
        this.requestUpdate();
    }

    toggleSelect(id) {
        const next = new Set(this.selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        this.selectedIds = next;
        this.requestUpdate();
        this.updateComplete.then(() => {
            this.dispatchEvent(new CustomEvent('stt-messages-updated', {
                detail: { messages: this.sttMessages },
                bubbles: true,
            }));
        });
    }

    _buildQuery(text) {
        return `Дай детальну відповідь на питання з інтерв'ю:\n\n"${text}"`;
    }

    _joinSelected() {
        return this.sttMessages
            .filter(m => this.selectedIds.has(m.id))
            .map(m => m.text.trim())
            .join(' ');
    }

    searchText(text) {
        window.api?.summaryView?.sendQuestionNoScreenshot(this._buildQuery(text));
    }

    searchTextWithScreenshot(text) {
        window.api?.summaryView?.sendQuestionFromSummary(this._buildQuery(text));
    }

    searchSelected() {
        window.api?.summaryView?.sendQuestionNoScreenshot(this._buildQuery(this._joinSelected()));
        this.selectedIds = new Set();
        this.requestUpdate();
    }

    searchSelectedWithScreenshot() {
        window.api?.summaryView?.sendQuestionFromSummary(this._buildQuery(this._joinSelected()));
        this.selectedIds = new Set();
        this.requestUpdate();
    }

    handleSttUpdate(event, { speaker, text, isFinal, isPartial }) {
        if (text === undefined) return;

        // Deduplicate final messages: drop if identical speaker+text seen within 3s
        if (isFinal) {
            const now = Date.now();
            this._recentFinals = this._recentFinals.filter(r => now - r.ts < 3000);
            const isDupe = this._recentFinals.some(r => r.speaker === speaker && r.text === text);
            if (isDupe) return;
            this._recentFinals.push({ speaker, text, ts: now });
        }

        const container = this.shadowRoot.querySelector('.transcription-container');
        this._shouldScrollAfterUpdate = container ? container.scrollTop + container.clientHeight >= container.scrollHeight - 10 : false;

        const findLastPartialIdx = spk => {
            for (let i = this.sttMessages.length - 1; i >= 0; i--) {
                const m = this.sttMessages[i];
                if (m.speaker === spk && m.isPartial) return i;
            }
            return -1;
        };

        const newMessages = [...this.sttMessages];
        const targetIdx = findLastPartialIdx(speaker);

        if (isPartial) {
            if (targetIdx !== -1) {
                newMessages[targetIdx] = {
                    ...newMessages[targetIdx],
                    text,
                    isPartial: true,
                    isFinal: false,
                };
            } else {
                newMessages.push({
                    id: this.messageIdCounter++,
                    speaker,
                    text,
                    isPartial: true,
                    isFinal: false,
                });
            }
        } else if (isFinal) {
            if (targetIdx !== -1) {
                newMessages[targetIdx] = {
                    ...newMessages[targetIdx],
                    text,
                    isPartial: false,
                    isFinal: true,
                };
            } else {
                newMessages.push({
                    id: this.messageIdCounter++,
                    speaker,
                    text,
                    isPartial: false,
                    isFinal: true,
                });
            }
        }

        this.sttMessages = newMessages;
        
        // Notify parent component about message updates
        this.dispatchEvent(new CustomEvent('stt-messages-updated', {
            detail: { messages: this.sttMessages },
            bubbles: true
        }));
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.transcription-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    getSpeakerClass(speaker) {
        return speaker.toLowerCase() === 'me' ? 'me' : 'them';
    }

    getTranscriptText() {
        return this.sttMessages.map(msg => `${msg.speaker}: ${msg.text}`).join('\n');
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        if (changedProperties.has('sttMessages')) {
            if (this._shouldScrollAfterUpdate) {
                this.scrollToBottom();
                this._shouldScrollAfterUpdate = false;
            }
        }
    }

    render() {
        if (!this.isVisible) {
            return html`<div style="display: none;"></div>`;
        }

        const hasSelection = this.selectedIds.size > 0;

        return html`
            <div class="transcription-container">
                ${this.sttMessages.length === 0
                    ? html`<div class="empty-state">Waiting for speech...</div>`
                    : this.sttMessages.map(msg => {
                        const speakerClass = this.getSpeakerClass(msg.speaker);
                        const isSelected = this.selectedIds.has(msg.id);
                        return html`
                            <div class="message-wrapper ${speakerClass}">
                                <div
                                    class="stt-message ${speakerClass} ${isSelected ? 'selected' : ''}"
                                    @click=${() => this.toggleSelect(msg.id)}
                                    style="cursor:pointer"
                                >
                                    ${msg.text}
                                </div>
                                <div class="btn-group">
                                    <button
                                        class="search-btn"
                                        title="Пошук (без скріншота)"
                                        @click=${(e) => { e.stopPropagation(); this.searchText(msg.text); }}
                                    >🔍</button>
                                    <button
                                        class="screenshot-btn"
                                        title="Пошук + скріншот екрану"
                                        @click=${(e) => { e.stopPropagation(); this.searchTextWithScreenshot(msg.text); }}
                                    >📸</button>
                                </div>
                            </div>
                        `;
                    })
                }
            </div>
            ${hasSelection ? html`
                <div class="floating-search">
                    <button class="floating-search-btn" @click=${() => this.searchSelected()}
                        style="margin-right:6px">
                        🔍 Вибрані (${this.selectedIds.size})
                    </button>
                    <button class="floating-search-btn" @click=${() => this.searchSelectedWithScreenshot()}
                        style="background:rgba(80,180,80,0.9)">
                        📸 + скріншот
                    </button>
                </div>
            ` : ''}
        `;
    }
}

customElements.define('stt-view', SttView); 