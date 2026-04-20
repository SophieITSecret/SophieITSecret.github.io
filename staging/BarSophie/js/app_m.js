import * as media from './media.js';
import * as nav from './navigation.js';

window.onerror = function(msg, url, lineNo) { alert("System Error:\n" + msg + "\nLine: " + lineNo); return true; };

let isPaused = false, isAutoPlay = false, isMusicMode = false, lastTxt = "", pressTimer = null;
let ytWrapper, img, tel, lv, nm, talkAudio;
let ytPlayer = null, ytPlayerReady = false;

// 第4軸マッピングデータ
const AXIS4_MAP = {
    "スコッチ・シングルモルト": { label: "スモーキー度", left: "無煙", right: "煙強" },
    "バーボン": { label: "樽熟成感", left: "軽熟", right: "深熟" },
    "赤ワイン": { label: "タンニン", left: "柔渋", right: "強渋" },
    "白ワイン": { label: "酸味", left: "丸酸", right: "鋭酸" },
    "純米大吟醸": { label: "旨味", left: "淡麗", right: "濃醇" },
    "ジン（銘柄）": { label: "ボタニカル感", left: "淡草", right: "強草" }
};
const AXIS4_DEFAULT = { label: "第4軸", left: "←", right: "→", disabled: true };

// スクリーニング状態
let scrState = null;
function initScrState() {
    scrState = { major: "", sub: "", country: "", region: "", keyword: "", cospa: "", isStandard: "", isSophieRecom: "", pMin: "", pMax: "", aMin: "", aMax: "", s1Min: "-2.0", s1Max: "2.0", s2Min: "-2.0", s2Max: "2.0", s3Min: "-2.0", s3Max: "2.0", s4Min: "-2.0", s4Max: "2.0", tags: [] };
}

// フォーム保存の安全化
function saveScrFormState() {
    const getV = (id) => { const el = document.getElementById(id); return el ? el.value : (scrState[id.replace('scr-','')] || ""); };
    if(!document.getElementById('scr-mj')) return; 
    scrState.keyword = getV('scr-kw'); scrState.major = getV('scr-mj'); scrState.sub = getV('scr-sb');
    scrState.country = getV('scr-cn'); scrState.region = getV('scr-rg'); scrState.cospa = getV('scr-cospa');
    scrState.isStandard = getV('scr-std'); scrState.isSophieRecom = getV('scr-sophie');
    scrState.pMin = getV('scr-p-min'); scrState.pMax = getV('scr-p-max');
    scrState.aMin = getV('scr-a-min'); scrState.aMax = getV('scr-a-max');
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
}

document.addEventListener('DOMContentLoaded', async () => {
    ytWrapper = document.getElementById('yt-wrapper'); img = document.getElementById('monitor-img');
    tel = document.getElementById('telop'); lv = document.getElementById('list-view'); nm = document.getElementById('nav-main');
    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if(!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }
    try { await nav.loadAllData(); } catch (e) { alert("Data Load Error: " + e.message); }
    initScrState(); setup();
});

// ★ 関数をグローバルに公開（これでHTMLのonclickが確実に動く）
window.openLiquorRoot = () => openLiquorRoot();
window.openScreeningUI = () => openScreeningUI();
window.executeScreening = () => executeScreening();
window.openLiquorMajor = () => openLiquorMajor();

function renderConsole(mode) {
    const grid = document.querySelector('.btn-grid'); if (!grid) return;
    if (mode === 'screening') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-clear" id="btn-c-clr">条件クリア</button><button class="console-scr-btn btn-c-exec" id="btn-c-ex">検索実行</button>`;
        document.getElementById('btn-c-clr').onclick = () => { initScrState(); openScreeningUI(); };
        document.getElementById('btn-c-ex').onclick = () => executeScreening();
    } else if (mode === 'result') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-mod" id="btn-c-md">🔍 検索条件を変更する</button>`;
        document.getElementById('btn-c-md').onclick = () => openScreeningUI();
    } else {
        grid.innerHTML = `<button class="c-btn" id="btn-expand">▼</button><button class="c-btn" id="ctrl-back">▲</button><button class="c-btn" id="ctrl-pause">⏹️</button><button class="c-btn" id="ctrl-play" style="flex: 1.5; font-size: 1.2rem;">▶</button><button class="c-btn" id="btn-next">⏭</button>`;
        document.getElementById('ctrl-play').onclick = playHead; document.getElementById('ctrl-pause').onclick = togglePause;
        document.getElementById('ctrl-back').onclick = handleBack; document.getElementById('btn-expand').onclick = handleExpand;
    }
}

function handleExpand() {
    if (nav.state === "lq_card" || nav.state === "lq_scr") {
        const ls = document.querySelector('.l-side');
        if (ls) { ls.style.display = 'block'; setTimeout(() => { if (nav.state.includes('lq')) ls.style.display = 'none'; }, 4000); }
        talkAudio.src = "./voices_mp3/what_order.mp3"; talkAudio.play().catch(() => media.speak("何になさいますか？"));
        return;
    }
    const mon = document.querySelector('.monitor'); mon.classList.toggle('expanded');
}

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
    document.getElementById('btn-liquor').onclick = () => openLiquorRoot();
    renderConsole('standard');
}

function showRootMenu() { lv.style.display='none'; nm.style.display='block'; nav.updateNav("none"); img.src='./front_sophie.jpeg'; renderConsole('standard'); }

function openLiquorRoot() {
    nav.updateNav("lq_root");
    let h = `<div class="label" style="justify-content:center;">お酒を選ぶ</div>`;
    h += `<button class="act-btn" onclick="window.openLiquorMajor()" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>`;
    h += `<button class="act-btn" onclick="window.openScreeningUI()" style="background:#d35400; margin:0 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>`;
    h += `<div class="direct-box-new"><div class="direct-lbl">ダイレクト検索</div><input type="number" id="direct-num" placeholder="No."><button id="btn-direct-go">開く</button></div>`;
    render(h, () => {});
    document.getElementById('btn-direct-go').onclick = () => {
        const v = document.getElementById('direct-num').value;
        const target = nav.liquorData.find(d => d["No"] == v);
        if(target) showLiquorCard(nav.liquorData.indexOf(target), nav.liquorData);
    };
}

// ★ダブルスライダー（重なり順を動的に変えて「掴めない」を解消）
function attachMultiSlider(id) {
    const minEl = document.getElementById(id + '-min'), maxEl = document.getElementById(id + '-max'), fillEl = document.getElementById(id + '-fill');
    if(!minEl) return;
    const up = (e) => {
        let v1 = parseFloat(minEl.value), v2 = parseFloat(maxEl.value);
        if (v1 > v2) { if (e && e.target === minEl) { v1 = v2; minEl.value = v1; } else { v2 = v1; maxEl.value = v2; } }
        // 動かしている方を前面にする
        if (e) e.target.style.zIndex = "10";
        if (e && e.target === minEl) maxEl.style.zIndex = "5"; else if(e) minEl.style.zIndex = "5";

        const p1 = ((v1 + 2) / 4) * 100, p2 = ((v2 + 2) / 4) * 100;
        fillEl.style.left = p1 + '%'; fillEl.style.width = (p2 - p1) + '%';
        scrState[id.replace('scr-', '') + 'Min'] = v1.toFixed(1); scrState[id.replace('scr-', '') + 'Max'] = v2.toFixed(1);
    };
    minEl.oninput = up; maxEl.oninput = up; up();
}

function openScreeningUI() {
    nav.updateNav("lq_scr");
    let h = `<div class="label"><button style="background:none;border:none;color:#fff;font-size:1.2rem;" onclick="window.openLiquorRoot()">◀</button> お好みでスクリーニング</div>`;
    h += `<div class="scr-container">`;
    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]))];
    const majorOpts = `<option value="">問わない</option>` + majors.map(m => `<option value="${m}" ${scrState.major===m?'selected':''}>${m}</option>`).join('');
    let subs = scrState.major ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]))] : [];
    const subOpts = `<option value="">問わない</option>` + subs.map(s => `<option value="${s}" ${scrState.sub===s?'selected':''}>${s}</option>`).join('');
    const countries = [...new Set(nav.liquorData.filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub)).map(d => d["国"]))].filter(Boolean).sort();
    const regions = [...new Set(nav.liquorData.filter(d => (!scrState.country || d["国"] === scrState.country)).map(d => d["産地"]))].filter(Boolean).sort();
    
    h += `<div class="scr-group">
            <div class="scr-row"><span class="scr-row-label">ジャンル:</span><select id="scr-mj" onchange="window.saveAndRefresh()">${majorOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">品目:</span><select id="scr-sb" onchange="window.saveAndRefresh()">${subOpts}</select></div>
            <div class="scr-row"><span class="scr-row-label">国:</span><select id="scr-cn" onchange="window.saveAndRefresh()"><option value="">問わない</option>${countries.map(c=>`<option value="${c}" ${scrState.country===c?'selected':''}>${c}</option>`).join('')}</select></div>
            <div class="scr-row"><span class="scr-row-label">地域:</span><select id="scr-rg"><option value="">問わない</option>${regions.map(r=>`<option value="${r}" ${scrState.region===r?'selected':''}>${r}</option>`).join('')}</select></div>
            <div class="scr-row" style="margin-top:6px;"><span class="scr-row-label">検索:</span><input type="text" id="scr-kw" placeholder="キーワードすべて" value="${scrState.keyword}"></div>
          </div>`;
    h += `<div class="scr-group">
            <div class="scr-row"><span class="scr-row-label">定番:</span><select id="scr-std"><option value="">問わない</option><option value="1" ${scrState.isStandard==='1'?'selected':''}>定番に絞る</option></select></div>
            <div class="scr-row"><span class="scr-row-label">推し:</span><select id="scr-sophie"><option value="">問わない</option><option value="1" ${scrState.isSophieRecom==='1'?'selected':''}>推しを聞く</option></select></div>
            <div class="scr-row"><span class="scr-row-label">ｺｽﾊﾟ:</span><select id="scr-cospa"><option value="">問わない</option><option value="1" ${scrState.cospa==='1'?'selected':''}>☆1以上</option><option value="2" ${scrState.cospa==='2'?'selected':''}>☆2以上</option><option value="3" ${scrState.cospa==='3'?'selected':''}>☆3のみ</option></select></div>
          </div>`;
    const mkBar = (id, l, r, min, max, dis) => `<div class="scr-slider-box" style="opacity:${dis?0.4:1}; pointer-events:${dis?'none':'auto'};"><div class="scr-slider-label-edge">${l}</div><div class="multi-range-wrap"><div class="multi-range-track"></div><div class="slider-ticks"><div class="tick"></div><div class="tick"></div><div class="tick center"></div><div class="tick"></div><div class="tick"></div></div><div class="multi-range-fill" id="${id}-fill"></div><input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${min}"><input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${max}"></div><div class="scr-slider-label-edge">${r}</div></div>`;
    h += `<div class="scr-group">`;
    h += mkBar("scr-s1", "辛口", "甘口", scrState.s1Min, scrState.s1Max, false);
    h += mkBar("scr-s2", "軽快", "濃厚", scrState.s2Min, scrState.s2Max, false);
    h += mkBar("scr-s3", "常道", "独特", scrState.s3Min, scrState.s3Max, false);
    const a4 = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    h += mkBar("scr-s4", a4.left, a4.right, scrState.s4Min, scrState.s4Max, !scrState.sub);
    h += `</div>`;
    render(h, (e) => { if(e.target.classList.contains('scr-tag-btn')) e.target.classList.toggle('selected'); }, true, 'screening');
    ['scr-s1','scr-s2','scr-s3','scr-s4'].forEach(id => attachMultiSlider(id));
}
window.saveAndRefresh = () => { saveScrFormState(); openScreeningUI(); };

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
        const avg1 = (parseFloat(d["GPT_甘辛"])+parseFloat(d["Gemini_甘辛"])+parseFloat(d["Claude_甘辛"]))/3;
        if(avg1 < scrState.s1Min || avg1 > scrState.s1Max) return false;
        return true;
    });
    renderSearchResults(res);
}

function renderSearchResults(results, scrollIdx = null) {
    nav.updateNav('lq_res', null, results);
    let h = `<div class='label'><button style='background:none;border:none;color:#fff;font-size:1.2rem;' onclick="window.openLiquorRoot()">◀</button>検索結果: ${results.length}件</div>`;
    h += `<button class="btn-back-scr" onclick="window.openScreeningUI()">🔍 検索条件を変更する</button>`;
    results.forEach(d => { h += `<div class='item' data-lqidx='${nav.liquorData.indexOf(d)}'>🥃 ${d['銘柄名']}</div>`; });
    render(h, (e) => { if(e.currentTarget.dataset.lqidx) showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), results); }, true, 'result');
    if(scrollIdx !== null) setTimeout(() => { const t = document.querySelector(`[data-lqidx='${scrollIdx}']`); if(t) t.scrollIntoView({ block: 'center' }); }, 50);
}

function showLiquorCard(gIdx, list = null) {
    if(list) nav.updateNav("lq_card", nav.curG, list, gIdx);
    const d = nav.liquorData[gIdx];
    const getP = (v) => { let n = parseFloat(v); if(isNaN(n)) return -1; return Math.min(100, Math.max(0, ((n + 2) / 4) * 100)); };
    const mkBar = (l, r, gpt, gem, cla, onlyC = false) => {
        let hg = `<div class="graph-row-inline"><div class="graph-label-inline">${l}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        if(!onlyC) { if(getP(gpt)>=0) hg+=`<div class="graph-point pt-gpt" style="left:${getP(gpt)}%"></div>`; if(getP(gem)>=0) hg+=`<div class="graph-point pt-gemini" style="left:${getP(gem)}%"></div>`; }
        if(getP(cla)>=0) hg+=`<div class="graph-point pt-claude" style="left:${getP(cla)}%"></div>`;
        return hg + `</div><div class="graph-label-inline">${r}</div></div>`;
    };
    let h = `<div class="label">No.${d["No"]}</div><div class="lq-card">`;
    h += `<div class="lq-name">${d["銘柄名"]}</div><div class="lq-quote">${(d["ソフィーのセリフ"]||"").replace(/[「」『』"']/g,'')}</div>`;
    h += `<div class="lq-basic-info"><div><span style="color:var(--blue)">▶</span> ${d["大分類"]}　<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div><div><span style="color:#888">産地:</span> ${d["国"]} / ${d["産地"]}</div>`;
    if(d["公式URL"] && d["公式URL"]!=="-") h+=`<a href="${d["公式URL"]}" target="_blank" class="lq-btn-small">🔗 メーカーサイト</a>`;
    h += `</div><div class="lq-split-view"><div class="lq-graph-half">`;
    if(d["Gemini_コスパ"]) h += `<div class="lq-cospa"><span>コスパ</span> ${d["Gemini_コスパ"]}</div>`;
    h += mkBar("辛口", "甘口", d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"]);
    h += mkBar("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
    h += mkBar("常道", "独特", "", "", d["Claude_個性"], true);
    const a4 = AXIS4_MAP[d["中分類"]] || AXIS4_DEFAULT;
    h += `<div style="font-size:0.65rem; color:var(--accent); text-align:center; margin-top:5px;">${a4.label}</div>`;
    h += mkBar(a4.left, a4.right, "", "", d["Claude_第4軸"], true);
    h += `<div style="font-size:0.6rem; color:#888; text-align:right; margin-top:8px;"><span style="color:#10a37f">●GPT</span> <span style="color:#1a73e8">●Gem</span> <span style="color:#d97757">●Claude</span></div></div>`;
    h += `<div class="lq-specs-half"><div class="spec-row-compact"><span>知名度</span><span>${d["知名度"]}</span></div><div class="spec-row-compact"><span>度数</span><span>${d["度数"]}</span></div><div class="spec-row-compact"><span>市販</span><span class="price-retail">${d["市販価格"]}</span></div><div class="spec-row-compact"><span>Bar</span><span class="price-bar">${d["バー価格"]}</span></div></div></div>`;
    if(d["ソフィーの裏話"]) h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    h += `</div>`;
    render(h, () => {}, true, 'standard');
    const b = document.getElementById('ctrl-back'); if(nav.curG === null) { b.innerText = '候補へ戻る'; b.style.background = '#d35400'; } else { b.innerText = 'リストへ'; }
}

function render(h, cb, isFS = false, conMode = 'standard') { 
    nm.style.display = 'none'; lv.style.display = 'block'; lv.innerHTML = h; document.getElementById('main-scroll').scrollTop = 0; 
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

function resetCtrlBack() { const b = document.getElementById('ctrl-back'); if(b){ b.innerText='▲'; b.style.background=''; b.style.color=''; } }

function openLiquorMajor() {
    nav.updateNav("lq_major"); let h = `<div class="label">ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]))].forEach(m => { h += `<div class="item" onclick="window.openLiquorSub('${m}')">📁 ${m}</div>`; });
    render(h, () => {});
}
window.openLiquorSub = (mj) => {
    nav.updateNav("lq_sub", mj); let h = `<div class="label">${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]))].forEach(s => { h += `<div class="item" onclick="window.openLiquorList('${s}')">📁 ${s}</div>`; });
    render(h, () => {});
};
window.openLiquorList = (sb) => {
    const list = nav.liquorData.filter(d => d["中分類"] === sb); nav.updateNav("lq_list", nav.curG, list);
    let h = `<div class="label">${sb} 一覧</div>`;
    list.forEach(d => { h += `<div class="item" data-lqidx="${nav.liquorData.indexOf(d)}">🥃 ${d["銘柄名"]}</div>`; });
    render(h, (e) => showLiquorCard(parseInt(e.currentTarget.dataset.lqidx), list));
};

function openMusic() { nav.updateNav("art"); render('<div class="label">Music Request</div>', ()=>{}); }
function openTalk() { nav.updateNav("g"); render('<div class="label">Story Menu</div>', ()=>{}); }