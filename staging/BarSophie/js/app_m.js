import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

// ★ スクリーニングの条件を記憶する箱
let scrState = null;
function initScrState() {
    scrState = {
        major: "", sub: "", area: "", keyword: "",
        pMin: "", pMax: "", aMin: "", aMax: "",
        s1Min: "-2.0", s1Max: "2.0", s2Min: "-2.0", s2Max: "2.0",
        s3Min: "-2.0", s3Max: "2.0", s4Min: "-2.0", s4Max: "2.0",
        tags: []
    };
}

document.addEventListener('DOMContentLoaded', async () => {
    ytWrapper = document.getElementById('yt-wrapper'); img = document.getElementById('monitor-img');
    tel = document.getElementById('telop'); lv = document.getElementById('list-view'); nm = document.getElementById('nav-main');
    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

    await nav.loadAllData();
    initScrState();
    setup();
    
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0]; firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
});

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('yt-player', {
        playerVars: { 'playsinline': 1, 'autoplay': 1, 'rel': 0, 'controls': 1 },
        events: {
            'onReady': () => { ytPlayerReady = true; },
            'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED && isAutoPlay && isMusicMode) next(); }
        }
    });
};

const defaultOnEnded = () => { if (isAutoPlay && !isMusicMode) setTimeout(next, 1200); };

// ★ コントローラー領域の動的書き換え（ソフィーはそのまま残す）
function renderConsole(mode) {
    const grid = document.querySelector('.btn-grid');
    if (!grid) return;
    
    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="console-scr-btn btn-c-clear" id="btn-c-clear">条件クリア</button>
            <button class="console-scr-btn btn-c-exec" id="btn-c-exec">検索実行</button>
        `;
        document.getElementById('btn-c-clear').onclick = () => { initScrState(); openScreeningUI(); };
        document.getElementById('btn-c-exec').onclick = executeScreening;
    } else if (mode === 'result') {
        grid.innerHTML = `
            <button class="console-scr-btn btn-c-mod" id="btn-c-mod">🔍 検索条件を変更する</button>
        `;
        document.getElementById('btn-c-mod').onclick = openScreeningUI;
    } else {
        // 標準コントローラー
        grid.innerHTML = `
            <button class="c-btn" id="btn-expand">▼</button>
            <button class="c-btn" id="ctrl-back">▲</button>
            <button class="c-btn" id="ctrl-pause">⏹️</button>
            <button class="c-btn" id="ctrl-play" style="flex: 1.5; font-size: 1.2rem;">▶</button>
            <button class="c-btn" id="btn-next">⏭</button>
        `;
        document.getElementById('ctrl-play').onclick = playHead;
        document.getElementById('ctrl-pause').onclick = togglePause;
        document.getElementById('ctrl-back').onclick = handleBack;
        document.getElementById('btn-expand').onclick = handleExpand;
        const btnN = document.getElementById('btn-next');
        if(btnN) {
            btnN.onpointerdown = (e) => { e.preventDefault(); pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
            btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
            btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
        }
        resetCtrlBack();
    }
}

// ソフィー召喚＆拡大機能
function handleExpand() {
    if (nav.state === "lq_card" || nav.state === "lq_scr") {
        const lSide = document.querySelector('.l-side');
        if (lSide) { lSide.style.display = ''; setTimeout(() => { if (nav.state === "lq_card" || nav.state === "lq_scr") lSide.style.display = 'none'; }, 4000); }
        window.speechSynthesis.cancel(); try { talkAudio.pause(); } catch(e){}
        const msg = "何になさいますか？"; talkAudio.src = "./voices_mp3/what_order.mp3"; 
        talkAudio.onerror = () => { try { media.speak(msg); } catch(e){} };
        try { const p = talkAudio.play(); if(p !== undefined) p.catch(() => { try { media.speak(msg); } catch(e){} }); } catch(e) { try { media.speak(msg); } catch(err){} }
        return;
    }
    if (isMusicMode || nav.state === "none") return;
    const monitor = document.querySelector('.monitor'); const btn = document.getElementById('btn-expand');
    monitor.classList.toggle('expanded'); btn.innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
}

function showRootMenu() {
    lv.style.display = 'none'; nm.style.display = 'block'; nav.updateNav("none");
    ytWrapper.style.display = 'none'; img.src = './front_sophie.jpeg'; img.style.display = 'block'; tel.style.display = 'none';
    const monitor = document.querySelector('.monitor'); monitor.classList.remove('expanded');
    renderConsole('standard'); // メニューに戻ったら標準コントローラーにする
    const lSide = document.querySelector('.l-side'); if(lSide) lSide.style.display = '';
}

function setup() {
    const btnEnter = document.getElementById('btn-enter');
    if(btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
            if (ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') { try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch(e) {} }
            const fallbackText = "いらっしゃいませ。"; talkAudio.src = "./voices_mp3/greeting.mp3"; talkAudio.onerror = () => { try { media.speak(fallbackText); } catch(e){} };
            try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(fallbackText); } catch(e){} }); } catch(e) { try { media.speak(fallbackText); } catch(err){} }
        };
    }

    const btnToBar = document.getElementById('btn-to-bar');
    if(btnToBar) {
        btnToBar.onclick = () => { 
            document.getElementById('chat-mode').style.display='none'; document.getElementById('main-ui').style.display='flex'; 
            window.speechSynthesis.cancel(); talkAudio.pause(); showRootMenu();
            talkAudio.src = "./voices_mp3/menu_greeting.mp3"; const fallbackText = "いつもありがとうございます。今日はいかがされますか？";
            talkAudio.onerror = () => { try { media.speak(fallbackText); } catch(e){} };
            try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(fallbackText); } catch(e){} }); } catch(e) { try { media.speak(fallbackText); } catch(err){} }
        };
    }

    renderConsole('standard'); // 初期状態のコントローラーをセット
    
    const sophieWarp = document.getElementById('sophie-warp');
    if(sophieWarp) {
        sophieWarp.onclick = () => { 
            if(nav.state !== "none") { showRootMenu(); } 
            else { 
                document.getElementById('main-ui').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
                const loungeText = document.getElementById('lounge-text'); loungeText.innerText = "ありがとうございました。"; 
                window.speechSynthesis.cancel(); if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') { try { ytPlayer.pauseVideo(); } catch(e){} }
                try { talkAudio.pause(); } catch(e){}
                talkAudio.src = "./voices_mp3/goodbye.mp3";
                const finalizeExit = () => { setTimeout(() => { document.getElementById('chat-mode').style.display='none'; document.getElementById('entry-screen').style.display='flex'; loungeText.innerText = "いらっしゃいませ。"; talkAudio.onended = defaultOnEnded; img.src = ""; }, 1000); };
                talkAudio.onended = finalizeExit; talkAudio.onerror = finalizeExit; 
                try { const p = talkAudio.play(); if (p !== undefined) p.catch(finalizeExit); } catch(e) { finalizeExit(); }
            } 
        };
    }

    document.getElementById('btn-music').onclick = openMusic; document.getElementById('btn-talk').onclick = openTalk;
    const btnLiquor = document.getElementById('btn-liquor'); if(btnLiquor) btnLiquor.onclick = openLiquorRoot;
    talkAudio.onended = defaultOnEnded;
}

function playHead() {
    if (nav.state === "lq_card") {
        const currentList = Array.isArray(nav.curP) ? nav.curP : [];
        if(currentList.length > 0) {
            const currentItem = nav.liquorData[nav.curI]; let listIdx = currentList.indexOf(currentItem);
            if (listIdx >= 0) { let nextListIdx = (listIdx + 1) % currentList.length; let nextGlobalIdx = nav.liquorData.indexOf(currentList[nextListIdx]); showLiquorCard(nextGlobalIdx, currentList); }
        }
        return;
    }
    if(ytPlayerReady && ytPlayer && typeof ytPlayer.seekTo === 'function') { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); }
    if(!isMusicMode) talkAudio.play().catch(()=>{});
}

function togglePause() {
    if(!isPaused) { if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo(); talkAudio.pause(); window.speechSynthesis.pause(); isPaused = true; } 
    else { if(ytPlayerReady && ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo(); if(!isMusicMode) talkAudio.play().catch(()=>{}); window.speechSynthesis.resume(); isPaused = false; }
}

function next() {
    if (nav.state === "lq_card") {
        const major = nav.curG; const sub = nav.liquorData[nav.curI]["中分類"];
        const subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === major).map(d => d["中分類"]).filter(Boolean))];
        const subIdx = subs.indexOf(sub);
        if (subIdx >= 0 && subIdx < subs.length - 1) {
            const nextSub = subs[subIdx + 1]; const nextSubItems = nav.liquorData.filter(d => d["中分類"] === nextSub);
            if (nextSubItems.length > 0) { const globalIdx = nav.liquorData.indexOf(nextSubItems[0]); showLiquorCard(globalIdx, nextSubItems); }
        }
        return;
    }
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1); const m = nav.curP[nav.curI];
        if (nav.state === "none") { let topText = isMusicMode ? `🎵 ${m.a}さんの「${m.ti}」です` : `🥃 ${m.th}：「${m.ti}」のお話です`; if (isMusicMode) { setMon('v', m.u); prep(topText, true, null, m.txt); } else { setMon('i', `./talk_images/${m.id}.jpg`); prep(topText, false, m.id, m.txt); } } 
        else {
            if (isMusicMode && nav.state !== "tit") { const title = nav.curP[0] && nav.curP[0].a ? nav.curP[0].a : "再生リスト"; nav.updateNav("tit"); renderSongList(title); } 
            else if (!isMusicMode && nav.state !== "st") { const title = nav.curP[0] && nav.curP[0].th ? nav.curP[0].th : "お酒の話"; nav.updateNav("st"); renderStoryList(title); }
            if (lv.style.display === 'none') { nm.style.display = 'none'; lv.style.display = 'block'; }
            if (isMusicMode) { setMon('v', m.u); prep(`${m.a}さんの${m.ti}です`, true); } else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
        }
    } else { isAutoPlay = false; const btnN = document.getElementById('btn-next'); if(btnN) btnN.classList.remove('auto-active'); }
}

function extractYtId(u) {
    if(!u) return ""; const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = u.match(reg); return match ? match[1] : u;
}
function setMon(m, s) {
    if (nav.state === "none") {
        ytWrapper.style.display = 'none'; img.style.display = 'block'; img.src = './front_sophie.jpeg';
        document.querySelector('.monitor').classList.remove('expanded'); 
        const btnExpand = document.getElementById('btn-expand'); if(btnExpand) { btnExpand.innerText = '▼'; btnExpand.style.opacity = '0.3'; }
        if(m === 'v') { if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(extractYtId(s)); } else { if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo(); }
        return;
    }
    ytWrapper.style.display = 'none'; img.style.display = 'none'; 
    if(m === 'v') { 
        ytWrapper.style.display = 'block'; const btnExpand = document.getElementById('btn-expand'); if(btnExpand) btnExpand.style.opacity = '0.3';
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(extractYtId(s));
    } else { 
        img.style.display = 'block'; img.src = s; const btnExpand = document.getElementById('btn-expand'); if(btnExpand) btnExpand.style.opacity = '1';
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
    }
}

function prep(t, isM, id = null, originalTxt = null) {
    window.speechSynthesis.cancel(); try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e){}
    lastTxt = t; isMusicMode = isM; isPaused = false; tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
    if (nav.state === "none") { tel.style.top = 'auto'; tel.style.bottom = '0'; tel.style.height = 'auto'; tel.style.background = 'rgba(0,0,0,0.6)'; } 
    else { tel.style.top = '0'; tel.style.bottom = 'auto'; tel.style.height = '100%'; tel.style.background = 'rgba(0,0,0,0.75)'; }
    let speakTxt = originalTxt ? originalTxt : t; 
    if(isM) { setTimeout(() => { if(lastTxt === t) tel.style.display = 'none'; }, 5000); } 
    else if (id) {
        talkAudio.src = `./voices_mp3/${id}.mp3`; talkAudio.onerror = () => { try { media.speak(speakTxt); } catch(e){} };
        try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(speakTxt); } catch(e){} }); } catch(e) { try { media.speak(speakTxt); } catch(err){} }
    }
    document.querySelectorAll('#list-view .item').forEach((el) => {
        if (el.dataset.idx && parseInt(el.dataset.idx) === nav.curI) { el.classList.add('active-item'); if (nav.state !== "none") el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } 
        else { el.classList.remove('active-item'); }
    });
}

// ==========================================
// ★音楽・お話 既存処理 (省略なし)
// ==========================================
function openMusic() {
    nav.updateNav("art"); let h = "";
    h += `<div class="label">マスターお薦め</div><div class="artist-grid"><div class="item" data-special="ソフィー" style="color: var(--blue);">🎤 ソフィー</div><div class="item" data-special="BGM">🎤 BGM</div><div class="item" data-special="昭和ソング">🎤 昭和ソング</div></div>`;
    const preferredOrder = ['E', 'F', 'J', 'L', 'W', 'I', 'S']; const rawFs = [...new Set(nav.jData.map(d => d.f).filter(Boolean))];
    const sortedFs = rawFs.sort((a, b) => { let ia = preferredOrder.indexOf(a); let ib = preferredOrder.indexOf(b); if (ia === -1) ia = 999; if (ib === -1) ib = 999; return ia - ib; });
    sortedFs.forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { 
            let labelName = (f === 'L') ? "特集コーナー" : (nav.jData.find(d => d.f === f && d.gName) ? nav.jData.find(d => d.f === f && d.gName).gName : f);
            h += `<div class="label">${labelName}</div><div class="artist-grid">`; arts.forEach(a => { h += `<div class="item" data-artist="${a}">🎤 ${a}</div>`; }); h += `</div>`;
        }
    });
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.special) openSpecialSongs(el.dataset.special); else if(el.dataset.artist) openSongs(el.dataset.artist); }, false, 'standard');
}
function openSpecialSongs(type) {
    let filtered = [];
    if(type === 'ソフィー') filtered = nav.jData.filter(m => m.a && m.a.includes("ソフィー")); else if(type === 'BGM') filtered = nav.jData.filter(m => m.a === "BGM");
    else if(type === '昭和ソング') { const showaGenres = ["70s", "昭和", "演歌", "歌姫"]; filtered = nav.jData.filter(m => showaGenres.includes(m.a)); }
    nav.updateNav("tit", undefined, filtered); isMusicMode = true; renderSongList(type);
}
function openSongs(a) { nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a)); isMusicMode = true; renderSongList(a); }
function renderSongList(title) {
    let h = `<div class="label">${title}</div>`;
    nav.curP.forEach((m, i) => { const color = (m.ti && (m.ti.includes("みずいろのシグナル") || m.ti.includes("水色のシグナル"))) ? `style="color: var(--blue);"` : ""; h += `<div class="item" data-idx="${i}" ${color}>🎵 ${m.ti}</div>`; });
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.idx) { const i = parseInt(el.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('v', nav.curP[i].u); prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true); } } }, false, 'standard');
}

function openTalk() {
    nav.updateNav("g"); let h = '<div class="label">お酒のジャンル</div>';
    [...new Set(nav.tData.map(d => d.g))].forEach(g => { h += `<div class="item" data-g="${g}">📁 ${g}</div>`; });
    render(h, (e) => { const g = e.currentTarget.dataset.g; if(g) { nav.updateNav("th", g); openThemes(nav.curG); } }, false, 'standard');
}
function openThemes(g) {
    nav.updateNav("th"); let h = `<div class="label">${g}</div>`;
    [...new Set(nav.tData.filter(d => d.g === g).map(d => d.th))].forEach(t => { h += `<div class="item" data-th="${t}">🏷️ ${t}</div>`; });
    render(h, (e) => { const t = e.currentTarget.dataset.th; if(t) openStories(t); }, false, 'standard');
}
function renderStoryList(t) {
    let h = `<div class="label">${t}</div>`;
    nav.curP.forEach((d, i) => { const fixIcon = (d.fix === "1" || d.fix === "true" || parseInt(d.fix) > 0) ? "📌 " : ""; h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti}</div>`; });
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.idx) { const i = parseInt(el.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('i', `./talk_images/${nav.curP[i].id}.jpg`); prep(nav.curP[i].txt, false, nav.curP[i].id); } } }, false, 'standard');
}
function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a,b) => { const isFixA = (a.fix === "1" || a.fix === "true" || parseInt(a.fix) > 0) ? 1 : 0; const isFixB = (b.fix === "1" || b.fix === "true" || parseInt(b.fix) > 0) ? 1 : 0; return isFixB - isFixA; });
    nav.updateNav("st", undefined, stories); isMusicMode = false; renderStoryList(t);
}


// ==========================================
// ★お酒データベース (3つの入り口 ＋ スクリーニング)
// ==========================================
function openLiquorRoot() {
    nav.updateNav("lq_root"); isMusicMode = false;
    let h = `<div class="label" style="justify-content:center;">お酒を選ぶ</div>`;
    
    h += `<button class="act-btn" id="btn-lq-cat" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 ジャンルから探す</button>`;
    h += `<button class="act-btn" id="btn-scr" style="background:#d35400; margin:0 15px; width:calc(100% - 30px);">🔍 お好みで絞り込む</button>`;
    
    h += `<div class="direct-box-new">
            <div class="direct-lbl">ダイレクト検索</div>
            <input type="number" id="direct-num" placeholder="No.">
            <button id="btn-direct-go">開く</button>
          </div>`;

    render(h, () => {}, false, 'standard');
    
    document.getElementById('btn-scr').onclick = openScreeningUI;
    document.getElementById('btn-lq-cat').onclick = openLiquorMajor;
    document.getElementById('btn-direct-go').onclick = () => {
        const v = document.getElementById('direct-num').value;
        const target = nav.liquorData.find(d => d["No"] == v);
        if(target) showLiquorCard(nav.liquorData.indexOf(target), nav.liquorData);
        else alert("指定されたNo.が見つかりませんでした。");
    };
}

// ★ダブルスライダーを動かすJS
function attachMultiSlider(id) {
    const minEl = document.getElementById(id + '-min');
    const maxEl = document.getElementById(id + '-max');
    const fillEl = document.getElementById(id + '-fill');
    const minDisp = document.getElementById(id + '-min-disp');
    const maxDisp = document.getElementById(id + '-max-disp');

    const update = () => {
        let minV = parseFloat(minEl.value); let maxV = parseFloat(maxEl.value);
        if (minV > maxV) { let tmp = minV; minV = maxV; maxV = tmp; minEl.value = minV; maxEl.value = maxV; }
        minDisp.innerText = minV.toFixed(1); maxDisp.innerText = maxV.toFixed(1);
        const percentMin = ((minV + 2.0) / 4.0) * 100; const percentMax = ((maxV + 2.0) / 4.0) * 100;
        fillEl.style.left = percentMin + '%'; fillEl.style.width = (percentMax - percentMin) + '%';
        scrState[id.replace('scr-', '') + 'Min'] = minV.toFixed(1); scrState[id.replace('scr-', '') + 'Max'] = maxV.toFixed(1);
    };
    minEl.addEventListener('input', update); maxEl.addEventListener('input', update);
    update();
}

// ★スクリーニングUI (フルスクリーン・コントローラー書き換え)
function openScreeningUI() {
    nav.updateNav("lq_scr");
    let h = `<div class="label" style="justify-content:flex-start; gap:10px;"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="openLiquorRoot()">◀</button> お好みで絞り込む</div>`;
    h += `<div class="scr-container">`;

    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];
    const majorOpts = `<option value="">問わない</option>` + majors.map(m => `<option value="${m}" ${scrState.major === m ? 'selected':''}>${m}</option>`).join('');
    
    let subs = [];
    if(scrState.major) subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]).filter(Boolean))];
    else subs = [...new Set(nav.liquorData.map(d => d["中分類"]).filter(Boolean))];
    const subOpts = `<option value="">問わない</option>` + subs.map(s => `<option value="${s}" ${scrState.sub === s ? 'selected':''}>${s}</option>`).join('');

    // ★国と地域の合体プルダウン
    const areas = [...new Set(nav.liquorData.map(d => {
        const c = d["国"] || ""; const p = d["マップ産地"] || d["産地"] || "";
        if (c && p) return `${c} / ${p}`; if (c) return c; return "";
    }).filter(Boolean))].sort();
    const areaOpts = `<option value="">問わない</option>` + areas.map(a => `<option value="${a}" ${scrState.area === a ? 'selected':''}>${a}</option>`).join('');

    h += `<div class="scr-group">
            <div class="scr-title">ジャンル・品目・地域</div>
            <div class="scr-row"><span class="scr-row-label">ジャンル:</span><select id="scr-mj">${majorOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">品目:</span><select id="scr-sb">${subOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">国・地域:</span><select id="scr-ar">${areaOpts}</select></div>
            <div class="scr-row" style="margin-top:10px;"><span class="scr-row-label">ｷーﾜｰﾄﾞ:</span><input type="text" id="scr-kw" placeholder="銘柄・解説・タグ等すべて" value="${scrState.keyword}"></div>
          </div>`;

    const makeDoubleSlider = (id, lblL, lblR, minV, maxV) => `
        <div class="scr-slider-box">
            <div class="scr-slider-label-edge">${lblL}</div>
            <div class="scr-slider-val" id="${id}-min-disp">${parseFloat(minV).toFixed(1)}</div>
            <div class="multi-range-wrap">
                <div class="multi-range-track"></div>
                <div class="multi-range-fill" id="${id}-fill"></div>
                <input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${minV}">
                <input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${maxV}">
            </div>
            <div class="scr-slider-val" id="${id}-max-disp">${parseFloat(maxV).toFixed(1)}</div>
            <div class="scr-slider-label-edge">${lblR}</div>
        </div>`;

    h += `<div class="scr-group">
            <div class="scr-title">お好み指定 (味わいの指標)</div>
            ${makeDoubleSlider("scr-s1", "辛口", "甘口", scrState.s1Min, scrState.s1Max)}
            ${makeDoubleSlider("scr-s2", "軽快", "濃厚", scrState.s2Min, scrState.s2Max)}
            ${makeDoubleSlider("scr-s3", "常道", "独特", scrState.s3Min, scrState.s3Max)}
            ${makeDoubleSlider("scr-s4", "淡麗", "コク", scrState.s4Min, scrState.s4Max)}
          </div>`;

    const pVals = ["", 1000, 2000, 3000, 4000, 5000, 7000, 10000, 20000, 30000, 50000];
    const pOpts = pVals.map(v => `<option value="${v}">${v===""?"問わない":v.toLocaleString()+"円"}</option>`).join('');
    const aVals = ["", 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const aOpts = aVals.map(v => `<option value="${v}">${v===""?"問わない":v+"%"}</option>`).join('');
    const sel = (opts, val) => opts.replace(`value="${val}"`, `value="${val}" selected`);

    h += `<div class="scr-group">
            <div class="scr-title">市場価格・度数</div>
            <div class="scr-row"><span class="scr-row-label">市場価格:</span> <select id="scr-p-min">${sel(pOpts, scrState.pMin)}</select> ～ <select id="scr-p-max">${sel(pOpts, scrState.pMax)}</select></div>
            <div class="scr-row"><span class="scr-row-label">度数(%):</span> <select id="scr-a-min">${sel(aOpts, scrState.aMin)}</select> ～ <select id="scr-a-max">${sel(aOpts, scrState.aMax)}</select></div>
          </div>`;

    let allTags = new Set();
    nav.liquorData.forEach(d => { ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',').forEach(t => { if(t.trim()) allTags.add(t.trim()); }); });
    h += `<div class="scr-group">
            <div class="scr-title">味わいタグ</div>
            <div class="scr-tag-grid">`;
    Array.from(allTags).sort().forEach(t => {
        const isSel = scrState.tags.includes(t) ? "selected" : "";
        h += `<div class="scr-tag-btn ${isSel}" data-tag="${t}">${t}</div>`;
    });
    h += `</div></div></div>`; 

    // 第4引数に 'screening' を渡して、コントローラーを「クリア＆実行」ボタンに化けさせる
    render(h, (e) => {
        if(e.currentTarget.classList.contains('scr-tag-btn')) e.currentTarget.classList.toggle('selected');
    }, true, 'screening');

    attachMultiSlider('scr-s1'); attachMultiSlider('scr-s2'); attachMultiSlider('scr-s3'); attachMultiSlider('scr-s4');

    document.getElementById('scr-mj').onchange = (e) => {
        scrState.major = e.target.value; scrState.sub = ""; openScreeningUI();
    };
}

// ★スクリーニング実行と状態保存
function executeScreening() {
    scrState.keyword = document.getElementById('scr-kw').value.trim().toLowerCase();
    scrState.major = document.getElementById('scr-mj').value;
    scrState.sub = document.getElementById('scr-sb').value;
    scrState.area = document.getElementById('scr-ar').value;
    scrState.pMin = document.getElementById('scr-p-min').value; scrState.pMax = document.getElementById('scr-p-max').value;
    scrState.aMin = document.getElementById('scr-a-min').value; scrState.aMax = document.getElementById('scr-a-max').value;
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);

    const pMinVal = scrState.pMin === "" ? 0 : parseFloat(scrState.pMin);
    const pMaxVal = scrState.pMax === "" ? 999999 : parseFloat(scrState.pMax);
    const aMinVal = scrState.aMin === "" ? 0 : parseFloat(scrState.aMin);
    const aMaxVal = scrState.aMax === "" ? 100 : parseFloat(scrState.aMax);

    const getAvg = (d, keyGPT, keyGem, keyCla) => {
        let vals = [parseFloat(d[keyGPT]), parseFloat(d[keyGem]), parseFloat(d[keyCla])].filter(v => !isNaN(v));
        return vals.length > 0 ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    };

    const results = nav.liquorData.filter(d => {
        if(scrState.keyword) {
            const allText = ((d["銘柄名"]||"") + " " + (d["鑑定評価(200字)"]||"") + " " + (d["ソフィーの裏話"]||"") + " " + (d["味わいタグ"]||"") + " " + (d["検索タグ"]||"")).toLowerCase();
            if(!allText.includes(scrState.keyword)) return false;
        }

        if(scrState.major && d["大分類"] !== scrState.major) return false;
        if(scrState.sub && d["中分類"] !== scrState.sub) return false;

        if(scrState.area) {
            const c = d["国"] || ""; const p = d["マップ産地"] || d["産地"] || "";
            const itemArea = (c && p) ? `${c} / ${p}` : c;
            if(itemArea !== scrState.area) return false;
        }

        const priceStr = (d["市販価格"]||"0").replace(/[^0-9]/g, '');
        const price = parseInt(priceStr) || 0;
        if(price < pMinVal || price > pMaxVal) return false;

        let abvStr = d["度数"] || "0"; let abv = parseFloat(abvStr);
        if (!isNaN(abv) && abv > 0 && abv <= 1.0 && !abvStr.includes('%')) abv *= 100;
        if(isNaN(abv)) abv = 0;
        if(abv < aMinVal || abv > aMaxVal) return false;

        const avg1 = getAvg(d, "GPT_甘辛", "Gemini_甘辛", "Claude_甘辛");
        const avg2 = getAvg(d, "GPT_ボディ", "Gemini_ボディ", "Claude_ボディ");
        const avg3 = getAvg(d, "GPT_個性", "Gemini_個性", "Claude_個性");
        const avg4 = getAvg(d, "GPT_第4軸", "Gemini_第4軸", "Claude_第4軸");
        
        if(avg1 < parseFloat(scrState.s1Min) || avg1 > parseFloat(scrState.s1Max)) return false;
        if(avg2 < parseFloat(scrState.s2Min) || avg2 > parseFloat(scrState.s2Max)) return false;
        if(avg3 < parseFloat(scrState.s3Min) || avg3 > parseFloat(scrState.s3Max)) return false;
        if(avg4 < parseFloat(scrState.s4Min) || avg4 > parseFloat(scrState.s4Max)) return false;

        if(scrState.tags.length > 0) {
            const dTags = ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',').map(t=>t.trim());
            const hasTag = scrState.tags.some(t => dTags.includes(t));
            if(!hasTag) return false;
        }
        return true;
    });

    nav.updateNav("lq_res", null, results);
    let h = `<div class="label" style="justify-content:flex-start; gap:10px;"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="openLiquorRoot()">◀</button> 検索結果: ${results.length}件</div>`;
    results.forEach(d => {
        const globalIdx = nav.liquorData.indexOf(d);
        h += `<div class="item" data-lqidx="${globalIdx}">🥃 ${(d["銘柄名"]||"").replace(/"/g,'')}</div>`;
    });
    
    // 第4引数に 'result' を渡して、コントローラーを「検索条件を変更」ボタンに化けさせる
    render(h, (e) => {
        if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), results);
    }, true, 'result');
}

// ★既存の階層メニュー
function openLiquorMajor() {
    nav.updateNav("lq_major"); 
    let h = `<div class="label" style="justify-content:flex-start; gap:10px;"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="openLiquorRoot()">◀</button> ジャンル (大分類)</div>`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];
    majors.forEach(m => { h += `<div class="item" data-lqmajor="${m}">📁 ${m}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqmajor) openLiquorSub(e.currentTarget.dataset.lqmajor); }, false, 'standard');
}

function openLiquorSub(major) {
    nav.updateNav("lq_sub", major); 
    let h = `<div class="label">${major}</div>`;
    const subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === major).map(d => d["中分類"]).filter(Boolean))];
    subs.forEach(s => { h += `<div class="item" data-lqsub="${s}">📁 ${s}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqsub) openLiquorList(e.currentTarget.dataset.lqsub); }, false, 'standard');
}

function openLiquorList(sub) {
    const items = nav.liquorData.filter(d => d["中分類"] === sub);
    nav.updateNav("lq_list", nav.curG, items); 
    let h = `<div class="label">${sub} 銘柄一覧</div>`;
    items.forEach(d => {
        const idx = nav.liquorData.indexOf(d); h += `<div class="item" data-lqidx="${idx}">🥃 ${(d["銘柄名"]||"").replace(/"/g, '')}</div>`;
    });
    render(h, (e) => { if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), items); }, false, 'standard');
}

// ★フルスクリーン鑑定カード
function showLiquorCard(globalIndex, currentListArray = null) {
    if(currentListArray) nav.updateNav("lq_card", nav.curG, currentListArray, globalIndex);
    else nav.updateNav("lq_card", nav.curG, nav.curP, globalIndex);

    const d = nav.liquorData[globalIndex]; if(!d) return;

    const getPos = (valStr) => { let v = parseFloat(valStr); if(isNaN(v)) return -1; return Math.min(100, Math.max(0, ((v + 2.0) / 4.0) * 100)); };
    const makeInlineGraph = (lblL, lblR, gpt, gem, cla) => {
        let hg = `<div class="graph-row-inline"><div class="graph-label-inline">${lblL}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        const pGpt = getPos(gpt); const pGem = getPos(gem); const pCla = getPos(cla);
        if(pGpt >= 0) hg += `<div class="graph-point pt-gpt" style="left:${pGpt}%"></div>`;
        if(pGem >= 0) hg += `<div class="graph-point pt-gemini" style="left:${pGem}%"></div>`;
        if(pCla >= 0) hg += `<div class="graph-point pt-claude" style="left:${pCla}%"></div>`;
        hg += `</div><div class="graph-label-inline">${lblR}</div></div>`;
        return hg;
    };

    let tagsHtml = "";
    const allTags = ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',');
    allTags.forEach(t => { if(t.trim()) tagsHtml += `<span class="lq-tag">${t.trim()}</span>`; });

    let abv = d["度数"] || "-";
    if (!isNaN(parseFloat(abv)) && parseFloat(abv) > 0 && parseFloat(abv) <= 1.0 && !abv.includes('%')) { abv = (parseFloat(abv) * 100).toFixed(0) + '%'; }

    let h = `<div class="label" style="justify-content:flex-end;">No.${d["No"]}</div>`;
             
    h += `<div class="lq-card">`;
    h += `<div class="lq-name">${(d["銘柄名"]||"").replace(/"/g, '')}</div>`;
    
    if(d["ソフィーのセリフ"]) {
        const cleanQuote = d["ソフィーのセリフ"].replace(/^[「『"']|[」』"']$/g, '');
        h += `<div class="lq-quote">${cleanQuote}</div>`;
    }
    
    h += `<div class="lq-basic-info">
            <div><span style="color:#e74c3c; font-size:0.8em">▶</span> ${d["大分類"]}　<span style="color:#3498db; font-size:0.8em">▶</span> ${d["中分類"]}</div>
            <div><span style="color:#888">産地:</span> ${d["国"]} / ${d["産地"]}</div>
            ${d["製造元と創業年"] && d["製造元と創業年"] !== "-" ? `<div><span style="color:#888">蒸留所/製造:</span> ${d["製造元と創業年"]}</div>` : ""}
            ${d["公式URL"] && d["公式URL"] !== "-" ? `<div style="margin-top:6px;"><a href="${d["公式URL"]}" target="_blank" class="lq-btn-small">🔗 メーカーサイト</a></div>` : ""}
          </div>`;

    h += `<div class="lq-split-view">`;
    h += `<div class="lq-graph-half">`;
    if(d["Gemini_コスパ"]) h += `<div class="lq-cospa"><span>コスパ</span> ${d["Gemini_コスパ"]}</div>`;
    h += makeInlineGraph("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"]);
    h += makeInlineGraph("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
    h += makeInlineGraph("常道", "独特", d["GPT_個性"], d["Gemini_個性"], d["Claude_個性"]);
    h += makeInlineGraph("淡麗", "コク", d["GPT_第4軸"], d["Gemini_第4軸"], d["Claude_第4軸"]);
    h += `<div style="font-size:0.6rem; color:#888; text-align:right; margin-top:4px;"><span style="color:#10a37f">●GPT</span> <span style="color:#1a73e8">●Gem</span> <span style="color:#d97757">●Cla</span></div>`;
    h += `</div>`;
    
    h += `<div class="lq-specs-half">
            <div class="spec-row-compact"><span>知名度</span><span>${d["知名度"]}</span></div>
            <div class="spec-row-compact"><span>度数</span><span>${abv}</span></div>
            <div class="spec-row-compact"><span>誕生年</span><span>${d["銘柄誕生年"]}</span></div>
            <div class="spec-row-compact"><span>市販</span><span>${d["市販価格"]}</span></div>
            <div class="spec-row-compact"><span>Bar</span><span class="price-bar">${d["バー価格"]}</span></div>
          </div>`;
    h += `</div>`; 

    if(d["ソフィーの裏話"]) h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    if(tagsHtml) h += `<div class="lq-tags">${tagsHtml}</div>`;
    if(d["鑑定評価(200字)"]) h += `<div class="lq-desc">${d["鑑定評価(200字)"]}</div>`;

    h += `</div>`; 

    // カード表示時は標準コントローラーにする
    render(h, (e) => {}, true, 'standard');

    // 鑑定画面の時だけ、戻るボタンの表示を変える
    const btnBack = document.getElementById('ctrl-back');
    if(btnBack) { btnBack.innerText = 'メニュー'; btnBack.style.fontSize = '0.75rem'; }
    const btnExpand = document.getElementById('btn-expand');
    if(btnExpand) { btnExpand.style.opacity = '1'; }
}

function resetCtrlBack() {
    const btnBack = document.getElementById('ctrl-back');
    if(btnBack) { btnBack.innerText = '▲'; btnBack.style.fontSize = ''; }
}

// ★ render関数の拡張（consoleMode によって下のボタン領域を差し替える）
function render(h, cb, isFullScreen = false, consoleMode = 'standard') { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; 
    document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item, .filter-btn, .scr-tag-btn').forEach(el => el.onclick = cb);
    
    const lSide = document.querySelector('.l-side');
    if(lSide) lSide.style.display = isFullScreen ? 'none' : '';

    // コントローラーの入れ替え
    renderConsole(consoleMode);

    if(!isFullScreen) resetCtrlBack();
}

function handleBack() {
    if (nav.state === "lq_card") {
        if(nav.curP && nav.curP.length > 0 && !nav.curP[0]["中分類"]) {
            executeScreening(); // 再度同じ条件で結果を描画（状態も維持）
        } else {
            openLiquorList(nav.curP[0]["中分類"]); 
        }
    }
    else if (nav.state === "lq_res") openScreeningUI(); 
    else if (nav.state === "lq_list") openLiquorSub(nav.curG);
    else if (nav.state === "lq_sub") openLiquorMajor();
    else if (nav.state === "lq_major") openLiquorRoot();
    else if (nav.state === "lq_scr") openLiquorRoot();
    else if (nav.state === "lq_root") showRootMenu();
    else if (nav.state === "st") openThemes(nav.curG); 
    else if (nav.state === "th") openTalk(); 
    else if (nav.state === "tit") openMusic();
    else { showRootMenu(); }
}