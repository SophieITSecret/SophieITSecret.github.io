import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop'), lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

// MP3再生用オーディオ要素
const talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    // 【要件1】入り口のホラー音声廃止・MP3化
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
        if (isMusicMode) { 
            setMon('v', m.u); 
            prep(`${m.a}さんの${m.ti}です`, true); 
        } else { 
            setMon('i', `./talk_images/${m.id}.jpg`); 
            prep(m.txt, false, m.id); 
        }
    } else { isAutoPlay = false; document.getElementById('btn-next').classList.remove('auto-active'); }
}

// 【要件3】YouTubeの即時再生（setTimeout撤廃）
function setMon(m, s) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    if(m==='v') { 
        yt.style.display='block'; 
        yt.src=`https://www.youtube.com/embed/${media.extractYtId(s)}?autoplay=1&enablejsapi=1`; 
    } else { 
        img.style.display='block'; img.src=s; 
    }
}

// 【要件3】曲名の読み上げを完全カット
function prep(t, isM, id = null) {
    window.speechSynthesis.cancel(); 
    try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e){}
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
    
    if(isM) {
        // 曲名読み上げなし、テロップのみ5秒表示
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

// 【要件2】オリジナルの音楽階層の復活 ＆ 2カラム ＆ 特選曲
function openMusic() {
    nav.updateNav("art"); let h = "";

    // 特選曲の自動生成（A案）
    const specialArts = [...new Set(nav.jData.filter(d => d.fix === "1" || d.fix === "true" || (d.a && d.a.includes("ソフィー"))).map(d => d.a))];
    if(specialArts.length) {
        h += `<div class="label">⭐ 特選曲</div>`;
        h += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">`;
        specialArts.forEach(a => { h += `<div class="item" data-special="true" id="art-${a}">🎤 ${a}</div>`; });
        h += `</div>`;
    }

    // オリジナルのジャンル階層
    ['E','F','J','W','I','S'].forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { 
            h += `<div class="label">${nav.jData.find(d => d.f === f).gName}</div>`; 
            h += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">`;
            arts.forEach(a => { h += `<div class="item" id="art-${a}">🎤 ${a}</div>`; }); 
            h += `</div>`;
        }
    });

    render(h, (e) => { 
        const el = e.currentTarget;
        if(el.id.startsWith('art-')) renderSongs(el.id.replace('art-',''), el.dataset.special === "true"); 
    });
}

function renderSongs(a, isSpecial) {
    let filtered = nav.jData.filter(m => m.a === a);
    if (isSpecial) filtered = filtered.filter(m => m.fix === "1" || m.fix === "true" || (m.a && m.a.includes("ソフィー")));
    
    nav.updateNav("tit", undefined, filtered); isMusicMode = true;
    let h = `<div class="label">${a}</div>`;
    
    // 曲一覧の2カラム化
    h += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">`;
    nav.curP.forEach((m, i) => { h += `<div class="item" data-idx="${i}">🎵 ${m.ti}</div>`; });
    h += `</div>`;

    render(h, (e) => { 
        const el = e.currentTarget;
        if(el.dataset.idx) {
            const i = parseInt(el.dataset.idx); 
            if(!isNaN(i)){ 
                nav.updateNav(undefined,undefined,undefined,i); 
                setMon('v', nav.curP[i].u); 
                prep(`${a}さんの${nav.curP[i].ti}です`, true); 
            }
        }
    });
}

// お酒の話（FIXソート対応版）
function openTalk() {
    nav.updateNav("g"); let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="item" id="g-${g}">📁 ${g}</div>`; });
    render(h, (e) => { if(e.currentTarget.id.startsWith('g-')) { nav.updateNav("th", e.currentTarget.id.replace('g-','')); openThemes(nav.curG); } });
}

function openThemes(g) {
    nav.updateNav("th"); let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="item" id="th-${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { if(e.currentTarget.id.startsWith('th-')) openStories(e.currentTarget.id.replace('th-','')); });
}

function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a,b) => {
        const fixA = (a.fix === "1" || a.fix === "true") ? 1 : 0;
        const fixB = (b.fix === "1" || b.fix === "true") ? 1 : 0;
        return fixB - fixA;
    });
    nav.updateNav("st", undefined, stories); isMusicMode = false;
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { 
        const fixIcon = (d.fix === "1" || d.fix === "true") ? "📌 " : "";
        h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti}</div>`; 
    });
    render(h, (e) => { 
        const el = e.currentTarget;
        if(el.dataset.idx) {
            const i = parseInt(el.dataset.idx); 
            if(!isNaN(i)){ 
                nav.updateNav(undefined,undefined,undefined,i); 
                setMon('i', `./talk_images/${nav.curP[i].id}.jpg`); 
                prep(nav.curP[i].txt, false, nav.curP[i].id); 
            }
        }
    });
}

// スマホのタップバグを回避するため、各アイテムに直接イベントを紐付け
function render(h, cb) { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; 
    document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item').forEach(el => el.onclick = cb);
}

function handleBack() {
    if (nav.state === "st") openThemes(nav.curG); 
    else if (nav.state === "th") openTalk(); 
    else if (nav.state === "tit") openMusic();
    else { lv.style.display = 'none'; nm.style.display = 'block'; nav.updateNav("none"); }
}
