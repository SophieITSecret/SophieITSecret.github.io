import * as media from './media.js';
import * as nav from './navigation.js';

let isAutoPlay = false, isMusicMode = false, lastTxt = "";

// Firebaseの準備（元のコードから継承）
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
const firebaseConfig = { apiKey: "AIzaSyC1Jvj7A03LCUVlcLZGMROJn5DU3D-l7JY", authDomain: "bar-sophie.firebaseapp.com", projectId: "bar-sophie", storageBucket: "bar-sophie.firebasestorage.app", messagingSenderId: "398354933251", appId: "1:398354933251:web:1afc2c3b879c2a50fa9036" };
const fbApp = initializeApp(firebaseConfig); const db = getFirestore(fbApp);

// 要素取得
const chat = document.getElementById('chat-area');
const telop = document.getElementById('telop-box');
const monitorImg = document.getElementById('monitor-image');
const yt = document.getElementById('yt-iframe');
const menuLayer = document.getElementById('menu-layer');
const menuContent = document.getElementById('menu-content');

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    window.enterBar = enterBar; // HTMLからの呼び出し対応
    window.handleMasterBack = handleBack;
    window.openMusicMenu = openMusic;
    window.openTalkGenres = openTalk;
    setInterval(checkAuto, 1000);
});

function enterBar() {
    document.getElementById('entry-overlay').style.display = 'none';
    sophieSpeak("まきむら様、お帰りなさいませ。今夜は音楽になさいますか？ それとも、お酒の物語を楽しみましょうか？");
}

function sophieSpeak(text, isMusic = false) {
    media.speak(text, 1.05, () => {
        if(isAutoPlay && !isMusicMode) setTimeout(next, 1000);
    });
    chat.innerText = text;
    lastTxt = text;
    if(text.length > 20) {
        telop.innerText = text;
        telop.style.display = 'block';
        if(isMusic) setTimeout(() => { if(telop.innerText === text) telop.style.display='none'; }, 5000);
    }
}

// 共通の次へ送り
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
    } else { isAutoPlay = false; }
}

function setMonitor(mode, src) {
    yt.style.display='none'; monitorImg.style.display='none'; yt.src="";
    if(mode === 'v') {
        yt.style.display='block';
        yt.src=`https://www.youtube.com/embed/${media.extractYtId(src)}?autoplay=1&enablejsapi=1`;
    } else {
        monitorImg.style.display='block'; monitorImg.src=src;
    }
}

function updateHighlight() {
    document.querySelectorAll('.menu-item').forEach((el, idx) => {
        el.classList.toggle('active-item', idx === nav.curI);
    });
}

// メニュー操作
function openMusic() {
    nav.updateNav("art");
    menuLayer.style.display = 'flex';
    menuLayer.classList.remove('single-col');
    let h = '<div class="genre-label">アーティスト</div>';
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        arts.forEach(a => { h += `<div class="menu-item" onclick="window.renderSongs('${a}')">🎤 ${a}</div>`; });
    });
    menuContent.innerHTML = h;
    window.renderSongs = renderSongs;
}

function renderSongs(a) {
    nav.updateNav("tit", a, nav.jData.filter(m => m.a === a));
    isMusicMode = true;
    menuLayer.classList.add('single-col');
    let h = `<div class="genre-label">${a}</div>`;
    nav.curP.forEach((m, i) => { h += `<div class="menu-item" onclick="window.playMusic(${i})">${m.ti}</div>`; });
    menuContent.innerHTML = h;
    window.playMusic = (i) => { nav.updateNav(undefined, undefined, undefined, i); setMonitor('v', nav.curP[i].u); sophieSpeak(a + "さんの" + nav.curP[i].ti + "です", true); updateHighlight(); };
}

function openTalk() {
    nav.updateNav("g");
    menuLayer.style.display = 'flex';
    menuLayer.classList.remove('single-col');
    let h = '<div class="genre-label">ジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="menu-item" onclick="window.openThemes('${g}')">📁 ${g}</div>`; });
    menuContent.innerHTML = h;
    window.openThemes = (g) => { nav.updateNav("th", g); renderThemes(g); };
}

function renderThemes(g) {
    nav.updateNav("th");
    menuLayer.classList.add('single-col');
    let h = `<div class="genre-label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="menu-item" onclick="window.openStories('${t}')">🏷️ ${t}</div>`; });
    menuContent.innerHTML = h;
    window.openStories = (t) => { nav.updateNav("st", undefined, nav.tData.filter(d => d.th === t)); renderStories(t); };
}

function renderStories(t) {
    isMusicMode = false;
    let h = `<div class="genre-label">${t}</div>`;
    nav.curP.forEach((d, i) => { h += `<div class="menu-item" onclick="window.playTalk(${i})">${d.ti}</div>`; });
    menuContent.innerHTML = h;
    window.playTalk = (i) => { nav.updateNav(undefined, undefined, undefined, i); setMonitor('i', `./talk_images/${nav.curP[i].id}.jpg`); sophieSpeak(nav.curP[i].txt); updateHighlight(); };
}

function handleBack() {
    if (nav.state === "st") renderThemes(nav.curG);
    else if (nav.state === "th") openTalk();
    else if (nav.state === "tit") openMusic();
    else { menuLayer.style.display = 'none'; nav.updateNav("none"); }
}

function checkAuto() { if(isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*'); }
window.addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d.info === 0 && isAutoPlay && isMusicMode) next(); } catch(err){} });
