// js/favorite.js
/**
 * favorite.js — 最終確定版
 * ★ M2階層の戻るをM1に修正
 */

import { setListView, clean } from './utils.js';
import * as nav from './navigation.js';

const STORAGE_KEY = 'bar_sophie_techo';
let currentFolder = null; 

export function getCurrentFolder() { return currentFolder; }

export function getTechoData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { favorites: [], gameLog: [], lastGameDate: '', gameCount: 0, janken: { myWins: 0, sophieWins: 0 }, playlists: [] };
    const parsed = JSON.parse(data);
    if (!parsed.janken) parsed.janken = { myWins: 0, sophieWins: 0 };
    if (!parsed.playlists) parsed.playlists = [];
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

    const menuHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                お呼びですか？
            </div>
            <div style="padding:10px;">
                <button class="act-btn" id="nt-news" style="background:#1a5276; margin-bottom:8px;">📢 お店からのお知らせ</button>
                <button class="act-btn" id="nt-how" style="background:#1a5276; margin-bottom:8px;">📖 このお店の使い方</button>
                <div style="border-top:1px solid #222; margin:8px 0;"></div>
                <button class="act-btn" id="nt-janken" style="background:#8e1a2e; margin-bottom:8px;">🎲 じゃんけん勝負</button>
                <button class="act-btn" style="background:#1a1a1a; color:#444; border:1px solid #222; margin-bottom:8px;" disabled>📅 この日はどんな日（近日公開）</button>
            </div>
        </div>`;

    setListView(menuHtml, false);

    document.getElementById('nt-news').onclick = () => showNews();
    document.getElementById('nt-how').onclick  = () => showHowTo();
    document.getElementById('nt-janken').onclick = () => {
        import('./janken.js').then(j => j.startJanken());
    };
}

function showNews() {
    const h = `
        <div class="label" style="background:#1a5276;">📢 お店からのお知らせ</div>
        <div style="padding:20px; color:#ddd; font-size:0.95rem; line-height:1.8;">
            現在準備中です。<br>
            <span style="color:#888; font-size:0.85rem;">今後ソフィーからのお知らせをここに掲載します。</span>
        </div>`;
    setListView(h, false);
}

function showHowTo() {
    const h = `
        <div class="label" style="background:#1a5276;">📖 このお店の使い方</div>
        <div style="padding:15px; color:#ddd; font-size:0.9rem; line-height:1.8;">
            <div style="margin-bottom:12px;">
                <span style="color:#f0b56e; font-weight:bold;">🎵 音楽リクエスト</span><br>
                曲のジャンルやアーティストから選んでリクエストできます。Sボタンを押すとDJソフィーが解説しながら自動再生します。
            </div>
            <div style="margin-bottom:12px;">
                <span style="color:#f0b56e; font-weight:bold;">🍸 お酒を探す</span><br>
                800銘柄を収録。リスト・スクリーニング・ID直接入力の3通りで検索できます。
            </div>
            <div style="margin-bottom:12px;">
                <span style="color:#f0b56e; font-weight:bold;">🥃 お酒の話</span><br>
                360話のお酒にまつわる物語が読めます。
            </div>
            <div style="margin-bottom:12px;">
                <span style="color:#f0b56e; font-weight:bold;">🎲 じゃんけん勝負</span><br>
                1日1回、ソフィーと3本先取勝負ができます。Sボタンから挑戦してみてください。
            </div>
            <div style="margin-bottom:12px;">
                <span style="color:#f0b56e; font-weight:bold;">⭐ ソフィーのおすすめ</span><br>
                Amazonのお買い得コーナーへダイレクト。マスター厳選のグッズも紹介します。
            </div>
            <div>
                <span style="color:#f0b56e; font-weight:bold;">📖 お客様ノート</span><br>
                ♡を押したお酒や曲が記録されます。📖ボタンから確認できます。
            </div>
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
        // M1：フォルダ選択画面
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

    // M2a/b/c：フォルダ内容画面
    const categories = { 'L': [], 'S': [], 'O': [] };
    data.favorites.forEach(id => {
        const type = id.charAt(0); if (categories[type]) categories[type].push(id); else categories['O'].push(id); 
    });

    if (folder === 'L') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--talk); padding-left:10px; font-size:0.78rem;">🍷 お気に入りのお酒</div>`;
        categories['L'].forEach(id => {
            const d = nav.liquorData.find(item => (item["No."] || item["No"]) === id);
            if (d) {
                const badge = lq ? lq.priceBadge(d["市販価格"], d["大分類"]) : "";
                h += `<div class="item fav-item lq-fav" data-id="${id}" style="display:flex; align-items:center; gap:4px; font-size:1.05rem; padding:0.15em 15px;">${badge}<span>${clean(d['銘柄名'])}</span></div>`;
            }
        });
    } else if (folder === 'S') {
        } else if (folder === 'S') {
    h += `<div style="padding:8px 15px;">
            <button class="act-btn" id="f-playlist" style="background:#1a3a4a; border:1px solid #00d2ff; width:100%; margin:0;">📋 マイプレイリスト</button>
          </div>`;
    h += `<div class="scr-title" style="margin-top:5px; color:var(--green); padding-left:10px; font-size:0.78rem;">🎵 お好きな歌</div>`;
        categories['S'].forEach(id => {
            const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
            const song = nav.jData.find(d => parseInt(d.code, 10) === num);
            let title = song ? (song.a ? `${song.a}／${song.ti}` : song.ti) : `曲ID:${num}`;
            let cleanTitle = title.replace(/🎵|♫|🎤/g, '').trim();
            if (cleanTitle.length > 18) cleanTitle = cleanTitle.substring(0, 17) + "…";
            
            h += `<div class="item fav-item music-row" data-id="${id}" data-fav-patched="true" style="display:flex; justify-content:space-between; align-items:center; padding:0.1em 15px;">
                    <div class="fav-music-play" data-code="${num}" style="flex:1; color:#eee; font-size:1.05rem; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; line-height:1.2; cursor:pointer;">${cleanTitle}</div>
                    <div class="fav-music-del" style="color:#ff69b4; font-size:1.4rem; padding-left:15px; cursor:pointer;">❤️</div>
                  </div>`;
        });
    
 } else if (folder === 'G') {
        const log = data.gameLog || [];
        if (log.length === 0) {
            h += '<div style="padding:20px; color:#888; text-align:center;">まだ記録がありません</div>';
        } else {
            log.forEach(r => {
                const color = r.result === '○' ? '#7fd97f' : '#ff6b6b';
                h += '<div style="padding:8px 15px; border-bottom:1px solid #333; display:flex; justify-content:space-between; color:#ccc; font-size:0.85rem;">';
                h += '<span>' + r.date + '</span>';
                h += '<span style="color:' + color + ';">' + r.result + '</span>';
                h += '<span>' + r.score + '</span>';
                h += '<span>' + r.total + '</span>';
                h += '</div>';
            });
        }
    }
setListView(h, false);
    const plBtn = document.getElementById('f-playlist');
    if (plBtn) plBtn.onclick = () => alert('playlist button clicked');
    document.querySelectorAll('.fav-item').forEach(el => {
        if (el.classList.contains('music-row')) {
            el.querySelector('.fav-music-del').onclick = (e) => { e.stopPropagation(); toggleFavorite(el.dataset.id); openTecho(folder); };
            el.querySelector('.fav-music-play').onclick = (e) => {
                const code = e.currentTarget.dataset.code;
                import('./music.js').then(m => m.playSongByCode(code));
            };
            return;
        }
        el.onclick = () => { if (el.classList.contains('lq-fav') && lq) lq.showCardById(el.dataset.id); };
    });
}

function openPlaylistMenu() {
    const data = getTechoData();
    const playlists = data.playlists.length > 0 ? data.playlists : 
        Array.from({length: 5}, (_, i) => ({ name: `リスト${i+1}`, songs: [] }));
    
    // プレイリストが5つ未満なら補完
    while (playlists.length < 5) {
        playlists.push({ name: `リスト${playlists.length + 1}`, songs: [] });
    }

    let h = `<div class="label" style="background:#1a3a4a;">📋 マイプレイリスト</div>`;
    playlists.forEach((pl, i) => {
        h += `<div class="item pl-item" data-idx="${i}" style="display:flex; justify-content:space-between; align-items:center; padding:0.4em 15px;">
                <span style="flex:1;">${pl.name}（${pl.songs.length}曲）</span>
                <span class="pl-rename" data-idx="${i}" style="color:#888; font-size:0.8rem; padding:4px 8px;">✏️</span>
              </div>`;
    });
    h += `<div class="item" id="pl-back" style="color:#888; padding:0.4em 15px;">◀ 戻る</div>`;
    setListView(h, false);

    // プレイリストデータを保存（初回）
    if (data.playlists.length === 0) {
        data.playlists = playlists;
        saveTechoData(data);
    }

    document.querySelectorAll('.pl-item').forEach(el => {
        el.onclick = (e) => {
            if (e.target.classList.contains('pl-rename')) return;
            openPlaylist(parseInt(el.dataset.idx));
        };
    });
    document.querySelectorAll('.pl-rename').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.idx);
            const newName = prompt('リスト名を入力してください', playlists[idx].name);
            if (newName && newName.trim()) {
                data.playlists[idx].name = newName.trim();
                saveTechoData(data);
                openPlaylistMenu();
            }
        };
    });
    document.getElementById('pl-back').onclick = () => openTecho('S');
}

function openPlaylist(idx) {
    const data = getTechoData();
    const pl = data.playlists[idx];
    if (!pl) return;

    // お気に入りの曲リストを取得
    const favIds = (data.favorites || []).filter(id => id.startsWith('S-'));
    const favSongs = favIds.map(id => {
        const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
        const song = nav.jData.find(d => parseInt(d.code, 10) === num);
        return song ? { ...song, favId: id } : null;
    }).filter(Boolean);

    let h = `<div class="label" style="background:#1a3a4a;">📋 ${pl.name}</div>`;
    
    // 連続再生ボタン
    if (pl.songs.length > 0) {
        h += `<div style="padding:8px 15px;">
                <button class="act-btn" id="pl-play-all" style="background:#1a5276; width:100%; margin:0;">🔁 連続再生（${pl.songs.length}曲）</button>
              </div>`;
    }

    // リスト内の曲
    if (pl.songs.length > 0) {
        h += `<div class="scr-title" style="color:#00d2ff; padding-left:10px; font-size:0.78rem; margin-top:5px;">リストの曲</div>`;
        pl.songs.forEach((code, i) => {
            const song = nav.jData.find(d => parseInt(d.code, 10) === parseInt(code, 10));
            if (song) {
                h += `<div class="item" style="display:flex; justify-content:space-between; align-items:center; padding:0.2em 15px;">
                        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🎵 ${song.ti}</span>
                        <span class="pl-remove" data-code="${code}" data-idx="${idx}" style="color:#ff6b6b; font-size:0.8rem; padding:4px 8px;">✕</span>
                      </div>`;
            }
        });
    } else {
        h += `<div style="padding:15px; color:#888; text-align:center; font-size:0.9rem;">曲がありません</div>`;
    }

    // お気に入りから追加
    h += `<div class="scr-title" style="color:#f0b56e; padding-left:10px; font-size:0.78rem; margin-top:10px;">お気に入りから追加</div>`;
    favSongs.forEach(song => {
        const inList = pl.songs.includes(String(song.code));
        h += `<div class="item pl-add-item" data-code="${song.code}" data-idx="${idx}" 
                style="display:flex; justify-content:space-between; align-items:center; padding:0.2em 15px; ${inList ? 'color:#555;' : 'color:#eee;'}">
                <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">🎵 ${song.ti}</span>
                <span style="font-size:0.8rem; padding:4px 8px; color:${inList ? '#555' : '#7fd97f'};">${inList ? '追加済' : '＋追加'}</span>
              </div>`;
    });

    h += `<div class="item" id="pl-back2" style="color:#888; padding:0.4em 15px; margin-top:5px;">◀ 戻る</div>`;
    setListView(h, false);

    const playAllBtn = document.getElementById('pl-play-all');
    if (playAllBtn) {
        playAllBtn.onclick = () => {
            const songs = pl.songs.map(code => 
                nav.jData.find(d => parseInt(d.code, 10) === parseInt(code, 10))
            ).filter(Boolean);
            // showAutoPlaySongSelectを直接呼べないのでstartAutoPlayを使う
            import('./music.js').then(m => m.startAutoPlay(songs, 0));
        };
    }

    document.querySelectorAll('.pl-remove').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const code = el.dataset.code;
            const listIdx = parseInt(el.dataset.idx);
            data.playlists[listIdx].songs = data.playlists[listIdx].songs.filter(c => c !== code);
            saveTechoData(data);
            openPlaylist(listIdx);
        };
    });

    document.querySelectorAll('.pl-add-item').forEach(el => {
        el.onclick = () => {
            const code = String(el.dataset.code);
            const listIdx = parseInt(el.dataset.idx);
            if (!data.playlists[listIdx].songs.includes(code)) {
                data.playlists[listIdx].songs.push(code);
                saveTechoData(data);
                openPlaylist(listIdx);
            }
        };
    });

    document.getElementById('pl-back2').onclick = () => openPlaylistMenu();
}

export function initMusicPatch() {
    const observer = new MutationObserver(() => {
        const lv = document.getElementById('list-view'); if (!lv) return;
        lv.querySelectorAll('.item').forEach(item => {
            const hasIcon = item.innerText.includes('🎵') || item.innerText.includes('🎤');
            if (hasIcon) {
                item.style.padding = '0.15em 15px'; 
            } else {
                item.style.padding = '0.4em 15px';
            }
            item.style.fontSize = '1.05rem';
            item.style.display = 'flex';
            item.style.alignItems = 'center';

            if (item.querySelector('.music-fav-btn') || item.dataset.favPatched) return;
            if (hasIcon) {
                item.innerHTML = item.innerHTML.replace(/🎤/g, '');
                const titleText = item.innerText.replace(/🎵|🎤/g, '').trim();
                const song = nav.jData.find(d => d.ti === titleText);
                const songId = song ? `S-${String(song.code).padStart(4,'0')}` : 'S-UNK';
                const isFav = isFavorite(songId);
                item.dataset.favPatched = "true";
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