let masterData = [];
let talkData = [];
let currentUrl = "";

const iframe = document.getElementById('yt-iframe');
const telop = document.getElementById('telop-box');
const grid = document.getElementById('fixed-buttons-grid');
const menuLayer = document.getElementById('menu-layer');
const menuContent = document.getElementById('menu-content');

document.addEventListener('DOMContentLoaded', () => {
    loadMusicCSV();
    loadTalkCSV();
    initUI();
});

async function loadMusicCSV() {
    try {
        const res = await fetch(`JBoxメニュー.csv?v=${new Date().getTime()}`);
        const text = await res.text();
        const lines = text.split('\n').slice(1);
        masterData = lines.filter(l => l.trim()).map(line => {
            const c = line.split(',');
            return { flag: c[0].trim(), artist: c[2].trim(), title: c[3].replace(/"/g,'').trim(), url: c[4].trim() };
        });
        renderFixedButtons();
    } catch (e) { console.error("Music CSV Error", e); }
}

async function loadTalkCSV() {
    try {
        const res = await fetch(`お酒の話.csv?v=${new Date().getTime()}`);
        const text = await res.text();
        const lines = text.split('\n').slice(1);
        talkData = lines.filter(l => l.trim()).map(line => {
            const c = line.split(',');
            // ID, ジャンル, テーマ, UI表示タイトル, 概要, 本文
            return { id: c[0], genre: c[1], theme: c[2], title: c[3], summary: c[4], body: c[5] };
        });
    } catch (e) { console.error("Talk CSV Error", e); }
}

function renderFixedButtons() {
    const fixedItems = masterData.filter(d => d.flag === 'FIX').slice(0, 10);
    grid.innerHTML = "";
    fixedItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'music-btn';
        btn.innerText = item.title;
        btn.onclick = () => playFix(item.url);
        grid.appendChild(btn);
    });
}

function playFix(url) {
    currentUrl = url;
    telop.style.display = 'none';
    let id = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url;
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
}

function initUI() {
    document.getElementById('mode-toggle').onclick = () => {
        const isTheater = document.body.classList.toggle('theater-mode');
        document.getElementById('mode-toggle').innerText = isTheater ? "戻る" : "シアター";
    };
    
    document.getElementById('btn-signal-song').onclick = () => {
        const signal = masterData.find(d => d.flag === 'SIGNAL');
        if (signal) playFix(signal.url);
    };

    document.getElementById('btn-open-menu').onclick = openMusicMenu;
    document.getElementById('btn-open-talk').onclick = openTalkMenu;
    document.getElementById('menu-back').onclick = () => menuLayer.style.display = 'none';

    // 再生操作
    document.getElementById('ctrl-play').onclick = () => iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    document.getElementById('ctrl-pause').onclick = () => iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    document.getElementById('ctrl-reset').onclick = () => { if(currentUrl) playFix(currentUrl); };
}

// --- 選曲メニュー ---
function openMusicMenu() {
    menuLayer.style.display = 'flex';
    const genres = { 'E':'演歌', 'F':'フォーク', 'J':'歌謡曲', 'W':'洋楽', 'I':'インスト', 'S':'旅情・映像' };
    menuContent.innerHTML = "";
    Object.keys(genres).forEach(f => {
        const artists = [...new Set(masterData.filter(d => d.flag === f).map(d => d.artist))];
        if(!artists.length) return;
        const lbl = document.createElement('div'); lbl.className="genre-label"; lbl.innerText=genres[f];
        menuContent.appendChild(lbl);
        artists.forEach(a => {
            const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🎤 " + a;
            div.onclick = () => {
                menuContent.innerHTML = `<div class="genre-label">${a}</div>`;
                masterData.filter(d => d.artist === a).forEach(d => {
                    const s = document.createElement('div'); s.className = "menu-item"; s.innerText = d.title;
                    s.onclick = () => playFix(d.url);
                    menuContent.appendChild(s);
                });
                addBackButton(openMusicMenu);
            };
            menuContent.appendChild(div);
        });
    });
}

// --- お酒の物語メニュー ---
function openTalkMenu() {
    menuLayer.style.display = 'flex';
    menuContent.innerHTML = '<div class="genre-label">お酒のジャンル</div>';
    const genres = [...new Set(talkData.map(d => d.genre))];
    genres.forEach(g => {
        const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🥃 " + g;
        div.onclick = () => openTalkThemes(g);
        menuContent.appendChild(div);
    });
}

function openTalkThemes(genre) {
    menuContent.innerHTML = `<div class="genre-label">${genre} - テーマ</div>`;
    const themes = [...new Set(talkData.filter(d => d.genre === genre).map(d => d.theme))];
    themes.forEach(t => {
        const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🏷️ " + t;
        div.onclick = () => openTalkTitles(genre, t);
        menuContent.appendChild(div);
    });
    addBackButton(openTalkMenu);
}

function openTalkTitles(genre, theme) {
    menuContent.innerHTML = `<div class="genre-label">${theme}</div>`;
    talkData.filter(d => d.genre === genre && d.theme === theme).forEach(d => {
        const div = document.createElement('div'); div.className="menu-item"; div.innerText = d.title;
        div.onclick = () => {
            telop.innerText = d.body;
            telop.style.display = 'block';
            telop.scrollTop = 0;
            // 必要に応じて左下のチャット欄にも反映可能
        };
        menuContent.appendChild(div);
    });
    addBackButton(() => openTalkThemes(genre));
}

function addBackButton(targetFunc) {
    const b = document.createElement('div'); b.className="back-btn"; b.innerText="← 戻る";
    b.onclick = targetFunc;
    menuContent.prepend(b);
}
