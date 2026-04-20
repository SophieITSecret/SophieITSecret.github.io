/**
 * Bar Sophie v21.0 — app_m.js
 * 設計方針:
 *   - onclick属性・window.関数名は一切使わない（ES Modules スコープ問題を回避）
 *   - イベントはすべて innerHTML 設定後に直接 addEventListener で設定
 *   - 状態管理は scrState と nav モジュールに集約
 */

import * as media from './media.js';
import * as nav from './navigation.js';

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
let isMusicMode = false;
let talkAudio;
let lv, nm, monImg, ytWrapper, ytPlayer, ytReady = false;

// =============================================
// 初期化
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    lv        = document.getElementById('list-view');
    nm        = document.getElementById('nav-main');
    monImg    = document.getElementById('monitor-img');
    ytWrapper = document.getElementById('yt-wrapper');
    talkAudio = document.createElement('audio');
    document.body.appendChild(talkAudio);

    try {
        await nav.loadAllData();
    } catch (e) {
        alert("データの読み込みに失敗しました。");
        return;
    }
    setup();

    // YouTube IFrame API 読み込み
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
});

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('yt-player', {
        playerVars: { playsinline: 1, autoplay: 0, rel: 0, controls: 1 },
        events: { onReady: () => { ytReady = true; } }
    });
};

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

    document.getElementById('btn-music').addEventListener('click', openMusic);
    document.getElementById('btn-talk').addEventListener('click', openTalk);
    document.getElementById('btn-liquor').addEventListener('click', openLiquorPortal);

    // ソフィーアイコン → 常にメイン画面（3ボタン）へ戻る
    document.getElementById('sophie-warp').addEventListener('click', showRoot);

    renderConsole('standard');
}

// =============================================
// ユーティリティ
// =============================================
function playVoice(src, txt) {
    talkAudio.src = src;
    talkAudio.play().catch(() => { try { media.speak(txt); } catch(e){} });
}

function clean(s) { return (s || "").toString().replace(/"/g, ''); }

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

function showLSide() { const el = document.querySelector('.l-side'); if (el) el.style.display = ''; }
function hideLSide() { const el = document.querySelector('.l-side'); if (el) el.style.display = 'none'; }

// 共通リスト描画（fullScreen=trueでl-sideを隠す）
function setListView(h, fullScreen) {
    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    document.getElementById('main-scroll').scrollTop = 0;
    if (fullScreen) hideLSide(); else showLSide();
}

function highlightItem(el) {
    document.querySelectorAll('#list-view .item').forEach(e => e.classList.remove('active-item'));
    el.classList.add('active-item');
}

function showTelopTemp(txt) {
    const tel = document.getElementById('telop');
    if (!tel) return;
    tel.innerText = txt;
    tel.style.display = 'block';
    setTimeout(() => { tel.style.display = 'none'; }, 4000);
}

function extractYtId(u) {
    if (!u) return "";
    const m = u.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/)([^"&?\/\s]{11})/i);
    return m ? m[1] : u;
}

// =============================================
// メインメニューへ戻る
// =============================================
function showRoot() {
    lv.style.display = 'none';
    nm.style.display = 'block';
    nav.updateNav("none");
    monImg.src = './front_sophie.jpeg';
    monImg.style.display = 'block';
    if (ytWrapper) ytWrapper.style.display = 'none';
    showLSide();
    isMusicMode = false;
    renderConsole('standard');
}

// =============================================
// 音楽選曲
// =============================================
function openMusic() {
    nav.updateNav("art");
    isMusicMode = true;

    const preferredOrder = ['E', 'F', 'J', 'W', 'I', 'S'];
    const genres = [...new Set(nav.jData.map(d => d.f))].sort((a, b) => {
        const ia = preferredOrder.indexOf(a), ib = preferredOrder.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });

    let h = `<div class="label" id="lbl-back-music">◀ 音楽を選ぶ</div>`;
    h += `<div class="list-section-label">マスターお薦め</div>`;
    ['ソフィー', 'BGM', '昭和ソング'].forEach(t => {
        h += `<div class="item music-special" data-special="${t}">🎤 ${t}</div>`;
    });
    genres.forEach(f => {
        const artists = [...new Set(nav.jData.filter(d => d.f === f).map(d => d.a))];
        if (!artists.length) return;
        const gName = nav.jData.find(d => d.f === f)?.gName || f;
        h += `<div class="list-section-label">${gName}</div>`;
        artists.forEach(a => { h += `<div class="item music-artist" data-artist="${a}">🎤 ${a}</div>`; });
    });

    setListView(h, false);
    renderConsole('standard');

    document.getElementById('lbl-back-music').addEventListener('click', showRoot);
    document.querySelectorAll('.music-special').forEach(el =>
        el.addEventListener('click', () => openSpecialSongs(el.dataset.special)));
    document.querySelectorAll('.music-artist').forEach(el =>
        el.addEventListener('click', () => openSongList(el.dataset.artist)));
}

function openSpecialSongs(type) {
    let filtered = [];
    if (type === 'ソフィー')      filtered = nav.jData.filter(d => d.a && d.a.includes('ソフィー'));
    else if (type === 'BGM')       filtered = nav.jData.filter(d => d.a === 'BGM');
    else if (type === '昭和ソング') filtered = nav.jData.filter(d => ['70s','昭和','演歌','歌姫'].includes(d.a));
    nav.updateNav("tit", type, filtered, 0);
    renderSongList(type, filtered);
}

function openSongList(artist) {
    const songs = nav.jData.filter(d => d.a === artist);
    nav.updateNav("tit", artist, songs, 0);
    renderSongList(artist, songs);
}

function renderSongList(title, songs) {
    let h = `<div class="label" id="lbl-back-songs">◀ ${title}</div>`;
    songs.forEach((s, i) => {
        const isSignal = s.ti && (s.ti.includes('みずいろのシグナル') || s.ti.includes('水色のシグナル'));
        h += `<div class="item song-item" data-idx="${i}" ${isSignal ? 'style="color:var(--blue)"' : ''}>🎵 ${s.ti}</div>`;
    });
    setListView(h, false);
    renderConsole('standard');

    document.getElementById('lbl-back-songs').addEventListener('click', openMusic);
    document.querySelectorAll('.song-item').forEach(el => {
        el.addEventListener('click', () => {
            const i = parseInt(el.dataset.idx);
            nav.updateNav(undefined, undefined, undefined, i);
            playSong(songs[i]);
            highlightItem(el);
        });
    });
}

function playSong(song) {
    isMusicMode = true;
    const vid = extractYtId(song.u);
    if (vid && ytReady && ytPlayer) {
        monImg.style.display = 'none';
        ytWrapper.style.display = 'block';
        ytPlayer.loadVideoById(vid);
    }
    showTelopTemp(`♪ ${song.a}「${song.ti}」`);
}

// =============================================
// お酒の話
// =============================================
function openTalk() {
    nav.updateNav("g");
    isMusicMode = false;

    const genres = [...new Set(nav.tData.map(d => d.g).filter(Boolean))];
    let h = `<div class="label" id="lbl-back-talk">◀ お酒の話</div>`;
    genres.forEach(g => { h += `<div class="item talk-genre" data-g="${g}">📁 ${g}</div>`; });

    setListView(h, false);
    renderConsole('standard');

    document.getElementById('lbl-back-talk').addEventListener('click', showRoot);
    document.querySelectorAll('.talk-genre').forEach(el =>
        el.addEventListener('click', () => openTalkThemes(el.dataset.g)));
}

function openTalkThemes(genre) {
    nav.updateNav("th", genre);
    const themes = [...new Set(nav.tData.filter(d => d.g === genre).map(d => d.th).filter(Boolean))];
    let h = `<div class="label" id="lbl-back-themes">◀ ${genre}</div>`;
    themes.forEach(t => { h += `<div class="item talk-theme" data-th="${t}">🏷️ ${t}</div>`; });

    setListView(h, false);
    renderConsole('standard');

    document.getElementById('lbl-back-themes').addEventListener('click', openTalk);
    document.querySelectorAll('.talk-theme').forEach(el =>
        el.addEventListener('click', () => openTalkStories(el.dataset.th)));
}

function openTalkStories(theme) {
    const stories = nav.tData.filter(d => d.th === theme);
    nav.updateNav("st", theme, stories, 0);
    let h = `<div class="label" id="lbl-back-stories">◀ ${theme}</div>`;
    stories.forEach((s, i) => { h += `<div class="item story-item" data-idx="${i}">📖 ${s.ti}</div>`; });

    setListView(h, false);
    renderConsole('standard');

    document.getElementById('lbl-back-stories').addEventListener('click', () => openTalkThemes(nav.curG));
    document.querySelectorAll('.story-item').forEach(el => {
        el.addEventListener('click', () => {
            const i = parseInt(el.dataset.idx);
            nav.updateNav(undefined, undefined, undefined, i);
            showStory(stories[i]);
            highlightItem(el);
        });
    });
}

function showStory(story) {
    monImg.src = `./talk_images/${story.id}.jpg`;
    monImg.style.display = 'block';
    if (ytWrapper) ytWrapper.style.display = 'none';
    const tel = document.getElementById('telop');
    if (tel) { tel.innerText = story.txt || story.ti; tel.style.display = 'block'; tel.scrollTop = 0; }
    playVoice(`./voices_mp3/${story.id}.mp3`, story.txt || story.ti);
}

// =============================================
// お酒データベース — 入口
// =============================================
function openLiquorPortal() {
    nav.updateNav("lq_root");
    const h = `
        <div class="label" style="justify-content:center; cursor:default;">お酒を選ぶ</div>
        <button class="act-btn" id="btn-portal-cat" style="background:#2c3e50; margin:15px; width:calc(100% - 30px);">📁 リストから探す</button>
        <button class="act-btn" id="btn-portal-scr" style="background:#d35400; margin:0 15px 15px; width:calc(100% - 30px);">🔍 お好みでスクリーニング</button>
        <div class="direct-box-new">
            <div class="direct-lbl">No.検索</div>
            <input type="number" id="dir-num" placeholder="番号">
            <button id="dir-go">開く</button>
        </div>`;
    setListView(h, false);
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

    const majors = [...new Set(nav.liquorData.map(d => d["大分類"]).filter(Boolean))];

    const subs = scrState.major
        ? [...new Set(nav.liquorData.filter(d => d["大分類"] === scrState.major).map(d => d["中分類"]).filter(Boolean))]
        : [];

    // 国：ジャンル＋品目で絞り込み
    const countryFiltered = nav.liquorData.filter(d =>
        (!scrState.major || d["大分類"] === scrState.major) &&
        (!scrState.sub   || d["中分類"] === scrState.sub));
    const countries = [...new Set(countryFiltered.map(d => d["国"]).filter(Boolean))].sort();

    // 地域：ジャンル＋品目＋国で絞り込み
    const regionFiltered = nav.liquorData.filter(d =>
        (!scrState.major   || d["大分類"] === scrState.major) &&
        (!scrState.sub     || d["中分類"] === scrState.sub) &&
        (!scrState.country || d["国"]     === scrState.country));
    const regions = [...new Set(regionFiltered.map(d => d["産地"]).filter(Boolean))].sort();

    const opt = (val, cur) => `<option value="${val}" ${cur === val ? 'selected' : ''}>${val}</option>`;
    const sel = (id, cur, arr) =>
        `<select id="${id}"><option value="">問わない</option>${arr.map(v => opt(v, cur)).join('')}</select>`;

    const a4    = (scrState.sub && AXIS4_MAP[scrState.sub]) ? AXIS4_MAP[scrState.sub] : AXIS4_DEFAULT;
    const a4dis = !scrState.sub;

    // ★スライダー：minのz-indexを初期値3、maxを2に設定（タッチ時にJSで切り替え）
    const mkSlider = (id, lbl, left, right, min, max, disabled) => `
        <div class="scr-axis-title">${lbl}</div>
        <div class="scr-slider-box" style="opacity:${disabled ? 0.35 : 1}; pointer-events:${disabled ? 'none' : 'auto'};">
            <div class="scr-slider-label-edge">${left}</div>
            <div class="multi-range-wrap">
                <div class="multi-range-track"></div>
                <div class="multi-range-fill" id="${id}-fill"></div>
                <input type="range" id="${id}-min" min="-2.0" max="2.0" step="0.5" value="${min}" style="z-index:3;">
                <input type="range" id="${id}-max" min="-2.0" max="2.0" step="0.5" value="${max}" style="z-index:2;">
            </div>
            <div class="scr-slider-label-edge">${right}</div>
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

    // ★ fullScreen=true → l-sideを隠して全画面表示
    setListView(h, true);
    renderConsole('screening');

    document.getElementById('lbl-back-scr').addEventListener('click', openLiquorPortal);

    // ジャンル・品目・国 → 保存して再描画（連動）
    ['s-mj', 's-sb', 's-cn'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            saveForm();
            openScreening();
        });
    });
    document.getElementById('s-rg').addEventListener('change', saveForm);

    ['s1', 's2', 's3', 's4'].forEach(id => attachSlider(id));

    document.querySelectorAll('.scr-tag-btn').forEach(btn => {
        btn.addEventListener('click', () => { btn.classList.toggle('selected'); saveForm(); });
    });
}

// =============================================
// ダブルスライダー
// ★ CSSのz-indexは初期値のみ。タッチ時にJSで前面切り替えして左つまみ問題を解消
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

        // ★ 操作した側を前面に（左つまみが右つまみの下に潜る問題を解消）
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
    scrState.tags = Array.from(document.querySelectorAll('.scr-tag-btn.selected')).map(el => el.dataset.tag);
}

// =============================================
// スクリーニング実行
// =============================================
function executeScr() {
    saveForm();

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
            const dTags = ((d["味わいタグ"] || "") + "," + (d["検索タグ"] || ""))
                .split(',').map(t => t.trim());
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

    let h = `<div class="label" id="lbl-back-res">◀ 検索結果: ${results.length}件</div>`;
    h += `<button class="btn-back-scr" id="btn-mod-scr">🔍 検索条件を変更する</button>`;
    results.forEach(d => {
        const gIdx = nav.liquorData.indexOf(d);
        h += `<div class="item res-item" data-gidx="${gIdx}">🥃 ${clean(d['銘柄名'])}</div>`;
    });

    setListView(h, true);
    renderConsole('result');

    document.getElementById('lbl-back-res').addEventListener('click', openLiquorPortal);
    document.getElementById('btn-mod-scr').addEventListener('click', openScreening);
    document.querySelectorAll('.res-item').forEach(el => {
        el.addEventListener('click', () => showCard(parseInt(el.dataset.gidx), results));
    });

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
    nav.updateNav("lq_card", null, list, gIdx);
    const d = nav.liquorData[gIdx];
    if (!d) return;

    const toPos = v => { const n = parseFloat(v); if (isNaN(n)) return -1; return Math.min(100, Math.max(0, (n + 2) / 4 * 100)); };
    const mkBar = (ll, rl, gpt, gem, cla, claudeOnly = false) => {
        let h = `<div class="graph-row-inline"><div class="graph-label-inline">${ll}</div><div class="graph-bar-bg"><div class="graph-zero"></div>`;
        if (!claudeOnly) {
            if (toPos(gpt) >= 0) h += `<div class="graph-point pt-gpt"    style="left:${toPos(gpt)}%"></div>`;
            if (toPos(gem) >= 0) h += `<div class="graph-point pt-gemini" style="left:${toPos(gem)}%"></div>`;
        }
        if (toPos(cla) >= 0)     h += `<div class="graph-point pt-claude" style="left:${toPos(cla)}%"></div>`;
        return h + `</div><div class="graph-label-inline">${rl}</div></div>`;
    };

    const sub  = (d["中分類"] || "").trim();
    const a4   = AXIS4_MAP[sub] || AXIS4_DEFAULT;
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
    if (d["鑑定評価(200字)"]) h += `<div class="lq-desc">${d["鑑定評価(200字)"]}</div>`;
    h += `</div>`;

    setListView(h, true);
    renderConsole('standard');

    const btnBack = document.getElementById('c-back');
    if (btnBack && nav.curG === null) {
        btnBack.textContent      = '候補へ戻る';
        btnBack.style.background = '#d35400';
        btnBack.style.color      = '#fff';
        btnBack.style.border     = '1px solid #e67e22';
        btnBack.style.fontSize   = '0.75rem';
    }
}

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
    renderConsole('standard');
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
    renderConsole('standard');
    document.getElementById('lbl-back-sub').addEventListener('click', openMajor);
    document.querySelectorAll('.sb-item').forEach(el =>
        el.addEventListener('click', () => openItems(el.dataset.sb)));
}

function openItems(sb) {
    const list = nav.liquorData.filter(d => d["中分類"] === sb);
    nav.updateNav("lq_list", null, list);
    const mj = list[0] ? list[0]["大分類"] : "";
    let h = `<div class="label" id="lbl-back-items">◀ ${sb}</div>`;
    list.forEach(d => {
        h += `<div class="item list-item" data-gidx="${nav.liquorData.indexOf(d)}">🥃 ${clean(d['銘柄名'])}</div>`;
    });
    setListView(h, false);
    renderConsole('standard');
    document.getElementById('lbl-back-items').addEventListener('click', () => openSub(mj));
    document.querySelectorAll('.list-item').forEach(el =>
        el.addEventListener('click', () => showCard(parseInt(el.dataset.gidx), list)));
}

// =============================================
// 戻るハンドラ
// =============================================
function handleBack() {
    switch (nav.state) {
        case "lq_card":
            if (nav.curG === null) {
                renderResults(nav.curP, nav.curI); // 候補へ戻る＋スクロール復元
            } else {
                const sub = nav.curP && nav.curP[0] ? nav.curP[0]["中分類"] : null;
                if (sub) openItems(sub); else openLiquorPortal();
            }
            break;
        case "lq_res":    openScreening();           break;
        case "lq_list":   openSub(nav.curG);         break;
        case "lq_sub":    openMajor();               break;
        case "lq_major":  openLiquorPortal();        break;
        case "lq_scr":    openLiquorPortal();        break;
        case "st":        openTalkStories(nav.curG); break;
        case "th":        openTalkThemes(nav.curG);  break;
        case "g":         openTalk();                break;
        case "tit":       openMusic();               break;
        default:          showRoot();                break;
    }
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
            scrState = initScrState(); openScreening();
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
            showLSide();
            setTimeout(() => { if (nav.state.includes('lq')) hideLSide(); }, 4000);
            playVoice("./voices_mp3/what_order.mp3", "何になさいますか？");
        });

        document.getElementById('c-stop').addEventListener('click', () => {
            if (ytReady && ytPlayer) ytPlayer.pauseVideo();
            talkAudio.pause();
        });

        document.getElementById('c-nxt').addEventListener('click', () => {
            if (nav.state === "lq_card" && nav.curP && nav.curP.length > 0) {
                const cur  = nav.liquorData[nav.curI];
                const idx  = nav.curP.indexOf(cur);
                const next = nav.curP[(idx + 1) % nav.curP.length];
                showCard(nav.liquorData.indexOf(next), nav.curP);
            }
        });
    }
}