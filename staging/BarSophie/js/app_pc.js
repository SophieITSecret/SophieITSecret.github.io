/**
 * Bar Sophie PC版 v14.19 (Order Restored Edition)
 * 【修正内容】
 * 1. メニュー層(menu-layer)を初期状態で確実に非表示にする
 * 2. 大量のボタンを「スクロール」対応にし、レイアウト崩れを防止
 * 3. 二重起動を防止し、ボタンの増殖を根絶
 */

const sophieVoice = new Audio();
const BGM_VOL_NORMAL = 0.2;
const BGM_VOL_DUCKING = 0.05;

let jboxData = [];
let storyData = [];

// ページ読み込み完了時に一度だけ実行
window.addEventListener('load', async () => {
    console.log("🕯️ Bar Sophie 秩序回復プロトコル開始...");
    
    // 最初はメニュー層を隠しておく
    const layer = document.getElementById('menu-layer');
    if (layer) layer.style.display = 'none';

    await loadBarDatabase();
    setupController();
});

// --- CSVパース ---
function parseCsv(line) {
    const res = [];
    let cur = '', inQ = false;
    for (let c of line) {
        if (c === '"') inQ = !inQ;
        else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
        else cur += c;
    }
    res.push(cur.trim());
    return res.map(v => v.replace(/^"|"$/g, ''));
}

async function loadBarDatabase() {
    try {
        const jRes = await fetch('data/JBoxメニュー.csv');
        const jText = await jRes.text();
        jboxData = jText.split(/\r?\n/).filter(l => l.length > 20).slice(1).map(parseCsv);

        const sRes = await fetch('data/お酒の話.csv');
        const sText = await sRes.text();
        storyData = sText.split(/\r?\n/).filter(l => l.length > 20).slice(1).map(parseCsv);

        renderTopFixGrid();
    } catch (e) {
        console.error("データロード失敗:", e);
    }
}

// --- 描画（整理整頓） ---

function renderTopFixGrid() {
    const grid = document.getElementById('fixed-buttons-grid');
    if (!grid) return;
    grid.innerHTML = ''; // 清掃

    jboxData.filter(d => d[0] === 'FIX').slice(0, 10).forEach(cols => {
        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${cols[2]}</span><br><span class="title">${cols[3]}</span>`;
        btn.onclick = () => playYouTube(cols[4]);
        grid.appendChild(btn);
    });
}

function openDynamicMenu(mode) {
    const content = document.getElementById('menu-content');
    const layer = document.getElementById('menu-layer');
    if (!content || !layer) return;

    content.innerHTML = ''; // 前のを消す
    layer.style.display = 'block'; // 表示
    
    // レイアウト崩れ防止：スクロールを有効にする
    content.style.overflowY = 'auto';
    content.style.maxHeight = '70vh'; 

    if (mode === 'music') {
        jboxData.filter(d => d[0] !== 'FIX' && d[0] !== 'SIGNAL').forEach(cols => {
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = `${cols[2]} - ${cols[3]}`;
            btn.onclick = () => playYouTube(cols[4]);
            content.appendChild(btn);
        });
    } else {
        storyData.forEach(cols => {
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = cols[1];
            btn.onclick = () => playSophieVoice(cols[0], cols[1], cols[3]);
            content.appendChild(btn);
        });
    }
}

// --- 再生 ---

function playYouTube(idOrUrl) {
    let vid = idOrUrl;
    const match = idOrUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    if (match) vid = match[1];

    const iframe = document.getElementById('yt-iframe');
    if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${vid}?autoplay=1&enablejsapi=1`;
    }
}

function playSophieVoice(id, title, text) {
    sophieVoice.pause();
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${Date.now()}`;
    
    const iframe = document.getElementById('yt-iframe');
    iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    sophieVoice.play().then(() => {
        const display = document.getElementById('sophie-speech-text');
        if (display) {
            display.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
        }
    });

    sophieVoice.onended = () => {
        iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

// --- コントローラー設定 ---
function setupController() {
    document.getElementById('btn-open-menu')?.addEventListener('click', () => openDynamicMenu('music'));
    document.getElementById('btn-open-talk')?.addEventListener('click', () => openDynamicMenu('story'));
    document.getElementById('menu-back')?.addEventListener('click', () => {
        document.getElementById('menu-layer').style.display = 'none';
    });
    document.getElementById('ctrl-stop-speech')?.addEventListener('click', () => {
        sophieVoice.pause();
        const iframe = document.getElementById('yt-iframe');
        iframe?.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    });
    document.getElementById('btn-signal-song')?.addEventListener('click', () => {
        const sig = jboxData.find(d => d[0] === 'SIGNAL');
        if (sig) playYouTube(sig[4]);
    });
}
