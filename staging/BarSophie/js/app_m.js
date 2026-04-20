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

// ★ スクリーニング条件記憶
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

    // ★ データ読み込みの安全装置（エラー時はポップアップで知らせる）
    try {
        await nav.loadAllData();
    } catch (error) {
        alert("【警告】お酒データの読み込みに失敗しました！\n\n・liquor_db.tsvのファイル名が変わっていませんか？\n・Excel等で保存した際、カンマ区切り（CSV）になっていませんか？\n元のタブ区切り形式で保存し直してください。\n\n詳細: " + error.message);
        return; // ここでプログラムを止める
    }

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
// ★お酒データベース (3つの入り口)
// ==========================================
function openLiquorRoot() {
    nav.updateNav("lq_root"); isMusicMode = false;
    let h = `<div class="label" style="justify-content:center;">お酒を選ぶ</div>`;
    h += `<button class="act-btn" id="btn-lq-cat" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 ジャンルから探す</button>`;
    h += `<button class="act-btn" id="btn-scr" style="background:#d35400; margin:0 15px; width:calc(100% - 30px);">🔍 お好みで絞り込む</button>`;
    h += `<div class="direct-box-new"><div class="direct-lbl">ダイレクト検索</div><input type="number" id="direct-num" placeholder="No."><button id="btn-direct-go">開く</button></div>`;
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

function attachMultiSlider(id) {
    const minEl = document.getElementById(id + '-min');
    const maxEl = document.getElementById(id + '-max');
    const fillEl = document.getElementById(id + '-fill');

    const update = () => {
        let minV = parseFloat(minEl.value); let maxV = parseFloat(maxEl.value);
        if (minV > maxV) { let tmp = minV; minV = maxV; maxV = tmp; minEl.value = minV; maxEl.value = maxV; }
        const percentMin = ((minV + 2.0) / 4.0) * 100; const percentMax = ((maxV + 2.0) / 4.0) * 100;
        fillEl.style.left = percentMin + '%'; fillEl.style.width = (percentMax - percentMin) + '%';
        scrState[id.replace('scr-', '') + 'Min'] = minV.toFixed(1); scrState[id.replace('scr-', '') + 'Max'] = maxV.toFixed(1);
    };
    if(minEl && maxEl) {
        minEl.addEventListener('input', update); maxEl.addEventListener('input', update);
        update();
    }
}

// ★第4軸・動的ダブルスライダー生成関数（安全な古い記法へ）
const makeDoubleSliderWithTitle = (id, title, lblL, lblR, minV, maxV, disabled) => {
    const opacity = disabled ? '0.4' : '1';
    const pointerEvents = disabled ? 'none' : 'auto';
    return `
        <div style='opacity:${opacity}; pointer-events:${pointerEvents}; margin-bottom: 8px;'>
            <div style='font-size:0.75rem; color:var(--accent); margin-bottom:2px; padding-left:4px;'>${title}</div>
            <div class='scr-slider-box'>
                <div class='scr-slider-label-edge'>${lblL}</div>
                <div class='multi-range-wrap'>
                    <div class='multi-range-track'></div>
                    <div class='slider-ticks'><div class='tick'></div><div class='tick'></div><div class='tick center'></div><div class='tick'></div><div class='tick'></div></div>
                    <div class='multi-range-fill' id='${id}-fill'></div>
                    <input type='range' id='${id}-min' min='-2.0' max='2.0' step='0.5' value='${minV}'>
                    <input type='range' id='${id}-max' min='-2.0' max='2.0' step='0.5' value='${maxV}'>
                </div>
                <div class='scr-slider-label-edge'>${lblR}</div>
            </div>
        </div>`;
};

// ★スクリーニングUI
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

    let areaFilterData = nav.liquorData;
    if(scrState.major) areaFilterData = areaFilterData.filter(d => d["大分類"] === scrState.major);
    if(scrState.sub) areaFilterData = areaFilterData.filter(d => d["中分類"] === scrState.sub);
    const areas = [...new Set(areaFilterData.map(d => {
        const c = d["国"] || ""; const p = d["産地"] || ""; 
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

    const cospaOpts = `<option value="">問わない</option><option value="1" ${scrState.cospa==='1'?'selected':''}>☆1以上</option><option value="2" ${scrState.cospa==='2'?'selected':''}>☆2以上</option><option value="3" ${scrState.cospa==='3'?'selected':''}>☆3のみ</option>`;
    const boolOpts = (val) => `<option value="">問わない</option><option value="1" ${val==='1'?'selected':''}>はい</option>`;
    
    h += `<div class="scr-group">
            <div class="scr-title">Bar Sophie 特選条件</div>
            <div class="scr-row"><span class="scr-row-label">定番銘柄:</span><select id="scr-std">${boolOpts(scrState.isStandard)}</select></div>
            <div class="scr-row"><span class="scr-row-label">ｿﾌｨｰ推し:</span><select id="scr-sophie">${boolOpts(scrState.isSophieRecom)}</select></div>
            <div class="scr-row"><span class="scr-row-label">コスパ:</span><select id="scr-cospa">${cospaOpts}</select></div>
          </div>`;

    h += `<div class="scr-group">
            <div class="scr-title">AI評価軸 (3社平均)</div>
            ${makeDoubleSliderWithTitle("scr-s1", "第1軸", "辛口", "甘口", scrState.s1Min, scrState.s1Max, false)}
            ${makeDoubleSliderWithTitle("scr-s2", "第2軸", "軽快", "濃厚", scrState.s2Min, scrState.s2Max, false)}
            ${makeDoubleSliderWithTitle("scr-s3", "第3軸", "常道", "独特", scrState.s3Min, scrState.s3Max, false)}
          `;
          
    // ★第4軸の動的表示（安全な三項演算子で対応）
    const axis4 = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    const axis4Disabled = !scrState.sub;
    h += `${makeDoubleSliderWithTitle('scr-s4', axis4.label, axis4.left, axis4.right, scrState.s4Min, scrState.s4Max, axis4Disabled)}</div>`;

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

    render(h, (e) => {
        if(e.currentTarget.classList.contains('scr-tag-btn')) e.currentTarget.classList.toggle('selected');
    }, true, 'screening');

    attachMultiSlider('scr-s1'); attachMultiSlider('scr-s2'); attachMultiSlider('scr-s3'); attachMultiSlider('scr-s4');

    document.getElementById('scr-mj').onchange = (e) => {
        saveScrFormState(); scrState.major = e.target.value; scrState.sub = ""; scrState.area = ""; openScreeningUI();
    };
    document.getElementById('scr-sb').onchange = (e) => {
        saveScrFormState(); scrState.sub = e.target.value; scrState.area = ""; openScreeningUI();
    };
    document.getElementById('scr-ar').onchange = (e) => { scrState.area = e.target.value; };
}

// ★スクリーニング結果表示（★前回書き忘れた最重要関数！）
function renderSearchResults(results, scrollToIdx = null) {
    nav.updateNav('lq_res', null, results);
    let h = `<div class='label' style='justify-content:flex-start; gap:10px;'>
             <button style='background:none;border:none;color:#fff;font-size:1.2rem;' onclick='openLiquorRoot()'>◀</button>
             検索結果: ${results.length}件</div>`;
             
    h += `<button class="btn-back-scr" onclick="openScreeningUI()">🔍 検索条件を変更する</button>`;

    results.forEach(d => {
        const globalIdx = nav.liquorData.indexOf(d);
        h += `<div class='item' data-lqidx='${globalIdx}'>🥃 ${(d['銘柄名']||'').replace(/"/g,'')}</div>`;
    });
    
    render(h, (e) => {
        if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), results);
    }, true, 'result');

    if(scrollToIdx !== null) {
        setTimeout(() => {
            const target = document.querySelector(`[data-lqidx='${scrollToIdx}']`);
            if(target) target.scrollIntoView({ block: 'center' });
        }, 50);
    }
}

// ★スクリーニング実行
function executeScreening() {
    saveScrFormState(); 

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
            if(!allText.includes(scrState.keyword.toLowerCase())) return false;
        }

        if(scrState.isStandard === "1" && d["定番フラグ"] !== "1") return false;
        if(scrState.isSophieRecom === "1" && d["ソフィーの推し"] !== "1") return false;
        if(scrState.cospa) {
            const cStar = (d["Gemini_コスパ"]||"").match(/☆/g);
            const cCount = cStar ? cStar.length : 0;
            if(parseInt(scrState.cospa) > cCount) return false;
        }

        if(scrState.major && d["大分類"] !== scrState.major) return false;
        if(scrState.sub && d["中分類"] !== scrState.sub) return false;
        if(scrState.area) {
            const c = d["国"] || ""; const p = d["産地"] || ""; 
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
        
        if(avg1 < parseFloat(scrState.s1Min) || avg1 > parseFloat(scrState.s1Max)) return false;
        if(avg2 < parseFloat(scrState.s2Min) || avg2 > parseFloat(scrState.s2Max)) return false;
        
        // 第3軸・第4軸は Claude のみで判定
        const cla3 = parseFloat(d["Claude_個性"]);
        if(!isNaN(cla3) && (cla3 < parseFloat(scrState.s3Min) || cla3 > parseFloat(scrState.s3Max))) return false;
        
        if(scrState.sub) { 
            const cla4 = parseFloat(d["Claude_第4軸"]);
            if(!isNaN(cla4) && (cla4 < parseFloat(scrState.s4Min) || cla4 > parseFloat(scrState.s4Max))) return false;
        }

        if(scrState.tags.length > 0) {
            const dTags = ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',').map(t=>t.trim());
            const hasTag = scrState.tags.some(t => dTags.includes(t));
            if(!hasTag) return false;
        }
        return true;
    });

    renderSearchResults(results); // 切り出した関数を呼ぶ
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
    const makeInlineGraph = (lblL, lblR, gpt, gem, cla, showOnlyClaude = false) => {
        let hg = `<div class="graph-row-inline"><div class="graph-label-inline">${lblL}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        const pGpt = getPos(gpt); const pGem = getPos(gem); const pCla = getPos(cla);
        
        // ★Claudeの要望通り、第3軸・第4軸はClaudeのみ表示
        if(!showOnlyClaude) {
            if(pGpt >= 0) hg += `<div class="graph-point pt-gpt" style="left:${pGpt}%"></div>`;
            if(pGem >= 0) hg += `<div class="graph-point pt-gemini" style="left:${pGem}%"></div>`;
        }
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
    
    // 第1軸・第2軸は3社表示
    h += makeInlineGraph("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"], false);
    h += makeInlineGraph("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"], false);
    
    // 第3軸・第4軸はClaudeのみ表示
    h += makeInlineGraph("常道", "独特", "", "", d["Claude_個性"], true);
    
    const cardAxis4 = (d["中分類"] && AXIS4_MAP[d["中分類"]]) ? AXIS4_MAP[d["中分類"]] : AXIS4_DEFAULT;
    h += `<div style='font-size:0.65rem; color:var(--accent); margin-top:6px; margin-bottom:2px; text-align:center;'>${cardAxis4.label}</div>`;
    h += makeInlineGraph(cardAxis4.left, cardAxis4.right, "", "", d["Claude_第4軸"], true);

    h += `<div style="font-size:0.6rem; color:#888; text-align:right; margin-top:8px;">
            <span style="color:#10a37f">●GPT</span> <span style="color:#1a73e8">●Gem</span> <span style="color:#d97757">●Claude</span>
          </div>`;
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

    render(h, (e) => {}, true, 'standard');

    const btnBack = document.getElementById('ctrl-back');
    if(btnBack) { 
        if (nav.curG === null) {
            btnBack.innerText = '候補へ戻る'; btnBack.style.fontSize = '0.8rem'; btnBack.style.background = '#d35400'; btnBack.style.color = '#fff'; btnBack.style.border = '1px solid #e67e22';
        } else {
            btnBack.innerText = 'リストへ'; btnBack.style.fontSize = '0.8rem';
        }
    }
    const btnExpand = document.getElementById('btn-expand');
    if(btnExpand) btnExpand.style.opacity = '1';
}

function resetCtrlBack() {
    const btnBack = document.getElementById('ctrl-back');
    if(btnBack) { btnBack.innerText = '▲'; btnBack.style.fontSize = ''; btnBack.style.background = ''; btnBack.style.color = ''; btnBack.style.border = ''; }
}

function render(h, cb, isFullScreen = false, consoleMode = 'standard') { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; 
    document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item, .filter-btn, .scr-tag-btn').forEach(el => el.onclick = cb);
    
    const lSide = document.querySelector('.l-side');
    if(lSide) lSide.style.display = isFullScreen ? 'none' : '';

    renderConsole(consoleMode);
    if(!isFullScreen) resetCtrlBack();
}

function handleBack() {
    if (nav.state === "lq_card") {
        if(nav.curP && nav.curP.length > 0 && !nav.curP[0]["中分類"]) {
            // ★戻る際にスクロール位置を復元
            renderSearchResults(nav.curP, nav.curI); 
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