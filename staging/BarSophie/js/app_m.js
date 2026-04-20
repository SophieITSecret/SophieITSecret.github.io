import * as media from './media.js';
import * as nav from './navigation.js';

// --- 第4軸・詳細定義マッピング（ご提示の基準を完全反映） ---
const AXIS4_MAP = {
    "スコッチ・シングルモルト": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "スコッチ・ブレンデッド": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "アイリッシュウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "カナディアンウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "ジャパニーズウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "ライウイスキー": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "バーボン": { label: "樽熟成感", left: "フレッシュ", right: "深熟" },
    "テネシーウイスキー": { label: "樽熟成感", left: "フレッシュ", right: "深熟" },
    "コニャック": { label: "樽熟成感", left: "フレッシュ", right: "深熟" },
    "アルマニャック": { label: "樽熟成感", left: "フレッシュ", right: "深熟" },
    "赤ワイン": { label: "タンニン", left: "なめらか", right: "力強い渋" },
    "白ワイン": { label: "酸味", left: "丸く", right: "シャープ" },
    "ロゼワイン": { label: "酸味", left: "丸く", right: "シャープ" },
    "シャンパン": { label: "辛口度", left: "甘泡", right: "辛泡" },
    "プロセッコ・フランチャコルタ": { label: "辛口度", left: "甘泡", right: "辛泡" },
    "純米大吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "純米吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "特別純米・純米": { label: "旨味", left: "淡麗", right: "濃醇" },
    "芋焼酎": { label: "芋の素材感", left: "クリーン", right: "素材前面" },
    "麦焼酎": { label: "麦の素材感", left: "クリーン", right: "香ばしい" },
    "米焼酎": { label: "米の素材感", left: "クリーン", right: "米の甘み" },
    "黒糖焼酎": { label: "黒糖感", left: "あっさり", right: "深み強い" },
    "泡盛": { label: "古酒感", left: "若い", right: "深み" },
    "ジン（銘柄）": { label: "ボタニカル感", left: "クリーン", right: "複雑個性" },
    "ウォッカ（銘柄）": { label: "クリーン度", left: "個性あり", right: "純粋" },
    "テキーラ（銘柄）": { label: "アガベ感", left: "弱い", right: "強く主張" },
    "ラム（銘柄）": { label: "糖蜜・樽感", left: "ライト", right: "濃厚" },
    "クラフトビール": { label: "苦味", left: "苦みなし", right: "苦味強" },
    "梅酒": { label: "梅の酸味", left: "まろやか", right: "酸鮮烈" }
};
const AXIS4_DEFAULT = { label: "第4軸", left: "←", right: "→", disabled: true };

let scrState = { major: "", sub: "", country: "", region: "", keyword: "", cospa: "", isStandard: "", isSophieRecom: "", s1Min: -2.0, s1Max: 2.0, s2Min: -2.0, s2Max: 2.0, s3Min: -2.0, s3Max: 2.0, s4Min: -2.0, s4Max: 2.0, tags: [] };
let talkAudio;
const lv = document.getElementById('list-view'), nm = document.getElementById('nav-main');

document.addEventListener('DOMContentLoaded', async () => {
    talkAudio = document.createElement('audio'); document.body.appendChild(talkAudio);
    try { await nav.loadAllData(); } catch (e) { alert("Data Error"); }
    setup();
});

// window登録
window.openLiquorPortal = openLiquorPortal;
window.openScreening = openScreening;
window.executeScr = executeScr;
window.refreshScr = () => { saveForm(); openScreening(); };
window.openMajor = openMajor;

function setup() {
    document.getElementById('btn-enter').onclick = () => { document.getElementById('entry-screen').style.display='none'; document.getElementById('chat-mode').style.display='flex'; playV("./voices_mp3/greeting.mp3", "いらっしゃいませ。"); };
    document.getElementById('btn-to-bar').onclick = () => { document.getElementById('chat-mode').style.display='none'; document.getElementById('main-ui').style.display='flex'; showRoot(); playV("./voices_mp3/menu_greeting.mp3", "今日はいかがされますか？"); };
    document.getElementById('btn-liquor').onclick = () => openLiquorPortal();
    document.getElementById('sophie-warp').onclick = () => { if(nav.state !== "none") showRoot(); };
    renderConsole('standard');
}

function playV(src, txt) { talkAudio.src = src; talkAudio.play().catch(() => media.speak(txt)); }
function showRoot() { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); document.getElementById('monitor-img').src='./front_sophie.jpeg'; renderConsole('standard'); }

function openLiquorPortal() {
    nav.updateNav("lq_root");
    let h = `<div class="label" style="justify-content:center;">お酒を選ぶ</div>`;
    h += `<button class="act-btn" onclick="window.openMajor()" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>`;
    h += `<button class="act-btn" onclick="window.openScreening()" style="background:#d35400; margin:0 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>`;
    h += `<div class="direct-box-new"><div class="direct-lbl">No.検索</div><input type="number" id="dir-num"><button id="dir-go">開く</button></div>`;
    render(h);
    document.getElementById('dir-go').onclick = () => { const v = document.getElementById('dir-num').value; const t = nav.liquorData.find(d => d["No"] == v); if(t) showCard(nav.liquorData.indexOf(t), nav.liquorData); };
}

function openScreening() {
    nav.updateNav("lq_scr");
    let h = `<div class="label" onclick="window.openLiquorPortal()">◀ お好みでスクリーニング</div><div class="scr-container">`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]))];
    const subs = scrState.major ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]))] : [];
    const countries = [...new Set(nav.liquorData.filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub)).map(d => d["国"]))].filter(Boolean).sort();
    const regions = [...new Set(nav.liquorData.filter(d => (!scrState.country || d["国"] === scrState.country)).map(d => d["産地"]))].filter(Boolean).sort();

    h += `<div class="scr-group">
        <div class="scr-row"><span class="scr-row-label">ジャンル:</span><select id="s-mj" onchange="window.refreshScr()"><option value="">問わない</option>${majors.map(m=>`<option value="${m}" ${scrState.major===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">品目:</span><select id="s-sb" onchange="window.refreshScr()"><option value="">問わない</option>${subs.map(s=>`<option value="${s}" ${scrState.sub===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">国:</span><select id="s-cn" onchange="window.refreshScr()"><option value="">問わない</option>${countries.map(c=>`<option value="${c}" ${scrState.country===c?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">地域:</span><select id="s-rg"><option value="">問わない</option>${regions.map(r=>`<option value="${r}" ${scrState.region===r?'selected':''}>${r}</option>`).join('')}</select></div>
        <div class="scr-row"><span class="scr-row-label">検索:</span><input type="text" id="s-kw" value="${scrState.keyword}" placeholder="名称・タグなど"></div>
    </div>`;

    h += `<div class="scr-group">
        <div class="scr-row"><span class="scr-row-label">定番:</span><select id="s-std"><option value="">問わない</option><option value="1" ${scrState.isStandard==='1'?'selected':''}>定番に絞る</option></select></div>
        <div class="scr-row"><span class="scr-row-label">推し:</span><select id="s-sop"><option value="">問わない</option><option value="1" ${scrState.isSophieRecom==='1'?'selected':''}>推しを聞く</option></select></div>
        <div class="scr-row"><span class="scr-row-label">ｺｽﾊﾟ:</span><select id="s-cospa"><option value="">問わない</option><option value="1" ${scrState.cospa==='1'?'selected':''}>☆1以上</option><option value="2" ${scrState.cospa==='2'?'selected':''}>☆2以上</option><option value="3" ${scrState.cospa==='3'?'selected':''}>☆3のみ</option></select></div>
    </div>`;

    const mkS = (id, l, r, min, max, dis) => `<div class="scr-slider-box" style="opacity:${dis?0.4:1}"><div class="scr-slider-label-edge">${l}</div><div class="multi-range-wrap"><div class="multi-range-track"></div><div class="multi-range-fill" id="${id}-fill"></div><input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${min}"><input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${max}"></div><div class="scr-slider-label-edge">${r}</div></div>`;
    h += `<div class="scr-group"><div class="scr-title">味わい指定</div>`;
    h += mkS('s1','辛口','甘口',scrState.s1Min,scrState.s1Max,false);
    h += mkS('s2','軽快','濃厚',scrState.s2Min,scrState.s2Max,false);
    h += mkS('s3','常道','独特',scrState.s3Min,scrState.s3Max,false);
    const a4 = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    h += mkS('s4', a4.left, a4.right, scrState.s4Min, scrState.s4Max, !scrState.sub);
    h += `</div>`;

    let allT = new Set();
    nav.liquorData.forEach(d => { ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',').forEach(t => { if(t.trim()) allT.add(t.trim()); }); });
    h += `<div class="scr-group"><div class="scr-title">タグ選択</div><div class="scr-tag-grid">`;
    Array.from(allT).sort().forEach(t => { h += `<div class="scr-tag-btn ${scrState.tags.includes(t)?'selected':''}" data-tag="${t}">${t}</div>`; });
    h += `</div></div></div>`;
    
    render(h, 'screening', true);
    ['s1','s2','s3','s4'].forEach(id => attachSlider(id));
}

function attachSlider(id) {
    const min = document.getElementById(id+'-min'), max = document.getElementById(id+'-max'), fill = document.getElementById(id+'-fill');
    if(!min) return;
    const up = (e) => {
        let v1 = parseFloat(min.value), v2 = parseFloat(max.value);
        if(v1 > v2){ if(e && e.target===min) v1=v2; else v2=v1; min.value=v1; max.value=v2; }
        if(e) e.target.style.zIndex = 10;
        fill.style.left = ((v1+2)/4*100)+'%'; fill.style.width = ((v2-v1)/4*100)+'%';
        scrState[id+'Min']=v1; scrState[id+'Max']=v2;
    };
    min.oninput = up; max.oninput = up; up();
}

function executeScr() {
    saveForm();
    const res = nav.liquorData.filter(d => {
        if(scrState.major && d["大分類"] !== scrState.major) return false;
        if(scrState.sub && d["中分類"] !== scrState.sub) return false;
        if(scrState.country && d["国"] !== scrState.country) return false;
        if(scrState.region && d["産地"] !== scrState.region) return false;
        if(scrState.isStandard === "1" && d["定番フラグ"] !== "1") return false;
        if(scrState.isSophieRecom === "1" && d["ソフィーの推し"] !== "1") return false;
        if(scrState.cospa) { const c = (d["Gemini_コスパ"]||"").split('☆').length - 1; if(parseInt(scrState.cospa) > c) return false; }
        if(scrState.tags.length > 0 && !scrState.tags.every(t => ((d["味わいタグ"]||"")+(d["検索タグ"]||"")).includes(t))) return false;
        const avg1 = (parseFloat(d["GPT_甘辛"])+parseFloat(d["Gemini_甘辛"])+parseFloat(d["Claude_甘辛"]))/3;
        if(avg1 < scrState.s1Min || avg1 > scrState.s1Max) return false;
        if(scrState.keyword && !d["銘柄名"].includes(scrState.keyword)) return false;
        return true;
    });
    renderResults(res);
}

function renderResults(results, scrollIdx = null) {
    nav.updateNav('lq_res', null, results);
    let h = `<div class='label' onclick="window.openLiquorPortal()">◀ 検索結果: ${results.length}件</div>`;
    h += `<button class="btn-back-scr" onclick="window.openScreening()">🔍 検索条件を変更する</button>`;
    results.forEach((d, i) => { h += `<div class='item' data-idx='${i}'>🥃 ${d['銘柄名']}</div>`; });
    render(h, 'result', true);
    document.querySelectorAll('#list-view .item').forEach(el => { el.onclick = () => showCard(nav.liquorData.indexOf(results[el.dataset.idx]), results); });
    if(scrollIdx !== null) setTimeout(() => { const t = document.querySelector(`[data-idx='${scrollIdx}']`); if(t) t.scrollIntoView({ block: 'center' }); }, 50);
}

function showCard(gIdx, list) {
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
    h += `<div class="lq-basic-info"><div><span style="color:var(--blue)">▶</span> ${d["大分類"]}　<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div><div><span style="color:#888">産地:</span> ${d["国"]} / ${d["産地"]}</div>`;
    if(d["製造元と創業年"] && d["製造元と創業年"] !== "-") h += `<div><span style="color:#888">製造:</span> ${d["製造元と創業年"]}</div>`;
    if(d["公式URL"] && d["公式URL"]!=="-") h+=`<a href="${d["公式URL"]}" target="_blank" class="lq-btn-small">🔗 メーカーサイト</a>`;
    h += `</div><div class="lq-split-view"><div class="lq-graph-half">`;
    if(d["Gemini_コスパ"]) h += `<div class="lq-cospa"><span>コスパ</span> ${d["Gemini_コスパ"]}</div>`;
    h += mkBar("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"]);
    h += mkBar("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
    h += mkBar("常道", "独特", "", "", d["Claude_個性"], true);
    const a4 = AXIS4_MAP[d["中分類"]] || AXIS4_DEFAULT;
    h += `<div style="font-size:0.6rem; color:var(--accent); text-align:center; margin-bottom:2px;">${a4.label}</div>${mkBar(a4.left, a4.right, "", "", d["Claude_第4軸"], true)}`;
    h += `<div style="font-size:0.6rem; color:#888; text-align:right; margin-top:8px;"><span style="color:#10a37f">●GPT</span> <span style="color:#1a73e8">●Gem</span> <span style="color:#d97757">●Claude</span></div>`;
    h += `</div><div class="lq-specs-half">`;
    h += `<div class="spec-row-compact"><span>知名度</span><span>${d["知名度"]}</span></div><div class="spec-row-compact"><span>度数</span><span>${d["度数"]}</span></div><div class="spec-row-compact"><span>発売</span><span>${d["銘柄誕生年"]}</span></div><div class="spec-row-compact"><span>市販</span><span class="price-retail">${d["市販価格"]}</span></div><div class="spec-row-compact"><span>Bar</span><span class="price-bar">${d["バー価格"]}</span></div>`;
    h += `</div></div>`;
    if(d["ソフィーの裏話"]) h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    let tags = ((d["味わいタグ"]||"") + "," + (d["検索タグ"]||"")).split(',').filter(t=>t.trim());
    if(tags.length) h += `<div class="lq-tags">${tags.map(t=>`<span class="lq-tag">${t}</span>`).join('')}</div>`;
    if(d["鑑定評価(200字)"]) h += `<div class="lq-desc">${d["鑑定評価(200字)"]}</div>`;
    h += `</div>`;
    render(h, 'standard', true);
    const b = document.getElementById('c-back'); if(nav.curG === null) { b.innerText = '候補へ戻る'; b.style.background = '#d35400'; }
}

function render(h, mode = 'standard', isFS = false) {
    nm.style.display='none'; lv.style.display='block'; lv.innerHTML=h;
    document.querySelectorAll('.scr-tag-btn').forEach(btn => btn.onclick = (e) => { e.target.classList.toggle('selected'); saveForm(); });
    const ls = document.querySelector('.l-side'); ls.style.display = isFS ? 'none' : 'block';
    renderConsole(mode);
}

function handleBack() {
    if (nav.state === "lq_card") { if(nav.curG === null) renderResults(nav.curP, nav.curI); else showRoot(); }
    else if (nav.state === "lq_res") openScreening();
    else openLiquorPortal();
}

function saveForm() {
    const get = (id) => document.getElementById(id)?.value || "";
    scrState.major = get('s-mj'); scrState.sub = get('s-sb'); scrState.country = get('s-cn'); scrState.region = get('s-rg');
    scrState.keyword = get('s-kw'); scrState.isStandard = get('s-std'); scrState.isSophieRecom = get('s-sop');
    scrState.cospa = get('s-cospa');
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
}

function openMajor() {
    nav.updateNav("lq_major"); let h = `<div class="label" onclick="window.openLiquorPortal()">◀ ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]))].forEach(m => { h += `<div class="item" onclick="window.openSub('${m}')">📁 ${m}</div>`; });
    render(h);
}
window.openSub = (mj) => {
    nav.updateNav("lq_sub", mj); let h = `<div class="label" onclick="window.openMajor()">◀ ${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]))].forEach(s => { h += `<div class="item" onclick="window.openItems('${s}')">📁 ${s}</div>`; });
    render(h);
};
window.openItems = (sb) => {
    const list = nav.liquorData.filter(d => d["中分類"] === sb); nav.updateNav("lq_list", null, list);
    let h = `<div class="label" onclick="window.openSub('${list[0]["大分類"]}')">◀ ${sb}</div>`;
    list.forEach((d, i) => { h += `<div class="item" data-idx="${i}">🥃 ${d["銘柄名"]}</div>`; });
    render(h);
    document.querySelectorAll('#list-view .item').forEach(el => { el.onclick = () => showCard(nav.liquorData.indexOf(list[el.dataset.idx]), list); });
};

function renderConsole(mode) {
    const grid = document.getElementById('console-grid');
    if (mode === 'screening') {
        grid.innerHTML = `<button class="console-scr-btn" id="c-clr">クリア</button><button class="console-scr-btn btn-c-exec" id="c-ex">検索実行</button>`;
        document.getElementById('c-clr').onclick = () => { scrState = { major: "", sub: "", country: "", region: "", keyword: "", cospa: "", isStandard: "", isSophieRecom: "", s1Min: -2.0, s1Max: 2.0, s2Min: -2.0, s2Max: 2.0, s3Min: -2.0, s3Max: 2.0, s4Min: -2.0, s4Max: 2.0, tags: [] }; openScreening(); };
        document.getElementById('c-ex').onclick = () => window.executeScr();
    } else if (mode === 'result') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-mod" id="c-mod">🔍 条件変更</button>`;
        document.getElementById('btn-mod').onclick = () => window.openScreening();
    } else {
        grid.innerHTML = `<button class="c-btn" id="c-exp">▼</button><button class="c-btn" id="c-back">▲</button><button class="c-btn">⏹️</button><button class="c-btn" id="c-next" style="flex:1.5">▶</button><button class="c-btn">⏭</button>`;
        document.getElementById('c-back').onclick = handleBack;
        document.getElementById('c-exp').onclick = () => { 
            const ls = document.querySelector('.l-side'); ls.style.display='block'; 
            setTimeout(() => { if(nav.state.includes('lq')) ls.style.display='none'; }, 4000);
            playV("./voices_mp3/what_order.mp3", "何になさいますか？");
        };
        document.getElementById('c-next').onclick = () => { if(nav.state === "lq_card") { let list = nav.curP; let idx = (list.indexOf(nav.liquorData[nav.curI]) + 1) % list.length; showCard(nav.liquorData.indexOf(list[idx]), list); } };
    }
}