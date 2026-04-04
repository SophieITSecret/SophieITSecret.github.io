/**
 * Bar Sophie PC版 v14.21 (Mat-chan & Claude Collaboration)
 * ベース: 安定版 v14.7
 * 変更点: startTalk/stopTalkをMP3(voices_mp3)対応にアップデート
 */

// --- 1. グローバル設定 ---
const sophieVoice = new Audio(); // ソフィーの声用プレイヤー
const BGM_VOL_NORMAL = 0.2;
const BGM_VOL_DUCKING = 0.05;

// クロード君の指摘通り、パスはルート(直下)を指定
const CSV_JBOX = 'JBoxメニュー.csv';
const CSV_STORY = 'お酒の話.csv';

let jboxData = [];
let storyData = [];

// --- 2. 起動処理 ---
window.onload = async function() {
    console.log("🍷 Bar Sophie v14.21 起動 (復旧モード)");
    await loadDatabase();
    initEventListeners();
};

async function loadDatabase() {
    try {
        // CSV読み込み（パスを修正済み）
        const jRes = await fetch(CSV_JBOX);
        const jText = await jRes.text();
        jboxData = parseCsvData(jText);

        const sRes = await fetch(CSV_STORY);
        const sText = await sRes.text();
        storyData = parseCsvData(sText);

        // 黄金の10個ボタン（FIX）を表示
        renderFixGrid();
    } catch (e) {
        console.error("❌ CSVの読み込みに失敗しました:", e);
    }
}

// --- 3. 音声物語の再生（ここをクロード案で強化！） ---
function startTalk(id, title, body) {
    stopTalk(); // 二重再生防止

    // BGMの音量を下げる（ダッキング）
    const iframe = document.getElementById('yt-iframe');
    iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    // テキスト表示
    const speechArea = document.getElementById('sophie-speech-text');
    if (speechArea) {
        speechArea.innerHTML = `<strong>【${title}】</strong><br>${body.replace(/\n/g, '<br>')}`;
    }

    // MP3再生（voices_mp3フォルダからID指定）
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${Date.now()}`;
    sophieVoice.play().catch(err => {
        console.warn(`🔊 音声ファイルが見つかりません: voices_mp3/${id}.mp3`);
    });

    // 再生が終わったらBGMを元に戻す
    sophieVoice.onended = () => {
        iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

function stopTalk() {
    sophieVoice.pause();
    sophieVoice.currentTime = 0;
    const speechArea = document.getElementById('sophie-speech-text');
    if (speechArea) speechArea.innerHTML = "";
    
    // BGM音量を元に戻す
    const iframe = document.getElementById('yt-iframe');
    iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
}

// --- 4. YouTube再生 ---
function playMusic(urlOrId) {
    let vid = urlOrId;
    if (urlOrId.includes('v=')) vid = urlOrId.split('v=')[1].split('&')[0];
    else if (urlOrId.includes('youtu.be/')) vid = urlOrId.split('youtu.be/')[1].split('?')[0];

    const iframe = document.getElementById('yt-iframe');
    if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    }
}

// --- 以下、v14.7の様式美を守る描画ロジック ---

function renderFixGrid() {
    const grid = document.getElementById('fixed-buttons-grid');
    if (!grid) return;
    grid.innerHTML = '';
    jboxData.filter(d => d[0] === 'FIX').slice(0, 10).forEach(cols => {
        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${cols[2]}</span><br><span class="title">${cols[3]}</span>`;
        btn.onclick = () => playMusic(cols[4]);
        grid.appendChild(btn);
    });
}

function openSubMenu(type) {
    const content = document.getElementById('menu-content');
    const layer = document.getElementById('menu-layer');
    if (!content || !layer) return;

    content.innerHTML = '';
    layer.style.display = 'block';

    if (type === 'music') {
        jboxData.filter(d => d[0] !== 'FIX' && d[0] !== 'SIGNAL').forEach(cols => {
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = `${cols[2]} - ${cols[3]}`;
            btn.onclick = () => playMusic(cols[4]);
            content.appendChild(btn);
        });
    } else {
        storyData.forEach(cols => {
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = cols[1]; // タイトル
            btn.onclick = () => startTalk(cols[0], cols[1], cols[3]); // ID, タイトル, 本文
            content.appendChild(btn);
        });
    }
}

function initEventListeners() {
    document.getElementById('btn-open-menu')?.addEventListener('click', () => openSubMenu('music'));
    document.getElementById('btn-open-talk')?.addEventListener('click', () => openSubMenu('story'));
    document.getElementById('menu-back')?.addEventListener('click', () => {
        document.getElementById('menu-layer').style.display = 'none';
    });
    document.getElementById('ctrl-stop-speech')?.addEventListener('click', stopTalk);
    document.getElementById('btn-signal-song')?.addEventListener('click', () => {
        const sig = jboxData.find(d => d[0] === 'SIGNAL');
        if (sig) playMusic(sig[4]);
    });
}

function parseCsvData(text) {
    return text.split(/\r?\n/).filter(l => l.trim().length > 5).map(line => {
        const res = [];
        let cur = '', inQ = false;
        for (let c of line) {
            if (c === '"') inQ = !inQ;
            else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
            else cur += c;
        }
        res.push(cur.trim());
        return res.map(v => v.replace(/^"|"$/g, ''));
    });
}
