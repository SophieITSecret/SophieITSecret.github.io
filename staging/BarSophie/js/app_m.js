import * as media from './media.js';
import * as nav from './navigation.js';

let isPaused = false, isAutoPlay = false, isMusicMode = false;
let lastTelopTxt = "", pressTimer = null;

const yt = document.getElementById('yt-iframe'), img = document.getElementById('monitor-img'), tel = document.getElementById('telop');

// 初期化
document.addEventListener('DOMContentLoaded', async () => {
    await nav.loadAllData();
    setupListeners();
    // YouTube終了監視
    setInterval(monitorYouTube, 1000);
});

function setupListeners() {
    document.getElementById('btn-enter').onclick = enter;
    document.getElementById('btn-to-bar').onclick = goToBar;
    document.getElementById('ctrl-play').onclick = playHead;
    document.getElementById('ctrl-pause').onclick = togglePause;
    document.getElementById('ctrl-back').onclick = handleBack;
    document.getElementById('sophie-warp').onclick = sophieWarp;
    document.getElementById('btn-music').onclick = openMusic;
    document.getElementById('btn-talk').onclick = openTalk;
    
    const btnNext = document.getElementById('btn-next');
    btnNext.onpointerdown = (e) => {
        pressTimer = setTimeout(() => { isAutoPlay = !isAutoPlay; updateAutoPlayUI(); pressTimer = null; }, 600);
    };
    btnNext.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; next(); } };
}

// (※ここにはv12.7の全ロジック：next, playHead, renderListなどを移行して集約します)
// ... (長くなるため、GitHubへアップする際はフルコードをお渡しします)
