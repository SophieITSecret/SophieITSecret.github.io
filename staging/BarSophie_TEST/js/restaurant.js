// js/restaurant.js
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwA1C22UhKroCFC_EPC-ugR5efyXVHlbkWywfD21HfD3-J4vm-b4ZjvIshO-i3fKk9W/exec';

function formatResult(text) {
    console.log('RAW:', text);
    text = text
        .replace(/^-{2,}$/gm, '')
        .replace(/^\*{1,2}$/gm, '')
        .replace(/^#{1,3}\s*/gm, '')
        .replace(/https?:\/\/tabelog\.com\/[^\s<\n]*/g, '')
        .replace(/食べログURL[：:]\s*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    text = text.replace(/(店舗名[：:]\s*)(<strong>)?([^<\n]+?)(<\/strong>)?(\s*<br>|$)/g,
        (match, label, s1, name, s2, end) => {
            const storeName = name.trim();
            const btn = `<button onclick="
                navigator.clipboard.writeText('${storeName.replace(/'/g, "\\'")}')
                .then(() => { 
                    window.open('https://tabelog.com/rstLst/RST/?vs=1&sa=${encodeURIComponent('吉祥寺')}&sk=', '_blank');
                    alert('「${storeName.replace(/'/g, "\\'")}」をコピーしました。食べログの検索窓に貼り付けてください。');
                })
                .catch(() => window.open('https://tabelog.com/', '_blank'));"
                style="background:#1a3a2a; color:#7fd97f; border:1px solid #3a6a4a;
                padding:2px 10px; border-radius:4px; font-size:0.75rem;
                margin-left:6px; cursor:pointer;">📖 食べログで検索</button>`;
            return `${label}<strong>${storeName}</strong>${btn}${end}`;
        });

    return text.replace(/\n/g, '<br>');
}

export function showRestaurantSearch() {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const prevHtml = lv ? lv.innerHTML : '';
    const prevDisplay = lv ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const row = (label, id, placeholder, type = 'input') => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <div style="color:#aaa; font-size:0.75rem; min-width:48px; text-align:right; flex-shrink:0;">${label}</div>
            ${type === 'input'
                ? `<input type="text" id="${id}" placeholder="${placeholder}"
                    style="flex:1; background:#000; border:1px solid #555; color:#fff;
                           height:38px; padding:0 10px; border-radius:4px; font-size:0.85rem;">`
                : `<textarea id="${id}" rows="2" placeholder="${placeholder}"
                    style="flex:1; background:#000; border:1px solid #555; color:#fff;
                           padding:6px 10px; border-radius:4px; font-size:0.85rem;
                           resize:none; font-family:inherit;"></textarea>`
            }
        </div>`;

    const formHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                いいお店を探す
            </div>
            <div style="padding:10px;">
                ${row('エリア', 'rs-area', '吉祥寺、三鷹駅周辺')}
                ${row('ジャンル', 'rs-genre', 'イタリアン、居酒屋、何でも')}
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; min-width:48px; text-align:right; flex-shrink:0;">予算感</div>
                    <div style="display:flex; gap:4px; flex:1;">
                        <button class="rs-budget" data-val="コスパ重視"
                            style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.75rem;">コスパ重視</button>
                        <button class="rs-budget" data-val="リーズナブル"
                            style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.75rem;">リーズナブル</button>
                        <button class="rs-budget" data-val="予算は気にしない"
                            style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.75rem; line-height:1.2;">予算は<br>気にしない</button>
                    </div>
                </div>
                ${row('こだわり', 'rs-point', '静かで落ち着ける、ワインが充実、デート向き', 'textarea')}
                <button id="rs-search" style="width:100%; background:#0096BF; color:#ff69b4;
                    border:2px solid #ff51a8; height:44px; border-radius:4px;
                    font-size:0.95rem; font-weight:bold; margin-bottom:8px;">
                    ソフィーに探してもらう
                </button>
                <button id="rs-close" style="width:100%; background:#34495e; color:#fff;
                    border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let selectedBudget = '';
    document.querySelectorAll('.rs-budget').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.rs-budget').forEach(b => {
                b.style.background = '#1a1a1a';
                b.style.color = '#888';
                b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF';
            btn.style.color = '#fff';
            btn.style.borderColor = '#00d2ff';
            selectedBudget = btn.dataset.val;
        });
    });

    document.getElementById('rs-close').onclick = () => {
        if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
        if (nm) nm.style.display = prevNm;
    };

    document.getElementById('rs-search').onclick = async () => {
        const area = document.getElementById('rs-area').value.trim();
        if (!area) { alert('エリアを入力してください'); return; }

        const genre = document.getElementById('rs-genre').value.trim();
        const point = document.getElementById('rs-point').value.trim();

        const btn = document.getElementById('rs-search');
        btn.textContent = '探しています…';
        btn.disabled = true;

        const prompt = `あなたはBARソフィーのソフィー、さわやかで知性的な若手バーテンダーです。
お客様から飲食店の相談を受けました。Web検索で実在する店舗を調べた上で推薦してください。

【条件】
エリア：${area}
ジャンル：${genre || '指定なし'}
予算感：${selectedBudget || '指定なし'}
こだわり・希望：${point || '指定なし'}

【回答形式】
第1候補と第2候補を推薦。各店舗：
・店舗名
・住所・アクセス
・概容（60字以内）
・選定理由（120字以内）
・ディナー予算目安
・食べログURL（実在するもののみ）

最後にソフィーらしい短いひとことを添えてください。
存在しない店は絶対に挙げないこと。`;

        const messages = [{ role: 'user', content: prompt }];
        const url = GAS_URL + '?messages=' + encodeURIComponent(JSON.stringify(messages));

        try {
            const res = await fetch(url);
            const data = await res.json();

            const resultHtml = `
                <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                            background: linear-gradient(#111, #111) padding-box,
                            linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                    <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                                border-bottom:1px solid #333; height:28px; line-height:28px;
                                border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                        <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                        ソフィーのおすすめ
                    </div>
                    <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.8;">${data.ok ? formatResult(data.text) : 'エラーが発生しました。もう一度お試しください。'}</div>
                    <div style="padding:0 10px 10px;">
                        <button id="rs-retry" style="width:100%; background:#1a3a2a; color:#7fd97f;
                            border:1px solid #3a6a4a; height:40px; border-radius:4px;
                            font-size:0.85rem; margin-bottom:6px;">条件を変えて再検索</button>
                        <button id="rs-done" style="width:100%; background:#34495e; color:#fff;
                            border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
                    </div>
                </div>`;

            if (lv) { lv.innerHTML = resultHtml; }

            document.getElementById('rs-retry').onclick = () => showRestaurantSearch();
            document.getElementById('rs-done').onclick = () => {
                if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
                if (nm) nm.style.display = prevNm;
            };

        } catch (e) {
            alert('通信エラーが発生しました。');
            btn.textContent = 'ソフィーに探してもらう';
            btn.disabled = false;
        }
    };
}