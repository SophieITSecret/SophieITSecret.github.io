import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

// ★【直接埋め込み】Claude殿監修：第4軸の動的マッピングデータ
const AXIS4_MAP = {
    "スコッチ・シングルモルト": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "スコッチ・ブレンデッド": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "アイリッシュウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "カナディアンウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "ジャパニーズウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "ライウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "その他ウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "バーボン": { label: "樽熟成感", left: "軽熟", right: "深熟" },
    "テネシーウイスキー": { label: "樽熟成感", left: "軽熟", right: "深熟" },
    "コニャック": { label: "樽熟成感", left: "軽熟", right: "深熟" },
    "アルマニャック": { label: "樽熟成感", left: "軽熟", right: "深熟" },
    "カルヴァドス": { label: "リンゴ感", left: "淡林", right: "強林" },
    "赤ワイン": { label: "タンニン", left: "柔渋", right: "強渋" },
    "白ワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "ロゼワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "オレンジワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "シェリー・酒精強化": { label: "ナッツ感", left: "淡果", right: "強果" },
    "シャンパン": { label: "辛口度", left: "甘泡", right: "辛泡" },
    "プロセッコ・フランチャコルタ": { label: "辛口度", left: "甘泡", right: "辛泡" },
    "純米大吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "純米吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "特別純米・純米": { label: "旨味", left: "淡麗", right: "濃醇" },
    "本醸造・その他": { label: "旨味", left: "淡麗", right: "濃醇" },
    "スパークリング日本酒": { label: "旨味", left: "淡麗", right: "濃醇" },
    "芋焼酎": { label: "芋の素材感", left: "淡芋", right: "強芋" },
    "麦焼酎": { label: "麦の素材感", left: "淡麦", right: "強麦" },
    "米焼酎": { label: "米の素材感", left: "淡米", right: "強米" },
    "黒糖焼酎": { label: "黒糖感", left: "淡糖", right: "強糖" },
    "泡盛": { label: "古酒感", left: "若酒", right: "古酒" },
    "ジン（銘柄）": { label: "ボタニカル感", left: "淡草", right: "強草" },
    "ウォッカ（銘柄）": { label: "クリーン度", left: "個性", right: "純粋" },
    "テキーラ（銘柄）": { label: "アガベ感", left: "淡龍", right: "強龍" },
    "ラム（銘柄）": { label: "糖蜜・樽感", left: "軽糖", right: "濃糖" },
    "ベルモット・アペリティフ": { label: "薬草感", left: "淡草", right: "強草" },
    "国内プレミアム": { label: "苦味", left: "無苦", right: "苦強" },
    "海外メジャー": { label: "苦味", left: "無苦", right: "苦強" },
    "クラフトビール": { label: "苦味", left: "無苦", right: "苦強" },
    "梅酒": { label: "熟成感", left: "若梅", right: "熟梅" },
    "和リキュール": { label: "素材感", left: "淡素", right: "強素" },
    "ウイスキー系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "ウォッカ系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "ジン系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "ラム系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "テキーラ系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "ブランデー系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "リキュール系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "クラシックカクテル": { label: "酸味", left: "無酸", right: "酸強" }
};
const AXIS4_DEFAULT = { label: "第4軸(品目指定)", left: "淡麗", right: "コク", disabled: true };

// ★ スクリーニング条件
let scrState = null;
function initScrState() {
    scrState = {
        major: "", sub: "", area: "", keyword: "",
        cospa: "", isStandard: "", isSophieRecom: "", 
        pMin: "", pMax: "", aMin: "", aMax: "",
        s1Min: "-2.0", s1Max: "2.0", s2Min: "-2.0", s2Max: "2.0",
        s3Min: "-2.0", s3Max: "2.0", s4Min: "-2.0", s4Max: "2.0",
        tags: []
    };
}

function saveScrFormState() {
    if(!document.getElementById('scr-mj')) return; 
    scrState.keyword = document.getElementById('scr-kw').value;
    scrState.major = document.getElementById('scr-mj').value;
    scrState.sub = document.getElementById('scr-sb').value;
    scrState.area = document.getElementById('scr-ar').value;
    scrState.cospa = document.getElementById('scr-cospa').value;
    scrState.isStandard = document.getElementById('scr-std').value;
    scrState.isSophieRecom = document.getElementById('scr-sophie').value;
    scrState.pMin = document.getElementById('scr-p-min').value;
    scrState.pMax = document.getElementById('scr-p-max').value;
    scrState.aMin = document.getElementById('scr-a-min').value;
    scrState.aMax = document.getElementById('scr-a-max').value;
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
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

function renderConsole(mode) {
    const grid = document.querySelector('.btn-grid');
    if (!grid) return;
    
    if (mode === 'screening') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-clear" id="btn-c-clear">条件クリア</button><button class="console-scr-btn btn-c-exec" id="btn-c-exec">検索実行</button>`;
        document.getElementById('btn-c-clear').onclick = () => { initScrState(); openScreeningUI(); };
        document.getElementById('btn-c-exec').onclick = executeScreening;
    } else if (mode === 'result') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-mod" id="btn-c-mod">🔍 検索条件を変更する</button>`;
        document.getElementById('btn-c-mod').onclick = openScreeningUI;
    } else {
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
    renderConsole('standard');
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

    renderConsole('standard');
    
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
function openSongs(a) { nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a)); isMusicMode =