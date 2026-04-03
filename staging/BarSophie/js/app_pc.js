/**
 * Bar Sophie PC版 v14.8 (External Voice Engine)
 * 360本以上の軽量MP3に対応した、音と文字の完全同期システム
 */

// --- 1. グローバル定数・プレイヤー設定 ---
const sophieVoice = new Audio(); // ソフィー専用の音声プレイヤー
const BGM_VOLUME_NORMAL = 0.2;   // BGMの通常音量
const BGM_VOLUME_DUCKING = 0.05; // ソフィーが話している時のBGM音量

// --- 2. 音声再生・演出コントロール（心臓部） ---
/**
 * @param {string} id - CSVのID（ファイル名に対応: 101, 102...）
 * @param {string} title - お酒のタイトル
 * @param {string} text - 読み上げる本文
 */
function playSophieStory(id, title, text) {
    console.log(`🎤 再生リクエスト: ${id} - ${title}`);

    // [A] 既存の音声を即座に停止（連打対応）
    sophieVoice.pause();
    sophieVoice.currentTime = 0;

    // [B] MP3ファイルのパスをセット (軽量化した600KBの精鋭たち)
    // キャッシュ対策としてタイムスタンプを付与
    sophieVoice.src = `voices_mp3/${id}.mp3?v=${new Date().getTime()}`;

    // [C] BGMのダッキング（音量を下げる）
    const bgmPlayer = document.getElementById('bgm-player');
    if (bgmPlayer) {
        bgmPlayer.volume = BGM_VOLUME_DUCKING;
    }

    // [D] 再生実行
    sophieVoice.play().then(() => {
        // [E] 視覚演出：モニターに画像を表示、チャット欄にテキストを表示
        updateMonitorImage(id); // IDに基づいた画像を表示（後述）
        displaySophieText(title, text);
        console.log(`✅ ${id}.mp3 再生中...`);
    }).catch(err => {
        console.error("❌ 音声ファイルが読み込めません:", err);
        // 音声がなくても物語だけは届ける（フォールバック）
        displaySophieText(title, text + "\n(音声読み込みエラー)");
    });

    // [F] 終了時の処理（BGMを戻す）
    sophieVoice.onended = () => {
        if (bgmPlayer) {
            bgmPlayer.volume = BGM_VOLUME_NORMAL;
        }
        console.log("🏁 物語が終了しました。");
    };
}

// --- 3. UI表示・テキスト演出 ---
function displaySophieText(title, text) {
    const chatContainer = document.getElementById('sophie-chat');
    if (!chatContainer) return;

    // HTMLを生成（改行コードを<br>に置換）
    const formattedText = text.replace(/\n/g, '<br>');
    chatContainer.innerHTML = `
        <div class="story-bubble">
            <h3 class="story-title">【${title}】</h3>
            <p class="story-body">${formattedText}</p>
        </div>
    `;
    
    // 常に最新のメッセージが見えるようスクロール
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// --- 4. モニター画像制御 ---
function updateMonitorImage(id) {
    const monitor = document.getElementById('main-monitor');
    if (!monitor) return;

    // お酒の画像があれば表示（なければデフォルトのソフィー画像）
    const imgPath = `images/liquor/${id}.jpg`;
    const defaultImg = `images/sophie_standard.png`;

    const img = new Image();
    img.src = imgPath;
    img.onload = () => monitor.style.backgroundImage = `url(${imgPath})`;
    img.onerror = () => monitor.style.backgroundImage = `url(${defaultImg})`;
}

// --- 5. ⏹️ 停止ボタンの完全連動 ---
function stopEverything() {
    // ソフィーを黙らせる
    sophieVoice.pause();
    sophieVoice.currentTime = 0;

    // BGMの音量を戻す
    const bgmPlayer = document.getElementById('bgm-player');
    if (bgmPlayer) bgmPlayer.volume = BGM_VOLUME_NORMAL;

    // チャットをクリア（または案内を表示）
    const chatContainer = document.getElementById('sophie-chat');
    if (chatContainer) chatContainer.innerHTML = "<p>（ソフィーは静かに微笑んでいます）</p>";

    console.log("⏹️ 全停止プロトコル発動");
}

// --- 6. CSVデータ読み込み・イベント紐付け（初期化） ---
async function initSophieStories() {
    try {
        const response = await fetch('data/お酒の話.csv');
        const csvData = await response.text();
        
        // 簡易CSVパース（ID, タイトル, ジャンル, 本文）
        const rows = csvData.split('\n').slice(1); // ヘッダーを除外
        const listContainer = document.getElementById('story-list');

        rows.forEach(row => {
            const cols = row.split(','); // 実際はカンマ区切り。必要に応じてPapaParse等を使用
            if (cols.length < 4) return;

            const [id, title, genre, body] = cols;

            // ボタン生成
            const btn = document.createElement('button');
            btn.className = 'story-button';
            btn.innerText = title;
            btn.onclick = () => playSophieStory(id.trim(), title.trim(), body.trim());
            
            listContainer.appendChild(btn);
        });
    } catch (err) {
        console.error("CSV読み込み失敗:", err);
    }
}

// ページ読み込み時に初期化
window.onload = initSophieStories;
