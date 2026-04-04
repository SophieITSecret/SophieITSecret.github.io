import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop'), lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

// 音声再生用のオーディオ要素（index_m.htmlにaudioタグがある前提）
const talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
if(!talkAudio.id) {
    talkAudio.id = 'talk-audio';
    document.body.appendChild(talkAudio);
}

document.addEventListener('DOMContentLoaded', async () => {
    // 360本対応のCSV読み込み
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    // 入店ボタン
    document.getElementById('btn-enter').onclick = () => { 
        document.getElementById('entry-screen').style.display='none'; 
        document.getElementById('chat-mode').style.display='flex'; 
        // 音声制限解除
        talkAudio.play().catch(()=>{}); talkAudio.pause();
        media.speak("まきむら様、お帰りなさいませ。"); 
    };

    document.getElementById('btn-to-bar').onclick = () => { 
        document.getElementById('chat-mode').style.display='none'; 
        document.getElementById('main-ui').style.display='flex'; 
        window.speechSynthesis.cancel(); 
    };

    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;

    document.getElementById('sophie-warp').onclick = () => { 
        if(nav.state !== "none") { 
            lv.style.display='none'; 
            nm.style.display='block'; 
            nav.updateNav("none"); 
        } else { 
            document.getElementById('main-ui').style.display='none'; 
            document.getElementById('chat-mode').style.display='flex'; 
        } 
    };

    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;

    // 次へボタン（長押しでオートプレイ切り替え）
    const btnN = document.getElementById('btn-next');
    btnN.onpointerdown = (e) => {
        pressTimer = setTimeout(() => {
            isAutoPlay = !isAutoPlay;
            btnN.classList.toggle('auto-active', isAutoPlay);
            pressTimer = null;
        }, 600);
    };
    btnN.onpointerup = () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); }
    };

    // 音声終了で次へ（オートプレイ時）
    talkAudio.onended = () => {
        if (isAutoPlay && !isMusicMode) setTimeout(next, 1200);
    };
}

// --- お酒の話リスト表示 (360本対応・FIXソート) ---
function openTalk() {
    nav.updateNav("g");
    let h = '<div class="label">お酒のジャンル</div>';
    // 重複排除してジャンル一覧作成
    const genres = [...new Set(nav.tData.map(d => d.g))].filter(g => g);
    genres.forEach(g => { h += `<div class="item" id="g-${g}">📁 ${g}</div>`; });
    render(h, (e) => { 
        if(e.target.id.startsWith('g-')) { 
            const selG = e.target.id.replace('g-','');
            nav.updateNav("th", selG); 
            openThemes(selG); 
        } 
    });
}

function openThemes(g) {
    let h = `<div class="label">${g}</div>`;
    const themes = [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].filter(t => t);
    themes.forEach(t => { h += `<div class="item" id="th-${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { 
        if(e.target.id.startsWith('th-')) {
            const selT = e.target.id.replace('th-','');
            openStories(selT); 
        } 
    });
}

function openStories(t) {
    // FIXフラグ（CSVの7列目/F列）によるソート
    const stories = nav.tData.filter(d => d.th === t).sort((a, b) => {
        const fixA = (a.fix === "1" || a.fix === "true") ? 1 : 0;
        const fixB = (b.fix === "1" || b.fix === "true") ? 1 : 0;
        return fixB - fixA;
    });
    
    nav.updateNav("st", undefined, stories);
    isMusicMode = false;
    let h = `<div class="label">${t}</div>`;
    stories.forEach((d, i) => { 
        const fixIcon = (d.fix === "1" || d.fix === "true") ? "📌 " : "";
        h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti}</div>`; 
    });
    render(h, (e) => { 
        const i = parseInt(e.target.dataset.idx); 
        if(!isNaN(i)){ 
            nav.updateNav(undefined,undefined,undefined,i); 
            setMon('i', `./talk_images/${nav.curD.id}.jpg`); 
            prep(nav.curD.txt, false, nav.curD.id); 
        } 
    });
}

// --- 音楽選曲リスト表示 ---
function openMusic() {
    nav.updateNav("art");
    let h = '<div class="label">アーティスト選曲</div>';
    const artists = [...new Set(nav.mData.map(d => d.a))].filter(a => a);
    artists.forEach(a => { h += `<div class="item" id="art-${a}">🎤 ${a}</div>`; });
    render(h, (e) => { 
        if(e.target.id.startsWith('art-')) { 
            const selA = e.target.id.replace('art-','');
            openSongs(selA); 
        } 
    });
}

function openSongs(a) {
    const songs = nav.mData.filter(m => m.a === a);
    nav.updateNav("tit", undefined, songs);
    isMusicMode = true;
    let h = `<div class="label">${a}</div>`;
    songs.forEach((m, i) => { h += `<div class="item" data-idx="${i}">${m.ti}</div>`; });
    render(h, (e) => { 
        const i = parseInt(e.target.dataset.idx); 
        if(!isNaN(i)){ 
            nav.updateNav(undefined,undefined,undefined,i); 
            setMon('v', nav.curD.u); 
            prep(`${nav.curD.a}さんの「${nav.curD.ti}」です。`, true); 
        } 
    });
}

// --- 共通処理 ---
function render(h, cb) {
    nm.style.display='none'; lv.style.display='block'; lv.innerHTML=h; lv.onclick=cb;
    document.getElementById('main-scroll').scrollTop = 0;
}

function setMon(type, src) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    setTimeout(() => {
        if(type==='v'){ 
            yt.style.display='block'; 
            const id = extractYtId(src);
            yt.src=`https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`; 
        } else { 
            img.style.display='block'; img.src=src; 
        }
    }, 100);
}

function prep(t, isM, id = null) {
    window.speechSynthesis.cancel();
    talkAudio.pause(); talkAudio.currentTime = 0;
    
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display='block'; tel.scrollTop = 0;

    if(isM) {
        media.speak(t);
        setTimeout(() => { if(tel.innerText===t) tel.style.display='none'; }, 5000);
    } else {
        // MP3再生 (ID.mp3)
        if(id) {
            talkAudio.src = `./voices_mp3/${id}.mp3?t=${new Date().getTime()}`;
            talkAudio.onerror = () => { media.speak(t); }; // ファイルがない時の保険
            talkAudio.play().catch(() => { media.speak(t); });
        }
    }
    // ハイライト表示
    const items = lv.querySelectorAll('.item');
    items.forEach(el => {
        if(parseInt(el.dataset.idx) === nav.idx) el.classList.add('active-item');
        else el.classList.remove('active-item');
    });
}

function handleBack() {
    const s = nav.state;
    if(s==="st") openThemes(nav.curG);
    else if(s==="th") openTalk();
    else if(s==="tit") openMusic();
    else if(s==="art") { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); }
    else { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); }
}

function playHead() {
    if(isMusicMode) {
        yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
        yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        media.speak(lastTxt);
    } else {
        talkAudio.play().catch(()=>{});
    }
}

function togglePause() {
    if(!isPaused) {
        yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        talkAudio.pause(); window.speechSynthesis.pause(); isPaused = true;
    } else {
        yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        if(!isMusicMode) talkAudio.play().catch(()=>{});
        window.speechSynthesis.resume(); isPaused = false;
    }
}

function next() {
    if(nav.idx < nav.curP.length - 1) {
        const i = nav.idx + 1;
        nav.updateNav(undefined,undefined,undefined,i);
        if(isMusicMode) { setMon('v', nav.curD.u); prep(`${nav.curD.a}さんの「${nav.curD.ti}」です。`, true); }
        else { setMon('i', `./talk_images/${nav.curD.id}.jpg`); prep(nav.curD.txt, false, nav.curD.id); }
    }
}

function extractYtId(u) {
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = u.match(reg);
    return match ? match[1] : u;
}

function checkYT() {
    if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*');
}

window.addEventListener('message', e => {
    try {
        const d = JSON.parse(e.data);
        if (d.info === 0 && isAutoPlay && isMusicMode) next();
    } catch(err){}
});
