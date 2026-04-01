import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop'), lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    document.getElementById('btn-enter').onclick = () => { document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; media.speak("まきむら様、お帰りなさいませ。"); };
    document.getElementById('btn-to-bar').onclick = () => { document.getElementById('chat-mode').style.display='none'; document.getElementById('main-ui').style.display='flex'; window.speechSynthesis.cancel(); };
    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    document.getElementById('sophie-warp').onclick = () => { if(nav.state !== "none") { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); } else { document.getElementById('main-ui').style.display='none'; document.getElementById('chat-mode').style.display='flex'; } };
    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;
    const btnN = document.getElementById('btn-next');
    btnN.onpointerdown = () => { pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
    btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
}

function playHead() {
    yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
    yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    if(!isMusicMode && lastTxt) media.speak(lastTxt, 1.05, () => { if(isAutoPlay) setTimeout(next, 800); });
}

function togglePause() {
    if(!isPaused) { yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); window.speechSynthesis.pause(); isPaused = true; }
    else { yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); window.speechSynthesis.resume(); isPaused = false; }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (isMusicMode) { setMon('v', m.u); prep(m.a+'さんの'+m.ti+'です', true); }
        else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false); if(isAutoPlay) media.speak(m.txt, 1.05, () => setTimeout(next, 800)); }
    } else { isAutoPlay = false; document.getElementById('btn-next').classList.remove('auto-active'); }
}

function setMon(m, s) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    setTimeout(() => { if(m==='v') { yt.style.display='block'; yt.src=`https://www.youtube.com/embed/${media.extractYtId(s)}?autoplay=1&enablejsapi=1`; } else { img.style.display='block'; img.src=s; } }, 100);
}

function prep(t, isM) {
    window.speechSynthesis.cancel(); lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
    if(isM) setTimeout(() => { if(tel.innerText === t) tel.style.display = 'none'; }, 5000);
    document.querySelectorAll('.item').forEach((el, idx) => el.classList.toggle('active-item', idx === nav.curI));
}

function checkYT() { if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*'); }
window.addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d.info === 0 && isAutoPlay && isMusicMode) next(); } catch(err){} });

function openMusic() {
    nav.updateNav("art"); let h = "";
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { h += `<div class="label">${nav.jData.find(d => d.f === f).gName}</div>`; arts.forEach(a => { h += `<div class="item" id="art-${a}">🎤 ${a}</div>`; }); }
    });
    render(h, (e) => { if(e.target.id.startsWith('art-')) renderSongs(e.target.id.replace('art-','')); });
}
function renderSongs(a) {
    nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a)); isMusicMode = true;
    let h = `<div class="label">${a}</div>`;
    nav.curP.forEach((m, i) => { h += `<div class="item" data-idx="${i}">${m.ti}</div>`; });
    render(h, (e) => { const i = parseInt(e.target.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('v', nav.curP[i].u); prep(a+'さんの'+nav.curP[i].ti+'です', true); } });
}
function openTalk() {
    nav.updateNav("g"); let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="item" id="g-${g}">📁 ${g}</div>`; });
    render(h, (e) => { if(e.target.id.startsWith('g-')) { nav.updateNav("th", e.target.id.replace('g-','')); openThemes(nav.curG); } });
}
function openThemes(g) {
    nav.updateNav("th"); let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="item" id="th-${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { if(e.target.id.startsWith('th-')) openStories(e.target.id.replace('th-','')); });
}
function openStories(t) {
    nav.updateNav("st", undefined, nav.tData.filter(d => d.th === t)); isMusicMode = false;
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { h += `<div class="item" data-idx="${i}">${d.ti}</div>`; });
    render(h, (e) => { const i = parseInt(e.target.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('i', `./talk_images/${nav.curP[i].id}.jpg`); prep(nav.curP[i].txt, false); } });
}
function render(h, cb) { nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; lv.onclick = cb; document.getElementById('main-scroll').scrollTop = 0; }
function handleBack() {
    if (nav.state === "st") openThemes(nav.curG); else if (nav.state === "th") openTalk(); else if (nav.state === "tit") openMusic();
    else { lv.style.display = 'none'; nm.style.display = 'block'; nav.updateNav("none"); }
}
