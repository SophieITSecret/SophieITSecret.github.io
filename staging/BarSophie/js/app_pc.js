import * as media from './media.js';
import * as nav from './navigation.js';

let isAutoPlay = false;
let isMusicMode = false;
let lastText = "";
let pressTimer = null;
let isPaused = false;

// DOM要素のキャッシュ
const chat = document.getElementById('chat-area');
const telop = document.getElementById('telop-box');
const monitorImg = document.getElementById('monitor-image');
const monitorYt = document.getElementById('yt-iframe');
const menuLayer = document.getElementById('menu-layer');
const menuContent = document.getElementById('menu-content');
const navMain = document.getElementById('nav-main-pc');
const btnNext = document.getElementById('btn-next');

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    initEventListeners();
    // YouTube終了検知の定期チェック
    setInterval(checkYoutubeState, 1000);
});

function initEventListeners() {
    // 入店
    document.getElementById('btn-entry-pc').onclick = () => {
        document.getElementById('entry-overlay').style.opacity = '0';
        setTimeout(() => document.getElementById('entry-overlay').style.display = 'none', 500);
        performSpeak("まきむら様、お帰りなさいませ。今夜もお会いできて光栄です。");
    };

    // 操作パネル
    document.getElementById('ctrl-play').onclick = () => {
        if (isMusicMode) {
            monitorYt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        } else if (lastText) {
            performSpeak(lastText);
        }
    };

    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;

    // 次へボタン（長押しでオートプレイ切り替え）
    btnNext.onpointerdown = () => {
        pressTimer = setTimeout(() => {
            isAutoPlay = !isAutoPlay;
            btnNext.classList.toggle('auto-active', isAutoPlay);
            media.speak(isAutoPlay ? "自動進行を開始します" : "自動進行を解除しました");
            pressTimer = null;
        }, 800);
    };
    btnNext.onpointerup = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
            goNext();
        }
    };

    // モード切替
    document.getElementById('btn-music').onclick = openMusicMenu;
    document.getElementById('btn-talk').onclick = openTalkMenu;
}

// 共通再生処理
function performSpeak(text, isShortInfo = false) {
    lastText = text;
    chat.innerText = text;
    
    // 物語モードならテロップ表示、音楽モードなら一定時間で消す
    if (text.length > 5) {
        telop.innerText = text;
        telop.style.display = 'block';
        telop.scrollTop = 0;
        if (isShortInfo) {
            setTimeout(() => { if(telop.innerText === text) telop.style.display = 'none'; }, 5000);
        }
    }

    media.speak(text, 1.05, () => {
        if (isAutoPlay && !isMusicMode) {
            setTimeout(goNext, 1500);
        }
    });
}

function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
        monitorYt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        media.stopSpeak();
    } else {
        if (isMusicMode) {
            monitorYt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        } else {
            performSpeak(lastText);
        }
    }
}

// 次の項目へ
function goNext() {
    if (nav.curI < nav.curP.length - 1) {
        const nextIdx = nav.curI + 1;
        nav.updateNav(undefined, undefined, undefined, nextIdx);
        playCurrentItem();
    } else {
        isAutoPlay = false;
        btnNext.classList.remove('auto-active');
        performSpeak("リストの終わりに到達しました。");
    }
}

// 現在のアイテムを再生（Music/Talk共通）
function playCurrentItem() {
    const item = nav.curP[nav.curI];
    if (!item) return;

    if (isMusicMode) {
        setMonitor('v', item.u);
        performSpeak(`${nav.curG}さんの「${item.ti}」をおかけします。`, true);
    } else {
        setMonitor('i', `./talk_images/${item.id}.jpg`);
        performSpeak(item.txt);
    }
    updateHighlight();
}

function setMonitor(mode, src) {
    monitorYt.style.display = 'none';
    monitorImg.style.display = 'none';
    
    if (mode === 'v') {
        const ytId = media.extractYtId(src);
        monitorYt.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1`;
        monitorYt.style.display = 'block';
    } else {
        monitorYt.src = "";
        monitorImg.src = src;
        monitorImg.style.display = 'block';
    }
}

// メニュー生成
function openMusicMenu() {
    isMusicMode = true;
    nav.updateNav("art");
    menuLayer.style.display = 'block';
    
    let html = '<div class="genre-label">アーティスト一覧</div>';
    // ジャンル順にアーティストを並べる
    ['E','F','J','W','I','S'].forEach(flag => {
        const artists = [...new Set(nav.jData.filter(d => d.f === flag).map(d => d.a))];
        artists.forEach(a => {
            html += `<div class="menu-item art-btn" data-art="${a}">🎤 ${a}</div>`;
        });
    });
    renderMenu(html, (e) => {
        const art = e.target.closest('.art-btn')?.dataset.art;
        if (art) showSongs(art);
    });
}

function showSongs(artist) {
    const songs = nav.jData.filter(d => d.a === artist);
    nav.updateNav("tit", artist, songs);
    
    let html = `<div class="genre-label">${artist} の名曲</div>`;
    songs.forEach((s, i) => {
        html += `<div class="menu-item song-btn" data-idx="${i}">${s.ti}</div>`;
    });
    renderMenu(html, (e) => {
        const idx = parseInt(e.target.closest('.song-btn')?.dataset.idx);
        if (!isNaN(idx)) {
            nav.updateNav(undefined, undefined, undefined, idx);
            playCurrentItem();
        }
    });
}

function openTalkMenu() {
    isMusicMode = false;
    nav.updateNav("g");
    menuLayer.style.display = 'block';
    
    let html = '<div class="genre-label">お酒の知識・物語</div>';
    const genres = [...new Set(nav.tData.map(d => d.g))];
    genres.forEach(g => {
        html += `<div class="menu-item g-btn" data-g="${g}">🥃 ${g}</div>`;
    });
    renderMenu(html, (e) => {
        const g = e.target.closest('.g-btn')?.dataset.g;
        if (g) showThemes(g);
    });
}

function showThemes(genre) {
    nav.updateNav("th", genre);
    const themes = [...new Set(nav.tData.filter(d => d.g === genre).map(d => d.th))];
    
    let html = `<div class="genre-label">${genre}</div>`;
    themes.forEach(th => {
        html += `<div class="menu-item th-btn" data-th="${th}">🏷️ ${th}</div>`;
    });
    renderMenu(html, (e) => {
        const th = e.target.closest('.th-btn')?.dataset.th;
        if (th) showStories(th);
    });
}

function showStories(theme) {
    const stories = nav.tData.filter(d => d.th === theme);
    nav.updateNav("st", undefined, stories);
    
    let html = `<div class="genre-label">${theme}</div>`;
    stories.forEach((st, i) => {
        html += `<div class="menu-item st-btn" data-idx="${i}">${st.ti}</div>`;
    });
    renderMenu(html, (e) => {
        const idx = parseInt(e.target.closest('.st-btn')?.dataset.idx);
        if (!isNaN(idx)) {
            nav.updateNav(undefined, undefined, undefined, idx);
            playCurrentItem();
        }
    });
}

function renderMenu(html, callback) {
    menuContent.innerHTML = html;
    menuContent.onclick = callback;
    menuLayer.scrollTop = 0;
}

function handleBack() {
    switch(nav.state) {
        case "st": showThemes(nav.curG); break;
        case "th": openTalkMenu(); break;
        case "tit": openMusicMenu(); break;
        default: 
            menuLayer.style.display = 'none';
            nav.updateNav("none");
            break;
    }
}

function updateHighlight() {
    document.querySelectorAll('.menu-item').forEach((el, idx) => {
        el.classList.toggle('active-item', idx === nav.curI);
    });
}

// YouTubeの状態監視（終了時に次へ）
function checkYoutubeState() {
    if (isAutoPlay && isMusicMode) {
        monitorYt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*');
    }
}

window.addEventListener('message', (e) => {
    try {
        const data = JSON.parse(e.data);
        // info: 0 は YouTube API における "Ended" (再生終了)
        if (data.info === 0 && isAutoPlay && isMusicMode) {
            goNext();
        }
    } catch (err) { /* JSON解析エラーは無視 */ }
});
