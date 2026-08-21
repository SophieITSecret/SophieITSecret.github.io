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
  const lines = [['ID', '日付', '種別', 'タイトル', '本文', '公開', '月次', '年次'].join(',')];
  for (const it of items) {
    lines.push([it.id, it.date, it.type, it.title, it.body,
                (it.published ? '1' : ''), (it.monthly ? '1' : ''), (it.yearly ? '1' : '')]
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
  // 2ファイルを1回のSSHでまとめて取得（無ければ空として扱う）
  const remoteCmd =
    `cat ${PROD.remoteDir}/daily_summary.json 2>/dev/null; ` +
    `echo; echo ${SEP}; ` +
    `cat ${PROD.remoteDir}/card_summary.json 2>/dev/null; ` +
    `echo; echo ${SEP}; ` +
    `cat ${PROD.remoteDir}/card_daily.json 2>/dev/null`;
  const args = [
    '-i', PROD.keyPath, '-p', String(PROD.port),
    '-o', 'StrictHostKeyChecking=no', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20',
    `${PROD.user}@${PROD.host}`, remoteCmd,
  ];
  try {
    const out = await spawnP('ssh', args, {});
    const [dailyRaw = '', cardRaw = '', cardDailyRaw = ''] = out.split(SEP);
    const parse = s => { s = s.trim(); if (!s) return {}; try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
    sendJSON(res, 200, { ok: true, daily: parse(dailyRaw), cards: parse(cardRaw), cardDaily: parse(cardDailyRaw) });
  } catch (e) {
    // SSH不通でも作業台自体は落とさない。理由を添えて空で返す。
    sendJSON(res, 200, { ok: false, error: e.message, daily: {}, cards: {}, cardDaily: {} });
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
  if (pathname === '/api/news' && method === 'GET') return getNews(req, res);
  if (pathname === '/api/news' && method === 'POST') return postNews(req, res);
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
