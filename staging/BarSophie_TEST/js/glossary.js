// js/glossary.js
// Step1: 命式表の用語タップ → ポップアップ表示
// Step2 (将来): AI回答文の用語自動検出・ハイライト用API

let _data = null;
let _loadPromise = null;

export function loadGlossary() {
    if (_data) return Promise.resolve(_data);
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('./shichushisei_glossary_v2.json')
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
