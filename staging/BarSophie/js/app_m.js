/**
 * Bar Sophie v22.1 — app_m.js
 * ★ 変更点：クレジット保護構造への対応、コンテキストに応じた左端ボタンの切り替え
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

    liquor.setRenderConsole(renderConsole);
    setup();

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

function setup() {
    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        playVoice("greeting", "いらっしゃいませ。");
    };

    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        showRootMenu();
        playVoice("menu_greeting", "今日はいかがされますか？");
    };

    renderConsole('standard');
}

/**
 * メインメニューを表示（クレジットを維持しながらボタンのみ描画）
 */
function showRootMenu() {
    utils.lv.style.display = 'none';
    utils.nm.style.display = 'block';
    nav.updateNav("none");
    utils.showLSide();

    // ボタンエリアのみを書き換え
    const btnArea = document.getElementById('main-btns');
    if (btnArea) {
        btnArea.innerHTML = `
            <button class="act-btn" style="background:var(--green); margin-bottom:10px;" id="btn-music">🎵 音楽選曲 (リクエスト)</button>
            <button class="act-btn" style="background:var(--talk); margin-bottom:10px;" id="btn-talk">🥃 お酒の話 (360本の物語)</button>
            <button class="act-btn" style="background:#8e44ad;" id="btn-liquor">🍸 お酒データベース (800銘柄)</button>
        `;
        document.getElementById('btn-music').onclick  = () => music.openMusic();
        document.getElementById('btn-talk').onclick   = () => music.openTalk();
        document.getElementById('btn-liquor').onclick = () => liquor.openLiquorPortal();
    }
    
    renderConsole('standard');
}

function playVoice(id, altTxt) {
    talkAudio.src = `./voices_mp3/${id}.mp3`;
    talkAudio.play().catch(() => media.speak(altTxt));
}

/**
 * コンソール描画（左端ボタンの機能を文脈で切り替え）
 */
function renderConsole(mode) {
    const grid = document.getElementById('console-grid');
    if (!grid) return;

    if (mode === 'screening') {
        grid.innerHTML = `<button class="c-btn" id="c-clr">クリア</button><button class="c-btn auto-active" id="c-ex">検索実行</button>`;
        document.getElementById('c-clr').onclick = () => liquor.clearScr();
        document.getElementById('c-ex').onclick  = () => liquor.execScr();
    } else if (mode === 'result') {
        grid.innerHTML = `<button class="c-btn" id="c-mod" style="flex:1;">🔍 条件を変更する</button>`;
        document.getElementById('c-mod').onclick = () => liquor.openScreening();
    } else {
        // 標準モード：トップメニュー(none)なら売店、それ以外はモニター拡張
        const leftBtnIcon = (nav.state === "none") ? "🛍️" : "🔽";
        
        grid.innerHTML = `
            <button class="c-btn" id="btn-left-action">${leftBtnIcon}</button>
            <button class="c-btn" id="ctrl-back">▲</button>
            <button class="c-btn" id="ctrl-pause">⏹️</button>
            <button class="c-btn" id="ctrl-play" style="flex:1.5; font-size:1.2rem;">▶</button>
            <button class="c-btn" id="btn-next">⏭</button>`;

        const leftBtn = document.getElementById('btn-left-action');
        if (nav.state === "none") {
            leftBtn.style.color = "#f0c040";
            leftBtn.onclick = () => import('./shop.js').then(m => m.openShopPortal());
        } else {
            leftBtn.onclick = () => {
                const monitor = document.querySelector('.monitor');
                monitor.classList.toggle('expanded');
                leftBtn.innerText = monitor.classList.contains('expanded') ? '▲' : '🔽';
            };
        }

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

function handleBack() {
    if (nav.state === "shop_root") { showRootMenu(); return; }
    if (liquor.handleLiquorBack()) return;
    showRootMenu();
}