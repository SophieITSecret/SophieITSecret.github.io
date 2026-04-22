/**
 * Bar Sophie v22.0 — app_m.js
 * ★ このファイルは「司令塔」です。各機能の呼び出しのみ行います。
 * ★ 音楽・お酒の話の実装は music.js（封印）
 * ★ データベース・スクリーニングの実装は liquor.js（作業対象）
 * ★ 共通ユーティリティは utils.js（封印）
 */

import * as media    from './media.js';
import * as nav      from './navigation.js';
import * as utils    from './utils.js';
import * as music    from './music.js';
import * as liquor   from './liquor.js';
import * as shop     from './shop.js';  // ＋追加：売店モジュール

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
        await shop.initShop();  // ＋追加：売店のCSVも一緒に読み込む
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
    document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
});

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('yt-player', {
        playerVars: { playsinline: 1, autoplay: 1, rel: 0, controls: 1 },
        events: {
            onReady: () => {
                ytPlayerReady = true;
                music.setYtReady(ytPlayer);
                music.initMusic(talkAudio, ytPlayer, true, document.getElementById('telop'));
            },
            onStateChange: (e) => {
                if (e.data === YT.PlayerState.ENDED && music.isAutoPlay && music.isMusicMode) {
                    music.next();
                }
            }
        }
    });
};

// =============================================
// セットアップ
// =============================================
function setup() {
    // musicモジュールに必要な参照を渡す（YT準備前でも音声は使える）
    music.initMusic(talkAudio, null, false, document.getElementById('telop'));

    talkAudio.onended = music.defaultOnEnded;

    // 入口ボタン
    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';

        if (ytPlayerReady && ytPlayer) {
            try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch(e) {}
        }

        playVoice("./voices_mp3/greeting.mp3", "いらっしゃいませ。");
    };

    // カウンターへ進む
    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        window.speechSynthesis.cancel();
        talkAudio.pause();
        showRootMenu();
        playVoice("./voices_mp3/menu_greeting.mp3", "いつもありがとうございます。今日はいかがされますか？");
    };

    // メインメニューボタン
    document.getElementById('btn-music').onclick  = music.openMusic;
    document.getElementById('btn-talk').onclick   = music.openTalk;
    document.getElementById('btn-liquor').onclick = liquor.openLiquorPortal;

    // コントローラーボタン
    document.getElementById('ctrl-play').onclick  = music.playHead;
    document.getElementById('ctrl-pause').onclick = music.togglePause;
    document.getElementById('ctrl-back').onclick  = handleBack;

    // 拡大ボタン
    document.getElementById('btn-expand').onclick = () => {
        if (music.isMusicMode || nav.state === "none") return;
        const monitor = document.querySelector('.monitor');
        const btn = document.getElementById('btn-expand');
        monitor.classList.toggle('expanded');
        btn.innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
    };

    // ソフィーアイコン（メニューへ戻る or 退店）
    document.getElementById('sophie-warp').onclick = () => {
        if (nav.state !== "none") {
            showRootMenu();
        } else {
            // 退店シーケンス
            document.getElementById('main-ui').style.display = 'none';
            document.getElementById('chat-mode').style.display = 'flex';
            const loungeText = document.getElementById('lounge-text');
            loungeText.innerText = "ありがとうございました。";
            window.speechSynthesis.cancel();
            if (ytPlayerReady && ytPlayer) { try { ytPlayer.pauseVideo(); } catch(e){} }
            try { talkAudio.pause(); } catch(e){}
            talkAudio.src = "./voices_mp3/goodbye.mp3";
            const finalize = () => {
                setTimeout(() => {
                    document.getElementById('chat-mode').style.display = 'none';
                    document.getElementById('entry-screen').style.display = 'flex';
                    loungeText.innerText = "いらっしゃいませ。";
                    talkAudio.onended = music.defaultOnEnded;
                    document.getElementById('monitor-img').src = "";
                }, 1000);
            };
            talkAudio.onended = finalize;
            talkAudio.onerror = finalize;
            try { const p = talkAudio.play(); if (p) p.catch(finalize); } catch(e) { finalize(); }
        }
    };

    // 次へボタン（長押しで自動再生）
    const btnN = document.getElementById('btn-next');
    if (btnN) {
        btnN.onpointerdown = (e) => {
            e.preventDefault();
            pressTimer = setTimeout(() => {
                // isAutoPlayはmusicモジュール内で管理 → nextで自動的にトグル
                music.next(); // 長押し時も次へ
                btnN.classList.toggle('auto-active');
                pressTimer = null;
            }, 600);
        };
        btnN.onpointerup = () => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; music.next(); }
        };
        btnN.onpointerleave = () => {
            if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        };
    }

    renderConsole('standard');
    showRootMenu();
}

// =============================================
// ユーティリティ
// =============================================
function playVoice(src, txt) {
    talkAudio.src = src;
    talkAudio.onerror = () => { try { media.speak(txt); } catch(e){} };
    try {
        const p = talkAudio.play();
        if (p !== undefined) p.catch(() => { try { media.speak(txt); } catch(e){} });
    } catch(e) { try { media.speak(txt); } catch(err){} }
}

function showRootMenu() {
    const lv  = document.getElementById('list-view');
    const nm  = document.getElementById('nav-main');
    const img = document.getElementById('monitor-img');
    const yt  = document.getElementById('yt-wrapper');
    const tel = document.getElementById('telop');
    const mon = document.querySelector('.monitor');

    lv.style.display  = 'none';
    nm.style.display  = 'block';
    nav.updateNav("none");
    yt.style.display  = 'none';
    img.src = './front_sophie.jpeg';
    img.style.display = 'block';
    if (tel) tel.style.display = 'none';
    if (mon) { mon.classList.remove('expanded'); }
    utils.showLSide();

    // ★ メニューに戻ったタイミングでコンソールを再描画（ピンクボタンの表示）
    renderConsole('standard');

    // ★メインメニュー時だけ免責を表示
    const db = document.getElementById('disclaimer-bar');
    if (db) db.style.display = 'block';
}

// =============================================
// 戻るハンドラ
// =============================================
function handleBack() {
    // ＋追加：売店から戻る処理
    if (nav.state === "shop") { showRootMenu(); return; }

    // まずliquor.jsで処理できるか試みる
    if (liquor.handleLiquorBack()) return;
    // 次にmusic.jsで処理できるか試みる
    if (music.handleBack()) return;
    // どちらでもなければルートへ
    showRootMenu();
}

// =============================================
// コンソール（下部ボタンエリア）
// ※ スクリーニング時はliquor.jsから呼ばれる
// =============================================
function renderConsole(mode) {
    // v13.0の固定HTMLコンソールを使う（ボタンIDはそのまま）
    // screening / result モードはliquor.jsが必要な時だけ呼ぶ
    if (mode === 'screening') {
        // スクリーニング画面：クリア＋実行ボタン
        const grid = document.querySelector('.btn-grid');
        if (!grid) return;
        grid.innerHTML = `
            <button class="c-btn" id="c-clr" style="background:#444;">クリア</button>
            <button class="c-btn" id="c-ex"  style="background:#8e44ad; color:#fff; flex:2;">検索実行</button>`;
        document.getElementById('c-clr').onclick = liquor.clearScr;
        document.getElementById('c-ex').onclick  = liquor.execScr;

    } else if (mode === 'result') {
        const grid = document.querySelector('.btn-grid');
        if (!grid) return;
        grid.innerHTML = `
            <button class="c-btn" id="c-mod" style="background:#8e44ad; color:#fff; font-size:0.85rem;">🔍 検索条件を変更する</button>`;
        document.getElementById('c-mod').onclick = liquor.openScreeningFromConsole;

    } else if (mode === 'card') {
        // ★個別銘柄カード専用コンソール
        const grid = document.querySelector('.btn-grid');
        if (!grid) return;
        grid.innerHTML = `
            <button class="c-btn card-btn" id="c-sophie" style="background:#1a3a4a; color:#00d2ff; font-size:1.1rem; font-weight:bold;">S</button>
            <button class="c-btn card-btn" id="c-scr"    style="background:#5b2d8e; color:#fff; font-size:0.62rem; line-height:1.2;">選択<br>画面</button>
            <button class="c-btn card-btn" id="c-list"   style="background:#7a3a00; color:#f0b56e; font-size:0.75rem;">リスト</button>
            <button class="c-btn card-btn" id="c-prev"   style="background:#1a3a1a; color:#7fd97f; font-size:1.1rem;">&#9664;</button>
            <button class="c-btn card-btn" id="c-next2"  style="background:#1a3a1a; color:#7fd97f; font-size:1.1rem;">&#9654;</button>`;

        // Sボタン：ソフィーの顔を表示＋音声
        document.getElementById('c-sophie').addEventListener('click', () => {
            const ls = document.querySelector('.l-side');
            if (ls) {
                ls.style.display = 'block';
                setTimeout(() => { if (nav.state === 'lq_card') ls.style.display = 'none'; }, 4000);
            }
            talkAudio.src = "./voices_mp3/what_order.mp3";
            talkAudio.play().catch(() => { try { media.speak("何になさいますか？"); } catch(e){} });
        });
        document.getElementById('c-scr').addEventListener('click',   liquor.cardNavToScr);
        document.getElementById('c-list').addEventListener('click',  liquor.cardNavToList);
        document.getElementById('c-prev').addEventListener('click',  liquor.cardNavPrev);
        document.getElementById('c-next2').addEventListener('click', liquor.cardNavNext);

    } else {
        // 通常モード：v13.0の元のボタン構成を復元
        const grid = document.querySelector('.btn-grid');
        if (!grid) return;

        // ＋追加：HOME画面の時だけ、左端のボタンをピンクの「隠し扉」にする
        const isHome = (nav.state === "none");
        const expandBtnHtml = isHome
            ? `<button class="c-btn" id="btn-expand" style="background:#ffb6c1; color:#1a0a10; font-size:0.75rem; line-height:1.2; font-weight:bold; letter-spacing:0.5px;">ソフィー<br>お薦め</button>`
            : `<button class="c-btn" id="btn-expand">▼</button>`;

        grid.innerHTML = `
            ${expandBtnHtml}
            <button class="c-btn" id="ctrl-back">▲</button>
            <button class="c-btn" id="ctrl-pause">⏹️</button>
            <button class="c-btn" id="ctrl-play" style="flex:1.5; font-size:1.2rem;">▶</button>
            <button class="c-btn" id="btn-next">⏭</button>`;

        document.getElementById('ctrl-play').onclick  = music.playHead;
        document.getElementById('ctrl-pause').onclick = music.togglePause;
        document.getElementById('ctrl-back').onclick  = handleBack;

        // ＋追加：隠し扉のクリックイベント
        document.getElementById('btn-expand').onclick = () => {
            // HOME画面なら売店を開く
            if (nav.state === "none") {
                shop.openShop();
                return;
            }
            // それ以外なら通常のモニター拡大処理
            if (music.isMusicMode || nav.state === "none") return;
            const monitor = document.querySelector('.monitor');
            const btn = document.getElementById('btn-expand');
            monitor.classList.toggle('expanded');
            btn.innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
        };

        const btnN = document.getElementById('btn-next');
        if (btnN) {
            btnN.onpointerdown = (e) => {
                e.preventDefault();
                pressTimer = setTimeout(() => {
                    btnN.classList.toggle('auto-active');
                    pressTimer = null;
                }, 600);
            };
            btnN.onpointerup = () => {
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; music.next(); }
            };
            btnN.onpointerleave = () => {
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            };
        }
    }
}