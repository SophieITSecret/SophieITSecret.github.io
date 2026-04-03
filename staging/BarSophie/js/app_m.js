/**
 * Bar Sophie Mobile v14.7 - Standard Edition
 * 修正：CSV列のインデックス指定によるデータ取得（undefined対策）
 * 音声：./voices_mp3/[ID].mp3
 */

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

// CSV読み込みロジック（列番号固定で取得）
async function loadData() {
    try {
        const tRes = await fetch('お酒の話.csv');
        const tTxt = await tRes.text();
        state.talkData = parseTalkCSV(tTxt);

        try {
            const mRes = await fetch('音楽リスト.csv');
            const mTxt = await mRes.text();
            state.musicData = parseMusicCSV(mTxt);
        } catch (e) {
            state.musicData = [];
        }
    } catch (e) {
        console.error("Data loading failed:", e);
    }
}

function parseTalkCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    
    return lines.slice(1).map(line => {
        // カンマで分割（引用符内のカンマは考慮しないシンプル分割）
        const v = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        return {
            id: v[0],    // ID
            g:  v[1],    // ジャンル
            th: v[2],    // テーマ
            ti: v[3],    // UI表示タイトル
            txt: v[5],   // カンペ本文（6列目）
            fix: v[6] || "" // FIX（もしあれば7列目）
        };
    }).filter(d => d.id);
}

function parseMusicCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const header = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const v = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        return { a: v[0], ti: v[1], u: v[2], fix: v[3] || "" };
    });
}

function setupEvents() {
    // 【継承】入店フロー
    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        // 音声アンロック
        dom.audio.play().catch(()=>{}); 
        dom.audio.pause();
        speak("まきむら様、お帰りなさいませ。");
    };

    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        stopAllVoice();
    };

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
    const genres = [...new Set(state.talkData.map(d => d.g))].filter(g => g);
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
    const themes = [...new Set(state.talkData.filter(d => d.g === g).map(d => d.th))].filter(t => t);
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
    
    // FIXソート
    const stories = state.talkData.filter(d => d.th === t).sort((a, b) => {
        const fixA = (a.fix === "1" || a.fix === "true") ? 1 : 0;
        const fixB = (b.fix === "1" || b.fix === "true") ? 1 : 0;
        return fixB - fixA;
    });
    
    state.currentList = stories;
    let h = `<div class="label">${t}</div>`;
    stories.forEach((d, i) => {
        const fixIcon = (d.fix === "1" || d.fix === "true") ? "📌 " : "";
        h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti || "無題"}</div>`;
    });
    render(h, (e) => {
        const i = parseInt(e.target.dataset.idx);
        if(!isNaN(i)) playStory(i);
    });
}

function playStory(index) {
    state.currentIndex = index;
    const m = state.currentList[index];
    if(!m) return;
    setMonitor('i', `./talk_images/${m.id}.jpg`);
    prepMedia(m.txt || "", false, m.id);
}

function openMusic() {
    state.currentView = "artists";
    let h = '<div class="label">アーティスト選曲</div>';
    const artists = [...new Set(state.musicData.map(d => d.a))].filter(a => a);
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
    const songs = state.musicData.filter(m => m.a === a);
    state.currentList = songs;
    let h = `<div class="label">${a}</div>`;
    songs.forEach((m, i) => {
        h += `<div class="item" data-idx="${i}">${m.ti || "無題"}</div>`;
    });
    render(h, (e) => {
        const i = parseInt(e.target.dataset.idx);
        if(!isNaN(i)) { state.currentIndex = i; playMusic(i); }
    });
}

function playMusic(index) {
    const m = state.currentList[index];
    if(!m) return;
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
    
    // アイテムのハイライト
    const items = dom.lv.querySelectorAll('.item');
    items.forEach((el) => {
        const idx = parseInt(el.dataset.idx);
        if (idx === state.currentIndex) el.classList.add('active-item');
        else el.classList.remove('active-item');
    });
}

function playAudio(id, fallbackText) {
    // MP3フォルダ指定
    dom.audio.src = `./voices_mp3/${id}.mp3?t=${new Date().getTime()}`;
    
    dom.audio.onerror = () => {
        speak(fallbackText);
    };

    const p = dom.audio.play();
    if (p !== undefined) {
        p.catch(() => { speak(fallbackText); });
    }
}

function speak(text) {
    if(!text) return;
    window.speechSynthesis.cancel();
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'ja-JP';
    ut.rate = 1.1; // 少しだけ速めに
    window.speechSynthesis.speak(ut);
}

function stopAllVoice() {
    window.speechSynthesis.cancel();
    dom.audio.pause();
    dom.audio.currentTime = 0;
    dom.audio.onerror = null;
}

function playHead() {
    if(state.isMusicMode) {
        dom.yt.contentWindow.postMessage('{"event":"command","func":"seekTo","args":[0, true]}', '*');
        dom.yt.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
        speak(state.lastTxt);
    } else {
        if(dom.audio.src) dom.audio.play().catch(()=>{});
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
        if(!state.isMusicMode && dom.audio.src) dom.audio.play().catch(()=>{});
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
