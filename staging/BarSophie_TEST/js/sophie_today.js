// js/sophie_today.js
// カウンター画面に「この日どんな日」カードを表示
// sophie_today.json（配列）から当日エントリを検索し、タップで音声+K1遷移

let _onBack = null;

function _todayKey() {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function _weekdayJa() {
    return ['日','月','火','水','木','金','土'][new Date().getDay()];
}

async function _load() {
    try {
        const res = await fetch('./sophie_today.json');
        const arr = await res.json();
        const key = _todayKey();
        return arr.find(e => e.date === key) || null;
    } catch (e) { return null; }
}

function _duckYoutube() {
    const player = window._ytPlayer;
    if (!player) return null;
    try {
        const vol = player.getVolume();
        player.setVolume(Math.round(vol * 0.2));
        return vol;
    } catch (e) { return null; }
}

function _restoreYoutube(vol) {
    if (vol === null) return;
    const player = window._ytPlayer;
    if (!player) return;
    try { player.setVolume(vol); } catch (e) {}
}

function _onTap(entry) {
    // 1. ダッキング + 音声再生
    let originalVol = null;
    if (entry.mp3) {
        originalVol = _duckYoutube();
        const audio = new Audio(`./voices_mp3/${entry.mp3}`);
        const restore = () => _restoreYoutube(originalVol);
        audio.addEventListener('ended', restore);
        audio.addEventListener('error', restore);
        audio.play().catch(restore);
    }

    // 2. K1画面へ遷移（narration を渡す）
    import('./konohi.js').then(k => {
        k.showKonoHi(_onBack, entry.narration || null);
    });
}

export async function initToday(onBack) {
    _onBack = onBack;

    const entry = await _load();
    if (!entry) return;

    const card = document.getElementById('today-card');
    if (!card) return;

    const d = new Date();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const wd = _weekdayJa();

    const calendarHtml = entry.calendar
        ? ` <span style="color:#9a8060; font-size:0.68rem; margin-left:3px;">${entry.calendar_type === '祝日' ? '🗾 ' : ''}${entry.calendar}</span>`
        : '';

    const title = entry.entries?.[0]?.title || '';

    card.innerHTML = `
        <div style="width:92%; margin:0 auto; padding:7px 10px 6px;
                    background:rgba(255,255,255,0.03); border-radius:6px;
                    border:1px solid rgba(255,255,255,0.06);">
            <div style="color:#888; font-size:0.7rem; margin-bottom:3px;
                        display:flex; align-items:center; user-select:none; pointer-events:none;">
                <span style="margin-right:5px;">📅</span>
                <span>${month}月${day}日 ${wd}曜日${calendarHtml}</span>
            </div>
            <div id="today-entry-btn"
                 style="color:#b8a878; font-size:0.78rem; line-height:1.5; padding-left:4px;
                        cursor:pointer; -webkit-tap-highlight-color:transparent; user-select:none;">
                ${title}
            </div>
        </div>`;

    document.getElementById('today-entry-btn').addEventListener('click', () => _onTap(entry));
}
