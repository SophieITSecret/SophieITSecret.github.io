/**
 * Bar Sophie PC版 v14.18 (Anti-Chaos Edition)
 * 【修正内容】
 * 1. ボタン生成前に「強制全消去」を行い、増殖を完全に阻止
 * 2. CSVの空行や不備データを無視するガード機能を強化
 * 3. HTML v14.7 の ID (fixed-buttons-grid, menu-content) に完全適合
 */

// --- プレイヤー設定 ---
const sophieVoice = new Audio();

let jboxData = [];
let storyData = [];

// [起動] 
(async function initBar() {
    console.log("🛡️ Bar Sophie 防衛プログラム始動...");
    await loadCSV();
    setupUI();
})();

// --- 高精度CSVパース ---
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

async function loadCSV() {
    try {
        const jRes = await fetch('data/JBoxメニュー.csv');
        const jText = await jRes.text();
        // 空行を除去してパース
        jboxData = jText.split(/\r?\n/).filter(l => l.trim().length > 10).slice(1).map(parseCsv);

        const sRes = await fetch('data/お酒の話.csv');
        const sText = await sRes.text();
        storyData = sText.split(/\r?\n/).filter(l => l.trim().length > 10).slice(1).map(parseCsv);

        renderFixGrid(); // 最初の10ボタンを描画
    } catch (e) {
        console.error("❌ データロード失敗:", e);
    }
}

// --- 画面描画（増殖阻止機能付き） ---

function renderFixGrid() {
    const grid = document.getElementById('fixed-buttons-grid');
    if (!grid) return;
    
    // 【最重要】既存のボタンを全て物理的に削除する
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    jboxData.filter(d => d[0] === 'FIX').forEach(cols => {
        if (!cols[3]) return; // タイトルがなければ作らない
        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${cols[2]}</span><br><span class="title">${cols[3]}</span>`;
        btn.onclick = () => playMusic(cols[4]);
        grid.appendChild(btn);
    });
}

function openMenu(type) {
    const content = document.getElementById('menu-content');
    const layer = document.getElementById('menu-layer');
    if (!content || !layer) return;

    // 【最重要】中身を完全に空にしてから作る
    content.innerHTML = '';
    layer.style.display = 'block';

    if (type === 'music') {
        jboxData.filter(d => d[0] !== 'FIX' && d[0] !== 'SIGNAL').forEach(cols => {
            if (!cols[3]) return;
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = `${cols[2]} - ${cols[3]}`;
            btn.onclick = () => playMusic(cols[4]);
            content.appendChild(btn);
        });
    } else {
        storyData.forEach(cols => {
            if (!cols[1]) return;
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = cols[1];
            btn.onclick = () => playSophieVoice(cols[0], cols[1], cols[3]);
            content.appendChild(btn);
        });
    }
}

// --- 再生系 ---

function playMusic(idOrUrl) {
    let vid = idOrUrl;
    if (idOrUrl.includes('v=')) vid = idOrUrl.split('v=')[1].split('&')[0];
    else if (idOrUrl.includes('youtu.be/')) vid = idOrUrl.split('youtu.be/')[1].split('?')[0];

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
        const speech = document.getElementById('sophie-speech-text');
        if (speech) {
            speech.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
        }
    }).catch(e => console.warn("音声ロード中..."));

    sophieVoice.onended = () => {
        iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

// --- イベント設定 ---
function setupUI() {
    document.getElementById('btn-open-menu')?.addEventListener('click', () => openMenu('music'));
    document.getElementById('btn-open-talk')?.addEventListener('click', () => openMenu('story'));
    document.getElementById('menu-back')?.addEventListener('click', () => {
        const layer = document.getElementById('menu-layer');
        if (layer) layer.style.display = 'none';
    });
    document.getElementById('ctrl-stop-speech')?.addEventListener('click', () => {
        sophieVoice.pause();
        const iframe = document.getElementById('yt-iframe');
        iframe?.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    });
    document.getElementById('btn-signal-song')?.addEventListener('click', () => {
        const sig = jboxData.find(d => d[0] === 'SIGNAL');
        if (sig) playMusic(sig[4]);
    });
}
