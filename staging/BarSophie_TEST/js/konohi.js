// js/konohi.js
import { setListView } from './utils.js';
import * as nav from './navigation.js';

let _data = null;
let _loadPromise = null;
let _onBack = null;
let _pickerInput = null;

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
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _adjacentKey(key, delta) {
    const [m, d] = key.split('-').map(Number);
    const date = new Date(2000, m - 1, d + delta); // 2000: うるう年でFeb29が使える
    return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function _sortEntries(entries) {
    return [...entries].sort((a, b) => {
        const aBC = a.year.startsWith('BC');
        const bBC = b.year.startsWith('BC');
        if (!aBC && !bBC) return parseInt(b.year) - parseInt(a.year);
        if (aBC && bBC) return parseInt(a.year.slice(2)) - parseInt(b.year.slice(2)); // BC44 < BC660
        return aBC ? 1 : -1; // BC は末尾
    });
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
        <span id="${iconId}" style="color:#a0003a; font-size:0.85rem; flex-shrink:0;
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
                            margin-top:3px; font-weight:${hasDesc ? '500' : 'normal'};">
                    ${entry.title}
                </div>
            </div>
            ${toggleIcon}
        </div>
        ${descBlock}
    </div>`;
}

function _showDay(key) {
    const data = _data;
    const entries = _sortEntries(data[key] || []);
    const [month, day] = key.split('-').map(Number);

    const todayKey = _todayKey();
    const prevKey = _adjacentKey(key, -1);
    const nextKey = _adjacentKey(key, +1);

    window._konohiNav = (k) => _showDay(k);

    const cards = entries.length > 0
        ? entries.map((e, i) => _buildCard(e, i)).join('')
        : `<div style="color:#888; text-align:center; padding:32px 0; font-size:0.88rem;">この日のデータはありません</div>`;

    const todayBtn = key !== todayKey ? `
        <div style="text-align:center; margin-bottom:10px;">
            <button onclick="window._konohiNav('${todayKey}')"
                    style="background:#ffe0ec; color:#a0003a; border:1px solid #f0a0bf;
                           border-radius:20px; padding:4px 18px; font-size:0.78rem; cursor:pointer;">
                今日に戻る
            </button>
        </div>` : '';

    const html = `
        <div style="background:#e8f4f8; min-height:100%; padding:12px 12px 24px; box-sizing:border-box;">

            <div style="background:#ffe0ec; border-radius:10px; padding:9px 10px;
                        margin-bottom:14px; display:flex; align-items:center; gap:4px;">

                <button onclick="window._konohiNav('${prevKey}')"
                        style="background:none; border:none; color:#a0003a; font-size:1.15rem;
                               cursor:pointer; padding:0 6px; line-height:1; flex-shrink:0;
                               -webkit-tap-highlight-color:transparent;">◀</button>

                <div style="flex:1; text-align:center;">
                    <div id="kh-date-btn" style="cursor:pointer; display:inline-block;">
                        <span style="color:#a0003a; font-weight:bold; font-size:0.95rem;
                                     border-bottom:1px dotted #c0406080; line-height:1.5;">
                            ${month}月${day}日の出来事
                        </span>
                        <span style="font-size:0.68rem; color:#c04060; margin-left:3px;">📅</span>
                    </div>
                    <div style="color:#c04060; font-size:0.71rem; margin-top:1px;">
                        ${entries.length}件${entries.length > 0 ? ' ／ 説明ありはタップで展開' : ''}
                    </div>
                </div>

                <button onclick="window._konohiNav('${nextKey}')"
                        style="background:none; border:none; color:#a0003a; font-size:1.15rem;
                               cursor:pointer; padding:0 6px; line-height:1; flex-shrink:0;
                               -webkit-tap-highlight-color:transparent;">▶</button>
            </div>

            ${todayBtn}
            ${cards}
        </div>`;

    setListView(html, false);

    // iOS Safari 対応: body に hidden input を生成して .click() でトリガー
    if (_pickerInput && _pickerInput.parentNode) {
        _pickerInput.parentNode.removeChild(_pickerInput);
    }
    _pickerInput = document.createElement('input');
    _pickerInput.type = 'date';
    _pickerInput.style.display = 'none';
    _pickerInput.value = `2000-${key}`;
    document.body.appendChild(_pickerInput);
    _pickerInput.addEventListener('change', (e) => {
        if (!e.target.value) return;
        const parts = e.target.value.split('-');
        _showDay(`${parts[1]}-${parts[2]}`);
    });

    const dateBtn = document.getElementById('kh-date-btn');
    if (dateBtn) {
        dateBtn.addEventListener('click', () => _pickerInput.click());
    }
}

export async function showKonoHi(onBack) {
    nav.updateNav('konohi');
    _onBack = onBack;
    window._konohiBack = () => { if (typeof _onBack === 'function') _onBack(); };

    setListView(`
        <div style="background:#e8f4f8; min-height:100%; padding:16px; box-sizing:border-box;">
            <div style="color:#4a8caa; text-align:center; padding:40px; font-size:0.9rem;">読み込み中…</div>
        </div>`, false);

    await _load();
    _showDay(_todayKey());
}
