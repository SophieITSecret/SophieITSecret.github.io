/**
 * Bar Sophie v21.0 — app_m.js
 * 設計方針:
 *   - onclick属性・window.関数名は一切使わない（ES Modules スコープ問題を回避）
 *   - イベントはすべて render() 後に直接 addEventListener で設定
 *   - 状態管理は scrState と nav モジュールに集約
 *   - renderResults() が nav.curP にリストを渡し、戻る時もそれを使う
 */

import * as media from './media.js';
import * as nav from './navigation.js';

// =============================================
// 第4軸マッピング
// =============================================
const AXIS4_MAP = {
    "スコッチ・シングルモルト":     { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "スコッチ・ブレンデッド":       { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "アイリッシュウイスキー":       { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "カナディアンウイスキー":       { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "ジャパニーズウイスキー":       { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "ライウイスキー":               { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "その他ウイスキー":             { label: "スモーキー度",  left: "無煙",    right: "煙強"   },
    "バーボン":                     { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",  right: "深熟"   },
    "テネシーウイスキー":           { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",  right: "深熟"   },
    "コニャック":                   { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",  right: "深熟"   },
    "アルマニャック":               { label: "樽熟成感",      left: "ﾌﾚｯｼｭ",  right: "深熟"   },
    "カルヴァドス":                 { label: "リンゴ感",      left: "淡林",    right: "強林"   },
    "赤ワイン":                     { label: "タンニン",      left: "なめらか", right: "力強い渋" },
    "白ワイン":                     { label: "酸味",          left: "丸く",    right: "シャープ" },
    "ロゼワイン":                   { label: "酸味",          left: "丸く",    right: "シャープ" },
    "オレンジワイン":               { label: "酸味",          left: "丸く",    right: "シャープ" },
    "シェリー・酒精強化":           { label: "ナッツ感",      left: "淡果",    right: "強果"   },
    "シャンパン":                   { label: "辛口度",        left: "甘泡",    right: "辛泡"   },
    "プロセッコ・フランチャコルタ": { label: "辛口度",        left: "甘泡",    right: "辛泡"   },
    "純米大吟醸":                   { label: "旨味",          left: "淡麗",    right: "濃醇"   },
    "純米吟醸":                     { label: "旨味",          left: "淡麗",    right: "濃醇"   },
    "特別純米・純米":               { label: "旨味",          left: "淡麗",    right: "濃醇"   },
    "本醸造・その他":               { label: "旨味",          left: "淡麗",    right: "濃醇"   },
    "スパークリング日本酒":         { label: "旨味",          left: "淡麗",    right: "濃醇"   },
    "芋焼酎":                       { label: "芋の素材感",    left: "クリーン", right: "素材前面" },
    "麦焼酎":                       { label: "麦の素材感",    left: "クリーン", right: "香ばしい" },
    "米焼酎":                       { label: "米の素材感",    left: "クリーン", right: "米の甘み" },
    "黒糖焼酎":                     { label: "黒糖感",        left: "あっさり", right: "深み強い" },
    "泡盛":                         { label: "古酒感",        left: "若い",    right: "深み"   },
    "ジン（銘柄）":                 { label: "ﾎﾞﾀﾆｶﾙ感",    left: "クリーン", right: "複雑個性" },
    "ウォッカ（銘柄）":             { label: "クリーン度",    left: "個性あり", right: "純粋"   },
    "テキーラ（銘柄）":             { label: "アガベ感",      left: "弱い",    right: "強く主張" },
    "ラム（銘柄）":                 { label: "糖蜜・樽感",    left: "ライト",  right: "濃厚"   },
    "ベルモット・アペリティフ":     { label: "薬草感",        left: "淡草",    right: "強草"   },
    "国内プレミアム":               { label: "苦味",          left: "苦みなし", right: "苦味強" },
    "海外メジャー":                 { label: "苦味",          left: "苦みなし", right: "苦味強" },
    "クラフトビール":               { label: "苦味",          left: "苦みなし", right: "苦味強" },
    "梅酒":                         { label: "熟成感",        left: "若梅",    right: "熟梅"   },
    "和リキュール":                 { label: "素材感",        left: "淡素",    right: "強素"   },
    "ウイスキー系カクテル":         { label: "酸味",          left: "無酸",    right: "酸強"   },
    "ウォッカ系カクテル":           { label: "酸味",          left: "無酸",    right: "酸強"   },
    "ジン系カクテル":               { label: "酸味",          left: "無酸",    right: "酸強"   },
    "ラム系カクテル":               { label: "酸味",          left: "無酸",    right: "酸強"   },
    "テキーラ系カクテル":           { label: "酸味",          left: "無酸",    right: "酸強"   },
    "ブランデー系カクテル":         { label: "酸味",          left: "無酸",    right: "酸強"   },
    "リキュール系カクテル":         { label: "酸味",          left: "無酸",    right: "酸強"   },
    "クラシックカクテル":           { label: "酸味",          left: "無酸",    right: "酸強"   },
};
const AXIS4_DEFAULT = { label: "第4軸(品目選択後)", left: "←", right: "→", disabled: true };

// =============================================
// 状態管理
// =============================================
const initScrState = () => ({
    major: "", sub: "", country: "", region: "", keyword: "",
    cospa: "", isStandard: "", isSophieRecom: "",
    s1Min: -2.0, s1Max: 2.0,
    s2Min: -2.0, s2Max: 2.0,
    s3Min: -2.0, s3Max: 2.0,
    s4Min: -2.0, s4Max: 2.0,
    tags: []
});
let scrState = initScrState();

// DOM参照（DOMContentLoaded後に設定）
let lv, nm, monImg, talkAudio;

// =============================================
// 初期化
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    lv      = document.getElementById('list-view');
    nm      = document.getElementById('nav-main');
    monImg  = document.getElementById('monitor-img');
    talkAudio = document.createElement('audio');
    document.body.appendChild(talkAudio);

    try {
        await nav.loadAllData();
    } catch (e) {
        alert("データの読み込みに失敗しました。");
        return;
    }
    setup();
});

// =============================================
// セットアップ
// =============================================
function setup() {
    document.getElementById('btn-enter').addEventListener('click', () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        playVoice("./voices_mp3/greeting.mp3", "いらっしゃいませ。");
    });

    document.getElementById('btn-to-bar').addEventListener('click', () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        showRoot();
        playVoice("./voices_mp3/menu_greeting.mp3", "今日はいかがされますか？");
    });

    document.getElementById('btn-liquor').addEventListener('click', openLiquorPortal);
    document.getElementById('btn-music').addEventListener('click', openMusic);
    document.getElementById('btn-talk').addEventListener('click', openTalk);

    document.getElementById('sophie-warp').addEventListener('click', () => {
        if (nav.state !== "none") showRoot();
    });

    renderConsole('standard');
}

// =============================================
// ユーティリティ
// =============================================
function playVoice(src, txt) {
    talkAudio.src = src;
    talkAudio.play().catch(() => media.speak(txt));
}

function clean(s) {
    return (s || "").toString().replace(/"/g, '');
}

function formatAbv(val) {
    if (!val || val === "-") return "-";
    const s = val.toString();
    if (s.includes('%') || s.includes('度')) return s;
    const n = parseFloat(s);
    if (isNaN(n)) return s;
    return (n > 0 && n <= 1.0 ? Math.round(n * 100) : n) + "%";
}

function avg3(a, b, c) {
    const vs = [a, b, c].map(Number).filter(v => !isNaN(v));
    return vs.length ? vs.reduce((x, y) => x + y) / vs.length : 0;
}

// =============================================
// ルート・メインメニュー
// =============================================
function showRoot() {
    lv.style.display = 'none';
    nm.style.display = 'block';
    nav.updateNav("none");
    monImg.src = './front_sophie.jpeg';
    renderConsole('standard');
}

// =============================================
// お酒データベース — 入口
// =============================================
function openLiquorPortal() {
    nav.updateNav("lq_root");
    lv.innerHTML = `
        <div class="label" style="justify-content:center;">お酒を選ぶ</div>
        <button class="act-btn" id="btn-portal-cat" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>
        <button class="act-btn" id="btn-portal-scr" style="background:#d35400; margin:0 15px 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>
        <div class="direct-box-new">
            <div class="direct-lbl">No.検索</div>
            <input type="number" id="dir-num" placeholder="番号">
            <button id="dir-go">開く</button>
        </div>`;
    nm.style.display = 'none';
    lv.style.display = 'block';
    renderConsole('standard');

    document.getElementById('btn-portal-cat').addEventListener('click', openMajor);
    document.getElementById('btn-portal-scr').addEventListener('click', openScreening);
    document.getElementById('dir-go').addEventListener('click', () => {
        const v = document.getElementById('dir-num').value;
        const t = nav.liquorData.find(d => d["No"] == v);
        if (t) showCard(nav.liquorData.indexOf(t), nav.liquorData);
        else alert("No." + v + " は見つかりませんでした。");
    });
}

// =============================================
// スクリーニング — UI描画
// =============================================
function openScreening() {
    nav.updateNav("lq_scr");

    // 連動データ生成
    const majors    = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];
    const subs      = scrState.major
        ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]).filter(Boolean))]
        : [];
    const countries = [...new Set(nav.liquorData
        .filter(d => (!scrState.major || d["大分類"] === scrState.major) && (!scrState.sub || d["中分類"] === scrState.sub))
        .map(d => d["国"]).filter(Boolean))].sort();
    const regions   = [...new Set(nav.liquorData
        .filter(d => !scrState.country || d["国"] === scrState.country)
        .map(d => d["産地"]).filter(Boolean))].sort();

    const opt = (val, cur) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${val}</option>`;
    const selBox = (id, cur, arr) =>
        `<select id="${id}"><option value="">問わない</option>${arr.map(v => opt(v, cur)).join('')}</select>`;

    // 第4軸設定
    const a4      = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    const a4dis   = !scrState.sub;

    // スライダーHTML生成
    const mkSlider = (id, lbl, left, right, min, max, disabled) => `
        <div class="scr-axis-title">${lbl}</div>
        <div class="scr-slider-box" style="opacity:${disabled ? 0.35 : 1}; pointer-events:${disabled ? 'none' : 'auto'};">
            <div class="scr-slider-label-edge">${left}</div>
            <div class="multi-range-wrap">
                <div class="multi-range-track"></div>
                <div class="multi-range-fill" id="${id}-fill"></div>
                <input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${min}">
                <input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${max}">
            </div>
            <div class="scr-slider-label-edge">${right}</div>
        </div>`;

    // タグ
    const allTags = new Set();
    nav.liquorData.forEach(d => {
        ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || ""))
            .split(',').forEach(t => { if (t.trim()) allTags.add(t.trim()); });
    });
    const tagHtml = Array.from(allTags).sort().map(t =>
        `<div class="scr-tag-btn ${scrState.tags.includes(t) ? 'selected' : ''}" data-tag="${t}">${t}</div>`
    ).join('');

    lv.innerHTML = `
        <div class="label" id="lbl-back-scr">◀ お好みでスクリーニング</div>
        <div class="scr-container">
            <div class="scr-group">
                <div class="scr-title">ジャンル・品目・産地</div>
                <div class="scr-row"><span class="scr-row-label">ジャンル:</span>${selBox('s-mj', scrState.major, majors)}</div>
                <div class="scr-row"><span class="scr-row-label">品目:</span>${selBox('s-sb', scrState.sub, subs)}</div>
                <div class="scr-row"><span class="scr-row-label">国:</span>${selBox('s-cn', scrState.country, countries)}</div>
                <div class="scr-row"><span class="scr-row-label">地域:</span>${selBox('s-rg', scrState.region, regions)}</div>
                <div class="scr-row"><span class="scr-row-label">検索:</span><input type="text" id="s-kw" value="${scrState.keyword}" placeholder="名称・タグ・解説など"></div>
            </div>
            <div class="scr-group">
                <div class="scr-title">フィルター</div>
                <div class="scr-row"><span class="scr-row-label">定番:</span>
                    <select id="s-std"><option value="">問わない</option><option value="○" ${scrState.isStandard === '○' ? 'selected' : ''}>定番に絞る</option></select></div>
                <div class="scr-row"><span class="scr-row-label">推し:</span>
                    <select id="s-sop"><option value="">問わない</option><option value="★" ${scrState.isSophieRecom === '★' ? 'selected' : ''}>推しを聞く</option></select></div>
                <div class="scr-row"><span class="scr-row-label">ｺｽﾊﾟ:</span>
                    <select id="s-cos"><option value="">問わない</option>
                        <option value="1" ${scrState.cospa === '1' ? 'selected' : ''}>☆1以上</option>
                        <option value="2" ${scrState.cospa === '2' ? 'selected' : ''}>☆☆以上</option>
                        <option value="3" ${scrState.cospa === '3' ? 'selected' : ''}>☆☆☆のみ</option></select></div>
            </div>
            <div class="scr-group">
                <div class="scr-title">味わい指定</div>
                ${mkSlider('s1', '甘辛', '辛口', '甘口', scrState.s1Min, scrState.s1Max, false)}
                ${mkSlider('s2', 'ボディ', '軽快', '濃厚', scrState.s2Min, scrState.s2Max, false)}
                ${mkSlider('s3', '個性', '常道', '独特', scrState.s3Min, scrState.s3Max, false)}
                ${mkSlider('s4', a4.label, a4.left, a4.right, scrState.s4Min, scrState.s4Max, a4dis)}
            </div>
            <div class="scr-group">
                <div class="scr-title">タグ選択</div>
                <div class="scr-tag-grid">${tagHtml}</div>
            </div>
        </div>`;

    nm.style.display = 'none';
    lv.style.display = 'block';
    renderConsole('screening');

    // ---- イベント設定 ----

    // 戻るラベル
    document.getElementById('lbl-back-scr').addEventListener('click', openLiquorPortal);

    // 連動プルダウン（ジャンル・品目・国 → 再描画）
    ['s-mj', 's-sb', 's-cn'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            saveForm();
            openScreening();
        });
    });

    // 地域は再描画不要（値保存のみ）
    document.getElementById('s-rg').addEventListener('change', saveForm);

    // スライダー
    ['s1', 's2', 's3', 's4'].forEach(id => attachSlider(id));

    // タグ
    document.querySelectorAll('.scr-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('selected');
            saveForm();
        });
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

        // つまみ交差防止
        if (v1 > v2) {
            if (e && e.target === minEl) { v1 = v2; minEl.value = v1; }
            else                         { v2 = v1; maxEl.value = v2; }
        }

        // 操作したほうを前面に
        if (e) {
            e.target.style.zIndex = "10";
            (e.target === minEl ? maxEl : minEl).style.zIndex = "5";
        }

        // fill描画
        fillEl.style.left  = ((v1 + 2) / 4 * 100) + '%';
        fillEl.style.width = ((v2 - v1) / 4 * 100) + '%';

        // 状態保存
        scrState[id + 'Min'] = v1;
        scrState[id + 'Max'] = v2;
    };

    minEl.addEventListener('input', update);
    maxEl.addEventListener('input', update);
    update(); // 初期描画
}

// =============================================
// フォーム値の保存
// =============================================
function saveForm() {
    const g = id => document.getElementById(id)?.value ?? "";
    scrState.major        = g('s-mj');
    scrState.sub          = g('s-sb');
    scrState.country      = g('s-cn');
    scrState.region       = g('s-rg');
    scrState.keyword      = g('s-kw');
    scrState.isStandard   = g('s-std');
    scrState.isSophieRecom = g('s-sop');
    scrState.cospa        = g('s-cos');
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
}

// =============================================
// スクリーニング実行
// =============================================
function executeScr() {
    saveForm();

    const results = nav.liquorData.filter(d => {
        if (scrState.major      && d["大分類"]    !== scrState.major)      return false;
        if (scrState.sub        && d["中分類"]    !== scrState.sub)        return false;
        if (scrState.country    && d["国"]        !== scrState.country)    return false;
        if (scrState.region     && d["産地"]      !== scrState.region)     return false;
        if (scrState.isStandard && d["定番フラグ"] !== scrState.isStandard) return false;
        if (scrState.isSophieRecom && d["ソフィーの推し"] !== scrState.isSophieRecom) return false;

        // コスパ
        if (scrState.cospa) {
            const stars = (d["Gemini_コスパ"] || "").split('☆').length - 1;
            if (stars < parseInt(scrState.cospa)) return false;
        }

        // 味わい軸
        const v1 = avg3(d["GPT_甘辛"], d["Gemini_甘辛"], d["Claude_甘辛"]);
        if (v1 < scrState.s1Min || v1 > scrState.s1Max) return false;

        const v2 = avg3(d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);
        if (v2 < scrState.s2Min || v2 > scrState.s2Max) return false;

        const v3 = Number(d["Claude_個性"] || 0);
        if (v3 < scrState.s3Min || v3 > scrState.s3Max) return false;

        if (scrState.sub) {
            const v4 = Number(d["Claude_第4軸"] || 0);
            if (v4 < scrState.s4Min || v4 > scrState.s4Max) return false;
        }

        // タグ（OR条件）
        if (scrState.tags.length > 0) {
            const dTags = ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || ""))
                .split(',').map(t => t.trim());
            if (!scrState.tags.some(t => dTags.includes(t))) return false;
        }

        // キーワード
        if (scrState.keyword) {
            const blob = [d["銘柄名"], d["国"], d["産地"], d["味わいタグ"],
                          d["検索タグ"], d["鑑定評価(200字)"], d["ソフィーの裏話"]]
                .map(v => v || "").join(" ").toLowerCase();
            if (!blob.includes(scrState.keyword.toLowerCase())) return false;
        }

        return true;
    });

    renderResults(results);
}

// =============================================
// 検索結果リスト描画
// =============================================
function renderResults(results, scrollToGlobalIdx = null) {
    // nav.curP に results を格納（戻る時に再利用）
    nav.updateNav('lq_res', null, results);

    let h = `<div class="label" id="lbl-back-res">◀ 検索結果: ${results.length}件</div>`;
    h += `<button class="btn-back-scr" id="btn-mod-scr">🔍 検索条件を変更する</button>`;
    results.forEach(d => {
        const gIdx = nav.liquorData.indexOf(d);
        h += `<div class="item res-item" data-gidx="${gIdx}">🥃 ${clean(d['銘柄名'])}</div>`;
    });

    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    renderConsole('result');

    document.getElementById('lbl-back-res').addEventListener('click', openLiquorPortal);
    document.getElementById('btn-mod-scr').addEventListener('click', openScreening);
    document.querySelectorAll('.res-item').forEach(el => {
        el.addEventListener('click', () => {
            showCard(parseInt(el.dataset.gidx), results);
        });
    });

    // 戻ってきた時のスクロール復元
    if (scrollToGlobalIdx !== null) {
        setTimeout(() => {
            const t = lv.querySelector(`[data-gidx="${scrollToGlobalIdx}"]`);
            if (t) t.scrollIntoView({ block: 'center' });
        }, 50);
    }
}

// =============================================
// 個別銘柄カード
// =============================================
function showCard(gIdx, list) {
    // list を nav.curP に格納し、curI にグローバルインデックスを格納
    nav.updateNav("lq_card", null, list, gIdx);
    const d = nav.liquorData[gIdx];
    if (!d) return;

    // グラフ用ヘルパー
    const toPos = v => { const n = parseFloat(v); if (isNaN(n)) return -1; return Math.min(100, Math.max(0, (n + 2) / 4 * 100)); };
    const mkBar = (leftLbl, rightLbl, gpt, gem, cla, claudeOnly = false) => {
        let h = `<div class="graph-row-inline">
                   <div class="graph-label-inline">${leftLbl}</div>
                   <div class="graph-bar-bg"><div class="graph-zero"></div>`;
        if (!claudeOnly) {
            if (toPos(gpt) >= 0) h += `<div class="graph-point pt-gpt"    style="left:${toPos(gpt)}%"></div>`;
            if (toPos(gem) >= 0) h += `<div class="graph-point pt-gemini" style="left:${toPos(gem)}%"></div>`;
        }
        if (toPos(cla) >= 0)     h += `<div class="graph-point pt-claude" style="left:${toPos(cla)}%"></div>`;
        return h + `</div><div class="graph-label-inline">${rightLbl}</div></div>`;
    };

    const sub = (d["中分類"] || "").trim();
    const a4  = AXIS4_MAP[sub] || AXIS4_DEFAULT;

    // タグ
    const tags = ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || ""))
        .split(',').map(t => t.trim()).filter(Boolean);

    let h = `<div class="label">No.${d["No"]}</div><div class="lq-card">`;
    h += `<div class="lq-name">${clean(d["銘柄名"])}</div>`;
    if (d["ソフィーのセリフ"]) h += `<div class="lq-quote">${clean(d["ソフィーのセリフ"])}</div>`;

    h += `<div class="lq-basic-info">
            <div><span style="color:var(--blue)">▶</span> ${d["大分類"]}&nbsp;&nbsp;<span style="color:#e74c3c">▶</span> ${d["中分類"]}</div>
            <div><span style="color:#888">産地:</span> ${d["国"] || ""}${d["産地"] ? ' / ' + d["産地"] : ''}</div>`;
    if (d["製造元と創業年"] && d["製造元と創業年"] !== "-")
        h += `<div><span style="color:#888">製造:</span> ${d["製造元と創業年"]}</div>`;
    if (d["公式URL"] && d["公式URL"] !== "-")
        h += `<div style="margin-top:6px;"><a href="${d["公式URL"]}" target="_blank" class="lq-btn-small">🔗 メーカーサイト</a></div>`;
    h += `</div>`;

    h += `<div class="lq-split-view"><div class="lq-graph-half">`;
    if (d["Gemini_コスパ"])
        h += `<div class="lq-cospa">コスパ ${d["Gemini_コスパ"]}</div>`;

    // 第1・2軸：3社比較
    h += mkBar("辛口", "甘口", d["GPT_甘辛"],  d["Gemini_甘辛"],  d["Claude_甘辛"]);
    h += mkBar("軽快", "濃厚", d["GPT_ボディ"], d["Gemini_ボディ"], d["Claude_ボディ"]);

    // 第3・4軸：Claude専用
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

    if (d["ソフィーの裏話"])
        h += `<div class="lq-sophie-talk"><span class="sophie-prefix">[ソフィー]</span> ${d["ソフィーの裏話"]}</div>`;
    if (tags.length)
        h += `<div class="lq-tags">${tags.map(t => `<span class="lq-tag">${t}</span>`).join('')}</div>`;
    if (d["鑑定評価(200字)"])
        h += `<div class="lq-desc">${d["鑑定評価(200字)"]}</div>`;
    h += `</div>`;

    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    const ls = document.querySelector('.l-side');
    if (ls) ls.style.display = 'none';
    renderConsole('standard');

    // 「候補へ戻る」ボタンのスタイル
    const btnBack = document.getElementById('c-back');
    if (btnBack && nav.curG === null) {
        btnBack.textContent = '候補へ戻る';
        btnBack.style.background = '#d35400';
        btnBack.style.color = '#fff';
        btnBack.style.border = '1px solid #e67e22';
        btnBack.style.fontSize = '0.75rem';
    }
}

// =============================================
// ジャンル階層ナビ
// =============================================
function openMajor() {
    nav.updateNav("lq_major");
    let h = `<div class="label" id="lbl-back-mj">◀ ジャンルを選択</div>`;
    [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))].forEach(m => {
        h += `<div class="item mj-item" data-mj="${m}">📁 ${m}</div>`;
    });
    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    renderConsole('standard');

    document.getElementById('lbl-back-mj').addEventListener('click', openLiquorPortal);
    document.querySelectorAll('.mj-item').forEach(el => {
        el.addEventListener('click', () => openSub(el.dataset.mj));
    });
}

function openSub(mj) {
    nav.updateNav("lq_sub", mj);
    let h = `<div class="label" id="lbl-back-sub">◀ ${mj}</div>`;
    [...new Set(nav.liquorData.filter(d => d["大分類"] === mj).map(d => d["中分類"]).filter(Boolean))].forEach(s => {
        h += `<div class="item sb-item" data-sb="${s}">📁 ${s}</div>`;
    });
    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    renderConsole('standard');

    document.getElementById('lbl-back-sub').addEventListener('click', openMajor);
    document.querySelectorAll('.sb-item').forEach(el => {
        el.addEventListener('click', () => openItems(el.dataset.sb));
    });
}

function openItems(sb) {
    const list = nav.liquorData.filter(d => d["中分類"] === sb);
    nav.updateNav("lq_list", null, list);
    const mj = list[0] ? list[0]["大分類"] : "";
    let h = `<div class="label" id="lbl-back-items">◀ ${sb}</div>`;
    list.forEach(d => {
        const gIdx = nav.liquorData.indexOf(d);
        h += `<div class="item list-item" data-gidx="${gIdx}">🥃 ${clean(d['銘柄名'])}</div>`;
    });
    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    renderConsole('standard');

    document.getElementById('lbl-back-items').addEventListener('click', () => openSub(mj));
    document.querySelectorAll('.list-item').forEach(el => {
        el.addEventListener('click', () => showCard(parseInt(el.dataset.gidx), list));
    });
}

// =============================================
// 戻るハンドラ
// =============================================
function handleBack() {
    switch (nav.state) {
        case "lq_card":
            if (nav.curG === null) {
                // スクリーニング結果から来た → 候補リストに戻りスクロール復元
                renderResults(nav.curP, nav.curI);
            } else {
                // ジャンルリストから来た
                const sub = nav.curP && nav.curP[0] ? nav.curP[0]["中分類"] : null;
                if (sub) openItems(sub); else openLiquorPortal();
            }
            break;
        case "lq_res":    openScreening();    break;
        case "lq_list":   openSub(nav.curG);  break;
        case "lq_sub":    openMajor();         break;
        case "lq_major":  openLiquorPortal();  break;
        case "lq_scr":    openLiquorPortal();  break;
        default:          showRoot();           break;
    }
}

// =============================================
// 音楽・お酒の話（スタブ — 既存実装をここに移植）
// =============================================
function openMusic() {
    // ★ 既存の音楽選曲ロジックをここへ
}

function openTalk() {
    // ★ 既存のお酒の話ロジックをここへ
}

// =============================================
// コンソール（下部ボタンエリア）
// =============================================
function renderConsole(mode) {
    const grid = document.getElementById('console-grid');
    if (!grid) return;

    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="console-scr-btn" id="c-clr">クリア</button>
            <button class="console-scr-btn btn-c-exec" id="c-ex">検索実行</button>`;
        document.getElementById('c-clr').addEventListener('click', () => {
            scrState = initScrState();
            openScreening();
        });
        document.getElementById('c-ex').addEventListener('click', executeScr);

    } else if (mode === 'result') {
        grid.innerHTML = `<button class="console-scr-btn btn-c-mod" id="c-mod">🔍 条件変更</button>`;
        document.getElementById('c-mod').addEventListener('click', openScreening);

    } else {
        grid.innerHTML = `
            <button class="c-btn" id="c-exp">▼</button>
            <button class="c-btn" id="c-back">▲</button>
            <button class="c-btn" id="c-stop">⏹️</button>
            <button class="c-btn" id="c-nxt" style="flex:1.5">▶</button>
            <button class="c-btn" id="c-skip">⏭</button>`;

        document.getElementById('c-back').addEventListener('click', handleBack);

        document.getElementById('c-exp').addEventListener('click', () => {
            const ls = document.querySelector('.l-side');
            if (ls) {
                ls.style.display = 'block';
                setTimeout(() => { if (nav.state.includes('lq')) ls.style.display = 'none'; }, 4000);
            }
            playVoice("./voices_mp3/what_order.mp3", "何になさいますか？");
        });

        document.getElementById('c-nxt').addEventListener('click', () => {
            if (nav.state === "lq_card" && nav.curP && nav.curP.length > 0) {
                const curItem  = nav.liquorData[nav.curI];
                const listIdx  = nav.curP.indexOf(curItem);
                const nextItem = nav.curP[(listIdx + 1) % nav.curP.length];
                showCard(nav.liquorData.indexOf(nextItem), nav.curP);
            }
        });
    }
}