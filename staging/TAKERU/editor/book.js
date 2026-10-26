// ============================================================
// 📌 住所録（TAKERU関係のサイト・管理画面・フォルダの住所を、作業台の中にまとめておく場所）2026-10-27
//   置き場：タケルプロジェクトの「TAKERU 住所録.json」（台帳と同じ場所。ふつうのファイルなので Obsidian や Claude Code からも読める）
//   ・サイトや管理画面の住所（https://…）… 押すとブラウザで開く
//   ・このPCのフォルダ・ファイル（D:\…）… 押すとエクスプローラーで開く（ファイルは場所を示すだけで、中身は実行しない）
//   ・⚠パスワード・鍵・トークンは入れない。この住所録は Dropbox に写る（台帳と同じ扱い）
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SEED = [
  ['アプリ・サイト', 'TAKERU（本番）', 'https://takeru.ms-forum.com/', '利用者が使う版。公開にしたカードだけ出る'],
  ['アプリ・サイト', 'TAKERU（開発版）', 'https://sophieitsecret.github.io/staging/TAKERU/', '全カードが出る確認用。?preview=prod を付けると本番の見え方'],
  ['アプリ・サイト', 'TAKERU マーケットの画面', 'https://takeru.ms-forum.com/?view=market', 'メルマガ・Xから貼るリンク'],
  ['アプリ・サイト', 'ホームページ', 'https://ms-forum.com/', '2026-09-28 にWordPressから静的HTMLへ'],
  ['アプリ・サイト', 'ホームページのTAKERU紹介', 'https://ms-forum.com/takeru.html', 'QRコード・ホーム画面への追加手順'],
  ['アプリ・サイト', 'TAKERUマガジン（バックナンバー）', 'https://ms-forum.com/mailmag/', '毎週土曜8:00に号が増える'],
  ['アプリ・サイト', '会員ページ', 'https://member.ms-forum.com/', '入門コースの受講など'],
  ['アプリ・サイト', '入会のお申込み', 'https://member.ms-forum.com/join.php', ''],
  ['アプリ・サイト', '事務局（牧村さん専用）', 'https://office.ms-forum.com/', ''],
  ['X・サーバー・GitHub', 'MSフォーラムのX（@MSforum01）', 'https://x.com/MSforum01', ''],
  ['X・サーバー・GitHub', 'X開発者コンソール（APIのクレジット・使用状況）', 'https://developer.x.com', 'Usage（使用状況）・Billing（請求）。画面の名前は変わることがある'],
  ['X・サーバー・GitHub', 'Xserver サーバーパネル', 'https://secure.xserver.ne.jp/xapanel/login/xserver/server/', 'PHP Ver.切替・php.ini設定・アクセスログ・バックアップ'],
  ['X・サーバー・GitHub', 'GitHub：TAKERUのコード', 'https://github.com/SophieITSecret/SophieITSecret.github.io', '公開の置き場。秘密は入れない'],
  ['X・サーバー・GitHub', 'GitHub：チャート撮影係（非公開）', 'https://github.com/SophieITSecret/msforum-chart-shot', '毎週土曜6:15。ログインしていないと404になる'],
  ['X・サーバー・GitHub', '撮影係の実行（Actions）', 'https://github.com/SophieITSecret/msforum-chart-shot/actions', 'Run workflow で手動実行できる'],
  ['Cowork君・Google', '牧村ダッシュボード', 'https://claude.ai/artifact/5My7AYukuMMr31UXxZP4LX', 'Cowork君が毎朝9:15に更新'],
  ['Cowork君・Google', 'TAKERU 全体像（作戦本部向け）', 'https://claude.ai/artifact/L9BZyPj2TnGHmxTqo9ZYWT', '2026-10-02'],
  ['Cowork君・Google', 'スプレッドシート「ガーディアンnews」', 'https://docs.google.com/spreadsheets/d/1zqeeMqB1qzsPLAmay3U5A68b4Pph8pmXYJaOul_80No', '記事ストア・タグ台帳・今週の候補'],
  ['このPCのフォルダ', '講座内容（原稿・手順書・ルール）', 'D:\\Dropbox\\00_執務室\\タケルプロジェクト\\講座内容', ''],
  ['このPCのフォルダ', '制作デスク（テーマごとのカード・資料・依頼）', 'D:\\Dropbox\\00_執務室\\タケルプロジェクト\\講座内容\\制作デスク', ''],
  ['このPCのフォルダ', '画像（手本・一覧）', 'D:\\Dropbox\\00_執務室\\タケルプロジェクト\\画像', ''],
  ['このPCのフォルダ', '調査資料（Deep Researchなど）', 'D:\\Dropbox\\00_執務室\\タケルプロジェクト\\調査資料', ''],
  ['このPCのフォルダ', 'マーケティング（QR・パンフレット・状況報告）', 'D:\\Dropbox\\00_執務室\\タケルプロジェクト\\マーケティング', ''],
  ['このPCのフォルダ', '共有の文書（担当どうし）', 'D:\\ms-common', 'マガジンの決まったこと・サーバー点検報告など'],
  ['このPCのフォルダ', '作業台のフォルダ', 'D:\\Sophie\\SophieITSecret.github.io\\staging\\TAKERU\\editor', '⚠ secrets.json（鍵）はここ。開いても中身を人に見せない・写さない'],
  ['このPCのフォルダ', 'TAKERU 台帳（リンクと置き場所）', 'D:\\Dropbox\\00_執務室\\タケルプロジェクト\\TAKERU 台帳（リンクと置き場所）.md', 'ファイルの場所を示す'],
];

module.exports = function book(ctx) {
  const { sendJSON, draftsDir } = ctx;
  const FILE = () => path.join(path.dirname(draftsDir()), 'TAKERU 住所録.json');
  const isUrl = s => /^https?:\/\/\S+$/i.test(s);
  const isPath = s => /^[A-Za-z]:\\/.test(s);
  const newId = () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const body = req => new Promise((ok, ng) => { const c = []; req.on('data', x => c.push(x));
    req.on('end', () => { try { ok(JSON.parse(Buffer.concat(c).toString('utf8') || '{}')); } catch (e) { ng(e); } }); });
  const stampOf = p => { try { return String(fs.statSync(p).mtimeMs); } catch { return ''; } };
  function read() {
    const p = FILE();
    if (!fs.existsSync(p)) {
      const items = SEED.map(([group, name, url, note]) => ({ id: newId(), group, name, url, note }));
      fs.writeFileSync(p, JSON.stringify({ about: 'TAKERU 住所録（作業台の「📌 住所録」が読み書きします）。パスワード・鍵は入れないこと', items }, null, 2) + '\n', 'utf8');
    }
    const j = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
    return { items: (j.items || []).map(x => ({ id: x.id || newId(), group: x.group || '', name: x.name || '', url: x.url || '', note: x.note || '' })), stamp: stampOf(p), path: p };
  }
  function clean(list) {
    if (!Array.isArray(list)) throw new Error('住所の一覧が違います');
    return list.map(x => {
      const name = String(x.name || '').trim(), url = String(x.url || '').trim(), group = String(x.group || '').trim() || 'その他';
      if (!name) throw new Error('名前がない行があります');
      if (!isUrl(url) && !isPath(url)) throw new Error(`「${name}」の住所は、https:// で始まるサイトの住所か、D:\\… のようなこのPCの場所にしてください`);
      return { id: String(x.id || newId()), group: group.slice(0, 40), name: name.slice(0, 80), url: url.slice(0, 500), note: String(x.note || '').trim().slice(0, 200) };
    });
  }
  async function handle(pathname, method, req, res) {
    if (!pathname.startsWith('/api/book')) return false;
    try {
      if (pathname === '/api/book' && method === 'GET') { const r = read(); return sendJSON(res, 200, { ok: true, ...r }), true; }
      if (pathname === '/api/book' && method === 'POST') {
        const b = await body(req), p = FILE();
        if (b.stamp && fs.existsSync(p) && stampOf(p) !== String(b.stamp)) return sendJSON(res, 200, { ok: false, conflict: true, error: '住所録が、ほかの所（Obsidian や Claude Code など）で先に直されていました。読み直します' }), true;
        const items = clean(b.items);
        if (fs.existsSync(p)) fs.copyFileSync(p, p.replace(/\.json$/, '.bak.json'));
        fs.writeFileSync(p, JSON.stringify({ about: 'TAKERU 住所録（作業台の「📌 住所録」が読み書きします）。パスワード・鍵は入れないこと', items }, null, 2) + '\n', 'utf8');
        return sendJSON(res, 200, { ok: true, stamp: stampOf(p) }), true;
      }
      // このPCの場所を、エクスプローラーで開く。住所録に載っている場所だけ（任意の場所は開かない）。ファイルは場所を示すだけ
      if (pathname === '/api/book/open' && method === 'POST') {
        const b = await body(req), t = String(b.target || '');
        if (!isPath(t) || !read().items.some(x => x.url === t)) throw new Error('住所録にない場所は開けません');
        if (!fs.existsSync(t)) throw new Error('見つかりません：' + t);
        const args = fs.statSync(t).isDirectory() ? [t] : ['/select,', t];
        spawn('explorer.exe', args, { detached: true, stdio: 'ignore' }).unref();
        return sendJSON(res, 200, { ok: true }), true;
      }
      return sendJSON(res, 404, { ok: false, error: '窓口がありません' }), true;
    } catch (e) { return sendJSON(res, 200, { ok: false, error: e.message }), true; }
  }
  return { handle };
};
