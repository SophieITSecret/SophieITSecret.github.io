// ============================================================
// TAKERU 速報パネル（Google Apps Script のウェブアプリ）2026-11-27 TAKERU担当（T）
//   牧村さんの決定（11/27、R-20261127-C-03）：11/28 の台湾統一地方選の開票速報を、HP トップの枠に出す。
//   ソフィーが30分ごとに、ホームくんを通さずに自分で中身を差し替える（R-20261127-S-15 の第4節）。
//
//   しくみ：
//     ソフィーは TAKERU_共有\80_速報\ に「開票速報_1730.html」のような新しいファイルを置くだけ（上書きしない）。
//     このウェブアプリは、その中の更新が一番新しい1枚を読み、危ないものを取り除いて JSON で返す。
//       { ok: true, file: "開票速報_1730.html", updated: "2026-11-28 17:31", html: "<div>…</div>" }
//     80_速報 に「停止.txt」があれば、html を空で返す（HP の枠は隠れる）。撤去や急ぎの取り消し用。
//     HP の枠（ホームくん）は、この住所を fetch して html を流し込む。
//   読むだけ。合鍵は要らない（返すのは公開する中身だけ）。
//   スクリプトのプロパティ：PANEL_FOLDER_ID（80_速報 のフォルダの番号）
//   設置の手順は、同じフォルダの「設置手順.md」。
// ============================================================

var TZ = 'Asia/Tokyo';
var FILE_RE = /^開票速報_.*\.html?$/i;
var STOP_FILE = '停止.txt';
var MAX_BYTES = 300 * 1024;

function doGet(e) {
  var out;
  try { out = latest_(); }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

// 試し：エディタで実行すると、返す中身の頭をログに出す
function testLatest() {
  var o = latest_();
  Logger.log(JSON.stringify({ ok: o.ok, file: o.file, updated: o.updated, stopped: o.stopped, length: (o.html || '').length, head: (o.html || '').slice(0, 200) }));
}

function latest_() {
  var id = PropertiesService.getScriptProperties().getProperty('PANEL_FOLDER_ID');
  if (!id) return { ok: false, error: 'PANEL_FOLDER_ID が未設定です' };
  var folder = DriveApp.getFolderById(id);
  if (hasLive_(folder.getFilesByName(STOP_FILE))) return { ok: true, stopped: true, file: STOP_FILE, updated: '', html: '' };
  var best = null, it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    if (f.isTrashed() || !FILE_RE.test(f.getName())) continue;
    if (!best || f.getLastUpdated().getTime() > best.getLastUpdated().getTime()) best = f;
  }
  if (!best) return { ok: true, file: '', updated: '', html: '' };
  if (best.getSize() > MAX_BYTES) return { ok: false, file: best.getName(), error: '大きすぎます（' + MAX_BYTES + 'バイトまで）' };
  return { ok: true, file: best.getName(), updated: Utilities.formatDate(best.getLastUpdated(), TZ, 'yyyy-MM-dd HH:mm'),
           html: cleanPanel_(best.getBlob().getDataAsString('UTF-8')) };
}
function hasLive_(it) { while (it.hasNext()) { if (!it.next().isTrashed()) return true; } return false; }

// HP に流し込む前に、危ないもの・ページ全体に効くものを取り除く
//   ・丸ごとの HTML なら <body> の中だけにする
//   ・script / iframe / object / embed / style / link / meta / base / form / title は塊ごと消す
//   ・on…= の属性（onclick など）と、javascript: の住所を消す
function cleanPanel_(h) {
  h = String(h).replace(/^﻿/, '');
  var b = /<body[^>]*>([\s\S]*)<\/body>/i.exec(h);
  if (b) h = b[1];
  h = h.replace(/<!--[\s\S]*?-->/g, '');
  ['script', 'iframe', 'object', 'embed', 'style', 'form', 'title', 'noscript', 'template'].forEach(function (t) {
    h = h.replace(new RegExp('<' + t + '\\b[\\s\\S]*?<\\/' + t + '\\s*>', 'gi'), '');
    h = h.replace(new RegExp('<\\/?' + t + '\\b[^>]*>', 'gi'), '');
  });
  h = h.replace(/<(link|meta|base)\b[^>]*>/gi, '');
  h = h.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  h = h.replace(/(href|src|xlink:href|action|formaction)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"');
  h = h.replace(/(href|src|xlink:href)\s*=\s*javascript:[^\s>]*/gi, '$1="#"');
  return h.trim();
}
