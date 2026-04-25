/**
 * favorite.js — 真・完全版
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

export async function openNotice() {
    nav.updateNav("notice");
    let h = `<div class="label" style="background:#1a5276;">📢 お知らせ・使い方</div>
             <div style="padding:20px; color:#ddd; font-size:0.95rem; line-height:1.7;">
                🍸 BARソフィーへようこそ。<br><br>
                ここでは1970〜80年代の名曲と、マスター厳選のお酒をお楽しみいただけます。<br><br>
                📖 ソフィーのお客様ノート：<br>お酒や曲の横にある「♡」を押すと記録されます。
             </div>`;
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
        categories['L'].forEach(id => {
            const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
            const d = nav.liquorData.find(item => parseInt(item["No"] || item["番号"], 10) === num);
            if (d) {
                const badge = lq ? lq.priceBadge(d["市販価格"], d["大分類"]) : "";
                h += `<div class="item fav-item lq-fav" data-id="${id}" style="display:flex; align-items:center; gap:4px; font-size:1.05rem; padding:0.4em 15px;">${badge}<span>${clean(d['銘柄名'])}</span></div>`;
            }
        });
    } else if (folder === 'S') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--green); padding-left:10px; font-size:0.78rem;">🎵 お好きな歌</div>`;
        categories['S'].forEach(id => {
            const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
            const song = nav.jData.find(d => parseInt(d.code, 10) === num);
            let title = song ? (song.a ? `${song.a}／${song.ti}` : song.ti) : `曲ID:${num}`;
            let cleanTitle = title.replace(/🎵|♫|🎤/g, '').trim();
            if (cleanTitle.length > 18) cleanTitle = cleanTitle.substring(0, 17) + "…";
            h += `<div class="item fav-item music-row" data-id="${id}" data-fav-patched="true" style="display:flex; justify-content:space-between; align-items:center; padding:0.2em 15px;">
                    <div class="fav-music-play" data-code="${num}" style="flex:1; color:#eee; font-size:1.05rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer;">${cleanTitle}</div>
                    <div class="fav-music-del" style="color:#ff69b4; font-size:1.4rem; padding-left:15px; cursor:pointer;">❤️</div>
                  </div>`;
        });
    }
    setListView(h, false);
    document.querySelectorAll('.fav-item').forEach(el => {
        if (el.classList.contains('music-row')) {
            el.querySelector('.fav-music-del').onclick = (e) => { e.stopPropagation(); toggleFavorite(el.dataset.id); openTecho(folder); };
            el.querySelector('.fav-music-play').onclick = (e) => {
                const code = e.currentTarget.dataset.code;
                import('./music.js').then(m => m.playSongByCode(code, { source: "notebook" }));
            };
            return;
        }
        el.onclick = () => { if (el.classList.contains('lq-fav') && lq) lq.showCardById(el.dataset.id); };
    });
}

export function initMusicPatch() {
    const observer = new MutationObserver(() => {
        const lv = document.getElementById('list-view'); if (!lv) return;
        lv.querySelectorAll('.item').forEach(item => {
            const hasIcon = item.innerText.includes('🎵') || item.innerText.includes('🎤');
            if (hasIcon) {
                item.style.padding = '0.2em 15px'; // 歌・歌手は0.2emに極限まで詰める
            } else {
                item.style.padding = '0.4em 15px';
            }
            item.style.fontSize = '1.05rem';
            item.style.display = 'flex';
            item.style.alignItems = 'center';

            if (item.querySelector('.music-fav-btn')) return;
            if (hasIcon) {
                // 🎤アイコンを削除
                item.innerHTML = item.innerHTML.replace(/🎤/g, '');
                const titleText = item.innerText.replace(/🎵|🎤/g, '').trim();
                const song = nav.jData.find(d => d.ti === titleText);
                const songId = song ? `S-${String(song.code).padStart(4,'0')}` : 'S-UNK';
                const isFav = isFavorite(songId);
                item.style.justifyContent = 'space-between';
                item.innerHTML = `<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🎵 ${titleText}</span>
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
        alert(`ソフィー「本日のマッチは終了しました。」`); return;
    }
    const h = `<div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff;">
        <div style="font-size:1.2rem; color:var(--accent); margin-bottom:10px; text-align:center;">ソフィーと勝負！（3本先取）</div>
        <div style="font-size:1.5rem; margin-bottom:20px;">あなた ${status.myWins} - ${status.sophieWins} ソフィー</div>
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
            let winner = (e.target.dataset.hand === sHand) ? "draw" : 
                         ((e.target.dataset.hand==="✊"&&sHand==="✌️")||(e.target.dataset.hand==="✌️"&&sHand==="🖐️")||(e.target.dataset.hand==="🖐️"&&sHand==="✊")) ? "my" : "sophie";
            updateGameScore(winner); document.getElementById('janken-overlay').remove(); playJanken();
        };
    });
}