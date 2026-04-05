// ==========================================
// TAKERU MSアカデミー app.js v2.0
// ==========================================

let cardData = [];
let curSection = [];
let curIndex = 0;
let navState = 'top';
let curGenre = '';
let curGrade = '3級';
let autoRead = false;

const voice = new Audio();

// DOM要素
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

// ==========================================
// 起動
// ==========================================
window.addEventListener('DOMContentLoaded', async () => {
    await loadCSV();
    setupButtons();
    setupSettings();
    loadSavedSettings();

    document.getElementById('btn-enter').onclick = () => {
        entryScreen.style.display = 'none';
        mainUI.style.display = 'flex';
        showTopMenu();
    };

    // プルダウンで更新（PWA対応）
    setupPullToRefresh();
});

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
    stopVoice();
    clearCard();
    showMenuView();

    // トップ画像を表示
    cardImage.src = 'images/takeru-top.jpg';
    cardImage.style.display = 'block';
    imagePlaceholder.style.display = 'none';
    cardImage.onerror = () => {
        cardImage.style.display = 'none';
        imagePlaceholder.style.display = 'flex';
    };

    // 設定ボタンを表示
    btnSettings.style.display = 'block';

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
        const action = btn.dataset.action;
        if (action === 'jukou') showGradeMenu();
        else showPlaceholder(btn.innerText);
    };

    updateToggleBtn('メニュー');
}

// ==========================================
// 級選択メニュー（1級・2級・3級）
// ==========================================
function showGradeMenu() {
    navState = 'grade';
    btnSettings.style.display = 'none';
    showMenuView();

    menuContent.innerHTML = `
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
    curGenre = genre;
    showMenuView();
    const sections = [...new Set(cardData.filter(d => d.genre === genre).map(d => d.section))];
    let html = `<div class="menu-label">◀ ${genre}</div>`;
    sections.forEach(s => {
        const count = cardData.filter(d => d.section === s).length;
        html += `<div class="menu-item" data-section="${s}">🏷️ ${s} <span style="color:#555;margin-left:auto;font-size:0.8em">${count}枚</span></div>`;
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
    navState = 'card';
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

    showTextView();
    cardProgress.innerText = `${curSection[0].section}　${curIndex + 1} / ${curSection.length}`;
    cardTitle.innerText = card.title;
    cardBody.innerText = card.body;
    textView.scrollTop = 0;

    // 画像表示
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

    // アクティブ更新
    document.querySelectorAll('#menu-content .menu-item').forEach((el, i) => {
        el.classList.toggle('active-item', i === curIndex);
    });

    navState = 'card';
    stopVoice();
    if (autoRead) setTimeout(() => playVoiceDirect(), 300);
}

// ==========================================
// 未実装メニュー
// ==========================================
function showPlaceholder(name) {
    navState = 'placeholder';
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
    updateToggleBtn('テキスト');
}

function showTextView() {
    menuView.style.display = 'none';
    textView.style.display = 'block';
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

    // 次へ
    btnNext.onclick = () => {
        if (navState === 'card' && curIndex < curSection.length - 1) {
            showCard(curIndex + 1);
        } else if (navState === 'card') {
            showSectionComplete();
        }
    };

    // 戻る（前のカードへ）
    btnBack.onclick = () => {
        if (navState === 'card' && curIndex > 0) {
            showCard(curIndex - 1);
        } else if (navState === 'card') {
            showCardList(curSection[0]?.section || '');
        } else if (navState === 'section') {
            showGenreMenu();
        } else if (navState === 'genre') {
            showGradeMenu();
        } else if (navState === 'grade') {
            showTopMenu();
        } else {
            showTopMenu();
        }
    };

    // ホーム（トップメニューへ一発で戻る）
    btnHome.onclick = () => {
        stopVoice();
        showTopMenu();
    };

    // テキスト/メニュー切り替え
    btnToggle.onclick = () => {
        if (menuView.style.display === 'none') {
            if (navState === 'card' && curSection.length) {
                showCardList(curSection[0].section);
                setTimeout(() => {
                    document.querySelectorAll('#menu-content .menu-item').forEach((el, i) => {
                        el.classList.toggle('active-item', i === curIndex);
                    });
                }, 50);
            } else showMenuView();
        } else {
            if (curSection.length && navState === 'card') showCard(curIndex);
            else showTextView();
        }
    };

    // 読上ON/OFFトグル
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
    showTextView();
    cardProgress.innerText = curSection[0]?.section || '';
    cardTitle.innerText = '✅ セクション完了';
    cardBody.innerText = `全${curSection.length}枚を読み終えました。\n\n「戻る」でカード一覧へ、「🏠」でトップメニューへ戻れます。`;
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

// ==========================================
// 音声読み上げ（iPhone対応）
// ==========================================
function playVoiceDirect() {
    if (!curSection.length || navState !== 'card') return;
    const card = curSection[curIndex];

    // まずWeb TTSを起動（iPhoneはこれが確実）
    window.speechSynthesis.cancel();
    const uttr = new SpeechSynthesisUtterance(card.body);
    uttr.lang = 'ja-JP';
    uttr.rate = 1.0;
    uttr.onend = () => { /* 一枚で止まる */ };
    window.speechSynthesis.speak(uttr);

    // MP3があれば上書き再生
    const mp3Path = `voices/${card.id}.mp3`;
    const testAudio = new Audio();
    testAudio.src = mp3Path;
    testAudio.play().then(() => {
        // MP3が再生できたらTTSをキャンセルしてMP3を使う
        window.speechSynthesis.cancel();
        // 少し待ってボリュームをフェードイン
        testAudio.volume = 0;
        voice.src = mp3Path;
        voice.volume = 0;
        voice.play().then(() => {
            testAudio.pause();
            // フェードイン
            let vol = 0;
            const fade = setInterval(() => {
                vol = Math.min(1, vol + 0.1);
                voice.volume = vol;
                if (vol >= 1) clearInterval(fade);
            }, 50);
            voice.onended = () => { /* 一枚で止まる */ };
        });
    }).catch(() => {
        // MP3なし → TTSのまま
    });
}

function stopVoice() {
    voice.pause();
    voice.currentTime = 0;
    voice.volume = 1;
    window.speechSynthesis.cancel();
}

// ==========================================
// 設定パネル
// ==========================================
function setupSettings() {
    btnSettings.onclick = () => {
        settingsPanel.style.display = 'flex';
    };
    document.getElementById('btn-settings-close').onclick = () => {
        settingsPanel.style.display = 'none';
    };

    // カラーモード
    document.getElementById('btn-dark').onclick = () => {
        document.body.classList.remove('light-mode');
        document.body.classList.add('dark-mode');
        setActiveToggle('btn-dark', ['btn-dark', 'btn-light']);
        localStorage.setItem('takeru-theme', 'dark');
    };
    document.getElementById('btn-light').onclick = () => {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        setActiveToggle('btn-light', ['btn-dark', 'btn-light']);
        localStorage.setItem('takeru-theme', 'light');
    };

    // フォントサイズ
    document.getElementById('btn-font-s').onclick = () => {
        setFontSize('small');
        setActiveToggle('btn-font-s', ['btn-font-s', 'btn-font-m', 'btn-font-l']);
        localStorage.setItem('takeru-font', 'small');
    };
    document.getElementById('btn-font-m').onclick = () => {
        setFontSize('medium');
        setActiveToggle('btn-font-m', ['btn-font-s', 'btn-font-m', 'btn-font-l']);
        localStorage.setItem('takeru-font', 'medium');
    };
    document.getElementById('btn-font-l').onclick = () => {
        setFontSize('large');
        setActiveToggle('btn-font-l', ['btn-font-s', 'btn-font-m', 'btn-font-l']);
        localStorage.setItem('takeru-font', 'large');
    };
}

function setActiveToggle(activeId, allIds) {
    allIds.forEach(id => {
        document.getElementById(id).classList.toggle('active', id === activeId);
    });
}

function setFontSize(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add(`font-${size}`);
}

function loadSavedSettings() {
    const theme = localStorage.getItem('takeru-theme') || 'dark';
    const font = localStorage.getItem('takeru-font') || 'medium';
    if (theme === 'light') {
        document.body.classList.remove('dark-mode');
        document.body.classList.add('light-mode');
        setActiveToggle('btn-light', ['btn-dark', 'btn-light']);
    }
    setFontSize(font);
    setActiveToggle(`btn-font-${font}`, ['btn-font-s', 'btn-font-m', 'btn-font-l']);
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
        const scrollEl = document.getElementById('menu-content') || document.getElementById('text-view');
        const atTop = scrollEl ? scrollEl.scrollTop === 0 : true;
        if (atTop && y - startY > 60) pulling = true;
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (pulling) {
            pulling = false;
            location.reload();
        }
    });
}
