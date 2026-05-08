// js/compatibility.js
import { showPeopleBook } from './people.js';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwA1C22UhKroCFC_EPC-ugR5efyXVHlbkWywfD21HfD3-J4vm-b4ZjvIshO-i3fKk9W/exec';

export function showCompatibility(onBack = null, prefillMe = null, prefillYou = null, texts = null) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const prevHtml = lv ? lv.innerHTML : '';
    const prevDisplay = lv ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const dateInput = (prefix, label, pf) => {
        const isYou = prefix === 'cp-you';
        const selBg = isYou ? '#ff69b4' : '#0096BF';
        const selBorder = isYou ? '#ff51a8' : '#00d2ff';
        const mBg = pf && pf.gender === '男性' ? selBg : '#1a1a1a';
        const mColor = pf && pf.gender === '男性' ? '#fff' : '#888';
        const mBorder = pf && pf.gender === '男性' ? selBorder : '#444';
        const fBg = pf && pf.gender === '女性' ? selBg : '#1a1a1a';
        const fColor = pf && pf.gender === '女性' ? '#fff' : '#888';
        const fBorder = pf && pf.gender === '女性' ? selBorder : '#444';
        return `
        <div style="margin-bottom:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                <div style="color:#aaa; font-size:0.75rem;">${label}の生年月日</div>
                <button id="${prefix}-people" style="background:#1a2a1a; color:#7fd97f; border:1px solid #3a6a4a; padding:2px 8px; border-radius:3px; font-size:0.7rem;">📖 人物帳</button>
            </div>
            <div style="display:flex; gap:4px; align-items:center;">
                <input type="number" id="${prefix}-year" placeholder="1980" min="1900" max="2010"
                    value="${pf ? pf.year : ''}"
                    style="width:72px; background:#000; border:1px solid #555; color:#fff;
                           height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                <span style="color:#aaa; font-size:0.8rem;">年</span>
                <input type="number" id="${prefix}-month" placeholder="1" min="1" max="12"
                    value="${pf ? pf.month : ''}"
                    style="width:48px; background:#000; border:1px solid #555; color:#fff;
                           height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                <span style="color:#aaa; font-size:0.8rem;">月</span>
                <input type="number" id="${prefix}-day" placeholder="1" min="1" max="31"
                    value="${pf ? pf.day : ''}"
                    style="width:48px; background:#000; border:1px solid #555; color:#fff;
                           height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                <span style="color:#aaa; font-size:0.8rem;">日</span>
                <div style="display:flex; gap:4px; margin-left:4px;">
                    <button class="${prefix}-gender" data-val="男性"
                        style="background:${mBg}; color:${mColor}; border:1px solid ${mBorder};
                               height:38px; padding:0 8px; border-radius:4px; font-size:0.75rem;">男</button>
                    <button class="${prefix}-gender" data-val="女性"
                        style="background:${fBg}; color:${fColor}; border:1px solid ${fBorder};
                               height:38px; padding:0 8px; border-radius:4px; font-size:0.75rem;">女</button>
                </div>
            </div>
        </div>`;
    };

    const formHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                💑 相性鑑定
            </div>
            <div style="padding:10px;">
                ${dateInput('cp-me', 'あなた', prefillMe)}
                <div style="border-top:1px solid #333; margin:8px 0;"></div>
                ${dateInput('cp-you', 'お相手', prefillYou)}
                <div style="border-top:1px solid #333; margin:8px 0;"></div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">相手をどう思っていますか？</div>
                    <textarea id="cp-feeling" rows="2" placeholder="例：好きだけど自分の気持ちがよくわからない、一緒にいると落ち着くが刺激がない"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit;">${texts ? texts.feeling : ''}</textarea>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">何が知りたいですか？</div>
                    <textarea id="cp-question" rows="2" placeholder="例：この人と将来一緒になれるか、どう接すればうまくいくか、踏み出していいか"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit;">${texts ? texts.question : ''}</textarea>
                </div>
                <button id="cp-submit" style="width:100%; background:#0096BF; color:#ff69b4;
                    border:2px solid #ff51a8; height:44px; border-radius:4px;
                    font-size:0.95rem; font-weight:bold; margin-bottom:8px;">
                    ソフィーに鑑定してもらう
                </button>
                <button id="cp-close" style="width:100%; background:#34495e; color:#fff;
                    border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let myGender = prefillMe ? prefillMe.gender : '';
    let yourGender = prefillYou ? prefillYou.gender : '';

    document.querySelectorAll('.cp-me-gender').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cp-me-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
            myGender = btn.dataset.val;
        });
    });

    document.querySelectorAll('.cp-you-gender').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cp-you-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#ff69b4'; btn.style.color = '#fff'; btn.style.borderColor = '#ff51a8';
            yourGender = btn.dataset.val;
        });
    });

    const getState = () => ({
        me:  { year: document.getElementById('cp-me-year').value,  month: document.getElementById('cp-me-month').value,  day: document.getElementById('cp-me-day').value,  gender: myGender },
        you: { year: document.getElementById('cp-you-year').value, month: document.getElementById('cp-you-month').value, day: document.getElementById('cp-you-day').value, gender: yourGender },
        texts: { feeling: document.getElementById('cp-feeling').value, question: document.getElementById('cp-question').value }
    });

    document.getElementById('cp-me-people').onclick = () => {
        const s = getState();
        showPeopleBook(
            (person) => {
                const [y, m, d] = person.birth.split('-');
                showCompatibility(onBack, { year: y, month: parseInt(m), day: parseInt(d), gender: person.gender }, s.you, s.texts);
            },
            () => showCompatibility(onBack, s.me, s.you, s.texts)
        );
    };

    document.getElementById('cp-you-people').onclick = () => {
        const s = getState();
        showPeopleBook(
            (person) => {
                const [y, m, d] = person.birth.split('-');
                showCompatibility(onBack, s.me, { year: y, month: parseInt(m), day: parseInt(d), gender: person.gender }, s.texts);
            },
            () => showCompatibility(onBack, s.me, s.you, s.texts)
        );
    };

    document.getElementById('cp-close').onclick = () => {
        if (onBack) { onBack(); return; }
        if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
        if (nm) nm.style.display = prevNm;
    };

    document.getElementById('cp-submit').onclick = async () => {
        const myYear = document.getElementById('cp-me-year').value;
        const myMonth = document.getElementById('cp-me-month').value;
        const myDay = document.getElementById('cp-me-day').value;
        const yourYear = document.getElementById('cp-you-year').value;
        const yourMonth = document.getElementById('cp-you-month').value;
        const yourDay = document.getElementById('cp-you-day').value;

        if (!myYear || !myMonth || !myDay) { alert('あなたの生年月日を入力してください'); return; }
        if (!myGender) { alert('あなたの性別を選択してください'); return; }
        if (!yourYear || !yourMonth || !yourDay) { alert('お相手の生年月日を入力してください'); return; }
        if (!yourGender) { alert('お相手の性別を選択してください'); return; }

        const feeling = document.getElementById('cp-feeling').value.trim();
        const question = document.getElementById('cp-question').value.trim();

        const btn = document.getElementById('cp-submit');
        btn.textContent = '鑑定中…';
        btn.disabled = true;

        const prompt = `あなたは四柱推命を極めた占い師であり、BARソフィーのバーテンダー「ソフィー」です。
カウンターで相談者の悩みに寄り添いながら、二人の相性を深く鑑定してください。

【相談者】
生年月日：${myYear}年${myMonth}月${myDay}日
性別：${myGender}

【お相手】
生年月日：${yourYear}年${yourMonth}月${yourDay}日
性別：${yourGender}

【相手への気持ち】
${feeling || 'とくになし'}

【知りたいこと】
${question || 'とくになし'}

【鑑定の進め方】
1. 二人それぞれの命式（日干を中心に）を算出する
2. 二人の命式の関係性を読む（相生・相剋・比和など）
3. 惹かれ合う理由と摩擦が起きやすいポイントを具体的に語る
4. 相談者の気持ちと知りたいことを命式と照らし合わせてお告げをする
5. この関係をうまくいかせるための具体的なアドバイスをする
6. 最後にソフィーらしい温かくも少し色っぽいひとことで締める

【注意】
・単なる一般論ではなく命式に基づいた具体的な言葉で語ること
・腕のいい占い師として深みと説得力のある鑑定をすること
・ソフィーとして品があり温かみのある語り口で
・斜体や演出の地の文は入れないこと`;

        const messages = [{ role: 'user', content: prompt }];
        const url = GAS_URL + '?messages=' + encodeURIComponent(JSON.stringify(messages));

        try {
            const res = await fetch(url);
            const data = await res.json();

            const resultText = data.ok ? data.text : 'エラーが発生しました。もう一度お試しください。';
            const formatted = resultText
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '')
                .replace(/\*\*/g, '')
                .replace(/^#{1,3}\s*/gm, '')
                .replace(/^-{2,}$/gm, '')
                .replace(/\n{2,}/g, '\n')
                .replace(/\n/g, '<br>');

            const resultHtml = `
                <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                            background: linear-gradient(#111, #111) padding-box,
                            linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                    <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                                border-bottom:1px solid #333; height:28px; line-height:28px;
                                border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                        <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                        💑 ソフィーの相性鑑定
                    </div>
                    <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.9;">${formatted}</div>
                    <div style="padding:0 10px 10px;">

                        <button id="cp-copy" style="width:100%; background:#1a2a3a; color:#5ba3d9;
                            border:1px solid #1a5276; height:40px; border-radius:4px;
                            font-size:0.85rem; margin-bottom:6px;">📋 結果をコピー</button>
                        <button id="cp-retry" style="width:100%; background:#2a1a3a; color:#c39bd3;
                            border:1px solid #6a3a8a; height:40px; border-radius:4px;
                            font-size:0.85rem; margin-bottom:6px;">もう一度鑑定する</button>
                        <button id="cp-done" style="width:100%; background:#34495e; color:#fff;
                            border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
                    </div>
                </div>`;

            if (lv) { lv.innerHTML = resultHtml; }

            document.getElementById('cp-copy').onclick = () => {
                navigator.clipboard.writeText(resultText)
                    .then(() => alert('鑑定結果をコピーしました。メモアプリに貼り付けてください。'))
                    .catch(() => alert('コピーに失敗しました。'));
            };
            
            document.getElementById('cp-retry').onclick = () => showCompatibility(onBack);
            document.getElementById('cp-done').onclick = () => {
                if (onBack) { onBack(); return; }
                if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
                if (nm) nm.style.display = prevNm;
            };

        } catch (e) {
            alert('通信エラーが発生しました。');
            btn.textContent = 'ソフィーに鑑定してもらう';
            btn.disabled = false;
        }
    };
}