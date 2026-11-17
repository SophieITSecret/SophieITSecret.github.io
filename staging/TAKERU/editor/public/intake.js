// ============================================================
// 📥 搬入（自由研究の原稿の受け取り）2026-11-17  サーバーは editor/intake.js
//   講座は作業台で立てる（＋ 新しい講座）。ソフィーは 受付\<講座名>\<テーマ名>\ にテーマごとに入れる。
//   テーマを確かめ・下見し、CSV へ未公開で入れる。合わなければ差し戻す。
//   図はここ（ブラウザ）で 960×720 の JPEG にしてから送る（画像の画面と同じやり方）。
// ============================================================
const ik = { list: null, sel: null, item: null };   // sel: {course, theme} か {course, edit:true} か {newCourse:true}
const ikEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function ikGet(p) { return (await fetch('/api/intake/' + p)).json(); }
async function ikPost(p, b) { return (await fetch('/api/intake/' + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json(); }
function ikToast(t, bad) {
  const el = document.getElementById('ikToast'); if (!el) return;
  el.textContent = t; el.className = 'dk-toast ' + (bad ? 'bad' : 'ok'); el.style.display = 'block';
  clearTimeout(ikToast.t); ikToast.t = setTimeout(() => { el.style.display = 'none'; }, bad ? 9000 : 4500);
}
const ikQ = (c, t) => 'course=' + encodeURIComponent(c) + '&theme=' + encodeURIComponent(t);

async function openIntake() {
  document.getElementById('intakeModal').style.display = 'flex';
  await ikLoad();
}
function closeIntake() { document.getElementById('intakeModal').style.display = 'none'; }

// ---------------- 左の欄：講座と受付 ----------------
async function ikLoad() {
  const j = await ikGet('list');
  const side = document.getElementById('ikSide');
  if (!j.ok) { side.innerHTML = `<p class="qr-warn">読めませんでした：${ikEsc(j.error)}</p>`; return; }
  ik.list = j;
  if (j.missing) { side.innerHTML = `<p class="qr-warn">置き場がありません：<br>${ikEsc(j.root)}</p>`; document.getElementById('ikBody').innerHTML = ''; return; }
  const on = (c, t) => ik.sel && ik.sel.course === c && ik.sel.theme === t ? 'on' : '';
  side.innerHTML = `<div class="ik-root" title="${ikEsc(j.root)}">置き場：${ikEsc(j.root)}</div>
    <button class="dash-refresh ik-new" onclick="ikCourseForm()">＋ 新しい講座</button>` +
    (j.courses.length ? j.courses.map(c => `
      <div class="ik-course">
        <div class="ik-cname ${ik.sel && ik.sel.edit && ik.sel.course === c.name ? 'on' : ''}" data-c="${ikEsc(c.name)}" onclick="ikCourseForm(this.dataset.c)" title="押すと講座の情報を見る・直す">
          📚 ${ikEsc(c.name)}<span class="ik-sub">　${ikEsc(c.author)}・${ikEsc(c.prefix)}・${c.cardCount}枚（公開${c.published}）</span></div>
        ${(c.changes || []).map(ch => `<div class="ik-item ik-change ${ik.sel && ik.sel.change && ik.sel.course === c.name && ik.sel.folder === ch.folder ? 'on' : ''}" data-c="${ikEsc(c.name)}" data-f="${ikEsc(ch.folder)}" onclick="ikOpenChange(this.dataset.c, this.dataset.f)">
            <div class="ik-name">🖼 直しが来ています：${ikEsc(ch.theme)}</div>
            <div class="ik-sub">${ch.images.length ? `図 ${ch.images.map(x => ikEsc(x.code)).join('・')}` : ''}${ch.images.length && ch.texts.length ? '／' : ''}${ch.texts.length ? '題・本文' : ''}</div>
          </div>`).join('')}
        ${c.inbox.length ? c.inbox.map(t => `<div class="ik-item ${on(c.name, t.theme)}" data-c="${ikEsc(c.name)}" data-t="${ikEsc(t.theme)}" onclick="ikOpen(this.dataset.c, this.dataset.t)">
            <div class="ik-name">${t.errors.length ? '⚠️' : '✅'} ${ikEsc(t.theme)}</div>
            <div class="ik-sub">${t.count || 0}枚${t.range ? '・' + ikEsc(t.range) : ''}${t.replace ? '・出し直し' : ''}${t.errors.length ? `・直し ${t.errors.length}件` : ''}${t.warnings.length ? `・注意 ${t.warnings.length}件` : ''}</div>
          </div>`).join('') : '<div class="ik-empty">受付は空です</div>'}
      </div>`).join('') : '<p class="qr-empty">講座がまだありません。「＋ 新しい講座」から立ててください。</p>') +
    (j.stray.length ? `<div class="ik-errs">講座の立っていないフォルダが受付にあります：${j.stray.map(ikEsc).join('、')}<br>講座を立てるか、正しい講座のフォルダへ移してください。</div>` : '') +
    `<div class="ik-h">取り込み済み（新しい順）</div>` + (j.done.length ? j.done.map(n => `<div class="ik-past">${ikEsc(n)}</div>`).join('') : '<p class="qr-empty">まだありません</p>') +
    `<div class="ik-h">差し戻し（新しい順）</div>` + (j.back.length ? j.back.map(n => `<div class="ik-past">${ikEsc(n)}</div>`).join('') : '<p class="qr-empty">まだありません</p>');
  // 開いていたものを開き直す
  const s = ik.sel;
  const c = s && j.courses.find(x => x.name === s.course);
  if (s && s.change && c && (c.changes || []).some(x => x.folder === s.folder)) ikOpenChange(s.course, s.folder);
  else if (s && s.theme && c && c.inbox.some(t => t.theme === s.theme)) await ikOpen(s.course, s.theme);
  else if (s && s.edit && c) ikCourseForm(s.course);
  else if (s && s.newCourse) ikCourseForm();
  else { ik.sel = null; ik.item = null; document.getElementById('ikBody').innerHTML = '<p class="qr-empty">左の受付からテーマを1つ選んでください。新しい講座は「＋ 新しい講座」から立てます。形の決まりは置き場の「搬入の決まり.md」にあります。</p>'; }
}

// ---------------- 講座を立てる・直す ----------------
function ikCourseForm(name) {
  const c = name ? (ik.list.courses.find(x => x.name === name) || null) : null;
  ik.sel = c ? { course: c.name, edit: true } : { newCourse: true }; ik.item = null;
  document.querySelectorAll('.ik-item').forEach(e => e.classList.remove('on'));
  document.querySelectorAll('.ik-cname').forEach(e => e.classList.toggle('on', !!c && e.dataset.c === c.name));
  const locked = c && c.cardCount > 0;
  const f = (id, label, val, ph, help, ro) => `<label class="ik-f"><span>${label}</span>
      <input id="${id}" value="${ikEsc(val || '')}" placeholder="${ikEsc(ph)}" ${ro ? 'readonly' : ''}>${help ? `<small>${help}</small>` : ''}</label>`;
  document.getElementById('ikBody').innerHTML = `
    <h3 class="ik-ftitle">${c ? '📚 講座の情報' : '＋ 新しい講座を立てる'}</h3>
    ${c ? `<div class="ik-note">CSV に ${c.cardCount}枚（公開 ${c.published}枚）。入ったテーマ：${ikEsc(c.themes.join('・') || 'まだありません')}</div>` : ''}
    <div class="ik-form">
      ${f('ikCName', '講座名', c && c.name, '例：宇田川敬介の歴史の中の戦争解説', 'アプリの自由研究の見出しになります（著者名を含めてください）。受付のフォルダの名前にもなります。あとから変えられます')}
      ${f('ikCAuthor', '著者', c && c.author, '例：宇田川敬介', 'カードの「著者」欄に入ります', locked)}
      ${f('ikCPrefix', 'コードの頭', c && c.prefix, '例：UDG', '英大文字2〜8字。カードのコードは「頭＋番号」（UDG01, UDG02…）。専用リンク ?study=頭 は講座の最初のテーマを開きます', locked)}
      ${f('ikCTags', '研究テーマ', c && c.tags, '例：歴史;戦争', 'アプリの「テーマから」の分け方。いくつか書くときは ; で区切ります')}
      ${f('ikCSource', '出典の書き方', c && c.source, '例：『SSRI Monthly』', 'カードの本文の最後に「（出典：著者＋これ＋台帳の号）」の1行が付きます。空なら付けません')}
    </div>
    ${locked ? '<div class="ik-note">カードが入っているので、著者とコードの頭は変えられません（講座名は変えられます）。</div>' : ''}
    <div class="ik-actions"><button class="btn-save" onclick="ikCourseSave(${c ? 'true' : 'false'})">${c ? '💾 講座の情報を直す' : '＋ この講座を立てる'}</button></div>`;
  document.getElementById('ikCPrefix').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });
}
async function ikCourseSave(edit) {
  const v = id => document.getElementById(id).value.trim();
  const b = { name: v('ikCName'), author: v('ikCAuthor'), prefix: v('ikCPrefix'), tags: v('ikCTags'), source: v('ikCSource') };
  if (edit) b.original = ik.sel.course;
  else if (!confirm(`講座「${b.name}」（${b.author}・頭 ${b.prefix}）を立てます。受付に「${b.name}」のフォルダができます。よろしいですか？`)) return;
  const r = await ikPost('course', b);
  if (!r.ok) { ikToast(r.error, true); return; }
  ikToast((edit ? '講座の情報を直しました' : `講座「${r.course.name}」を立てました。受付\\${r.course.name}\\ にテーマを入れてもらえます`) + (r.warnings.length ? '。' + r.warnings.join('。') : ''), r.warnings.length > 0 && edit);
  ik.sel = { course: r.course.name, edit: true };
  await ikLoad();
}

// ---------------- テーマを開く ----------------
async function ikOpen(course, theme) {
  const j = await ikGet('item?' + ikQ(course, theme));
  if (!j.ok) { ikToast(j.error, true); return; }
  ik.sel = { course, theme }; ik.item = j;
  document.querySelectorAll('.ik-item').forEach(e => e.classList.toggle('on', e.dataset.c === course && e.dataset.t === theme));
  document.querySelectorAll('.ik-cname').forEach(e => e.classList.remove('on'));
  const ci = j.courseInfo;
  const img = c => c.image ? `<img class="ik-thumb" src="/api/intake/image?${ikQ(course, theme)}&file=${encodeURIComponent(c.image)}" alt="">` : '<div class="ik-thumb ik-noimg">図なし</div>';
  document.getElementById('ikBody').innerHTML = `
    <div class="ik-meta">
      <div class="ik-crumb">📚 ${ikEsc(ci.name)}　›　<b>${ikEsc(theme)}</b>　${j.count}枚</div>
      <div class="ik-note">著者：${ikEsc(ci.author)}　頭：${ikEsc(ci.prefix)}　研究テーマ：${ikEsc(ci.tags || '—')}　講座のカード：今 ${j.courseCount}枚</div>
      <div>振るコード：<b>${ikEsc(j.range || '—')}</b>${j.replace ? '（出し直し。前のコードを使い回します）' : ''}</div>
    </div>
    ${j.errors.length ? `<div class="ik-errs"><b>直しが要るところ（このままでは取り込めません）</b><ul>${j.errors.map(e => `<li>${ikEsc(e)}</li>`).join('')}</ul></div>` : ''}
    ${j.warnings.length ? `<div class="ik-warns"><b>注意（取り込みはできます）</b><ul>${j.warnings.map(e => `<li>${ikEsc(e)}</li>`).join('')}</ul></div>` : ''}
    ${j.replace ? `<div class="ik-warns">このテーマのカードが、もう ${j.replace.count}枚 CSV にあります（${ikEsc(j.replace.codes.join('、'))}。うち公開 ${j.replace.published}枚）。取り込むと入れ替わります。公開の印は残ります。</div>` : ''}
    <div class="ik-actions">
      <button class="btn-save" ${j.errors.length ? 'disabled' : ''} onclick="ikImport(${j.replace ? 'true' : 'false'})">${j.replace ? '⚠ 置き換えて取り込む' : '📥 CSVへ未公開で取り込む'}</button>
      <input id="ikReason" class="ik-reason" placeholder="差し戻す理由（自動で見つけた問題は、書かなくても添えます）">
      <button class="btn-cancel" onclick="ikReturn()">↩ 差し戻す</button>
    </div>
    <table class="ik-table"><tr><th>コード</th><th>部</th><th>題・本文の頭</th><th>図</th></tr>
      ${j.cards.map(c => `<tr><td>${ikEsc(c.code)}${c.reuse ? '<div class="ik-sub">使い回し</div>' : ''}</td><td>${ikEsc(c.part || '')}</td>
        <td><div class="ik-title">${c.no}. ${ikEsc(c.title)}</div><div class="ik-body">${ikEsc(String(c.body).slice(0, 120))}${c.body.length > 120 ? '…' : ''}</div>
            <div class="ik-sub">${c.len}字${c.sourceLine ? '・最後に ' + ikEsc(c.sourceLine) : ''}</div></td>
        <td>${img(c)}<div class="ik-sub">${c.imgW ? `${c.imgW}×${c.imgH}` : ''}</div></td></tr>`).join('')}
    </table>`;
}

// ---------------- 取り込んだ後の直し（2026-11-18） ----------------
//   取り込み済みのフォルダで差し替えられた図を、今のカードの図と並べて見せる。押せば差し替える
function ikOpenChange(course, folder) {
  const c = ik.list.courses.find(x => x.name === course);
  const ch = c && (c.changes || []).find(x => x.folder === folder);
  if (!ch) { ik.sel = null; ikLoad(); return; }
  ik.sel = { course, folder, change: true }; ik.item = null;
  document.querySelectorAll('.ik-item').forEach(e => e.classList.toggle('on', e.dataset.c === course && e.dataset.f === folder));
  document.querySelectorAll('.ik-cname').forEach(e => e.classList.remove('on'));
  const q = `course=${encodeURIComponent(course)}&folder=${encodeURIComponent(folder)}`;
  const t = Date.now();
  document.getElementById('ikBody').innerHTML = `
    <div class="ik-meta"><div class="ik-crumb">📚 ${ikEsc(course)}　›　<b>${ikEsc(ch.theme)}</b>　の直し</div>
      <div class="ik-note">取り込んだ後に、置き場（取り込み済み\\${ikEsc(course)}\\${ikEsc(folder)}）で差し替えられたファイルです。</div></div>
    ${ch.images.map(x => `
      <div class="ik-chg">
        <div class="ik-chg-h"><b>${ikEsc(x.code)}</b>　${ikEsc(x.file)}</div>
        <div class="ik-chg-row">
          <figure><img src="/api/images/${encodeURIComponent(x.code)}.jpg?t=${t}" alt=""><figcaption>いまのカードの図</figcaption></figure>
          <div class="ik-chg-arrow">→</div>
          <figure><img src="/api/intake/done-image?${q}&file=${encodeURIComponent(x.file)}&t=${t}" alt=""><figcaption>新しい図</figcaption></figure>
        </div>
        <div class="ik-actions">
          <button class="btn-save" onclick="ikReplaceImage('${ikEsc(x.file)}','${ikEsc(x.code)}', this)">🖼 この図に差し替える</button>
          <button class="btn-cancel" onclick="ikSkipImage('${ikEsc(x.file)}')">差し替えない</button>
        </div>
      </div>`).join('')}
    ${ch.texts.length ? `
      <div class="ik-warns"><b>題や本文が直されています</b>（${ch.texts.map(ikEsc).join('・')}）<br>
        「受付へ戻す」を押すと、このテーマのフォルダが受付に戻ります。そのあと、受付のテーマを開いて「⚠ 置き換えて取り込む」を押してください。テーマ全体（題・本文・図）が、置き場の原稿の形で入り直します（上の図の差し替えは、しなくてもかまいません）。
        <div class="ik-actions"><button class="btn-save" onclick="ikReopen()">↩ 受付へ戻す</button></div></div>` : ''}`;
}
async function ikReplaceImage(file, code, btn) {
  const s = ik.sel; if (!s || !s.change) return;
  if (!confirm(`${code} の図を、${file} に差し替えます。今の図は控えに残ります。よろしいですか？`)) return;
  if (btn) { btn.disabled = true; btn.textContent = '差し替えています…'; }
  try {
    const image = await ikToJpeg(`/api/intake/done-image?course=${encodeURIComponent(s.course)}&folder=${encodeURIComponent(s.folder)}&file=${encodeURIComponent(file)}`);
    const r = await ikPost('replace-image', { course: s.course, folder: s.folder, file, image });
    if (!r.ok) throw new Error(r.error);
    ikToast(`${r.code} の図を差し替えました（前の図は控えに残しました）。カードの画面で見るときは「🔄 再読み込み」を押してください`);
    await ikLoad();
  } catch (e) {
    ikToast('差し替えられませんでした：' + e.message, true);
    if (btn) { btn.disabled = false; btn.textContent = '🖼 この図に差し替える'; }
  }
}
async function ikSkipImage(file) {
  const s = ik.sel; if (!s || !s.change) return;
  if (!confirm(`${file} は差し替えずに、一覧から外します。よろしいですか？`)) return;
  const r = await ikPost('skip-image', { course: s.course, folder: s.folder, file });
  if (!r.ok) { ikToast(r.error, true); return; }
  await ikLoad();
}
async function ikReopen() {
  const s = ik.sel; if (!s || !s.change) return;
  if (!confirm('このテーマのフォルダを受付へ戻します。そのあと「置き換えて取り込む」で入れ直してください。よろしいですか？')) return;
  const r = await ikPost('reopen', { course: s.course, folder: s.folder });
  if (!r.ok) { ikToast(r.error, true); return; }
  ikToast(`受付へ戻しました。左の「${r.theme}」を開いて「⚠ 置き換えて取り込む」を押してください`);
  ik.sel = { course: s.course, theme: r.theme };
  await ikLoad();
}

// 図を 960×720 の JPEG に（伸び縮みさせる。白で下地を塗ってから描く）
function ikToJpeg(url) {
  return new Promise((ok, ng) => {
    const im = new Image();
    im.onload = () => {
      const cv = document.createElement('canvas'); cv.width = 960; cv.height = 720;
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 960, 720); cx.drawImage(im, 0, 0, 960, 720);
      ok(cv.toDataURL('image/jpeg', typeof IMG_JPEG_QUALITY === 'number' ? IMG_JPEG_QUALITY : 0.9));
    };
    im.onerror = () => ng(new Error('図が読めませんでした'));
    im.src = url;
  });
}

async function ikImport(replace) {
  const j = ik.item, s = ik.sel; if (!j || !s || !s.theme) return;
  const drop = j.replace && j.replace.drop.length ? `\n${j.replace.drop.join('、')} は CSV から外れます${j.replace.dropPublished.length ? '（公開中のものを含みます）' : ''}。` : '';
  if (!confirm(`「${s.course}」のテーマ「${s.theme}」${j.count}枚を、${j.range} として CSV に未公開で入れます。${replace ? '\n同じテーマの前のカードと入れ替わります。' : ''}${drop}\nよろしいですか？`)) return;
  const btn = document.querySelector('.ik-actions .btn-save'); if (btn) { btn.disabled = true; btn.textContent = '図を変換しています…'; }
  try {
    const images = {};
    for (const c of j.cards) images[c.no] = await ikToJpeg(`/api/intake/image?${ikQ(s.course, s.theme)}&file=${encodeURIComponent(c.image)}`);
    if (btn) btn.textContent = '取り込んでいます…';
    const r = await ikPost('import', { course: s.course, theme: s.theme, replace: !!replace, images });
    if (!r.ok) throw new Error(r.error);
    ikToast(`${r.codes.length}枚を取り込みました（${r.codes[0]}〜${r.codes[r.codes.length - 1]}・未公開）。フォルダは「取り込み済み」の ${r.movedTo} へ。カードの画面を読み直します`);
    ik.sel = null; ik.item = null;
    await ikLoad();
    if (typeof reload === 'function') reload();
  } catch (e) {
    ikToast('取り込めませんでした：' + e.message, true);
    if (btn) { btn.disabled = false; btn.textContent = replace ? '⚠ 置き換えて取り込む' : '📥 CSVへ未公開で取り込む'; }
  }
}

async function ikReturn() {
  const s = ik.sel; if (!s || !s.theme) return;
  const reason = document.getElementById('ikReason').value.trim();
  if (!confirm(`「${s.course}」のテーマ「${s.theme}」を差し戻します。理由を書いたファイルを添えて「差し戻し」へ移します。よろしいですか？`)) return;
  const r = await ikPost('return', { course: s.course, theme: s.theme, reason });
  if (!r.ok) { ikToast(r.error, true); return; }
  ikToast(`差し戻しました（「差し戻し」の ${r.movedTo}）。ソフィーには提出箱か伝言で知らせてください`);
  ik.sel = null; ik.item = null;
  await ikLoad();
}
