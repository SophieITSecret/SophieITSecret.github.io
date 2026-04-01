import * as media from './media.js';
import * as nav from './navigation.js';

let isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null, isPaused = false;

// 要素の取得
const chat = document.getElementById('chat-area');
const tel = document.getElementById('telop-box');
const img = document.getElementById('monitor-image');
const yt = document.getElementById('yt-iframe');
const menuL = document.getElementById('menu-layer');
const menuC = document.getElementById('menu-content');
const navM = document.getElementById('nav-main-pc');

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setupEventListeners();
    setInterval(checkYouTubeStatus, 1000);
});

function setupEventListeners() {
    // 入店
    document.getElementById('btn-entry-pc').onclick = () => {
        document.getElementById('entry-overlay').style.display = 'none';
        sophieSpeak("まきむら様、お帰りなさいませ。");
    };

    // 4大ボタン
    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    
    // 次へ（長押し対応）
    const btnN = document.getElementById('btn-next');
    btnN.onpointerdown = () => {
        pressTimer = setTimeout(() => {
            isAutoPlay = !isAutoPlay;
            btnN.classList.toggle('auto-active', isAutoPlay);
            pressTimer = null;
        }, 600);
    };
    btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };

    // メインメニュー切り替え
    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;

    // ソフィーワープ
    document.getElementById('sophie-image').onclick = () => {
        if(nav.state !== "none") {
            handleBack();
        } else {
            document.getElementById('entry-overlay').style.display = 'flex';
        }
    };
}

function sophieSpeak(text, isMusic = false) {
    media.speak(text, 1.05, () => { if(isAutoPlay && !isMusicMode) setTimeout(next, 1000); });
    chat.innerText = text; 
    lastTxt = text;
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
    if(!isPaused) {
        yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        window.speechSynthesis.pause(); isPaused = true;
    } else {
        yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        window.speechSynthesis.resume(); isPaused = false;
    }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (isMusicMode) {
            setMonitor('v', m.u);
            sophieSpeak(nav.curG + "さんの" + m.ti + "です", true);
        } else {
            setMonitor('i', `./talk_images/${m.id}.jpg`);
            sophieSpeak(m.txt);
        }
        updateHighlight();
    } else {
        isAutoPlay = false;
        document.getElementById('btn-next').classList.remove('auto-active');
    }
}

function setMonitor(mode, src) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    setTimeout(() => {
        if(mode === 'v') {
            yt.style.display='block';
            yt.src=`https://www.youtube.com/embed/${media.extractYtId(src)}?autoplay=1&enablejsapi=1`;
        } else {
            img.style.display='block'; img.src=src;
        }
    }, 100);
}

function updateHighlight() {
    document.querySelectorAll('.menu-item').forEach((el, idx) => {
        el.classList.toggle('active-item', idx === nav.curI);
    });
}

// メニュー生成（イベント委譲でクリックを拾う）
function openMusic() {
    nav.updateNav("art"); menuL.style.display = 'block'; navM.style.display = 'none';
    let h = '<div class="genre-label">アーティスト</div>';
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        arts.forEach(a => { h += `<div class="menu-item art-click" data-art="${a}">🎤 ${a}</div>`; });
    });
    menuC.innerHTML = h;
    menuC.onclick = (e) => {
        const art = e.target.closest('.art-click')?.dataset.art;
        if(art) renderSongs(art);
    };
}

function renderSongs(a) {
    nav.updateNav("tit", a, nav.jData.filter(m => m.a === a)); isMusicMode = true;
    let h = `<div class="genre-label">${a}</div>`;
    nav.curP.forEach((m, i) => { h += `<div class="menu-item song-click" data-idx="${i}">${m.ti}</div>`; });
    menuC.innerHTML = h;
    menuC.onclick = (e) => {
        const i = parseInt(e.target.closest('.song-click')?.dataset.idx);
        if(!isNaN(i)) {
            nav.updateNav(undefined, undefined, undefined, i);
            setMonitor('v', nav.curP[i].u);
            sophieSpeak(a + "さんの" + nav.curP[i].ti + "です", true);
            updateHighlight();
        }
    };
}

function openTalk() {
    nav.updateNav("g"); menuL.style.display = 'block'; navM.style.display = 'none';
    let h = '<div class="genre-label">ジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="menu-item g-click" data-g="${g}">📁 ${g}</div>`; });
    menuC.innerHTML = h;
    menuC.onclick = (e) => {
        const g = e.target.closest('.g-click')?.dataset.g;
        if(g) { nav.updateNav("th", g); renderThemes(g); }
    };
}

function renderThemes(g) {
    nav.updateNav("th");
    let h = `<div class="genre-label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => {
        h += `<div class="menu-item th-click" data-th="${t}">🏷️ ${t}</div>`;
    });
    menuC.innerHTML = h;
    menuC.onclick = (e) => {
        const t = e.target.closest('.th-click')?.dataset.th;
        if(t) { nav.updateNav("st", undefined, nav.tData.filter(d => d.th === t)); renderStories(t); }
    };
}

function renderStories(t) {
    isMusicMode = false;
    let h = `<div class="genre-label">${t}</div>`;
    nav.curP.forEach((d, i) => { h += `<div class="menu-item st-click" data-idx="${i}">${d.ti}</div>`; });
    menuC.innerHTML = h;
    menuC.onclick = (e) => {
        const i = parseInt(e.target.closest('.st-click')?.dataset.idx);
        if(!isNaN(i)) {
            nav.updateNav(undefined, undefined, undefined, i);
            setMonitor('i', `./talk_images/${nav.curP[i].id}.jpg`);
            sophieSpeak(nav.curP[i].txt);
            updateHighlight();
        }
    };
}

function handleBack() {
    if (nav.state === "st") renderThemes(nav.curG);
    else if (nav.state === "th") openTalk();
    else if (nav.state === "tit") openMusic();
    else { menuL.style.display = 'none'; navM.style.display = 'grid'; nav.updateNav("none"); }
}

function checkYouTubeStatus() {
    if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*');
}

window.addEventListener('message', (e) => {
    try {
        const d = JSON.parse(e.data);
        if (d.info === 0 && isAutoPlay && isMusicMode) next();
    } catch(err){}
});
