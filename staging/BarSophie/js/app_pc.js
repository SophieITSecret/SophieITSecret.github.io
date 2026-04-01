let masterData = [];
let currentUrl = "";

const iframe = document.getElementById('yt-iframe');
const grid = document.getElementById('fixed-buttons-grid');
const menuLayer = document.getElementById('menu-layer');
const menuContent = document.getElementById('menu-content');

document.addEventListener('DOMContentLoaded', () => {
    loadCSV();
    initUI();
});

async function loadCSV() {
    try {
        const res = await fetch(`JBoxメニュー.csv?v=${new Date().getTime()}`);
        const text = await res.text();
        const lines = text.split('\n').slice(1);
        masterData = lines.filter(l => l.trim()).map(line => {
            const c = line.split(',');
            // Flag, ID, Artist, Title, URL
            return { flag: c[0].trim(), artist: c[2].trim(), title: c[3].replace(/"/g,'').trim(), url: c[4].trim() };
        });
        renderFixedButtons();
        setupSignalSong();
    } catch (e) { console.error("CSV Load Error", e); }
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

function setupSignalSong() {
    const signalItem = masterData.find(d => d.flag === 'SIGNAL');
    const signalBtn = document.getElementById('btn-signal-song');
    if (signalItem && signalBtn) {
        signalBtn.onclick = () => playFix(signalItem.url);
    }
}

function playFix(url) {
    currentUrl = url;
    let id = "";
    if (url.includes('v=')) {
        id = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
        id = url.split('youtu.be/')[1].split('?')[0];
    } else {
        id = url;
    }
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
}

function initUI() {
    document.getElementById('mode-toggle').onclick = () => {
        const isTheater = document.body.classList.toggle('theater-mode');
        document.getElementById('mode-toggle').innerText = isTheater ? "戻る" : "シアター";
    };
    
    document.getElementById('btn-open-menu').onclick = openMenu;
    document.getElementById('btn-open-talk').onclick = openTalkMenu; // Talkメニュー追加
    document.getElementById('menu-back').onclick = () => menuLayer.style.display = 'none';

    document.getElementById('ctrl-play').onclick = () => iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    document.getElementById('ctrl-pause').onclick = () => iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    document.getElementById('ctrl-reset').onclick = () => { if(currentUrl) playFix(currentUrl); };
    document.getElementById('ctrl-next').onclick = () => moveSong(1);
    document.getElementById('ctrl-prev').onclick = () => moveSong(-1);
}

function moveSong(dir) {
    const fixedItems = masterData.filter(d => d.flag === 'FIX');
    let idx = fixedItems.findIndex(d => d.url === currentUrl);
    if (idx !== -1) {
        idx = (idx + dir + fixedItems.length) % fixedItems.length;
        playFix(fixedItems[idx].url);
    }
}

function openMenu() {
    menuLayer.style.display = 'flex';
    const genres = { 'E':'演歌', 'F':'フォーク', 'J':'歌謡曲', 'W':'洋楽', 'I':'インスト', 'S':'旅情・映像' };
    renderGenreList(genres, masterData);
}

function openTalkMenu() {
    // お酒の物語（仮実装：ジャンルを Talk 等に分けている場合のフィルター）
    // 現状は全リストを表示するか、専用のCSVフラグで分ける運用を推奨
    alert("お酒の物語メニューを表示します（データ連携準備中）");
}

function renderGenreList(genres, data) {
    menuContent.innerHTML = "";
    Object.keys(genres).forEach(f => {
        const artists = [...new Set(data.filter(d => d.flag === f).map(d => d.artist))];
        if(!artists.length) return;
        const lbl = document.createElement('div'); lbl.className="genre-label"; lbl.innerText=genres[f];
        menuContent.appendChild(lbl);
        artists.forEach(a => {
            const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🎤 " + a;
            div.onclick = () => renderTitles(a, f, data);
            menuContent.appendChild(div);
        });
    });
}

function renderTitles(artist, flag, data) {
    menuContent.innerHTML = `<div class="genre-label">${artist}</div>`;
    data.filter(d => d.artist === artist).forEach(d => {
        const div = document.createElement('div'); div.className = "menu-item"; div.innerText = d.title;
        div.onclick = () => playFix(d.url);
        menuContent.appendChild(div);
    });
    const back = document.createElement('div'); back.className="back-btn"; back.innerText="← 歌手一覧へ";
    back.onclick = () => renderGenreList({ 'E':'演歌', 'F':'フォーク', 'J':'歌謡曲', 'W':'洋楽', 'I':'インスト', 'S':'旅情・映像' }, data);
    menuContent.prepend(back);
}
