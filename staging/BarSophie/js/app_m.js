import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

// 第4軸定義
const AXIS4_MAP = {
    "スコッチ・シングルモルト": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "バーボン": { label: "樽熟成感", left: "軽熟", right: "深熟" },
    "赤ワイン": { label: "タンニン", left: "柔渋", right: "強渋" },
    "白ワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "純米大吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "ジン（銘柄）": { label: "ボタニカル感", left: "淡草", right: "強草" }
    // ... 他の分類も内部で保持
};
const AXIS4_DEFAULT = { label: "第4軸(品目指定)", left: "←", right: "→", disabled: true };

// ★ スクリーニング条件記憶
let scrState = null;
function initScrState() {
    scrState = {
        major: "", sub: "", country: "", region: "", keyword: "",
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
    scrState.country = document.getElementById('scr-cn').value;
    scrState.region = document.getElementById('scr-rg').value;
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

    try { await nav.loadAllData(); } catch (e) { alert("Data Error: " + e.message); }
    initScrState();
    setup();
    const tag = document.createElement('script'); tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
});

window.onYouTubeIframeAPIReady = function() {
    ytPlayer = new YT.Player('yt-player', {
        playerVars: { 'playsinline': 1, 'autoplay': 1 },
        events: { 'onStateChange': (e) => { if (e.data === YT.PlayerState.ENDED && isAutoPlay && isMusicMode) next(); } }
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
        grid.innerHTML = `<button class="c-btn" id="btn-expand">▼</button><button class="c-btn" id="ctrl-back">▲</button><button class="c-btn" id="ctrl-pause">⏹️</button><button class="c-btn" id="ctrl-play" style="flex: 1.5; font-size: 1.2rem;">▶</button><button class="c-btn" id="btn-next">⏭</button>`;
        document.getElementById('ctrl-play').onclick = playHead;
        document.getElementById('ctrl-pause').onclick = togglePause;
        document.getElementById('ctrl-back').onclick = handleBack;
        document.getElementById('btn-expand').onclick = handleExpand;
        const btnN = document.getElementById('btn-next');
        if(btnN) {
            btnN.onpointerdown = (e) => { e.preventDefault(); pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; btnN.classList.toggle('auto-active', isAutoPlay); pressTimer = null; }, 600); };
            btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
        }
        resetCtrlBack();
    }
}

// ★下↓手ソフィーの安定化
function handleExpand() {
    if (nav.state === "lq_card" || nav.state === "lq_scr") {
        const lSide = document.querySelector('.l-side');
        if (lSide) { lSide.style.display = 'block'; setTimeout(() => { if (nav.state === "lq_card" || nav.state === "lq_scr") lSide.style.display = 'none'; }, 4000); }
        window.speechSynthesis.cancel();
        const msg = "何になさいますか？";
        talkAudio.src = "./voices_mp3/what_order.mp3"; 
        talkAudio.onerror = () => { media.speak(msg); };
        talkAudio.play().catch(() => media.speak(msg));
        return;
    }
    const monitor = document.querySelector('.monitor');
    monitor.classList.toggle('expanded');
    document.getElementById('btn-expand').innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
}

function showRootMenu() {
    lv.style.display = 'none'; nm.style.display = 'block'; nav.updateNav("none");
    ytWrapper.style.display = 'none'; img.src = './front_sophie.jpeg'; img.style.display = 'block'; tel.style.display = 'none';
    renderConsole('standard');
}

function setup() {
    const btnEnter = document.getElementById('btn-enter');
    if(btnEnter) {
        btnEnter.onclick = () => { 
            document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
            // ★挨拶を確実に鳴らす
            const msg = "いらっしゃいませ。";
            talkAudio.src = "./voices_mp3/greeting.mp3";
            talkAudio.onerror = () => media.speak(msg);
            talkAudio.play().catch(() => media.speak(msg));
        };
    }
    const btnToBar = document.getElementById('btn-to-bar');
    if(btnToBar) {
        btnToBar.onclick = () => { 
            document.getElementById('chat-mode').style.display='none'; document.getElementById('main-ui').style.display='flex'; 
            window.speechSynthesis.cancel(); showRootMenu();
            // ★カウンター挨拶
            const msg = "今日はいかがされますか？";
            talkAudio.src = "./voices_mp3/menu_greeting.mp3";
            talkAudio.onerror = () => media.speak(msg);
            talkAudio.play().catch(() => media.speak(msg));
        };
    }
    renderConsole('standard');
}

function playHead() {
    if (nav.state === "lq_card") {
        const list = Array.isArray(nav.curP) ? nav.curP : [];
        if(list.length > 0) {
            let idx = (list.indexOf(nav.liquorData[nav.curI]) + 1) % list.length;
            showLiquorCard(nav.liquorData.indexOf(list[idx]), list);
        }
        return;
    }
    if(ytPlayer && ytPlayer.seekTo) { ytPlayer.seekTo(0, true); ytPlayer.playVideo(); }
    talkAudio.play().catch(()=>{});
}

function togglePause() {
    if(!isPaused) { if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); talkAudio.pause(); isPaused = true; } 
    else { if(ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo(); talkAudio.play().catch(()=>{}); isPaused = false; }
}

function next() {
    if (nav.state === "lq_card") {
        const major = nav.curG; const sub = nav.liquorData[nav.curI]["中分類"];
        const subs = [...new Set(nav.liquorData.filter(d => d["大分類"] === major).map(d => d["中分類"]))];
        let nextIdx = (subs.indexOf(sub) + 1) % subs.length;
        openLiquorList(subs[nextIdx]); return;
    }
    if(nav.curI < nav.curP.length - 1) {
        nav.updateNav(undefined, undefined, undefined, nav.curI + 1);
        const m = nav.curP[nav.curI];
        if (isMusicMode) { setMon('v', m.u); prep(m.ti, true); } else { setMon('i', `./talk_images/${m.id}.jpg`); prep(m.txt, false, m.id); }
    }
}

function setMon(m, s) {
    ytWrapper.style.display = (m === 'v') ? 'block' : 'none';
    img.style.display = (m === 'i') ? 'block' : 'none';
    if(m === 'v' && ytPlayer && ytPlayer.loadVideoById) ytPlayer.loadVideoById(s.split('v=')[1] || s);
    if(m === 'i') img.src = s;
}

function prep(t, isM, id = null) {
    tel.innerText = t; tel.style.display = 'block';
    if(id) { talkAudio.src = `./voices_mp3/${id}.mp3`; talkAudio.play().catch(() => media.speak(t)); }
}

// --- お酒ポータル ---
function openLiquorRoot() {
    nav.updateNav("lq_root");
    let h = `<div class="label" style="justify-content:center;">お酒を選ぶ</div>`;
    h += `<button class="act-btn" id="btn-lq-cat" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>`;
    h += `<button class="act-btn" id="btn-scr" style="background:#d35400; margin:0 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>`;
    h += `<div class="direct-box-new"><div class="direct-lbl">ダイレクト検索</div><input type="number" id="direct-num" placeholder="No."><button id="btn-direct-go">開く</button></div>`;
    render(h, () => {});
    document.getElementById('btn-scr').onclick = openScreeningUI;
    document.getElementById('btn-lq-cat').onclick = openLiquorMajor;
    document.getElementById('btn-direct-go').onclick = () => {
        const v = document.getElementById('direct-num').value;
        const target = nav.liquorData.find(d => d["No"] == v);
        if(target) showLiquorCard(nav.liquorData.indexOf(target), nav.liquorData);
    };
}

// --- スクリーニングUI ---
function openScreeningUI() {
    nav.updateNav("lq_scr");
    let h = `<div class="label"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" id="btn-scr-back">◀</button> お好みでスクリーニング</div>`;
    h += `<div class="scr-container">`;

    // ジャンル・品目
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]))];
    const majorOpts = `<option value="">問わない</option>` + majors.map(m => `<option value="${m}" ${scrState.major === m ? 'selected':''}>${m}</option>`).join('');
    let subs = scrState.major ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]))] : [];
    const subOpts = `<option value="">問わない</option>` + subs.map(s => `<option value="${s}" ${scrState.sub === s ? 'selected':''}>${s}</option>`).join('');

    // ★国と地域を分離
    const countries = [...new Set(nav.liquorData.filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub)).map(d => d["国"]))].filter(Boolean).sort();
    const regions = [...new Set(nav.liquorData.filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub) && (!scrState.country || d["国"] === scrState.country)).map(d => d["産地"]))].filter(Boolean).sort();
    const countryOpts = `<option value="">問わない</option>` + countries.map(c => `<option value="${c}" ${scrState.country === c ? 'selected':''}>${c}</option>`).join('');
    const regionOpts = `<option value="">問わない</option>` + regions.map(r => `<option value="${r}" ${scrState.region === r ? 'selected':''}>${r}</option>`).join('');

    h += `<div class="scr-group">
            <div class="scr-title">基本条件</div>
            <div class="scr-row"><span class="scr-row-label">ジャンル:</span><select id="scr-mj">${majorOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">品目:</span><select id="scr-sb">${subOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">国:</span><select id="scr-cn">${countryOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">地域:</span><select id="scr-rg">${regionOpts}</select></div>
            <div class="scr-row" style="margin-top:10px;"><span class="scr-row-label">検索:</span><input type="text" id="scr-kw" placeholder="すべての文字から探す" value="${scrState.keyword}"></div>
          </div>`;

    // ★定番・推し・コスパ
    const stdOpts = `<option value="">問わない</option><option value="1" ${scrState.isStandard==='1'?'selected':''}>定番に絞る</option>`;
    const sopOpts = `<option value="">問わない</option><option value="1" ${scrState.isSophieRecom==='1'?'selected':''}>推しを聞く</option>`;
    const cospaOpts = `<option value="">問わない</option><option value="1" ${scrState.cospa==='1'?'selected':''}>☆1以上</option><option value="2" ${scrState.cospa==='2'?'selected':''}>☆2以上</option><option value="3" ${scrState.cospa==='3'?'selected':''}>☆3のみ</option>`;

    h += `<div class="scr-group">
            <div class="scr-title">Bar Sophie 特選</div>
            <div class="scr-row"><span class="scr-row-label">定番:</span><select id="scr-std">${stdOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">推し:</span><select id="scr-sophie">${sopOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">ｺｽﾊﾟ:</span><select id="scr-cospa">${cospaOpts}</select></div>
          </div>`;

    // スライダー（第1〜第3ラベル削除）
    const makeDoubleSlider = (id, lblL, lblR, minV, maxV, dis) => `
        <div class="scr-slider-box" style="opacity:${dis?0.4:1}; pointer-events:${dis?'none':'auto'};">
            <div class="scr-slider-label-edge">${lblL}</div>
            <div class="multi-range-wrap">
                <div class="multi-range-track"></div>
                <div class="slider-ticks"><div class="tick"></div><div class="tick"></div><div class="tick center"></div><div class="tick"></div><div class="tick"></div></div>
                <div class="multi-range-fill" id="${id}-fill"></div>
                <input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${minV}">
                <input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${maxV}">
            </div>
            <div class="scr-slider-label-edge">${lblR}</div>
        </div>`;

    h += `<div class="scr-group"><div class="scr-title">味わい指定</div>
            ${makeDoubleSlider("scr-s1", "辛口", "甘口", scrState.s1Min, scrState.s1Max, false)}
            ${makeDoubleSlider("scr-s2", "軽快", "濃厚", scrState.s2Min, scrState.s2Max, false)}
            ${makeDoubleSlider("scr-s3", "常道", "独特", scrState.s3Min, scrState.s3Max, false)}`;
    const axis4 = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    h += `${makeDoubleSlider("scr-s4", axis4.left, axis4.right, scrState.s4Min, scrState.s4Max, !scrState.sub)}</div>`;

    // 価格・度数
    const pVals = ["", 1000, 2000, 3000, 4000, 5000, 7000, 10000, 20000, 30000, 50000];
    const pOpts = pVals.map(v => `<option value="${v}">${v===""?"問わない":v.toLocaleString()+"円"}</option>`).join('');
    const aVals = ["", 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const aOpts = aVals.map(v => `<option value="${v}">${v===""?"問わない":v+"%"}</option>`).join('');
    h += `<div class="scr-group"><div class="scr-title">市場価格・度数</div>
            <div class="scr-row"><span class="scr-row-label">価格:</span><select id="scr-p-min">${pOpts.replace('value="'+scrState.pMin+'"', 'value="'+scrState.pMin+'" selected')}</select> 〜 <select id="scr-p-max">${pOpts.replace('value="'+scrState.pMax+'"', 'value="'+scrState.pMax+'" selected')}</select></div>
            <div class="scr-row"><span class="scr-row-label">度数:</span><select id="scr-a-min">${aOpts.replace('value="'+scrState.aMin+'"', 'value="'+scrState.aMin+'" selected')}</select> 〜 <select id="scr-a-max">${aOpts.replace('value="'+scrState.aMax+'"', 'value="'+scrState.aMax+'" selected')}</select></div>
          </div>`;

    render(h, (e) => { if(e.currentTarget.classList.contains('scr-tag-btn')) e.currentTarget.classList.toggle('selected'); }, true, 'screening');
    document.getElementById('btn-scr-back').onclick = openLiquorRoot;
    attachMultiSlider('scr-s1'); attachMultiSlider('scr-s2'); attachMultiSlider('scr-s3'); attachMultiSlider('scr-s4');
    document.getElementById('scr-mj').onchange = (e) => { saveScrFormState(); scrState.major = e.target.value; scrState.sub = ""; openScreeningUI(); };
    document.getElementById('scr-sb').onchange = (e) => { saveScrFormState(); scrState.sub = e.target.value; openScreeningUI(); };
    document.getElementById('scr-cn').onchange = (e) => { saveScrFormState(); scrState.country = e.target.value; openScreeningUI(); };
}

function executeScreening() {
    saveScrFormState();
    const res = nav.liquorData.filter(d => {
        if(scrState.keyword && !((d["銘柄名"]||"")+(d["鑑定評価(200字)"]||"")+(d["ソフィーの裏話"]||"")).toLowerCase().includes(scrState.keyword.toLowerCase())) return false;
        if(scrState.major && d["大分類"] !== scrState.major) return false;
        if(scrState.sub && d["中分類"] !== scrState.sub) return false;
        if(scrState.country && d["国"] !== scrState.country) return false;
        if(scrState.region && d["産地"] !== scrState.region) return false;
        if(scrState.isStandard === "1" && d["定番フラグ"] !== "1") return false;
        if(scrState.isSophieRecom === "1" && d["ソフィーの推し"] !== "1") return false;
        if(scrState.cospa) { const c = (d["Gemini_コスパ"]||"").split('☆').length - 1; if(parseInt(scrState.cospa) > c) return false; }
        const price = parseInt((d["市販価格"]||"0").replace(/[^0-9]/g, '')) || 0;
        if((scrState.pMin && price < scrState.pMin) || (scrState.pMax && price > scrState.pMax)) return false;
        const avg1 = (parseFloat(d["GPT_甘辛"])+parseFloat(d["Gemini_甘辛"])+parseFloat(d["Claude_甘辛"]))/3;
        if(avg1 < scrState.s1Min || avg1 > scrState.s1Max) return false;
        return true;
    });
    renderSearchResults(res);
}

function renderSearchResults(results, scrollToIdx = null) {
    nav.updateNav('lq_res', null, results);
    let h = `<div class='label'><button style='background:none;border:none;color:#fff;font-size:1.2rem;' id="btn-res-back">◀</button>検索結果: ${results.length}件</div>`;
    results.forEach(d => { h += `<div class='item' data-lqidx='${nav.liquorData.indexOf(d)}'>🥃 ${(d['銘柄名']||'').replace(/"/g,'')}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), results); }, true, 'result');
    document.getElementById('btn-res-back').onclick = openLiquorRoot;
    if(scrollToIdx !== null) setTimeout(() => { const t = document.querySelector(`[data-lqidx='${scrollToIdx}']`); if(t) t.scrollIntoView({ block: 'center' }); }, 50);
}

// --- 鑑定カード ---
function showLiquorCard(gIdx, list = null) {
    if(list) nav.updateNav("lq_card", nav.curG, list, gIdx);
    const d = nav.liquorData[gIdx];
    const getPos = (v) => { let n = parseFloat(v); if(isNaN(n)) return -1; return Math.min(100, Math.max(0, ((n + 2.0) / 4.0) * 100)); };
    const makeBar = (l, r, gpt, gem, cla, onlyC = false) => {
        let hg = `<div class="graph-row-inline"><div class="graph-label-inline">${l}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        if(!onlyC) {
            if(getPos(gpt)>=0) hg+=`<div class="graph-point pt-gpt" style="left:${getPos(gpt)}%"></div>`;
            if(getPos(gem)>=0) hg+=`<div class="graph-point pt-gemini" style="left:${getPos(gem)}%"></div>`;
        }
        if(getPos(cla)>=0) hg+=`<div class="graph-point pt-claude" style="left:${getPos(cla)}%"></div>`;
        return hg + `</div><div class="graph-label-inline">${r}</div></div>`;
    };

    let abv = d["度数"] || "-";
    if (parseFloat(abv) > 0 && parseFloat(abv) <= 1.0) abv = (parseFloat(abv) * 100).toFixed(0) + '%';

    // ★Noを左上に。矢印の色を入れ替え（大:青、中:赤）
    let h = `<div class="label">No.${d["No"]}</div><div class="lq-card">`;
    h += `<div class="lq-name">${d["銘柄名"]}</div><div class="lq-quote">${(d["ソフィーのセリフ"]||"").replace(/[「」『』"']/g,'')}</div>`;
    h += `<div class="lq-basic-info"><div><span style="color:var(--blue)">▶</span> ${d["大分類"]}　<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div><div><span style="color:#888">産地:</span> ${d["国"]} / ${d["産地"]}</div>`;
    if(d["公式URL"] && d["公式URL"]!=="-") h+=`<a href="${d["公式URL"]}" target="_blank" class="lq-btn-small">🔗 メーカーサイト</a>`;
    h += `</div><div class="lq-split-view"><div class="lq-graph-half">`;
    h += makeBar("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"]);
    h += makeBar("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
    h += makeBar("常道", "独特", "", "", d["Claude_個性"], true);
    const a4 = AXIS4_MAP[d["中分類"]] || AXIS4_DEFAULT;
    h += `<div style="font-size:0.65rem; color:var(--accent); text-align:center; margin-top:5px;">${a4.label}</div>`;
    h += makeBar(a4.left, a4.right, "", "", d["Claude_第4軸"], true);
    h += `<div style="font-size:0.6rem; color:#888; text-align:right; margin-top:8px;"><span style="color:#10a37f">●GPT</span> <span style="color:#1a73e8">●Gem</span> <span style="color:#d97757">●Claude</span></div></div>`;
    
    // ★価格色入れ替え（市販：オレンジ、Bar：白）
    h += `<div class="lq-specs-half">
            <div class="spec-row-compact"><span>知名度</span><span>${d["知名度"]}</span></div>
            <div class="spec-row-compact"><span>度数</span><span>${abv}</span></div>
            <div class="spec-row-compact"><span>市販</span><span class="price-retail">${d["市販価格"]}</span></div>
            <div class="spec-row-compact"><span>Bar</span><span>${d["バー価格"]}</span></div>
          </div></div>`;
    if(d["ソフィーの裏話"]) h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    h += `</div>`;

    render(h, () => {}, true, 'standard');
    const b = document.getElementById('ctrl-back');
    if(nav.curG === null) { b.innerText = '候補へ戻る'; b.style.background = '#d35400'; } else { b.innerText = 'リストへ'; }
}

// 共通描画
function render(h, cb, isFS = false, conMode = 'standard') { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; 
    document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item, .scr-tag-btn').forEach(el => el.onclick = cb);
    const ls = document.querySelector('.l-side'); if(ls) ls.style.display = isFS ? 'none' : 'block';
    renderConsole(conMode);
}

function handleBack() {
    if (nav.state === "lq_card") { if(nav.curG === null) renderSearchResults(nav.curP, nav.curI); else openLiquorList(nav.curP); }
    else if (nav.state === "lq_res") openScreeningUI(); 
    else if (nav.state === "lq_list") openLiquorSub(nav.curG);
    else if (nav.state === "lq_sub") openLiquorMajor();
    else if (nav.state === "lq_major" || nav.state === "lq_scr") openLiquorRoot();
    else showRootMenu();
}

function resetCtrlBack() { const b = document.getElementById('ctrl-back'); if(b){ b.innerText='▲'; b.style.background=''; } }

// --- ジャンル選択系 ---
function openLiquorMajor() {
    nav.updateNav("lq_major");
    let h = `<div class="label">ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]))].forEach(m => { h += `<div class="item" data-mj="${m}">📁 ${m}</div>`; });
    render(h, (e) => openLiquorSub(e.currentTarget.dataset.mj), false, 'standard');
}
function openLiquorSub(mj) {
    nav.updateNav("lq_sub", mj);
    let h = `<div class="label">${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]))].forEach(s => { h += `<div class="item" data-sb="${s}">📁 ${s}</div>`; });
    render(h, (e) => openLiquorList(e.currentTarget.dataset.sb), false, 'standard');
}
function openLiquorList(sb) {
    const list = nav.liquorData.filter(d => d["中分類"] === sb);
    nav.updateNav("lq_list", nav.curG, list);
    let h = `<div class="label">${sb} 一覧</div>`;
    list.forEach(d => { h += `<div class="item" data-lqidx="${nav.liquorData.indexOf(d)}">🥃 ${d["銘柄名"]}</div>`; });
    render(h, (e) => showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), list), false, 'standard');
}

// 他、音楽・お話等は既存通り
function openMusic() { nav.updateNav("art"); render('<div class="label">Music Request</div>', ()=>{}); }
function openTalk() { nav.updateNav("g"); render('<div class="label">Story Menu</div>', ()=>{}); }