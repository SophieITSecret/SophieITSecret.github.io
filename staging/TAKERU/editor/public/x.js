// ============================================================
// 𝕏 X発信の一覧（X用GAS。Claude＝Cowork君の作、版 x3〜）
//   資料：「MSフォーラム X発信管理 仕様書 第3版」と「コード君たちへの依頼」（10/14）の 1-1
//   ⚠本番：「待機中」にした行は、予定の時刻に @MSforum01 へ本当に投稿される。承認の前に必ず確認を出す
//   ・書き込みは作業台のサーバー（/api/x/save）経由。鍵は画面に渡さない
//   ・直すときは一覧で読んだ updated_at を添える（GASや別の画面と取り違えないため）。食い違ったら入力は消さない
//   ・直しかけの文章は端末に一時保存（閉じても残る）
//   ・スマホでも縦1列で読めるようにする
// ============================================================
let xItems = [], xStat = null, xFilter = 'coming', xEditing = null, xTimer = null, xLastOk = null;
const X_STASH = 'takeru.x.stash.';
const X_KIND_LIST = ['マーケット', '先週の動き', 'ご存知ですか', '時事', 'アプリ紹介', 'お知らせ', '在庫', 'その他'];
const X_DONE = ['投稿済', '試運転済'];

function xEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function xHm(d) { return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
// "2026-10-15 17:00" → "10月15日（水）17:00"
function xAtLabel(at) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(at || ''); if (!m) return at ? at : '（次の空いている枠）';
  const w = '日月火水木金土'[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
  return `${+m[2]}月${+m[3]}日（${w}）${m[4] ? ` ${+m[4]}:${m[5]}` : ''}`;
}
function xWeightLocal(s) {   // Xの数え方の目安（日本語は2、URLは23）
  let n = 0;
  const t = String(s || '').replace(/https?:\/\/\S+/g, () => { n += 23; return ''; });
  for (const ch of t) { const c = ch.codePointAt(0); n += (c <= 4351 || (c >= 8192 && c <= 8205) || (c >= 8208 && c <= 8223) || (c >= 8242 && c <= 8247)) ? 1 : 2; }
  return n;
}
function xToInput(at) { return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(at || '') ? at.replace(' ', 'T') : ''; }
function xFromInput(v) { return v ? v.replace('T', ' ').slice(0, 16) : ''; }

// ---------------- 開く・閉じる ----------------
function openX() {
  document.getElementById('xModal').style.display = 'flex';
  xLoad();
  clearInterval(xTimer);
  xTimer = setInterval(() => { if (!xEditing) xLoad(true); }, 60000);   // 直している最中は取り直さない
}
function closeX() {
  if (xEditing && !confirm('直している途中の行があります（この端末には一時保存してあります）。閉じますか？')) return;
  xEditing = null;
  document.getElementById('xModal').style.display = 'none';
  clearInterval(xTimer); xTimer = null;
}
function xSetFilter(f) { xFilter = f; xRender(); }

// ---------------- 読む ----------------
async function xLoad(quiet, tries = 2) {
  const pane = document.getElementById('xPane');
  if (!quiet && !xItems.length) pane.innerHTML = '<p class="qr-empty">X用GASの返事を待っています…</p>';
  try {
    const from = new Date(); from.setDate(from.getDate() - 45);
    const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const [s, l] = await Promise.all([
      fetch('/api/x/status').then(r => r.json()),
      fetch('/api/x/list?from=' + ymd(from)).then(r => r.json()),
    ]);
    if (!s.ok || !l.ok) {
      const bad = !s.ok ? s : l;
      if (bad.need_secret) { pane.innerHTML = xNeedSecretHtml(); xBadge(null); return; }
      throw new Error(bad.error || '不明');
    }
    xStat = s; xItems = l.items || []; xLastOk = new Date();
    xUpdated(true);
    xBadge(s);
    if (!xEditing) xRender();
  } catch (e) {
    // GASは時々404や空を返す。前の表示を残し、少し待って取り直す
    xUpdated(false, e.message);
    if (!xItems.length) pane.innerHTML = `<p class="qr-warn">読み込めませんでした：${xEsc(e.message)}。数秒後にもう一度試します。</p>`;
    if (tries > 0) { await new Promise(r => setTimeout(r, 5000)); return xLoad(true, tries - 1); }
  }
}
function xNeedSecretHtml() {
  return `<div class="mag-alert">X用GASの鍵（URLと合鍵）が、まだ作業台に入っていません。</div>
    <p class="mag-dim">牧村さんが Cowork君から受け取った「X用GASのURL」と「合鍵（API_TOKEN）」を、
    作業台のフォルダの <b>secrets.json</b> に次の形で足してください（ガーディアンnewsの鍵とは別です）。足したら作業台を立ち上げ直します。</p>
    <pre class="mag-pre x-code">"x": { "gasUrl": "https://script.google.com/macros/s/…/exec", "token": "…" }</pre>
    <p class="mag-dim">secrets.json は git にも Dropbox にも写らない置き場です。鍵をチャットやメモに貼らないでください。</p>`;
}
function xUpdated(ok, msg) {
  const el = document.getElementById('xUpdated'); if (!el) return;
  if (ok) { el.textContent = `最終更新 ${xHm(xLastOk)}`; el.classList.remove('bad'); }
  else { el.textContent = `更新できませんでした（${xLastOk ? xHm(xLastOk) + 'の内容' : '内容なし'}）${msg ? '：' + msg : ''}`; el.classList.add('bad'); }
}
// 上の段のボタンに承認待ちの件数を出す
function xBadge(s) {
  const b = document.getElementById('btnX'); if (!b) return;
  const n = s && s.count ? (s.count['承認待ち'] || 0) : 0;
  const bad = s && s.count ? (s.count['エラー'] || 0) + (s.count['要確認'] || 0) : 0;
  b.textContent = '𝕏 X' + (n ? `（承認待ち${n}）` : '') + (bad ? ' ⚠' : '');
  b.classList.toggle('x-attn', !!(n || bad));
}
async function xPeek() { try { const s = await (await fetch('/api/x/status')).json(); if (s.ok) xBadge(s); return s; } catch (e) { return null; } }

// ---------------- 描く ----------------
function xVisible() {
  if (xFilter === 'coming') return xItems.filter(r => !X_DONE.includes(r.status));
  if (xFilter === 'wait') return xItems.filter(r => r.status === '承認待ち');
  if (xFilter === 'done') return xItems.filter(r => X_DONE.includes(r.status)).slice().reverse();
  return xItems;
}
function xRender() {
  const pane = document.getElementById('xPane'), s = xStat || {};
  const c = s.count || {};
  const chips = Object.keys(c).map(k => `<span class="x-st x-st-${xEsc(k)}">${xEsc(k)} ${c[k]}</span>`).join('');
  const waitN = c['承認待ち'] || 0, badN = (c['エラー'] || 0) + (c['要確認'] || 0);
  const band = `
    <div class="mag-band">
      ${s.mock ? '<div class="qr-warn">【試験用の見本モード】Xには何も出ません</div>' : ''}
      ${s.dry_run ? '<div class="x-dry">試運転中（Xには出ません）</div>' : '<div class="x-live">本番：「待機中」の行は、予定の時刻に @MSforum01 へ投稿されます</div>'}
      <div class="row">${chips || '<span class="mag-dim">行がありません</span>'}<span class="mag-dim">X用GAS ${xEsc(s.version || '')}</span></div>
      ${waitN ? `<div class="mag-alert">承認待ちが ${waitN} 件あります。読んで「承認」または「保留」にしてください。</div>` : ''}
      ${badN ? `<div class="mag-alert">エラー・要確認が ${badN} 件あります（下の一覧で赤く出ています）。</div>` : ''}
    </div>`;
  const tabs = [['coming', 'これから'], ['wait', '承認待ち'], ['done', '投稿済'], ['all', 'すべて']]
    .map(([k, l]) => `<button class="${xFilter === k ? 'on' : ''}" onclick="xSetFilter('${k}')">${l}</button>`).join('');
  const rows = xVisible();
  pane.innerHTML = `${band}
    <details class="x-add" ${xEditing === 'new' ? 'open' : ''}><summary>＋ 新しく足す（お知らせ・アプリ紹介など）</summary>${xFormHtml(null)}</details>
    <div class="x-filter">${tabs}<span class="mag-dim">${rows.length}件（45日前から）</span></div>
    <div class="x-list">${rows.map(xItemHtml).join('') || '<p class="mag-dim">この絞り込みでは、行がありません。</p>'}</div>
    <div class="mag-btns"><button class="dash-refresh" onclick="xLoad()">↻ 今すぐ取り直す</button><span class="sub">開いている間は60秒ごとに取り直します（直している最中は止めます）</span></div>`;
  xRestore(xEditing && xEditing !== 'new' && document.getElementById('xF_text_' + xEditing) ? xEditing : 'new');
}
function xItemHtml(r) {
  if (xEditing === r.id) return `<div class="x-item editing" id="xItem_${xEsc(r.id)}">${xHeadHtml(r)}${xFormHtml(r)}</div>`;
  const body = String(r.text || '');
  const long = body.split('\n').length > 6 || body.length > 220;
  const text = long ? `<details class="x-more"><summary>${xEsc(body.split('\n').slice(0, 3).join('\n').slice(0, 140))}…<span class="mag-dim">（全文を開く）</span></summary><div class="x-text">${xEsc(body)}</div></details>`
                    : `<div class="x-text">${xEsc(body)}</div>`;
  const done = X_DONE.includes(r.status);
  const btns = done ? '' : `<div class="x-btns">
      <button class="dash-refresh" onclick="xEdit('${xEsc(r.id)}')">✎ 直す</button>
      ${r.status !== '待機中' ? `<button class="x-ok" onclick="xApprove('${xEsc(r.id)}')">${['エラー', '要確認'].includes(r.status) ? '↻ もう一度出す（待機中に）' : '✓ 承認（待機中に）'}</button>` : ''}
      ${r.status !== '保留' ? `<button class="dash-refresh" onclick="xHold('${xEsc(r.id)}')">⏸ 保留</button>` : ''}
    </div>`;
  return `<div class="x-item st-${xEsc(r.status)}" id="xItem_${xEsc(r.id)}">
    ${xHeadHtml(r)}
    ${text}
    ${r.link ? `<div class="x-link">🔗 <a href="${xEsc(r.link)}" target="_blank" rel="noopener">${xEsc(r.link)}</a></div>` : '<div class="mag-dim">リンクなし</div>'}
    ${(r.images || []).length ? `<div class="mag-dim">🖼 画像 ${r.images.length}枚</div>` : ''}
    ${r.error ? `<div class="x-err">⚠ ${xEsc(r.error)}</div>` : ''}
    <div class="mag-dim">${r.source ? '出どころ：' + xEsc(r.source) : ''}${r.issue ? '　号：' + xEsc(r.issue) : ''}${r.approved ? '　承認：' + xEsc(r.approved) : ''}${r.memo ? '　メモ：' + xEsc(r.memo) : ''}</div>
    ${r.post_url ? `<div class="x-link">✓ ${xEsc(r.posted_at || '')} 投稿　<a href="${xEsc(r.post_url)}" target="_blank" rel="noopener">Xで見る↗</a></div>` : ''}
    ${btns}
  </div>`;
}
function xHeadHtml(r) {
  const w = r.weighted_length != null ? r.weighted_length : xWeightLocal(r.text + (r.link ? '\n' + r.link : ''));
  return `<div class="x-head"><span class="x-kind">${xEsc(r.kind)}</span><b>${xEsc(xAtLabel(r.at))}</b>
    <span class="x-st x-st-${xEsc(r.status)}">${xEsc(r.status)}</span><span class="mag-dim">${xEsc(r.id)}・${w}字分</span></div>`;
}
// 直す・足す の入力欄（r＝null なら新しく足す）
function xFormHtml(r) {
  const k = r ? r.id : 'new';
  const kindSel = r ? '' : `<label>種類 <select id="xF_kind_${k}">${X_KIND_LIST.map(x => `<option${x === 'お知らせ' ? ' selected' : ''}>${x}</option>`).join('')}</select></label>`;
  return `<div class="x-form">
    <div class="x-form-row">${kindSel}
      <label>予定日時 <input type="datetime-local" id="xF_at_${k}" value="${xEsc(xToInput(r ? r.at : ''))}" oninput="xOnInput('${k}')"></label>
      <span class="mag-dim">空なら次の空いている枠。朝は8:00、夕方は17:00</span></div>
    <label class="x-lbl">本文（リンクは入れない。タイムラインでは最初の2〜3行だけが見えます） <span class="mag-count2" id="xF_n_${k}"></span></label>
    <textarea id="xF_text_${k}" class="x-ta" oninput="xOnInput('${k}')">${xEsc(r ? r.text : '')}</textarea>
    <label class="x-lbl">リンク（本文の下に別の行で付きます。TAKERU・号ページには <code>src=x</code> を付ける）</label>
    <input type="text" id="xF_link_${k}" class="x-in" value="${xEsc(r ? r.link : '')}" oninput="xOnInput('${k}')" placeholder="https://takeru.ms-forum.com/?src=x">
    <label class="x-lbl">メモ（Xには出ません）</label>
    <input type="text" id="xF_memo_${k}" class="x-in" value="${xEsc(r ? r.memo : '')}" oninput="xOnInput('${k}')">
    <div class="x-btns">
      ${r ? `<button class="x-ok" onclick="xSaveEdit('${k}')">💾 保存（状態は${xEsc(r.status)}のまま）</button>
             <button class="dash-refresh" onclick="xCancel('${k}')">やめる</button>`
          : `<button class="x-ok" onclick="xSaveNew(false)">💾 承認待ちとして足す</button>
             <button class="dash-refresh" onclick="xSaveNew(true)">✓ 足して、すぐ承認（待機中）</button>`}
    </div>
    <div id="xF_msg_${k}"></div>
  </div>`;
}
function xVals(k) {
  const g = id => document.getElementById(`xF_${id}_${k}`);
  return { at: xFromInput(g('at').value), text: g('text').value, link: g('link').value.trim(), memo: g('memo').value,
           kind: g('kind') ? g('kind').value : undefined };
}
function xCount(k) {
  const v = xVals(k), n = xWeightLocal(v.text + (v.link ? '\n' + v.link : ''));
  const el = document.getElementById('xF_n_' + k); if (el) el.textContent = `目安 ${n}字分（日本語1字＝2、URL＝23）`;
  return v;
}
function xOnInput(k) {
  if (k === 'new') xEditing = 'new';
  const v = xCount(k);
  try { localStorage.setItem(X_STASH + k, JSON.stringify({ v, at: Date.now() })); } catch (e) {}
}
function xRestore(k) {
  let st = null; try { st = JSON.parse(localStorage.getItem(X_STASH + k) || 'null'); } catch (e) {}
  if (st && st.v) {
    const g = id => document.getElementById(`xF_${id}_${k}`);
    if (g('at')) g('at').value = xToInput(st.v.at); g('text').value = st.v.text || ''; g('link').value = st.v.link || ''; g('memo').value = st.v.memo || '';
    if (st.v.kind && g('kind')) g('kind').value = st.v.kind;
    xMsg(k, true, 'この端末に一時保存してあった直しを戻しました（まだ保存していません）。');
    if (k === 'new') { xEditing = 'new'; const d = document.querySelector('.x-add'); if (d) d.open = true; }
  }
  xCount(k);
}
function xForget(k) { try { localStorage.removeItem(X_STASH + k); } catch (e) {} }
function xMsg(k, ok, t) { const el = document.getElementById('xF_msg_' + k); if (el) el.innerHTML = `<div class="mag-msgbox ${ok ? 'ok' : 'bad'}">${xEsc(t)}</div>`; }

// ---------------- 操作 ----------------
function xEdit(id) {
  if (xEditing && xEditing !== id && xEditing !== 'new' && !confirm('ほかの行を直している途中です（一時保存してあります）。こちらに移りますか？')) return;
  xEditing = id; xRender();
  const el = document.getElementById('xItem_' + id); if (el) el.scrollIntoView({ block: 'start' });
}
function xCancel(k) {
  if (!confirm('直しをやめて、元の文に戻しますか？（一時保存も消します）')) return;
  xForget(k); xEditing = null;
  xLoad(true);   // 食い違いのあとなら、ここで最新を読み直す
  xRender();
}
async function xPost(body) {
  const r = await fetch('/api/x/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
function xWhen(at) {
  if (!at) return '次の空いている枠';
  const t = new Date(at.replace(' ', 'T'));
  return t <= new Date() ? `${xAtLabel(at)}（予定の時刻を過ぎているので、5分以内）` : xAtLabel(at);
}
function xConfirmText(at, text, link) {
  return `この内容で ${xWhen(at)} に、@MSforum01 へ本当に投稿されます。\n\n${String(text).slice(0, 300)}${String(text).length > 300 ? '…' : ''}${link ? '\n' + link : ''}\n\nよろしいですか？`;
}
async function xSaveEdit(id) {
  const r = xItems.find(x => x.id === id); if (!r) return;
  const v = xVals(id);
  if (!v.text.trim()) return xMsg(id, false, '本文が空です。');
  if (r.status === '待機中' && !confirm(xConfirmText(v.at, v.text, v.link))) return;
  xMsg(id, true, '保存しています…');
  const j = await xPost({ op: 'update', id, text: v.text, link: v.link, at: v.at, memo: v.memo, expected_updated: r.updated_at || '' });
  if (!j.ok) return xMsg(id, false, j.conflict ? `${j.error}（${j.updated_at}）。直した文章は残してあります。「やめる」で読み直して、もう一度直してください。` : '保存できませんでした：' + j.error);
  xForget(id); xEditing = null; await xLoad(true); xRender();
}
async function xSaveNew(approve) {
  const v = xVals('new');
  if (!v.text.trim()) return xMsg('new', false, '本文が空です。');
  if (approve && !confirm(xConfirmText(v.at, v.text, v.link))) return;
  xMsg('new', true, '足しています…');
  const j = await xPost({ op: 'add', kind: v.kind, at: v.at, text: v.text, link: v.link, memo: v.memo, status: approve ? '待機中' : '承認待ち' });
  if (!j.ok) return xMsg('new', false, '足せませんでした：' + j.error);
  xForget('new'); xEditing = null; await xLoad(true); xRender();
}
async function xApprove(id) {
  const r = xItems.find(x => x.id === id); if (!r) return;
  if (!confirm(xConfirmText(r.at, r.text, r.link))) return;
  const j = await xPost({ op: 'update', id, status: '待機中', expected_updated: r.updated_at || '' });
  if (!j.ok) { alert(j.conflict ? j.error + '。読み直します。もう一度中身を見てから承認してください。' : '承認できませんでした：' + j.error); }
  await xLoad(true); xRender();
}
async function xHold(id) {
  const r = xItems.find(x => x.id === id); if (!r) return;
  if (!confirm(`${r.id}（${xAtLabel(r.at)}・${r.kind}）を保留にします。保留のあいだは投稿されません。`)) return;
  const j = await xPost({ op: 'update', id, status: '保留', expected_updated: r.updated_at || '' });
  if (!j.ok) alert('保留にできませんでした：' + j.error);
  await xLoad(true); xRender();
}

// 作業台を開いたときに、承認待ちの件数だけ見ておく
setTimeout(xPeek, 1500);
