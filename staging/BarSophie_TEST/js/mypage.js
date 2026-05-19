// js/mypage.js
import { getFirestore, doc, updateDoc }
    from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export function showWelcomePage(onClose) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');

    const isLoggedIn = !!window.currentUser;

    const html = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                🍸 BARソフィーへようこそ
            </div>
            <div style="padding:12px; color:#ddd; font-size:0.85rem;">

                <div style="color:#aaa; font-size:0.8rem; line-height:1.8; margin-bottom:12px;
                            padding:8px; background:#1a1a1a; border-radius:6px;">
                    いらっしゃいませ。BARソフィーは、音楽・お酒・占い・
                    お店探しを楽しめる、大人のためのバー体験アプリです。
                </div>

                <div style="margin-bottom:10px;">
                    <div style="color:#7fd97f; font-size:0.8rem; font-weight:bold;
                                margin-bottom:6px;">🎵 今すぐ無料で楽しめること</div>
                    <div style="color:#aaa; font-size:0.78rem; line-height:1.8;
                                padding-left:8px;">
                        🎵 600曲の音楽リクエスト<br>
                        📖 360話のお酒の話<br>
                        🍸 800銘柄のお酒データベース<br>
                        🎲 じゃんけん勝負
                    </div>
                </div>

                <div style="margin-bottom:10px;">
                    <div style="color:#5ba3d9; font-size:0.8rem; font-weight:bold;
                                margin-bottom:6px;">✨ 無料登録（Googleログイン）で使えること</div>
                    <div style="color:#aaa; font-size:0.78rem; line-height:1.8;
                                padding-left:8px;">
                        🔮 ソフィーの推命占い<br>
                        🍽️ いいお店を探す（1日1回）<br>
                        📖 ソフィーのノート（無制限）
                    </div>
                </div>

                <div style="margin-bottom:14px;">
                    <div style="color:#f0b56e; font-size:0.8rem; font-weight:bold;
                                margin-bottom:6px;">👑 常連パス（月額300円）で使えること</div>
                    <div style="color:#aaa; font-size:0.78rem; line-height:1.8;
                                padding-left:8px;">
                        🔮 特別鑑定チケット5枚/月<br>
                        🍽️ いいお店を探す（1日3回）<br>
                        ✨ 今後追加される特別機能
                    </div>
                </div>

                ${!isLoggedIn ? `
                <button id="wp-login" style="width:100%; background:#4285f4; color:#fff;
                    border:none; height:44px; border-radius:4px;
                    font-size:0.95rem; font-weight:bold; margin-bottom:8px;">
                    Googleで無料登録する
                </button>` : ''}

                <button id="wp-close" style="width:100%;
                    background:${isLoggedIn ? '#0096BF' : '#34495e'};
                    color:#fff; border:none; height:40px; border-radius:4px;
                    font-size:0.85rem;">
                    ${isLoggedIn ? '🍸 バーに入る' : 'まずは音楽を楽しむ'}
                </button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
    if (nm) nm.style.display = 'none';

    if (!isLoggedIn) {
        document.getElementById('wp-login').onclick = () => {
            window.signInWithGoogle();
        };
    }
    document.getElementById('wp-close').onclick = () => {
        if (onClose) onClose();
        else {
            if (lv) lv.style.display = 'none';
            if (nm) nm.style.display = 'flex';
        }
    };
}

export function showMyPage(onClose) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const user = window.currentUser;
    const userData = window.currentUserData;

    if (!user || !userData) {
        showWelcomePage(onClose);
        return;
    }

    const statusLabel = {
        free: '無料会員',
        active: '常連パス会員',
        vip: 'VIP会員',
        admin: '管理者'
    };

    const nickname = userData.nickname || user.displayName || user.email;
    const status = userData.role === 'admin' ? 'admin' : (userData.status || 'free');
    const tickets = userData.tickets || 0;

    const html = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                👤 マイページ
            </div>
            <div style="padding:12px;">

                <div style="background:#1a1a1a; border-radius:8px; padding:10px; margin-bottom:12px;">
                    <div style="color:#888; font-size:0.72rem; margin-bottom:4px;">表示名</div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input type="text" id="mp-nickname" value="${nickname}"
                            style="flex:1; background:#000; border:1px solid #555; color:#fff;
                                   height:36px; padding:0 10px; border-radius:4px; font-size:0.85rem;">
                        <button id="mp-save-name" style="background:#0096BF; color:#fff;
                            border:none; padding:0 12px; height:36px; border-radius:4px;
                            font-size:0.8rem; white-space:nowrap;">保存</button>
                    </div>
                </div>

                <div style="background:#1a1a1a; border-radius:8px; padding:10px; margin-bottom:12px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                        <div style="color:#888; font-size:0.72rem;">会員ステータス</div>
                        <div style="color:#f0b56e; font-size:0.8rem; font-weight:bold;">
                            ${status === 'admin' ? '👑 ' : ''}${statusLabel[status] || '無料会員'}
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <div style="color:#888; font-size:0.72rem;">特別鑑定チケット</div>
                        <div style="color:#c39bd3; font-size:0.8rem;">🎫 ${tickets}枚</div>
                    </div>
                </div>

                ${status === 'free' ? `
                <div style="background:#1a2a1a; border:1px solid #3a6a4a; border-radius:8px;
                            padding:10px; margin-bottom:12px;">
                    <div style="color:#7fd97f; font-size:0.8rem; font-weight:bold; margin-bottom:6px;">
                        👑 常連パスにアップグレード
                    </div>
                    <div style="color:#aaa; font-size:0.75rem; line-height:1.7; margin-bottom:8px;">
                        月額300円で特別鑑定チケット5枚/月・<br>
                        お店検索1日3回・その他特典が使えます
                    </div>
                    <button id="mp-upgrade" style="width:100%; background:#27ae60; color:#fff;
                        border:none; height:40px; border-radius:4px; font-size:0.85rem;
                        font-weight:bold;">常連パスに加入する（月額300円）</button>
                </div>` : ''}

                <button id="mp-guide" style="width:100%; background:#1a1a2a; color:#9b59b6;
                    border:1px solid #6a3a8a; height:36px; border-radius:4px;
                    font-size:0.8rem; margin-bottom:8px;">📋 ご利用案内を見る</button>

                <button id="mp-logout" style="width:100%; background:#2a1a1a; color:#e74c3c;
                    border:1px solid #6a2a2a; height:36px; border-radius:4px;
                    font-size:0.8rem; margin-bottom:8px;">ログアウト</button>

                <button id="mp-close" style="width:100%; background:#34495e; color:#fff;
                    border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
    if (nm) nm.style.display = 'none';

    document.getElementById('mp-save-name').onclick = async () => {
        const newNickname = document.getElementById('mp-nickname').value.trim();
        if (!newNickname) { alert('表示名を入力してください'); return; }
        try {
            const db = getFirestore();
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { nickname: newNickname });
            window.currentUserData.nickname = newNickname;
            window.updateLoginUI();
            alert('表示名を保存しました');
        } catch(e) {
            alert('保存に失敗しました');
        }
    };

    if (status === 'free') {
        document.getElementById('mp-upgrade').onclick = () => {
            const uid = window.currentUser?.uid || '';
            const stripeUrl = 'https://buy.stripe.com/test_28EdR88eF0cu8Ap0zcbMQ02' + '?client_reference_id=' + uid;
            window.open(stripeUrl, '_blank');
        };
    }

    document.getElementById('mp-guide').onclick = () => showWelcomePage(onClose);
    document.getElementById('mp-logout').onclick = () => {
        window.signOutUser();
        if (onClose) onClose();
    };
    document.getElementById('mp-close').onclick = () => {
        if (onClose) onClose();
        else {
            if (lv) lv.style.display = 'none';
            if (nm) nm.style.display = 'flex';
        }
    };
}
