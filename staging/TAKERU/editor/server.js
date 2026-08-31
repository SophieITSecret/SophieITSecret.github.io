// ============================================================
// TAKERU 作業台 — Node.js ローカルサーバー
// 依存パッケージなし（Node標準モジュールのみ）。npm install 不要。
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

// ---- 設定読み込み ----
const CONFIG_PATH = path.join(__dirname, 'config.json');
const READING_SCRIPTS_PATH = path.join(__dirname, 'reading_scripts.json');
const PROMPTS_PATH = path.join(__dirname, 'prompts.json');
const VOICE_SETTINGS_PATH = path.join(__dirname, 'voice_settings.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.error('config.json を読み込めませんでした:', e.message);
  process.exit(1);
}

const PUBLIC_DIR = path.join(__dirname, 'public');
// 動作確認用に別ポートで立てられるようにしておく（既に作業台が動いていても試せる）
const PORT = process.env.EDITOR_PORT || config.port || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function timestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ============================================================
// API ハンドラ
// ============================================================

// GET /api/csv — CSVを読み込んで返す
function getCsv(req, res) {
  fs.readFile(config.csvPath, 'utf8', (err, data) => {
    if (err) return sendJSON(res, 500, { ok: false, error: 'CSVを読み込めません: ' + err.message });
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(data);
  });
}

// POST /api/csv — CSVを上書き保存（保存前にバックアップを自動作成）
function postCsv(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text.trim()) return sendJSON(res, 400, { ok: false, error: '空のデータは保存できません' });
    try {
      let backupName = null;
      if (fs.existsSync(config.csvPath)) {
        const dir = path.dirname(config.csvPath);
        const base = path.basename(config.csvPath, '.csv');
        backupName = `${base}_backup_${timestamp()}.csv`;
        fs.copyFileSync(config.csvPath, path.join(dir, backupName));
      }
      fs.writeFileSync(config.csvPath, text, 'utf8');
      // 本体画面で直した本文を、既にある原稿mdにも書き戻す
      let drafts = [];
      try { drafts = syncDraftsFromCsv(text); } catch (e) { /* 同期に失敗してもCSVの保存は成立させる */ }
      sendJSON(res, 200, { ok: true, backup: backupName, drafts });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: '保存に失敗しました: ' + e.message });
    }
  });
}

// ---- お知らせ（news.csv）----
//   news.csv は TAKERUcard.csv と同じフォルダに置く。
function newsPath() { return path.join(path.dirname(config.csvPath), 'news.csv'); }
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
// GET /api/news — news.csv を配列で返す
function getNews(req, res) {
  fs.readFile(newsPath(), 'utf8', (err, data) => {
    if (err) { if (err.code === 'ENOENT') return sendJSON(res, 200, { ok: true, items: [] }); return sendJSON(res, 500, { ok: false, error: err.message }); }
    const recs = parseCsvText(data.replace(/^﻿/, ''));
    const items = recs.slice(1).filter(r => (r[0] || '').trim()).map(r => ({
      id: (r[0] || '').trim(), date: (r[1] || '').trim(), type: (r[2] || '').trim() || 'お知らせ',
      title: (r[3] || '').trim(), body: (r[4] || ''), published: (r[5] || '').trim() === '1',
      monthly: (r[6] || '').trim() === '1', yearly: (r[7] || '').trim() === '1',
      srcUrl: (r[8] || '').trim(),
    }));
    sendJSON(res, 200, { ok: true, items });
  });
}
// ============================================================
// 原稿（下書き .md）
//   チャットとの往復で育てるテーマ単位の原稿を、作業台から直接編集する。
//   置き場は Obsidian/VSC と同じフォルダ（config.draftsDir）。同じファイルを
//   両方から触れるようにしてあるので、作業台が合わなければいつでも戻れる。
//   バックアップは作業台側（editor/draft_backup）に取る。原稿フォルダに
//   置くと Obsidian の一覧が履歴で埋まるため。
// ============================================================
const DRAFT_BACKUP_DIR = path.join(__dirname, 'draft_backup');

function draftsDir() {
  return config.draftsDir || path.join(path.dirname(config.csvPath), 'drafts');
}

// 受け取った名前を draftsDir の中に閉じ込める（.. や絶対パスを弾く）
function draftPath(name) {
  const BS = String.fromCharCode(92);            // 円記号（Windowsの区切り）
  const rel = String(name || '').split(BS).join('/');
  if (!rel || rel[0] === '/' || rel.indexOf('..') >= 0) return null;
  if (/^[A-Za-z]:/.test(rel)) return null;       // 絶対パスは受け取らない
  if (!rel.toLowerCase().endsWith('.md')) return null;
  const root = path.resolve(draftsDir());
  const full = path.resolve(root, rel);
  if (full !== root && !full.startsWith(root + path.sep)) return null;
  return full;
}

// ============================================================
// 原稿mdをCSVに合わせる
//   本体画面で図を見ながら本文を直す、というやり方はそのまま続けたい。
//   そこでCSVを保存したとき、既にある原稿mdを現在のカードで書き直す。
//   ・新しいmdは作らない（既にあるものだけ追いかける）
//   ・中身が変わらないファイルには触らない（控えが無駄に増えないように）
// ============================================================
const WIP_PLACEHOLDER = '（準備中）このカードは現在作成中です。';

// 原稿mdの1行目「# テーマ名」と2行目「科目：…」から、どのテーマのものか読む
function draftHeaderOf(text) {
  const lines = String(text || '').split(/\r?\n/);
  let genre = null, subject = null;
  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const m1 = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m1 && genre === null) { genre = m1[1]; continue; }
    const m2 = lines[i].match(/^科目：\s*([^　\s]+)/);
    if (m2 && subject === null) subject = m2[1];
  }
  return { genre, subject };
}

// 比較用：最初の「#### 」から後ろだけ取る（見出しの更新日で差が出ないように）
function draftBodyPart(text) {
  const i = String(text || '').indexOf('#### ');
  return i < 0 ? '' : text.slice(i).replace(/\s+$/, '');
}

function buildDraftMd(genre, subject, rows) {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  let md = `# ${genre || '（テーマ未設定）'}\n`;
  md += `科目：${subject || '（未設定）'}　／　${rows.length}枚　／　更新：${stamp}\n\n`;
  for (const r of rows) {
    const body = (r.body === WIP_PLACEHOLDER) ? '' : r.body;
    md += `#### ${r.id}　${r.title}\n${body}\n\n`;
  }
  return md;
}

// CSVの本文から、既にある原稿mdを書き直す。書き換えたファイル名の配列を返す。
function syncDraftsFromCsv(csvText) {
  const recs = parseCsvText(String(csvText || '').replace(/^﻿/, ''));
  const cards = recs.slice(1)
    .filter(r => (r[0] || '').trim())
    .map(r => ({ id: (r[0] || '').trim(), genre: (r[1] || '').trim(), title: (r[3] || '').trim(),
                 body: (r[4] || ''), subject: (r[5] || '').trim() }));

  const root = draftsDir();
  const files = [];
  const walk = (dir, rel, depth) => {
    let names; try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      if (n.startsWith('.')) continue;
      const full = path.join(dir, n);
      let st; try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) { if (depth > 0) walk(full, rel + n + '/', depth - 1); }
      else if (n.toLowerCase().endsWith('.md') && (rel + n).includes('カード原稿/')) files.push({ full, rel: rel + n });
    }
  };
  walk(root, '', 2);

  const done = [];
  for (const f of files) {
    let old; try { old = fs.readFileSync(f.full, 'utf8'); } catch { continue; }
    const { genre, subject } = draftHeaderOf(old);
    if (!genre) continue;                       // テーマが読めないファイルは触らない
    const rows = cards.filter(c => c.genre === genre && (!subject || c.subject === subject));
    if (!rows.length) continue;                 // 該当カードが無いなら触らない
    const next = buildDraftMd(genre, subject, rows);
    if (draftBodyPart(next) === draftBodyPart(old)) continue;   // 中身が同じなら何もしない
    try {
      fs.mkdirSync(DRAFT_BACKUP_DIR, { recursive: true });
      fs.copyFileSync(f.full, path.join(DRAFT_BACKUP_DIR,
        path.basename(f.full, '.md') + '_backup_' + timestamp() + '.md'));
      fs.writeFileSync(f.full, next, 'utf8');
      done.push({ name: f.rel, cards: rows.length });
    } catch (e) { /* 1本失敗しても他は続ける */ }
  }
  return done;
}

// GET /api/drafts — 原稿フォルダの .md を一覧（3階層まで／更新の新しい順）
function getDrafts(req, res) {
  const root = draftsDir();
  const out = [];
  const walk = (dir, rel, depth) => {
    let names;
    try { names = fs.readdirSync(dir); } catch { return; }
    for (const n of names) {
      if (n.startsWith('.')) continue;
      const full = path.join(dir, n);
      let st; try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) { if (depth > 0) walk(full, rel + n + '/', depth - 1); }
      else if (n.toLowerCase().endsWith('.md')) out.push({ name: rel + n, size: st.size, mtime: st.mtimeMs });
    }
  };
  walk(root, '', 2);
  out.sort((a, b) => b.mtime - a.mtime);
  sendJSON(res, 200, { ok: true, dir: root, items: out });
}

// GET /api/draft?name=... — 1件読む
function getDraft(req, res, name) {
  const full = draftPath(name);
  if (!full) return sendJSON(res, 400, { ok: false, error: 'ファイル名が不正です' });
  fs.readFile(full, 'utf8', (err, data) => {
    if (err) return sendJSON(res, 404, { ok: false, error: '読み込めません: ' + err.message });
    sendJSON(res, 200, { ok: true, name, text: data });
  });
}

// POST /api/draft — 上書き保存（保存前にバックアップ）
function postDraft(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    let payload;
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch (e) { return sendJSON(res, 400, { ok: false, error: '受け取れませんでした: ' + e.message }); }
    const full = draftPath(payload.name);
    if (!full) return sendJSON(res, 400, { ok: false, error: 'ファイル名が不正です' });
    const text = String(payload.text == null ? '' : payload.text);
    if (!text.trim()) return sendJSON(res, 400, { ok: false, error: '空の原稿は保存できません' });
    try {
      let backupName = null;
      if (fs.existsSync(full)) {
        fs.mkdirSync(DRAFT_BACKUP_DIR, { recursive: true });
        const base = path.basename(full, '.md');
        backupName = base + '_backup_' + timestamp() + '.md';
        fs.copyFileSync(full, path.join(DRAFT_BACKUP_DIR, backupName));
      }
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, text, 'utf8');
      sendJSON(res, 200, { ok: true, backup: backupName });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: '保存に失敗しました: ' + e.message });
    }
  });
}

// ===== sw.js のバージョン =====
//   内容を変えても版数を上げないと、利用者の端末に古い図や音声が残る。
//   CSVを保存するたびに自動で上げると、校正中の小さな直しでも番号が進み、
//   利用者に何度も更新を促すことになる。だから「上げる」は人が押して決める。
//   代わりに、上げる必要があるかどうかは中身の日付を見て教える。
function swPath() { return path.join(path.dirname(config.csvPath), 'sw.js'); }

// 版数より新しい内容ファイルがあるか。あれば「上げどき」。
function swPending() {
  const dir = path.dirname(config.csvPath);
  let swTime = 0;
  try { swTime = fs.statSync(swPath()).mtimeMs; } catch { return { pending: false, changed: [] }; }
  const changed = [];
  const look = (rel) => {
    const full = path.join(dir, rel);
    let st; try { st = fs.statSync(full); } catch { return; }
    if (st.isDirectory()) {
      let newest = 0, name = '';
      for (const f of fs.readdirSync(full)) {
        try { const t = fs.statSync(path.join(full, f)).mtimeMs; if (t > newest) { newest = t; name = f; } } catch {}
      }
      if (newest > swTime) changed.push(rel + '/' + name);
    } else if (st.mtimeMs > swTime) {
      changed.push(rel);
    }
  };
  ['TAKERUcard.csv', 'news.csv', 'MSlink.csv', 'app.js', 'style.css', 'index.html', 'images', 'voices'].forEach(look);
  return { pending: changed.length > 0, changed };
}

function appPath() { return path.join(path.dirname(config.csvPath), 'app.js'); }

function readSwVersion() {
  const t = fs.readFileSync(swPath(), 'utf8');
  const u = fs.readFileSync(appPath(), 'utf8');
  const a = (t.match(/SW_VERSION = 'v(\d+)'/) || [])[1];
  const b = (t.match(/takeru-v(\d+)/) || [])[1];
  // app.js の ASSET_V は画像・音声のURLに付ける印。ブラウザ自身のキャッシュを
  // 外すために要るので、sw.js の2つと必ず同じ番号に揃える。
  const c = (u.match(/ASSET_V = 'v(\d+)'/) || [])[1];
  return { text: t, appText: u, sw: a, cache: b, asset: c };
}

// GET /api/sw-version — 現在の版数と、上げどきかどうか
function getSwVersion(req, res) {
  try {
    const v = readSwVersion();
    sendJSON(res, 200, { ok: true, version: v.sw,
                         mismatch: (v.sw !== v.cache || v.sw !== v.asset), ...swPending() });
  } catch (e) { sendJSON(res, 200, { ok: false, error: e.message }); }
}

// POST /api/sw-version — 版数を1つ上げる（tools/bump-sw.sh と同じことをする）
function bumpSwVersion(req, res) {
  try {
    const v = readSwVersion();
    if (!v.sw || !v.cache || !v.asset) return sendJSON(res, 200, { ok: false, error: 'sw.js / app.js から版数を読めません' });
    const next = String(Math.max(+v.sw, +v.cache, +v.asset) + 1);
    const t = v.text
      .replace(/SW_VERSION = 'v\d+'/, "SW_VERSION = 'v" + next + "'")
      .replace(/takeru-v\d+/g, 'takeru-v' + next);
    const u = v.appText.replace(/ASSET_V = 'v\d+'/, "ASSET_V = 'v" + next + "'");
    // 3つが揃っているか検算してから書く。ずれると更新が中途半端に届く。
    const a = (t.match(/SW_VERSION = 'v(\d+)'/) || [])[1];
    const b = (t.match(/takeru-v(\d+)/) || [])[1];
    const c = (u.match(/ASSET_V = 'v(\d+)'/) || [])[1];
    if (a !== b || a !== c || a !== next) return sendJSON(res, 200, { ok: false, error: '書き換えの検算に失敗しました' });
    fs.writeFileSync(swPath(), t, 'utf8');
    fs.writeFileSync(appPath(), u, 'utf8');
    sendJSON(res, 200, { ok: true, from: v.sw, version: next });
  } catch (e) { sendJSON(res, 200, { ok: false, error: e.message }); }
}

// GET /api/links — MSlink.csv を配列で返す（読み取り専用）
//   閲覧状況の画面で、リンクIDに名前とジャンルを添えるためだけに使う。
function getLinks(req, res) {
  const p = path.join(path.dirname(config.csvPath), 'MSlink.csv');
  fs.readFile(p, 'utf8', (err, data) => {
    if (err) { if (err.code === 'ENOENT') return sendJSON(res, 200, { ok: true, items: [] }); return sendJSON(res, 500, { ok: false, error: err.message }); }
    const recs = parseCsvText(data.replace(/^﻿/, ''));
    const items = recs.slice(1).filter(r => (r[0] || '').trim()).map(r => ({
      id: (r[0] || '').trim(), genre: (r[1] || '').trim(), field: (r[2] || '').trim(),
      name: (r[3] || '').trim(), url: (r[4] || '').trim(),
    }));
    sendJSON(res, 200, { ok: true, items });
  });
}

// POST /api/news — 配列を受け取り news.csv を上書き（バックアップ作成）
function postNews(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const { items } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(items)) return sendJSON(res, 400, { ok: false, error: 'items配列が必要です' });
      const p = newsPath();
      let backup = null;
      if (fs.existsSync(p)) { backup = `news_backup_${timestamp()}.csv`; fs.copyFileSync(p, path.join(path.dirname(p), backup)); }
      fs.writeFileSync(p, buildNewsCsv(items), 'utf8');
      sendJSON(res, 200, { ok: true, backup });
    } catch (e) { sendJSON(res, 500, { ok: false, error: e.message }); }
  });
}

// GET /api/images — imagesフォルダのファイル一覧を { 拡張子なし名: ファイル名 } で返す
function getImages(req, res) {
  fs.readdir(config.imagesDir, (err, files) => {
    if (err) return sendJSON(res, 200, {}); // フォルダがなくても落とさない
    const map = {};
    for (const f of files) {
      const ext = path.extname(f).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        map[path.basename(f, path.extname(f))] = f;
      }
    }
    sendJSON(res, 200, map);
  });
}

// GET /api/images/:filename — 個別画像を返す（プレビュー用）
function getImageFile(req, res, filename) {
  const safe = path.basename(decodeURIComponent(filename)); // パストラバーサル防止
  const full = path.join(config.imagesDir, safe);
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const mime = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// POST /api/images/save — 960x720に変換済みのJPEGを保存
// （ブラウザのcanvasで強制伸縮・JPEG化済み。既存画像はバックアップしてから差し替え）
// 以前はPNGで保存していたが、1枚約1.5MB・118枚で141MBに膨らんでいた。
// sw.jsが端末にキャッシュするため実害が大きく、JPEGへ統一した。
const IMG_BACKUP_DIR = path.join(__dirname, 'image_backup');
function postImageSave(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const { id, dataUrl } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!id || !dataUrl) return sendJSON(res, 400, { ok: false, error: 'idまたは画像データがありません' });
      const safeId = path.basename(String(id)); // パストラバーサル防止
      const m = /^data:image\/jpeg;base64,(.+)$/.exec(dataUrl);
      if (!m) return sendJSON(res, 400, { ok: false, error: 'JPEG形式の画像ではありません' });
      const buf = Buffer.from(m[1], 'base64');
      if (!fs.existsSync(config.imagesDir)) fs.mkdirSync(config.imagesDir, { recursive: true });

      // 既存の同名画像（拡張子違いを含む）をバックアップ。.jpg以外の旧拡張子は退避後に削除して.jpgへ統一
      let backupName = null;
      const files = fs.readdirSync(config.imagesDir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (path.basename(f, path.extname(f)) === safeId && IMAGE_EXTS.includes(ext)) {
          if (!fs.existsSync(IMG_BACKUP_DIR)) fs.mkdirSync(IMG_BACKUP_DIR, { recursive: true });
          backupName = `${safeId}_${timestamp()}${path.extname(f)}`;
          fs.copyFileSync(path.join(config.imagesDir, f), path.join(IMG_BACKUP_DIR, backupName));
          if (ext !== '.jpg') fs.unlinkSync(path.join(config.imagesDir, f));
        }
      }
      fs.writeFileSync(path.join(config.imagesDir, safeId + '.jpg'), buf);
      sendJSON(res, 200, { ok: true, file: safeId + '.jpg', backup: backupName });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: '画像の保存に失敗しました: ' + e.message });
    }
  });
}

// GET /api/prompts — プロンプト一覧を返す
function getPrompts(req, res) {
  try {
    const data = fs.existsSync(PROMPTS_PATH)
      ? JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'))
      : [];
    sendJSON(res, 200, data);
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: e.message });
  }
}

// POST /api/prompts — 全件保存
function postPrompts(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(data)) return sendJSON(res, 400, { ok: false, error: 'array expected' });
      fs.writeFileSync(PROMPTS_PATH, JSON.stringify(data, null, 2), 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: e.message });
    }
  });
}

// GET /api/voice-settings
function getVoiceSettings(req, res) {
  try {
    const data = fs.existsSync(VOICE_SETTINGS_PATH)
      ? JSON.parse(fs.readFileSync(VOICE_SETTINGS_PATH, 'utf8'))
      : {};
    sendJSON(res, 200, data);
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: e.message });
  }
}

// POST /api/voice-settings
function postVoiceSettings(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      fs.writeFileSync(VOICE_SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: e.message });
    }
  });
}

// GET /api/reading-scripts — 読み上げ原稿一覧を返す
function getReadingScripts(req, res) {
  try {
    const data = fs.existsSync(READING_SCRIPTS_PATH)
      ? JSON.parse(fs.readFileSync(READING_SCRIPTS_PATH, 'utf8'))
      : {};
    sendJSON(res, 200, data);
  } catch (e) {
    sendJSON(res, 500, { ok: false, error: e.message });
  }
}

// POST /api/reading-scripts — 1件保存・削除（{ id, text } を受け取る。textが空なら削除）
function postReadingScript(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const { id, text } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!id) return sendJSON(res, 400, { ok: false, error: 'id は必須です' });
      let scripts = {};
      if (fs.existsSync(READING_SCRIPTS_PATH)) {
        try { scripts = JSON.parse(fs.readFileSync(READING_SCRIPTS_PATH, 'utf8')); } catch {}
      }
      if (text && text.trim()) scripts[id] = text.trim();
      else delete scripts[id];
      fs.writeFileSync(READING_SCRIPTS_PATH, JSON.stringify(scripts, null, 2), 'utf8');
      sendJSON(res, 200, { ok: true });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: e.message });
    }
  });
}

// GET /api/access-stats — 本番サーバーの集計JSONをSSHで取得して返す
//   本番の logs/ は外部非公開なので、デプロイと同じ鍵でSSH経由で取りに行く。
//   設定は config.json の prodStats で上書き可。既定はデプロイ先と同じ。
const PROD = Object.assign({
  host: 'xs302342.xsrv.jp',
  user: 'xs302342',
  port: '10022',
  keyPath: path.join(os.homedir(), '.ssh', 'takeru_deploy'),
  remoteDir: '~/ms-forum.com/public_html/takeru/logs',
}, config.prodStats || {});

async function getAccessStats(req, res) {
  const SEP = '===TAKERU_SPLIT===';
  // 5ファイルを1回のSSHでまとめて取得（無ければ空として扱う）
  const remoteCmd =
    `cat ${PROD.remoteDir}/daily_summary.json 2>/dev/null; ` +
    `echo; echo ${SEP}; ` +
    `cat ${PROD.remoteDir}/card_summary.json 2>/dev/null; ` +
    `echo; echo ${SEP}; ` +
    `cat ${PROD.remoteDir}/card_daily.json 2>/dev/null; ` +
    `echo; echo ${SEP}; ` +
    `cat ${PROD.remoteDir}/news_summary.json 2>/dev/null; ` +
    `echo; echo ${SEP}; ` +
    `cat ${PROD.remoteDir}/link_summary.json 2>/dev/null; ` +
    // 末尾を true で閉じる。まだ生成されていないJSONがあると最後の cat が
    // 失敗し、ssh 全体が異常終了して既存の集計まで空で返ってしまうため。
    `true`;
  const args = [
    '-i', PROD.keyPath, '-p', String(PROD.port),
    '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
    `${PROD.user}@${PROD.host}`, remoteCmd,
  ];
  try {
    const out = await spawnP('ssh', args, {});
    const [dailyRaw = '', cardRaw = '', cardDailyRaw = '', newsRaw = '', linkRaw = ''] = out.split(SEP);
    const parse = s => { s = s.trim(); if (!s) return {}; try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
    sendJSON(res, 200, { ok: true, daily: parse(dailyRaw), cards: parse(cardRaw), cardDaily: parse(cardDailyRaw),
                         news: parse(newsRaw), links: parse(linkRaw) });
  } catch (e) {
    // SSH不通でも作業台自体は落とさない。理由を添えて空で返す。
    sendJSON(res, 200, { ok: false, error: e.message, daily: {}, cards: {}, cardDaily: {}, news: {}, links: {} });
  }
}

// GET /api/members — 本番の会員メール一覧(logs/members.csv)をSSHで取得
//   1行 = 「日付, メール」。外部からは403で見えないのでSSHで取りに行く。
async function getMembers(req, res) {
  const remoteCmd = `cat ${PROD.remoteDir}/members.csv 2>/dev/null`;
  const args = [
    '-i', PROD.keyPath, '-p', String(PROD.port),
    '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
    `${PROD.user}@${PROD.host}`, remoteCmd,
  ];
  try {
    const out = await spawnP('ssh', args, {});
    const members = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
      const i = line.indexOf(',');
      return {
        date: i >= 0 ? line.slice(0, i).trim() : '',
        email: (i >= 0 ? line.slice(i + 1) : line).trim(),
      };
    });
    sendJSON(res, 200, { ok: true, members });
  } catch (e) {
    sendJSON(res, 200, { ok: false, error: e.message, members: [] });
  }
}

// POST /api/publish — 開発版(GitHub)と本番(Xserver)へ反映する
//   tools/publish-content.sh（コミット→push→本番転送）を Git Bash で実行し、
//   出力をまとめて返す。長め（本番転送に数分）。
function findBash() {
  // Windowsでもフォワードスラッシュで存在確認・起動できる（バックスラッシュのescape事故を回避）
  const cands = [
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files (x86)/Git/bin/bash.exe',
    (process.env.LOCALAPPDATA || '').replace(/\\/g, '/') + '/Programs/Git/bin/bash.exe',
  ];
  for (const p of cands) { try { if (p && fs.existsSync(p)) return p; } catch (e) {} }
  return 'bash';
}
function postPublish(req, res) {
  // csvPath のあるフォルダ（staging/TAKERU）を足場に、リポジトリ root へ移って実行。
  // root の算出は bash 側の git rev-parse に任せる（確実）。
  const cwd = path.dirname(config.csvPath);
  const cmd = 'cd "$(git rev-parse --show-toplevel)" && bash tools/publish-content.sh';
  const p = spawn(findBash(), ['-c', cmd], { cwd, windowsHide: true });
  let log = '';
  p.stdout.on('data', d => { log += d; });
  p.stderr.on('data', d => { log += d; });
  p.on('close', code => sendJSON(res, 200, { ok: code === 0, log }));
  p.on('error', err => sendJSON(res, 200, { ok: false, log: 'Git Bash の起動に失敗しました: ' + err.message }));
}

// mp3list.json を voices ディレクトリから再生成
function updateMp3List(voicesDir) {
  try {
    const ids = fs.readdirSync(voicesDir)
      .filter(f => f.toLowerCase().endsWith('.mp3'))
      .map(f => path.basename(f, '.mp3'))
      .sort();
    fs.writeFileSync(path.join(voicesDir, 'mp3list.json'), JSON.stringify(ids) + '\n', 'utf8');
    console.log(`  [mp3list] ${ids.length}件更新`);
  } catch (e) {
    console.warn('[mp3list] 更新失敗:', e.message);
  }
}

// ---- 将来の拡張用スタブ ----
// POST /api/images/process — 画像加工（フェーズ2・別用途用に予約）
function postImageProcess(req, res) {
  sendJSON(res, 501, { ok: false, error: '未実装（フェーズ2で対応予定）' });
}

// ============================================================
// VOICE API — VOICEPEAK連携（フェーズ2）
// ============================================================

function getVpConfig() {
  const vpPath = config.voicepeakPath || 'C:\\Program Files\\VOICEPEAK\\voicepeak.exe';
  const vpDir  = path.dirname(vpPath);
  const voicesDir = config.voicesDir || path.join(path.dirname(config.csvPath), 'voices');
  const backupDir = path.join(path.dirname(voicesDir), 'voices_backup');
  const tempDir   = path.join(os.tmpdir(), 'takeru_voice_temp');
  [voicesDir, backupDir, tempDir].forEach(d => { try { fs.mkdirSync(d, { recursive: true }); } catch {} });
  return { vpPath, vpDir, voicesDir, backupDir, tempDir };
}

// 子プロセス実行（Promise）
function spawnP(cmd, args, opts, onProc) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, windowsHide: true });
    if (onProc) onProc(p);
    let out = '', err = '';
    p.stdout && p.stdout.on('data', d => out += d);
    p.stderr && p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`)));
    p.on('error', reject);
  });
}

// VOICEPEAK 呼び出し（クラッシュ時リトライ付き）
async function spawnVP(args, opts, retries = 3, cancelRef) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (cancelRef && cancelRef.cancelled) throw new Error('aborted');
    try {
      return await spawnP(args[0], args.slice(1), opts, proc => { if (cancelRef) cancelRef.proc = proc; });
    } catch (e) {
      if (e.message === 'aborted' || attempt === retries) throw e;
      console.warn(`  [VP retry ${attempt}/${retries}] ${e.message}`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// WAVs（複数可）→ MP3（ffmpeg で結合＋変換を一括処理）
// loudnorm で音量を一定基準(EBU R128)にそろえる。ナレーターや感情で声量が
// 変わっても、カードごとの仕上がり音量が揃う。
function wavsToMp3(wavFiles, mp3Path, tempDir, reqId) {
  const af = 'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:st=0:d=0.08';
  if (wavFiles.length === 1) {
    return spawnP('ffmpeg', ['-y', '-i', wavFiles[0], '-af', af, '-ar', '44100', '-ac', '1', '-b:a', '96k', mp3Path]);
  }
  // concat demuxer 用リストファイル
  const listFile = path.join(tempDir, `${reqId}_list.txt`);
  const lines = wavFiles.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "\\'")}'`).join('\n');
  fs.writeFileSync(listFile, lines, 'utf8');
  return spawnP('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-af', af, '-ar', '44100', '-ac', '1', '-b:a', '96k', mp3Path])
    .finally(() => { try { fs.unlinkSync(listFile); } catch {} });
}

// GET /api/voice/narrators
function getVoiceNarrators(req, res) {
  const { vpPath, vpDir } = getVpConfig();
  spawnP(vpPath, ['--list-narrator'], { cwd: vpDir })
    .then(out => {
      const narrators = out.trim().split(/\r?\n/).map(n => n.trim()).filter(Boolean);
      sendJSON(res, 200, { ok: true, narrators });
    })
    .catch(e => sendJSON(res, 200, { ok: false, error: e.message }));
}

// GET /api/voice/list — voicesDirにあるMP3のIDリストを返す
function getVoiceList(req, res) {
  const { voicesDir } = getVpConfig();
  try {
    const ids = fs.readdirSync(voicesDir)
      .filter(f => f.toLowerCase().endsWith('.mp3'))
      .map(f => path.basename(f, '.mp3'));
    sendJSON(res, 200, { ok: true, ids });
  } catch {
    sendJSON(res, 200, { ok: true, ids: [] });
  }
}

// GET /api/voice/status/:code
function getVoiceStatus(req, res, code) {
  const { voicesDir } = getVpConfig();
  sendJSON(res, 200, { exists: fs.existsSync(path.join(voicesDir, code + '.mp3')) });
}

// GET /api/voice/audio/:code
function getVoiceAudio(req, res, code) {
  const { voicesDir } = getVpConfig();
  const mp3 = path.join(voicesDir, code + '.mp3');
  if (!fs.existsSync(mp3)) { res.writeHead(404); return res.end('not found'); }
  const total = fs.statSync(mp3).size;
  const range = req.headers.range;
  if (range) {
    const [s, e] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(s, 10);
    const end = e ? parseInt(e, 10) : total - 1;
    res.writeHead(206, {
      'Content-Type': 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1
    });
    fs.createReadStream(mp3, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Length': total,
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(mp3).pipe(res);
  }
}

// POST /api/voice/generate
// 間マーカー【間】1つあたりの無音（秒）
const PAUSE_MARK = '【間】';
const PAUSE_SEC = 0.5;

// テキストを「読み上げ」と「無音」のセグメント列に分解する。
// 【間】の連続数ぶんだけ無音を積む（【間】2つで1.0秒）。マーカー自体は読ませない。
function buildSegments(text, limit) {
  const segs = [];
  let pending = 0;
  const flushSpeech = (t) => { for (const s of splitForVP(t, limit)) segs.push({ type: 'speech', text: s }); };
  // 【間】で区切りつつマーカーも残す
  for (const part of text.split(new RegExp(`(${PAUSE_MARK})`))) {
    if (part === PAUSE_MARK) { pending += PAUSE_SEC; continue; }
    if (!part.trim()) continue;
    if (pending > 0) { segs.push({ type: 'pause', sec: pending }); pending = 0; }
    flushSpeech(part);
  }
  if (pending > 0) segs.push({ type: 'pause', sec: pending });
  return segs;
}

// 指定秒数の無音WAV（結合できるよう標準フォーマットで作る）
function makeSilence(sec, outPath) {
  return spawnP('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
    '-t', String(sec), '-c:a', 'pcm_s16le', outPath]);
}
// VOICEPEAKのWAVを標準フォーマット(44100/mono/16bit)へ。無音WAVと結合できるようにするため。
function toStdWav(inPath, outPath) {
  return spawnP('ffmpeg', ['-y', '-i', inPath, '-ar', '44100', '-ac', '1', '-c:a', 'pcm_s16le', outPath]);
}

// VOICEPEAK用にテキストを分割する。
//  1) まず「。」で文に分ける（句点は各文の末尾に残す）
//  2) limit字を超える文は「、」でさらに分割（読点は前側の末尾に残す）
//  3) それでも超える断片は、最後の保険として limit字ごとに機械的に切る
// これで句点のない長文（例：服務の宣誓 163字）でも上限内に収まる。
function splitForVP(text, limit) {
  const out = [];
  const pushChunked = (s) => {
    // どうしても limit を超える場合だけ、字数で強制分割
    while (s.length > limit) { out.push(s.slice(0, limit)); s = s.slice(limit); }
    if (s) out.push(s);
  };
  for (let sentence of text.split('。')) {
    sentence = sentence.trim();
    if (!sentence) continue;
    sentence += '。';
    if (sentence.length <= limit) { out.push(sentence); continue; }
    // 長すぎる文を「、」で分割。読点は前側に付けて自然な区切りにする
    let buf = '';
    for (const part of sentence.split('、')) {
      const piece = part + '、';
      if ((buf + piece).length > limit) {
        if (buf) pushChunked(buf);
        buf = piece;
      } else {
        buf += piece;
      }
    }
    if (buf) {
      // 末尾の余分な「、」は取り、元の「。」を保つ
      buf = buf.replace(/、$/, '');
      pushChunked(buf);
    }
  }
  return out;
}

// 比較サンプル：1つのパラメータを 中心-差分 / 中心 / 中心+差分 の3値で生成する。
// 他は固定。短いサンプル文なので分割不要。結果は temp に置いて配信する。
const COMPARE_DIR = path.join(os.tmpdir(), 'takeru_voice_compare');
try { fs.mkdirSync(COMPARE_DIR, { recursive: true }); } catch {}

function postVoiceCompare(req, res) {
  let chunks = [];
  const cancelRef = { cancelled: false, proc: null };
  req.socket.on('close', () => {
    if (!res.writableEnded) { cancelRef.cancelled = true; if (cancelRef.proc) { try { cancelRef.proc.kill('SIGTERM'); } catch {} } }
  });
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    const wavs = [];
    try {
      const d = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const text     = (d.text || '').trim();
      const narrator = (d.narrator || 'Japanese Female 1').trim();
      const param    = d.param;                    // 'speed'|'pitch'|'happy'|'fun'|'sad'|'angry'
      const center   = Number(d.center);
      const delta    = Number(d.delta);
      const base     = d.base || {};               // 固定する他パラメータ {speed,pitch,happy,fun,sad,angry}
      if (!text) return sendJSON(res, 400, { ok: false, error: 'サンプル文が空です' });
      if (!['speed','pitch','happy','fun','sad','angry'].includes(param))
        return sendJSON(res, 400, { ok: false, error: 'パラメータ指定が不正です' });

      // 各パラメータの下限・上限（UIのスライダーに合わせる）
      const range = { speed:[50,200], pitch:[0,100], happy:[0,100], fun:[0,100], sad:[0,100], angry:[0,100] }[param];
      const clamp = v => Math.max(range[0], Math.min(range[1], Math.round(v)));
      const values = [clamp(center - delta), clamp(center), clamp(center + delta)];

      const { vpPath, vpDir, tempDir } = getVpConfig();
      const reqId = `cmp_${Date.now().toString(36)}`;
      const outValues = [];

      for (let i = 0; i < values.length; i++) {
        if (cancelRef.cancelled) return;
        const v = values[i];
        // このサンプル用のパラメータを組み立て（paramだけ差し替え、他はbase）
        const p = { speed:100, pitch:50, happy:0, fun:0, sad:0, angry:0, ...base, [param]: v };
        const emParts = [];
        if (p.happy>0) emParts.push(`happy=${p.happy}`);
        if (p.fun>0)   emParts.push(`fun=${p.fun}`);
        if (p.sad>0)   emParts.push(`sad=${p.sad}`);
        if (p.angry>0) emParts.push(`angry=${p.angry}`);
        const emotion = emParts.join(',') || 'happy=0';
        const vpPitch = String(Math.round((Number(p.pitch) - 50) * 6));  // 0-100中央50 → -300〜300

        const txtFile = path.join(tempDir, `${reqId}_${i}.txt`);
        const wavFile = path.join(tempDir, `${reqId}_${i}.wav`);
        fs.writeFileSync(txtFile, text, 'utf8');
        await spawnVP([vpPath, '-t', txtFile, '-n', narrator, '-e', emotion,
          '--speed', String(p.speed), '--pitch', vpPitch, '-o', wavFile], { cwd: vpDir }, 3, cancelRef);
        wavs.push(wavFile);
        try { fs.unlinkSync(txtFile); } catch {}

        const mp3Path = path.join(COMPARE_DIR, `${i}.mp3`);
        await wavsToMp3([wavFile], mp3Path, tempDir, `${reqId}_${i}`);
        outValues.push(v);
      }
      sendJSON(res, 200, { ok: true, param, values: outValues });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: e.message });
    } finally {
      wavs.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    }
  });
}

// 比較サンプルの音声を返す（0.mp3 / 1.mp3 / 2.mp3）
function getVoiceCompareAudio(req, res, idx) {
  const i = String(idx).replace(/\D/g, '');
  const p = path.join(COMPARE_DIR, `${i}.mp3`);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}

function postVoiceGenerate(req, res) {
  let chunks = [];
  const cancelRef = { cancelled: false, proc: null };
  req.socket.on('close', () => {
    if (!res.writableEnded) {
      cancelRef.cancelled = true;
      if (cancelRef.proc) { try { cancelRef.proc.kill('SIGTERM'); } catch {} }
      console.log('  [中止] クライアントが切断しました');
    }
  });
  req.on('data', c => chunks.push(c));
  req.on('end', async () => {
    let chunkWavs = [];
    try {
      const d        = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const code     = (d.code     || '').trim();
      const text     = (d.text     || '').trim();
      const narrator = (d.narrator || 'Japanese Female 1').trim();
      const emotion  = (d.emotion  || 'happy=40,fun=30');
      const speed    = String(d.speed || 100);
      // スライダー 0-100(中央50) → VOICEPEAK -300〜300(中央0) に変換
      const pitch    = String(Math.round((Number(d.pitch ?? 50) - 50) * 6));

      if (!code || !text) return sendJSON(res, 400, { ok: false, error: 'code と text は必須です' });

      const { vpPath, vpDir, voicesDir, backupDir, tempDir } = getVpConfig();
      const mp3Path = path.join(voicesDir, code + '.mp3');

      // 既存MP3 → バックアップ
      if (fs.existsSync(mp3Path)) {
        fs.copyFileSync(mp3Path, path.join(backupDir, `${code}_${timestamp()}.mp3`));
      }

      // テキストを「読み上げ」「無音(【間】)」のセグメント列に。
      // 読み上げは「。」で分け、VOICEPEAKの上限(約140字)超えは「、」でさらに分割。
      const segments = buildSegments(text, 140);
      const speechCount = segments.filter(s => s.type === 'speech').length;
      if (!speechCount) return sendJSON(res, 400, { ok: false, error: 'テキストが空です' });

      // リクエストごとにユニークなプレフィックスを生成（同一カードの並行処理に備える）
      const reqId = `${code}_${Date.now().toString(36)}`;
      const pauseCount = segments.length - speechCount;
      console.log(`[voice] ${code}  ${speechCount}文` + (pauseCount ? ` ＋間${pauseCount}個` : '') + ` narrator=${narrator}`);

      let spoken = 0;
      for (let i = 0; i < segments.length; i++) {
        if (cancelRef.cancelled) return;
        const seg = segments[i];
        const stdWav = path.join(tempDir, `${reqId}_${i}_std.wav`);

        if (seg.type === 'pause') {
          await makeSilence(seg.sec, stdWav);            // 【間】→ 無音WAV
          chunkWavs.push(stdWav);
          continue;
        }
        // 読み上げ：VOICEPEAK → 標準フォーマットへ変換（無音WAVと結合できるように）
        const txtFile = path.join(tempDir, `${reqId}_${i}.txt`);
        const rawWav  = path.join(tempDir, `${reqId}_${i}.wav`);
        fs.writeFileSync(txtFile, seg.text, 'utf8');
        await spawnVP(
          [vpPath, '-t', txtFile, '-n', narrator, '-e', emotion, '--speed', speed, '--pitch', pitch, '-o', rawWav],
          { cwd: vpDir }, 3, cancelRef);
        await toStdWav(rawWav, stdWav);
        chunkWavs.push(stdWav);
        try { fs.unlinkSync(txtFile); } catch {}
        try { fs.unlinkSync(rawWav); } catch {}
        spoken++;
        console.log(`  [${spoken}/${speechCount}] 完了`);
        if (spoken < speechCount) await new Promise(r => setTimeout(r, 5000));  // VOICEPEAK連続実行の間隔
      }

      // WAV 結合 → MP3（loudnormで音量そろえ）
      await wavsToMp3(chunkWavs, mp3Path, tempDir, reqId);
      console.log(`  ✅ ${code}.mp3 完成`);
      updateMp3List(voicesDir);
      sendJSON(res, 200, { ok: true, message: `${code}.mp3 を生成しました` });

    } catch (e) {
      console.error('  ❌', e.message);
      sendJSON(res, 500, { ok: false, error: e.message });
    } finally {
      chunkWavs.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    }
  });
}

// ============================================================
// 静的ファイル配信
// ============================================================
function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const full = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const mime = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

// ============================================================
// ルーティング
// ============================================================
const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(parsed.pathname);
  const method = req.method;

  // API
  if (pathname === '/api/csv' && method === 'GET')  return getCsv(req, res);
  if (pathname === '/api/csv' && method === 'POST') return postCsv(req, res);
  if (pathname === '/api/images' && method === 'GET') return getImages(req, res);
  if (pathname === '/api/images/save' && method === 'POST') return postImageSave(req, res);
  if (pathname.startsWith('/api/images/') && method === 'GET')
    return getImageFile(req, res, pathname.slice('/api/images/'.length));
  if (pathname === '/api/images/process' && method === 'POST') return postImageProcess(req, res);
  if (pathname === '/api/voice/narrators' && method === 'GET') return getVoiceNarrators(req, res);
  if (pathname === '/api/voice/list' && method === 'GET') return getVoiceList(req, res);
  if (pathname.startsWith('/api/voice/status/') && method === 'GET')
    return getVoiceStatus(req, res, pathname.slice('/api/voice/status/'.length));
  if (pathname.startsWith('/api/voice/audio/') && method === 'GET')
    return getVoiceAudio(req, res, pathname.slice('/api/voice/audio/'.length));
  if (pathname === '/api/voice/generate' && method === 'POST') return postVoiceGenerate(req, res);
  if (pathname === '/api/voice/compare' && method === 'POST') return postVoiceCompare(req, res);
  if (pathname.startsWith('/api/voice/compare-audio/') && method === 'GET')
    return getVoiceCompareAudio(req, res, pathname.slice('/api/voice/compare-audio/'.length));
  if (pathname === '/api/prompts' && method === 'GET')  return getPrompts(req, res);
  if (pathname === '/api/prompts' && method === 'POST') return postPrompts(req, res);
  if (pathname === '/api/voice-settings' && method === 'GET')  return getVoiceSettings(req, res);
  if (pathname === '/api/voice-settings' && method === 'POST') return postVoiceSettings(req, res);
  if (pathname === '/api/reading-scripts' && method === 'GET')  return getReadingScripts(req, res);
  if (pathname === '/api/reading-scripts' && method === 'POST') return postReadingScript(req, res);
  if (pathname === '/api/access-stats' && method === 'GET') return getAccessStats(req, res);
  if (pathname === '/api/members' && method === 'GET') return getMembers(req, res);
  if (pathname === '/api/drafts' && method === 'GET') return getDrafts(req, res);
  if (pathname === '/api/draft'  && method === 'GET') return getDraft(req, res, parsed.searchParams.get('name'));
  if (pathname === '/api/draft'  && method === 'POST') return postDraft(req, res);
  if (pathname === '/api/news' && method === 'GET') return getNews(req, res);
  if (pathname === '/api/news' && method === 'POST') return postNews(req, res);
  if (pathname === '/api/links' && method === 'GET') return getLinks(req, res);
  if (pathname === '/api/sw-version' && method === 'GET') return getSwVersion(req, res);
  if (pathname === '/api/sw-version' && method === 'POST') return bumpSwVersion(req, res);
  if (pathname === '/api/publish' && method === 'POST') return postPublish(req, res);

  // 静的
  if (method === 'GET') return serveStatic(req, res, pathname);

  res.writeHead(405);
  res.end('method not allowed');
});

const URL_LOCAL = 'http://localhost:' + PORT;

function openAppBrowser(url) {
  if (process.platform === 'win32') {
    const chromeCandidates = [
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const chromePath = chromeCandidates.find(p => { try { return fs.existsSync(p); } catch { return false; } });
    if (chromePath) {
      spawn(chromePath, [`--app=${url}`, '--window-size=1600,1000'], { detached: true, stdio: 'ignore' }).unref();
      console.log('  Chromeアプリモードで起動しました');
      return;
    }
    console.log('  Chrome未検出 → 通常ブラウザで開きます');
    exec('start "" "' + url + '"');
  } else if (process.platform === 'darwin') {
    exec(`open -a "Google Chrome" --args --app="${url}" --window-size=1600,1000 2>/dev/null || open "${url}"`);
  } else {
    exec(`google-chrome --app="${url}" --window-size=1600,1000 2>/dev/null || xdg-open "${url}"`);
  }
}

server.listen(PORT, () => {
  console.log('==================================================');
  console.log('  TAKERU 作業台 が起動しました');
  console.log('  ' + URL_LOCAL + '  （ブラウザを自動で開きます）');
  console.log('  CSV : ' + config.csvPath);
  console.log('  画像: ' + config.imagesDir);
  console.log('  終了するにはこの黒い窓を閉じてください');
  console.log('==================================================');
  // サーバー起動完了後にChromeアプリモードで開く
  openAppBrowser(URL_LOCAL);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\nポート ' + PORT + ' は既に使用中です。');
    console.error('すでに作業台が起動している可能性があります。');
    console.error('ブラウザで ' + URL_LOCAL + ' を開いてください。\n');
  } else {
    console.error('サーバーエラー:', e.message);
  }
});
