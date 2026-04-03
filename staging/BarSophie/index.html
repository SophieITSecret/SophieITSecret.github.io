/**
 * Bar Sophie PC版 v14.14 (v14.7 HTML専用)
 * 修正内容：HTML側の ID (yt-iframe, fixed-buttons-grid, menu-content等) に完全対応
 */

const sophieVoice = new Audio();
const BGM_VOLUME_NORMAL = 0.2;
const BGM_VOLUME_DUCKING = 0.05;

// CSVデータの保持用
let jboxData = [];
let storyData = [];

window.onload = async function() {
    console.log("🍷 Bar Sophie v14.7 起動...");
    await loadAllCsvData();
    setupEventListeners();
};

// --- 1. 高精度CSVパース ---
function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else cur += char;
    }
    result.push(cur.trim());
    return result.map(val => val.replace(/^"|"$/g, ''));
}

// --- 2. データ読み込み ---
async function loadAllCsvData() {
    try {
        // 音楽メニュー
        const jboxRes = await fetch('data/JBoxメニュー.csv');
        const jboxText = await jboxRes.text();
        const jboxLines = jboxText.split(/\r?\n/).filter(l => l.trim() !== '');
        jboxData = jboxLines.slice(1).map(line => parseCsvLine(line));

        // お酒の物語
        const storyRes = await fetch('data/お酒の話.csv');
        const storyText = await storyRes.text();
        const storyLines = storyText.split(/\r?\n/).filter(l => l.trim() !== '');
        storyData = storyLines.slice(1).map(line => parseCsvLine(line));

        // 最初の画面（FIXボタン）を描画
        renderFixedButtons();
        console.log("✅ データ読み込み完了");
    } catch (err) {
        console.error("❌ CSV読み込み失敗:", err);
    }
}

// --- 3. メニュー描画ロジック ---

// [FIXボタン] 上部のグリッドに表示
function renderFixedButtons() {
    const grid = document.getElementById('fixed-buttons-grid');
    if (!grid) return;
    grid.innerHTML = '';

    jboxData.filter(d => d[0] === 'FIX').forEach(cols => {
        const [flag, code, singer, title, url] = cols;
        const btn = document.createElement('button');
        btn.className = 'jbox-button'; // CSSに合わせる
        btn.innerHTML = `<span class="singer">${singer}</span><br><span class="title">${title}</span>`;
        btn.onclick = () => playMusic(url);
        grid.appendChild(btn);
    });
}

// [動的メニュー] 選曲リクエスト または お酒の物語
function renderDynamicMenu(type) {
    const container = document.getElementById('menu-content');
    const layer = document.getElementById('menu-layer');
    if (!container || !layer) return;

    container.innerHTML = '';
    layer.style.display = 'block'; // メニュー層を表示

    if (type === 'music') {
        jboxData.filter(d => d[0] !== 'FIX' && d[0] !== 'SIGNAL').forEach(cols => {
            const [flag, code, singer, title, url] = cols;
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn'; // スタイルに合わせて調整
            btn.innerText = `${singer} - ${title}`;
            btn.onclick = () => playMusic(url);
            container.appendChild(btn);
        });
    } else {
        storyData.forEach(cols => {
            const [id, title, genre, body] = cols;
            const btn = document.createElement('button');
            btn.className = 'menu-item-btn';
            btn.innerText = title;
            btn.onclick = () => playSophieStory(id, title, body);
            container.appendChild(btn);
        });
    }
}

// --- 4. 再生コントロール ---

function playMusic(urlOrId) {
    let videoId = urlOrId;
    if (urlOrId.includes('v=')) videoId = urlOrId.split('v=')[1].split('&')[0];
    else if (urlOrId.includes('youtu.be/')) videoId = urlOrId.split('youtu.be/')[1].split('?')[0];

    const iframe = document.getElementById('yt-iframe'); // HTMLに準拠
    if (iframe) {
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&enablejsapi=1`;
        console.log("🎬 YouTube再生:", videoId);
    }
}

function playSophieStory(id, title, text) {
    sophieVoice.pause();
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${new Date().getTime()}`;

    // ダッキング (iframeへ命令)
    const iframe = document.getElementById('yt-iframe');
    iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');

    sophieVoice.play().then(() => {
        const display = document.getElementById('sophie-speech-text'); // HTMLに準拠
        if (display) {
            display.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
        }
    }).catch(e => console.warn("音声再生待ち...", e));

    sophieVoice.onended = () => {
        iframe?.contentWindow?.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
    };
}

// --- 5. イベントリスナー設定 ---
function setupEventListeners() {
    // 選曲リクエストボタン
    document.getElementById('btn-open-menu')?.addEventListener('click', () => renderDynamicMenu('music'));
    
    // お酒の物語ボタン
    document.getElementById('btn-open-talk')?.addEventListener('click', () => renderDynamicMenu('story'));
    
    // 戻るボタン
    document.getElementById('menu-back')?.addEventListener('click', () => {
        document.getElementById('menu-layer').style.display = 'none';
    });

    // ⏹ 停止ボタン
    document.getElementById('ctrl-stop-speech')?.addEventListener('click', () => {
        sophieVoice.pause();
        const iframe = document.getElementById('yt-iframe');
        iframe?.contentWindow?.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    });

    // シグナル曲ボタン
    document.getElementById('btn-signal-song')?.addEventListener('click', () => {
        const signal = jboxData.find(d => d[0] === 'SIGNAL');
        if (signal) playMusic(signal[4]);
    });
}
