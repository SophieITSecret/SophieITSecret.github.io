/**
 * utils.js — 共通ユーティリティ
 * ★ このファイルは封印済みです。編集しないでください。
 */

// DOM参照（app_m.jsから初期化後にセットされる）
export let lv, nm, monImg, ytWrapper, tel;

export function initDom() {
    lv        = document.getElementById('list-view');
    nm        = document.getElementById('nav-main');
    monImg    = document.getElementById('monitor-img');
    ytWrapper = document.getElementById('yt-wrapper');
    tel       = document.getElementById('telop');
}

// 文字列クリーン
export function clean(s) {
    return (s || "").toString().replace(/"/g, '');
}

// 度数フォーマット
export function formatAbv(val) {
    if (!val || val === "-") return "-";
    const s = val.toString();
    if (s.includes('%') || s.includes('度')) return s;
    const n = parseFloat(s);
    if (isNaN(n)) return s;
    return (n > 0 && n <= 1.0 ? Math.round(n * 100) : n) + "%";
}

// 3値平均（NaN除外）
export function avg3(a, b, c) {
    const vs = [a, b, c].map(Number).filter(v => !isNaN(v));
    return vs.length ? vs.reduce((x, y) => x + y) / vs.length : 0;
}

// YouTube ID抽出
export function extractYtId(u) {
    if (!u) return "";
    const m = u.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return m ? m[1] : u;
}

// l-side 表示制御
export function showLSide() {
    const el = document.querySelector('.l-side');
    if (el) el.style.display = '';
}
export function hideLSide() {
    const el = document.querySelector('.l-side');
    if (el) el.style.display = 'none';
}

// リスト描画共通（fullScreen=trueでl-sideを隠す）
export function setListView(h, fullScreen) {
    nm.style.display = 'none';
    lv.style.display = 'block';
    lv.innerHTML = h;
    document.getElementById('main-scroll').scrollTop = 0;
    if (fullScreen) hideLSide(); else showLSide();
}

// アクティブ強調
export function highlightItem(el) {
    document.querySelectorAll('#list-view .item').forEach(e => e.classList.remove('active-item'));
    el.classList.add('active-item');
}
