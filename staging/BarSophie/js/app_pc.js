/**
 * Bar Sophie PC版 v14.10
 * 【修正内容】
 * 1. YouTube切り替えを「iframe直接操作」に変更（無反応を解消）
 * 2. 音楽ボタン(JBox)と物語ボタン(MP3)の完全連動
 * 3. 引用符を含む複雑なCSVを正しく読み込む「高精度パース」搭載
 */

// --- 1. グローバル設定 ---
const sophieVoice = new Audio();
const BGM_VOLUME_NORMAL = 0.2;
const BGM_VOLUME_DUCKING = 0.05;

// --- 2. 初期化 ---
window.onload = async function() {
    console.log("🍷 Bar Sophie v14.10 起動中...");
    await loadBarData();
};

// --- 3. CSVを正しく読み込む関数（カンマや引用符対策） ---
function parseCsvLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    // 各項目の前後にある余計な引用符を削除
    return result.map(val => val.replace(/^"|"$/g, ''));
}

// --- 4. データ読み込みとボタン生成 ---
async function loadBarData() {
    try {
        // [A] ジュークボックス（音楽）の読み込み
        const jboxRes = await fetch('data/JBoxメニュー.csv');
        const jboxText = await jboxRes.text();
        renderJukebox(jboxText);

        // [B] お酒の物語（音声）の読み込み
        const storyRes = await fetch('data/お酒の話.csv');
        const storyText = await storyRes.text();
        renderStories(storyText);

    } catch (err) {
        console.error("❌ データ読み込み失敗:", err);
    }
}

// [JBoxボタン生成]
function renderJukebox(csvData) {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    const fixGrid = document.getElementById('fix-buttons-grid');
    const requestList = document.getElementById('request-list');
    
    if (fixGrid) fixGrid.innerHTML = '';
    if (requestList) requestList.innerHTML = '';

    lines.slice(1).forEach(line => {
        const [flag, code, singer, title, url] = parseCsvLine(line);
        if (!title || !url) return;

        const btn = document.createElement('button');
        btn.className = 'jbox-button';
        btn.innerHTML = `<span class="singer">${singer}</span><br><span class="title">${title}</span>`;
        
        // クリックイベント：YouTubeを再生
        btn.onclick = () => playMusic(url);

        if (flag === 'FIX') {
            if (fixGrid) fixGrid.appendChild(btn);
        } else if (flag !== 'SIGNAL') {
            if (requestList) requestList.appendChild(btn);
        }
    });
    console.log("🎵 音楽メニュー展開完了");
}

// [物語ボタン生成]
function renderStories(csvData) {
    const lines = csvData.split(/\r?\n/).filter(line => line.trim() !== '');
    const storyList = document.getElementById('story-list');
    if (storyList) storyList.innerHTML = '';

    lines.slice(1).forEach(line => {
        const [id, title, genre, body] = parseCsvLine(line);
        if (!title) return;

        const btn = document.createElement('button');
        btn.className = 'story-button';
        btn.innerText = title;
        
        // クリックイベント：ソフィーの声を再生
        btn.onclick = () => playSophieStory(id, title, body);
        
        if (storyList) storyList.appendChild(btn);
    });
    console.log("🎙️ 物語メニュー展開完了");
}

// --- 5. 再生コントロール（メイン） ---

// [YouTube再生]
function playMusic(urlOrId) {
    let videoId = urlOrId;
    // URLからIDを抽出 (v=... または youtu.be/...)
    if (urlOrId.includes('v=')) {
        videoId = urlOrId.split('v=')[1].split('&')[0];
    } else if (urlOrId.includes('youtu.be/')) {
        videoId = urlOrId.split('youtu.be/')[1].split('?')[0];
    }

    const monitor = document.getElementById('main-monitor-iframe');
    if (monitor) {
        // enablejsapi=1 を付けて、後で音量をいじれるようにしておく
        monitor.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&enablejsapi=1`;
        console.log("🎬 YouTube切り替え:", videoId);
    } else {
        console.error("❌ main-monitor-iframe が見つかりません");
    }
}

// [ソフィーの音声再生]
function playSophieStory(id, title, text) {
    // 前の声を止める
    sophieVoice.pause();
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${new Date().getTime()}`;

    // YouTubeの音量を下げる（ダッキング命令を送信）
    const monitor = document.getElementById('main-monitor-iframe');
    if (monitor && monitor.contentWindow) {
        monitor.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[5]}', '*');
    }

    sophieVoice.play().then(() => {
        // テキスト表示
        const chat = document.getElementById('sophie-chat');
        if (chat) {
            chat.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
            chat.scrollTop = chat.scrollHeight;
        }
    }).catch(e => console.error("🎙️ 音声再生エラー:", e));

    // 声が終わったら音量を戻す
    sophieVoice.onended = () => {
        if (monitor && monitor.contentWindow) {
            monitor.contentWindow.postMessage('{"event":"command","func":"setVolume","args":[20]}', '*');
        }
    };
}

// --- 6. 全停止プロトコル ---
function stopEverything() {
    sophieVoice.pause();
    const monitor = document.getElementById('main-monitor-iframe');
    if (monitor && monitor.contentWindow) {
        monitor.contentWindow.postMessage('{"event":"command","func":"stopVideo","args":""}', '*');
    }
}
