/**
 * favorite.js — ソフィーのノート ＆ じゃんけんゲーム ＆ お知らせ
 * ★ 全機能統合・DJ配線・デザインルール厳守完全版
 */

import { setListView, clean } from './utils.js';
import * as nav from './navigation.js';

const STORAGE_KEY = 'bar_sophie_techo';
let currentFolder = null; 

export function getCurrentFolder() { return currentFolder; }

function getTechoData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { favorites: [], gameLog: [], lastGameDate: '', gameCount: 0, janken: { myWins: 0, sophieWins: 0 } };
    const parsed = JSON.parse(data);
    if (!parsed.janken) parsed.janken = { myWins: 0, sophieWins: 0 };
    return parsed;
}

function saveTechoData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

export function toggleFavorite(id) {
    const data = getTechoData();
    const index = data.favorites.indexOf(id);
    if (index === -1) data.favorites.push(id); else data.favorites.splice(index, 1);
    saveTechoData(data); return index === -1;
}

export function isFavorite(id) { return getTechoData().favorites.includes(id); }

// --- じゃんけん戦績ロジック ---
export function getGameStatus() {
    const data = getTechoData();
    const d = new Date();
    const today = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    if (data.lastGameDate !== today) {
        data.gameCount = 0;
        data.janken = { myWins: 0, sophieWins: 0 };
        data.lastGameDate = today;
        saveTechoData(data);
    }
    return { count: data.gameCount, limit: 1, myWins: data.janken.myWins, sophieWins: data.janken.sophieWins };
}

export function updateGameScore(winner) {
    const data = getTechoData();
    if (winner === "my") data.janken.myWins++;
    else if (winner === "sophie") data.janken.sophieWins++;
    if (data.janken.myWins >= 3 || data.janken.sophieWins >= 3) data.gameCount++;
    saveTechoData(data);
    return data.janken;
}

function addGameLog(text) {
    const data = getTechoData();
    const d = new Date();
    const timeStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    data.gameLog.unshift(`[${timeStr}] ${text}`);
    if (data.gameLog.length > 30) data.gameLog.pop();
    saveTechoData(data);
}

// --- お知らせ表示 ---
export async function openNotice() {
    nav.updateNav("notice");
    let content = "";
    try {
        const res = await fetch('お知らせ.txt');
        if (res.ok) {
            const text = await res.text();
            content = `<div style="white-space: pre-wrap; margin-top:10px;">${clean(text)}</div>`;
        }
    } catch (e) {}
    if (!content) {
        content = `<h3 style="color:var(--accent);">🍸 BARソフィーへようこそ</h3><p>お酒と音楽の記録をお楽しみください。</p>`;
    }
    
    let h = `<div class="label" style="background:#1a5276;">📢 お知らせ・使い方</div>
    <div style="padding:20px; color:#ddd; line-height:1.7; font-size:0.95rem;">${content}</div>`;
    setListView(h, false);
}

// --- ノート（手帳）フォルダ・アイテム表示 ---
export async function openTecho(folder = null) {
    nav.updateNav("techo");
    currentFolder = folder;
    const data = getTechoData();
    const lq = await import('./liquor.js').catch(() => null);
    
    let h = `<div class="label" style="background:#333;">📖 ソフィーのノート</div>`;

    // 1階層目：フォルダ一覧
    if (folder === null) {
        h += `<div style="padding:20px;">
                <button class="act-btn" id="f-lq" style="width:100%; background:var(--talk); margin-bottom:15px;">🍷 好きなお酒</button>
                <button class="act-btn" id="f-mu" style="width:100%; background:var(--green); margin-bottom:15px;">🎵 好きな歌</button>
                <button class="act-btn" id="f-gm" style="width:100%; background:#e67e22; margin-bottom:15px;">🎲 ソフィーとの記録</button>
              </div>`;
        setListView(h, false);
        document.getElementById('f-lq').onclick = () => openTecho('L');
        document.getElementById('f-mu').onclick = () => openTecho('S');
        document.getElementById('f-gm').onclick = () => openTecho('G');
        return;
    }

    // 2階層目：各フォルダの内容
    const categories = { 'L': [], 'S': [], 'O': [] };
    data.favorites.forEach(id => {
        const type = id.charAt(0);
        if (categories[type]) categories[type].push(id); else categories['O'].push(id); 
    });

    if (folder === 'L') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--talk); padding-left:10px;">🍷 好きなお酒</div>`;
        if (categories['L'].length === 0) h += `<div style="padding:40px; color:#888; text-align:center;">記録がありません</div>`;
        else {
            categories['L'].forEach(id => {
                const num = id.replace(/[^0-9]/g, '');
                const item = nav.liquorData.find(d => parseInt(String(Object.values(d)[0]).replace(/[^0-9]/g,''),10) === parseInt(num,10));
                if (item) {
                    const badge = lq ? lq.priceBadge(item["市販価格"], item["大分類"]) : "";
                    h += `<div class="item fav-item lq-fav" data-id="${id}" style="display:flex; align-items:center; gap:4px; padding:0.4em 15px;">
                            ${badge}<span>${clean(item['銘柄名'])}</span>
                          </div>`;
                }
            });
        }
    } else if (folder === 'S') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--green); padding-left:10px;">🎵 好きな歌</div>`;
        if (categories['S'].length === 0) h += `<div style="padding:40px; color:#888; text-align:center;">記録がありません</div>`;
        else {
            categories['S'].forEach(id => {
                const numStr = id.replace(/[^0-9]/g, '');
                let displayTitle = `曲ID: ${numStr}`;
                // Claude指示：parseIntによる確実なマッチング
                const song = nav.jData.find(d => parseInt(String(d.code || ""), 10) === parseInt(numStr, 10));
                if (song) displayTitle = `${song.a} ／ ${song.ti}`;

                // data-fav-patched="true" で二重ハートを防止
                h += `<div class="item fav-item music-row" data-id="${id}" data-fav-patched="true" style="display:flex; justify-content:space-between; align-items:center; padding:0.4em 15px;">
                        <div class="fav-music-play" style="flex:1; cursor:pointer;">🎵 ${clean(displayTitle)}</div>
                        <div class="fav-music-del" style="color:#ff69b4; font-size:1.4rem; cursor:pointer; padding-left:15px;">❤️</div>
                      </div>`;
            });
        }
    } else if (folder === 'G') {
        h += `<div class="scr-title" style="margin-top:15px; color:#e67e22; padding-left:10px;">🎲 ソフィーとの思い出</div>`;
        if (data.gameLog.length === 0) h += `<div style="padding:40px; color:#888; text-align:center;">記録がありません</div>`;
        else {
            data.gameLog.slice(0, 30).forEach(log => {
                h += `<div style="font-size:0.75rem; color:#888; padding:6px 15px; border-bottom:1px dashed #222;">${log}</div>`;
            });
        }
    }

    setListView(h, false);

    // クリックイベントの設定
    document.querySelectorAll('.fav-item').forEach(el => {
        if (el.classList.contains('music-row')) return;
        el.onclick = () => { if (lq && el.classList.contains('lq-fav')) lq.showCardById(el.dataset.id); };
    });

    document.querySelectorAll('.music-row').forEach(row => {
        const id = row.dataset.id;
        // ❤️を押したら削除
        row.querySelector('.fav-music-del').onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(id);
            openTecho(folder); 
        };
        // 曲名を押したらDJ経由で再生
        row.querySelector('.fav-music-play').onclick = (e) => {
            e.stopPropagation();
            const code = id.replace(/[^0-9]/g, '');
            import('./dj.js').then(dj => dj.requestSong(code));
        };
    });
}

// --- 音楽リスト自動パッチ（行間0.4em厳守） ---
export function initMusicPatch() {
    const observer = new MutationObserver(() => {
        const lv = document.getElementById('list-view');
        if (!lv) return;

        // ラベル高さの統一
        lv.querySelectorAll('.label').forEach(l => {
            if(!l.dataset.h){ l.dataset.h="1"; l.style.height="28px"; l.style.display="flex"; l.style.alignItems="center"; }
        });

        lv.querySelectorAll('.item').forEach(item => {
            // ★ デザインルール第7項：行間 0.4em 統一
            if (!item.dataset.s) {
                item.dataset.s="1"; item.style.padding="0.4em 15px"; item.style.lineHeight="1.0";
                item.style.display="flex"; item.style.alignItems="center";
            }
            
            // Claude指示：二重追加防止チェック
            if (item.innerHTML.includes('🎵') && !item.dataset.favPatched && !item.querySelector('.music-fav-btn')) {
                item.dataset.favPatched = "true";
                let songId = null;
                // 長いタイトルから順に探す（誤爆防止）
                const match = nav.jData.sort((a,b)=>(b.ti||"").length-(a.ti||"").length).find(d => d.ti && item.innerText.includes(d.ti));
                songId = match ? `S-${String(match.code).padStart(4,'0')}` : `S-UNK-${Math.random().toString(36).substr(2,5)}`;
                
                const isFav = isFavorite(songId);

                // 🎵アイコンの除去（重複表示防止）
                Array.from(item.childNodes).forEach(n => { if (n.nodeType===3 && n.nodeValue.includes('🎵')) n.nodeValue = n.nodeValue.replace(/🎵/g,''); });
                item.style.justifyContent = 'space-between';

                const btn = document.createElement('div');
                btn.className = 'music-fav-btn';
                btn.dataset.id = songId;
                btn.style.cssText = `padding:8px 12px; margin:-8px -5px -8px auto; color:${isFav?'#ff69b4':'#555'}; font-size:1.2rem; cursor:pointer; line-height:1;`;
                btn.innerText = isFav ? '❤️' : '♡';
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const added = toggleFavorite(songId);
                    btn.style.color = added ? '#ff69b4' : '#555';
                    btn.innerText = added ? '❤️' : '♡';
                };
                item.appendChild(btn);
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// --- じゃんけんゲーム：UI表示と進行 ---
export function playJanken() {
    const status = getGameStatus();
    if (status.count >= status.limit) {
        media.speak("あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？");
        alert(`ソフィー「あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？」\n\n（※本日のマッチは終了しました。現在の戦績：あなた ${status.myWins} - ${status.sophieWins} ソフィー）`);
        return;
    }

    const h = `
        <div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif;">
            <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:10px; text-align:center;" id="j-title">ソフィーと勝負しますか？<br>（3本先取マッチ）</div>
            <div style="font-size:1.5rem; font-weight:bold; margin-bottom:20px; color:#1e90ff;" id="j-score">
                あなた ${status.myWins} <span style="color:#fff;">-</span> ${status.sophieWins} ソフィー
            </div>
            <img id="j-img" src="./front_sophie.jpeg" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin-bottom:20px; box-shadow:0 0 15px rgba(255,255,255,0.2);">
            <div id="j-btns" style="display:flex; gap:15px; margin-bottom:30px;">
                <button class="j-btn" data-hand="✊" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✊</button>
                <button class="j-btn" data-hand="✌️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✌️</button>
                <button class="j-btn" data-hand="🖐️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">🖐️</button>
            </div>
            <button id="j-cancel" style="padding:10px 35px; border-radius:25px; background:#444; color:#fff; border:1px solid #777; font-size:1.1rem; font-weight:bold;">やめる</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', h);

    document.getElementById('j-cancel').onclick = () => document.getElementById('janken-overlay').remove();

    document.querySelectorAll('.j-btn').forEach(btn => {
        btn.onclick = (e) => {
            const myHand = e.currentTarget.dataset.hand;
            const hands = ["✊", "✌️", "🖐️"];
            const sHand = hands[Math.floor(Math.random() * hands.length)];
            let result = (myHand === sHand) ? "draw" : ((myHand==="✊"&&sHand==="✌️")||(myHand==="✌️"&&sHand==="🖐️")||(myHand==="🖐️"&&sHand==="✊")) ? "my" : "sophie";

            const newScore = updateGameScore(result);
            let msg = "";

            if (newScore.myWins >= 3) {
                msg = (newScore.sophieWins === 0) ? "ふふっ……ストレート負けなんて久しぶりです。お約束通り、特別なご褒美……チュッ💋" : "お見事です。今日のところは私の負けですね。";
                addGameLog(newScore.sophieWins === 0 ? "【完全勝利】ソフィーから💋をもらった" : `【勝利】${newScore.myWins}-${newScore.sophieWins}で勝利`);
            } else if (newScore.sophieWins >= 3) {
                msg = (newScore.myWins === 0) ? "私のストレート勝ちですね！さぁ、約束のドンペリ、開けていただきますよ？ふふっ。" : "私の勝ちですね。ふふっ、また明日挑戦してくださいな。";
                addGameLog(newScore.myWins === 0 ? "【完敗】ドンペリを入れさせられた💸" : `【敗北】${newScore.myWins}-${newScore.sophieWins}で敗北`);
            } else {
                msg = (result === "my") ? "やりますね、あなたの勝ちです。次いきますよ！" : (result === "sophie") ? "ふふっ、私の勝ちですね。まだまだこれからですよ！" : "あら、気が合いますね。引き分けです。";
            }

            document.getElementById('j-title').innerText = msg;
            document.getElementById('j-score').innerHTML = `あなた ${newScore.myWins} <span style="color:#fff;">-</span> ${newScore.sophieWins} ソフィー`;
            document.getElementById('j-btns').innerHTML = `<div style="font-size:5rem;">${sHand}</div>`;
            
            const cancelBtn = document.getElementById('j-cancel');
            cancelBtn.style.background = "var(--blue)";
            cancelBtn.style.color = "#000";
            
            if (newScore.myWins >= 3 || newScore.sophieWins >= 3) {
                cancelBtn.innerText = "終了";
                cancelBtn.onclick = () => document.getElementById('janken-overlay').remove();
            } else {
                cancelBtn.innerText = "次へ";
                cancelBtn.onclick = () => {
                    document.getElementById('janken-overlay').remove();
                    playJanken(); 
                };
            }
            media.speak(msg);
        };
    });
}