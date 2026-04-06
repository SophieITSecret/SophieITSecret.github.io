import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop'), lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

const talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    document.getElementById('btn-enter').onclick = () => { 
        document.getElementById('entry-screen').style.display='none'; 
        document.getElementById('chat-mode').style.display='flex'; 
        
        const fallbackText = "いらっしゃいませ。お待ちしておりました。";
        talkAudio.src = "./voices_mp3/greeting.mp3";
        talkAudio.onerror = () => { media.speak(fallbackText); };
        const p = talkAudio.play();
        if (p !== undefined) p.catch(() => { media.speak(fallbackText); });
    };

    document.getElementById('btn-to-bar').onclick = () => { 
        document.getElementById('chat-mode').style.display='none'; 
        document.getElementById('main-ui').style.display='flex'; 
        window.speechSynthesis.cancel(); 
        talkAudio.pause();
    };

    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    document.getElementById('sophie-warp').onclick = () => { 
        if(nav.state !== "none") { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); } 
        else { document.getElementById('main-ui').style.display='none'; document.getElementById('chat-mode').style.display='flex'; } 
    };

    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;

    const btnN = document.getElementById('btn-next');
    btnN.onpointerdown = (e) => { 
        e.preventDefault();
        pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); 
    };
    btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
    btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };

    talkAudio.onended = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };
}

function playHead() {
    yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
    yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    if(!isMusicMode) talkAudio.play().catch(()=>{});
}

function togglePause() {
    if(!isPaused) { yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); talkAudio.pause(); window.speechSynthesis.pause(); isPaused = true; }
    else { yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*'); if(!isMusicMode) talkAudio.play().catch(()=>{}); window.speechSynthesis.resume(); isPaused = false; }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (isMusicMode) { setMon('v', m.u); prep(`${m.a}さんの${m.ti}です`, true); } 
        else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
    } else { isAutoPlay = false; document.getElementById('btn-next').classList.remove('auto-active'); }
}

function setMon(m, s) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    if(m==='v') { 
        yt.style.display='block'; 
        yt.src=`https://www.youtube.com/embed/${media.extractYtId(s)}?autoplay=1&enablejsapi=1`; 
    } else { 
        img.style.display='block'; img.src=s; 
    }
}

function prep(t, isM, id = null) {
    window.speechSynthesis.cancel(); 
    try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e){}
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
    
    if(isM) {
        setTimeout(() => { if(tel.innerText === t) tel.style.display = 'none'; }, 5000);
    } else if (id) {
        talkAudio.src = `./voices_mp3/${id}.mp3`;
        talkAudio.onerror = () => media.speak(t);
        const p = talkAudio.play();
        if (p !== undefined) p.catch(() => media.speak(t));
    }
    
    document.querySelectorAll('#list-view .item').forEach((el) => {
        if (el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) el.classList.add('active-item');
        else el.classList.remove('active-item');
    });
}

function checkYT() { if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*'); }
window.addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d.info === 0 && isAutoPlay && isMusicMode) next(); } catch(err){} });

// --- 音楽選曲（マスターお薦め ＆ オリジナル階層） ---
function openMusic() {
    nav.updateNav("art"); let h = "";

    // 1. ジャンル「マスターお薦め」と、仮想歌手たち（2カラム）
    h += `<div class="label">マスターお薦め</div>`;
    h += `<div class="artist-grid">`;
    h += `<div class="item" data-special="ソフィー" style="color: var(--blue);">🎤 ソフィー</div>`;
    h += `<div class="item" data-special="BGM">🎤 BGM</div>`;
    h += `<div class="item" data-special="昭和ソング">🎤 昭和ソング</div>`;
    h += `</div>`;

    // 2. オリジナルのジャンル階層（2カラム）
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { 
            h += `<div class="label">${nav.jData.find(d => d.f === f).gName}</div>`; 
            h += `<div class="artist-grid">`;
            arts.forEach(a => { h += `<div class="item" data-artist="${a}">🎤 ${a}</div>`; }); 
            h += `</div>`;
        }
    });

    render(h, (e) => { 
        const el = e.currentTarget;
        if(el.dataset.special) openSpecialSongs(el.dataset.special);
        else if(el.dataset.artist) openSongs(el.dataset.artist); 
    });
}

function openSpecialSongs(type) {
    let filtered = [];
    if(type === 'ソフィー') {
        filtered = nav.jData.filter(m => m.a && m.a.includes("ソフィー"));
    } else if(type === 'BGM') {
        filtered = nav.jData.filter(m => { const n = parseInt(m.fix); return !isNaN(n) && n >= 1 && n <= 6; });
    } else if(type === '昭和ソング') {
        filtered = nav.jData.filter(m => { const n = parseInt(m.fix); return !isNaN(n) && n >= 7 && n <= 10; });
