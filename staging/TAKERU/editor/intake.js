// ============================================================
// 📥 搬入（自由研究の原稿を、決まった形で受け取ってカードのCSVへ入れる）2026-11-17
//   依頼：R-20261117-S-03（ソフィー）。原稿は手を入れずに使う。音声は原稿に付けない（作業台で牧村さんが付ける）。
//   牧村さんの決定（11/17）：講座は作業台で立てる。ソフィーはテーマ（5〜6枚）ごとに入れるだけ。
//     例：講座「歴史の中の戦争解説」（宇田川敬介）に、テーマ「天下統一への城攻め」を足していく。
//   アプリでは 講座＝CSVの「テーマ」欄、テーマ＝「サブテーマ」欄（講座の中の見出し）。
//
//   置き場（config.intakeDir。既定 G:\マイドライブ\TAKERU_共有\60_自由研究の搬入）
//     講座一覧.json … 講座の正本（作業台が読み書き）。講座一覧.md … 人が見る表（作業台が書く）
//     受付\<講座名>\<テーマ名>\ … 台帳.csv（番号,題,出典）・01.txt…・01.jpg|png…
//     取り込み済み\<講座名>\YYYYMMDD_<テーマ名>\（取り込み記録.md）
//     差し戻し\<講座名>\YYYYMMDD_<テーマ名>\（差し戻し理由.md）
//   コードは 講座の頭＋番号。講座の続きの番号を作業台が振る（2桁、100枚目からは3桁）。
//   形の説明は置き場の「搬入の決まり.md」。ここを変えたらそちらも直す。
// ============================================================
const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = 'G:\\マイドライブ\\TAKERU_共有\\60_自由研究の搬入';
const BOX = { in: '受付', done: '取り込み済み', back: '差し戻し' };
const COURSES_JSON = '講座一覧.json', COURSES_MD = '講座一覧.md';
const SUBJECT = '自由研究';
const MAX_CARDS = 60;                       // 1つのテーマの上限（ふつうは5〜6枚）
const BODY_SHORT = 100, BODY_LONG = 800;    // 今の自由研究の本文はおよそ270〜520字。外れたら知らせるだけ
// CSVの列（TAKERUcard.csv の見出しの順）
const COL = { code: 0, theme: 1, sub: 2, title: 3, body: 4, subject: 5, pub: 6, author: 7, tags: 8, pdf: 9 };
const padNo = n => (n < 100 ? String(n).padStart(2, '0') : String(n));

module.exports = function intake(ctx) {
  const { config, sendJSON, timestamp, pruneBackups, RE_CSV_BACKUP, RE_STAMP_BACKUP, parseCsvText, syncDraftsFromCsv, imgBackupDir } = ctx;
  const ROOT = () => config.intakeDir || DEFAULT_DIR;
  const boxDir = (k, ...rest) => path.join(ROOT(), BOX[k], ...rest);

  // ---------------- 小さな道具 ----------------
  const ymd = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`; };
  const nowText = () => { const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const readText = p => fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const body = req => new Promise((ok, ng) => { const c = []; req.on('data', x => c.push(x));
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(c).toString('utf8') || '{}')); } catch (e) { ng(e); } }); });
  const csvCell = v => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const str = v => String(v == null ? '' : v).trim();
  // フォルダの名前にしてよいか（講座名・テーマ名はそのままフォルダ名になる）
  function okName(n, what) {
    const s = str(n);
    if (!s) throw new Error(what + 'が空です');
    if (/[\\/:*?"<>|]/.test(s) || s.startsWith('.') || s.endsWith('.') || s !== path.basename(s)) throw new Error(`${what}「${s}」に、フォルダ名に使えない文字があります（\\ / : * ? " < > |）`);
    return s;
  }
  function freeName(dir, base) {
    let n = base, i = 2;
    while (fs.existsSync(path.join(dir, n))) n = `${base}_${i++}`;
    return path.join(dir, n);
  }
  const lsDirs = d => { try { return fs.readdirSync(d, { withFileTypes: true }).filter(x => x.isDirectory()).map(x => x.name).sort(); } catch { return []; } };

  // ---------------- CSV ----------------
  function readCsvRows() {
    const text = fs.readFileSync(config.csvPath, 'utf8').replace(/^\uFEFF/, '');
    return parseCsvText(text).filter(r => r.some(x => String(x).trim()));
  }
  function writeCsv(head, rows) {
    const text = '\uFEFF' + [head].concat(rows).map(r => r.map(csvCell).join(',')).join('\r\n');
    const dir = path.dirname(config.csvPath), base = path.basename(config.csvPath, '.csv');
    const backup = `${base}_backup_${timestamp()}.csv`;
    fs.copyFileSync(config.csvPath, path.join(dir, backup));
    pruneBackups(dir, RE_CSV_BACKUP);
    fs.writeFileSync(config.csvPath, text, 'utf8');
    let drafts = []; try { drafts = syncDraftsFromCsv(text); } catch {}
    return { backup, drafts };
  }
  const codeOf = r => str(r[COL.code]);
  const prefixRe = p => new RegExp('^' + p + '(\\d+)$');
  // 講座のCSVの様子（行・番号の最大・テーマの並び）
  function courseState(data, c) {
    const re = prefixRe(c.prefix);
    const rows = data.filter(r => re.test(codeOf(r)));
    const mine = rows.filter(r => str(r[COL.theme]) === c.name && str(r[COL.subject]) === SUBJECT);
    const maxNo = rows.reduce((m, r) => Math.max(m, parseInt(re.exec(codeOf(r))[1], 10)), 0);
    const themes = []; for (const r of mine) { const t = str(r[COL.sub]); if (!themes.includes(t)) themes.push(t); }
    return { re, rows, mine, foreign: rows.filter(r => !mine.includes(r)), maxNo, themes,
             published: mine.filter(r => str(r[COL.pub]) === '1').length };
  }

  // ---------------- 講座一覧 ----------------
  function loadCourses() {
    try { const j = JSON.parse(readText(path.join(ROOT(), COURSES_JSON))); return Array.isArray(j.courses) ? j.courses : []; } catch { return []; }
  }
  function saveCourses(list) {
    fs.writeFileSync(path.join(ROOT(), COURSES_JSON), JSON.stringify({ note: '作業台の「📥 搬入」が書く講座の正本です。手で直さないでください。', courses: list }, null, 2) + '\n', 'utf8');
    writeCoursesMd(list);
  }
  function writeCoursesMd(list) {
    let data = []; try { data = readCsvRows().slice(1); } catch {}
    const lines = ['# 自由研究の講座一覧', '', `作業台の「📥 搬入」が書く表です（手で直さない）。最後に書いた日時：${nowText()}`, '',
      'テーマの原稿は `受付\\<講座名>\\<テーマ名>\\` に入れる。形は `搬入の決まり.md`。', '',
      '| 講座名 | 著者 | コードの頭 | 研究テーマ | 出典の書き方 | CSVの枚数（公開） | 入ったテーマ |', '|---|---|---|---|---|---|---|'];
    for (const c of list) {
      const s = courseState(data, c);
      lines.push(`| ${c.name} | ${c.author} | ${c.prefix} | ${c.tags || ''} | ${c.source || ''} | ${s.mine.length}（${s.published}） | ${s.themes.join('・') || '—'} |`);
    }
    if (!list.length) lines.push('| （まだありません） | | | | | | |');
    fs.writeFileSync(path.join(ROOT(), COURSES_MD), lines.join('\n') + '\n', 'utf8');
  }
  function findCourse(name) {
    const c = loadCourses().find(x => x.name === str(name));
    if (!c) throw new Error(`講座「${str(name)}」が立っていません。作業台の「＋ 新しい講座」で先に立ててください`);
    return c;
  }
  function knownTags(data) {
    const s = new Set();
    for (const r of data) if (str(r[COL.subject]) === SUBJECT) String(r[COL.tags] || '').split(';').map(x => x.trim()).filter(Boolean).forEach(x => s.add(x));
    return s;
  }

  // 講座を作る・直す
  function saveCourse(b) {
    const list = loadCourses();
    const orig = b.original ? list.find(x => x.name === b.original) : null;
    if (b.original && !orig) throw new Error('直そうとした講座が見つかりません');
    const c = {
      name: okName(b.name, '講座名'), author: str(b.author), prefix: str(b.prefix).toUpperCase(),
      tags: str(b.tags).split(/[;；、,]/).map(s => s.trim()).filter(Boolean).join(';'), source: str(b.source),
      created: orig ? orig.created : nowText(), updated: nowText(),
      lastNo: orig ? (Number(orig.lastNo) || 0) : 0,     // これまでに振った最後の番号（外したコードを使い回さないため）
    };
    if (!c.author) throw new Error('著者を入れてください');
    if (!/^[A-Z]{2,8}$/.test(c.prefix)) throw new Error('コードの頭は、英大文字2〜8字にしてください（例 UDG）');
    const data = readCsvRows().slice(1);
    if (orig) {
      const s = courseState(data, orig);
      if (s.mine.length && (c.name !== orig.name || c.prefix !== orig.prefix)) throw new Error(`この講座のカードがもう ${s.mine.length}枚 CSV にあるので、講座名とコードの頭は変えられません`);
    }
    const others = list.filter(x => x !== orig);
    if (others.some(x => x.name === c.name)) throw new Error(`講座「${c.name}」はもうあります`);
    if (others.some(x => x.prefix === c.prefix)) throw new Error(`コードの頭「${c.prefix}」は、ほかの講座が使っています`);
    // CSVで同じ頭のコードを使っている行（この講座の行は別）
    const used = data.filter(r => prefixRe(c.prefix).test(codeOf(r)) && !(orig && str(r[COL.theme]) === orig.name));
    if (used.length) throw new Error(`コードの頭「${c.prefix}」は、もうカードが使っています（${used.slice(0, 3).map(r => codeOf(r) + '「' + str(r[COL.theme]) + '」').join('、')}${used.length > 3 ? ' ほか' : ''}）`);
    // 長い頭で、ほかのコードの頭と紛れないか（例 頭 MS に対して MSENSHI01 は ^MS\d+$ に当たらないので問題なし）
    const nameUsed = data.filter(r => str(r[COL.theme]) === c.name && !(orig && orig.name === c.name));
    if (nameUsed.length) throw new Error(`「${c.name}」という名前の講座（テーマ）が、もう CSV にあります（${codeOf(nameUsed[0])} など）`);
    // 受付のフォルダ（名前を変えたら移す）
    if (!fs.existsSync(boxDir('in'))) fs.mkdirSync(boxDir('in'), { recursive: true });
    if (orig && orig.name !== c.name && fs.existsSync(boxDir('in', orig.name))) fs.renameSync(boxDir('in', orig.name), boxDir('in', c.name));
    if (!fs.existsSync(boxDir('in', c.name))) fs.mkdirSync(boxDir('in', c.name), { recursive: true });
    const next = orig ? list.map(x => (x === orig ? c : x)) : list.concat([c]);
    saveCourses(next);
    const warn = [];
    const known = knownTags(data), unknown = c.tags.split(';').filter(t => t && !known.has(t));
    if (unknown.length) warn.push(`研究テーマに、今のアプリに無い名前があります：${unknown.join('、')}（新しい分け方として出ます）`);
    if (orig && (orig.author !== c.author || orig.tags !== c.tags) && courseState(data, orig).mine.length) warn.push('著者・研究テーマの直しは、これから入れるカードから効きます（もう入っているカードは、カードの画面で直してください）');
    return { course: c, warnings: warn };
  }

  // 図の縦横（PNG・JPEG の頭を読むだけ）
  function imageSize(file) {
    const b = fs.readFileSync(file);
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504E47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b.length > 4 && b[0] === 0xFF && b[1] === 0xD8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xFF) { i++; continue; }
        const m = b[i + 1];
        if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
        const len = b.readUInt16BE(i + 2);
        if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + len;
      }
      return { w: 0, h: 0 };
    }
    return null;
  }

  // ---------------- テーマの原稿の読み取りと確かめ ----------------
  //   errors＝差し戻しになるもの、warnings＝知らせるだけ
  function themeDir(course, theme) {
    const c = okName(course, '講座名'), t = okName(theme, 'テーマ名');
    const d = boxDir('in', c, t);
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) throw new Error(`受付にそのテーマがありません：${c}\\${t}`);
    return d;
  }
  function readTheme(courseName, themeName) {
    const dir = themeDir(courseName, themeName);
    const course = findCourse(courseName), theme = str(themeName);
    const errors = [], warnings = [];
    const files = fs.readdirSync(dir);
    const cards = [];
    if (!files.includes('台帳.csv')) errors.push('台帳.csv がありません');
    else {
      const rows = parseCsvText(readText(path.join(dir, '台帳.csv'))).filter(r => r.some(x => String(x).trim()));
      const head = (rows[0] || []).map(s => str(s));
      const at = k => head.indexOf(k);
      if (at('番号') < 0 || at('題') < 0) errors.push('台帳.csv の1行目（見出し）に「番号」と「題」が要ります（番号,題,出典）');
      else {
        for (const r of rows.slice(1)) cards.push({ no: parseInt(str(r[at('番号')]), 10), title: str(r[at('題')]),
          source: (at('出典') >= 0 ? str(r[at('出典')]) : '') });
        if (!cards.length) errors.push('台帳.csv にカードの行がありません');
        if (cards.length > MAX_CARDS) errors.push(`カードが${cards.length}枚あります。1つのテーマは${MAX_CARDS}枚までです`);
        const nos = cards.map(c => c.no);
        if (nos.some(n => !Number.isInteger(n) || n < 1)) errors.push('台帳.csv の「番号」に、数字でないものがあります');
        else {
          const dup = nos.filter((n, i) => nos.indexOf(n) !== i);
          if (dup.length) errors.push('台帳.csv の番号が重なっています：' + [...new Set(dup)].join('、'));
          const miss = []; for (let n = 1; n <= Math.max(...nos); n++) if (!nos.includes(n)) miss.push(n);
          if (miss.length) errors.push('台帳.csv の番号が抜けています（テーマの中で 1 から続けてください）：' + miss.join('、'));
        }
        cards.forEach(c => { if (!c.title) errors.push(`${c.no}番の「題」が空です`); });
      }
    }
    const byNo = re => { const m = new Map(); for (const f of files) { const x = re.exec(f); if (x) m.set(parseInt(x[1], 10), f); } return m; };
    const txts = byNo(/^0*(\d+)\.txt$/i), imgs = byNo(/^0*(\d+)\.(jpe?g|png)$/i), others = byNo(/^0*(\d+)\.(gif|webp|bmp|heic|tiff?)$/i);
    cards.sort((a, b) => a.no - b.no);
    for (const c of cards) {
      const t = txts.get(c.no);
      if (!t) errors.push(`${c.no}番の本文（${padNo(c.no)}.txt）がありません`);
      else {
        c.body = readText(path.join(dir, t)).replace(/\s+$/, '');
        c.len = c.body.replace(/\s/g, '').length;
        if (!c.len) errors.push(`${c.no}番の本文が空です`);
        else if (c.len < BODY_SHORT) warnings.push(`${c.no}番の本文が短めです（${c.len}字）`);
        else if (c.len > BODY_LONG) warnings.push(`${c.no}番の本文が長めです（${c.len}字。今のカードはおよそ270〜520字）`);
      }
      const im = imgs.get(c.no);
      if (!im) errors.push(others.get(c.no) ? `${c.no}番の図が jpg・png ではありません（${others.get(c.no)}）` : `${c.no}番の図（${padNo(c.no)}.jpg か .png）がありません`);
      else {
        c.imageFile = im;
        const sz = imageSize(path.join(dir, im));
        if (!sz) errors.push(`${c.no}番の図（${im}）が読めません`);
        else {
          c.imgW = sz.w; c.imgH = sz.h;
          if (sz.w && sz.h && Math.abs(sz.w / sz.h - 4 / 3) > 0.02) warnings.push(`${c.no}番の図が横4：縦3ではありません（${sz.w}×${sz.h}）。取り込むと960×720に伸び縮みします`);
        }
      }
      // 出典の1行：（出典：著者＋出典の書き方＋号）。号の欄が空なら、出典の書き方だけ
      const src = str(course.source) + str(c.source);
      c.sourceLine = src ? `（出典：${course.author}${src}）` : '';
    }
    // コード：同じテーマが CSV にあれば、そのコードを順に使い回す。足りない分は講座の続きの番号
    const data = readCsvRows().slice(1);
    const s = courseState(data, course);
    if (s.foreign.length) errors.push(`コードの頭「${course.prefix}」を、この講座でないカードが使っています（${s.foreign.slice(0, 3).map(r => codeOf(r)).join('、')}）`);
    const old = s.mine.filter(r => str(r[COL.sub]) === theme);
    // 一度外したコードは使い回さない（外に出したリンク ?card= が別のカードを指さないように）。講座に「振った最後の番号」を覚えておく
    let next = Math.max(s.maxNo, Number(course.lastNo) || 0);
    cards.forEach((c, i) => { c.code = i < old.length ? codeOf(old[i]) : course.prefix + padNo(++next); c.reuse = i < old.length; });
    let replace = null;
    if (old.length) {
      const drop = old.slice(cards.length);
      replace = { count: old.length, published: old.filter(r => str(r[COL.pub]) === '1').length,
                  codes: old.map(codeOf), drop: drop.map(codeOf), dropPublished: drop.filter(r => str(r[COL.pub]) === '1').map(codeOf) };
      if (replace.dropPublished.length) warnings.push(`⚠ 枚数が減るので、公開中のカード ${replace.dropPublished.join('、')} が CSV から外れます`);
      else if (drop.length) warnings.push(`枚数が減るので、${replace.drop.join('、')} が CSV から外れます`);
    }
    return { course, theme, dir, cards, errors, warnings, replace, courseCount: s.mine.length };
  }

  const toRow = (t, c, pub) => {
    const r = new Array(10).fill('');
    r[COL.code] = c.code; r[COL.theme] = t.course.name; r[COL.sub] = t.theme; r[COL.title] = c.title;
    r[COL.body] = c.body + (c.sourceLine ? '\n\n' + c.sourceLine : ''); r[COL.subject] = SUBJECT; r[COL.pub] = pub || '';
    r[COL.author] = t.course.author; r[COL.tags] = t.course.tags;
    return r;
  };
  const themeSummary = t => ({ course: t.course.name, theme: t.theme, count: t.cards.length, errors: t.errors, warnings: t.warnings, replace: t.replace,
    range: t.cards.length ? (t.cards.length > 1 ? `${t.cards[0].code}〜${t.cards[t.cards.length - 1].code}` : t.cards[0].code) : '' });

  // ---------------- 経路 ----------------
  async function handle(pathname, method, req, res, q) {
    const r = pathname.slice('/api/intake/'.length);
    try {
      // 講座ごとの受付の一覧（取り込み済み・差し戻しは名前だけ）
      if (r === 'list' && method === 'GET') {
        if (!fs.existsSync(ROOT())) return sendJSON(res, 200, { ok: true, root: ROOT(), missing: true, courses: [], stray: [], done: [], back: [] });
        const data = readCsvRows().slice(1);
        const list = loadCourses();
        const courses = list.map(c => {
          const s = courseState(data, c);
          const inbox = lsDirs(boxDir('in', c.name)).map(t => { try { return themeSummary(readTheme(c.name, t)); } catch (e) { return { course: c.name, theme: t, count: 0, errors: [e.message], warnings: [] }; } });
          return { ...c, cardCount: s.mine.length, published: s.published, themes: s.themes, maxNo: s.maxNo, inbox };
        });
        const stray = lsDirs(boxDir('in')).filter(n => !list.some(c => c.name === n));
        const past = k => list.flatMap(c => lsDirs(boxDir(k, c.name)).map(n => `${c.name}\\${n}`)).sort((a, b) => b.split('\\')[1].localeCompare(a.split('\\')[1])).slice(0, 20);
        return sendJSON(res, 200, { ok: true, root: ROOT(), courses, stray, done: past('done'), back: past('back') });
      }
      // 講座を作る・直す
      if (r === 'course' && method === 'POST') {
        const b = await body(req);
        if (!fs.existsSync(ROOT())) fs.mkdirSync(ROOT(), { recursive: true });
        const out = saveCourse(b);
        return sendJSON(res, 200, { ok: true, ...out });
      }
      // テーマの中身（下見用）
      if (r === 'item' && method === 'GET') {
        const t = readTheme(q.get('course'), q.get('theme'));
        return sendJSON(res, 200, { ok: true, ...themeSummary(t), courseInfo: t.course, courseCount: t.courseCount,
          cards: t.cards.map(c => ({ no: c.no, code: c.code, reuse: !!c.reuse, title: c.title, sourceLine: c.sourceLine || '', body: c.body || '', len: c.len || 0,
                                     image: c.imageFile || '', imgW: c.imgW || 0, imgH: c.imgH || 0 })) });
      }
      // 図のファイルを返す（ブラウザで960×720のJPEGにするため）
      if (r === 'image' && method === 'GET') {
        const dir = themeDir(q.get('course'), q.get('theme')), f = String(q.get('file') || '');
        if (f !== path.basename(f) || !/\.(jpe?g|png)$/i.test(f)) throw new Error('図の名前が正しくありません');
        const full = path.join(dir, f);
        if (!fs.existsSync(full)) throw new Error('図がありません');
        res.writeHead(200, { 'Content-Type': /png$/i.test(f) ? 'image/png' : 'image/jpeg', 'Cache-Control': 'no-store' });
        return res.end(fs.readFileSync(full));
      }
      // 取り込む：フォルダを「取り込み済み」へ移してから、CSVへ未公開で入れ、図を images へ
      if (r === 'import' && method === 'POST') {
        const b = await body(req);
        const t = readTheme(b.course, b.theme);
        if (t.errors.length) throw new Error('直しが要るところがあります：' + t.errors.join('／'));
        if (t.replace && !b.replace) throw new Error(`このテーマのカードがもう ${t.replace.count}枚 CSV にあります（${t.replace.codes.join('、')}）。入れ替えるなら「置き換えて取り込む」を押してください`);
        const imgs = b.images || {}, bufs = {};
        for (const c of t.cards) {
          const m = /^data:image\/jpeg;base64,(.+)$/.exec(String(imgs[c.no] || ''));
          if (!m) throw new Error(`${c.no}番の図を変換できませんでした`);
          bufs[c.code] = Buffer.from(m[1], 'base64');
        }
        const rows = readCsvRows(), head = rows[0], data = rows.slice(1);
        const s = courseState(data, t.course);
        const oldRows = s.mine.filter(x => str(x[COL.sub]) === t.theme);
        const oldSet = new Set(oldRows);
        const pubOf = new Map(oldRows.map(x => [codeOf(x), str(x[COL.pub])]));
        const newRows = t.cards.map(c => toRow(t, c, pubOf.get(c.code) || ''));
        const kept = data.filter(x => !oldSet.has(x));
        let pos;
        if (oldRows.length) { const first = data.indexOf(oldRows[0]); pos = data.slice(0, first).filter(x => !oldSet.has(x)).length; }   // もとの場所
        else {
          const mineKept = new Set(s.mine);
          let last = -1; kept.forEach((x, i) => { if (mineKept.has(x)) last = i; });                  // 講座の最後の行の後ろ
          if (last < 0) kept.forEach((x, i) => { if (str(x[COL.subject]) === SUBJECT) last = i; });   // 講座が空なら最後の自由研究の後ろ
          pos = last >= 0 ? last + 1 : kept.length;
        }
        const out = kept.slice(0, pos).concat(newRows, kept.slice(pos));
        // 先にフォルダを移す（開かれていて移せないなら、何も書かずに止める）
        const doneDir = boxDir('done', t.course.name);
        if (!fs.existsSync(doneDir)) fs.mkdirSync(doneDir, { recursive: true });
        const to = freeName(doneDir, `${ymd()}_${t.theme}`);
        fs.renameSync(t.dir, to);
        let w;
        try { w = writeCsv(head, out); } catch (e) { try { fs.renameSync(to, t.dir); } catch {} throw e; }
        // 図（同じ名前があれば控えを取ってから）
        const imgDir = config.imagesDir;
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });
        for (const code of Object.keys(bufs)) {
          for (const f of fs.readdirSync(imgDir)) {
            if (path.basename(f, path.extname(f)) !== code) continue;
            if (!fs.existsSync(imgBackupDir)) fs.mkdirSync(imgBackupDir, { recursive: true });
            fs.copyFileSync(path.join(imgDir, f), path.join(imgBackupDir, `${code}_${timestamp()}${path.extname(f)}`));
            if (path.extname(f).toLowerCase() !== '.jpg') fs.unlinkSync(path.join(imgDir, f));
          }
          fs.writeFileSync(path.join(imgDir, code + '.jpg'), bufs[code]);
        }
        try { pruneBackups(imgBackupDir, RE_STAMP_BACKUP); } catch {}
        const dropped = t.replace ? t.replace.drop : [];
        const rec = ['# 取り込み記録', '', `- 取り込んだ日時：${nowText()}（作業台）`, `- 講座：${t.course.name}（${t.course.author}・頭 ${t.course.prefix}）`,
          `- テーマ：${t.theme}`, `- 枚数：${t.cards.length}枚（未公開で入れた${oldRows.length ? `。前の ${oldRows.length}枚と入れ替え` : ''}）`,
          ...(dropped.length ? [`- CSV から外したコード：${dropped.join('、')}`] : []), '',
          '| コード | 題 |', '|---|---|', ...t.cards.map(c => `| ${c.code} | ${c.title} |`),
          ...(t.warnings.length ? ['', '## 注意として出たもの', ...t.warnings.map(x => '- ' + x)] : []), ''].join('\n');
        fs.writeFileSync(path.join(to, '取り込み記録.md'), rec, 'utf8');
        // 振った最後の番号を講座に覚える（講座一覧.md も書き直す）
        try {
          const re = prefixRe(t.course.prefix);
          const top = t.cards.reduce((m, c) => Math.max(m, parseInt(re.exec(c.code)[1], 10)), 0);
          const list = loadCourses().map(x => (x.name === t.course.name ? { ...x, lastNo: Math.max(Number(x.lastNo) || 0, top, s.maxNo) } : x));
          saveCourses(list);
        } catch {}
        return sendJSON(res, 200, { ok: true, codes: t.cards.map(c => c.code), removed: oldRows.length, dropped, backup: w.backup, movedTo: `${t.course.name}\\${path.basename(to)}` });
      }
      // 差し戻す：理由を書いて「差し戻し\<講座名>」へ
      if (r === 'return' && method === 'POST') {
        const b = await body(req);
        const dir = themeDir(b.course, b.theme);
        let found = { errors: [], warnings: [] };
        try { found = readTheme(b.course, b.theme); } catch (e) { found.errors.push(e.message); }
        const reason = str(b.reason);
        if (!reason && !found.errors.length && !found.warnings.length) throw new Error('差し戻す理由を書いてください');
        const txt = ['# 差し戻し理由', '', `- 日時：${nowText()}（作業台）`, `- 講座：${str(b.course)}　テーマ：${str(b.theme)}`, '',
          ...(reason ? ['## 作業台からのひとこと', '', reason, ''] : []),
          ...(found.errors.length ? ['## 直しが要るところ', ...found.errors.map(x => '- ' + x), ''] : []),
          ...(found.warnings.length ? ['## 気になったところ（直さなくてもよい）', ...found.warnings.map(x => '- ' + x), ''] : []),
          '直したら、このファイルを消して、フォルダごと `受付\\<講座名>\\` へ入れ直してください。', ''].join('\n');
        fs.writeFileSync(path.join(dir, '差し戻し理由.md'), txt, 'utf8');
        const backDir = boxDir('back', okName(b.course, '講座名'));
        if (!fs.existsSync(backDir)) fs.mkdirSync(backDir, { recursive: true });
        const to = freeName(backDir, `${ymd()}_${str(b.theme)}`);
        fs.renameSync(dir, to);
        return sendJSON(res, 200, { ok: true, movedTo: `${str(b.course)}\\${path.basename(to)}` });
      }
      return sendJSON(res, 404, { ok: false, error: 'not found' });
    } catch (e) {
      if (e.code === 'EBUSY' || e.code === 'EPERM') return sendJSON(res, 400, { ok: false,
        error: 'フォルダが開かれていて移せませんでした。エクスプローラーなどで開いていれば閉じてから、もう一度押してください（CSVと図には、まだ何も入れていません）' });
      return sendJSON(res, 400, { ok: false, error: e.message });
    }
  }
  // 試し用（番号の振り方を外から確かめる）
  return { handle, _padNo: padNo };
};
