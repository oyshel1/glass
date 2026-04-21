import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { parser, parser_write, parser_end, default_renderer } from '../../assets/smd.js';

export class LiveQAView extends LitElement {
    static styles = css`
        :host {
            display: block;
            width: 100%;
        }

        .container {
            padding: 10px 16px 16px 16px;
            min-height: 120px;
            max-height: 600px;
            overflow-y: auto;
            box-sizing: border-box;
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
            width: 24px;
            height: 24px;
            font-size: 16px;
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
            color: rgba(255,255,255,0.55);
            min-width: 34px;
            text-align: center;
        }
        .counter.answered { color: rgba(100,220,100,0.75); }

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
            color: rgba(255,200,80,0.85);
            font-style: italic;
        }

        .question-box {
            background: rgba(255,255,255,0.06);
            border-left: 2px solid rgba(255,255,255,0.25);
            border-radius: 0 6px 6px 0;
            padding: 7px 10px;
            margin-bottom: 12px;
        }

        .q-label {
            font-size: 9px;
            color: rgba(255,255,255,0.4);
            display: block;
            margin-bottom: 3px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }

        .q-text {
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            line-height: 1.4;
            word-wrap: break-word;
        }

        .answer-content {
            color: #f0f0f0;
            font-size: 13px;
            line-height: 1.6;
            word-wrap: break-word;
            user-select: text;
            cursor: text;
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            align-items: center;
            padding: 8px 0;
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

        /* ── Markdown content ── */
        .answer-content p { margin: 0 0 10px 0; }
        .answer-content p:last-child { margin-bottom: 0; }

        .answer-content ul,
        .answer-content ol {
            margin: 6px 0 10px 0;
            padding-left: 20px;
        }
        .answer-content li {
            margin: 4px 0;
            line-height: 1.55;
        }
        .answer-content li:last-child { margin-bottom: 0; }

        .answer-content strong {
            font-weight: 700;
            color: #ffffff;
        }
        .answer-content em {
            font-style: italic;
            color: #f1fa8c;
        }

        .answer-content code {
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 11px;
            background: rgba(255,255,255,0.12);
            padding: 2px 5px;
            border-radius: 4px;
            color: #ffd700;
        }

        .answer-content pre {
            background: rgba(0,0,0,0.45);
            border-radius: 7px;
            padding: 12px 14px;
            margin: 10px 0;
            overflow-x: auto;
            border: 1px solid rgba(255,255,255,0.1);
        }
        .answer-content pre code {
            background: transparent;
            padding: 0;
            color: #f8f8f2;
            font-size: 11px;
            white-space: pre;
            word-wrap: normal;
        }

        .answer-content h1,
        .answer-content h2,
        .answer-content h3 {
            color: rgba(255,255,255,0.95);
            margin: 14px 0 6px 0;
            font-size: 13px;
            font-weight: 600;
        }
        .answer-content h1:first-child,
        .answer-content h2:first-child,
        .answer-content h3:first-child { margin-top: 0; }

        .answer-content blockquote {
            border-left: 3px solid rgba(255,255,255,0.3);
            margin: 8px 0;
            padding: 4px 10px;
            color: rgba(255,255,255,0.7);
        }

        .answer-content a { color: #8be9fd; text-decoration: none; }
        .answer-content a:hover { text-decoration: underline; }

        /* hljs overrides */
        .hljs-keyword { color: #ff79c6; }
        .hljs-string  { color: #f1fa8c; }
        .hljs-comment { color: #6272a4; }
        .hljs-number  { color: #bd93f9; }
        .hljs-function, .hljs-title { color: #50fa7b; }
        .hljs-variable, .hljs-built_in { color: #8be9fd; }
        .hljs-attr    { color: #50fa7b; }
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
        this.hljs = null;
        this._smdParser = null;
        this._smdContainer = null;
        this._smdLastLength = 0;
        this._renderedEntryId = null;
        this._renderedEntryComplete = false;
        this._loadHljs();
    }

    connectedCallback() {
        super.connectedCallback();
        if (window.api) {
            window.api.liveQAView.onLiveQAUpdate((event, data) => {
                this.qaHistory = data.history || [];
                this.currentIndex = data.currentIndex ?? -1;
                this.requestUpdate();
                this.updateComplete.then(() => {
                    this.dispatchEvent(new CustomEvent('liveqa-updated', { bubbles: true }));
                });
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
        const entry = this.currentIndex >= 0 ? this.qaHistory[this.currentIndex] : null;
        if (!entry) return '';
        return `Питання: ${entry.questionText}\n\nВідповідь:\n${entry.answer}`;
    }

    reset() {
        this.qaHistory = [];
        this.currentIndex = -1;
        this._smdParser = null;
        this._smdContainer = null;
        this._smdLastLength = 0;
        this._renderedEntryId = null;
        this._renderedEntryComplete = false;
        this.requestUpdate();
    }

    _truncateQuestion(text) {
        if (!text) return '';
        // Split on sentence-ending punctuation; keep first 2 sentences
        const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g);
        if (sentences && sentences.length >= 2) {
            const two = sentences.slice(0, 2).join('').trimEnd();
            if (two.length < text.trimEnd().length) return two + ' …';
        }
        // Fallback: hard truncate at 200 chars
        if (text.length > 200) return text.slice(0, 200).trimEnd() + ' …';
        return text;
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
                    <span class="q-text">${this._truncateQuestion(entry.questionText)}</span>
                </div>

                <div class="answer-box">
                    ${entry.isLoading && !entry.answer
                        ? html`<div class="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>`
                        : html`<div class="answer-content"></div>`}
                </div>
            </div>
        `;
    }

    updated() {
        super.updated();
        this._renderAnswer();
    }

    _renderAnswer() {
        const total = this.qaHistory.length;
        const entry = this.currentIndex >= 0 && this.currentIndex < total
            ? this.qaHistory[this.currentIndex]
            : null;

        if (!entry || (entry.isLoading && !entry.answer)) return;

        const container = this.shadowRoot?.querySelector('.answer-content');
        if (!container) return;

        // Different entry — reset SMD state and clear container
        if (this._renderedEntryId !== entry.id) {
            this._renderedEntryId = entry.id;
            this._smdParser = null;
            this._smdContainer = null;
            this._smdLastLength = 0;
            this._renderedEntryComplete = false;
            container.innerHTML = '';
        }

        if (!entry.answer) return;

        // If DOM was rebuilt (e.g. tab switch), container is empty — force re-render
        if (this._renderedEntryComplete && container.children.length === 0) {
            this._renderedEntryComplete = false;
            this._smdParser = null;
            this._smdLastLength = 0;
        }
        if (this._renderedEntryComplete) return;

        // Completed entry (navigated to old answer or just finished) — render full text
        if (!entry.isLoading && this._smdParser === null) {
            container.innerHTML = '';
            const renderer = default_renderer(container);
            const p = parser(renderer);
            parser_write(p, entry.answer);
            parser_end(p);
            this._applyHljs(container);
            this._renderedEntryComplete = true;
            return;
        }

        // Streaming entry — feed delta to SMD parser
        if (!this._smdParser) {
            container.innerHTML = '';
            const renderer = default_renderer(container);
            this._smdParser = parser(renderer);
            this._smdContainer = container;
            this._smdLastLength = 0;
        }

        const newText = entry.answer.slice(this._smdLastLength);
        if (newText.length > 0) {
            parser_write(this._smdParser, newText);
            this._smdLastLength = entry.answer.length;
        }

        if (!entry.isLoading) {
            parser_end(this._smdParser);
            this._smdParser = null;
            this._applyHljs(container);
            this._renderedEntryComplete = true;
        }
    }

    _applyHljs(container) {
        if (!this.hljs) return;
        container.querySelectorAll('pre code').forEach(block => {
            if (!block.hasAttribute('data-highlighted')) {
                try { this.hljs.highlightElement(block); } catch {}
                block.setAttribute('data-highlighted', 'true');
            }
        });
    }

    async _loadHljs() {
        try {
            if (!window.hljs) await this._loadScript('../../assets/highlight-11.9.0.min.js');
            this.hljs = window.hljs;
        } catch (err) {
            console.warn('[LiveQAView] hljs load failed:', err);
        }
    }

    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
}

customElements.define('live-qa-view', LiveQAView);
