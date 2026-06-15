// js/compatibility.js
import { showPeopleBook } from './people.js';
import { getThreePillars, getFullMeishiki } from './meishiki.js';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwA1C22UhKroCFC_EPC-ugR5efyXVHlbkWywfD21HfD3-J4vm-b4ZjvIshO-i3fKk9W/exec';

export function showCompatibility(onBack = null, prefillMe = null, prefillYou = null, texts = null) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');

    const monImg = document.getElementById('monitor-img');
    if (monImg) monImg.src = './fortune_sophie.jpeg';
    if (window._renderConsole) window._renderConsole('fortune');
    window._fortuneBack = () => { if (onBack) onBack(); else import('./fortune.js').then(f => f.showFortuneMenu()); };

    const userData = window.currentUserData || {};
    const role = userData.role === 'admin' ? 'admin' : (userData.status || userData.role || 'guest');
    const lightLimitMap = { guest: 0, free: 1, active: 3, vip: 99, admin: 99 };
    const lightLimit = lightLimitMap[role] || 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const usedToday = userData.lastFortuneBDate === todayKey ? (userData.dailyFortuneBCount || 0) : 0;
    const lightRemaining = Math.max(0, lightLimit - usedToday);
    const totalTickets = (userData.dailyTickets || 0) + (userData.weeklyTickets || 0) + (userData.purchasedTickets || 0);

    const makeDots = (filled, total) => Array.from({length: total}, (_, i) =>
        `<span style="color:${i < filled ? '#f0b56e' : '#444'}; font-size:0.72rem;">●</span>`).join('');

    const lightDotsHtml = makeDots(Math.min(5, lightRemaining), Math.min(5, lightLimit));
    const premiumDotsHtml = makeDots(Math.min(5, totalTickets), 5);

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
        <div style="margin-bottom:4px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:3px;">
                <div style="color:#aaa; font-size:0.7rem;">${label}</div>
                <button id="${prefix}-people" style="background:#1a2a1a; color:#7fd97f; border:1px solid #3a6a4a; padding:4px 10px; border-radius:4px; font-size:0.68rem;">📖 人物帳</button>
            </div>
            <div style="display:flex; gap:2px; align-items:center; flex-wrap:nowrap;">
                <input type="number" id="${prefix}-year" placeholder="1980" min="1900" max="2010"
                    value="${pf ? pf.year : ''}"
                    style="width:52px; background:#000; border:1px solid #555; color:#fff;
                           height:26px; padding:0 4px; border-radius:4px; font-size:0.75rem;">
                <span style="color:#aaa; font-size:0.68rem;">年</span>
                <input type="number" id="${prefix}-month" placeholder="1" min="1" max="12"
                    value="${pf ? pf.month : ''}"
                    style="width:32px; background:#000; border:1px solid #555; color:#fff;
                           height:26px; padding:0 4px; border-radius:4px; font-size:0.75rem;">
                <span style="color:#aaa; font-size:0.68rem;">月</span>
                <input type="number" id="${prefix}-day" placeholder="1" min="1" max="31"
                    value="${pf ? pf.day : ''}"
                    style="width:32px; background:#000; border:1px solid #555; color:#fff;
                           height:26px; padding:0 4px; border-radius:4px; font-size:0.75rem;">
                <span style="color:#aaa; font-size:0.68rem;">日</span>
                <button class="${prefix}-gender" data-val="男性"
                    style="background:${mBg}; color:${mColor}; border:1px solid ${mBorder};
                           height:26px; padding:0 8px; border-radius:4px; font-size:0.72rem; margin-left:3px;">男</button>
                <button class="${prefix}-gender" data-val="女性"
                    style="background:${fBg}; color:${fColor}; border:1px solid ${fBorder};
                           height:26px; padding:0 8px; border-radius:4px; font-size:0.72rem;">女</button>
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
                💑 相性診断
            </div>
            <div style="padding:10px;">
                <div style="display:flex; gap:6px; margin-bottom:8px; align-items:stretch;">
                    <div style="flex:1; min-width:0;">
                        ${dateInput('cp-me', 'あなた', prefillMe)}
                        <div style="border-top:1px solid #2a2a2a; margin:5px 0;"></div>
                        ${dateInput('cp-you', 'お相手', prefillYou)}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; width:88px; flex-shrink:0;">
                        <button id="cp-grade-light" style="flex:1; background:#2a2a1a; border:2px solid #f0b56e;
                            border-radius:6px; padding:6px 8px; text-align:left; cursor:pointer;">
                            <div style="font-weight:bold; color:#f0b56e; font-size:0.72rem; margin-bottom:3px;">ライト診断</div>
                            <div>${lightDotsHtml}</div>
                        </button>
                        <button id="cp-grade-premium" style="flex:1; background:#1a1a2a; border:1px solid #555;
                            border-radius:6px; padding:6px 8px; text-align:left; cursor:pointer;">
                            <div style="font-weight:bold; color:#9b59b6; font-size:0.72rem; margin-bottom:3px;">プレミア診断</div>
                            <div>${premiumDotsHtml}</div>
                        </button>
                    </div>
                </div>
                <div style="border-top:1px solid #333; margin:4px 0 8px;"></div>
                <div style="margin-bottom:6px;">
                    <div style="color:#aaa; font-size:0.72rem; margin-bottom:3px;">相手をどう思っていますか？</div>
                    <textarea id="cp-feeling" rows="2" maxlength="50" placeholder="例：好きだけど自分の気持ちがよくわからない"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit; box-sizing:border-box;">${texts ? texts.feeling : ''}</textarea>
                    <div id="cp-feeling-count" style="color:#666; font-size:0.7rem; text-align:right;">残り${texts ? 50 - texts.feeling.length : 50}文字</div>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="color:#aaa; font-size:0.72rem; margin-bottom:3px;">何が知りたいですか？</div>
                    <textarea id="cp-question" rows="2" maxlength="50" placeholder="例：この人と将来一緒になれるか"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit; box-sizing:border-box;">${texts ? texts.question : ''}</textarea>
                    <div id="cp-question-count" style="color:#666; font-size:0.7rem; text-align:right;">残り${texts ? 50 - texts.question.length : 50}文字</div>
                </div>
                <button id="cp-submit" style="display:none;"></button>
            </div>
        </div>
        <div id="cp-meishiki-area" style="display:none; margin:10px;"></div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let myGender = prefillMe ? prefillMe.gender : '';
    let yourGender = prefillYou ? prefillYou.gender : '';
    let selectedGrade = 'light';

    function _updateGradeUI() {
        const lightBtn = document.getElementById('cp-grade-light');
        const premiumBtn = document.getElementById('cp-grade-premium');
        if (selectedGrade === 'light') {
            lightBtn.style.border = '2px solid #f0b56e';
            lightBtn.style.background = '#2a2a1a';
            premiumBtn.style.border = '1px solid #555';
            premiumBtn.style.background = '#1a1a2a';
        } else {
            lightBtn.style.border = '1px solid #555';
            lightBtn.style.background = '#1a1a2a';
            premiumBtn.style.border = '2px solid #9b59b6';
            premiumBtn.style.background = '#1a0a2a';
        }
    }

    document.getElementById('cp-grade-light').onclick = () => { selectedGrade = 'light'; _updateGradeUI(); };
    document.getElementById('cp-grade-premium').onclick = () => { selectedGrade = 'premium'; _updateGradeUI(); };

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

    document.getElementById('cp-feeling').oninput = function() {
        document.getElementById('cp-feeling-count').textContent = '残り' + (50 - this.value.length) + '文字';
    };
    document.getElementById('cp-question').oninput = function() {
        document.getElementById('cp-question-count').textContent = '残り' + (50 - this.value.length) + '文字';
    };

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

    window._fortuneSubmit = () => {
        const btn = document.getElementById('cp-submit');
        if (btn && !btn.disabled) btn.click();
    };

    window._showMeishikiPanel = () => {
        const area = document.getElementById('cp-meishiki-area');
        if (!area) return;
        if (area.style.display !== 'none') { area.style.display = 'none'; return; }
        const myY = parseInt(document.getElementById('cp-me-year')?.value);
        const myM = parseInt(document.getElementById('cp-me-month')?.value);
        const myD = parseInt(document.getElementById('cp-me-day')?.value);
        const yourY = parseInt(document.getElementById('cp-you-year')?.value);
        const yourM = parseInt(document.getElementById('cp-you-month')?.value);
        const yourD = parseInt(document.getElementById('cp-you-day')?.value);
        if ((!myY || !myM || !myD) && (!yourY || !yourM || !yourD)) return;
        const buildFn = window.buildMeishikiHtml;
        if (!buildFn) return;
        import('./meishiki.js').then(m => {
            const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
            const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
            let html = '';
            if (myY && myM && myD) {
                const raw = m.getFullMeishiki(myY, myM, myD, myGender || '不明');
                const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
                html += `<div style="margin-bottom:8px;"><div style="color:#aaa;font-size:0.72rem;margin-bottom:4px;">あなたの命式</div>${buildFn(data, myY, myM, myD, myGender || '不明')}</div>`;
            }
            if (yourY && yourM && yourD) {
                const raw = m.getFullMeishiki(yourY, yourM, yourD, yourGender || '不明');
                const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
                html += `<div><div style="color:#aaa;font-size:0.72rem;margin-bottom:4px;">お相手の命式</div>${buildFn(data, yourY, yourM, yourD, yourGender || '不明')}</div>`;
            }
            area.innerHTML = html;
            area.style.display = 'block';
        });
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

        if (selectedGrade === 'light') {
            if (!await window.checkAccess('fortune_haiku')) return;
        } else {
            if (!await window.checkAccess('fortune_sonnet')) return;
        }

        const feeling = document.getElementById('cp-feeling').value.trim();
        const question = document.getElementById('cp-question').value.trim();
        const savedMe = { year: myYear, month: myMonth, day: myDay, gender: myGender };
        const savedYou = { year: yourYear, month: yourMonth, day: yourDay, gender: yourGender };
        const savedTexts = { feeling, question };
        const ctrlBtn = document.getElementById('c-fortune-submit');
        let colorTimer = null;
        if (ctrlBtn) {
            ctrlBtn.textContent = '診断中';
            ctrlBtn.disabled = true;
            let flip = false;
            colorTimer = setInterval(() => { flip = !flip; ctrlBtn.style.color = flip ? '#ff1493' : '#ff69b4'; }, 1000);
        }

        const myPillars = getThreePillars(parseInt(myYear), parseInt(myMonth), parseInt(myDay));
        const yourPillars = getThreePillars(parseInt(yourYear), parseInt(yourMonth), parseInt(yourDay));

        const btn = document.getElementById('cp-submit');
        btn.disabled = true;

        const sophieChar = 'あなたはBARソフィーのソフィー（20代・女性バーテンダー）。知的で品のある、です・ます調の丁寧な語り口で四柱推命の相性鑑定をしてください。お客は40・50代。';
        const today = new Date();
        const todayStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;

        let prompt;
        if (selectedGrade === 'light') {
            prompt = `${sophieChar}
【現在の日付】${todayStr}

【相談者】
生年月日：${myYear}年${myMonth}月${myDay}日・${myGender}
命式：年柱 ${myPillars.year}・月柱 ${myPillars.month}・日柱 ${myPillars.day}

【お相手】
生年月日：${yourYear}年${yourMonth}月${yourDay}日・${yourGender}
命式：年柱 ${yourPillars.year}・月柱 ${yourPillars.month}・日柱 ${yourPillars.day}

${feeling ? `気持ち：${feeling}` : ''}${question ? `\n知りたいこと：${question}` : ''}

二人の相性についてひとことお告げをしてください。ソフィーらしい品のある語り口で、100字以内でお願いします。`;
        } else {
            const myFull = getFullMeishiki(parseInt(myYear), parseInt(myMonth), parseInt(myDay), myGender);
            const yourFull = getFullMeishiki(parseInt(yourYear), parseInt(yourMonth), parseInt(yourDay), yourGender);
            const myDetail = `
・年柱：${myPillars.year}（通変星：${myFull?.columns?.year?.tsuhensei || ''}・十二運星：${myFull?.columns?.year?.juniUnsei || ''}）
・月柱：${myPillars.month}（通変星：${myFull?.columns?.month?.tsuhensei || ''}・十二運星：${myFull?.columns?.month?.juniUnsei || ''}）
・日柱：${myPillars.day}（通変星：日主・十二運星：${myFull?.columns?.day?.juniUnsei || ''}）
五行バランス：${Object.entries(myFull?.gogyoBalance || {}).map(([g,c]) => `${g}${c}`).join('・')}`;
            const yourDetail = `
・年柱：${yourPillars.year}（通変星：${yourFull?.columns?.year?.tsuhensei || ''}・十二運星：${yourFull?.columns?.year?.juniUnsei || ''}）
・月柱：${yourPillars.month}（通変星：${yourFull?.columns?.month?.tsuhensei || ''}・十二運星：${yourFull?.columns?.month?.juniUnsei || ''}）
・日柱：${yourPillars.day}（通変星：日主・十二運星：${yourFull?.columns?.day?.juniUnsei || ''}）
五行バランス：${Object.entries(yourFull?.gogyoBalance || {}).map(([g,c]) => `${g}${c}`).join('・')}`;

            prompt = `${sophieChar}
【現在の日付】${todayStr}
※鑑定は必ずこの日付を基準に行うこと。「来年は○○年」などの表現も正確に。
あなたは四柱推命を極めた占い師であり、BARソフィーのバーテンダー「ソフィー」です。
カウンターで相談者の悩みに寄り添いながら、二人の相性を深く鑑定してください。

【相談者】
生年月日：${myYear}年${myMonth}月${myDay}日
性別：${myGender}
命式：年柱 ${myPillars.year}・月柱 ${myPillars.month}・日柱 ${myPillars.day}
${myDetail}

【お相手】
生年月日：${yourYear}年${yourMonth}月${yourDay}日
性別：${yourGender}
命式：年柱 ${yourPillars.year}・月柱 ${yourPillars.month}・日柱 ${yourPillars.day}
${yourDetail}

【相手への気持ち】
${feeling || 'とくになし'}

【知りたいこと】
${question || 'とくになし'}

【鑑定の進め方】
1. 二人の命式の関係性を読む（相生・相剋・比和など）
2. 惹かれ合う理由と摩擦が起きやすいポイントを具体的に語る
3. 相談者の気持ちと知りたいことを命式と照らし合わせてお告げをする
4. この関係をうまくいかせるための具体的なアドバイスをする
5. 最後にソフィーらしい温かくも少し色っぽいひとことで締める

【注意】
・単なる一般論ではなく命式に基づいた具体的な言葉で語ること
・腕のいい占い師として深みと説得力のある鑑定をすること
・ソフィーとして品があり温かみのある語り口で
・斜体や演出の地の文は入れないこと
・回答は1000字程度にまとめること`;
        }

        const messages = [{ role: 'user', content: prompt }];

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ messages, search: false, grade: selectedGrade })
            });
            const data = await res.json();

            const resultText = data.ok ? data.text : 'エラーが発生しました。もう一度お試しください。';
            const gradeLabel = selectedGrade === 'light' ? 'ライト' : 'プレミア';
            const formatted = resultText
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '')
                .replace(/\*\*/g, '')
                .replace(/^#{1,3}\s*(.+)$/gm, '<span style="color:#f0b56e; font-weight:bold; font-size:0.88rem; display:block; margin:8px 0 2px;">$1</span>')
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
                        <div style="color:#888; font-size:0.75rem; text-align:center; padding:4px 0; border-bottom:1px solid #333; margin-bottom:8px;">
                            相性鑑定・${gradeLabel}　${myYear}/${myMonth}/${myDay}（${myGender}）×${yourYear}/${yourMonth}/${yourDay}（${yourGender}）　${new Date().toLocaleDateString('ja-JP')}
                        </div>
                        <button id="cp-meishiki-btn" style="width:100%; background:#1a1a2a; color:#9b59b6;
                            border:1px solid #6a3a8a; height:36px; border-radius:4px;
                            font-size:0.8rem; margin-bottom:6px;">📊 命式を確認する</button>
                        <div id="cp-meishiki-area-result" style="display:none; margin-bottom:8px;"></div>
                        <button id="cp-copy" style="width:100%; background:#1a2a3a; color:#5ba3d9;
                            border:1px solid #1a5276; height:40px; border-radius:4px;
                            font-size:0.85rem;">📋 結果をコピー</button>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button id="cp-fullscreen-result" style="flex:1; background:#1a1a2a; color:#aaa;
                                border:1px solid #444; height:36px; border-radius:4px;
                                font-size:0.72rem; cursor:pointer;">📄 診断を全画面</button>
                            <button id="cp-fullscreen-meishiki" style="flex:1; background:#1a1a2a; color:#aaa;
                                border:1px solid #444; height:36px; border-radius:4px;
                                font-size:0.72rem; cursor:pointer;">🀄 命式表を全画面</button>
                        </div>
                    </div>
                </div>`;

            if (lv) { lv.innerHTML = resultHtml; }
            if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
            if (ctrlBtn) { ctrlBtn.textContent = '天命診断を行う'; ctrlBtn.style.color = '#ff69b4'; ctrlBtn.disabled = false; }

            window._fortuneBack = () => showCompatibility(onBack, savedMe, savedYou, savedTexts);

            window._showMeishikiPanel = () => {
                const area = document.getElementById('cp-meishiki-area-result');
                if (!area) return;
                if (area.style.display !== 'none') { area.style.display = 'none'; return; }
                const buildFn = window.buildMeishikiHtml;
                if (!buildFn) return;
                import('./meishiki.js').then(m => {
                    const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
                    const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
                    const myRaw = m.getFullMeishiki(parseInt(myYear), parseInt(myMonth), parseInt(myDay), myGender);
                    const myData = { ...myRaw, yearPillar: adapt(myRaw.columns?.year), monthPillar: adapt(myRaw.columns?.month), dayPillar: adapt(myRaw.columns?.day) };
                    const yourRaw = m.getFullMeishiki(parseInt(yourYear), parseInt(yourMonth), parseInt(yourDay), yourGender);
                    const yourData = { ...yourRaw, yearPillar: adapt(yourRaw.columns?.year), monthPillar: adapt(yourRaw.columns?.month), dayPillar: adapt(yourRaw.columns?.day) };
                    area.innerHTML = `<div style="margin-bottom:8px;"><div style="color:#aaa;font-size:0.72rem;margin-bottom:4px;">あなたの命式</div>${buildFn(myData, parseInt(myYear), parseInt(myMonth), parseInt(myDay), myGender)}</div><div><div style="color:#aaa;font-size:0.72rem;margin-bottom:4px;">お相手の命式</div>${buildFn(yourData, parseInt(yourYear), parseInt(yourMonth), parseInt(yourDay), yourGender)}</div>`;
                    area.style.display = 'block';
                });
            };

            document.getElementById('cp-meishiki-btn').onclick = () => window._showMeishikiPanel();
            document.getElementById('cp-copy').onclick = () => {
                const header = `【相性診断・${gradeLabel}】${myYear}/${myMonth}/${myDay}（${myGender}）×${yourYear}/${yourMonth}/${yourDay}（${yourGender}）　${new Date().toLocaleDateString('ja-JP')}\n\n`;
                navigator.clipboard.writeText(header + resultText)
                    .then(() => alert('鑑定結果をコピーしました。'))
                    .catch(() => alert('コピーに失敗しました。'));
            };

            document.getElementById('cp-fullscreen-result').onclick = () => {
                const hdrText = `【相性診断・${gradeLabel}】${myYear}/${myMonth}/${myDay}（${myGender}）×${yourYear}/${yourMonth}/${yourDay}（${yourGender}）`;
                const hdrHtml = `<div style="color:#888; font-size:0.78rem; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #333;">${hdrText}</div>`;
                window.showResultFullscreen('💑 ソフィーの相性鑑定', hdrHtml + formatted);
            };

            document.getElementById('cp-fullscreen-meishiki').onclick = () => {
                const buildFn = window.buildMeishikiHtml;
                if (!buildFn) return;
                import('./meishiki.js').then(m => {
                    const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
                    const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
                    const myRaw = m.getFullMeishiki(parseInt(myYear), parseInt(myMonth), parseInt(myDay), myGender);
                    const myData = { ...myRaw, yearPillar: adapt(myRaw.columns?.year), monthPillar: adapt(myRaw.columns?.month), dayPillar: adapt(myRaw.columns?.day) };
                    const yourRaw = m.getFullMeishiki(parseInt(yourYear), parseInt(yourMonth), parseInt(yourDay), yourGender);
                    const yourData = { ...yourRaw, yearPillar: adapt(yourRaw.columns?.year), monthPillar: adapt(yourRaw.columns?.month), dayPillar: adapt(yourRaw.columns?.day) };
                    const html = `<div style="margin-bottom:8px;"><div style="color:#aaa;font-size:0.72rem;margin-bottom:4px;">あなたの命式</div>${buildFn(myData, parseInt(myYear), parseInt(myMonth), parseInt(myDay), myGender)}</div><div><div style="color:#aaa;font-size:0.72rem;margin-bottom:4px;">お相手の命式</div>${buildFn(yourData, parseInt(yourYear), parseInt(yourMonth), parseInt(yourDay), yourGender)}</div>`;
                    window.showMeishikiHtmlFullscreen(html);
                });
            };

        } catch (e) {
            alert('通信エラーが発生しました。');
            btn.disabled = false;
            if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
            if (ctrlBtn) { ctrlBtn.textContent = '天命診断を行う'; ctrlBtn.style.color = '#ff69b4'; ctrlBtn.disabled = false; }
        }
    };
}
