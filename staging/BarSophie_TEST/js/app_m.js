// js/app_m.js
/**
 * Bar Sophie v22.4 — app_m.js
 * ★ S2でSボタン→リクエストモード（前口上→自動再生）
 */

import * as media    from './media.js';
import * as nav      from './navigation.js';
import * as utils    from './utils.js';
import * as music    from './music.js';
import * as liquor   from './liquor.js';
import * as shop     from './shop.js';

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
    music.setRenderConsole(renderConsole);
    
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

    document.getElementById('btn-music').onclick = () => { if (music.openMusic) music.openMusic(); renderConsole('standard'); };
    document.getElementById('btn-talk').onclick = () => { if (music.openTalk) music.openTalk(); renderConsole('standard'); };
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
                    document.getElementById('monitor-img').src = "";
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

    renderConsole('standard');

    let noticeBtn = document.getElementById('btn-notice');
    if (!noticeBtn && nm) {
        noticeBtn = document.createElement('button');
        noticeBtn.id = 'btn-notice';
        noticeBtn.className = 'act-btn';
        noticeBtn.style.cssText = 'background: linear-gradient(135deg, #1a5276, #2980b9); color:#fff; margin:20px auto 10px; width:calc(100% - 30px); display:block; border:1px solid #5DADE2; font-weight:bold; box-shadow:0 0 10px rgba(41,128,185,0.3);';
        noticeBtn.innerHTML = '📢 ソフィーのお知らせ・使い方';
        noticeBtn.onclick = () => {
            import('./favorite.js').then(f => {
                f.openNotice();
                renderConsole('standard');
            }).catch(e => alert("準備中です"));
        };
        nm.appendChild(noticeBtn);
    }
}

function handleBack() {
    if (nav.state === "techo") {
        import('./favorite.js').then(f => {
            const folder = f.getCurrentFolder();
            if (folder !== null) {
                f.openTecho(null);
                renderConsole('standard');
            } else {
                showRootMenu();
            }
        });
        return;
    }
    if (["shop", "notice"].includes(nav.state)) { showRootMenu(); return; }
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

// ★ 画面ごとのSボタン動作
function handleSButton() {
    // ★ 氷の音
    const ice = new Audio('./voices_mp3/ice.mp3');
    ice.play().catch(() => {});

    const state = nav.state;

    if (state === "tit") {
        // ★ S2（曲リスト）：リクエストモードを起動
        music.startRequestMode();
        return;
    }

    if (state === "shop") {
        import('./janken.js').then(j => j.startJanken());
        return;
    }

    // その他の画面はじゃんけん
    import('./janken.js').then(j => j.startJanken());
}

function renderConsole(mode) {
    const db = document.getElementById('disclaimer-bar');
    if (db) db.style.display = (nav.state === "none") ? 'block' : 'none';

    const grid = document.querySelector('.btn-grid');
    if (!grid) return;

    const noApp   = "-webkit-appearance:none; appearance:none; outline:none;";
    const pCtrl   = `flex:1; background:#1a2b1a; color:#5c9e5c; border:none; border-radius:0; ${noApp}`;
    const pBtn    = `flex:1.0; font-size:1.2rem; background:#1a3a1a; color:#7fd97f; border:none; border-radius:0; ${noApp}`;
    const backBtn = `background:#34495e; color:#fff; flex:1; font-size:0.95rem; font-weight:bold; border:none;`;
    const sBtn    = `background:#1a3a4a; color:#00d2ff; font-size:1.1rem; font-weight:bold; flex:1.0;`;
    const navBtn  = `flex:1; background:#1a2a3a; color:#5ba3d9; font-size:1.1rem; border:none; border-radius:0; touch-action:manipulation; ${noApp}`;

    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="c-btn" id="c-back" style="${backBtn}">戻る</button>
            <button class="c-btn" id="c-clr"  style="background:#5DADE2; color:#fff; flex:1; font-size:0.95rem; text-shadow:0 0 2px rgba(0,0,0,0.5); border:none;">リセット</button>
            <button class="c-btn" id="c-ex"   style="background:#8e44ad; color:#fff; flex:2; font-size:0.95rem; border:none;">検索実行</button>`;
        document.getElementById('c-back').onclick = liquor.openLiquorPortal;
        document.getElementById('c-clr').onclick  = liquor.clearScr;
        document.getElementById('c-ex').onclick   = liquor.execScr;
        return;
    }

    if (mode === 'result') {
        grid.innerHTML = `<button class="c-btn" id="c-mod" style="background:#8e44ad; color:#fff; font-size:0.85rem; border:none;">🔍 検索条件を変更する</button>`;
        document.getElementById('c-mod').onclick = liquor.openScreeningFromConsole;
        return;
    }

    if (mode === 'card') {
        // LT：戻る・S・⏹️・◀・▶
        grid.innerHTML = `
            <button class="c-btn card-btn" id="c-back"   style="${backBtn}">戻る</button>
            <button class="c-btn card-btn" id="c-sophie" style="${sBtn}">S</button>
            <button class="c-btn card-btn" id="ctrl-pause" style="${pCtrl}">⏹️</button>
            <button class="c-btn card-btn" id="c-prev"   style="${navBtn}">&#9664;</button>
            <button class="c-btn card-btn" id="c-next2"  style="${navBtn}">&#9654;</button>`;
        document.getElementById('c-back').addEventListener('click', liquor.cardNavToList);
        document.getElementById('c-sophie').addEventListener('click', handleSButton);
        document.getElementById('ctrl-pause').onclick = music.togglePause;
        document.getElementById('c-prev').addEventListener('click', liquor.cardNavPrev);
        document.getElementById('c-next2').addEventListener('click', liquor.cardNavNext);
        return;
    }

    if (nav.state === "none") {
        const shopBaseStyle = "background:rgba(255, 228, 225, 0.6); color:#cc294a; border:3px solid #1e90ff; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(2px); padding:0; flex:1.0; display:flex;";
        grid.innerHTML = `
            <button class="c-btn" id="btn-shop" style="${shopBaseStyle}">
                <span style="font-size:0.75rem; font-weight:bold; line-height:1.1;">ソフィー</span>
                <span style="font-size:0.75rem; font-weight:bold; line-height:1.1;">おすすめ</span>
                <span style="font-size:0.75rem; letter-spacing:1px; line-height:1.1;">SHOP</span>
            </button>
            <button class="c-btn" id="btn-techo" style="background:rgba(34,34,34,0.8); color:#fff; border:1px solid #777; font-size:1.5rem; flex:1.0; display:flex; justify-content:center; align-items:center;">📖</button>
            <button class="c-btn" id="ctrl-pause" style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"  style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"   style="${pCtrl}">⏭</button>`;
        document.getElementById('btn-shop').onclick = () => { nav.updateNav("shop"); shop.openShop(); renderConsole('standard'); };
    }
    else if (["tit", "st", "lq_list", "lq_res", "shop"].includes(nav.state)) {
        // 最深部＋SHOP：戻る（左端）・S・⏹️・▶・⏭
        grid.innerHTML = `
            <button class="c-btn" id="ctrl-back-txt" style="${backBtn}">戻る</button>
            <button class="c-btn" id="c-sophie-std"  style="${sBtn}">S</button>
            <button class="c-btn" id="ctrl-pause"    style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"     style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"      style="${pCtrl}">⏭</button>`;
        document.getElementById('ctrl-back-txt').onclick = handleBack;
        document.getElementById('c-sophie-std').onclick  = handleSButton;
    }
    else {
        // 中間メニュー：戻る（左端）・メモ・⏹️・▶・⏭
        grid.innerHTML = `
            <button class="c-btn" id="ctrl-back-txt" style="${backBtn}">戻る</button>
            <button class="c-btn" id="btn-techo"     style="background:rgba(34,34,34,0.8); color:#fff; border:1px solid #777; font-size:1.5rem; flex:1.0; display:flex; justify-content:center; align-items:center;">📖</button>
            <button class="c-btn" id="ctrl-pause"    style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"     style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"      style="${pCtrl}">⏭</button>`;
        document.getElementById('ctrl-back-txt').onclick = handleBack;
    }

    const btnTecho = document.getElementById('btn-techo');
    if (btnTecho) {
        btnTecho.onclick = () => {
            import('./favorite.js').then(f => { nav.updateNav("techo"); f.openTecho(null); renderConsole('standard'); });
        };
    }
    const playEl  = document.getElementById('ctrl-play');
    const pauseEl = document.getElementById('ctrl-pause');
    if (playEl)  playEl.onclick  = music.playHead;
    if (pauseEl) pauseEl.onclick = music.togglePause;
    setupNextButton();
}