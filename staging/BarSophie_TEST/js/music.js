/**
 * music.js — 音楽選曲機能
 * ★ Claude指示に基づき、末尾に外部API（playSongByCodeなど）を増設しました。
 */

import * as nav from './navigation.js';
import * as media from './media.js';
import { lv, nm, setListView, highlightItem, extractYtId } from './utils.js';

// 外部から参照される変数
export let isMusicMode = false;
export let isPaused = false;
export let isAutoPlay = false;

// 内部変数
let lastTxt = "";
let pressTimer = null;
let ytPlayer = null;
let ytPlayerReady = false;
let talkAudio = null;
let tel = null;

// =============================================
// 初期化（app_m.jsから呼ぶ）
// =============================================
export function initMusic(audio, ytP, ytReady, telEl) {
    talkAudio    = audio;
    ytPlayer     = ytP;
    ytPlayerReady = ytReady;
    tel          = telEl;
}

// ytPlayerReadyの更新
export function setYtReady(player) {
    ytPlayer      = player;
    ytPlayerReady = true;
}

// =============================================
// 音楽選曲画面
// =============================================
export function openMusic() {
    nav.updateNav("art");
    let h = "";
    h += `<div class="label">マスターお薦め</div><div class="artist-grid">`;
    h += `<div class="item" data-special="ソフィー" style="color: var(--blue);">🎤 ソフィー</div>`;
    h += `<div class="item" data-special="BGM">🎤 BGM</div>`;
    h += `<div class="item" data-special="昭和ソング">🎤 昭和ソング</div></div>`;

    const preferredOrder = ['E', 'F', 'J', 'L', 'W', 'I', 'S'];
    const rawFs = [...new Set(nav.jData.map(d => d.f).filter(Boolean))];
    const sortedFs = rawFs.sort((a, b) => {
        let ia = preferredOrder.indexOf(a);
        let ib = preferredOrder.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });

    sortedFs.forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if (arts.length) {
            let labelName = (f === 'L') ? "特集コーナー" : (nav.jData.find(d => d.f === f && d.gName)?.gName || f);
            h += `<div class="label">${labelName}</div><div class="artist-grid">`;
            arts.forEach(a => { h += `<div class="item" data-artist="${a}">🎤 ${a}</div>`; });
            h += `</div>`;
        }
    });

    render(h, (e) => {
        const el = e.currentTarget;
        if (el.dataset.special) openSpecialSongs(el.dataset.special);
        else if (el.dataset.artist) openSongs(el.dataset.artist);
    });
}

function openSpecialSongs(type) {
    let filtered = [];
    if (type === 'ソフィー') filtered = nav.jData.filter(m => m.a && m.a.includes("ソフィー"));
    else if (type === 'BGM') filtered = nav.jData.filter(m => m.a === "BGM");
    else if (type === '昭和ソング') filtered = nav.jData.filter(m => ["70s", "昭和", "演歌", "歌姫"].includes(m.a));
    nav.updateNav("tit", undefined, filtered);
    isMusicMode = true;
    renderSongList(type);
}

function openSongs(a) {
    nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a));
    isMusicMode = true;
    renderSongList(a);
}

export function renderSongList(title) {
    let h = `<div class="label">${title}</div>`;
    nav.curP.forEach((m, i) => {
        const isSophie = m.ti && (m.ti.includes("みずいろのシグナル") || m.ti.includes("水色のシグナル"));
        const color = isSophie ? `style="color: var(--blue);"` : "";
        h += `<div class="item" data-idx="${i}" ${color}>🎵 ${m.ti}</div>`;
    });
    render(h, (e) => {
        const el = e.currentTarget;
        if (el.dataset.idx) {
            const i = parseInt(el.dataset.idx);
            if (!isNaN(i)) {
                nav.updateNav(undefined, undefined, undefined, i);
                setMon('v', nav.curP[i].u);
                prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true);
            }
        }
    });
}

// =============================================
// お酒の話
// =============================================
export function openTalk() {
    nav.updateNav("g");
    let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="item" data-g="${g}">📁 ${g}</div>`; });
    render(h, (e) => {
        const g = e.currentTarget.dataset.g;
        if (g) { nav.updateNav("th", g); openThemes(nav.curG); }
    });
}

function openThemes(g) {
    nav.updateNav("th");
    let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="item" data-th="${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { const t = e.currentTarget.dataset.th; if (t) openStories(t); });
}

export function renderStoryList(t) {
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => {
        const isFix = (d.fix === "1" || d.fix === "true" || parseInt(d.fix) > 0);
        h += `<div class="item" data-idx="${i}">${isFix ? "📌 " : ""}${d.ti}</div>`;
    });
    render(h, (e) => {
        const el = e.currentTarget;
        if (el.dataset.idx) {
            const i = parseInt(el.dataset.idx);
            if (!isNaN(i)) {
                nav.updateNav(undefined, undefined, undefined, i);
                setMon('i', `./talk_images/${nav.curP[i].id}.jpg`);
                prep(nav.curP[i].txt, false, nav.curP[i].id);
            }
        }
    });
}

function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a, b) => (parseInt(b.fix)||0) - (parseInt(a.fix)||0));
    nav.updateNav("st", undefined, stories);
    isMusicMode = false;
    renderStoryList(t);
}

// =============================================
// 再生コントロール
// =============================================
export function playHead() {
    if (ytPlayerReady && ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(0, true);
        ytPlayer.playVideo();
    }
    if (!isMusicMode) talkAudio.play().catch(() => {});
}

export function togglePause() {
    if (!isPaused) {
        if (ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
        talkAudio.pause();
        window.speechSynthesis.pause();
        isPaused = true;
    } else {
        if (ytPlayerReady && ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
        if (!isMusicMode) talkAudio.play().catch(() => {});
        window.speechSynthesis.resume();
        isPaused = false;
    }
}

export function next() {
    if (nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (nav.state === "none") {
            let topText = isMusicMode ? `🎵 ${m.a}さんの「${m.ti}」です` : `🥃 ${m.th}：「${m.ti}」のお話です`;
            if (isMusicMode) { setMon('v', m.u); prep(topText, true, null, m.txt); }
            else { setMon('i', `./talk_images/${m.id}.jpg`); prep(topText, false, m.id, m.txt); }
        } else {
            if (isMusicMode) renderSongList(nav.curP[0]?.a || "再生リスト");
            else renderStoryList(nav.curP[0]?.th || "お酒の話");
            if (isMusicMode) { setMon('v', m.u); prep(`${m.a}さんの${m.ti}です`, true); }
            else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
        }
    } else {
        isAutoPlay = false;
        document.getElementById('btn-next')?.classList.remove('auto-active');
    }
}

export function handleBack() {
    if (nav.state === "st") { openThemes(nav.curG); return true; }
    if (nav.state === "th") { openTalk(); return true; }
    if (nav.state === "tit") { openMusic(); return true; }
    return false;
}

function setMon(m, s) {
    const monImg = document.getElementById('monitor-img'), ytWrapper = document.getElementById('yt-wrapper'), btnExpand = document.getElementById('btn-expand');
    if (nav.state === "none") {
        ytWrapper.style.display = 'none'; monImg.style.display = 'block'; monImg.src = './front_sophie.jpeg';
        document.querySelector('.monitor').classList.remove('expanded');
        if (btnExpand) { btnExpand.innerText = '▼'; btnExpand.style.opacity = '0.3'; }
        if (m === 'v' && ytPlayerReady) ytPlayer.loadVideoById(extractYtId(s));
        else if (ytPlayerReady) ytPlayer.pauseVideo();
        return;
    }
    ytWrapper.style.display = (m === 'v') ? 'block' : 'none';
    monImg.style.display = (m === 'v') ? 'none' : 'block';
    if (m === 'v') {
        if (btnExpand) btnExpand.style.opacity = '0.3';
        if (ytPlayerReady) ytPlayer.loadVideoById(extractYtId(s));
    } else {
        monImg.src = s;
        if (btnExpand) btnExpand.style.opacity = '1';
        if (ytPlayerReady) ytPlayer.pauseVideo();
    }
}

function prep(t, isM, id = null, originalTxt = null) {
    window.speechSynthesis.cancel();
    try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e) {}
    lastTxt = t; isMusicMode = isM; isPaused = false;
    if (tel) {
        tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
        if (nav.state === "none") { tel.style.top = 'auto'; tel.style.bottom = '0'; tel.style.height = 'auto'; tel.style.background = 'rgba(0,0,0,0.6)'; }
        else { tel.style.top = '0'; tel.style.bottom = 'auto'; tel.style.height = '100%'; tel.style.background = 'rgba(0,0,0,0.75)'; }
    }
    if (isM) setTimeout(() => { if (lastTxt === t && tel) tel.style.display = 'none'; }, 5000);
    else if (id) {
        talkAudio.src = `./voices_mp3/${id}.mp3`;
        const speak = () => media.speak(originalTxt || t);
        talkAudio.onerror = speak;
        try { const p = talkAudio.play(); if (p) p.catch(speak); } catch(e) { speak(); }
    }
    document.querySelectorAll('#list-view .item').forEach((el) => {
        if (el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) {
            el.classList.add('active-item');
            if (nav.state !== "none") el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else el.classList.remove('active-item');
    });
}

function render(h, cb) {
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h;
    document.getElementById('main-scroll').scrollTop = 0;
    document.querySelectorAll('#list-view .item').forEach(el => el.onclick = cb);
}

export const defaultOnEnded = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };

// ==========================================================
// ★ 外部公開API（末尾追加：DJやノートから使用）
// ==========================================================

const _playerState = { currentCode: null, currentTitle: null, currentArtist: null, source: null };

export function playSongByCode(code, options = {}) {
    const song = nav.jData.find(d => parseInt(String(d.code || ""), 10) === parseInt(String(code), 10));
    if (!song) return false;
    _playerState.currentCode = code; _playerState.currentTitle = song.ti; _playerState.currentArtist = song.a; _playerState.source = options.source || "unknown";
    setMon('v', song.u);
    prep(`${song.a}さんの${song.ti}です`, true);
    return true;
}

export function getCurrentSong() { return { ..._playerState }; }

export function fadeOutAndStop(duration = 3000) {
    if (!ytPlayerReady || !ytPlayer) return;
    const steps = 20, interval = duration / steps;
    let vol = 100;
    const timer = setInterval(() => {
        vol -= 100 / steps;
        if (vol <= 0) {
            ytPlayer.pauseVideo();
            if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(100);
            clearInterval(timer); _playerState.currentCode = null;
        } else if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(Math.max(0, vol));
    }, interval);
}