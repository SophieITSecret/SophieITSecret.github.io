/**
 * favorite.js — ソフィーのノート ＆ じゃんけんゲーム
 * ★ 新設ファイル：お気に入り保存とエンタメ機能を統括します。
 */

import { setListView, clean } from './utils.js';
import * as nav from './navigation.js';

const STORAGE_KEY = 'bar_sophie_techo';

// --- データ構造の初期化 ---
function getTechoData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { favorites: [], gameLog: [], lastGameDate: '', gameCount: 0 };
    return JSON.parse(data);
}

function saveTechoData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// --- お気に入りの切り替え ---
export function toggleFavorite(id) {
    const data = getTechoData();
    const index = data.favorites.indexOf(id);
    if (index === -1) {
        data.favorites.push(id);
    } else {
        data.favorites.splice(index, 1);
    }
    saveTechoData(data);
    return index === -1;
}

export function isFavorite(id) {
    return getTechoData().favorites.includes(id);
}

// --- じゃんけん回数制限ロジック ---
export function getGameStatus() {
    const data = getTechoData();
    const d = new Date();
    // 日付の判定（午前0時リセット）
    const today = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    
    if (data.lastGameDate !== today) {
        data.gameCount = 0;
        data.lastGameDate = today;
        saveTechoData(data);
    }
    return { count: data.gameCount, limit: 3 };
}

export function incrementGameCount() {
    const data = getTechoData();
    data.gameCount++;
    saveTechoData(data);
}

function addGameLog(text) {
    const data = getTechoData();
    const d = new Date();
    const timeStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    data.gameLog.unshift(`[${timeStr}] ${text}`);
    if (data.gameLog.length > 30) data.gameLog.pop(); // 最新30件まで保存
    saveTechoData(data);
}

// --- 手帳（ノート）画面の描画 ---
export function openTecho() {
    nav.updateNav("techo");
    const data = getTechoData();
    
    let h = `<div class="label" style="background:#333;">📖 ソフィーのノート</div>`;
    
    if (data.favorites.length === 0 && data.gameLog.length === 0) {
        h += `<div style="padding:40px 20px; color:#888; text-align:center; line-height:1.6;">
                まだ白紙のページですね...<br><br>
                お酒や音楽の画面で「🤍」を押して<br>
                あなただけの記録を。</div>`;
    } else {
        const categories = {
            'L': { title: '🍷 キープしたお酒', list: [] },
            'S': { title: '🎵 お気に入りの曲', list: [] },
            'N': { title: '📝 備忘録ノート', list: [] }
        };

        data.favorites.forEach(id => {
            const type = id.charAt(0);
            if (categories[type]) categories[type].list.push(id);
            else categories['L'].list.push(id); // 不明なものは一旦お酒へ
        });

        for (const key in categories) {
            const cat = categories[key];
            if (cat.list.length > 0) {
                h += `<div class="scr-title" style="margin-top:15px; color:var(--blue); padding-left:10px;">${cat.title}</div>`;
                cat.list.forEach(id => {
                    h += `<div class="item fav-item" style="color:#eee; border-bottom:1px solid #222;">🔖 ${id}</div>`;
                });
            }
        }

        if (data.gameLog.length > 0) {
            h += `<div class="scr-title" style="margin-top:25px; color:var(--accent); padding-left:10px;">🎲 ソフィーとの思い出（履歴）</div>`;
            data.gameLog.slice(0, 10).forEach(log => {
                h += `<div style="font-size:0.75rem; color:#888; padding:6px 15px; border-bottom:1px dashed #222;">${log}</div>`;
            });
        }
    }

    setListView(h, false);
}

// --- 🎮 ソフィーとのじゃんけん勝負（Sボタンから呼び出し） ---
export function playJanken() {
    const status = getGameStatus();
    
    if (status.count >= status.limit) {
        // 4回目以降のソフィーのあしらい
        import('./media.js').then(media => media.speak("あら、そんなに私と遊びたいの？ でも、しつこい男性は嫌われるわよ。続きはまた明日、ね？"));
        alert("ソフィー「あら、そんなに私と遊びたいの？ でも、しつこい男性は嫌われるわよ。続きはまた明日、ね？」\n\n（※本日の勝負は終了しました）");
        return;
    }

    // ゲーム画面のオーバーレイ表示
    const h = `
        <div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif;">
            <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:20px; text-align:center;">ソフィーと勝負する？<br><span style="font-size:0.8rem; color:#aaa;">（本日あと ${status.limit - status.count} 回）</span></div>
            <div style="display:flex; gap:15px; margin-bottom:30px;">
                <button class="j-btn" data-hand="✊" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✊</button>
                <button class="j-btn" data-hand="✌️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✌️</button>
                <button class="j-btn" data-hand="🖐️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">🖐️</button>
            </div>
            <button id="j-cancel" style="padding:10px 25px; border-radius:20px; background:#333; color:#fff; border:1px solid #555; font-size:1rem;">やめる</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', h);

    document.getElementById('j-cancel').onclick = () => document.getElementById('janken-overlay').remove();

    document.querySelectorAll('.j-btn').forEach(btn => {
        btn.onclick = (e) => {
            const myHand = e.currentTarget.dataset.hand;
            const hands = ["✊", "✌️", "🖐️"];
            const sHand = hands[Math.floor(Math.random() * hands.length)];

            let resultStr = "";
            let msg = "";

            if (myHand === sHand) {
                resultStr = "引き分け";
                msg = "あーら、気が合うわね。引き分けよ。";
            } else if (
                (myHand === "✊" && sHand === "✌️") ||
                (myHand === "✌️" && sHand === "🖐️") ||
                (myHand === "🖐️" && sHand === "✊")
            ) {
                resultStr = "勝ち";
                msg = "うふふ、私の負けね。約束通り……チュッ💋";
            } else {
                resultStr = "負け";
                msg = "あら、私の勝ち！それじゃあ一番高いシャンパン、開けてもらおうかしら？";
            }

            incrementGameCount();
            addGameLog(`じゃんけん (${resultStr}) ｜ あなた:${myHand} ソフィー:${sHand}`);

            // 結果発表画面
            document.getElementById('janken-overlay').innerHTML = `
                <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:10px; text-align:center; padding:0 20px; line-height:1.5;">${msg}</div>
                <div style="font-size:5rem; margin-bottom:30px; animation: pop 0.5s ease-out;">${sHand}</div>
                <button id="j-close" style="padding:12px 35px; border-radius:25px; background:var(--blue); color:#000; border:none; font-weight:bold; font-size:1.1rem; box-shadow:0 0 10px var(--blue);">戻る</button>
                <style>@keyframes pop { 0% {transform:scale(0.5); opacity:0;} 100% {transform:scale(1); opacity:1;} }</style>
            `;
            import('./media.js').then(media => media.speak(clean(msg)));

            document.getElementById('j-close').onclick = () => document.getElementById('janken-overlay').remove();
        };
    });
}