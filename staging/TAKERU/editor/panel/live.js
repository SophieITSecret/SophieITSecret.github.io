// ============================================================
// 開票ライブの係（OBS のブラウザの部品が読むページ）2026-11-27 TAKERU担当（T）
//   牧村さんの決定（R-20261127-S-20）：11/28 の台湾統一地方選の開票を YouTube でライブ実況する。
//   画面は自前の速報パネルだけ。音はソフィーの解説クリップをループで流す（BGM なし）。
//
//   http://localhost:3100/            … ライブ用のページ（live.html）
//   http://localhost:3100/panel       … 速報パネルの中身（GAS の返事をそのまま中継）
//   http://localhost:3100/audio/list  … 80_速報\音声\ の mp3 の一覧（直下だけ）
//   http://localhost:3100/audio/<名前> … その mp3
//
//   読むだけ。合鍵も個人情報も扱わない。このパソコンの中だけで動く（127.0.0.1 で待つ）。
//   試すとき：LIVE_PANEL_FILE=<JSON のファイル> で GAS の代わりにそのファイルを返す。
//             LIVE_AUDIO_DIR=<フォルダ> で音声の置き場を替える。
// ============================================================
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = Number(process.env.LIVE_PORT || 3100)
const PANEL_URL = process.env.LIVE_PANEL_URL ||
  'https://script.google.com/macros/s/AKfycbxqaMFSwSdgDlROUjl6ixWgeD4Xo7YRNT7keJ2K_kSr0biJ7cSAiMrYYvDFhdLMobEM/exec'
const PANEL_FILE = process.env.LIVE_PANEL_FILE || ''
const AUDIO_DIR = process.env.LIVE_AUDIO_DIR || 'G:\\マイドライブ\\TAKERU_共有\\80_速報\\音声'
const PAGE = path.join(__dirname, 'live.html')

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(body)
}
function stamp() { return new Date().toLocaleTimeString('ja-JP', { hour12: false }) }

let lastPanel = null   // GAS が応えないときは、前の中身を返す
async function panel() {
  if (PANEL_FILE) return JSON.parse(fs.readFileSync(PANEL_FILE, 'utf8'))
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 30000)
  try {
    const r = await fetch(PANEL_URL + '?t=' + Date.now(), { redirect: 'follow', signal: ctl.signal })
    const j = await r.json()
    if (j && j.ok) lastPanel = j
    return j && j.ok ? j : (lastPanel || j)
  } finally { clearTimeout(t) }
}

function audioList() {
  let names = []
  try { names = fs.readdirSync(AUDIO_DIR, { withFileTypes: true }) } catch (e) { return [] }
  return names
    .filter(d => d.isFile() && /\.mp3$/i.test(d.name))
    .map(d => { const st = fs.statSync(path.join(AUDIO_DIR, d.name)); return { name: d.name, size: st.size, mtime: st.mtimeMs } })
    .filter(f => f.size > 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'))
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost')
  try {
    if (u.pathname === '/' || u.pathname === '/index.html') {
      return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(PAGE))
    }
    if (u.pathname === '/panel') {
      try {
        const j = await panel()
        return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(j))
      } catch (e) {
        console.log(stamp(), 'パネルが読めません：', e.message)
        return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(lastPanel || { ok: false, error: String(e.message) }))
      }
    }
    if (u.pathname === '/audio/list') {
      return send(res, 200, 'application/json; charset=utf-8', JSON.stringify(audioList()))
    }
    if (u.pathname.startsWith('/audio/')) {
      const name = decodeURIComponent(u.pathname.slice(7))
      const ok = audioList().some(f => f.name === name)   // 一覧にある名前だけ（../ などは通さない）
      if (!ok) return send(res, 404, 'text/plain; charset=utf-8', 'ありません')
      const buf = fs.readFileSync(path.join(AUDIO_DIR, name))
      return send(res, 200, 'audio/mpeg', buf)
    }
    if (u.pathname === '/log') {   // ページからの知らせ（いま流した音など）を、この窓に出す
      console.log(stamp(), (u.searchParams.get('m') || '').slice(0, 200))
      return send(res, 204, 'text/plain', '')
    }
    send(res, 404, 'text/plain; charset=utf-8', 'ありません')
  } catch (e) {
    console.log(stamp(), 'エラー：', e.message)
    send(res, 500, 'text/plain; charset=utf-8', 'エラー')
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log('開票ライブの係が動いています： http://localhost:' + PORT + '/')
  console.log('  パネル：' + (PANEL_FILE ? '試しのファイル ' + PANEL_FILE : 'GAS'))
  console.log('  音声　：' + AUDIO_DIR + (fs.existsSync(AUDIO_DIR) ? '' : '（まだありません）'))
  console.log('この窓を閉じると止まります。')
})
