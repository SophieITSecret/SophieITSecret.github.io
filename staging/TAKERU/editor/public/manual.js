// ============================================================
// 📖 使い方（作業台のマニュアル）2026-11-17 牧村さんの希望  サーバーは server.js の getManual
//   章は editor/manual/*.md（Obsidian・Claude Code でそのまま直せる）。開くたびに読む。
//   制作デスクの章は public/desk-help.js の dkhSections()（11/17 にデスクの中から、ここへ移した）。
//   搬入の章の <!-- intake-rules --> の所に、置き場の「搬入の決まり.md」（ソフィー向け）をその場で読んで足す。
//   md は、見出し・段落・箇条書き（入れ子）・番号付き・表・引用・コードの囲み・太字・`コード`・リンクだけを扱う。
// ============================================================
const mn = { items: [], cur: '' };
const DESK_CH = { name: 'desk', title: '制作デスク' };
const mnEsc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function mnToast(t, bad) {
  const el = document.getElementById('mnToast'); if (!el) return;
  el.textContent = t; el.className = 'dk-toast ' + (bad ? 'bad' : 'ok'); el.style.display = 'block';
  clearTimeout(mnToast.t); mnToast.t = setTimeout(() => { el.style.display = 'none'; }, bad ? 8000 : 3000);
}

// 章を開く。name は md の名前（例 '03_搬入'）か、頭の言葉（'搬入'）か 'desk'
async function openManual(name) {
  document.getElementById('manualModal').style.display = 'flex';
  try {
    const j = await (await fetch('/api/manual/list')).json();
    mn.items = j.ok ? j.items.slice() : [];
  } catch (e) { mn.items = []; }
  // 制作デスクの章は、カードの基本作業の後ろに置く
  const at = mn.items.findIndex(x => /カードの基本作業/.test(x.name));
  mn.items.splice(at >= 0 ? at + 1 : mn.items.length, 0, DESK_CH);
  const want = name ? mn.items.find(x => x.name === name || x.name.replace(/^\d+_/, '') === name) : null;
  await mnShow((want || mn.items[0] || DESK_CH).name);
}
function closeManual() { document.getElementById('manualModal').style.display = 'none'; }

async function mnShow(name) {
  mn.cur = name;
  document.getElementById('mnToc').innerHTML = mn.items.map(x =>
    `<a href="#" class="mn-toc-i ${x.name === name ? 'on' : ''}" onclick="mnShow('${mnEsc(x.name).replace(/'/g, '&#39;')}'); return false;">${mnEsc(x.title)}</a>`).join('');
  const body = document.getElementById('mnBody');
  if (body.parentElement) body.parentElement.scrollTop = 0;   // 流れるのは外側の枠（.dk-main）
  if (name === 'desk') {
    // 制作デスクの使い方（desk-help.js）。節の目次を先に出す
    const secs = typeof dkhSections === 'function' ? dkhSections() : [];
    body.innerHTML = `<h2 class="mn-h1">🧭 制作デスク</h2>
      <p>新しいテーマのカードを、構想から本文まで作る所です（上の段の「🧭 制作デスク」）。デスクの画面の「❓ 使い方」からも、この章が開きます。</p>
      <div class="mn-subtoc">${secs.map(s => `<a href="#" onclick="dkhGo('${s[0]}'); return false;">${mnEsc(s[1])}</a>`).join('')}</div>` +
      secs.map(s => `<section id="dkh_${s[0]}"><h3>${mnEsc(s[1])}</h3>${s[2]}</section>`).join('');
    return;
  }
  let j;
  try { j = await (await fetch('/api/manual/get?name=' + encodeURIComponent(name))).json(); } catch (e) { j = { ok: false, error: e.message }; }
  if (!j.ok) { body.innerHTML = `<p class="qr-warn">読めませんでした：${mnEsc(j.error)}</p>`; return; }
  let html = mdToHtml(j.text);
  if (html.includes('<!-- intake-rules -->')) {
    let rules;
    try { rules = await (await fetch('/api/manual/intake-rules')).json(); } catch (e) { rules = { ok: false, error: e.message }; }
    const part = rules.ok
      ? `<div class="mn-embed"><div class="mn-embed-h">📄 ソフィー向けの決まり（置き場の <code>${mnEsc(rules.path)}</code> をそのまま出しています）</div>${mdToHtml(rules.text, 1)}</div>`
      : `<p class="qr-warn">${mnEsc(rules.error)}</p>`;
    html = html.replace('<!-- intake-rules -->', part);
  }
  body.innerHTML = html;
}

// ---------------- md → 画面 ----------------
//   shift：見出しを何段下げるか（埋め込むとき用）
function mdInline(s) {
  const codes = [];
  let t = mnEsc(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
       .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}
function mdToHtml(src, shift = 0) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let para = [];
  const flush = () => { if (para.length) { out.push(`<p>${mdInline(para.join(' '))}</p>`); para = []; } };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (/^\s*<!--\s*intake-rules\s*-->\s*$/.test(ln)) { flush(); out.push('<!-- intake-rules -->'); continue; }
    // コードの囲み
    if (/^```/.test(ln)) {
      flush(); const buf = [];
      while (++i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i]);
      out.push(`<pre class="dkh-tree">${mnEsc(buf.join('\n'))}</pre>`); continue;
    }
    // 見出し
    const h = /^(#{1,4})\s+(.+)$/.exec(ln);
    if (h) { flush(); const lv = Math.min(h[1].length + shift, 4);
      out.push(lv === 1 ? `<h2 class="mn-h1">${mdInline(h[2])}</h2>` : `<h${lv + 1}>${mdInline(h[2])}</h${lv + 1}>`); continue; }
    // 表
    if (/^\s*\|/.test(ln)) {
      flush(); const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]); i--;
      const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const isSep = r => /^\s*\|?\s*:?-{2,}/.test(r) && /^[\s|:-]+$/.test(r);
      let html = '<table class="dkh-t">';
      rows.forEach((r, k) => {
        if (isSep(r)) return;
        const tag = k === 0 && rows[1] && isSep(rows[1]) ? 'th' : 'td';
        html += '<tr>' + cells(r).map(c => `<${tag}>${mdInline(c)}</${tag}>`).join('') + '</tr>';
      });
      out.push(html + '</table>'); continue;
    }
    // 引用
    if (/^>\s?/.test(ln)) {
      flush(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, '')); i--;
      out.push(`<blockquote class="mn-quote">${mdInline(buf.join(' '))}</blockquote>`); continue;
    }
    // 箇条書き・番号付き（字下げ2つで1段）
    if (/^\s*([-*]|\d+\.)\s+/.test(ln)) {
      flush();
      const stack = []; let html = '';
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(lines[i]);
        const depth = Math.floor(m[1].replace(/\t/g, '  ').length / 2), tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        while (stack.length > depth + 1) html += `</li></${stack.pop()}>`;
        if (stack.length === depth + 1) html += '</li>';
        while (stack.length < depth + 1) { stack.push(tag); html += `<${tag}>`; }
        html += `<li>${mdInline(m[3])}`;
        i++;
      }
      while (stack.length) html += `</li></${stack.pop()}>`;
      i--; out.push(html); continue;
    }
    if (!ln.trim()) { flush(); continue; }
    para.push(ln.trim());
  }
  flush();
  return out.join('\n');
}
