/**
 * Bar Sophie PC版 v14.17 (Final Stability)
 * HTML v14.7 構造に100%完全適合
 */

// --- プレイヤー設定 ---
const sophieVoice = new Audio();
const BGM_VOL_NORMAL = 0.2;
const BGM_VOL_DUCKING = 0.05;

let jboxData = [];
let storyData = [];

// [起動] ページが読み込まれたら開始
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🍷 Bar Sophie プロトコル始動...");
    await loadDatabase();
    initUI();
});

// --- CSVパース（引用符内のカンマも正しく処理） ---
function parseCsvLine(line) {
    const result = [];
    let cur = '', inQuotes = false;
    for (let char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
        else cur += char;
    }
    result.push(cur.trim());
    return result.map(v => v.replace(/^"|"$/g, ''));
}

async function loadDatabase() {
    try {
        // 音楽データ
        const jRes = await fetch('data/JBoxメニュー.csv');
        const jText = await jRes.text();
        jboxData = jText.split(/\r?\n/).filter(l => l.trim()).slice(1).map(parseCsvLine);

        // 物語データ
        const sRes = await fetch('data/お酒の話.csv');
        const sText = await sRes.text();
        storyData = sText.split(/\r?\n/).filter(l => l.trim()).slice(1).map(parseCsvLine);

        renderFixGrid(); // 上部の常設10ボタンを表示
    } catch (e) {
        console.error("❌ CSVロードエラー:", e);
    }
}

// --- 画面描画（IDに忠実に！） ---

// 1. 上部の固定10ボタン (FIX)
function renderFixGrid() {
    const grid = document.getElementById('fixed-buttons-grid');
    if (!grid) return;
    grid.innerHTML = ''; // 一旦空にする

    jboxData.filter(d => d[0] === 'FIX').forEach(cols => {
        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${cols[2]}</span><br><span class="title">${cols[3]}</span>`;
        btn.onclick = () => playMusic(cols[4]);
        grid.appendChild(btn);
    });
}

// 2. 選曲リクエスト or お酒の物語 (動的メニュー)
function openSubMenu(type) {
    const content = document.getElementById('menu-content');
    const layer = document.getElementById('menu-layer');
    if (!content || !layer) return;

    content.innerHTML = ''; // 以前のボタンを消去（これで増殖を防ぐ！）
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
            btn.onclick = () => playSophieVoice(cols[0], cols[1], cols[3]); // ID, タイトル, 本文
            content.appendChild(btn);
        });
    }
}

// --- 再生ロジック ---

function playMusic(idOrUrl) {
    let vid = idOrUrl;
    // URLから動画IDを抽出
    if (idOrUrl.includes('v=')) vid = idOrUrl.split('v=')[1].split('&')[0];
    else if (idOrUrl.includes('youtu.be/')) vid = idOrUrl.split('youtu.be/')[1].split('?')[0];

    const iframe = document.getElementById('yt-iframe');
    if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
        console.log("🎬 YouTube再生:", vid);
    }
}

function playSophieVoice(id, title, text) {
    sophieVoice.pause();
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${Date.now()}`;
    
    // YouTube音量を下げる（ダッキング）
    const iframe = document.getElementById('yt-iframe');
    iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    sophieVoice.play().then(() => {
        // テキストをご主人様の指定ID「sophie-speech-text」へ
        const speech = document.getElementById('sophie-speech-text');
        if (speech) {
            speech.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
        }
    }).catch(e => console.warn("音声再生待機...", e));

    sophieVoice.onended = () => {
        // 音量を戻す
        iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

// --- UIイベント設定 ---
function initUI() {
    // 選曲リクエスト
    document.getElementById('btn-open-menu')?.addEventListener('click', () => openSubMenu('music'));
    // お酒の物語
    document.getElementById('btn-open-talk')?.addEventListener('click', () => openSubMenu('story'));
    // 戻る
    document.getElementById('menu-back')?.addEventListener('click', () => {
        const layer = document.getElementById('menu-layer');
        if (layer) layer.style.display = 'none';
    });
    // ⏹ 停止
    document.getElementById('ctrl-stop-speech')?.addEventListener('click', () => {
        sophieVoice.pause();
        const iframe = document.getElementById('yt-iframe');
        iframe?.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    });
    // シグナル曲
    document.getElementById('btn-signal-song')?.addEventListener('click', () => {
        const sig = jboxData.find(d => d[0] === 'SIGNAL');
        if (sig) playMusic(sig[4]);
    });
}
