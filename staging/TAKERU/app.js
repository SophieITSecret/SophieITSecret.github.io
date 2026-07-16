// ==========================================
// TAKERU MSアカデミー app.js v2.9
// ==========================================

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
            subject: c[5]?.trim() || '3級-軍事と戦略'
        })).filter(d => d.id);
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
            <button class="top-btn btn-jukou" data-action="jukou">📚 受　講</button>
            <button class="top-btn btn-library" data-action="library">🏛️ 図書館</button>
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
        if (btn.dataset.action === 'jukou') showGradeMenu();
        else if (btn.dataset.action === 'links') showLinkGenreMenu();
        else showPlaceholder(btn.innerText);
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
                <div class="subject-row">
                    <button class="subject-btn btn-grade3" data-subject="3級-軍事と戦略">軍事と戦略</button>
                    <button class="subject-btn btn-grade3" data-subject="3級-国家と法律">国家と法律</button>
                    <button class="subject-btn btn-grade3" data-subject="3級-戦争の歴史">戦争の歴史</button>
                </div>
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
function showGenreMenu() {
    navState = 'genre';
    isMenuVisible = true;
    showMenuBanner();
    showMenuView();
    const genres = [...new Set(cardData.filter(d => d.subject === curSubject).map(d => d.genre))];
    const subjectBanner = curSubject.replace('3級-', '３級　').replace('2級-', '２級　').replace('1級-', '１級　');
    let html = `
        <div class="double-banner-wrap">
            <div class="top-btn btn-jukou banner-btn banner-small">📚 受　講</div>
            <div class="grade-btn btn-grade3 banner-btn banner-small">${subjectBanner}</div>
        </div>
        <div class="genre-panel-label label-section">テーマ一覧</div>
    `;
    let genreHtml = '';
    genres.forEach(g => {
        genreHtml += `<button class="genre-btn" data-genre="${g}">${g}</button>`;
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
    curSection = cardData.filter(d => d.section === section);
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
    const subjectBannerS = curSubject.replace('3級-', '３級　').replace('2級-', '２級　').replace('1級-', '１級　');

    let html = `
        <div class="double-banner-wrap banner-xs-wrap">
            <div class="top-btn btn-jukou banner-btn banner-xs">📚 受　講</div>
            <div class="grade-btn btn-grade3 banner-btn banner-xs">${subjectBannerS}</div>
        </div>
        <div class="genre-panel-label label-genre-header">${genre}</div>
    `;
    sections.forEach(s => {
        const sCards = genreCards.filter(d => d.section === s);
        html += `<div class="section-header">${s}</div>`;
        sCards.forEach((card, i) => {
            html += `<div class="menu-item" data-section="${s}" data-section-idx="${i}"><span class="item-dot">●</span> ${card.title}</div>`;
        });
    });

    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const item = e.target.closest('.menu-item[data-section]');
        if (!item) return;
        const section = item.dataset.section;
        const idx = parseInt(item.dataset.sectionIdx);
        if (section && !isNaN(idx)) {
            curSection = cardData.filter(d => d.genre === curGenre && d.section === section);
            showCard(idx);
        }
    };
}

function showFlatCardList(genre) {
    navState = 'cardlist';
    isMenuVisible = true;
    const isReturn = curGenre === genre && curSection.length > 0;
    curGenre = genre;
    curSection = cardData.filter(d => d.genre === genre);
    if (!isReturn) curIndex = 0;
    showMenuBanner();
    showMenuView();

    const subjectBannerF = curSubject.replace('3級-', '３級　').replace('2級-', '２級　').replace('1級-', '１級　');
    let html = `
        <div class="double-banner-wrap banner-xs-wrap">
            <div class="top-btn btn-jukou banner-btn banner-xs">📚 受　講</div>
            <div class="grade-btn btn-grade3 banner-btn banner-xs">${subjectBannerF}</div>
        </div>
        <div class="genre-panel-label label-genre-header">${genre}</div>
    `;
    curSection.forEach((card, i) => {
        const type = /\dF\d+$/.test(card.id) ? 'fact' : /\dC\d+$/.test(card.id) ? 'com' : null;
        const badge = type ? `<span class="card-badge badge-${type}">${type === 'fact' ? '史実' : '解説'}</span> ` : '';
        const title = card.title.replace(/^→/, '').trim();
        html += `<div class="menu-item" data-idx="${i}"><span class="item-dot">●</span> ${badge}${title}</div>`;
    });
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
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
    isMenuVisible = false;
    mp3Failed = false;
    hideVoiceWarning();
    exitMenuFull();
    showTextView();

    const cardType = /\dF\d+$/.test(card.id) ? 'fact' : /\dC\d+$/.test(card.id) ? 'com' : null;
    const typeBadge = cardType ? ` <span class="card-badge badge-${cardType}">${cardType === 'fact' ? '史実' : '解説'}</span>` : '';
    if (card.section) {
        cardProgress.innerHTML =
            `<div class="prog-unit">${curGenre}</div>` +
            `<div>${card.section}　${curIndex + 1} / ${curSection.length}${typeBadge}</div>`;
    } else {
        cardProgress.innerHTML =
            `<div class="prog-unit">${curGenre}　${curIndex + 1} / ${curSection.length}${typeBadge}</div>`;
    }
    cardTitle.innerText = card.title.replace(/^→/, '').trim();
    cardBody.innerText = card.body;
    textView.scrollTop = 0;

    // カード画像は.jpgに統一済み。.pngは旧データ用のフォールバックとして残す
    cardImage.src = `images/${card.id}.jpg`;
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.src = `images/${card.id}.png`;
        cardImage.onerror = () => {
            cardImage.style.display = 'none';
            imagePlaceholder.style.display = 'flex';
        };
    };

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
    if (isMenuVisible) {
        btnBack.textContent = 'CARD';
        btnBack.classList.add('btn-card-mode');
        btnBack.disabled = curSection.length === 0;
    } else {
        btnBack.textContent = '◀';
        btnBack.classList.remove('btn-card-mode');
        btnBack.disabled = false;
    }
    btnVoice.classList.toggle('voice-on', autoRead);
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

    // ▶：カード送り。音声ON中に長押し（700ms）で連続再生モードのON/OFF
    let _longPressTimer = null;
    let _longPressTriggered = false;

    const _startLongPress = () => {
        if (!autoRead) return;
        clearTimeout(_longPressTimer);
        _longPressTriggered = false;
        _longPressTimer = setTimeout(() => {
            _longPressTriggered = true;
            autoAdvance = !autoAdvance;
            updateAutoAdvBtn();
            if (autoAdvance && navState === 'card') playVoiceDirect();
            if (navigator.vibrate) navigator.vibrate(40);
        }, 700);
    };
    const _cancelLongPress = () => clearTimeout(_longPressTimer);

    btnNext.addEventListener('touchstart',  _startLongPress,  { passive: true });
    btnNext.addEventListener('touchend',    _cancelLongPress, { passive: true });
    btnNext.addEventListener('touchcancel', _cancelLongPress, { passive: true });
    btnNext.addEventListener('touchmove',   _cancelLongPress, { passive: true });
    btnNext.addEventListener('mousedown', (e) => { if (e.button === 0) _startLongPress(); });
    btnNext.addEventListener('mouseup',   _cancelLongPress);
    btnNext.addEventListener('mouseleave', _cancelLongPress);

    btnNext.onclick = () => {
        if (_longPressTriggered) { _longPressTriggered = false; return; }
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

    // ◀／CARD：カード戻し（カード画面）/ 最後のカードへ戻る（メニュー・完了画面）
    btnBack.onclick = () => {
        if (isMenuVisible) {
            if (curSection.length) showCard(curIndex);
        } else if (navState === 'card') {
            if (curIndex > 0) {
                showCard(curIndex - 1);
            } else if (curGenre) {
                // 先頭カードで◀→前サブユニットの最終カードへ
                const allGenre = cardData.filter(d => d.genre === curGenre);
                const posInGenre = allGenre.indexOf(curSection[0]);
                if (posInGenre > 0) {
                    const prevCard = allGenre[posInGenre - 1];
                    curSection = cardData.filter(d => d.genre === curGenre && d.section === prevCard.section);
                    showCard(curSection.length - 1);
                }
            }
        } else if (navState === 'complete') {
            showCard(curSection.length - 1);
        }
    };

    btnHome.onclick = () => {
        stopVoice();
        showTopMenu();
    };

    // ▲：上位メニューへ1層ずつ移動
    btnToggle.onclick = () => {
        switch (navState) {
            case 'card':
            case 'complete':
                if (curSection.length) {
                    if (curSection[0]?.section) showSectionedCardList(curGenre);
                    else showFlatCardList(curGenre);
                } else showGenreMenu();
                break;
            case 'cardlist':
            case 'sectionedlist':
            case 'section':
                showGenreMenu();
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
    };

    // 音声ボタン：ON/OFFトグル
    btnVoice.onclick = () => {
        hideVoiceWarning();
        // MP3失敗中に再押し → TTS開始（トグルではなくフォールバック）
        if (mp3Failed && navState === 'card') {
            mp3Failed = false;
            startTTS(curSection[curIndex].body);
            return;
        }
        autoRead = !autoRead;
        if (!autoRead) { autoAdvance = false; updateAutoAdvBtn(); }
        updateControlButtons();
        if (autoRead && navState === 'card') {
            playVoiceDirect();
        } else if (!autoRead) {
            stopVoice();
        }
    };
}

// セクション内の全カードを読み終えたら次のセクションへ進む
function advanceToNextSection() {
    const sectionName = curSection[0]?.section;
    if (sectionName && curGenre) {
        const genreCards = cardData.filter(d => d.genre === curGenre);
        const sections = [...new Set(genreCards.map(d => d.section))];
        const si = sections.indexOf(sectionName);
        if (si >= 0 && si < sections.length - 1) {
            curSection = genreCards.filter(d => d.section === sections[si + 1]);
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
    updateAutoAdvBtn();
    navState = 'complete';
    isMenuVisible = false;
    showTextView();
    const unitName = curGenre || curSection[0]?.section || '';
    const unitTotal = curGenre ? cardData.filter(d => d.genre === curGenre).length : curSection.length;
    cardProgress.innerText = unitName;
    cardTitle.innerText = '✅ 完了';
    cardBody.innerText = `${unitName}の全${unitTotal}枚を読み終えました。\n\n◀ で最後のカードに戻れます。\n▲ で上位メニューに戻れます。`;
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

// 連続再生：次のカードへ自動送り
function doNextCard() {
    if (navState !== 'card') return;
    if (curIndex < curSection.length - 1) showCard(curIndex + 1);
    else { autoAdvance = false; updateAutoAdvBtn(); advanceToNextSection(); }
}

function updateAutoAdvBtn() {
    btnNext.classList.toggle('btn-auto-adv', autoAdvance);
    btnNext.title = autoAdvance ? '連続再生中（ダブルクリックで停止）' : '';
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
}

// ==========================================
// プルダウンで更新（PWA対応）
// ==========================================
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
        if (pulling) { pulling = false; location.reload(); }
    });
}
