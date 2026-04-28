// js/janken.js
/**
 * BARソフィー — janken.js
 * 日刊じゃんけん勝負（3本先取制）
 */

import * as nav from './navigation.js';

const STORAGE_KEY = 'bar_sophie_techo';
const V = './voices_mp3/';
const I = './img/';

// ─── LocalStorage ───────────────────────────────
function getData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    if (!data.janken) data.janken = { myWins: 0, sophieWins: 0 };
    if (!data.gameLog) data.gameLog = [];
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
        data.janken = { myWins: 0, sophieWins: 0 };
        data.gameCount = 0;
        data.lastGameDate = today;
        saveData(data);
    }
}

function isDoneToday() {
    const data = getData();
    resetDailyIfNeeded(data);
    return getData().gameCount >= 1;
}

function recordResult(myWins, sophieWins) {
    const data = getData();
    const today = getToday();
    const result = myWins > sophieWins ? '○' : '●';
    const score = `${myWins} - ${sophieWins}`;
    // 通算成績
    const total = (data.gameLog || []).reduce((acc, r) => {
        if (r.result === '○') acc.win++; else acc.lose++;
        return acc;
    }, { win: 0, lose: 0 });
    if (result === '○') total.win++; else total.lose++;
    data.gameLog = data.gameLog || [];
    data.gameLog.unshift({ date: today, result, score, total: `${total.win}勝 ${total.lose}敗` });
    if (data.gameLog.length > 30) data.gameLog = data.gameLog.slice(0, 30);
    data.gameCount = 1;
    data.lastGameDate = today;
    data.janken = { myWins: 0, sophieWins: 0 };
    saveData(data);
}

// ─── 音声 ────────────────────────────────────────
function playAudio(file, onended) {
    const a = new Audio(V + file);
    if (onended) a.onended = onended;
    a.play().catch(() => { if (onended) onended(); });
    return a;
}

// ─── メイン起動 ──────────────────────────────────
export function startJanken() {
    if (isDoneToday()) {
        showDone();
        return;
    }
    showReady();
}

// ─── 画面：本日終了済み ──────────────────────────
function showDone() {
    const data = getData();
    const log = data.gameLog || [];
    let logHtml = '';
    if (log.length > 0) {
        logHtml = `<table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-top:15px;">
            <tr style="color:#f0b56e; border-bottom:1px solid #444;">
                <th style="padding:5px; text-align:left;">日付</th>
                <th style="padding:5px;">結果</th>
                <th style="padding:5px;">スコア</th>
                <th style="padding:5px;">通算</th>
            </tr>
            ${log.map(r => `<tr style="border-bottom:1px solid #333; color:#ccc;">
                <td style="padding:5px;">${r.date}</td>
                <td style="padding:5px; text-align:center; color:${r.result==='○'?'#7fd97f':'#ff6b6b'}">${r.result}</td>
                <td style="padding:5px; text-align:center;">${r.score}</td>
                <td style="padding:5px; text-align:center;">${r.total}</td>
            </tr>`).join('')}
        </table>`;
    }

    mount(`
        <div style="text-align:center; padding:20px 15px;">
            <img src="${I}front_sophie.jpg" style="width:180px; border-radius:10px; margin-bottom:15px;">
            <div style="color:#f0b56e; font-size:1.1rem; margin-bottom:8px;">本日の勝負は終了しました</div>
            <div style="color:#aaa; font-size:0.85rem; margin-bottom:20px;">また明日お越しくださいませ</div>
            ${logHtml}
            <button id="j-close" style="margin-top:20px; padding:10px 40px; border-radius:25px; background:#444; border:none; color:#fff;">閉じる</button>
        </div>
    `);
    document.getElementById('j-close').onclick = unmount;
}

// ─── 画面：勝負前 ────────────────────────────────
function showReady() {
    mount(`
        <div style="text-align:center; padding:20px 15px;">
            <img id="j-img" src="${I}front_sophie.jpg" style="width:180px; border-radius:10px; margin-bottom:15px;">
            <div id="j-msg" style="color:#f0b56e; font-size:1rem; min-height:2em; margin-bottom:20px;"></div>
            <div style="display:flex; gap:15px; justify-content:center;">
                <button id="j-start" style="padding:12px 35px; border-radius:25px; background:#8e1a2e; border:none; color:#fff; font-size:1rem; font-weight:bold;">勝負！</button>
                <button id="j-quit"  style="padding:12px 35px; border-radius:25px; background:#444; border:none; color:#fff; font-size:1rem;">やめる</button>
            </div>
        </div>
    `);

    playAudio('janken_start_voice.mp3');
    setMsg('本日のソフィーとのじゃんけん勝負、準備はよろしいですか？');

    document.getElementById('j-start').onclick = () => showBattle(0, 0);
    document.getElementById('j-quit').onclick  = unmount;
}

// ─── 画面：勝負中 ────────────────────────────────
function showBattle(myWins, sophieWins) {
    mount(`
        <div style="text-align:center; padding:15px;">
            <div style="color:#f0b56e; font-size:1rem; margin-bottom:8px;">3本先取勝負</div>
            <div id="j-score" style="font-size:1.3rem; color:#fff; margin-bottom:12px;">
                あなた <span style="color:#7fd97f;">${myWins}</span> 
                ー 
                <span style="color:#ff6b6b;">${sophieWins}</span> ソフィー
            </div>
            <img id="j-img" src="${I}Janken_Ready.png" style="width:180px; border-radius:10px; margin-bottom:12px;">
            <div id="j-msg" style="color:#f0b56e; font-size:0.95rem; min-height:2.5em; margin-bottom:15px;"></div>
            <div id="j-hands" style="display:flex; gap:20px; justify-content:center; margin-bottom:15px;">
                <button class="j-hand" data-hand="G" style="font-size:3rem; background:none; border:2px solid #555; border-radius:15px; padding:8px 15px; color:#fff;">✊</button>
                <button class="j-hand" data-hand="C" style="font-size:3rem; background:none; border:2px solid #555; border-radius:15px; padding:8px 15px; color:#fff;">✌️</button>
                <button class="j-hand" data-hand="P" style="font-size:3rem; background:none; border:2px solid #555; border-radius:15px; padding:8px 15px; color:#fff;">🖐️</button>
            </div>
            <button id="j-quit" style="padding:8px 30px; border-radius:25px; background:#333; border:none; color:#888; font-size:0.85rem;">やめる</button>
        </div>
    `);

    document.getElementById('j-quit').onclick = unmount;
    disableHands(true);

    // じゃんけん音声を流してからボタンを有効化
    playAudio('janken_voice.mp3', () => {
        disableHands(false);
        setMsg('ぽん！');
        // ぽん音声と同時にタイムアウト監視（3秒以内に押さなければ「どうしました？」）
        const ponAudio = playAudio('pon_voice.mp3');
        let chosen = false;

        const timeout = setTimeout(() => {
            if (!chosen) {
                disableHands(true);
                playAudio('why.mp3', () => showBattle(myWins, sophieWins));
                setMsg('どうしました？');
            }
        }, 3000);

        document.querySelectorAll('.j-hand').forEach(btn => {
            btn.onclick = (e) => {
                if (chosen) return;
                chosen = true;
                clearTimeout(timeout);
                disableHands(true);
                ponAudio.pause();
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

    // 画像をソフィーの手に切り替え
    setImg(imgs[sHand]);

    // 勝敗判定
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
        voiceFile  = 'match_voice.mp3';
        msg        = '引き分けです。気が合いますね';
        resultImg  = 'Janken_Natural.png';
    } else if (result === 'my') {
        newMy++;
        resultImg  = 'Janken_Lose.png';
        if (newMy >= 3 || newSophie >= 3) {
            voiceFile = 'decide_voice.mp3';
            msg = '本日の勝負がつきましたね';
        } else {
            voiceFile = 'lose_voice.mp3';
            msg = 'おめでとうございます。お客様の勝ちでございます';
        }
    } else {
        newSophie++;
        resultImg  = 'Janken_Win.png';
        if (newMy >= 3 || newSophie >= 3) {
            voiceFile = 'decide_voice.mp3';
            msg = '本日の勝負がつきましたね';
        } else {
            voiceFile = 'win_voice.mp3';
            msg = 'わたくしの勝ちでございます';
        }
    }

    // あいこ以外は「まだまだですね」を追加
    const addMada = result !== 'draw' && newMy < 3 && newSophie < 3;

    setTimeout(() => {
        setImg(resultImg);
        setMsg(`あなた ${emoji[myHand]} vs ソフィー ${emoji[sHand]}　${msg}`);
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
    }, 300);
}

// ─── 最終結果 ────────────────────────────────────
function showFinal(myWins, sophieWins) {
    recordResult(myWins, sophieWins);

    const isMyWin     = myWins > sophieWins;
    const isStraight  = myWins === 3 && sophieWins === 0;  // 客の3連勝
    const isSophie3   = sophieWins === 3 && myWins === 0;  // ソフィーの3連勝

    // スコア別音声
    let scoreFile;
    if      (sophieWins === 3 && myWins === 0) scoreFile = 'score_3_0.mp3';
    else if (sophieWins === 2 && myWins === 1) scoreFile = 'score_2_1.mp3';
    else if (myWins === 2 && sophieWins === 1) scoreFile = 'score_1_2.mp3';
    else if (myWins === 3 && sophieWins === 0) scoreFile = 'score_0_3.mp3';

    if (isSophie3) {
        // ★ ソフィー3連勝：シャンパン演出
        showSophie3Win(scoreFile);
    } else if (isStraight) {
        // ★ 客の3連勝：投げキッス演出
        showMyStraigtWin(scoreFile);
    } else {
        // 通常決着
        showNormalEnd(myWins, sophieWins, scoreFile, isMyWin);
    }
}

// ─── 通常決着 ────────────────────────────────────
function showNormalEnd(myWins, sophieWins, scoreFile, isMyWin) {
    const img = isMyWin ? 'Janken_LoseD.png' : 'Janken_WinD.png';
    mount(`
        <div style="text-align:center; padding:20px 15px;">
            <img id="j-img" src="${I}${img}" style="width:180px; border-radius:10px; margin-bottom:15px;">
            <div id="j-msg" style="color:#f0b56e; font-size:1rem; min-height:2em; margin-bottom:20px;"></div>
            <button id="j-close" style="padding:12px 40px; border-radius:25px; background:#444; border:none; color:#fff;">閉じる</button>
        </div>
    `);
    playAudio(scoreFile, () => {
        playAudio('closing_voice.mp3', () => {
            document.getElementById('j-close').style.background = '#8e1a2e';
        });
    });
    setMsg(`本日の結果：あなた ${myWins} ー ${sophieWins} ソフィー`);
    document.getElementById('j-close').onclick = unmount;
}

// ─── ソフィー3連勝：シャンパン演出 ──────────────
function showSophie3Win(scoreFile) {
    mount(`
        <div style="text-align:center; padding:20px 15px;">
            <img id="j-img" src="${I}front_sophie.jpg" style="width:180px; border-radius:10px; margin-bottom:15px;">
            <div id="j-msg" style="color:#f0b56e; font-size:1rem; min-height:2em; margin-bottom:20px;"></div>
            <div id="j-btns" style="display:flex; gap:15px; justify-content:center;">
                <button id="j-champagne" style="padding:12px 25px; border-radius:25px; background:#8e1a2e; border:none; color:#fff; font-size:0.95rem;">🍾 シャンパンを開ける</button>
                <button id="j-refuse"   style="padding:12px 25px; border-radius:25px; background:#444; border:none; color:#fff; font-size:0.95rem;">遠慮します</button>
            </div>
        </div>
    `);
    setMsg('3連勝でわたくしの勝ちでございます！');
    playAudio(scoreFile);

    document.getElementById('j-champagne').onclick = () => {
        setImg('Janken_Win3.png');
        playAudio('thanks_voice.mp3', () => {
            playAudio('closing_voice.mp3', () => setTimeout(unmount, 1500));
        });
        setMsg('ありがとうございます！皆様で乾杯いたしましょう🥂');
        document.getElementById('j-btns').style.display = 'none';
    };
    document.getElementById('j-refuse').onclick = () => {
        playAudio('booboo_voice.mp3', () => {
            playAudio('closing_voice.mp3', () => setTimeout(unmount, 1500));
        });
        setMsg('えーっ、駄目ですか。ふふふ…');
        document.getElementById('j-btns').style.display = 'none';
    };
}

// ─── 客の3連勝：投げキッス演出 ──────────────────
function showMyStraigtWin(scoreFile) {
    mount(`
        <div style="text-align:center; padding:20px 15px;">
            <img id="j-img" src="${I}Janken_Lose3.png" style="width:180px; border-radius:10px; margin-bottom:15px;">
            <div id="j-msg" style="color:#f0b56e; font-size:1rem; min-height:2em; margin-bottom:20px;"></div>
            <canvas id="j-hearts" style="position:absolute; inset:0; pointer-events:none; width:100%; height:100%;"></canvas>
            <button id="j-close" style="padding:12px 40px; border-radius:25px; background:#444; border:none; color:#fff; margin-top:10px;">閉じる</button>
        </div>
    `);
    setMsg('3連勝でお客様の勝ちでございます！お見それいたしました🎉');
    playAudio('score_0_3.mp3', () => {
        playAudio('kiss_se.mp3');
        startHearts();
        playAudio('closing_voice.mp3', () => {
            document.getElementById('j-close').style.background = '#8e1a2e';
        });
    });
    document.getElementById('j-close').onclick = () => { stopHearts(); unmount(); };
}

// ─── ハート粒子演出 ──────────────────────────────
let heartAnimId = null;
function startHearts() {
    const canvas = document.getElementById('j-hearts');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    const particles = Array.from({ length: 30 }, () => ({
        x: Math.random() * canvas.width,
        y: canvas.height + 20,
        size: 10 + Math.random() * 20,
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

// ─── UI ヘルパー ─────────────────────────────────
let overlay = null;

function mount(html) {
    unmount();
    overlay = document.createElement('div');
    overlay.id = 'janken-overlay';
    overlay.style.cssText = `
        position:fixed; inset:0; background:rgba(0,0,0,0.92);
        z-index:10000; display:flex; flex-direction:column;
        align-items:center; justify-content:center;
        color:#fff; overflow-y:auto; font-family:sans-serif;
    `;
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
}

function unmount() {
    stopHearts();
    const el = document.getElementById('janken-overlay');
    if (el) el.remove();
    overlay = null;
}

function setImg(src) {
    const el = document.getElementById('j-img');
    if (el) el.src = I + src;
}

function setMsg(txt) {
    const el = document.getElementById('j-msg');
    if (el) el.innerText = txt;
}

function disableHands(disabled) {
    document.querySelectorAll('.j-hand').forEach(b => {
        b.disabled = disabled;
        b.style.opacity = disabled ? '0.4' : '1';
    });
}