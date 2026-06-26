// ============================================================
// TAKERU 作業台 — Node.js ローカルサーバー
// 依存パッケージなし（Node標準モジュールのみ）。npm install 不要。
// ============================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ---- 設定読み込み ----
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config;
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
  console.error('config.json を読み込めませんでした:', e.message);
  process.exit(1);
}

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = config.port || 3000;

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
      sendJSON(res, 200, { ok: true, backup: backupName });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: '保存に失敗しました: ' + e.message });
    }
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

// POST /api/images/save — 960x720に変換済みのPNGを保存
// （ブラウザのcanvasで強制伸縮済み。既存画像はバックアップしてから差し替え）
const IMG_BACKUP_DIR = path.join(__dirname, 'image_backup');
function postImageSave(req, res) {
  let chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const { id, dataUrl } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!id || !dataUrl) return sendJSON(res, 400, { ok: false, error: 'idまたは画像データがありません' });
      const safeId = path.basename(String(id)); // パストラバーサル防止
      const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
      if (!m) return sendJSON(res, 400, { ok: false, error: 'PNG形式の画像ではありません' });
      const buf = Buffer.from(m[1], 'base64');
      if (!fs.existsSync(config.imagesDir)) fs.mkdirSync(config.imagesDir, { recursive: true });

      // 既存の同名画像（拡張子違いを含む）をバックアップ。.png以外の旧拡張子は退避後に削除して.pngへ統一
      let backupName = null;
      const files = fs.readdirSync(config.imagesDir);
      for (const f of files) {
        const ext = path.extname(f).toLowerCase();
        if (path.basename(f, path.extname(f)) === safeId && IMAGE_EXTS.includes(ext)) {
          if (!fs.existsSync(IMG_BACKUP_DIR)) fs.mkdirSync(IMG_BACKUP_DIR, { recursive: true });
          backupName = `${safeId}_${timestamp()}${path.extname(f)}`;
          fs.copyFileSync(path.join(config.imagesDir, f), path.join(IMG_BACKUP_DIR, backupName));
          if (ext !== '.png') fs.unlinkSync(path.join(config.imagesDir, f));
        }
      }
      fs.writeFileSync(path.join(config.imagesDir, safeId + '.png'), buf);
      sendJSON(res, 200, { ok: true, file: safeId + '.png', backup: backupName });
    } catch (e) {
      sendJSON(res, 500, { ok: false, error: '画像の保存に失敗しました: ' + e.message });
    }
  });
}

// ---- 将来の拡張用スタブ ----
// POST /api/images/process — 画像加工（フェーズ2・別用途用に予約）
function postImageProcess(req, res) {
  sendJSON(res, 501, { ok: false, error: '未実装（フェーズ2で対応予定）' });
}
// POST /api/voice/generate — VOICEPEAK連携（フェーズ2）
function postVoiceGenerate(req, res) {
  sendJSON(res, 501, { ok: false, error: '未実装（フェーズ2で対応予定）' });
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
  if (pathname === '/api/voice/generate' && method === 'POST') return postVoiceGenerate(req, res);

  // 静的
  if (method === 'GET') return serveStatic(req, res, pathname);

  res.writeHead(405);
  res.end('method not allowed');
});

const URL_LOCAL = 'http://localhost:' + PORT;

server.listen(PORT, () => {
  console.log('==================================================');
  console.log('  TAKERU 作業台 が起動しました');
  console.log('  ' + URL_LOCAL + '  （ブラウザを自動で開きます）');
  console.log('  CSV : ' + config.csvPath);
  console.log('  画像: ' + config.imagesDir);
  console.log('  終了するにはこの黒い窓を閉じてください');
  console.log('==================================================');
  // サーバー起動完了後にブラウザを開く（タイミング競合を防ぐ）
  if (process.platform === 'win32') exec('start "" "' + URL_LOCAL + '"');
  else if (process.platform === 'darwin') exec('open "' + URL_LOCAL + '"');
  else exec('xdg-open "' + URL_LOCAL + '"');
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
