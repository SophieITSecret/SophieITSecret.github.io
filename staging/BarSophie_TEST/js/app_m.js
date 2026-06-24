// js/app_m.js
/**
 * Bar Sophie v22.4 — app_m.js
 * ★ S2でSボタン→リクエストモード（前口上→自動再生）
 */

import * as media from './media.js';
import * as nav from './navigation.js';
import * as utils from './utils.js';
import * as music from './music.js';
import * as liquor from './liquor.js';
import * as shop from './shop.js';
import * as restaurant from './restaurant.js';
import * as fortune from './fortune.js';
import * as compatibility from './compatibility.js';
import * as people from './people.js';
import { showWelcomePage, showMyPage } from './mypage.js';
import * as guestFlow from './guest_flow.js';
import * as djSophie from './dj_sophie.js';

const SOPHIE_VOICE_TIMING = {
  entry:   0,
  counter: 0,
  music:   1000,
  song:    1500,
  sake:    1000,
  find:    1000,
  talk:    0,
  rest:    500,
  fortune: 1000,
  news:    500,
  note:    500,
};

function playSophieVoice(screen) {
  if (window._djNarrationActive) return;
  if (window._lastSophieVoiceAudio) {
    window._lastSophieVoiceAudio.pause();
    window._lastSophieVoiceAudio = null;
  }
  const _cat = window.currentUserData?.createdAt;
  const isNewComer = _cat && typeof _cat.toMillis === 'function' &&
    (Date.now() - _cat.toMillis() < 24 * 60 * 60 * 1000);

  let file;
  if (isNewComer && ['entry', 'counter'].includes(screen)) {
    file = `sophie_${screen}_nc.mp3`;
  } else {
    const rand = Math.random();
    const code = screen === 'entry' || screen === 'counter'
      ? (rand < 0.7 ? 'a' : 'b')
      : (rand < 0.5 ? 'a' : rand < 0.7 ? 'b' : rand < 0.9 ? 'c' : 'r');
    file = `sophie_${screen}_${code}.mp3`;
  }

  const delay = SOPHIE_VOICE_TIMING[screen] || 0;
  setTimeout(() => {
    const audio = new Audio(`voices_mp3/${file}`);
    window._lastSophieVoiceAudio = audio;
    audio.play().catch(() => {});
  }, delay);
}

window.playSophieVoice = playSophieVoice;

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
    window._renderConsole = renderConsole;
    window._showRootMenu = showRootMenu;
    window._startCounterFlow = () => {
        const isGuest = guestFlow.startCounterFlow(showRootMenu);
        if (!isGuest) playSophieVoice('counter');
    };

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
                window._ytPlayer = ytPlayer;
                music.setYtReady(ytPlayer);
                music.initMusic(talkAudio, ytPlayer, true, document.getElementById('telop'));
            },
            onStateChange: (e) => {
                if (e.data === YT.PlayerState.ENDED) {
                    if (window._djYtEndCallback) {
                        const fn = window._djYtEndCallback;
                        window._djYtEndCallback = null;
                        fn();
                        return;
                    }
                    if (window._djYtPreloading) return; // DJプリロード中はmusic.next()スキップ
                    if (music.isAutoPlayMode && music.isAutoPlayMode()) {
                        music.nextAutoPlay();
                    } else if (music.isAutoPlay && music.isMusicMode) {
                        music.next();
                    }
                }
            },
            onError: () => {
                if (window._djYtEndCallback) {
                    const fn = window._djYtEndCallback;
                    window._djYtEndCallback = null;
                    fn();
                }
            }
        }
    });
};

function setup() {
    music.initMusic(talkAudio, null, false, document.getElementById('telop'));
    talkAudio.onended = music.defaultOnEnded;

    document.getElementById('btn-enter').onclick = () => {
        const es = document.getElementById('entry-screen');
        es.style.transition = 'opacity 1s ease';
        es.style.opacity = '0';
        setTimeout(() => {
            es.style.display = 'none';
            es.style.opacity = '';
            es.style.transition = '';
            document.getElementById('chat-mode').style.display = 'flex';
            if (ytPlayerReady && ytPlayer) {
                try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch (e) { }
            }
            playVoice("./voices_mp3/greeting.mp3", "いらっしゃいませ。");
        }, 1000);
    };

    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        window.speechSynthesis.cancel();
        talkAudio.pause();
        showRootMenu();
        const isGuest = guestFlow.startCounterFlow(showRootMenu);
        if (!isGuest) playSophieVoice('counter');
    };

    document.getElementById('btn-music').onclick = _showMusicSubmenu;
    document.getElementById('btn-sake').onclick = () => {
        nav.updateNav("notice");
        utils.setListView(`
            <div style="padding:12px; display:flex; flex-direction:column; gap:8px;">
                <button class="act-btn" id="sake-liquor" style="background:#8e44ad;">🍸 お酒を探す</button>
                <button class="act-btn" id="sake-talk" style="background:var(--talk);">🥃 お酒の話</button>
            </div>`, false);
        renderConsole('standard');
        document.getElementById('sake-liquor').onclick = liquor.openLiquorPortal;
        document.getElementById('sake-talk').onclick = () => { if (music.openTalk) music.openTalk(); renderConsole('standard'); };
    };
    // ★以下2行を追加
    document.getElementById('btn-news').onclick = () => showNewsMarket();
    document.getElementById('btn-notice').onclick = () => {
        const ice = new Audio('./voices_mp3/ice.mp3');
        ice.onended = () => { import('./favorite.js').then(f => { f.openNotice(); renderConsole('standard'); }); };
        ice.play().catch(() => { import('./favorite.js').then(f => { f.openNotice(); renderConsole('standard'); }); });
    };
    document.getElementById('sophie-warp').onclick = () => {
        if (nav.state !== "none") {
            showRootMenu();
        } else {
            document.getElementById('main-ui').style.display = 'none';
            document.getElementById('chat-mode').style.display = 'flex';
            const loungeText = document.getElementById('lounge-text');
            loungeText.innerText = "ありがとうございました。";
            window.speechSynthesis.cancel();
            if (ytPlayerReady && ytPlayer) { try { ytPlayer.pauseVideo(); } catch (e) { } }
            try { talkAudio.pause(); } catch (e) { }
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
            try { const p = talkAudio.play(); if (p) p.catch(finalize); } catch (e) { finalize(); }
        }
    };

    setupNextButton();
    renderConsole('standard');
    showRootMenu();

    import('./sophie_today.js').then(m => m.initToday(showRootMenu));

    window._appSetupDone = true;
    if (window._handlePurchaseOnSetup) {
        const fn = window._handlePurchaseOnSetup;
        window._handlePurchaseOnSetup = null;
        fn();
    }
    if (window._handleTokenNavOnSetup) {
        const fn = window._handleTokenNavOnSetup;
        window._handleTokenNavOnSetup = null;
        fn();
    }
}

function playVoice(src, txt) {
    talkAudio.src = src;
    talkAudio.onerror = () => { try { media.speak(txt); } catch (e) { } };
    try {
        const p = talkAudio.play();
        if (p !== undefined) p.catch(() => { try { media.speak(txt); } catch (e) { } });
    } catch (e) { try { media.speak(txt); } catch (err) { } }
}

function showRootMenu() {
    if (window._lastSophieVoiceAudio) {
        window._lastSophieVoiceAudio.pause();
        window._lastSophieVoiceAudio = null;
    }
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const img = document.getElementById('monitor-img');
    const yt = document.getElementById('yt-wrapper');
    const tel = document.getElementById('telop');
    const mon = document.querySelector('.monitor');

    lv.style.display = 'none';
    nm.style.display = 'block';
    nav.updateNav("none");
    window._cancelGuestCaution?.();
    document.getElementById('sophie-caution')?.remove();
    document.getElementById('daily-advice-pill')?.remove();
    yt.style.display = 'none';
    img.src = './front_sophie.jpeg';
    img.style.display = 'block';
    // ★chart-frameをクリア
    const cw = document.getElementById('chart-wrapper');
    if (cw) { cw.style.display = 'none'; cw.innerHTML = ''; }
    if (tel) tel.style.display = 'none';
    if (mon) { mon.classList.remove('expanded'); }
    utils.showLSide();

    if (window.currentUser) { _insertDailyAdviceButton(); _insertHintButton(); }
    if (window.currentUserData?.role === 'admin') { _insertMenuModeToggle(); }
    renderConsole('standard');

    if (_isTsundereMode()) {
        _initTsundereMenu();
    } else {
        _restoreClassicHandlers();
        ['btn-music', 'btn-sake', 'btn-news'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }
}

// ---- ツンデレ動的メニュー ----

let _wrongCount = 0;

const _TD_BUTTONS = [
    { id: 'td-music',      emoji: '🎵', label: '音楽',           prob: 0.30, needsLogin: false,
      action: () => _showMusicSubmenu() },
    { id: 'td-sake',       emoji: '🍸', label: 'お酒',           prob: 0.20, needsLogin: false,
      action: () => document.getElementById('btn-sake')?.click() },
    { id: 'td-news',       emoji: '📰', label: 'ニュース',       prob: 0.15, needsLogin: false,
      action: () => showNewsMarket() },
    { id: 'td-konohi',     emoji: '📅', label: 'この日どんな日', prob: 0.15, needsLogin: true,
      action: () => { nav.updateNav('konohi'); import('./konohi.js').then(k => k.showKonoHi(showRootMenu)); } },
    { id: 'td-fortune',    emoji: '🔮', label: '占い',           prob: 0.10, needsLogin: true,
      action: async () => { if (!await window.checkAccess?.('fortune_haiku')) return; fortune.showFortuneMenu(); } },
    { id: 'td-restaurant', emoji: '🗺️', label: '店探し',        prob: 0.05, needsLogin: true,
      action: async () => { if (!await window.checkAccess?.('restaurant_search')) return; restaurant.showRestaurantSearch(); } },
    { id: 'td-janken',     emoji: '✋', label: 'じゃんけん',     prob: 0.05, needsLogin: false,
      action: () => import('./janken.js').then(j => j.startJanken()) },
];

function _isTsundereMode() {
    return (localStorage.getItem('sophie_menu_mode') || 'tsundere') === 'tsundere';
}

function _initTsundereMenu() {
    _wrongCount = 0;
    ['btn-music', 'btn-sake', 'btn-news'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.style.animation = ''; }
    });
    const area = document.getElementById('tsundere-random-area');
    if (area) { area.innerHTML = ''; area.style.display = 'none'; }
    const btnNotice = document.getElementById('btn-notice');
    if (btnNotice) {
        btnNotice.onclick = () => {
            _playTdVoice('./voices_mp3/sophie_counter_offer.mp3');
            _tdShowRandom();
        };
    }
}

function _tdPickTwo(exclude = []) {
    const avail = _TD_BUTTONS.filter(b => !exclude.includes(b.id));
    const pickOne = (pool) => {
        let r = Math.random() * pool.reduce((s, b) => s + b.prob, 0);
        for (const b of pool) { r -= b.prob; if (r <= 0) return b; }
        return pool[pool.length - 1];
    };
    const first  = pickOne(avail);
    const second = pickOne(avail.filter(b => b.id !== first.id));
    return [first, second];
}

function _tdShowRandom(exclude = []) {
    const area = document.getElementById('tsundere-random-area');
    if (!area) return;
    const picked   = _tdPickTwo(exclude);
    const isGuest  = !window.currentUser;
    area.innerHTML = '';
    area.style.display = 'flex';

    picked.forEach((btn, i) => {
        const locked = isGuest && btn.needsLogin;
        const el = document.createElement('button');
        el.className = 'act-btn';
        el.style.cssText = `width:92%; animation: sophieButtonIn 0.4s ease ${i * 0.15}s both;
            ${locked ? 'opacity:0.45; filter:grayscale(0.6);' : ''}`;
        el.dataset.tdId = btn.id;
        el.textContent  = `${btn.emoji} ${btn.label}`;
        el.onclick = () => {
            if (locked) { _tdGuestPrompt(); return; }
            _tdClearArea();
            _wrongCount = 0;
            btn.action();
        };
        area.appendChild(el);
    });

    // 操作ボタン行
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; width:92%; animation: sophieButtonIn 0.4s ease 0.3s both;';
    row.innerHTML = `
        <button id="td-wrong-btn" class="act-btn"
            style="flex:1; background:#2a1a1a; border:1px solid #884444; color:#ffaaaa;
                   font-size:0.85rem; margin-bottom:0;">❌ 違うよ</button>
        <button id="td-menu-btn" class="act-btn"
            style="flex:1; background:#1a1a2a; border:1px solid #448844; color:#aaffaa;
                   font-size:0.85rem; margin-bottom:0;">📋 メニュー見せて</button>`;
    area.appendChild(row);

    area.dataset.picked = picked.map(b => b.id).join(',');
    document.getElementById('td-wrong-btn').onclick = _tdHandleWrong;
    document.getElementById('td-menu-btn').onclick  = _tdHandleShowMenu;
}

function _tdHandleWrong() {
    _wrongCount++;
    if (_wrongCount >= 3) { _tdOshioki(); return; }
    const mp3 = _wrongCount === 1 ? 'sophie_counter_wrong1.mp3' : 'sophie_counter_wrong2.mp3';
    _playTdVoice(`./voices_mp3/${mp3}`);
    const area  = document.getElementById('tsundere-random-area');
    const btns  = area.querySelectorAll('button[data-td-id]');
    btns.forEach(b => { b.style.animation = 'sophieButtonOut 0.3s ease forwards'; });
    const prev  = (area.dataset.picked || '').split(',');
    setTimeout(() => _tdShowRandom(prev), 380);
}

function _tdOshioki() {
    _playTdVoice('./voices_mp3/sophie_counter_oshioki.mp3');
    const area = document.getElementById('tsundere-random-area');
    const all  = [...area.querySelectorAll('button')];
    all.forEach((b, i) => {
        setTimeout(() => { b.style.animation = 'sophieButtonOut 0.25s ease forwards'; }, i * 120);
    });
    setTimeout(() => {
        _tdClearArea();
        _wrongCount = 0;
        // BGMダッキング
        try { window._ytPlayer?.setVolume(20); } catch(e) {}
        const yt  = document.getElementById('yt-wrapper');
        const img = document.getElementById('monitor-img');
        if (yt)  yt.style.display  = 'block';
        if (img) img.style.display = 'none';
        const prev = window._djYtEndCallback;
        window._djYtEndCallback = () => {
            window._djYtEndCallback = prev;
            try { window._ytPlayer?.setVolume(100); } catch(e) {}
            showRootMenu();
        };
        try { window._ytPlayer?.loadVideoById('2vfCbdmKhMw'); } catch(e) {}
    }, all.length * 120 + 350);
}

function _tdHandleShowMenu() {
    _playTdVoice('./voices_mp3/sophie_counter_menu.mp3');
    _wrongCount = 0;
    _tdClearArea();
    _restoreClassicHandlers();
    ['btn-music', 'btn-sake', 'btn-news'].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) { el.style.display = ''; el.style.animation = `sophieButtonIn 0.4s ease ${i * 0.1}s both`; }
    });
}

function _tdClearArea() {
    const area = document.getElementById('tsundere-random-area');
    if (area) { area.innerHTML = ''; area.style.display = 'none'; }
}

function _tdGuestPrompt() {
    const a = new Audio('./voices_mp3/guest_login_01.mp3');
    a.play().catch(() => {});
    const area = document.getElementById('tsundere-random-area');
    if (!area || document.getElementById('td-login-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'td-login-btn';
    btn.className = 'act-btn';
    btn.style.cssText = 'width:92%; background:#1a1a3a; border:1px solid #5ba3d9; color:#5ba3d9; animation: sophieButtonIn 0.4s ease both;';
    btn.textContent = '🔑 会員登録する';
    btn.onclick = () => showMyPage(showRootMenu);
    area.appendChild(btn);
}

function _restoreClassicHandlers() {
    const btnNotice = document.getElementById('btn-notice');
    if (btnNotice) {
        btnNotice.onclick = () => {
            const ice = new Audio('./voices_mp3/ice.mp3');
            ice.onended = () => { import('./favorite.js').then(f => { f.openNotice(); renderConsole('standard'); }); };
            ice.play().catch(() => { import('./favorite.js').then(f => { f.openNotice(); renderConsole('standard'); }); });
        };
    }
}

function _playTdVoice(src) {
    const a = new Audio(src);
    a.play().catch(() => {});
}

function _showMusicSubmenu() {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    if (nm) nm.style.display = 'none';
    if (lv) {
        lv.style.display = 'block';
        lv.innerHTML = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background:linear-gradient(#111,#111) padding-box,
                        linear-gradient(120deg,#ff69b4 50%,#00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                    <img src="./sophie_face.png" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">
                    🎵 DJソフィー／音楽リクエスト
                </div>
                <div style="padding:10px; display:flex; flex-direction:column; gap:8px;">
                    <button class="act-btn" id="ms-dj"
                            style="background:#1a1a2e; border:1.5px solid #ff69b4; color:#ff69b4;">
                        🎙️ DJソフィーの歌とお酒の物語
                    </button>
                    <button class="act-btn" id="ms-music" style="background:var(--green);">
                        🎵 音楽リクエスト
                    </button>
                </div>
            </div>`;
    }
    nav.updateNav('notice');
    renderConsole('standard');

    document.getElementById('ms-dj').onclick = () => {
        djSophie.showDJList(showRootMenu);
    };
    document.getElementById('ms-music').onclick = () => {
        if (music.openMusic) music.openMusic();
        renderConsole('standard');
    };
}

function _insertDailyAdviceButton() {
    if (document.getElementById('daily-advice-pill')) return;
    const bar = document.getElementById('label-bar');
    if (!bar) return;
    const todayKey = new Date().toISOString().slice(0, 10);
    let cached = null;
    try { const r = JSON.parse(localStorage.getItem('sophie_daily_fortune') || 'null'); cached = r && r.date === todayKey ? r : null; } catch {}
    const pill = document.createElement('div');
    pill.id = 'daily-advice-pill';
    pill.style.cssText = 'flex-shrink:0; margin:0 10px 0 4px;';
    pill.innerHTML = `<button id="btn-daily-advice"
        style="background:${cached ? '#1a2a1a' : '#111'}; border:1px solid ${cached ? '#3a6a4a' : '#333'};
               color:${cached ? '#7fd97f' : '#888'};
               border-radius:50px; padding:2px 8px; height:20px;
               cursor:pointer; -webkit-tap-highlight-color:transparent;
               display:inline-flex; align-items:center; gap:3px; font-size:0.63rem; white-space:nowrap;">
        🌙${cached ? '今日のアドバイス✓' : '今日のアドバイス'}
    </button>`;
    const dateInfo = document.getElementById('today-date-info');
    bar.insertBefore(pill, dateInfo ? dateInfo.nextSibling : bar.lastChild);
    document.getElementById('btn-daily-advice').addEventListener('click', () => {
        import('./fortune.js').then(f => {
            nav.updateNav('fortune');
            f.showDailyAdvice(showRootMenu);
        });
    });
}

function _insertMenuModeToggle() {
    if (document.getElementById('admin-menu-toggle')) return;
    const row = document.getElementById('today-row');
    if (!row) return;
    const mode = localStorage.getItem('sophie_menu_mode') || 'tsundere';
    const wrap = document.createElement('div');
    wrap.id = 'admin-menu-toggle';
    wrap.style.cssText = 'flex-shrink:0; margin-left:2px;';
    wrap.innerHTML = `<button id="btn-mode-toggle"
        title="メニューモード切替（管理者）"
        style="background:${mode === 'tsundere' ? '#2a1a2a' : '#1a2a1a'}; border:1px solid ${mode === 'tsundere' ? '#aa66aa' : '#66aa66'};
               color:${mode === 'tsundere' ? '#cc88cc' : '#88cc88'};
               border-radius:50px; padding:3px 8px; cursor:pointer;
               display:inline-flex; align-items:center; gap:3px; font-size:0.65rem;">
        ⚙ ${mode === 'tsundere' ? 'ツンデレ' : 'クラシック'}
    </button>`;
    row.appendChild(wrap);
    document.getElementById('btn-mode-toggle').addEventListener('click', () => {
        const next = (localStorage.getItem('sophie_menu_mode') || 'tsundere') === 'tsundere' ? 'classic' : 'tsundere';
        localStorage.setItem('sophie_menu_mode', next);
        wrap.remove();
        showRootMenu();
    });
}

function _insertHintButton() {
    if (document.getElementById('sophie-caution')) return;
    const row = document.getElementById('today-row');
    if (!row) return;
    const hint = document.createElement('div');
    hint.id = 'sophie-caution';
    hint.style.cssText = 'flex-shrink:0;';
    hint.innerHTML = `<button id="btn-howto-hint"
        style="background:#ffffff; border:1px solid #5ba3d9; color:#444;
               border-radius:50px; padding:3px 8px 3px 10px;
               cursor:pointer; -webkit-tap-highlight-color:transparent;
               display:inline-flex; align-items:center; gap:4px; font-size:0.68rem;">
        <img src="./sophie_face.png" style="width:16px; height:16px; border-radius:50%; object-fit:cover; flex-shrink:0;">
        お店の使い方
    </button>`;
    row.appendChild(hint);
    document.getElementById('btn-howto-hint').addEventListener('click', () => {
        hint.remove();
        import('./guide.js').then(g => g.showGuideScreen(showRootMenu));
    });
}

function handleBack() {
    if (window._restaurantBack && (document.getElementById('rs-search') || document.getElementById('rs-retry'))) {
        window._restaurantBack();
        return;
    }
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
    if (nav.state === 'dj') { showRootMenu(); return; }
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
    const ice = new Audio('./voices_mp3/ice.mp3');
    ice.onended = () => showSophieMenu();
    ice.play().catch(() => showSophieMenu());
}

function showSophieMenu() {
    const state = nav.state;

    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    // ★ニュース・マーケット画面の場合は保存しない
    const isNewsScreen = lv && lv.querySelector('#nm-ann');
    const prevHtml = (lv && !isNewsScreen) ? lv.innerHTML : '';
    const prevDisplay = (lv && !isNewsScreen) ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const specificItems = {
        "tit": [
            { label: "🎵 DJソフィー（解説＋自動再生）", action: () => music.startRequestMode() },
            { label: "🔁 連続再生", action: () => showAutoPlaySelect() },
        ],
        "lq_list": [
            { label: "📖 カテゴリー解説", disabled: true },
            { label: "⭐ ソフィーのイチ押し銘柄", disabled: true },
        ],
        "lq_scr": [
            { label: "📖 スクリーニング使い方ガイド", disabled: true },
        ],
        "st": [
            { label: "📋 記事の目次ナビゲーター", disabled: true },
        ],
        "techo": [
            { label: "🔁 連続再生（お気に入りの歌）", action: () => showTechoAutoPlay() },
        ],
    };

    const specific = specificItems[state] || [];

    const specificHtml = specific.length ? specific.map((item, i) =>
        item.disabled
            ? `<button class="act-btn" style="background:#1a1a1a; color:#444; border:1px solid #222; margin-bottom:8px;" disabled>${item.label}（準備中）</button>`
            : `<button class="act-btn s-menu-specific" data-idx="${i}" style="background:#1a5276; border-color:#1a5276; margin-bottom:8px;">${item.label}</button>`
    ).join('') : '';

    const menuHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                お呼びですか？
            </div>
            <div style="padding:10px;">
                ${specificHtml}
                ${specific.length ? '<div style="border-top:1px solid #222; margin:8px 0;"></div>' : ''}
                <button class="act-btn" id="sm-restaurant" style="background:#1a3a2a; margin-bottom:8px;">🍽️ いいお店を探す</button>
                <button class="act-btn" id="sm-fortune" style="background:#2a1a3a; margin-bottom:8px;">🔮 ソフィーの天命診断</button>
                <button class="act-btn" id="sm-janken" style="background:#8e1a2e; margin-bottom:8px;">🎲 じゃんけん勝負</button>
                <button class="act-btn" style="background:#1a1a1a; color:#444; border:1px solid #222; margin-bottom:8px;" disabled>📅 この日はどんな日（近日公開）</button>
                <button class="act-btn" id="sm-close" style="background:#34495e; margin-top:4px;">閉じる</button>
            </div>
        </div>`;

if (lv) { lv.style.display = 'block'; lv.innerHTML = menuHtml; }
    if (nm) nm.style.display = 'none';

    document.getElementById('sm-restaurant').onclick = async () => {
        if (!await window.checkAccess('restaurant_search')) return;
        import('./restaurant.js').then(r => r.showRestaurantSearch());
    };
    document.getElementById('sm-fortune').onclick = async () => {
        if (!await window.checkAccess('fortune_haiku')) return;
        import('./fortune.js').then(f => f.showFortuneMenu());
    };
    document.getElementById('sm-janken').onclick = () => {
        import('./janken.js').then(j => j.startJanken());
    };
    document.getElementById('sm-close').onclick = () => {
        if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
        if (nm) nm.style.display = prevNm;
    };
    document.querySelectorAll('.s-menu-specific').forEach(btn => {
        const idx = parseInt(btn.dataset.idx);
        if (specific[idx] && !specific[idx].disabled) {
            btn.onclick = () => specific[idx].action();
        }
    });
}

function showNewsMarket() {
    playSophieVoice('news');
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    if (nm) nm.style.display = 'none';
    nav.updateNav("lq_main");
    renderConsole('standard');

    const showYoutube = (videoId) => {
        const cw = document.getElementById('chart-wrapper');
        if (cw) { cw.style.display = 'none'; cw.innerHTML = ''; }
        const yt = document.getElementById('yt-wrapper');
        const img = document.getElementById('monitor-img');
        const lside = document.querySelector('.l-side');
        if (lside) lside.style.display = 'flex';
        if (img) img.style.display = 'none';
        if (yt) {
            // ★一旦空にしてから新しいiframeを入れる
            yt.style.display = 'none';
            yt.innerHTML = '';
            setTimeout(() => {
                yt.style.display = 'block';
                yt.innerHTML = `<iframe width="100%" height="100%" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1" 
                frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
            }, 100);
        }
    };

    const showChart = (symbol) => {
        const cw = document.getElementById('chart-wrapper');
        const yt = document.getElementById('yt-wrapper');
        const img = document.getElementById('monitor-img');
        const lside = document.querySelector('.l-side');
        if (lside) lside.style.display = 'flex';
        if (img) img.style.display = 'none';
        if (yt) yt.style.display = 'none';
        if (cw) {
            cw.style.display = 'block';
            cw.innerHTML = `<iframe 
                src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&theme=dark&style=1&timezone=Etc%2FUTC&locale=ja" 
                width="100%" height="100%" frameborder="0"></iframe>
                <div id="chart-error" style="display:none; color:#888; padding:20px; text-align:center;">シンボルが見つかりません</div>`;
        }
    };

    const openLink = (url) => window.open(url, '_blank');

    const mainHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0;">📰 NEWS・マーケット</div>
            <div style="padding:10px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <button class="act-btn nm-btn" id="nm-ann"     style="background:#1a3a4a; margin:0;">📺 テレ朝NEWS24</button>
                    <button class="act-btn nm-btn" id="nm-weather" style="background:#1a3a4a; margin:0; font-size:0.8rem;">🌤 ウェザーニュース</button>
                    <button class="act-btn nm-btn" id="nm-camera"  style="background:#1a2a1a; margin:0;">📷 ライブカメラ</button>
                    <button class="act-btn nm-btn" id="nm-market"  style="background:#1a1a3a; margin:0;">📊 マーケット</button>
                    <button class="act-btn nm-btn" id="nm-newsmenu" style="background:#2a1a1a; margin:0;">📰 ニュース・情報</button>
                    <button class="act-btn nm-btn" id="nm-useful"  style="background:#1a2a2a; margin:0;">🔗 便利情報</button>
                </div>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = mainHtml; }

    document.getElementById('nm-ann').onclick = () => showYoutube('coYw-eVU0Ks');
    document.getElementById('nm-weather').onclick = () => window.open('https://www.youtube.com/channel/UCNsidkYpIAQ4QaufptQBPHQ/live', '_blank');

    document.getElementById('nm-camera').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">📷 ライブカメラ</div>
                <div style="padding:10px;">
                   <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🇯🇵 日本</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=8H3nRCFVR6Y','_blank')">🗼 渋谷スクランブル</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=bzn2QWfOLFY','_blank')">🏮 大阪・道頓堀</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=X5rq4ioggLk','_blank')">🌸 京都・花見小路</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=Sv9hcJ3k5h4','_blank')">🗻 富士山(河口湖4K)</button>
                    </div>
                    <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🌍 世界の都市</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" id="cam-nyc"    style="background:#1a2a3a; margin:0; font-size:0.85rem;">🗽 NYC タイムズSq</button>
                        <button class="act-btn" id="cam-paris"  style="background:#1a2a3a; margin:0; font-size:0.85rem;">🗼 パリ エッフェル</button>
                        <button class="act-btn" id="cam-london" style="background:#1a2a3a; margin:0; font-size:0.85rem;">🎡 ロンドン・ビッグベン</button>
                        <button class="act-btn" id="cam-sydney" style="background:#1a2a3a; margin:0; font-size:0.85rem;">🌉 シドニー・オペラハウス</button>
                        <button class="act-btn" id="cam-rome"   style="background:#1a2a3a; margin:0; font-size:0.85rem;">🏛 ローマ・トレビの泉</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.earthcam.com/world/','_blank')">🌐 その他世界中</button>
                    </div>
                    <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🚀 特別</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#0a0a2a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=vytmBNhc9ig','_blank')">🌏 NASA 地球ライブ</button>
                        <button class="act-btn" style="background:#1a2a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=qpukdDslCjk','_blank')">🦁 アフリカサファリ</button>
                    </div>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        renderConsole('standard');

        document.getElementById('cam-nyc').onclick    = () => showYoutube('PGrq-2mju2s');
        document.getElementById('cam-paris').onclick = () => window.open('https://www.earthtv.com/en/webcam/paris-eiffel-tower', '_blank');
        document.getElementById('cam-london').onclick = () => showYoutube('VgRo9SBQW3U');
        document.getElementById('cam-sydney').onclick = () => showYoutube('7pcL-0Wo77U');
        document.getElementById('cam-rome').onclick   = () => showYoutube('jXYQoWAKgFE');
    };

    document.getElementById('nm-market').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">📊 マーケット</div>
                <div style="padding:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" id="mkt-nk">📈 日経平均</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" id="mkt-fx">📈 ドル円</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" id="mkt-oil">📈 原油(WTI)</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" id="mkt-spx">📈 S&P500</button>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
                        <input type="text" id="nm-code" placeholder="7203 AAPL NYSE:IBM" 
                            style="width:110px; background:#000; border:1px solid #555; color:#fff; 
                                   height:44px; padding:0 8px; border-radius:4px; font-size:0.9rem;">
                        <button id="nm-search" style="background:#34495e; color:#fff; border:none; 
                            height:44px; flex:1; border-radius:4px; font-size:0.9rem;">🔍 検索</button>
                        <button id="nm-go" style="background:#8e1a2e; color:#fff; border:none; 
                            height:44px; flex:1; border-radius:4px; font-size:0.9rem;">▶ 表示</button>
                    </div>
                    <div style="color:#666; font-size:0.7rem; margin-bottom:10px;">
                        日本株：4桁　米国株：ティッカー　NYSE：NYSE:銘柄
                    </div>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        renderConsole('standard');

        document.getElementById('mkt-nk').onclick  = () => { const cw=document.getElementById('chart-wrapper'); if(cw) cw.innerHTML=''; showChart('FOREXCOM:JP225'); };
        document.getElementById('mkt-fx').onclick  = () => { const cw=document.getElementById('chart-wrapper'); if(cw) cw.innerHTML=''; showChart('FX:USDJPY'); };
        document.getElementById('mkt-oil').onclick = () => { const cw=document.getElementById('chart-wrapper'); if(cw) cw.innerHTML=''; showChart('TVC:USOIL'); };
        document.getElementById('mkt-spx').onclick = () => { const cw=document.getElementById('chart-wrapper'); if(cw) cw.innerHTML=''; showChart('CAPITALCOM:US500'); };

        document.getElementById('nm-search').onclick = () => {
            const code = document.getElementById('nm-code').value.trim();
            if (!code) return;
            window.open(`https://www.google.com/search?q=${encodeURIComponent(code + ' 株価 証券コード')}`, '_blank');
        };
       document.getElementById('nm-go').onclick = () => {
    let code = document.getElementById('nm-code').value.trim().toUpperCase();
    if (!code) return;
    // N:IBM → NYSE:IBM に自動変換
    if (code.startsWith('N:')) {
        code = 'NYSE:' + code.slice(2);
    }
    if (/^\d+$/.test(code)) {
        window.open(`https://finance.yahoo.co.jp/quote/${code}.T`, '_blank');
    } else if (code.startsWith('NYSE:') || code.startsWith('NASDAQ:') || code.startsWith('TSE:')) {
        showChart(code);
    } else {
        showChart(`NASDAQ:${code}`);
    }
};
    };

    document.getElementById('nm-newsmenu').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">📰 ニュース・情報</div>
                <div style="padding:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://jp.reuters.com','_blank')">📰 ロイター</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www3.nhk.or.jp/news/','_blank')">📰 NHK NEWS</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.bbc.com/japanese','_blank')">📰 BBC日本語</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://toyokeizai.net','_blank')">📰 東洋経済</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.nikkei.com','_blank')">📰 日本経済新聞</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://news.yahoo.co.jp','_blank')">📰 Yahooニュース</button>
                    </div>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        renderConsole('standard');
    };

    document.getElementById('nm-useful').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">🔗 便利情報</div>
                <div style="padding:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.flightradar24.com','_blank')">✈️ フライトレーダー</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://artscape.jp/exhibition/','_blank')">🏛 イベント情報</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://tabelog.com','_blank')">🍽 食べログ</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.jma.go.jp/bosai/','_blank')">📡 気象庁防災情報</button>
                    </div>
                    <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🔍 Wikipedia検索</div>
                    <div style="display:flex; gap:6px; align-items:center; margin-bottom:10px;">
                        <input type="text" id="wiki-input" placeholder="調べたいことを入力"
                            onfocus="this.select()"
                            style="flex:1; background:#000; border:1px solid #555; color:#fff; 
                                   height:44px; padding:0 8px; border-radius:4px; font-size:0.9rem;">
                        <button id="wiki-go" style="background:#1a3a4a; color:#fff; border:none; 
                            height:44px; padding:0 20px; border-radius:4px; font-size:1rem;">🔍 検索</button>
                    </div>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        renderConsole('standard');
        document.getElementById('wiki-go').onclick = () => {
            const q = document.getElementById('wiki-input').value.trim();
            if (!q) return;
            window.open(`https://ja.wikipedia.org/wiki/${encodeURIComponent(q)}`, '_blank');
        };
    };
}

function showAutoPlaySelect() {
    try {
        const lv = document.getElementById('list-view');
        const favSongs = nav.curP.filter(m => {
            try {
                const raw = localStorage.getItem('bar_sophie_techo');
                const data = raw ? JSON.parse(raw) : { favorites: [] };
                const favIds = data.favorites || [];
                const songId = `S-${String(m.code).padStart(4, '0')}`;
                return favIds.includes(songId);
            } catch (e) { return false; }
        });

        const menuHtml = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">🔁 連続再生</div>
                <div style="padding:10px;">
                    ${favSongs.length === 0
                ? `<div style="color:#888; text-align:center; padding:15px; font-size:0.9rem;">お気に入りがありません</div>
                           <button class="act-btn" id="ap-back" style="background:#34495e;">戻る</button>`
                : `<button class="act-btn" id="ap-fav" style="background:#8e1a2e; margin-bottom:8px;">❤️ お気に入りのみ（${favSongs.length}曲）</button>
                           <button class="act-btn" id="ap-all" style="background:#1a5276; margin-bottom:8px;">🎵 全曲（${nav.curP.length}曲）</button>
                           <button class="act-btn" id="ap-back" style="background:#34495e;">戻る</button>`
            }
                </div>
            </div>`;

        if (lv) { lv.style.display = 'block'; lv.innerHTML = menuHtml; }

        document.getElementById('ap-back').onclick = () => showSophieMenu();
        if (favSongs.length > 0) {
            document.getElementById('ap-fav').onclick = () => showAutoPlaySongSelect(favSongs);
            document.getElementById('ap-all').onclick = () => showAutoPlaySongSelect([...nav.curP]);
        }
    } catch (e) {
        alert('error: ' + e.message);
    }
}

function showTechoAutoPlay() {
    const raw = localStorage.getItem('bar_sophie_techo');
    const data = raw ? JSON.parse(raw) : { favorites: [] };
    const favIds = (data.favorites || []).filter(id => id.startsWith('S-'));
    const favSongs = favIds.map(id => {
        const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
        return nav.jData.find(d => parseInt(d.code, 10) === num);
    }).filter(Boolean);

    if (favSongs.length === 0) {
        alert('お気に入りの歌がありません');
        return;
    }
    showAutoPlaySongSelect(favSongs);
}

function showAutoPlaySongSelect(list) {
    const lv = document.getElementById('list-view');
    let h = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0;">▶ どの曲からスタートしますか？</div>
            <div style="padding:5px 0;">`;
    list.forEach((m, i) => {
        h += `<div class="item ap-start-item" data-idx="${i}" style="font-size:1.05rem; padding:0.2em 15px; color:#eee;">🎵 ${m.ti}</div>`;
    });
    h += `</div></div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = h; }

    document.querySelectorAll('.ap-start-item').forEach(el => {
        el.onclick = () => {
            const idx = parseInt(el.dataset.idx);
            music.startAutoPlay(list, idx);
        };
    });
}



function renderConsole(mode) {
    const db = document.getElementById('disclaimer-bar');
    if (db) db.style.display = (nav.state === "none") ? 'block' : 'none';

    const grid = document.querySelector('.btn-grid');
    if (!grid) return;

    const noApp = "-webkit-appearance:none; appearance:none; outline:none;";
    const pCtrl = `flex:1; background:#1a2b1a; color:#5c9e5c; border:none; border-radius:0; ${noApp}`;
    const pBtn = `flex:1.0; font-size:1.2rem; background:#1a3a1a; color:#7fd97f; border:none; border-radius:0; ${noApp}`;
    const backBtn = `background:#34495e; color:#fff; flex:1; font-size:0.95rem; font-weight:bold; border:1px solid #5ba3d9;`;
    const sBtn = `background:#0096BF; color:#ff69b4; font-size:1.4rem; font-weight:bold; flex:1.0; border:2px solid #ff51a8;`;
    const navBtn = `flex:1; background:#1a2a3a; color:#5ba3d9; font-size:1.1rem; border:none; border-radius:0; touch-action:manipulation; ${noApp}`;

    if (mode === 'dj_player') {
        grid.innerHTML = `
            <button class="c-btn" id="c-dj-close" style="${backBtn}">閉じる</button>
            <button class="c-btn" id="c-dj-skip"  style="${navBtn}">⏭</button>
            <button class="c-btn" id="c-dj-stop"  style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="c-dj-play"  style="${pBtn}">▶</button>`;
        document.getElementById('c-dj-close').onclick = () => djSophie.djClose(window._djBackFn || showRootMenu);
        document.getElementById('c-dj-skip').onclick  = () => djSophie.djSkip();
        document.getElementById('c-dj-stop').onclick  = () => djSophie.djStop();
        document.getElementById('c-dj-play').onclick  = () => djSophie.djPlay();
        return;
    }

    if (mode === 'fortune') {
        grid.innerHTML = `
        <button class="c-btn" id="c-back"           style="${backBtn} flex:1; font-size:0.8rem;">戻る</button>
        <button class="c-btn" id="c-fortune-submit"  style="background:#0096BF; color:#ff69b4; border:2px solid #ff51a8; flex:2.5; font-size:1rem; font-weight:bold;">天命診断を行う</button>
        <button class="c-btn" id="c-meishiki"        style="background:#1a1a2a; color:#9b59b6; border:1px solid #6a3a8a; flex:1.5; font-size:0.78rem;">📊 命式表</button>`;
        document.getElementById('c-back').onclick = () => {
            window._fortuneBack && window._fortuneBack();
        };
        document.getElementById('c-meishiki').onclick = () => {
            window._showMeishikiPanel && window._showMeishikiPanel();
        };
        document.getElementById('c-fortune-submit').onclick = () => {
            window._fortuneSubmit && window._fortuneSubmit();
        };
        return;
    }

    if (mode === 'konohi') {
        grid.innerHTML = `
            <button class="c-btn" id="c-back" style="${backBtn} flex:1; font-size:0.85rem;">戻る</button>`;
        document.getElementById('c-back').onclick = () => {
            window._konohiBack && window._konohiBack();
        };
        return;
    }

    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="c-btn" id="c-back" style="${backBtn}">戻る</button>
            <button class="c-btn" id="c-clr"  style="background:#5DADE2; color:#fff; flex:1; font-size:0.95rem; text-shadow:0 0 2px rgba(0,0,0,0.5); border:none;">リセット</button>
            <button class="c-btn" id="c-ex"   style="background:#8e44ad; color:#fff; flex:2; font-size:0.95rem; border:none;">検索実行</button>`;
        document.getElementById('c-back').onclick = liquor.openLiquorPortal;
        document.getElementById('c-clr').onclick = liquor.clearScr;
        document.getElementById('c-ex').onclick = liquor.execScr;
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
        const shopBaseStyle = "background:#ffe0ec; color:#cc294a; border:3px solid #1e90ff; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(2px); padding:0; flex:1.0; display:flex;";
        grid.innerHTML = `
            <button class="c-btn" id="btn-shop" style="${shopBaseStyle}">
                <span style="font-size:0.75rem; font-weight:bold; line-height:1.1;">ソフィー</span>
                <span style="font-size:0.75rem; font-weight:bold; line-height:1.1;">おすすめ</span>
                <span style="font-size:0.75rem; letter-spacing:1px; line-height:1.1;">SHOP</span>
            </button>
            <button class="c-btn" id="btn-techo" style="background:#d0f0f8; color:#ff69b4; border:3px solid #1e90ff; font-size:0.75rem; flex:1.0; display:flex; flex-direction:column; justify-content:center; align-items:center; line-height:1.3;"><span>📓</span><span>ソフィー</span><span>ノート</span></button>
            <button class="c-btn" id="ctrl-pause" style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"  style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"   style="${pCtrl}">⏭</button>`;
        document.getElementById('btn-shop').onclick = () => { nav.updateNav("shop"); shop.openShop(); renderConsole('standard'); };
    }
    else if (["tit", "st", "lq_list", "lq_res", "shop", "lq_main", "techo"].includes(nav.state)) {
        // 最深部＋SHOP：戻る（左端）・S・⏹️・▶・⏭
        grid.innerHTML = `
            <button class="c-btn" id="ctrl-back-txt" style="${backBtn}">戻る</button>
            <button class="c-btn" id="c-sophie-std"  style="${sBtn}">S</button>
            <button class="c-btn" id="ctrl-pause"    style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"     style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"      style="${pCtrl}">⏭</button>`;
        document.getElementById('ctrl-back-txt').onclick = handleBack;
        document.getElementById('c-sophie-std').onclick = handleSButton;
    }
    else {
        // 中間メニュー：戻る（左端）・メモ・⏹️・▶・⏭
        grid.innerHTML = `
            <button class="c-btn" id="ctrl-back-txt" style="${backBtn}">戻る</button>
            <button class="c-btn" id="btn-techo"     style="background:#d0f0f8; color:#ff69b4; border:3px solid #1e90ff; font-size:0.75rem; flex:1.0; display:flex; flex-direction:column; justify-content:center; align-items:center; line-height:1.3;"><span>📓</span><span>ソフィー</span><span>ノート</span></button>
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
    const playEl = document.getElementById('ctrl-play');
    const pauseEl = document.getElementById('ctrl-pause');
    if (playEl) playEl.onclick = music.playHead;
    if (pauseEl) pauseEl.onclick = music.togglePause;
    setupNextButton();



}