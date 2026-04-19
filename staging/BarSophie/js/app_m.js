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
                if (e.data === YT.PlayerState.ENDED && isAutoPlay && isMusicMode) next();
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
    btnExpand.innerText = '▼';
    btnExpand.style.opacity = '0.3'; 

    // フルスクリーン（左画面隠し）を解除
    const lSide = document.querySelector('.l-side');
    if(lSide) lSide.style.display = '';
}

function setup() {
    const btnEnter = document.getElementById('btn-enter');
    if(btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; 
            document.getElementById('chat-mode').style.display='flex'; 
            if (ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
                try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch(e) {}
            }
            const fallbackText = "いらっしゃいませ。";
            talkAudio.src = "./voices_mp3/greeting.mp3";
            talkAudio.onerror = () => { try { media.speak(fallbackText); } catch(e){} };
            try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(fallbackText); } catch(e){} }); } catch(e) { try { media.speak(fallbackText); } catch(err){} }
        };
    }

    const btnToBar = document.getElementById('btn-to-bar');
    if(btnToBar) {
        btnToBar.onclick = () => { 
            document.getElementById('chat-mode').style.display='none'; 
            document.getElementById('main-ui').style.display='flex'; 
            window.speechSynthesis.cancel(); talkAudio.pause();
            showRootMenu();
            
            talkAudio.src = "./voices_mp3/menu_greeting.mp3"; 
            const fallbackText = "いつもありがとうございます。今日はいかがされますか？";
            talkAudio.onerror = () => { try { media.speak(fallbackText); } catch(e){} };
            try { const p = talkAudio.play(); if (p !== undefined) p.catch(() => { try { media.speak(fallbackText); } catch(e){} }); } catch(e) { try { media.speak(fallbackText); } catch(err){} }
        };
    }

    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    
    document.getElementById('btn-expand').onclick = () => {
        if (isMusicMode || nav.state === "none" || nav.state === "lq_card") return;
        const monitor = document.querySelector('.monitor');
        const btn = document.getElementById('btn-expand');
        monitor.classList.toggle('expanded');
        btn.innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
    };
    
    const sophieWarp = document.getElementById('sophie-warp');
    if(sophieWarp) {
        sophieWarp.onclick = () => { 
            if(nav.state !== "none") { showRootMenu(); } 
            else { 
                document.getElementById('main-ui').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
                const loungeText = document.getElementById('lounge-text'); loungeText.innerText = "ありがとうございました。"; 
                window.speechSynthesis.cancel();
                if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') { try { ytPlayer.pauseVideo(); } catch(e){} }
                try { talkAudio.pause(); } catch(e){}
                talkAudio.src = "./voices_mp3/goodbye.mp3";
                const finalizeExit = () => { setTimeout(() => { document.getElementById('chat-mode').style.display='none'; document.getElementById('entry-screen').style.display='flex'; loungeText.innerText = "いらっしゃいませ。"; talkAudio.onended = defaultOnEnded; img.src = ""; }, 1000); };
                talkAudio.onended = finalizeExit; talkAudio.onerror = finalizeExit; 
                try { const p = talkAudio.play(); if (p !== undefined) p.catch(finalizeExit); } catch(e) { finalizeExit(); }
            } 
        };
    }

    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;
    const btnLiquor = document.getElementById('btn-liquor');
    if(btnLiquor) btnLiquor.onclick = openLiquorMajor;

    const btnN = document.getElementById('btn-next');
    if(btnN) {
        btnN.onpointerdown = (e) => { e.preventDefault(); pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
        btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
        btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    }
    talkAudio.onended = defaultOnEnded;
}

function playHead() {
    if(ytPlayerReady && ytPlayer && typeof ytPlayer.seekTo === 'function') { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); }
    if(!isMusicMode) talkAudio.play().catch(()=>{});
}

function togglePause() {
    if(!isPaused) { if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo(); talkAudio.pause(); window.speechSynthesis.pause(); isPaused = true; } 
    else { if(ytPlayerReady && ytPlayer && typeof ytPlayer.playVideo === 'function') ytPlayer.playVideo(); if(!isMusicMode) talkAudio.play().catch(()=>{}); window.speechSynthesis.resume(); isPaused = false; }
}

function next() {
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
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
    if(!u) return "";
    const reg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = u.match(reg); return match ? match[1] : u;
}

function setMon(m, s) {
    if (nav.state === "none") {
        ytWrapper.style.display = 'none'; img.style.display = 'block'; img.src = './front_sophie.jpeg';
        document.querySelector('.monitor').classList.remove('expanded'); document.getElementById('btn-expand').innerText = '▼'; document.getElementById('btn-expand').style.opacity = '0.3';
        if(m === 'v') { if(ytPlayerReady && ytPlayer && typeof ytPlayer.loadVideoById === 'function') ytPlayer.loadVideoById(extractYtId(s)); } 
        else { if(ytPlayerReady && ytPlayer && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo(); }
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
    window.speechSynthesis.cancel(); 
    try { talkAudio.pause(); if (talkAudio.readyState > 0) talkAudio.currentTime = 0; } catch(e){}
    lastTxt = t; isMusicMode = isM; isPaused = false;
    tel.innerText = t; tel.style.display = 'block'; tel.scrollTop = 0;
    
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

// 音楽
function openMusic() {
    nav.updateNav("art"); let h = "";
    h += `<div class="label">マスターお薦め</div><div class="artist-grid">`;
    h += `<div class="item" data-special="ソフィー" style="color: var(--blue);">🎤 ソフィー</div>`;
    h += `<div class="item" data-special="BGM">🎤 BGM</div>`;
    h += `<div class="item" data-special="昭和ソング">🎤 昭和ソング</div></div>`;
    const preferredOrder = ['E', 'F', 'J', 'L', 'W', 'I', 'S']; 
    const rawFs = [...new Set(nav.jData.map(d => d.f).filter(Boolean))];
    const sortedFs = rawFs.sort((a, b) => { let ia = preferredOrder.indexOf(a); let ib = preferredOrder.indexOf(b); if (ia === -1) ia = 999; if (ib === -1) ib = 999; return ia - ib; });
    sortedFs.forEach(f => {
        const arts = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if(arts.length) { 
            let labelName = (f === 'L') ? "特集コーナー" : (nav.jData.find(d => d.f === f && d.gName) ? nav.jData.find(d => d.f === f && d.gName).gName : f);
            h += `<div class="label">${labelName}</div><div class="artist-grid">`;
            arts.forEach(a => { h += `<div class="item" data-artist="${a}">🎤 ${a}</div>`; }); h += `</div>`;
        }
    });
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.special) openSpecialSongs(el.dataset.special); else if(el.dataset.artist) openSongs(el.dataset.artist); });
}
function openSpecialSongs(type) {
    let filtered = [];
    if(type === 'ソフィー') filtered = nav.jData.filter(m => m.a && m.a.includes("ソフィー"));
    else if(type === 'BGM') filtered = nav.jData.filter(m => m.a === "BGM");
    else if(type === '昭和ソング') { const showaGenres = ["70s", "昭和", "演歌", "歌姫"]; filtered = nav.jData.filter(m => showaGenres.includes(m.a)); }
    nav.updateNav("tit", undefined, filtered); isMusicMode = true; renderSongList(type);
}
function openSongs(a) { nav.updateNav("tit", undefined, nav.jData.filter(m => m.a === a)); isMusicMode = true; renderSongList(a); }
function renderSongList(title) {
    let h = `<div class="label">${title}</div>`;
    nav.curP.forEach((m, i) => { const color = (m.ti && (m.ti.includes("みずいろのシグナル") || m.ti.includes("水色のシグナル"))) ? `style="color: var(--blue);"` : ""; h += `<div class="item" data-idx="${i}" ${color}>🎵 ${m.ti}</div>`; });
    render(h, (e) => { const el = e.currentTarget; if(el.dataset.idx) { const i = parseInt(el.dataset.idx); if(!isNaN(i)){ nav.updateNav(undefined,undefined,undefined,i); setMon('v', nav.curP[i].u); prep(`${nav.curP[i].a}さんの${nav.curP[i].ti}です`, true); } } });
}

// お話
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
// ★お酒データベース（階層型・フルスクリーン）
// ==========================================

// 1. 大分類一覧
function openLiquorMajor() {
    nav.updateNav("lq_major");
    isMusicMode = false;
    let h = `<div class="label">お酒の種類 (大分類)</div>`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];
    majors.forEach(m => { h += `<div class="item" data-lqmajor="${m}">📁 ${m}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqmajor) openLiquorSub(e.currentTarget.dataset.lqmajor); });
}

// 2. 中分類一覧
function openLiquorSub(major) {
    nav.updateNav("lq_sub", major); 
    let h = `<div class="label">${major}</div>`;
    const subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === major).map(d => d["中分類"]).filter(Boolean))];
    subs.forEach(s => { h += `<div class="item" data-lqsub="${s}">📁 ${s}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqsub) openLiquorList(e.currentTarget.dataset.lqsub); });
}

// 3. 銘柄リスト
function openLiquorList(sub) {
    nav.updateNav("lq_list", nav.curG, sub); // curG=major, curP=sub として保持
    let h = `<div class="label">${sub} 銘柄一覧</div>`;
    const items = nav.liquorData.filter(d => d["中分類"] === sub);
    items.forEach(d => {
        const idx = nav.liquorData.indexOf(d);
        h += `<div class="item" data-lqidx="${idx}">🥃 ${d["銘柄名"]}</div>`;
    });
    render(h, (e) => { if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx)); });
}

// 4. フルスクリーン鑑定カード
function showLiquorCard(index) {
    nav.updateNav("lq_card", nav.curG, nav.curP, index);
    const d = nav.liquorData[index];
    if(!d) return;

    const getPos = (valStr) => {
        let v = parseFloat(valStr);
        if(isNaN(v)) return -1;
        return Math.min(100, Math.max(0, ((v + 2.0) / 4.0) * 100)); // -2.0〜2.0 を 0%〜100%に
    };

    const makeGraphRow = (labelLeft, labelRight, gptVal, geminiVal, claudeVal) => {
        let h = `<div class="graph-row"><div class="graph-label"><span>${labelLeft}</span><span>${labelRight}</span></div><div class="graph-bar-bg">`;
        const pGpt = getPos(gptVal); const pGem = getPos(geminiVal); const pCla = getPos(claudeVal);
        if(pGpt >= 0) h += `<div class="graph-point pt-gpt" style="left:${pGpt}%"></div>`;
        if(pGem >= 0) h += `<div class="graph-point pt-gemini" style="left:${pGem}%"></div>`;
        if(pCla >= 0) h += `<div class="graph-point pt-claude" style="left:${pCla}%"></div>`;
        h += `</div></div>`;
        return h;
    };

    // タグの結合
    let tagsHtml = "";
    const allTags = ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',');
    allTags.forEach(t => { if(t.trim()) tagsHtml += `<span class="lq-tag">${t.trim()}</span>`; });

    // 度数の100倍処理
    let abv = d["度数"] || "-";
    if (!isNaN(parseFloat(abv)) && parseFloat(abv) > 0 && parseFloat(abv) <= 1.0 && !abv.includes('%')) {
        abv = (parseFloat(abv) * 100).toFixed(0) + '%';
    }

    let h = `<div class="label" style="justify-content:flex-start; gap:10px;">
                <button id="btn-lq-back" style="background:none;border:none;color:#fff;font-size:1.2rem;">◀</button>
                No.${d["No"]}
             </div>`;
             
    h += `<div class="lq-card">`;
    h += `<div class="lq-name">${d["銘柄名"]}</div>`;
    if(d["ソフィーのセリフ"]) h += `<div class="lq-quote">「${d["ソフィーのセリフ"]}」</div>`;
    
    // スペック表
    h += `<div class="lq-specs-grid">
            <div class="spec-item"><span class="spec-key">大分類</span><span class="spec-val">${d["大分類"]}</span></div>
            <div class="spec-item"><span class="spec-key">中分類</span><span class="spec-val">${d["中分類"]}</span></div>
            <div class="spec-item"><span class="spec-key">産地</span><span class="spec-val">${d["国"]} / ${d["マップ産地"] || d["産地"]}</span></div>
            <div class="spec-item"><span class="spec-key">度数</span><span class="spec-val">${abv}</span></div>
            <div class="spec-item"><span class="spec-key">知名度</span><span class="spec-val">Lv.${d["知名度"]}</span></div>
            <div class="spec-item"><span class="spec-key">誕生</span><span class="spec-val">${d["銘柄誕生年"]}</span></div>
            <div class="spec-item"><span class="spec-key">バー価格</span><span class="spec-val">${d["バー価格"]}</span></div>
            <div class="spec-item"><span class="spec-key">市販価格</span><span class="spec-val">${d["市販価格"]}</span></div>
          </div>`;

    // コスパとグラフ
    h += `<div class="lq-graph-box">`;
    if(d["Gemini_コスパ"]) h += `<div class="lq-cospa">コスパ評価：${d["Gemini_コスパ"]}</div>`;
    
    h += `  ${makeGraphRow("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"])}
            ${makeGraphRow("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"])}
            ${makeGraphRow("常道", "独特", d["GPT_個性"], d["Gemini_個性"], d["Claude_個性"])}
            ${makeGraphRow("淡麗", "コク", d["GPT_第4軸"], d["Gemini_第4軸"], d["Claude_第4軸"])}
            <div class="graph-legend"><span style="color:#10a37f">●GPT</span> <span style="color:#1a73e8">●Gem</span> <span style="color:#d97757">●Cla</span></div>
          </div>`;

    // テキスト類
    if(d["鑑定評価(200字)"]) h += `<div class="lq-desc">${d["鑑定評価(200字)"]}</div>`;
    
    // [ソフィー] をピンク色にする
    if(d["ソフィーの裏話"]) h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span>${d["ソフィーの裏話"]}</div>`;
    
    if(tagsHtml) h += `<div class="lq-tags">${tagsHtml}</div>`;

    h += `<div class="lq-actions">`;
    if(d["公式URL"] && d["公式URL"] !== "-") h += `<a href="${d["公式URL"]}" target="_blank" class="lq-btn btn-amazon">公式情報を見る</a>`;
    h += `</div></div>`; // card end

    // ★ フルスクリーン（isFullScreen = true）で描画
    render(h, (e) => {}, true);
    
    document.getElementById('btn-lq-back').onclick = () => openLiquorList(nav.curP); // subリストへ戻る
}

// render関数の第3引数でフルスクリーン（l-side隠し）を制御
function render(h, cb, isFullScreen = false) { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; 
    document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item, .filter-btn').forEach(el => el.onclick = cb);
    
    const lSide = document.querySelector('.l-side');
    if(lSide) lSide.style.display = isFullScreen ? 'none' : '';
}

function handleBack() {
    if (nav.state === "lq_card") openLiquorList(nav.curP); 
    else if (nav.state === "lq_list") openLiquorSub(nav.curG);
    else if (nav.state === "lq_sub") openLiquorMajor();
    else if (nav.state === "lq_major") showRootMenu();
    else if (nav.state === "st") openThemes(nav.curG); 
    else if (nav.state === "th") openTalk(); 
    else if (nav.state === "tit") openMusic();
    else { showRootMenu(); }
}