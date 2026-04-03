/**
 * Bar Sophie Mobile v14.7 - MP3 Edition
 * Folder path: ./voices_mp3/
 * File format: [ID].mp3
 */

// 状態管理
const state = {
    talkData: [],
    musicData: [],
    currentView: 'none',
    currentGenre: '',
    currentTheme: '',
    currentArtist: '',
    currentList: [],
    currentIndex: -1,
    isPaused: false,
    isAutoPlay: false,
    isMusicMode: false,
    lastTxt: "",
    pressTimer: null
};

// DOM要素
const dom = {
    yt: document.getElementById('yt-iframe'),
    img: document.getElementById('monitor-img'),
    tel: document.getElementById('telop'),
    lv: document.getElementById('list-view'),
    nm: document.getElementById('nav-main'),
    audio: document.getElementById('talk-audio'),
    scrollArea: document.getElementById('main-scroll'),
    loungeText: document.getElementById('lounge-text')
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    setupEvents();
    setInterval(checkYTProgress, 1000);
});

// CSV読み込み
async function loadData() {
    try {
        const tRes = await fetch('お酒の話.csv');
        const tTxt = await tRes.text();
        state.talkData = parseCSV(tTxt);

        try {
            const mRes = await fetch('音楽リスト.csv');
            const mTxt = await mRes.text();
            state.musicData = parseCSV(mTxt);
        } catch (e) {
            state.musicData = [];
        }
    } catch (e) {
        console.error("Data loading failed:", e);
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const header = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj = {};
        header.forEach((h, i) => {
            const val = values[i] ? values[i].trim() : "";
            if(h === "ID") obj.id = val;
            else if(h === "ジャンル") obj.g = val;
            else if(h === "テーマ") obj.th = val;
            else if(h === "UI表示タイトル") obj.ti = val;
            else if(h === "カンペ本文（250文字程度）") obj.txt = val;
            else if(h === "FIX") obj.fix = val;
            obj[h] = val;
        });
        return obj;
    });
}

function setupEvents() {
    // 入店フロー
    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        dom.audio.play().catch(()=>{}); 
        dom.audio.pause();
        speak(dom.loungeText.innerText);
    };

    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        stopAllVoice();
    };

    // 操作パネル
    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    
    document.getElementById('sophie-warp').onclick = () => {
        if(state.currentView !== "none") {
            dom.lv.style.display = 'none';
            dom.nm.style.display = 'block';
            state.currentView = "none";
        } else {
            document.getElementById('main-ui').style.display = 'none';
            document.getElementById('chat-mode').style.display = 'flex';
        }
    };

    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;

    // 次へボタン
    const btnN = document.getElementById('btn-next');
    btnN.onpointerdown = () => {
        state.pressTimer = setTimeout(() => {
            state.isAutoPlay = !state.isAutoPlay;
            btnN.classList.toggle('auto-active', state.isAutoPlay);
            state.pressTimer = null;
        }, 600);
    };
    btnN.onpointerup = () => {
        if (state.pressTimer) {
            clearTimeout(state.pressTimer);
            state.pressTimer = null;
            next();
        }
    };

    dom.audio.onended = () => {
        if (state.isAutoPlay && !state.isMusicMode) setTimeout(next, 1200);
    };
}

// ---------------- UI描画 ----------------

function openTalk() {
    state.currentView = "genre";
    let h = '<div class="label">お酒のジャンル</div>';
    const genres = [...new Set(state.talkData.map(d => d.g))];
    genres.forEach(g => { h += `<div class="item" id="g-${g}">📁 ${g}</div>`; });
    render(h, (e) => {
        if(e.target.id.startsWith('g-')) {
            state.currentGenre = e.target.id.replace('g-','');
            openThemes(state.currentGenre);
        }
    });
}

function openThemes(g) {
    state.currentView = "theme";
    let h = `<div class="label">${g}</div>`;
    const themes = [...new Set(state.talkData.filter(d => d.g === g).map(d => d.th))];
    themes.forEach(t => { h += `<div class="item" id="th-${t}">🏷️ ${t}</div>`; });
    render(h, (e) => {
        if(e.target.id.startsWith('th-')) {
            state.currentTheme = e.target.id.replace('th-','');
            openStories(state.currentTheme);
        }
    });
}

function openStories(t) {
    state.currentView = "stories";
    state.isMusicMode = false;
    
    const stories = state.talkData.filter(d => d.th === t).sort((a, b) => {
        const fixA = (a.fix === "1" || a.fix === "true") ? 1 : 0;
        const fixB = (b.fix === "1" || b.fix === "true") ? 1 : 0;
        return fixB - fixA;
    });
    
    state.currentList = stories;
    let h = `<div class="label">${t}</div>`;
    stories.forEach((d, i) => {
        const fixIcon = (d.fix === "1" || d.fix === "true") ? "📌 " : "";
        h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti}</div>`;
    });
    render(h, (e) => {
        const i = parseInt(e.target.dataset.idx);
        if(!isNaN(i)) playStory(i);
    });
}

function playStory(index) {
    state.currentIndex = index;
    const m = state.currentList[index];
    setMonitor('i', `./talk_images/${m.id}.jpg`);
    prepMedia(m.txt, false, m.id);
}

function openMusic() {
    state.currentView = "artists";
    let h = '<div class="label">アーティスト選曲</div>';
    const artists = [...new Set(state.musicData.map(d => d.a))];
    artists.forEach(a => { h += `<div class="item" id="art-${a}">🎤 ${a}</div>`; });
    render(h, (e) => {
        if(e.target.id.startsWith('art-')) {
            state.currentArtist = e.target.id.replace('art-','');
            renderSongs(state.currentArtist);
        }
    });
}

function renderSongs(a) {
    state.currentView = "titles";
    state.isMusicMode = true;
    const songs = state.musicData.filter(m => m.a === a).sort((a, b) => {
        const fixA = (a.fix === "1" || a.fix === "true") ? 1 : 0;
        const fixB = (b.fix === "1" || b.fix === "true") ? 1 : 0;
        return fixB - fixA;
    });
    
    state.currentList = songs;
    let h = `<div class="label">${a}</div>`;
    songs.forEach((m, i) => {
        const fixIcon = (m.fix === "1" || m.fix === "true") ? "📌 " : "";
        h += `<div class="item" data-idx="${i}">${fixIcon}${m.ti}</div>`;
    });
    render(h, (e) => {
        const i = parseInt(e.target.dataset.idx);
        if(!isNaN(i)) { state.currentIndex = i; playMusic(i); }
    });
}

function playMusic(index) {
    const m = state.currentList[index];
    setMonitor('v', m.u);
    prepMedia(`${m.a}さんの「${m.ti}」です。`, true);
}

function render(h, cb) {
    dom.nm.style.display = 'none';
    dom.lv.style.display = 'block';
    dom.lv.innerHTML = h;
    dom.lv.onclick = cb;
    dom.scrollArea.scrollTop = 0;
}

function handleBack() {
    const v = state.currentView;
    if (v === "stories") openThemes(state.currentGenre);
    else if (v === "theme") openTalk();
    else if (v === "titles") openMusic();
    else { dom.lv.style.display = 'none'; dom.nm.style.display = 'block'; state.currentView = "none"; }
}

// ---------------- メディア制御 ----------------

function setMonitor(type, src) {
    dom.yt.style.display = 'none';
    dom.img.style.display = 'none';
    dom.yt.src = "";
    setTimeout(() => {
        if(type === 'v') {
            dom.yt.style.display = 'block';
            const ytId = extractYtId(src);
            dom.yt.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&enablejsapi=1`;
        } else {
            dom.img.style.display = 'block';
            dom.img.src = src;
        }
    }, 100);
}

function prepMedia(text, isMusic, id = null) {
    stopAllVoice();
    state.lastTxt = text;
    state.isMusicMode = isMusic;
    state.isPaused = false;
    dom.tel.innerText = text;
    dom.tel.style.display = 'block';
    dom.tel.scrollTop = 0;

    if(isMusic) {
        speak(text);
        setTimeout(() => { if(dom.tel.innerText === text) dom.tel.style.display = 'none'; }, 5000);
    } else {
        if(id) playAudio(id, text);
    }
    
    document.querySelectorAll('.item').forEach((el, idx) => {
        el.classList.toggle('active-item', idx === state.currentIndex);
    });
}

/**
 * 音声再生コア（MP3 & フォルダ voices_mp3 対応版）
 */
function playAudio(id, fallbackText) {
    // キャッシュ回避用のランダムクエリを付与 (?t=...)
    dom.audio.src = `./voices_mp3/${id}.mp3?t=${new Date().getTime()}`;
    
    dom.audio.onerror = () => {
        console.warn(`MP3 [${id}.mp3] not found. Fallback to synthesis.`);
        speak(fallbackText);
    };

    const p = dom.audio.play();
    if (p !== undefined) {
        p.catch(() => { speak(fallbackText); });
    }
}

function speak(text) {
    window.speechSynthesis.cancel();
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'ja-JP';
    ut.rate = 1.05;
    window.speechSynthesis.speak(ut);
}

function stopAllVoice() {
    window.speechSynthesis.cancel();
    dom.audio.pause();
    dom.audio.currentTime = 0;
    dom.audio.onerror = null;
}

function playHead() {
    dom.yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
    dom.yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    if(!state.isMusicMode) {
        if(dom.audio.src) dom.audio.play();
    } else {
        speak(state.lastTxt);
    }
}

function togglePause() {
    if(!state.isPaused) {
        dom.yt.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        dom.audio.pause();
        window.speechSynthesis.pause();
        state.isPaused = true;
    } else {
        dom.yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        if(!state.isMusicMode && dom.audio.src) dom.audio.play();
        window.speechSynthesis.resume();
        state.isPaused = false;
    }
}

function next() {
    if(state.currentIndex < state.currentList.length - 1) {
        const nextIdx = state.currentIndex + 1;
        if (state.isMusicMode) {
            state.currentIndex = nextIdx;
            playMusic(nextIdx);
        } else {
            playStory(nextIdx);
        }
    } else {
        state.isAutoPlay = false;
        document.getElementById('btn-next').classList.remove('auto-active');
    }
}

function extractYtId(u) {
    if(!u) return "";
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = u.match(reg);
    return match ? match[1] : u;
}

function checkYTProgress() {
    if (state.isAutoPlay && state.isMusicMode) {
        dom.yt.contentWindow.postMessage('{"event":"command","func":"getPlayerState","args":[]}', '*');
    }
}

window.addEventListener('message', (e) => {
    try {
        const d = JSON.parse(e.data);
        if (d.info === 0 && state.isAutoPlay && state.isMusicMode) next();
    } catch(err){}
});
