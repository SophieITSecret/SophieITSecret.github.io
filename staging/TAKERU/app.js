// ==========================================
// TAKERU MSアカデミー app.js v2.4c
// ==========================================

let cardData = [];
let curSection = [];
let curIndex = 0;
let navState = 'top';
let curGenre = '';
let curGrade = '3級';
let autoRead = false;
let isMenuVisible = false;
let mp3Missing = false;

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

window.addEventListener('DOMContentLoaded', async () => {
    await loadCSV();
    setupButtons();
    setupSettings();
    loadSavedSettings();
    setupPullToRefresh();
    setupLandscapeLayout();

    document.getElementById('btn-enter').onclick = () => {
        entryScreen.style.display = 'none';
        mainUI.style.display = 'flex';
        showTopMenu();
        setTimeout(applyLandscapeLayout, 100);
    };
});

// ==========================================
// 横向きレイアウト動的計算（デバッグ表示付き）
// ==========================================
function applyLandscapeLayout() {
    const isLandscape = window.innerWidth > window.innerHeight;
    const imageArea = document.getElementById('image-area');
    const contentArea = document.getElementById('content-area');

    if (!isLandscape) {
        imageArea.style.width = '';
        contentArea.style.width = '';
        // 縦向きのときはデバッグ表示を消す
        const dbg = document.getElementById('debug-overlay');
        if (dbg) dbg.remove();
        return;
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const btnW = 32;
    const availableW = screenW - btnW;
    const minTextW = 80;
    const idealImageW = Math.floor(screenH * 4 / 3);

    let imageW, textW;
    if (idealImageW + minTextW <= availableW) {
        imageW = idealImageW;
        textW = availableW - idealImageW;
    } else {
        textW = minTextW;
        imageW = availableW - minTextW;
    }

    imageArea.style.width = imageW + 'px';
    contentArea.style.width = textW + 'px';

    // ★デバッグ表示（タップで消える）
    let dbg = document.getElementById('debug-overlay');
    if (!dbg) {
        dbg = document.createElement('div');
        dbg.id = 'debug-overlay';
        dbg.style.cssText = [
            'position:fixed', 'top:10px', 'left:10px', 'z-index:99999',
            'background:rgba(0,0,0,0.85)', 'color:#0f0', 'font-size:11px',
            'padding:8px 12px', 'border-radius:6px', 'font-family:monospace',
            'border:1px solid #0f0', 'line-height:1.6'
        ].join(';');
        dbg.onclick = () => dbg.remove();
        document.body.appendChild(dbg);
    }
    const rectH = Math.round(imageArea.getBoundingClientRect().height);
    dbg.innerHTML =
        '[タップで閉じる]<br>' +
        'innerW: ' + screenW + 'px<br>' +
        'innerH: ' + screenH + 'px<br>' +
        'availableW: ' + availableW + 'px<br>' +
        'idealImageW: ' + idealImageW + 'px<br>' +
        'imageW設定: ' + imageW + 'px<br>' +
        'textW設定: ' + textW + 'px<br>' +
        'imageArea実H: ' + rectH + 'px';
}

function setupLandscapeLayout() {
    window.addEventListener('resize', applyLandscapeLayout);
    window.addEventListener('orientationchange', () => {
        setTimeout(applyLandscapeLayout, 300);
    });
}

// ==========================================
// CSVロード
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
// トップメニュー
// ==========================================
function showTopMenu() {
    navState = 'top';
    isMenuVisible = true;
    stopVoice();
    clearCard();
    showMenuView();
    btnSettings.style.display = 'block';

    cardImage.src = 'images/takeru-top.jpg';
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    };

    menuContent.innerHTML =
        '<div class="top-menu-wrap">' +
        '<button class="top-btn btn-jukou" data-action="jukou">📚 受　講</button>' +
        '<button class="top-btn btn-library" data-action="library">🏛️ 図書館</button>' +
        '<button class="top-btn btn-news" data-action="news">📰 ニュース・お知らせ</button>' +
        '<button class="top-btn btn-links" data-action="links">🔗 リンク集</button>' +
        '<button class="top-btn btn-exam" data-action="exam">📝 受験案内</button>' +
        '</div>';

    menuContent.onclick = (e) => {
        const btn = e.target.closest('.top-btn');
        if (!btn) return;
        if (btn.dataset.action === 'jukou') showGradeMenu();
        else showPlaceholder(btn.innerText);
    };
    updateToggleBtn('メニュー');
}

// ==========================================
// 級選択
// ==========================================
function showGradeMenu() {
    navState = 'grade';
    isMenuVisible = true;
    btnSettings.style.display = 'none';
    showMenuView();

    menuContent.innerHTML =
        '<div class="menu-label">▶ 受講する級を選んでください</div>' +
        '<div class="grade-menu-wrap">' +
        '<button class="grade-btn btn-coming" disabled>１級　将官の心得<span class="grade-sub">ご期待ください</span></button>' +
        '<button class="grade-btn btn-coming" disabled>２級　士官の心得<span class="grade-sub">ご期待ください</span></button>' +
        '<button class="grade-btn btn-grade3" data-grade="3級">３級　戦士の心得<span class="grade-sub">開講中</span></button>' +
        '</div>';

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
    let html = '<div class="menu-label">▶ ' + curGrade + '　科目・ジャンルを選ぶ</div>';
    genres.forEach(g => {
        html += '<div class="menu-item" data-genre="' + g + '">📁 ' + g + '</div>';
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
    let html = '<div class="menu-label">◀ ' + genre + '</div>';
    sections.forEach(s => {
        const count = cardData.filter(d => d.section === s).length;
        html += '<div class="menu-item" data-section="' + s + '">🏷️ ' + s + ' <span style="color:#555;margin-left:auto;font-size:0.8em">' + count + '枚</span></div>';
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
    let html = '<div class="menu-label">◀ ' + section + '</div>';
    curSection.forEach((card, i) => {
        html += '<div class="menu-item" data-idx="' + i + '">' + (i + 1) + '. ' + card.title + '</div>';
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
    hideVoiceWarning();
    mp3Missing = false;
    curIndex = Math.max(0, Math.min(idx, curSection.length - 1));
    const card = curSection[curIndex];

    navState = 'card';
    isMenuVisible = false;
    showTextView();

    cardProgress.innerText = curSection[0].section + '　' + (curIndex + 1) + ' / ' + curSection.length;
    cardTitle.innerText = card.title;
    cardBody.innerText = card.body;
    textView.scrollTop = 0;

    const imgPath = 'images/' + card.id + '.png';
    cardImage.src = imgPath;
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.src = 'images/' + card.id + '.jpg';
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
        if (mp3Missing) {
            hideVoiceWarning();
            mp3Missing = false;
            autoRead = true;
            btnVoice.innerText = '🔊 読上 ON';
            btnVoice.classList.add('playing');
            if (navState === 'card') startTTS(curSection[curIndex].body);
            return;
        }
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
    cardBody.innerText = '全' + curSection.length + '枚を読み終えました。\n\n「🏠」でトップメニューへ戻れます。';
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

// ==========================================
// 音声再生
// ==========================================
function playVoiceDirect() {
    if (!curSection.length || navState !== 'card') return;
    const card = curSection[curIndex];
    stopVoice();
    mp3Missing = false;

    voice.src = 'voices/' + card.id + '.mp3';
    voice.volume = 1.0;
    voice.play()
        .then(() => {
            voice.onended = () => {};
        })
        .catch(() => {
            voice.src = '';
            mp3Missing = true;
            autoRead = false;
            btnVoice.innerText = '🔊 読上';
            btnVoice.classList.remove('playing');
            showVoiceWarning();
        });
}

function showVoiceWarning() {
    const el = document.getElementById('voice-warning');
    el.style.display = 'block';
    document.getElementById('voice-warning-box').onclick = () => {
        hideVoiceWarning();
        mp3Missing = false;
    };
}

function hideVoiceWarning() {
    document.getElementById('voice-warning').style.display = 'none';
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
    hideVoiceWarning();
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
    document.body.classList.add('font-' + size);
}

function loadSavedSettings() {
    const theme = localStorage.getItem('takeru-theme') || 'dark';
    const font = localStorage.getItem('takeru-font') || 'medium';
    if (theme === 'light') {
        document.body.classList.replace('dark-mode', 'light-mode');
        setActiveToggle('btn-light', ['btn-dark', 'btn-light']);
    }
    setFontSize(font);
    setActiveToggle('btn-font-' + font, ['btn-font-s','btn-font-m','btn-font-l']);
}

// ==========================================
// プルダウンで更新（220px・誤作動防止強化）
// ==========================================
function setupPullToRefresh() {
    let startY = 0;
    let pulling = false;

    document.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        pulling = false;
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
