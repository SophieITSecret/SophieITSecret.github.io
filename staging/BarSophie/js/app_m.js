import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, talkAudio;

// ★第4軸評価基準（完全版）
const AXIS4_MAP = {
    "スコッチ・シングルモルト": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "スコッチ・ブレンデッド": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "アイリッシュウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "カナディアンウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "ジャパニーズウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "バーボン": { label: "樽熟成感", left: "フレッシュ", right: "深熟" },
    "赤ワイン": { label: "タンニン", left: "柔渋", right: "強渋" },
    "白ワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "ロゼワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "シャンパン": { label: "辛口度", left: "甘口", right: "辛口" },
    "純米大吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "芋焼酎": { label: "芋の素材感", left: "淡芋", right: "強芋" },
    "麦焼酎": { label: "麦の素材感", left: "淡麦", right: "強麦" },
    "米焼酎": { label: "米の素材感", left: "淡米", right: "強米" },
    "泡盛": { label: "古酒感", left: "若酒", right: "古酒" },
    "ジン（銘柄）": { label: "ボタニカル感", left: "淡草", right: "強草" },
    "ウォッカ（銘柄）": { label: "クリーン度", left: "個性", right: "純粋" },
    "ビール": { label: "苦味", left: "無苦", right: "苦強" },
    "梅酒": { label: "梅の酸味", left: "まろやか", right: "酸鮮烈" }
};
const AXIS4_DEFAULT = { label: "第4軸", left: "←", right: "→", disabled: true };

let scrState = { major: "", sub: "", country: "", region: "", keyword: "", cospa: "", isStandard: "", isSophieRecom: "", s1Min: -2.0, s1Max: 2.0, s2Min: -2.0, s2Max: 2.0, s3Min: -2.0, s3Max: 2.0, s4Min: -2.0, s4Max: 2.0 };

document.addEventListener('DOMContentLoaded', async () => {
    talkAudio = document.createElement('audio');
    document.body.appendChild(talkAudio);
    try { await nav.loadAllData(); } catch (e) { alert("Data Load Error"); }
    setup();
});

// ★ 関数をグローバル(window)に登録
window.openLiquorRoot = openLiquorRoot;
window.openScreeningUI = openScreeningUI;
window.executeScreening = executeScreening;
window.refreshScr = () => { saveForm(); openScreeningUI(); };

function setup() {
    document.getElementById('btn-enter').onclick = () => { 
        document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; 
        playVoice("./voices_mp3/greeting.mp3", "いらっしゃいませ。");
    };
    document.getElementById('btn-to-bar').onclick = () => { 
        document.getElementById('chat-mode').style.display='none'; document.getElementById('main-ui').style.display='flex'; 
        showRootMenu(); playVoice("./voices_mp3/menu_greeting.mp3", "今日はいかがされますか？");
    };
    document.getElementById('btn-liquor').onclick = openLiquorRoot;
    document.getElementById('sophie-warp').onclick = () => { if(nav.state !== "none") showRootMenu(); };
    renderConsole('standard');
}

function playVoice(src, txt) { talkAudio.src = src; talkAudio.play().catch(() => media.speak(txt)); }

function renderConsole(mode) {
    const grid = document.getElementById('console-grid');
    if (mode === 'screening') {
        grid.innerHTML = `<button class="console-scr-btn" id="c-clr">条件クリア</button><button class="console-scr-btn btn-c-exec" id="c-ex">検索実行</button>`;
        document.getElementById('c-clr').onclick = () => { scrState = { major: "", sub: "", country: "", region: "", keyword: "", cospa: "", isStandard: "", isSophieRecom: "", s1Min: -2.0, s1Max: 2.0, s2Min: -2.0, s2Max: 2.0, s3Min: -2.0, s3Max: 2.0, s4Min: -2.0, s4Max: 2.0 }; openScreeningUI(); };
        document.getElementById('c-ex').onclick = executeScreening;
    } else if (mode === 'result') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-mod" id="c-mod">🔍 検索条件を変更する</button>`;
        document.getElementById('c-mod').onclick = openScreeningUI;
    } else {
        grid.innerHTML = `<button class="c-btn" id="c-exp">▼</button><button class="c-btn" id="c-back">▲</button><button class="c-btn">⏹️</button><button class="c-btn" id="c-next" style="flex:1.5">▶</button><button class="c-btn">⏭</button>`;
        document.getElementById('c-back').onclick = handleBack;
        document.getElementById('c-exp').onclick = () => { 
            const ls = document.querySelector('.l-side'); ls.style.display='block'; 
            setTimeout(() => { if(nav.state.includes('lq')) ls.style.display='none'; }, 4000);
            playVoice("./voices_mp3/what_order.mp3", "何になさいますか？");
        };
        document.getElementById('c-next').onclick = () => {
            if(nav.state === "lq_card") {
                let list = nav.curP; let idx = (list.indexOf(nav.liquorData[nav.curI]) + 1) % list.length;
                showLiquorCard(nav.liquorData.indexOf(list[idx]), list);
            }
        };
    }
}

function showRootMenu() {
    document.getElementById('list-view').style.display='none'; document.getElementById('nav-main').style.display='block';
    nav.updateNav("none"); document.getElementById('monitor-img').src='./front_sophie.jpeg'; renderConsole('standard');
}

function openLiquorRoot() {
    nav.updateNav("lq_root");
    let h = `<div class="label" style="justify-content:center;">お酒を選ぶ</div>`;
    h += `<button class="act-btn" onclick="window.openLiquorMajor()" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>`;
    h += `<button class="act-btn" onclick="window.openScreeningUI()" style="background:#d35400; margin:0 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>`;
    h += `<div class="direct-box-new"><div class="direct-lbl">No.検索</div><input type="number" id="dir-num"><button id="dir-go">開く</button></div>`;
    render(h);
    document.getElementById('dir-go').onclick = () => { const v = document.getElementById('dir-num').value; const t = nav.liquorData.find(d => d["No"] == v); if(t) showLiquorCard(nav.liquorData.indexOf(t), nav.liquorData); };
}

function openScreeningUI() {
    nav.updateNav("lq_scr");
    let h = `<div class="label" onclick="window.openLiquorRoot()">◀ お好みでスクリーニング</div><div class="scr-container">`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]))];
    const subs = scrState.major ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]))] : [];
    const countries = [...new Set(nav.liquorData.filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub)).map(d => d["国"]))].filter(Boolean).sort();
    const regions = [...new Set(nav.liquorData.filter(d => (!scrState.country || d["国"] === scrState.country)).map(d => d["産地"]))].filter(Boolean).sort();

    h += `<div class="scr-group">
        <div class="scr-row"><span class="scr-row-label">ジャンル:</span><select id="s-mj" onchange="window.refreshScr()"><option value="">問わない</option>${majors.map(m=>`<option value="${m}" ${scrState.major===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">品目:</span><select id="s-sb" onchange="window.refreshScr()"><option value="">問わない</option>${subs.map(s=>`<option value="${s}" ${scrState.sub===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">国:</span><select id="s-cn" onchange="window.refreshScr()"><option value="">問わない</option>${countries.map(c=>`<option value="${c}" ${scrState.country===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">地域:</span><select id="s-rg"><option value="">問わない</option>${regions.map(r=>`<option value="${r}" ${scrState.region===r?'selected':''}>${r}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">検索:</span><input type="text" id="s-kw" value="${scrState.keyword}" placeholder="文字で検索"></div>
    </div>`;

    h += `<div class="scr-group">
        <div class="scr-row"><span class="scr-row-label">定番:</span><select id="s-std"><option value="">問わない</option><option value="1" ${scrState.isStandard==='1'?'selected':''}>定番に絞る</option></select></div>
        <div class="scr-row"><span class="scr-row-label">推し:</span><select id="s-sop"><option value="">問わない</option><option value="1" ${scrState.isSophieRecom==='1'?'selected':''}>推しを聞く</option></select></div>
    </div>`;

    const mkS = (id, l, r, min, max, dis) => `<div class="scr-slider-box" style="opacity:${dis?0.4:1}"><div class="scr-slider-label-edge">${l}</div><div class="multi-range-wrap"><div class="multi-range-track"></div><div class="slider-ticks"><div class="tick"></div><div class="tick"></div><div class="tick center"></div><div class="tick"></div><div class="tick"></div></div><div class="multi-range-fill" id="${id}-fill"></div><input type="range" id="${id}-min" min="-2" max="2" step="0.5" value="${min}"><input type="range" id="${id}-max" min="-2" max="2" step="0.5" value="${max}"></div><div class="scr-slider-label-edge">${r}</div></div>`;
    h += `<div class="scr-group">`;
    h += mkS('s1','辛口','甘口',scrState.s1Min,scrState.s1Max,false);
    h += mkS('s2','軽快','濃厚',scrState.s2Min,scrState.s2Max,false);
    h += mkS('s3','常道','独特',scrState.s3Min,scrState.s3Max,false);
    const a4 = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    h += mkS('s4', a4.left, a4.right, scrState.s4Min, scrState.s4Max, !scrState.sub);
    h += `</div></div>`;
    
    render(h, 'screening', true);
    ['s1','s2','s3','s4'].forEach(id => {
        const min = document.getElementById(id+'-min'), max = document.getElementById(id+'-max'), fill = document.getElementById(id+'-fill');
        const up = (e) => {
            let v1 = parseFloat(min.value), v2 = parseFloat(max.value);
            if(v1 > v2){ if(e && e.target===min) v1=v2; else v2=v1; min.value=v1; max.value=v2; }
            if(e) e.target.style.zIndex = 10;
            fill.style.left = ((v1+2)/4*100)+'%'; fill.style.width = ((v2-v1)/4*100)+'%';
            scrState[id+'Min']=v1; scrState[id+'Max']=v2;
        };
        min.oninput = up; max.oninput = up; up();
    });
}

function executeScreening() {
    saveForm();
    const res = nav.liquorData.filter(d => {
        if(scrState.major && d["大分類"] !== scrState.major) return false;
        if(scrState.sub && d["中分類"] !== scrState.sub) return false;
        if(scrState.country && d["国"] !== scrState.country) return false;
        if(scrState.isStandard === "1" && d["定番フラグ"] !== "1") return false;
        if(scrState.isSophieRecom === "1" && d["ソフィーの推し"] !== "1") return false;
        const avg1 = (parseFloat(d["GPT_甘辛"])+parseFloat(d["Gemini_甘辛"])+parseFloat(d["Claude_甘辛"]))/3;
        if(avg1 < scrState.s1Min || avg1 > scrState.s1Max) return false;
        return true;
    });
    renderResults(res);
}

function renderResults(results, scrollIdx = null) {
    nav.updateNav('lq_res', null, results);
    let h = `<div class='label' onclick="window.openLiquorRoot()">◀ 検索結果: ${results.length}件</div>`;
    h += `<button class="btn-back-scr" onclick="window.openScreeningUI()">🔍 検索条件を変更する</button>`;
    results.forEach((d, i) => { h += `<div class='item' data-idx='${i}'>🥃 ${d['銘柄名']}</div>`; });
    render(h, 'result', true);
    document.querySelectorAll('#list-view .item').forEach(el => { el.onclick = () => showLiquorCard(nav.liquorData.indexOf(results[el.dataset.idx]), results); });
    if(scrollIdx !== null) setTimeout(() => { const t = document.querySelector(`[data-idx='${scrollIdx}']`); if(t) t.scrollIntoView({ block: 'center' }); }, 50);
}

function showLiquorCard(gIdx, list) {
    nav.updateNav("lq_card", null, list, gIdx);
    const d = nav.liquorData[gIdx];
    const getP = (v) => { let n = parseFloat(v); if(isNaN(n)) return -1; return Math.min(100, Math.max(0, ((n + 2) / 4) * 100)); };
    const mkBar = (l, r, g, m, c, onlyC = false) => {
        let hg = `<div class="graph-row-inline"><div class="graph-label-inline">${l}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        if(!onlyC) { if(getP(g)>=0) hg+=`<div class="graph-point pt-gpt" style="left:${getP(g)}%"></div>`; if(getP(m)>=0) hg+=`<div class="graph-point pt-gemini" style="left:${getP(m)}%"></div>`; }
        if(getP(c)>=0) hg+=`<div class="graph-point pt-claude" style="left:${getP(c)}%"></div>`;
        return hg + `</div><div class="graph-label-inline">${r}</div></div>`;
    };

    let h = `<div class="label">No.${d["No"]}</div><div class="lq-card">`;
    h += `<div class="lq-name">${d["銘柄名"]}</div><div class="lq-quote">${(d["ソフィーのセリフ"]||"").replace(/[「」『』"']/g,'')}</div>`;
    h += `<div class="lq-basic-info"><div><span style="color:var(--blue)">▶</span> ${d["大分類"]}　<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div><div><span style="color:#888">産地:</span> ${d["国"]} / ${d["産地"]}</div></div>`;
    h += `<div class="lq-split-view"><div class="lq-graph-half">`;
    h += mkBar("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"]);
    h += mkBar("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
    h += mkBar("常道", "独特", "", "", d["Claude_個性"], true);
    const a4 = AXIS4_MAP[d["中分類"]] || AXIS4_DEFAULT;
    h += `<div style="font-size:0.6rem; color:var(--accent); text-align:center;">${a4.label}</div>${mkBar(a4.left, a4.right, "", "", d["Claude_第4軸"], true)}`;
    h += `</div><div class="lq-specs-half"><div class="spec-row-compact"><span>市販</span><span class="price-retail">${d["市販価格"]}</span></div><div class="spec-row-compact"><span>Bar</span><span class="price-bar">${d["バー価格"]}</span></div></div></div>`;
    if(d["ソフィーの裏話"]) h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    h += `</div>`;
    render(h, 'standard', true);
    const b = document.getElementById('c-back');
    if(nav.curG === null) { b.innerText = '候補へ戻る'; b.style.background = '#d35400'; }
}

function render(h, mode = 'standard', isFS = false) {
    nm.style.display='none'; lv.style.display='block'; lv.innerHTML=h;
    const ls = document.querySelector('.l-side'); ls.style.display = isFS ? 'none' : 'block';
    renderConsole(mode);
}

function handleBack() {
    if (nav.state === "lq_card") { if(nav.curG === null) renderResults(nav.curP, nav.curI); else showRootMenu(); }
    else if (nav.state === "lq_res") openScreeningUI();
    else openLiquorRoot();
}

function saveForm() {
    if(!document.getElementById('s-mj')) return;
    scrState.major = document.getElementById('s-mj').value;
    scrState.sub = document.getElementById('s-sb').value;
    scrState.country = document.getElementById('s-cn').value;
    scrState.region = document.getElementById('s-rg').value;
    scrState.keyword = document.getElementById('s-kw').value;
    scrState.isStandard = document.getElementById('s-std').value;
    scrState.isSophieRecom = document.getElementById('s-sop').value;
}

function openLiquorMajor() {
    nav.updateNav("lq_major");
    let h = `<div class="label">ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]))].forEach(m => { h += `<div class="item" data-mj="${m}">📁 ${m}</div>`; });
    render(h);
    document.querySelectorAll('#list-view .item').forEach(el => { el.onclick = () => openLiquorSub(el.dataset.mj); });
}

function openLiquorSub(mj) {
    nav.updateNav("lq_sub", mj);
    let h = `<div class="label">${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]))].forEach(s => { h += `<div class="item" data-sb="${s}">📁 ${s}</div>`; });
    render(h);
    document.querySelectorAll('#list-view .item').forEach(el => { el.onclick = () => {
        const list = nav.liquorData.filter(d => d["中分類"] === el.dataset.sb);
        nav.updateNav("lq_list", null, list);
        let h2 = `<div class="label">${el.dataset.sb}</div>`;
        list.forEach((d, i) => { h2 += `<div class="item" data-idx="${i}">🥃 ${d["銘柄名"]}</div>`; });
        render(h2);
        document.querySelectorAll('#list-view .item').forEach(e2 => { e2.onclick = () => showLiquorCard(nav.liquorData.indexOf(list[e2.dataset.idx]), list); });
    }; });
}

function openMusic() { alert("Music selected"); }
function openTalk() { alert("Talk selected"); }