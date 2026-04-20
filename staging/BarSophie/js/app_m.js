import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

// 第4軸定義データ（ Claude殿の全マッピングを内包 ）
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
    "ジン系カカクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "ラム系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "テキーラ系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "ブランデー系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "リキュール系カクテル": { label: "酸味", left: "無酸", right: "酸強" },
    "クラシックカクテル": { label: "酸味", left: "無酸", right: "酸強" }
};
const AXIS4_DEFAULT = { label: "第4軸(品目指定)", left: "←", right: "→", disabled: true };

// ★ スクリーニング条件記憶
let scrState = null;
function initScrState() {
    scrState = { major: "", sub: "", country: "", region: "", keyword: "", cospa: "", isStandard: "", isSophieRecom: "", pMin: "", pMax: "", aMin: "", aMax: "", s1Min: "-2.0", s1Max: "2.0", s2Min: "-2.0", s2Max: "2.0", s3Min: "-2.0", s3Max: "2.0", s4Min: "-2.0", s4Max: "2.0", tags: [] };
}

// ★ 安全な入力値保存（要素がないときは無視するように修正）
function saveScrFormState() {
    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : (scrState[id.replace('scr-','')] || "");
    };
    if(!document.getElementById('scr-mj')) return; 
    scrState.keyword = getVal('scr-kw');
    scrState.major = getVal('scr-mj');
    scrState.sub = getVal('scr-sb');
    scrState.country = getVal('scr-cn');
    scrState.region = getVal('scr-rg');
    scrState.cospa = getVal('scr-cospa');
    scrState.isStandard = getVal('scr-std');
    scrState.isSophieRecom = getVal('scr-sophie');
    scrState.pMin = getVal('scr-p-min');
    scrState.pMax = getVal('scr-p-max');
    scrState.aMin = getVal('scr-a-min');
    scrState.aMax = getVal('scr-a-max');
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
}

document.addEventListener('DOMContentLoaded', async () => {
    ytWrapper = document.getElementById('yt-wrapper'); img = document.getElementById('monitor-img');
    tel = document.getElementById('telop'); lv = document.getElementById('list-view'); nm = document.getElementById('nav-main');
    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }
    try { await nav.loadAllData(); } catch (e) { alert("Data Error: " + e.message); }
    initScrState(); setup();
});

// グローバル関数登録（HTMLのonclickから呼べるようにする）
window.openLiquorRoot = openLiquorRoot;
window.openScreeningUI = openScreeningUI;
window.openLiquorMajor = openLiquorMajor;
window.executeScreening = executeScreening;

function renderConsole(mode) {
    const grid = document.querySelector('.btn-grid'); if (!grid) return;
    if (mode === 'screening') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-clear" id="btn-c-clear">条件クリア</button><button class="console-scr-btn btn-c-exec" id="btn-c-exec">検索実行</button>`;
        document.getElementById('btn-c-clear').onclick = () => { initScrState(); openScreeningUI(); };
        document.getElementById('btn-c-exec').onclick = executeScreening;
    } else if (mode === 'result') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-mod" id="btn-c-mod">🔍 検索条件を変更する</button>`;
        document.getElementById('btn-c-mod').onclick = openScreeningUI;
    } else {
        grid.innerHTML = `<button class="c-btn" id="btn-expand">▼</button><button class="c-btn" id="ctrl-back">▲</button><button class="c-btn" id="ctrl-pause">⏹️</button><button class="c-btn" id="ctrl-play" style="flex: 1.5; font-size: 1.2rem;">▶</button><button class="c-btn" id="btn-next">⏭</button>`;
        document.getElementById('ctrl-play').onclick = playHead; document.getElementById('ctrl-pause').onclick = togglePause;
        document.getElementById('ctrl-back').onclick = handleBack; document.getElementById('btn-expand').onclick = handleExpand;
    }
    resetCtrlBack();
}

function handleExpand() {
    if (nav.state === "lq_card" || nav.state === "lq_scr") {
        const lSide = document.querySelector('.l-side');
        if (lSide) { lSide.style.display = 'block'; setTimeout(() => { if (nav.state === "lq_card" || nav.state === "lq_scr") lSide.style.display = 'none'; }, 4000); }
        window.speechSynthesis.cancel();
        talkAudio.src = "./voices_mp3/what_order.mp3"; talkAudio.play().catch(() => media.speak("何になさいますか？"));
        return;
    }
    const monitor = document.querySelector('.monitor'); monitor.classList.toggle('expanded');
    document.getElementById('btn-expand').innerText = monitor.classList.contains('expanded') ? '▲' : '▼';
}

function showRootMenu() { lv.style.display = 'none'; nm.style.display = 'block'; nav.updateNav("none"); ytWrapper.style.display = 'none'; img.src = './front_sophie.jpeg'; img.style.display = 'block'; tel.style.display = 'none'; renderConsole('standard'); }

function setup() {
    document.getElementById('btn-enter').onclick = () => { 
        document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
        talkAudio.src = "./voices_mp3/greeting.mp3"; talkAudio.play().catch(() => media.speak("いらっしゃいませ。"));
    };
    document.getElementById('btn-to-bar').onclick = () => { 
        document.getElementById('chat-mode').style.display='none'; document.getElementById('main-ui').style.display='flex'; 
        window.speechSynthesis.cancel(); showRootMenu();
        talkAudio.src = "./voices_mp3/menu_greeting.mp3"; talkAudio.play().catch(() => media.speak("今日はいかがされますか？"));
    };
    renderConsole('standard');
    document.getElementById('sophie-warp').onclick = () => { if(nav.state !== "none") showRootMenu(); };
    document.getElementById('btn-music').onclick = openMusic; document.getElementById('btn-talk').onclick = openTalk;
    document.getElementById('btn-liquor').onclick = openLiquorRoot;
}

function playHead() {
    if (nav.state === "lq_card") {
        const list = Array.isArray(nav.curP) ? nav.curP : [];
        if(list.length > 0) { let idx = (list.indexOf(nav.liquorData[nav.curI]) + 1) % list.length; showLiquorCard(nav.liquorData.indexOf(list[idx]), list); }
        return;
    }
}
function togglePause() { if(!isPaused) { talkAudio.pause(); isPaused = true; } else { talkAudio.play(); isPaused = false; } }

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

function attachMultiSlider(id) {
    const minEl = document.getElementById(id + '-min'), maxEl = document.getElementById(id + '-max'), fillEl = document.getElementById(id + '-fill');
    const up = () => {
        let v1 = parseFloat(minEl.value), v2 = parseFloat(maxEl.value);
        if (v1 > v2) { let t = v1; v1 = v2; v2 = t; minEl.value = v1; maxEl.value = v2; }
        const p1 = ((v1 + 2) / 4) * 100, p2 = ((v2 + 2) / 4) * 100;
        fillEl.style.left = p1 + '%'; fillEl.style.width = (p2 - p1) + '%';
        scrState[id.replace('scr-', '') + 'Min'] = v1.toFixed(1); scrState[id.replace('scr-', '') + 'Max'] = v2.toFixed(1);
    };
    if(minEl && maxEl) { minEl.addEventListener('input', up); maxEl.addEventListener('input', up); up(); }
}

function openScreeningUI() {
    nav.updateNav("lq_scr");
    let h = `<div class="label"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="window.openLiquorRoot()">◀</button> お好みでスクリーニング</div>`;
    h += `<div class="scr-container">`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]))];
    const majorOpts = `<option value="">問わない</option>` + majors.map(m => `<option value="${m}" ${scrState.major === m ? 'selected':''}>${m}</option>`).join('');
    let subs = scrState.major ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]))] : [];
    const subOpts = `<option value="">問わない</option>` + subs.map(s => `<option value="${s}" ${scrState.sub === s ? 'selected':''}>${s}</option>`).join('');
    const countries = [...new Set(nav.liquorData.filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub)).map(d => d["国"]))].filter(Boolean).sort();
    const regions = [...new Set(nav.liquorData.filter(d => (!scrState.country || d["国"] === scrState.country)).map(d => d["産地"]))].filter(Boolean).sort();
    const countryOpts = `<option value="">問わない</option>` + countries.map(c => `<option value="${c}" ${scrState.country === c ? 'selected':''}>${c}</option>`).join('');
    const regionOpts = `<option value="">問わない</option>` + regions.map(r => `<option value="${r}" ${scrState.region === r ? 'selected':''}>${r}</option>`).join('');
    h += `<div class="scr-group">
            <div class="scr-title">基本条件</div>
            <div class="scr-row"><span class="scr-row-label">ジャンル:</span><select id="scr-mj">${majorOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">品目:</span><select id="scr-sb">${subOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">国:</span><select id="scr-cn">${countryOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">地域:</span><select id="scr-rg">${regionOpts}</select></div>
            <div class="scr-row" style="margin-top:10px;"><span class="scr-row-label">検索:</span><input type="text" id="scr-kw" placeholder="銘柄・解説・タグ等" value="${scrState.keyword}"></div>
          </div>`;
    h += `<div class="scr-group">
            <div class="scr-row"><span class="scr-row-label">定番:</span><select id="scr-std"><option value="">問わない</option><option value="1" ${scrState.isStandard==='1'?'selected':''}>定番に絞る</option></select></div>
            <div class="scr-row"><span class="scr-row-label">推し:</span><select id="scr-sophie"><option value="">問わない</option><option value="1" ${scrState.isSophieRecom==='1'?'selected':''}>推しを聞く</option></select></div>
            <div class="scr-row"><span class="scr-row-label">ｺｽﾊﾟ:</span><select id="scr-cospa"><option value="">問わない</option><option value="1" ${scrState.cospa==='1'?'selected':''}>☆1以上</option><option value="2" ${scrState.cospa==='2'?'selected':''}>☆2以上</option><option value="3" ${scrState.cospa==='3'?'selected':''}>☆3のみ</option></select></div>
          </div>`;
    const makeDS = (id, l, r, minV, maxV, dis) => `<div class="scr-slider-box" style="opacity:${dis?0.4:1}; pointer-events:${dis?'none':'auto'};"><div class="scr-slider-label-edge">${l}</div><div class="multi-range-wrap"><div class="multi-range-track"></div><div class="slider-ticks"><div class="tick"></div><div class="tick"></div><div class="tick center"></div><div class="tick"></div><div class="tick"></div></div><div class="multi-range-fill" id="${id}-fill"></div><input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${minV}"><input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${maxV}"></div><div class="scr-slider-label-edge">${r}</div></div>`;
    h += `<div class="scr-group">`;
    h += makeDS("scr-s1", "辛口", "甘口", scrState.s1Min, scrState.s1Max, false);
    h += makeDS("scr-s2", "軽快", "濃厚", scrState.s2Min, scrState.s2Max, false);
    h += makeDS("scr-s3", "常道", "独特", scrState.s3Min, scrState.s3Max, false);
    const axis4 = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    h += makeDS("scr-s4", axis4.left, axis4.right, scrState.s4Min, scrState.s4Max, !scrState.sub);
    h += `</div>`;
    const pVals = ["", 1000, 2000, 3000, 4000, 5000, 7000, 10000, 20000, 30000, 50000];
    const pOpts = pVals.map(v => `<option value="${v}">${v===""?"問わない":v.toLocaleString()+"円"}</option>`).join('');
    const aVals = ["", 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const aOpts = aVals.map(v => `<option value="${v}">${v===""?"問わない":v+"%"}</option>`).join('');
    h += `<div class="scr-group">
            <div class="scr-row"><span class="scr-row-label">価格:</span><select id="scr-p-min">${pOpts.replace('value="'+scrState.pMin+'"', 'value="'+scrState.pMin+'" selected')}</select> 〜 <select id="scr-p-max">${pOpts.replace('value="'+scrState.pMax+'"', 'value="'+scrState.pMax+'" selected')}</select></div>
            <div class="scr-row"><span class="scr-row-label">度数:</span><select id="scr-a-min">${aOpts.replace('value="'+scrState.aMin+'"', 'value="'+scrState.aMin+'" selected')}</select> 〜 <select id="scr-a-max">${aOpts.replace('value="'+scrState.aMax+'"', 'value="'+scrState.aMax+'" selected')}</select></div>
          </div>`;
    render(h, (e) => { if(e.currentTarget.classList.contains('scr-tag-btn')) e.currentTarget.classList.toggle('selected'); }, true, 'screening');
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
    nav.updateNav('lq_res', null, results); // 検索モードとして保存 [cite: 16]
    let h = `<div class='label'><button style='background:none;border:none;color:#fff;font-size:1.2rem;' id="btn-res-back">◀</button>検索結果: ${results.length}件</div>`;
    h += `<button class="btn-back-scr" onclick="window.openScreeningUI()">🔍 検索条件を変更する</button>`;
    results.forEach(d => { h += `<div class='item' data-lqidx='${nav.liquorData.indexOf(d)}'>🥃 ${d['銘柄名']}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), results); }, true, 'result');
    document.getElementById('btn-res-back').onclick = openLiquorRoot;
    if(scrollToIdx !== null) setTimeout(() => { const t = document.querySelector(`[data-lqidx='${scrollToIdx}']`); if(t) t.scrollIntoView({ block: 'center' }); }, 50);
}

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
    let abv = d["度数"] || "-"; if (parseFloat(abv) > 0 && parseFloat(abv) <= 1.0) abv = (parseFloat(abv) * 100).toFixed(0) + '%';

    // ★Noを左上に。矢印の色入れ替え（大：青、中：赤）
    let h = `<div class="label">No.${d["No"]}</div><div class="lq-card">`;
    h += `<div class="lq-name">${d["銘柄名"]}</div><div class="lq-quote">${(d["ソフィーのセリフ"]||"").replace(/[「」『』"']/g,'')}</div>`;
    h += `<div class="lq-basic-info"><div><span style="color:var(--blue)">▶</span> ${d["大分類"]}　<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div><div><span style="color:#888">産地:</span> ${d["国"]} / ${d["産地"]}</div>`;
    if(d["公式URL"] && d["公式URL"]!=="-") h+=`<a href="${d["公式URL"]}" target="_blank" class="lq-btn-small">🔗 メーカーサイト</a>`;
    h += `</div><div class="lq-split-view"><div class="lq-graph-half">`;
    if(d["Gemini_コスパ"]) h += `<div class="lq-cospa"><span>コスパ</span> ${d["Gemini_コスパ"]}</div>`;
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

function render(h, cb, isFS = false, conMode = 'standard') { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; document.getElementById('main-scroll').scrollTop = 0; 
    document.querySelectorAll('#list-view .item, .scr-tag-btn').forEach(el => el.onclick = cb);
    const ls = document.querySelector('.l-side'); if(ls) ls.style.display = isFS ? 'none' : 'block';
    renderConsole(conMode);
}

function handleBack() {
    if (nav.state === "lq_card") { 
        if(nav.curG === null && Array.isArray(nav.curP)) renderSearchResults(nav.curP, nav.curI); 
        else openLiquorList(nav.curP); 
    }
    else if (nav.state === "lq_res") openScreeningUI(); 
    else if (nav.state === "lq_list") openLiquorSub(nav.curG);
    else if (nav.state === "lq_sub") openLiquorMajor();
    else if (nav.state === "lq_major" || nav.state === "lq_scr") openLiquorRoot();
    else showRootMenu();
}

function resetCtrlBack() { const b = document.getElementById('ctrl-back'); if(b){ b.innerText='▲'; b.style.background=''; b.style.color=''; } }

function openLiquorMajor() {
    nav.updateNav("lq_major"); let h = `<div class="label">ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]))].forEach(m => { h += `<div class="item" data-mj="${m}">📁 ${m}</div>`; });
    render(h, (e) => openLiquorSub(e.currentTarget.dataset.mj));
}
function openLiquorSub(mj) {
    nav.updateNav("lq_sub", mj); let h = `<div class="label">${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]))].forEach(s => { h += `<div class="item" data-sb="${s}">📁 ${s}</div>`; });
    render(h, (e) => openLiquorList(e.currentTarget.dataset.sb));
}
function openLiquorList(sb) {
    let list = Array.isArray(sb) ? sb : nav.liquorData.filter(d => d["中分類"] === sb);
    let title = Array.isArray(sb) ? list[0]["中分類"] : sb;
    nav.updateNav("lq_list", nav.curG, list);
    let h = `<div class="label">${title} 一覧</div>`;
    list.forEach(d => { h += `<div class="item" data-lqidx="${nav.liquorData.indexOf(d)}">🥃 ${d["銘柄名"]}</div>`; });
    render(h, (e) => showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), list));
}

function openMusic() { nav.updateNav("art"); render('<div class="label">Music Request</div>', ()=>{}); }
function openTalk() { nav.updateNav("g"); render('<div class="label">Story Menu</div>', ()=>{}); }