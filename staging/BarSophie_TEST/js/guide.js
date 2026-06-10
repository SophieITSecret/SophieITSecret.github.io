// js/guide.js — P1 ご案内画面
import * as nav from './navigation.js';

export function showGuideScreen(onClose) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    if (!lv) return;

    nav.updateNav('notice');
    window._renderConsole?.('standard');

    const isLoggedIn = !!window.currentUser;
    const userData = window.currentUserData;
    const role = userData?.role === 'admin' ? 'admin' : (userData?.status || 'free');
    const isPremium = ['vip', 'active', 'admin'].includes(role);

    const mp3 = isLoggedIn
        ? (isPremium ? 'guide_premium.mp3' : 'guide_member.mp3')
        : 'guide_guest.mp3';

    const HL  = 'background:rgba(0,150,191,0.10); border:1px solid rgba(0,150,191,0.22); border-radius:6px; padding:8px; margin-bottom:8px;';
    const DIM = 'padding:8px; margin-bottom:8px; opacity:0.55;';

    const s1 = HL;
    const s2 = isLoggedIn  ? HL  : DIM;
    const s3 = isPremium   ? HL  : DIM;

    lv.style.display = 'block';
    lv.innerHTML = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111,#111) padding-box,
                    linear-gradient(120deg,#ff69b4 50%,#00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                🍸 BARソフィーへようこそ
            </div>
            <div style="padding:10px;">

                <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;
                            background:#1a1a1a; border-radius:8px; padding:8px 10px;">
                    <img src="./sophie_face.png" style="width:34px; height:34px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                    <div style="flex:1; color:#c8b090; font-size:0.77rem; line-height:1.4;">ソフィーのご案内</div>
                    <button id="p1-play" style="background:rgba(160,0,58,0.15); border:1px solid #c04060; color:#a0003a;
                               border-radius:50%; width:32px; height:32px; font-size:0.85rem; cursor:pointer;
                               display:flex; align-items:center; justify-content:center;
                               -webkit-tap-highlight-color:transparent; flex-shrink:0;">▶</button>
                    <button id="p1-stop" style="background:#1a1a1a; border:1px solid #444; color:#666;
                               border-radius:50%; width:32px; height:32px; font-size:0.85rem; cursor:pointer;
                               display:flex; align-items:center; justify-content:center;
                               -webkit-tap-highlight-color:transparent; flex-shrink:0;">⏹</button>
                </div>

                <div style="${s1}">
                    <div style="color:#7fd97f; font-size:0.82rem; font-weight:bold; margin-bottom:4px;">✨ 未登録でも楽しめます</div>
                    <div style="color:#aaa; font-size:0.79rem; line-height:1.85; padding-left:4px;">
                        🎵 600曲の音楽リクエスト<br>
                        📖 360話のお酒の話<br>
                        🍸 800銘柄のお酒データベース<br>
                        📺 NEWS・マーケット
                    </div>
                </div>

                <div style="${s2}">
                    <div style="color:#5ba3d9; font-size:0.82rem; font-weight:bold; margin-bottom:4px;">✨ 無料登録会員になるとできること</div>
                    <div style="color:${isLoggedIn ? '#aaa' : '#666'}; font-size:0.79rem; line-height:1.85; padding-left:4px;">
                        📅 この日どんな日<br>
                        🔮 ソフィーの天命診断（ライト・1日1回）<br>
                        🍽️ いいお店を探す（ライト・1日1回）<br>
                        🎲 じゃんけん勝負<br>
                        📓 ソフィーのノート（無制限）<br>
                        💎 プレミアチケット購入可・月1枚進呈
                    </div>
                </div>

                <div style="${s3}">
                    <div style="color:#f0b56e; font-size:0.82rem; font-weight:bold; margin-bottom:4px;">✨ ご常連パスカード（月額300円）になるとさらに</div>
                    <div style="color:${isPremium ? '#aaa' : '#666'}; font-size:0.79rem; line-height:1.85; padding-left:4px;">
                        🔮 ソフィーの天命診断（プレミア・1日1回）<br>
                        🍽️ いいお店を探す（プレミア・1日3回）<br>
                        💎 プレミアチケット月5枚進呈
                    </div>
                </div>

                ${!isLoggedIn ? `
                <button id="p1-register" style="width:100%; background:#4285f4; color:#fff;
                    border:none; height:44px; border-radius:4px; font-size:0.95rem;
                    font-weight:bold; margin-bottom:8px;">会員登録する</button>` : ''}
                <button id="p1-close" style="width:100%; background:#34495e; color:#fff;
                    border:none; height:40px; border-radius:4px; font-size:0.85rem;">閉じる</button>
            </div>
        </div>`;

    if (nm) nm.style.display = 'none';

    let _audio = null;
    let _origVol = null;

    const playBtn = document.getElementById('p1-play');
    const stopBtn = document.getElementById('p1-stop');

    const _restoreVol = () => {
        const player = window._ytPlayer;
        if (_origVol !== null && player) { try { player.setVolume(_origVol); } catch(e) {} _origVol = null; }
    };

    const _startPlay = () => {
        const player = window._ytPlayer;
        if (player) { try { _origVol = player.getVolume(); player.setVolume(Math.round(_origVol * 0.2)); } catch(e) {} }
        _audio = new Audio(`./voices_mp3/${mp3}`);
        playBtn.textContent = '⏸';
        const done = () => { playBtn.textContent = '▶'; _restoreVol(); };
        _audio.addEventListener('ended', done);
        _audio.addEventListener('error', done);
        _audio.play().catch(done);
    };

    playBtn.addEventListener('click', () => {
        if (_audio && !_audio.paused) {
            _audio.pause();
            playBtn.textContent = '▶';
        } else if (_audio && _audio.paused && _audio.currentTime > 0) {
            _audio.play().catch(() => {});
            playBtn.textContent = '⏸';
        } else {
            _startPlay();
        }
    });

    // 画面が開いたら自動再生（ユーザー操作から呼ばれるので iOS でも OK）
    _startPlay();

    stopBtn.addEventListener('click', () => {
        if (_audio) { _audio.pause(); _audio.currentTime = 0; _audio = null; }
        playBtn.textContent = '▶';
        _restoreVol();
    });

    if (!isLoggedIn) {
        document.getElementById('p1-register')?.addEventListener('click', () => {
            if (_audio) { _audio.pause(); _audio = null; }
            _restoreVol();
            window.signInWithGoogle();
        });
    }

    document.getElementById('p1-close').addEventListener('click', () => {
        if (_audio) { _audio.pause(); _audio = null; }
        _restoreVol();
        if (typeof onClose === 'function') onClose();
        else window._showRootMenu?.();
    });
}
