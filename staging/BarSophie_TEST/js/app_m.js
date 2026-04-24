
/**
 * Bar Sophie v22.0 — app_m.js
 * ★ DJソフィー連携・全機能統合版
 */

import * as media    from './media.js';
import * as nav      from './navigation.js';
import * as utils    from './utils.js';
import * as music    from './music.js';
import * as liquor   from './liquor.js';
import * as shop     from './shop.js';
import * as dj       from './dj.js';

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
        await shop.initShop();
    } catch (e) {
        alert("データの読み込みに失敗しました。");
        return;
    }

    liquor.setRenderConsole(renderConsole);
    
    // 音楽リスト・歌手リストの自動パッチ（行間0.4em）開始
    import('./favorite.js').then(fav => {
        fav.initMusicPatch();
    }).catch(e => console.warn("favorite.js load error", e));
    
    setup();

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
                // DJモジュールにYouTubeの状態（終了など）を伝える
                if (dj.handleYtStateChange) dj.handleYtStateChange(e.data);
                
                if (e.data === YT.PlayerState.ENDED && music.isAutoPlay && music.isMusicMode) {
                    music.next();
                }
            }
        }
    });
};

function setup() {
    music.initMusic(talkAudio, null, false, document.getElementById('telop'));
    talkAudio.onended = music.defaultOnEnded;

    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        if (ytPlayerReady && ytPlayer) {
            try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch(e) {}
        }
        playVoice("./voices_mp3/greeting.mp3", "いらっしゃいませ。");
    };

    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        window.speechSynthesis.cancel();
        talkAudio.pause();
        showRootMenu();
        playVoice("./voices_mp3/menu_greeting.mp3", "いつもありがとうございます。今日はいかがされますか？");
    };

    document.getElementById('btn-music').onclick = () => { music.openMusic(); renderConsole('standard'); };
    document.getElementById('btn-talk').onclick  = () => { music.openTalk();  renderConsole('standard'); };
    document.getElementById('btn-liquor').onclick = liquor.openLiquorPortal;

    document.getElementById('sophie-warp').onclick = () => {
        if (nav.state !== "none") {
            showRootMenu();
        } else {
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
                }, 1000);
            };
            talkAudio.onended = finalize;
            talkAudio.onerror = finalize;
            try { const p = talkAudio.play(); if (p) p.catch(finalize); } catch(e) { finalize(); }
        }
    };

    setupNextButton();
    renderConsole('standard');
    showRootMenu();
}

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
    const mon = document.querySelector('.monitor');

    lv.style.display  = 'none';
    nm.style.display  = 'block';
    nav.updateNav("none");
    yt.style.display  = 'none';
    img.src = './front_sophie.jpeg';
    img.style.display = 'block';
    if (mon) { mon.classList.remove('expanded'); }
    utils.showLSide();

    renderConsole('standard');

    let noticeBtn = document.getElementById('btn-notice');
    if (!noticeBtn && nm) {
        noticeBtn = document.createElement('button');
        noticeBtn.id = 'btn-notice';
        noticeBtn.className = 'act-btn';
        noticeBtn.style.cssText = 'background: linear-gradient(135deg, #1a5276, #2980b9); color:#fff; margin:20px auto 10px; width:calc(100% - 30px); display:block; border:1px solid #5DADE2; font-weight:bold;';
        noticeBtn.innerHTML = '📢 ソフィーのお知らせ・使い方';
        noticeBtn.onclick = () => {
            import('./favorite.js').then(f => {
                f.openNotice();
                renderConsole('standard');
            });
        };
        nm.appendChild(noticeBtn);
    }
}

function handleBack() {
    if (nav.state === "shop" || nav.state === "techo" || nav.state === "notice") { showRootMenu(); return; }
    if (liquor.handleLiquorBack && liquor.handleLiquorBack()) return;
    if (music.handleBack && music.handleBack()) return;
    showRootMenu();
}

function setupNextButton() {
    const btnN = document.getElementById('btn-next');
    if (btnN) {
        btnN.onpointerdown = (e) => {
            e.preventDefault();
            pressTimer = setTimeout(() => { music.next(); btnN.classList.toggle('auto-active'); pressTimer = null; }, 600);
        };
        btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; music.next(); } };
        btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    }
}

function renderConsole(mode) {
    // ★ 免責事項（クレジット）のカウンター限定表示
    const db = document.getElementById('disclaimer-bar');
    if (db) db.style.display = (nav.state === "none") ? 'block' : 'none';

    const grid = document.querySelector('.btn-grid');
    if (!grid) return;

    const noApp = "-webkit-appearance:none; appearance:none; outline:none;";
    const playCtrlStyle = `flex:1; background:#1a2b1a; color:#5c9e5c; border:none; box-shadow:none; border-radius:0; ${noApp}`;
    const playBtnStyle  = `flex:1.0; font-size:1.2rem; background:#1a3a1a; color:#7fd97f; border:none; box-shadow:none; border-radius:0; ${noApp}`;

    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="c-btn" id="c-back" style="background:#34495e; color:#fff; flex:1; font-weight:bold; border:none;">戻る</button>
            <button class="c-btn" id="c-clr"  style="background:#5DADE2; color:#fff; flex:1; border:none;">リセット</button>
            <button class="c-btn" id="c-ex"   style="background:#8e44ad; color:#fff; flex:2; border:none;">検索実行</button>`;
        document.getElementById('c-back').onclick = liquor.openLiquorPortal;
        document.getElementById('c-clr').onclick  = liquor.clearScr;
        document.getElementById('c-ex').onclick   = liquor.execScr;
        return;
    }

    if (mode === 'card') {
        grid.innerHTML = `
            <button class="c-btn card-btn" id="c-sophie" style="background:#1a3a4a; color:#00d2ff; font-weight:bold;">S</button>
            <button class="c-btn card-btn" id="c-scr"    style="background:#5b2d8e; color:#fff; font-size:0.62rem;">選択画面</button>
            <button class="c-btn card-btn" id="c-list"   style="background:#7a3a00; color:#f0b56e; font-size:0.75rem;">リスト</button>
            <button class="c-btn card-btn" id="c-prev"   style="background:#1a3a1a; color:#7fd97f;">&#9664;</button>
            <button class="c-btn card-btn" id="c-next2"  style="background:#1a3a1a; color:#7fd97f;">&#9654;</button>`;
        document.getElementById('c-sophie').onclick = () => import('./favorite.js').then(f => f.playJanken());
        document.getElementById('c-scr').onclick    = liquor.cardNavToScr;
        document.getElementById('c-list').onclick   = liquor.cardNavToList;
        document.getElementById('c-prev').onclick   = liquor.cardNavPrev;
        document.getElementById('c-next2').onclick  = liquor.cardNavNext;
        return;
    }

    if (nav.state === "none") {
        const shopBaseStyle = "background:rgba(255,228,225,0.6); color:#cc294a; border:3px solid #1e90ff; flex:1; font-size:0.75rem; font-weight:bold;";
        grid.innerHTML = `
            <button class="c-btn" id="btn-shop" style="${shopBaseStyle}"><span>ソフィー</span><br><span>SHOP</span></button>
            <button class="c-btn" id="btn-techo" style="background:rgba(34,34,34,0.8); color:#fff; border:1px solid #777; font-size:1.5rem; flex:1;">📖</button>
            <button class="c-btn" id="ctrl-pause" style="${playCtrlStyle}">⏹️</button>
            <button class="c-btn" id="ctrl-play" style="${playBtnStyle}">▶</button>
            <button class="c-btn" id="btn-next" style="${playCtrlStyle}">⏭</button>`;
        document.getElementById('btn-shop').onclick = () => { nav.updateNav("shop"); shop.openShop(); renderConsole('standard'); };
    } else {
        // [📖][戻る][⏹️][▶][⏭] の共通レイアウト
        grid.innerHTML = `
            <button class="c-btn" id="btn-techo" style="background:rgba(34,34,34,0.8); color:#fff; border:1px solid #777; font-size:1.5rem; flex:1;">📖</button>
            <button class="c-btn" id="ctrl-back" style="background:#34495e; color:#fff; flex:1; font-weight:bold; border:none; box-shadow:none;">戻る</button>
            <button class="c-btn" id="ctrl-pause" style="${playCtrlStyle}">⏹️</button>
            <button class="c-btn" id="ctrl-play" style="${playBtnStyle}">▶</button>
            <button class="c-btn" id="btn-next" style="${playCtrlStyle}">⏭</button>`;

        document.getElementById('ctrl-back').onclick = () => {
            if (nav.state === "techo") {
                import('./favorite.js').then(f => {
                    if (f.getCurrentFolder()) f.openTecho(null);
                    else showRootMenu();
                });
            } else {
                handleBack();
            }
        };
    }

    document.getElementById('ctrl-play').onclick  = music.playHead;
    document.getElementById('ctrl-pause').onclick = music.togglePause;
    document.getElementById('btn-techo').onclick = () => {
        if (nav.state === "techo") showRootMenu();
        else import('./favorite.js').then(f => {
            nav.updateNav("techo");
            f.openTecho(null);
            renderConsole('standard');
        });
    };

    setupNextButton();
}