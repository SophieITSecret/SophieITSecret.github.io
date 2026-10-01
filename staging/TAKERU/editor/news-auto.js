// ============================================================
// TAKERUニュース 土曜の自動取り込み
//   担当B（Coworkのルーチン）が土曜9時台にGASへ書いたダイジェストを取ってきて、
//   news.csv に足し、開発版（GitHub）と本番（Xserver）へ出す。
//   Windowsのタスクスケジューラから土曜の10時に起動する（editor/news-auto-install.ps1）。
//
//   ・取り込み済みの記事は飛ばすので、何度動かしても二重には入らない。
//     新しい記事が無ければ何もせずに終わる。
//   ・コミットするのは news.csv だけ。作業台で作りかけのカードなどは巻き込まない。
//   ・失敗したときは画面に知らせを出し、editor/news-auto.log に残す。
//
// 使い方:  node editor/news-auto.js             （取り込み→公開）
//          node editor/news-auto.js --dry-run   （何が入るかを見るだけ。何も書かない）
//          node editor/news-auto.js --no-deploy （取り込みとコミットまで。pushと本番はしない）
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');
const { readNews, buildNewsCsv, parseDigest, assignNewsIds, fetchLatestDigest } = require('./news-lib');

const DRY = process.argv.includes('--dry-run');
const NO_DEPLOY = process.argv.includes('--no-deploy');
const LOG_PATH = path.join(__dirname, 'news-auto.log');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const TAKERU_DIR = path.dirname(config.csvPath);
const NEWS_PATH = path.join(TAKERU_DIR, 'news.csv');
const PROD_NEWS = 'https://takeru.ms-forum.com/news.csv';

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
function log(msg) {
  const line = `[${stamp()}] ${msg}`;
  console.log(line);
  if (!DRY) { try { fs.appendFileSync(LOG_PATH, line + '\n', 'utf8'); } catch {} }
}
// 失敗を牧村さんの画面に出す。ログを見に行かなくても気づけるように。
function notify(msg) {
  if (DRY || process.platform !== 'win32') return;
  const text = ('TAKERUニュースの自動取り込みが止まりました。\n\n' + msg +
                '\n\n作業台の「🌐 今週のニュースを取ってくる」で手で取り込めます。\n記録: ' + LOG_PATH)
               .replace(/'/g, "''");
  const ps = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('${text}', 'TAKERU ニュース', 'OK', 'Warning') | Out-Null`;
  spawn('powershell.exe', ['-NoProfile', '-Command', ps], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
}
function fail(msg) { log('❌ ' + msg); notify(msg); process.exit(1); }

function findBash() {
  const cands = [
    'C:/Program Files/Git/bin/bash.exe',
    'C:/Program Files (x86)/Git/bin/bash.exe',
    (process.env.LOCALAPPDATA || '').replace(/\\/g, '/') + '/Programs/Git/bin/bash.exe',
  ];
  for (const p of cands) { try { if (p && fs.existsSync(p)) return p; } catch {} }
  return 'bash';
}
function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, out: ((r.stdout || '') + (r.stderr || '')).trim() };
}

(async () => {
  log(DRY ? '--- 試しに見るだけ（--dry-run）---' : '--- 自動取り込みを始めます ---');

  // 1) 取ってくる
  const d = await fetchLatestDigest();
  if (!d.ok) fail(d.error);
  log(`GASのダイジェスト: ${d.date || '日付なし'}`);

  // 2) 手元の news.csv が作業途中でないか。途中なら巻き込まないよう止める。
  const top = git(['rev-parse', '--show-toplevel'], TAKERU_DIR);
  if (!top.ok) fail('gitのリポジトリが見つかりません: ' + top.out);
  const root = top.out;
  const rel = path.relative(root, NEWS_PATH).replace(/\\/g, '/');
  const dirty = git(['status', '--porcelain', '--', rel], root);
  if (dirty.out) fail('news.csv に、まだ公開していない手直しがあります。作業台で公開してから、もう一度取り込んでください。');

  // 3) 新しい記事だけ足す
  const { items } = readNews(NEWS_PATH);
  const today = new Date().toISOString().slice(0, 10);
  const { added, skipped, blocks } = parseDigest(d.text, items, today);
  if (!blocks) fail('ダイジェストに記事が1本もありませんでした（書式が変わった？）。');
  if (!added.length) { log(`新しい記事はありません（${skipped.length}本すべて取り込み済み）。終わります。`); return; }
  assignNewsIds(items, added);
  for (const a of added) log(`  + ${a.id} ${a.date} ${a.title}`);
  if (skipped.length) log(`  （${skipped.length}本は取り込み済みのため飛ばしました）`);
  if (DRY) { log(`${added.length}本が入る予定です。--dry-run なので何も書きません。`); return; }

  const backup = path.join(TAKERU_DIR, `news_backup_${stamp().replace(/[-: ]/g, '').replace(/^(\d{8})/, '$1_')}.csv`);
  fs.copyFileSync(NEWS_PATH, backup);
  fs.writeFileSync(NEWS_PATH, buildNewsCsv(items.concat(added)), 'utf8');
  log(`news.csv に ${added.length}本を足しました（控え: ${path.basename(backup)}）`);

  // 4) news.csv だけをコミット
  const msg = `ニュース自動取り込み ${d.date || today}（${added.length}本）`;
  const c = git(['commit', '-m', msg, '--', rel], root);
  if (!c.ok) fail('コミットに失敗しました: ' + c.out);
  log('コミットしました: ' + msg);
  if (NO_DEPLOY) { log('--no-deploy なので、push と本番への公開はしません。'); return; }

  // 5) 開発版（GitHub）へ。先に誰かが上げていたら取り込んでから送り直す。
  let p = git(['push', 'origin', 'main'], root);
  if (!p.ok) {
    log('push が通らなかったので、GitHubの分を取り込んでから送り直します。');
    const pull = git(['pull', '--rebase', '--autostash', 'origin', 'main'], root);
    if (!pull.ok) fail('GitHubの分を取り込めませんでした（コミットは手元に残っています）: ' + pull.out);
    p = git(['push', 'origin', 'main'], root);
    if (!p.ok) fail('GitHubへ送れませんでした（コミットは手元に残っています）: ' + p.out);
  }
  log('開発版（GitHub）に送りました。');

  // 6) 本番（Xserver）へ。ニュースの追加だけなのでsw版数は上げない（publish-content.sh と同じ）。
  const dep = spawnSync(findBash(), ['tools/deploy-takeru-prod.sh', '--force'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const depOut = ((dep.stdout || '') + (dep.stderr || '')).trim();
  if (dep.status !== 0) fail('本番への転送に失敗しました（開発版には出ています）:\n' + depOut.split('\n').slice(-5).join('\n'));
  log('本番へ転送しました。' + ((depOut.match(/記録タグ: \S+/) || [''])[0]));

  // 7) 本番に本当に載ったか確かめる
  try {
    const r = await fetch(PROD_NEWS + '?t=' + Date.now(), { signal: AbortSignal.timeout(30000) });
    const t = await r.text();
    const miss = added.filter(a => !t.includes(a.title));
    if (miss.length) fail(`本番の news.csv に ${miss.length}本が見当たりません: ${miss.map(m => m.title).join(' / ')}`);
  } catch (e) { fail('本番の確認ができませんでした: ' + e.message); }
  log(`✅ 完了：${added.length}本を本番に出しました。`);
})().catch(e => fail('思わぬ失敗: ' + (e && e.stack || e)));
