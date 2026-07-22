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

window.addEventListener('DOMContentLoaded', async () => {
    logAccess('top_view');                  // トップが開かれた
    window.addEventListener('appinstalled', () => logAccess('pwa_installed'));

    await Promise.all([loadCSV(), loadLinkCSV(), loadMp3List()]);
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
            published: c[6]?.trim() === '1'
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
    if (item.translate === 1) {
        window.open(toTranslateGoogUrl(item.url), '_blank');
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
        imageArea.classList.remove('menu-banner');
    }
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
            <button class="top-btn btn-news" data-action="news">📰 ニュース・お知らせ</button>
            <button class="top-btn btn-links" data-action="links">🔗 リンク集</button>
            <div class="top-btn-row">
                <button class="top-btn btn-exam" data-action="exam">📝 受験案内</button>
                <button class="top-btn btn-howto" data-action="howto">❓ 使い方</button>
            </div>
        </div>
    `;
    menuContent.onclick = (e) => {
        const btn = e.target.closest('.top-btn');
        if (!btn) return;
        if (btn.dataset.action === 'guide') showGuideMenu();
        else if (btn.dataset.action === 'jukou') showGradeMenu();
        else if (btn.dataset.action === 'links') showLinkGenreMenu();
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
                <div class="grade-label grade-label-1">１級　将軍の視点</div>
                <div class="subject-row">
                    <button class="subject-btn btn-coming" disabled>軍事と戦略</button>
                    <button class="subject-btn btn-coming" disabled>国家と法律</button>
                    <button class="subject-btn btn-coming" disabled>戦争の歴史</button>
                </div>
                <div class="grade-label grade-label-2">２級　指揮官の視点</div>
                <div class="subject-row">
                    <button class="subject-btn btn-coming" disabled>軍事と戦略</button>
                    <button class="subject-btn btn-coming" disabled>国家と法律</button>
                    <button class="subject-btn btn-coming" disabled>戦争の歴史</button>
                </div>
                <div class="grade-label grade-label-3">３級　戦士の視点</div>
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
    cardBody.innerText = card.body;
    textView.scrollTop = 0;

    if (curSubject === GUIDE_SUBJECT) {
        // ご案内のカードはメインメニューの大パネルを継続（図表は出さない）
        showMainPanel();
    } else {
        // カード画像は.jpgに統一済み。.pngは旧データ用のフォールバックとして残す
        cardImage.classList.remove('complete-mascot');   // 完了画面のマスコット指定を解除
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
    html += `</div></div>`;
    menuContent.innerHTML = html;

    menuContent.onclick = (e) => {
        const btn = e.target.closest('.link-genre-btn');
        if (!btn) return;
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
                if (item.translate === 1) badge = '<span class="link-badge badge-jp">JP</span>';
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

// 音声ボタンの見た目：読み上げ中は緑、連続再生中は青く光る
function updateVoiceBtn() {
    btnVoice.classList.toggle('voice-on', autoRead && !autoAdvance);
    btnVoice.classList.toggle('voice-auto', autoAdvance);
    btnVoice.title = autoAdvance ? '連続再生中（長押しで停止）'
                   : autoRead    ? '読み上げ中（タップで停止／長押しで連続再生）'
                   : '';
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
    const uttr = new SpeechSynthesisUtterance(text);
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
    switch (navState) {
        case 'card':
        case 'complete':
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
            showLinkGenreMenu();
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
