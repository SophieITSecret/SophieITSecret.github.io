// ============================================================
// 📌 住所録（サーバー側は editor/book.js）2026-10-27
//   TAKERU関係のサイト・管理画面・フォルダの住所をまとめておく。名前を押すと開く（サイトはブラウザ、フォルダはエクスプローラー）
//   ⚠パスワード・鍵は入れない
// ============================================================
let bk = { items: [], stamp: '', path: '', filter: '', editing: null, msg: '' };

function bkEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function bkIsUrl(s) { return /^https?:\/\//i.test(s); }

async function openBook() {
  document.getElementById('bookModal').style.display = 'flex';
  await bkLoad();
  const f = document.getElementById('bkFilter'); if (f) f.focus();
}
function closeBook() { document.getElementById('bookModal').style.display = 'none'; }
async function bkLoad() {
  const j = await (await fetch('/api/book')).json();
  if (!j.ok) { document.getElementById('bkBody').innerHTML = `<p class="qr-warn">読めませんでした：${bkEsc(j.error)}</p>`; return; }
  bk.items = j.items; bk.stamp = j.stamp; bk.path = j.path; bk.editing = null;
  bkRender();
}
async function bkSave(items, okMsg) {
  const j = await (await fetch('/api/book', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items, stamp: bk.stamp }) })).json();
  if (!j.ok) {
    bk.msg = j.error; bk.msgBad = true;
    if (j.conflict) { await bkLoad(); bk.msg = j.error; bk.msgBad = true; bkRender(); }
    else bkRender();
    return false;
  }
  bk.items = items; bk.stamp = j.stamp; bk.editing = null; bk.msg = okMsg || '保存しました'; bk.msgBad = false;
  bkRender(); return true;
}
function bkFiltered() {
  const q = bk.filter.trim().toLowerCase();
  return q ? bk.items.filter(x => (x.name + ' ' + x.url + ' ' + x.note + ' ' + x.group).toLowerCase().includes(q)) : bk.items;
}
function bkRender() {
  const groups = [...new Set(bk.items.map(x => x.group))];
  const list = bkFiltered();
  const shown = [...new Set(list.map(x => x.group))];
  const body = shown.map(g => `<div class="bk-group"><div class="bk-gh">${bkEsc(g)}</div>${list.filter(x => x.group === g).map(bkRow).join('')}</div>`).join('')
    || '<p class="mag-dim">見つかりません。</p>';
  document.getElementById('bkBody').innerHTML = `
    <div class="bk-bar">
      <input id="bkFilter" class="x-in" placeholder="さがす（名前・住所・メモ）" value="${bkEsc(bk.filter)}" oninput="bk.filter=this.value; bkRenderList()">
      <button class="dash-refresh" onclick="bkNew()">＋ 住所を足す</button>
      <button class="dash-refresh" onclick="bkLoad()" title="Obsidian や Claude Code で直したものを読み直す">↻ 読み直す</button>
    </div>
    ${bk.msg ? `<div class="mag-msgbox ${bk.msgBad ? 'bad' : 'ok'}">${bkEsc(bk.msg)}</div>` : ''}
    ${bk.editing ? bkForm(groups) : ''}
    <div id="bkList">${body}</div>
    <p class="mag-dim" style="margin-top:12px">⚠ パスワード・鍵は入れないでください（この住所録は Dropbox に写ります）。ファイル：${bkEsc(bk.path)}</p>`;
}
// 打ちながら絞り込むとき、入力欄を作り直さない（打っている途中で文字が途切れないように）
function bkRenderList() {
  const list = bkFiltered(), shown = [...new Set(list.map(x => x.group))];
  document.getElementById('bkList').innerHTML = shown.map(g => `<div class="bk-group"><div class="bk-gh">${bkEsc(g)}</div>${list.filter(x => x.group === g).map(bkRow).join('')}</div>`).join('') || '<p class="mag-dim">見つかりません。</p>';
}
function bkRow(x) {
  const url = bkIsUrl(x.url);
  return `<div class="bk-row">
    <button class="bk-open" onclick="bkOpen('${bkEsc(x.id)}')" title="${bkEsc(x.url)}">${url ? '🌐' : '📁'} ${bkEsc(x.name)}</button>
    <span class="bk-note">${bkEsc(x.note)}</span>
    <span class="bk-btns">
      <button class="dk-mini" onclick="bkCopy('${bkEsc(x.id)}')" title="住所を写す">📋</button>
      <button class="dk-mini" onclick="bkEdit('${bkEsc(x.id)}')" title="直す">✎</button>
      <button class="dk-mini" onclick="bkDelete('${bkEsc(x.id)}')" title="消す">✕</button></span></div>`;
}
function bkForm(groups) {
  const e = bk.editing;
  return `<div class="mag-band bk-form"><b>${e.id ? '住所を直す' : '住所を足す'}</b>
    <div class="dk-grid2"><label class="mag-dim">グループ（新しい名前を打ってもよい）<input id="bkF_group" class="x-in" list="bkGroups" value="${bkEsc(e.group)}"></label>
      <label class="mag-dim">名前<input id="bkF_name" class="x-in" value="${bkEsc(e.name)}"></label></div>
    <datalist id="bkGroups">${groups.map(g => `<option value="${bkEsc(g)}">`).join('')}</datalist>
    <label class="mag-dim">住所（https:// で始まるサイトの住所、または D:\\… のこのPCの場所）<input id="bkF_url" class="x-in" value="${bkEsc(e.url)}"></label>
    <label class="mag-dim">メモ<input id="bkF_note" class="x-in" value="${bkEsc(e.note)}"></label>
    <div class="mag-btns"><button class="btn-save" onclick="bkSaveForm()">💾 保存</button><button class="dash-refresh" onclick="bk.editing=null; bkRender()">やめる</button></div></div>`;
}
function bkNew() { bk.msg = ''; bk.editing = { id: '', group: bk.items.length ? bk.items[bk.items.length - 1].group : '', name: '', url: '', note: '' }; bkRender(); const n = document.getElementById('bkF_name'); if (n) n.focus(); }
function bkEdit(id) { const x = bk.items.find(i => i.id === id); if (!x) return; bk.msg = ''; bk.editing = { ...x }; bkRender(); const n = document.getElementById('bkF_name'); if (n) n.focus(); }
async function bkSaveForm() {
  const g = id => document.getElementById('bkF_' + id).value.trim();
  const x = { id: bk.editing.id, group: g('group') || 'その他', name: g('name'), url: g('url'), note: g('note') };
  if (!x.name) { bk.msg = '名前を入れてください'; bk.msgBad = true; return bkRender(); }
  if (!/^https?:\/\/\S+$/i.test(x.url) && !/^[A-Za-z]:\\/.test(x.url)) { bk.msg = '住所は、https:// で始まるサイトの住所か、D:\\… のようなこのPCの場所にしてください'; bk.msgBad = true; return bkRender(); }
  if (/(password|passwd|パスワード|token|トークン)\s*[:=：]/i.test(x.note + ' ' + x.url)) { if (!confirm('パスワードや鍵のような文字が入っているようです。この住所録は Dropbox に写ります。本当に入れますか？')) return; }
  const items = bk.items.slice(), isNew = !x.id;
  if (x.id) { const i = items.findIndex(i => i.id === x.id); items[i] = x; }
  else {
    x.id = 'b' + Date.now().toString(36);
    let at = -1; items.forEach((it, i) => { if (it.group === x.group) at = i; });      // 同じグループの終わりに
    items.splice(at >= 0 ? at + 1 : items.length, 0, x);
  }
  await bkSave(items, isNew ? '足しました' : '保存しました');
}
async function bkDelete(id) {
  const x = bk.items.find(i => i.id === id); if (!x) return;
  if (!confirm(`「${x.name}」を住所録から消します。よろしいですか？`)) return;
  await bkSave(bk.items.filter(i => i.id !== id), '消しました（直前の分は「TAKERU 住所録.bak.json」に残っています）');
}
async function bkOpen(id) {
  const x = bk.items.find(i => i.id === id); if (!x) return;
  bk.msg = '';
  if (bkIsUrl(x.url)) { window.open(x.url, '_blank', 'noopener'); return; }
  const j = await (await fetch('/api/book/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target: x.url }) })).json();
  if (!j.ok) { bk.msg = j.error; bk.msgBad = true; bkRender(); }
}
function bkCopy(id) {
  const x = bk.items.find(i => i.id === id); if (!x) return;
  navigator.clipboard.writeText(x.url).then(() => { bk.msg = `「${x.name}」の住所を写しました`; bk.msgBad = false; bkRender(); }, () => { bk.msg = '写せませんでした'; bk.msgBad = true; bkRender(); });
}
