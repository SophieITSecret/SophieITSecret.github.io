// js/app_m.js
/**
 * Bar Sophie v22.4 — app_m.js
 * ★ S2でSボタン→リクエストモード（前口上→自動再生）
 */

import * as media    from './media.js';
import * as nav      from './navigation.js';
import * as utils    from './utils.js';
import * as music    from './music.js';
import * as liquor   from './liquor.js';
import * as shop     from './shop.js';

let talkAudio;
let ytPlayer = null;
let ytPlayerReady = false;
let pressTimer = null;

document.addEventListener('DOMContentLoaded', async () => {
    utils.initDom();
    talkAudio = document.getElementById('talk-audio') || document.createElement('audio');
    if (!talkAudio.id) { talkAudio.id = 'talk-audio'; document.body.appendChild(talkAudio); }

    try {
        await nav.loadAllData();
        await shop.initShop();
    } catch (e) {
        alert("データの読み込みに失敗しました。");
        return;
    }

    liquor.setRenderConsole(renderConsole);
    music.setRenderConsole(renderConsole);
    
    import('./favorite.js').then(fav => {
        fav.initMusicPatch();
    }).catch(e => console.warn("favorite.js load error", e));
    
    setup();
    window._renderConsole = renderConsole;
    window._showRootMenu = showRootMenu;

    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
});

window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('yt-player', {
        playerVars: { playsinline: 1, autoplay: 1, rel: 0, controls: 1 },
        events: {
            onReady: () => {
                ytPlayerReady = true;
                music.setYtReady(ytPlayer);
                music.initMusic(talkAudio, ytPlayer, true, document.getElementById('telop'));
            },
            onStateChange: (e) => {
    if (e.data === YT.PlayerState.ENDED) {
        if (music.isAutoPlayMode && music.isAutoPlayMode()) {
            music.nextAutoPlay();
        } else if (music.isAutoPlay && music.isMusicMode) {
            music.next();
        }
    }
}
        }
    });
};

function setup() {
    music.initMusic(talkAudio, null, false, document.getElementById('telop'));
    talkAudio.onended = music.defaultOnEnded;

    document.getElementById('btn-enter').onclick = () => {
        document.getElementById('entry-screen').style.display = 'none';
        document.getElementById('chat-mode').style.display = 'flex';
        if (ytPlayerReady && ytPlayer) {
            try { ytPlayer.mute(); ytPlayer.loadVideoById('2vfCbdmKhMw'); setTimeout(() => { ytPlayer.pauseVideo(); ytPlayer.unMute(); }, 1000); } catch(e) {}
        }
        playVoice("./voices_mp3/greeting.mp3", "いらっしゃいませ。");
    };

    document.getElementById('btn-to-bar').onclick = () => {
        document.getElementById('chat-mode').style.display = 'none';
        document.getElementById('main-ui').style.display = 'flex';
        window.speechSynthesis.cancel();
        talkAudio.pause();
        showRootMenu();
        playVoice("./voices_mp3/menu_greeting.mp3", "いつもありがとうございます。今日はいかがされますか？");
    };

        document.getElementById('btn-music').onclick = () => { if (music.openMusic) music.openMusic(); renderConsole('standard'); };
        document.getElementById('btn-liquor').onclick = liquor.openLiquorPortal;
        document.getElementById('btn-talk').onclick = () => { if (music.openTalk) music.openTalk(); renderConsole('standard'); };
// ★以下2行を追加
document.getElementById('btn-news').onclick = () => showNewsMarket();
document.getElementById('btn-notice').onclick = () => {
    import('./favorite.js').then(f => {
        f.openNotice();
        renderConsole('standard');
    }).catch(e => alert("準備中です"));
};
    document.getElementById('sophie-warp').onclick = () => {
        if (nav.state !== "none") {
            showRootMenu();
        } else {
            document.getElementById('main-ui').style.display = 'none';
            document.getElementById('chat-mode').style.display = 'flex';
            const loungeText = document.getElementById('lounge-text');
            loungeText.innerText = "ありがとうございました。";
            window.speechSynthesis.cancel();
            if (ytPlayerReady && ytPlayer) { try { ytPlayer.pauseVideo(); } catch(e){} }
            try { talkAudio.pause(); } catch(e){}
            talkAudio.src = "./voices_mp3/goodbye.mp3";
            const finalize = () => {
                setTimeout(() => {
                    document.getElementById('chat-mode').style.display = 'none';
                    document.getElementById('entry-screen').style.display = 'flex';
                    loungeText.innerText = "いらっしゃいませ。";
                    talkAudio.onended = music.defaultOnEnded;
                    document.getElementById('monitor-img').src = "";
                }, 1000);
            };
            talkAudio.onended = finalize;
            talkAudio.onerror = finalize;
            try { const p = talkAudio.play(); if (p) p.catch(finalize); } catch(e) { finalize(); }
        }
    };

    setupNextButton();
    renderConsole('standard');
    showRootMenu();
}

function playVoice(src, txt) {
    talkAudio.src = src;
    talkAudio.onerror = () => { try { media.speak(txt); } catch(e){} };
    try {
        const p = talkAudio.play();
        if (p !== undefined) p.catch(() => { try { media.speak(txt); } catch(e){} });
    } catch(e) { try { media.speak(txt); } catch(err){} }
}

function showRootMenu() {
    const lv  = document.getElementById('list-view');
    const nm  = document.getElementById('nav-main');
    const img = document.getElementById('monitor-img');
    const yt  = document.getElementById('yt-wrapper');
    const tel = document.getElementById('telop');
    const mon = document.querySelector('.monitor');

    lv.style.display  = 'none';
    nm.style.display  = 'block';
    nav.updateNav("none");
    yt.style.display  = 'none';
    img.src = './front_sophie.jpeg';
    img.style.display = 'block';
    // ★chart-frameをクリア
    const cw = document.getElementById('chart-wrapper');
    if (cw) { cw.style.display = 'none'; cw.innerHTML = ''; }
    if (tel) tel.style.display = 'none';
    if (mon) { mon.classList.remove('expanded'); }
    utils.showLSide();

    renderConsole('standard');
}

function handleBack() {
    if (nav.state === "techo") {
        import('./favorite.js').then(f => {
            const folder = f.getCurrentFolder();
            if (folder !== null) {
                f.openTecho(null);
                renderConsole('standard');
            } else {
                showRootMenu();
            }
        });
        return;
    }
    if (["shop", "notice"].includes(nav.state)) { showRootMenu(); return; }
    if (liquor.handleLiquorBack && liquor.handleLiquorBack()) return;
    if (music.handleBack && music.handleBack()) return;
    showRootMenu();
}

function setupNextButton() {
    const btnN = document.getElementById('btn-next');
    if (btnN) {
        btnN.onpointerdown = (e) => {
            e.preventDefault();
            pressTimer = setTimeout(() => { music.next(); btnN.classList.toggle('auto-active'); pressTimer = null; }, 600);
        };
        btnN.onpointerup = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; music.next(); } };
        btnN.onpointerleave = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    }
}

// ★ 画面ごとのSボタン動作
function handleSButton() {
    const ice = new Audio('./voices_mp3/ice.mp3');
    ice.onended = () => showSophieMenu();
    ice.play().catch(() => showSophieMenu());
}

function showSophieMenu() {
    const state = nav.state;

    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    // ★ニュース・マーケット画面の場合は保存しない
const isNewsScreen = lv && lv.querySelector('#nm-ann');
const prevHtml    = (lv && !isNewsScreen) ? lv.innerHTML : '';
const prevDisplay = (lv && !isNewsScreen) ? lv.style.display : 'none';
const prevNm      = nm ? nm.style.display : 'none';

    const specificItems = {
        "tit": [
            { label: "🎵 DJソフィー（解説＋自動再生）", action: () => music.startRequestMode() },
            { label: "🔁 連続再生", action: () => showAutoPlaySelect() }, 
        ],
        "lq_list": [
            { label: "📖 カテゴリー解説", disabled: true },
            { label: "⭐ ソフィーのイチ押し銘柄", disabled: true },
        ],
        "lq_scr": [
            { label: "📖 スクリーニング使い方ガイド", disabled: true },
        ],
        "st": [
            { label: "📋 記事の目次ナビゲーター", disabled: true },
        ],
        "techo": [
            { label: "🔁 連続再生（お気に入りの歌）", action: () => showTechoAutoPlay() },
        ],
    };

    const specific = specificItems[state] || [];

    const specificHtml = specific.length ? specific.map((item, i) =>
        item.disabled
        ? `<button class="act-btn" style="background:#1a1a1a; color:#444; border:1px solid #222; margin-bottom:8px;" disabled>${item.label}（準備中）</button>`
        : `<button class="act-btn s-menu-specific" data-idx="${i}" style="background:#1a5276; border-color:#1a5276; margin-bottom:8px;">${item.label}</button>`
    ).join('') : '';

    const menuHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                お呼びですか？
            </div>
            <div style="padding:10px;">
                ${specificHtml}
                ${specific.length ? '<div style="border-top:1px solid #222; margin:8px 0;"></div>' : ''}
                <button class="act-btn" id="sm-janken" style="background:#8e1a2e; margin-bottom:8px;">🎲 じゃんけん勝負</button>
                <button class="act-btn" style="background:#1a1a1a; color:#444; border:1px solid #222; margin-bottom:8px;" disabled>📅 この日はどんな日（近日公開）</button>
                <button class="act-btn" id="sm-close" style="background:#34495e; margin-top:4px;">閉じる</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = menuHtml; }
    if (nm) nm.style.display = 'none';

    document.getElementById('sm-janken').onclick = () => {
        import('./janken.js').then(j => j.startJanken());
    };
    document.getElementById('sm-close').onclick = () => {
        if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
        if (nm) nm.style.display = prevNm;
    };
    document.querySelectorAll('.s-menu-specific').forEach(btn => {
        const idx = parseInt(btn.dataset.idx);
        if (specific[idx] && !specific[idx].disabled) {
            btn.onclick = () => specific[idx].action();
        }
    });
}

function showNewsMarket() {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    if (nm) nm.style.display = 'none';
    nav.updateNav("lq_main");

    const showYoutube = (videoId) => {
        const cw = document.getElementById('chart-wrapper');
        if (cw) { cw.style.display = 'none'; cw.innerHTML = ''; }
        const yt = document.getElementById('yt-wrapper');
        const img = document.getElementById('monitor-img');
        const lside = document.querySelector('.l-side');
        if (lside) lside.style.display = 'flex';
        if (img) img.style.display = 'none';
        if (yt) {
            yt.style.display = 'block';
            yt.innerHTML = `<iframe width="100%" height="100%" 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1" 
                frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
        }
    };

    const showChart = (symbol) => {
        const cw = document.getElementById('chart-wrapper');
        const yt = document.getElementById('yt-wrapper');
        const img = document.getElementById('monitor-img');
        const lside = document.querySelector('.l-side');
        if (lside) lside.style.display = 'flex';
        if (img) img.style.display = 'none';
        if (yt) yt.style.display = 'none';
        if (cw) {
            cw.style.display = 'block';
            cw.innerHTML = `<iframe src="https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(symbol)}&interval=D&theme=dark&style=1&timezone=Etc%2FUTC&locale=ja" width="100%" height="100%" frameborder="0"></iframe>`;
        }
    };

    const openLink = (url) => window.open(url, '_blank');

    const mainHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0;">📰 NEWS・マーケット</div>
            <div style="padding:10px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                    <button class="act-btn nm-btn" id="nm-ann"     style="background:#1a3a4a; margin:0;">📺 テレ朝NEWS24</button>
                    <button class="act-btn nm-btn" id="nm-weather" style="background:#1a3a4a; margin:0;">🌤 ウェザーニュース</button>
                    <button class="act-btn nm-btn" id="nm-camera"  style="background:#1a2a1a; margin:0;">📷 ライブカメラ</button>
                    <button class="act-btn nm-btn" id="nm-market"  style="background:#1a1a3a; margin:0;">📊 マーケット</button>
                    <button class="act-btn nm-btn" id="nm-newsmenu" style="background:#2a1a1a; margin:0;">📰 ニュース・情報</button>
                    <button class="act-btn nm-btn" id="nm-useful"  style="background:#1a2a2a; margin:0;">🔗 便利情報</button>
                </div>
                <button class="act-btn" id="nm-back" style="background:#34495e;">戻る</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = mainHtml; }

    document.getElementById('nm-ann').onclick     = () => showYoutube('coYw-eVU0Ks');
    document.getElementById('nm-weather').onclick = () => showYoutube('G1souS7inLE');
    document.getElementById('nm-back').onclick    = () => showRootMenu();

    document.getElementById('nm-camera').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">📷 ライブカメラ</div>
                <div style="padding:10px;">
                   <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🇯🇵 日本</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=8H3nRCFVR6Y','_blank')">🗼 渋谷スクランブル</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=bzn2QWfOLFY','_blank')">🏮 大阪・道頓堀</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=X5rq4ioggLk','_blank')">🌸 京都・花見小路</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=Sv9hcJ3k5h4','_blank')">🗻 富士山(河口湖4K)</button>
                    </div>
                    <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🌍 世界の都市</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.earthcam.com/usa/newyork/timessquare/','_blank')">🗽 NYC タイムズSq</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.earthtv.com/en/webcam/paris-eiffel-tower','_blank')">🗼 パリ エッフェル</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://london-webcam.co.uk/','_blank')">🎡 ロンドン</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.skylinewebcams.com/en/webcam/australia/new-south-wales/sydney/sydney.html','_blank')">🌉 シドニー</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=jXYQoWAKgFE','_blank')">🏛 ローマ・トレビの泉</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.earthcam.com/world/','_blank')">🌐 その他世界中</button>
                    </div>
                    <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🚀 特別</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#0a0a2a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=vytmBNhc9ig','_blank')">🌏 NASA 地球ライブ</button>
                        <button class="act-btn" style="background:#1a2a1a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.youtube.com/watch?v=qpukdDslCjk','_blank')">🦁 アフリカサファリ</button>
                    </div>
                    <button class="act-btn" id="cam-back" style="background:#34495e;">戻る</button>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        document.getElementById('cam-back').onclick = () => showNewsMarket();
    };

    document.getElementById('nm-market').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">📊 マーケット</div>
                <div style="padding:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" onclick="(${() => showChart('FOREXCOM:JP225')})()">📈 日経平均</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" onclick="(${() => showChart('FX:USDJPY')})()">📈 ドル円</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" onclick="(${() => showChart('TVC:USOIL')})()">📈 原油(WTI)</button>
                        <button class="act-btn" style="background:#1a3a1a; margin:0;" onclick="(${() => showChart('SP:SPX')})()">📈 S&P500</button>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">
                        <input type="text" id="nm-code" placeholder="コード or ティッカー" 
                            style="flex:1; background:#000; border:1px solid #555; color:#fff; 
                                   height:36px; padding:0 8px; border-radius:4px; font-size:0.9rem;">
                        <button id="nm-search" style="background:#34495e; color:#fff; border:none; 
                            height:36px; padding:0 10px; border-radius:4px; font-size:1rem;">🔍</button>
                        <button id="nm-go" style="background:#8e1a2e; color:#fff; border:none; 
                            height:36px; padding:0 10px; border-radius:4px; font-size:1rem;">▶</button>
                    </div>
                    <div style="color:#666; font-size:0.7rem; margin-bottom:10px;">
                        日本株：4桁（例：7203）　米国株：ティッカー（例：AAPL）　NYSE：NYSE:銘柄
                    </div>
                    <button class="act-btn" id="mkt-back" style="background:#34495e;">戻る</button>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        document.getElementById('nm-search').onclick = () => {
            const code = document.getElementById('nm-code').value.trim();
            if (!code) return;
            window.open(`https://www.google.com/search?q=${encodeURIComponent(code + ' 株価 証券コード')}`, '_blank');
        };
        document.getElementById('nm-go').onclick = () => {
            const code = document.getElementById('nm-code').value.trim().toUpperCase();
            if (!code) return;
            if (/^\d+$/.test(code)) {
                window.open(`https://finance.yahoo.co.jp/quote/${code}.T`, '_blank');
            } else if (code.startsWith('NYSE:')) {
                showChart(code);
            } else {
                showChart(`NASDAQ:${code}`);
            }
        };
        document.getElementById('mkt-back').onclick = () => showNewsMarket();
    };

    document.getElementById('nm-newsmenu').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">📰 ニュース・情報</div>
                <div style="padding:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://jp.reuters.com','_blank')">📰 ロイター</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www3.nhk.or.jp/news/','_blank')">📰 NHK NEWS</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.bbc.com/japanese','_blank')">📰 BBC日本語</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://toyokeizai.net','_blank')">📰 東洋経済</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.nikkei.com','_blank')">📰 日本経済新聞</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://news.yahoo.co.jp','_blank')">📰 Yahooニュース</button>
                    </div>
                    <button class="act-btn" id="news-back" style="background:#34495e;">戻る</button>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        document.getElementById('news-back').onclick = () => showNewsMarket();
    };

    document.getElementById('nm-useful').onclick = () => {
        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">🔗 便利情報</div>
                <div style="padding:10px;">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:8px;">
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.flightradar24.com','_blank')">✈️ フライトレーダー</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.walkerplus.com/event/','_blank')">🏛 イベント情報</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://tabelog.com','_blank')">🍽 食べログ</button>
                        <button class="act-btn" style="background:#1a2a3a; margin:0; font-size:0.85rem;" onclick="window.open('https://www.jma.go.jp/bosai/','_blank')">📡 気象庁防災情報</button>
                    </div>
                    <div style="color:#888; font-size:0.75rem; margin-bottom:6px;">🔍 Wikipedia検索</div>
                    <div style="display:flex; gap:6px; align-items:center; margin-bottom:10px;">
                        <input type="text" id="wiki-input" placeholder="調べたいことを入力" 
                            style="flex:1; background:#000; border:1px solid #555; color:#fff; 
                                   height:36px; padding:0 8px; border-radius:4px; font-size:0.9rem;">
                        <button id="wiki-go" style="background:#1a3a4a; color:#fff; border:none; 
                            height:36px; padding:0 12px; border-radius:4px;">検索</button>
                    </div>
                    <button class="act-btn" id="useful-back" style="background:#34495e;">戻る</button>
                </div>
            </div>`;
        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        document.getElementById('wiki-go').onclick = () => {
            const q = document.getElementById('wiki-input').value.trim();
            if (!q) return;
            window.open(`https://ja.wikipedia.org/wiki/${encodeURIComponent(q)}`, '_blank');
        };
        document.getElementById('useful-back').onclick = () => showNewsMarket();
    };
}

function showAutoPlaySelect() {
    try {
        const lv = document.getElementById('list-view');
        const favSongs = nav.curP.filter(m => {
            try {
                const raw = localStorage.getItem('bar_sophie_techo');
                const data = raw ? JSON.parse(raw) : { favorites: [] };
                const favIds = data.favorites || [];
                const songId = `S-${String(m.code).padStart(4,'0')}`;
                return favIds.includes(songId);
            } catch(e) { return false; }
        });

        const menuHtml = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0;">🔁 連続再生</div>
                <div style="padding:10px;">
                    ${favSongs.length === 0
                        ? `<div style="color:#888; text-align:center; padding:15px; font-size:0.9rem;">お気に入りがありません</div>
                           <button class="act-btn" id="ap-back" style="background:#34495e;">戻る</button>`
                        : `<button class="act-btn" id="ap-fav" style="background:#8e1a2e; margin-bottom:8px;">❤️ お気に入りのみ（${favSongs.length}曲）</button>
                           <button class="act-btn" id="ap-all" style="background:#1a5276; margin-bottom:8px;">🎵 全曲（${nav.curP.length}曲）</button>
                           <button class="act-btn" id="ap-back" style="background:#34495e;">戻る</button>`
                    }
                </div>
            </div>`;

        if (lv) { lv.style.display = 'block'; lv.innerHTML = menuHtml; }

        document.getElementById('ap-back').onclick = () => showSophieMenu();
        if (favSongs.length > 0) {
            document.getElementById('ap-fav').onclick = () => showAutoPlaySongSelect(favSongs);
            document.getElementById('ap-all').onclick  = () => showAutoPlaySongSelect([...nav.curP]);
        }
    } catch(e) {
        alert('error: ' + e.message);
    }
}

function showTechoAutoPlay() {
    const raw = localStorage.getItem('bar_sophie_techo');
    const data = raw ? JSON.parse(raw) : { favorites: [] };
    const favIds = (data.favorites || []).filter(id => id.startsWith('S-'));
    const favSongs = favIds.map(id => {
        const num = parseInt(id.replace(/[^0-9]/g, ''), 10);
        return nav.jData.find(d => parseInt(d.code, 10) === num);
    }).filter(Boolean);

    if (favSongs.length === 0) {
        alert('お気に入りの歌がありません');
        return;
    }
    showAutoPlaySongSelect(favSongs);
}

function showAutoPlaySongSelect(list) {
    const lv = document.getElementById('list-view');
    let h = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0;">▶ どの曲からスタートしますか？</div>
            <div style="padding:5px 0;">`;
    list.forEach((m, i) => {
        h += `<div class="item ap-start-item" data-idx="${i}" style="font-size:1.05rem; padding:0.2em 15px; color:#eee;">🎵 ${m.ti}</div>`;
    });
    h += `</div></div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = h; }

    document.querySelectorAll('.ap-start-item').forEach(el => {
        el.onclick = () => {
            const idx = parseInt(el.dataset.idx);
            music.startAutoPlay(list, idx);
        };
    });
}



function renderConsole(mode) {
    const db = document.getElementById('disclaimer-bar');
    if (db) db.style.display = (nav.state === "none") ? 'block' : 'none';

    const grid = document.querySelector('.btn-grid');
    if (!grid) return;

    const noApp   = "-webkit-appearance:none; appearance:none; outline:none;";
    const pCtrl   = `flex:1; background:#1a2b1a; color:#5c9e5c; border:none; border-radius:0; ${noApp}`;
    const pBtn    = `flex:1.0; font-size:1.2rem; background:#1a3a1a; color:#7fd97f; border:none; border-radius:0; ${noApp}`;
    const backBtn = `background:#34495e; color:#fff; flex:1; font-size:0.95rem; font-weight:bold; border:none;`;
    const sBtn = `background:#0096BF; color:#ff69b4; font-size:1.4rem; font-weight:bold; flex:1.0; border:2px solid #ff51a8;`;
    const navBtn  = `flex:1; background:#1a2a3a; color:#5ba3d9; font-size:1.1rem; border:none; border-radius:0; touch-action:manipulation; ${noApp}`;

    if (mode === 'screening') {
        grid.innerHTML = `
            <button class="c-btn" id="c-back" style="${backBtn}">戻る</button>
            <button class="c-btn" id="c-clr"  style="background:#5DADE2; color:#fff; flex:1; font-size:0.95rem; text-shadow:0 0 2px rgba(0,0,0,0.5); border:none;">リセット</button>
            <button class="c-btn" id="c-ex"   style="background:#8e44ad; color:#fff; flex:2; font-size:0.95rem; border:none;">検索実行</button>`;
        document.getElementById('c-back').onclick = liquor.openLiquorPortal;
        document.getElementById('c-clr').onclick  = liquor.clearScr;
        document.getElementById('c-ex').onclick   = liquor.execScr;
        return;
    }

    if (mode === 'result') {
        grid.innerHTML = `<button class="c-btn" id="c-mod" style="background:#8e44ad; color:#fff; font-size:0.85rem; border:none;">🔍 検索条件を変更する</button>`;
        document.getElementById('c-mod').onclick = liquor.openScreeningFromConsole;
        return;
    }

    if (mode === 'card') {
        // LT：戻る・S・⏹️・◀・▶
        grid.innerHTML = `
            <button class="c-btn card-btn" id="c-back"   style="${backBtn}">戻る</button>
            <button class="c-btn card-btn" id="c-sophie" style="${sBtn}">S</button>
            <button class="c-btn card-btn" id="ctrl-pause" style="${pCtrl}">⏹️</button>
            <button class="c-btn card-btn" id="c-prev"   style="${navBtn}">&#9664;</button>
            <button class="c-btn card-btn" id="c-next2"  style="${navBtn}">&#9654;</button>`;
        document.getElementById('c-back').addEventListener('click', liquor.cardNavToList);
        document.getElementById('c-sophie').addEventListener('click', handleSButton);
        document.getElementById('ctrl-pause').onclick = music.togglePause;
        document.getElementById('c-prev').addEventListener('click', liquor.cardNavPrev);
        document.getElementById('c-next2').addEventListener('click', liquor.cardNavNext);
        return;
    }

    if (nav.state === "none") {
        const shopBaseStyle = "background:rgba(255, 228, 225, 0.6); color:#cc294a; border:3px solid #1e90ff; flex-direction:column; justify-content:center; align-items:center; backdrop-filter:blur(2px); padding:0; flex:1.0; display:flex;";
        grid.innerHTML = `
            <button class="c-btn" id="btn-shop" style="${shopBaseStyle}">
                <span style="font-size:0.75rem; font-weight:bold; line-height:1.1;">ソフィー</span>
                <span style="font-size:0.75rem; font-weight:bold; line-height:1.1;">おすすめ</span>
                <span style="font-size:0.75rem; letter-spacing:1px; line-height:1.1;">SHOP</span>
            </button>
            <button class="c-btn" id="btn-techo" style="background:rgba(34,34,34,0.8); color:#fff; border:1px solid #777; font-size:1.5rem; flex:1.0; display:flex; justify-content:center; align-items:center;">📖</button>
            <button class="c-btn" id="ctrl-pause" style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"  style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"   style="${pCtrl}">⏭</button>`;
        document.getElementById('btn-shop').onclick = () => { nav.updateNav("shop"); shop.openShop(); renderConsole('standard'); };
    }
    else if (["tit", "st", "lq_list", "lq_res", "shop", "lq_main", "techo"].includes(nav.state)) {
        // 最深部＋SHOP：戻る（左端）・S・⏹️・▶・⏭
        grid.innerHTML = `
            <button class="c-btn" id="ctrl-back-txt" style="${backBtn}">戻る</button>
            <button class="c-btn" id="c-sophie-std"  style="${sBtn}">S</button>
            <button class="c-btn" id="ctrl-pause"    style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"     style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"      style="${pCtrl}">⏭</button>`;
        document.getElementById('ctrl-back-txt').onclick = handleBack;
        document.getElementById('c-sophie-std').onclick  = handleSButton;
    }
    else {
        // 中間メニュー：戻る（左端）・メモ・⏹️・▶・⏭
        grid.innerHTML = `
            <button class="c-btn" id="ctrl-back-txt" style="${backBtn}">戻る</button>
            <button class="c-btn" id="btn-techo"     style="background:rgba(34,34,34,0.8); color:#fff; border:1px solid #777; font-size:1.5rem; flex:1.0; display:flex; justify-content:center; align-items:center;">📖</button>
            <button class="c-btn" id="ctrl-pause"    style="${pCtrl}">⏹️</button>
            <button class="c-btn" id="ctrl-play"     style="${pBtn}">▶</button>
            <button class="c-btn" id="btn-next"      style="${pCtrl}">⏭</button>`;
        document.getElementById('ctrl-back-txt').onclick = handleBack;
    }

    const btnTecho = document.getElementById('btn-techo');
    if (btnTecho) {
        btnTecho.onclick = () => {
            import('./favorite.js').then(f => { nav.updateNav("techo"); f.openTecho(null); renderConsole('standard'); });
        };
    }
    const playEl  = document.getElementById('ctrl-play');
    const pauseEl = document.getElementById('ctrl-pause');
    if (playEl)  playEl.onclick  = music.playHead;
    if (pauseEl) pauseEl.onclick = music.togglePause;
    setupNextButton();
}