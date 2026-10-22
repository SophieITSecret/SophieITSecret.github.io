// ============================================================
// 🧭 制作デスク（カード制作の上流：テーマ→調査→カード割り→執筆→CSVへ出力）2026-10-22
//   段は「TAKERU テーマ制作手順書」の段1〜段7。段2と段5は牧村さんの承認で次へ進む。
//
//   置き場：原稿フォルダ（config.draftsDir）の中の「制作デスク」。Obsidian からも Claude Code からも
//           ふつうのファイルとして読み書きできるようにする。
//     制作デスク/_設定.json             … 基礎資料の一覧（手順書・作成ルールなど。押すと開く）
//     制作デスク/<テーマ>/theme.json     … テーマの情報・段・主軸・縦糸・カードの並び（order）
//     制作デスク/<テーマ>/cards/<コード>.md … カード1枚（題・狙い・骨組み・本文・画像プロンプト）
//     制作デスク/<テーマ>/research/*.md  … 調査資料（カードに縛られない）
//     制作デスク/<テーマ>/カード一覧.md   … 自動で作る読み物（AIに渡す用。手で直さない）
//
//   CSV（TAKERUcard.csv）とのつながりは2本だけ：
//     出力（デスク→CSV）… テーマのカードを、未公開のままCSVに書く（同じコードの行は置き換え）
//     取り込み（CSV→デスク）… 本体画面で直した題・本文をデスクへ戻す
//   原稿フォルダの「カード原稿/*.md」は本体のCSV保存で書き直されるので、デスクの置き場にはしない。
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const STAGES = [
  { no: 1, name: '現在地の復元' },
  { no: 2, name: 'テーマの主軸を一文で決める', approve: true },
  { no: 3, name: '縦糸の割り当て' },
  { no: 4, name: '基礎調査（二本立て・突き合わせ）' },
  { no: 5, name: 'カード割り（F／Cの設計）', approve: true },
  { no: 6, name: '執筆と確定（一枚ずつ）' },
  { no: 7, name: '締めの処理' },
];
const CARD_STATUS = ['構想', '骨組み', '執筆中', '確定'];
const WIP = '（準備中）このカードは現在作成中です。';   // 本体の server.js と同じ仮の文
const SECTIONS = [['aim', '狙い'], ['skeleton', '骨組み'], ['body', '本文'], ['imagePrompt', '画像プロンプト'], ['memo', 'メモ']];
const DEFAULT_REFS = [
  'TAKERU テーマ制作手順書 ― 国家と法律・3級.md',
  'TAKERU カード作成ルール v2.md',
  'TAKERU_文体見本_横須賀.md',
  'TAKERU_カード作成ワークフロー_引き継ぎ書.md',
  'TAKERU カリキュラム設計書v4.md',
  'TAKERU ユニット・サブユニット一覧 v5.md',
  'TAKERU 国家と法律・3級　カードタイトル一覧.md',
];

module.exports = function desk(ctx) {
  const { config, sendJSON, timestamp, pruneBackups, RE_CSV_BACKUP, parseCsvText, syncDraftsFromCsv, draftsDir } = ctx;
  const ROOT = () => path.join(draftsDir(), '制作デスク');

  // ---------------- 小さな道具 ----------------
  const now = () => { const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const readJSON = (p, dflt) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return dflt; } };
  const writeJSON = (p, o) => fs.writeFileSync(p, JSON.stringify(o, null, 2) + '\n', 'utf8');
  const body = req => new Promise((ok, ng) => { const c = []; req.on('data', x => c.push(x));
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(c).toString('utf8') || '{}')); } catch (e) { ng(e); } }); });
  // テーマのフォルダ名を、制作デスクの中に閉じ込める（.. や区切りを弾く）
  function themeDir(f) {
    const name = String(f || '');
    if (!name || /[\\/:*?"<>|]/.test(name) || name.startsWith('.') || name.startsWith('_')) throw new Error('テーマのフォルダ名が違います');
    const dir = path.join(ROOT(), name);
    if (!fs.existsSync(path.join(dir, 'theme.json'))) throw new Error('そのテーマがありません：' + name);
    return dir;
  }
  const codeOk = c => /^[A-Z][A-Z0-9]{1,19}$/.test(String(c || ''));
  const fileSafe = s => String(s || '').replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 80);

  // ---------------- カード1枚の md ----------------
  //   ---\ncode: GNPF01\nkind: F\nstatus: 執筆中\n---\n# 題\n…\n## 狙い\n…\n## 骨組み\n…\n## 本文\n…\n## 画像プロンプト\n…\n## メモ\n…
  function parseCard(text, codeFromName) {
    const card = { code: codeFromName, kind: '', status: '構想', title: '', aim: '', skeleton: '', body: '', imagePrompt: '', memo: '' };
    let t = String(text || '').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    const fm = /^---\n([\s\S]*?)\n---\n?/.exec(t);
    if (fm) {
      for (const line of fm[1].split('\n')) { const m = /^(\w+):\s*(.*)$/.exec(line); if (m) card[m[1]] = m[2].trim(); }
      t = t.slice(fm[0].length);
    }
    const names = { '題': 'title' }; for (const [k, l] of SECTIONS) names[l] = k;
    let cur = null; const buf = {};
    for (const line of t.split('\n')) {
      const h = /^(#{1,2})\s+(題|狙い|骨組み|本文|画像プロンプト|メモ)\s*$/.exec(line);
      if (h && ((h[1] === '#' && h[2] === '題') || (h[1] === '##' && h[2] !== '題'))) { cur = names[h[2]]; buf[cur] = []; continue; }
      if (cur) buf[cur].push(line);
    }
    for (const k in buf) card[k] = buf[k].join('\n').replace(/^\n+|\s+$/g, '');
    card.title = card.title.replace(/\n.*/s, '').trim();   // 題は1行
    return card;
  }
  function cardText(c) {
    let s = `---\ncode: ${c.code}\nkind: ${c.kind || ''}\nstatus: ${c.status || '構想'}\n---\n# 題\n${(c.title || '').trim()}\n`;
    for (const [k, l] of SECTIONS) s += `\n## ${l}\n${String(c[k] || '').replace(/\r\n/g, '\n').replace(/\s+$/, '')}\n`;
    return s;
  }
  const cardPath = (dir, code) => path.join(dir, 'cards', code + '.md');
  function readCard(dir, code) {
    const p = cardPath(dir, code);
    const st = fs.statSync(p);
    return { ...parseCard(fs.readFileSync(p, 'utf8'), code), code, mtime: st.mtimeMs, chars: 0 };
  }
  function loadTheme(dir) {
    const th = readJSON(path.join(dir, 'theme.json'), null);
    if (!th) throw new Error('theme.json が読めません');
    th.stages = th.stages || {};
    th.order = Array.isArray(th.order) ? th.order : [];
    // order に無いカードの md が置かれていたら（Claude Code が足したなど）、最後に足す
    let files = []; try { files = fs.readdirSync(path.join(dir, 'cards')).filter(n => n.endsWith('.md')).map(n => n.slice(0, -3)); } catch {}
    for (const c of files) if (!th.order.includes(c)) th.order.push(c);
    th.order = th.order.filter(c => files.includes(c));
    return th;
  }
  function saveTheme(dir, th) { th.updated = now(); writeJSON(path.join(dir, 'theme.json'), th); }
  // AI に渡す読み物（「#### コード　題」＋本文。本体の原稿mdと同じ形）。カードを保存するたびに作り直す
  function writeSummary(dir, th) {
    const cards = th.order.map(c => { try { return readCard(dir, c); } catch { return null; } }).filter(Boolean);
    let md = `# ${th.name}（制作デスク）\n科目：${th.subject}　／　${cards.length}枚　／　更新：${now()}\n`;
    md += `\n> このファイルは制作デスクが自動で作ります。直すときは cards/ の各カードを直してください。\n`;
    if (th.axis) md += `\n## 主軸\n${th.axis}\n`;
    if (th.threads) md += `\n## 縦糸\n${th.threads}\n`;
    md += `\n## カード\n`;
    for (const c of cards) md += `\n#### ${c.code}　${c.title}${c.status ? `　〔${c.status}〕` : ''}\n${c.aim ? `（狙い）${c.aim.replace(/\n/g, ' ')}\n` : ''}${c.body || '（本文まだ）'}\n`;
    fs.writeFileSync(path.join(dir, 'カード一覧.md'), md, 'utf8');
  }
  function countChars(s) { return String(s || '').replace(/\s/g, '').length; }

  // ---------------- コード ----------------
  //   国家と法律：テーマ略称＋種別（F=史実／C=解説）＋2桁（GNPF01）。種別なし（軍事と戦略など）：略称＋2桁（ASAKA01）
  function nextCode(th, kind) {
    const pre = (th.prefix || '') + (kind || '');
    let n = 0;
    for (const c of th.order) { const m = new RegExp('^' + pre + '(\\d+)$').exec(c); if (m) n = Math.max(n, +m[1]); }
    return pre + String(n + 1).padStart(2, '0');
  }
  // カードの並びのとおりに振り直す（種別ごとに 01 から）。ファイル名・画像の名前も一緒に変える
  function renumberPlan(dir, th) {
    const cnt = {}, plan = [];
    for (const c of th.order) {
      let kind = ''; try { kind = readCard(dir, c).kind || ''; } catch {}
      cnt[kind] = (cnt[kind] || 0) + 1;
      plan.push({ from: c, to: (th.prefix || '') + kind + String(cnt[kind]).padStart(2, '0') });
    }
    return plan;
  }
  function applyRename(dir, th, pairs) {
    pairs = pairs.filter(p => p.from !== p.to);
    if (!pairs.length) return [];
    const tmp = pairs.map(p => ({ ...p, tmp: `__tmp_${p.from}_${Date.now()}` }));
    const imgDir = path.join(dir, 'images');
    const imgOf = (code) => { try { return fs.readdirSync(imgDir).filter(n => n.startsWith(code + '.')); } catch { return []; } };
    // 2段階で名前を変える（GNPF02→GNPF03 と GNPF03→GNPF02 が同時にあっても壊れないように）
    for (const p of tmp) {
      fs.renameSync(cardPath(dir, p.from), cardPath(dir, p.tmp));
      p.imgs = imgOf(p.from); for (const n of p.imgs) fs.renameSync(path.join(imgDir, n), path.join(imgDir, p.tmp + n.slice(p.from.length)));
    }
    for (const p of tmp) {
      const c = parseCard(fs.readFileSync(cardPath(dir, p.tmp), 'utf8'), p.from);
      c.code = p.to;
      fs.writeFileSync(cardPath(dir, p.to), cardText(c), 'utf8');
      fs.unlinkSync(cardPath(dir, p.tmp));
      for (const n of p.imgs) fs.renameSync(path.join(imgDir, p.tmp + n.slice(p.from.length)), path.join(imgDir, p.to + n.slice(p.from.length)));
    }
    const map = Object.fromEntries(pairs.map(p => [p.from, p.to]));
    th.order = th.order.map(c => map[c] || c);
    th.renames = (th.renames || []).concat(pairs.map(p => ({ ...p, at: now() }))).slice(-200);
    return pairs;
  }

  // ---------------- CSV ----------------
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  function readCsvRows() {
    const text = fs.readFileSync(config.csvPath, 'utf8').replace(/^﻿/, '');
    return parseCsvText(text).filter(r => r.some(x => String(x).trim()));
  }
  // テーマのカードがCSVでどう変わるかを数える（書き込みはしない）
  function exportPlan(dir, th) {
    const rows = readCsvRows();
    const head = rows[0], data = rows.slice(1);
    const cards = th.order.map(c => readCard(dir, c));
    const codes = new Set(cards.map(c => c.code));
    const byCode = new Map(data.map(r => [String(r[0]).trim(), r]));
    // このテーマの行＝略称で始まり、同じ科目の行
    const isMine = r => th.prefix && String(r[0]).trim().startsWith(th.prefix) && String(r[5]).trim() === th.subject;
    const removed = data.filter(r => isMine(r) && !codes.has(String(r[0]).trim())).map(r => ({ code: r[0], title: r[3], published: String(r[6]).trim() === '1' }));
    const out = cards.map(c => {
      const old = byCode.get(c.code);
      const title = c.kind === 'C' && !c.title.startsWith('→') ? '→' + c.title : c.title;
      const row = [c.code, th.unit || th.name, th.subunit || '', title, c.body || '', th.subject,
                   old ? old[6] || '' : '', old ? old[7] || '' : '', old ? old[8] || '' : '', old ? old[9] || '' : ''];
      const changed = !old || row.some((v, i) => String(v) !== String(old[i] || ''));
      return { code: c.code, title, chars: countChars(c.body), row, isNew: !old, changed,
               published: old && String(old[6]).trim() === '1', otherTheme: old && !isMine(old) };
    });
    return { head, data, out, removed, isMine };
  }
  function writeCsv(head, rows) {
    const text = '﻿' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
    const dir = path.dirname(config.csvPath), base = path.basename(config.csvPath, '.csv');
    const backup = `${base}_backup_${timestamp()}.csv`;
    fs.copyFileSync(config.csvPath, path.join(dir, backup));
    pruneBackups(dir, RE_CSV_BACKUP);
    fs.writeFileSync(config.csvPath, text, 'utf8');
    let drafts = []; try { drafts = syncDraftsFromCsv(text); } catch {}
    return { backup, drafts };
  }

  // ---------------- 取り込み（本体の原稿mdから。最初の1回） ----------------
  //   「#### コード　題」＋本文 の形を、カードに分ける
  function parseDraftMd(text) {
    const out = []; let cur = null;
    for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
      const m = /^####\s+([A-Z][A-Z0-9]{1,19})[\s　]+(.+?)\s*$/.exec(line);
      if (m) { cur = { code: m[1], title: m[2], body: [] }; out.push(cur); continue; }
      if (cur) cur.body.push(line);
    }
    return out.map(c => ({ ...c, body: c.body.join('\n').replace(/^\n+|\s+$/g, '') }));
  }
  // カードタイトル案の表（| コード | 種別 | 仮題 | そのカードで言うこと |）から、コードごとの狙いを拾う
  function parsePlanTable(text) {
    const aims = {};
    for (const line of String(text || '').split(/\r?\n/)) {
      const cells = line.split('|').map(s => s.trim());
      if (cells.length >= 5 && codeOk(cells[1]) && cells[4]) aims[cells[1]] = cells[4].replace(/\*\*/g, '');
    }
    return aims;
  }

  // ---------------- 窓口 ----------------
  async function handle(pathname, method, req, res, q) {
    if (!pathname.startsWith('/api/desk/')) return false;
    const r = pathname.slice('/api/desk/'.length);
    try {
      // テーマの一覧と、基礎資料
      if (r === 'themes' && method === 'GET') {
        fs.mkdirSync(ROOT(), { recursive: true });
        const themes = fs.readdirSync(ROOT(), { withFileTypes: true }).filter(d => d.isDirectory() && !d.name.startsWith('_') && !d.name.startsWith('.'))
          .map(d => { try { const dir = path.join(ROOT(), d.name); const th = loadTheme(dir);
            const st = th.order.map(c => { try { return readCard(dir, c).status; } catch { return ''; } });
            return { folder: d.name, name: th.name, subject: th.subject, prefix: th.prefix, cards: th.order.length,
                     done: st.filter(s => s === '確定').length, stages: th.stages, updated: th.updated || '' };
          } catch { return null; } }).filter(Boolean).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
        const conf = readJSON(path.join(ROOT(), '_設定.json'), null) || { refs: DEFAULT_REFS };
        const refs = (conf.refs || []).map(f => ({ file: f, exists: fs.existsSync(path.join(draftsDir(), f)) }));
        return sendJSON(res, 200, { ok: true, root: ROOT(), themes, refs, stages: STAGES, cardStatus: CARD_STATUS }), true;
      }
      // テーマを1つ読む（カード全部と、調査資料の一覧）
      if (r === 'theme' && method === 'GET') {
        const dir = themeDir(q.get('f')), th = loadTheme(dir);
        const cards = th.order.map(c => { const x = readCard(dir, c); x.chars = countChars(x.body);
          x.image = (() => { try { return fs.readdirSync(path.join(dir, 'images')).find(n => n.startsWith(c + '.')) || ''; } catch { return ''; } })();
          x.liveImage = ['.jpg', '.png'].some(e => fs.existsSync(path.join(config.imagesDir || path.join(path.dirname(config.csvPath), 'images'), c + e)));
          return x; });
        let research = []; try { research = fs.readdirSync(path.join(dir, 'research')).filter(n => /\.(md|txt)$/i.test(n))
          .map(n => { const st = fs.statSync(path.join(dir, 'research', n)); return { name: n, size: st.size, mtime: st.mtimeMs }; })
          .sort((a, b) => a.name.localeCompare(b.name)); } catch {}
        return sendJSON(res, 200, { ok: true, folder: q.get('f'), dir, theme: th, cards, research }), true;
      }
      // 新しいテーマ
      if (r === 'theme/create' && method === 'POST') {
        const b = await body(req);
        const folder = fileSafe(b.folder || b.name);
        if (!folder || !String(b.name || '').trim()) throw new Error('テーマ名を入れてください');
        if (b.prefix && !/^[A-Z][A-Z0-9]{0,9}$/.test(b.prefix)) throw new Error('コードの略称は大文字の英数字にしてください（例 GNP）');
        const dir = path.join(ROOT(), folder);
        if (fs.existsSync(dir)) throw new Error('同じ名前のテーマがもうあります');
        fs.mkdirSync(path.join(dir, 'cards'), { recursive: true }); fs.mkdirSync(path.join(dir, 'research'), { recursive: true });
        // CSVにもう同じ略称のカードがあれば、そのユニット名（アプリのメニューに出る名前）を引き継ぐ
        let unit = b.unit || String(b.name).trim(), subunit = b.subunit || '';
        if (b.prefix) { const hit = readCsvRows().slice(1).find(x => String(x[0]).trim().startsWith(b.prefix) && String(x[5]).trim() === (b.subject || '3級-国家と法律'));
          if (hit) { unit = String(hit[1]).trim() || unit; subunit = String(hit[2]).trim(); } }
        const th = { name: String(b.name).trim(), subject: b.subject || '3級-国家と法律', unit, subunit,
                     prefix: b.prefix || '', usesKind: b.usesKind !== false, axis: '', threads: '', concept: '', goal: '', stages: {}, order: [], created: now() };
        saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, folder }), true;
      }
      // テーマの情報（段・主軸・縦糸など）を保存。order はここでは変えない
      if (r === 'theme/save' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        for (const k of ['name', 'subject', 'unit', 'subunit', 'axis', 'threads', 'concept', 'goal', 'notes']) if (typeof b[k] === 'string') th[k] = b[k];
        if (typeof b.prefix === 'string') { if (b.prefix && !/^[A-Z][A-Z0-9]{0,9}$/.test(b.prefix)) throw new Error('コードの略称は大文字の英数字にしてください'); th.prefix = b.prefix; }
        if (b.stage && STAGES.some(s => s.no === +b.stage.no)) {
          const s = th.stages[b.stage.no] = th.stages[b.stage.no] || {};
          if (['未', '途中', '済'].includes(b.stage.state)) { s.state = b.stage.state; s.at = now(); }
          if (typeof b.stage.note === 'string') s.note = b.stage.note;
          if (typeof b.stage.approved === 'boolean') s.approved = b.stage.approved ? now() : '';
        }
        saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, theme: th }), true;
      }
      // 調査資料
      if (r === 'research' && method === 'GET') {
        const dir = themeDir(q.get('f')), n = fileSafe(q.get('name'));
        return sendJSON(res, 200, { ok: true, name: n, text: fs.readFileSync(path.join(dir, 'research', n), 'utf8') }), true;
      }
      if (r === 'research/save' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder);
        let n = fileSafe(b.name); if (!n) throw new Error('名前を入れてください'); if (!/\.(md|txt)$/i.test(n)) n += '.md';
        const p = path.join(dir, 'research', n);
        if (b.isNew && fs.existsSync(p)) throw new Error('同じ名前の資料がもうあります');
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, String(b.text || ''), 'utf8');
        return sendJSON(res, 200, { ok: true, name: n }), true;
      }
      if (r === 'research/delete' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), n = fileSafe(b.name);
        const trash = path.join(dir, '_ごみ箱'); fs.mkdirSync(trash, { recursive: true });
        fs.renameSync(path.join(dir, 'research', n), path.join(trash, timestamp() + '_' + n));
        return sendJSON(res, 200, { ok: true }), true;
      }
      // カード：保存
      if (r === 'card/save' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        if (!th.order.includes(b.code)) throw new Error('そのカードがありません：' + b.code);
        const cur = readCard(dir, b.code);
        if (b.mtime && Math.abs(cur.mtime - b.mtime) > 1) return sendJSON(res, 200, { ok: false, conflict: true, error: 'このカードは、ほかの所（Claude Code や Obsidian など）で先に直されていました' }), true;
        for (const k of ['title', 'aim', 'skeleton', 'body', 'imagePrompt', 'memo']) if (typeof b[k] === 'string') cur[k] = b[k];
        if (typeof b.kind === 'string') cur.kind = b.kind.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
        if (CARD_STATUS.includes(b.status)) cur.status = b.status;
        fs.writeFileSync(cardPath(dir, b.code), cardText(cur), 'utf8');
        saveTheme(dir, th); writeSummary(dir, th);
        const x = readCard(dir, b.code); x.chars = countChars(x.body);
        return sendJSON(res, 200, { ok: true, card: x }), true;
      }
      // カード：差し込み（index の位置に。コードは種別ごとの次の番号）
      if (r === 'card/insert' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        const kind = String(b.kind || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
        const code = nextCode(th, th.usesKind === false ? '' : kind);
        if (!th.prefix) throw new Error('先にテーマの「コードの略称」（例 GNP）を決めてください');
        const c = { code, kind: th.usesKind === false ? '' : kind, status: '構想', title: String(b.title || '（題はまだ）'), aim: '', skeleton: '', body: '', imagePrompt: '', memo: '' };
        fs.mkdirSync(path.join(dir, 'cards'), { recursive: true });
        fs.writeFileSync(cardPath(dir, code), cardText(c), 'utf8');
        const i = Math.max(0, Math.min(th.order.length, Number.isInteger(b.index) ? b.index : th.order.length));
        th.order.splice(i, 0, code);
        saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, code, order: th.order }), true;
      }
      // カード：並べ替え（画面でドラッグした結果の並びをそのまま受け取る）
      if (r === 'card/order' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        const want = Array.isArray(b.order) ? b.order : [];
        if (want.length !== th.order.length || want.some(c => !th.order.includes(c))) throw new Error('並びが合いません。読み直してください');
        th.order = want; saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, order: th.order }), true;
      }
      // カード：外す（ごみ箱へ。消しはしない）
      if (r === 'card/delete' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        if (!th.order.includes(b.code)) throw new Error('そのカードがありません');
        const trash = path.join(dir, '_ごみ箱'); fs.mkdirSync(trash, { recursive: true });
        fs.renameSync(cardPath(dir, b.code), path.join(trash, timestamp() + '_' + b.code + '.md'));
        th.order = th.order.filter(c => c !== b.code); saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, order: th.order }), true;
      }
      // カード：コードを1枚だけ変える
      if (r === 'card/recode' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        const to = String(b.to || '').toUpperCase().trim();
        if (!codeOk(to)) throw new Error('コードは大文字の英数字にしてください（例 GNPF07）');
        if (th.order.includes(to)) throw new Error(to + ' はこのテーマでもう使っています');
        const pairs = applyRename(dir, th, [{ from: b.code, to }]);
        saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, pairs, order: th.order }), true;
      }
      // コードを並びどおりに振り直す（preview=1 なら見るだけ）
      if (r === 'renumber' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        if (!th.prefix) throw new Error('先にテーマの「コードの略称」（例 GNP）を決めてください');
        const plan = renumberPlan(dir, th).filter(p => p.from !== p.to);
        if (b.preview) return sendJSON(res, 200, { ok: true, plan }), true;
        const pairs = applyRename(dir, th, plan); saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, pairs, order: th.order }), true;
      }
      // 出力の下見（CSVに何が起きるか）
      if (r === 'export/preview' && method === 'GET') {
        const dir = themeDir(q.get('f')), th = loadTheme(dir);
        const p = exportPlan(dir, th);
        return sendJSON(res, 200, { ok: true, cards: p.out.map(({ row, ...x }) => x), removed: p.removed, unit: th.unit, subject: th.subject }), true;
      }
      // 出力（デスク→CSV）。このテーマの行を、デスクの並びで置き換える。公開の印はそのまま残す
      if (r === 'export' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        if (!th.prefix) throw new Error('テーマの「コードの略称」がありません');
        const p = exportPlan(dir, th);
        if (p.out.some(o => o.otherTheme)) throw new Error('ほかのテーマで使っているコードがあります：' + p.out.filter(o => o.otherTheme).map(o => o.code).join('、'));
        const codes = new Set(p.out.map(o => o.code));
        const isDrop = r => p.isMine(r) || codes.has(String(r[0]).trim());
        const at = p.data.findIndex(isDrop);
        const kept = p.data.filter(r => !isDrop(r));
        let pos;
        if (at >= 0) pos = p.data.slice(0, at).filter(r => !isDrop(r)).length;               // もとの場所
        else { let last = -1; kept.forEach((r, i) => { if (String(r[5]).trim() === th.subject) last = i; }); pos = last >= 0 ? last + 1 : kept.length; }
        const rows = kept.slice(0, pos).concat(p.out.map(o => o.row), kept.slice(pos));
        const w = writeCsv(p.head, rows);
        th.exported = now(); saveTheme(dir, th);
        return sendJSON(res, 200, { ok: true, written: p.out.length, removed: p.removed.length, backup: w.backup, drafts: w.drafts }), true;
      }
      // 取り込み（CSV→デスク）：本体画面で直した題・本文を戻す（preview=1 なら見るだけ）
      if (r === 'pull' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        const byCode = new Map(readCsvRows().slice(1).map(x => [String(x[0]).trim(), x]));
        const diff = [];
        for (const code of th.order) {
          const row = byCode.get(code); if (!row) continue;
          const c = readCard(dir, code);
          const title = String(row[3] || '').replace(/^→/, '').trim(), bodyText = String(row[4] || '');
          if (bodyText.trim() === WIP || !bodyText.trim()) continue;   // CSVの方が準備中の仮の文・空なら、比べない（取り込むと書きかけが消える）
          if (!b.preview && Array.isArray(b.codes) && !b.codes.includes(code)) continue;
          if (title !== c.title || bodyText.replace(/\s+$/, '') !== String(c.body || '').replace(/\s+$/, '')) diff.push({ code, title, titleChanged: title !== c.title, bodyChanged: bodyText.replace(/\s+$/, '') !== String(c.body || '').replace(/\s+$/, '') });
          if (!b.preview && diff.length && diff[diff.length - 1].code === code) { c.title = title; c.body = bodyText; fs.writeFileSync(cardPath(dir, code), cardText(c), 'utf8'); }
        }
        if (!b.preview && diff.length) { saveTheme(dir, th); writeSummary(dir, th); }
        return sendJSON(res, 200, { ok: true, diff }), true;
      }
      // 最初の取り込み：本体の原稿md（「#### コード　題」の形）と、カードタイトル案の表（狙い）から
      if (r === 'import' && method === 'POST') {
        const b = await body(req); const dir = themeDir(b.folder), th = loadTheme(dir);
        const src = path.resolve(draftsDir(), String(b.draft || ''));
        if (!src.startsWith(path.resolve(draftsDir()) + path.sep) || !fs.existsSync(src)) throw new Error('原稿mdが見つかりません');
        const got = parseDraftMd(fs.readFileSync(src, 'utf8'));
        if (!got.length) throw new Error('「#### コード　題」の形のカードが見つかりませんでした');
        let aims = {};
        if (b.plan) { const pp = path.resolve(draftsDir(), b.plan); if (pp.startsWith(path.resolve(draftsDir()) + path.sep) && fs.existsSync(pp)) aims = parsePlanTable(fs.readFileSync(pp, 'utf8')); }
        const made = [], skipped = [];
        for (const g of got) {
          if (th.order.includes(g.code)) { skipped.push(g.code); continue; }
          const kind = th.usesKind === false ? '' : ((/^[A-Z]+?([FC])\d+$/.exec(g.code) || [])[1] || '');
          const c = { code: g.code, kind, status: g.body.trim() ? '執筆中' : '構想', title: g.title.replace(/^→/, '').trim(), aim: aims[g.code] || '',
                      skeleton: '', body: g.body, imagePrompt: '', memo: `（${now()} に「${path.basename(src)}」から取り込み）` };
          fs.writeFileSync(cardPath(dir, g.code), cardText(c), 'utf8'); th.order.push(g.code); made.push(g.code);
        }
        // 資料も写す（調査資料として）
        const copied = [];
        for (const f of [].concat(b.research || [])) {
          const p = path.resolve(draftsDir(), String(f)); if (!p.startsWith(path.resolve(draftsDir()) + path.sep) || !fs.existsSync(p)) continue;
          const n = fileSafe(path.basename(p)); fs.copyFileSync(p, path.join(dir, 'research', n)); copied.push(n);
        }
        saveTheme(dir, th); writeSummary(dir, th);
        return sendJSON(res, 200, { ok: true, made, skipped, copied }), true;
      }
      // 基礎資料・テーマのフォルダを開く
      if (r === 'open' && method === 'POST') {
        const b = await body(req);
        let p;
        if (b.ref) { p = path.resolve(draftsDir(), String(b.ref)); if (!p.startsWith(path.resolve(draftsDir()) + path.sep)) throw new Error('場所が違います'); }
        else if (b.folder) p = b.sub ? path.join(themeDir(b.folder), fileSafe(b.sub)) : themeDir(b.folder);
        else p = ROOT();
        if (!fs.existsSync(p)) throw new Error('見つかりません：' + p);
        spawn('explorer.exe', [p], { detached: true, stdio: 'ignore' }).unref();
        return sendJSON(res, 200, { ok: true }), true;
      }
      // 原稿フォルダの md の一覧（取り込みの元を選ぶため）
      if (r === 'drafts' && method === 'GET') {
        const root = draftsDir(), out = [];
        const walk = (d, rel, depth) => { for (const n of fs.readdirSync(d)) { if (n.startsWith('.') || n === '制作デスク') continue;
          const full = path.join(d, n), st = fs.statSync(full);
          if (st.isDirectory()) { if (depth > 0) walk(full, rel + n + '/', depth - 1); } else if (/\.md$/i.test(n)) out.push(rel + n); } };
        walk(root, '', 2);
        return sendJSON(res, 200, { ok: true, files: out.sort() }), true;
      }
      return sendJSON(res, 404, { ok: false, error: '窓口がありません' }), true;
    } catch (e) {
      return sendJSON(res, 200, { ok: false, error: e.message }), true;
    }
  }
  return { handle };
};
