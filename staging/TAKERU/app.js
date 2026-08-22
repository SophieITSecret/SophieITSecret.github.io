// ==========================================
// TAKERU MSアカデミー app.js v3.0
// ==========================================

// ── 環境判定 ────────────────────────────────
// 方針：開発だと確実に分かるホストだけを開発モードとし、それ以外は
//       すべて本番モード（安全側）に倒す。想定外URLから入られても
//       必ず「隠す側」に倒れる。
// 判定の本体は index.html の <head>（window.__IS_PROD）にある。
// ホーム画面追加より前に必要なため head で先に決めており、ここはそれを受け取る。
// head が読めなかった場合に備え、同じ規則で計算し直すフォールバックを持つ。
const IS_PROD = (typeof window.__IS_PROD === 'boolean') ? window.__IS_PROD : (function () {
    let preview = null;
    try { preview = new URLSearchParams(location.search).get('preview'); } catch (e) { /* noop */ }
    if (preview === 'prod') return true;    // 本番の見え方を確認する
    if (preview === 'dev')  return false;   // 強制的に全表示

    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return false;
    if (h.endsWith('.github.io')) return false;
    if (/^192\.168\./.test(h) || /^10\./.test(h)) return false;   // LAN内の実機テスト
    return true;                            // 上記以外はすべて本番
})();

// ==========================================
// アクセス計測（本番のみ）
//   記録するのは日付・種別・カード番号だけ。個人を特定する情報は送らない。
//   送信に失敗しても学習を止めないよう、エラーは必ず握りつぶす。
// ==========================================
function logAccess(type, code) {
    if (!IS_PROD) return;                   // 開発の動作確認を数えない
    try {
        fetch('./log.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(code ? { type: type, code: code } : { type: type }),
            keepalive: true                 // 画面を離れる直前でも送り切る
        }).catch(function () { /* 記録の失敗は無視する */ });
    } catch (e) { /* fetch自体が使えない環境でも落とさない */ }
}

// 科目（級）の状態を判定して保持する。dev/prod共通・データ由来なので見え方が揃う。
//   'full'    … 公開カードがある（明・通常閲覧）      例）軍事と戦略
//   'preview' … 未公開だがタイトルはある（中・タイトルまで見せる） 例）国家と法律・戦争の歴史
//   'coming'  … データが無い（暗・準備中）             例）1級・2級
let subjectTierMap = {};
function computeSubjectTiers() {
    subjectTierMap = {};
    const by = {};
    for (const c of cardData) {
        if (!c.subject) continue;
        (by[c.subject] = by[c.subject] || []).push(c);
    }
    for (const s in by) {
        const cs = by[s];
        subjectTierMap[s] = cs.some(c => c.published) ? 'full'
            : cs.some(c => c.title && c.title.trim()) ? 'preview' : 'coming';
    }
}
function subjectTier(subject) { return subjectTierMap[subject] || 'coming'; }

// このカードを表示するか（表示制御の芯はここ一箇所）
// ※ preview科目はメニューで「作成中」表示にとどめ、カードは開かせない（下の showGradeMenu 参照）
function isCardVisible(card) {
    if (!IS_PROD) return true;              // 開発：全部見せる
    return card.published === true;         // 本番：公開フラグのみ
}
// 配下に見えるカードが1枚でもあるか（タイル点灯の判定）
function hasVisibleCards(cards) {
    return cards.some(isCardVisible);
}
// 見えるカードだけに絞る（一覧・カード送りが扱う配列は必ずこれを通す）
function visibleOf(cards) {
    return cards.filter(isCardVisible);
}

let cardData = [];
let linkData = [];
let newsData = [];
let newsTab = 'ニュース';   // 📰内のタブ：ニュース（既定）／お知らせ
let newsLevel = 0;          // ニュースをどの層まで開いているか（0=今週 … 3=3ヶ月前まで）
let curSection = [];
let curIndex = 0;
let navState = 'top';
let curGenre = '';
let curSubject = '3級';
let curLinkGenre = '';
let autoRead = false;
let autoAdvance = false;
let isMenuVisible = false;
let linkFullscreen = false;
let mp3Failed = false;
let _mp3LoadTimer = null;
let mp3Set = null;

const voice = new Audio();

const entryScreen = document.getElementById('entry-screen');
const mainUI = document.getElementById('main-ui');
const cardImage = document.getElementById('card-image');
const imagePlaceholder = document.getElementById('image-placeholder');
const textView = document.getElementById('text-view');
const menuView = document.getElementById('menu-view');
const menuContent = document.getElementById('menu-content');
const cardProgress = document.getElementById('card-progress');
const cardTitle = document.getElementById('card-title');
const cardBody = document.getElementById('card-body');
const btnVoice = document.getElementById('btn-voice');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');
const btnToggle = document.getElementById('btn-toggle');
const btnHome = document.getElementById('btn-home');
const btnSettings = document.getElementById('btn-settings');
const settingsPanel = document.getElementById('settings-panel');
const imageArea = document.getElementById('image-area');
const dividerLine = document.getElementById('divider-line');

// ホーム画面追加(PWA)用：Android/PCのA2HSイベントを保持。iOSでは発火しない。
let deferredInstallPrompt = null;

window.addEventListener('DOMContentLoaded', async () => {
    logAccess('top_view');                  // トップが開かれた
    window.addEventListener('appinstalled', () => {
        logAccess('pwa_installed');
        deferredInstallPrompt = null;
        if (navState === 'install') renderInstallGuideBody();
    });
    // Android/PC(Chrome/Edge)：追加候補が出せる時に横取りして「インストール」ボタン化する
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (navState === 'install') renderInstallGuideBody();
    });
    waitForGis();                           // Googleサインインの初期化（読み込み待ち）
    maybeShowInAppBanner();                  // LINE等の内蔵ブラウザ検知→外部ブラウザ案内

    await Promise.all([loadCSV(), loadLinkCSV(), loadMp3List(), loadNewsCSV()]);
    setupButtons();
    setupSettings();
    loadSavedSettings();
    setupPullToRefresh();

    document.getElementById('btn-enter').onclick = () => {
        // iOS音声解除：ユーザージェスチャー内で空再生してAudioContextをアンロック
        voice.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        voice.play().then(() => { voice.pause(); voice.src = ''; }).catch(() => { voice.src = ''; });
        entryScreen.style.display = 'none';
        mainUI.style.display = 'flex';
        showTopMenu();
    };
});

// ==========================================
// CSVロード（カードデータ）
// ==========================================
async function loadCSV() {
    try {
        const res = await fetch(`TAKERUcard.csv?v=${Date.now()}`);
        const text = await res.text();
        const records = parseCSV(text).slice(1);
        cardData = records.map(c => ({
            id: c[0]?.trim() || '',
            genre: c[1]?.trim() || '',
            section: c[2]?.trim() || '',
            title: c[3]?.trim() || '',
            body: c[4]?.trim() || '',
            subject: c[5]?.trim() || '3級-軍事と戦略',
            // 7列目「公開」。値が '1' のときだけ公開。空欄・列なし(旧CSV)は非公開
            published: c[6]?.trim() === '1',
            // 8〜10列目（自由研究用）。既存カードは空欄のまま
            author: c[7]?.trim() || '',
            // テーマは複数可。「歴史;国家戦略」のように ; か 、 で区切る
            themes: (c[8]?.trim() || '').split(/[;；,、]/).map(s => s.trim()).filter(Boolean),
            pdf: c[9]?.trim() || ''
        })).filter(d => d.id);
        computeSubjectTiers();   // 科目ごとの明るさ（full/preview/coming）を確定
    } catch (e) {
        console.error('CSVロード失敗:', e);
    }
}

// ==========================================
// MP3リスト読み込み
// ==========================================
async function loadMp3List() {
    try {
        const res = await fetch('voices/mp3list.json');
        if (res.ok) mp3Set = new Set(await res.json());
    } catch (e) {
        // 失敗時はnull維持→通常のonerrorフローにフォールバック
    }
}

// ==========================================
// CSVロード（リンクデータ）
// ==========================================
async function loadLinkCSV() {
    try {
        const res = await fetch(`MSlink.csv?v=${Date.now()}`);
        const text = await res.text();
        const records = parseCSV(text).slice(1);
        linkData = records.map(c => ({
            id: c[0]?.trim() || '',
            genre: c[1]?.trim() || '',
            field: c[2]?.trim() || '',
            name: c[3]?.trim() || '',
            url: c[4]?.trim() || '',
            translate: parseInt(c[5]?.trim() || '0')
        })).filter(d => d.id);
    } catch (e) {
        console.error('リンクCSVロード失敗:', e);
    }
}

// ==========================================
// CSVロード（お知らせ・ニュース）
// ==========================================
async function loadNewsCSV() {
    try {
        const res = await fetch(`news.csv?v=${Date.now()}`);
        if (!res.ok) return;
        const text = await res.text();
        const records = parseCSV(text).slice(1);
        newsData = records.map(c => ({
            id: c[0]?.trim() || '',
            date: c[1]?.trim() || '',
            type: c[2]?.trim() || 'お知らせ',
            title: c[3]?.trim() || '',
            body: c[4] || '',                  // 本文は改行を残すのでtrimしない
            published: c[5]?.trim() === '1',
            // 上の層に持ち上げる印。1記事1行なので、印を立てるだけで
            // 3ヶ月表・年次表の素材になる（同じ記事を作り直さない）
            monthly: c[6]?.trim() === '1',
            yearly:  c[7]?.trim() === '1'
        })).filter(d => d.id);
    } catch (e) {
        console.error('お知らせCSVロード失敗:', e);
    }
}

function parseCSV(text) {
    const records = [];
    let cur = [], field = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            if (inQ && text[i+1] === '"') { field += '"'; i++; }
            else inQ = !inQ;
        } else if (c === ',' && !inQ) {
            cur.push(field.trim()); field = '';
        } else if ((c === '\n' || (c === '\r' && text[i+1] === '\n')) && !inQ) {
            if (c === '\r') i++;
            cur.push(field.trim());
            if (cur.some(f => f)) records.push(cur);
            cur = []; field = '';
        } else {
            field += c;
        }
    }
    if (field || cur.length) { cur.push(field.trim()); if (cur.some(f => f)) records.push(cur); }
    return records;
}

// ==========================================
// translate.goog URL変換
// ==========================================
// パソコンかどうか（スマホ・タブレット以外）。翻訳経路の選択に使う。
function isDesktop_() {
    const ua = navigator.userAgent || '';
    if (/Android|iPhone|iPod|iPad|Mobile/i.test(ua)) return false;
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return false;  // iPad
    return true;
}

function toTranslateGoogUrl(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.replace(/\./g, '-');
        const path = u.pathname + u.search + u.hash;
        return `https://${host}.translate.goog${path}?_x_tr_sl=auto&_x_tr_tl=ja&_x_tr_hl=ja`;
    } catch (e) {
        return url;
    }
}

function openLink(item) {
    if (!item.url) return;
    // 翻訳の中継をどう通すか。サイトによって通る経路が違うので、リンクごとに指定する。
    //   1 = 翻訳（…translate.goog）。ふつうはこちら
    //   3 = 翻訳（旧形式）。新形式を弾くサイト向け（中国国防部・CSTOなど）
    //   4 = スマホだけ翻訳し、パソコンでは原文を開く。
    //       米政府サイトなどは、パソコンからの翻訳中継を拒否して
    //       「Can't translate this page」を返すため、無駄な画面を挟まない。
    const t = item.translate;
    if (t === 1 || (t === 4 && !isDesktop_())) {
        window.open(toTranslateGoogUrl(item.url), '_blank');
    } else if (t === 3) {
        window.open('https://translate.google.com/translate?sl=auto&tl=ja&u=' + encodeURIComponent(item.url), '_blank');
    } else {
        window.open(item.url, '_blank');
    }
}

// ==========================================
// リンク画面フルスクリーン制御
// ==========================================
function enterLinkFullscreen() {
    linkFullscreen = true;
    showMenuBanner();
    btnSettings.style.display = 'none';
}

function exitLinkFullscreen() {
    linkFullscreen = false;
    imageArea.style.display = '';
    dividerLine.style.display = '';
}

// メニュー画面（カード一覧以降）では画像エリアを非表示
function enterMenuFull() {
    imageArea.style.display = 'none';
    dividerLine.style.display = 'none';
}
function exitMenuFull() {
    if (!linkFullscreen) {
        imageArea.style.display = '';
        dividerLine.style.display = '';
        // menu-banner を外すのは「化粧パネル以外の画像に変わるとき」だけ。
        // クラスだけ外して画像が化粧パネルのままだと object-fit が contain に変わり、
        // パネルが枠いっぱいでなく内側に小さく表示されてしまう。
        if (!isMenuBannerImage()) imageArea.classList.remove('menu-banner');
    }
}
// いま表示中の画像が「メニューの化粧パネル」かどうか
function isMenuBannerImage() {
    return /takeru-menu\.(jpg|png)/.test(cardImage.getAttribute('src') || '');
}
// メニュー・一覧画面でコンパクトバナーを表示
function showMenuBanner() {
    imageArea.classList.add('menu-banner');
    imageArea.style.display = '';
    dividerLine.style.display = '';
    cardImage.src = 'images/takeru-menu.jpg';
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    };
}

// ご案内はメインメニューの大パネル（takeru-top.jpg）を一覧でもカードでも出し続ける。
// 受講のように「低いバナー→カード図表」へは変えない。
function showMainPanel() {
    imageArea.style.display = '';
    dividerLine.style.display = '';
    imageArea.classList.remove('menu-banner');   // 低いバナーにしない＝大パネルのまま
    imageArea.classList.remove('has-image');      // 拡大印は出さない
    cardImage.classList.remove('complete-mascot');
    cardImage.src = 'images/takeru-top.jpg';
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    };
}

// ==========================================
// トップメニュー
// ==========================================
function showTopMenu() {
    navState = 'top';
    isMenuVisible = true;
    stopVoice();
    clearCard();
    exitLinkFullscreen();
    exitMenuFull();
    showMenuView();
    btnSettings.style.display = 'block';

    imageArea.classList.remove('menu-banner');   // トップは大パネル。低い枠を必ず解除
    cardImage.src = 'images/takeru-top.jpg';
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    };

    menuContent.innerHTML = `
        <div class="top-menu-wrap">
            <button class="top-btn btn-guide" data-action="guide">📖 アカデミーのご案内</button>
            <button class="top-btn btn-jukou" data-action="jukou">📚 受　講</button>
            <button class="top-btn btn-freestudy" data-action="freestudy">🔬 自由研究</button>
            <button class="top-btn btn-news" data-action="news">📰 ニュース・お知らせ${hasUnreadNews() ? '<span class="news-badge"></span>' : ''}</button>
            <button class="top-btn btn-links" data-action="links">🔗 リンク集</button>
            <div class="top-btn-row">
                <button class="top-btn btn-exam" data-action="exam">📝 受験案内</button>
                <button class="top-btn btn-howto" data-action="register">✉️ 登録案内</button>
            </div>
            <div class="top-beta">β版（試験公開中）</div>
            ${installLinkHtml()}
        </div>
    `;
    menuContent.onclick = (e) => {
        const btn = e.target.closest('.top-btn');
        if (!btn) return;
        if (btn.dataset.action === 'guide') showGuideMenu();
        else if (btn.dataset.action === 'jukou') showGradeMenu();
        else if (btn.dataset.action === 'links') showLinkGenreMenu();
        else if (btn.dataset.action === 'register') showRegisterInfo();
        else if (btn.dataset.action === 'news') showNews();
        else if (btn.dataset.action === 'freestudy') showFreeMenu();
        else showPlaceholder(btn.innerText);
    };
}

// アカデミーのご案内（受講と同じ2階層：ユニット→カード。級・科目の選択は挟まない）
const GUIDE_SUBJECT = '案内';

function showGuideMenu() {
    navState = 'guide';
    isMenuVisible = true;
    curSubject = GUIDE_SUBJECT;
    curGenre = '';
    btnSettings.style.display = 'none';
    showMainPanel();          // ご案内はメインメニューの大パネルを継続
    showMenuView();

    const units = [...new Set(cardData.filter(d => d.subject === GUIDE_SUBJECT).map(d => d.genre))];
    let html = `
        <div class="sticky-head">
            <div class="single-banner-wrap">
                <div class="top-btn btn-guide banner-btn banner-small">📖 アカデミーのご案内</div>
            </div>
            <div class="genre-panel-label label-section">目次</div>
        </div>
        <div class="genre-list-wrap">`;
    units.forEach(u => {
        html += hasVisibleCards(cardData.filter(d => d.genre === u))
            ? `<button class="genre-btn" data-genre="${u}">${u}</button>`
            : `<button class="genre-btn btn-coming" disabled>${u}</button>`;
    });
    html += `</div>`;
    html += `<div class="guide-install-wrap">${installLinkHtml('guide')}</div>`;
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const item = e.target.closest('.genre-btn');
        if (!item || !item.dataset.genre) return;
        showGuideCards(item.dataset.genre);
    };
}

function showGuideCards(genre) {
    navState = 'cardlist';
    isMenuVisible = true;
    curSubject = GUIDE_SUBJECT;
    const isReturn = curGenre === genre && curSection.length > 0;
    curGenre = genre;
    curSection = visibleOf(cardData.filter(d => d.genre === genre));
    if (!isReturn) curIndex = 0;
    showMainPanel();          // ご案内はメインメニューの大パネルを継続
    showMenuView();

    // ご案内の中は、ずっと同じ「アカデミーのご案内」看板で通す（受講のように科目名へ変えない）
    let html = `
        <div class="sticky-head">
            <div class="single-banner-wrap">
                <div class="top-btn btn-guide banner-btn banner-small">📖 アカデミーのご案内</div>
            </div>
            ${genreHeaderHtml(genre)}
        </div>
        <div class="card-list-body">`;
    curSection.forEach((card, i) => {
        html += `<div class="menu-item" data-idx="${i}"><span class="item-dot">●</span> ${card.title}</div>`;
    });
    html += `</div>`;
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        if (e.target.closest('.gnav-prev')) { stepGenre(-1); return; }
        if (e.target.closest('.gnav-next')) { stepGenre(1); return; }
        const item = e.target.closest('.menu-item');
        if (!item) return;
        const idx = parseInt(item.dataset.idx);
        if (!isNaN(idx)) showCard(idx);
    };
}

// ==========================================
// 自由研究（著者から探す／テーマから探す の2つの入口）
//   データは TAKERUcard.csv に同居（科目='自由研究'）。
//   著者・テーマ・PDF は8〜10列目。テーマは複数可（; 区切り）。
// ==========================================
const FREE_SUBJECT = '自由研究';
let freeTab = 'author';        // author=著者から／theme=テーマから
let freeTheme = '';            // テーマ絞り込み中のテーマ名

function freeCards() {
    return cardData.filter(d => d.subject === FREE_SUBJECT);
}
// 講座（ユニット）単位でまとめる。表示順はCSVの登場順。
function freeUnits(filterFn) {
    const units = [];
    for (const c of freeCards()) {
        if (filterFn && !filterFn(c)) continue;
        if (!units.includes(c.genre)) units.push(c.genre);
    }
    return units;
}
function unitAuthor(unit) {
    const c = freeCards().find(d => d.genre === unit);
    return c ? c.author : '';
}
function freeBanner() {
    return `<div class="top-btn btn-freestudy banner-btn banner-small">🔬 自由研究</div>`;
}
// PDF列があるカードに「資料をダウンロード」ボタンを添える（pdf/ フォルダに置く）
function pdfLinkHtml(card) {
    if (!card || !card.pdf) return '';
    const href = /^https?:\/\//.test(card.pdf) ? card.pdf : `pdf/${card.pdf}`;
    return `<div class="card-pdf"><a href="${escHtml(href)}" target="_blank" rel="noopener" download>📄 資料をダウンロード（PDF）</a></div>`;
}

function showFreeMenu(tab) {
    freeTab = tab || freeTab || 'author';
    navState = 'free';
    isMenuVisible = true;
    curSubject = FREE_SUBJECT;
    curGenre = '';
    freeTheme = '';
    btnSettings.style.display = 'none';
    showMenuBanner();
    showMenuView();

    const tabs = `
        <div class="news-tabs free-tabs">
            <button class="news-tab ${freeTab==='author'?'active':''}" data-ftab="author">著者から</button>
            <button class="news-tab ${freeTab==='theme'?'active':''}" data-ftab="theme">テーマから</button>
        </div>`;

    let body = '';
    if (freeTab === 'author') {
        // 著者ごとに講座を並べる
        const authors = [];
        for (const c of freeCards()) if (c.author && !authors.includes(c.author)) authors.push(c.author);
        if (!authors.length) {
            body = `<div class="news-empty">準備中です。</div>`;
        } else {
            body = '<div class="card-list-body">';
            for (const a of authors) {
                body += `<div class="section-header">${escHtml(a)}${a === 'MSフォーラム' ? '' : ' の自由研究'}</div>`;
                for (const u of freeUnits(c => c.author === a)) {
                    const enabled = hasVisibleCards(freeCards().filter(d => d.genre === u));
                    body += enabled
                        ? `<div class="menu-item free-unit" data-unit="${escHtml(u)}"><span class="item-dot">●</span> ${escHtml(u)}</div>`
                        : `<div class="menu-item link-coming">${escHtml(u)}（準備中）</div>`;
                }
            }
            body += '</div>';
        }
    } else {
        // テーマ一覧（そのテーマを含む講座がある分だけ）
        const themes = [];
        for (const c of freeCards()) for (const t of c.themes) if (!themes.includes(t)) themes.push(t);
        if (!themes.length) {
            body = `<div class="news-empty">準備中です。</div>`;
        } else {
            body = '<div class="genre-list-wrap">';
            for (const t of themes) {
                const n = freeUnits(c => c.themes.includes(t)).length;
                body += `<button class="genre-btn free-theme" data-theme="${escHtml(t)}">${escHtml(t)}<span class="free-theme-count">${n}</span></button>`;
            }
            body += '</div>';
        }
    }

    menuContent.innerHTML = `
        <div class="sticky-head">
            <div class="single-banner-wrap free-wrap">${freeBanner()}</div>
            ${tabs}
        </div>
        ${body}`;

    menuContent.onclick = (e) => {
        const tb = e.target.closest('.news-tab');
        if (tb) { showFreeMenu(tb.dataset.ftab); return; }
        const th = e.target.closest('.free-theme');
        if (th) { showFreeThemeUnits(th.dataset.theme); return; }
        const u = e.target.closest('.free-unit');
        if (u) { showFreeUnit(u.dataset.unit); return; }
    };
}

// テーマを選んだあとの講座一覧
function showFreeThemeUnits(theme) {
    navState = 'freetheme';
    isMenuVisible = true;
    curSubject = FREE_SUBJECT;
    freeTheme = theme;
    showMenuBanner();
    showMenuView();

    const units = freeUnits(c => c.themes.includes(theme));
    let html = `
        <div class="sticky-head">
            <div class="double-banner-wrap free-wrap">
                ${freeBanner()}
                <div class="genre-btn banner-btn banner-small">${escHtml(theme)}</div>
            </div>
        </div>
        <div class="card-list-body">`;
    for (const u of units) {
        const author = unitAuthor(u);
        const enabled = hasVisibleCards(freeCards().filter(d => d.genre === u));
        html += enabled
            ? `<div class="menu-item free-unit" data-unit="${escHtml(u)}">
                 <span class="item-dot">●</span>
                 <span class="free-unit-name">${escHtml(u)}</span>
                 <span class="free-unit-author">${escHtml(author)}</span>
               </div>`
            : `<div class="menu-item link-coming">${escHtml(u)}（準備中）</div>`;
    }
    html += '</div>';
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const u = e.target.closest('.free-unit');
        if (u) showFreeUnit(u.dataset.unit);
    };
}

// 講座を選んだあと：サブユニットがあれば見出し付き、なければフラットで一覧
function showFreeUnit(unit) {
    navState = 'freeunit';
    isMenuVisible = true;
    curSubject = FREE_SUBJECT;
    curGenre = unit;
    showMenuBanner();
    showMenuView();

    const cards = freeCards().filter(d => d.genre === unit);
    const hasSections = cards.some(d => d.section !== '');
    const author = unitAuthor(unit);

    let html = `
        <div class="sticky-head">
            <div class="double-banner-wrap free-wrap">
                ${freeBanner()}
                <div class="genre-btn banner-btn banner-small">${escHtml(author)}</div>
            </div>
            <div class="genre-panel-label label-section label-theme theme-start" data-start="1"><span class="theme-tag">テーマ</span><span class="theme-name">${escHtml(unit)}</span><span class="theme-go" title="第1話へ">▶</span></div>
        </div>
        <div class="card-list-body">`;

    if (hasSections) {
        const sections = [...new Set(cards.map(d => d.section))];
        for (const s of sections) {
            const sCards = visibleOf(cards.filter(d => d.section === s));
            if (!sCards.length) continue;
            html += `<div class="section-header">${escHtml(s)}</div>`;
            sCards.forEach((card, i) => {
                html += `<div class="menu-item" data-section="${escHtml(s)}" data-section-idx="${i}"><span class="item-dot">●</span> ${escHtml(card.title)}</div>`;
            });
        }
    } else {
        curSection = visibleOf(cards);
        curSection.forEach((card, i) => {
            html += `<div class="menu-item" data-idx="${i}"><span class="item-dot">●</span> ${escHtml(card.title)}</div>`;
        });
    }
    html += '</div>';
    menuContent.innerHTML = html;

    menuContent.onclick = (e) => {
        // テーマ名のパネルを押したら第1話から始める
        if (e.target.closest('.theme-start')) { startFreeUnitFromTop(unit); return; }
        const secItem = e.target.closest('.menu-item[data-section]');
        if (secItem) {
            const section = secItem.dataset.section;
            const idx = parseInt(secItem.dataset.sectionIdx);
            if (section && !isNaN(idx)) {
                curSection = visibleOf(cardData.filter(d => d.genre === curGenre && d.section === section));
                showCard(idx);
            }
            return;
        }
        const item = e.target.closest('.menu-item[data-idx]');
        if (item) {
            const idx = parseInt(item.dataset.idx);
            if (!isNaN(idx)) showCard(idx);
        }
    };
}

// テーマのパネルから「第1話」を開く。サブテーマがある場合は最初のサブテーマの1枚目。
function startFreeUnitFromTop(unit) {
    const cards = freeCards().filter(d => d.genre === unit);
    const first = visibleOf(cards)[0];
    if (!first) return;
    curGenre = unit;
    curSection = first.section
        ? visibleOf(cards.filter(d => d.section === first.section))
        : visibleOf(cards);
    showCard(0);
}

// ==========================================
// 級選択（受講ボタンを看板として持ち込み）
// ==========================================
function showGradeMenu() {
    navState = 'subject';
    isMenuVisible = true;
    btnSettings.style.display = 'none';
    showMenuBanner();
    showMenuView();

    // 3級の各科目を明るさ3段階で。full=明（通常）/ preview=中（タイトルまで）/ coming=暗。
    // 判定はデータ由来（subjectTier）なので dev/prod で同じ見え方になる。
    const grade3 = [
        ['3級-軍事と戦略', '軍事と戦略'],
        ['3級-国家と法律', '国家と法律'],
        ['3級-戦争の歴史', '戦争の歴史']
    ];
    const grade3Html = grade3.map(([subj, label]) => {
        const tier = subjectTier(subj);
        // full=明・押せる／preview=中・押せる（中でユニット名まで見せる）／coming=暗・押せない
        if (tier === 'full')    return `<button class="subject-btn btn-grade3" data-subject="${subj}">${label}</button>`;
        if (tier === 'preview') return `<button class="subject-btn btn-preview" data-subject="${subj}">${label}</button>`;
        return `<button class="subject-btn btn-coming" disabled>${label}</button>`;
    }).join('');

    menuContent.innerHTML = `
        <div class="sub-menu-wrap">
            <div class="top-btn btn-jukou banner-btn">📚 受　講</div>
            <div class="sub-panel-wrap">
                <div class="grade-label grade-label-1">１級</div>
                <div class="subject-row">
                    <button class="subject-btn btn-coming" disabled>軍事と戦略</button>
                    <button class="subject-btn btn-coming" disabled>国家と法律</button>
                    <button class="subject-btn btn-coming" disabled>戦争の歴史</button>
                </div>
                <div class="grade-label grade-label-2">２級</div>
                <div class="subject-row">
                    <button class="subject-btn btn-coming" disabled>軍事と戦略</button>
                    <button class="subject-btn btn-coming" disabled>国家と法律</button>
                    <button class="subject-btn btn-coming" disabled>戦争の歴史</button>
                </div>
                <div class="grade-label grade-label-3">３級</div>
                <div class="subject-row">${grade3Html}</div>
            </div>
        </div>
    `;
    menuContent.onclick = (e) => {
        const btn = e.target.closest('.subject-btn[data-subject]');
        if (!btn) return;
        curSubject = btn.dataset.subject;
        showGenreMenu();
    };
}

// ==========================================
// ジャンル→セクション→カード
// 受講2層目：「受講」＋「3級 戦士の視点」の2枚看板
// ==========================================

// 看板の科目表示。"3級-軍事と戦略" → "軍事と戦略　３級"（科目名を先、級を後ろに）
function formatSubjectBanner(subject) {
    const m = /^(\d)級-(.+)$/.exec(subject);
    if (!m) return subject;
    const grade = { '1': '１級', '2': '２級', '3': '３級' }[m[1]] || (m[1] + '級');
    return `${m[2]}　${grade}`;
}

function showGenreMenu() {
    navState = 'genre';
    isMenuVisible = true;
    showMenuBanner();
    showMenuView();
    const genres = [...new Set(cardData.filter(d => d.subject === curSubject).map(d => d.genre))];
    const subjectBanner = formatSubjectBanner(curSubject);
    let html = `
        <div class="sticky-head">
            <div class="double-banner-wrap">
                <div class="top-btn btn-jukou banner-btn banner-small">📚 受　講</div>
                <div class="grade-btn btn-grade3 banner-btn banner-small">${subjectBanner}</div>
            </div>
            <div class="genre-panel-label label-section">テーマ一覧</div>
        </div>
    `;
    // preview科目（作成中）：ユニット名は見せるが、個別カードはまだ仮なので開かせない。
    //   各ユニットを「作成中」バッジ付きの押せないタイルにする。
    // それ以外：配下に見えるカードがあれば点灯、無ければ暗く（btn-coming）。
    const isPreviewSubject = subjectTier(curSubject) === 'preview';
    let genreHtml = '';
    genres.forEach(g => {
        if (isPreviewSubject) {
            genreHtml += `<button class="genre-btn btn-preview" disabled>${g}<span class="wip-tag">作成中</span></button>`;
        } else {
            genreHtml += hasVisibleCards(cardData.filter(d => d.genre === g))
                ? `<button class="genre-btn" data-genre="${g}">${g}</button>`
                : `<button class="genre-btn btn-coming" disabled>${g}</button>`;
        }
    });
    html += `<div class="genre-list-wrap">${genreHtml}</div>`;
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const item = e.target.closest('.genre-btn');
        if (!item) return;
        const genre = item.dataset.genre;
        if (!genre) return;
        const hasSections = cardData.filter(d => d.genre === genre).some(d => d.section !== '');
        if (hasSections) showSectionedCardList(genre);
        else showFlatCardList(genre);
    };
}

// カード一覧のジャンル見出し。左右に ◀▶ を付け、同じ科目内の
// 別ユニット（テーマ）へ横移動できるようにする（第1メニューへ戻らずに済む）。
function siblingGenres() {
    return [...new Set(cardData.filter(d => d.subject === curSubject).map(d => d.genre))];
}
function genreHeaderHtml(genre) {
    const list = siblingGenres();
    const i = list.indexOf(genre);
    const prevDis = i <= 0 ? 'disabled' : '';
    const nextDis = (i < 0 || i >= list.length - 1) ? 'disabled' : '';
    return `<div class="genre-panel-label label-genre-header">
        <button class="genre-nav-btn gnav-prev" ${prevDis} aria-label="前のテーマ">◀</button>
        <span class="genre-nav-name">${genre}</span>
        <button class="genre-nav-btn gnav-next" ${nextDis} aria-label="次のテーマ">▶</button>
    </div>`;
}
function gotoGenre(genre) {
    if (curSubject === GUIDE_SUBJECT) { showGuideCards(genre); return; }
    const hasSections = cardData.filter(d => d.genre === genre).some(d => d.section !== '');
    if (hasSections) showSectionedCardList(genre);
    else showFlatCardList(genre);
}
function stepGenre(dir) {
    const list = siblingGenres();
    const j = list.indexOf(curGenre) + dir;
    if (j >= 0 && j < list.length) gotoGenre(list[j]);
}

function showSectionMenu(genre) {
    navState = 'section';
    isMenuVisible = true;
    curGenre = genre;
    showMenuBanner();
    showMenuView();
    const sections = [...new Set(cardData.filter(d => d.genre === genre).map(d => d.section))];
    let html = `<div class="menu-label">${genre}</div>`;
    sections.forEach(s => {
        const count = cardData.filter(d => d.section === s).length;
        html += `<div class="menu-item" data-section="${s}"><span class="item-dot">●</span> ${s} <span style="margin-left:auto;font-size:0.85em">${count}枚</span></div>`;
    });
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        const section = item.dataset.section;
        if (section) showCardList(section);
    };
}

function showCardList(section) {
    navState = 'cardlist';
    isMenuVisible = true;
    curSection = visibleOf(cardData.filter(d => d.section === section));
    curIndex = 0;
    showMenuBanner();
    showMenuView();
    let html = `<div class="menu-label">${section}</div>`;
    curSection.forEach((card, i) => {
        html += `<div class="menu-item" data-idx="${i}"><span class="item-dot">●</span> ${card.title}</div>`;
    });
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        const idx = parseInt(item.dataset.idx);
        if (!isNaN(idx)) showCard(idx);
    };
}

function showSectionedCardList(genre) {
    navState = 'sectionedlist';
    isMenuVisible = true;
    curGenre = genre;
    showMenuBanner();
    showMenuView();

    const genreCards = cardData.filter(d => d.genre === genre);
    const sections = [...new Set(genreCards.map(d => d.section))];
    const subjectBannerS = formatSubjectBanner(curSubject);

    let html = `
        <div class="sticky-head">
            <div class="double-banner-wrap banner-xs-wrap">
                <div class="top-btn btn-jukou banner-btn banner-xs">📚 受　講</div>
                <div class="grade-btn btn-grade3 banner-btn banner-xs">${subjectBannerS}</div>
            </div>
            ${genreHeaderHtml(genre)}
        </div>
    `;
    // 一覧本体は箱で包む（広い画面で「左を埋めてから右へ折り返す」段組にするため）
    html += '<div class="card-list-body">';
    sections.forEach(s => {
        const sCards = visibleOf(genreCards.filter(d => d.section === s));
        if (!sCards.length) return;   // 見えるカードのないセクションは見出しごと出さない
        html += `<div class="section-header">${s}</div>`;
        sCards.forEach((card, i) => {
            html += `<div class="menu-item" data-section="${s}" data-section-idx="${i}"><span class="item-dot">●</span> ${card.title}</div>`;
        });
    });
    html += '</div>';

    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        if (e.target.closest('.gnav-prev')) { stepGenre(-1); return; }
        if (e.target.closest('.gnav-next')) { stepGenre(1); return; }
        const item = e.target.closest('.menu-item[data-section]');
        if (!item) return;
        const section = item.dataset.section;
        const idx = parseInt(item.dataset.sectionIdx);
        if (section && !isNaN(idx)) {
            // data-section-idx は「見えるカード」内の番号なので、curSection も見えるカードで揃える
            curSection = visibleOf(cardData.filter(d => d.genre === curGenre && d.section === section));
            showCard(idx);
        }
    };
}

function showFlatCardList(genre) {
    navState = 'cardlist';
    isMenuVisible = true;
    const isReturn = curGenre === genre && curSection.length > 0;
    curGenre = genre;
    curSection = visibleOf(cardData.filter(d => d.genre === genre));
    if (!isReturn) curIndex = 0;
    showMenuBanner();
    showMenuView();

    const subjectBannerF = formatSubjectBanner(curSubject);
    let html = `
        <div class="sticky-head">
            <div class="double-banner-wrap banner-xs-wrap">
                <div class="top-btn btn-jukou banner-btn banner-xs">📚 受　講</div>
                <div class="grade-btn btn-grade3 banner-btn banner-xs">${subjectBannerF}</div>
            </div>
            ${genreHeaderHtml(genre)}
        </div>`;
    // 一覧本体は箱で包む（広い画面で「左を埋めてから右へ折り返す」段組にするため）
    html += '<div class="card-list-body">';
    curSection.forEach((card, i) => {
        const type = /\dF\d+$/.test(card.id) ? 'fact' : /\dC\d+$/.test(card.id) ? 'com' : null;
        const badge = type ? `<span class="card-badge badge-${type}">${type === 'fact' ? '史実' : '解説'}</span> ` : '';
        const title = card.title.replace(/^→/, '').trim();
        html += `<div class="menu-item" data-idx="${i}"><span class="item-dot">●</span> ${badge}${title}</div>`;
    });
    html += '</div>';
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        if (e.target.closest('.gnav-prev')) { stepGenre(-1); return; }
        if (e.target.closest('.gnav-next')) { stepGenre(1); return; }
        const item = e.target.closest('.menu-item');
        if (!item) return;
        const idx = parseInt(item.dataset.idx);
        if (!isNaN(idx)) showCard(idx);
    };
}

// 本文中のリンクを扱う。
//   ・[表示名](https://…) → 表示名のリンク
//   ・素の https://… もそのままリンク
// カード本文は自分たちのCSV（信頼できる）だが、念のためHTMLはエスケープしてから組む。
function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function bodyToHtml(text) {
    text = String(text || '');
    const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(text))) {
        out += escHtml(text.slice(last, m.index));
        if (m[2]) {                       // [表示名](URL)
            out += `<a href="${escHtml(m[2])}" target="_blank" rel="noopener">${escHtml(m[1])}</a>`;
        } else {                          // 素のURL（末尾の句読点はリンクから外す）
            let u = m[3], trail = '';
            const tm = u.match(/[)。、.,!?！？」』]+$/);
            if (tm) { trail = u.slice(-tm[0].length); u = u.slice(0, -tm[0].length); }
            out += `<a href="${escHtml(u)}" target="_blank" rel="noopener">${escHtml(u)}</a>` + escHtml(trail);
        }
        last = re.lastIndex;
    }
    out += escHtml(text.slice(last));
    return out;
}
// 読み上げ用：リンク記法を読みやすい文字に（[表示名](URL)→表示名、素のURLは読まない）
function bodyToPlain(text) {
    return String(text || '')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1')
        .replace(/https?:\/\/[^\s<]+/g, '');
}

function showCard(idx) {
    if (!curSection.length) return;
    curIndex = Math.max(0, Math.min(idx, curSection.length - 1));
    const card = curSection[curIndex];

    navState = 'card';
    logAccess('card_view', card.id);        // 連続再生での表示も1回として数える
    isMenuVisible = false;
    mp3Failed = false;
    hideVoiceWarning();
    exitMenuFull();
    showTextView();

    const cardType = /\dF\d+$/.test(card.id) ? 'fact' : /\dC\d+$/.test(card.id) ? 'com' : null;
    const typeBadge = cardType ? ` <span class="card-badge badge-${cardType}">${cardType === 'fact' ? '史実' : '解説'}</span>` : '';
    // カード番号は進捗行の右端に小さく出す（ご意見フォームでカードを特定してもらうため）
    const codeTag = `<span class="card-code">${card.id}</span>`;
    if (card.section) {
        cardProgress.innerHTML =
            `<div class="prog-unit">${curGenre}</div>` +
            `<div class="prog-row"><span>${card.section}　${curIndex + 1} / ${curSection.length}${typeBadge}</span>${codeTag}</div>`;
    } else {
        cardProgress.innerHTML =
            `<div class="prog-row"><span>${curGenre}　${curIndex + 1} / ${curSection.length}${typeBadge}</span>${codeTag}</div>`;
    }
    cardTitle.innerText = card.title.replace(/^→/, '').trim();
    // 本文中のURL・[表示名](URL)をリンク化。PDF指定があればダウンロードボタンを添える
    cardBody.innerHTML = bodyToHtml(card.body) + pdfLinkHtml(card);
    textView.scrollTop = 0;

    if (curSubject === GUIDE_SUBJECT) {
        // ご案内のカードはメインメニューの大パネルを継続（図表は出さない）
        showMainPanel();
    } else {
        // カード画像は.jpgに統一済み。.pngは旧データ用のフォールバックとして残す
        cardImage.classList.remove('complete-mascot');   // 完了画面のマスコット指定を解除
        imageArea.classList.remove('menu-banner');       // 化粧パネル用の低い枠を必ず解除
        cardImage.src = `images/${card.id}.jpg`;
        cardImage.style.display = 'block';
        imagePlaceholder.style.display = 'none';
        imageArea.classList.add('has-image');   // 拡大できる印（⛶）を出す
        cardImage.onerror = () => {
            cardImage.src = `images/${card.id}.png`;
            cardImage.onerror = () => {
                cardImage.style.display = 'none';
                imagePlaceholder.style.display = 'flex';
                imageArea.classList.remove('has-image');
            };
        };
    }

    document.querySelectorAll('#menu-content .menu-item').forEach((el, i) => {
        el.classList.toggle('active-item', i === curIndex);
    });

    stopVoice();
    if (autoRead) setTimeout(() => playVoiceDirect(), 300);
}

// ==========================================
// リンク集（リンク集ボタンを看板として持ち込み）
// ==========================================
// ==========================================
// リンク集の使い方（リンク集の9つ目）
//   使う場所のすぐ隣に置く。何がどこにあるか、どう使い分けるかを一枚で。
// ==========================================
function showLinkHelp() {
    navState = 'linkhelp';
    isMenuVisible = false;
    showTextView();
    showMenuBanner();
    cardProgress.innerText = '';
    cardTitle.innerText = 'リンク集の使い方';
    cardBody.innerHTML = LINK_HELP_HTML +
        `<div class="reg-back"><button class="reg-backbtn" onclick="showLinkGenreMenu()">← リンク集に戻る</button></div>`;
    textView.scrollTop = 0;
}

const LINK_HELP_HTML = `
<div class="reg-priv-doc lh-doc">
  <p>防衛・安全保障を調べるときの入口を、<strong>172件</strong>集めた場所です。
  官庁や研究機関の公式サイトが中心で、信頼できるものだけを選んでいます。</p>

  <h3 class="lh-h">まず、どこを見ればよいか</h3>
  <ul class="lh-list">
    <li><strong>何が起きているか知りたい</strong> → 📰 ニュース・情勢</li>
    <li><strong>自衛隊のことを知りたい</strong> → 🛡 日本の防衛・自衛隊</li>
    <li><strong>言葉の意味を調べたい</strong> → 🔍 調べる道具</li>
    <li><strong>正確な数字が欲しい</strong> → 🗺 地図・地形・データ（軍事費・兵力の統計）</li>
    <li><strong>原典に当たりたい</strong> → 📚 公式機関・1次資料／📜 歴史・教養</li>
  </ul>

  <h3 class="lh-h">8つのジャンル</h3>
  <ul class="lh-list">
    <li><strong>公式機関・1次資料</strong>（36）… 官庁・国連・NATO・白書。<em>すべての土台</em></li>
    <li><strong>日本の防衛・自衛隊</strong>（28）… 組織・駐屯地・装備・採用。<em>基地見学やイベントの情報も</em></li>
    <li><strong>世界の軍事</strong>（24）… 各国の国防省、軍事力の比較、研究機関</li>
    <li><strong>戦略・戦争</strong>（25）… 戦略とは何か、作戦、兵站、サイバー・宇宙</li>
    <li><strong>地図・地形・データ</strong>（20）… <em>使える道具</em>。地形の断面図、距離と射程、統計</li>
    <li><strong>ニュース・情勢</strong>（24）… 専門紙・海外メディア・論考</li>
    <li><strong>歴史・教養</strong>（15）… 資料館、そして<em>当時の公文書そのもの</em></li>
    <li><strong>調べる道具</strong>（8）… 言葉を入れて、その場で検索</li>
  </ul>

  <h3 class="lh-h">知っておくと便利なこと</h3>
  <p><span class="link-badge badge-jp">JP</span> の印が付いたものは、<strong>自動で日本語に訳して開きます</strong>。
  海外のサイトでも、そのまま読めます。うまく訳せないときは英語のまま開きますが、
  パソコンならブラウザの翻訳機能（右クリック →「日本語に翻訳」）が使えます。</p>
  <p><span class="link-badge badge-pdf">PDF</span> の印は、PDFの資料が開きます。</p>

  <h3 class="lh-h">とくに勧めたいもの</h3>
  <ul class="lh-list">
    <li><strong>地理院地図の断面図</strong>（地図・地形）… 地図に線を引くと、その経路の高低差がグラフになります。
    「この尾根の向こうは見えるか」を自分で確かめられます</li>
    <li><strong>Great Circle Mapper</strong>（地図・地形）… 2点間の距離を測り、<strong>指定した距離の円を描けます</strong>。
    射程の話が具体的になります</li>
    <li><strong>Flightradar24・MarineTraffic</strong>（地図・地形）… 航空機と船の現在位置。
    ニュースで聞いた動きをその場で確かめられます</li>
    <li><strong>アジア歴史資料センター</strong>（調べる道具）… 戦前・戦中の公文書の<strong>原本</strong>が
    200万件。大本営の命令書や外交電報が、当時の紙のまま読めます</li>
    <li><strong>朝雲デジタル</strong>（ニュース）… 自衛隊の専門紙。一般にはあまり知られていません</li>
  </ul>

  <h3 class="lh-h">使うときの心得</h3>
  <p><strong>公式サイトを先に見る</strong>のが基本です。まとめサイトや解説より、
  官庁や研究機関が出している資料のほうが確かです。数字を引くときは、
  <strong>いつの時点のものか</strong>を確かめてください。</p>
  <p>リンク先の内容は、それぞれの発信者によるものです。
  MSアカデミーの見解とは限りません。</p>
  <p class="reg-priv-note">開かないリンクがあれば、ご意見フォームからお知らせください。直します。</p>
</div>`;

// ==========================================
// 調べる道具（リンク集の8つ目）
//   他のジャンルと違い、語を入れてボタンを押すとその場で検索結果へ飛ぶ。
//   検索できるのは「URLに語を埋め込める」サービスだけ。CiNiiやアジ歴は
//   画面側で検索する作りのためURLでは渡せず、入口を開くだけにしてある。
// ==========================================
const SEARCH_TOOLS = [
    { key: 'wikija', label: '📖 Wikipedia（日本語）', note: '用語や人物の概要をつかむ',
      url: q => 'https://ja.wikipedia.org/w/index.php?search=' + encodeURIComponent(q) },
    { key: 'wikien', label: '📘 Wikipedia（英語）', note: '日本語版に無い項目・装備に強い',
      url: q => 'https://en.wikipedia.org/w/index.php?search=' + encodeURIComponent(q) },
    { key: 'ndl', label: '📚 国会図書館サーチ', note: '本・雑誌記事・論文をまとめて探す',
      url: q => 'https://ndlsearch.ndl.go.jp/search?cs=bib&keyword=' + encodeURIComponent(q) },
    { key: 'scholar', label: '🎓 Google Scholar', note: '学術論文を探す',
      url: q => 'https://scholar.google.com/scholar?hl=ja&q=' + encodeURIComponent(q) },
    { key: 'gimg', label: '🖼 画像で探す', note: '装備や地形を写真で確かめる',
      url: q => 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q) },
];
// 語を渡せない（画面側で検索する）サービス。入口だけ開く。
const SEARCH_SITES = [
    { label: '📂 アジア歴史資料センター', note: '戦前・戦中の公文書の原本を探す。200万件・3000万画像',
      url: 'https://www.jacar.archives.go.jp/aj/search' },
    { label: '📄 CiNii Research', note: '日本の論文・研究データを探す',
      url: 'https://cir.nii.ac.jp/' },
    { label: '📜 国会図書館デジタルコレクション', note: '著作権の切れた本や古い資料を、その場で読む',
      url: 'https://dl.ndl.go.jp/' },
];

function showSearchTools() {
    navState = 'searchtool';
    isMenuVisible = true;
    curLinkGenre = '';
    enterLinkFullscreen();
    showMenuView();

    const saved = (() => { try { return localStorage.getItem('takeru_search_q') || ''; } catch (e) { return ''; } })();

    let html = `
        <div class="sub-menu-wrap">
            <div class="double-banner-wrap">
                <div class="top-btn btn-links banner-btn banner-small">🔗 リンク集</div>
                <div class="link-genre-btn banner-btn banner-small"><span class="link-genre-name">調べる道具</span></div>
            </div>
            <div class="st-box">
                <div class="st-lead">調べたい言葉を入れて、探す先を選んでください。</div>
                <input type="search" id="st-input" class="st-input" placeholder="例：制海権、F-35、ホルムズ海峡"
                       value="${escHtml(saved)}" autocomplete="off" enterkeyhint="search">
                <div class="st-grid">`;
    SEARCH_TOOLS.forEach(t => {
        html += `<button class="st-btn" data-tool="${t.key}">
                    <span class="st-btn-label">${t.label}</span>
                    <span class="st-btn-note">${t.note}</span>
                 </button>`;
    });
    html += `   </div>
            </div>
            <div class="link-field-header">語を入れずに、そのまま開いて探す</div>`;
    SEARCH_SITES.forEach((s, i) => {
        html += `<div class="menu-item link-item st-site" data-site="${i}">
                    <span class="link-name">${s.label}<span class="st-site-note">${s.note}</span></span>
                    <span class="link-arrow">↗</span>
                 </div>`;
    });
    html += `</div>`;
    menuContent.innerHTML = html;

    const input = document.getElementById('st-input');
    const run = (tool) => {
        const q = (input && input.value || '').trim();
        if (!q) { input && input.focus(); return; }
        try { localStorage.setItem('takeru_search_q', q); } catch (e) {}
        window.open(tool.url(q), '_blank');
    };
    // Enterでは最初の道具（Wikipedia日本語）を開く
    if (input) input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); run(SEARCH_TOOLS[0]); }
    });
    menuContent.onclick = (e) => {
        const b = e.target.closest('.st-btn');
        if (b) { const t = SEARCH_TOOLS.find(x => x.key === b.dataset.tool); if (t) run(t); return; }
        const s = e.target.closest('.st-site');
        if (s) { const site = SEARCH_SITES[parseInt(s.dataset.site, 10)]; if (site) window.open(site.url, '_blank'); }
    };
}

function showLinkGenreMenu() {
    navState = 'linkgenre';
    isMenuVisible = true;
    curLinkGenre = '';
    enterLinkFullscreen();
    showMenuView();

    const genres = [...new Set(linkData.map(d => d.genre))];

    let html = `
        <div class="sub-menu-wrap">
            <div class="top-btn btn-links banner-btn">🔗 リンク集</div>
            <div class="sub-panel-wrap">
    `;
    genres.forEach(g => {
        const active = linkData.filter(d => d.genre === g && d.url && d.name !== '準備中').length;
        const total = linkData.filter(d => d.genre === g).length;
        html += `
            <button class="link-genre-btn" data-genre="${g}">
                <span class="link-genre-name">${g}</span>
                <span class="link-genre-count">${active}/${total}</span>
            </button>
        `;
    });
    // 8つ目は趣向が違う。語を入れて調べる道具（CSVではなくアプリが持つ）
    html += `
            <button class="link-genre-btn link-genre-tool" data-tool="1">
                <span class="link-genre-name">🔍 調べる道具</span>
                <span class="link-genre-count">${SEARCH_TOOLS.length + SEARCH_SITES.length}</span>
            </button>
            <button class="link-genre-btn link-genre-help" data-help="1">
                <span class="link-genre-name">📘 リンク集の使い方</span>
            </button>`;
    html += `</div></div>`;
    menuContent.innerHTML = html;

    menuContent.onclick = (e) => {
        const btn = e.target.closest('.link-genre-btn');
        if (!btn) return;
        if (btn.dataset.tool) { showSearchTools(); return; }
        if (btn.dataset.help) { showLinkHelp(); return; }
        curLinkGenre = btn.dataset.genre;
        showLinkList(curLinkGenre);
    };
}

// リンク集2層目：「リンク集」＋「ジャンル名」の2枚看板
function showLinkList(genre) {
    navState = 'linklist';
    isMenuVisible = true;
    showMenuView();

    const items = linkData.filter(d => d.genre === genre);
    const fields = [...new Set(items.map(d => d.field))];

    let html = `
        <div class="double-banner-wrap">
            <div class="top-btn btn-links banner-btn banner-small">🔗 リンク集</div>
            <div class="link-genre-btn banner-btn banner-small">
                <span class="link-genre-name">${genre}</span>
            </div>
        </div>
    `;

    fields.forEach(f => {
        html += `<div class="link-field-header">${f}</div>`;
        const fieldItems = items.filter(d => d.field === f);
        fieldItems.forEach(item => {
            const isReady = item.url && item.name !== '準備中';
            if (isReady) {
                let badge = '';
                if (item.translate === 1 || item.translate === 3 || item.translate === 4) badge = '<span class="link-badge badge-jp">JP</span>';
                if (item.translate === 2) badge = '<span class="link-badge badge-pdf">PDF</span>';
                html += `<div class="menu-item link-item" data-id="${item.id}">
                    <span class="link-name">${item.name}</span>
                    ${badge}
                    <span class="link-arrow">↗</span>
                </div>`;
            } else {
                html += `<div class="menu-item link-item link-coming">
                    <span class="link-name">準備中</span>
                </div>`;
            }
        });
    });
    menuContent.innerHTML = html;

    menuContent.onclick = (e) => {
        const el = e.target.closest('.link-item');
        if (!el || el.classList.contains('link-coming')) return;
        const id = el.dataset.id;
        const item = linkData.find(d => d.id === id);
        if (item) openLink(item);
    };
}

// ==========================================
// 未実装メニュー
// ==========================================
function showPlaceholder(name) {
    navState = 'placeholder';
    isMenuVisible = false;
    showTextView();
    showMenuBanner();
    cardProgress.innerText = '';
    cardTitle.innerText = name;
    cardBody.innerText = 'このメニューは準備中です。\n\nお楽しみに！';
}

// ==========================================
// ニュース・お知らせ（中でタブ切替。ニュースは当面「準備中」）
// ==========================================
// 表示対象のお知らせ（本番は公開のみ／開発は全部）を新しい順で返す
function visibleNotices() {
    return visibleOfType('お知らせ');
}
// 種別（お知らせ／ニュース）ごとに、表示できるものを新しい順で返す
function visibleOfType(type) {
    return newsData
        .filter(n => n.type === type && (IS_PROD ? n.published : true))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }));
}
// ニュースは直近1ヶ月ぶんだけ出す。データは消さずに表示だけ絞る。
//   絞り込みは「記事1本ずつの日付」で行う。ダイジェストの登録日で絞ると、
//   過去をまとめた束（例：3ヶ月ぶん）が丸ごと通ってしまうため。

// 記事は1件1行で持つ。表示のときだけ、期間と印で層に振り分ける。
function digestArticles() {
    return visibleOfType('ニュース')
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

// 日付の道具。toISOString はUTCに直すため日本時間だと1日ずれる。自前で組む。
function ymd_(d) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function dateOf_(s) { return new Date(String(s) + 'T00:00:00'); }
function addDays_(s, n) { const d = dateOf_(s); d.setDate(d.getDate() + n); return ymd_(d); }
// その日を含む「週」の初日（土曜）。週次ダイジェストが土曜に作られるため土〜金で区切る。
function weekStart_(s) {
    const d = dateOf_(s);
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
    return ymd_(d);
}
// 一覧に出す日付は月日だけ（年は層の見出しに範囲で出る）
function mmdd_(s) {
    const m = String(s).match(/^\d{4}-(\d{2})-(\d{2})$/);
    return m ? (parseInt(m[1], 10) + '/' + m[2]) : String(s);
}
// 週の範囲は曜日まで出す（例：8/8土〜8/14金）。土〜金で区切っていることが伝わる。
var WDAY_ = ['日', '月', '火', '水', '木', '金', '土'];
function mmddw_(s) {
    const m = String(s).match(/^\d{4}-(\d{2})-(\d{2})$/);
    if (!m) return String(s);
    return parseInt(m[1], 10) + '/' + parseInt(m[2], 10) + WDAY_[dateOf_(s).getDay()];
}
function range_(a, b) { return mmddw_(a) + '〜' + mmddw_(b); }
// 3ヶ月のような広い層は、日付まで出すと細かすぎるので月で示す（例：5月〜7月）
function monthRange_(a, b) {
    const ma = String(a).match(/^\d{4}-(\d{2})/), mb = String(b).match(/^\d{4}-(\d{2})/);
    if (!ma || !mb) return range_(a, b);
    const x = parseInt(ma[1], 10) + '月', y = parseInt(mb[1], 10) + '月';
    return (x === y) ? x : (x + '〜' + y);
}

// 記事を時間の層に仕分ける。
//   近い層（今週・先週・1ヶ月前まで）は、その期間の記事をすべて出す。
//   遠い層（3ヶ月）は「月次重要」の印が付いたものだけに絞る。
//   ＝「近いものは詳しく、遠いものは絞って」。同じ記事に印を足すだけで上の層ができる。
function digestByLayer() {
    const list = digestArticles();
    const empty = { bands: [[], [], []], older: [], labels: [], olderRange: '' };
    if (!list.length) return empty;

    const w0 = weekStart_(list[0].date);          // 最新記事を含む週の土曜
    const w1 = addDays_(w0, -7);                  // 先週の土曜
    const mStart = addDays_(w0, -21);             // 1ヶ月の層の始まり

    const bands = [[], [], []], older = [];
    list.forEach(a => {
        const d = String(a.date);
        if (d >= w0)          bands[0].push(a);
        else if (d >= w1)     bands[1].push(a);
        else if (d >= mStart) bands[2].push(a);
        else if (a.monthly)   older.push(a);       // 1ヶ月より古いものは印のあるものだけ
    });
    const labels = [
        { label: '今週',        range: range_(w0, addDays_(w0, 6)) },
        { label: '先週',        range: range_(w1, addDays_(w1, 6)), btn: '先週を見る' },
        { label: '1ヶ月前まで', range: range_(mStart, addDays_(w1, -1)), btn: '1ヶ月前までを見る' }
    ];
    return { bands: bands, older: older, labels: labels,
             olderRange: older.length ? monthRange_(older[older.length - 1].date, older[0].date) : '' };
}

// 新着の赤●は「お知らせ」「ニュース」どちらの新着でも点ける
function latestNoticeId() {
    const v = visibleNotices(), d = visibleOfType('ニュース');
    const ids = [];
    if (v.length) ids.push(v[0].id);
    if (d.length) ids.push(d[0].id);
    return ids.sort().join('|');
}
function getNewsSeen() { try { return localStorage.getItem('takeru_news_seen') || ''; } catch (e) { return ''; } }
function markNewsSeen() { try { localStorage.setItem('takeru_news_seen', latestNoticeId()); } catch (e) {} }
function hasUnreadNews() { const l = latestNoticeId(); return !!l && l !== getNewsSeen(); }

function showNews(tab) {
    newsTab = tab || newsTab || 'ニュース';
    navState = 'news';
    isMenuVisible = true;
    enterLinkFullscreen();
    showMenuView();
    markNewsSeen();                              // 開いたら既読（お知らせ・ニュース共通）

    const tabRow = `
        <div class="news-tabs">
            <button class="news-tab ${newsTab==='ニュース'?'active':''}" data-tab="ニュース">ニュース</button>
            <button class="news-tab ${newsTab==='お知らせ'?'active':''}" data-tab="お知らせ">お知らせ</button>
        </div>`;

    const rowHtml = (n) =>
        `<div class="menu-item news-item" data-id="${n.id}">
            <span class="news-date">${escHtml(n.date)}</span>
            <span class="news-title">${escHtml(n.title)}</span>
            <span class="link-arrow">›</span>
        </div>`;

    let listHtml = '';
    if (newsTab === 'お知らせ') {
        const items = visibleNotices();
        listHtml = items.length
            ? `<div class="news-list">` + items.map(rowHtml).join('') + `</div>`
            : `<div class="news-empty">まだお知らせはありません。</div>`;
    } else {
        // ニュース＝記事を時間の層に畳んで見せる。近い層は開いた状態、遠い層はボタンで開く。
        //   3ヶ月は選抜された別の表なので、押すと画面ごと切り替える。
        if (!visibleOfType('ニュース').length) {
            listHtml = `<div class="news-coming">ニュースは準備中です。<br>もうしばらくお待ちください。</div>`;
        } else {
            const L = digestByLayer();
            const artHtml = (a) =>
                `<div class="menu-item news-item" data-id="${a.id}">
                    <span class="news-date">${escHtml(mmdd_(a.date))}</span>
                    <span class="news-title">${escHtml(a.title)}</span>
                    <span class="link-arrow">›</span>
                </div>`;
            //   層の見出しはそのまま開閉スイッチになる（押すとその層から下を閉じる）。
            //   今週は常に開いた状態なので閉じない。
            const bandHead = (t, r, closeTo) =>
                (closeTo === undefined)
                  ? `<div class="news-band"><span class="nb-label">${escHtml(t)}</span><span class="nb-range">${escHtml(r)}</span></div>`
                  : `<div class="news-band news-band-btn" data-level="${closeTo}" role="button">
                        <span class="nb-label">${escHtml(t)}</span>
                        <span class="nb-range">${escHtml(r)}</span>
                        <span class="nb-fold">▲ 閉じる</span>
                     </div>`;

            listHtml = '';
            if (newsLevel === 9) {
                // 3ヶ月の別画面
                listHtml += bandHead('3ヶ月のまとめ', L.olderRange);
                // 3ヶ月は範囲が広いので、月が変わるところで区切りを入れる
                let curMonth = '';
                listHtml += `<div class="news-list">`;
                L.older.forEach(a => {
                    const mo = String(a.date).slice(0, 7);
                    if (mo !== curMonth) {
                        curMonth = mo;
                        listHtml += `<div class="news-month">${parseInt(mo.slice(5), 10)}月</div>`;
                    }
                    listHtml += artHtml(a);
                });
                listHtml += `</div>`;
                listHtml += `<div class="news-more"><button class="news-more-btn" data-level="0">← 最近のニュースに戻る</button></div>`;
            } else {
                for (let i = 0; i < L.bands.length; i++) {
                    if (i <= newsLevel) {
                        if (!L.bands[i].length) continue;
                        listHtml += bandHead(L.labels[i].label, L.labels[i].range, i > 0 ? i - 1 : undefined);
                        listHtml += `<div class="news-list">` + L.bands[i].map(artHtml).join('') + `</div>`;
                    } else if (L.bands[i].length) {
                        listHtml += `<div class="news-more"><button class="news-more-btn" data-level="${i}">${L.labels[i].btn}（${L.bands[i].length}件）</button></div>`;
                    }
                }
                if (L.older.length) {
                    listHtml += `<div class="news-more"><button class="news-more-btn news-more-sep" data-level="9">3ヶ月のまとめを見る（${L.older.length}件）</button></div>`;
                }
            }
            listHtml += `<div class="news-source-foot">（出所：英ガーディアン紙）</div>`;
        }
    }

    menuContent.innerHTML = `
        <div class="sub-menu-wrap">
            <div class="top-btn btn-news banner-btn">📰 ニュース・お知らせ</div>
            ${tabRow}
            ${listHtml}
        </div>`;

    menuContent.onclick = (e) => {
        const tabBtn = e.target.closest('.news-tab');
        if (tabBtn) { newsLevel = 0; showNews(tabBtn.dataset.tab); return; }
        const lv = e.target.closest('.news-more-btn, .news-band-btn');
        if (lv) { newsLevel = parseInt(lv.dataset.level, 10) || 0; showNews('ニュース'); return; }
        const item = e.target.closest('.news-item');
        if (item) showNewsItem(item.dataset.id);
    };
}

function showNewsItem(id) {
    const n = newsData.find(d => d.id === id);
    if (!n) return;
    const isDigest = (n.type === 'ニュース');
    const date = n.date, title = n.title, body = n.body;
    navState = 'newsitem';
    isMenuVisible = false;
    showTextView();
    showMenuBanner();
    cardProgress.innerText = date || '';
    cardTitle.innerText = title || (isDigest ? 'ニュース' : 'お知らせ');
    cardBody.innerHTML = bodyToHtml(body) +
        (isDigest ? `<div class="news-source">（出所：英ガーディアン紙／要約はMSアカデミー）</div>` : '') +
        `<div class="reg-back"><button class="reg-backbtn" onclick="showNews('${isDigest ? 'ニュース' : 'お知らせ'}')">← ${isDigest ? 'ニュース' : 'お知らせ'}一覧に戻る</button></div>`;
    textView.scrollTop = 0;
}

// ==========================================
// 会員登録・Googleサインイン
// ==========================================
const GOOGLE_CLIENT_ID = '1006540175144-6mp05gm3hci79jvdkj10hlbvqnrvisuf.apps.googleusercontent.com';
let gisReady = false;

function initGoogleAuth() {
    if (!(window.google && google.accounts && google.accounts.id)) return false;
    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: onGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true,
    });
    gisReady = true;
    return true;
}
function waitForGis() {
    if (initGoogleAuth()) return;
    let n = 0;
    const t = setInterval(() => { if (initGoogleAuth() || ++n > 40) clearInterval(t); }, 150);
}

// 登録状態は端末に保持（無料ゲート＝厳密な認証は不要。メール記録はサーバーが検証済み）
function getMemberEmail() { try { return localStorage.getItem('takeru_member_email') || ''; } catch (e) { return ''; } }
function setMemberEmail(email) { try { localStorage.setItem('takeru_member_email', email); } catch (e) {} }
function clearMemberEmail() { try { localStorage.removeItem('takeru_member_email'); } catch (e) {} }

async function onGoogleCredential(response) {
    if (!response || !response.credential) return;
    const statusEl = document.getElementById('reg-status');
    if (statusEl) statusEl.textContent = '登録処理中…';
    try {
        const res = await fetch('./auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: response.credential }),
        });
        const j = await res.json();
        if (j.ok && j.email) {
            setMemberEmail(j.email);
            if (navState === 'register') renderRegisterBody();
        } else if (statusEl) {
            statusEl.textContent = '登録に失敗しました。少し待ってもう一度お試しください。';
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = '通信に失敗しました。ネット接続をご確認ください。';
    }
}

function showRegisterInfo() {
    navState = 'register';
    isMenuVisible = false;
    showTextView();
    showMenuBanner();
    cardProgress.innerText = '';
    cardTitle.innerText = '登録案内';
    renderRegisterBody();
}

// プライバシー方針をアプリ内画面で表示（ページ移動しない）
function showPrivacyInfo() {
    navState = 'privacy';
    isMenuVisible = false;
    showTextView();
    showMenuBanner();
    cardProgress.innerText = '';
    cardTitle.innerText = 'プライバシー方針';
    cardBody.innerHTML = PRIVACY_HTML +
        `<div class="reg-back"><button class="reg-backbtn" onclick="showRegisterInfo()">← 登録案内に戻る</button></div>`;
    textView.scrollTop = 0;
}

const REG_BACK = `<div class="reg-back"><button class="reg-backbtn" onclick="showTopMenu()">← メニューに戻る</button></div>`;
// プライバシー方針はアプリ内画面で表示する（別ページへ移動しない＝再読み込みで
// オープニングに戻る問題を回避。戻るは登録案内へ）。公開用の privacy.html も別途あり。
const REG_PRIVACY = `<div class="reg-privacy"><a href="#" onclick="showPrivacyInfo();return false;">プライバシー方針</a>（メールアドレスのみ利用します）</div>`;

const PRIVACY_HTML = `
<div class="reg-priv-doc">
  <p>MSアカデミー TAKERU（ベータ版）のプライバシー方針です。</p>
  <p><strong>取得する情報</strong><br>会員登録ではGoogleサインインを利用し、<strong>保存・利用するのはメールアドレスのみ</strong>です。氏名・プロフィール写真は受け取っても保存・利用しません。パスワード、Gmailの内容、連絡先などを取得することはありません。</p>
  <p><strong>利用目的</strong><br>会員登録の管理と、新しい講座・検定の開始などのお知らせ（週1回程度）の送付にのみ利用します。</p>
  <p><strong>第三者への提供</strong><br>法令に基づく場合を除き、本人の同意なく第三者に提供しません。</p>
  <p><strong>アクセスの記録</strong><br>どのページが何回開かれたかを、個人を特定しない形で記録しています（回数の集計のみ）。</p>
  <p><strong>登録の解除・お問い合わせ</strong><br>登録の解除は、この「登録案内」の「登録を解除する」からいつでも行えます。その他のお問い合わせは <a href="https://ms-forum.com/" target="_blank" rel="noopener">ms-forum.com</a> までご連絡ください。</p>
  <p class="reg-priv-note">※ベータ版時点の内容です。正式版に向けて更新する場合があります。</p>
</div>`;

// ========== ホーム画面に追加（PWAインストール案内） ==========
// すでにアイコン起動（インストール済み）なら案内は不要
function isAppInstalled() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
        || window.navigator.standalone === true;   // iOS Safari
}
// 開いている端末を判定して、その機種の手順だけ出す
function installPlatform() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPod/.test(ua)) return 'iphone';
    if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ipad';
    if (/Android/.test(ua)) return 'android';
    return 'desktop';
}
// トップ／ご案内メニューに差し込むリンク（インストール済みなら空）
//   top  … 目立たない小さなリンク（毎回の入口）
//   guide … 明るいボタン＋「方法（必読）」（最初の案内）
function installLinkHtml(variant) {
    if (isAppInstalled()) return '';
    if (variant === 'guide') {
        return `<button class="top-install guide-install" onclick="showInstallGuide()">📲 アイコンにして使う方法（必読）</button>`;
    }
    return `<button class="top-install" onclick="showInstallGuide()">📲 アイコンにして使う</button>`;
}

function showInstallGuide() {
    navState = 'install';
    isMenuVisible = false;
    showTextView();
    showMenuBanner();
    cardProgress.innerText = '';
    cardTitle.innerText = 'ホーム画面に追加';
    renderInstallGuideBody();
    textView.scrollTop = 0;
}

function renderInstallGuideBody() {
    const p = installPlatform();
    const canPrompt = !!deferredInstallPrompt;   // Android/PCで候補が用意できている
    const btn = canPrompt
        ? `<div class="install-now"><button onclick="doNativeInstall()">📲 このアプリをインストール</button></div>`
        : '';

    let steps = '';
    if (p === 'iphone') {
        // いまSafari以外（Chrome等）で見ている人には、Safariへの移り方から具体的に示す
        const toSafari = (isIosNonSafari() || detectInAppBrowser())
          ? `<li>下のボタンで<strong>アドレスをコピー</strong>する
               <div class="ins-copy"><button onclick="copyAppUrl()">📋 アドレスをコピー</button></div></li>
             <li><strong>Safari</strong>（羅針盤のアイコン）を開く
               <div class="ins-sub">ホーム画面やドックにあります。見つからなければ、画面を下へスワイプして「Safari」と検索してください。</div></li>
             <li>画面上の<strong>アドレス欄を長押し</strong>して<strong>「ペースト」</strong>を選び、<strong>「開く」</strong>を押す</li>`
          : `<li>Safariでこのページを開く</li>`;
        steps = `
          <p class="ins-note">iPhoneは <strong>Safari</strong> でのみ追加できます。メールやLINE、Chromeで開いた場合は、いったん<strong>Safariで開き直して</strong>ください。</p>
          <ol class="ins-steps">
            ${toSafari}
            <li>画面下の<strong>「共有」ボタン</strong>（□に↑）を押す
              <div class="ins-sub">見当たらない時は、アドレスバー横の<strong>「ぁあ」や「⋯」</strong>を押すと、その中に「共有」があります。</div></li>
            <li>メニューを下にスクロールし<strong>「ホーム画面に追加」</strong>を選ぶ</li>
            <li>右上の<strong>「追加」</strong>を押す → 完了</li>
          </ol>`;
    } else if (p === 'ipad') {
        const toSafariPad = (isIosNonSafari() || detectInAppBrowser())
          ? `<li>下のボタンで<strong>アドレスをコピー</strong>する
               <div class="ins-copy"><button onclick="copyAppUrl()">📋 アドレスをコピー</button></div></li>
             <li><strong>Safari</strong>（羅針盤のアイコン）を開く</li>
             <li>上の<strong>アドレス欄を長押し</strong>して<strong>「ペースト」</strong>を選び、<strong>「開く」</strong>を押す</li>`
          : `<li>Safariでこのページを開く</li>`;
        steps = `
          <p class="ins-note">iPadは <strong>Safari</strong> でのみ追加できます。メールやLINE、Chromeで開いた場合は、いったんSafariで開き直してください。</p>
          <ol class="ins-steps">
            ${toSafariPad}
            <li>画面右上（アドレスバー右）の<strong>「共有」ボタン</strong>（□に↑）を押す
              <div class="ins-sub">見当たらない時は、右上の<strong>「⋯」</strong>メニューの中に「共有」があります。</div></li>
            <li><strong>「ホーム画面に追加」</strong>を選ぶ</li>
            <li>右上の<strong>「追加」</strong>を押す → 完了</li>
          </ol>`;
    } else if (p === 'android') {
        steps = canPrompt
          ? `<p class="ins-note">上のボタンを押すと、そのまま追加できます。</p>`
          : `<p class="ins-note"><strong>Chrome</strong>でのご利用がおすすめです。</p>
             <ol class="ins-steps">
               <li>画面右上の<strong>「⋮」</strong>（点が縦に3つ）を押す</li>
               <li><strong>「アプリをインストール」</strong>または<strong>「ホーム画面に追加」</strong>を選ぶ</li>
               <li>確認画面で<strong>「インストール／追加」</strong>を押す → 完了</li>
             </ol>
             <div class="ins-sub">メニューに「◯◯で開く」と出る場合は、すでにインストール済みです。</div>`;
    } else {
        steps = canPrompt
          ? `<p class="ins-note">上のボタンを押すと、そのまま追加できます。</p>`
          : `<p class="ins-note"><strong>Chrome</strong>または<strong>Edge</strong>でご利用ください。</p>
             <ol class="ins-steps">
               <li>アドレスバー右端の<strong>インストールアイコン</strong>（モニターに↓が付いた印）をクリック</li>
               <li>または右上の<strong>「⋮」/「…」</strong> →「キャスト、保存、共有」→<strong>「TAKERUをインストール」</strong></li>
               <li>確認画面で<strong>「インストール」</strong>を押す → 完了</li>
             </ol>
             <div class="ins-sub">メニューに「TAKERUをインストール」が無く<strong>「TAKERU｜MSアカデミーで開く」</strong>と出る場合は、<strong>そのパソコンには既にインストール済み</strong>です。</div>`;
    }

    cardBody.innerHTML = `
      <div class="reg-priv-doc ins-doc">
        <p>このアプリをアイコンにしてホーム画面に登録すると、次回からブラウザで開き直さず<strong>ワンタップで起動</strong>できます。</p>
        ${btn}
        ${steps}
        <p class="reg-priv-note">うまくいかない時は、そのままブラウザでご利用いただいても内容は変わりません。設定は必須ではありません。</p>
      </div>
      <div class="reg-back"><button class="reg-backbtn" onclick="showTopMenu()">← メニューに戻る</button></div>`;
}

async function doNativeInstall() {
    if (!deferredInstallPrompt) return;
    const e = deferredInstallPrompt;
    deferredInstallPrompt = null;
    try { e.prompt(); await e.userChoice; } catch (err) {}
    renderInstallGuideBody();
}

// ---- 内蔵ブラウザ（LINE/FB/IG/X）検知 → 外部ブラウザ案内バナー ----
//   LINE等のアプリ内ブラウザでは「ホーム画面に追加」ができないため、
//   Safari/Chromeで開き直してもらう案内を出す。
function detectInAppBrowser() {
    const ua = navigator.userAgent || '';
    if (/\bLine\//i.test(ua)) return 'LINE';
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
    if (/Instagram/i.test(ua)) return 'Instagram';
    if (/Twitter/i.test(ua)) return 'X（旧Twitter）';
    return '';
}
// iPhone/iPad で Safari 以外のブラウザか。
//   iOSはどのブラウザも中身はWebKitだが、ホーム画面への追加は Safari でしかできない。
//   Chrome=CriOS / Edge=EdgiOS / Firefox=FxiOS / Opera=OPT で見分ける。
function isIosNonSafari() {
    const ua = navigator.userAgent || '';
    const isIos = /iPhone|iPod/.test(ua)
        || /iPad/.test(ua)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (!isIos) return false;
    return /CriOS|EdgiOS|FxiOS|OPT\//i.test(ua);
}
function maybeShowInAppBanner() {
    if (isAppInstalled()) return;                 // アイコン起動なら不要
    const name = detectInAppBrowser();
    // アプリ内ブラウザでなくても、iPhoneのChrome等ならホーム画面に追加できないので案内する
    if (!name && !isIosNonSafari()) return;
    try { if (sessionStorage.getItem('takeru_inapp_dismissed')) return; } catch (e) {}
    const el = document.getElementById('inapp-banner');
    if (!el) return;

    // iOSでSafari以外（Chrome等）。閲覧はできるので、まず安心させてから手順を示す。
    if (!name && isIosNonSafari()) {
        el.innerHTML =
            `<div class="iab-text">現在のブラウザでもTAKERUはご利用いただけます。<br>` +
            `ホーム画面にアプリとして登録することも出来ます。<br>` +
            `そのためには<b>Safari</b>から開いてください。` +
            `<span class="iab-how">下のボタンでアドレスをコピーし、Safariに貼り付けてください。</span></div>` +
            `<div class="iab-actions">` +
              `<button class="iab-btn" onclick="copyAppUrl()">アドレスをコピー</button>` +
              `<button class="iab-btn2" onclick="dismissInAppBanner();showInstallGuide()">くわしく</button>` +
              `<button class="iab-close" onclick="dismissInAppBanner()" aria-label="閉じる">×</button>` +
            `</div>`;
        el.style.display = 'flex';
        return;
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const action = isAndroid
        ? `<button class="iab-btn" onclick="openInChrome()">Chromeで開く</button>`
        : `<button class="iab-btn" onclick="copyAppUrl()">URLをコピー</button>`;
    const how = isAndroid
        ? '右上メニューから「ブラウザで開く／Chromeで開く」でもOK'
        : '右下メニューから「Safariで開く」、またはコピーしてSafariに貼り付け';
    el.innerHTML =
        `<div class="iab-text"><b>${name}内のブラウザで開いています。</b>ホーム画面にアイコンとして追加するには、外部ブラウザで開いてください。<span class="iab-how">（${how}）</span></div>` +
        `<div class="iab-actions">${action}<button class="iab-close" onclick="dismissInAppBanner()" aria-label="閉じる">×</button></div>`;
    el.style.display = 'flex';
}
function openInChrome() {
    // Android：intentでChromeを開く
    location.href = 'intent://takeru.ms-forum.com/#Intent;scheme=https;package=com.android.chrome;end';
}
function copyAppUrl() {
    const url = 'https://takeru.ms-forum.com/';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url)
            .then(() => alert('アドレスをコピーしました。\n\nSafariを開き、上のアドレス欄に貼り付けて\n「開く」を押してください。'))
            .catch(() => alert('コピーできませんでした。\nSafariで takeru.ms-forum.com を開いてください。'));
    } else {
        alert('Safariで次のアドレスを開いてください。\ntakeru.ms-forum.com');
    }
}
function dismissInAppBanner() {
    const el = document.getElementById('inapp-banner');
    if (el) el.style.display = 'none';
    try { sessionStorage.setItem('takeru_inapp_dismissed', '1'); } catch (e) {}
}

function renderRegisterBody() {
    const email = getMemberEmail();
    if (email) {
        cardBody.innerHTML =
            `<div class="reg-text">ご登録ありがとうございます。<br>次のメールアドレスで登録済みです。</div>` +
            `<div class="reg-email">${escHtml(email)}</div>` +
            `<div class="reg-actions">` +
              `<button class="reg-logout" onclick="doMemberLogout()">この端末からログアウト</button>` +
              `<button class="reg-unreg" onclick="doUnregister()">登録を解除する</button>` +
            `</div>` +
            REG_PRIVACY +
            REG_BACK;
        return;
    }
    cardBody.innerHTML =
        `<div class="reg-text">現在このアプリはβ版で登録がなくてもご利用可能です。本番移行時にはメールアドレス登録を基本とし、未登録の場合には機能の制限がかかる予定です。ぜひ今からメールアドレス登録をお済ませください。週1度程度、簡単なお知らせをお送りします。</div>` +
        `<div id="gbtn" class="reg-gbtn"></div>` +
        `<div id="reg-status" class="reg-status"></div>` +
        REG_PRIVACY +
        REG_BACK;
    renderGoogleButton();
}

// 登録解除（自分でできるように）。ベータ用の軽実装：ログイン中のメールを削除。
async function doUnregister() {
    const email = getMemberEmail();
    if (!email) return;
    if (!confirm('登録を解除します（お知らせの配信を停止します）。よろしいですか？')) return;
    try {
        const res = await fetch('./auth.php', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unregister', email: email }),
        });
        const j = await res.json();
        if (j.ok) {
            clearMemberEmail();
            try { google.accounts.id.disableAutoSelect(); } catch (e) {}
            cardBody.innerHTML =
                `<div class="reg-text">登録を解除しました。<br>またのご利用をお待ちしています。</div>` + REG_BACK;
        } else {
            alert('解除に失敗しました。時間をおいてお試しください。');
        }
    } catch (e) {
        alert('通信に失敗しました。ネット接続をご確認ください。');
    }
}

function renderGoogleButton() {
    const c = document.getElementById('gbtn');
    if (!c) return;
    if (gisReady) {
        c.innerHTML = '';
        google.accounts.id.renderButton(c, {
            type: 'standard', theme: 'filled_blue', size: 'large',
            text: 'signin_with', shape: 'pill', locale: 'ja',
        });
        return;
    }
    // GISの読み込み待ち
    c.innerHTML = '<span class="reg-loading">ログインボタンを準備中…</span>';
    let n = 0;
    const t = setInterval(() => {
        if (gisReady) { clearInterval(t); if (navState === 'register') renderGoogleButton(); }
        else if (++n > 40) { clearInterval(t); const cc = document.getElementById('gbtn'); if (cc) cc.innerHTML = '<span class="reg-loading">ログインを準備できませんでした。通信環境をご確認ください。</span>'; }
    }, 150);
}

function doMemberLogout() {
    clearMemberEmail();
    try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    renderRegisterBody();
}

// ==========================================
// 表示切替
// ==========================================
function showMenuView() {
    textView.style.display = 'none';
    menuView.style.display = 'flex';
    menuView.style.flexDirection = 'column';
    isMenuVisible = true;
    updateControlButtons();
}

function showTextView() {
    menuView.style.display = 'none';
    textView.style.display = 'block';
    isMenuVisible = false;
    updateControlButtons();
}

// ◀/CARD と音声ON/OFF の表示を状態に合わせて更新
function updateControlButtons() {
    syncMenuMode();   // パソコンのワイド表示で、メニューだけ紙面型に戻すための目印
    if (isMenuVisible) {
        btnBack.textContent = 'CARD';
        btnBack.classList.add('btn-card-mode');
        btnBack.disabled = curSection.length === 0;
    } else {
        btnBack.textContent = '◀';
        btnBack.classList.remove('btn-card-mode');
        btnBack.disabled = false;
    }
    updateVoiceBtn();
}

// 音声ボタンの見た目：待機は「🔊 聴く」、読み上げ中は緑で「停止」、連続再生中は青く光る
function updateVoiceBtn() {
    btnVoice.classList.toggle('voice-on', autoRead && !autoAdvance);
    btnVoice.classList.toggle('voice-auto', autoAdvance);
    const label = autoAdvance ? '連続' : autoRead ? '停止' : '聴く';
    const icon  = autoAdvance ? '🔊' : autoRead ? '⏸' : '🔊';
    // 長押し（連続再生）の最中にDOMを差し替えるとジェスチャーが切れるため、
    // 表示が実際に変わるときだけ書き換える
    const next = `${icon}|${label}`;
    if (btnVoice.dataset.state !== next) {
        btnVoice.dataset.state = next;
        btnVoice.innerHTML = `${icon}<span class="btn-sub-label">${label}</span>`;
    }
    btnVoice.title = autoAdvance ? '連続再生中（長押しで停止）'
                   : autoRead    ? '読み上げ中（タップで停止／長押しで連続再生）'
                   : 'タップで読み上げ／長押しで連続再生';
}

function clearCard() {
    cardProgress.innerText = '';
    cardTitle.innerText = '';
    cardBody.innerText = '';
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
    stopVoice();
}

// ==========================================
// ボタン設定
// ==========================================
function setupButtons() {

    // ▶：カード送りのみ（連続再生の切替は音声ボタンへ移した）
    btnNext.onclick = () => {
        if (isMenuVisible) {
            if (curSection.length) {
                if (curIndex < curSection.length - 1) showCard(curIndex + 1);
                else advanceToNextSection();
            }
        } else if (navState === 'card') {
            if (curIndex < curSection.length - 1) showCard(curIndex + 1);
            else advanceToNextSection();
        }
    };

    // 音声ボタン：チョンと触る＝読み上げON/OFF、長押し（700ms）＝連続再生ON/OFF
    setupVoiceButton();

    // ◀／CARD：カード戻し（カード画面）/ 最後のカードへ戻る（メニュー・完了画面）
    btnBack.onclick = () => {
        if (isMenuVisible) {
            if (curSection.length) showCard(curIndex);
        } else if (navState === 'card') {
            if (curIndex > 0) {
                showCard(curIndex - 1);
            } else if (curGenre) {
                // 先頭カードで◀→前サブユニットの最終カードへ（見えるセクション/カードのみ）
                const genreCards = cardData.filter(d => d.genre === curGenre);
                const sections = [...new Set(genreCards.map(d => d.section))]
                    .filter(s => hasVisibleCards(genreCards.filter(d => d.section === s)));
                const si = sections.indexOf(curSection[0]?.section);
                if (si > 0) {
                    curSection = visibleOf(genreCards.filter(d => d.section === sections[si - 1]));
                    showCard(curSection.length - 1);
                }
            }
        } else if (navState === 'complete') {
            showCard(curSection.length - 1);
        }
    };

    // 図表をタップ／クリックで全画面。もう一度タップで戻る
    imageArea.addEventListener('click', openImgZoom);
    document.getElementById('img-zoom').addEventListener('click', closeImgZoom);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeImgZoom(); });

    btnHome.onclick = () => {
        stopVoice();
        showTopMenu();
    };

    // ▲：上位メニューへ1層ずつ移動
    btnToggle.onclick = goUpOneLevel;
}

// 音声ボタン：短タップ＝読み上げON/OFF（緑）、長押し700ms＝連続再生ON/OFF（青く光る）
// タッチ／マウスを1回に統一する Pointer Events を使う。
// 旧実装は touch と mouse が二重発火し、長押し後の疑似クリックが短タップに
// 化けて連続再生が即解除されていた。
function setupVoiceButton() {
    let timer = null, longFired = false, moved = false, sx = 0, sy = 0;

    btnVoice.style.touchAction = 'manipulation';

    btnVoice.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;     // マウスは左のみ
        sx = e.clientX; sy = e.clientY;
        longFired = false; moved = false;
        clearTimeout(timer);
        timer = setTimeout(() => {
            longFired = true;
            voiceLongPress();
            if (navigator.vibrate) navigator.vibrate(40);
        }, 700);
    });
    btnVoice.addEventListener('pointermove', (e) => {
        if (Math.abs(e.clientX - sx) > 14 || Math.abs(e.clientY - sy) > 14) {
            moved = true; clearTimeout(timer);
        }
    });
    btnVoice.addEventListener('pointerup', () => {
        clearTimeout(timer);
        if (!longFired && !moved) voiceShortTap();   // 長押し済み／ドラッグは短タップにしない
    });
    btnVoice.addEventListener('pointercancel', () => clearTimeout(timer));
    btnVoice.addEventListener('pointerleave', () => clearTimeout(timer));
}

// 短タップ：読み上げモードのON/OFF（従来の音声ボタンの動き）
function voiceShortTap() {
    hideVoiceWarning();
    // MP3失敗中に再押し → TTS開始（トグルではなくフォールバック）
    if (mp3Failed && navState === 'card') {
        mp3Failed = false;
        startTTS(curSection[curIndex].body);
        return;
    }
    autoRead = !autoRead;
    if (!autoRead) autoAdvance = false;   // 読み上げを切れば連続再生も切れる
    updateVoiceBtn();
    updateControlButtons();
    if (autoRead && navState === 'card') playVoiceDirect();
    else if (!autoRead) stopVoice();
}

// 長押し：連続再生モードのON/OFF
function voiceLongPress() {
    hideVoiceWarning();
    autoAdvance = !autoAdvance;
    if (autoAdvance) autoRead = true;     // 連続再生は読み上げONが前提
    else if (!autoRead) autoRead = false;
    updateVoiceBtn();
    updateControlButtons();
    if (autoAdvance && navState === 'card') playVoiceDirect();
    else if (!autoRead) stopVoice();
}

// セクション内の全カードを読み終えたら次のセクションへ進む
function advanceToNextSection() {
    // ご案内は各ユニットが数枚しかないので、ユニットを超えて次のユニットの先頭へ進む
    // （▶送り・連続再生とも）。最後のユニットの末尾でだけ完了。
    if (curSubject === GUIDE_SUBJECT) {
        const units = [...new Set(cardData.filter(d => d.subject === GUIDE_SUBJECT).map(d => d.genre))];
        const ui = units.indexOf(curGenre);
        if (ui >= 0 && ui < units.length - 1) {
            curGenre = units[ui + 1];
            curSection = visibleOf(cardData.filter(d => d.genre === curGenre));
            showCard(0);
            return;
        }
        showSectionComplete();
        return;
    }
    const sectionName = curSection[0]?.section;
    if (sectionName && curGenre) {
        const genreCards = cardData.filter(d => d.genre === curGenre);
        // 見えるカードを持つセクションだけを順に並べる（空セクションは飛ばす）
        const sections = [...new Set(genreCards.map(d => d.section))]
            .filter(s => hasVisibleCards(genreCards.filter(d => d.section === s)));
        const si = sections.indexOf(sectionName);
        if (si >= 0 && si < sections.length - 1) {
            curSection = visibleOf(genreCards.filter(d => d.section === sections[si + 1]));
            showCard(0);
            return;
        }
    }
    showSectionComplete();
}

// ==========================================
// セクション完了
// ==========================================
function showSectionComplete() {
    stopVoice();
    autoAdvance = false;
    updateVoiceBtn();
    navState = 'complete';
    isMenuVisible = false;
    showTextView();
    const unitName = curGenre || curSection[0]?.section || '';
    const unitTotal = curGenre ? visibleOf(cardData.filter(d => d.genre === curGenre)).length : curSection.length;
    cardProgress.innerText = unitName;
    cardTitle.innerText = '✅ 完了';
    cardBody.innerText = `${unitName}の全${unitTotal}枚を読み終えました。\n\n◀ で最後のカードに戻れます。\n▲ で上位メニューに戻れます。`;
    // 完了画面はタケル＆サクラを小さめに（⚔の代わり）。ズーム印は出さない。
    imageArea.classList.remove('has-image');
    imageArea.classList.remove('menu-banner');   // 化粧パネル用の低い枠を必ず解除
    cardImage.classList.add('complete-mascot');
    cardImage.src = 'images/mascots.png';
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
}

// 連続再生：次のカードへ自動送り
function doNextCard() {
    if (navState !== 'card') return;
    if (curIndex < curSection.length - 1) showCard(curIndex + 1);
    // サブユニットの最後まで来たら次のサブユニットへ。連続再生は切らずに継続する。
    // （ユニット全体を読み終えたときだけ showSectionComplete が autoAdvance を止める）
    else advanceToNextSection();
}


// ==========================================
// 音声読み上げ（iPhone対応）
// MP3失敗→警告表示→もう一度押したらTTS
// ==========================================
function playVoiceDirect() {
    if (!curSection.length || navState !== 'card') return;
    const card = curSection[curIndex];
    stopVoice();
    mp3Failed = false;

    // mp3が存在しないカードは即TTS
    if (mp3Set && !mp3Set.has(card.id)) {
        startTTS(card.body);
        return;
    }

    // canplayを待ってから再生（キャッシュなし時のiOS play()失敗を防ぐ）
    const tryPlay = () => {
        if (mp3Failed) return;
        voice.oncanplay = null;
        voice.onerror = null;
        clearTimeout(_mp3LoadTimer);
        voice.play()
            .then(() => hideVoiceWarning())
            .catch(() => {
                mp3Failed = true;
                if (autoRead) startTTS(card.body);
                else showVoiceWarning();
            });
    };

    const failPlay = () => {
        if (mp3Failed) return;
        voice.oncanplay = null;
        voice.onerror = null;
        clearTimeout(_mp3LoadTimer);
        mp3Failed = true;
        if (autoRead) startTTS(card.body);
        else showVoiceWarning();
    };

    voice.oncanplay = tryPlay;
    voice.onerror = failPlay;
    voice.onended = () => { if (autoAdvance && navState === 'card') setTimeout(doNextCard, 700); };
    voice.volume = 1.0;
    voice.src = `voices/${card.id}.mp3`;
    voice.load();
    _mp3LoadTimer = setTimeout(failPlay, 3000);
}

function showVoiceWarning() {
    const overlay = document.getElementById('voice-warning');
    if (!overlay) return;
    overlay.onclick = () => {
        hideVoiceWarning();
        if (curSection.length && navState === 'card') startTTS(curSection[curIndex].body);
    };
    const textEl = document.getElementById('voice-warning-text');
    if (textEl) textEl.innerHTML = '🔇 音声データなし &nbsp;<span>▶ タップでシステム音声</span>';
    overlay.style.display = 'flex';
}

function hideVoiceWarning() {
    const overlay = document.getElementById('voice-warning');
    if (overlay) overlay.style.display = 'none';
}

function startTTS(text) {
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(bodyToPlain(text));   // URL等は読み上げから除く
    uttr.lang = 'ja-JP';
    uttr.rate = 1.0;
    uttr.volume = 1.0;
    uttr.onend = () => { if (autoAdvance && navState === 'card') setTimeout(doNextCard, 700); };
    window.speechSynthesis.speak(uttr);
}

function stopVoice() {
    clearTimeout(_mp3LoadTimer);
    voice.oncanplay = null;
    voice.onerror = null;
    voice.onended = null;
    voice.pause();
    voice.currentTime = 0;
    voice.src = '';
    voice.volume = 1.0;
    window.speechSynthesis.cancel();
}

// ==========================================
// 図表の全画面表示（カード画面で図表をタップ）
// 設定を経由せず、その場で大きく見られるようにするための入り口。
// ==========================================
function openImgZoom() {
    if (isMenuVisible) return;                       // メニューのバナーでは効かせない
    if (!imageArea.classList.contains('has-image')) return;  // 図表のあるカードだけ拡大（ご案内の大パネル・完了マスコットは対象外）
    if (cardImage.style.display === 'none') return;  // 画像が無いカードは対象外
    if (!cardImage.src) return;
    document.getElementById('img-zoom-img').src = cardImage.src;
    document.getElementById('img-zoom').style.display = 'flex';
}

function closeImgZoom() {
    document.getElementById('img-zoom').style.display = 'none';
}

// ==========================================
// 設定パネル
// ==========================================
function setupSettings() {
    btnSettings.onclick = () => { settingsPanel.style.display = 'flex'; };
    document.getElementById('btn-settings-close').onclick = () => { settingsPanel.style.display = 'none'; };

    document.getElementById('btn-dark').onclick = () => {
        document.body.classList.replace('light-mode', 'dark-mode');
        setActiveToggle('btn-dark', ['btn-dark', 'btn-light']);
        localStorage.setItem('takeru-theme', 'dark');
    };
    document.getElementById('btn-light').onclick = () => {
        document.body.classList.replace('dark-mode', 'light-mode');
        setActiveToggle('btn-light', ['btn-dark', 'btn-light']);
        localStorage.setItem('takeru-theme', 'light');
    };

    document.getElementById('btn-font-s').onclick = () => { setFontSize('small'); localStorage.setItem('takeru-font', 'small'); setActiveToggle('btn-font-s', ['btn-font-s','btn-font-m','btn-font-l']); };
    document.getElementById('btn-font-m').onclick = () => { setFontSize('medium'); localStorage.setItem('takeru-font', 'medium'); setActiveToggle('btn-font-m', ['btn-font-s','btn-font-m','btn-font-l']); };
    document.getElementById('btn-font-l').onclick = () => { setFontSize('large'); localStorage.setItem('takeru-font', 'large'); setActiveToggle('btn-font-l', ['btn-font-s','btn-font-m','btn-font-l']); };

    // パソコンの画面レイアウト（スマホでは設定欄自体を隠しているので影響しない）
    document.getElementById('btn-pc-tablet').onclick = () => { setPcLayout('tablet'); localStorage.setItem('takeru-pc-layout', 'tablet'); };
    document.getElementById('btn-pc-wide').onclick   = () => { setPcLayout('wide');   localStorage.setItem('takeru-pc-layout', 'wide'); };
}

// パソコン向け：'tablet'（A4的な紙面を中央）/ 'wide'（図表を大きく）
function setPcLayout(mode) {
    document.body.classList.toggle('pc-wide', mode === 'wide');
    setActiveToggle(mode === 'wide' ? 'btn-pc-wide' : 'btn-pc-tablet', ['btn-pc-tablet', 'btn-pc-wide']);
}

// ワイド表示のとき、メニュー画面だけは横並びにせず紙面型に戻す
function syncMenuMode() {
    document.body.classList.toggle('menu-mode', isMenuVisible);
}

function setActiveToggle(activeId, allIds) {
    allIds.forEach(id => document.getElementById(id).classList.toggle('active', id === activeId));
}

function setFontSize(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add(`font-${size}`);
}

function loadSavedSettings() {
    const theme = localStorage.getItem('takeru-theme') || 'dark';
    const font = localStorage.getItem('takeru-font') || 'medium';
    if (theme === 'light') {
        document.body.classList.replace('dark-mode', 'light-mode');
        setActiveToggle('btn-light', ['btn-dark', 'btn-light']);
    }
    setFontSize(font);
    setActiveToggle(`btn-font-${font}`, ['btn-font-s','btn-font-m','btn-font-l']);
    setPcLayout(localStorage.getItem('takeru-pc-layout') || 'tablet');
}

// ==========================================
// プルダウンで更新（PWA対応）
// ==========================================
// ▲ボタンと下方向スワイプで共用：現在の階層から1つ上のメニューへ
function goUpOneLevel() {
    const guide = curSubject === GUIDE_SUBJECT;
    const free = curSubject === FREE_SUBJECT;
    switch (navState) {
        case 'card':
        case 'complete':
            if (free) { showFreeUnit(curGenre); break; }
            if (curSection.length) {
                if (guide) showGuideCards(curGenre);
                else if (curSection[0]?.section) showSectionedCardList(curGenre);
                else showFlatCardList(curGenre);
            } else { guide ? showGuideMenu() : showGenreMenu(); }
            break;
        case 'cardlist':
        case 'sectionedlist':
        case 'section':
            guide ? showGuideMenu() : showGenreMenu();
            break;
        case 'guide':          // ご案内のユニット一覧 → トップへ
            showTopMenu();
            break;
        case 'genre':
            showGradeMenu();
            break;
        case 'subject':
            showTopMenu();
            break;
        case 'linklist':
        case 'searchtool':
        case 'linkhelp':
            showLinkGenreMenu();
            break;
        case 'newsitem':
            showNews('お知らせ');
            break;
        case 'free':            // 自由研究のトップ → メニューへ
            showTopMenu();
            break;
        case 'freetheme':       // テーマ別の講座一覧 → 自由研究トップへ
            showFreeMenu('theme');
            break;
        case 'freeunit':        // 講座のカード一覧 → 一つ上へ
            freeTheme ? showFreeThemeUnits(freeTheme) : showFreeMenu('author');
            break;
        default:
            showTopMenu();
            break;
    }
}

function setupPullToRefresh() {
    let startY = 0;
    let pulling = false;

    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        const y = e.touches[0].clientY;
        const menuEl = document.getElementById('menu-content');
        const textEl = document.getElementById('text-view');
        const atTop = (menuEl && menuEl.scrollTop === 0) || (textEl && textEl.scrollTop === 0);
        if (atTop && y - startY > 220) pulling = true;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (!pulling) return;
        pulling = false;
        // トップメニューでの下スワイプだけオープニングへ戻す。
        // それ以外の画面では1つ上のメニューへ上がるだけにする。
        if (navState === 'top') location.reload();
        else goUpOneLevel();
    });
}
