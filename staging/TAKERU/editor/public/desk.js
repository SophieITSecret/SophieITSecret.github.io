// ============================================================
// 🧭 制作デスク（カード制作の上流）2026-10-22
//   段は「TAKERU テーマ制作手順書」の段1〜段7。中身は原稿フォルダの「制作デスク」に、ふつうのファイルで置く
//   （サーバー側は editor/desk.js）。CSVとは「出力」と「取り込み」の2本だけでつながる。
// ============================================================
let dk = { meta: null, folder: '', data: null, tab: 'cards', cur: '', dirty: false, research: '', resDirty: false };
const DK_SAVE = 'takeru.desk.';   // ＋テーマ名＋コード。書きかけの一時保存

function dkEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function dkChars(s) { return String(s || '').replace(/\s/g, '').length; }
async function dkGet(p) { return (await fetch('/api/desk/' + p)).json(); }
async function dkPost(p, b) { return (await fetch('/api/desk/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json(); }
function dkToast(t, bad) {
  const el = document.getElementById('dkToast'); if (!el) return;
  el.textContent = t; el.className = 'dk-toast ' + (bad ? 'bad' : 'ok'); el.style.display = 'block';
  clearTimeout(dkToast.t); dkToast.t = setTimeout(() => { el.style.display = 'none'; }, bad ? 8000 : 3500);
}

// ---------------- 開く・閉じる ----------------
async function openDesk() {
  document.getElementById('deskModal').style.display = 'flex';
  await dkLoadMeta();
  let last = ''; try { last = localStorage.getItem(DK_SAVE + 'last') || ''; } catch (e) {}
  const f = dk.meta.themes.find(t => t.folder === (dk.folder || last)) ? (dk.folder || last) : (dk.meta.themes[0] || {}).folder;
  if (f) await dkOpenTheme(f); else dkRender();
}
function closeDesk() {
  if ((dk.dirty || dk.resDirty) && !confirm('保存していない直しがあります（この端末には一時保存してあります）。閉じますか？')) return;
  document.getElementById('deskModal').style.display = 'none';
}
async function dkLoadMeta() {
  const j = await dkGet('themes');
  if (!j.ok) { document.getElementById('dkBody').innerHTML = `<p class="qr-warn">読めませんでした：${dkEsc(j.error)}</p>`; return; }
  dk.meta = j;
}
async function dkOpenTheme(f) {
  if ((dk.dirty || dk.resDirty) && !confirm('保存していない直しがあります。ほかのテーマに移りますか？（一時保存は残ります）')) { dkRender(); return; }
  const j = await dkGet('theme?f=' + encodeURIComponent(f));
  if (!j.ok) { dkToast(j.error, true); return; }
  dk.folder = f; dk.data = j; dk.dirty = false; dk.resDirty = false;
  if (!j.cards.some(c => c.code === dk.cur)) dk.cur = (j.cards[0] || {}).code || '';
  try { localStorage.setItem(DK_SAVE + 'last', f); } catch (e) {}
  dkRender();
}
async function dkReload() { await dkLoadMeta(); if (dk.folder) await dkOpenTheme(dk.folder); }
function dkTab(t) {
  if (t !== dk.tab && dk.dirty && !confirm('カードに保存していない直しがあります（一時保存はしてあります）。移りますか？')) return;
  dk.tab = t; dk.dirty = false; dkRender();
}

// ---------------- 全体 ----------------
function dkRender() {
  const m = dk.meta || { themes: [], refs: [], stages: [] }, d = dk.data;
  document.getElementById('dkThemeSel').innerHTML = (m.themes.length ? '' : '<option value="">（テーマがありません）</option>') +
    m.themes.map(t => `<option value="${dkEsc(t.folder)}" ${t.folder === dk.folder ? 'selected' : ''}>${dkEsc(t.name)}（${t.done}/${t.cards}枚 確定）</option>`).join('');
  const side = document.getElementById('dkSide');
  if (!d) { side.innerHTML = dkRefsHtml(); document.getElementById('dkBody').innerHTML = '<p class="qr-empty">「＋ 新しいテーマ」から始めてください。</p>'; return; }
  const th = d.theme;
  side.innerHTML = `<div class="dk-h">手順（段1〜7）</div><ol class="dk-stages">${m.stages.map(s => {
      const st = (th.stages || {})[s.no] || {}, state = st.state || '未';
      return `<li class="st-${state}">
        <button class="dk-st" onclick="dkStageCycle(${s.no})" title="押すと 未→途中→済">${state === '済' ? '✓' : state === '途中' ? '◐' : '○'}</button>
        <div><div class="t">段${s.no}　${dkEsc(s.name)}</div>
          ${s.approve ? `<label class="dk-appr"><input type="checkbox" ${st.approved ? 'checked' : ''} onchange="dkStageApprove(${s.no}, this.checked)"> 牧村さんの承認${st.approved ? `（${dkEsc(st.approved)}）` : ''}</label>` : ''}
          <div class="dk-stnote" contenteditable="true" data-no="${s.no}" onblur="dkStageNote(this)" title="メモ（押して書く）">${dkEsc(st.note || '')}</div></div></li>`; }).join('')}</ol>
    ${dkRefsHtml()}
    <div class="dk-h">置き場</div><button class="dash-refresh" onclick="dkOpenPath({folder: dk.folder})">📁 このテーマのフォルダ</button>
    <div class="mag-dim" style="margin-top:4px">Claude Code や Obsidian からは、このフォルダの cards/・research/・カード一覧.md を直接読めます。</div>`;
  const tabs = [['theme', 'テーマ'], ['research', `資料（${d.research.length}）`], ['cards', `カード（${d.cards.length}）`], ['brief', '依頼と受け取り'], ['export', 'CSVへ出力']]
    .map(([k, l]) => `<button class="${dk.tab === k ? 'on' : ''}" onclick="dkTab('${k}')">${l}</button>`).join('');
  document.getElementById('dkTabs').innerHTML = tabs;
  ({ theme: dkRenderTheme, research: dkRenderResearch, cards: dkRenderCards, brief: dkRenderBrief, export: dkRenderExport })[dk.tab]();
}
function dkRefsHtml() {
  const refs = (dk.meta && dk.meta.refs) || [];
  return `<div class="dk-h">基礎資料</div><ul class="dk-refs">${refs.map(r =>
    `<li><button class="dk-link" ${r.exists ? '' : 'disabled title="見つかりません"'} onclick='dkOpenPath({ref: ${JSON.stringify(r.file)}})'>${dkEsc(r.file.replace(/\.md$/, ''))}</button></li>`).join('')}</ul>
    <div class="mag-dim">一覧は 制作デスク/_設定.json の refs で変えられます</div>`;
}
async function dkOpenPath(b) { const j = await dkPost('open', b); if (!j.ok) dkToast(j.error, true); }
async function dkStageSave(stage) {
  const j = await dkPost('theme/save', { folder: dk.folder, stage });
  if (!j.ok) return dkToast(j.error, true);
  dk.data.theme.stages = j.theme.stages; dkRender();
}
function dkStageCycle(no) {
  const cur = ((dk.data.theme.stages || {})[no] || {}).state || '未';
  const next = { '未': '途中', '途中': '済', '済': '未' }[cur];
  const s = dk.meta.stages.find(x => x.no === no);
  if (next === '済' && s.approve && !((dk.data.theme.stages || {})[no] || {}).approved && !confirm(`段${no}は、牧村さんの承認を得てから次へ進む段です。承認の印を付けずに「済」にしますか？`)) return;
  dkStageSave({ no, state: next });
}
function dkStageApprove(no, v) { dkStageSave({ no, approved: v }); }
function dkStageNote(el) {
  const no = +el.dataset.no, v = el.innerText.trim(), old = ((dk.data.theme.stages || {})[no] || {}).note || '';
  if (v !== old) dkStageSave({ no, note: v });
}

// ---------------- テーマ ----------------
function dkRenderTheme() {
  const th = dk.data.theme, f = (k, l, hint, big) => `<div class="mag-field"><div class="lbl">${l} <span class="hint">${hint || ''}</span></div>
      ${big ? `<textarea id="dkT_${k}" class="mid">${dkEsc(th[k] || '')}</textarea>` : `<input id="dkT_${k}" class="x-in" value="${dkEsc(th[k] || '')}">`}</div>`;
  document.getElementById('dkBody').innerHTML = `
    <div class="dk-grid2">${f('name', 'テーマ名')}${f('subject', '科目（CSVの科目）', '例 3級-国家と法律')}
      ${f('unit', 'ユニット（CSVのテーマ列）', 'アプリのメニューに出る名前')}${f('prefix', 'コードの略称', '例 GNP → GNPF01・GNPC01')}</div>
    ${f('axis', '段2　テーマの主軸（一文）', '牧村さんの承認を得る', true)}
    ${f('threads', '段3　縦糸の割り当て', 'どの縦糸を、どのカードで回収するか', true)}
    ${f('goal', '学習目標', '', true)}
    ${f('concept', 'コンセプト・全体のメモ', 'この時代・テーマで何を伝えるか', true)}
    <div class="mag-btns"><button class="btn-save" onclick="dkThemeSave()">💾 テーマを保存</button>
      <span class="sub">コードの略称を変えても、すでにあるカードのコードは変わりません（「カード」の「番号を振り直す」で変えます）</span></div>
    ${dk.data.cards.length ? '' : `<div class="mag-band"><b>原稿mdから取り込む</b>（「#### コード　題」＋本文の形）
      <div class="mag-dim">本体の原稿フォルダの md を読み、カードに分けます。カードタイトル案の表（| コード | 種別 | 仮題 | そのカードで言うこと |）を選ぶと、狙いの欄に入れます。資料は「資料」に写します。</div>
      <div id="dkImport"><button class="dash-refresh" onclick="dkImportForm()">取り込む元を選ぶ</button></div></div>`}`;
}
async function dkThemeSave() {
  const b = { folder: dk.folder }; for (const k of ['name', 'subject', 'unit', 'prefix', 'axis', 'threads', 'goal', 'concept']) b[k] = document.getElementById('dkT_' + k).value;
  b.prefix = b.prefix.trim().toUpperCase();
  const j = await dkPost('theme/save', b);
  if (!j.ok) return dkToast(j.error, true);
  dkToast('テーマを保存しました'); await dkReload();
}
async function dkImportForm() {
  const j = await dkGet('drafts'); if (!j.ok) return dkToast(j.error, true);
  const opt = j.files.map(f => `<option value="${dkEsc(f)}">${dkEsc(f)}</option>`).join('');
  document.getElementById('dkImport').innerHTML = `
    <div class="mag-field"><div class="lbl">原稿md</div><select id="dkImD" class="x-in">${opt}</select></div>
    <div class="mag-field"><div class="lbl">カードタイトル案（狙い）<span class="hint">なくてもよい</span></div><select id="dkImP" class="x-in"><option value="">（使わない）</option>${opt}</select></div>
    <div class="mag-field"><div class="lbl">資料に写すもの<span class="hint">Ctrl を押しながら複数選べます</span></div><select id="dkImR" class="x-in" multiple size="6">${opt}</select></div>
    <button class="btn-save" onclick="dkImportRun()">取り込む</button>`;
}
async function dkImportRun() {
  const research = [...document.getElementById('dkImR').selectedOptions].map(o => o.value);
  const j = await dkPost('import', { folder: dk.folder, draft: document.getElementById('dkImD').value, plan: document.getElementById('dkImP').value, research });
  if (!j.ok) return dkToast(j.error, true);
  dkToast(`${j.made.length}枚を取り込みました${j.skipped.length ? `（${j.skipped.length}枚はもうあるので飛ばしました）` : ''}・資料${j.copied.length}本`);
  dk.tab = 'cards'; await dkReload();
}
async function dkNewTheme() {
  const name = prompt('テーマ名（例：火器が覇者を変えた——清とオスマン）'); if (!name) return;
  const prefix = (prompt('コードの略称（大文字。例 GNP → GNPF01）', '') || '').trim().toUpperCase();
  const subject = prompt('科目（CSVの科目）', '3級-国家と法律'); if (!subject) return;
  const folder = prompt('フォルダ名（並べたい順に番号を付けると探しやすい）', name);
  const j = await dkPost('theme/create', { name, prefix, subject, unit: name, folder, usesKind: /国家と法律/.test(subject) });
  if (!j.ok) return dkToast(j.error, true);
  dk.folder = j.folder; dk.tab = 'theme'; await dkReload();
}

// ---------------- 資料 ----------------
function dkRenderResearch() {
  const d = dk.data;
  document.getElementById('dkBody').innerHTML = `<div class="dk-res">
    <div class="dk-reslist"><button class="btn-save" onclick="dkResNew()">＋ 新しい資料（貼り付け）</button>
      <ul>${d.research.map(r => `<li class="${r.name === dk.research ? 'on' : ''}" onclick='dkResOpen(${JSON.stringify(r.name)})'>${dkEsc(r.name)}<span class="mag-dim">${Math.round(r.size / 1024 * 10) / 10}KB</span></li>`).join('') || '<li class="mag-dim">まだありません</li>'}</ul>
      <button class="dash-refresh" onclick="dkOpenPath({folder: dk.folder, sub: 'research'})">📁 資料のフォルダ</button>
      <div class="mag-dim">Deep Research・NotebookLM などの結果、史実メモ、URL を、カードに縛られずに置いておく場所です。</div></div>
    <div class="dk-resview" id="dkResView"><p class="qr-empty">左から資料を選んでください。</p></div></div>`;
  if (dk.research && d.research.some(r => r.name === dk.research)) dkResOpen(dk.research, true);
}
async function dkResOpen(name, quiet) {
  if (!quiet && dk.resDirty && !confirm('資料に保存していない直しがあります。ほかを開きますか？')) return;
  const j = await dkGet(`research?f=${encodeURIComponent(dk.folder)}&name=${encodeURIComponent(name)}`);
  if (!j.ok) return dkToast(j.error, true);
  dk.research = name; dk.resDirty = false;
  document.querySelectorAll('.dk-reslist li').forEach(li => li.classList.toggle('on', li.textContent.startsWith(name)));
  document.getElementById('dkResView').innerHTML = `<div class="dk-row"><b>${dkEsc(name)}</b>
      <button class="btn-save" onclick="dkResSave()">💾 保存</button><button class="dash-refresh" onclick="dkCopy(document.getElementById('dkResText').value)">📋 全文を写す</button>
      <button class="dash-refresh" onclick="dkResDelete()">ごみ箱へ</button></div>
    <textarea id="dkResText" class="dk-restext" oninput="dk.resDirty=true">${dkEsc(j.text)}</textarea>`;
}
async function dkResNew() {
  const name = prompt('資料の名前（例：01_オスマン_DeepResearch）'); if (!name) return;
  const j = await dkPost('research/save', { folder: dk.folder, name, text: '', isNew: true });
  if (!j.ok) return dkToast(j.error, true);
  dk.research = j.name; await dkReload();
  setTimeout(() => { const t = document.getElementById('dkResText'); if (t) t.focus(); }, 300);
}
async function dkResSave() {
  const j = await dkPost('research/save', { folder: dk.folder, name: dk.research, text: document.getElementById('dkResText').value });
  if (!j.ok) return dkToast(j.error, true);
  dk.resDirty = false; dkToast('保存しました');
}
async function dkResDelete() {
  if (!confirm(`「${dk.research}」をテーマの _ごみ箱 に移します。`)) return;
  const j = await dkPost('research/delete', { folder: dk.folder, name: dk.research });
  if (!j.ok) return dkToast(j.error, true);
  dk.research = ''; dk.resDirty = false; await dkReload();
}

// ---------------- カード（並び＋作業欄） ----------------
function dkRenderCards() {
  const d = dk.data, th = d.theme, useKind = th.usesKind !== false;
  const plus = (i) => `<div class="dk-plus"><span>＋</span>${useKind ? `<button onclick="dkInsert(${i},'F')">史実を差し込む</button><button onclick="dkInsert(${i},'C')">解説を差し込む</button>`
                                                              : `<button onclick="dkInsert(${i},'')">カードを差し込む</button>`}</div>`;
  const st = { '構想': '・', '骨組み': '◔', '執筆中': '◑', '確定': '●' };
  const list = d.cards.map((c, i) => `${plus(i)}
    <div class="dk-card ${c.code === dk.cur ? 'on' : ''} k-${dkEsc(c.kind || 'X')}" draggable="true" data-code="${dkEsc(c.code)}"
         onclick="dkPick('${dkEsc(c.code)}')" ondragstart="dkDragStart(event)" ondragover="dkDragOver(event)" ondragleave="this.classList.remove('drop')" ondrop="dkDrop(event)">
      <span class="dk-no">${i + 1}</span><span class="dk-code">${dkEsc(c.code)}</span>
      <span class="dk-title">${dkEsc(c.title)}</span>
      <span class="dk-stat s-${dkEsc(c.status)}" title="${dkEsc(c.status)}">${st[c.status] || '・'}</span>
      <span class="dk-chars ${c.chars > 460 ? 'over' : ''}">${c.chars || ''}</span></div>`).join('') + plus(d.cards.length);
  const done = d.cards.filter(c => c.status === '確定').length;
  document.getElementById('dkBody').innerHTML = `
    <div class="dk-cards">
      <div class="dk-outline">
        <div class="dk-row"><b>${d.cards.length}枚</b><span class="mag-dim">確定 ${done}・史実 ${d.cards.filter(c => c.kind === 'F').length}・解説 ${d.cards.filter(c => c.kind === 'C').length}</span>
          <button class="dash-refresh" onclick="dkRenumber()" title="いまの並びのとおりに、種別ごとに01から振り直す">番号を振り直す</button></div>
        <div class="mag-dim">ドラッグで並べ替え。・構想 ◔骨組み ◑執筆中 ●確定。右の数字は本文の字数（空白を除く）</div>
        <div class="dk-list">${list}</div>
      </div>
      <div class="dk-panel" id="dkPanel"></div>
    </div>`;
  dkRenderPanel();
}
function dkCard() { return dk.data.cards.find(c => c.code === dk.cur); }
// 作業欄の ◀▶：テーマの並びの前後のカードへ（直しかけなら dkPick が確かめる）。左の並びも、選んだカードが見えるようにずらす
function dkStep(d) {
  const o = dk.data.theme.order, i = o.indexOf(dk.cur), j = i + d;
  if (i < 0 || j < 0 || j >= o.length) return;
  dkPick(o[j]);
  const row = document.querySelector(`.dk-card[data-code="${o[j]}"]`); if (row) row.scrollIntoView({ block: 'nearest' });
  const pn = document.getElementById('dkPanel'); if (pn) pn.scrollIntoView({ block: 'nearest' });   // 'start' だとタブの段が上に隠れた（10/25）
}
function dkPick(code) {
  if (code === dk.cur) return;
  if (dk.dirty && !confirm('このカードに保存していない直しがあります（一時保存はしてあります）。ほかのカードに移りますか？')) return;
  dk.cur = code; dk.dirty = false;
  document.querySelectorAll('.dk-card').forEach(e => e.classList.toggle('on', e.dataset.code === code));
  dkRenderPanel();
}
const DK_FIELDS = [['aim', '狙い', 'このカードで言うこと', 'dk-s'], ['skeleton', '骨組み・ファクト', 'NotebookLM などで拾った箇条書き。出典もここに', 'dk-m'],
                   ['body', '本文', '400字前後（現行の基準）。アプリにはこの文が出る', 'dk-l'], ['imagePrompt', '画像プロンプト', 'チャッピーに渡す文', 'dk-m'], ['memo', 'メモ', '確認したいこと・申し送り', 'dk-s']];
function dkRenderPanel() {
  const p = document.getElementById('dkPanel'), c = dkCard(), th = dk.data.theme;
  if (!c) { p.innerHTML = '<p class="qr-empty">左からカードを選ぶか、「＋」で差し込んでください。</p>'; return; }
  const i = dk.data.theme.order.indexOf(c.code), n = dk.data.theme.order.length;
  p.innerHTML = `
    <div class="dk-row dk-nav">
      <button class="dash-refresh" onclick="dkStep(-1)" ${i <= 0 ? 'disabled' : ''} title="前のカード（Alt+←）">◀ 前のカード</button>
      <span class="mag-dim">${i + 1} / ${n}</span>
      <button class="dash-refresh" onclick="dkStep(1)" ${i >= n - 1 ? 'disabled' : ''} title="次のカード（Alt+→）">次のカード ▶</button>
    </div>
    <div class="dk-row">
      <span class="dk-bigcode">${dkEsc(c.code)}</span><button class="dash-refresh" onclick="dkRecode()">コードを変える</button>
      ${th.usesKind !== false ? `<select id="dkF_kind" onchange="dkOnInput()"><option value="F" ${c.kind === 'F' ? 'selected' : ''}>史実（F）</option><option value="C" ${c.kind === 'C' ? 'selected' : ''}>解説（C）</option></select>` : ''}
      <select id="dkF_status" onchange="dkOnInput()">${dk.meta.cardStatus.map(s => `<option ${s === c.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <span class="mag-dim">${c.liveImage ? '🖼 アプリの画像あり' : '🖼 アプリの画像なし'}</span>
    </div>
    <div class="mag-field"><div class="lbl">題 <span class="hint">${c.kind === 'C' ? 'CSVに出すとき、頭に「→」が付きます' : ''}</span></div><input id="dkF_title" class="x-in dk-titlein" value="${dkEsc(c.title)}" oninput="dkOnInput()"></div>
    ${DK_FIELDS.map(([k, l, h, cls]) => `<div class="mag-field"><div class="lbl">${l} <span class="hint">${h}</span>
        ${k === 'body' ? `<span class="mag-count2" id="dkN_body"></span>` : ''}
        ${k === 'imagePrompt' || k === 'skeleton' ? `<button class="dk-mini" onclick="dkCopy(document.getElementById('dkF_${k}').value)">📋 写す</button>` : ''}</div>
      <textarea id="dkF_${k}" class="${cls}" oninput="dkOnInput()">${dkEsc(c[k] || '')}</textarea></div>`).join('')}
    <div class="dk-row dk-actions">
      <button class="btn-save" onclick="dkSaveCard()">💾 保存（Ctrl+S）</button>
      <button class="dash-refresh" onclick="dkCopyBrief()" title="テーマの主軸・縦糸と、このカードの題・狙い・骨組みをまとめて写す">📋 AIへの依頼の素を写す</button>
      <button class="dash-refresh" onclick="dkTab('brief')" title="ひな形を選んで、このカードの依頼書を作る">📨 このカードの依頼書へ</button>
      <span class="dk-imgbtns" title="画像はテーマ1本のスレッドで作る：最初に「テーマ全体」を1回、あとはカードごとに「このカードへ」">🖼 画像：
        <button class="dk-mini" onclick="dkImageBrief('72_')" title="チャッピーのプロジェクトで新しいスレッドを開き、最初に1回だけ貼る（全カードの題と本文）">① テーマ全体を写す（最初に1回）</button>
        <button class="dk-mini" onclick="dkImageBrief('73_')" title="同じスレッドで、このカードへ進む（コード・題・メモだけ）">② このカードへ進む</button>
        <button class="dk-mini" onclick="dkImageBrief('70_')" title="このカード1枚だけを、決まりの全文つきで頼む（スレッドを分けるとき・プロジェクトを使わないとき）">1枚だけ（全文）</button></span>
      <button class="dash-refresh" onclick="dkDelete()">外す（ごみ箱へ）</button>
      <span id="dkMsg" class="mag-dim"></span>
    </div>`;
  dkRestore();
  dkCount();
}
function dkVals() {
  const g = id => document.getElementById(id);
  const v = { title: g('dkF_title').value, status: g('dkF_status').value };
  if (g('dkF_kind')) v.kind = g('dkF_kind').value;
  for (const [k] of DK_FIELDS) v[k] = g('dkF_' + k).value;
  return v;
}
function dkCount() { const el = document.getElementById('dkN_body'); if (!el) return; const n = dkChars(document.getElementById('dkF_body').value);
  el.textContent = `${n}字`; el.classList.toggle('out', n > 460 || (n > 0 && n < 320)); }
function dkKey() { return DK_SAVE + dk.folder + '.' + dk.cur; }
function dkOnInput() {
  dk.dirty = true; dkCount();
  try { localStorage.setItem(dkKey(), JSON.stringify({ v: dkVals(), mtime: (dkCard() || {}).mtime, at: Date.now() })); } catch (e) {}
  const m = document.getElementById('dkMsg'); if (m) m.textContent = '保存していません（この端末に一時保存中）';
}
function dkRestore() {
  let st = null; try { st = JSON.parse(localStorage.getItem(dkKey()) || 'null'); } catch (e) {}
  const c = dkCard(); if (!st || !c) return;
  const same = Object.keys(st.v).every(k => String(st.v[k] || '') === String(c[k] || ''));
  if (same) { try { localStorage.removeItem(dkKey()); } catch (e) {} return; }
  const when = new Date(st.at);
  if (confirm(`このカードに、${when.getMonth() + 1}/${when.getDate()} ${when.getHours()}:${String(when.getMinutes()).padStart(2, '0')} に書きかけた直しが残っています。戻しますか？\n（いいえ＝捨てて、ファイルの内容を出す）`)) {
    for (const k in st.v) { const el = document.getElementById('dkF_' + k); if (el) el.value = st.v[k]; }
    dk.dirty = true; const m = document.getElementById('dkMsg'); if (m) m.textContent = '書きかけを戻しました（まだ保存していません）';
  } else { try { localStorage.removeItem(dkKey()); } catch (e) {} }
}
async function dkSaveCard() {
  const c = dkCard(); if (!c) return;
  const j = await dkPost('card/save', { folder: dk.folder, code: c.code, mtime: c.mtime, ...dkVals() });
  if (!j.ok) {
    if (j.conflict && confirm(j.error + '。\n\nいまの入力を残したまま読み直しますか？（入力はこの端末に一時保存してあります。読み直したあと「戻す」を選べます）')) { dk.dirty = false; await dkOpenTheme(dk.folder); }
    else if (!j.conflict) dkToast(j.error, true);
    return;
  }
  try { localStorage.removeItem(dkKey()); } catch (e) {}
  Object.assign(c, j.card); dk.dirty = false;
  const row = document.querySelector(`.dk-card[data-code="${c.code}"]`);
  if (row) { row.querySelector('.dk-title').textContent = c.title; row.querySelector('.dk-chars').textContent = c.chars || '';
    const s = row.querySelector('.dk-stat'); s.className = 'dk-stat s-' + c.status; s.textContent = { '構想': '・', '骨組み': '◔', '執筆中': '◑', '確定': '●' }[c.status] || '・';
    row.className = row.className.replace(/k-\w+/, 'k-' + (c.kind || 'X')); }
  const m = document.getElementById('dkMsg'); if (m) m.textContent = '保存しました';
}
async function dkInsert(i, kind) {
  // 押しまちがいで空のカードができないよう、必ず確かめる（10/26：題を押したつもりで差し込まれた）
  const what = kind === 'F' ? '史実' : kind === 'C' ? '解説' : '新しい';
  if (!confirm(`${i + 1}枚目の位置に、${what}のカードを差し込みます。よろしいですか？`)) return;
  if (dk.dirty && !confirm('いまのカードに保存していない直しがあります（一時保存はしてあります）。差し込みますか？')) return;
  const j = await dkPost('card/insert', { folder: dk.folder, index: i, kind });
  if (!j.ok) return dkToast(j.error, true);
  dk.cur = j.code; dk.dirty = false; await dkOpenTheme(dk.folder);
  dkToast(`${j.code} を${i + 1}枚目に差し込みました。並びが決まったら「番号を振り直す」で連番にできます`);
  setTimeout(() => { const t = document.getElementById('dkF_title'); if (t) { t.select(); t.focus(); } }, 200);
}
async function dkDelete() {
  const c = dkCard(); if (!c) return;
  if (!confirm(`${c.code}「${c.title}」を、このテーマから外します（テーマの _ごみ箱 に移すだけで、消えはしません）。CSVにはまだ残っています。`)) return;
  const j = await dkPost('card/delete', { folder: dk.folder, code: c.code });
  if (!j.ok) return dkToast(j.error, true);
  try { localStorage.removeItem(dkKey()); } catch (e) {}
  dk.cur = ''; dk.dirty = false; await dkOpenTheme(dk.folder);
}
async function dkRecode() {
  const c = dkCard(); if (!c) return;
  if (dk.dirty) return dkToast('先に保存してください', true);
  const to = (prompt(`${c.code} の新しいコード`, c.code) || '').trim().toUpperCase();
  if (!to || to === c.code) return;
  const j = await dkPost('card/recode', { folder: dk.folder, code: c.code, to });
  if (!j.ok) return dkToast(j.error, true);
  dk.cur = to; await dkOpenTheme(dk.folder); dkToast(`${c.code} → ${to} に変えました`);
}
async function dkRenumber() {
  if (dk.dirty) return dkToast('先にカードを保存してください', true);
  const pv = await dkPost('renumber', { folder: dk.folder, preview: true });
  if (!pv.ok) return dkToast(pv.error, true);
  if (!pv.plan.length) return dkToast('番号は、もう並びどおりです');
  if (!confirm(`いまの並びのとおりに、${pv.plan.length}枚のコードを変えます。\n\n${pv.plan.map(p => `${p.from} → ${p.to}`).join('\n')}\n\nAIとのやり取りで前のコードを使っていたら、言い換えてください。CSVに出したあとなら、もう一度「CSVへ出力」が要ります。`)) return;
  const curIdx = dk.data.theme.order.indexOf(dk.cur);
  const j = await dkPost('renumber', { folder: dk.folder });
  if (!j.ok) return dkToast(j.error, true);
  dk.cur = j.order[curIdx] || dk.cur; await dkOpenTheme(dk.folder); dkToast(`${j.pairs.length}枚のコードを振り直しました`);
}
// ドラッグで並べ替え
function dkDragStart(e) { e.dataTransfer.setData('text/plain', e.currentTarget.dataset.code); e.dataTransfer.effectAllowed = 'move'; }
function dkDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drop'); }
async function dkDrop(e) {
  e.preventDefault(); e.currentTarget.classList.remove('drop');
  const from = e.dataTransfer.getData('text/plain'), to = e.currentTarget.dataset.code;
  if (!from || from === to) return;
  const order = dk.data.theme.order.slice(), i = order.indexOf(from); order.splice(i, 1);
  const j0 = order.indexOf(to), after = e.offsetY > e.currentTarget.offsetHeight / 2;
  order.splice(j0 + (after ? 1 : 0), 0, from);
  const j = await dkPost('card/order', { folder: dk.folder, order });
  if (!j.ok) return dkToast(j.error, true);
  dk.data.theme.order = j.order;
  dk.data.cards.sort((a, b) => j.order.indexOf(a.code) - j.order.indexOf(b.code));
  const keepDirty = dk.dirty; const v = keepDirty ? dkVals() : null;
  dkRenderCards();
  if (v) { for (const k in v) { const el = document.getElementById('dkF_' + k); if (el) el.value = v[k]; } dk.dirty = true; }
}
function dkCopy(t) {
  navigator.clipboard.writeText(String(t || '')).then(() => dkToast('写しました（貼り付けできます）'), () => dkToast('写せませんでした', true));
}
// チャッピーへの画像の依頼を、このカード1枚で作って写す（ひな形 70_／71_。控えはテーマの 依頼/ に残る。10/25）
async function dkImageBrief(prefix) {
  const c = dkCard(); if (!c) return;
  if (dk.dirty) return dkToast('先にこのカードを保存してください（依頼書は保存した内容で作ります）', true);
  if (!dkTpls) { const j = await dkGet('templates'); if (!j.ok) return dkToast(j.error, true); dkTpls = j; }
  const t = dkTpls.templates.find(x => x.name.startsWith(prefix));
  if (!t) return dkToast('画像の依頼のひな形（' + prefix + '…）が見つかりません', true);
  const whole = t.scope === 'theme';
  const j = await dkPost('brief', { folder: dk.folder, template: t.name, to: 'チャッピー', cards: whole ? [] : [c.code], ask: '' });
  if (!j.ok) return dkToast(j.error, true);
  const what = whole ? `テーマ全体（${dk.data.cards.length}枚の題と本文、${j.chars}字）` : `${c.code} の画像の依頼（${t.title.replace(/^画像の依頼[：（]?/, '').replace(/）$/, '')}）`;
  try { await navigator.clipboard.writeText(j.text); dkToast(`${what}を写しました。チャッピーに貼ってください`); }
  catch (e) { dkToast('写せませんでした（控えは 依頼/ にあります）', true); }
}
function dkCopyBrief() {
  const th = dk.data.theme, v = dkVals(), c = dkCard();
  const i = dk.data.theme.order.indexOf(c.code);
  const near = dk.data.cards.slice(Math.max(0, i - 1), i + 2).map(x => `${x.code}　${x.code === c.code ? v.title : x.title}`).join('\n');
  dkCopy(`【TAKERU ${th.subject}／テーマ：${th.name}】\n` +
    (th.axis ? `\n■ テーマの主軸\n${th.axis}\n` : '') + (th.threads ? `\n■ 縦糸\n${th.threads}\n` : '') +
    `\n■ このカード：${c.code}（${v.kind === 'C' ? '解説' : v.kind === 'F' ? '史実' : ''}）${v.title}\n` +
    (v.aim ? `狙い：${v.aim}\n` : '') + (v.skeleton ? `\n骨組み・ファクト：\n${v.skeleton}\n` : '') +
    (v.body ? `\nいまの本文：\n${v.body}\n` : '') +
    `\n■ 前後のカード\n${near}\n\n（書き方は「TAKERU カード作成ルール」と「テーマ制作手順書」に従う。本文は400字前後）`);
}

// ---------------- CSVへ出力・取り込み ----------------
async function dkRenderExport() {
  const b = document.getElementById('dkBody');
  b.innerHTML = '<p class="qr-empty">CSVと突き合わせています…</p>';
  const [p, pull] = await Promise.all([dkGet('export/preview?f=' + encodeURIComponent(dk.folder)), dkPost('pull', { folder: dk.folder, preview: true })]);
  if (!p.ok) { b.innerHTML = `<p class="qr-warn">${dkEsc(p.error)}</p>`; return; }
  const pub = p.cards.filter(c => c.published && c.changed), other = p.cards.filter(c => c.otherTheme);
  b.innerHTML = `
    <div class="mag-band">
      <div><b>CSVへ出力</b>：このテーマのカードを、デスクの並びのとおりに TAKERUcard.csv に書きます。同じコードの行は置き換えます。
        <b>新しいカードは未公開</b>で入ります（公開の印がある行は、印をそのまま残します）。</div>
      <div class="mag-dim">ユニット（テーマ列）：${dkEsc(p.unit)}　科目：${dkEsc(p.subject)}　解説の題には「→」を付けます。書く前にCSVの控えを作ります。</div>
      ${pub.length ? `<div class="mag-alert">⚠ 公開中のカードの中身が変わります：${pub.map(c => dkEsc(c.code)).join('、')}</div>` : ''}
      ${p.removed.length ? `<div class="mag-alert">⚠ CSVから消える行（デスクに無い ${dkEsc(dk.data.theme.prefix)} のカード）：${p.removed.map(r => `${dkEsc(r.code)}「${dkEsc(r.title)}」${r.published ? '（公開中）' : ''}`).join('、')}</div>` : ''}
      ${other.length ? `<div class="mag-alert">⚠ ほかのテーマで使っているコードがあるので出力できません：${other.map(c => dkEsc(c.code)).join('、')}</div>` : ''}
      <div class="mag-btns"><button class="btn-publish" onclick="dkExport()" ${other.length ? 'disabled' : ''}>📤 CSVへ出力する</button>
        <span class="sub">出したあと、本体の画面に読み直します。アプリへの公開は、これまでどおり「🚀 本番公開」で</span></div>
    </div>
    <table class="mag-small-table"><tr><th>コード</th><th>題（CSVに出る形）</th><th>字数</th><th>CSV</th></tr>
      ${p.cards.map(c => `<tr><td>${dkEsc(c.code)}</td><td>${dkEsc(c.title)}</td><td class="${c.chars > 460 ? 'mag-warn' : ''}">${c.chars}</td>
        <td>${c.isNew ? '<b>新しく入る</b>' : c.changed ? '置き換え' : '<span class="mag-dim">変わらない</span>'}${c.published ? '（公開中）' : ''}</td></tr>`).join('')}</table>
    <div class="mag-band" style="margin-top:14px">
      <div><b>取り込み（CSV→デスク）</b>：本体の画面で直した題・本文を、デスクのカードへ戻します。</div>
      ${pull.ok && pull.diff.length ? `<div>CSVの方が違うカード（取り込むものに印を付けてください）：</div>
        <div class="dk-pull">${pull.diff.map(d => `<label><input type="checkbox" class="dkPullCk" value="${dkEsc(d.code)}"> ${dkEsc(d.code)}　${dkEsc(d.title)}（${[d.titleChanged ? '題' : '', d.bodyChanged ? '本文' : ''].filter(Boolean).join('・')}が違う）</label>`).join('')}</div>
        <div class="mag-dim">CSVの方が「（準備中）」の仮の文のカードは、比べていません。</div>
        <div class="mag-btns"><button class="dash-refresh" onclick="dkPull()">⤵ 印を付けたカードの題・本文を、CSVから取り込む</button></div>`
        : '<div class="mag-dim">いまは、CSVとデスクの題・本文は同じです（CSVにまだ無いカードは比べていません）。</div>'}
    </div>`;
}
async function dkExport() {
  if (typeof dirty !== 'undefined' && dirty) return dkToast('本体の画面に、保存していない直しがあります。先に本体で保存してください（そのまま出力すると、本体の保存で上書きされます）', true);
  if (!confirm('このテーマのカードを TAKERUcard.csv に書きます（控えを作ってから書きます）。よろしいですか？')) return;
  const j = await dkPost('export', { folder: dk.folder });
  if (!j.ok) return dkToast(j.error, true);
  dkToast(`CSVに${j.written}枚を書きました${j.removed ? `・${j.removed}行を外しました` : ''}（控え ${j.backup}）`);
  if (typeof reload === 'function') { try { await reload(); } catch (e) {} }   // 本体の画面にも読み直す
  dkRenderExport();
}
async function dkPull() {
  const codes = [...document.querySelectorAll('.dkPullCk:checked')].map(e => e.value);
  if (!codes.length) return dkToast('取り込むカードに印を付けてください', true);
  if (!confirm(`${codes.join('、')} の題・本文を、CSVの内容で書き換えます。デスクの方にだけある直しは消えます。よろしいですか？`)) return;
  const j = await dkPost('pull', { folder: dk.folder, codes });
  if (!j.ok) return dkToast(j.error, true);
  dkToast(`${j.diff.length}枚を取り込みました`); await dkOpenTheme(dk.folder); dk.tab = 'export'; dkRender();
}

// ---------------- 依頼と受け取り（AIからAIへ引き継ぐ。2026-10-22） ----------------
//   依頼書：ひな形（制作デスク/_依頼のひな形）に、デスクで決まったことを差し込んで作る。控えはテーマの 依頼/ に残る
//   受け取り：返ってきた文を、資料・カード割り・骨組み・本文としてデスクに入れる（先に下見を見せる）
let dkTpls = null, dkBriefSel = '', dkLastBrief = '';
const DK_RET = { none: '受け取りなし（話し合い・指摘）', research: '資料として受け取る', plan: 'カード割りの表として受け取る', skeleton: '骨組みとして受け取る', body: '本文として受け取る' };
async function dkRenderBrief() {
  const b = document.getElementById('dkBody');
  if (!dkTpls) { const j = await dkGet('templates'); if (!j.ok) { b.innerHTML = `<p class="qr-warn">${dkEsc(j.error)}</p>`; return; } dkTpls = j; }
  const tpls = dkTpls.templates;
  if (!tpls.find(t => t.name === dkBriefSel)) dkBriefSel = (tpls[0] || {}).name || '';
  const t = tpls.find(x => x.name === dkBriefSel);
  const d = dk.data;
  const cardPick = t && (t.scope === 'cards' || t.slots.some(s => /選んだカード|前後のカード|画像プロンプト/.test(s)));
  const resPick = t && t.slots.includes('資料');
  b.innerHTML = `<div class="dk-brief">
    <div class="dk-tpls"><div class="dk-h" style="margin-top:0">依頼のひな形</div>
      <ul>${tpls.map(x => `<li class="${x.name === dkBriefSel ? 'on' : ''}" onclick='dkBriefPick(${JSON.stringify(x.name)})'>
        <span class="dk-tstage">${x.stage ? (/^\d+$/.test(x.stage) ? '段' + dkEsc(x.stage) : dkEsc(x.stage)) : ''}</span>${dkEsc(x.title)}<div class="mag-dim">${dkEsc(x.to)}</div></li>`).join('') || '<li class="mag-dim">ひな形がありません</li>'}</ul>
      <button class="dash-refresh" onclick="dkOpenPath({})">📁 ひな形のフォルダ（制作デスク）</button>
      <button class="dash-refresh" onclick="dkTpls=null; dkRenderBrief()">↻ ひな形を読み直す</button>
      <div class="mag-dim">ひな形は「_依頼のひな形」の md です。文面は自由に直せます。</div>
      <div class="dk-h">これまでの依頼と受け取り</div><div id="dkBriefHist" class="dk-hist"></div></div>
    <div class="dk-bform">${t ? `
      <div class="mag-band"><div><b>${dkEsc(t.title)}</b>　→ ${dkEsc(t.to)}</div>${t.note ? `<div class="mag-dim">${dkEsc(t.note)}</div>` : ''}
        <div class="mag-dim">返事は：${dkEsc(DK_RET[t.returns] || t.returns)}</div></div>
      ${/／/.test(t.to) ? `<div class="mag-field"><div class="lbl">渡す相手 <span class="hint">控えの名前に入ります</span></div>
        <select id="dkBTo" class="x-in">${t.to.split('／').map(x => `<option>${dkEsc(x.trim())}</option>`).join('')}</select></div>` : ''}
      ${cardPick ? `<div class="mag-field"><div class="lbl">カード <span class="hint">選んだカードの題・狙い・骨組みなどが入ります</span>
          <button class="dk-mini" onclick="dkBriefAll(true)">全部</button><button class="dk-mini" onclick="dkBriefAll(false)">外す</button></div>
        <div class="dk-picks">${d.cards.map(c => `<label><input type="checkbox" class="dkBCard" value="${dkEsc(c.code)}" ${c.code === dk.cur ? 'checked' : ''}> ${dkEsc(c.code)} ${dkEsc(c.title)}</label>`).join('')}</div></div>` : ''}
      ${resPick ? `<div class="mag-field"><div class="lbl">添える資料 <span class="hint">全文が入ります（長いと依頼書も長くなります）</span></div>
        <div class="dk-picks">${d.research.map(r => `<label><input type="checkbox" class="dkBRes" value="${dkEsc(r.name)}"> ${dkEsc(r.name)}</label>`).join('') || '<span class="mag-dim">資料はまだありません</span>'}</div></div>` : ''}
      <div class="mag-field"><div class="lbl">頼みたいこと <span class="hint">依頼書の「頼みたいこと」に入ります</span></div>
        <textarea id="dkBAsk" class="mid" placeholder="例：1450〜1700年のオスマン帝国の軍制の変化を、時系列で"></textarea></div>
      <div class="mag-btns"><button class="btn-save" onclick="dkBriefBuild()">📨 依頼書を作る（写す）</button><span class="sub">作った依頼書はクリップボードに写り、テーマの 依頼/ に控えが残ります</span></div>
      <div id="dkBOut"></div>
      ${t.returns && t.returns !== 'none' ? dkRecvHtml(t.returns) : `<div class="mag-band"><div><b>受け取り</b></div>${dkRecvHtml('', true)}</div>`}` : '<p class="qr-empty">左からひな形を選んでください。</p>'}
    </div></div>`;
  if (document.getElementById('dkRKind')) dkRecvKind();
  dkBriefHist();
}
function dkRecvHtml(kind, plain) {
  const opt = ['research', 'plan', 'skeleton', 'body'].map(k => `<option value="${k}" ${k === kind ? 'selected' : ''}>${DK_RET[k]}</option>`).join('');
  return `${plain ? '' : '<div class="mag-band"><div><b>受け取り</b>：返ってきた文を貼って、デスクに入れます</div>'}
    <div class="dk-row"><select id="dkRKind" onchange="dkRecvKind()">${opt}</select>
      <input id="dkRFrom" class="x-in" style="max-width:200px" placeholder="どのAIから（控えの名前に）">
      <input id="dkRName" class="x-in" style="max-width:260px" placeholder="資料の名前（資料のとき）"></div>
    <textarea id="dkRText" class="mid" style="min-height:160px" placeholder="返ってきた文をそのまま貼る"></textarea>
    <div class="dk-row"><button class="dash-refresh" onclick="dkRecv(true)">下見（何が変わるか）</button>
      <label class="mag-dim" id="dkRReorderL"><input type="checkbox" id="dkRReorder"> 表の並びにカードを並べ替える</label>
      <label class="mag-dim" id="dkRTitleL"><input type="checkbox" id="dkRTitle"> 題も、返事の見出しの題に書き換える</label></div>
    <div id="dkROut"></div>${plain ? '' : '</div>'}`;
}
function dkRecvKind() {
  const k = document.getElementById('dkRKind').value;
  document.getElementById('dkRName').style.display = k === 'research' ? '' : 'none';
  document.getElementById('dkRReorderL').style.display = k === 'plan' ? '' : 'none';
  document.getElementById('dkRTitleL').style.display = (k === 'body' || k === 'skeleton') ? '' : 'none';
}
function dkBriefPick(n) { dkBriefSel = n; dkRenderBrief(); }
function dkBriefAll(on) { document.querySelectorAll('.dkBCard').forEach(e => e.checked = on); }
async function dkBriefBuild() {
  const to = document.getElementById('dkBTo');
  const j = await dkPost('brief', { folder: dk.folder, template: dkBriefSel, to: to ? to.value : '',
    cards: [...document.querySelectorAll('.dkBCard:checked')].map(e => e.value),
    research: [...document.querySelectorAll('.dkBRes:checked')].map(e => e.value),
    ask: document.getElementById('dkBAsk').value });
  if (!j.ok) return dkToast(j.error, true);
  dkLastBrief = j.text;
  try { await navigator.clipboard.writeText(j.text); } catch (e) {}
  document.getElementById('dkBOut').innerHTML = `<div class="mag-msgbox ok">依頼書を写しました（${j.chars}字）。控え：依頼/${dkEsc(j.name)}　相手のAIにそのまま貼ってください。</div>
    <details><summary class="mag-dim">中身を見る・直して写す</summary><textarea id="dkBText" class="mid" style="min-height:240px">${dkEsc(j.text)}</textarea>
    <button class="dash-refresh" onclick="dkCopy(document.getElementById('dkBText').value)">📋 直したものを写す</button></details>`;
  dkBriefHist();
}
async function dkRecv(preview) {
  const b = { folder: dk.folder, kind: document.getElementById('dkRKind').value, text: document.getElementById('dkRText').value,
              name: document.getElementById('dkRName').value, from: document.getElementById('dkRFrom').value,
              reorder: document.getElementById('dkRReorder').checked, withTitle: document.getElementById('dkRTitle').checked, preview };
  if (!preview) { const ck = [...document.querySelectorAll('.dkRCode')]; if (ck.length) b.codes = ck.filter(e => e.checked).map(e => e.value); }
  const j = await dkPost('receive', b);
  const out = document.getElementById('dkROut');
  if (!j.ok) { out.innerHTML = `<div class="mag-msgbox bad">${dkEsc(j.error)}</div>`; return; }
  if (!preview) {
    out.innerHTML = '<div class="mag-msgbox ok">デスクに入れました。控えはテーマの 依頼/ にあります。</div>';
    document.getElementById('dkRText').value = '';
    const keep = dk.tab; await dkOpenTheme(dk.folder); dk.tab = keep; return;
  }
  const pick = ['skeleton', 'body'].includes(b.kind);
  out.innerHTML = `<div class="mag-band"><b>下見</b>
    <ul class="dk-chg">${j.changes.map(c => `<li class="${c.skip ? 'skip' : c.same ? 'same' : ''}">${pick && !c.skip ? `<label><input type="checkbox" class="dkRCode" value="${dkEsc(c.code)}" checked> ` : ''}${c.code ? `<b>${dkEsc(c.code)}</b>　` : ''}${dkEsc(c.what)}${c.titleNew && !b.withTitle ? `<span class="mag-dim">（返事の題：${dkEsc(c.titleNew)}。題は変えません）</span>` : ''}${pick && !c.skip ? '</label>' : ''}</li>`).join('')}</ul>
    ${(j.missing || []).length ? `<div class="mag-dim">表に無いカード（そのまま残します）：${j.missing.map(dkEsc).join('、')}</div>` : ''}
    ${b.kind === 'body' ? '<div class="mag-dim">本文を書き換えるカードは、受け取る前の本文を 依頼/ の控えに残します。</div>' : ''}
    <div class="mag-btns"><button class="btn-save" onclick="dkRecv(false)">この内容でデスクに入れる</button></div></div>`;
}
async function dkBriefHist() {
  const el = document.getElementById('dkBriefHist'); if (!el) return;
  const j = await dkGet('briefs?f=' + encodeURIComponent(dk.folder));
  if (!j.ok) { el.textContent = ''; return; }
  el.innerHTML = j.names.length ? j.names.slice(0, 20).map(n => `<div class="dk-hrow" onclick='dkBriefShow(${JSON.stringify(n)})'>${dkEsc(n.replace(/\.md$/, ''))}</div>`).join('')
                                : '<div class="mag-dim">まだありません</div>';
}
async function dkBriefShow(n) {
  const j = await dkGet(`briefs?f=${encodeURIComponent(dk.folder)}&name=${encodeURIComponent(n)}`);
  if (!j.ok) return dkToast(j.error, true);
  document.getElementById('dkBOut').innerHTML = `<div class="mag-band"><div class="dk-row"><b>${dkEsc(n)}</b>
      <button class="dash-refresh" onclick="dkCopy(document.getElementById('dkBText').value)">📋 写す</button></div>
    <textarea id="dkBText" class="mid" style="min-height:240px">${dkEsc(j.text)}</textarea></div>`;
}

// Ctrl+S でカードを保存
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && document.getElementById('deskModal') && document.getElementById('deskModal').style.display === 'flex') {
    e.preventDefault(); e.stopPropagation();
    if (dk.tab === 'cards') dkSaveCard(); else if (dk.tab === 'research' && dk.research) dkResSave();
  }
  // Alt+← / Alt+→ で前後のカードへ（カードのタブのとき）
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && dk.tab === 'cards' && document.getElementById('deskModal') && document.getElementById('deskModal').style.display === 'flex') {
    e.preventDefault(); dkStep(e.key === 'ArrowLeft' ? -1 : 1);
  }
}, true);
