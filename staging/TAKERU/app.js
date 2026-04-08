// ==========================================
// TAKERU MSアカデミー app.js v2.7
// ==========================================

let cardData = [];
let linkData = [];
let curSection = [];
let curIndex = 0;
let navState = 'top';
let curGenre = '';
let curGrade = '3級';
let autoRead = false;
let isMenuVisible = false;
let linkFullscreen = false;

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
    await loadCSV();
    await loadLinkCSV();
    setupButtons();
    setupSettings();
    loadSavedSettings();
    setupPullToRefresh();

    document.getElementById('btn-enter').onclick = () => {
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
            body: c[4]?.trim() || ''
        })).filter(d => d.id);
    } catch (e) {
        console.error('CSVロード失敗:', e);
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
    imageArea.style.display = 'none';
    dividerLine.style.display = 'none';
    btnSettings.style.display = 'none';
}

function exitLinkFullscreen() {
    linkFullscreen = false;
    imageArea.style.display = '';
    dividerLine.style.display = '';
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
            <button class="top-btn btn-exam" data-action="exam">📝 受験案内</button>
        </div>
    `;
    menuContent.onclick = (e) => {
        const btn = e.target.closest('.top-btn');
        if (!btn) return;
        if (btn.dataset.action === 'jukou') showGradeMenu();
        else if (btn.dataset.action === 'links') showLinkGenreMenu();
        else showPlaceholder(btn.innerText);
    };
    updateToggleBtn('メニュー');
}

// ==========================================
// 級選択（看板付き）
// ==========================================
function showGradeMenu() {
    navState = 'grade';
    isMenuVisible = true;
    btnSettings.style.display = 'none';
    showMenuView();

    menuContent.innerHTML = `
        <div class="section-banner banner-jukou">
            <span class="banner-icon">📚</span>
            <span class="banner-title">受　講</span>
        </div>
        <div class="menu-label">▶ 受講する級を選んでください</div>
        <div class="grade-menu-wrap">
            <button class="grade-btn btn-coming" disabled>
                １級　将官の心得
                <span class="grade-sub">ご期待ください</span>
            </button>
            <button class="grade-btn btn-coming" disabled>
                ２級　士官の心得
                <span class="grade-sub">ご期待ください</span>
            </button>
            <button class="grade-btn btn-grade3" data-grade="3級">
                ３級　戦士の心得
                <span class="grade-sub">開講中</span>
            </button>
        </div>
    `;
    menuContent.onclick = (e) => {
        const btn = e.target.closest('.grade-btn[data-grade]');
        if (!btn) return;
        curGrade = btn.dataset.grade;
        showGenreMenu();
    };
}

// ==========================================
// ジャンル→セクション→カード
// ==========================================
function showGenreMenu() {
    navState = 'genre';
    isMenuVisible = true;
    showMenuView();
    const genres = [...new Set(cardData.map(d => d.genre))];
    let html = `<div class="menu-label">▶ ${curGrade}　科目・ジャンルを選ぶ</div>`;
    genres.forEach(g => {
        html += `<div class="menu-item" data-genre="${g}">📁 ${g}</div>`;
    });
    menuContent.innerHTML = html;
    menuContent.onclick = (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        const genre = item.dataset.genre;
        if (genre) showSectionMenu(genre);
    };
}

function showSectionMenu(genre) {
    navState = 'section';
    isMenuVisible = true;
    curGenre = genre;
    showMenuView();
    const sections = [...new Set(cardData.filter(d => d.genre === genre).map(d => d.section))];
    let html = `<div class="menu-label">◀ ${genre}</div>`;
    sections.forEach(s => {
        const count = cardData.filter(d => d.section === s).length;
        html += `<div class="menu-item" data-section="${s}">🏷️ ${s} <span style="margin-left:auto;font-size:0.8em">${count}枚</span></div>`;
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
    showMenuView();
    let html = `<div class="menu-label">◀ ${section}</div>`;
    curSection.forEach((card, i) => {
        html += `<div class="menu-item" data-idx="${i}">${i + 1}. ${card.title}</div>`;
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
    showTextView();

    cardProgress.innerText = `${curSection[0].section}　${curIndex + 1} / ${curSection.length}`;
    cardTitle.innerText = card.title;
    cardBody.innerText = card.body;
    textView.scrollTop = 0;

    const imgPath = `images/${card.id}.png`;
    cardImage.src = imgPath;
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.src = `images/${card.id}.jpg`;
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
// リンク集（看板付き・パネル化）
// ==========================================
function showLinkGenreMenu() {
    navState = 'linkgenre';
    isMenuVisible = true;
    enterLinkFullscreen();
    showMenuView();

    const genres = [...new Set(linkData.map(d => d.genre))];

    // ジャンルごとのカラー設定
    const genreColors = [
        { bg: 'linear-gradient(135deg, #1a2a3a, #00695c)', border: '#26a69a' },
        { bg: 'linear-gradient(135deg, #1a3a1a, #2e7d32)', border: '#4caf50' },
        { bg: 'linear-gradient(135deg, #1a237e, #283593)', border: '#5c6bc0' },
        { bg: 'linear-gradient(135deg, #2a1a2a, #6a1b9a)', border: '#9c27b0' },
        { bg: 'linear-gradient(135deg, #3a2a1a, #e65100)', border: '#ff9800' },
        { bg: 'linear-gradient(135deg, #1a2a3a, #01579b)', border: '#0288d1' },
        { bg: 'linear-gradient(135deg, #3a1a1a, #b71c1c)', border: '#f44336' },
    ];

    let html = `
        <div class="section-banner banner-links">
            <span class="banner-icon">🔗</span>
            <span class="banner-title">リンク集</span>
        </div>
        <div class="link-genre-wrap">
    `;
    genres.forEach((g, i) => {
        const col = genreColors[i % genreColors.length];
        const active = linkData.filter(d => d.genre === g && d.url && d.name !== '準備中').length;
        const total = linkData.filter(d => d.genre === g).length;
        html += `
            <button class="link-genre-btn" data-genre="${g}"
                style="background:${col.bg};border-color:${col.border};">
                <span class="link-genre-name">${g}</span>
                <span class="link-genre-count">${active}/${total}</span>
            </button>
        `;
    });
    html += `</div>`;
    menuContent.innerHTML = html;

    menuContent.onclick = (e) => {
        const btn = e.target.closest('.link-genre-btn');
        if (!btn) return;
        showLinkList(btn.dataset.genre);
    };
}

function showLinkList(genre) {
    navState = 'linklist';
    isMenuVisible = true;
    showMenuView();

    const items = linkData.filter(d => d.genre === genre);
    const fields = [...new Set(items.map(d => d.field))];

    let html = `<div class="menu-label">◀ ${genre}</div>`;
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
    cardProgress.innerText = '';
    cardTitle.innerText = name;
    cardBody.innerText = 'このメニューは準備中です。\n\nお楽しみに！';
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

// ==========================================
// 表示切替
// ==========================================
function showMenuView() {
    textView.style.display = 'none';
    menuView.style.display = 'flex';
    menuView.style.flexDirection = 'column';
    isMenuVisible = true;
    updateToggleBtn('テキスト');
}

function showTextView() {
    menuView.style.display = 'none';
    textView.style.display = 'block';
    isMenuVisible = false;
    updateToggleBtn('メニュー');
}

function updateToggleBtn(label) { btnToggle.innerText = label; }

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

    btnNext.onclick = () => {
        if (navState === 'card' && curIndex < curSection.length - 1) {
            showCard(curIndex + 1);
        } else if (navState === 'card') {
            showSectionComplete();
        }
    };

    btnBack.onclick = () => {
        if (!isMenuVisible) {
            if (navState === 'card' && curIndex > 0) {
                showCard(curIndex - 1);
            } else {
                showCardList(curSection[0]?.section || '');
            }
        } else {
            if (navState === 'cardlist') showSectionMenu(curGenre);
            else if (navState === 'section') showGenreMenu();
            else if (navState === 'genre') showGradeMenu();
            else if (navState === 'grade') showTopMenu();
            else if (navState === 'linklist') showLinkGenreMenu();
            else if (navState === 'linkgenre') showTopMenu();
            else showTopMenu();
        }
    };

    btnHome.onclick = () => {
        stopVoice();
        showTopMenu();
    };

    btnToggle.onclick = () => {
        if (!isMenuVisible) {
            if (curSection.length && navState === 'card') {
                showCardList(curSection[0].section);
                setTimeout(() => {
                    document.querySelectorAll('#menu-content .menu-item').forEach((el, i) => {
                        el.classList.toggle('active-item', i === curIndex);
                    });
                }, 50);
            } else showMenuView();
        } else {
            if (curSection.length && (navState === 'card' || navState === 'cardlist')) {
                navState = 'card';
                isMenuVisible = false;
                showCard(curIndex);
            } else showTextView();
        }
    };

    btnVoice.onclick = () => {
        autoRead = !autoRead;
        if (autoRead) {
            btnVoice.innerText = '🔊 読上 ON';
            btnVoice.classList.add('playing');
            if (navState === 'card') playVoiceDirect();
        } else {
            btnVoice.innerText = '🔇 読上 OFF';
            btnVoice.classList.remove('playing');
            stopVoice();
        }
    };
}

// ==========================================
// セクション完了
// ==========================================
function showSectionComplete() {
    stopVoice();
    navState = 'complete';
    isMenuVisible = false;
    showTextView();
    cardProgress.innerText = curSection[0]?.section || '';
    cardTitle.innerText = '✅ セクション完了';
    cardBody.innerText = `全${curSection.length}枚を読み終えました。\n\n「🏠」でトップメニューへ戻れます。`;
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

// ==========================================
// 音声読み上げ（iPhone対応・v2.3）
// ==========================================
function playVoiceDirect() {
    if (!curSection.length || navState !== 'card') return;
    const card = curSection[curIndex];
    stopVoice();

    const mp3Path = `voices/${card.id}.mp3`;
    let mp3Started = false;
    let ttsStarted = false;

    voice.src = mp3Path;
    voice.volume = 1.0;
    voice.play()
        .then(() => {
            mp3Started = true;
            voice.onended = () => {};
        })
        .catch(() => {
            if (!ttsStarted) { ttsStarted = true; startTTS(card.body); }
        });

    setTimeout(() => {
        if (!mp3Started && !ttsStarted) {
            ttsStarted = true;
            voice.pause(); voice.src = '';
            startTTS(card.body);
        }
    }, 500);
}

function startTTS(text) {
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(text);
    uttr.lang = 'ja-JP';
    uttr.rate = 1.0;
    uttr.volume = 1.0;
    uttr.onend = () => {};
    window.speechSynthesis.speak(uttr);
}

function stopVoice() {
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
