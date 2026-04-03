/**
 * Bar Sophie PC版 v14.8
 * 【修正内容】
 * 1. ジュークボックス(JBoxメニュー.csv)の完全復旧
 * 2. 音声物語(お酒の話.csv)の軽量MP3対応
 * 3. YouTube(音楽)とMP3(声)の同時制御（ダッキング機能付）
 */

// --- 1. プレイヤー・定数設定 ---
let ytPlayer; // YouTubeプレイヤー
const sophieVoice = new Audio(); // ソフィーの音声用
const BGM_VOLUME_NORMAL = 0.2;
const BGM_VOLUME_DUCKING = 0.05;

// --- 2. 初期化処理（CSV読み込み） ---
window.onload = async function() {
    console.log("🚀 Bar Sophie v14.8 起動開始...");
    await initJukebox();       // 音楽メニューの読み込み
    await initSophieStories(); // お酒の物語の読み込み
};

// --- 3. ジュークボックス（音楽）制御 ---
async function initJukebox() {
    try {
        const response = await fetch('data/JBoxメニュー.csv');
        const csvData = await response.text();
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        const fixGrid = document.getElementById('fix-buttons-grid'); // FIXボタン用エリア
        const requestList = document.getElementById('request-list'); // 選曲リスト用エリア

        // ヘッダーを除外してループ
        rows.slice(1).forEach(row => {
            // カンマ区切り（簡易パース。引用符内のカンマには非対応なので注意）
            const [flag, code, singer, title, url] = row.split(',').map(s => s.replace(/"/g, '').trim());

            if (!title) return; // 空行対策

            const btn = document.createElement('button');
            btn.className = 'jbox-button';
            btn.innerHTML = `<span class="singer">${singer}</span><br><span class="title">${title}</span>`;
            
            // 再生イベント
            btn.onclick = () => playMusic(url);

            // フラグが「FIX」なら上部グリッドへ、それ以外はリストへ
            if (flag === 'FIX') {
                if (fixGrid) fixGrid.appendChild(btn);
            } else if (flag === 'SIGNAL') {
                // 看板曲ボタン（もしあれば個別に紐付け）
                const signalBtn = document.getElementById('signal-btn');
                if (signalBtn) signalBtn.onclick = () => playMusic(url);
            } else {
                if (requestList) requestList.appendChild(btn);
            }
        });
        console.log("🎵 ジュークボックスの読み込み完了");
    } catch (err) {
        console.error("❌ 音楽データの読み込みに失敗:", err);
    }
}

function playMusic(urlOrId) {
    let videoId = urlOrId;
    // URLからIDだけを抽出（YouTubeのフルURLにも対応）
    if (urlOrId.includes('v=')) {
        videoId = urlOrId.split('v=')[1].split('&')[0];
    } else if (urlOrId.includes('youtu.be/')) {
        videoId = urlOrId.split('youtu.be/')[1];
    }

    // YouTubeプレイヤーの読み込み（iframe apiを使用している前提）
    if (ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById(videoId);
    } else {
        // 簡易実装用：直接iframeのsrcを書き換える場合
        const monitor = document.getElementById('main-monitor-iframe');
        if (monitor) {
            monitor.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0`;
        }
    }
    console.log(`播放音楽: ${videoId}`);
}

// --- 4. お酒の物語（音声）制御 ---
async function initSophieStories() {
    try {
        const response = await fetch('data/お酒の話.csv');
        const csvData = await response.text();
        const rows = csvData.split('\n').filter(row => row.trim() !== '');
        
        const storyList = document.getElementById('story-list');

        rows.slice(1).forEach(row => {
            const [id, title, genre, body] = row.split(',').map(s => s.replace(/"/g, '').trim());
            if (!title) return;

            const btn = document.createElement('button');
            btn.className = 'story-button';
            btn.innerText = title;
            btn.onclick = () => playSophieStory(id, title, body);
            
            if (storyList) storyList.appendChild(btn);
        });
        console.log("🎙️ お酒の物語の読み込み完了");
    } catch (err) {
        console.error("❌ 物語データの読み込みに失敗:", err);
    }
}

function playSophieStory(id, title, text) {
    sophieVoice.pause();
    sophieVoice.currentTime = 0;

    // 軽量MP3を読み込み
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${new Date().getTime()}`;

    // ダッキング：BGM音量を下げる
    const monitorIframe = document.getElementById('main-monitor-iframe');
    // 注意: YouTubeの音量操作はAPI経由が必要。
    // ここでは簡易的に「再生中のYouTubeがあれば音量を下げる」命令を想定
    if (ytPlayer && ytPlayer.setVolume) {
        ytPlayer.setVolume(BGM_VOLUME_DUCKING * 100);
    }

    sophieVoice.play().then(() => {
        displayChat(title, text);
    }).catch(e => console.log("音声再生エラー:", e));

    // 終了時に音量を戻す
    sophieVoice.onended = () => {
        if (ytPlayer && ytPlayer.setVolume) {
            ytPlayer.setVolume(BGM_VOLUME_NORMAL * 100);
        }
    };
}

// --- 5. 共通演出・ユーティリティ ---
function displayChat(title, text) {
    const chat = document.getElementById('sophie-chat');
    if (!chat) return;
    chat.innerHTML = `<strong>【${title}】</strong><br>${text.replace(/\n/g, '<br>')}`;
    chat.scrollTop = chat.scrollHeight;
}

function stopAll() {
    sophieVoice.pause();
    if (ytPlayer && ytPlayer.stopVideo) ytPlayer.stopVideo();
    console.log("⏹️ 全停止");
}
