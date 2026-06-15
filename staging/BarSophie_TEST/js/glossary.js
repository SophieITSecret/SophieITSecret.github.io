// js/glossary.js
// Step1: 命式表の用語タップ → ポップアップ表示
// Step2 (将来): AI回答文の用語自動検出・ハイライト用API

let _data = null;
let _loadPromise = null;

export function loadGlossary() {
    if (_data) return Promise.resolve(_data);
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('./shichushisei_glossary_v3.json')
        .then(r => r.json())
        .then(d => { _data = d; return d; });
    return _loadPromise;
}

// 用語検索（同期。事前に loadGlossary() を await しておくこと）
// → { term, category, description } または null
export function lookupGlossary(term) {
    if (!_data || !term) return null;
    for (const [category, entries] of Object.entries(_data)) {
        if (Object.prototype.hasOwnProperty.call(entries, term)) {
            return { term, category, description: entries[term] };
        }
    }
    return null;
}

// 全用語リスト（Step2: AI回答文スキャン用）
// → [{ term, category }, ...]
export function getAllGlossaryTerms() {
    if (!_data) return [];
    return Object.entries(_data).flatMap(([category, entries]) =>
        Object.keys(entries).map(term => ({ term, category }))
    );
}

function _renderPopup(term, category, description) {
    const existing = document.getElementById('glossary-popup');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'glossary-popup';
    overlay.style.cssText = [
        'position:fixed', 'inset:0',
        'background:rgba(0,0,0,0.78)',
        'z-index:99998',
        'display:flex', 'align-items:center', 'justify-content:center',
        'padding:24px', 'box-sizing:border-box'
    ].join(';');

    overlay.innerHTML = `
        <div style="background:#111; border-radius:12px; border:2px solid #9b59b6;
                    max-width:320px; width:100%; padding:18px 20px;">
            <div style="color:#666; font-size:0.68rem; margin-bottom:4px; letter-spacing:1px;">${category}</div>
            <div style="color:#f0b56e; font-size:1.15rem; font-weight:bold; margin-bottom:10px;">${term}</div>
            <div style="color:#ddd; font-size:0.83rem; line-height:1.9;">${description}</div>
            <div style="color:#444; font-size:0.68rem; text-align:center; margin-top:16px;">タップして閉じる</div>
        </div>`;

    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
}

export async function showGlossaryPopup(term) {
    await loadGlossary();
    const result = lookupGlossary(term);
    if (!result) return;
    _renderPopup(result.term, result.category, result.description);
}

window.showGlossaryPopup = showGlossaryPopup;

export function showResultFullscreen(title, text) {
    const existing = document.getElementById('result-fullscreen');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'result-fullscreen';
    overlay.style.cssText = 'position:fixed;inset:0;background:#0a0a0a;z-index:99997;display:flex;flex-direction:column;box-sizing:border-box;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #333;background:#111;flex-shrink:0;';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#f0b56e;font-weight:bold;font-size:0.9rem;flex:1;';
    titleEl.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:1.6rem;cursor:pointer;line-height:1;padding:0 4px;-webkit-tap-highlight-color:transparent;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;color:#ddd;font-size:15px;line-height:1.8;';
    body.innerHTML = text;

    overlay.appendChild(header);
    overlay.appendChild(body);
    document.body.appendChild(overlay);
}

window.showResultFullscreen = showResultFullscreen;

export function showMeishikiHtmlFullscreen(html) {
    const existing = document.getElementById('meishiki-fullscreen');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'meishiki-fullscreen';
    overlay.style.cssText = 'position:fixed;inset:0;background:#0a0a0a;z-index:99997;display:flex;flex-direction:column;box-sizing:border-box;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #333;background:#111;flex-shrink:0;';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'color:#f0b56e;font-weight:bold;font-size:0.9rem;flex:1;';
    titleEl.textContent = '📊 命式表';

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;color:#888;font-size:1.6rem;cursor:pointer;line-height:1;padding:0 4px;-webkit-tap-highlight-color:transparent;';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => overlay.remove());

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px;line-height:1.8;';
    body.innerHTML = html;

    overlay.appendChild(header);
    overlay.appendChild(body);
    document.body.appendChild(overlay);
}

window.showMeishikiHtmlFullscreen = showMeishikiHtmlFullscreen;

let _guideData = null;
let _guideLoadPromise = null;

function _loadGuide() {
    if (_guideData) return Promise.resolve(_guideData);
    if (_guideLoadPromise) return _guideLoadPromise;
    _guideLoadPromise = fetch('./meishiki_guide.json')
        .then(r => r.json())
        .then(d => { _guideData = d; return d; });
    return _guideLoadPromise;
}

function _renderGuideSection(sec) {
    let html = `
        <div style="margin-bottom:22px;">
            <div style="color:#f0b56e; font-size:0.85rem; font-weight:bold; margin-bottom:8px;
                        padding-bottom:5px; border-bottom:1px solid #333;">${sec.title}</div>
            <div style="color:#ccc; font-size:0.82rem; line-height:1.9;">${sec.content}</div>`;

    if (sec.items) {
        html += '<div style="margin-top:10px;">';
        for (const item of sec.items) {
            html += `
            <div style="display:flex; gap:8px; margin-bottom:6px; padding:6px 10px;
                        background:#1a1a2a; border-radius:4px; align-items:flex-start;">
                <span style="color:#9b59b6; font-weight:bold; font-size:0.8rem;
                             white-space:nowrap; min-width:2em;">${item.label}</span>
                <span style="color:#aaa; font-size:0.78rem; line-height:1.7;">${item.desc}</span>
            </div>`;
        }
        html += '</div>';
    }

    if (sec.steps) {
        html += '<div style="margin-top:10px;">';
        for (const s of sec.steps) {
            html += `
            <div style="display:flex; gap:10px; margin-bottom:10px; align-items:flex-start;">
                <div style="background:#9b59b6; color:#fff; border-radius:50%;
                            width:20px; height:20px; min-width:20px; display:flex;
                            align-items:center; justify-content:center;
                            font-size:0.7rem; font-weight:bold;">${s.step}</div>
                <div>
                    <div style="color:#f0b56e; font-size:0.8rem; font-weight:bold; margin-bottom:2px;">${s.label}</div>
                    <div style="color:#aaa; font-size:0.78rem; line-height:1.7;">${s.desc}</div>
                </div>
            </div>`;
        }
        html += '</div>';
    }

    if (sec.tips) {
        html += '<ul style="margin:10px 0 0 0; padding-left:18px;">';
        for (const tip of sec.tips) {
            html += `<li style="color:#aaa; font-size:0.78rem; line-height:1.8; margin-bottom:4px;">${tip}</li>`;
        }
        html += '</ul>';
    }

    html += '</div>';
    return html;
}

export async function showMeishikiGuide() {
    const guide = await _loadGuide();
    const existing = document.getElementById('meishiki-guide-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'meishiki-guide-modal';
    overlay.style.cssText = [
        'position:fixed', 'inset:0',
        'background:#0a0a0a',
        'z-index:99997',
        'display:flex', 'flex-direction:column',
        'box-sizing:border-box'
    ].join(';');

    const gHeader = document.createElement('div');
    gHeader.style.cssText = 'display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid #333;background:#111;flex-shrink:0;';
    const gTitle = document.createElement('div');
    gTitle.style.cssText = 'color:#f0b56e;font-weight:bold;font-size:0.9rem;flex:1;';
    gTitle.textContent = `📖 ${guide.title}`;
    const gClose = document.createElement('button');
    gClose.style.cssText = 'background:none;border:none;color:#888;font-size:1.6rem;cursor:pointer;line-height:1;padding:0 4px;-webkit-tap-highlight-color:transparent;';
    gClose.textContent = '✕';
    gClose.addEventListener('click', () => overlay.remove());
    gHeader.appendChild(gTitle);
    gHeader.appendChild(gClose);
    const gBody = document.createElement('div');
    gBody.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px;';
    gBody.innerHTML = guide.sections.map(_renderGuideSection).join('');
    overlay.appendChild(gHeader);
    overlay.appendChild(gBody);
    document.body.appendChild(overlay);
}

window.showMeishikiGuide = showMeishikiGuide;
