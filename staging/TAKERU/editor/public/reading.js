// ============================================================
// 🔤 読み確認と読みの辞書（2026-11-19 牧村さん）  サーバーは server.js の handleReading
//   流れ：原稿を仕上げる → テーマごとに「🔤 読み確認」で読みの原稿を確かめて「確定」→「🎙 一括」でまとめて録る
//   読みの下書きは、決まりで作る（考える力は使わない）：
//     1. 作業台の辞書の語（src≠voicepeak）を、長い語から読みに置き換える
//     2. 年代（数字＋年・年代・年頃・年間、範囲「1542〜43年」）をカタカナの読みにする
//     3. 辞書に無いハイフン入りの型式（F-35 など）は置き換えず「要確認」として知らせる
//   VOICEPEAK から取り込んだ語は VOICEPEAK 側で効くので置き換えない（「方」「城」などを文字のまま変えると「地方」まで変わるため）
//   確定した読み原稿は、今までの読み修正（reading_scripts.json）に入る。一括録音・1枚の録音はそれを読ませる
// ============================================================
let rdDict = [], rdMeta = {}, rdCur = '', rdTab = 'cards', rdGen = null;

// ---------------- 数字の読み（年代用） ----------------
const RD_DIG = ['', 'イチ', 'ニ', 'サン', 'ヨン', 'ゴ', 'ロク', 'ナナ', 'ハチ', 'キュウ'];
const RD_HUN = ['', 'ヒャク', 'ニヒャク', 'サンビャク', 'ヨンヒャク', 'ゴヒャク', 'ロッピャク', 'ナナヒャク', 'ハッピャク', 'キュウヒャク'];
const RD_THO = ['', 'セン', 'ニセン', 'サンゼン', 'ヨンセン', 'ゴセン', 'ロクセン', 'ナナセン', 'ハッセン', 'キュウセン'];
// 0〜9999 をカタカナに。beforeNen=true なら、一の位の4を「ヨ」にする（4年＝ヨネン、1984年＝…ハチジュウヨネン）
function rdNum(n, beforeNen) {
  n = Number(n);
  if (!Number.isInteger(n) || n < 0 || n > 9999) return null;
  if (n === 0) return 'ゼロ';
  const th = Math.floor(n / 1000), hu = Math.floor(n / 100) % 10, te = Math.floor(n / 10) % 10, on = n % 10;
  let s = RD_THO[th] + RD_HUN[hu];
  if (te) s += (te === 1 ? '' : RD_DIG[te]) + 'ジュウ';
  if (on) s += (beforeNen && on === 4) ? 'ヨ' : RD_DIG[on];
  return s;
}
const rdZen = s => String(s).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
// 本文の中の年代を探す：[紀元前]数字[〜数字]年[代|頃|間]
const RD_YEAR_RE = /(\d{1,4})(?:\s*[〜～~\-－–]\s*(\d{1,4}))?年(代|頃|ごろ|間)?/g;
function rdYearRead(m) {
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : null, tail = m[3] || '';
  const end = tail === '代' ? 'ネンダイ' : (tail === '頃' || tail === 'ごろ') ? 'ネンゴロ' : tail === '間' ? 'ネンカン' : 'ネン';
  const beforeNen = !tail || tail !== '代' ? true : false;
  if (b === null) { const r = rdNum(a, beforeNen); return r ? r + end : null; }
  const ra = rdNum(a, false), rb = rdNum(b, beforeNen);
  return ra && rb ? ra + 'カラ' + rb + end : null;
}
// ハイフン入りの型式（英字-英数字）
const RD_MODEL_RE = /[A-Za-zＡ-Ｚａ-ｚ]{1,5}[\-‐－–][0-9A-Za-z０-９Ａ-Ｚａ-ｚ]{1,5}/g;

// ---------------- 下書きを作る ----------------
//   返り値 { text, marks:[{from,to,orig,read,kind:'dict'|'year'|'flag'}] }（from/to は本文の位置）
//   cardId を渡すと、「このカードだけ」の語（cards にそのコードがある語）も当てる。ソフィー案（pending）は kind='sophie'
//   opt.noPending=true なら、ソフィー案（未承認）は当てない（一括録音の自動の読み。ソフィー案は牧村さんが確かめてから）
//   ソフィー案は、頼んだテーマ（theme）のカードにだけ当てる（S-15）
// ソフィー案を頼んだテーマ（themes。古い形は theme）。テーマの記録が無い語は、どのテーマにも当てる
function rdThemes(x) { return x.themes || (x.theme ? [x.theme] : []); }
function rdInTheme(x, theme) { const t = rdThemes(x); return !t.length || t.includes(theme); }
function rdBuild(body, cardId, opt) {
  opt = opt || {};
  body = String(body || '');
  const norm = rdZen(body);   // 全角数字を半角にした写し（位置は同じ）
  const cands = [];
  const card = cardId && typeof cardData !== 'undefined' ? cardData.find(c => c.id === cardId) : null;
  const theme = card ? card.genre : '';
  const active = rdDict.filter(x => x.src !== 'voicepeak' && x.sur && (!(x.cards || []).length || (cardId && x.cards.includes(cardId)))
      && (!x.pending || (!opt.noPending && rdInTheme(x, theme))))
    .sort((a, b) => b.sur.length - a.sur.length || ((b.cards || []).length - (a.cards || []).length));
  for (const d of active) {
    let i = 0;
    while ((i = body.indexOf(d.sur, i)) >= 0) { cands.push({ from: i, to: i + d.sur.length, orig: d.sur, read: d.pron, kind: d.pending ? 'sophie' : 'dict' }); i += d.sur.length; }
  }
  let m; RD_YEAR_RE.lastIndex = 0;
  while ((m = RD_YEAR_RE.exec(norm))) {
    const r = rdYearRead(m);
    if (r) cands.push({ from: m.index, to: m.index + m[0].length, orig: body.slice(m.index, m.index + m[0].length), read: r, kind: 'year' });
  }
  const known = new Set(rdDict.map(x => rdZen(x.sur).toUpperCase()));
  RD_MODEL_RE.lastIndex = 0;
  while ((m = RD_MODEL_RE.exec(body))) {
    if (!known.has(rdZen(m[0]).toUpperCase())) cands.push({ from: m.index, to: m.index + m[0].length, orig: m[0], read: '', kind: 'flag' });
  }
  // 重なりは、先に始まる・長い・辞書＞年代＞要確認 の順で残す
  const rank = { dict: 0, sophie: 0, year: 1, flag: 2 };
  cands.sort((a, b) => a.from - b.from || (b.to - b.from) - (a.to - a.from) || rank[a.kind] - rank[b.kind]);
  const marks = []; let last = -1;
  for (const c of cands) { if (c.from >= last) { marks.push(c); last = c.to; } }
  let text = '', p = 0;
  for (const k of marks) { text += body.slice(p, k.from) + (k.kind === 'flag' ? k.orig : k.read); p = k.to; }
  text += body.slice(p);
  return { text, marks };
}
function rdHash(s) { let h = 5381; s = String(s || ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

// ---------------- カードの読みの状態 ----------------
//   'ok'＝確定済み、'changed'＝確定の後に本文が変わった、'legacy'＝前からの読み原稿（確定の印なし）、'none'＝未確認
function readingStatus(card) {
  const meta = rdMeta[card.id];
  if (meta) return meta.bodyHash === rdHash(card.body) ? 'ok' : 'changed';
  return (readingScripts[card.id] || '').trim() ? 'legacy' : 'none';
}
const RD_ST = { ok: ['✅', '確定済み'], changed: ['⚠', '本文が変わった'], legacy: ['📝', '前からの読み原稿'], none: ['・', '未確認'] };
// 録音で読ませる文（S-16。1枚ずつの確定は要らない）
//   確定済み・前からの読み原稿 → その読み原稿／それ以外 → 決まり（年代・作業台の辞書）で自動に作った読み
function rdAutoText(card) {
  const st = readingStatus(card), s = (readingScripts[card.id] || '').trim();
  if ((st === 'ok' || st === 'legacy') && s) return s;
  return rdBuild(card.body, card.id, { noPending: true }).text.trim();
}

// ---------------- 画面 ----------------
async function rdLoad() {
  try { const a = await (await fetch('/api/reading-dict')).json(); if (a.ok) rdDict = a.items; } catch (e) {}
  try { const b = await (await fetch('/api/reading-meta')).json(); if (b.ok) rdMeta = b.meta; } catch (e) {}
}
function rdCards() { return (typeof filteredList !== 'undefined' ? filteredList : []).filter(c => (c.body || '').trim()); }
let rdReply = null;   // そのテーマのソフィーの返事（GET /api/reading-reply）
async function rdLoadReply() {
  rdReply = null;
  if (typeof curUnit === 'undefined' || !curUnit) return;
  try { const j = await (await fetch('/api/reading-reply?theme=' + encodeURIComponent(curUnit))).json(); if (j.ok && j.found) rdReply = j; } catch (e) {}
}
async function openReading(tab) {
  if (typeof curUnit !== 'undefined' && !curUnit) { alert('先に左の一覧でテーマを選んでください'); return; }
  await rdLoad();
  await rdLoadReply();
  document.getElementById('readingModal').style.display = 'flex';
  rdTab = tab === 'check' ? 'check' : 'cards';
  if (rdTab === 'check') { rdChkCur = ''; await rdChkLoad(); }
  const cs = rdCards();
  if (!cs.some(c => c.id === rdCur)) rdCur = (cs.find(c => readingStatus(c) !== 'ok') || cs[0] || {}).id || '';
  rdRender();
}
function closeReading() { document.getElementById('readingModal').style.display = 'none'; }
function rdToast(t, bad) {
  const el = document.getElementById('rdToast'); if (!el) return;
  el.textContent = t; el.className = 'dk-toast ' + (bad ? 'bad' : 'ok'); el.style.display = 'block';
  clearTimeout(rdToast.t); rdToast.t = setTimeout(() => { el.style.display = 'none'; }, bad ? 8000 : 3000);
}
function rdRender() {
  document.querySelectorAll('.rd-tab').forEach(b => b.classList.toggle('on', b.dataset.t === rdTab));
  if (rdTab === 'dict') return rdRenderDict();
  if (rdTab === 'check') return rdRenderCheck();
  const cs = rdCards();
  const count = s => cs.filter(c => readingStatus(c) === s).length;
  const pend = rdDict.filter(x => x.pending && rdInTheme(x, curUnit)).length;
  document.getElementById('rdSide').innerHTML =
    `<div class="rd-sum">確定 ${count('ok')}／${cs.length}枚${count('changed') ? `・本文が変わった ${count('changed')}` : ''}</div>` +
    `<div class="rd-sophiebox">
       ${rdReply ? `<button class="btn-save" onclick="rdImportReply()">📥 ソフィーの返事を取り込む（${rdReply.rows.length}語${rdReply.bad.length ? `・形の悪い行 ${rdReply.bad.length}` : ''}）</button>`
                 : `<button class="dash-refresh" onclick="rdRequest()" title="このテーマの今の本文・辞書・決まりを、TAKERU_共有の 70_読み\\依頼 に置く">📤 ソフィーに読みを頼む</button>`}
       ${pend ? `<div class="ik-note">ソフィー案（未承認）${pend}語。カードを確定すると、使った語が認められます。</div>` : ''}
     </div>` +
    cs.map(c => { const st = readingStatus(c); return `<div class="rd-item ${c.id === rdCur ? 'on' : ''} st-${st}" data-id="${esc(c.id)}" onclick="rdOpen(this.dataset.id)">
      <span class="rd-st" title="${RD_ST[st][1]}">${RD_ST[st][0]}</span><span class="rd-code">${esc(c.id)}</span><span class="rd-title">${esc(c.title || '')}</span></div>`; }).join('');
  rdRenderCard();
}
function rdOpen(id) { rdCur = id; rdGen = null; rdRender(); }
function rdRenderCard() {
  const card = cardData.find(c => c.id === rdCur);
  const box = document.getElementById('rdBody');
  if (!card) { box.innerHTML = '<p class="qr-empty">左からカードを選んでください。</p>'; return; }
  const st = readingStatus(card);
  rdGen = rdBuild(card.body, card.id);
  const existing = (readingScripts[card.id] || '').trim();
  const useExisting = existing && st !== 'none';
  // 左：本文に色を付ける
  let html = '', p = 0;
  for (const k of rdGen.marks) {
    html += esc(card.body.slice(p, k.from)) + `<mark class="rd-m rd-${k.kind}" title="${k.kind === 'flag' ? '要確認：辞書に無い型式' : (k.kind === 'sophie' ? 'ソフィー案（未承認）→ ' : '→ ') + esc(k.read)}">${esc(k.orig)}</mark>`;
    p = k.to;
  }
  html += esc(card.body.slice(p));
  const flags = rdGen.marks.filter(k => k.kind === 'flag');
  const reps = rdGen.marks.filter(k => k.kind !== 'flag');
  box.innerHTML = `
    <div class="rd-head"><b>${esc(card.id)}</b>　${esc(card.title || '')}　<span class="rd-badge st-${st}">${RD_ST[st][0]} ${RD_ST[st][1]}</span></div>
    ${st === 'changed' ? '<div class="ik-warns">確定した後に本文が直されています。読みを確かめ直して、もう一度「確定」してください。</div>' : ''}
    <div class="rd-cols">
      <div class="rd-col"><div class="rd-lbl">本文（色の所を置き換え・要確認）</div><div class="rd-text">${html}</div></div>
      <div class="rd-col"><div class="rd-lbl">読みの原稿（VOICEPEAK に読ませる文）${useExisting ? '　<button class="dk-mini" onclick="rdRegen()">決まりで作り直す</button>' : ''}</div>
        <textarea id="rdScript" class="rd-script">${esc(useExisting ? existing : rdGen.text)}</textarea></div>
    </div>
    ${flags.length ? `<div class="rd-flags"><b>要確認（辞書に無い型式）</b>${flags.map(k => `<div class="rd-flag">${esc(k.orig)}　読み <input class="rd-in" data-sur="${esc(k.orig)}" placeholder="例：エフサンジュウゴ"> <button class="dk-mini" onclick="rdAddFromFlag(this)">辞書に足す</button></div>`).join('')}</div>` : ''}
    ${reps.length ? `<div class="rd-reps"><b>置き換えた所</b>　${reps.map(k => `${k.kind === 'sophie' ? '🟣' : ''}${esc(k.orig)} → ${esc(k.read)}`).join('　／　')}</div>` : ''}
    <div class="rd-legend"><mark class="rd-m rd-year">年代</mark> <mark class="rd-m rd-dict">辞書</mark> <mark class="rd-m rd-sophie">ソフィー案（確定で認める）</mark> <mark class="rd-m rd-flag">要確認</mark></div>
    <div class="ik-actions">
      <button class="btn-save" onclick="rdConfirm()">✅ この読みで確定</button>
      <button class="dash-refresh" onclick="rdNext()">次のカードへ ▶</button>
      <span class="ik-note">確定すると、このカードの読み修正として保存され、「🎙 一括」でこの文が読まれます。</span>
    </div>`;
}
function rdRegen() { const card = cardData.find(c => c.id === rdCur); if (!card) return; document.getElementById('rdScript').value = rdBuild(card.body, card.id).text; rdToast('決まりで作り直しました（まだ保存していません）'); }
async function rdConfirm() {
  const card = cardData.find(c => c.id === rdCur); if (!card) return;
  const text = document.getElementById('rdScript').value.trim();
  if (!text) { rdToast('読みの原稿が空です', true); return; }
  const left = (rdGen ? rdGen.marks : []).filter(k => k.kind === 'flag').filter(k => text.includes(k.orig));
  if (left.length && !confirm(`辞書に無い型式（${left.map(k => k.orig).join('、')}）が、読みの原稿にそのまま残っています。VOICEPEAK は「マイナス」と読むかもしれません。このまま確定しますか？`)) return;
  // このカードで使ったソフィー案の語のうち、読みの原稿にその読みが残っているものを認める
  const approve = [...new Set((rdGen ? rdGen.marks : []).filter(k => k.kind === 'sophie' && text.includes(k.read)).map(k => k.orig))];
  const r = await (await fetch('/api/reading-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: card.id, text, bodyHash: rdHash(card.body), approve }) })).json();
  if (!r.ok) { rdToast(r.error, true); return; }
  readingScripts[card.id] = text; rdMeta[card.id] = r.meta;
  if (r.items) rdDict = r.items;
  if (typeof _updateReadScriptBtn === 'function' && cardData[selectedIdx] && cardData[selectedIdx].id === card.id) _updateReadScriptBtn(card.id);
  rdToast(`${card.id} の読みを確定しました`);
  rdNext(true);
}
function rdNext(afterConfirm) {
  const cs = rdCards(), i = cs.findIndex(c => c.id === rdCur);
  const next = cs.slice(i + 1).find(c => readingStatus(c) !== 'ok') || cs.slice(i + 1)[0] || (afterConfirm ? cs.find(c => readingStatus(c) !== 'ok') : null);
  if (next) rdOpen(next.id); else { rdRender(); rdToast('このテーマの最後のカードです'); }
}
async function rdAddFromFlag(btn) {
  const inp = btn.parentElement.querySelector('.rd-in');
  const r = await rdSaveWord(inp.dataset.sur, inp.value.trim(), 'workbench', '読み確認で足した');
  if (r) { rdToast(`「${inp.dataset.sur}」を辞書に足しました。下書きを作り直します`); rdRenderCard(); rdRegen(); }
}
async function rdSaveWord(sur, pron, src, note) {
  const r = await (await fetch('/api/reading-dict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sur, pron, src, note }) })).json();
  if (!r.ok) { rdToast(r.error, true); return false; }
  rdDict = r.items; return true;
}

// ---------------- ソフィーとの受け渡し ----------------
async function rdRequest() {
  const cs = rdCards();
  if (!cs.length) { rdToast('このテーマには本文のあるカードがありません', true); return; }
  if (typeof dirty !== 'undefined' && dirty && !confirm('保存していない直しがあります。今の画面の本文のまま依頼を作りますか？（先に「💾 CSV を保存」をしておくと確実です）')) return;
  const r = await (await fetch('/api/reading-request', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ theme: curUnit, cards: cs.map(c => ({ id: c.id, title: c.title, body: c.body })) }) })).json();
  if (!r.ok) { rdToast(r.error, true); return; }
  rdToast(`ソフィーへの依頼を置きました（70_読み\\依頼\\${r.name}.md）。ソフィーが6時・18時の見回りで拾います（急ぐときは声をかけてください）`);
}
async function rdImportReply() {
  if (!rdReply) return;
  const bad = rdReply.bad.length ? `\n形の悪い行（取り込みません）：\n${rdReply.bad.map(b => `・${b.line}行目 ${b.reason}`).join('\n')}` : '';
  if (!confirm(`ソフィーの返事（${rdReply.file}）の ${rdReply.rows.length}語を、辞書に「ソフィー案（未承認）」として入れます。${bad}\nよろしいですか？`)) return;
  const r = await (await fetch('/api/reading-reply/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: curUnit }) })).json();
  if (!r.ok) { rdToast(r.error, true); return; }
  rdDict = r.items; rdReply = null;
  rdToast(`ソフィー案を ${r.added}語 取り込みました${r.kept ? `（認め済みの ${r.kept}語はそのまま）` : ''}。下書きに紫の色で出ます`);
  rdGen = null; rdRender();
}

// ---------------- 辞書の画面 ----------------
function rdRenderDict() {
  const mine = rdDict.filter(x => x.src !== 'voicepeak'), vp = rdDict.filter(x => x.src === 'voicepeak');
  const toVp = mine.filter(x => !x.pending && !(x.cards || []).length);   // VOICEPEAK にまだ入っていない語（書き出す語）
  const noAccent = vp.some(x => !x.vp);
  document.getElementById('rdSide').innerHTML = `<div class="rd-sum">作業台の語 ${mine.length}・VOICEPEAK の語 ${vp.length}</div>
    <p class="ik-note"><b>正本は VOICEPEAK の辞書</b>です（アクセントは VOICEPEAK にしか持てないため）。VOICEPEAK の語は VOICEPEAK の中で効くので、作業台は置き換えません。<br>
    作業台の語は、VOICEPEAK に入るまでの間、録音の前に作業台が置き換えます。</p>
    <label class="dash-refresh rd-import">📥 VOICEPEAK の辞書を取り込む（.vdc2）<input type="file" accept=".vdc2,.json" style="display:none" onchange="rdImport(event)"></label>
    ${noAccent ? '<div class="ik-warns">VOICEPEAK の語のアクセントが、まだ作業台にありません。VOICEPEAK で辞書を書き出し、上の「📥 取り込む」で取り込み直してください。</div>' : ''}
    <div class="rd-sophiebox">
      <button class="btn-save" onclick="rdExport()" ${noAccent || !toVp.length ? 'disabled' : ''}>📤 VOICEPEAK 用に書き出す（.vdc2）</button>
      <div class="ik-note">VOICEPEAK にまだ入っていない語：${toVp.length}語${toVp.length ? `（${toVp.slice(0, 6).map(x => esc(x.sur)).join('・')}${toVp.length > 6 ? '…' : ''}）` : ''}</div>
      <div class="ik-note">書き出した後：<br>① VOICEPEAK の辞書の画面で「辞書のインポート」→ 書き出したファイル →「マージ」<br>② アクセントがおかしい語は、●を動かして直す<br>③ VOICEPEAK で「辞書のエクスポート」<br>④ 上の「📥 取り込む」で取り込み直す（VOICEPEAK に入った語は、作業台の置き換えから外れます）<br>書き出しには VOICEPEAK の全部の語を元のアクセントのまま入れてあるので、「置換」を選んでも消えません。</div>
    </div>`;
  const acc = x => { const a = x.src === 'voicepeak' ? x.vp : (x.vpShadow && x.vpShadow.pron === x.pron ? x.vpShadow : null); return a ? ((a.overwriteAccents ? '●で直した' : a.accentType === 0 ? '平板' : String(a.accentType))) : ''; };
  const row = x => `<tr class="${x.pending ? 'rd-pend' : ''}"><td>${esc(x.sur)}${(x.cards || []).length ? `<div class="ik-sub">${esc(x.cards.join('・'))}だけ</div>` : ''}${x.pending && rdThemes(x).length ? `<div class="ik-sub">${esc(rdThemes(x).join('・'))} で頼んだ</div>` : ''}</td><td>${esc(x.pron)}${x.vpShadow && x.vpShadow.pron !== x.pron ? `<div class="ik-sub">⚠ VOICEPEAK では ${esc(x.vpShadow.pron)}</div>` : ''}</td>
    <td>${esc(acc(x))}</td>
    <td>${x.src === 'voicepeak' ? 'VOICEPEAK' : x.src === 'sophie' ? (x.pending ? '🟣 ソフィー案（未承認）' : 'ソフィー') : '作業台'}</td><td>${esc(x.note || '')}</td>
    <td>${x.pending ? `<button class="dk-mini" data-s="${esc(x.sur)}" onclick="rdApproveWord(this.dataset.s)">認める</button>` : ''}${x.src === 'voicepeak' ? '' : `<button class="dk-mini" data-s="${esc(x.sur)}" onclick="rdDelWord(this.dataset.s)">消す</button>`}</td></tr>`;
  mine.sort((a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0));
  document.getElementById('rdBody').innerHTML = `
    <div class="rd-add">書き方 <input id="rdNewSur" placeholder="例：E-767"> 読み（カタカナ） <input id="rdNewPron" placeholder="例：イーナナロクナナ">
      <button class="btn-save" onclick="rdAddNew()">＋ 足す</button></div>
    <table class="dkh-t rd-dicttbl"><tr><th>書き方</th><th>読み</th><th title="VOICEPEAK のアクセント。数字は音が下がる位置">アクセント</th><th>出どころ</th><th>メモ</th><th></th></tr>${mine.concat(vp).map(row).join('')}</table>`;
}
async function rdExport() {
  const r = await fetch('/api/reading-dict/export');
  if (!r.ok) { let e = ''; try { e = (await r.json()).error; } catch (x) {} rdToast(e || '書き出せませんでした', true); return; }
  const blob = await r.blob();
  const m = /filename\*=UTF-8''([^;]+)/.exec(r.headers.get('Content-Disposition') || '');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = m ? decodeURIComponent(m[1]) : 'TAKERU読み辞書.vdc2';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  rdToast(`書き出しました（全部で ${r.headers.get('X-Count')}語、うち新しい語 ${r.headers.get('X-New')}語）。ダウンロードのフォルダにあります。VOICEPEAK の「辞書のインポート」で読み込んでください`);
}
async function rdAddNew() {
  const s = document.getElementById('rdNewSur').value.trim(), p = document.getElementById('rdNewPron').value.trim();
  if (await rdSaveWord(s, p, 'workbench', '')) { rdToast(`「${s}」を足しました`); rdRenderDict(); }
}
async function rdApproveWord(sur) {
  const r = await (await fetch('/api/reading-dict/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ surs: [sur] }) })).json();
  if (r.ok) { rdDict = r.items; rdToast(`「${sur}」を認めました`); rdRenderDict(); }
}
async function rdDelWord(sur) {
  if (!confirm(`「${sur}」を辞書から消しますか？`)) return;
  const r = await (await fetch('/api/reading-dict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'delete', sur }) })).json();
  if (r.ok) { rdDict = r.items; rdRenderDict(); }
}
function rdImport(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const fr = new FileReader();
  fr.onload = async () => {
    let entries; try { entries = JSON.parse(String(fr.result).replace(/^﻿/, '')); } catch (e) { rdToast('ファイルが読めません（VOICEPEAK の辞書の書き出しを選んでください）', true); return; }
    const r = await (await fetch('/api/reading-dict/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) })).json();
    if (!r.ok) { rdToast(r.error, true); return; }
    rdDict = r.items;
    rdToast(`VOICEPEAK の語を ${r.imported}語 取り込みました（辞書は全部で ${r.total}語）。${r.absorbed ? `作業台の語のうち ${r.absorbed}語は VOICEPEAK に入っていたので、VOICEPEAK 任せにしました。` : ''}${r.differ && r.differ.length ? `VOICEPEAK と読みが違う語：${r.differ.join('・')}（作業台の読みが先に効きます）` : ''}`, !!(r.differ && r.differ.length));
    rdRenderDict();
  };
  fr.readAsText(f, 'utf-8');
}
async function rdSetTab(t) { rdTab = t; if (t === 'check') await rdChkLoad(); rdRender(); }

// ---------------- 🔎 検算（S-16：録ってから Whisper で書き起こし、読ませた文と見比べる） ----------------
let rdChk = { results: {}, rerecord: {}, fixes: [] }, rdChkReply = null, rdChkCur = '', rdChkBusy = false;
function rdChkCards() { return rdCards().filter(c => typeof mp3Ids === 'undefined' || mp3Ids.has(c.id)); }
async function rdChkLoad() {
  const codes = rdCards().map(c => c.id).join(',');
  try { const j = await (await fetch('/api/reading-check?codes=' + encodeURIComponent(codes))).json(); if (j.ok) rdChk = j; } catch (e) {}
  rdChkReply = null;
  try { const j = await (await fetch('/api/reading-check/reply?theme=' + encodeURIComponent(curUnit))).json(); if (j.ok && j.found) rdChkReply = j; } catch (e) {}
}
function rdRenderCheck() {
  const cs = rdChkCards(), all = rdCards();
  const done = cs.filter(c => rdChk.results[c.id]);
  const nDiff = done.reduce((s, c) => s + rdChk.results[c.id].diffs.length, 0);
  const rr = Object.keys(rdChk.rerecord || {}).filter(id => all.some(c => c.id === id));
  const fixes = (rdChk.fixes || []).map((f, i) => ({ ...f, i })).filter(f => String(f.code).split(';').some(id => all.some(c => c.id === id)));
  document.getElementById('rdSide').innerHTML =
    `<div class="rd-sum">検算 ${done.length}／${cs.length}枚・ずれ ${nDiff}件${all.length > cs.length ? `<div class="ik-sub">音声の無いカード ${all.length - cs.length}枚は除く</div>` : ''}</div>
     <div class="rd-sophiebox">
       <button class="btn-save" id="rdChkRunBtn" onclick="rdChkRun()" ${rdChkBusy ? 'disabled' : ''}>🔎 印のカードを検算</button>
       ${rdChkReply ? `<button class="btn-save" onclick="rdChkImport()">📥 ソフィーの仕分けを取り込む（${rdChkReply.rows.length}件${rdChkReply.bad.length ? `・形の悪い行 ${rdChkReply.bad.length}` : ''}）</button>`
                    : `<button class="dash-refresh" onclick="rdChkRequest()" ${done.length ? '' : 'disabled'} title="ずれの一覧を TAKERU_共有の 70_読み\\依頼 に置く">📤 ソフィーに仕分けを頼む</button>`}
       <div class="ik-note">1枚 10〜20秒ほど。初めての時だけ、Whisper のモデル（約480MB）の読み込みで長くかかります。</div>
     </div>
     ${rr.length ? `<div class="ik-warns">🔁 録り直すカード：${rr.map(esc).join('・')}<div class="ik-sub">「カードの読み」で紫の所を確かめて確定 →「🎙 一括」（印が付いています）</div></div>` : ''}
     ${fixes.length ? `<div class="ik-warns">✏️ 原稿の直し（ソフィーの d）${fixes.map(f => `<div>${esc(f.code)}：${esc(f.what)}${f.why ? `（${esc(f.why)}）` : ''} <button class="dk-mini" onclick="rdChkFixDone(${f.i})">直した</button></div>`).join('')}</div>` : ''}
     <div class="rd-chk-tools"><button class="dk-mini" onclick="rdChkSel(true)">全部</button><button class="dk-mini" onclick="rdChkSel(false)">外す</button></div>` +
    cs.map(c => { const r = rdChk.results[c.id];
      return `<div class="rd-item ${c.id === rdChkCur ? 'on' : ''}" data-id="${esc(c.id)}" onclick="if(event.target.tagName!=='INPUT')rdChkOpen(this.dataset.id)">
        <input type="checkbox" class="rd-chk-cb" data-id="${esc(c.id)}" ${r ? '' : 'checked'}>
        <span class="rd-code">${esc(c.id)}</span><span class="rd-title">${esc(c.title || '')}</span>
        <span class="rd-bmark ${r ? (r.diffs.length ? 'warn' : 'ok') : 'legacy'}">${r ? (r.diffs.length ? `ずれ${r.diffs.length}` : '一致') : '未'}</span></div>`; }).join('');
  rdChkRenderCard();
}
function rdChkSel(v) { document.querySelectorAll('.rd-chk-cb').forEach(cb => cb.checked = v); }
function rdChkOpen(id) { rdChkCur = id; rdRenderCheck(); }
function rdChkRenderCard() {
  const box = document.getElementById('rdBody');
  const card = cardData.find(c => c.id === rdChkCur), r = rdChk.results[rdChkCur];
  if (!card) { box.innerHTML = `<p class="qr-empty">左でカードを選ぶと、ずれの一覧が出ます。</p>
    <div class="ik-note">流れ：「🎙 一括」でテーマを録る →「🔎 検算」→「📤 ソフィーに仕分けを頼む」→ 返事を取り込む → 録り直すカードだけ「カードの読み」で確定して録り直す。<br>
    Whisper は聞いた音を漢字に直して書くので、漢字の別の読み（金沢柵をカナザワと読んだ、など）は、ここには出にくいです。</div>`; return; }
  if (!r) { box.innerHTML = `<div class="rd-head"><b>${esc(card.id)}</b>　${esc(card.title || '')}</div><p class="qr-empty">まだ検算していません。左で印を付けて「🔎 印のカードを検算」。</p>`; return; }
  box.innerHTML = `
    <div class="rd-head"><b>${esc(card.id)}</b>　${esc(card.title || '')}　<span class="rd-badge">一致 ${Math.round(r.match * 100)}%・ずれ ${r.diffs.length}件</span>
      <span class="ik-sub">${esc(r.checkedAt || '')}・${esc(r.model)}・${r.seconds}秒${r.textFrom === 'guess' ? '・読ませた文の記録が無いので、今の読み原稿か本文と見比べた' : ''}</span></div>
    <audio id="rdChkAudio" controls preload="auto" src="/api/voice/audio/${encodeURIComponent(card.id)}?t=${Date.now()}" style="width:100%"></audio>
    ${r.diffs.length ? `<table class="dkh-t rd-chktbl"><tr><th></th><th>秒</th><th>読ませた文</th><th>書き起こし</th><th>読ませた音 → 聞こえた音</th></tr>
      ${r.diffs.map(d => `<tr><td><button class="dk-mini" onclick="rdChkPlay(${d.at})">▶</button></td><td>${d.at}</td><td>${rdChkHi(d.script)}</td><td>${rdChkHi(d.heard)}</td><td class="ik-sub">${esc(d.said)} → ${esc(d.got)}</td></tr>`).join('')}</table>`
      : '<p class="qr-empty">ずれはありませんでした。</p>'}
    <details><summary>書き起こしの全文</summary><div class="rd-text">${esc(r.heard)}</div></details>
    <details><summary>読ませた文</summary><div class="rd-text">${esc(r.script)}</div></details>`;
}
function rdChkHi(s) { return esc(s).replace(/【(.*?)】/, '<mark class="rd-m rd-flag">$1</mark>'); }
function rdChkPlay(t) { const a = document.getElementById('rdChkAudio'); if (!a) return; a.currentTime = Math.max(0, t); a.play(); }
async function rdChkRun() {
  const ids = [...document.querySelectorAll('.rd-chk-cb:checked')].map(cb => cb.dataset.id);
  if (!ids.length) { rdToast('検算するカードに印を付けてください', true); return; }
  rdChkBusy = true; let ok = 0, ng = 0, lastErr = '';
  for (let i = 0; i < ids.length; i++) {
    const card = cardData.find(c => c.id === ids[i]); if (!card) continue;
    const btn = document.getElementById('rdChkRunBtn'); if (btn) { btn.disabled = true; btn.textContent = `⏳ 検算中 ${i + 1}/${ids.length}（${card.id}）`; }
    try {
      const r = await (await fetch('/api/reading-check', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: card.id, text: (readingScripts[card.id] || card.body || '').trim() }) })).json();
      if (r.ok) { rdChk.results[card.id] = r; ok++; } else { ng++; lastErr = r.error; if (/入っていません|起動できません/.test(r.error || '')) break; }
    } catch (e) { ng++; lastErr = e.message; }
  }
  rdChkBusy = false;
  if (!rdChkCur && ids.length) rdChkCur = ids[0];
  rdRenderCheck();
  rdToast(`検算 ${ok}枚${ng ? `・できなかった ${ng}枚：${lastErr}` : ''}`, !!ng);
}
async function rdChkRequest() {
  const codes = rdChkCards().filter(c => rdChk.results[c.id]).map(c => c.id);
  const titles = {}; rdCards().forEach(c => titles[c.id] = c.title || '');
  const r = await (await fetch('/api/reading-check/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: curUnit, codes, titles }) })).json();
  if (!r.ok) { rdToast(r.error, true); return; }
  rdToast(`仕分けの依頼を置きました（70_読み\\依頼\\${r.name}.md・ずれ ${r.count}件）。ソフィーが6時・18時の見回りで拾います（急ぐときは声をかけてください）`);
}
async function rdChkImport() {
  if (!rdChkReply) return;
  const bad = rdChkReply.bad.length ? `\n形の悪い行（取り込みません）：\n${rdChkReply.bad.map(b => `・${b.line}行目 ${b.reason}`).join('\n')}` : '';
  if (!confirm(`ソフィーの仕分け（${rdChkReply.file}）を取り込みます。a（VOICEPEAK の読み違い）は辞書に「ソフィー案」として入り、そのカードに「録り直す」の印が付きます。d（原稿の誤り）は直す所の一覧に出ます。${bad}\nよろしいですか？`)) return;
  const r = await (await fetch('/api/reading-check/reply/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme: curUnit }) })).json();
  if (!r.ok) { rdToast(r.error, true); return; }
  rdDict = r.items; await rdChkLoad(); rdRenderCheck();
  rdToast(`取り込みました：a ${r.counts.a}・b ${r.counts.b}・c ${r.counts.c}・d ${r.counts.d}。${r.rerecord.length ? `録り直すカード：${r.rerecord.join('・')}` : '録り直すカードはありません'}`);
}
async function rdChkFixDone(i) {
  const r = await (await fetch('/api/reading-check/fix-done', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ index: i }) })).json();
  if (r.ok) { rdChk.fixes = r.fixes; rdRenderCheck(); }
}

// 起動時に読み込んでおく（一括録音の一覧の印に使う）
rdLoad();
