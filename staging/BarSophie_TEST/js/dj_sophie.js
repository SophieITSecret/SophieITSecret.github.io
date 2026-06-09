// js/dj_sophie.js — DJソフィー 一覧（DJ0）& 再生画面（DJ1）

import * as nav from './navigation.js';

let _narrationAudio = null;
let _origVol = null;
let _slideTimer = null;
let _orientationHandler = null;
let _currentEpisode = null;
let _narrationSkipFn = null;  // ジェスチャーコンテキストで呼ばれるスキップ関数
let _djYtPreloaded = false;   // ジェスチャーコンテキストでYTをプリロード済み

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
    if (yt)  yt.style.display = 'none';
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
    try {
        if (_djYtPreloaded) {
            // ジェスチャーコンテキストでプリロード済み → アンミュートして先頭から再生
            _djYtPreloaded = false;
            if (_origVol !== null) { player.setVolume(_origVol); _origVol = null; }
            else { player.setVolume(100); }
            player.unMute();
            player.seekTo(0, true);
            player.playVideo();
        } else {
            // 通常フォールバック（BGM再生中なら既に "activated" 状態）
            _restoreBgm();
            player.loadVideoById(ytId);
            player.playVideo();
        }
    } catch(e) {}
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
    lv.innerHTML = `<div style="padding:20px; color:#888; text-align:center;">読み込み中...</div>`;

    let episodes = [];
    try {
        const res = await fetch('./dj_stories.json');
        episodes = await res.json();
    } catch(e) {
        lv.innerHTML = `<div style="padding:20px; color:#e74c3c; text-align:center;">データの読み込みに失敗しました</div>`;
        return;
    }

    if (!episodes.length) {
        lv.innerHTML = `<div style="padding:20px; color:#888; text-align:center;">エピソードがまだありません</div>`;
        return;
    }

    let html = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background:linear-gradient(#111,#111) padding-box,
                    linear-gradient(120deg,#ff69b4 50%,#00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">
                🎙️ DJソフィーの歌とお酒の物語
            </div>
            <div style="padding:6px 0;">`;

    episodes.forEach(ep => {
        html += `
            <div class="dj-ep-card" data-id="${ep.id}"
                 style="padding:10px 14px; border-bottom:1px solid #222; cursor:pointer;
                        -webkit-tap-highlight-color:transparent;">
                <div style="display:flex; align-items:baseline; gap:8px; margin-bottom:3px;">
                    <span style="color:#5ba3d9; font-size:0.72rem; font-weight:bold; flex-shrink:0;">#${ep.id}</span>
                    <span style="color:#888; font-size:0.68rem; flex-shrink:0;">${ep.date}</span>
                </div>
                <div style="color:#f0b56e; font-size:0.9rem; font-weight:bold; line-height:1.4; margin-bottom:3px;">${ep.title}</div>
                <div style="color:#aaa; font-size:0.78rem;">
                    <span style="color:#c8b090;">${ep.artist}</span>
                    <span style="color:#555; margin:0 4px;">／</span>
                    <span>「${ep.song}」</span>
                </div>
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
    nav.updateNav('dj');

    const lv  = document.getElementById('list-view');
    const nm  = document.getElementById('nav-main');
    const mon = document.querySelector('.monitor');

    if (nm) nm.style.display = 'none';
    if (!lv) return;
    lv.style.display = 'block';

    // スライド画像をモニターに表示
    _setMonitorImg(`./img/dj/${episode.slide_img}`);

    // ---- iOS自動再生対策: ユーザージェスチャーコンテキスト内でYTをプリロード ----
    // stopVideo() を呼ばず、ミュートで先行ロードすることでiOSの再生ロックを回避する
    const player = window._ytPlayer;
    if (player && episode.youtube_id) {
        try {
            _origVol = player.getVolume();
        } catch(e) { _origVol = 100; }
        try {
            player.mute();
            player.loadVideoById(episode.youtube_id);
            _djYtPreloaded = true;
        } catch(e) {
            _origVol = null;
            _duckBgm(); // フォールバック: プリロード失敗時はBGMダッキング
        }
    } else {
        _duckBgm();
    }

    // エピソード情報パネル（縦画面時）
    lv.innerHTML = `
        <div style="padding:10px 14px 8px;">
            <div style="color:#f0b56e; font-size:0.92rem; font-weight:bold; line-height:1.5; margin-bottom:3px;">${episode.title}</div>
            <div style="color:#aaa; font-size:0.78rem;">
                <span style="color:#c8b090;">${episode.artist}</span>
                <span style="color:#555; margin:0 4px;">／</span>
                <span>「${episode.song}」</span>
            </div>
            <div style="color:#888; font-size:0.68rem; margin-top:3px;">#${episode.id}&nbsp;&nbsp;${episode.date}</div>
        </div>`;

    // モニター右上サムネイル（20秒後に出現）
    document.getElementById('dj-thumb')?.remove();
    const thumb = document.createElement('img');
    thumb.id  = 'dj-thumb';
    thumb.src = `./img/dj/${episode.slide_img}`;
    thumb.style.cssText = [
        'position:absolute', 'top:8px', 'right:8px',
        'width:144px', 'height:80px', 'object-fit:cover',
        'border-radius:5px', 'border:1px solid rgba(255,255,255,0.35)',
        'display:none', 'cursor:pointer', 'z-index:50',
        'box-shadow:0 2px 10px rgba(0,0,0,0.9)',
    ].join(';');
    if (mon) mon.appendChild(thumb);
    thumb.addEventListener('click', () => _showThumbModal(episode.slide_img));

    // コンソールモード（バック先を先に保存）
    window._djBackFn = onBackToList;
    window._renderConsole?.('dj_player');

    // ナレーション（ユーザージェスチャーのコンテキストで生成）
    _narrationAudio = new Audio(`./voices_mp3/${episode.mp3}`);
    _narrationAudio.preload = 'auto';

    // ナレーション終了後の処理（共通化）
    let _done = false;
    const _showSophie = () => {
        _setMonitorImg('./front_sophie.jpeg');
        const thumbEl = document.getElementById('dj-thumb');
        if (thumbEl) thumbEl.style.display = 'block';
        const lsImg = document.querySelector('#dj-landscape-panel .dj-ls-sophie');
        if (lsImg) lsImg.src = './front_sophie.jpeg';
    };

    // 通常終了（非同期 → setTimeoutで遅延）
    const _onEnd = () => {
        if (_done) return;
        _done = true;
        _narrationSkipFn = null;
        if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
        _showSophie();
        setTimeout(() => _loadYoutube(episode.youtube_id), 300);
    };

    // スキップ（ジェスチャー → 同期的にloadYoutube呼び出し）
    _narrationSkipFn = () => {
        if (_done) return;
        _done = true;
        _narrationSkipFn = null;
        if (_narrationAudio) { try { _narrationAudio.pause(); } catch(e) {} }
        if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
        _showSophie();
        _loadYoutube(episode.youtube_id); // ジェスチャーコンテキスト内で同期呼び出し
    };

    _narrationAudio.addEventListener('ended', _onEnd, { once: true });
    _narrationAudio.addEventListener('error', _onEnd, { once: true });
    _narrationAudio.play().catch(_onEnd);

    // 20秒後: ソフィー写真に切り替え＋サムネイル表示
    _slideTimer = setTimeout(() => {
        if (_done) return;
        _showSophie();
    }, 20000);

    // 横画面自動対応
    _setupOrientation(mon, episode);
}

// ---- 横画面レイアウト ----

function _applyLandscapeLayout(episode) {
    document.getElementById('dj-landscape-panel')?.remove();

    const rSide = document.querySelector('.r-side');
    if (!rSide) return;

    // 現在のモニター表示と同期
    const monImg = document.getElementById('monitor-img');
    const currentSrc = (monImg && monImg.style.display !== 'none')
        ? monImg.src
        : `./img/dj/${episode.slide_img}`;

    const panel = document.createElement('div');
    panel.id = 'dj-landscape-panel';
    panel.style.cssText = 'position:absolute;inset:0;z-index:200;display:flex;flex-direction:column;background:#000;';

    const btnStyle = 'width:100%;border:none;cursor:pointer;font-weight:bold;touch-action:manipulation;-webkit-tap-highlight-color:transparent;';
    panel.innerHTML = `
        <div style="position:relative;flex:1;overflow:hidden;min-height:0;">
            <img class="dj-ls-sophie" src="${currentSrc}"
                 style="width:100%;height:100%;object-fit:cover;display:block;">
            <div style="position:absolute;top:10px;left:10px;right:10px;
                        background:rgba(0,0,0,0.6);border-radius:6px;padding:6px 8px;">
                <div style="color:#f0b56e;font-size:0.82rem;font-weight:bold;
                            line-height:1.4;text-shadow:0 1px 4px #000;">${episode.title}</div>
                <div style="color:#c8b090;font-size:0.7rem;margin-top:2px;text-shadow:0 1px 3px #000;">
                    ${episode.artist}「${episode.song}」
                </div>
            </div>
        </div>
        <button id="dj-ls-skip"
                style="${btnStyle}height:40px;background:#1a2a3a;color:#5ba3d9;
                       font-size:0.85rem;border-top:1px solid #2a3a4a;">⏭ スキップ</button>
        <button id="dj-ls-stop"
                style="${btnStyle}height:40px;background:#1a2b1a;color:#5c9e5c;
                       font-size:1.1rem;border-top:1px solid #1f3020;">⏹</button>
        <button id="dj-ls-play"
                style="${btnStyle}height:40px;background:#1a3a1a;color:#7fd97f;
                       font-size:1.3rem;border-top:1px solid #203a20;">▶</button>
        <button id="dj-ls-close"
                style="${btnStyle}height:50px;background:#34495e;color:#fff;
                       font-size:0.95rem;border-top:2px solid #5ba3d9;">閉じる</button>`;

    rSide.style.position = 'relative';
    rSide.appendChild(panel);

    document.getElementById('dj-ls-skip').onclick  = () => djSkip();
    document.getElementById('dj-ls-stop').onclick  = () => djStop();
    document.getElementById('dj-ls-play').onclick  = () => djPlay();
    document.getElementById('dj-ls-close').onclick = () => djClose(window._djBackFn || (() => {}));
}

function _removeLandscapeLayout() {
    document.getElementById('dj-landscape-panel')?.remove();
}

function _setupOrientation(mon, episode) {
    _removeOrientation();
    if (!mon) return;
    const _update = () => {
        const isLandscape = window.matchMedia('(orientation: landscape)').matches;
        if (isLandscape) {
            mon.classList.add('expanded');
            _applyLandscapeLayout(episode);
        } else {
            mon.classList.remove('expanded');
            _removeLandscapeLayout();
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
    const yt = document.getElementById('yt-wrapper');
    if (yt && yt.style.display !== 'none') {
        try { window._ytPlayer?.playVideo(); } catch(e) {}
    }
}

export function djStop() {
    if (_narrationAudio && !_narrationAudio.paused) _narrationAudio.pause();
    try { window._ytPlayer?.pauseVideo(); } catch(e) {}
}

export function djSkip() {
    const yt = document.getElementById('yt-wrapper');
    const player = window._ytPlayer;
    if (yt && yt.style.display !== 'none' && player) {
        // YouTube再生中 → 曲の末尾（10秒前）へシーク
        try {
            const dur = player.getDuration();
            if (dur > 0) player.seekTo(Math.max(0, dur - 10), true);
        } catch(e) {}
        return;
    }
    // ナレーション中 → ジェスチャーコンテキストでYouTubeへスキップ
    if (_narrationSkipFn) {
        const fn = _narrationSkipFn;
        _narrationSkipFn = null;
        fn();
    }
}

export function djClose(onBack) {
    if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
    if (_narrationAudio) { _narrationAudio.pause(); _narrationAudio = null; }
    _narrationSkipFn = null;
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
