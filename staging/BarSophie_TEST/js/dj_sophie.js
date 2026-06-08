// js/dj_sophie.js — DJソフィー 一覧（DJ0）& 再生画面（DJ1）

import * as nav from './navigation.js';

let _narrationAudio = null;
let _origVol = null;
let _slideTimer = null;
let _orientationHandler = null;
let _currentEpisode = null;

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
    const img = document.getElementById('monitor-img');
    const yt  = document.getElementById('yt-wrapper');
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
    if (player) { try { player.loadVideoById(ytId); } catch(e) {} }
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

    // BGMダッキング
    _duckBgm();

    // エピソード情報パネル
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
        'width:72px', 'height:40px', 'object-fit:cover',
        'border-radius:4px', 'border:1px solid rgba(255,255,255,0.3)',
        'display:none', 'cursor:pointer', 'z-index:50',
        'box-shadow:0 2px 8px rgba(0,0,0,0.8)',
    ].join(';');
    if (mon) mon.appendChild(thumb);
    thumb.addEventListener('click', () => _showThumbModal(episode.slide_img));

    // コンソールモードをDJプレイヤーに（バック先を先に保存）
    window._djBackFn = onBackToList;
    window._renderConsole?.('dj_player');

    // ナレーション（ユーザージェスチャーのコンテキストで生成）
    _narrationAudio = new Audio(`./voices_mp3/${episode.mp3}`);
    _narrationAudio.preload = 'auto';

    let _done = false;
    const _onEnd = () => {
        if (_done) return;
        _done = true;
        if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
        _setMonitorImg('./front_sophie.jpeg');
        thumb.style.display = 'block';
        _restoreBgm();
        const player = window._ytPlayer;
        if (player) { try { player.stopVideo(); } catch(e) {} }
        setTimeout(() => _loadYoutube(episode.youtube_id), 500);
    };

    _narrationAudio.addEventListener('ended', _onEnd, { once: true });
    _narrationAudio.addEventListener('error', _onEnd, { once: true });
    _narrationAudio.play().catch(_onEnd);

    // 20秒後: ソフィー写真に切り替え＋サムネイル表示
    _slideTimer = setTimeout(() => {
        if (_done) return;
        _setMonitorImg('./front_sophie.jpeg');
        thumb.style.display = 'block';
    }, 20000);

    // 横画面自動対応
    _setupOrientation(mon);
}

// ---- 横画面 ----

function _setupOrientation(mon) {
    _removeOrientation();
    if (!mon) return;
    const _update = () => {
        if (window.matchMedia('(orientation: landscape)').matches) mon.classList.add('expanded');
        else mon.classList.remove('expanded');
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

// ---- コントロール（app_m.js の renderConsole から呼ばれる） ----

export function djPlay() {
    if (_narrationAudio && !_narrationAudio.ended) {
        if (_narrationAudio.paused) _narrationAudio.play().catch(() => {});
        return;
    }
    // YouTubeフェーズ
    const yt = document.getElementById('yt-wrapper');
    if (yt && yt.style.display !== 'none') {
        const player = window._ytPlayer;
        if (player) { try { player.playVideo(); } catch(e) {} }
    }
}

export function djStop() {
    if (_narrationAudio && !_narrationAudio.paused) _narrationAudio.pause();
    const player = window._ytPlayer;
    if (player) { try { player.pauseVideo(); } catch(e) {} }
}

export function djClose(onBack) {
    if (_slideTimer) { clearTimeout(_slideTimer); _slideTimer = null; }
    if (_narrationAudio) { _narrationAudio.pause(); _narrationAudio = null; }
    _restoreBgm();
    _removeOrientation();

    document.getElementById('dj-thumb')?.remove();
    document.getElementById('dj-modal')?.remove();

    const yt = document.getElementById('yt-wrapper');
    if (yt) yt.style.display = 'none';
    const player = window._ytPlayer;
    if (player) { try { player.stopVideo(); } catch(e) {} }

    const img = document.getElementById('monitor-img');
    if (img) { img.src = './front_sophie.jpeg'; img.style.display = 'block'; }

    window._djBackFn = null;
    _currentEpisode = null;

    if (typeof onBack === 'function') onBack();
}
