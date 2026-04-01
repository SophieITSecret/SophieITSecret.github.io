import * as media from './media.js';
import * as nav from './navigation.js';

let isAutoPlay = false;
let isMusicMode = false;
let lastText = "";
let isPaused = false;

const chat = document.getElementById('chat-area');
const telop = document.getElementById('telop-box');
const monitorImg = document.getElementById('monitor-image');
const monitorYt = document.getElementById('yt-iframe');
const menuLayer = document.getElementById('menu-layer');
const menuContent = document.getElementById('menu-content');

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    initEventListeners();
    setInterval(checkYoutubeState, 1000);
});

function initEventListeners() {
    document.getElementById('btn-entry-pc').onclick = () => {
        document.getElementById('entry-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('entry-overlay').style.display = 'none', 500);
        performSpeak("まきむら様、お帰りなさいませ。", "今夜も至高のひと時をお過ごしください。");
    };

    // コントロール系
    document.getElementById('ctrl-play').onclick = () => {
        if (isMusicMode) monitorYt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        else if (lastText) media.speak(lastText);
    };
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    document.getElementById('btn-next').onclick = goNext;

    // シアターモード（拡張用：現在は全画面表示のトリガー）
    document.getElementById('ctrl-theater').onclick = () => {
        media.speak("シアターモード、準備いたします。");
        if (monitorYt.requestFullscreen) monitorYt.requestFullscreen();
    };

    // 看板ソング
    document.getElementById('btn-signal-song').onclick = () => {
        const signal = nav.jData.find(d => d.ti.includes("みずいろのシグナル"));
        if (signal) {
            isMusicMode = true;
            nav.updateNav("tit", signal.a, [signal], 0);
            playCurrentItem();
        }
    };

    // ジャンルクイックセレクト
    document.querySelectorAll('.g-select-btn').forEach(btn => {
        btn.onclick = () => {
            const flag = btn.dataset.flag;
            isMusicMode = true;
            openMusicGenre(flag);
        };
    });

    document.getElementById('btn-music').onclick = openMusicMenu;
    document.getElementById('btn-talk').onclick = openTalkMenu;
}

// テキスト配信の分離
function performSpeak(sophieVoice, storyText = "") {
    lastText = storyText || sophieVoice;
    
    // ソフィーの台詞（左下）
    chat.innerText = sophieVoice;
    
    // 物語や情報のテキスト（右上テロップ）
    if (storyText) {
        telop.innerText = storyText;
        telop.style.display = 'block';
        telop.scrollTop = 0;
    } else {
        // 短い挨拶などの時はテロップを隠す
        telop.style.display = 'none';
    }

    media.speak(lastText, 1.05, () => {
        if (isAutoPlay && !isMusicMode) setTimeout(goNext, 1500);
    });
}

function openMusicGenre(flag) {
    const genreNames = { E:"演歌", F:"フォーク", J:"歌謡曲", W:"洋楽", I:"インスト", S:"旅情・映像" };
    const artists = [...new Set(nav.jData.filter(d => d.f === flag).map(d => d.a))];
    nav.updateNav("art");
    menuLayer.style.display = 'block';
    
    let html = `<div class="genre-label">${genreNames[flag] || 'ジャンル'} アーティスト</div>`;
    artists.forEach(a => {
        html += `<div class="menu-item art-btn" data-art="${a}">🎤 ${a}</div>`;
    });
    renderMenu(html, (e) => {
        const art = e.target.closest('.art-btn')?.dataset.art;
        if (art) showSongs(art);
    });
}

// 既存の showSongs, playCurrentItem 等は維持しつつ、
// playCurrentItem 内の performSpeak 呼び出しを最適化
function playCurrentItem() {
    const item = nav.curP[nav.curI];
    if (!item) return;

    if (isMusicMode) {
        setMonitor('v', item.u);
        performSpeak(`${item.a}さんの名曲です。`, `再生中：${item.ti}`);
    } else {
        setMonitor('i', `./talk_images/${item.id}.jpg`);
        performSpeak("お酒の物語をお聴きください。", item.txt);
    }
}

// --- (以下、残りの既存ロジックを統合して納品) ---
function setMonitor(mode, src) {
    monitorYt.style.display = 'none'; monitorImg.style.display = 'none';
    if (mode === 'v') {
        const ytId = media.extractYtId(src);
        monitorYt.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1`;
        monitorYt.style.display = 'block';
    } else {
        monitorYt.src = ""; monitorImg.src = src; monitorImg.style.display = 'block';
    }
}
function renderMenu(html, callback) {
    menuContent.innerHTML = html; menuContent.onclick = callback; menuLayer.scrollTop = 0;
}
function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        monitorYt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        media.stopSpeak();
    } else {
        if (isMusicMode) monitorYt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        else media.speak(lastText);
    }
}
function goNext() {
    if (nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        playCurrentItem();
    }
}
function handleBack() {
    menuLayer.style.display = 'none';
}
function checkYoutubeState() {
    if (isAutoPlay && isMusicMode) {
        monitorYt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*');
    }
}
function openMusicMenu() {
    isMusicMode = true; menuLayer.style.display = 'block';
    let html = '<div class="genre-label">全アーティスト</div>';
    const allArtists = [...new Set(nav.jData.map(d => d.a))];
    allArtists.forEach(a => { html += `<div class="menu-item art-btn" data-art="${a}">🎤 ${a}</div>`; });
    renderMenu(html, (e) => {
        const art = e.target.closest('.art-btn')?.dataset.art;
        if (art) showSongs(art);
    });
}
function showSongs(artist) {
    const songs = nav.jData.filter(d => d.a === artist);
    nav.updateNav("tit", artist, songs);
    let html = `<div class="genre-label">${artist}</div>`;
    songs.forEach((s, i) => { html += `<div class="menu-item song-btn" data-idx="${i}">${s.ti}</div>`; });
    renderMenu(html, (e) => {
        const idx = parseInt(e.target.closest('.song-btn')?.dataset.idx);
        if (!isNaN(idx)) { nav.updateNav(undefined, undefined, undefined, idx); playCurrentItem(); }
    });
}
function openTalkMenu() {
    isMusicMode = false; menuLayer.style.display = 'block';
    let html = '<div class="genre-label">お酒の物語</div>';
    const genres = [...new Set(nav.tData.map(d => d.g))];
    genres.forEach(g => { html += `<div class="menu-item g-btn" data-g="${g}">🥃 ${g}</div>`; });
    renderMenu(html, (e) => {
        const g = e.target.closest('.g-btn')?.dataset.g;
        if (g) {
            const themes = [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))];
            let thHtml = `<div class="genre-label">${g}</div>`;
            themes.forEach(th => { thHtml += `<div class="menu-item th-btn" data-th="${th}">🏷️ ${th}</div>`; });
            renderMenu(thHtml, (ee) => {
                const th = ee.target.closest('.th-btn')?.dataset.th;
                if (th) {
                    const stories = nav.tData.filter(d => d.th === th);
                    nav.updateNav("st", undefined, stories);
                    let stHtml = `<div class="genre-label">${th}</div>`;
                    stories.forEach((st, i) => { stHtml += `<div class="menu-item st-btn" data-idx="${i}">${st.ti}</div>`; });
                    renderMenu(stHtml, (eee) => {
                        const idx = parseInt(eee.target.closest('.st-btn')?.dataset.idx);
                        if (!isNaN(idx)) { nav.updateNav(undefined, undefined, undefined, idx); playCurrentItem(); }
                    });
                }
            });
        }
    });
}
