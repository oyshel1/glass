import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class LiveQAView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
        }

        .container {
            padding: 12px 16px 16px 16px;
            min-height: 120px;
            max-height: 580px;
            overflow-y: auto;
        }

        .container::-webkit-scrollbar { width: 6px; }
        .container::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 3px; }
        .container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 3px; }

        .empty-state {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100px;
            color: rgba(255,255,255,0.5);
            font-size: 12px;
            font-style: italic;
        }

        .nav-bar {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 10px;
        }

        .nav-btn {
            background: rgba(255,255,255,0.1);
            border: none;
            color: rgba(255,255,255,0.8);
            border-radius: 4px;
            width: 22px;
            height: 22px;
            font-size: 14px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            transition: background 0.15s;
            line-height: 1;
        }
        .nav-btn:hover:not(:disabled) { background: rgba(255,255,255,0.2); }
        .nav-btn:disabled { opacity: 0.3; cursor: default; }

        .counter {
            font-size: 11px;
            color: rgba(255,255,255,0.6);
            min-width: 32px;
            text-align: center;
        }
        .counter.answered { color: rgba(100,220,100,0.8); }

        .live-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #ff5f5f;
            animation: pulse 1.4s ease-in-out infinite;
            flex-shrink: 0;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
        }

        .analyzing-label {
            font-size: 10px;
            color: rgba(255,200,80,0.8);
            font-style: italic;
        }

        .question-box {
            background: rgba(255,255,255,0.06);
            border-left: 2px solid rgba(255,255,255,0.3);
            border-radius: 0 6px 6px 0;
            padding: 7px 10px;
            margin-bottom: 10px;
        }

        .q-label {
            font-size: 10px;
            color: rgba(255,255,255,0.45);
            display: block;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .q-text {
            font-size: 12px;
            color: rgba(255,255,255,0.75);
            line-height: 1.4;
            word-wrap: break-word;
        }

        .answer-box {
            color: #ffffff;
            font-size: 12px;
            line-height: 1.5;
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 4px 0;
        }
        .typing-indicator span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: rgba(255,255,255,0.5);
            animation: bounce 1.2s ease-in-out infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); }
            40% { transform: translateY(-6px); }
        }

        /* Markdown styles */
        .markdown-content p { margin: 4px 0 8px 0; }
        .markdown-content ul, .markdown-content ol { margin: 4px 0; padding-left: 18px; }
        .markdown-content li { margin: 3px 0; }
        .markdown-content strong { font-weight: 600; color: #f8f8f2; }
        .markdown-content em { font-style: italic; color: #f1fa8c; }
        .markdown-content code {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 11px;
            background: rgba(255,255,255,0.1);
            padding: 1px 4px;
            border-radius: 3px;
            color: #ffd700;
        }
        .markdown-content pre {
            background: rgba(0,0,0,0.4);
            border-radius: 6px;
            padding: 10px 12px;
            margin: 6px 0;
            overflow-x: auto;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .markdown-content pre code {
            background: transparent;
            padding: 0;
            color: #f8f8f2;
        }
        .markdown-content h1, .markdown-content h2, .markdown-content h3 {
            color: rgba(255,255,255,0.9);
            margin: 8px 0 4px 0;
            font-size: 13px;
        }
    `;

    static properties = {
        qaHistory: { type: Array },
        currentIndex: { type: Number },
        isVisible: { type: Boolean },
    };

    constructor() {
        super();
        this.qaHistory = [];
        this.currentIndex = -1;
        this.isVisible = true;
        this.marked = null;
        this.DOMPurify = null;
        this.isLibrariesLoaded = false;
        this._loadLibraries();
    }

    connectedCallback() {
        super.connectedCallback();
        if (window.api) {
            window.api.liveQAView.onLiveQAUpdate((event, data) => {
                this.qaHistory = data.history || [];
                this.currentIndex = data.currentIndex ?? -1;
                this.requestUpdate();
                this.updateComplete.then(() => this._renderMarkdown());
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.api) {
            window.api.liveQAView.removeLiveQAUpdateListeners();
        }
    }

    navigate(direction) {
        if (window.api) {
            window.api.liveQAView.navigate(direction);
        }
    }

    getQAText() {
        if (this.qaHistory.length === 0) return '';
        const entry = this.qaHistory[this.currentIndex];
        if (!entry) return '';
        return `Питання: ${entry.questionText}\n\nВідповідь:\n${entry.answer}`;
    }

    reset() {
        this.qaHistory = [];
        this.currentIndex = -1;
        this.requestUpdate();
    }

    render() {
        if (!this.isVisible) return html`<div style="display:none"></div>`;

        const total = this.qaHistory.length;
        const entry = this.currentIndex >= 0 && this.currentIndex < total
            ? this.qaHistory[this.currentIndex]
            : null;

        if (!entry) {
            return html`
                <div class="container">
                    <div class="empty-state">Очікую питання від інтерв'юера...</div>
                </div>`;
        }

        const isLatest = this.currentIndex === total - 1;

        return html`
            <div class="container">
                <div class="nav-bar">
                    <button class="nav-btn" ?disabled=${this.currentIndex <= 0}
                        @click=${() => this.navigate(-1)}>‹</button>
                    <span class="counter ${entry.isAnswered ? 'answered' : ''}">
                        ${this.currentIndex + 1}/${total}${entry.isAnswered ? ' ✓' : ''}
                    </span>
                    <button class="nav-btn" ?disabled=${this.currentIndex >= total - 1}
                        @click=${() => this.navigate(1)}>›</button>
                    ${isLatest && entry.isLoading
                        ? html`<span class="analyzing-label">⏳ Думаю...</span>`
                        : ''}
                    ${isLatest && !entry.isAnswered && !entry.isLoading
                        ? html`<span class="live-dot"></span>`
                        : ''}
                </div>

                <div class="question-box">
                    <span class="q-label">Питання інтерв'юера</span>
                    <span class="q-text">${entry.questionText}</span>
                </div>

                <div class="answer-box">
                    ${entry.isLoading && !entry.answer
                        ? html`<div class="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>`
                        : html`<div class="markdown-content"
                                data-qa-id="${entry.id}">${entry.answer}</div>`}
                </div>
            </div>
        `;
    }

    updated() {
        super.updated();
        this._renderMarkdown();
    }

    _renderMarkdown() {
        if (!this.isLibrariesLoaded || !this.marked) return;
        const els = this.shadowRoot?.querySelectorAll('.markdown-content[data-qa-id]');
        els?.forEach(el => {
            const rawText = el.textContent || '';
            if (!rawText.trim()) return;
            try {
                let parsed = this.marked(rawText);
                if (this.DOMPurify) parsed = this.DOMPurify.sanitize(parsed);
                el.innerHTML = parsed;
            } catch {}
        });
    }

    async _loadLibraries() {
        try {
            if (!window.marked) await this._loadScript('../../../assets/marked-4.3.0.min.js');
            if (!window.DOMPurify) await this._loadScript('../../../assets/dompurify-3.0.7.min.js');
            this.marked = window.marked;
            this.DOMPurify = window.DOMPurify;
            if (this.marked) {
                this.marked.setOptions({ breaks: true, gfm: true });
                this.isLibrariesLoaded = true;
            }
        } catch (err) {
            console.warn('[LiveQAView] Markdown libs failed to load:', err);
        }
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
}

customElements.define('live-qa-view', LiveQAView);
