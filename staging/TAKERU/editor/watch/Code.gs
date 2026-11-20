// ============================================================
// TAKERU 見張り番（Google Apps Script）2026-11-19 TAKERU担当（T）
//   牧村さんの決定（11/19）：予定どおり動いていない異常を、パソコンが寝ていても見つけて、
//   牧村さんのスマホ（Gmail）へ知らせる。ソフィーは「最後に動いた時刻」を見る（見張りの見張り）。
//
//   1時間ごとに hourly() が動く。確かめごとは、それぞれの時刻の条件のときだけ判定する。
//   何もなければ静か。新しい異常だけをメールで知らせ、片付くまで1日1回だけ知らせ直す。
//   毎回、TAKERU_共有\20_見張り\今日の様子.md を書き直す（最後に動いた時刻・いまの異常・確かめた項目）。
//
//   読む所（どれも読むだけ）：
//     X 用 GAS の窓口（action=x_list）／マガジン GAS の窓口（action=magazine_dashboard）
//     本番のアプリ（takeru.ms-forum.com）と「様子の窓」（health.php）／開発版の sw.js（版の比べ）
//     HP の YouTube の予定（ms-forum.com/youtube.html）／チャンネルの公開の一覧（RSS）／YouTube の oEmbed（リンク切れ）
//   合鍵・住所は「スクリプトのプロパティ」に置く（コードにもリポジトリにも書かない）：
//     X_GAS_URL, X_TOKEN, MAG_GAS_URL, MAG_TOKEN, ALERT_TO, WATCH_FOLDER_ID
//     （任意）DEADLINES_JSON … 期日表。[{"name":"…","due":"YYYY-MM-DD","who":"牧村さん","note":"…"}]
//   設置の手順は、同じフォルダの「設置手順.md」。
// ============================================================

var APP_URL = 'https://takeru.ms-forum.com/';
var HEALTH_URL = 'https://takeru.ms-forum.com/health.php';
var DEV_SW_URL = 'https://sophieitsecret.github.io/staging/TAKERU/sw.js';
var YT_PAGE_URL = 'https://ms-forum.com/youtube.html';
var YT_FEED_URL = 'https://www.youtube.com/feeds/videos.xml?channel_id=UCOhTl9zeT96dp5XYXEJbZYw';   // MSフォーラム 軍事・戦略検定講座（@MSCPOfficial）
var TZ = 'Asia/Tokyo';
var STATUS_FILE = '今日の様子.md';
var RENOTIFY_HOURS = 24;

// 期日表の初め（DEADLINES_JSON が無いときに使う）
var DEFAULT_DEADLINES = [
  { name: 'ガーディアンの API キーの延長（90日ごと）', due: '2027-02-15', who: '牧村さん',
    note: 'ガーディアンからのメール（no-reply@email.open-platform.theguardian.com）の「延長」だけを押す。消えるとマガジンが作れなくなる' }
];

// 試しのときだけ時刻を差し替える（ふだんは null）
var WATCH_NOW = null;

// ---------------- 入口 ----------------
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'hourly') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('hourly').timeBased().everyHours(1).create();
  hourly();
}

function testAlert() {
  sendMail_('【TAKERU見張り】試しの知らせ', '見張り番からの試しの知らせです。これがスマホに届けば、知らせの道はつながっています。\n\n' + statusFileUrl_());
}

function hourly() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var now = now_();
    var results = [];                 // 確かめた項目：{ name, state: 'ok'|'ng'|'skip', detail }
    var found = [];                   // 異常：{ key, title, detail, who }
    var checks = [checkX_, checkMagazine_, checkApp_, checkYouTube_, checkDeadlines_];
    checks.forEach(function (fn) {
      try { fn(now, results, found); }
      catch (e) { found.push({ key: 'watch-' + fn.name, title: '見張り番の確かめごとが失敗しました（' + fn.name + '）', detail: String(e && e.message || e), who: 'T' }); }
    });
    notify_(now, found);
    writeStatus_(now, results, found);
  } finally {
    lock.releaseLock();
  }
}

// ---------------- 確かめごと ----------------
// X：予定を過ぎても投稿されていない、エラーが入った
function checkX_(now, results, found) {
  var p = props_();
  if (!p.X_GAS_URL || !p.X_TOKEN) { results.push({ name: 'X の投稿', state: 'skip', detail: '窓口の住所・合鍵が未設定' }); return; }
  var from = fmt_(addHours_(now, -36), 'yyyy-MM-dd'), to = fmt_(now, 'yyyy-MM-dd');
  var j = getJson_(p.X_GAS_URL + '?' + qs_({ action: 'x_list', token: p.X_TOKEN, from: from, to: to }));
  if (!j || !j.ok) {
    found.push({ key: 'x-gas', title: 'X 用 GAS の窓口が応えません', detail: (j && j.error) || '返事なし', who: 'マガジン' });
    results.push({ name: 'X の投稿', state: 'ng', detail: '窓口が応えない' });
    return;
  }
  var n = 0;
  (j.items || []).forEach(function (it) {
    var at = parseLocal_(it.at);
    if (it.error || it.status === 'エラー') {
      n++; found.push({ key: 'x-err-' + it.id, title: 'X ' + it.id + '（' + it.at + '）の投稿でエラー',
        detail: String(it.error || '状態がエラー').slice(0, 300), who: 'マガジン（クレジット切れなど、お金・ログインは牧村さん）' });
    } else if (at && it.status === '待機中' && minutesBetween_(at, now) > 20) {
      n++; found.push({ key: 'x-late-' + it.id, title: 'X ' + it.id + '（' + it.at + ' 予定）がまだ投稿されていません',
        detail: '承認済み（待機中）なのに、予定の時刻を ' + minutesBetween_(at, now) + '分過ぎています', who: 'マガジン' });
    } else if (at && it.status === '承認待ち' && minutesBetween_(at, now) > 0) {
      n++; found.push({ key: 'x-unapproved-' + it.id, title: 'X ' + it.id + '（' + it.at + ' 予定）が承認されないまま時刻を過ぎました',
        detail: '承認待ちのままです。出すなら承認と時刻の付け直し、出さないなら保留に', who: '牧村さん' });
    }
  });
  results.push({ name: 'X の投稿', state: n ? 'ng' : 'ok', detail: (j.items || []).length + '件を確かめた' + (n ? '・異常 ' + n + '件' : '') });
}

// マガジン：GAS 側の警告（alerts）、金曜 23:00 に下書きが無い、土曜 9:30 に配信されていない
function checkMagazine_(now, results, found) {
  var p = props_();
  if (!p.MAG_GAS_URL || !p.MAG_TOKEN) { results.push({ name: 'マガジン', state: 'skip', detail: '窓口の住所・合鍵が未設定' }); return; }
  var j = getJson_(p.MAG_GAS_URL + '?' + qs_({ action: 'magazine_dashboard', token: p.MAG_TOKEN }));
  if (!j || !j.ok) {
    found.push({ key: 'mag-gas', title: 'マガジン GAS の窓口が応えません', detail: (j && j.error) || '返事なし', who: 'マガジン' });
    results.push({ name: 'マガジン', state: 'ng', detail: '窓口が応えない' });
    return;
  }
  var n = 0, skipped = 0;
  var dow = dow_(now), hm = fmt_(now, 'HH:mm'), today = fmt_(now, 'yyyy-MM-dd');
  (j.alerts || []).forEach(function (a) {
    var text = typeof a === 'string' ? a : (a.message || a.text || a.label || JSON.stringify(a));
    // 金曜 16:06 の担当M金曜は日経平均だけを取り、米国株・為替・原油は土曜 7:05 の担当Mが取る。
    // その間（金曜16:00〜土曜7:30）の「一部の銘柄だけ」は正常なので数えない（2026-11-21 マガジンの C-03）
    if (marketPartialOk_(dow, hm) && text.indexOf('一部の銘柄だけ') >= 0) { skipped++; return; }
    n++; found.push({ key: 'mag-alert-' + hash_(text), title: 'マガジンの警告', detail: text, who: 'マガジン' });
  });
  if (dow === 5 && hm >= '23:00' && j.issue && j.friday === today && !j.issue.exists) {
    n++; found.push({ key: 'mag-nodraft-' + today, title: '明日の号（' + j.issue.issue_date + '）の下書きがまだありません',
      detail: '初版は金曜 20:50 ごろ自動で作られるはずです', who: 'マガジン' });
  }
  if (dow === 6 && hm >= '09:30') {
    var h = (j.history || []).filter(function (x) { return x.issue_date === today && !x.is_test; })[0];
    if (!h || !h.sent || !(h.mail && h.mail.ok)) {
      n++; found.push({ key: 'mag-notsent-' + today, title: '今日（' + today + '）の号が、まだ配信済みになっていません',
        detail: h ? ('配信の記録：' + JSON.stringify(h.mail || {})) : '今日の号の記録がありません', who: 'マガジン（メールの送り出しは会員システム）' });
    }
  }
  // 「警告」と「異常」が別々にあるように見えないよう、数えた分は「いまの異常」に載せたと書く（C-03 の2）
  var counted = (j.alerts || []).length - skipped;
  results.push({ name: 'マガジン', state: n ? 'ng' : 'ok', detail: 'GAS の警告 ' + (j.alerts || []).length + '件' +
    (skipped ? '（うち ' + skipped + '件は金曜夕方〜土曜朝の「一部の銘柄だけ」なので正常として数えない）' : '') +
    (n ? '・異常 ' + n + '件（GAS の警告 ' + counted + '件を含む。中身は上の「いまの異常」）' : '') });
}

// アプリ本番：開けるか、様子の窓（集計の日付・ニュースの更新・版）
function checkApp_(now, results, found) {
  var r = fetch_(APP_URL);
  if (!r || r.code !== 200) {
    found.push({ key: 'app-down', title: 'アプリ（takeru.ms-forum.com）が開けません', detail: r ? ('HTTP ' + r.code) : '応えない', who: 'T（サーバーの不調なら牧村さん）' });
    results.push({ name: 'アプリ本番', state: 'ng', detail: '開けない' });
    return;
  }
  var h = fetch_(HEALTH_URL);
  if (!h || h.code !== 200) {
    results.push({ name: 'アプリ本番', state: 'ok', detail: '開ける（様子の窓はまだ本番に無い：HTTP ' + (h ? h.code : '-') + '）' });
    return;
  }
  var s; try { s = JSON.parse(h.text); } catch (e) { s = null; }
  if (!s || !s.ok) { results.push({ name: 'アプリ本番', state: 'ok', detail: '開ける（様子の窓が読めない）' }); return; }
  var n = 0, today = fmt_(now, 'yyyy-MM-dd');
  // 閲覧の集計（1日1回）：いちばん新しい日付が2日より前
  if (s.summary_last_date && daysBetween_(s.summary_last_date, today) > 2) {
    n++; found.push({ key: 'summary-stale', title: '閲覧の集計が止まっています', detail: '集計の最後の日付：' + s.summary_last_date + '（本番の cron を確かめる）', who: 'T' });
  }
  // 土曜 13:00：ニュースの自動取り込み（パソコン）が本番まで届いたか、開発版と本番の版がそろったか
  if (dow_(now) === 6 && fmt_(now, 'HH:mm') >= '13:00') {
    if (!s.news_csv || s.news_csv.slice(0, 10) < today) {
      n++; found.push({ key: 'news-auto-' + today, title: '今日のニュース自動取り込みが、本番に届いていません',
        detail: '本番の news.csv の更新：' + (s.news_csv || '不明') + '。パソコンが寝ているか、取り込みが失敗した。パソコンを起こすと動きます（editor\\news-auto.log）', who: 'T（パソコンを起こすのは牧村さん）' });
    }
    var dev = fetch_(DEV_SW_URL), m = dev && /SW_VERSION\s*=\s*'([^']+)'/.exec(dev.text);
    if (m && s.version && m[1] !== s.version) {
      n++; found.push({ key: 'version-' + today, title: '本番の版（' + s.version + '）が開発版（' + m[1] + '）とそろっていません',
        detail: '土曜の自動転送で本番に入るはずのものが、入っていない', who: 'T' });
    }
  }
  results.push({ name: 'アプリ本番', state: n ? 'ng' : 'ok', detail: '版 ' + s.version + '・集計 ' + s.summary_last_date + '・ニュース ' + s.news_csv + (n ? '・異常 ' + n + '件' : '') });
}

// YouTube の毎日17時の公開と HP の入口（2026-11-19 ソフィーの頼み R-20261119-S-01）
//   予定：HP の youtube.html（テーマごとに data-open・テーマ名・全N話・公開済みの印 data-ready とリンク）
//   実際：チャンネルの公開の一覧（RSS。新しい15本）。リンク切れ：oEmbed（無い・非公開なら 404）
function checkYouTube_(now, results, found) {
  var sp = PropertiesService.getScriptProperties();
  var page = fetch_(YT_PAGE_URL);
  if (!page || page.code !== 200) {
    var since = Number(sp.getProperty('YT_PAGE_FAIL_SINCE') || 0) || now.getTime();
    sp.setProperty('YT_PAGE_FAIL_SINCE', String(since));
    if (now.getTime() - since > 12 * 3600000) {
      found.push({ key: 'yt-page', title: 'HP の YouTube のページ（予定の一覧）が半日以上読めません', detail: YT_PAGE_URL + ' が ' + (page ? 'HTTP ' + page.code : '応えない'), who: 'ホームくん' });
      results.push({ name: 'YouTube の公開', state: 'ng', detail: '予定が読めない（半日以上）' });
    } else results.push({ name: 'YouTube の公開', state: 'skip', detail: '予定（HP）が読めない' });
    return;
  }
  sp.deleteProperty('YT_PAGE_FAIL_SINCE');
  var themes = parseYtPage_(page.text);
  var opened = themes.filter(function (t) { return t.open && t.open.getTime() <= now.getTime(); });
  if (!opened.length) { results.push({ name: 'YouTube の公開', state: 'skip', detail: '公開済みのテーマがまだ無い' }); return; }
  var n = 0, notes = [];

  // 1. 公開の40分後から24時間：RSS に合本と Shorts が出たか
  var recent = opened.filter(function (t) { var m = minutesBetween_(t.open, now); return m >= 40 && m < 24 * 60; });
  if (recent.length) {
    var feed = fetch_(YT_FEED_URL), entries = feed && feed.code === 200 ? parseYtFeed_(feed.text) : null;
    if (!entries) { notes.push('公開の一覧（RSS）が読めない'); }
    else recent.forEach(function (t) {
      var shorts = entries.filter(function (e) { return e.isShort && e.title.indexOf('｜' + t.name) >= 0; }).length;
      var full = entries.some(function (e) { return !e.isShort && e.title.indexOf(t.name + ' 全') === 0; });
      var need = Math.min(t.count || 1, 14);
      if (!full || shorts < need) {
        n++; found.push({ key: 'yt-missing-' + t.no, title: 'YouTube：' + t.label + '「' + t.name + '」が出そろっていません（' + fmt_(t.open, 'M月d日 HH:mm') + ' 公開の予定）',
          detail: '合本：' + (full ? 'あり' : 'なし') + '／Shorts：' + shorts + '本（' + need + '本以上のはず）', who: '牧村さん（YouTube の予約）・ソフィー（原因の説明）' });
      } else notes.push(t.name + ' 合本あり・Shorts ' + shorts + '本');
    });
  }
  // 2. 公開の60分後から：HP のそのテーマが公開済みの形になったか
  opened.forEach(function (t) {
    if (minutesBetween_(t.open, now) >= 60 && (!t.ready || !t.links.length)) {
      n++; found.push({ key: 'yt-hp-' + t.no, title: 'HP の YouTube のページ：' + t.label + '「' + t.name + '」が「公開予定」のままです',
        detail: '公開の時刻（' + fmt_(t.open, 'M月d日 HH:mm') + '）を過ぎたのに、スタートカードと合本のリンクが出ていません', who: 'ホームくん（ソフィーから依頼）' });
    }
  });
  // 3. 1日1回（19時台）：公開済みのテーマのリンクが生きているか
  var today = fmt_(now, 'yyyy-MM-dd');
  if (fmt_(now, 'HH') === '19' && sp.getProperty('YT_LINKCHECK_DATE') !== today) {
    sp.setProperty('YT_LINKCHECK_DATE', today);
    var checked = 0;
    opened.forEach(function (t) {
      t.links.forEach(function (url) {
        checked++;
        var r = fetch_('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url));
        if (r && (r.code === 404 || r.code === 401 || r.code === 403)) {
          n++; found.push({ key: 'yt-link-' + hash_(url), title: 'HP の YouTube のページのリンクが切れています：' + t.label + '「' + t.name + '」',
            detail: url + '（YouTube が HTTP ' + r.code + '。動画が無いか、非公開）', who: 'ホームくん（リンクの直し）・牧村さん（動画の公開設定）' });
        }
      });
    });
    notes.push('リンク ' + checked + '本を確かめた');
  }
  results.push({ name: 'YouTube の公開', state: n ? 'ng' : 'ok', detail: '公開済み ' + opened.length + 'テーマ' + (notes.length ? '・' + notes.join('・') : '') + (n ? '・異常 ' + n + '件' : '') });
}
// HP の youtube.html から、テーマの予定を拾う
function parseYtPage_(html) {
  var out = [], re = /<li class="yt-item[^"]*"([^>]*)>([\s\S]*?)<\/li>/g, m;   // 公開済みは class="yt-item is-open"
  while ((m = re.exec(html))) {
    var attrs = m[1], body = m[2];
    var open = /data-open="([^"]+)"/.exec(attrs);
    var h3 = /<span class="yt-no">([^<]*)<\/span>([^<]*)<span class="yt-count">全(\d+)話/.exec(body);
    if (!open || !h3) continue;
    var links = [], on = /<p class="yt-links yt-on">([\s\S]*?)<\/p>/.exec(body);
    if (on) { var a, ra = /href="([^"]+)"/g; while ((a = ra.exec(on[1]))) links.push(a[1]); }
    out.push({ open: new Date(open[1]), ready: /data-ready/.test(attrs), label: h3[1].trim(), no: h3[1].replace(/\D/g, ''),
               name: h3[2].trim(), count: Number(h3[3]), links: links });
  }
  return out;
}
// チャンネルの公開の一覧（RSS）から、題と種類を拾う
function parseYtFeed_(xml) {
  var out = [], re = /<entry>([\s\S]*?)<\/entry>/g, m;
  while ((m = re.exec(xml))) {
    var e = m[1], t = /<title>([\s\S]*?)<\/title>/.exec(e), l = /<link rel="alternate" href="([^"]+)"/.exec(e);
    if (!t) continue;
    out.push({ title: unescapeXml_(t[1]), isShort: !!(l && l[1].indexOf('/shorts/') >= 0) });
  }
  return out;
}
function unescapeXml_(s) { return String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"); }

// 期限もの：2週間前から知らせる
function checkDeadlines_(now, results, found) {
  var list = DEFAULT_DEADLINES;
  var raw = props_().DEADLINES_JSON;
  if (raw) { try { list = JSON.parse(raw); } catch (e) { found.push({ key: 'deadlines-json', title: '期日表（DEADLINES_JSON）が読めません', detail: String(e.message), who: 'T' }); } }
  var today = fmt_(now, 'yyyy-MM-dd'), n = 0;
  (list || []).forEach(function (d) {
    var left = daysBetween_(today, d.due);
    if (left <= 14) {
      n++; found.push({ key: 'deadline-' + hash_(d.name + d.due),
        title: (left < 0 ? '期日を過ぎました：' : 'あと ' + left + '日：') + d.name + '（' + d.due + '）',
        detail: d.note || '', who: d.who || '牧村さん' });
    }
  });
  results.push({ name: '期限もの', state: n ? 'ng' : 'ok', detail: (list || []).length + '件の期日を確かめた' });
}

// ---------------- 知らせ ----------------
function notify_(now, found) {
  var sp = PropertiesService.getScriptProperties();
  var state = {}; try { state = JSON.parse(sp.getProperty('ALERT_STATE') || '{}'); } catch (e) { state = {}; }
  var t = now.getTime(), next = {}, toSend = [], resolved = [];
  found.forEach(function (f) {
    var s = state[f.key];
    if (!s) { next[f.key] = { first: t, last: t, title: f.title }; toSend.push(f); }
    else if (t - s.last >= RENOTIFY_HOURS * 3600000) { next[f.key] = { first: s.first, last: t, title: f.title }; toSend.push(f); }
    else next[f.key] = s;
  });
  Object.keys(state).forEach(function (k) { if (!next[k]) resolved.push(state[k].title); });
  sp.setProperty('ALERT_STATE', JSON.stringify(next));
  if (!toSend.length) return;
  var body = '見張り番が異常を見つけました（' + fmt_(now, 'M月d日 HH:mm') + '）。\n\n' +
    toSend.map(function (f, i) { return (i + 1) + '. ' + f.title + '\n   ' + f.detail + '\n   受け持ち：' + f.who; }).join('\n\n') +
    (resolved.length ? '\n\n片付いたもの：\n' + resolved.map(function (x) { return '・' + x; }).join('\n') : '') +
    '\n\nいまの様子：' + statusFileUrl_();
  sendMail_('【TAKERU見張り】異常 ' + toSend.length + '件', body);
}

function sendMail_(subject, body) {
  var to = props_().ALERT_TO;
  if (!to) throw new Error('ALERT_TO（知らせの宛先）が未設定です');
  GmailApp.sendEmail(to, subject, body, { name: 'TAKERU 見張り番' });
}

// ---------------- 今日の様子.md ----------------
function writeStatus_(now, results, found) {
  var mark = { ok: '✅', ng: '⚠️', skip: '－' };
  var md = [
    '# 見張り番：今日の様子',
    '',
    '- **最後に動いた時刻：' + fmt_(now, 'yyyy-MM-dd HH:mm') + '**（1時間ごとに書き直す。3時間以上古ければ、見張り番が止まっている）',
    '- いまの異常：' + found.length + '件',
    '- 作り：TAKERU担当（T）。コードは リポジトリの staging/TAKERU/editor/watch/Code.gs',
    '',
    '## いまの異常',
    found.length ? found.map(function (f) { return '- ' + f.title + '\n  - ' + f.detail + '\n  - 受け持ち：' + f.who; }).join('\n') : '- なし',
    '',
    '## 確かめた項目',
    '| 項目 | 結果 | 中身 |',
    '|---|---|---|'
  ].concat(results.map(function (r) { return '| ' + r.name + ' | ' + mark[r.state] + ' | ' + String(r.detail).replace(/\|/g, '／') + ' |'; }))
   .concat(['', '異常の受け持ち：X・マガジン＝マガジン／ニュース自動取り込み・アプリ・作業台＝T／お金・ログイン＝牧村さん／記録＝事務局', '']).join('\n');
  var f = statusFile_();
  if (f) f.setContent(md);
}
function statusFile_() {
  var id = props_().WATCH_FOLDER_ID;
  if (!id) return null;
  var folder = DriveApp.getFolderById(id);
  var it = folder.getFilesByName(STATUS_FILE);
  return it.hasNext() ? it.next() : folder.createFile(STATUS_FILE, '', 'text/markdown');
}
function statusFileUrl_() {
  try { var f = statusFile_(); return f ? f.getUrl() : '（20_見張り のフォルダが未設定）'; } catch (e) { return '（今日の様子.md を開けません）'; }
}

// ---------------- 小さな道具 ----------------
function props_() { return PropertiesService.getScriptProperties().getProperties(); }
function now_() { return WATCH_NOW ? new Date(WATCH_NOW) : new Date(); }
function fmt_(d, f) { return Utilities.formatDate(d, TZ, f); }
function dow_(d) { return Number(fmt_(d, 'u')) % 7; }   // 0＝日曜 … 6＝土曜
function marketPartialOk_(dow, hm) { return (dow === 5 && hm >= '16:00') || (dow === 6 && hm < '07:30'); }   // マーケットが日経平均だけでよい時間（金曜16:00〜土曜7:30）
function addHours_(d, h) { return new Date(d.getTime() + h * 3600000); }
function minutesBetween_(a, b) { return Math.floor((b.getTime() - a.getTime()) / 60000); }
function daysBetween_(a, b) {   // 'yyyy-MM-dd' どうしの日数（b − a）
  var pa = a.split('-'), pb = b.split('-');
  return Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000);
}
// 'yyyy-MM-dd HH:mm'（日本時間）を Date に
function parseLocal_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(String(s || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5])) : null;
}
function qs_(o) { return Object.keys(o).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(o[k]); }).join('&'); }
function fetch_(url) {
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    return { code: r.getResponseCode(), text: r.getContentText() };
  } catch (e) { return null; }
}
function getJson_(url) {
  var r = fetch_(url);
  if (!r) return null;
  try { return JSON.parse(r.text); } catch (e) { return { ok: false, error: 'HTTP ' + r.code + '・返事が読めない' }; }
}
function hash_(s) {
  var h = 0; s = String(s);
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(36);
}
