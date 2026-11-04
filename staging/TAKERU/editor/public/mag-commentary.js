// ============================================================
// 📮マガジン：🔎 解説（ときどき付く欄）2026-10-30
//   GAS v37〜。号の版とは別の「解説」タブに入る（commentary_save）。下書きが無い号にも先に入れられる。
//   出るのは「出す」に印があり、本文が空でないときだけ。位置は「先週の世界の動き」の直後。
//   図は magazine_image（同じ名前で差し替え）。名前は半角英数字と . - _（会員システムの決まり）。
//   資料：D:\ms-common\TAKERUマガジン\26（依頼）・27（Cowork君の返事）・28（会員システムの返事）
// ============================================================
const MAG_CM_NOTE = 'この解説は、TAKERUが各紙の報道をもとにまとめました。';
let magCm = null;   // { issue, show, title, text, note, images, updated }

async function magCmMount(issue) {
  const box = document.getElementById('magCm'); if (!box) return;
  box.innerHTML = '<div class="mag-dim">解説の欄を読み込み中…</div>';
  try {
    const j = await (await fetch('/api/magazine/inputs?issue=' + encodeURIComponent(issue))).json();
    if (!j.ok) throw new Error(j.error || '不明');
    if (!('commentary_show' in j)) { box.innerHTML = '<div class="mag-dim">解説の欄は、GASが v37 以降になると使えます。</div>'; return; }
    magCm = { issue, show: !!j.commentary_show, title: j.commentary_title || '', text: j.commentary_text || '',
              note: j.commentary_note || '', images: j.commentary_images || [], updated: j.commentary_updated_at || '' };
    magCmRender();
  } catch (e) { box.innerHTML = `<div class="qr-warn">解説の欄を読めませんでした：${magEsc(e.message)}</div>`; }
}

function magCmRender() {
  const box = document.getElementById('magCm'); if (!box || !magCm) return;
  const c = magCm, open = c.show || c.text || c.images.length;
  const imgs = c.images.map((x, i) => `
    <div class="mag-cm-img">
      <a href="/api/magazine/image?issue=${encodeURIComponent(c.issue)}&name=${encodeURIComponent(x.name)}" target="_blank" title="押すと原寸で開きます">
        <img src="/api/magazine/image?issue=${encodeURIComponent(c.issue)}&name=${encodeURIComponent(x.name)}" alt=""></a>
      <div class="mag-cm-imgf">
        <div><b>${magEsc(x.name)}</b> <span class="mag-dim">${x.width && x.height ? x.width + '×' + x.height : ''}</span></div>
        <label>説明（caption）<input id="magCmCap_${i}" value="${magEsc(x.caption || '')}"></label>
        <label>写真などのクレジット（credit。撮影者・ライセンス・元の住所。複数行可。号ページに必ず出ます）
          <textarea id="magCmCred_${i}" rows="4">${magEsc(x.credit || '')}</textarea></label>
        <div class="mag-btns">
          <button class="dash-refresh" onclick="magCmImgMeta(${i})">💾 説明とクレジットを保存</button>
          <button class="dash-refresh" onclick="magCmPickFile('${magEsc(x.name)}')">🖼 図を差し替える</button>
          <button class="dash-refresh" onclick="magCmImgRemove(${i})">外す</button></div>
      </div></div>`).join('');
  box.innerHTML = `
    <details class="mag-cm" ${open ? 'open' : ''}>
      <summary>🔎 解説（ときどき付く欄）　${c.show && c.text.trim() ? '<span class="mag-badge mag-st-確認済">この号に出す</span>' : '<span class="mag-dim">出さない</span>'}
        <span class="mag-dim">　「先週の世界の動き」の直後に出ます。号の版とは別に保存します</span></summary>
      <label class="mag-cm-show"><input type="checkbox" id="magCmShow" ${c.show ? 'checked' : ''}> この号に解説を出す
        <span class="hint">（印を外しておけば、下書きしておくだけで、メールにも号ページにも出ません）</span></label>
      <div class="mag-field"><div class="lbl">題 <span class="hint">（見出しは「🔎 解説：題」になります）</span></div>
        <input id="magCmTitle" class="mag-cm-in" value="${magEsc(c.title)}" placeholder="例：イスラエル総選挙のゆくえ"></div>
      <div class="mag-field"><div class="lbl">本文 <span class="hint">（400字前後・です・ます調。空行で段落）</span> <span id="magCmCount" class="mag-count2"></span></div>
        <textarea id="magCmText" class="mid" oninput="magCmCount()">${magEsc(c.text)}</textarea></div>
      <div class="mag-field"><div class="lbl">出典の一行 <span class="hint">（解説の下に出ます。末尾の「ガーディアンの記事をもとに…」とは別です）</span></div>
        <input id="magCmNote" class="mag-cm-in" value="${magEsc(c.note || MAG_CM_NOTE)}"></div>
      <div class="mag-btns"><button class="btn-save" onclick="magCmSave()">💾 解説を保存</button>
        <span class="sub">${c.updated ? '前の保存：' + magEsc(String(c.updated).replace('T', ' ').slice(0, 16)) : 'まだ保存していません'}。
        配信後に直したときは、号の「新しい版として保存」をすると号ページに入ります</span></div>
      <div class="mag-field"><div class="lbl">図 <span class="hint">（PNG・JPEG、1枚2MBまで。メールには付かず、「図はホームページで」と案内します）</span></div>
        ${imgs || '<div class="mag-dim">図はありません</div>'}
        <div class="mag-btns"><button class="dash-refresh" onclick="magCmPickFile('')">＋ 図を足す（ファイルから）</button>
          <button class="dash-refresh" onclick="magCmFromX()">＋ Xで使った図から</button></div>
        <div id="magCmX"></div></div>
      <div id="magCmMsg"></div>
    </details>`;
  magCmCount();
}
function magCmCount() {
  const t = document.getElementById('magCmText'), el = document.getElementById('magCmCount');
  if (t && el) el.textContent = t.value.replace(/\s/g, '').length + '字';
}
function magCmSay(t, ok) { const el = document.getElementById('magCmMsg'); if (el) el.innerHTML = `<div class="mag-msgbox ${ok ? 'ok' : 'bad'}">${magEsc(t)}</div>`; }
async function magCmPost(body) {
  const r = await fetch('/api/magazine/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ issue_date: magCm.issue, ...body }) });
  return r.json();
}

async function magCmSave() {
  const v = { commentary_show: document.getElementById('magCmShow').checked,
    commentary_title: document.getElementById('magCmTitle').value.trim(),
    commentary_text: document.getElementById('magCmText').value.replace(/\s+$/, ''),
    commentary_note: document.getElementById('magCmNote').value.trim() };
  if (v.commentary_show && !v.commentary_text) return magCmSay('「出す」に印がありますが、本文が空です。', false);
  if (v.commentary_show && !v.commentary_title) return magCmSay('「出す」に印がありますが、題が空です。', false);
  magCmSay('保存しています…', true);
  const j = await magCmPost({ mode: 'commentary_save', ...v, expected_updated: magCm.updated });
  if (!j.ok) return magCmSay('保存できませんでした：' + (j.error || '') + '（ほかで直されたときは、読み直してから直してください）', false);
  await magCmMount(magCm.issue);
  magCmSay(v.commentary_show ? '保存しました。この号に解説が出ます。' : '保存しました（出さない設定です）。', true);
}

// 図：ファイルから（name を渡すと、その名前で差し替え）
function magCmPickFile(name) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (!/^image\/(png|jpeg)$/.test(f.type)) return magCmSay('PNG か JPEG にしてください', false);
    if (f.size > 2 * 1024 * 1024) return magCmSay('2MBを超えています（' + (f.size / 1024 / 1024).toFixed(1) + 'MB）。縮めてから入れてください', false);
    let nm = name;
    if (!nm) {
      const ext = f.type === 'image/png' ? '.png' : '.jpg';
      let base = f.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
      if (!/[A-Za-z0-9]/.test(base)) base = 'fig' + (magCm.images.length + 1);
      nm = (prompt('図の名前（半角英数字と . - _ だけ。同じ名前の図は差し替えになります）', base + ext) || '').trim();
      if (!nm) return;
      if (!/^[A-Za-z0-9._-]{1,80}$/.test(nm)) return magCmSay('名前は半角英数字と . - _ だけにしてください', false);
    }
    const old = magCm.images.find(x => x.name === nm) || {};
    magCmSay('図を送っています…（大きい図は少しかかります）', true);
    const j = await magCmPost({ mode: 'magazine_image', name: nm, mime: f.type, base64: await magCmB64(f),
      caption: old.caption || '', credit: old.credit || '' });
    if (!j.ok) return magCmSay('送れませんでした：' + (j.error || ''), false);
    await magCmMount(magCm.issue);
    magCmSay(name ? '図を差し替えました。' : '図を足しました。説明とクレジットを入れて「保存」してください。', true);
  };
  inp.click();
}
function magCmB64(blob) {
  return new Promise((ok, ng) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = ng; r.readAsDataURL(blob); });
}

// 説明・クレジットだけ直す：いまの図を読み戻して、同じ名前で送り直す（図はそのまま）
async function magCmImgMeta(i) {
  const x = magCm.images[i]; if (!x) return;
  magCmSay('保存しています…', true);
  try {
    const r = await fetch(`/api/magazine/image?issue=${encodeURIComponent(magCm.issue)}&name=${encodeURIComponent(x.name)}`);
    if (!r.ok) throw new Error('いまの図を読めませんでした');
    const blob = await r.blob();
    const j = await magCmPost({ mode: 'magazine_image', name: x.name, mime: x.mime || blob.type, base64: await magCmB64(blob),
      caption: document.getElementById('magCmCap_' + i).value.trim(), credit: document.getElementById('magCmCred_' + i).value.replace(/\s+$/, '') });
    if (!j.ok) throw new Error(j.error || '');
    await magCmMount(magCm.issue);
    magCmSay('説明とクレジットを保存しました。', true);
  } catch (e) { magCmSay('保存できませんでした：' + e.message, false); }
}
async function magCmImgRemove(i) {
  const x = magCm.images[i]; if (!x || !confirm(`図「${x.name}」を外します。よろしいですか？（Driveのファイルはごみ箱へ）`)) return;
  const j = await magCmPost({ mode: 'magazine_image', name: x.name, remove: true });
  if (!j.ok) return magCmSay('外せませんでした：' + (j.error || ''), false);
  await magCmMount(magCm.issue);
  magCmSay('図を外しました。', true);
}

// Xで使った図から（X用GASとマガジンGASは同じアカウントなので、DriveのファイルIDで写せる）
async function magCmFromX() {
  const box = document.getElementById('magCmX');
  box.innerHTML = '<div class="mag-dim">Xの投稿を読み込み中…</div>';
  const from = new Date(Date.now() - 60 * 86400000);
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  try {
    const j = await (await fetch('/api/x/list?from=' + ymd(from))).json();
    const rows = (j.items || []).filter(r => (r.images || []).length).reverse();
    if (!rows.length) { box.innerHTML = '<div class="mag-dim">この60日のXの投稿に、図の付いたものはありません。</div>'; return; }
    box.innerHTML = `<div class="mag-cm-xlist"><div class="mag-dim">足したい図を選んでください（↗で中身を確かめられます）</div>
      ${rows.map(r => r.images.map((fid, i) => `<div>
        <button class="dash-refresh" onclick="magCmAddX('${magEsc(fid)}','${magEsc(r.id)}',${i})">これを足す</button>
        <a href="https://drive.google.com/file/d/${encodeURIComponent(fid)}/view" target="_blank" rel="noopener">↗</a>
        <span class="mag-dim">${magEsc(r.id)}（${magEsc(String(r.at || '').replace('T', ' ').slice(0, 16))}）${i + 1}枚目：</span>${magEsc(String(r.text || '').replace(/\s+/g, ' ').slice(0, 50))}…</div>`).join('')).join('')}
      <button class="dash-refresh" onclick="document.getElementById('magCmX').innerHTML=''">閉じる</button></div>`;
  } catch (e) { box.innerHTML = `<div class="qr-warn">読み込めませんでした：${magEsc(e.message)}</div>`; }
}
async function magCmAddX(fid, xid, i) {
  const nm = (prompt('図の名前（半角英数字と . - _ だけ。拡張子は元の図に合わせて .png か .jpg）', `${xid}_${i + 1}.png`.replace(/[^A-Za-z0-9._-]/g, '_')) || '').trim();
  if (!nm) return;
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(nm)) return magCmSay('名前は半角英数字と . - _ だけにしてください', false);
  magCmSay('Xの図を写しています…', true);
  const j = await magCmPost({ mode: 'magazine_image', name: nm, from_file_id: fid, caption: '', credit: '' });
  if (!j.ok) return magCmSay('写せませんでした：' + (j.error || ''), false);
  await magCmMount(magCm.issue);
  magCmSay('図を足しました。説明とクレジットを入れて「保存」してください。', true);
}
