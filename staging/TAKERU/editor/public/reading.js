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
function rdBuild(body, cardId) {
  body = String(body || '');
  const norm = rdZen(body);   // 全角数字を半角にした写し（位置は同じ）
  const cands = [];
  const active = rdDict.filter(x => x.src !== 'voicepeak' && x.sur && (!(x.cards || []).length || (cardId && x.cards.includes(cardId))))
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
async function openReading() {
  if (typeof curUnit !== 'undefined' && !curUnit) { alert('先に左の一覧でテーマを選んでください'); return; }
  await rdLoad();
  await rdLoadReply();
  document.getElementById('readingModal').style.display = 'flex';
  rdTab = 'cards';
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
  const cs = rdCards();
  const count = s => cs.filter(c => readingStatus(c) === s).length;
  const pend = rdDict.filter(x => x.pending).length;
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
  document.getElementById('rdSide').innerHTML = `<div class="rd-sum">作業台の語 ${mine.length}・VOICEPEAK の語 ${vp.length}</div>
    <p class="ik-note">作業台の語は、録音の前に作業台が置き換えます。VOICEPEAK の語は VOICEPEAK の辞書で効いているので、ここでは「登録済み」と分かるためだけに持っています。</p>
    <label class="dash-refresh rd-import">📥 VOICEPEAK の辞書を取り込む（.vdc2）<input type="file" accept=".vdc2,.json" style="display:none" onchange="rdImport(event)"></label>`;
  const row = x => `<tr class="${x.pending ? 'rd-pend' : ''}"><td>${esc(x.sur)}${(x.cards || []).length ? `<div class="ik-sub">${esc(x.cards.join('・'))}だけ</div>` : ''}</td><td>${esc(x.pron)}</td>
    <td>${x.src === 'voicepeak' ? 'VOICEPEAK' : x.src === 'sophie' ? (x.pending ? '🟣 ソフィー案（未承認）' : 'ソフィー') : '作業台'}</td><td>${esc(x.note || '')}</td>
    <td>${x.pending ? `<button class="dk-mini" data-s="${esc(x.sur)}" onclick="rdApproveWord(this.dataset.s)">認める</button>` : ''}${x.src === 'voicepeak' ? '' : `<button class="dk-mini" data-s="${esc(x.sur)}" onclick="rdDelWord(this.dataset.s)">消す</button>`}</td></tr>`;
  mine.sort((a, b) => (b.pending ? 1 : 0) - (a.pending ? 1 : 0));
  document.getElementById('rdBody').innerHTML = `
    <div class="rd-add">書き方 <input id="rdNewSur" placeholder="例：E-767"> 読み（カタカナ） <input id="rdNewPron" placeholder="例：イーナナロクナナ">
      <button class="btn-save" onclick="rdAddNew()">＋ 足す</button></div>
    <table class="dkh-t rd-dicttbl"><tr><th>書き方</th><th>読み</th><th>出どころ</th><th>メモ</th><th></th></tr>${mine.concat(vp).map(row).join('')}</table>`;
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
    rdDict = r.items; rdToast(`VOICEPEAK の語を ${r.imported}語 取り込みました（辞書は全部で ${r.total}語）`); rdRenderDict();
  };
  fr.readAsText(f, 'utf-8');
}
function rdSetTab(t) { rdTab = t; rdRender(); }

// 起動時に読み込んでおく（一括録音の一覧の印に使う）
rdLoad();
