import * as media from './media.js';
import * as nav from './navigation.js';

let isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null, isPaused = false;
const chat = document.getElementById('chat-area'), tel = document.getElementById('telop-box'), img = document.getElementById('monitor-image'), yt = document.getElementById('yt-iframe'), menuL = document.getElementById('menu-layer'), menuC = document.getElementById('menu-content'), navM = document.getElementById('nav-main-pc');

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    window.enterBar = () => { document.getElementById('entry-overlay').style.display = 'none'; sophieSpeak("まきむら様、お帰りなさいませ。"); };
    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;
    
    const btnN = document.getElementById('btn-next');
    btnN.onpointerdown = () => { pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
    btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
}

function sophieSpeak(text, isMusic = false) {
    media.speak(text, 1.05, () => { if(isAutoPlay && !isMusicMode) setTimeout(next, 1000); });
    chat.innerText = text; lastTxt = text;
    if(text.length > 10) {
        tel.innerText = text; tel.style.display = 'block'; tel.scrollTop = 0;
        if(isMusic) setTimeout(() => { if(tel.innerText === text) tel.style.display = 'none'; }, 5000);
    }
}

function playHead() {
    yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
    yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    if(!isMusicMode && lastTxt) sophieSpeak(lastTxt);
}

function togglePause() {
    if(!isPaused) { yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); window.speechSynthesis.pause(); isPaused = true; }
    else { yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); window.speechSynthesis.resume(); isPaused = false; }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (isMusicMode) { setMon('v', m.u); sophieSpeak(nav.curG + "さんの" + m.ti + "です", true); }
        else { setMon('i', `./talk_images/${m.id}.jpg`); sophieSpeak(m.txt); }
        updateHigh();
    } else { isAutoPlay = false; document.getElementById('btn-next').classList.remove('auto-active'); }
}

function setMon(mode, src) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    setTimeout(() => {
        if(mode === 'v') { yt.style.display='block'; yt.src=`https://www.youtube.com/embed/${media.extractYtId(src)}?autoplay=1&enablejsapi=1`; }
        else { img.style.display='block'; img.src=src; }
    }, 100);
}

function updateHigh() { document.querySelectorAll('.menu-item').forEach((el, idx) => el.classList.toggle('active-item', idx === nav.curI)); }

function openMusic() {
    nav.updateNav("art"); menuL.style.display = 'block'; navM.style.display = 'none';
    let h = '<div class="genre-label">アーティスト</div>';
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        arts.forEach(a => { h += `<div class="menu-item" id="art-${a}">🎤 ${a}</div>`; });
    });
    render(h, (e) => { if(e.target.id.startsWith('art-')) renderSongs(e.target.id.replace('art-','')); });
}

function renderSongs(a) {
    nav.updateNav("tit", a, nav.jData.filter(m => m.a === a)); isMusicMode = true;
    let h = `<div class="genre-label">${a}</div>`;
    nav.curP.forEach((m, i) => { h += `<div class="menu-item" data-idx="${i}">${m.ti}</div>`; });
    render(h, (e) => {
        const i = parseInt(e.target.dataset.idx);
        if(!isNaN(i)) { nav.updateNav(undefined, undefined, undefined, i); setMon('v', nav.curP[i].u); sophieSpeak(a + "さんの" + nav.curP[i].ti + "です", true); updateHigh(); }
    });
}

function openTalk() {
    nav.updateNav("g"); menuL.style.display = 'block'; navM.style.display = 'none';
    let h = '<div class="genre-label">ジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="menu-item" id="g-${g}">📁 ${g}</div>`; });
    render(h, (e) => { if(e.target.id.startsWith('g-')) { nav.updateNav("th", e.target.id.replace('g-','')); renderThemes(nav.curG); } });
}

function renderThemes(g) {
    nav.updateNav("th"); let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="menu-item" id="th-${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { if(e.target.id.startsWith('th-')) renderStories(e.target.id.replace('th-','')); });
}

function renderStories(t) {
    nav.updateNav("st", undefined, nav.tData.filter(d => d.th === t)); isMusicMode = false;
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { h += `<div class="menu-item" data-idx="${i}">${d.ti}</div>`; });
    render(h, (e) => {
        const i = parseInt(e.target.dataset.idx);
        if(!isNaN(i)) { nav.updateNav(undefined, undefined, undefined, i); setMon('i', `./talk_images/${nav.curP[i].id}.jpg`); sophieSpeak(nav.curP[i].txt); updateHigh(); }
    });
}

function render(h, cb) { menuC.innerHTML = h; menuC.onclick = cb; menuL.scrollTop = 0; }

function handleBack() {
    if (nav.state === "st") renderThemes(nav.curG); else if (nav.state === "th") openTalk(); else if (nav.state === "tit") openMusic();
    else { menuL.style.display = 'none'; navM.style.display = 'grid'; nav.updateNav("none"); }
}

function checkYT() { if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*'); }
window.addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d.info === 0 && isAutoPlay && isMusicMode) next(); } catch(err){} });
