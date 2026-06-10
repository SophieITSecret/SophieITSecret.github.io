// js/dj_sophie.js — DJソフィー 一覧（DJ0）& 再生画面（DJ1）

import * as nav from './navigation.js';

let _narrationAudio = null;
let _afterAudio = null;
let _origVol = null;
let _slideTimer = null;
let _autoReturnTimer = null;
let _orientationHandler = null;
let _currentEpisode = null;
let _narrationSkipFn = null;
let _djYtPreloaded = false;
let _sophiePhase = false;
let _lastIsLandscape = null;

// ---- ユーティリティ ----

function _duckBgm() {
    const player = window._ytPlayer;
    if (!player) return;
    try { _origVol = player.getVolume(); player.setVolume(Math.round(_origVol * 0.2)); } catch(e) { _origVol = null; }
}

function _restoreBgm() {
    const player = window._ytPlayer;
    if (_origVol !== null && player) {
        try { player.setVolume(_origVol); } catch(e) {}
        _origVol = null;
    }
}

function _setMonitorImg(src) {
    const img   = document.getElementById('monitor-img');
    const yt    = document.getElementById('yt-wrapper');
    const lside = document.querySelector('.l-side');
    if (lside) lside.style.display = 'flex';
    if (img) { img.src = src; img.style.display = 'block'; }
    // プリロード中はyt-wrapperをdisplay:noneにしない（iOSが動画を一時停止するのを防ぐ）
    if (yt && !window._djYtPreloading) yt.style.display = 'none';
}

function _loadYoutube(ytId) {
    const img   = document.getElementById('monitor-img');
    const yt    = document.getElementById('yt-wrapper');
    const thumb = document.getElementById('dj-thumb');
    const lside = document.querySelector('.l-side');
    if (lside) lside.style.display = 'flex';
    if (img) img.style.display = 'none';
    if (yt)  yt.style.display = 'block';
    if (thumb) thumb.style.display = 'none';

    const player = window._ytPlayer;
    if (!player) return;
    if (_djYtPreloaded) {
        _djYtPreloaded = false;
        window._djYtPreloading = false;
        try { if (_origVol !== null) { player.setVolume(_origVol); _origVol = null; } else { player.setVolume(100); } } catch(e) {}
        try { player.unMute(); } catch(e) {}
        try {
            const state = player.getPlayerState();
            if (state === -1) {
                // 動画がロードされていない（埋め込み制限など）→ loadVideoByIdで再試行→onErrorが発火してコールバックが進む
                player.loadVideoById(ytId);
            } else {
                // iOSはタップ時に確立したautoplay許可でseekTo+playVideoが機能する
                player.seekTo(0, true);
                player.playVideo();
            }
        } catch(e) {}
    } else {
        _restoreBgm();
        try { player.loadVideoById(ytId); player.playVideo(); } catch(e) {}
    }
}

function _showSophieMonitor() {
    _setMonitorImg('./front_sophie.jpeg');
    const thumbEl = document.getElementById('dj-thumb');
    if (thumbEl) {
        const ls = window.matchMedia('(orientation: landscape)').matches;
        thumbEl.style.width  = ls ? '216px' : '144px';
        thumbEl.style.height = ls ? '120px' : '80px';
        thumbEl.style.display = 'block';
    }
    _sophiePhase = true;
}

// ---- DJ0: エピソード一覧 ----

export async function showDJList(onBack) {
    nav.updateNav('dj');
    window._renderConsole?.('standard');

    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    if (nm) nm.style.display = 'none';
    if (!lv) return;
    lv.style.display = 'block';
    lv.innerHTML = `<div style="padding:20px;color:#888;text-align:center;">読み込み中...</div>`;

    let episodes = [];
    try {
        const res = await fetch('./dj_stories.json');
        episodes = await res.json();
    } catch(e) {
        lv.innerHTML = `<div style="padding:20px;color:#e74c3c;text-align:center;">データの読み込みに失敗しました</div>`;
        return;
    }

    if (!episodes.length) {
        lv.innerHTML = `<div style="padding:20px;color:#888;text-align:center;">エピソードがまだありません</div>`;
        return;
    }

    let html = `
        <div style="margin:10px;border-radius:10px;border:2px solid transparent;
                    background:linear-gradient(#111,#111) padding-box,
                    linear-gradient(120deg,#ff69b4 50%,#00d2ff 100%) border-box;">
            <div style="color:#f0b56e;padding:0 12px;font-size:0.8rem;font-weight:bold;
                        border-bottom:1px solid #333;height:28px;line-height:28px;
                        border-radius:8px 8px 0 0;display:flex;align-items:center;gap:6px;">
                <img src="./sophie_face.png" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">
                🎙️ DJソフィーの歌とお酒の物語
            </div>
            <div style="padding:6px 0;">`;

    episodes.forEach(ep => {
        const segs = ep.segments || [];
        const subtitleHtml = segs.length > 1
            ? `<span style="color:#c8b090;">全${segs.length}曲</span>`
            : `<span style="color:#c8b090;">${ep.artist || ''}</span>`
                + (ep.artist && ep.song ? `<span style="color:#555;margin:0 4px;">／</span>` : '')
                + (ep.song ? `<span>「${ep.song}」</span>` : '');
        html += `
            <div class="dj-ep-card" data-id="${ep.id}"
                 style="padding:10px 14px;border-bottom:1px solid #222;cursor:pointer;
                        -webkit-tap-highlight-color:transparent;">
                <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px;">
                    <span style="color:#5ba3d9;font-size:0.72rem;font-weight:bold;flex-shrink:0;">#${ep.id}</span>
                    <span style="color:#888;font-size:0.68rem;flex-shrink:0;">${ep.date}</span>
                </div>
                <div style="color:#f0b56e;font-size:0.9rem;font-weight:bold;line-height:1.4;margin-bottom:3px;">${ep.title}</div>
                <div style="color:#aaa;font-size:0.78rem;">${subtitleHtml}</div>
            </div>`;
    });

    html += `</div></div>`;
    lv.innerHTML = html;

    document.querySelectorAll('.dj-ep-card').forEach(card => {
        card.addEventListener('click', () => {
            const ep = episodes.find(e => e.id === card.dataset.id);
            if (ep) showDJPlayer(ep, () => showDJList(onBack));
        });
    });
}

// ---- DJ1: 再生画面 ----

export function showDJPlayer(episode, onBackToList) {
    _currentEpisode = episode;
    _sophiePhase = false;
    nav.updateNav('dj');

    const lv  = document.getElementById('list-view');
    const nm  = document.getElementById('nav-main');
    const mon = document.querySelector('.monitor');

    if (nm) nm.style.display = 'none';
    if (!lv) return;
    lv.style.display = 'block';

    // 競合する音声を即停止
    if (window._cancelGuestCaution) window._cancelGuestCaution();
    try { const ta = document.getElementById('talk-audio'); if (ta) ta.pause(); } catch(e) {}
    try { if (window._lastSophieVoiceAudio) window._lastSophieVoiceAudio.pause(); } catch(e) {}

    // iOS自動再生対策: yt-wrapper が見えている状態でプリロード（_setMonitorImg より先に実行）
    // showRootMenu が yt-wrapper を非表示にしているため、ここで一時的に表示してから loadVideoById する
    const segments = episode.segments || [];
    const firstYtId = segments[0]?.youtube_id || null;
    const ytEl = document.getElementById('yt-wrapper');
    if (ytEl && firstYtId) ytEl.style.display = 'block';
    const player = window._ytPlayer;
    if (player && firstYtId) {
        try { _origVol = player.getVolume(); } catch(e) { _origVol = 100; }
        try {
            player.mute();
            player.loadVideoById(firstYtId);
            _djYtPreloaded = true;
            window._djYtPreloading = true;
        } catch(e) {
            _origVol = null;
            _duckBgm();
        }
    } else {
        _duckBgm();
    }

    const slideImgSrc = episode.slide_img
        ? `./img/dj/${episode.slide_img}`
        : './front_sophie.jpeg';
    _setMonitorImg(slideImgSrc);

    // エピソード情報パネル
    const isMulti = segments.length > 1;
    const subtitleHtml = isMulti
        ? `<span id="dj-ep-subtitle" style="color:#c8b090;">全${segments.length}曲</span>`
        : `<span style="color:#c8b090;">${episode.artist || ''}</span>`
            + (episode.artist && episode.song ? `<span style="color:#555;margin:0 4px;">／</span>` : '')
            + (episode.song ? `<span>「${episode.song}」</span>` : '');
    lv.innerHTML = `
        <div style="padding:6px 12px 5px;">
            <div style="color:#f0b56e;font-size:0.82rem;font-weight:bold;line-height:1.4;margin-bottom:2px;">${episode.title}</div>
            <div style="color:#aaa;font-size:0.70rem;">${subtitleHtml}</div>
            <div style="color:#888;font-size:0.62rem;margin-top:2px;">#${episode.id}&nbsp;&nbsp;${episode.date}</div>
        </div>`;

    // モニター右上サムネイル
    document.getElementById('dj-thumb')?.remove();
    const thumb = document.createElement('img');
    thumb.id  = 'dj-thumb';
    thumb.src = slideImgSrc;
    thumb.style.cssText = [
        'position:absolute','top:8px','right:8px',
        'width:144px','height:80px','object-fit:cover',
        'border-radius:5px','border:1px solid rgba(255,255,255,0.35)',
        'display:none','cursor:pointer','z-index:50',
        'box-shadow:0 2px 10px rgba(0,0,0,0.9)',
    ].join(';');
    if (mon) mon.appendChild(thumb);
    if (episode.slide_img) thumb.addEventListener('click', () => _showThumbModal(episode.slide_img));

    window._djBackFn = onBackToList;
    window._renderConsole?.('dj_player');

    _setupOrientation(mon, episode);
    _startFlow(episode);
}

// ---- 共通再生ヘルパー ----

function _playNarration(mp3, onDone) {
    if (_narrationAudio) { try { _narrationAudio.pause(); } catch(e) {} }
    if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }

    _narrationAudio = new Audio(`./voices_mp3/${mp3}`);
    _narrationAudio.preload = 'auto';
    let _invoked = false;

    const done = () => {
        if (_invoked) return;
        _invoked = true;
        _narrationSkipFn = null;
        if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
        window._djNarrationActive = false;
        onDone();
    };

    _narrationSkipFn = () => {
        if (_invoked) return;
        _invoked = true;
        _narrationSkipFn = null;
        if (_narrationAudio) { try { _narrationAudio.pause(); } catch(e) {} }
        if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
        window._djNarrationActive = false;
        onDone();
    };

    _narrationAudio.addEventListener('ended', done, { once: true });
    _narrationAudio.addEventListener('error', done, { once: true });
    _narrationAudio.play().catch(done);
    window._djNarrationActive = true;

    _slideTimer = setTimeout(() => {
        if (_invoked) return;
        _showSophieMonitor();
    }, 20000);
}

function _playAfterAudio(mp3, onComplete, preCreated) {
    _showSophieMonitor();
    if (_afterAudio) { try { _afterAudio.pause(); } catch(e) {} }
    _afterAudio = preCreated || new Audio(`./voices_mp3/${mp3}`);
    if (!preCreated) _afterAudio.preload = 'auto';
    const done = () => {
        _afterAudio = null;
        _narrationSkipFn = null;
        window._djNarrationActive = false;
        if (onComplete) onComplete();
    };
    _narrationSkipFn = () => {
        if (_afterAudio) { try { _afterAudio.pause(); } catch(e) {} _afterAudio = null; }
        _narrationSkipFn = null;
        window._djNarrationActive = false;
        if (onComplete) onComplete();
    };
    window._djNarrationActive = true;
    _afterAudio.addEventListener('ended', done, { once: true });
    _afterAudio.addEventListener('error', done, { once: true });
    _afterAudio.play().catch(done);
}

// ---- 再生フロー ----

function _startFlow(episode) {
    const segments = episode.segments || [];
    const isMulti = segments.length > 1;

    // iOS: ユーザーゼスチャーのコンテキスト内でAudioを事前作成しておく
    // YouTube終了後にnew Audio().play()するとiOSに拒否されるため
    const _preAudio = {};
    segments.forEach(seg => {
        if (seg.mp3 && !seg.youtube_id) {
            const a = new Audio(`./voices_mp3/${seg.mp3}`);
            a.preload = 'auto';
            _preAudio[seg.mp3] = a;
        }
    });

    const onAllDone = () => {
        _autoReturnTimer = setTimeout(() => {
            _autoReturnTimer = null;
            const backFn = window._djBackFn;
            if (backFn) djClose(backFn);
        }, 1500);
    };

    const _playSegment = (idx) => {
        if (idx >= segments.length) {
            onAllDone();
            return;
        }
        const seg = segments[idx];
        if (isMulti) _updateSubtitle(episode, idx);
        if (idx > 0) _showSophieMonitor();

        if (!seg.youtube_id) {
            _playAfterAudio(seg.mp3, onAllDone, _preAudio[seg.mp3]);
            return;
        }

        _playNarration(seg.mp3, () => {
            _showSophieMonitor();
            window._djYtEndCallback = () => _playSegment(idx + 1);
            _loadYoutube(seg.youtube_id);
        });
    };

    _playSegment(0);
}

function _updateSubtitle(episode, idx) {
    const el = document.getElementById('dj-ep-subtitle');
    if (!el) return;
    const seg = episode.segments[idx];
    if (!seg) return;
    const n = episode.segments.length;
    const pos = `<span style="color:#777;font-size:0.6rem;margin-left:4px;">(${idx + 1}/${n})</span>`;
    if (seg.artist || seg.song) {
        el.innerHTML = `<span style="color:#c8b090;">${seg.artist || ''}</span>`
            + (seg.artist && seg.song ? `<span style="color:#555;margin:0 4px;">／</span>` : '')
            + (seg.song ? `<span>「${seg.song}」</span>` : '')
            + pos;
    } else {
        el.innerHTML = pos;
    }
}

// ---- 横画面レイアウト ----

function _applyLandscapeLayout(episode) {
    document.getElementById('dj-landscape-panel')?.remove();

    const rSide = document.querySelector('.r-side');
    if (!rSide) return;

    // CSSでr-side幅固定・子要素非表示（JSでstyleを直接操作しない → 復元時に破損なし）
    let styleEl = document.getElementById('dj-ls-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'dj-ls-style';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent =
        '.r-side{flex:0 0 100px!important;max-width:100px!important;overflow:hidden!important;position:relative!important;}' +
        '.r-side>*:not(#dj-landscape-panel){display:none!important;}';

    const btnStyle = 'width:100%;border:none;cursor:pointer;font-weight:bold;touch-action:manipulation;-webkit-tap-highlight-color:transparent;flex-shrink:0;';
    const panel = document.createElement('div');
    panel.id = 'dj-landscape-panel';
    panel.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;background:#111;z-index:500;';
    panel.innerHTML = `
        <div style="flex:1;position:relative;overflow:hidden;">
            <img class="dj-ls-sophie" src="./sophie_shake.png"
                 style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;display:block;">
        </div>
        <button id="dj-ls-skip"
                style="${btnStyle}height:55px;background:#1a2a3a;color:#5ba3d9;
                       font-size:0.8rem;border-top:1px solid #2a3a4a;">⏭ スキップ</button>
        <button id="dj-ls-play"
                style="${btnStyle}height:55px;background:#1a3a1a;color:#7fd97f;
                       font-size:1.2rem;border-top:1px solid #203a20;">▶</button>
        <button id="dj-ls-stop"
                style="${btnStyle}height:55px;background:#1a2b1a;color:#5c9e5c;
                       font-size:1rem;border-top:1px solid #1f3020;">⏹</button>
        <button id="dj-ls-close"
                style="${btnStyle}height:55px;background:#34495e;color:#fff;
                       font-size:0.88rem;border-top:2px solid #5ba3d9;">閉じる</button>`;

    rSide.appendChild(panel);

    document.getElementById('dj-ls-skip').onclick  = () => djSkip();
    document.getElementById('dj-ls-stop').onclick  = () => djStop();
    document.getElementById('dj-ls-play').onclick  = () => djPlay();
    document.getElementById('dj-ls-close').onclick = () => djClose(window._djBackFn || (() => {}));
}

function _removeLandscapeLayout() {
    const styleEl = document.getElementById('dj-ls-style');
    if (styleEl) styleEl.textContent = '';
    document.getElementById('dj-landscape-panel')?.remove();
}

function _setupOrientation(mon, episode) {
    _removeOrientation();
    if (!mon) return;
    _lastIsLandscape = null;
    const _update = () => {
        const isLandscape = window.matchMedia('(orientation: landscape)').matches;
        if (isLandscape === _lastIsLandscape) return;
        _lastIsLandscape = isLandscape;
        const thumbEl = document.getElementById('dj-thumb');
        if (isLandscape) {
            mon.classList.add('expanded');
            _applyLandscapeLayout(episode);
            if (thumbEl && thumbEl.style.display !== 'none') {
                thumbEl.style.width = '216px'; thumbEl.style.height = '120px';
            }
        } else {
            mon.classList.remove('expanded');
            _removeLandscapeLayout();
            if (thumbEl && thumbEl.style.display !== 'none') {
                thumbEl.style.width = '144px'; thumbEl.style.height = '80px';
            }
        }
    };
    _update();
    _orientationHandler = _update;
    window.addEventListener('orientationchange', _orientationHandler);
    window.addEventListener('resize', _orientationHandler);
}

function _removeOrientation() {
    if (_orientationHandler) {
        window.removeEventListener('orientationchange', _orientationHandler);
        window.removeEventListener('resize', _orientationHandler);
        _orientationHandler = null;
    }
    _lastIsLandscape = null;
    document.querySelector('.monitor')?.classList.remove('expanded');
    _removeLandscapeLayout();
}

// ---- サムネイル拡大モーダル ----

function _showThumbModal(slideImg) {
    if (document.getElementById('dj-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'dj-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;';
    modal.innerHTML = `
        <div style="position:relative;width:90vw;max-width:480px;">
            <img src="./img/dj/${slideImg}" style="width:100%;height:auto;border-radius:8px;display:block;">
            <button style="position:absolute;top:-12px;right:-12px;background:#333;color:#fff;border:none;border-radius:50%;width:28px;height:28px;font-size:1rem;cursor:pointer;z-index:1;">✕</button>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', () => modal.remove());
}

// ---- コントロール ----

export function djPlay() {
    if (_narrationAudio && !_narrationAudio.ended) {
        if (_narrationAudio.paused) _narrationAudio.play().catch(() => {});
        return;
    }
    if (_afterAudio && !_afterAudio.ended) {
        if (_afterAudio.paused) _afterAudio.play().catch(() => {});
        return;
    }
    const yt = document.getElementById('yt-wrapper');
    if (yt && yt.style.display !== 'none') {
        try { window._ytPlayer?.playVideo(); } catch(e) {}
    }
}

export function djStop() {
    if (_narrationAudio && !_narrationAudio.paused) _narrationAudio.pause();
    if (_afterAudio && !_afterAudio.paused) _afterAudio.pause();
    try { window._ytPlayer?.pauseVideo(); } catch(e) {}
}

export function djSkip() {
    const yt = document.getElementById('yt-wrapper');
    const player = window._ytPlayer;
    if (yt && yt.style.display !== 'none' && player) {
        try {
            const dur = player.getDuration();
            if (dur > 0) player.seekTo(Math.max(0, dur - 10), true);
        } catch(e) {}
        return;
    }
    if (_narrationSkipFn) {
        const fn = _narrationSkipFn;
        _narrationSkipFn = null;
        fn();
    }
}

export function djClose(onBack) {
    if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
    if (_autoReturnTimer) { clearTimeout(_autoReturnTimer); _autoReturnTimer = null; }
    if (_narrationAudio) { _narrationAudio.pause(); _narrationAudio = null; }
    if (_afterAudio) { _afterAudio.pause(); _afterAudio = null; }
    window._djYtEndCallback = null;
    window._djYtPreloading = false;
    _narrationSkipFn = null;
    window._djNarrationActive = false;
    _sophiePhase = false;
    _removeOrientation();

    document.getElementById('dj-thumb')?.remove();
    document.getElementById('dj-modal')?.remove();

    const yt = document.getElementById('yt-wrapper');
    if (yt) yt.style.display = 'none';

    const player = window._ytPlayer;
    if (player) {
        if (_origVol !== null) {
            try { player.setVolume(_origVol); player.unMute(); } catch(e) {}
            _origVol = null;
        }
        try { player.stopVideo(); } catch(e) {}
    }
    _djYtPreloaded = false;

    const img = document.getElementById('monitor-img');
    if (img) { img.src = './front_sophie.jpeg'; img.style.display = 'block'; }

    window._djBackFn = null;
    _currentEpisode = null;

    if (typeof onBack === 'function') onBack();
}
