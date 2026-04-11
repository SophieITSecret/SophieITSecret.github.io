import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) {
    alert("System Error:\n" + msg + "\nLine: " + lineNo);
    return true;
};

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

document.addEventListener('DOMContentLoaded', async () => {
    ytWrapper = document.getElementById('yt-wrapper');
    img = document.getElementById('monitor-img');
    tel = document.getElementById('telop');
    lv = document.getElementById('list-view');
    nm = document.getElementById('nav-main');

    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

    await nav.loadAllData();
    setup();
    
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
});

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('yt-player', {
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'rel': 0, 'controls': 1 },
        events: {
            'onReady': () => { ytPlayerReady = true; },
            'onStateChange': (e) => {
                if (e.data === YT.PlayerState.ENDED && isAutoPlay && isMusicMode) {
                    next();
                }
            }
        }
    });
};

const defaultOnEnded = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };

function showRootMenu() {
    lv.style.display = 'none'; 
    nm.style.display = 'block'; 
    nav.updateNav("none");
    
    ytWrapper.style.display = 'none';
    img.src = './front_sophie.jpeg';
    img.style.display = 'block';
    tel.style.display = 'none';
    
    const monitor = document.querySelector('.monitor');
    monitor.classList.remove('expanded');
    const btnExpand = document.getElementById('btn-expand');
    btnExpand.innerText = '🔽';
    btnExpand.style.opacity = '0.3'; 
}

function setup() {
    const btnEnter = document.getElementById('btn-enter');
    if(btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; 
            document.getElementById('chat-mode').style.display='flex'; 
            
            if (ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                try {
                    ytPlayer.mute();
                    ytPlayer.loadVideoById('2vfCbdmKhMw'); 
                    setTimeout(() => {
                        ytPlayer.pauseVideo();
                        ytPlayer.unMute();
                    }, 1000);
                } catch(e) {}
            }

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
            showRootMenu();
        };
    }

    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    
    document.getElementById('btn-expand').onclick = () => {
        if (isMusicMode || nav.state === "none") return;
        
        const monitor = document.querySelector('.monitor');
        const btn = document.getElementById('btn-expand');
        monitor.classList.toggle('expanded');
        btn.innerText = monitor.classList.contains('expanded') ? '🔼' : '🔽';
    };
    
    const sophieWarp = document.getElementById('sophie-warp');
    if(sophieWarp) {
        sophieWarp.onclick = () => { 
            if(nav.state !== "none") { 
                showRootMenu(); 
            } else { 
                document.getElementById('main-ui').style.display='none'; 
                document.getElementById('chat-mode').style.display='flex'; 
                
                const loungeText = document.getElementById('lounge-text');
                loungeText.innerText = "ありがとうございました。"; 
                
                window.speechSynthesis.cancel();
                if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                    try { ytPlayer.pauseVideo(); } catch(e){}
                }
                try { talkAudio.pause(); } catch(e){}
                
                talkAudio.src = "./voices_mp3/goodbye.mp3";
                
                const finalizeExit = () => {
                    setTimeout(() => {
                        document.getElementById('chat-mode').style.display='none';
                        document.getElementById('entry-screen').style.display='flex';
                        loungeText.innerText = "いらっしゃいませ。";
                        talkAudio.onended = defaultOnEnded; 
                        img.src = ""; 
                    }, 1000);
                };
                
                talkAudio.onended = finalizeExit;
                talkAudio.onerror = finalizeExit; 
                
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
    if(ytPlayerReady && ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(0, true);
        ytPlayer.playVideo();
    }
    if(!isMusicMode) talkAudio.play().catch(()=>{});
}

function togglePause() {
    if(!isPaused) { 
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo(); 
        talkAudio.pause(); window.speechSynthesis.pause(); isPaused = true; 
    } else { 
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo(); 
        if(!isMusicMode) talkAudio.play().catch(()=>{}); window.speechSynthesis.resume(); isPaused = false; 
    }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        
        if (nav.state === "none") {
            let topText = isMusicMode ? `🎵 ${m.a}さんの「${m.ti}」です` : `🥃 ${m.th}：「${m.ti}」のお話です`;
            
            if (isMusicMode) { 
                setMon('v', m.u); 
                prep(topText, true, null, m.txt); 
            } else { 
                setMon('i', `./talk_images/${m.id}.jpg`); 
                prep(topText, false, m.id, m.txt); 
            }
        } else {
            if (isMusicMode && nav.state !== "tit") {
                const title = nav.curP[0] && nav.curP[0].a ? nav.curP[0].a : "再生リスト";
                nav.updateNav("tit");
                renderSongList(title);
            } else if (!isMusicMode && nav.state !== "st") {
                const title = nav.curP[0] && nav.curP[0].th ? nav.curP[0].th : "お酒の話";
                nav.updateNav("st");
                renderStoryList(title);
            }
            
            if (lv.style.display === 'none') {
                nm.style.display = 'none';
                lv.style.display = 'block';
            }

            if (isMusicMode) { setMon('v', m.u); prep(`${m.a}さんの${m.ti}です`, true); } 
            else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
        }
    } else { 
        isAutoPlay = false; 
        const btnN = document.getElementById('btn-next'); 
        if(btnN) btnN.classList.remove('auto-active'); 
    }
}

function extractYtId(u) {
    if(!u) return "";
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = u.match(reg);
    return match ? match[1] : u;
}

function setMon(m, s) {
    if (nav.state === "none") {
        ytWrapper.style.display = 'none'; 
        img.style.display = 'block'; 
        img.src = './front_sophie.jpeg';
        
        document.querySelector('.monitor').classList.remove('expanded');
        document.getElementById('btn-expand').innerText = '🔽';
        document.getElementById('btn-expand').style.opacity = '0.3';
        
        if(m === 'v') { 
            if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                ytPlayer.loadVideoById(extractYtId(s));
            }
        } else { 
            if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                ytPlayer.pauseVideo();
            }
        }
        return;
    }

    ytWrapper.style.display = 'none'; 
    img.style.display = 'none'; 
    
    if(m === 'v') { 
        ytWrapper.style.display = 'block'; 
        document.getElementById('btn-expand').style.opacity = '0.3';
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
            ytPlayer.loadVideoById(extractYtId(s));
        }
    } else { 
        img.style.display = 'block'; 
        img.src = s; 
        document.getElementById('btn-expand').style.opacity = '1';
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
            ytPlayer.pauseVideo();
        }
    }
}

function prep(t, isM, id = null, originalTxt = null) {
    window.speechSynthesis.cancel(); 
    try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e){}
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; 
    tel.style.display = 'block'; 
    tel.scrollTop = 0;
    
    if (nav.state === "none") {
        tel.style.top = 'auto';           
        tel.style.bottom = '0';           
        tel.style.height = 'auto';        
        tel.style.background = 'rgba(0,0,0,0.6)'; 
    } else {
        tel.style.top = '0';              
        tel.style.bottom = 'auto';
        tel.style.height = '100%';
        tel.style.background = 'rgba(0,0,0,0.75)';
    }

    let speakTxt = originalTxt ? originalTxt : t; 

    if(isM) {
        setTimeout(() => { if(tel.innerText === t) tel.style.display = 'none'; }, 5000);
    } else if (id) {
        talkAudio.src = `./voices_mp3/${id}.mp3`;
        talkAudio.onerror = () => { try { media.speak(speakTxt); } catch(e){} };
        try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(speakTxt); } catch(e){} }); } 
        catch(e) { try { media.speak(speakTxt); } catch(err){} }
    }
    
    document.querySelectorAll('#list-view .item').forEach((el) => {
        if (el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) {
            el.classList.add('active-item');
            if (nav.state !== "none") {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            el.classList.remove('active-item');
        }
    });
}

function openMusic() {
    nav.updateNav("art"); let h = "";
    
    h += `<div class="label">マスターお薦め</div>`;
    h += `<div class="artist-grid">`;
    h += `<div class="item" data-special="ソフィー" style="color: var(--blue);">🎤 ソフィー</div>`;
    h += `<div class="item" data-special="BGM">🎤 BGM</div>`;
    h += `<div class="item" data-special="昭和ソング">🎤 昭和ソング</div>`;
    h += `</div>`;
    
    // 【改修ポイント】Lを洋楽Wの上に配置し、その他の順序も定義
    const preferredOrder = ['E', 'F', 'J', 'L', 'W', 'I', 'S']; 
    const rawFs = [...new Set(nav.jData.map(d => d.f).filter(Boolean))];
    
    const sortedFs = rawFs.sort((a, b) => {
        let ia = preferredOrder.indexOf(a);
        let ib = preferredOrder.indexOf(b);
        if (ia === -1) ia = 999;
        if (ib === -1) ib = 999;
        return ia - ib;
    });

    sortedFs.forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { 
            let labelName = "";
            
            // 【特別ルール】Lの場合は強制的に「特集コーナー」とする
            if (f === 'L') {
                labelName = "特集コーナー";
            } else {
                const genreData = nav.jData.find(d => d.f === f && d.gName);
                labelName = genreData ? genreData.gName : f;
            }
            
            h += `<div class="label">${labelName}</div>`; 
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

function renderStoryList(t) {
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { 
        const isFix = (d.fix === "1" || d.fix === "true" || parseInt(d.fix) > 0);
        const fixIcon = isFix ? "📌 " : "";
        h += `<div class="item
