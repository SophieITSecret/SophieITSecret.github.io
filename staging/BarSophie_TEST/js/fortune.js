// js/fortune.js
import { showPeopleBook } from './people.js';
import { showCompatibility } from './compatibility.js';
import { getThreePillars, getFullMeishiki, getDaiyun, getKakukyoku, getKuubou } from './meishiki.js';
import { loadGlossary } from './glossary.js';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwA1C22UhKroCFC_EPC-ugR5efyXVHlbkWywfD21HfD3-J4vm-b4ZjvIshO-i3fKk9W/exec';

loadGlossary();

const sophieChar = 'ソフィーは20代の若い女性バーテンダー。さわやかで知的、品がある。口調は丁寧な「です・ます」調。マダムのような馴れ馴れしさやタメ口は使わない。お客様は40〜50代の紳士が多い。四柱推命の専門用語はさりげなく使い、少し意味を補足するが説明的になりすぎない。';

function loadSelfPrefill() {
    const selfRaw = localStorage.getItem('bar_sophie_self');
    const selfData = selfRaw ? JSON.parse(selfRaw) : null;
    if (selfData && selfData.birth) {
        const [y, m, d] = selfData.birth.split('-');
        return { year: y, month: parseInt(m), day: parseInt(d), gender: selfData.gender || '' };
    }
    return null;
}

export function showMyFortune(onBack = null, prefill = null) {
    if (prefill === null) prefill = loadSelfPrefill();

    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');

    const monImg = document.getElementById('monitor-img');
    if (monImg) { monImg.src = './fortune_sophie.jpeg'; }
    if (window._renderConsole) window._renderConsole('fortune');
    window._fortuneBack = () => showFortuneMenu();

    const userData = window.currentUserData || {};
    const role = userData.role === 'admin' ? 'admin' : (userData.status || userData.role || 'guest');
    const lightLimitMap = { guest: 0, free: 1, active: 3, vip: 99, admin: 99 };
    const lightLimit = lightLimitMap[role] || 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const usedToday = userData.lastFortuneBDate === todayKey ? (userData.dailyFortuneBCount || 0) : 0;
    const lightRemaining = Math.max(0, lightLimit - usedToday);
    const totalTickets = (userData.dailyTickets || 0) + (userData.weeklyTickets || 0) + (userData.purchasedTickets || 0);

    const makeDots = (filled, total) => Array.from({length: total}, (_, i) =>
        `<span style="color:${i < filled ? '#f0b56e' : '#444'}; font-size:0.75rem;">●</span>`).join('');

    const lightDotsHtml = makeDots(Math.min(5, lightRemaining), Math.min(5, lightLimit));
    const premiumDotsHtml = makeDots(Math.min(5, totalTickets), 5);

    const formHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                あなたの天命診断
            </div>
            <div style="padding:10px;">
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1; border:1px solid #333; border-radius:6px; padding:8px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                            <div style="color:#aaa; font-size:0.72rem;">生年月日</div>
                            <button id="ft-people" style="background:#1a2a1a; color:#7fd97f; border:1px solid #3a6a4a; padding:5px 12px; border-radius:5px; font-size:0.72rem;">📖 人物帳</button>
                        </div>
                        <div style="display:flex; gap:3px; align-items:center; margin-bottom:6px;">
                            <input type="number" id="ft-year" placeholder="1980" min="1900" max="2010"
                                value="${prefill ? prefill.year : ''}"
                                style="width:60px; background:#000; border:1px solid #555; color:#fff;
                                       height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                            <span style="color:#aaa; font-size:0.75rem;">年</span>
                            <input type="number" id="ft-month" placeholder="1" min="1" max="12"
                                value="${prefill ? prefill.month : ''}"
                                style="width:40px; background:#000; border:1px solid #555; color:#fff;
                                       height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                            <span style="color:#aaa; font-size:0.75rem;">月</span>
                            <input type="number" id="ft-day" placeholder="1" min="1" max="31"
                                value="${prefill ? prefill.day : ''}"
                                style="width:40px; background:#000; border:1px solid #555; color:#fff;
                                       height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                            <span style="color:#aaa; font-size:0.75rem;">日</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="ft-gender" data-val="男性"
                                style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                       height:28px; border-radius:4px; font-size:0.8rem;">男性</button>
                            <button class="ft-gender" data-val="女性"
                                style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                       height:28px; border-radius:4px; font-size:0.8rem;">女性</button>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; width:96px; flex-shrink:0;">
                        <button id="ft-grade-light" style="background:#2a2a1a; border:2px solid #f0b56e;
                            border-radius:6px; padding:7px 8px; text-align:left; cursor:pointer; width:100%;">
                            <div style="font-weight:bold; color:#f0b56e; font-size:0.75rem; margin-bottom:2px;">ライト診断</div>
                            <div>${lightDotsHtml}</div>
                        </button>
                        <button id="ft-grade-premium" style="background:#1a1a2a; border:1px solid #555;
                            border-radius:6px; padding:7px 8px; text-align:left; cursor:pointer; width:100%;">
                            <div style="font-weight:bold; color:#9b59b6; font-size:0.75rem; margin-bottom:2px;">プレミア診断</div>
                            <div>${premiumDotsHtml}</div>
                        </button>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.72rem; margin-bottom:4px;">鑑定テーマ とスタイル</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button class="ft-theme" data-val="総合運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">🌟 総合運</button>
                        <button class="ft-theme" data-val="仕事運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💼 仕事運</button>
                        <button class="ft-theme" data-val="恋愛運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💕 恋愛運</button>
                        <button class="ft-theme" data-val="金運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💰 金運</button>
                        <button class="ft-theme ft-premium-only" data-val="向こう1ヶ月"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">📅 向こう1ヶ月</button>
                        <button class="ft-theme ft-premium-only" data-val="向こう1年"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">📅 向こう1年</button>
                        <button class="ft-theme ft-premium-only" data-val="向こう10年"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">🔭 向こう10年</button>
                        <button class="ft-theme ft-premium-only" data-val="これが聞きたい"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💬 これが聞きたい</button>
                    </div>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                    <button id="ft-style-balance" style="flex:1; background:#2a1a00; border:2px solid #f0b56e; border-radius:4px; height:30px; color:#f0b56e; font-size:0.75rem; cursor:pointer;">バランス</button>
                    <button id="ft-style-straight" style="flex:1; background:#1a1a1a; border:1px solid #444; border-radius:4px; height:30px; color:#888; font-size:0.75rem; cursor:pointer;">ストレート</button>
                </div>
                <div style="margin-bottom:10px;">
                    <div id="ft-worry-label" style="color:#aaa; font-size:0.72rem; margin-bottom:4px;">特に気になることがあれば</div>
                    <textarea id="ft-worry" rows="2" placeholder="例：転職のタイミングが気になっています"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit; box-sizing:border-box;"></textarea>
                </div>
                <button id="ft-submit" style="display:none;"></button>
            </div>
        </div>
        <div id="ft-meishiki-area-form" style="display:none; margin:10px;"></div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let selectedGender = prefill ? prefill.gender : '';
    const personName = prefill?.name || '';
    let selectedTheme = '';
    let selectedGrade = 'light';

    function _updateGradeUI() {
        const lightBtn = document.getElementById('ft-grade-light');
        const premiumBtn = document.getElementById('ft-grade-premium');
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
        document.querySelectorAll('.ft-premium-only').forEach(btn => {
            if (selectedGrade === 'light') {
                if (btn.dataset.val === selectedTheme) selectedTheme = '';
                btn.disabled = true;
                btn.style.color = '#555';
                btn.style.borderColor = '#2a2a2a';
                btn.style.background = '#1a1a1a';
            } else {
                btn.disabled = false;
                if (btn.dataset.val === selectedTheme) {
                    btn.style.background = '#8e44ad';
                    btn.style.color = '#fff';
                    btn.style.borderColor = '#9b59b6';
                } else {
                    btn.style.background = '#1a1a1a';
                    btn.style.color = '#888';
                    btn.style.borderColor = '#444';
                }
            }
        });
    }

    let selectedStyle = 'balance';

    function _updateStyleUI() {
        const balBtn = document.getElementById('ft-style-balance');
        const strBtn = document.getElementById('ft-style-straight');
        if (!balBtn || !strBtn) return;
        if (selectedStyle === 'balance') {
            balBtn.style.border = '2px solid #f0b56e'; balBtn.style.background = '#2a1a00'; balBtn.style.color = '#f0b56e';
            strBtn.style.border = '1px solid #444'; strBtn.style.background = '#1a1a1a'; strBtn.style.color = '#888';
        } else {
            balBtn.style.border = '1px solid #444'; balBtn.style.background = '#1a1a1a'; balBtn.style.color = '#888';
            strBtn.style.border = '2px solid #ff6b6b'; strBtn.style.background = '#2a0a0a'; strBtn.style.color = '#ff6b6b';
        }
    }

    document.getElementById('ft-grade-light').onclick = () => { selectedGrade = 'light'; _updateGradeUI(); };
    document.getElementById('ft-grade-premium').onclick = () => { selectedGrade = 'premium'; _updateGradeUI(); };
    document.getElementById('ft-style-balance').onclick = () => { selectedStyle = 'balance'; _updateStyleUI(); };
    document.getElementById('ft-style-straight').onclick = () => { selectedStyle = 'straight'; _updateStyleUI(); };

    document.querySelectorAll('.ft-gender').forEach(btn => {
        if (selectedGender && btn.dataset.val === selectedGender) {
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
        }
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ft-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
            selectedGender = btn.dataset.val;
        });
    });

    document.querySelectorAll('.ft-theme').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            document.querySelectorAll('.ft-theme:not(:disabled)').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#8e44ad'; btn.style.color = '#fff'; btn.style.borderColor = '#9b59b6';
            selectedTheme = btn.dataset.val;
            const label = document.getElementById('ft-worry-label');
            if (label) label.textContent = selectedTheme === 'これが聞きたい' ? '具体的に教えてください' : '特に気になることがあれば';
        });
    });

    document.getElementById('ft-people').onclick = () => {
        const cur = {
            year: document.getElementById('ft-year').value,
            month: document.getElementById('ft-month').value,
            day: document.getElementById('ft-day').value,
            gender: selectedGender
        };
        showPeopleBook(
            (person) => {
                const [y, m, d] = person.birth.split('-');
                showMyFortune(onBack, { year: y, month: parseInt(m), day: parseInt(d), gender: person.gender, name: person.name });
            },
            () => showMyFortune(onBack, cur)
        );
    };

    window._showMeishikiPanel = () => {
        const area = document.getElementById('ft-meishiki-area-form');
        if (!area) return;
        if (area.style.display !== 'none') { area.style.display = 'none'; return; }
        const y = parseInt(document.getElementById('ft-year')?.value);
        const mo = parseInt(document.getElementById('ft-month')?.value);
        const d = parseInt(document.getElementById('ft-day')?.value);
        const g = selectedGender || '不明';
        if (!y || !mo || !d) return;
        import('./meishiki.js').then(m => {
            const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
            const raw = m.getFullMeishiki(y, mo, d, g);
            const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
            const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
            area.style.display = 'block';
            area.innerHTML = buildMeishikiHtml(data, y, mo, d, g);
        });
    };

    document.getElementById('ft-submit').onclick = async () => {
        const year = document.getElementById('ft-year').value;
        const month = document.getElementById('ft-month').value;
        const day = document.getElementById('ft-day').value;

        if (!year || !month || !day) { alert('生年月日を入力してください'); return; }
        if (!selectedGender) { alert('性別を選択してください'); return; }
        if (!selectedTheme) { alert('鑑定テーマを選択してください'); return; }

        if (selectedGrade === 'light') {
            if (!await window.checkAccess('fortune_haiku')) return;
        } else {
            if (!await window.checkAccess('fortune_sonnet')) return;
        }

        const worry = document.getElementById('ft-worry').value.trim();
        const savedPrefill = { year, month, day, gender: selectedGender };
        const ctrlBtn = document.getElementById('c-fortune-submit');
        let colorTimer = null;
        if (ctrlBtn) {
            ctrlBtn.textContent = '診断中';
            ctrlBtn.disabled = true;
            let flip = false;
            colorTimer = setInterval(() => { flip = !flip; ctrlBtn.style.color = flip ? '#ff1493' : '#ff69b4'; }, 1000);
        }

        const btn = document.getElementById('ft-submit');
        btn.disabled = true;

        const today = new Date();
        const todayStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;

        let prompt;
        if (selectedGrade === 'light') {
            const pillars = getThreePillars(parseInt(year), parseInt(month), parseInt(day));
            prompt = `${sophieChar}
【現在の日付】${todayStr}
あなたはBARソフィーのバーテンダー「ソフィー」です。

【お客様】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
命式：年柱 ${pillars.year}・月柱 ${pillars.month}・日柱 ${pillars.day}
鑑定テーマ：${selectedTheme}
${worry ? `特に相談したいこと：${worry}` : ''}

この方の命式をもとに、${selectedTheme}についてひとことお告げをしてください。ソフィーらしい品のある語り口で、100字以内でお願いします。`;
        } else {
            const pillars = getThreePillars(parseInt(year), parseInt(month), parseInt(day));
            const fullData = getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
            const daiyun = getDaiyun(parseInt(year), parseInt(month), parseInt(day), selectedGender);
            const currentAge = today.getFullYear() - parseInt(year);
            const currentDaiyun = daiyun.daiyunList.find((d, i) => {
                const next = daiyun.daiyunList[i + 1];
                return d.age <= currentAge && (!next || currentAge < next.age);
            });
            const meishikiDetail = `
命式詳細：
・年柱：${pillars.year}（通変星：${fullData?.columns?.year?.tsuhensei || ''}・十二運星：${fullData?.columns?.year?.juniUnsei || ''}）
・月柱：${pillars.month}（通変星：${fullData?.columns?.month?.tsuhensei || ''}・十二運星：${fullData?.columns?.month?.juniUnsei || ''}）
・日柱：${pillars.day}（通変星：日主・十二運星：${fullData?.columns?.day?.juniUnsei || ''}）
五行バランス：${Object.entries(fullData?.gogyoBalance || {}).map(([g,c]) => `${g}${c}`).join('・')}
大運（開始${daiyun.startAge}歳・${daiyun.isForward ? '順行' : '逆行'}）：${daiyun.daiyunList.slice(0,6).map(d => `${d.ageRange}${d.pillar}`).join('・')}
現在の大運：${currentDaiyun ? `${currentDaiyun.ageRange} ${currentDaiyun.pillar}` : '不明'}
`;
            prompt = `${sophieChar}
【現在の日付】${todayStr}
※鑑定は必ずこの日付を基準に行うこと。「来年は○○年」などの表現も正確に。
あなたは四柱推命を極めた占い師であり、BARソフィーのバーテンダー「ソフィー」です。
貴方にお客様から相談がありました。自分の運勢を占いで見てほしいそうです。
カウンターでお客様の相談ごとに寄り添いながら、お客様の自己発見に導き深みのあるアドバイスをしてください。

【お客様】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
命式：年柱 ${pillars.year}・月柱 ${pillars.month}・日柱 ${pillars.day}
${meishikiDetail}
鑑定テーマ：${selectedTheme}
特に相談したいテーマ：${worry || 'なし'}

【対話の進め方】
1. この方の本質的な性格・才能・宿命を読む。その際、自然な語りの中で、この人ならではの強み、見落としがちな弱み、これから開ける可能性、気をつけるべき点にさりげなく触れること
2. 現在の大運・年運（${today.getFullYear()}年）の流れを読んで伝える
3. 相談テーマと命式・運気を照らし合わせて具体的なアドバイスをする
4. 最後にソフィーらしい温かいひとことで締める

【注意】
・占い師として深みと説得力のある命式分析をすること
・単なる一般論ではなく、命式に基づいた具体的な言葉で語ること
・ソフィーとして品があり温かみのある語り口で
・見出しや箇条書きは使わず、会話するように自然な文章で
・回答は1200字程度にまとめること`;
            if (selectedStyle === 'straight') {
                prompt += `\n【鑑定スタイル】\nお客様はズバッと率直な鑑定を希望されています。\n良い面だけでなく、課題・弱点・注意点を忖度しないで包み隠さず伝えること。\nマイルドな表現で丸めない。ただしソフィーとしての品と温かみは保つこと。`;
            }
        }

        const messages = [{ role: 'user', content: prompt }];

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ messages, search: false, grade: selectedGrade, style: selectedStyle })
            });
            const data = await res.json();

            const resultText = data.ok ? data.text : 'エラーが発生しました。もう一度お試しください。';
            const now = new Date();
            const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
            const personLabel = personName ? `${personName}（${selectedGender}）` : `${year}年${month}月${day}日生（${selectedGender}）`;
            const gradeLabel = selectedGrade === 'light' ? 'ライト' : 'プレミア';
            const resultHeader = `【${selectedTheme}・${gradeLabel}】${personLabel}　${dateStr}`;
            const formatted = resultText
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '')
                .replace(/\*\*/g, '')
                .replace(/^#{1,3}\s*(.+)$/gm, '<span style="color:#f0b56e; font-weight:bold; font-size:0.88rem; display:block; margin:8px 0 2px;">$1</span>')
                .replace(/^-{2,}$/gm, '')
                .replace(/\n{3,}/g, '\n\n')
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
                        ソフィーの鑑定結果
                    </div>
                    <div style="padding:4px 12px 6px; color:#888; font-size:0.72rem; border-bottom:1px solid #222;">${resultHeader}</div>
                    <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.9;">${formatted}</div>
                    <div style="padding:0 10px 10px;">
                        <button id="ft-meishiki-btn2" style="width:100%; background:#1a1a2a; color:#9b59b6;
                            border:1px solid #6a3a8a; height:36px; border-radius:4px;
                            font-size:0.8rem; margin-bottom:6px;">📊 命式を確認する</button>
                        <div id="ft-meishiki-area2" style="display:none; margin-bottom:8px;"></div>
                        <button id="ft-copy" style="width:100%; background:#1a2a3a; color:#5ba3d9;
                            border:1px solid #1a5276; height:40px; border-radius:4px;
                            font-size:0.85rem;">📋 結果をコピー</button>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button id="ft-fullscreen-result" style="flex:1; background:#1a1a2a; color:#aaa;
                                border:1px solid #444; height:36px; border-radius:4px;
                                font-size:0.72rem; cursor:pointer;">📄 診断を全画面</button>
                            <button id="ft-fullscreen-meishiki" style="flex:1; background:#1a1a2a; color:#aaa;
                                border:1px solid #444; height:36px; border-radius:4px;
                                font-size:0.72rem; cursor:pointer;">🀄 命式表を全画面</button>
                        </div>
                    </div>
                </div>`;

            if (lv) { lv.innerHTML = resultHtml; }
            if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
            if (ctrlBtn) { ctrlBtn.textContent = '天命診断を行う'; ctrlBtn.style.color = '#ff69b4'; ctrlBtn.disabled = false; }

            window._showMeishikiPanel = () => {
                const area = document.getElementById('ft-meishiki-area2');
                if (!area) return;
                if (area.style.display !== 'none') { area.style.display = 'none'; return; }
                import('./meishiki.js').then(m => {
                    const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
                    const raw = m.getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
                    const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
                    const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
                    area.style.display = 'block';
                    area.innerHTML = buildMeishikiHtml(data, parseInt(year), parseInt(month), parseInt(day), selectedGender);
                });
            };

            window._meishikiFullscreen = () => {
                import('./meishiki.js').then(m => {
                    const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
                    const raw = m.getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
                    const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
                    const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
                    window.showMeishikiHtmlFullscreen(buildMeishikiHtml(data, parseInt(year), parseInt(month), parseInt(day), selectedGender));
                });
            };

            window._fortuneBack = () => showMyFortune(onBack, savedPrefill);

            document.getElementById('ft-meishiki-btn2').onclick = () => window._showMeishikiPanel();

            document.getElementById('ft-copy').onclick = () => {
                navigator.clipboard.writeText(resultHeader + '\n\n' + resultText)
                    .then(() => alert('鑑定結果をコピーしました。メモアプリに貼り付けてください。'))
                    .catch(() => alert('コピーに失敗しました。'));
            };

            document.getElementById('ft-fullscreen-result').onclick = () => {
                const hdrHtml = `<div style="color:#888; font-size:0.78rem; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #333;">${resultHeader}</div>`;
                window.showResultFullscreen('ソフィーの鑑定結果', hdrHtml + formatted);
            };

            document.getElementById('ft-fullscreen-meishiki').onclick = () => window._meishikiFullscreen();

        } catch (e) {
            alert('通信エラーが発生しました。');
            btn.disabled = false;
            if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
            if (ctrlBtn) { ctrlBtn.textContent = '天命診断を行う'; ctrlBtn.style.color = '#ff69b4'; ctrlBtn.disabled = false; }
        }
    };
    window._fortuneSubmit = () => {
        const btn = document.getElementById('ft-submit');
        if (btn && !btn.disabled) btn.click();
    };
}

export function showAboutPerson(onBack = null, prefill = null) {
    if (prefill === null) prefill = loadSelfPrefill();

    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');

    const monImg = document.getElementById('monitor-img');
    if (monImg) { monImg.src = './fortune_sophie.jpeg'; }
    if (window._renderConsole) window._renderConsole('fortune');
    window._fortuneBack = () => showFortuneMenu();

    const userData = window.currentUserData || {};
    const role = userData.role === 'admin' ? 'admin' : (userData.status || userData.role || 'guest');
    const lightLimitMap = { guest: 0, free: 1, active: 3, vip: 99, admin: 99 };
    const lightLimit = lightLimitMap[role] || 0;
    const todayKey = new Date().toISOString().slice(0, 10);
    const usedToday = userData.lastFortuneBDate === todayKey ? (userData.dailyFortuneBCount || 0) : 0;
    const lightRemaining = Math.max(0, lightLimit - usedToday);
    const totalTickets = (userData.dailyTickets || 0) + (userData.weeklyTickets || 0) + (userData.purchasedTickets || 0);

    const makeDots = (filled, total) => Array.from({length: total}, (_, i) =>
        `<span style="color:${i < filled ? '#f0b56e' : '#444'}; font-size:0.75rem;">●</span>`).join('');

    const lightDotsHtml = makeDots(Math.min(5, lightRemaining), Math.min(5, lightLimit));
    const premiumDotsHtml = makeDots(Math.min(5, totalTickets), 5);

    const formHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                この人どんな人
            </div>
            <div style="padding:10px;">
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <div style="flex:1; border:1px solid #333; border-radius:6px; padding:8px;">
                        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                            <div style="color:#aaa; font-size:0.72rem;">生年月日</div>
                            <button id="ft-people" style="background:#1a2a1a; color:#7fd97f; border:1px solid #3a6a4a; padding:5px 12px; border-radius:5px; font-size:0.72rem;">📖 人物帳</button>
                        </div>
                        <div style="display:flex; gap:3px; align-items:center; margin-bottom:6px;">
                            <input type="number" id="ft-year" placeholder="1980" min="1900" max="2010"
                                value="${prefill ? prefill.year : ''}"
                                style="width:60px; background:#000; border:1px solid #555; color:#fff;
                                       height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                            <span style="color:#aaa; font-size:0.75rem;">年</span>
                            <input type="number" id="ft-month" placeholder="1" min="1" max="12"
                                value="${prefill ? prefill.month : ''}"
                                style="width:40px; background:#000; border:1px solid #555; color:#fff;
                                       height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                            <span style="color:#aaa; font-size:0.75rem;">月</span>
                            <input type="number" id="ft-day" placeholder="1" min="1" max="31"
                                value="${prefill ? prefill.day : ''}"
                                style="width:40px; background:#000; border:1px solid #555; color:#fff;
                                       height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                            <span style="color:#aaa; font-size:0.75rem;">日</span>
                        </div>
                        <div style="display:flex; gap:6px;">
                            <button class="ft-gender" data-val="男性"
                                style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                       height:28px; border-radius:4px; font-size:0.8rem;">男性</button>
                            <button class="ft-gender" data-val="女性"
                                style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                       height:28px; border-radius:4px; font-size:0.8rem;">女性</button>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; width:96px; flex-shrink:0;">
                        <button id="ft-grade-light" style="background:#2a2a1a; border:2px solid #f0b56e;
                            border-radius:6px; padding:7px 8px; text-align:left; cursor:pointer; width:100%;">
                            <div style="font-weight:bold; color:#f0b56e; font-size:0.75rem; margin-bottom:2px;">ライト診断</div>
                            <div>${lightDotsHtml}</div>
                        </button>
                        <button id="ft-grade-premium" style="background:#1a1a2a; border:1px solid #555;
                            border-radius:6px; padding:7px 8px; text-align:left; cursor:pointer; width:100%;">
                            <div style="font-weight:bold; color:#9b59b6; font-size:0.75rem; margin-bottom:2px;">プレミア診断</div>
                            <div>${premiumDotsHtml}</div>
                        </button>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.72rem; margin-bottom:4px;">鑑定テーマ とスタイル</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button class="ft-theme" data-val="性格分析"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">🔍 性格分析</button>
                        <button class="ft-theme" data-val="SWOT分析"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">📊 SWOT分析</button>
                        <button class="ft-theme ft-premium-only" data-val="アプローチ法"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💡 アプローチ法</button>
                        <button class="ft-theme ft-premium-only" data-val="地雷ポイント"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💣 地雷ポイント</button>
                        <button class="ft-theme ft-premium-only" data-val="弱点と反撃法"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">⚔️ 弱点と反撃法</button>
                        <button class="ft-theme ft-premium-only" data-val="プレゼント"
                            style="background:#1a1a1a; color:#555; border:1px solid #2a2a2a;
                                   height:36px; border-radius:4px; font-size:0.8rem;">🎁 プレゼント</button>
                    </div>
                </div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                    <button id="ft-style-balance" style="flex:1; background:#2a1a00; border:2px solid #f0b56e; border-radius:4px; height:30px; color:#f0b56e; font-size:0.75rem; cursor:pointer;">バランス</button>
                    <button id="ft-style-straight" style="flex:1; background:#1a1a1a; border:1px solid #444; border-radius:4px; height:30px; color:#888; font-size:0.75rem; cursor:pointer;">ストレート</button>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="color:#aaa; font-size:0.72rem; margin-bottom:4px;">気になる点・関係性など</div>
                    <textarea id="ft-worry" rows="2" placeholder="例：職場の上司、もっと懐に入りたい"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit; box-sizing:border-box;"></textarea>
                </div>
                <button id="ft-submit" style="display:none;"></button>
            </div>
        </div>
        <div id="ap-meishiki-area2" style="display:none; margin:10px;"></div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let selectedGender = prefill ? prefill.gender : '';
    const personName = prefill?.name || '';
    let selectedTheme = '';
    let selectedGrade = 'light';

    function _updateGradeUI() {
        const lightBtn = document.getElementById('ft-grade-light');
        const premiumBtn = document.getElementById('ft-grade-premium');
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
        document.querySelectorAll('.ft-premium-only').forEach(btn => {
            if (selectedGrade === 'light') {
                if (btn.dataset.val === selectedTheme) selectedTheme = '';
                btn.disabled = true;
                btn.style.color = '#555';
                btn.style.borderColor = '#2a2a2a';
                btn.style.background = '#1a1a1a';
            } else {
                btn.disabled = false;
                if (btn.dataset.val === selectedTheme) {
                    btn.style.background = '#8e44ad';
                    btn.style.color = '#fff';
                    btn.style.borderColor = '#9b59b6';
                } else {
                    btn.style.background = '#1a1a1a';
                    btn.style.color = '#888';
                    btn.style.borderColor = '#444';
                }
            }
        });
    }

    let selectedStyle = 'balance';

    function _updateStyleUI() {
        const balBtn = document.getElementById('ft-style-balance');
        const strBtn = document.getElementById('ft-style-straight');
        if (!balBtn || !strBtn) return;
        if (selectedStyle === 'balance') {
            balBtn.style.border = '2px solid #f0b56e'; balBtn.style.background = '#2a1a00'; balBtn.style.color = '#f0b56e';
            strBtn.style.border = '1px solid #444'; strBtn.style.background = '#1a1a1a'; strBtn.style.color = '#888';
        } else {
            balBtn.style.border = '1px solid #444'; balBtn.style.background = '#1a1a1a'; balBtn.style.color = '#888';
            strBtn.style.border = '2px solid #ff6b6b'; strBtn.style.background = '#2a0a0a'; strBtn.style.color = '#ff6b6b';
        }
    }

    document.getElementById('ft-grade-light').onclick = () => { selectedGrade = 'light'; _updateGradeUI(); };
    document.getElementById('ft-grade-premium').onclick = () => { selectedGrade = 'premium'; _updateGradeUI(); };
    document.getElementById('ft-style-balance').onclick = () => { selectedStyle = 'balance'; _updateStyleUI(); };
    document.getElementById('ft-style-straight').onclick = () => { selectedStyle = 'straight'; _updateStyleUI(); };

    document.querySelectorAll('.ft-gender').forEach(btn => {
        if (selectedGender && btn.dataset.val === selectedGender) {
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
        }
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ft-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
            selectedGender = btn.dataset.val;
        });
    });

    document.querySelectorAll('.ft-theme').forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.disabled) return;
            document.querySelectorAll('.ft-theme:not(:disabled)').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#8e44ad'; btn.style.color = '#fff'; btn.style.borderColor = '#9b59b6';
            selectedTheme = btn.dataset.val;
        });
    });

    window._showMeishikiPanel = () => {
        const area = document.getElementById('ap-meishiki-area2');
        if (!area) return;
        if (area.style.display !== 'none') { area.style.display = 'none'; return; }
        const y = parseInt(document.getElementById('ft-year')?.value);
        const mo = parseInt(document.getElementById('ft-month')?.value);
        const d = parseInt(document.getElementById('ft-day')?.value);
        const g = selectedGender || '不明';
        if (!y || !mo || !d) return;
        import('./meishiki.js').then(m => {
            const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
            const raw = m.getFullMeishiki(y, mo, d, g);
            const adapt = col => col ? { ...col, stemInfo: siMap[col.stem] || {} } : null;
            const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
            area.style.display = 'block';
            area.innerHTML = buildMeishikiHtml(data, y, mo, d, g);
        });
    };

    document.getElementById('ft-people').onclick = () => {
        const cur = {
            year: document.getElementById('ft-year').value,
            month: document.getElementById('ft-month').value,
            day: document.getElementById('ft-day').value,
            gender: selectedGender
        };
        showPeopleBook(
            (person) => {
                const [y, m, d] = person.birth.split('-');
                showAboutPerson(onBack, { year: y, month: parseInt(m), day: parseInt(d), gender: person.gender, name: person.name });
            },
            () => showAboutPerson(onBack, cur)
        );
    };

    document.getElementById('ft-submit').onclick = async () => {
        const year = document.getElementById('ft-year').value;
        const month = document.getElementById('ft-month').value;
        const day = document.getElementById('ft-day').value;

        if (!year || !month || !day) { alert('生年月日を入力してください'); return; }
        if (!selectedGender) { alert('性別を選択してください'); return; }
        if (!selectedTheme) { alert('鑑定テーマを選択してください'); return; }

        if (selectedGrade === 'light') {
            if (!await window.checkAccess('fortune_haiku')) return;
        } else {
            if (!await window.checkAccess('fortune_sonnet')) return;
        }

        const worry = document.getElementById('ft-worry').value.trim();
        const savedPrefill = { year, month, day, gender: selectedGender, name: personName };
        const ctrlBtn = document.getElementById('c-fortune-submit');
        let colorTimer = null;
        if (ctrlBtn) {
            ctrlBtn.textContent = '診断中';
            ctrlBtn.disabled = true;
            let flip = false;
            colorTimer = setInterval(() => { flip = !flip; ctrlBtn.style.color = flip ? '#ff1493' : '#ff69b4'; }, 1000);
        }

        const btn = document.getElementById('ft-submit');
        btn.disabled = true;

        const pillars = getThreePillars(parseInt(year), parseInt(month), parseInt(day));
        const today = new Date();
        const todayStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;

        let prompt;
        if (selectedGrade === 'light') {
            prompt = `${sophieChar}
【現在の日付】${todayStr}
あなたはBARソフィーのバーテンダー「ソフィー」です。

【この方】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
命式：年柱 ${pillars.year}・月柱 ${pillars.month}・日柱 ${pillars.day}
${worry ? `気になる点・関係性：${worry}` : ''}

この人の${selectedTheme}について、命式をもとに100字以内でお伝えください。`;
        } else {
            const fullData = getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
            const meishikiDetail = `
命式詳細：
・年柱：${pillars.year}（通変星：${fullData?.columns?.year?.tsuhensei || ''}・十二運星：${fullData?.columns?.year?.juniUnsei || ''}）
・月柱：${pillars.month}（通変星：${fullData?.columns?.month?.tsuhensei || ''}・十二運星：${fullData?.columns?.month?.juniUnsei || ''}）
・日柱：${pillars.day}（通変星：日主・十二運星：${fullData?.columns?.day?.juniUnsei || ''}）
五行バランス：${Object.entries(fullData?.gogyoBalance || {}).map(([g,c]) => `${g}${c}`).join('・')}
`;
            const baseIntro = `${sophieChar}
【現在の日付】${todayStr}
※鑑定は必ずこの日付を基準に行うこと。「来年は○○年」などの表現も正確に。
あなたは四柱推命を極めた占い師であり、BARソフィーのバーテンダー「ソフィー」です。
あなたにお客さんから相談がありました。

【この方】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
命式：年柱 ${pillars.year}・月柱 ${pillars.month}・日柱 ${pillars.day}
${meishikiDetail}
${worry ? `気になる点・関係性：${worry}` : ''}`;

            if (selectedTheme === '性格分析') {
                prompt = `${baseIntro}

この人の本質的な気質・価値観・色合いを四柱推命で読み解いて、カウンターで静かに語りかけるように伝えてください。強い弱いではなく、この人ならではの色合いとして。1000字程度。`;
            } else if (selectedTheme === 'SWOT分析') {
                prompt = `${baseIntro}

この人の強み・弱み・活かせる機会・気をつけるべき脅威を四柱推命で読み解いて、付き合い方のアドバイスも添えてください。1000字程度。`;
            } else if (selectedTheme === 'アプローチ法') {
                prompt = `${baseIntro}

この人の心を開くためのアプローチ方法を四柱推命で読み解いて具体的に伝えてください。距離の縮め方・響く言葉・態度を含めて。1000字程度。`;
            } else if (selectedTheme === '地雷ポイント') {
                prompt = `${baseIntro}

この人の地雷・触れてはいけない急所を四柱推命で読み解いてください。800字程度。`;
            } else if (selectedTheme === '弱点と反撃法') {
                prompt = `${baseIntro}

この人が攻められて弱いところ・こちらの反撃ポイントを四柱推命で読み解いてください。800字程度。`;
            } else if (selectedTheme === 'プレゼント') {
                prompt = `${baseIntro}

この人の命式から、喜ぶプレゼントとラッキーアイテムを具体的に提案してください。300字程度。`;
            }
            if (selectedStyle === 'straight') {
                prompt += `\n【鑑定スタイル】\nお客様はズバッと率直な鑑定を希望されています。\n良い面だけでなく、課題・弱点・注意点を忖度しないで包み隠さず伝えること。\nマイルドな表現で丸めない。ただしソフィーとしての品と温かみは保つこと。`;
            }
        }

        const messages = [{ role: 'user', content: prompt }];

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ messages, search: false, grade: selectedGrade, style: selectedStyle })
            });
            const data = await res.json();

            const resultText = data.ok ? data.text : 'エラーが発生しました。もう一度お試しください。';
            const now = new Date();
            const dateStr = `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日`;
            const personLabel = personName ? `${personName}（${selectedGender}）` : `${year}年${month}月${day}日生（${selectedGender}）`;
            const gradeLabel = selectedGrade === 'light' ? 'ライト' : 'プレミア';
            const resultHeader = `【${selectedTheme}・${gradeLabel}】${personLabel}　${dateStr}`;
            const formatted = resultText
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*([^*]+)\*/g, '')
                .replace(/\*\*/g, '')
                .replace(/^#{1,3}\s*(.+)$/gm, '<span style="color:#f0b56e; font-weight:bold; font-size:0.88rem; display:block; margin:8px 0 2px;">$1</span>')
                .replace(/^-{2,}$/gm, '')
                .replace(/\n{3,}/g, '\n\n')
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
                        ソフィーの鑑定結果
                    </div>
                    <div style="padding:4px 12px 6px; color:#888; font-size:0.72rem; border-bottom:1px solid #222;">${resultHeader}</div>
                    <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.9;">${formatted}</div>
                    <div style="padding:0 10px 10px;">
                        <div id="ft-meishiki-area2" style="display:none; margin-bottom:8px;"></div>
                        <button id="ft-copy" style="width:100%; background:#1a2a3a; color:#5ba3d9;
                            border:1px solid #1a5276; height:40px; border-radius:4px;
                            font-size:0.85rem;">📋 結果をコピー</button>
                        <div style="display:flex; gap:6px; margin-top:6px;">
                            <button id="ft-fullscreen-result" style="flex:1; background:#1a1a2a; color:#aaa;
                                border:1px solid #444; height:36px; border-radius:4px;
                                font-size:0.72rem; cursor:pointer;">📄 診断を全画面</button>
                            <button id="ft-fullscreen-meishiki" style="flex:1; background:#1a1a2a; color:#aaa;
                                border:1px solid #444; height:36px; border-radius:4px;
                                font-size:0.72rem; cursor:pointer;">🀄 命式表を全画面</button>
                        </div>
                    </div>
                </div>`;

            if (lv) { lv.innerHTML = resultHtml; }
            if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
            if (ctrlBtn) { ctrlBtn.textContent = '天命診断を行う'; ctrlBtn.style.color = '#ff69b4'; ctrlBtn.disabled = false; }

            window._showMeishikiPanel = () => {
                const area = document.getElementById('ft-meishiki-area2');
                if (!area) return;
                if (area.style.display !== 'none') { area.style.display = 'none'; return; }
                import('./meishiki.js').then(m => {
                    const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
                    const raw = m.getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
                    const adapt = col => col ? {...col, stemInfo: siMap[col.stem] || {}} : null;
                    const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
                    area.style.display = 'block';
                    area.innerHTML = buildMeishikiHtml(data, parseInt(year), parseInt(month), parseInt(day), selectedGender);
                });
            };

            window._meishikiFullscreen = () => {
                import('./meishiki.js').then(m => {
                    const siMap = {甲:{gogyo:'木',inyo:'陽'},乙:{gogyo:'木',inyo:'陰'},丙:{gogyo:'火',inyo:'陽'},丁:{gogyo:'火',inyo:'陰'},戊:{gogyo:'土',inyo:'陽'},己:{gogyo:'土',inyo:'陰'},庚:{gogyo:'金',inyo:'陽'},辛:{gogyo:'金',inyo:'陰'},壬:{gogyo:'水',inyo:'陽'},癸:{gogyo:'水',inyo:'陰'}};
                    const raw = m.getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
                    const adapt = col => col ? {...col, stemInfo: siMap[col.stem] || {}} : null;
                    const data = { ...raw, yearPillar: adapt(raw.columns?.year), monthPillar: adapt(raw.columns?.month), dayPillar: adapt(raw.columns?.day) };
                    window.showMeishikiHtmlFullscreen(buildMeishikiHtml(data, parseInt(year), parseInt(month), parseInt(day), selectedGender));
                });
            };

            window._fortuneBack = () => showAboutPerson(onBack, savedPrefill);

            document.getElementById('ft-copy').onclick = () => {
                navigator.clipboard.writeText(resultHeader + '\n\n' + resultText)
                    .then(() => alert('鑑定結果をコピーしました。メモアプリに貼り付けてください。'))
                    .catch(() => alert('コピーに失敗しました。'));
            };

            document.getElementById('ft-fullscreen-result').onclick = () => {
                const hdrHtml = `<div style="color:#888; font-size:0.78rem; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #333;">${resultHeader}</div>`;
                window.showResultFullscreen('ソフィーの鑑定結果', hdrHtml + formatted);
            };

            document.getElementById('ft-fullscreen-meishiki').onclick = () => window._meishikiFullscreen();

        } catch (e) {
            alert('通信エラーが発生しました。');
            btn.disabled = false;
            if (colorTimer) { clearInterval(colorTimer); colorTimer = null; }
            if (ctrlBtn) { ctrlBtn.textContent = '天命診断を行う'; ctrlBtn.style.color = '#ff69b4'; ctrlBtn.disabled = false; }
        }
    };
    window._fortuneSubmit = () => {
        const btn = document.getElementById('ft-submit');
        if (btn && !btn.disabled) btn.click();
    };
}

export function showFortuneMenu(onBack = null) {
    window.playSophieVoice?.('fortune');
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');

    const monImg = document.getElementById('monitor-img');
    if (monImg) { monImg.src = './front_sophie.jpeg'; }
    if (window._renderConsole) window._renderConsole('standard');

    const todayKey = new Date().toISOString().slice(0, 10);
    const cached = (() => { try { const r = JSON.parse(localStorage.getItem('sophie_daily_fortune') || 'null'); return r && r.date === todayKey ? r : null; } catch { return null; } })();
    const dailyLabel = cached ? '🌙 今日のアドバイス（取得済み）' : '🌙 今日のアドバイスを聞く';

    const menuHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                🔮 ソフィーの天命診断
            </div>
            <div style="padding:10px;">
                <button id="fm-daily" style="width:100%; height:48px; display:block; border-radius:8px;
                    font-weight:bold; font-size:1.1rem; font-family:sans-serif;
                    background:#ffffff; color:#ff69b4;
                    border:2px solid #00d2ff; margin-bottom:8px; cursor:pointer;">${dailyLabel}</button>
                <button id="fm-my-fortune" class="act-btn" style="background:#2a1a3a; color:#c39bd3;
                    border:1px solid #6a3a8a; margin-bottom:8px;">🌟 あなたのご相談</button>
                <button id="fm-about-person" class="act-btn" style="background:#1a1a2a; color:#9b59b6;
                    border:1px solid #6a3a8a; margin-bottom:8px;">👤 この人どんな人</button>
                <button id="fm-compat" class="act-btn" style="background:#1a2a3a; color:#5ba3d9;
                    border:1px solid #1a5276; margin-bottom:8px;">💑 相性を見てもらう</button>
                <button id="fm-people" class="act-btn" style="background:#1a2a1a; color:#7fd97f; border:1px solid #3a6a4a; margin-bottom:0;">👥 人物帳</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = menuHtml; }
    if (nm) nm.style.display = 'none';

    document.getElementById('fm-daily').onclick = () => showDailyAdvice(showFortuneMenu);
    document.getElementById('fm-people').onclick = () => showPeopleBook(null, showFortuneMenu);
    document.getElementById('fm-my-fortune').onclick = () => showMyFortune(showFortuneMenu);
    document.getElementById('fm-about-person').onclick = () => showAboutPerson(showFortuneMenu);
    document.getElementById('fm-compat').onclick = async () => {
        if (!await window.checkAccess('compatibility')) return;
        showCompatibility(showFortuneMenu);
    };
}

export async function showDailyAdvice(onBack = null, prefillOverride = null, forceForm = false) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const monImg = document.getElementById('monitor-img');
    if (monImg) monImg.src = './fortune_sophie.jpeg';
    if (window._renderConsole) window._renderConsole('fortune');
    window._fortuneBack = () => { if (onBack) onBack(); };

    const todayKey = new Date().toISOString().slice(0, 10);
    const userData = window.currentUserData || {};
    const role = userData.role === 'admin' ? 'admin' : (userData.status || userData.role || 'guest');
    const lightLimitMap = { guest: 0, free: 1, active: 3, vip: 99, admin: 99 };
    const lightLimit = lightLimitMap[role] || 0;
    const usedToday = userData.lastFortuneBDate === todayKey ? (userData.dailyFortuneBCount || 0) : 0;
    const lightRemaining = Math.max(0, lightLimit - usedToday);
    const totalTickets = (userData.dailyTickets || 0) + (userData.weeklyTickets || 0) + (userData.purchasedTickets || 0);

    const makeDots = (filled, total) => Array.from({length: total}, (_, i) =>
        `<span style="color:${i < filled ? '#f0b56e' : '#444'}; font-size:0.75rem;">●</span>`).join('');
    const lightDotsHtml = makeDots(Math.min(5, lightRemaining), Math.min(5, lightLimit));
    const premiumDotsHtml = makeDots(Math.min(5, totalTickets), 5);

    const getCached = () => {
        try {
            const r = JSON.parse(localStorage.getItem('sophie_daily_fortune') || 'null');
            return r && r.date === todayKey ? r : null;
        } catch { return null; }
    };

    const showResult = (text, fromCache = false, gradeUsed = 'light') => {
        const formatted = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '')
            .replace(/\*\*/g, '')
            .replace(/^#{1,3}\s*(.+)$/gm, '<span style="color:#f0b56e; font-weight:bold; font-size:0.88rem; display:block; margin:8px 0 2px;">$1</span>')
            .replace(/^-{2,}$/gm, '')
            .replace(/\n{2,}/g, '\n')
            .replace(/\n/g, '<br>');

        const cacheNote = fromCache ? '<span style="color:#555; font-size:0.65rem;">（本日取得済み）</span>' : '';
        const gradeLabel = gradeUsed === 'premium' ? 'プレミア' : 'ライト';
        const d = new Date();
        const dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #3a6a4a 50%, #f0b56e 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                    <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                    🌙 今日のアドバイス・${gradeLabel} ${cacheNote}
                </div>
                <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.9;">${formatted}</div>
                <div style="padding:0 10px 10px;">
                    <div style="color:#888; font-size:0.72rem; text-align:center; margin-bottom:8px;">${dateStr}</div>
                    <button id="da-copy" style="width:100%; background:#1a2a3a; color:#5ba3d9;
                        border:1px solid #1a5276; height:40px; border-radius:4px;
                        font-size:0.85rem; margin-bottom:6px;">📋 コピーする</button>
                    <button id="da-refresh" style="width:100%; background:#1a1a1a; color:#555;
                        border:1px solid #333; height:36px; border-radius:4px;
                        font-size:0.75rem;">↩ 入力フォームに戻る</button>
                </div>
            </div>`;

        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        if (nm) nm.style.display = 'none';

        document.getElementById('da-copy').onclick = () => {
            navigator.clipboard.writeText(`🌙 今日のアドバイス・${gradeLabel}（${dateStr}）\n\n${text}`)
                .then(() => alert('コピーしました。'))
                .catch(() => alert('コピーに失敗しました。'));
        };
        document.getElementById('da-refresh').onclick = () => {
            let backPrefill = null;
            try {
                const r = JSON.parse(localStorage.getItem('sophie_daily_fortune') || 'null');
                if (r?.birth) {
                    const [y, m, d] = r.birth.split('-');
                    backPrefill = { year: y, month: parseInt(m), day: parseInt(d), gender: r.gender };
                }
            } catch {}
            showDailyAdvice(onBack, backPrefill, true);
        };
    };

    const cached = getCached();
    if (cached && !forceForm) { showResult(cached.text, true, cached.grade || 'light'); return; }

    const prefill = prefillOverride !== null ? prefillOverride : loadSelfPrefill();

    const formHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #3a6a4a 50%, #f0b56e 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                🌙 今日のアドバイス
            </div>
            <div style="padding:10px;">
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                    <button id="da-grade-light" style="flex:1; background:#2a2a1a; border:2px solid #f0b56e;
                        border-radius:6px; padding:6px 8px; text-align:left; cursor:pointer;">
                        <div style="font-weight:bold; color:#f0b56e; font-size:0.75rem; margin-bottom:2px;">ライト診断</div>
                        <div>${lightDotsHtml}</div>
                    </button>
                    <button id="da-grade-premium" style="flex:1; background:#1a1a2a; border:1px solid #555;
                        border-radius:6px; padding:6px 8px; text-align:left; cursor:pointer;">
                        <div style="font-weight:bold; color:#9b59b6; font-size:0.75rem; margin-bottom:2px;">プレミア診断</div>
                        <div>${premiumDotsHtml}</div>
                    </button>
                </div>
                <div style="border-top:1px solid #333; padding-top:8px; margin-bottom:6px;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
                        <div style="color:#aaa; font-size:0.72rem;">生年月日</div>
                        <button id="da-people" style="background:#1a2a1a; color:#7fd97f; border:1px solid #3a6a4a; padding:5px 12px; border-radius:5px; font-size:0.72rem;">📖 人物帳</button>
                    </div>
                    <div style="display:flex; gap:3px; align-items:center; margin-bottom:6px;">
                        <input type="number" id="da-year" placeholder="1980" min="1900" max="2010"
                            value="${prefill ? prefill.year : ''}"
                            style="width:60px; background:#000; border:1px solid #555; color:#fff;
                                   height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                        <span style="color:#aaa; font-size:0.75rem;">年</span>
                        <input type="number" id="da-month" placeholder="1" min="1" max="12"
                            value="${prefill ? prefill.month : ''}"
                            style="width:40px; background:#000; border:1px solid #555; color:#fff;
                                   height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                        <span style="color:#aaa; font-size:0.75rem;">月</span>
                        <input type="number" id="da-day" placeholder="1" min="1" max="31"
                            value="${prefill ? prefill.day : ''}"
                            style="width:40px; background:#000; border:1px solid #555; color:#fff;
                                   height:28px; padding:0 6px; border-radius:4px; font-size:0.8rem;">
                        <span style="color:#aaa; font-size:0.75rem;">日</span>
                        <button class="da-gender" data-val="男性"
                            style="background:${prefill && prefill.gender === '男性' ? '#0096BF' : '#1a1a1a'};
                                   color:${prefill && prefill.gender === '男性' ? '#fff' : '#888'};
                                   border:1px solid ${prefill && prefill.gender === '男性' ? '#00d2ff' : '#444'};
                                   height:28px; padding:0 10px; border-radius:4px; font-size:0.8rem; margin-left:4px;">男</button>
                        <button class="da-gender" data-val="女性"
                            style="background:${prefill && prefill.gender === '女性' ? '#0096BF' : '#1a1a1a'};
                                   color:${prefill && prefill.gender === '女性' ? '#fff' : '#888'};
                                   border:1px solid ${prefill && prefill.gender === '女性' ? '#00d2ff' : '#444'};
                                   height:28px; padding:0 10px; border-radius:4px; font-size:0.8rem;">女</button>
                    </div>
                </div>
                <button id="da-submit" style="width:100%; background:#1a2a1a; color:#7fd97f;
                    border:2px solid #3a6a4a; height:44px; border-radius:6px;
                    font-size:0.9rem; font-weight:bold;">🌙 今日のアドバイスを聞く</button>
                <button id="da-submit-tomorrow" style="width:100%; background:#0d1829; color:#5ba3d9;
                    border:1px solid #1a3a6a; height:40px; border-radius:6px;
                    font-size:0.85rem; font-weight:bold; margin-top:4px;">🌙 明日のアドバイスを聞く</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let selectedGender = prefill ? prefill.gender : '';
    let selectedGrade = 'light';

    function _updateGradeUIDA() {
        const lb = document.getElementById('da-grade-light');
        const pb = document.getElementById('da-grade-premium');
        if (selectedGrade === 'light') {
            lb.style.border = '2px solid #f0b56e'; lb.style.background = '#2a2a1a';
            pb.style.border = '1px solid #555'; pb.style.background = '#1a1a2a';
        } else {
            lb.style.border = '1px solid #555'; lb.style.background = '#1a1a2a';
            pb.style.border = '2px solid #9b59b6'; pb.style.background = '#1a0a2a';
        }
    }

    document.getElementById('da-grade-light').onclick = () => { selectedGrade = 'light'; _updateGradeUIDA(); };
    document.getElementById('da-grade-premium').onclick = () => { selectedGrade = 'premium'; _updateGradeUIDA(); };

    document.querySelectorAll('.da-gender').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.da-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
            selectedGender = btn.dataset.val;
        });
    });

    document.getElementById('da-people').onclick = () => {
        const cur = {
            year: document.getElementById('da-year').value,
            month: document.getElementById('da-month').value,
            day: document.getElementById('da-day').value,
            gender: selectedGender
        };
        showPeopleBook(
            (person) => {
                const [y, m, d] = person.birth.split('-');
                showDailyAdvice(onBack, { year: y, month: parseInt(m), day: parseInt(d), gender: person.gender });
            },
            () => showDailyAdvice(onBack, cur)
        );
    };

    document.getElementById('da-submit').onclick = async () => {
        const year = document.getElementById('da-year').value;
        const month = document.getElementById('da-month').value;
        const day = document.getElementById('da-day').value;
        if (!year || !month || !day) { alert('生年月日を入力してください'); return; }
        if (!selectedGender) { alert('性別を選択してください'); return; }

        if (selectedGrade === 'light') {
            if (!await window.checkAccess('fortune_haiku')) return;
        } else {
            if (!await window.checkAccess('fortune_sonnet')) return;
        }

        const pillars = getThreePillars(parseInt(year), parseInt(month), parseInt(day));
        const today = new Date();
        const todayStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;
        const todayPillars = getThreePillars(today.getFullYear(), today.getMonth()+1, today.getDate());

        let prompt;
        if (selectedGrade === 'light') {
            prompt = `${sophieChar}
【現在の日付】${todayStr}
あなたはBARソフィーのバーテンダー「ソフィー」です。

【お客様】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
命式：年柱 ${pillars.year}・月柱 ${pillars.month}・日柱 ${pillars.day}
今日の干支：${todayPillars.day}（年：${todayPillars.year}・月：${todayPillars.month}）

今日の運気と過ごし方について、ひとことアドバイスをしてください。ソフィーらしい品のある語り口で、100字以内でお願いします。`;
        } else {
            const fullMeishiki = getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
            const detail = `
・年柱：${pillars.year}（通変星：${fullMeishiki?.columns?.year?.tsuhensei || ''}・十二運星：${fullMeishiki?.columns?.year?.juniUnsei || ''}）
・月柱：${pillars.month}（通変星：${fullMeishiki?.columns?.month?.tsuhensei || ''}・十二運星：${fullMeishiki?.columns?.month?.juniUnsei || ''}）
・日柱：${pillars.day}（十二運星：${fullMeishiki?.columns?.day?.juniUnsei || ''}）
五行バランス：${Object.entries(fullMeishiki?.gogyoBalance || {}).map(([g,c]) => `${g}${c}`).join('・')}`;
            prompt = `${sophieChar}
【現在の日付】${todayStr}
あなたはBARソフィーのバーテンダー「ソフィー」です。四柱推命を極めた占い師として、今日一日の詳細なアドバイスをお客様にお伝えください。

【お客様】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
${detail}
今日の干支：${todayPillars.day}（年：${todayPillars.year}・月：${todayPillars.month}）

【鑑定の内容】
1. 今日の運気概観（日柱との相性・五行の流れ）
2. 特に意識すべき時間帯・行動
3. 今日のラッキーポイント（色・方角・食べ物など）
4. 注意すべき点・避けるべきこと
5. 今日一日を締めるソフィーのひとこと

品のある語り口で500字程度にまとめてください。`;
        }

        const submitBtn = document.getElementById('da-submit');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '占い中...'; }

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], search: false, grade: selectedGrade })
            });
            const data = await res.json();
            const text = data.ok ? data.text : 'エラーが発生しました。';
            localStorage.setItem('sophie_daily_fortune', JSON.stringify({
                date: todayKey, text, grade: selectedGrade,
                birth: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
                gender: selectedGender
            }));
            showResult(text, false, selectedGrade);
        } catch {
            alert('通信エラーが発生しました。');
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🌙 今日のアドバイスを聞く'; }
        }
    };

    const showTomorrowResult = (text, fromCache, gradeUsed, tomorrowDate) => {
        const formatted = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '')
            .replace(/\*\*/g, '')
            .replace(/^#{1,3}\s*(.+)$/gm, '<span style="color:#5ba3d9; font-weight:bold; font-size:0.88rem; display:block; margin:8px 0 2px;">$1</span>')
            .replace(/^-{2,}$/gm, '')
            .replace(/\n{2,}/g, '\n')
            .replace(/\n/g, '<br>');

        const cacheNote = fromCache ? '<span style="color:#555; font-size:0.65rem;">（取得済み）</span>' : '';
        const gradeLabel = gradeUsed === 'premium' ? 'プレミア' : 'ライト';
        const d = tomorrowDate || new Date();
        const dateStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #1a3a6a 50%, #5ba3d9 100%) border-box;">
                <div style="color:#5ba3d9; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                    <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                    🌙 明日のアドバイス・${gradeLabel} ${cacheNote}
                </div>
                <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.9;">${formatted}</div>
                <div style="padding:0 10px 10px;">
                    <div style="color:#888; font-size:0.72rem; text-align:center; margin-bottom:8px;">${dateStr}（明日）</div>
                    <button id="da-tomorrow-copy" style="width:100%; background:#1a2a3a; color:#5ba3d9;
                        border:1px solid #1a5276; height:40px; border-radius:4px;
                        font-size:0.85rem; margin-bottom:6px;">📋 コピーする</button>
                    <button id="da-tomorrow-back" style="width:100%; background:#1a1a1a; color:#555;
                        border:1px solid #333; height:36px; border-radius:4px;
                        font-size:0.75rem;">↩ 入力フォームに戻る</button>
                </div>
            </div>`;

        if (lv) lv.innerHTML = html;
        if (nm) nm.style.display = 'none';

        document.getElementById('da-tomorrow-copy').onclick = () => {
            navigator.clipboard.writeText(`🌙 明日のアドバイス・${gradeLabel}（${dateStr}）\n\n${text}`)
                .then(() => alert('コピーしました。'))
                .catch(() => alert('コピーに失敗しました。'));
        };
        document.getElementById('da-tomorrow-back').onclick = () => {
            let backPrefill = null;
            try {
                const tc = JSON.parse(localStorage.getItem('sophie_tomorrow_fortune') || 'null');
                if (tc?.birth) {
                    const [y, m, d] = tc.birth.split('-');
                    backPrefill = { year: y, month: parseInt(m), day: parseInt(d), gender: tc.gender };
                }
            } catch {}
            showDailyAdvice(onBack, backPrefill, true);
        };
    };

    document.getElementById('da-submit-tomorrow').onclick = async () => {
        const year = document.getElementById('da-year').value;
        const month = document.getElementById('da-month').value;
        const day = document.getElementById('da-day').value;
        if (!year || !month || !day) { alert('生年月日を入力してください'); return; }
        if (!selectedGender) { alert('性別を選択してください'); return; }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowKey = tomorrow.toISOString().slice(0, 10);

        try {
            const tc = JSON.parse(localStorage.getItem('sophie_tomorrow_fortune') || 'null');
            if (tc && tc.date === tomorrowKey) {
                showTomorrowResult(tc.text, true, tc.grade || 'light', tomorrow);
                return;
            }
        } catch {}

        if (selectedGrade === 'light') {
            if (!await window.checkAccess('fortune_haiku')) return;
        } else {
            if (!await window.checkAccess('fortune_sonnet')) return;
        }

        const pillars = getThreePillars(parseInt(year), parseInt(month), parseInt(day));
        const todayDateObj = new Date();
        const todayStr = `${todayDateObj.getFullYear()}年${todayDateObj.getMonth()+1}月${todayDateObj.getDate()}日`;
        const tomorrowStr = `${tomorrow.getFullYear()}年${tomorrow.getMonth()+1}月${tomorrow.getDate()}日`;
        const tomorrowPillars = getThreePillars(tomorrow.getFullYear(), tomorrow.getMonth()+1, tomorrow.getDate());

        let tomorrowPrompt;
        if (selectedGrade === 'light') {
            tomorrowPrompt = `${sophieChar}
【今日の日付】${todayStr}
【鑑定対象】明日（${tomorrowStr}）
あなたはBARソフィーのバーテンダー「ソフィー」です。

【お客様】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
命式：年柱 ${pillars.year}・月柱 ${pillars.month}・日柱 ${pillars.day}
${tomorrowStr}の干支：${tomorrowPillars.day}（年：${tomorrowPillars.year}・月：${tomorrowPillars.month}）

${tomorrowStr}（明日）の運気と過ごし方について、ひとことアドバイスをしてください。ソフィーらしい品のある語り口で、100字以内でお願いします。`;
        } else {
            const fullMeishiki = getFullMeishiki(parseInt(year), parseInt(month), parseInt(day), selectedGender);
            const detail = `
・年柱：${pillars.year}（通変星：${fullMeishiki?.columns?.year?.tsuhensei || ''}・十二運星：${fullMeishiki?.columns?.year?.juniUnsei || ''}）
・月柱：${pillars.month}（通変星：${fullMeishiki?.columns?.month?.tsuhensei || ''}・十二運星：${fullMeishiki?.columns?.month?.juniUnsei || ''}）
・日柱：${pillars.day}（十二運星：${fullMeishiki?.columns?.day?.juniUnsei || ''}）
五行バランス：${Object.entries(fullMeishiki?.gogyoBalance || {}).map(([g,c]) => `${g}${c}`).join('・')}`;
            tomorrowPrompt = `${sophieChar}
【今日の日付】${todayStr}
【鑑定対象】明日（${tomorrowStr}）
あなたはBARソフィーのバーテンダー「ソフィー」です。四柱推命を極めた占い師として、明日（${tomorrowStr}）の詳細なアドバイスをお客様にお伝えください。

【お客様】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
${detail}
${tomorrowStr}の干支：${tomorrowPillars.day}（年：${tomorrowPillars.year}・月：${tomorrowPillars.month}）

【鑑定の内容】
1. ${tomorrowStr}（明日）の運気概観（日柱との相性・五行の流れ）
2. 特に意識すべき時間帯・行動
3. ${tomorrowStr}（明日）のラッキーポイント（色・方角・食べ物など）
4. 注意すべき点・避けるべきこと
5. 明日（${tomorrowStr}）を締めるソフィーのひとこと

品のある語り口で500字程度にまとめてください。`;
        }

        const tomorrowBtn = document.getElementById('da-submit-tomorrow');
        if (tomorrowBtn) { tomorrowBtn.disabled = true; tomorrowBtn.textContent = '占い中...'; }

        try {
            const res = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({ messages: [{ role: 'user', content: tomorrowPrompt }], search: false, grade: selectedGrade })
            });
            const data = await res.json();
            const text = data.ok ? data.text : 'エラーが発生しました。';
            localStorage.setItem('sophie_tomorrow_fortune', JSON.stringify({
                date: tomorrowKey, text, grade: selectedGrade,
                birth: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
                gender: selectedGender
            }));
            showTomorrowResult(text, false, selectedGrade, tomorrow);
        } catch {
            alert('通信エラーが発生しました。');
            if (tomorrowBtn) { tomorrowBtn.disabled = false; tomorrowBtn.textContent = '🌙 明日のアドバイスを聞く'; }
        }
    };
}

function buildMeishikiHtml(data, year, month, day, gender) {
    const stemInfo = {
        甲: { read:'きのえ', catch:'頼れる大樹', gogyo:'木・陽', desc:'強い意志と責任感を持つリーダー。困難にも折れず、まっすぐ上を目指す。' },
        乙: { read:'きのと', catch:'可憐な草花', gogyo:'木・陰', desc:'しなやかで適応力が高い。人の心を読む繊細さと、したたかな生命力を持つ。' },
        丙: { read:'ひのえ', catch:'情熱の太陽', gogyo:'火・陽', desc:'明るく豪快で人を惹きつける。太陽のように周囲を照らし、場を温める存在。' },
        丁: { read:'ひのと', catch:'知性の灯火', gogyo:'火・陰', desc:'繊細で知的、深く考える思索家。小さくとも確かな光で人の心を照らす。' },
        戊: { read:'つちのえ', catch:'不動の大山', gogyo:'土・陽', desc:'安定感と包容力を持つ守護者。どっしりと構え、周囲に安心感を与える。' },
        己: { read:'つちのと', catch:'育みの田畑', gogyo:'土・陰', desc:'面倒見が良く、人を育てる才能がある。縁の下の力持ちとして人を支える。' },
        庚: { read:'かのえ', catch:'剛健な刀', gogyo:'金・陽', desc:'意志が強く正義感旺盛。鋭い判断力と行動力で、困難を断ち切る力を持つ。' },
        辛: { read:'かのと', catch:'煌めく宝石', gogyo:'金・陰', desc:'美意識が高く繊細。磨かれることで輝く、こだわりと完璧主義の持ち主。' },
        壬: { read:'みずのえ', catch:'大海の波', gogyo:'水・陽', desc:'スケールが大きく包容力がある。自由を愛し、大きな流れの中で力を発揮する。' },
        癸: { read:'みずのと', catch:'癒しの雫', gogyo:'水・陰', desc:'感受性豊かで直感が鋭い。静かに深く物事を見通す、癒しと知恵の持ち主。' }
    };
    const branchInfo = {
        子: { read:'ねずみ', catch:'新たな始まり', gogyo:'水・陽', desc:'知恵と生命力にあふれる。小さくとも鋭い感覚で好機をつかむ、繁栄の象徴。' },
        丑: { read:'うし', catch:'誠実な努力', gogyo:'土・陰', desc:'粘り強く着実に歩む努力家。遅くとも確実に結果を出す、信頼の象徴。' },
        寅: { read:'とら', catch:'勇猛な飛躍', gogyo:'木・陽', desc:'勇気と行動力にあふれる。果敢に挑戦し、困難を力で切り開くリーダー。' },
        卯: { read:'うさぎ', catch:'温和な発展', gogyo:'木・陰', desc:'穏やかで人当たりが良く愛される。しなやかな知恵で着実に前進する。' },
        辰: { read:'たつ', catch:'偉大な力', gogyo:'土・陽', desc:'スケールが大きく夢を持つ。強大なエネルギーで大きな目標を実現する。' },
        巳: { read:'へび', catch:'神秘の直感', gogyo:'火・陰', desc:'深く静かな知性と直感を持つ。物事の本質を見抜く、神秘的な存在。' },
        午: { read:'うま', catch:'天を駆ける', gogyo:'火・陽', desc:'情熱的で自由を愛する。颯爽と駆け抜ける行動力と華やかさを持つ。' },
        未: { read:'ひつじ', catch:'温かな絆', gogyo:'土・陰', desc:'穏やかで思いやり深く、人との絆を大切にする。芸術的センスも光る。' },
        申: { read:'さる', catch:'機知の閃き', gogyo:'金・陽', desc:'機転が利き器用で賢い。状況を素早く読み、柔軟に対応する才能を持つ。' },
        酉: { read:'とり', catch:'夜明けの先触れ', gogyo:'金・陰', desc:'美意識が高く完璧主義。細部まで丁寧に仕上げる、こだわりの持ち主。' },
        戌: { read:'いぬ', catch:'忠誠の証', gogyo:'土・陽', desc:'誠実で義理堅く、信頼される。仲間を守る強い正義感と忠誠心を持つ。' },
        亥: { read:'いのしし', catch:'純粋な突進', gogyo:'水・陰', desc:'純粋で一途、信じた道を突き進む。直感力が強く、意外な粘り強さを持つ。' }
    };
    const stemImg = {
        甲:'stem_kinoe.png', 乙:'stem_kinoto.png',
        丙:'stem_hinoe.png', 丁:'stem_hinoto.png',
        戊:'stem_tsuchinoe.png', 己:'stem_tsuchinoto.png',
        庚:'stem_kanoe.png', 辛:'stem_kanoto.png',
        壬:'stem_mizunoe.png', 癸:'stem_mizunoto.png'
    };
    const branchImg = {
        子:'branch_ne.png', 丑:'branch_ushi.png',
        寅:'branch_tora.png', 卯:'branch_u.png',
        辰:'branch_tatsu.png', 巳:'branch_mi.png',
        午:'branch_uma.png', 未:'branch_hitsuji.png',
        申:'branch_saru.png', 酉:'branch_tori.png',
        戌:'branch_inu.png', 亥:'branch_i.png'
    };
    const gogyoColor = { 木:'#4CAF50', 火:'#e74c3c', 土:'#f39c12', 金:'#bdc3c7', 水:'#3498db' };
    const stemReading = {
        甲:'きのえ',乙:'きのと',丙:'ひのえ',丁:'ひのと',
        戊:'つちのえ',己:'つちのと',庚:'かのえ',辛:'かのと',
        壬:'みずのえ',癸:'みずのと'
    };
    const branchReading = {
        子:'ね',丑:'うし',寅:'とら',卯:'う',辰:'たつ',巳:'み',
        午:'うま',未:'ひつじ',申:'さる',酉:'とり',戌:'いぬ',亥:'い'
    };
    const branchGogyo = {
        子:'水',丑:'土',寅:'木',卯:'木',辰:'土',巳:'火',
        午:'火',未:'土',申:'金',酉:'金',戌:'土',亥:'水'
    };
    const branchInyo = {
        子:'陽',丑:'陰',寅:'陽',卯:'陰',辰:'陽',巳:'陰',
        午:'陽',未:'陰',申:'陽',酉:'陰',戌:'陽',亥:'陰'
    };
    const tsuhenseiReading = {
        比肩:'ひけん',劫財:'ごうざい',食神:'しょくじん',傷官:'しょうかん',
        偏財:'へんざい',正財:'せいざい',偏官:'へんかん',正官:'せいかん',
        偏印:'へんいん',印綬:'いんじゅ',日主:'にっしゅ'
    };
    const juniUnseiReading = {
        長生:'ちょうせい',沐浴:'もくよく',冠帯:'かんたい',建禄:'けんろく',
        帝旺:'ていおう',衰:'すい',病:'びょう',死:'し',墓:'ぼ',
        絶:'ぜつ',胎:'たい',養:'よう'
    };
    const pillarHtml = (label, pillar) => {
        if (!pillar) return '';
        const si = pillar.stemInfo || {};
        const color = gogyoColor[si.gogyo] || '#aaa';
        const bGogyo = branchGogyo[pillar.branch] || '';
        const bInyo  = branchInyo[pillar.branch] || '';
        const bColor = gogyoColor[bGogyo] || '#aaa';
        return `
            <div style="flex:1; text-align:center; border-right:1px solid #333; padding:4px;">
                <div style="color:#888; font-size:0.65rem;">${label}</div>
                <img src="./img/${stemImg[pillar.stem] || ''}"
                    style="width:48px; height:48px; object-fit:contain; margin-bottom:2px; cursor:pointer;"
                    onclick="showCharacterModal('${pillar.stem}', 'stem')"
                    onerror="this.style.display='none'">
                <div style="font-size:1.2rem; font-weight:bold; color:${color}; cursor:pointer;"
                     onclick="window.showGlossaryPopup('${pillar.stem}')">
                    ${pillar.stem || ''}
                </div>
                <div style="color:${color}; font-size:0.6rem;">
                    （${stemReading[pillar.stem] || ''}）
                </div>
                <img src="./img/${branchImg[pillar.branch] || ''}"
                    style="width:44px; height:44px; object-fit:contain; margin-bottom:2px; margin-top:4px; cursor:pointer;"
                    onclick="showCharacterModal('${pillar.branch}', 'branch')"
                    onerror="this.style.display='none'">
                <div style="font-size:1.1rem; color:#ddd; cursor:pointer;"
                     onclick="window.showGlossaryPopup('${pillar.branch}')">
                    ${pillar.branch || ''}
                </div>
                <div style="color:#aaa; font-size:0.6rem;">
                    （${branchReading[pillar.branch] || ''}）
                </div>
                <div style="color:${bColor}; font-size:0.6rem;">
                    <span style="cursor:pointer;" onclick="window.showGlossaryPopup('${bGogyo}')">${bGogyo}</span>・${bInyo}
                </div>
                <div style="color:#888; font-size:0.6rem; border-top:1px solid #333; margin-top:3px; padding-top:2px;">
                    蔵干 ${(pillar.kakuchu || []).join(' ')}
                </div>
                <div style="color:#f0b56e; font-size:0.6rem; border-top:1px solid #333; margin-top:2px; padding-top:2px;">
                    <span style="cursor:pointer;" onclick="window.showGlossaryPopup('${pillar.tsuhensei || ''}')">
                        ${pillar.tsuhensei || ''}
                    </span>
                    <span style="color:#888;">
                        （${tsuhenseiReading[pillar.tsuhensei] || ''}）
                    </span>
                </div>
                <div style="color:#9b59b6; font-size:0.6rem; border-top:1px solid #333; margin-top:2px; padding-top:2px;">
                    <span style="cursor:pointer;" onclick="window.showGlossaryPopup('${pillar.juniUnsei || ''}')">
                        ${pillar.juniUnsei || ''}
                    </span>
                    <span style="color:#888;">
                        （${juniUnseiReading[pillar.juniUnsei] || ''}）
                    </span>
                </div>
            </div>`;
    };
    const balance = data.gogyoBalance || {};
    const maxVal = Math.max(...Object.values(balance), 1);
    const balanceHtml = Object.entries(balance).map(([gogyo, count]) => `
        <div style="display:flex; align-items:center; gap:6px; margin-bottom:2px;">
            <div style="color:${gogyoColor[gogyo]}; width:14px; font-size:0.75rem; cursor:pointer;"
                 onclick="window.showGlossaryPopup('${gogyo}')">${gogyo}</div>
            <div style="flex:1; background:#222; border-radius:2px; height:10px;">
                <div style="background:${gogyoColor[gogyo]}; width:${(count/maxVal)*100}%; height:100%; border-radius:2px;"></div>
            </div>
            <div style="color:#aaa; font-size:0.7rem; width:14px;">${count}</div>
        </div>`).join('');

    const daiyun = getDaiyun(year, month, day, gender || '男性');
    const currentAge = new Date().getFullYear() - year;
    const daiyunHtml = daiyun.daiyunList.slice(0, 8).map(d => {
        const isCurrent = d.age <= currentAge && currentAge < d.age + 10;
        return `
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;
            ${isCurrent ? 'background:#1a1a3a; border-radius:4px; padding:2px 4px;' : 'padding:2px 4px;'}">
            <div style="color:${isCurrent ? '#f0b56e' : '#666'}; font-size:0.7rem; width:72px;">
                ${d.ageRange}
            </div>
            <div style="color:${isCurrent ? '#fff' : '#aaa'}; font-size:0.8rem; font-weight:${isCurrent ? 'bold' : 'normal'};">
                ${d.pillar}
            </div>
            ${isCurrent ? '<div style="color:#f0b56e; font-size:0.65rem;">◀ 現在</div>' : ''}
        </div>`;
    }).join('');

    const dayPillarStem   = data.dayPillar?.stem || '';
    const dayPillarBranch = data.dayPillar?.branch || '';
    const monthBranch     = data.monthPillar?.branch || '';
    const kakukyoku = getKakukyoku(dayPillarStem, monthBranch);
    const kuubou    = getKuubou(dayPillarStem, dayPillarBranch);

    return `
        <div style="border:1px solid #6a3a8a; border-radius:6px; padding:8px; background:#0a0a1a;">
            <div style="color:#9b59b6; font-size:0.75rem; margin-bottom:6px; text-align:center;">
                📊 ${year}年${month}月${day}日・${gender || ''}の命式
            </div>
            <div style="display:flex; gap:8px; margin-bottom:8px;">
                <div style="flex:1; background:#1a1a2a; border:1px solid #6a3a8a;
                    border-radius:4px; padding:6px; text-align:center;">
                    <div style="color:#888; font-size:0.65rem;">格局</div>
                    <div style="color:#9b59b6; font-size:0.9rem; font-weight:bold; cursor:pointer;"
                         onclick="window.showGlossaryPopup('${kakukyoku}')">${kakukyoku}</div>
                </div>
                <div style="flex:1; background:#1a2a1a; border:1px solid #3a6a4a;
                    border-radius:4px; padding:6px; text-align:center;">
                    <div style="color:#888; font-size:0.65rem; cursor:pointer;"
                         onclick="window.showGlossaryPopup('空亡とは')">空亡（天中殺）</div>
                    <div style="color:#7fd97f; font-size:0.9rem; font-weight:bold; cursor:pointer;"
                         onclick="window.showGlossaryPopup('${kuubou.replace('・', '')}空亡')">${kuubou}</div>
                </div>
            </div>
            <div style="display:flex; border:1px solid #333; border-radius:4px; overflow:hidden; margin-bottom:8px;">
                ${pillarHtml('日柱', data.dayPillar)}
                ${pillarHtml('月柱', data.monthPillar)}
                ${pillarHtml('年柱', data.yearPillar)}
            </div>
            <div style="font-size:0.7rem; color:#aaa; margin-bottom:4px;">五行バランス</div>
            ${balanceHtml}
            <div style="border:1px solid #333; border-radius:4px; padding:8px; margin-top:8px;">
                <div style="color:#aaa; font-size:0.7rem; margin-bottom:6px;">
                    大運（${daiyun.startAge}歳起運・${daiyun.isForward ? '順行' : '逆行'}）
                </div>
                ${daiyunHtml}
            </div>
            <button onclick="window.showMeishikiGuide()"
                    style="width:100%; margin-top:8px; background:none; border:1px solid #3a3a4a;
                           color:#666; font-size:0.72rem; height:28px; border-radius:4px; cursor:pointer;">
                📖 命式表の読み方
            </button>
        </div>
        `;
}

window.showCharacterModal = (key, type) => {
    const stemImg = {
        甲:'stem_kinoe.png', 乙:'stem_kinoto.png',
        丙:'stem_hinoe.png', 丁:'stem_hinoto.png',
        戊:'stem_tsuchinoe.png', 己:'stem_tsuchinoto.png',
        庚:'stem_kanoe.png', 辛:'stem_kanoto.png',
        壬:'stem_mizunoe.png', 癸:'stem_mizunoto.png'
    };
    const branchImg = {
        子:'branch_ne.png', 丑:'branch_ushi.png',
        寅:'branch_tora.png', 卯:'branch_u.png',
        辰:'branch_tatsu.png', 巳:'branch_mi.png',
        午:'branch_uma.png', 未:'branch_hitsuji.png',
        申:'branch_saru.png', 酉:'branch_tori.png',
        戌:'branch_inu.png', 亥:'branch_i.png'
    };
    const stemInfo = {
        甲:{read:'きのえ',catch:'頼れる大樹',gogyo:'木・陽',desc:'強い意志と責任感を持つリーダー。困難にも折れず、まっすぐ上を目指す。'},
        乙:{read:'きのと',catch:'可憐な草花',gogyo:'木・陰',desc:'しなやかで適応力が高い。人の心を読む繊細さと、したたかな生命力を持つ。'},
        丙:{read:'ひのえ',catch:'情熱の太陽',gogyo:'火・陽',desc:'明るく豪快で人を惹きつける。太陽のように周囲を照らし、場を温める存在。'},
        丁:{read:'ひのと',catch:'知性の灯火',gogyo:'火・陰',desc:'繊細で知的、深く考える思索家。小さくとも確かな光で人の心を照らす。'},
        戊:{read:'つちのえ',catch:'不動の大山',gogyo:'土・陽',desc:'安定感と包容力を持つ守護者。どっしりと構え、周囲に安心感を与える。'},
        己:{read:'つちのと',catch:'育みの田畑',gogyo:'土・陰',desc:'面倒見が良く、人を育てる才能がある。縁の下の力持ちとして人を支える。'},
        庚:{read:'かのえ',catch:'剛健な刀',gogyo:'金・陽',desc:'意志が強く正義感旺盛。鋭い判断力と行動力で、困難を断ち切る力を持つ。'},
        辛:{read:'かのと',catch:'煌めく宝石',gogyo:'金・陰',desc:'美意識が高く繊細。磨かれることで輝く、こだわりと完璧主義の持ち主。'},
        壬:{read:'みずのえ',catch:'大海の波',gogyo:'水・陽',desc:'スケールが大きく包容力がある。自由を愛し、大きな流れの中で力を発揮する。'},
        癸:{read:'みずのと',catch:'癒しの雫',gogyo:'水・陰',desc:'感受性豊かで直感が鋭い。静かに深く物事を見通す、癒しと知恵の持ち主。'}
    };
    const branchInfo = {
        子:{read:'ねずみ',catch:'新たな始まり',gogyo:'水・陽',desc:'知恵と生命力にあふれる。小さくとも鋭い感覚で好機をつかむ、繁栄の象徴。'},
        丑:{read:'うし',catch:'誠実な努力',gogyo:'土・陰',desc:'粘り強く着実に歩む努力家。遅くとも確実に結果を出す、信頼の象徴。'},
        寅:{read:'とら',catch:'勇猛な飛躍',gogyo:'木・陽',desc:'勇気と行動力にあふれる。果敢に挑戦し、困難を力で切り開くリーダー。'},
        卯:{read:'うさぎ',catch:'温和な発展',gogyo:'木・陰',desc:'穏やかで人当たりが良く愛される。しなやかな知恵で着実に前進する。'},
        辰:{read:'たつ',catch:'偉大な力',gogyo:'土・陽',desc:'スケールが大きく夢を持つ。強大なエネルギーで大きな目標を実現する。'},
        巳:{read:'へび',catch:'神秘の直感',gogyo:'火・陰',desc:'深く静かな知性と直感を持つ。物事の本質を見抜く、神秘的な存在。'},
        午:{read:'うま',catch:'天を駆ける',gogyo:'火・陽',desc:'情熱的で自由を愛する。颯爽と駆け抜ける行動力と華やかさを持つ。'},
        未:{read:'ひつじ',catch:'温かな絆',gogyo:'土・陰',desc:'穏やかで思いやり深く、人との絆を大切にする。芸術的センスも光る。'},
        申:{read:'さる',catch:'機知の閃き',gogyo:'金・陽',desc:'機転が利き器用で賢い。状況を素早く読み、柔軟に対応する才能を持つ。'},
        酉:{read:'とり',catch:'夜明けの先触れ',gogyo:'金・陰',desc:'美意識が高く完璧主義。細部まで丁寧に仕上げる、こだわりの持ち主。'},
        戌:{read:'いぬ',catch:'忠誠の証',gogyo:'土・陽',desc:'誠実で義理堅く、信頼される。仲間を守る強い正義感と忠誠心を持つ。'},
        亥:{read:'いのしし',catch:'純粋な突進',gogyo:'水・陰',desc:'純粋で一途、信じた道を突き進む。直感力が強く、意外な粘り強さを持つ。'}
    };

    const info    = type === 'stem' ? stemInfo[key]  : branchInfo[key];
    const imgFile = type === 'stem' ? stemImg[key]  : branchImg[key];
    if (!info || !imgFile) return;

    // 既存モーダルを削除してbody直下に再生成（スタッキングコンテキスト問題を回避）
    const existing = document.getElementById('char-modal');
    if (existing) existing.remove();

    const base = location.href.replace(/[^\/]*$/, '');
    const src = base + 'img/' + imgFile;

    const modal = document.createElement('div');
    modal.id = 'char-modal';
    modal.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'width:100%', 'height:100%',
        'background:rgba(0,0,0,0.85)', 'z-index:99999',
        'overflow-y:scroll', '-webkit-overflow-scrolling:touch'
    ].join(';');

    const inner = document.createElement('div');
    inner.style.cssText = 'background:#111;border-radius:12px;border:2px solid #9b59b6;max-width:85%;width:85%;margin:40px auto 40px auto;padding:20px;text-align:center;display:flex;flex-direction:column;align-items:center;';
    inner.innerHTML = `
        <img src="${src}" style="width:200px; height:200px; object-fit:contain; margin-bottom:12px;">
        <div style="color:#f0b56e; font-size:1.1rem; font-weight:bold; margin-bottom:4px;">${key}（${info.read}）</div>
        <div style="color:#9b59b6; font-size:0.85rem; margin-bottom:8px;">${info.gogyo}　${info.catch}</div>
        <div style="color:#ddd; font-size:0.85rem; line-height:1.7; text-align:left; max-width:260px;">${info.desc}</div>`;
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'margin-top:14px;background:#34495e;color:#fff;border:none;padding:8px 24px;border-radius:4px;font-size:0.85rem;cursor:pointer;-webkit-tap-highlight-color:transparent;';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', () => { modal.remove(); document.body.style.overflow = ''; });
    inner.appendChild(closeBtn);
    modal.appendChild(inner);

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
    modal.addEventListener('click', (e) => { if (e.target === modal) { modal.remove(); document.body.style.overflow = ''; } });
};

window.buildMeishikiHtml = buildMeishikiHtml;
