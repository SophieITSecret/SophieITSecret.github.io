// ============================================================
// 📮 TAKERUマガジン（状況・入力・プレビュー・実績）
//   資料：D:\ms-common\TAKERUマガジン\（19＝10/6の追記、20＝10/7の追記その2、21＝作業台への依頼）
//   ・状態の判定（済み・遅れ・やること）は全部 GAS（magazine_dashboard）がする。ここでは並べるだけ
//   ・書き込みは作業台のサーバー（/api/magazine/save）経由。トークンは画面に渡さない
//   ・版を変える書き込みには必ず expected_version を付ける（Cowork君の書き直しとの取り違え防止）
//   ・配信前の直しは update_latest（上書き。版は増えない）。大きく直したときは new_version
//   ・入力中の文章は端末に一時保存（閉じても残る）。保存に失敗しても入力を消さない
// ============================================================
let magIssue = '';          // いま見ている号（空＝GASが決める「いま注目すべき号」）
let magTabName = 'status';
let magDash = null;         // magazine_dashboard の返事
let magDoc = null;          // magazine_latest の返事（入力・プレビューで使う）
let magTimer = null;
let magLastOkAt = null;
const MAG_SUMMARY_MIN = 480, MAG_SUMMARY_MAX = 520;
const MAG_FIELDS = ['summary', 'schedule', 'trivia', 'notice'];
const MAG_STASH = 'takeru.mag.stash.';     // ＋号の日付。入力中の文章の一時保存

function magEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function magChars(t) { return String(t || '').replace(/\s/g, '').length; }
function magHm(d) { const p = n => String(n).padStart(2, '0'); return `${d.getHours()}:${p(d.getMinutes())}`; }
function magDateLabel(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return iso || '';
  const w = '日月火水木金土'[new Date(+m[1], +m[2] - 1, +m[3]).getDay()];
  return `${+m[2]}月${+m[3]}日（${w}）`;
}

// ---------------- 開く・閉じる・タブ ----------------
function openMag() {
  document.getElementById('magModal').style.display = 'flex';
  magTab(magTabName);
  magStartTimer();
}
function closeMag() {
  if (magTabName === 'edit' && magEditDirty() && !confirm('保存していない直しがあります（この端末には一時保存してあります）。閉じますか？')) return;
  document.getElementById('magModal').style.display = 'none';
  clearInterval(magTimer); magTimer = null;
}
function magTab(name) {
  if (magTabName === 'edit' && name !== 'edit') magStashNow();
  magTabName = name;
  document.querySelectorAll('.mag-tabs button').forEach(b => b.classList.toggle('on', b.dataset.mtab === name));
  if (name === 'status') magLoadDash();
  else if (name === 'edit') magLoadDoc(true);
  else if (name === 'preview') magLoadDoc(false).then(magRenderPreview);
  else if (name === 'history') magLoadDash().then(magRenderHistory);
}
function magPickIssue(v) {
  if (magTabName === 'edit' && magEditDirty()) magStashNow();
  magIssue = v; magDoc = null;
  // 入力・プレビューでも、先にその号の状況を読む（下書きが無い号なら、本文を取りに行かずに先置きの画面にできる）
  if (magTabName === 'edit' || magTabName === 'preview') { magWaiting('号を切り替えています…'); magLoadDash(true).then(() => magTab(magTabName)); }
  else magTab(magTabName);
}
// 開いている間は60秒ごとに状況を取り直す（状況タブのときだけ。入力中は邪魔しない）
function magStartTimer() {
  clearInterval(magTimer);
  magTimer = setInterval(() => { if (magTabName === 'status') magLoadDash(true); }, 60000);
}
function magSetUpdated(ok, msg) {
  const el = document.getElementById('magUpdated'); if (!el) return;
  if (ok) { magLastOkAt = new Date(); el.textContent = `最終更新 ${magHm(magLastOkAt)}`; el.classList.remove('bad'); }
  else { el.textContent = `更新できませんでした（${magLastOkAt ? magHm(magLastOkAt) + 'の内容' : '内容なし'}）${msg ? '：' + msg : ''}`; el.classList.add('bad'); }
}
// 号を指定して dashboard を読むと、selectable_issues がその号だけになる（2026-10-08 確認）。
//   そのまま入れ替えると、ほかの号へ戻れなくなるので、一度見えた号は残して足し合わせる。
//   「注目」の印は、号を指定しないで読んだときの返事だけで決める
let magIssueList = [];
function magFillIssueSel(list, base) {
  const sel = document.getElementById('magIssueSel'); if (!sel || !Array.isArray(list)) return;
  const byDate = new Map(magIssueList.map(x => [x.issue_date, x]));
  for (const x of list) {
    const old = byDate.get(x.issue_date);
    byDate.set(x.issue_date, { ...x, focus: base ? !!x.focus : !!(old && old.focus) });
  }
  if (base) for (const [k, x] of byDate) if (!list.some(y => y.issue_date === k)) byDate.set(k, { ...x, focus: false });
  magIssueList = [...byDate.values()].sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date)));
  list = magIssueList;
  sel.innerHTML = list.map(x => `<option value="${magEsc(x.issue_date)}">${magEsc(magDateLabel(x.issue_date))}号${x.label ? '　' + magEsc(x.label) : ''}${x.focus ? '（注目）' : ''}</option>`).join('');
  sel.value = magIssue || (list.find(x => x.focus) || list[0] || {}).issue_date || '';
}

// ---------------- 状況 ----------------
async function magLoadDash(quiet, tries = 2) {
  const pane = document.getElementById('magPane');
  if (!quiet && !magDash) magWaiting('状況を読み込み中…');
  try {
    const j = await (await fetch('/api/magazine/dashboard' + (magIssue ? '?issue=' + encodeURIComponent(magIssue) : ''))).json();
    if (!j.ok) throw new Error(j.error || '不明');
    if (magDoc && magDoc.issue_date === j.focus_issue && (!!magDoc.pre) === !!(j.issue && j.issue.exists)) magDoc = null;   // 先置き⇔初版が入れ替わった
    magDash = j; magSetUpdated(true);
    magFillIssueSel(j.selectable_issues, !magIssue);
    magWaitEnd();
    if (magTabName === 'status') magRenderStatus();
    return j;
  } catch (e) {
    // GASは時々一時的に404や空を返す。前の表示を残し、少し待って取り直す
    magSetUpdated(false, e.message);
    if (!magDash && magTabName === 'status') pane.innerHTML = `<p class="qr-warn">状況を読み込めませんでした：${magEsc(e.message)}。数秒後にもう一度試します。</p>`;
    if (tries > 0) { await new Promise(r => setTimeout(r, 5000)); return magLoadDash(true, tries - 1); }
    return magDash;
  }
}
const MAG_SEC_WORD = { ok: ['●', '入っている'], pending: ['…', 'これから自動で入る'], partial: ['◐', '一部だけ入っている'],
                       empty: ['－', 'なし（この欄はメールに出ません）'], todo: ['！', '未入力（牧村さんの入力待ち）'] };
const MAG_TODO_IC = { todo: '▶', done: '✓', wait: '○', na: '－' };
const MAG_STEP = { done: ['✓', '済'], upcoming: ['○', 'これから'], passed: ['・', '時刻は過ぎた'], late: ['⚠', '遅れ'], not_run: ['－', '試験号：まだ記録がありません'] };
function magRenderStatus() {
  const d = magDash, pane = document.getElementById('magPane'); if (!d) return;
  const is = d.issue || {};
  const warns = (d.alerts || []).filter(a => a.level === 'warn'), infos = (d.alerts || []).filter(a => a.level !== 'warn');
  const band = `
    <div class="mag-band">
      <div class="row">
        ${is.is_test ? `<span class="mag-test">試験号　${magEsc(is.label || '')}</span>` : ''}
        <span class="mag-date">${magEsc(magDateLabel(d.focus_issue))}号</span>
        ${is.exists ? `<span class="mag-badge mag-st-${magEsc(is.status)}">${magEsc(is.status)}</span><span>版 ${is.version}</span>` : '<span class="mag-dim">まだ下書きがありません</span>'}
      </div>
      ${is.stamp_text ? `<div class="mag-dim">配信文の最後に付く表示：<b>${magEsc(is.stamp_text)}</b></div>` : ''}
      ${warns.map(a => `<div class="mag-alert">⚠ ${magEsc(a.text)}</div>`).join('') || '<div class="mag-okline">いまのところ異常はありません</div>'}
      ${infos.map(a => `<div class="mag-alert info">ℹ ${magEsc(a.text)}</div>`).join('')}
    </div>`;
  const todo = `<div class="mag-h3">牧村さんのやること</div><ul class="mag-list mag-todo">${(d.todo || []).map(t => `
      <li class="${magEsc(t.state)}" ${t.state === 'todo' ? `onclick="magGoInput('${magEsc(t.key)}')" title="押すと入力へ"` : ''}>
        <span class="ic">${MAG_TODO_IC[t.state] || '・'}</span>
        <div><div class="t">${magEsc(t.label)}</div><div class="d">${magEsc(t.due_label || '')}${t.detail ? '　' + magEsc(t.detail) : ''}${t.state === 'done' ? '　（済）' : ''}</div></div>
      </li>`).join('') || '<li><span class="ic">✓</span><div class="t">いまはありません</div></li>'}</ul>`;
  const secs = `<div class="mag-h3">配信文の5つの欄</div><ul class="mag-list mag-sec">${(d.sections || []).map(s => {
      const w = MAG_SEC_WORD[s.state] || ['・', s.state];
      return `<li class="${magEsc(s.state)}"><span class="ic">${w[0]}</span><div><div class="t">${magEsc(s.label)}：${w[1]}</div>${s.detail ? `<div class="d">${magEsc(s.detail)}</div>` : ''}</div></li>`;
    }).join('')}</ul>`;
  const next = (d.steps || []).find(s => s.id === d.next_step);
  const nextHtml = next ? `<div class="mag-h3">次に起きること</div><div class="mag-next">${magEsc(next.when_label)}　${magEsc(next.who)}：${magEsc(next.what)}</div>` : '';
  const steps = `<div class="mag-h3">今後の段取り</div><ul class="mag-list mag-steps">${(d.steps || []).map(s => {
      const w = MAG_STEP[s.state] || ['・', s.state];
      return `<li class="${magEsc(s.state)}${s.id === d.next_step ? ' next' : ''}${s.mine ? ' mine' : ''}"><span class="ic" title="${w[1]}">${w[0]}</span>
        <div><div class="t">${magEsc(s.when_label)}　${magEsc(s.who)}：${magEsc(s.what)}</div><div class="d">${w[1]}${s.detail ? '　' + magEsc(s.detail) : ''}</div></div></li>`;
    }).join('')}</ul>`;
  const sched = (d.upcoming_schedule || []).length ? `<div class="mag-h3">これからの重要日程</div><table class="mag-small-table">${d.upcoming_schedule.map(x =>
      `<tr><td>${magEsc(magDateLabel(x.date))}${x.end_date ? '〜' + magEsc(magDateLabel(x.end_date)) : ''}</td><td>${magEsc(x.text)}</td><td class="mag-dim">${magEsc(x.kind)}</td></tr>`).join('')}</table>` : '';
  const ups = (d.upcoming_issues || []).length ? `<div class="mag-h3">今後の号</div><table class="mag-small-table">${d.upcoming_issues.map(x =>
      `<tr><td>${magEsc(magDateLabel(x.issue_date))}号</td><td>${x.has_draft ? `下書きあり（版${x.version}・${magEsc(x.status)}）` : '<span class="mag-dim">まだ下書きなし</span>'}</td></tr>`).join('')}</table>` : '';
  pane.innerHTML = `${d.mock ? '<p class="qr-warn">【試験用の見本モード】</p>' : ''}${band}${todo}${secs}${nextHtml}${steps}${sched}${ups}
    <div class="mag-btns"><button class="dash-refresh" onclick="magLoadDash()">↻ 今すぐ取り直す</button><span class="sub">開いている間は60秒ごとに自動で取り直します</span></div>`;
}
function magGoInput(key) {
  magTab('edit');
  const id = { notice: 'magF_notice', schedule: 'magF_schedule', trivia: 'magF_trivia', summary: 'magF_summary', confirm: 'magBtnOk' }[key];
  setTimeout(() => { const el = id && document.getElementById(id); if (el) { el.scrollIntoView({ block: 'center' }); el.focus && el.focus(); } }, 900);
}

// ---------------- 入力 ----------------
// GASの返事は数秒〜1分ほどばらつく（2026-10-07 に 60秒・101秒を確認）。待っているあいだは秒数を出して、
//   止まっているのではないとわかるようにする
let magWaitTimer = null;
function magWaiting(text) {
  const pane = document.getElementById('magPane'), t0 = Date.now();
  clearInterval(magWaitTimer);
  const draw = () => { const sec = Math.round((Date.now() - t0) / 1000);
    pane.innerHTML = `<p class="qr-empty">${magEsc(text)}　GASの返事を待っています（${sec}秒）${sec >= 20 ? '<br>GASが混んでいると1分ほどかかることがあります。そのままお待ちください。' : ''}</p>`; };
  draw(); magWaitTimer = setInterval(draw, 1000);
}
function magWaitEnd() { clearInterval(magWaitTimer); magWaitTimer = null; }
async function magLoadDoc(render, tries = 2) {
  const issue = magIssue || (magDash && magDash.focus_issue) || '';
  // 一度読んだ号は覚えておく（タブを行き来するたびに読み直さない）。読み直しは保存のあとと号の切り替え
  if (magDoc && magDoc.issue_date === issue) { if (render) magRenderEdit(); return magDoc; }
  // 状況ボードで「まだ下書きが無い」とわかっている号は、本文を取りに行かずに先置きの画面にする
  const di = magDash && magDash.focus_issue === issue ? magDash.issue : null;
  if (di && !di.exists) {
    const inp = di.inputs || {};
    magDoc = { pre: true, issue_date: issue, version: 0, notice: inp.notice || '', trivia: inp.trivia || '',
               updated_at: inp.updated_at || '', is_test: !!di.is_test, issue_label: di.label || '', mock: magDash.mock };
    if (render) magRenderEdit();
    return magDoc;
  }
  if (render) magWaiting('下書きを読み込み中…');
  try {
    const j = await (await fetch('/api/magazine' + (issue ? '?issue=' + encodeURIComponent(issue) : ''))).json();
    if (!j.ok && j.error !== 'no magazine draft') throw new Error(j.error || '不明');
    magDoc = j.ok && (!issue || j.issue_date === issue) ? j : null;
    if (!magDoc && issue) {
      // 下書きがまだ無い号：お知らせ・ご存知ですかは「先置き」できる（GAS v27 issue_inputs。初版が自動で拾う）
      const p = await (await fetch('/api/magazine/inputs?issue=' + encodeURIComponent(issue))).json();
      if (!p.ok) throw new Error(p.error || '不明');
      if (!p.has_draft) magDoc = { pre: true, issue_date: issue, version: 0, notice: p.notice || '', trivia: p.trivia || '',
        updated_at: p.updated_at || '', is_test: !!(di && di.is_test), issue_label: (di && di.label) || '', mock: p.mock };
    }
    magWaitEnd();
    if (render) magRenderEdit();
    return magDoc;
  } catch (e) {
    if (tries > 0) { await new Promise(r => setTimeout(r, 4000)); return magLoadDoc(render, tries - 1); }
    magWaitEnd();
    if (render) document.getElementById('magPane').innerHTML = `<p class="qr-warn">読み込めませんでした：${magEsc(e.message)}　<button class="dash-refresh" onclick="magDoc=null;magTab('edit')">もう一度</button></p>`;
    return null;
  }
}
function magStashKey() { return MAG_STASH + (magDoc ? magDoc.issue_date : ''); }
function magEditValues() {
  const v = {}; for (const k of MAG_FIELDS) { const el = document.getElementById('magF_' + k); if (el) v[k] = el.value; } return v;
}
function magEditDirty() {
  if (!magDoc) return false;
  const v = magEditValues(); return MAG_FIELDS.some(k => v[k] !== undefined && v[k] !== String(magDoc[k] || ''));
}
function magStashNow() {
  if (!magDoc) return;
  try {
    if (magEditDirty()) localStorage.setItem(magStashKey(), JSON.stringify({ version: magDoc.version, at: Date.now(), v: magEditValues() }));
    else localStorage.removeItem(magStashKey());
  } catch (e) { /* 端末に置けなくても入力は続けられる */ }
}
function magRenderEdit() {
  const pane = document.getElementById('magPane'), m = magDoc;
  if (!m) { pane.innerHTML = '<p class="qr-warn">この号の下書きはまだありません（金曜20:50ごろに初版ができます）。</p>'; return; }
  if (m.pre) return magRenderPre();
  const ro = m.status === '配信済';
  const field = (k, label, hint, cls) => `
    <div class="mag-field"><div class="lbl">${label} <span class="hint">${hint}</span>${k === 'summary' || k === 'notice' ? ` <span id="magC_${k}" class="mag-count2"></span>` : ''}</div>
      <textarea id="magF_${k}" class="${cls}" oninput="magOnInput('${k}')" ${ro ? 'readonly' : ''}>${magEsc(m[k] || '')}</textarea></div>`;
  const src = Array.isArray(m.sources) && m.sources.length
    ? `<details class="mag-interp"><summary>根拠（文ごとの元記事・${m.sources.length}件）</summary><ol class="mag-src">${m.sources.map(x =>
        `<li><div class="mag-src-point">${magEsc(x.point || '')}</div><a href="${magEsc(x.url || '')}" target="_blank" rel="noopener">${magEsc(x.title || x.url || '')}</a></li>`).join('')}</ol></details>` : '';
  const interp = (() => { const s = String(m.reason || ''); const i = s.indexOf('解釈メモ'); return i < 0 ? '' : s.slice(i); })();
  pane.innerHTML = `
    ${m.mock ? '<p class="qr-warn">【試験用の見本モード】GASには書き込みません。</p>' : ''}
    <div class="mag-band"><div class="row">
      ${m.is_test ? `<span class="mag-test">試験号　${magEsc(m.issue_label || '')}</span>` : ''}
      <span class="mag-date">${magEsc(magDateLabel(m.issue_date))}号</span>
      <span class="mag-badge mag-st-${magEsc(m.status)}">${magEsc(m.status)}</span><span>版 ${m.version}</span>
      <span class="mag-dim">対象 ${magEsc(m.period || '')}</span></div>
      <div class="mag-dim">配信文の最後に付く表示：<b>${magEsc(m.stamp_text || '')}</b></div>
      ${String(m.check_note || '').startsWith('【要確認】') ? `<div class="mag-alert">⚠ ${magEsc(m.check_note)}</div>` : (m.check_note ? `<div class="mag-dim">${magEsc(m.check_note)}</div>` : '')}
      ${m.reject_note ? `<div class="mag-alert info">差し戻しのメモ：${magEsc(m.reject_note)}</div>` : ''}
      ${ro ? '<div class="mag-alert info">配信済の号です。ここでは直せません（配信後の小さな直しは「新しい版として保存」で行います）。</div>' : ''}
    </div>
    <div id="magStashNote"></div>
    ${field('trivia', 'ご存知ですか', '（空で保存＝この欄はメールに出ません）', 'mid')}
    ${ro ? '' : '<div class="mag-btns"><button class="dash-refresh" onclick="magAddCardLink()">🔗 カードのリンクを足す</button><span class="sub">元になったカードのコード（例 YOKO07）を入れると、欄の最後にTAKERUのカードへのリンクを足します</span></div>'}
    ${field('summary', '先週の世界の動き', `（目安 ${MAG_SUMMARY_MIN}〜${MAG_SUMMARY_MAX}字・改行と空白を除く）`, 'big')}
    <p id="magSrcWarn" class="mag-warn" hidden>本文を直しました。根拠は、直す前の文に対するものです。</p>
    ${src}
    ${interp ? `<details class="mag-interp"><summary>解釈メモ（筆者の読みが入った文）</summary><div class="mag-pre">${magEsc(interp)}</div></details>` : ''}
    <div class="mag-field"><div class="lbl">マーケット動向 <span class="hint">（自動。直せません。空ならメールに出ません）</span></div>
      <div class="readonly">${m.market ? magEsc(m.market) + '\n' + magEsc(m.market_note || '') : '<span class="mag-dim">まだ入っていません（土曜7時ごろ自動で入ります）</span>'}</div></div>
    ${field('schedule', '今週以降の主要日程', '（自動で入ります。直したいときだけ直す。空で保存＝この欄はメールに出ません）', 'mid')}
    ${ro ? '' : '<div class="mag-btns"><button class="dash-refresh" onclick="magScheduleAuto()">↺ 日程を自動に戻す</button><span class="sub">確認済・配信済の号には効きません</span></div>'}
    ${field('notice', 'MSフォーラムからのお知らせ', '（牧村さんが書く欄。空で保存＝この欄はメールに出ません）', 'mid')}
    <div class="mag-btns">
      ${ro ? `<button class="btn-load" onclick="magSaveNewVersion(true)">💾 配信後の小さな直しとして、新しい版で保存</button>`
           : `<button class="btn-save" onclick="magSaveOver()">💾 上書き保存</button>
              <button class="btn-load" onclick="magSaveNewVersion(false)" title="大きく直したとき。前の版は残る">新しい版として保存</button>
              <button class="btn-publish" id="magBtnOk" onclick="magSetStatus('確認済')" ${m.status === '確認済' ? 'disabled' : ''}>✅ 確認済にする</button>
              <button class="dash-refresh" onclick="magSetStatus('下書き')" ${m.status !== '確認済' ? 'disabled' : ''}>差し戻す（下書きに戻す）</button>`}
      <button class="dash-refresh" onclick="magTab('preview')">👁 プレビュー</button>
    </div>
    <div id="magMsgBox"></div>`;
  if (ro) { for (const k of MAG_FIELDS) { const el = document.getElementById('magF_' + k); if (el) el.removeAttribute('readonly'); } }
  magAfterRenderEdit();
}
function magAfterRenderEdit() {
  // 前に入れかけていた文章が端末に残っていれば戻すか聞く
  try {
    const st = JSON.parse(localStorage.getItem(magStashKey()) || 'null');
    if (st && MAG_FIELDS.some(k => st.v[k] !== undefined && st.v[k] !== String(magDoc[k] || ''))) {
      const when = new Date(st.at);
      document.getElementById('magStashNote').innerHTML = `<div class="mag-alert info">この端末に、${when.getMonth() + 1}月${when.getDate()}日 ${magHm(when)} に入れかけた文章が残っています（版${st.version}のとき）。
        <button class="dash-refresh" onclick="magRestoreStash()">入れかけの文章に戻す</button>
        <button class="dash-refresh" onclick="magDropStash()">捨てる</button></div>`;
    }
  } catch (e) { /* noop */ }
  for (const k of ['summary', 'notice', 'trivia']) magCountUp(k);
  magGrow2();
}
function magRestoreStash() {
  try { const st = JSON.parse(localStorage.getItem(magStashKey())); for (const k of MAG_FIELDS) { const el = document.getElementById('magF_' + k); if (el && st.v[k] !== undefined) el.value = st.v[k]; } } catch (e) {}
  document.getElementById('magStashNote').innerHTML = '';
  for (const k of MAG_FIELDS) magOnInput(k);
}
function magDropStash() { try { localStorage.removeItem(magStashKey()); } catch (e) {} document.getElementById('magStashNote').innerHTML = ''; }
function magCountUp(k) {
  const el = document.getElementById('magC_' + k), f = document.getElementById('magF_' + k); if (!el || !f) return;
  const n = magChars(f.value);
  if (k === 'summary') { el.textContent = `${n}字`; el.classList.toggle('out', n < MAG_SUMMARY_MIN || n > MAG_SUMMARY_MAX); }
  else el.textContent = n ? `${n}字` : '（空＝欄なし）';
}
function magGrow2() {
  for (const k of MAG_FIELDS) { const t = document.getElementById('magF_' + k); if (!t) continue; t.style.height = 'auto'; t.style.height = (t.scrollHeight + 4) + 'px'; }
}
let magStashTimer = null;
function magOnInput(k) {
  magCountUp(k); magGrow2();
  if (k === 'summary' && document.getElementById('magSrcWarn')) document.getElementById('magSrcWarn').hidden = document.getElementById('magF_summary').value === String(magDoc.summary || '');
  clearTimeout(magStashTimer); magStashTimer = setTimeout(magStashNow, 800);
}
function magMsg(text, ok) {
  const el = document.getElementById('magMsgBox'); if (!el) { if (!ok) alert(text); return; }
  el.innerHTML = `<div class="mag-msgbox ${ok ? 'ok' : 'bad'}">${magEsc(text)}</div>`;
}
async function magPost(body) {
  const r = await fetch('/api/magazine/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_date: magDoc.issue_date, expected_version: magDoc.version, ...body }) });
  return r.json();
}
function magFail(j) {
  // 失敗しても入力は消さない（端末にも一時保存してある）
  magStashNow();
  if (/版が変わっています/.test(j.error || ''))
    magMsg('別の画面で更新されたか、Cowork君が書き直したため、保存しませんでした。入力した文章はこの端末に残してあります。「状況」か号を選び直して読み直し、「入れかけの文章に戻す」で続けてください。（' + j.error + '）', false);
  else magMsg('保存できませんでした：' + (j.error || '不明') + '。入力した文章はこの端末に残してあります。', false);
}
async function magAfterSave(text) {
  try { localStorage.removeItem(magStashKey()); } catch (e) {}
  const wasPre = magDoc && magDoc.pre, issue = magDoc && magDoc.issue_date;
  magDoc = null;
  if (wasPre) { await magLoadDash(true); if (magDash && magDash.focus_issue !== issue) magDash = null; }
  await magLoadDoc(true);
  magMsg(text, true);
  magLoadDash(true);
}
// 上書き保存：直した欄だけを update_latest で送る（版は増えない）
async function magSaveOver() {
  const v = magEditValues(), body = { mode: 'update_latest' };
  let n = 0; for (const k of MAG_FIELDS) if (v[k] !== String(magDoc[k] || '')) { body[k] = v[k]; n++; }
  if (!n) { magMsg('直したところがありません。', true); return; }
  magMsg('保存しています…', true);
  const j = await magPost(body);
  if (!j.ok) return magFail(j);
  magAfterSave(`上書き保存しました（版${magDoc.version}・${n}か所）。`);
}
// 新しい版として保存：大きく直したとき／配信後の小さな直し（status は配信済のまま）
async function magSaveNewVersion(afterSent) {
  const v = magEditValues();
  let reason = '牧村さんが作業台で添削（新しい版）';
  if (afterSent) {
    const what = prompt('配信後の小さな直しです。何を直したか、ひとことで（記録に残ります。HPには出ません）', '誤字の修正');
    if (what === null) return;
    reason = '配信後の小修正：' + what;
    if (!confirm('新しい版を「配信済」で保存します。HPの号ページはこの版で作り直されます。メールは再送しません。よろしいですか？')) return;
  }
  magMsg('保存しています…', true);
  const j = await magPost({ mode: 'new_version', status: afterSent ? '配信済' : '下書き', reason, ...v });
  if (!j.ok) return magFail(j);
  magAfterSave(`新しい版（版${j.version || '?'}）として保存しました。`);
}
// 確認済にする／差し戻す。直したまま押したら、先に上書き保存してから状態を変える
async function magSetStatus(st) {
  const v = magEditValues(), body = { mode: 'update_latest', status: st };
  let n = 0; for (const k of MAG_FIELDS) if (v[k] !== String(magDoc[k] || '')) { body[k] = v[k]; n++; }
  let msg = st === '確認済' ? `版${magDoc.version}を確認済にします。土曜8:00にこの版が送られます。` : `版${magDoc.version}を下書きに戻します。`;
  if (n) msg += `\n直した${n}か所も一緒に保存します。`;
  if (st === '下書き') {
    const note = prompt(msg + '\n差し戻す理由があれば（空でも可）', '');
    if (note === null) return;
    if (note) body.reject_note = note;
  } else if (!confirm(msg + '\nよろしいですか？')) return;
  magMsg('保存しています…', true);
  const j = await magPost(body);
  if (!j.ok) return magFail(j);
  magAfterSave(st === '確認済' ? '確認済にしました。' : '下書きに戻しました。');
}
async function magScheduleAuto() {
  if (!confirm('主要日程を、自動で作った内容に戻します（今の欄の内容は置き換わります）。よろしいですか？')) return;
  magMsg('日程を組み直しています…', true);
  const j = await magPost({ mode: 'schedule_apply' });
  if (!j.ok) return magFail(j);
  magAfterSave('日程を自動の内容に戻しました。');
}

// ---------------- プレビュー（メールに載る形） ----------------
//   会員システム担当から受け取った組み立ての規則（2026-10-07）と同じものを作る。ここと実際のメールが違わないことが大事。
//   件名：【TAKERUマガジン】2026年10月10日号（試験号は末尾に「（テスト）」）
//   本文：「TAKERUマガジン　2026年10月10日号」／「ＭＳフォーラムがお届けする、軍事と戦略の週刊マガジンです。」／空行
//         （事務局の画面でその号に添える一言を書いてあれば：その文、空行 ← 作業台からは見えない）
//         各欄「■ 見出し」→空行→本文→（添え：空行→添え）→空行。空の欄は見出しごと出さない
//           ご存知ですか／先週の世界の動き（period）＋添え「（stamp_text）」／マーケット動向＋添え market_note／主要日程／お知らせ（10/10号から）
//         「根拠の記事つきの全文は、こちらでもお読みいただけます：」＋号ページのURL（試験号は test-YYYYMMDD.html）
//         末尾（会員システムが付ける）：発行・お問い合わせ・バックナンバー・読者ごとの配信停止リンク。宛名は付けない
function magIssueJa(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[1]}年${+m[2]}月${+m[3]}日号` : iso; }
function magMailSubject(m) { return `【TAKERUマガジン】${magIssueJa(m.issue_date)}${m.is_test ? '（テスト）' : ''}`; }
// 2026-10-08 版の規則（会員システム担当から。テキストメール・Cowork君のレイアウト案 22/23）：
//   ━×20／「TAKERUマガジン　2026年10月10日号」／試験号は次の行に「（第0号（試験））」／キャッチ／━×20／※stamp_text／空行
//   各欄：絵文字＋半角空白＋見出し／─×20／本文（加工しない）／（市況だけ 空行＋market_note、空行＋「チャートはTAKERUで見られます：」＋URL）／空行・空行
//   見出し：💡 ご存知ですか？／🌐 先週の世界の動き（9月26日〜10月2日）／📈 マーケット動向／📅 今週以降の主要日程／📢 MSフォーラムからのお知らせ
//   号ページ：「本稿の「世界の動き」は、」「英ガーディアン紙の記事をもとに、」「TAKERUがまとめています。」「元になった記事はこちらでご覧ください。」＋URL（単独の行）（10/8 牧村さん、順を入れ替え）
//   末尾：会員システムが付ける（URLはすべて単独の行）。固定の行はすべて全角23字以内
const MAG_RULE = '━'.repeat(20), MAG_LINE = '─'.repeat(20);
const MAG_MARKET_URL = 'https://takeru.ms-forum.com/?view=market';
function magPeriodJa(p) {
  return String(p || '').replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, mo, d) => `${+mo}月${+d}日`);
}
function magBuildMail(m, v) {
  const out = [MAG_RULE, `TAKERUマガジン　${magIssueJa(m.issue_date)}`];
  if (m.is_test && m.issue_label) out.push(`（${m.issue_label}）`);
  out.push('ＭＳフォーラムの軍事と戦略、週刊メルマガ', MAG_RULE);
  if (m.stamp_text) out.push('※' + m.stamp_text);
  out.push('');
  const sec = (title, body, add) => {
    if (!body || !String(body).trim()) return;
    out.push(title, MAG_LINE, String(body).replace(/\s+$/, ''));
    if (add) out.push('', add);
    out.push('', '');
  };
  // 並び：ご存知ですか → 先週の世界の動き → マーケット動向 → 今週以降の主要日程 → お知らせ（section_order）
  sec('💡 ご存知ですか？', v.trivia);
  sec(`🌐 先週の世界の動き${m.period ? '（' + magPeriodJa(m.period) + '）' : ''}`, v.summary);
  // 市況の下に、TAKERUのマーケット画面へのリンク（10/8 牧村さん。URLは単独の行）
  sec('📈 マーケット動向', m.market, [m.market_note, 'チャートはTAKERUで見られます：\n' + MAG_MARKET_URL].filter(Boolean).join('\n\n'));
  sec('📅 今週以降の主要日程', v.schedule);
  sec('📢 MSフォーラムからのお知らせ', v.notice);
  const ymd = String(m.issue_date).replace(/-/g, '');
  // 号ページへの案内（10/8 牧村さん：出典の3行を先に、そのあと号ページ）
  out.push('本稿の「世界の動き」は、', '英ガーディアン紙の記事をもとに、', 'TAKERUがまとめています。',
    '元になった記事はこちらでご覧ください。', `https://ms-forum.com/mailmag/${m.is_test ? 'test-' : ''}${ymd}.html`,
    '', MAG_RULE, 'TAKERUマガジン（ＭＳフォーラムのメルマガ）', '発行：一般社団法人ＭＳフォーラム',
    '発行者について：', 'https://ms-forum.com/about.html', 'お問い合わせ：support@ms-forum.com',
    'バックナンバー：', 'https://ms-forum.com/mailmag/', '',
    '配信停止（このアドレスだけ止まります）：', '（読者ごとの停止のURLが入ります）',
    '会員の方へ：メルマガを止めても、', '講座や事務局のご連絡は届きます。', MAG_RULE);
  return out.join('\n');
}
function magRenderPreview() {
  const pane = document.getElementById('magPane'), m = magDoc;
  if (!m) { pane.innerHTML = '<p class="qr-warn">この号を読み込めませんでした。入力タブを開き直してください。</p>'; return; }
  // 初版の前（先置き）：入れたご存知ですか・お知らせだけで組み立て、Cowork君が入れる欄は「（初版で入ります）」と出す
  const PRE_FILL = '（金曜20:50ごろ、Cowork君の初版で入ります）';
  let mm = m;
  if (m.pre) {
    const d0 = new Date(m.issue_date + 'T00:00:00'), ymd = n => { const d = new Date(d0); d.setDate(d.getDate() + n);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    mm = { ...m, period: `${ymd(-7)}〜${ymd(-1)}`, market: PRE_FILL, market_note: '', stamp_text: '' };
  }
  // 入力タブで直しかけの文章があれば、それで組み立てる（保存前でも見られるように）
  let v = { summary: m.pre ? PRE_FILL : m.summary, schedule: m.pre ? PRE_FILL : m.schedule, trivia: m.trivia, notice: m.notice }, fromStash = false;
  try { const st = JSON.parse(localStorage.getItem(magStashKey()) || 'null'); if (st && st.v) { v = { ...v, ...st.v }; fromStash = true; } } catch (e) {}
  if (m.pre) { if (!String(v.summary || '').trim()) v.summary = PRE_FILL; if (!String(v.schedule || '').trim()) v.schedule = PRE_FILL; }
  pane.innerHTML = `
    ${m.pre ? '<p class="qr-warn">この号の初版はまだです（金曜20:50ごろにできます）。いま見えているのは、先に入れたご存知ですか・お知らせと、メールの形だけです。</p>' : ''}
    ${m.is_test ? `<div class="mag-band"><span class="mag-test">試験号　${magEsc(m.issue_label || '')}</span></div>` : ''}
    <p class="mag-dim">メールに載る形です（空の欄は見出しごと省きます）。${fromStash ? '<b>まだ保存していない直しも入れて組み立てています。</b>' : ''}
      会員システムの組み立ての規則（10/7）と同じ形です。</p>
    <div class="mag-dim">件名：<b>${magEsc(magMailSubject(m))}</b></div>
    <p class="mag-dim">※事務局の「メルマガ」画面で、その号に添える一言を書いた場合は、※の行のあとに入ります（作業台からは見えません）。</p>
    <div class="mag-mail">${magEsc(magBuildMail(mm, v))}</div>
    <div class="mag-btns"><button class="dash-refresh" onclick="magTab('edit')">✎ 入力に戻る</button></div>`;
}

// ---------------- 実績 ----------------
async function magRenderHistory() {
  const pane = document.getElementById('magPane'), d = magDash;
  if (!d) { pane.innerHTML = '<p class="qr-warn">読み込めませんでした。</p>'; return; }
  const st = d.stats || {};
  const rows = (d.history || []).map(h => `
    <tr class="mag-hist-row" onclick="magHistDetail('${magEsc(h.issue_date)}')">
      <td>${magEsc(magDateLabel(h.issue_date))}号${h.is_test ? ' <span class="mag-chip">試験</span>' : ''}</td>
      <td>${h.mail ? `${magEsc((h.mail.at || '').replace('T', ' ').slice(5, 16))}<br>${h.mail.count}通${h.mail.failed ? `（失敗${h.mail.failed}）` : ''}` : '<span class="mag-dim">記録なし</span>'}</td>
      <td>${h.hp && h.hp.url ? `<a href="${magEsc(h.hp.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">ページ↗</a>` : '<span class="mag-dim">記録なし</span>'}</td>
      <td>${h.summary_chars || 0}字・版${h.final_version}</td>
      <td><span class="mag-chip ${h.market_count ? '' : 'off'}">市況</span><span class="mag-chip ${h.schedule_lines ? '' : 'off'}">日程</span><span class="mag-chip ${h.has_trivia ? '' : 'off'}">ご存知</span><span class="mag-chip ${h.has_notice ? '' : 'off'}">お知らせ</span></td>
      <td>${(h.post_fixes || 0) + (h.corrections || 0) + (h.hp_fixes || 0) ? `直し${h.post_fixes || 0}・訂正${h.corrections || 0}・HP${h.hp_fixes || 0}` : '－'}</td>
    </tr>`).join('');
  pane.innerHTML = `
    <div class="mag-band"><div class="row"><span>送った号 <b>${st.issues_sent || 0}</b></span><span>本文の平均 <b>${st.avg_chars || 0}</b>字</span><span>配信後の直しの合計 <b>${st.total_post_fixes || 0}</b></span><span class="mag-dim">（試験号は数えません）</span></div></div>
    ${rows ? `<table class="mag-small-table"><tr><th>号</th><th>メール</th><th>HP</th><th>本文</th><th>欄</th><th>配信後</th></tr>${rows}</table>`
           : '<p class="mag-dim">まだ送った号はありません（10月10日の第1号から記録されます）。</p>'}
    <div id="magHistDetail"></div>`;
}
async function magHistDetail(issue) {
  const box = document.getElementById('magHistDetail');
  box.innerHTML = '<p class="qr-empty">読み込み中…</p>';
  try {
    const [l, dl, m] = await Promise.all([
      fetch('/api/magazine/list').then(r => r.json()),
      fetch('/api/magazine/deliveries?issue=' + encodeURIComponent(issue)).then(r => r.json()),
      fetch('/api/magazine?issue=' + encodeURIComponent(issue)).then(r => r.json())]);
    const vers = (l.rows || []).filter(r => r.issue_date === issue);
    box.innerHTML = `
      <div class="mag-h3">${magEsc(magDateLabel(issue))}号の詳細</div>
      <div class="mag-h3">送信・公開の記録</div>
      ${(dl.rows || []).length ? `<table class="mag-small-table">${dl.rows.map(r => `<tr><td>${magEsc((r.at || '').replace('T', ' ').slice(0, 16))}</td><td>${magEsc(r.kind)}</td><td>${magEsc(r.result)}</td><td>${r.count != null ? r.count + '通' : ''}${r.failed ? '（失敗' + r.failed + '）' : ''}</td><td>${r.url ? `<a href="${magEsc(r.url)}" target="_blank" rel="noopener">↗</a>` : ''}</td><td>${magEsc(r.note || '')}</td></tr>`).join('')}</table>` : '<p class="mag-dim">記録なし</p>'}
      <div class="mag-h3">版の一覧</div>
      ${vers.length ? `<ul class="mag-vers">${vers.map(r => `<li>版${r.version}・${magEsc(r.status)}・${r.summary_chars}字<span>${magEsc(r.reason || '')}</span></li>`).join('')}</ul>` : '<p class="mag-dim">なし</p>'}
      <div class="mag-h3">配信された本文（最新の版）</div>
      ${m.ok ? `<div class="mag-mail">${magEsc(magBuildMail(m, m))}</div>` : '<p class="mag-dim">読めませんでした</p>'}`;
  } catch (e) { box.innerHTML = `<p class="qr-warn">読み込めませんでした：${magEsc(e.message)}</p>`; }
}

// ---------------- 下書きがまだ無い号：先置き ----------------
function magRenderPre() {
  const pane = document.getElementById('magPane'), m = magDoc;
  const f = (k, label, hint) => `
    <div class="mag-field"><div class="lbl">${label} <span class="hint">${hint}</span> <span id="magC_${k}" class="mag-count2"></span></div>
      <textarea id="magF_${k}" class="mid" oninput="magOnInput('${k}')">${magEsc(m[k] || '')}</textarea></div>`;
  pane.innerHTML = `
    ${m.mock ? '<p class="qr-warn">【試験用の見本モード】GASには書き込みません。</p>' : ''}
    <div class="mag-band"><div class="row">
      ${m.is_test ? `<span class="mag-test">試験号　${magEsc(m.issue_label || '')}</span>` : ''}
      <span class="mag-date">${magEsc(magDateLabel(m.issue_date))}号</span><span class="mag-dim">まだ下書きがありません</span></div>
      <div>下書き（先週の世界の動き）は、金曜20:50ごろに自動でできます。<b>お知らせ欄と「ご存知ですか」は、いま先に入れておけます。</b>
        初版ができたとき、自動で中に入ります。</div>
      ${m.updated_at ? `<div class="mag-dim">先に入れた内容があります（${magEsc(String(m.updated_at).replace('T', ' ').slice(0, 16))}）</div>` : ''}
    </div>
    <div id="magStashNote"></div>
    ${f('trivia', 'ご存知ですか', '（空で保存＝この欄はメールに出ません）')}
    <div class="mag-btns"><button class="dash-refresh" onclick="magAddCardLink()">🔗 カードのリンクを足す</button><span class="sub">元になったカードのコード（例 YOKO07）を入れると、欄の最後にTAKERUのカードへのリンクを足します</span></div>
    ${f('notice', 'MSフォーラムからのお知らせ', '（空で保存＝この欄はメールに出ません）')}
    <div class="mag-btns"><button class="btn-save" onclick="magSavePre()">💾 先に入れておく（保存）</button>
      <span class="sub">主要日程とマーケットは、初版と土曜朝に自動で入ります</span></div>
    <div id="magMsgBox"></div>`;
  magAfterRenderEdit();
}
async function magSavePre() {
  const v = magEditValues(), body = { mode: 'issue_inputs' };
  let n = 0; for (const k of ['notice', 'trivia']) if (v[k] !== String(magDoc[k] || '')) { body[k] = v[k]; n++; }
  if (!n) { magMsg('直したところがありません。', true); return; }
  magMsg('保存しています…', true);
  const j = await magPost(body);
  if (!j.ok) return magFail(j);
  magAfterSave(`先に入れておきました（${n}か所）。金曜の夜に初版ができたら、自動で中に入ります。`);
}

// ---------------- ご存知ですか：TAKERUのカードへのリンク ----------------
//   2026-10-08 牧村さんの決定。欄の最後に「この記事の関連カードをTAKERUで読む：」と専用リンク（?card=コード）を足す。
//   メールではURLを必ず単独の行に置く決まり（全角の「）」「。」がリンクに入ると開けなくなる）なので、2行に分ける。
//   公開していないカードは、リンクを開いてもトップから始まってしまうので、確かめてから足す。
async function magAddCardLink() {
  const t = document.getElementById('magF_trivia'); if (!t) return;
  const code = (prompt('元になったカードのコード（例 YOKO07）', '') || '').trim().toUpperCase();
  if (!code) return;
  let item = null;
  try { const j = await (await fetch('/api/card-link?code=' + encodeURIComponent(code))).json(); if (j.ok) item = j.item; } catch (e) {}
  if (!item) { alert(`「${code}」というカードが見つかりません。作業台の左の一覧で、カードのコードを確かめてください。`); return; }
  if (!item.published && !confirm(`「${item.title}」は、まだ公開していないカードです。リンクを開いてもトップから始まってしまいます。それでも足しますか？`)) return;
  // 前に足したリンクがあれば置き換える（1つだけにする）
  let v = t.value.replace(/\n*(?:このカード|この記事の関連カード)をTAKERUで読む：\nhttps:\/\/takeru\.ms-forum\.com\/\?card=[A-Za-z0-9]+\s*$/, '').replace(/\s+$/, '');
  t.value = v + (v ? '\n\n' : '') + 'この記事の関連カードをTAKERUで読む：\n' + item.url;
  magOnInput('trivia');
  magMsg(`「${item.title}」へのリンクを足しました。保存すると入ります。`, true);
}
