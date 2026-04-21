/**
 * Bar Sophie v22.0 — app_m.js
 * ★ このファイルは「司令塔」です。
 * ★ コンソールの制御（renderConsole）と各機能の橋渡しを行います。
 */

import * as media    from './media.js';
import * as nav      from './navigation.js';
import * as utils    from './utils.js';
import * as music    from './music.js';
import * as liquor   from './liquor.js';

// =============================================
// グローバル変数
// =============================================
let talkAudio;
let ytPlayer = null;
let ytPlayerReady = false;
let pressTimer = null;

// =============================================
// 初期化
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    utils.initDom();

    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if (!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

    try {
        await nav.loadAllData();
    } catch (e) {
        alert("データの読み込みに失敗しました。");
        return;
    }

    // liquor.jsにコンソール切替関数を渡す
    liquor.setRenderConsole(renderConsole);

    setup();

    // YouTube IFrame API 読み込み
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
});

// YouTube API Callback
window.onYouTubeIframeAPIReady = () => {
    ytPlayer = new YT.Player('yt-player', {
        height: '100%', width: '100%',
        playerVars: { 'autoplay': 0, 'controls': 1, 'rel': 0, 'playsinline': 1 },
        events: {
            'onReady': (e) => {
                ytPlayerReady = true;
                music.initMusic(talkAudio, ytPlayer, true, utils.tel);
            },
            'onStateChange': music.onPlayerStateChange
        }
    });
};

// =============================================
// 基本セットアップ
// =============================================
function setup() {
    // 1. 入口画面
    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        playVoice("greeting", "いらっしゃいませ。");
    };

    // 2. ラウンジからバーへ
    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        showRootMenu();
        playVoice("menu_greeting", "今日はいかがされますか？");
    };

    // 3. メインメニューボタン
    document.getElementById('btn-music').onclick  = () => music.openMusic();
    document.getElementById('btn-talk').onclick   = () => music.openTalk();
    document.getElementById('btn-liquor').onclick = () => liquor.openLiquorPortal();

    // 4. ソフィーアイコン（ワープ）
    document.getElementById('sophie-warp').onclick = () => {
        if (nav.state !== "none") showRootMenu();
    };

    renderConsole('standard');
}

/**
 * メインメニュー（初期状態）を表示
 */
function showRootMenu() {
    utils.lv.style.display = 'none';
    utils.nm.style.display = 'block';
    nav.updateNav("none");
    utils.showLSide();
    renderConsole('standard');
}

/**
 * 音声再生
 */
function playVoice(id, altTxt) {
    talkAudio.src = `./voices_mp3/${id}.mp3`;
    talkAudio.play().catch(() => media.speak(altTxt));
}

// =============================================
// コントローラー（コンソール）描画ロジック
// =============================================
function renderConsole(mode) {
    const grid = document.getElementById('console-grid');
    if (!grid) return;

    if (mode === 'screening') {
        // スクリーニング画面専用（クリア・実行）
        grid.innerHTML = `
            <button class=\"console-scr-btn\" id=\"c-clr\">クリア</button>
            <button class=\"console-scr-btn btn-c-exec\" id=\"c-ex\">検索実行</button>`;
        document.getElementById('c-clr').onclick = () => liquor.clearScr();
        document.getElementById('c-ex').onclick  = () => liquor.execScr();

    } else if (mode === 'result') {
        // 検索結果画面専用（戻って条件変更）
        grid.innerHTML = `
            <button class=\"console-scr-btn btn-c-mod\" id=\"c-mod\">🔍 条件を変更する</button>`;
        document.getElementById('c-mod').onclick = () => liquor.openScreening();

    } else {
        // 標準モード（メイン、リスト、鑑定カード、音楽、売店）
        grid.innerHTML = `
            <button class=\"c-btn\" id=\"btn-expand\">🛍️</button>
            <button class=\"c-btn\" id=\"ctrl-back\">▲</button>
            <button class=\"c-btn\" id=\"ctrl-pause\">⏹️</button>
            <button class=\"c-btn\" id=\"ctrl-play\" style=\"flex:1.5; font-size:1.2rem;\">▶</button>
            <button class=\"c-btn\" id=\"btn-next\">⏭</button>`;

        // 売店（隠し部屋）ボタンへの配線
        document.getElementById('btn-expand').style.color = "#f0c040";
        document.getElementById('btn-expand').onclick = () => {
            import('./shop.js').then(m => m.openShopPortal());
        };

        document.getElementById('ctrl-play').onclick  = music.playHead;
        document.getElementById('ctrl-pause').onclick = music.togglePause;
        document.getElementById('ctrl-back').onclick  = handleBack;

        // 次へボタンの長押し処理（オートプレイ切替）
        const btnN = document.getElementById('btn-next');
        if (btnN) {
            btnN.onpointerdown = (e) => {
                e.preventDefault();
                pressTimer = setTimeout(() => {
                    btnN.classList.toggle('auto-active');
                    music.toggleAutoPlay(btnN.classList.contains('auto-active'));
                    pressTimer = null;
                }, 600);
            };
            btnN.onpointerup = () => {
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; music.next(); }
            };
            btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        }
    }
}

/**
 * 「戻る」ボタン（▲）の共通処理
 */
function handleBack() {
    // 売店にいる場合はメインメニューへ
    if (nav.state === "shop_root") {
        showRootMenu();
        return;
    }

    // お酒データベース内の戻り処理を優先
    if (liquor.handleLiquorBack()) return;

    // それ以外（音楽・お酒の話など）はメインメニューへ
    showRootMenu();
}