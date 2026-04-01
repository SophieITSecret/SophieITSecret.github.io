import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-image'), tel = document.getElementById('telop-box');
const chat = document.getElementById('chat-area'), menuL = document.getElementById('menu-layer'), menuC = document.getElementById('menu-content');

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    window.enterBar = () => { document.getElementById('entry-overlay').style.display='none'; sophieSpeak("まきむら様、お帰りなさいませ。"); };
    window.toggleTheater = () => { 
        const isTheater = document.body.classList.toggle('theater-mode');
        document.getElementById('mode-toggle').innerText = isTheater ? "戻る" : "シアター";
        document.getElementById('theater-req').style.display = isTheater ? "inline-block" : "none";
    };
    window.playFix = (url) => { isMusicMode = true; setMon('v', url); prepMedia("リクエストありがとうございます", true); };
    window.openMenu = () => { menuL.style.display='flex'; openMusic(); };
    window.closeMenu = () => { menuL.style.display='none'; };
    document.getElementById('menu-back').onclick = window.closeMenu;

    // コントロール
    window.playCurrent = () => { yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); if(!isMusicMode && lastTxt) sophieSpeak(lastTxt); };
    window.pauseSong = () => { yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); window.speechSynthesis.pause(); isPaused = true; };
    window.resetSong = () => { if(nav.curP[nav.curI]) setMon('v', nav.curP[nav.curI].url); };

    // 次へ（長押しでオートプレイ）
    window.nextSong = next;
    const btnN = document.querySelector('button[onclick="nextSong()"]');
    btnN.onpointerdown = () => { pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
    btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
}

function sophieSpeak(text, isMusic = false) {
    media.speak(text, 1.05, () => { if(isAutoPlay && !isMusicMode) setTimeout(next, 1000); });
    chat.innerText = text; lastTxt = text;
    if(text.length > 20) {
        tel.innerText = text; tel.style.display='block'; tel.scrollTop=0;
        if(isMusic) setTimeout(() => { if(tel.innerText === text) tel.style.display='none'; }, 5000);
    }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (isMusicMode) { setMon('v', m.u || m.url); prepMedia(nav.curG + "さんの" + m.ti + "です", true); }
        else { setMon('i', `./talk_images/${m.id}.jpg`); prepMedia(m.txt, false); if(isAutoPlay) sophieSpeak(m.txt); }
        updateHigh();
    } else { isAutoPlay = false; }
}

function setMon(mode, src) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    setTimeout(() => {
        if(mode==='v') { yt.style.display='block'; yt.src=`https://www.youtube.com/embed/${media.extractYtId(src)}?autoplay=1&enablejsapi=1`; }
        else { img.style.display='block'; img.src=src; }
    }, 100);
}

function prepMedia(t, isM) { window.speechSynthesis.cancel(); lastTxt = t; isMusicMode = isM; updateHigh(); }
function updateHigh() { document.querySelectorAll('.menu-item').forEach((el, idx) => el.classList.toggle('active-item', idx === nav.curI)); }

// メニュー生成（スマホ版とほぼ共通化）
function openMusic() {
    nav.updateNav("art"); let h = "";
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { h += `<div class="genre-label">${nav.jData.find(d => d.f === f).gName}</div>`; arts.forEach(a => { h += `<div class="menu-item" id="art-${a}">🎤 ${a}</div>`; }); }
    });
    render(h, (e) => { if(e.target.id.startsWith('art-')) renderSongs(e.target.id.replace('art-','')); });
}
function renderSongs(a) {
    nav.updateNav("tit", a, nav.jData.filter(m => m.a === a)); isMusicMode = true;
    let h = `<div class="genre-label">${a}</div>`;
    nav.curP.forEach((m, i) => { h += `<div class="menu-item" data-idx="${i}">${m.ti}</div>`; });
    render(h, (e) => { const i = parseInt(e.target.dataset.idx); if(!isNaN(i)) { nav.updateNav(undefined,undefined,undefined,i); setMon('v', nav.curP[i].u); prepMedia(a+'さんの'+nav.curP[i].ti+'です', true); } });
}
// お酒メニュー(openTalk...)も同様にapp_m.jsから移植

function render(h, cb) { menuC.innerHTML = h; menuC.onclick = cb; }
function checkYT() { if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*'); }
window.addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d.info === 0 && isAutoPlay && isMusicMode) next(); } catch(err){} });
