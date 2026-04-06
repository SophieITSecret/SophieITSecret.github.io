import * as media from './media.js';
import * as nav from './navigation.js';

// 自己診断ツール
window.onerror = function(msg, url, lineNo) {
    alert("System Error:\n" + msg + "\nLine: " + lineNo);
    return true;
};

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let currentMusicGenre = ""; 

const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop'), lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

const talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
if(!talkAudio.id) { 
    talkAudio.id = 'talk-audio'; 
    document.body.appendChild(talkAudio); 
}

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    // 【要件1】入り口の挨拶：greeting.mp3（または汎用テキストの読み上げ）
    document.getElementById('btn-enter').onclick = () => { 
        document.getElementById('entry-screen').style.display='none'; 
        document.getElementById('chat-mode').style.display='flex'; 
        
        const fallbackText = "いらっしゃいませ。お待ちしておりました。";
        talkAudio.src = "./voices_mp3/greeting.mp3";
        talkAudio.onerror = () => { media.speak(fallbackText); };
        
        const playPromise = talkAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => { media.speak(fallbackText); });
        }
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
    btnN.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pressTimer = setTimeout(() => {
            isAutoPlay = !isAutoPlay;
            btnN.classList.toggle('auto-active', isAutoPlay);
            pressTimer = null;
        }, 600);
    });
    btnN.addEventListener('pointerup', () => { 
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } 
    });
    btnN.addEventListener('pointerleave', () => {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });

    talkAudio.onended = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };
}

// --- お酒の話 ---
function openTalk() {
    nav.updateNav("th"); 
    let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].filter(Boolean).forEach(g => { h += `<div class="item" id="g-${g}">📁 ${g}</div>`; });
    
    render(h, (item) => { 
        if(item.id && item.id.startsWith('g-')) { 
            const selG = item.id.replace('g-','');
            nav.updateNav("th", selG); 
            openThemes(selG); 
        } 
    });
}

function openThemes(g) {
    nav.updateNav("th"); 
    let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].filter(Boolean).forEach(t => { h += `<div class="item" id="th-${t}">🏷️ ${t}</div>`; });
    
    render(h, (item) => { 
        if(item.id && item.id.startsWith('th-')) openStories(item.id.replace('th-','')); 
    });
}

function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a, b) => {
        const fixA = (a.fix === "1" || a.fix === "true") ? 1 : 0;
        const fixB = (b.fix === "1" || b.fix === "true") ? 1 : 0;
        return fixB - fixA;
    });
    nav.updateNav("st", undefined, stories);
    isMusicMode = false;
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { 
        const fixIcon = (d.fix === "1" || d.fix === "true") ? "📌 " : "";
        h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti}</div>`; 
    });
    
    render(h, (item) => { 
        if(!item.dataset.idx) return;
        const i = parseInt(item.dataset.idx); 
        if(!isNaN(i)){ 
            nav.updateNav(undefined,undefined,undefined,i);
            const curItem = nav.curP[nav.curI];
            setMon('i', `./talk_images/${curItem.id}.jpg`); 
            prep(curItem.txt, false, curItem.id); 
        } 
    });
}

// --- 音楽選曲 ---
// 【要件2】ジャンル表記の復活と翻訳
function getMusicGenreName(code) {
    if(!code) return "その他";
    const map = {
        'e': '演歌', 'E': '演歌',
        'f': 'フォーク', 'F': 'フォーク',
        'k': '歌謡曲', 'K': '歌謡曲',
        'y': '洋楽', 'Y': '洋楽',
        'i': '演奏', 'I': '演奏',
        's': '風景・旅情', 'S': '風景・旅情'
    };
    return map[code.trim()] || code;
}

function openMusic() {
    nav.updateNav("m_gen"); 
    let h = '<div class="label">音楽ジャンル</div>';
    
    // 【要件2】特選曲の自動生成（A案）
    const hasSpecial = nav.jData.some(m => m.fix === "1" || m.fix === "true" || (m.a && m.a.includes("ソフィー")));
    if(hasSpecial) {
        h += `<div class="item" id="mgen-SPECIAL">⭐ 特選曲</div>`;
    }

    const genres = [...new Set(nav.jData.map(d => d.g))].filter(Boolean);
    genres.forEach(g => { 
        h += `<div class="item" id="mgen-${g}">📁 ${getMusicGenreName(g)}</div>`; 
    });
    
    render(h, (item) => { 
        if(item.id && item.id.startsWith('mgen-')) {
            currentMusicGenre = item.id.replace('mgen-','');
            openMusicArtists(currentMusicGenre); 
        }
    });
}

function openMusicArtists(genre) {
    nav.updateNav("art");
    const genreName = (genre === 'SPECIAL') ? '⭐ 特選曲' : getMusicGenreName(genre);
    
    // 【要件2】表記を「アーティスト一覧」に戻す
    let h = `<div class="label">${genreName} - アーティスト一覧</div>`;
    
    // 【要件2】見やすい2カラムレイアウト（縦割り）
    h += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 4px;">`;
    
    let filtered;
    if(genre === 'SPECIAL') {
        filtered = nav.jData.filter(m => m.fix === "1" || m.fix === "true" || (m.a && m.a.includes("ソフィー")));
    } else {
        filtered = nav.jData.filter(m => m.g === genre);
    }
    
    const artists = [...new Set(filtered.map(d => d.a))].filter(Boolean);
    artists.forEach(a => { 
        h += `<div class="item" style="margin:0; font-size: 0.95rem; padding: 12px 5px;" data-genre="${genre}" data-artist="${a}">🎤 ${a}</div>`; 
    });
    h += `</div>`;
    
    render(h, (item) => { 
        const g = item.dataset.genre;
        const a = item.dataset.artist;
        if(g && a) { openSongs(g, a); }
    });
}

function openSongs(genre, artist) {
    let filtered;
    if(genre === 'SPECIAL') {
        filtered = nav.jData.filter(m => (m.fix === "1" || m.fix === "true" || (m.a && m.a.includes("ソフィー"))) && m.a === artist);
    } else {
        filtered = nav.jData.filter(m => m.g === genre && m.a === artist);
    }
    
    nav.updateNav("tit", undefined, filtered);
    isMusicMode = true;
    let h = `<div class="label">${artist}</div>`;
    
    // 【要件2】見やすい2カラムレイアウト（縦割り）
    h += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; padding: 4px;">`;
    nav.curP.forEach((m, i) => { 
        h += `<div class="item" style="margin:0; font-size: 0.95rem; padding: 12px 5px;" data-idx="${i}">🎵 ${m.ti}</div>`; 
    });
    h += `</div>`;
    
    render(h, (item) => { 
        if(!item.dataset.idx) return;
        const i = parseInt(item.dataset.idx); 
        if(!isNaN(i)){ 
            nav.updateNav(undefined,undefined,undefined,i); 
            const curItem = nav.curP[nav.curI];
            setMon('v', curItem.u); 
            prep(`${curItem.a}さんの「${curItem.ti}」です。`, true); 
        } 
    });
}

// --- 共通メディア・UI制御 ---
function render(h, cb) {
    nm.style.display='none'; 
    lv.style.display='block'; 
    lv.innerHTML=h; 
    document.getElementById('main-scroll').scrollTop = 0;

    const items = lv.querySelectorAll('.item');
    items.forEach(item => {
        item.onclick = () => cb(item); 
    });
}

function setMon(type, src) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    
    // 【要件3】YouTubeの即時再生（setTimeoutを完全撤廃し、タップした瞬間にロード）
    if(type==='v'){ 
        yt.style.display='block'; 
        const id = extractYtId(src);
        yt.src=`https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`; 
    } else { 
        img.style.display='block'; img.src=src; 
    }
}

function prep(t, isM, id = null) {
    window.speechSynthesis.cancel();
    
    try {
        talkAudio.pause(); 
        if (talkAudio.readyState > 0) {
            talkAudio.currentTime = 0;
        }
    } catch(err) {
        console.warn("Audio reset safety catch triggered.");
    }
    
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display='block'; tel.scrollTop = 0;

    if(isM) {
        // 【要件3】曲名の読み上げを完全に禁止（無音）。文字の5秒表示のみ。
        setTimeout(() => { if(tel.innerText===t) tel.style.display='none'; }, 5000);
    } else if(id) {
        talkAudio.src = `./voices_mp3/${id}.mp3`;
        talkAudio.onerror = () => { media.speak(t); };
        const playPromise = talkAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => { media.speak(t); });
        }
    }
    
    const items = lv.querySelectorAll('.item');
    items.forEach(el => {
        if(el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) el.classList.add('active-item'); 
        else el.classList.remove('active-item');
    });
}

function handleBack() {
    const s = nav.state;
    if(s==="st") openThemes(nav.curG);
    else if(s==="th") openTalk();
    else if(s==="tit") openMusicArtists(currentMusicGenre); 
    else if(s==="art" || s==="m_gen") openMusic(); 
    else { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); }
}

function playHead() {
    if(isMusicMode) {
        yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
        yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    } else { talkAudio.play().catch(()=>{}); }
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
    if(nav.curI < nav.curP.length - 1) { 
        const i = nav.curI + 1; 
        nav.updateNav(undefined,undefined,undefined,i);
        const curItem = nav.curP[nav.curI]; 
        if(isMusicMode) { setMon('v', curItem.u); prep(`${curItem.a}さんの「${curItem.ti}」です。`, true); }
        else { setMon('i', `./talk_images/${curItem.id}.jpg`); prep(curItem.txt, false, curItem.id); }
    } else {
        isAutoPlay = false;
        document.getElementById('btn-next').classList.remove('auto-active');
    }
}

function extractYtId(u) {
    if(!u) return "";
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
