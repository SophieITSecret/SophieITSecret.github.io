// js/sophie_today.js
// カウンター画面に「この日どんな日」を表示
// - label-bar (#today-date-info) に日付・曜日・暦を表示
// - nav-main (#today-card) にタイトル行「今日は：〇〇」を表示

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
        return await res.json();
    } catch (e) { return []; }
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
    if (entry.mp3) {
        const originalVol = _duckYoutube();
        const audio = new Audio(`./voices_mp3/${entry.mp3}`);
        const restore = () => _restoreYoutube(originalVol);
        audio.addEventListener('ended', restore);
        audio.addEventListener('error', restore);
        audio.play().catch(restore);
    }

    // 2. K1画面へ遷移（200ms遅延で音声優先）
    setTimeout(() => {
        import('./konohi.js').then(k => k.showKonoHi(_onBack));
    }, 200);
}

export async function initToday(onBack) {
    _onBack = onBack;

    const arr = await _load();
    if (!arr.length) return;

    const key = _todayKey();
    const entry = arr.find(e => e.date === key);
    if (!entry) return;

    const d = new Date();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const wd = _weekdayJa();

    // --- 修正1: 日付行を label-bar (#today-date-info) に表示 ---
    const calendarHtml = entry.calendar
        ? `<span style="color:#9a8060; margin-left:4px;">${entry.calendar_type === '祝日' ? '🗾 ' : ''}${entry.calendar}</span>`
        : '';

    const dateInfo = document.getElementById('today-date-info');
    if (dateInfo) {
        dateInfo.innerHTML = `
            <span style="display:flex; align-items:center; gap:3px;
                         color:#888; font-size:0.68rem; white-space:nowrap; user-select:none; pointer-events:none;">
                <span>📅</span>
                <span>${month}月${day}日 ${wd}曜日${calendarHtml}</span>
            </span>`;
    }

    // --- 修正2: タイトル行を nav-main (#today-card) に「今日は：」付きで表示 ---
    const title = entry.entries?.[0]?.title || '';
    const card = document.getElementById('today-card');
    if (card && title) {
        card.innerHTML = `
            <div id="today-entry-btn"
                 style="width:92%; margin:0 auto; padding:4px 10px;
                        cursor:pointer; -webkit-tap-highlight-color:transparent; user-select:none;">
                <span style="color:#ffb3c1; font-size:0.78rem; font-weight:bold;">今日は：</span><span style="color:#c8b090; font-size:0.78rem;">${title}</span>
            </div>`;
        document.getElementById('today-entry-btn').addEventListener('click', () => _onTap(entry));
    }
}
