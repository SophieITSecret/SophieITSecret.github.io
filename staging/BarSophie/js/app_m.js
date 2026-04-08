import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) {
    alert("System Error:\n" + msg + "\nLine: " + lineNo);
    return true;
};

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let yt, img, tel, lv, nm, talkAudio;

document.addEventListener('DOMContentLoaded', async () => {
    yt = document.getElementById('yt-iframe');
    img = document.getElementById('monitor-img');
    tel = document.getElementById('telop');
    lv = document.getElementById('list-view');
    nm = document.getElementById('nav-main');

    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

    await nav.loadAllData();
    setup();
    setInterval(checkYT, 1000);
});

// 自動再生用の標準動作を変数化（退店処理後に復帰させるため）
const defaultOnEnded = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };

function setup() {
    const btnEnter = document.getElementById('btn-enter');
    if(btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; 
            document.getElementById('chat-mode').style.display='flex'; 
            
            // 【イノベーション：YouTubeプレウォーム（事前暖機）】
            // 入口ボタンのタップ権限を利用し、裏で無音の動画を読み込ませてメディア再生権限をOSに承認させる
            yt.style.display = 'none';
            yt.src = "https://www.youtube.com/embed/2vfCbdmKhMw?enablejsapi=1&playsinline=1&mute=1&autoplay=1";
            setTimeout(() => {
                try { yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); } catch(e){}
            }, 1500);

            const fallbackText = "いらっしゃいませ。";
            talkAudio.src = "./voices_mp3/greeting.mp3";
            talkAudio.onerror = () => { try { media.speak(fallbackText); } catch(e){} };
            
            try {
                const p = talkAudio.play();
                if (p !== undefined) p.catch(() => { try { media.speak(fallbackText); } catch(e){} });
            } catch(e) { try { media.speak(fallbackText); } catch(err){} }
        };
    }

    const btnToBar = document.getElementById('btn-to-bar');
    if(btnToBar) {
        btnToBar.onclick = () => { 
            document.getElementById('chat-mode').style.display='none'; 
            document.getElementById('main-ui').style.display='flex'; 
            window.speechSynthesis.cancel(); 
            talkAudio.pause();
        };
    }

    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    
    const sophieWarp = document.getElementById('sophie-warp');
    if(sophieWarp) {
        sophieWarp.onclick = () => { 
            if(nav.state !== "none") { 
                lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); 
            } else { 
                // 【退店（エグジット）シーケンス】
                document.getElementById('main-ui').style.display='none'; 
                document.getElementById('chat-mode').style.display='flex'; 
                
                const loungeText = document.getElementById('lounge-text');
                loungeText.innerText = "ありがとうございました。"; // メッセージ切替
                
                // 再生中のメディアをすべて強制停止
                window.speechSynthesis.cancel();
                try { yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*'); } catch(e){}
                try { talkAudio.pause(); } catch(e){}
                
                talkAudio.src = "./voices_mp3/goodbye.mp3";
                
                // 退店完了処理（1秒後に初期画面へ戻し、テキストをリセット）
                const finalizeExit = () => {
                    setTimeout(() => {
                        document.getElementById('chat-mode').style.display='none';
                        document.getElementById('entry-screen').style.display='flex';
                        loungeText.innerText = "いらっしゃいませ。";
                        talkAudio.onended = defaultOnEnded; // 音声終了後の挙動を元に戻す
                    }, 1000);
                };
                
                talkAudio.onended = finalizeExit;
                talkAudio.onerror = finalizeExit; // 音声ファイル不在時のフェイルセーフ
                
                try {
                    const p = talkAudio.play();
                    if (p !== undefined) p.catch(finalizeExit);
                } catch(e) {
                    finalizeExit();
                }
            } 
        };
    }

    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;

    const btnN = document.getElementById('btn-next');
    if(btnN) {
        btnN.onpointerdown = (e) => { 
            e.preventDefault();
            pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); 
        };
        btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
        btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    }

    talkAudio.onended = defaultOnEnded;
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
    } else { isAutoPlay = false; const btnN = document.getElementById('btn-next'); if(btnN) btnN.classList.remove('auto-active'); }
}

function extractYtId(u) {
    if(!u) return "";
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = u.match(reg);
    return match ? match[1] : u;
}

function setMon(m, s) {
    yt.style.display='none'; img.style.display='none'; yt.src="";
    if(m==='v') { 
        yt.style.display='block'; 
        // YouTube自動再生ブロック緩和策 (&playsinline=1 を維持)
        yt.src=`https://www.youtube.com/embed/${extractYtId(s)}?autoplay=1&enablejsapi=1&playsinline=1`; 
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
        talkAudio.onerror = () => { try { media.speak(t); } catch(e){} };
        try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(t); } catch(e){} }); } 
        catch(e) { try { media.speak(t); } catch(err){} }
    }
    
    document.querySelectorAll('#list-view .item').forEach((el) => {
        if (el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) el.classList.add('active-item');
        else el.classList.remove('active-item');
    });
}

function checkYT() { if (isAutoPlay && isMusicMode) yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*'); }
window.addEventListener('message', (e) => { try { const d = JSON.parse(e.data); if (d.info === 0 && isAutoPlay && isMusicMode) next(); } catch(err){} });

// --- 音楽選曲 ---
function openMusic() {
    nav.updateNav("art"); let h = "";

    h += `<div class="label">マスターお薦め</div>`;
    h += `<div class="artist-grid">`;
    h += `<div class="item" data-special="ソフィー" style="color: var(--blue);">🎤 ソフィー</div>`;
    h += `<div class="item" data-special="BGM">🎤 BGM</div>`;
    h += `<div class="item" data-special="昭和ソング">🎤 昭和ソング</div>`;
    h += `</div>`;

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
        filtered = nav.jData.filter(m => m.a === "BGM");
    } else if(type === '昭和ソング') {
        const showaGenres = ["70s", "昭和", "演歌", "歌姫"];
        filtered = nav.jData.filter(m => showaGenres.includes(m.a));
    }
    nav.updateNav("tit", undefined, filtered); isMusicMode = true;
    renderSongList(type);
}

function openSongs(a) {
    nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a)); isMusicMode = true;
    renderSongList(a);
}

function renderSongList(title) {
    let h = `<div class="label">${title}</div>`;
    nav.curP.forEach((m, i) => { 
        const isSophie = m.ti && (m.ti.includes("みずいろのシグナル") || m.ti.includes("水色のシグナル"));
        const color = isSophie ? `style="color: var(--blue);"` : "";
        h += `<div class="item" data-idx="${i}" ${color}>🎵 ${m.ti}</div>`; 
    });
    
    render(h, (e) => { 
        const el = e.currentTarget;
        if(el.dataset.idx) {
            const i = parseInt(el.dataset.idx); 
            if(!isNaN(i)){ 
                nav.updateNav(undefined,undefined,undefined,i); 
                setMon('v', nav.curP[i].u); 
                prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true); 
            }
        }
    });
}

// --- お酒の話 ---
function openTalk() {
    nav.updateNav("g"); let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="item" data-g="${g}">📁 ${g}</div>`; });
    render(h, (e) => { const g = e.currentTarget.dataset.g; if(g) { nav.updateNav("th", g); openThemes(nav.curG); } });
}

function openThemes(g) {
    nav.updateNav("th"); let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="item" data-th="${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { const t = e.currentTarget.dataset.th; if(t) openStories(t); });
}

function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a,b) => {
        const isFixA = (a.fix === "1" || a.fix === "true" || parseInt(a.fix) > 0) ? 1 : 0;
        const isFixB = (b.fix === "1" || b.fix === "true" || parseInt(b.fix) > 0) ? 1 : 0;
        return isFixB - isFixA;
    });
    nav.updateNav("st", undefined, stories); isMusicMode = false;
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { 
        const isFix = (d.fix === "1" || d.fix === "true" || parseInt(d.fix) > 0);
        const fixIcon = isFix ? "📌 " : "";
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