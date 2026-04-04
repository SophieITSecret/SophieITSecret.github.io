// ==========================================
// Bar Sophie PC版 app_pc.js v14.26
// 修正内容：歌手一覧(2列)と他メニュー(1列)の動的分離、音声再生の堅牢化
// ==========================================

let masterData = [];
let talkData = [];
let currentUrl = "";

const sophieVoice = new Audio();
const iframe = document.getElementById('yt-iframe');
const monitorImg = document.getElementById('monitor-image-overlay');
const speechArea = document.getElementById('sophie-speech-text');
const menuLayer = document.getElementById('menu-layer');
const menuContent = document.getElementById('menu-content');
const menuBack = document.getElementById('menu-back');

document.addEventListener('DOMContentLoaded', () => {
    loadMusicCSV();
    loadTalkCSV();
    initUI();
});

async function loadMusicCSV() {
    const res = await fetch(`JBoxメニュー.csv?v=${Date.now()}`);
    const text = await res.text();
    const lines = text.split('\n').slice(1);
    masterData = lines.filter(l => l.trim()).map(line => {
        const c = line.split(',');
        return { flag: c[0].trim(), artist: c[2].trim(), title: c[3].replace(/"/g,'').trim(), url: c[4].trim() };
    });
    renderFixedButtons();
}

async function loadTalkCSV() {
    const res = await fetch(`お酒の話.csv?v=${Date.now()}`);
    const text = await res.text();
    const lines = text.split('\n').slice(1);
    talkData = lines.filter(l => l.trim()).map(line => {
        const c = line.split(',');
        return { id: c[0].trim(), genre: c[1], theme: c[2], title: c[3], body: c[5] };
    });
}

function renderFixedButtons() {
    const fixedItems = masterData.filter(d => d.flag === 'FIX').slice(0, 10);
    const grid = document.getElementById('fixed-buttons-grid');
    grid.innerHTML = "";
    fixedItems.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'music-btn';
        btn.innerText = item.title;
        btn.onclick = () => { stopTalk(); playFix(item.url); };
        grid.appendChild(btn);
    });
}

function playFix(url, showOverlay = false) {
    currentUrl = url;
    monitorImg.style.display = showOverlay ? 'block' : 'none';
    let id = url.includes('v=') ? url.split('v=')[1].split('&')[0] : url;
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
}

function initUI() {
    document.getElementById('mode-toggle').onclick = () => {
        const isTheater = document.body.classList.toggle('theater-mode');
        document.getElementById('mode-toggle').innerText = isTheater ? "戻る" : "シアター";
    };
    document.getElementById('btn-signal-song').onclick = () => {
        stopTalk();
        const signal = masterData.find(d => d.flag === 'SIGNAL');
        if (signal) playFix(signal.url);
    };
    document.getElementById('btn-open-menu').onclick = openMusicMenu;
    document.getElementById('btn-open-talk').onclick = openTalkMenu;
    document.getElementById('ctrl-stop-speech').onclick = stopTalk;
    document.getElementById('ctrl-play').onclick = () => iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    document.getElementById('ctrl-pause').onclick = () => iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    document.getElementById('ctrl-reset').onclick = () => { if(currentUrl) playFix(currentUrl); };
}

// --- 曲選択：歌手一覧（2カラム） ---
function openMusicMenu() {
    menuLayer.style.display = 'flex';
    menuContent.classList.remove('single-col'); // 2カラムに戻す
    menuBack.innerText = "← ソフィーと話す (閉じる)";
    menuBack.onclick = () => menuLayer.style.display = 'none';
    
    const genres = { 'E':'演歌', 'F':'フォーク', 'J':'歌謡曲', 'W':'洋楽', 'I':'インスト', 'S':'旅情・映像' };
    menuContent.innerHTML = "";
    Object.keys(genres).forEach(f => {
        const artists = [...new Set(masterData.filter(d => d.flag === f).map(d => d.artist))];
        if(!artists.length) return;
        const lbl = document.createElement('div'); lbl.className="genre-label"; lbl.innerText=genres[f];
        menuContent.appendChild(lbl);
        artists.forEach(a => {
            const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🎤 " + a;
            div.onclick = () => renderSongTitles(a);
            menuContent.appendChild(div);
        });
    });
}

// --- 曲選択：曲名一覧（1カラム） ---
function renderSongTitles(artist) {
    menuContent.classList.add('single-col'); // 1カラムに設定
    menuBack.innerText = "← 歌手一覧へ戻る";
    menuBack.onclick = openMusicMenu;
    menuContent.innerHTML = `<div class="genre-label">${artist}</div>`;
    masterData.filter(d => d.artist === artist).forEach(d => {
        const div = document.createElement('div'); div.className = "menu-item"; div.innerText = d.title;
        div.onclick = () => { stopTalk(); playFix(d.url); };
        menuContent.appendChild(div);
    });
}

// --- お酒メニュー（全て1カラム） ---
function openTalkMenu() {
    menuLayer.style.display = 'flex';
    menuContent.classList.add('single-col'); 
    menuBack.innerText = "← ソフィーと話す (閉じる)";
    menuBack.onclick = () => menuLayer.style.display = 'none';
    
    menuContent.innerHTML = '<div class="genre-label">お酒のジャンル</div>';
    const genres = [...new Set(talkData.map(d => d.genre))];
    genres.forEach(g => {
        const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🥃 " + g;
        div.onclick = () => renderTalkThemes(g);
        menuContent.appendChild(div);
    });
}

function renderTalkThemes(genre) {
    menuBack.innerText = `← ジャンル一覧へ`;
    menuBack.onclick = openTalkMenu;
    menuContent.innerHTML = `<div class="genre-label">${genre}（テーマ選択）</div>`;
    const themes = [...new Set(talkData.filter(d => d.genre === genre).map(d => d.theme))];
    themes.forEach(t => {
        const div = document.createElement('div'); div.className = "menu-item"; div.innerText = "◆ " + t;
        div.onclick = () => renderTalkTitles(genre, t);
        menuContent.appendChild(div);
    });
}

function renderTalkTitles(genre, theme) {
    menuBack.innerText = `← ${genre}の一覧へ戻る`;
    menuBack.onclick = () => renderTalkThemes(genre);
    menuContent.innerHTML = `<div class="genre-label">${theme}</div>`;
    talkData.filter(d => d.genre === genre && d.theme === theme).forEach(t => {
        const div = document.createElement('div'); div.className = "menu-item"; div.innerText = t.title;
        div.onclick = () => startTalk(t);
        menuContent.appendChild(div);
    });
}

function startTalk(talkObj) {
    stopTalk(); // 音声と表示の初期化

    // YouTubeダッキング (5%)
    iframe.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    speechArea.innerText = talkObj.body;
    monitorImg.src = "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800";
    monitorImg.style.display = 'block';

    // 音声再生ロジックの堅牢化
    const mp3Path = `voices_mp3/${talkObj.id}.mp3?v=${Date.now()}`;
    sophieVoice.src = mp3Path;
    sophieVoice.load(); // 明示的にロード

    // ロード完了後に再生
    sophieVoice.oncanplaythrough = () => {
        sophieVoice.play().catch(e => {
            console.error("再生失敗:", e);
        });
    };

    sophieVoice.onended = () => {
        iframe.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

function stopTalk() {
    sophieVoice.pause();
    sophieVoice.currentTime = 0;
    // イベントハンドラをクリアして競合を防ぐ
    sophieVoice.oncanplaythrough = null;
    
    speechArea.innerText = "";
    monitorImg.style.display = 'none';
    iframe.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
}
