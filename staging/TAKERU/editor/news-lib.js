// ============================================================
// ニュース（news.csv）の読み書きと、週次ダイジェストの取り込み
//   作業台（server.js）と土曜の自動取り込み（news-auto.js）の両方が使う。
//   CSVの形はここ1か所で決める。片方だけ直して列がずれるのを防ぐため。
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRETS_PATH = path.join(__dirname, 'secrets.json');

function parseCsvText(text) {
  const recs = []; let cur = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { if (q && text[i + 1] === '"') { f += '"'; i++; } else q = !q; }
    else if (c === ',' && !q) { cur.push(f); f = ''; }
    else if ((c === '\n' || (c === '\r' && text[i + 1] === '\n')) && !q) { if (c === '\r') i++; cur.push(f); recs.push(cur); cur = []; f = ''; }
    else f += c;
  }
  if (f !== '' || cur.length) { cur.push(f); recs.push(cur); }
  return recs;
}
function csvField(s) { s = String(s == null ? '' : s); return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function buildNewsCsv(items) {
  // 1記事1行。月次・年次は「上の層へ持ち上げる印」（3ヶ月表・年次表の絞り込みに使う）
  // 原URL … 翻訳リンクが将来使えなくなっても読み口を作り直せるよう控えておく（画面には出さない）
  const lines = [['ID', '日付', '種別', 'タイトル', '本文', '公開', '月次', '年次', '原URL'].join(',')];
  for (const it of items) {
    lines.push([it.id, it.date, it.type, it.title, it.body,
                (it.published ? '1' : ''), (it.monthly ? '1' : ''), (it.yearly ? '1' : ''),
                (it.srcUrl || '')]
               .map(csvField).join(','));
  }
  return '﻿' + lines.join('\r\n') + '\r\n';
}
function parseNewsCsv(data) {
  const recs = parseCsvText(String(data).replace(/^﻿/, ''));
  return recs.slice(1).filter(r => (r[0] || '').trim()).map(r => ({
    id: (r[0] || '').trim(), date: (r[1] || '').trim(), type: (r[2] || '').trim() || 'お知らせ',
    title: (r[3] || '').trim(), body: (r[4] || ''), published: (r[5] || '').trim() === '1',
    monthly: (r[6] || '').trim() === '1', yearly: (r[7] || '').trim() === '1',
    srcUrl: (r[8] || '').trim(),
  }));
}

// 読み込んだ時点の news.csv の指紋。保存のときに突き合わせ、
// 作業台を開いている間に自動取り込みが記事を足していたら、上書きせずに止める。
function newsStamp(p) {
  try { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex').slice(0, 16); }
  catch (e) { return ''; }
}
function readNews(p) {
  if (!fs.existsSync(p)) return { items: [], stamp: '' };
  const buf = fs.readFileSync(p);
  return { items: parseNewsCsv(buf.toString('utf8')),
           stamp: crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) };
}

// 担当Bの書式（### 日付 見出し ／ 要約 ／ [記事本文](…) ／ 原URL: …）を記事に分ける。
//   作業台の「📥 ダイジェストを取り込む」と同じ読み方。
//   取り込み済みの判定は「日付＋見出し」か「原URL」。担当Bが同じ記事に
//   別の見出しを付け直しても、原URLが同じなら二度入れない。
function parseDigest(text, items, today) {
  const blocks = String(text || '').split(/(?=^###\s)/m).filter(b => /^###\s/.test(b.trim()));
  const known = new Set(items.map(n => n.date + '\u0001' + n.title));
  const knownUrl = new Set(items.map(n => n.srcUrl).filter(Boolean));
  const added = [], skipped = [];
  for (const b of blocks) {
    const m = b.match(/^###\s*(\d{4}-\d{2}-\d{2})?\s*(.*)$/m);
    if (!m) continue;
    const date = m[1] || today;
    const title = (m[2] || '').trim();
    let body = b.split('\n').slice(1).join('\n').trim();
    if (!title) continue;
    let srcUrl = '';
    const um = body.match(/^\s*原URL[:：]\s*(\S+)\s*$/m);
    if (um) { srcUrl = um[1]; body = body.replace(um[0], '').trim(); }
    if (known.has(date + '\u0001' + title) || (srcUrl && knownUrl.has(srcUrl))) { skipped.push(title); continue; }
    known.add(date + '\u0001' + title);
    if (srcUrl) knownUrl.add(srcUrl);
    added.push({ date, type: 'ニュース', title, body, published: true, monthly: false, yearly: false, srcUrl });
  }
  return { added, skipped, blocks: blocks.length };
}
// 新しい記事に N0001 形式の通し番号を振る
function assignNewsIds(items, added) {
  let max = 0;
  for (const n of items) { const mm = /(\d+)$/.exec(n.id || ''); if (mm) max = Math.max(max, parseInt(mm[1], 10)); }
  added.forEach((a, i) => { a.id = 'N' + String(max + i + 1).padStart(4, '0'); });
  return added;
}

// GAS の Web アプリを呼ぶ。GAS は 1回目に 302 で別の住所（googleusercontent）へ飛ばし、
//   2回目でそこから中身を返す。この2回目が、ときどき 404 になる（2026-10-05 に確認。同じ住所でも
//   通ったり通らなかったりする）。そこで、飛び先は自分で取りに行き、404 なら少し待って呼び直す。
//   POST も 302 のあとは GET で取りに行く（GAS の決まり。書き込みは1回目の POST で済んでいる）。
//   POST は書き込みが2回にならないよう、1回目そのものは呼び直さない。
async function gasFetch(url, opts = {}, tries = 3) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const isPost = (opts.method || 'GET') === 'POST';
  let last = null;
  for (let i = 0; i < tries; i++) {
    const r1 = await fetch(url, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(60000) });
    const loc = r1.headers.get('location');
    if (!(r1.status >= 300 && r1.status < 400 && loc)) {
      if (r1.status !== 404 || isPost) return r1;
      last = r1; await wait(1500); continue;
    }
    // 飛び先は GET で取る。404 なら飛び先だけ呼び直す（POST の書き込みは済んでいるので、1回目には戻らない）
    for (let j = 0; j < tries; j++) {
      const r2 = await fetch(loc, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
      if (r2.status !== 404) return r2;
      last = r2; await wait(1500);
    }
    if (isPost) return last;
  }
  return last;
}

// ガーディアンnews（GAS）から、担当Bが書いた最新のダイジェストを取ってくる。
//   返り値 { ok, date, text } ／ 失敗時 { ok:false, error }
async function fetchLatestDigest() {
  let s;
  try { s = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8')).news; }
  catch (e) { return { ok: false, error: 'secrets.json を読めません: ' + e.message }; }
  if (!s || !s.gasUrl || !s.token) return { ok: false, error: 'secrets.json に news.gasUrl / news.token がありません' };
  const url = s.gasUrl + '?action=latest_digest&token=' + encodeURIComponent(s.token);
  try {
    const r = await gasFetch(url);
    const t = await r.text();
    let j;
    try { j = JSON.parse(t); } catch { return { ok: false, error: 'GASの返事が読めません: ' + t.slice(0, 200) }; }
    if (!j.ok) return { ok: false, error: 'GAS: ' + (j.error || '不明') };
    return { ok: true, date: j.date || '', text: j.text || '' };
  } catch (e) {
    return { ok: false, error: 'GASにつながりません: ' + e.message };
  }
}

// ---- TAKERUマガジン（Cowork君の takerunews.gs v22 の窓口） ----
//   読み取り：magazine_latest / magazine_list（GET）
//   書き込み：stage=magazine_save（POST。text/plain で JSON を送る。expected_version 必須）
//   トークンは書き込みもできる鍵なので、作業台のサーバーの中でだけ使う（画面には渡さない）。
function gasConf() {
  const s = JSON.parse(fs.readFileSync(SECRETS_PATH, 'utf8')).news;
  if (!s || !s.gasUrl || !s.token) throw new Error('secrets.json に news.gasUrl / news.token がありません');
  return s;
}
async function gasGet(action, params = {}) {
  const s = gasConf();
  const q = new URLSearchParams({ action, token: s.token, ...params });
  const r = await gasFetch(s.gasUrl + '?' + q);
  const t = await r.text();
  try { return JSON.parse(t); }
  catch { return { ok: false, error: r.status === 404 ? 'GASにこの窓口がまだありません（デプロイの更新待ち？）' : 'GASの返事が読めません' }; }
}
async function gasPost(body) {
  const s = gasConf();
  const r = await gasFetch(s.gasUrl, { method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ token: s.token, ...body }) });
  const t = (await r.text()).trim();
  if (t.startsWith('OK')) {
    const m = /version=(\d+)/.exec(t);
    return { ok: true, text: t, version: m ? Number(m[1]) : null };
  }
  return { ok: false, error: t.startsWith('ERROR') ? t : ('GASの返事が読めません（' + r.status + '）') };
}

module.exports = { parseCsvText, csvField, buildNewsCsv, parseNewsCsv, newsStamp, readNews,
                   parseDigest, assignNewsIds, fetchLatestDigest, gasGet, gasPost };
