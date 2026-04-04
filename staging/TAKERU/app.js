// ==========================================
// TAKERU 軍事戦略検定 app.js v1.1
// ==========================================

let cardData = [];
let curSection = [];
let curIndex = 0;
let navState = 'top';
let curGenre = '';
let autoRead = false;

const voice = new Audio();

const entryScreen = document.getElementById('entry-screen');
const mainUI = document.getElementById('main-ui');
const cardImage = document.getElementById('card-image');
const imagePlaceholder = document.getElementById('image-placeholder');
const textView = document.getElementById('text-view');
const menuView = document.getElementById('menu-view');
const menuContent = document.getElementById('menu-content');
const cardTitle = document.getElementById('card-title');
const cardBody = document.getElementById('card-body');
const btnVoice = document.getElementById('btn-voice');
const btnNext = document.getElementById('btn-next');
const btnBack = document.getElementById('btn-back');
const btnToggle = document.getElementById('btn-toggle');

window.addEventListener('DOMContentLoaded', async () => {
    await loadCSV();
    setupButtons();
    document.getElementById('btn-enter').onclick = () => {
        entryScreen.style.display = 'none';
        mainUI.style.display = 'flex';
        showTopMenu();
    };
});

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

function showTopMenu() {
    navState = 'top';
    stopVoice();
    clearCard();
    menuView.style.display = 'flex';
    menuView.style.flexDirection = 'column';
    textView.style.display = 'none';
    updateToggleBtn('メニュー');

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
        if (action === 'jukou') showGenreMenu();
        else showPlaceholder(btn.innerText);
    };
}

function showPlaceholder(name) {
    navState = 'placeholder';
    showText();
    cardTitle.innerText = name;
    cardBody.innerText = 'このメニューは準備中です。\n\nお楽しみに！';
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

function showGenreMenu() {
    navState = 'genre';
    showMenu();
    const genres = [...new Set(cardData.map(d => d.genre))];
    let html = '<div class="menu-label">▶ 科目・ジャンルを選ぶ</div>';
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
    showMenu();
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
    showMenu();
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
    showText();
    cardTitle.innerText = `[${curIndex + 1}/${curSection.length}] ${card.title}`;
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

    navState = 'card';
    stopVoice();
    if (autoRead) setTimeout(() => playVoice(), 300);
}

function showMenu() {
    textView.style.display = 'none';
    menuView.style.display = 'flex';
    menuView.style.flexDirection = 'column';
    updateToggleBtn('テキスト');
}

function showText() {
    menuView.style.display = 'none';
    textView.style.display = 'block';
    updateToggleBtn('メニュー');
}

function updateToggleBtn(label) { btnToggle.innerText = label; }

function clearCard() {
    cardTitle.innerText = '';
    cardBody.innerText = '';
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
    stopVoice();
}

function setupButtons() {
    btnBack.onclick = () => {
        if (navState === 'card' && curIndex > 0) {
            showCard(curIndex - 1);
        } else if (navState === 'card') {
            showCardList(curSection[0]?.section || '');
        } else if (navState === 'section') {
            showGenreMenu();
        } else if (navState === 'genre') {
            showTopMenu();
        } else {
            showTopMenu();
        }
    };

    document.getElementById('btn-section').onclick = () => {
        if (curGenre) showSectionMenu(curGenre);
        else showGenreMenu();
    };

    btnNext.onclick = () => {
        if (navState === 'card' && curIndex < curSection.length - 1) {
            showCard(curIndex + 1);
        } else if (navState === 'card') {
            showSectionComplete();
        }
    };

    btnToggle.onclick = () => {
        if (menuView.style.display === 'none') {
            if (navState === 'card' && curSection.length) {
                showCardList(curSection[0].section);
                setTimeout(() => {
                    document.querySelectorAll('#menu-content .menu-item').forEach((el, i) => {
                        el.classList.toggle('active-item', i === curIndex);
                    });
                }, 50);
            } else showMenu();
        } else {
            if (curSection.length && navState === 'card') showCard(curIndex);
            else showText();
        }
    };

    btnVoice.onclick = () => {
        autoRead = !autoRead;
        if (autoRead) {
            btnVoice.innerText = '🔊 読上 ON';
            btnVoice.classList.add('playing');
            if (navState === 'card') playVoice();
        } else {
            btnVoice.innerText = '🔇 読上 OFF';
            btnVoice.classList.remove('playing');
            stopVoice();
        }
    };
}

function showSectionComplete() {
    stopVoice();
    showText();
    cardTitle.innerText = '✅ セクション完了';
    cardBody.innerText = `「${curSection[0]?.section || ''}」の全${curSection.length}枚を読み終えました。\n\n章選択ボタンで次のセクションへ進みましょう。`;
    cardImage.style.display = 'none';
    imagePlaceholder.style.display = 'flex';
}

function playVoice() {
    if (!curSection.length || navState !== 'card') return;
    const card = curSection[curIndex];
    voice.src = `voices/${card.id}.mp3`;
    voice.play().then(() => {
        voice.onended = () => {
            if (autoRead) {
                if (curIndex < curSection.length - 1) setTimeout(() => showCard(curIndex + 1), 500);
                else showSectionComplete();
            }
        };
    }).catch(() => {
        const uttr = new SpeechSynthesisUtterance(card.body);
        uttr.lang = 'ja-JP';
        uttr.rate = 1.0;
        uttr.onend = () => {
            if (autoRead) {
                if (curIndex < curSection.length - 1) setTimeout(() => showCard(curIndex + 1), 500);
                else showSectionComplete();
            }
        };
        window.speechSynthesis.speak(uttr);
    });
}

function stopVoice() {
    voice.pause();
    voice.currentTime = 0;
    window.speechSynthesis.cancel();
}
