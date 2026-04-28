// js/janken.js
/**
 * BARソフィー — janken.js v2
 * モニター画面・コンソールを使ったじゃんけん
 */

const V = './voices_mp3/';
const I = './img/';

const STORAGE_KEY = 'bar_sophie_techo';

// ─── LocalStorage ───────────────────────────────
function getData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data.janken)       data.janken = { myWins: 0, sophieWins: 0 };
    if (!data.gameLog)      data.gameLog = [];
    if (!data.lastGameDate) data.lastGameDate = '';
    if (typeof data.gameCount !== 'number') data.gameCount = 0;
    return data;
}

function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function getToday() {
    const d = new Date();
    return `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
}

function resetDailyIfNeeded(data) {
    const today = getToday();
    if (data.lastGameDate !== today) {
        data.janken    = { myWins: 0, sophieWins: 0 };
        data.gameCount = 0;
        data.lastGameDate = today;
        saveData(data);
    }
}

function isDoneToday() {
    return false; // ★テスト用・常にプレイ可能
}

//function isDoneToday() {       ////////////////////戻すの忘れないように。上の3行は消すfunction isDoneToday() {    return false; // ★テスト用・常にプレイ可能}
//    const data = getData();
//    resetDailyIfNeeded(data);
//    return getData().gameCount >= 1;
//}

function recordResult(myWins, sophieWins) {
    const data   = getData();
    const today  = getToday();
    const result = myWins > sophieWins ? '○' : '●';
    const score  = `${myWins} - ${sophieWins}`;
    const total  = (data.gameLog || []).reduce((acc, r) => {
        if (r.result === '○') acc.win++; else acc.lose++;
        return acc;
    }, { win: 0, lose: 0 });
    if (result === '○') total.win++; else total.lose++;
    data.gameLog = data.gameLog || [];
    data.gameLog.unshift({ date: today, result, score, total: `${total.win}勝 ${total.lose}敗` });
    if (data.gameLog.length > 30) data.gameLog = data.gameLog.slice(0, 30);
    data.gameCount    = 1;
    data.lastGameDate = today;
    data.janken       = { myWins: 0, sophieWins: 0 };
    saveData(data);
}

// ─── 音声 ────────────────────────────────────────
function playAudio(file, onended) {
    const a = new Audio(V + file);
    if (onended) a.onended = onended;
    a.play().catch(() => { if (onended) onended(); });
    return a;
}

// ─── UI ヘルパー ─────────────────────────────────
function setMonitor(filename) {
    const el = document.getElementById('monitor-img');
    if (el) el.src = filename.startsWith('./') ? filename : I + filename;
}

function setListContent(html) {
    const lv = document.getElementById('list-view');
    if (!lv) return;
    lv.style.display = 'block';
    lv.innerHTML = html;
}

function setConsole(html, bindings) {
    const grid = document.querySelector('.btn-grid');
    if (!grid) return;
    grid.innerHTML = html;
    if (bindings) bindings();
}

function exit() {
    // 元の画面に戻す
    setMonitor('./front_sophie.jpeg');
    const lv = document.getElementById('list-view');
    if (lv) lv.style.display = 'none';
    if (window._renderConsole) window._renderConsole('standard');
}

// ─── メイン起動 ──────────────────────────────────
export function startJanken() {
    if (isDoneToday()) {
        showDone();
        return;
    }
    showReady();
}

// ─── 本日終了済み ────────────────────────────────
function showDone() {
    const data = getData();
    const log  = data.gameLog || [];

    setMonitor('./front_sophie.jpeg');

    let logHtml = '';
    if (log.length > 0) {
        logHtml = `
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-top:10px;">
            <tr style="color:#f0b56e; border-bottom:1px solid #444;">
                <th style="padding:5px; text-align:left;">日付</th>
                <th style="padding:5px;">結果</th>
                <th style="padding:5px;">スコア</th>
                <th style="padding:5px;">通算</th>
            </tr>
            ${log.map(r => `
            <tr style="border-bottom:1px solid #333; color:#ccc;">
                <td style="padding:5px;">${r.date}</td>
                <td style="padding:5px; text-align:center; color:${r.result==='○'?'#7fd97f':'#ff6b6b'}">${r.result}</td>
                <td style="padding:5px; text-align:center;">${r.score}</td>
                <td style="padding:5px; text-align:center;">${r.total}</td>
            </tr>`).join('')}
        </table>`;
    }

    setListContent(`
        <div class="label" style="background:#333;">🎲 ソフィーとじゃんけん勝負</div>
        <div style="padding:15px; color:#f0b56e; text-align:center; font-size:1rem;">
            本日の勝負は終了しました<br>
            <span style="color:#aaa; font-size:0.85rem;">また明日お越しくださいませ</span>
        </div>
        ${logHtml}
    `);

    setConsole(
        `<button class="c-btn" id="j-close" style="background:#34495e; color:#fff; flex:1; border:none;">閉じる</button>`,
        () => { document.getElementById('j-close').onclick = exit; }
    );
}

// ─── 勝負前 ──────────────────────────────────────
function showReady() {
    setMonitor('./front_sophie.jpeg');

    setListContent(`
        <div class="label" style="background:#333;">🎲 ソフィーとじゃんけん勝負</div>
        <div style="padding:20px; color:#f0b56e; text-align:center; font-size:1rem; line-height:1.8;">
            本日のソフィーとのじゃんけん勝負<br>
            <span style="font-size:1.2rem; font-weight:bold;">3本先取制</span><br>
            <span style="color:#aaa; font-size:0.85rem;">準備はよろしいですか？</span>
        </div>
    `);

    setTimeout(() => playAudio('janken_start_voice.mp3'), 1200);

    const backStyle  = 'background:#34495e; color:#fff; flex:1; border:none; font-weight:bold;';
    const startStyle = 'background:#8e1a2e; color:#fff; flex:2; border:none; font-size:1rem; font-weight:bold;';

    setConsole(
        `<button class="c-btn" id="j-quit"  style="${backStyle}">やめる</button>
         <button class="c-btn" id="j-start" style="${startStyle}">勝負！</button>`,
        () => {
            document.getElementById('j-quit').onclick  = exit;
            document.getElementById('j-start').onclick = () => showBattle(0, 0); // ★音声再生を削除
        }
    );
}

// ─── 勝負中 ──────────────────────────────────────
function showBattle(myWins, sophieWins) {
    setMonitor('Janken_Ready.png');

setListContent(`
    <div class="label" style="background:#333;">🎲 ソフィーとじゃんけん勝負</div>
    <div style="padding:15px; text-align:center;">
        <div style="color:#aaa; font-size:0.85rem; margin-bottom:8px;">3本先取</div>
        <div style="font-size:1.3rem; color:#fff; margin-bottom:8px; display:flex; justify-content:center; align-items:center; gap:8px;">
            <span style="color:#aaa; font-size:0.85rem;">あなた</span>
            <span id="j-my-hand" style="font-size:1.5rem; min-width:1.8em;"> </span>
            <span style="color:#7fd97f;">${myWins}</span>
            <span style="color:#aaa;">ー</span>
            <span style="color:#ff6b6b;">${sophieWins}</span>
            <span id="j-sophie-hand" style="font-size:1.5rem; min-width:1.8em;"> </span>
            <span style="color:#aaa; font-size:0.85rem;">ソフィー</span>
        </div>
        <div id="j-msg" style="color:#f0b56e; font-size:0.95rem; height:2.5em; margin-top:10px; overflow:hidden; display:flex; align-items:center; justify-content:center;"></div>
        <div id="j-hands" style="display:flex; gap:15px; justify-content:center; margin-top:20px;">
            <button class="j-hand" data-hand="G" style="font-size:2.5rem; background:#1a3a1a; border:2px solid #555; border-radius:15px; padding:10px 18px; color:#fff; opacity:0.4;" disabled>✊</button>
            <button class="j-hand" data-hand="C" style="font-size:2.5rem; background:#1a3a1a; border:2px solid #555; border-radius:15px; padding:10px 18px; color:#fff; opacity:0.4;" disabled>✌️</button>
            <button class="j-hand" data-hand="P" style="font-size:2.5rem; background:#1a3a1a; border:2px solid #555; border-radius:15px; padding:10px 18px; color:#fff; opacity:0.4;" disabled>🖐️</button>
        </div>
    </div>
`);

    // コンソールはやめるボタンだけ
    setConsole(
        `<button class="c-btn" id="j-quit" style="background:#34495e; color:#888; flex:1; border:none; font-size:0.85rem;">やめる</button>`,
        () => { document.getElementById('j-quit').onclick = exit; }
    );

    // じゃんけん音声→ぽん→ボタン有効化
    playAudio('janken_voice.mp3', () => {
        let chosen = false;
        enableHands(true);
        setMsg('ぽん！');

        const ponAudio = playAudio('pon_voice.mp3');

        const timeout = setTimeout(() => {
            if (!chosen) {
                enableHands(false);
                setMsg('どうしました？');
                playAudio('why.mp3', () => showBattle(myWins, sophieWins));
            }
        }, 3000);

        document.querySelectorAll('.j-hand').forEach(btn => {
            btn.onclick = (e) => {
                if (chosen) return;
                chosen = true;
                clearTimeout(timeout);
                enableHands(false);
              //  ponAudio.pause();  ここがあると「ポン」が切られる。
                resolveRound(e.currentTarget.dataset.hand, myWins, sophieWins);
            };
        });
    });
}

// ─── ラウンド決着 ────────────────────────────────
function resolveRound(myHand, myWins, sophieWins) {
    const hands = ['G', 'C', 'P'];
    const sHand = hands[Math.floor(Math.random() * 3)];
    const imgs  = { G: 'Janken_G.png', C: 'Janken_C.png', P: 'Janken_P.png' };
    const emoji = { G: '✊', C: '✌️', P: '🖐️' };

    setMonitor(imgs[sHand]);

    let result;
    if (myHand === sHand) {
        result = 'draw';
    } else if (
        (myHand==='G' && sHand==='C') ||
        (myHand==='C' && sHand==='P') ||
        (myHand==='P' && sHand==='G')
    ) {
        result = 'my';
    } else {
        result = 'sophie';
    }

    let newMy = myWins, newSophie = sophieWins;
    let voiceFile, msg, resultImg;

    if (result === 'draw') {
        voiceFile = 'match_voice.mp3';
        msg       = '引き分けです。気が合いますね';
        resultImg = 'Janken_Natural.png';
    } else if (result === 'my') {
        newMy++;
        resultImg = 'Janken_Lose.png';
        if (newMy >= 3 || newSophie >= 3) {
            voiceFile = 'decide_voice.mp3';
            msg       = '本日の勝負がつきましたね';
        } else {
            voiceFile = 'lose_voice.mp3';
            msg       = 'おめでとうございます。お客様の勝ちでございます';
        }
    } else {
        newSophie++;
        resultImg = 'Janken_Win.png';
        if (newMy >= 3 || newSophie >= 3) {
            voiceFile = 'decide_voice.mp3';
            msg       = '本日の勝負がつきましたね';
        } else {
            voiceFile = 'win_voice.mp3';
            msg       = 'わたくしの勝ちでございます';
        }
    }

    const addMada = result !== 'draw' && newMy < 3 && newSophie < 3;

  setTimeout(() => {
        setMonitor(resultImg);
        // 手をスコア横に表示
        const myHandEl = document.getElementById('j-my-hand');
        const sophieHandEl = document.getElementById('j-sophie-hand');
        if (myHandEl) myHandEl.innerText = emoji[myHand];
        if (sophieHandEl) sophieHandEl.innerText = emoji[sHand];
        setMsg(msg);

        // コンソールを一時的に無効化
        setConsole(`<button class="c-btn" style="background:#333; color:#555; flex:1; border:none;" disabled>しばらくお待ちください</button>`, null);

        playAudio(voiceFile, () => {
            if (addMada) {
                playAudio('mada_voice.mp3', () => {
                    setTimeout(() => showBattle(newMy, newSophie), 800);
                });
            } else if (newMy >= 3 || newSophie >= 3) {
                setTimeout(() => showFinal(newMy, newSophie), 800);
            } else {
                setTimeout(() => showBattle(newMy, newSophie), 800);
            }
        });
    }, 1200);
}

// ─── 最終結果 ────────────────────────────────────
function showFinal(myWins, sophieWins) {
    recordResult(myWins, sophieWins);

    const isSophie3 = sophieWins === 3 && myWins === 0;
    const isMy3     = myWins === 3 && sophieWins === 0;

    let scoreFile;
    if      (sophieWins === 3 && myWins === 0) scoreFile = 'score_3_0.mp3';
    else if (sophieWins === 3 && myWins === 1) scoreFile = 'score_3_1.mp3';
    else if (sophieWins === 3 && myWins === 2) scoreFile = 'score_3_2.mp3';
    else if (myWins === 3 && sophieWins === 2) scoreFile = 'score_2_3.mp3';
    else if (myWins === 3 && sophieWins === 1) scoreFile = 'score_1_3.mp3';
    else if (myWins === 3 && sophieWins === 0) scoreFile = 'score_0_3.mp3';

    if      (isSophie3) showSophie3Win(scoreFile);
    else if (isMy3)     showMy3Win(scoreFile);
    else                showNormalEnd(myWins, sophieWins, scoreFile);
}

// ─── 通常決着 ────────────────────────────────────
function showNormalEnd(myWins, sophieWins, scoreFile) {
    const isMyWin = myWins > sophieWins;
    setMonitor(isMyWin ? 'Janken_LoseD.png' : 'Janken_WinD.png');

    setListContent(`
        <div class="label" style="background:#333;">🎲 本日の結果</div>
        <div style="padding:20px; text-align:center;">
            <div style="font-size:1.4rem; color:#fff; margin-bottom:10px;">
                あなた <span style="color:#7fd97f;">${myWins}</span> 
                ー 
                <span style="color:#ff6b6b;">${sophieWins}</span> ソフィー
            </div>
            <div style="color:#f0b56e; font-size:1rem;">
                ${isMyWin ? '🎉 お客様の勝ちでございます' : 'わたくしの勝ちでございます'}
            </div>
        </div>
    `);

    setConsole(
        `<button class="c-btn" id="j-close" style="background:#34495e; color:#fff; flex:1; border:none;" disabled>しばらくお待ちください</button>`,
        null
    );

    playAudio(scoreFile, () => {
        playAudio('closing_voice.mp3', () => {
            setConsole(
                `<button class="c-btn" id="j-close" style="background:#8e1a2e; color:#fff; flex:1; border:none;">閉じる</button>`,
                () => { document.getElementById('j-close').onclick = exit; }
            );
        });
    });
}

// ─── ソフィー3連勝：シャンパン演出 ──────────────
function showSophie3Win(scoreFile) {
    setMonitor('./front_sophie.jpeg');

    setListContent(`
        <div class="label" style="background:#333;">🎲 本日の結果</div>
        <div style="padding:20px; text-align:center;">
            <div style="font-size:1.3rem; color:#fff; margin-bottom:10px;">
                あなた <span style="color:#7fd97f;">0</span> 
                ー 
                <span style="color:#ff6b6b;">3</span> ソフィー
            </div>
            <div style="color:#f0b56e; font-size:1rem;">3連勝でわたくしの勝ちでございます！</div>
        </div>
    `);

    const champStyle  = 'background:#8e1a2e; color:#fff; flex:2; border:none; font-size:0.9rem;';
    const refuseStyle = 'background:#444; color:#fff; flex:1; border:none; font-size:0.85rem;';

    setConsole(
        `<button class="c-btn" id="j-champagne" style="${champStyle}" disabled>🍾 シャンパンを開ける</button>
         <button class="c-btn" id="j-refuse"    style="${refuseStyle}" disabled>遠慮します</button>`,
        null
    );

    playAudio(scoreFile, () => {
        // ボタン有効化
        setConsole(
            `<button class="c-btn" id="j-champagne" style="${champStyle}">🍾 シャンパンを開ける</button>
             <button class="c-btn" id="j-refuse"    style="${refuseStyle}">遠慮します</button>`,
            () => {
                document.getElementById('j-champagne').onclick = () => {
                    setMonitor('Janken_Win3.png');
                    setConsole(`<button class="c-btn" style="background:#333; color:#555; flex:1; border:none;" disabled>しばらくお待ちください</button>`, null);
                    playAudio('thanks_voice.mp3', () => {
                        playAudio('closing_voice.mp3', () => {
                            setConsole(
                                `<button class="c-btn" id="j-close" style="background:#8e1a2e; color:#fff; flex:1; border:none;">閉じる</button>`,
                                () => { document.getElementById('j-close').onclick = exit; }
                            );
                        });
                    });
                };
                document.getElementById('j-refuse').onclick = () => {
                    setConsole(`<button class="c-btn" style="background:#333; color:#555; flex:1; border:none;" disabled>しばらくお待ちください</button>`, null);
                    playAudio('booboo_voice.mp3', () => {
                        playAudio('closing_voice.mp3', () => {
                            setConsole(
                                `<button class="c-btn" id="j-close" style="background:#8e1a2e; color:#fff; flex:1; border:none;">閉じる</button>`,
                                () => { document.getElementById('j-close').onclick = exit; }
                            );
                        });
                    });
                };
            }
        );
    });
}

// ─── 客の3連勝：投げキッス演出 ──────────────────
function showMy3Win(scoreFile) {
    setMonitor('./front_sophie.jpeg'); // ★まず通常顔

    setListContent(`
        <div class="label" style="background:#333;">🎲 本日の結果</div>
        <div style="padding:20px; text-align:center; position:relative;">
            <div style="font-size:1.3rem; color:#fff; margin-bottom:10px;">
                あなた <span style="color:#7fd97f;">3</span> 
                ー 
                <span style="color:#ff6b6b;">0</span> ソフィー
            </div>
            <div style="color:#f0b56e; font-size:1rem;">3連勝！お見それいたしました🎉</div>
            <canvas id="j-hearts" style="position:absolute; inset:0; pointer-events:none; width:100%; height:100%;"></canvas>
        </div>
    `);

    setConsole(
        `<button class="c-btn" id="j-close" style="background:#34495e; color:#fff; flex:1; border:none;" disabled>しばらくお待ちください</button>`,
        null
    );

    playAudio(scoreFile, () => {
        // ★score_0_3.mp3が終わったらキッス画像に切り替えてkiss_se再生
        setMonitor('Janken_Lose3.png');
        playAudio('kiss_se.mp3');
        startHearts();
        playAudio('closing_voice.mp3', () => {
            stopHearts();
            setConsole(
                `<button class="c-btn" id="j-close" style="background:#8e1a2e; color:#fff; flex:1; border:none;">閉じる</button>`,
                () => { document.getElementById('j-close').onclick = exit; }
            );
        });
    });
}

// ─── ハート粒子演出 ──────────────────────────────
let heartAnimId = null;
function startHearts() {
    const canvas = document.getElementById('j-hearts');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 25 }, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        size: 10 + Math.random() * 18,
        speed: 1 + Math.random() * 2,
        opacity: 0.8 + Math.random() * 0.2,
        drift: (Math.random() - 0.5) * 1.5
    }));
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
            ctx.font = `${p.size}px serif`;
            ctx.globalAlpha = p.opacity;
            ctx.fillText('💗', p.x, p.y);
            p.y -= p.speed;
            p.x += p.drift;
            if (p.y < -30) { p.y = canvas.height + 20; p.x = Math.random() * canvas.width; }
        });
        ctx.globalAlpha = 1;
        heartAnimId = requestAnimationFrame(draw);
    }
    draw();
}
function stopHearts() {
    if (heartAnimId) { cancelAnimationFrame(heartAnimId); heartAnimId = null; }
}

// ─── ヘルパー ────────────────────────────────────
function setMsg(txt) {
    const el = document.getElementById('j-msg');
    if (el) el.innerText = txt;
}

function enableHands(enabled) {
    document.querySelectorAll('.j-hand').forEach(b => {
        b.disabled = !enabled;
        b.style.opacity = enabled ? '1' : '0.4';
        b.style.background = enabled ? '#1a5a1a' : '#1a3a1a';
    });
}