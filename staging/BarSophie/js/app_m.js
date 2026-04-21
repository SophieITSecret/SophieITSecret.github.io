/**
 * Bar Sophie v22.1 — app_m.js
 * ★ ソフィーの写真表示復旧、コンソール制御、戻り処理の統合。
 */

import * as media    from './media.js';
import * as nav      from './navigation.js';
import * as utils    from './utils.js';
import * as music    from './music.js';
import * as liquor   from './liquor.js';

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

    // YouTube API
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
});

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
    // 1. 入口
    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        playVoice("greeting", "いらっしゃいませ。");
    };

    // 2. ラウンジ
    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        showRootMenu();
        playVoice("menu_greeting", "今日はいかがされますか？");
    };

    // 3. メインボタン
    document.getElementById('btn-music').onclick  = () => music.openMusic();
    document.getElementById('btn-talk').onclick   = () => music.openTalk();
    document.getElementById('btn-liquor').onclick = () => liquor.openLiquorPortal();

    // 4. ソフィーアイコン（メインメニューへのワープ）
    document.getElementById('sophie-warp').onclick = () => {
        if (nav.state !== "none") showRootMenu();
    };

    renderConsole('standard');
}

/**
 * メインメニューを表示（写真の復旧処理を含む）
 */
function showRootMenu() {
    utils.lv.style.display = 'none';
    utils.nm.style.display = 'block';
    nav.updateNav("none");
    
    // 写真が消える問題を修正：表示を戻して画像を再セット
    utils.showLSide();
    if (utils.monImg) {
        utils.monImg.src = './front_sophie.jpeg';
    }
    
    renderConsole('standard');
}

function playVoice(id, altTxt) {
    talkAudio.src = `./voices_mp3/${id}.mp3`;
    talkAudio.play().catch(() => media.speak(altTxt));
}

// =============================================
// コンソール制御
// =============================================
function renderConsole(mode) {
    const grid = document.getElementById('console-grid');
    if (!grid) return;

    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="console-scr-btn" id="c-clr">クリア</button>
            <button class="console-scr-btn btn-c-exec" id="c-ex">検索実行</button>`;
        document.getElementById('c-clr').onclick = () => liquor.clearScr();
        document.getElementById('c-ex').onclick  = () => liquor.execScr();

    } else if (mode === 'result') {
        grid.innerHTML = `
            <button class="console-scr-btn btn-c-mod" id="c-mod">🔍 条件を変更</button>`;
        document.getElementById('c-mod').onclick = () => liquor.openScreening();

    } else {
        grid.innerHTML = `
            <button class="c-btn" id="btn-expand" style="color:#f0c040;">🛍️</button>
            <button class="c-btn" id="ctrl-back">▲</button>
            <button class="c-btn" id="ctrl-pause">⏹️</button>
            <button class="c-btn" id="ctrl-play" style="flex:1.5; font-size:1.2rem;">▶</button>
            <button class="c-btn" id="btn-next">⏭</button>`;

        // 売店ポータルへの配線
        document.getElementById('btn-expand').onclick = () => {
            import('./shop.js').then(m => m.openShopPortal());
        };

        document.getElementById('ctrl-play').onclick  = music.playHead;
        document.getElementById('ctrl-pause').onclick = music.togglePause;
        document.getElementById('ctrl-back').onclick  = handleBack;

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
            btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; music.next(); } };
            btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        }
    }
}

/**
 * 戻るボタンの共通処理
 */
function handleBack() {
    if (nav.state === "shop_root") {
        showRootMenu();
        return;
    }
    if (liquor.handleLiquorBack()) return;
    showRootMenu();
}