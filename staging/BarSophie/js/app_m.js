/**
 * Bar Sophie PC版 v14.13
 * 目的: メニューが動かない問題を根絶し、強引に起動させる
 */

const sophieVoice = new Audio();

window.onload = async function() {
    console.log("🛠️ [Debug] PC版 起動シーケンス開始...");
    try {
        await loadBarData();
        console.log("🛠️ [Debug] 全データ読み込み完了");
    } catch (e) {
        console.error("🛠️ [Debug] 起動時に致命的なエラー:", e);
    }
};

// --- 高精度CSVパース（エラー耐性強化） ---
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

// --- データ読み込み ---
async function loadBarData() {
    // [1] JBoxメニューの読み込み
    console.log("🛠️ [Debug] JBoxメニューを読み込みます...");
    try {
        const jboxRes = await fetch('data/JBoxメニュー.csv');
        if (!jboxRes.ok) throw new Error("JBoxメニューが見つかりません");
        const jboxText = await jboxRes.text();
        renderJukebox(jboxText);
    } catch (e) {
        console.warn("⚠️ JBox読み込み失敗（スキップします）:", e);
    }

    // [2] お酒の物語の読み込み
    console.log("🛠️ [Debug] お酒の物語を読み込みます...");
    try {
        const storyRes = await fetch('data/お酒の話.csv');
        if (!storyRes.ok) throw new Error("お酒の話が見つかりません");
        const storyText = await storyRes.text();
        renderStories(storyText);
    } catch (e) {
        console.warn("⚠️ お酒の話読み込み失敗（スキップします）:", e);
    }
}

// --- 音楽メニュー表示（徹底的に安全な設計） ---
function renderJukebox(csvData) {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    // HTMLのIDを徹底的に探す
    const fixGrid = document.getElementById('fix-buttons-grid') || document.querySelector('.fix-grid');
    const requestList = document.getElementById('request-list') || document.querySelector('.request-list');
    
    if (fixGrid) fixGrid.innerHTML = '';
    if (requestList) requestList.innerHTML = '';

    lines.slice(1).forEach((line, index) => {
        const cols = parseCsvLine(line);
        if (cols.length < 5) return;
        const [flag, code, singer, title, url] = cols;

        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${singer}</span><br><span class="title">${title}</span>`;
        
        btn.onclick = () => {
            console.log(`🎵 ボタンクリック成功: ${title}`);
            playMusic(url);
        };

        if (flag === 'FIX' && fixGrid) fixGrid.appendChild(btn);
        else if (flag !== 'SIGNAL' && requestList) requestList.appendChild(btn);
    });
}

// --- お酒の物語表示 ---
function renderStories(csvData) {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    const storyList = document.getElementById('story-list') || document.querySelector('.story-list');
    if (storyList) storyList.innerHTML = '';

    lines.slice(1).forEach(line => {
        const cols = parseCsvLine(line);
        if (cols.length < 4) return;
        const [id, title, genre, body] = cols;

        const btn = document.createElement('button');
        btn.className = 'story-button';
        btn.innerText = title;
        btn.onclick = () => {
            console.log(`🎙️ 物語クリック成功: ${title}`);
            playSophieStory(id, title, body);
        };
        if (storyList) storyList.appendChild(btn);
    });
}

// --- 🎬 YouTubeモニター制御 ---
function playMusic(urlOrId) {
    let videoId = urlOrId;
    if (urlOrId.includes('v=')) videoId = urlOrId.split('v=')[1].split('&')[0];
    else if (urlOrId.includes('youtu.be/')) videoId = urlOrId.split('youtu.be/')[1].split('?')[0];

    const monitor = document.getElementById('main-monitor-iframe') || 
                    document.getElementById('player') || 
                    document.querySelector('iframe');

    if (monitor) {
        monitor.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&enablejsapi=1`;
        console.log("✅ YouTubeをモニターに設定しました:", videoId);
    } else {
        console.error("❌ [Fatal] YouTubeを表示する iframe が見つかりません。");
    }
}

// --- 🎙️ ソフィー音声再生 ---
function playSophieStory(id, title, text) {
    sophieVoice.pause();
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${new Date().getTime()}`;

    const monitor = document.querySelector('iframe');
    if (monitor?.contentWindow) {
        monitor.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');
    }

    sophieVoice.play().then(() => {
        const chat = document.getElementById('sophie-chat');
        if (chat) {
            chat.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
            chat.scrollTop = chat.scrollHeight;
        }
    }).catch(e => console.warn("音声ファイル読み込み中...", e));

    sophieVoice.onended = () => {
        if (monitor?.contentWindow) {
            monitor.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
        }
    };
}
