import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

document.addEventListener('DOMContentLoaded', async () => {
    ytWrapper = document.getElementById('yt-wrapper'); img = document.getElementById('monitor-img');
    tel = document.getElementById('telop'); lv = document.getElementById('list-view'); nm = document.getElementById('nav-main');
    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

    await nav.loadAllData();
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

function showRootMenu() {
    lv.style.display = 'none'; nm.style.display = 'block'; nav.updateNav("none");
    ytWrapper.style.display = 'none'; img.src = './front_sophie.jpeg'; img.style.display = 'block'; tel.style.display = 'none';
    const monitor = document.querySelector('.monitor'); monitor.classList.remove('expanded');
    const btnExpand = document.getElementById('btn-expand'); btnExpand.innerText = '▼'; btnExpand.style.opacity = '0.3'; 
    const lSide = document.querySelector('.l-side'); if(lSide) lSide.style.display = '';
    resetCtrlBack();
}

function setup() {
    const btnEnter = document.getElementById('btn-enter');
    if(btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
            if (ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') { try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch(e) {} }
            const fallbackText = "いらっしゃいませ。";
            talkAudio.src = "./voices_mp3/greeting.mp3"; talkAudio.onerror = () => { try { media.speak(fallbackText); } catch(e){} };
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

    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    
    document.getElementById('btn-expand').onclick = () => {
        if (nav.state === "lq_card") {
            const lSide = document.querySelector('.l-side');
            if (lSide) { lSide.style.display = ''; setTimeout(() => { if (nav.state === "lq_card") lSide.style.display = 'none'; }, 4000); }
            window.speechSynthesis.cancel(); try { talkAudio.pause(); } catch(e){}
            const msg = "何になさいますか？"; talkAudio.src = "./voices_mp3/what_order.mp3"; 
            talkAudio.onerror = () => { try { media.speak(msg); } catch(e){} };
            try { const p = talkAudio.play(); if(p !== undefined) p.catch(() => { try { media.speak(msg); } catch(e){} }); } catch(e) { try { media.speak(msg); } catch(err){} }
            return;
        }
        if (isMusicMode || nav.state === "none") return;
        const monitor = document.querySelector('.monitor'); const btn = document.getElementById('btn-expand');
        monitor.classList.toggle('expanded'); btn.innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
    };
    
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

    const btnN = document.getElementById('btn-next');
    if(btnN) {
        btnN.onpointerdown = (e) => { e.preventDefault(); pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
        btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
        btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    }
    talkAudio.onended = defaultOnEnded;
}

function playHead() {
    // 鑑定画面中：リスト（nav.curP）内をループして「次へ」
    if (nav.state === "lq_card") {
        const currentList = Array.isArray(nav.curP) ? nav.curP : [];
        if(currentList.length > 0) {
            const currentItem = nav.liquorData[nav.curI];
            let listIdx = currentList.indexOf(currentItem);
            if (listIdx >= 0) {
                let nextListIdx = (listIdx + 1) % currentList.length; // ループ
                let nextGlobalIdx = nav.liquorData.indexOf(currentList[nextListIdx]);
                showLiquorCard(nextGlobalIdx, currentList);
            }
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
    // 鑑定画面中：次の中分類へ
    if (nav.state === "lq_card") {
        const major = nav.curG; const sub = nav.liquorData[nav.curI]["中分類"];
        const subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === major).map(d => d["中分類"]).filter(Boolean))];
        const subIdx = subs.indexOf(sub);
        if (subIdx >= 0 && subIdx < subs.length - 1) {
            const nextSub = subs[subIdx + 1];
            const nextSubItems = nav.liquorData.filter(d => d["中分類"] === nextSub);
            if (nextSubItems.length > 0) {
                const globalIdx = nav.liquorData.indexOf(nextSubItems[0]);
                showLiquorCard(globalIdx, nextSubItems);
            }
        }
        return;
    }
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1); const m = nav.curP[nav.curI];
        if (nav.state === "none") {
            let topText = isMusicMode ? `🎵 ${m.a}さんの「${m.ti}」です` : `🥃 ${m.th}：「${m.ti}」のお話です`;
            if (isMusicMode) { setMon('v', m.u); prep(topText, true, null, m.txt); } else { setMon('i', `./talk_images/${m.id}.jpg`); prep(topText, false, m.id, m.txt); }
        } else {
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
        document.querySelector('.monitor').classList.remove('expanded'); document.getElementById('btn-expand').innerText = '▼'; document.getElementById('btn-expand').style.opacity = '0.3';
        if(m === 'v') { if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(extractYtId(s)); } else { if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo(); }
        return;
    }
    ytWrapper.style.display = 'none'; img.style.display = 'none'; 
    if(m === 'v') { 
        ytWrapper.style.display = 'block'; document.getElementById('btn-expand').style.opacity = '0.3';
        if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(extractYtId(s));
    } else { 
        img.style.display = 'block'; img.src = s; document.getElementById('btn-expand').style.opacity = '1';
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
// ★音楽・お話 既存処理
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
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.special) openSpecialSongs(el.dataset.special); else if(el.dataset.artist) openSongs(el.dataset.artist); });
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
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.idx) { const i = parseInt(el.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('v', nav.curP[i].u); prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true); } } });
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
    nav.curP.forEach((d, i) => { const fixIcon = (d.fix === "1" || d.fix === "true" || parseInt(d.fix) > 0) ? "📌 " : ""; h += `<div class="item" data-idx="${i}">${fixIcon}${d.ti}</div>`; });
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.idx) { const i = parseInt(el.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('i', `./talk_images/${nav.curP[i].id}.jpg`); prep(nav.curP[i].txt, false, nav.curP[i].id); } } });
}
function openStories(t) {
    const stories = nav.tData.filter(d => d.th === t).sort((a,b) => { const isFixA = (a.fix === "1" || a.fix === "true" || parseInt(a.fix) > 0) ? 1 : 0; const isFixB = (b.fix === "1" || b.fix === "true" || parseInt(b.fix) > 0) ? 1 : 0; return isFixB - isFixA; });
    nav.updateNav("st", undefined, stories); isMusicMode = false; renderStoryList(t);
}


// ==========================================
// ★お酒データベース (3つの入り口)
// ==========================================
function openLiquorRoot() {
    nav.updateNav("lq_root"); isMusicMode = false;
    let h = `<div class="label">データベース・メニュー</div>`;
    h += `<div class="act-btn" id="btn-scr" style="background:#d35400; display:flex; align-items:center; justify-content:center; margin:15px; width:auto; border:none; cursor:pointer;">🔍 条件で絞り込む (スクリーニング)</div>`;
    h += `<div class="act-btn" id="btn-lq-cat" style="background:#2c3e50; display:flex; align-items:center; justify-content:center; margin:15px; width:auto; border:none; cursor:pointer;">📁 お酒メニューから探す</div>`;
    
    // ダイレクト検索ボックス
    h += `<div class="label" style="margin-top:20px;">No.でダイレクト検索</div>`;
    h += `<div class="direct-box">
            <input type="number" id="direct-num" placeholder="例: 293">
            <button id="btn-direct-go">開く</button>
          </div>`;

    render(h, () => {});
    
    document.getElementById('btn-scr').onclick = openScreeningUI;
    document.getElementById('btn-lq-cat').onclick = openLiquorMajor;
    document.getElementById('btn-direct-go').onclick = () => {
        const v = document.getElementById('direct-num').value;
        const target = nav.liquorData.find(d => d["No"] == v);
        if(target) showLiquorCard(nav.liquorData.indexOf(target), nav.liquorData);
        else alert("指定されたNo.が見つかりませんでした。");
    };
}

// ★スクリーニングUI
function openScreeningUI() {
    nav.updateNav("lq_scr");
    let h = `<div class="label">スクリーニング検索</div>`;
    h += `<div class="scr-container">`;

    // 金額・度数
    h += `<div class="scr-group">
            <div class="scr-title">基本条件</div>
            <div class="scr-row"><span>Bar価格:</span><input type="number" id="scr-prc-min" placeholder="下限"> 〜 <input type="number" id="scr-prc-max" placeholder="上限"></div>
            <div class="scr-row"><span>度数(%):</span><input type="number" id="scr-abv-min" placeholder="下限"> 〜 <input type="number" id="scr-abv-max" placeholder="上限"></div>
          </div>`;

    // 評価軸レンジ (2つのスライダー)
    const makeRangeSlider = (id, labelL, labelR) => {
        return `<div class="scr-slider-box">
                    <div class="scr-slider-labels"><span>${labelL} (-2.0)</span><span>${labelR} (+2.0)</span></div>
                    <div class="scr-slider-inputs">
                        <input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="-2.0" oninput="this.nextElementSibling.innerText=this.value">
                        <div class="scr-slider-val">-2.0</div> 〜 
                        <input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="2.0" oninput="this.nextElementSibling.innerText=this.value">
                        <div class="scr-slider-val">2.0</div>
                    </div>
                </div>`;
    };

    h += `<div class="scr-group">
            <div class="scr-title">AI評価軸 (3社平均)</div>
            ${makeRangeSlider("scr-s1", "辛口", "甘口")}
            ${makeRangeSlider("scr-s2", "軽快", "濃厚")}
            ${makeRangeSlider("scr-s3", "常道", "独特")}
            ${makeRangeSlider("scr-s4", "淡麗", "コク")}
          </div>`;

    // タグ (例として頻出タグをいくつか)
    h += `<div class="scr-group">
            <div class="scr-title">味わいタグ</div>
            <div class="scr-tag-grid" id="scr-tag-grid">
                <div class="scr-tag-btn" data-tag="甘口">甘口</div><div class="scr-tag-btn" data-tag="辛口">辛口</div>
                <div class="scr-tag-btn" data-tag="フルーティー">フルーティー</div><div class="scr-tag-btn" data-tag="スパイシー">スパイシー</div>
                <div class="scr-tag-btn" data-tag="ぽかぽか広がる">ぽかぽか広がる</div><div class="scr-tag-btn" data-tag="余韻が長い">余韻が長い</div>
            </div>
          </div>`;

    h += `<div class="scr-actions">
            <button class="scr-btn scr-btn-clear" onclick="openScreeningUI()">クリア</button>
            <button class="scr-btn scr-btn-exec" id="btn-scr-exec">検索実行</button>
          </div>`;
    h += `</div>`;

    render(h, (e) => {
        if(e.currentTarget.classList.contains('scr-tag-btn')) e.currentTarget.classList.toggle('selected');
    });

    document.getElementById('btn-scr-exec').onclick = executeScreening;
}

// ★スクリーニング実行ロジック
function executeScreening() {
    const pMin = parseFloat(document.getElementById('scr-prc-min').value) || 0;
    const pMax = parseFloat(document.getElementById('scr-prc-max').value) || 999999;
    const aMin = parseFloat(document.getElementById('scr-abv-min').value) || 0;
    const aMax = parseFloat(document.getElementById('scr-abv-max').value) || 100;

    const getAvg = (d, keyGPT, keyGem, keyCla) => {
        let vals = [parseFloat(d[keyGPT]), parseFloat(d[keyGem]), parseFloat(d[keyCla])].filter(v => !isNaN(v));
        return vals.length > 0 ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    };

    const s1Min = parseFloat(document.getElementById('scr-s1-min').value); const s1Max = parseFloat(document.getElementById('scr-s1-max').value);
    const s2Min = parseFloat(document.getElementById('scr-s2-min').value); const s2Max = parseFloat(document.getElementById('scr-s2-max').value);
    const s3Min = parseFloat(document.getElementById('scr-s3-min').value); const s3Max = parseFloat(document.getElementById('scr-s3-max').value);
    const s4Min = parseFloat(document.getElementById('scr-s4-min').value); const s4Max = parseFloat(document.getElementById('scr-s4-max').value);

    // 選択されたタグを取得
    const selectedTags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);

    const results = nav.liquorData.filter(d => {
        // 価格チェック (カンマ等を除去して数値化)
        const priceStr = (d["バー価格"]||"0").replace(/[^0-9]/g, '');
        const price = parseInt(priceStr) || 0;
        if(price < pMin || price > pMax) return false;

        // 度数チェック (0.4 等の小数は % に直して比較)
        let abvStr = d["度数"] || "0";
        let abv = parseFloat(abvStr);
        if (!isNaN(abv) && abv > 0 && abv <= 1.0 && !abvStr.includes('%')) abv *= 100;
        if(isNaN(abv)) abv = 0;
        if(abv < aMin || abv > aMax) return false;

        // AI 評価軸チェック (3社平均)
        const avg1 = getAvg(d, "GPT_甘辛", "Gemini_甘辛", "Claude_甘辛");
        const avg2 = getAvg(d, "GPT_ボディ", "Gemini_ボディ", "Claude_ボディ");
        const avg3 = getAvg(d, "GPT_個性", "Gemini_個性", "Claude_個性");
        const avg4 = getAvg(d, "GPT_第4軸", "Gemini_第4軸", "Claude_第4軸");
        
        if(avg1 < s1Min || avg1 > s1Max) return false;
        if(avg2 < s2Min || avg2 > s2Max) return false;
        if(avg3 < s3Min || avg3 > s3Max) return false;
        if(avg4 < s4Min || avg4 > s4Max) return false;

        // タグチェック (一つでも選択されていれば、それが含まれるか確認)
        if(selectedTags.length > 0) {
            const dTags = ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',').map(t=>t.trim());
            const hasTag = selectedTags.some(t => dTags.includes(t));
            if(!hasTag) return false;
        }

        return true;
    });

    // 検索結果のリスト表示へ
    nav.updateNav("lq_res", null, results); // curP に結果配列を保持
    let h = `<div class="label" style="justify-content:flex-start; gap:10px;"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="openScreeningUI()">◀</button> 検索結果: ${results.length}件</div>`;
    results.forEach(d => {
        const globalIdx = nav.liquorData.indexOf(d);
        h += `<div class="item" data-lqidx="${globalIdx}">🥃 ${(d["銘柄名"]||"").replace(/"/g,'')}</div>`;
    });
    
    render(h, (e) => {
        if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), results);
    });
}

// ★既存の階層メニュー
function openLiquorMajor() {
    nav.updateNav("lq_major"); 
    let h = `<div class="label" style="justify-content:flex-start; gap:10px;"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="openLiquorRoot()">◀</button> お酒の種類 (大分類)</div>`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];
    majors.forEach(m => { h += `<div class="item" data-lqmajor="${m}">📁 ${m}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqmajor) openLiquorSub(e.currentTarget.dataset.lqmajor); });
}

function openLiquorSub(major) {
    nav.updateNav("lq_sub", major); 
    let h = `<div class="label">${major}</div>`;
    const subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === major).map(d => d["中分類"]).filter(Boolean))];
    subs.forEach(s => { h += `<div class="item" data-lqsub="${s}">📁 ${s}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqsub) openLiquorList(e.currentTarget.dataset.lqsub); });
}

function openLiquorList(sub) {
    const items = nav.liquorData.filter(d => d["中分類"] === sub);
    nav.updateNav("lq_list", nav.curG, items); // curPにリスト配列を保持
    let h = `<div class="label">${sub} 銘柄一覧</div>`;
    items.forEach(d => {
        const idx = nav.liquorData.indexOf(d); h += `<div class="item" data-lqidx="${idx}">🥃 ${(d["銘柄名"]||"").replace(/"/g, '')}</div>`;
    });
    render(h, (e) => { if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), items); });
}

// ★フルスクリーン鑑定カード（表示リストを引数で受け取る）
function showLiquorCard(globalIndex, currentListArray = null) {
    // どこから来たか（階層か検索か）を維持するため、curPにリストを保持
    if(currentListArray) nav.updateNav("lq_card", nav.curG, currentListArray, globalIndex);
    else nav.updateNav("lq_card", nav.curG, nav.curP, globalIndex);

    const d = nav.liquorData[globalIndex]; if(!d) return;

    const btnBack = document.getElementById('ctrl-back');
    if(btnBack) { btnBack.innerText = 'メニュー'; btnBack.style.fontSize = '0.75rem'; }
    document.getElementById('btn-expand').style.opacity = '1';

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

    render(h, (e) => {}, true);
}

function resetCtrlBack() {
    const btnBack = document.getElementById('ctrl-back');
    if(btnBack) { btnBack.innerText = '▲'; btnBack.style.fontSize = ''; }
}

function render(h, cb, isFullScreen = false) { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; 
    document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item, .filter-btn').forEach(el => el.onclick = cb);
    
    const lSide = document.querySelector('.l-side');
    if(lSide) lSide.style.display = isFullScreen ? 'none' : '';

    if(!isFullScreen) resetCtrlBack();
}

function handleBack() {
    if (nav.state === "lq_card") {
        // 直前が検索結果か、階層メニューかで戻り先を変える
        if(nav.curP && nav.curP.length > 0 && !nav.curP[0]["中分類"]) {
            // 中分類がない（または混ざっている）＝検索結果
            executeScreening(); // 再度同じ条件で結果を描画
        } else {
            openLiquorList(nav.curP[0]["中分類"]); 
        }
    }
    else if (nav.state === "lq_res") openLiquorRoot();
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