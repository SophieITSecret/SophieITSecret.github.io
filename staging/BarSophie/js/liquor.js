/**
 * liquor.js — お酒データベース・スクリーニング・鑑定カード
 * ★ このファイルが現在の作業対象です。
 * ★ music.js / utils.js / navigation.js は触らないでください。
 */

import * as nav from './navigation.js';
import { clean, formatAbv, avg3, setListView } from './utils.js';

// =============================================
// 第4軸マッピング
// =============================================
const AXIS4_MAP = {
    "スコッチ・シングルモルト":     { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "スコッチ・ブレンデッド":       { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "アイリッシュウイスキー":       { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "カナディアンウイスキー":       { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "ジャパニーズウイスキー":       { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "ライウイスキー":               { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "その他ウイスキー":             { label: "スモーキー度",  left: "無煙",     right: "煙強"     },
    "バーボン":                     { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",   right: "深熟"     },
    "テネシーウイスキー":           { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",   right: "深熟"     },
    "コニャック":                   { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",   right: "深熟"     },
    "アルマニャック":               { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",   right: "深熟"     },
    "カルヴァドス":                 { label: "リンゴ感",      left: "淡林",     right: "強林"     },
    "赤ワイン":                     { label: "タンニン",      left: "なめらか",  right: "力強い渋"  },
    "白ワイン":                     { label: "酸味",          left: "丸く",     right: "シャープ"  },
    "ロゼワイン":                   { label: "酸味",          left: "丸く",     right: "シャープ"  },
    "オレンジワイン":               { label: "酸味",          left: "丸く",     right: "シャープ"  },
    "シェリー・酒精強化":           { label: "ナッツ感",      left: "淡果",     right: "強果"     },
    "シャンパン":                   { label: "辛口度",        left: "甘泡",     right: "辛泡"     },
    "プロセッコ・フランチャコルタ": { label: "辛口度",        left: "甘泡",     right: "辛泡"     },
    "純米大吟醸":                   { label: "旨味",          left: "淡麗",     right: "濃醇"     },
    "純米吟醸":                     { label: "旨味",          left: "淡麗",     right: "濃醇"     },
    "特別純米・純米":               { label: "旨味",          left: "淡麗",     right: "濃醇"     },
    "本醸造・その他":               { label: "旨味",          left: "淡麗",     right: "濃醇"     },
    "スパークリング日本酒":         { label: "旨味",          left: "淡麗",     right: "濃醇"     },
    "芋焼酎":                       { label: "芋の素材感",    left: "クリーン",  right: "素材前面"  },
    "麦焼酎":                       { label: "麦の素材感",    left: "クリーン",  right: "香ばしい"  },
    "米焼酎":                       { label: "米の素材感",    left: "クリーン",  right: "米の甘み"  },
    "黒糖焼酎":                     { label: "黒糖感",        left: "あっさり",  right: "深み強い"  },
    "泡盛":                         { label: "古酒感",        left: "若い",     right: "深み"     },
    "ジン（銘柄）":                 { label: "ﾎﾞﾀﾆｶﾙ感",    left: "クリーン",  right: "複雑個性"  },
    "ウォッカ（銘柄）":             { label: "クリーン度",    left: "個性あり",  right: "純粋"     },
    "テキーラ（銘柄）":             { label: "アガベ感",      left: "弱い",     right: "強く主張"  },
    "ラム（銘柄）":                 { label: "糖蜜・樽感",    left: "ライト",   right: "濃厚"     },
    "ベルモット・アペリティフ":     { label: "薬草感",        left: "淡草",     right: "強草"     },
    "国内プレミアム":               { label: "苦味",          left: "苦みなし",  right: "苦味強"   },
    "海外メジャー":                 { label: "苦味",          left: "苦みなし",  right: "苦味強"   },
    "クラフトビール":               { label: "苦味",          left: "苦みなし",  right: "苦味強"   },
    "梅酒":                         { label: "熟成感",        left: "若梅",     right: "熟梅"     },
    "和リキュール":                 { label: "素材感",        left: "淡素",     right: "強素"     },
    "ウイスキー系カクテル":         { label: "酸味",          left: "無酸",     right: "酸強"     },
    "ウォッカ系カクテル":           { label: "酸味",          left: "無酸",     right: "酸強"     },
    "ジン系カクテル":               { label: "酸味",          left: "無酸",     right: "酸強"     },
    "ラム系カクテル":               { label: "酸味",          left: "無酸",     right: "酸強"     },
    "テキーラ系カクテル":           { label: "酸味",          left: "無酸",     right: "酸強"     },
    "ブランデー系カクテル":         { label: "酸味",          left: "無酸",     right: "酸強"     },
    "リキュール系カクテル":         { label: "酸味",          left: "無酸",     right: "酸強"     },
    "クラシックカクテル":           { label: "酸味",          left: "無酸",     right: "酸強"     },
};
const AXIS4_DEFAULT = { label: "第4軸(品目選択後)", left: "←", right: "→", disabled: true };

// =============================================
// 価格帯バッジ
// =============================================
const PRICE_LEVELS = [
    { max: 2000,   num: "2",  color: "#27ae60" },  // 緑
    { max: 5000,   num: "5",  color: "#27ae60" },  // 緑
    { max: 10000,  num: "1",  color: "#8e1a2e" },  // ボルドーワインレッド
    { max: 20000,  num: "2",  color: "#8e1a2e" },  // ボルドーワインレッド
    { max: 50000,  num: "5",  color: "#8e1a2e" },  // ボルドーワインレッド
];

// 価格文字列から数値を抽出（万円対応・範囲表記は最小値採用）
function parsePrice(priceStr) {
    if (!priceStr) return null;
    const s = priceStr.replace(/,|，|、/g, '');  // カンマ等を除去

    // 「万」が含まれる場合：最初の数字×10000
    if (s.includes('万')) {
        const m = s.match(/([0-9]+(?:\.[0-9]+)?)\s*万/);
        if (m) return Math.round(parseFloat(m[1]) * 10000);
    }

    // 通常：最初に現れる数字を使う（範囲表記は最小値を採用）
    const m = s.match(/[0-9]+/);
    return m ? parseInt(m[0]) : null;
}

function priceBadge(priceStr, major) {
    // カクテルはグラスアイコン
    if (major === 'カクテル') return `<span style="font-size:1rem; margin-right:3px;">🍸</span>`;

    const n = parsePrice(priceStr);
    if (n === null) return "　";
    if (n > 50000) return `<span style="font-size:1rem; margin-right:3px;">💎</span>`;
    for (const lv of PRICE_LEVELS) {
        if (n <= lv.max) {
            return `<svg width="16" height="16" viewBox="0 0 16 16" style="vertical-align:middle; margin-right:3px; flex-shrink:0;">` +
                   `<circle cx="8" cy="8" r="8" fill="${lv.color}"/>` +
                   `<text x="8" y="12" text-anchor="middle" fill="white" font-size="9" font-weight="bold" font-family="sans-serif">${lv.num}</text>` +
                   `</svg>`;
        }
    }
    return "　";
}

// =============================================
// スクリーニング状態
// =============================================
const initScrState = () => ({
    major: "", sub: "", country: "", region: "", keyword: "",
    cospa: "", isStandard: "", isSophieRecom: "",
    pMin: "", pMax: "",
    s1Min: -2.0, s1Max: 2.0,
    s2Min: -2.0, s2Max: 2.0,
    s3Min: -2.0, s3Max: 2.0,
    s4Min: -2.0, s4Max: 2.0,
    tags: []
});
let scrState = initScrState();

// コールバック
let _renderConsole = null;
export function setRenderConsole(fn) { _renderConsole = fn; }

// 現在のリスト（コンソールから参照）
let _currentList = [];
let _currentState = ""; // "scr" or "list"

// =============================================
// お酒データベース — 入口
// =============================================
export function openLiquorPortal() {
    nav.updateNav("lq_root");
    const h = `
        <div class="label" style="justify-content:center; cursor:default;">お酒を選ぶ</div>
        <button class="act-btn" id="btn-portal-cat" style="background:#27ae60; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>
        <button class="act-btn" id="btn-portal-scr" style="background:#8e44ad; margin:0 15px 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>
        <div class="direct-box-new">
            <div class="direct-lbl">No.検索</div>
            <input type="number" id="dir-num" placeholder="番号">
            <button id="dir-go">開く</button>
        </div>`;
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');

    document.getElementById('btn-portal-cat').addEventListener('click', openMajor);
    document.getElementById('btn-portal-scr').addEventListener('click', openScreening);
    document.getElementById('dir-go').addEventListener('click', () => {
        const v = document.getElementById('dir-num').value;
        const t = nav.liquorData.find(d => d["No"] == v);
        if (t) showCard(nav.liquorData.indexOf(t), nav.liquorData, 'list');
        else alert("No." + v + " は見つかりませんでした。");
    });
}

// =============================================
// スクリーニング — UI描画
// =============================================
function openScreening() {
    nav.updateNav("lq_scr");

    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];
    const subs = scrState.major
        ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]).filter(Boolean))]
        : [];
    const countries = [...new Set(nav.liquorData
        .filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub))
        .map(d => d["国"]).filter(Boolean))].sort();
    const regions = [...new Set(nav.liquorData
        .filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub) && (!scrState.country || d["国"] === scrState.country))
        .map(d => d["産地"]).filter(Boolean))].sort();

    const opt = (val, cur) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${val}</option>`;
    const sel = (id, cur, arr) =>
        `<select id="${id}"><option value="">問わない</option>${arr.map(v => opt(v, cur)).join('')}</select>`;

    // 価格帯選択肢
    const priceVals = ["", 1000, 2000, 3000, 4000, 5000, 10000, 20000, 30000, 50000, 100000];
    const priceOpts = priceVals.map(v =>
        `<option value="${v}" ${scrState.pMin == v && v !== "" ? 'selected' : ''}>${v === "" ? "決めない" : v.toLocaleString() + "円"}</option>`
    ).join('');
    const priceOptsMax = priceVals.map(v =>
        `<option value="${v}" ${scrState.pMax == v && v !== "" ? 'selected' : ''}>${v === "" ? "決めない" : v.toLocaleString() + "円"}</option>`
    ).join('');

    const a4    = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    const a4dis = !scrState.sub;

    // スライダー（目盛り付き）
    const mkSlider = (id, lbl, left, right, min, max, disabled) => `
        <div class="scr-slider-row" style="opacity:${disabled ? 0.35 : 1}; pointer-events:${disabled ? 'none' : 'auto'};">
            <div class="scr-slider-label-name">${lbl}</div>
            <div class="scr-slider-label-left">${left}</div>
            <div class="multi-range-wrap">
                <div class="multi-range-track"></div>
                <div class="slider-ticks">
                    <div class="stick stick-sm"></div>
                    <div class="stick stick-md"></div>
                    <div class="stick stick-lg"></div>
                    <div class="stick stick-md"></div>
                    <div class="stick stick-sm"></div>
                </div>
                <div class="multi-range-fill" id="${id}-fill"></div>
                <input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${min}" style="z-index:3;">
                <input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${max}" style="z-index:2;">
            </div>
            <div class="scr-slider-label-right">${right}</div>
        </div>`;

    const allTags = new Set();
    nav.liquorData.forEach(d => {
        ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || ""))
            .split(',').forEach(t => { if (t.trim()) allTags.add(t.trim()); });
    });
    const tagHtml = Array.from(allTags).sort().map(t =>
        `<div class="scr-tag-btn ${scrState.tags.includes(t) ? 'selected' : ''}" data-tag="${t}">${t}</div>`
    ).join('');

    const h = `
        <div class="label" id="lbl-back-scr">◀ お好みでスクリーニング</div>
        <div class="scr-container">
            <div class="scr-group">
                <div class="scr-title">ジャンル・品目・産地</div>
                <div class="scr-row"><span class="scr-row-label">ジャンル:</span>${sel('s-mj', scrState.major, majors)}</div>
                <div class="scr-row"><span class="scr-row-label">品目:</span>${sel('s-sb', scrState.sub, subs)}</div>
                <div class="scr-row"><span class="scr-row-label">国:</span>${sel('s-cn', scrState.country, countries)}</div>
                <div class="scr-row"><span class="scr-row-label">地域:</span>${sel('s-rg', scrState.region, regions)}</div>
                <div class="scr-row"><span class="scr-row-label">検索:</span>
                    <input type="text" id="s-kw" value="${scrState.keyword}" placeholder="名称・タグ・解説など"></div>
            </div>
            <div class="scr-group">
                <div class="scr-title">フィルター</div>
                <div class="scr-row">
                    <span class="scr-row-label">市場価格:</span>
                    <select id="s-pmin" class="scr-price-sel">${priceOpts}</select>
                    <span class="scr-price-sep">〜</span>
                    <select id="s-pmax" class="scr-price-sel">${priceOptsMax}</select>
                </div>
                <div class="scr-row"><span class="scr-row-label">定番:</span>
                    <select id="s-std"><option value="">問わない</option>
                        <option value="○" ${scrState.isStandard === '○' ? 'selected' : ''}>定番に絞る</option></select></div>
                <div class="scr-row"><span class="scr-row-label">推し:</span>
                    <select id="s-sop"><option value="">問わない</option>
                        <option value="★" ${scrState.isSophieRecom === '★' ? 'selected' : ''}>推しを聞く</option></select></div>
                <div class="scr-row"><span class="scr-row-label">ｺｽﾊﾟ:</span>
                    <select id="s-cos"><option value="">問わない</option>
                        <option value="1" ${scrState.cospa === '1' ? 'selected' : ''}>☆1以上</option>
                        <option value="2" ${scrState.cospa === '2' ? 'selected' : ''}>☆☆以上</option>
                        <option value="3" ${scrState.cospa === '3' ? 'selected' : ''}>☆☆☆のみ</option></select></div>
            </div>
            <div class="scr-group">
                <div class="scr-title">味わい指定</div>
                ${mkSlider('s1', '甘辛',   '辛口',    '甘口',    scrState.s1Min, scrState.s1Max, false)}
                ${mkSlider('s2', 'ボディ', '軽快',    '濃厚',    scrState.s2Min, scrState.s2Max, false)}
                ${mkSlider('s3', '個性',   '常道',    '独特',    scrState.s3Min, scrState.s3Max, false)}
                ${mkSlider('s4', a4.label, a4.left,   a4.right,  scrState.s4Min, scrState.s4Max, a4dis)}
            </div>
            <div class="scr-group">
                <div class="scr-title">タグ選択</div>
                <div class="scr-tag-grid">${tagHtml}</div>
            </div>
        </div>`;

    setListView(h, true);
    if (_renderConsole) _renderConsole('screening');

    document.getElementById('lbl-back-scr').addEventListener('click', openLiquorPortal);
    ['s-mj', 's-sb', 's-cn'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => { saveForm(); openScreening(); });
    });
    document.getElementById('s-rg').addEventListener('change', saveForm);
    ['s1', 's2', 's3', 's4'].forEach(id => attachSlider(id));
    document.querySelectorAll('.scr-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => { btn.classList.toggle('selected'); saveForm(); });
    });
}

// =============================================
// ダブルスライダー
// =============================================
function attachSlider(id) {
    const minEl  = document.getElementById(id + '-min');
    const maxEl  = document.getElementById(id + '-max');
    const fillEl = document.getElementById(id + '-fill');
    if (!minEl || !maxEl || !fillEl) return;

    const update = (e) => {
        let v1 = parseFloat(minEl.value);
        let v2 = parseFloat(maxEl.value);
        if (v1 > v2) {
            if (e && e.target === minEl) { v1 = v2; minEl.value = v1; }
            else                         { v2 = v1; maxEl.value = v2; }
        }
        if (e) {
            e.target.style.zIndex = "5";
            (e.target === minEl ? maxEl : minEl).style.zIndex = "3";
        }
        fillEl.style.left  = ((v1 + 2) / 4 * 100) + '%';
        fillEl.style.width = ((v2 - v1) / 4 * 100) + '%';
        scrState[id + 'Min'] = v1;
        scrState[id + 'Max'] = v2;
    };

    minEl.addEventListener('input', update);
    maxEl.addEventListener('input', update);
    update();
}

// =============================================
// フォーム値の保存
// =============================================
function saveForm() {
    const g = id => document.getElementById(id)?.value ?? "";
    scrState.major         = g('s-mj');
    scrState.sub           = g('s-sb');
    scrState.country       = g('s-cn');
    scrState.region        = g('s-rg');
    scrState.keyword       = g('s-kw');
    scrState.isStandard    = g('s-std');
    scrState.isSophieRecom = g('s-sop');
    scrState.cospa         = g('s-cos');
    scrState.pMin          = g('s-pmin');
    scrState.pMax          = g('s-pmax');
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
}

// =============================================
// スクリーニング実行
// =============================================
function executeScr() {
    saveForm();
    const pMinN = scrState.pMin ? parseInt(scrState.pMin) : 0;
    const pMaxN = scrState.pMax ? parseInt(scrState.pMax) : Infinity;

    const results = nav.liquorData.filter(d => {
        if (scrState.major         && d["大分類"]         !== scrState.major)         return false;
        if (scrState.sub           && d["中分類"]         !== scrState.sub)           return false;
        if (scrState.country       && d["国"]             !== scrState.country)       return false;
        if (scrState.region        && d["産地"]           !== scrState.region)        return false;
        if (scrState.isStandard    && d["定番フラグ"]     !== scrState.isStandard)    return false;
        if (scrState.isSophieRecom && d["ソフィーの推し"] !== scrState.isSophieRecom) return false;
        if (scrState.cospa) {
            const stars = (d["Gemini_コスパ"] || "").split('☆').length - 1;
            if (stars < parseInt(scrState.cospa)) return false;
        }
        // 市場価格フィルター（万円対応）
        if (scrState.pMin || scrState.pMax) {
            const price = parsePrice(d["市販価格"]);
            if (price === null) return false;
            if (scrState.pMin && price < pMinN) return false;
            if (scrState.pMax && price > pMaxN) return false;
        }
        const v1 = avg3(d["GPT_甘辛"],  d["Gemini_甘辛"],  d["Claude_甘辛"]);
        if (v1 < scrState.s1Min || v1 > scrState.s1Max) return false;
        const v2 = avg3(d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
        if (v2 < scrState.s2Min || v2 > scrState.s2Max) return false;
        const v3 = Number(d["Claude_個性"] || 0);
        if (v3 < scrState.s3Min || v3 > scrState.s3Max) return false;
        if (scrState.sub) {
            const v4 = Number(d["Claude_第4軸"] || 0);
            if (v4 < scrState.s4Min || v4 > scrState.s4Max) return false;
        }
        if (scrState.tags.length > 0) {
            const dTags = ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || "")).split(',').map(t => t.trim());
            if (!scrState.tags.some(t => dTags.includes(t))) return false;
        }
        if (scrState.keyword) {
            const blob = [d["銘柄名"], d["国"], d["産地"], d["味わいタグ"],
                          d["検索タグ"], d["鑑定評価(200字)"], d["ソフィーの裏話"]]
                .map(v => clean(v)).join(" ").toLowerCase();
            if (!blob.includes(scrState.keyword.toLowerCase())) return false;
        }
        return true;
    });
    renderResults(results);
}

// =============================================
// 検索結果リスト
// =============================================
function renderResults(results, scrollToGlobalIdx = null) {
    nav.updateNav('lq_res', null, results);
    _currentList = results;
    _currentState = "scr";

    let h = `<div class="label" id="lbl-back-res">◀ 検索結果: ${results.length}件</div>`;
    results.forEach(d => {
        const gIdx = nav.liquorData.indexOf(d);
        const badge = priceBadge(d["市販価格"], d["大分類"]);
        h += `<div class="item res-item" data-gidx="${gIdx}" style="display:flex; align-items:center; gap:4px;">${badge}<span style="overflow:hidden; text-overflow:ellipsis;">${clean(d['銘柄名'])}</span></div>`;
    });
    setListView(h, true);
    if (_renderConsole) _renderConsole('result');

    document.getElementById('lbl-back-res').addEventListener('click', openLiquorPortal);
    document.querySelectorAll('.res-item').forEach(el => {
        el.addEventListener('click', () => showCard(parseInt(el.dataset.gidx), results, 'scr'));
    });
    if (scrollToGlobalIdx !== null) {
        setTimeout(() => {
            const t = document.getElementById('list-view').querySelector(`[data-gidx="${scrollToGlobalIdx}"]`);
            if (t) t.scrollIntoView({ block: 'center' });
        }, 50);
    }
}

// =============================================
// 個別銘柄カード
// =============================================
function showCard(gIdx, list, fromState) {
    nav.updateNav("lq_card", null, list, gIdx);
    _currentList  = list;
    _currentState = fromState || "list";
    const d = nav.liquorData[gIdx];
    if (!d) return;

    const toPos = v => { const n = parseFloat(v); if (isNaN(n)) return -1; return Math.min(100, Math.max(0, (n + 2) / 4 * 100)); };
    const mkBar = (ll, rl, gpt, gem, cla, claudeOnly = false) => {
        let h = `<div class="graph-row-inline"><div class="graph-label-inline">${ll}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        if (!claudeOnly) {
            if (toPos(gpt) >= 0) h += `<div class="graph-point pt-gpt"    style="left:${toPos(gpt)}%"></div>`;
            if (toPos(gem) >= 0) h += `<div class="graph-point pt-gemini" style="left:${toPos(gem)}%"></div>`;
        }
        if (toPos(cla) >= 0) h += `<div class="graph-point pt-claude" style="left:${toPos(cla)}%"></div>`;
        return h + `</div><div class="graph-label-inline">${rl}</div></div>`;
    };

    const sub  = (d["中分類"] || "").trim();
    const a4   = AXIS4_MAP[sub] || AXIS4_DEFAULT;
    const tags = ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || "")).split(',').map(t => t.trim()).filter(Boolean);

    let h = `<div class="label">No.${d["No"]}</div><div class="lq-card">`;
    h += `<div class="lq-name">${clean(d["銘柄名"])}</div>`;
    if (d["ソフィーのセリフ"]) h += `<div class="lq-quote">${clean(d["ソフィーのセリフ"])}</div>`;
    // ★大分類の▶を青（#1a73e8）に変更
    h += `<div class="lq-basic-info">
        <div><span style="color:#1a73e8">▶</span> ${d["大分類"]}&nbsp;&nbsp;<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div>
        <div><span style="color:#888">産地:</span> ${d["国"] || ""}${d["産地"] ? ' / ' + d["産地"] : ''}</div>`;
    if (d["製造元と創業年"] && d["製造元と創業年"] !== "-")
        h += `<div><span style="color:#888">製造:</span> ${d["製造元と創業年"]}</div>`;

    // ★ボタン行：メーカー(翻訳経由) ＋ Amazon ＋ G検索 ＋ 免責（右端）
    const amzKw  = encodeURIComponent(clean(d["銘柄名"]) + " " + d["大分類"]);
    const amzUrl = `https://www.amazon.co.jp/s?k=${amzKw}&tag=itsophie-22`;
    const gUrl   = `https://www.google.com/search?q=${encodeURIComponent(clean(d["銘柄名"]) + " " + d["大分類"])}`;
    h += `<div class="card-link-row">`;
    if (d["公式URL"] && d["公式URL"] !== "-") {
        const transUrl = `https://translate.google.com/translate?sl=auto&tl=ja&u=${encodeURIComponent(d["公式URL"])}`;
        h += `<a href="${transUrl}" target="_blank" class="lq-btn-small">🔗</a>`;
    }
    h += `<a href="${amzUrl}" target="_blank" class="lq-btn-amz">🛒 Amazon</a>`;
    h += `<a href="${gUrl}"   target="_blank" class="lq-btn-g">G</a>`;
    h += `<span class="card-disclaimer">※広告/AI</span>`;
    h += `</div>`;
    h += `</div><div class="lq-split-view"><div class="lq-graph-half">`;
    if (d["Gemini_コスパ"]) h += `<div class="lq-cospa">コスパ ${d["Gemini_コスパ"]}</div>`;
    h += mkBar("辛口", "甘口", d["GPT_甘辛"],  d["Gemini_甘辛"],  d["Claude_甘辛"]);
    h += mkBar("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
    h += mkBar("常道", "独特", "", "", d["Claude_個性"], true);
    h += `<div class="axis4-label">${a4.label}</div>`;
    h += mkBar(a4.left, a4.right, "", "", d["Claude_第4軸"], true);
    h += `<div class="graph-legend"><span class="leg-gpt">●GPT</span> <span class="leg-gem">●Gem</span> <span class="leg-cla">●Claude</span></div>`;
    h += `</div><div class="lq-specs-half">`;
    h += `<div class="spec-row-compact"><span>知名度</span><span>${d["知名度"] || "-"}</span></div>`;
    h += `<div class="spec-row-compact"><span>度数</span><span>${formatAbv(d["度数"])}</span></div>`;
    h += `<div class="spec-row-compact"><span>発売</span><span>${d["銘柄誕生年"] || "-"}</span></div>`;
    h += `<div class="spec-row-compact"><span>市販</span><span class="price-retail">${d["市販価格"] || "-"}</span></div>`;
    h += `<div class="spec-row-compact"><span>Bar</span><span class="price-bar">${d["バー価格"] || "-"}</span></div>`;
    h += `</div></div>`;
    if (d["ソフィーの裏話"])   h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    if (tags.length)           h += `<div class="lq-tags">${tags.map(t => `<span class="lq-tag">${t}</span>`).join('')}</div>`;
    // ★解説：ヘッダーをインラインで文章に続ける
    if (d["鑑定評価(200字)"]) h += `<div class="lq-desc"><span class="lq-desc-header">[解説]</span> ${d["鑑定評価(200字)"]}</div>`;
    h += `</div>`;

    setListView(h, true);
    if (_renderConsole) _renderConsole('card');
}

// =============================================
// カード画面のコンソール用ナビ関数（app_m.jsから呼ぶ）
// =============================================
export function cardNavPrev() {
    const cur  = nav.liquorData[nav.curI];
    const idx  = _currentList.indexOf(cur);
    const prev = _currentList[(idx - 1 + _currentList.length) % _currentList.length];
    showCard(nav.liquorData.indexOf(prev), _currentList, _currentState);
}
export function cardNavNext() {
    const cur  = nav.liquorData[nav.curI];
    const idx  = _currentList.indexOf(cur);
    const next = _currentList[(idx + 1) % _currentList.length];
    showCard(nav.liquorData.indexOf(next), _currentList, _currentState);
}
export function cardNavToList() {
    if (_currentState === 'scr') {
        renderResults(_currentList, nav.curI);
    } else {
        const sb = _currentList[0] ? _currentList[0]["中分類"] : null;
        if (sb) openItems(sb); else openLiquorPortal();
    }
}
export function cardNavToScr() { openScreening(); }
export function getCurrentState() { return _currentState; }

// =============================================
// ジャンル階層ナビ
// =============================================
function openMajor() {
    nav.updateNav("lq_major");
    let h = `<div class="label" id="lbl-back-major">◀ ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))].forEach(m => {
        h += `<div class="item mj-item" data-mj="${m}">📁 ${m}</div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');
    document.getElementById('lbl-back-major').addEventListener('click', openLiquorPortal);
    document.querySelectorAll('.mj-item').forEach(el =>
        el.addEventListener('click', () => openSub(el.dataset.mj)));
}

function openSub(mj) {
    nav.updateNav("lq_sub", mj);
    let h = `<div class="label" id="lbl-back-sub">◀ ${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]).filter(Boolean))].forEach(s => {
        h += `<div class="item sb-item" data-sb="${s}">📁 ${s}</div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');
    document.getElementById('lbl-back-sub').addEventListener('click', openMajor);
    document.querySelectorAll('.sb-item').forEach(el =>
        el.addEventListener('click', () => openItems(el.dataset.sb)));
}

function openItems(sb) {
    const list = nav.liquorData.filter(d => d["中分類"] === sb);
    nav.updateNav("lq_list", null, list);
    _currentList  = list;
    _currentState = "list";
    const mj = list[0] ? list[0]["大分類"] : "";
    let h = `<div class="label" id="lbl-back-items">◀ ${sb}</div>`;
    list.forEach(d => {
        const badge = priceBadge(d["市販価格"], d["大分類"]);
        h += `<div class="item list-item" data-gidx="${nav.liquorData.indexOf(d)}" style="display:flex; align-items:center; gap:4px;">${badge}<span style="overflow:hidden; text-overflow:ellipsis;">${clean(d['銘柄名'])}</span></div>`;
    });
    setListView(h, false);
    if (_renderConsole) _renderConsole('standard');
    document.getElementById('lbl-back-items').addEventListener('click', () => openSub(mj));
    document.querySelectorAll('.list-item').forEach(el =>
        el.addEventListener('click', () => showCard(parseInt(el.dataset.gidx), list, 'list')));
}

// =============================================
// 戻るハンドラ
// =============================================
export function handleLiquorBack() {
    switch (nav.state) {
        case "lq_card":    cardNavToList();     return true;
        case "lq_res":     openScreening();     return true;
        case "lq_list":    openSub(nav.curG);   return true;
        case "lq_sub":     openMajor();         return true;
        case "lq_major":   openLiquorPortal();  return true;
        case "lq_scr":     openLiquorPortal();  return true;
        default:           return false;
    }
}

// =============================================
// コンソール用export
// =============================================
export function execScr()                  { executeScr(); }
export function clearScr()                 { scrState = initScrState(); openScreening(); }
export function openScreeningFromConsole() { openScreening(); }
