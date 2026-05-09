// js/restaurant.js
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwA1C22UhKroCFC_EPC-ugR5efyXVHlbkWywfD21HfD3-J4vm-b4ZjvIshO-i3fKk9W/exec';

function formatResult(text) {
    const startIdx = text.search(/こんばんは|いらっしゃいませ|さわやかなソフィー|ソフィーです。/);
    if (startIdx > 0) text = text.slice(startIdx);

    text = text.replace(/食べログURL[：:][^\n]*/g, '');
    text = text.replace(/https?:\/\/tabelog\.com\/[^\s\n]*/g, '');
    text = text.replace(/^-{2,}$/gm, '');
    text = text.replace(/^#{1,3}\s*/gm, '');
    text = text.replace(/（約?\d+字(以内|程度)?）/g, '');
    text = text.replace(/\(約?\d+字(以内|程度)?\)/g, '');

    // **太字**を先に変換してからタイトル処理
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 候補タイトル処理
    let candidateIdx = 0;
    text = text.replace(/[【\[]?(第[1-2１２]候補)[】\]]?[：:\s]*([^\n]+)/g, (match, num, name) => {
        const idx = candidateIdx++;
        const msgId = `rs-msg-${idx}`;
        // HTMLタグ・括弧読み仮名を除去して検索用テキストを作成
        const searchName = name.trim()
            .replace(/<[^>]*>/g, '')
            .replace(/[（(][^）)]*[）)]/g, '')
            .trim();
        const enc = encodeURIComponent(searchName);
        const esc = searchName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const btn = `<button onclick="(function(){var m=document.getElementById('${msgId}');if(m)m.style.display='block';window.open('https://tabelog.com/rstLst/RST/?vs=1&sk=${enc}','_blank');navigator.clipboard.writeText('${esc}').catch(function(){});setTimeout(function(){var m=document.getElementById('${msgId}');if(m)m.style.display='none';},5000);})()" style="background:#1a3a2a;color:#7fd97f;border:1px solid #3a6a4a;padding:2px 10px;border-radius:4px;font-size:0.75rem;margin-left:8px;cursor:pointer;">📖 食べログで検索</button><div id="${msgId}" style="display:none;margin-top:4px;padding:6px 10px;background:#1a2a1a;color:#7fd97f;border:1px solid #3a6a4a;border-radius:4px;font-size:0.75rem;line-height:1.5;">「${esc}」をコピーしました。<br>食べログが開いたら検索窓に貼り付けて探してください。</div>`;
        return `<span style="color:#f0b56e;font-weight:bold;">◆${num}：${name.trim()}</span>${btn}`;
    });

    text = text.replace(/(\*\*[^*]+\*\*)\s*\n+\s*\n+/g, '$1\n');
    text = text.replace(/(\*\*[^*]+\*\*)[ \t]+\n/g, '$1\n');
    text = text.replace(/([^\n。！？])\n([^\n◆\-])/g, '$1$2');
    text = text.replace(/(<\/strong>)([^\s<\n])/g, '$1 $2');
    text = text.replace(/\n{2,}/g, '\n');

    return text.trim().replace(/\n/g, '<br>');
}

export function showRestaurantSearch(savedArea = '', savedGenre = '', savedBudget = '', savedPoint = '') {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const prevHtml = lv ? lv.innerHTML : '';
    const prevDisplay = lv ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const row = (label, id, placeholder, type = 'input', val = '') => `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
            <div style="color:#aaa; font-size:0.75rem; min-width:48px; text-align:right; flex-shrink:0;">${label}</div>
            ${type === 'input'
                ? `<input type="text" id="${id}" placeholder="${placeholder}" value="${val}"
                    style="flex:1; background:#000; border:1px solid #555; color:#fff;
                           height:38px; padding:0 10px; border-radius:4px; font-size:0.85rem;">`
                : `<textarea id="${id}" rows="2" placeholder="${placeholder}"
                    style="flex:1; background:#000; border:1px solid #555; color:#fff;
                           padding:6px 10px; border-radius:4px; font-size:0.85rem;
                           resize:none; font-family:inherit;">${val}</textarea>`
            }
        </div>`;

    const budgetBtns = ['コスパ重視', 'リーズナブル', '予算は気にしない'].map(v => {
        const selected = v === savedBudget;
        return `<button class="rs-budget" data-val="${v}"
            style="flex:1; background:${selected ? '#0096BF' : '#1a1a1a'}; color:${selected ? '#fff' : '#888'};
                   border:1px solid ${selected ? '#00d2ff' : '#444'};
                   height:36px; border-radius:4px; font-size:0.75rem; line-height:1.2;">${v.replace('予算は気にしない', '予算は<br>気にしない')}</button>`;
    }).join('');

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
                ${row('エリア', 'rs-area', '吉祥寺、三鷹駅周辺', 'input', savedArea)}
                ${row('ジャンル', 'rs-genre', 'イタリアン、居酒屋、何でも', 'input', savedGenre)}
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; min-width:48px; text-align:right; flex-shrink:0;">予算感</div>
                    <div style="display:flex; gap:4px; flex:1;">${budgetBtns}</div>
                </div>
                ${row('こだわり', 'rs-point', '静かで落ち着ける、ワインが充実、デート向き', 'textarea', savedPoint)}
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

    let selectedBudget = savedBudget;
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
第1候補と第2候補を推薦。各店舗について以下の順で記載：
・第1候補：店舗名（例：第1候補：トラットリア〇〇）
・住所・アクセス
・概要　※お客様がわかりやすいよう詳しく
・選定理由　※なぜこの店を選んだか具体的に
・ディナー予算目安

最後にソフィーらしい短いひとことを添えてください。
食べログURLは記載不要。存在しない店は絶対に挙げないこと。`;

        const messages = [{ role: 'user', content: prompt }];
        const url = GAS_URL + '?messages=' + encodeURIComponent(JSON.stringify(messages)) + '&search=true';

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

            document.getElementById('rs-retry').onclick = () => showRestaurantSearch(area, genre, selectedBudget, point);
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