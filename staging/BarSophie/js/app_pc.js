/**
 * Bar Sophie PC版 v14.16 (HTML v14.7 完全適合モデル)
 * 修正点：ID一致確認済み、YouTube解析強化、CSVエラー耐性向上
 */

const sophieVoice = new Audio();
const BGM_VOL_NORMAL = 0.2;
const BGM_VOL_DUCKING = 0.05;

let jboxData = [];
let storyData = [];

window.onload = async function() {
    console.log("🍷 Bar Sophie 起動中...");
    await loadData();
    bindEvents();
};

// --- 高精度CSVパース（引用符内のカンマ・改行対策） ---
function parseCsv(line) {
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

async function loadData() {
    try {
        // [1] 音楽メニュー読み込み
        const jRes = await fetch('data/JBoxメニュー.csv');
        const jText = await jRes.text();
        jboxData = jText.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1).map(parseCsv);

        // [2] お酒の物語読み込み
        const sRes = await fetch('data/お酒の話.csv');
        const sText = await sRes.text();
        storyData = sText.split(/\r?\n/).filter(l => l.trim().length > 0).slice(1).map(parseCsv);

        drawFixButtons();
        console.log("✅ データロード成功");
    } catch (e) {
        console.error("❌ データロード失敗:", e);
    }
}

// --- 画面描画 ---
function drawFixButtons() {
    const grid = document.getElementById('fixed-buttons-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    jboxData.filter(d => d[0] === 'FIX').forEach(cols => {
        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${cols[2]}</span><br><span class="title">${cols[3]}</span>`;
        btn.onclick = () => playMusic(cols[4]);
        grid.appendChild(btn);
    });
}

function showSubMenu(mode) {
    const content = document.getElementById('menu-content');
    const layer = document.getElementById('menu-layer');
    if (!content || !layer) return;

    content.innerHTML = '';
    layer.style.display = 'block';

    if (mode === 'music') {
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
            btn.onclick = () => playVoiceStory(cols[0], cols[1], cols[3]); // ID, タイトル, 本文
            content.appendChild(btn);
        });
    }
}

// --- 再生系 ---
function playMusic(idOrUrl) {
    let vid = idOrUrl;
    // URLから動画IDを抽出する正規表現
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = idOrUrl.match(regExp);
    if (match && match[2].length === 11) vid = match[2];

    const iframe = document.getElementById('yt-iframe');
    if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&controls=0&enablejsapi=1`;
    }
}

function playVoiceStory(id, title, text) {
    sophieVoice.pause();
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${Date.now()}`;
    
    const iframe = document.getElementById('yt-iframe');
    // ダッキング（BGM音量を下げる）
    iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    sophieVoice.play().then(() => {
        const chat = document.getElementById('sophie-speech-text');
        if (chat) chat.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
    }).catch(err => console.warn("音声再生待機中...", err));

    sophieVoice.onended = () => {
        iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

// --- イベント登録 ---
function bindEvents() {
    document.getElementById('btn-open-menu')?.addEventListener('click', () => showSubMenu('music'));
    document.getElementById('btn-open-talk')?.addEventListener('click', () => showSubMenu('story'));
    document.getElementById('menu-back')?.addEventListener('click', () => {
        const layer = document.getElementById('menu-layer');
        if (layer) layer.style.display = 'none';
    });
    
    // ⏹ 停止ボタン
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
