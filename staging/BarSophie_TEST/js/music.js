// js/music.js
import * as nav from './navigation.js';
import * as media from './media.js';
import { lv, nm, setListView, highlightItem, extractYtId } from './utils.js';

export let isMusicMode = false;
export let isPaused = false;
export let isAutoPlay = false;

// ★リクエストモードフラグ
let _requestMode = false;
// ★連続再生モード
let _autoPlayMode = false;
let _autoPlayList = [];

export function isAutoPlayMode() { return _autoPlayMode; }

export function stopAutoPlay() {
    _autoPlayMode = false;
    _autoPlayList = [];
}

export function nextAutoPlay() {
    if (!_autoPlayMode || _autoPlayList.length === 0) return;
    const curIdx = _autoPlayList.findIndex(m => m === nav.curP[nav.curI]);
    const nextIdx = (curIdx + 1) % _autoPlayList.length;
    playAutoPlaySong(nextIdx);
}

function playAutoPlaySong(idx) {
    const m = _autoPlayList[idx];
    if (!m) return;
    const globalIdx = nav.curP.indexOf(m);
    if (globalIdx >= 0) nav.updateNav(undefined, undefined, undefined, globalIdx);
    renderAutoPlayList();
    setMon('v', m.u);
    prep(`${m.a}さんの${m.ti}です`, true);
}

function renderAutoPlayList() {
    const title = nav.curP[0]?.a || '連続再生';
    let h = `<div class="label" style="background:#1a3a1a; color:#7fd97f;">🔁 連続再生中　─　${title}</div>`;
    _autoPlayList.forEach((m, i) => {
        const globalIdx = nav.curP.indexOf(m);
        const isPlaying = globalIdx === nav.curI;
        const color = isPlaying ? 'color:#7fd97f; font-weight:bold;' : 'color:#eee;';
        const icon = isPlaying ? '▶ ' : '🎵 ';
        h += `<div class="item auto-item" data-gidx="${globalIdx}" style="font-size:1.05rem; padding:0.2em 15px; ${color}">${icon}${m.ti}</div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');
    document.querySelectorAll('.auto-item').forEach(el => {
        el.onclick = () => {
            const gIdx = parseInt(el.dataset.gidx);
            if (!isNaN(gIdx)) {
                const m = nav.curP[gIdx];
                const listIdx = _autoPlayList.indexOf(m);
                if (listIdx >= 0) playAutoPlaySong(listIdx);
            }
        };
    });
}

export function startAutoPlay(list, startIdx) {
    _autoPlayMode = true;
    _autoPlayList = list;
    isMusicMode = true;
    playAutoPlaySong(startIdx);
}

function playAutoPlaySong(idx) {
    const m = _autoPlayList[idx];
    if (!m) return;
    const globalIdx = nav.curP.indexOf(m);
    if (globalIdx >= 0) nav.updateNav(undefined, undefined, undefined, globalIdx);
    // ★リストのハイライトを更新
    renderAutoPlayList();
    setMon('v', m.u);
    prep(`${m.a}さんの${m.ti}です`, true);
}

function renderAutoPlayList() {
    const title = nav.curP[0]?.a || '連続再生';
    let h = `<div class="label" style="background:#1a3a1a; color:#7fd97f;">🔁 連続再生中　─　${title}</div>`;
    _autoPlayList.forEach((m, i) => {
        const globalIdx = nav.curP.indexOf(m);
        const isPlaying = globalIdx === nav.curI;
        const color = isPlaying ? 'color:#7fd97f; font-weight:bold;' : 'color:#eee;';
        const icon = isPlaying ? '▶ ' : '🎵 ';
        h += `<div class="item auto-item" data-gidx="${globalIdx}" style="font-size:1.05rem; padding:0.2em 15px; ${color}">${icon}${m.ti}</div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');
    document.querySelectorAll('.auto-item').forEach(el => {
        el.onclick = () => {
            const gIdx = parseInt(el.dataset.gidx);
            if (!isNaN(gIdx)) {
                const m = nav.curP[gIdx];
                const listIdx = _autoPlayList.indexOf(m);
                if (listIdx >= 0) playAutoPlaySong(listIdx);
            }
        };
    });
}

let lastTxt = "";
let pressTimer = null;
let ytPlayer = null;
let ytPlayerReady = false;
let talkAudio = null;
let tel = null;
let _renderConsole = null; 

export function initMusic(audio, ytP, ytReady, telEl) {
    talkAudio    = audio;
    ytPlayer     = ytP;
    ytPlayerReady = ytReady;
    tel          = telEl;
}

export function setYtReady(player) {
    ytPlayer      = player;
    ytPlayerReady = true;
}

export function setRenderConsole(fn) {
    _renderConsole = fn;
}

export function openMusic() {
    _requestMode = false;
    nav.updateNav("art");
    let h = "";
    h += `<div class="label">マスターお薦め</div><div class="artist-grid">`;
    h += `<div class="item" data-special="ソフィー" style="color: var(--blue); padding:0.2em 15px;">ソフィー</div>`;
    h += `<div class="item" data-special="BGM" style="padding:0.2em 15px;">BGM</div>`;
    h += `<div class="item" data-special="昭和ソング" style="padding:0.2em 15px;">昭和ソング</div></div>`;

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
        if (arts.length) {
            let labelName = (f === 'L') ? "特集コーナー" : (nav.jData.find(d => d.f === f && d.gName)?.gName || f);
            h += `<div class="label">${labelName}</div><div class="artist-grid">`;
            arts.forEach(a => { h += `<div class="item" data-artist="${a}" style="font-size:1.05rem; padding:0.2em 15px;">${a}</div>`; });
            h += `</div>`;
        }
    });

    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');

    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const item = e.currentTarget;
        if (item.dataset.special) openSpecialSongs(item.dataset.special);
        else if (item.dataset.artist) openSongs(item.dataset.artist);
    });
}

function openSpecialSongs(type) {
    let filtered = [];
    if (type === 'ソフィー') filtered = nav.jData.filter(m => m.a && m.a.includes("ソフィー"));
    else if (type === 'BGM') filtered = nav.jData.filter(m => m.a === "BGM");
    else if (type === '昭和ソング') filtered = nav.jData.filter(m => ["70s", "昭和", "演歌", "歌姫"].includes(m.a));
    nav.updateNav("tit", undefined, filtered);
    isMusicMode = true;
    _requestMode = false;
    renderSongList(type);
}

function openSongs(a) {
    nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a));
    isMusicMode = true;
    _requestMode = false;
    renderSongList(a);
}

export function renderSongList(title) {
    const labelStyle = _requestMode ? 'background:#6b1a2a; color:#ffb3c1;' : '';
    const labelText  = _requestMode ? `🎤 リクエストどうぞ　─　${title}` : title;
    const itemBg     = _requestMode ? 'background:#1a0a0a;' : '';

    let h = `<div class="label" style="${labelStyle}">${labelText}</div>`;
    nav.curP.forEach((m, i) => {
        const isSophie = m.ti && (m.ti.includes("みずいろのシグナル") || m.ti.includes("水色のシグナル"));
        const color = isSophie ? `color: var(--blue);` : `color: #eee;`;
        h += `<div class="item" data-idx="${i}" style="font-size:1.05rem; padding:0.2em 15px; ${color} ${itemBg}">🎵 ${m.ti}</div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');

    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        if (!isNaN(i)) {
            if (_requestMode) {
                handleRequest(i);
            } else {
                nav.updateNav(undefined, undefined, undefined, i);
                setMon('v', nav.curP[i].u);
                prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true);
            }
        }
    });
}

// ★リクエスト処理：前口上→自動再生
function handleRequest(idx) {
    const m = nav.curP[idx];
    if (!m) return;

    if (!m.desc) {
        speakText("あ、この曲はまだ私、勉強中です。ほかの曲でおねがいします。");
        return;
    }

    _requestMode = false;
    nav.updateNav(undefined, undefined, undefined, idx);
    const title = m.a || "リクエスト";
    renderSongList(title);

    // ★テロップ表示
    const telEl = document.getElementById('telop');
    if (telEl) {
        telEl.innerText = m.desc;
        telEl.style.top = '0';
        telEl.style.bottom = 'auto';
        telEl.style.height = '100%';
        telEl.style.background = 'rgba(0,0,0,0.75)';
        telEl.style.display = 'block';
    }

    // ★前口上をしゃべり終わってからYouTubeをロード・再生
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(m.desc);
    utter.lang = 'ja-JP';
utter.onend = () => {
    if (telEl) telEl.style.display = 'none';
    setMon('v', m.u);
    // ★ロード後に明示的に再生
    setTimeout(() => {
        if (ytPlayerReady && ytPlayer) {
            try { ytPlayer.playVideo(); } catch(e) {}
        }
    }, 500);
};
    window.speechSynthesis.speak(utter);
}

// ★Sボタンからリクエストモードを起動
export function startRequestMode() {
    if (nav.state !== "tit") return;
    _requestMode = true;
    setTimeout(() => {
        speakText("ご紹介しましょう。お好みの曲を選んでください。");
    }, 800);
    const title = nav.curP[0]?.a || "リクエスト";
    renderSongList(title);
}

// ★テキストをしゃべるだけのヘルパー
function speakText(txt) {
    window.speechSynthesis.cancel();
    try { talkAudio.pause(); } catch(e) {}
    if (tel) {
        tel.innerText = txt;
        tel.style.display = 'block';
        setTimeout(() => { if (tel) tel.style.display = 'none'; }, 6000);
    }
    try { media.speak(txt); } catch(e) {}
}

export function openTalk() {
    nav.updateNav("g");
    let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="item" data-g="${g}" style="font-size:1.05rem; padding:0.4em 15px;">📁 ${g}</div>`; });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');

    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const g = e.currentTarget.dataset.g;
        if (g) { nav.updateNav("th", g); openThemes(nav.curG); }
    });
}

function openThemes(g) {
    nav.updateNav("th");
    let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="item" data-th="${t}" style="font-size:1.05rem; padding:0.4em 15px;">🏷️ ${t}</div>`; });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');

    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const t = e.currentTarget.dataset.th;
        if (t) openStories(t);
    });
}

export function renderStoryList(t) {
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => {
        const isFix = (d.fix === "1" || d.fix === "true" || parseInt(d.fix) > 0);
        h += `<div class="item" data-idx="${i}" style="font-size:1.05rem; padding:0.4em 15px;">${isFix ? "📌 " : ""}${d.ti}</div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');

    document.querySelectorAll('.item').forEach(el => el.onclick = (e) => {
        const i = parseInt(e.currentTarget.dataset.idx);
        if (!isNaN(i)) {
            nav.updateNav(undefined, undefined, undefined, i);
            setMon('i', `./talk_images/${nav.curP[i].id}.jpg`);
            prep(nav.curP[i].txt, false, nav.curP[i].id);
        }
    });
}

function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a, b) => (parseInt(b.fix)||0) - (parseInt(a.fix)||0));
    nav.updateNav("st", undefined, stories);
    isMusicMode = false;
    renderStoryList(t);
}

export function playHead() {
    if (ytPlayerReady && ytPlayer && typeof ytPlayer.seekTo === 'function') {
        ytPlayer.seekTo(0, true);
        ytPlayer.playVideo();
    }
    if (!isMusicMode) talkAudio.play().catch(() => {});
}

export function togglePause() {
    if (!isPaused) {
        if (ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
        talkAudio.pause();
        window.speechSynthesis.pause();
        isPaused = true;
    } else {
        if (ytPlayerReady && ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo();
        if (!isMusicMode) talkAudio.play().catch(() => {});
        window.speechSynthesis.resume();
        isPaused = false;
    }
}

export function next() {
    if (nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (nav.state === "none") {
            let topText = isMusicMode ? `🎵 ${m.a}さんの「${m.ti}」です` : `🥃 ${m.th}：「${m.ti}」のお話です`;
            if (isMusicMode) { setMon('v', m.u); prep(topText, true, null, m.txt); }
            else { setMon('i', `./talk_images/${m.id}.jpg`); prep(topText, false, m.id, m.txt); }
        } else {
            if (isMusicMode) renderSongList(nav.curP[0]?.a || "再生リスト");
            else renderStoryList(nav.curP[0]?.th || "お酒の話");
            if (isMusicMode) { setMon('v', m.u); prep(`${m.a}さんの${m.ti}です`, true); }
            else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
        }
    } else {
        isAutoPlay = false;
        document.getElementById('btn-next')?.classList.remove('auto-active');
    }
}

export function handleBack() {
    _requestMode = false;
    if (nav.state === "st") { openThemes(nav.curG); return true; }
    if (nav.state === "th") { openTalk(); return true; }
    if (nav.state === "tit") { openMusic(); return true; }
    return false;
}

function setMon(m, s) {
    // ★chart-wrapperをクリア
    const cw = document.getElementById('chart-wrapper');
    if (cw) { cw.style.display = 'none'; cw.innerHTML = ''; }
    const monImg = document.getElementById('monitor-img'), ytWrapper = document.getElementById('yt-wrapper'), btnExpand = document.getElementById('btn-expand');
    if (nav.state === "none") {
        ytWrapper.style.display = 'none'; monImg.style.display = 'block'; monImg.src = './front_sophie.jpeg';
        if (btnExpand) { btnExpand.innerText = '▼'; btnExpand.style.opacity = '0.3'; }
        if (m === 'v' && ytPlayerReady) ytPlayer.loadVideoById(extractYtId(s));
        else if (ytPlayerReady) ytPlayer.pauseVideo();
        return;
    }
    ytWrapper.style.display = (m === 'v') ? 'block' : 'none';
    monImg.style.display = (m === 'v') ? 'none' : 'block';
    if (m === 'v') {
        if (btnExpand) btnExpand.style.opacity = '0.3';
        if (ytPlayerReady) {
    ytPlayer.cueVideoById(extractYtId(s));
    setTimeout(() => { try { ytPlayer.playVideo(); } catch(e) {} }, 300);
}
    } else {
        monImg.src = s;
        if (btnExpand) btnExpand.style.opacity = '1';
        if (ytPlayerReady) ytPlayer.pauseVideo();
    }
}

function prep(t, isM, id = null, originalTxt = null) {
    window.speechSynthesis.cancel();
    try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e) {}
    lastTxt = t; isMusicMode = isM; isPaused = false;
    if (tel) {
        tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
        if (nav.state === "none") { tel.style.top = 'auto'; tel.style.bottom = '0'; tel.style.height = 'auto'; tel.style.background = 'rgba(0,0,0,0.6)'; }
        else { tel.style.top = '0'; tel.style.bottom = 'auto'; tel.style.height = '100%'; tel.style.background = 'rgba(0,0,0,0.75)'; }
    }
    if (isM) setTimeout(() => { if (lastTxt === t && tel) tel.style.display = 'none'; }, 5000);
    else if (id) {
        talkAudio.src = `./voices_mp3/${id}.mp3`;
        const speak = () => { media.speak(originalTxt || t); };
        talkAudio.onerror = speak;
        talkAudio.onended = null;
        try { const p = talkAudio.play(); if (p) p.catch(speak); } catch(e) { speak(); }
    }
    document.querySelectorAll('#list-view .item').forEach((el) => {
        if (el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) {
            el.classList.add('active-item');
            if (nav.state !== "none") el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else el.classList.remove('active-item');
    });
}

// --- 外部API ---
const _playerState = { currentCode: null, currentTitle: null, currentArtist: null };
export function playSongByCode(code, options = {}) {
    const song = nav.jData.find(d => parseInt(String(d.code), 10) === parseInt(String(code), 10));
    if (!song) return false;
    _playerState.currentCode = code; _playerState.currentTitle = song.ti; _playerState.currentArtist = song.a;
    setMon('v', song.u);
    prep(`${song.a}さんの${song.ti}です`, true);
    return true;
}
export function getCurrentSong() { return { ..._playerState }; }
export function fadeOutAndStop(duration = 3000) {
    if (!ytPlayerReady || !ytPlayer) return;
    const steps = 20, interval = duration / steps;
    let vol = 100;
    const timer = setInterval(() => {
        vol -= 5;
        if (vol <= 0) {
            ytPlayer.pauseVideo();
            if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(100);
            clearInterval(timer);
        } else if (typeof ytPlayer.setVolume === 'function') ytPlayer.setVolume(Math.max(0, vol));
    }, interval);
}