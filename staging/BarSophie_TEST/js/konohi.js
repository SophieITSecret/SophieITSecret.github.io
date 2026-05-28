// js/konohi.js
import { setListView } from './utils.js';
import * as nav from './navigation.js';

let _data = null;
let _loadPromise = null;

function _load() {
    if (_data) return Promise.resolve(_data);
    if (_loadPromise) return _loadPromise;
    _loadPromise = fetch('./this_day_history.json')
        .then(r => r.json())
        .then(d => { _data = d; return d; });
    return _loadPromise;
}

function _todayKey() {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}-${day}`;
}

function _buildCard(entry, idx) {
    const hasDesc = !!entry.description;
    const descId = `kh-desc-${idx}`;
    const iconId = `kh-icon-${idx}`;

    const descBlock = hasDesc ? `
        <div id="${descId}" style="color:#3a5a6a; font-size:0.8rem; line-height:1.85;
                    margin-top:10px; padding-top:10px; border-top:1px solid #c8e4ef; display:none;">
            ${entry.description}
        </div>` : '';

    const toggleIcon = hasDesc ? `
        <span id="${iconId}" style="color:#4a8caa; font-size:0.85rem; flex-shrink:0;
                    padding-left:10px; padding-top:2px; user-select:none;">▼</span>` : '';

    const cardClick = hasDesc
        ? `onclick="(function(){
            var d=document.getElementById('${descId}');
            var i=document.getElementById('${iconId}');
            var open=d.style.display==='block';
            d.style.display=open?'none':'block';
            i.textContent=open?'▼':'▲';
           })()"
           style="cursor:pointer;"`
        : `style="cursor:default;"`;

    return `
    <div ${cardClick}
         style="background:#fff; border-radius:10px;
                box-shadow:0 1px 5px rgba(26,42,58,0.10), 0 0 0 1px rgba(26,42,58,0.04);
                margin-bottom:10px; padding:13px 15px; user-select:none;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div style="flex:1;">
                <span style="color:#1a6a9a; font-weight:bold; font-size:0.78rem;
                             letter-spacing:0.5px;">${entry.year}年</span>
                <div style="color:#1a2a3a; font-size:0.875rem; line-height:1.55;
                            margin-top:3px; font-weight:${entry.description ? '500' : 'normal'};">
                    ${entry.title}
                </div>
            </div>
            ${toggleIcon}
        </div>
        ${descBlock}
    </div>`;
}

export async function showKonoHi(onBack) {
    nav.updateNav('konohi');

    window._konohiBack = () => {
        if (typeof onBack === 'function') onBack();
    };

    const key = _todayKey();
    const [month, day] = key.split('-').map(Number);

    const loadingHtml = `
        <div style="background:#e8f4f8; min-height:100%; padding:16px; box-sizing:border-box;">
            <div style="color:#4a8caa; text-align:center; padding:40px; font-size:0.9rem;">読み込み中…</div>
        </div>`;
    setListView(loadingHtml, false);

    const data = await _load();
    const entries = data[key] || [];

    if (entries.length === 0) {
        const emptyHtml = `
            <div style="background:#e8f4f8; min-height:100%; padding:16px; box-sizing:border-box;">
                <div style="color:#1a2a3a; font-size:1rem; font-weight:bold; text-align:center; padding:40px 0;">
                    ${month}月${day}日のデータはありません
                </div>
            </div>`;
        setListView(emptyHtml, false);
        return;
    }

    const cards = entries.map((e, i) => _buildCard(e, i)).join('');

    const html = `
        <div style="background:#e8f4f8; min-height:100%; padding:12px 12px 24px; box-sizing:border-box;">
            <div style="display:flex; align-items:center; gap:8px;
                        background:#1a6a9a; border-radius:10px;
                        padding:10px 14px; margin-bottom:14px;">
                <span style="font-size:1.1rem;">📅</span>
                <div>
                    <div style="color:#fff; font-weight:bold; font-size:0.95rem; line-height:1.3;">
                        ${month}月${day}日の出来事
                    </div>
                    <div style="color:#b8d8ea; font-size:0.72rem; margin-top:1px;">
                        ${entries.length}件 ／ 説明ありはタップで展開
                    </div>
                </div>
            </div>
            ${cards}
        </div>`;

    setListView(html, false);
}
