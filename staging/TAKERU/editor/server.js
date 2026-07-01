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
function spawnP(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, windowsHide: true });
    let out = '', err = '';
    p.stdout && p.stdout.on('data', d => out += d);
    p.stderr && p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(err || `exit ${code}`)));
    p.on('error', reject);
  });
}

// WAVs（複数可）→ MP3（ffmpeg で結合＋変換を一括処理）
function wavsToMp3(wavFiles, mp3Path, tempDir, code) {
  if (wavFiles.length === 1) {
    return spawnP('ffmpeg', ['-y', '-i', wavFiles[0], '-ar', '44100', '-ac', '1', '-b:a', '96k', mp3Path]);
  }
  // concat demuxer 用リストファイル
  const listFile = path.join(tempDir, `${code}_list.txt`);
  const lines = wavFiles.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "\\'")}'`).join('\n');
  fs.writeFileSync(listFile, lines, 'utf8');
  return spawnP('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile,
    '-ar', '44100', '-ac', '1', '-b:a', '96k', mp3Path])
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
  const stat = fs.statSync(mp3);
  res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Content-Length': stat.size });
  fs.createReadStream(mp3).pipe(res);
}

// POST /api/voice/generate
function postVoiceGenerate(req, res) {
  let chunks = [];
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
      const pitch    = String(d.pitch || 50);

      if (!code || !text) return sendJSON(res, 400, { ok: false, error: 'code と text は必須です' });

      const { vpPath, vpDir, voicesDir, backupDir, tempDir } = getVpConfig();
      const mp3Path = path.join(voicesDir, code + '.mp3');

      // 既存MP3 → バックアップ
      if (fs.existsSync(mp3Path)) {
        fs.copyFileSync(mp3Path, path.join(backupDir, `${code}_${timestamp()}.mp3`));
      }

      // 「。」で分割
      const sentences = text.split('。').map(s => s.trim()).filter(Boolean).map(s => s + '。');
      if (!sentences.length) return sendJSON(res, 400, { ok: false, error: 'テキストが空です' });

      console.log(`[voice] ${code}  ${sentences.length}文 narrator=${narrator}`);

      for (let i = 0; i < sentences.length; i++) {
        const txtFile = path.join(tempDir, `${code}_${i}.txt`);
        const wavFile = path.join(tempDir, `${code}_${i}.wav`);
        fs.writeFileSync(txtFile, sentences[i], 'utf8');

        await spawnP(vpPath,
          ['-t', txtFile, '-n', narrator, '-e', emotion, '--speed', speed, '--pitch', pitch, '-o', wavFile],
          { cwd: vpDir });

        chunkWavs.push(wavFile);
        console.log(`  [${i + 1}/${sentences.length}] 完了`);
        if (i < sentences.length - 1) await new Promise(r => setTimeout(r, 3000));
      }

      // WAV 結合 → MP3（ffmpeg 一括）
      await wavsToMp3(chunkWavs, mp3Path, tempDir, code);
      console.log(`  ✅ ${code}.mp3 完成`);
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
  if (pathname.startsWith('/api/voice/status/') && method === 'GET')
    return getVoiceStatus(req, res, pathname.slice('/api/voice/status/'.length));
  if (pathname.startsWith('/api/voice/audio/') && method === 'GET')
    return getVoiceAudio(req, res, pathname.slice('/api/voice/audio/'.length));
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
