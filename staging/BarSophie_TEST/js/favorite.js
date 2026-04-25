/**
 * favorite.js — 完全改修版（全コード）
 * ★ お客様ノート刷新・18文字制限・じゃんけんセリフ維持
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
    if (index === -1) data.favorites.push(id);
    else data.favorites.splice(index, 1);
    saveTechoData(data);
    return index === -1;
}

export function isFavorite(id) { return getTechoData().favorites.includes(id); }

export function getGameStatus() {
    const data = getTechoData();
    const d = new Date();
    const today = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    if (data.lastGameDate !== today) {
        data.gameCount = 0; data.janken = { myWins: 0, sophieWins: 0 };
        data.lastGameDate = today; saveTechoData(data);
    }
    return { count: data.gameCount, limit: 1, myWins: data.janken.myWins, sophieWins: data.janken.sophieWins };
}

export function updateGameScore(winner) {
    const data = getTechoData();
    if (winner === "my") data.janken.myWins++;
    if (winner === "sophie") data.janken.sophieWins++;
    if (data.janken.myWins >= 3 || data.janken.sophieWins >= 3) data.gameCount++;
    saveTechoData(data);
    return { myWins: data.janken.myWins, sophieWins: data.janken.sophieWins };
}

function addGameLog(text) {
    const data = getTechoData();
    const d = new Date();
    const timeStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    data.gameLog.unshift(`[${timeStr}] ${text}`);
    if (data.gameLog.length > 30) data.gameLog.pop();
    saveTechoData(data);
}

export async function openNotice() {
    nav.updateNav("notice");
    let content = "";
    try {
        const res = await fetch('お知らせ.txt');
        if (res.ok) { content = `<div style="white-space: pre-wrap; margin-top:10px;">${clean(await res.text())}</div>`; }
        else throw new Error();
    } catch (e) {
        content = `<h3 style="color:var(--accent); border-bottom:1px solid #555; padding-bottom:5px;">🍸 BARソフィーへようこそ</h3>
                   <p style="margin-top:10px;">ここでは1970〜80年代の名曲と、マスター厳選のお酒をお楽しみいただけます。</p>`;
    }
    let h = `<div class="label" style="background:#1a5276;">📢 お知らせ・使い方</div><div style="padding:20px; color:#ddd; font-size:0.95rem;">${content}</div>`;
    setListView(h, false);
}

export async function openTecho(folder = null) {
    nav.updateNav("techo");
    currentFolder = folder; 
    const data = getTechoData();
    const lq = await import('./liquor.js').catch(() => null);
    
    let h = `<div class="label" style="background:#333; display:flex; justify-content:center; align-items:center;">
                <span>📖 ソフィーのお客様ノート</span>
             </div>`;

    if (folder === null) {
        // 並び順：歌 → お酒 → 記録 [cite: 19]
        h += `<div style="padding:20px;">
                <button class="act-btn" id="f-mu" style="width:100%; background:var(--green); margin-bottom:15px;">🎵 お好きな歌</button>
                <button class="act-btn" id="f-lq" style="width:100%; background:var(--talk); margin-bottom:15px;">🍷 お気に入りのお酒</button>
                <button class="act-btn" id="f-gm" style="width:100%; background:#e67e22; margin-bottom:15px;">🎲 ソフィーとの記録</button>
              </div>`;
        setListView(h, false);
        document.getElementById('f-mu').onclick = () => openTecho('S');
        document.getElementById('f-lq').onclick = () => openTecho('L');
        document.getElementById('f-gm').onclick = () => openTecho('G');
        return;
    }

    const categories = { 'L': [], 'S': [], 'O': [] };
    data.favorites.forEach(id => {
        const type = id.charAt(0); if (categories[type]) categories[type].push(id); else categories['O'].push(id); 
    });

    if (folder === 'L') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--talk); padding-left:10px; font-size:0.78rem;">🍷 お気に入りのお酒</div>`;
        if (categories['L'].length === 0) h += `<div style="padding:40px 20px; color:#888; text-align:center;">まだお酒が記録されていません</div>`;
        else {
            categories['L'].forEach(id => {
                if (lq) {
                    const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
                    const d = nav.liquorData.find(item => parseInt(String(item["No"] || item["番号"] || "").replace(/[^0-9]/g, ''), 10) === num);
                    if (d) h += `<div class="item fav-item lq-fav" data-id="${id}" style="display:flex; align-items:center; gap:4px; font-size:1.1rem; padding:0.4em 15px;">${lq.priceBadge(d["市販価格"], d["大分類"])}<span>${clean(d['銘柄名'])}</span></div>`;
                }
            });
        }
    } else if (folder === 'S') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--green); padding-left:10px; font-size:0.78rem;">🎵 お好きな歌</div>`;
        if (categories['S'].length === 0) h += `<div style="padding:40px 20px; color:#888; text-align:center;">まだ曲が記録されていません</div>`;
        else {
            categories['S'].forEach(id => {
                const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
                const song = nav.jData.find(d => parseInt(String(d.code || ""), 10) === num);
                let title = song ? (song.a ? `${song.a}／${song.ti}` : song.ti) : `曲ID:${num}`;
                
                // ♫削除 & 18文字制限 & 1.1rem拡大 [cite: 20]
                let cleanTitle = title.replace(/🎵|♫/g, '').trim();
                if (cleanTitle.length > 18) cleanTitle = cleanTitle.substring(0, 17) + "…";

                h += `<div class="item fav-item music-row" data-id="${id}" data-fav-patched="true" style="display:flex; justify-content:space-between; align-items:center; padding:0.4em 15px;">
                        <div class="fav-music-play" style="flex:1; color:#eee; font-size:1.1rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; line-height:1.2;">${cleanTitle}</div>
                        <div class="fav-music-del" style="color:#ff69b4; font-size:1.4rem; padding-left:15px; cursor:pointer;">❤️</div>
                      </div>`;
            });
        }
    } else if (folder === 'G') {
        h += `<div class="scr-title" style="margin-top:15px; color:#e67e22; padding-left:10px; font-size:0.78rem;">🎲 ソフィーとの思い出</div>`;
        data.gameLog.forEach(log => { h += `<div style="font-size:0.75rem; color:#888; padding:6px 15px; border-bottom:1px dashed #222;">${log}</div>`; });
    }

    setListView(h, false);

    document.querySelectorAll('.fav-item').forEach(el => {
        if (el.classList.contains('music-row')) {
            el.querySelector('.fav-music-del').onclick = (e) => { e.stopPropagation(); toggleFavorite(el.dataset.id); openTecho(folder); };
            return;
        }
        el.onclick = () => { if (el.classList.contains('lq-fav') && lq) lq.showCardById(el.dataset.id); };
    });
}

export function initMusicPatch() {
    const observer = new MutationObserver(() => {
        const lv = document.getElementById('list-view'); if (!lv) return;
        lv.querySelectorAll('.item').forEach(item => {
            if (!item.dataset.spacingPatched) {
                item.dataset.spacingPatched = "true";
                item.style.padding = '0.4em 15px'; item.style.fontSize = '1.1rem'; item.style.display = 'flex'; item.style.alignItems = 'center';
            }
            if (item.querySelector('.music-fav-btn') || item.dataset.favPatched) return;
            if (item.innerText.includes('🎵')) {
                item.dataset.favPatched = "true";
                const match = item.innerText.match(/🎵\s*(.*)/);
                const titleOnly = match ? match[1].trim() : "";
                const song = nav.jData.find(d => d.ti === titleOnly);
                const songId = song ? `S-${String(song.code).padStart(4,'0')}` : 'S-UNK';
                const isFav = isFavorite(songId);
                item.style.justifyContent = 'space-between';
                item.innerHTML = `<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🎵 ${titleOnly}</span>
                                  <div class="music-fav-btn" data-id="${songId}" style="padding:8px 12px; margin:-8px -5px -8px auto; color:${isFav?'#ff69b4':'#555'}; font-size:1.2rem; cursor:pointer;">${isFav?'❤️':'♡'}</div>`;
                item.querySelector('.music-fav-btn').onclick = (e) => {
                    e.stopPropagation(); const added = toggleFavorite(songId);
                    e.target.style.color = added ? '#ff69b4' : '#555'; e.target.innerText = added ? '❤️' : '♡';
                };
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function playJanken() {
    const status = getGameStatus();
    if (status.count >= status.limit) {
        import('./media.js').then(media => media.speak("あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？"));
        alert(`ソフィー「あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？」`);
        return;
    }
    const h = `<div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;">
        <div style="font-size:1.2rem; color:var(--accent); margin-bottom:10px; text-align:center;" id="j-title">ソフィーと勝負！（3本先取）</div>
        <div style="font-size:1.5rem; margin-bottom:20px; color:#1e90ff;" id="j-score">あなた ${status.myWins} - ${status.sophieWins} ソフィー</div>
        <img id="j-img" src="./front_sophie.jpeg" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin-bottom:20px;">
        <div id="j-btns" style="display:flex; gap:15px; margin-bottom:30px;">
            <button class="j-btn" data-hand="✊" style="font-size:3.5rem; background:none; border:none;">✊</button>
            <button class="j-btn" data-hand="✌️" style="font-size:3.5rem; background:none; border:none;">✌️</button>
            <button class="j-btn" data-hand="🖐️" style="font-size:3.5rem; background:none; border:none;">🖐️</button>
        </div>
        <button id="j-cancel" style="padding:10px 35px; border-radius:25px; background:#444; border:none;">やめる</button>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('j-cancel').onclick = () => document.getElementById('janken-overlay').remove();

    document.querySelectorAll('.j-btn').forEach(btn => {
        btn.onclick = (e) => {
            const hands = ["✊", "✌️", "🖐️"]; const sHand = hands[Math.floor(Math.random() * 3)];
            const myHand = e.currentTarget.dataset.hand;
            let winner = (myHand === sHand) ? "draw" : 
                         ((myHand==="✊"&&sHand==="✌️")||(myHand==="✌️"&&sHand==="🖐️")||(myHand==="🖐️"&&sHand==="✊")) ? "my" : "sophie";
            const newScore = updateGameScore(winner);
            let msg = winner==="my"?"あなたの勝ちです！":winner==="sophie"?"私の勝ちですね。":"引き分けですわ。";
            
            if (newScore.myWins >= 3) {
                msg = newScore.sophieWins === 0 ? "ストレート負けなんて久しぶりです。お約束通り、特別なご褒美……チュッ💋" : "お見事です。今日のところは私の負けですね。";
                addGameLog(`勝利！ ${newScore.myWins}-${newScore.sophieWins}`);
            } else if (newScore.sophieWins >= 3) {
                msg = newScore.myWins === 0 ? "私のストレート勝ちですね！さぁ、約束のドンペリ、開けていただきますよ？ふふっ。" : "私の勝ちですね。また明日挑戦してくださいな。";
                addGameLog(`敗北... ${newScore.myWins}-${newScore.sophieWins}`);
            }

            document.getElementById('j-title').innerText = msg;
            document.getElementById('j-score').innerText = `あなた ${newScore.myWins} - ${newScore.sophieWins} ソフィー`;
            import('./media.js').then(media => media.speak(clean(msg)));
            
            const cancelBtn = document.getElementById('j-cancel');
            if (newScore.myWins >= 3 || newScore.sophieWins >= 3) {
                cancelBtn.innerText = "戻る"; cancelBtn.onclick = () => document.getElementById('janken-overlay').remove();
                document.getElementById('j-btns').innerHTML = `<div style="font-size:6rem;">${sHand}</div>`;
            } else {
                cancelBtn.innerText = "次へ"; cancelBtn.onclick = () => { document.getElementById('janken-overlay').remove(); playJanken(); };
            }
        };
    });
}