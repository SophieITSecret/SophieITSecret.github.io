import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop'), lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

// 音声再生用要素（MP3用・メモリリーク防止設定）
const talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
if(!talkAudio.id) { 
    talkAudio.id = 'talk-audio'; 
    talkAudio.preload = 'auto'; // スマホでの読み込み遅延を防止
    document.body.appendChild(talkAudio); 
}

document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

function setup() {
    // 入店・カウンター移動
    const btnEnter = document.getElementById('btn-enter');
    if (btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; 
            document.getElementById('chat-mode').style.display='flex'; 
            // iOS/Androidの厳格なAudio制限を確実にアンロック
            talkAudio.play().then(() => talkAudio.pause()).catch(()=>{});
            media.speak("まきむら様、お帰りなさいませ。"); 
        };
    }

    const btnToBar = document.getElementById('btn-to-bar');
    if (btnToBar) {
        btnToBar.onclick = () => { 
            document.getElementById('chat-mode').style.display='none'; 
            document.getElementById('main-ui').style.display='flex'; 
            window.speechSynthesis.cancel(); 
        };
    }

    // 操作パネル
    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    document.getElementById('sophie-warp').onclick = () => { 
        if(nav.state !== "none") { 
            lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); 
        } else { 
            document.getElementById('main-ui').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
        } 
    };

    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;

    // 次へボタン（長押し対応）
    const btnN = document.getElementById('btn-next');
    btnN.addEventListener('pointerdown', (e) => {
        // デフォルトのスワイプ挙動をキャンセルし、長押し判定を安定化
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

// --- お酒の話 (360本対応 / 摩擦ゼロ・タップ設計) ---
function openTalk() {
    nav.updateNav("th"); 
    let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].filter(Boolean).forEach(g => { 
        h += `<div class="item" id="g-${g}">📁 ${g}</div>`; 
    });
    render(h, (e) => { 
        // 改善: タップした要素の親( .item )を確実に見つける
        const item = e.target.closest('.item');
        if(!item) return;
        if(item.id.startsWith('g-')) { 
            const selG = item.id.replace('g-','');
            nav.updateNav("th", selG); 
            openThemes(selG); 
        } 
    });
}

function openThemes(g) {
    nav.updateNav("th"); 
    let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].filter(Boolean).forEach(t => { 
        h += `<div class="item" id="th-${t}">🏷️ ${t}</div>`; 
    });
    render(h, (e) => { 
        const item = e.target.closest('.item');
        if(!item) return;
        if(item.id.startsWith('th-')) openStories(item.id.replace('th-','')); 
    });
}

function openStories(t) {
    // FIXフラグによるソートを適用
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
    render(h, (e) => { 
        const item = e.target.closest('.item');
        if(!item) return;
        const i = parseInt(item.dataset.idx); 
        if(!isNaN(i)){ 
            nav.updateNav(undefined,undefined,undefined,i); 
            setMon('i', `./talk_images/${nav.curD.id}.jpg`); 
            prep(nav.curD.txt, false, nav.curD.id); 
        } 
    });
}

// --- 音楽選曲 ---
function openMusic() {
    nav.updateNav("art");
    let h = '<div class="label">アーティスト選曲</div>';
    [...new Set(nav.mData.map(d => d.a))].filter(Boolean).forEach(a => { 
        h += `<div class="item" id="art-${a}">🎤 ${a}</div>`; 
    });
    render(h, (e) => { 
        const item = e.target.closest('.item');
        if(!item) return;
        if(item.id.startsWith('art-')) {
            const selA = item.id.replace('art-','');
            openSongs(selA); 
        }
    });
}

function openSongs(a) {
    nav.updateNav("tit", undefined, nav.mData.filter(m => m.a === a));
    isMusicMode = true;
    let h = `<div class="label">${a}</div>`;
    nav.curP.forEach((m, i) => { h += `<div class="item" data-idx="${i}">${m.ti}</div>`; });
    render(h, (e) => { 
        const item = e.target.closest('.item');
        if(!item) return;
        const i = parseInt(item.dataset.idx); 
        if(!isNaN(i)){ 
            nav.updateNav(undefined,undefined,undefined,i); 
            setMon('v', nav.curD.u); 
            prep(`${nav.curD.a}さんの「${nav.curD.ti}」です。`, true); 
        } 
    });
}

// --- 共通メディア・UI制御 ---
function render(h, cb) {
    nm.style.display='none'; 
    lv.style.display='block'; 
    lv.innerHTML=h; 
    lv.onclick=cb; // closest()を使っているため、イベント委譲で安全に捕捉
    document.getElementById('main-scroll').scrollTop = 0;
}

function setMon(type, src) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    setTimeout(() => {
        if(type==='v'){ 
            yt.style.display='block'; 
            const id = extractYtId(src);
            yt.src=`https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`; 
        } else { img.style.display='block'; img.src=src; }
    }, 100);
}

function prep(t, isM, id = null) {
    window.speechSynthesis.cancel();
    talkAudio.pause(); 
    talkAudio.currentTime = 0;
    
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display='block'; tel.scrollTop = 0;

    if(isM) {
        media.speak(t);
        setTimeout(() => { if(tel.innerText===t) tel.style.display='none'; }, 5000);
    } else if(id) {
        // 通信量最適化：ランダムなクエリは廃止し、通常パスでアクセス。
        // GitHub Pages側で更新があれば自然に新しいファイルが降ってくる設計。
        talkAudio.src = `./voices_mp3/${id}.mp3`;
        
        // フォールバック（WAVが見つからない場合）
        talkAudio.onerror = () => { media.speak(t); };
        
        const playPromise = talkAudio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => { media.speak(t); });
        }
    }
}

function handleBack() {
    const s = nav.state;
    if(s==="st") openThemes(nav.curG);
    else if(s==="th") openTalk();
    else if(s==="tit") openMusic();
    else { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); }
}

function playHead() {
    if(isMusicMode) {
        yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
        yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        media.speak(lastTxt);
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
    if(nav.idx < nav.curP.length - 1) {
        const i = nav.idx + 1;
        nav.updateNav(undefined,undefined,undefined,i);
        if(isMusicMode) { setMon('v', nav.curD.u); prep(`${nav.curD.a}さんの「${nav.curD.ti}」です。`, true); }
        else { setMon('i', `./talk_images/${nav.curD.id}.jpg`); prep(nav.curD.txt, false, nav.curD.id); }
    } else {
        // リストの最後まで到達したらオートプレイを解除
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
