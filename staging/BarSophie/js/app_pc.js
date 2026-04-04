// ==========================================
// Bar Sophie PC版 app_pc.js v14.23
// 修正内容：BGM強制リセットの除去、MP3キャッシュ回避の統一
// ==========================================

let masterData = [];
let talkData = [];
let currentUrl = "";

// 音声再生用のAudioオブジェクト
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

function openMusicMenu() {
    menuLayer.style.display = 'flex';
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

function renderSongTitles(artist) {
    menuBack.innerText = "← 歌手一覧へ戻る";
    menuBack.onclick = openMusicMenu;
    menuContent.innerHTML = `<div class="genre-label">${artist}</div>`;
    masterData.filter(d => d.artist === artist).forEach(d => {
        const div = document.createElement('div'); div.className = "menu-item"; div.innerText = d.title;
        div.onclick = () => { stopTalk(); playFix(d.url); };
        menuContent.appendChild(div);
    });
}

function openTalkMenu() {
    menuLayer.style.display = 'flex';
    menuBack.innerText = "← ソフィーと話す (閉じる)";
    menuBack.onclick = () => menuLayer.style.display = 'none';
    
    menuContent.innerHTML = '<div class="genre-label">お酒のジャンル</div>';
    const genres = [...new Set(talkData.map(d => d.genre))];
    genres.forEach(g => {
        const div = document.createElement('div'); div.className="menu-item"; div.innerText = "🥃 " + g;
        div.onclick = () => {
            menuBack.innerText = "← ジャンル一覧へ";
            menuBack.onclick = openTalkMenu;
            menuContent.innerHTML = `<div class="genre-label">${g}</div>`;
            talkData.filter(d => d.genre === g).forEach(t => {
                const item = document.createElement('div'); item.className="menu-item"; item.innerText = t.title;
                item.onclick = () => startTalk(t);
                menuContent.appendChild(item);
            });
        };
        menuContent.appendChild(div);
    });
}

function startTalk(talkObj) {
    stopTalk();

    // BGMをダッキング (5%) - 既存のBGMを維持
    iframe.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    // お酒の画像をオーバーレイ表示（画像URLは任意で運用してください）
    monitorImg.src = "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800";
    monitorImg.style.display = 'block';

    // 字幕を表示
    speechArea.innerText = talkObj.body;

    // MP3を再生（キャッシュ回避用タイムスタンプ付与）
    const mp3Path = `voices_mp3/${talkObj.id}.mp3?v=${Date.now()}`;
    sophieVoice.src = mp3Path;
    sophieVoice.play().catch(e => console.warn("MP3再生失敗:", mp3Path));

    // 再生終了後にBGMを復元 (20%)
    sophieVoice.onended = () => {
        iframe.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

function stopTalk() {
    sophieVoice.pause();
    sophieVoice.currentTime = 0;
    speechArea.innerText = "";
    monitorImg.style.display = 'none';
    // BGM音量を復元
    iframe.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
}
