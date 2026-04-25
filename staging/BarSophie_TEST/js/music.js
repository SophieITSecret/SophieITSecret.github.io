/**
 * music.js — 完全改修版（全コード）
 * ★ 1.05rem・ジャンル順・曲順正常化版
 */

import * as nav from './navigation.js';
import * as media from './media.js';
import { lv, nm, setListView, highlightItem, extractYtId } from './utils.js';

export let isMusicMode = false; export let isPaused = false; export let isAutoPlay = false;
let lastTxt = ""; let ytPlayer = null; let ytPlayerReady = false; let talkAudio = null; let tel = null;

export function initMusic(audio, ytP, ytReady, telEl) { talkAudio = audio; ytPlayer = ytP; ytPlayerReady = ytReady; tel = telEl; }
export function setYtReady(player) { ytPlayer = player; ytPlayerReady = true; }

export function openMusic() {
    nav.updateNav("art");
    let h = `<div class="label">マスターお薦め</div><div class="artist-grid">
             <div class="item" data-special="ソフィー" style="color:var(--blue);">🎤 ソフィー</div>
             <div class="item" data-special="BGM">🎤 BGM</div>
             <div class="item" data-special="昭和ソング">🎤 昭和ソング</div></div>`;
    
    const preferredOrder = ['E', 'F', 'J', 'L', 'W', 'I', 'S'];
    const rawFs = [...new Set(nav.jData.map(d => d.f))];
    const sortedFs = rawFs.sort((a, b) => {
        let ia = preferredOrder.indexOf(a); if(ia === -1) ia = 999;
        let ib = preferredOrder.indexOf(b); if(ib === -1) ib = 999;
        return ia - ib;
    });

    sortedFs.forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if (arts.length) {
            let labelName = (f==='L') ? "特集コーナー" : (nav.jData.find(d=>d.f===f)?.gName || f);
            h += `<div class="label">${labelName}</div><div class="artist-grid">`;
            arts.forEach(a => h += `<div class="item" data-artist="${a}" style="font-size:1.05rem; padding:0.4em 15px;">🎤 ${a}</div>`);
            h += `</div>`;
        }
    });
    setListView(h, false);
    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => { 
        if(e.currentTarget.dataset.special) openSpecialSongs(e.currentTarget.dataset.special); 
        else openSongs(e.currentTarget.dataset.artist); 
    });
}

function openSpecialSongs(type) {
    let filtered = (type==='ソフィー') ? nav.jData.filter(m=>m.a.includes("ソフィー")) : (type==='BGM') ? nav.jData.filter(m=>m.a==="BGM") : nav.jData.filter(m=>["70s","昭和","演歌","歌姫"].includes(m.a));
    nav.updateNav("tit", undefined, filtered); isMusicMode = true; renderSongList(type);
}

function openSongs(a) { nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a)); isMusicMode = true; renderSongList(a); }

export function renderSongList(title) {
    let h = `<div class="label">${title}</div>`;
    nav.curP.forEach((m, i) => {
        const isSophie = m.ti && (m.ti.includes("みずいろのシグナル") || m.ti.includes("水色のシグナル"));
        h += `<div class="item" data-idx="${i}" style="font-size:1.05rem; padding:0.3em 15px; ${isSophie?'color:var(--blue);':''}">🎵 ${m.ti}</div>`;
    });
    setListView(h, false);
    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const i = parseInt(e.currentTarget.dataset.idx); if(!isNaN(i)) { nav.updateNav(undefined,undefined,undefined,i); setMon('v', nav.curP[i].u); prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true); }
    });
}

export function openTalk() {
    nav.updateNav("g");
    let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => h += `<div class="item" data-g="${g}" style="font-size:1.05rem; padding:0.4em 15px;">📁 ${g}</div>`);
    setListView(h, false);
    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => { if(e.currentTarget.dataset.g){ nav.updateNav("th", e.currentTarget.dataset.g); openThemes(nav.curG); } });
}

function openThemes(g) {
    nav.updateNav("th");
    let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => h += `<div class="item" data-th="${t}" style="font-size:1.05rem; padding:0.4em 15px;">🏷️ ${t}</div>`);
    setListView(h, false);
    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => { if(e.currentTarget.dataset.th) openStories(e.currentTarget.dataset.th); });
}

export function renderStoryList(t) {
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { h += `<div class="item" data-idx="${i}" style="font-size:1.05rem; padding:0.4em 15px;">${d.fix==="1"?"📌 ":""}${d.ti}</div>`; });
    setListView(h, false);
    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const i = parseInt(e.currentTarget.dataset.idx); if(!isNaN(i)) { nav.updateNav(undefined,undefined,undefined,i); setMon('i', `./talk_images/${nav.curP[i].id}.jpg`); prep(nav.curP[i].txt, false, nav.curP[i].id); }
    });
}

function openStories(t) { nav.updateNav("st", undefined, nav.tData.filter(d => d.th === t).sort((a,b)=>(parseInt(b.fix)||0)-(parseInt(a.fix)||0))); isMusicMode = false; renderStoryList(t); }

export function playHead() { if(ytPlayerReady && ytPlayer && ytPlayer.seekTo) { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); } if(!isMusicMode) talkAudio.play().catch(()=>{}); }
export function togglePause() { if(!isPaused) { if(ytPlayerReady && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); talkAudio.pause(); window.speechSynthesis.pause(); isPaused=true; } else { if(ytPlayerReady && ytPlayer.playVideo) ytPlayer.playVideo(); if(!isMusicMode) talkAudio.play().catch(()=>{}); window.speechSynthesis.resume(); isPaused=false; } }

export function next() {
    if (nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (nav.state === "none") {
            let txt = isMusicMode ? `🎵 ${m.a}の「${m.ti}」です` : `🥃 ${m.th}：「${m.ti}」の話です`;
            if (isMusicMode) { setMon('v', m.u); prep(txt, true, null, m.txt); } else { setMon('i', `./talk_images/${m.id}.jpg`); prep(txt, false, m.id, m.txt); }
        } else {
            if (isMusicMode) renderSongList(nav.curP[0]?.a || "再生リスト"); else renderStoryList(nav.curP[0]?.th || "お酒の話");
            if (isMusicMode) { setMon('v', m.u); prep(`${m.a}の${m.ti}です`, true); } else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
        }
    } else { isAutoPlay = false; document.getElementById('btn-next')?.classList.remove('auto-active'); }
}

export function handleBack() { if(nav.state==="st"){ openThemes(nav.curG); return true;} if(nav.state==="th"){ openTalk(); return true;} if(nav.state==="tit"){ openMusic(); return true;} return false; }

function setMon(m, s) {
    const mon = document.getElementById('monitor-img'), yt = document.getElementById('yt-wrapper'), exp = document.getElementById('btn-expand');
    if (nav.state === "none") {
        yt.style.display = 'none'; mon.style.display = 'block'; mon.src = './front_sophie.jpeg';
        if (exp) exp.style.opacity = '0.3';
        if (m === 'v' && ytPlayerReady) ytPlayer.loadVideoById(extractYtId(s)); else if (ytPlayerReady) ytPlayer.pauseVideo();
        return;
    }
    yt.style.display = (m==='v') ? 'block' : 'none'; mon.style.display = (m==='v') ? 'none' : 'block';
    if (m === 'v') { if(exp) exp.style.opacity = '0.3'; if(ytPlayerReady) ytPlayer.loadVideoById(extractYtId(s)); }
    else { mon.src = s; if(exp) exp.style.opacity = '1'; if(ytPlayerReady) ytPlayer.pauseVideo(); }
}

function prep(t, isM, id = null, originalTxt = null) {
    window.speechSynthesis.cancel(); try { talkAudio.pause(); talkAudio.currentTime = 0; } catch(e) {}
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
    document.querySelectorAll('#list-view .item').forEach(el => {
        if (parseInt(el.dataset.idx) === nav.curI) { el.classList.add('active-item'); if(nav.state!=="none") el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        else el.classList.remove('active-item');
    });
}

function render(h, cb) { nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; document.getElementById('main-scroll').scrollTop = 0; document.querySelectorAll('#list-view .item').forEach(el => el.onclick = cb); }
export const defaultOnEnded = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };

// --- DJ API維持 ---
const _st = { currentCode: null, currentTitle: null, currentArtist: null };
export function playSongByCode(code, options = {}) {
    const s = nav.jData.find(d => parseInt(String(d.code), 10) === parseInt(String(code), 10));
    if (!s) return false;
    _st.currentCode = code; _st.currentTitle = s.ti; _st.currentArtist = s.a;
    setMon('v', s.u); prep(`${s.a}の${s.ti}です`, true); return true;
}
export function getCurrentSong() { return { ..._st }; }
export function fadeOutAndStop(duration = 3000) {
    if (!ytPlayerReady) return;
    let vol = 100; const steps = 20, interval = duration / steps;
    const timer = setInterval(() => { vol -= 5; if (vol <= 0) { ytPlayer.pauseVideo(); ytPlayer.setVolume(100); clearInterval(timer); } else ytPlayer.setVolume(vol); }, interval);
}