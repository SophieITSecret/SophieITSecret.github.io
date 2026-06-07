// js/guest_flow.js — ゲスト着席フロー

let _cautionTimer = null;

// ▼ DEBUG: 画面上にトーストを表示（問題確認後に削除）
function _dbg(msg) {
    const el = document.createElement('div');
    el.textContent = `[DBG] ${msg}`;
    el.style.cssText = 'position:fixed;bottom:70px;right:6px;background:rgba(0,0,0,0.85);color:#ff0;font-size:10px;padding:3px 7px;border-radius:4px;z-index:9999;pointer-events:none;';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
}

function _playVoice(mp3, onEnd) {
    const player = window._ytPlayer;
    let origVol = null;
    if (player) { try { origVol = player.getVolume(); player.setVolume(Math.round(origVol * 0.2)); } catch(e) {} }
    const audio = new Audio(`./voices_mp3/${mp3}`);
    _dbg(`play: ${mp3}`);
    const done = () => {
        if (origVol !== null && player) { try { player.setVolume(origVol); } catch(e) {} }
        if (onEnd) onEnd();
    };
    audio.addEventListener('ended', done);
    audio.addEventListener('error', () => { _dbg(`ERROR: ${mp3}`); done(); });
    audio.play().catch(e => { _dbg(`REJECTED: ${mp3}`); done(); });
}

function _showDialogue(msg, buttons) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    if (!lv) return;
    lv.style.display = 'block';
    lv.innerHTML = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111,#111) padding-box,
                    linear-gradient(120deg,#ff69b4 50%,#00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                ソフィーより
            </div>
            <div style="padding:14px 12px 12px;">
                <div id="dlg-msg" style="color:#c8b090; font-size:0.88rem; line-height:1.85; margin-bottom:14px;">${msg}</div>
                <div id="dlg-btns" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
        </div>`;
    if (nm) nm.style.display = 'none';
    _renderButtons(buttons);
}

function _renderButtons(buttons) {
    const container = document.getElementById('dlg-btns');
    if (!container) return;
    container.innerHTML = buttons.map((b, i) =>
        `<button class="act-btn dlg-btn" data-idx="${i}"
                 style="background:${b.bg||'#1a2a3a'}; color:${b.fg||'#7fb8d7'};
                        border:1px solid ${b.bd||'#3a5a7a'}; margin:0;">${b.label}</button>`
    ).join('');
    container.querySelectorAll('.dlg-btn').forEach((btn, i) => {
        btn.addEventListener('click', buttons[i].action);
    });
}

function _updateMsg(msg) {
    const el = document.getElementById('dlg-msg');
    if (el) el.textContent = msg;
}

function _goToGuide(onDone) {
    localStorage.setItem('sophie_visited', 'true');
    import('./guide.js').then(g => g.showGuideScreen(onDone));
}

function _dismiss(mp3, onDone) {
    localStorage.setItem('sophie_visited', 'true');
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const btns = document.getElementById('dlg-btns');
    if (btns) btns.innerHTML = '';
    _playVoice(mp3, () => {
        if (lv) lv.style.display = 'none';
        if (nm) nm.style.display = 'block';
        if (onDone) onDone();
    });
}

function _showGuestFirst(onDone) {
    _playVoice('guest_first_01.mp3');
    _showDialogue(
        'いらっしゃいませ。ようこそおいでくださいました。こちら、はじめてでしたか？',
        [
            { label: 'はい', bg: '#0a3a2a', fg: '#7fd97f', bd: '#2a6a4a', action: () => {
                _playVoice('guest_first_02a.mp3');
                _updateMsg('では、お店のご案内をいたしましょうか？');
                _renderButtons([
                    { label: 'はい、お願いします', bg: '#0a3a2a', fg: '#7fd97f', bd: '#2a6a4a', action: () => _goToGuide(onDone) },
                    { label: 'いいえ、大丈夫です', bg: '#34495e', fg: '#ccc', bd: '#555', action: () => _dismiss('guest_first_03a.mp3', onDone) }
                ]);
            }},
            { label: 'いいえ', bg: '#34495e', fg: '#ccc', bd: '#555', action: () => {
                _playVoice('guest_first_02b.mp3');
                _updateMsg('では、お店のご案内は大丈夫ですか？');
                _renderButtons([
                    { label: 'はい、大丈夫です', bg: '#34495e', fg: '#ccc', bd: '#555', action: () => _dismiss('guest_first_03a.mp3', onDone) },
                    { label: 'いいえ、お願いします', bg: '#0a3a2a', fg: '#7fd97f', bd: '#2a6a4a', action: () => _goToGuide(onDone) }
                ]);
            }}
        ]
    );
}

function _showGuestReturn(onDone) {
    _playVoice('guest_return_01.mp3');
    _showDialogue(
        'いらっしゃいませ。ようこそおいでくださいました。確か、以前においでいただきましたね？お店の使い方は大丈夫ですか？',
        [
            { label: '大丈夫です', bg: '#34495e', fg: '#ccc', bd: '#555', action: () => _dismiss('guest_return_02.mp3', onDone) },
            { label: '聞かせてください', bg: '#0a3a2a', fg: '#7fd97f', bd: '#2a6a4a', action: () => _goToGuide(onDone) }
        ]
    );
}

function _startMemberCaution() {
    if (_cautionTimer) { clearTimeout(_cautionTimer); _cautionTimer = null; }
    let cancelled = false;
    _dbg('caution: START');

    const cancel = () => {
        if (cancelled) return;
        cancelled = true;
        _dbg('caution: CANCELLED');
        if (_cautionTimer) { clearTimeout(_cautionTimer); _cautionTimer = null; }
        document.removeEventListener('click', cancel);
        document.removeEventListener('touchstart', cancel);
        window._cancelGuestCaution = null;
    };
    window._cancelGuestCaution = cancel;
    // 現在のタップイベントが完全に終わってから登録（iOS の同一イベントによる誤キャンセル防止）
    setTimeout(() => {
        if (cancelled) return;
        _dbg('caution: listeners ON');
        document.addEventListener('click', cancel);
        document.addEventListener('touchstart', cancel);
    }, 0);

    const fireVoice = () => {
        if (cancelled) return;
        _dbg('caution: FIRE');
        _cautionTimer = null;
        document.removeEventListener('click', cancel);
        document.removeEventListener('touchstart', cancel);
        window._cancelGuestCaution = null;
        _playVoice('member_caution_01.mp3');
    };

    // 着席から10秒後を必ず仕掛ける（フォールバック）
    _cautionTimer = setTimeout(fireVoice, 10000);

    // グリーティングが先に終わった場合は「終了+3秒」に前倒し
    setTimeout(() => {
        if (cancelled) return;
        const greetAudio = window._lastSophieVoiceAudio;
        _dbg(`caution: greet ended=${greetAudio?.ended} src=${greetAudio?.src?.split('/').pop()}`);
        if (greetAudio && !greetAudio.ended) {
            greetAudio.addEventListener('ended', () => {
                _dbg('caution: greet ended → switch to +3s');
                if (!cancelled && _cautionTimer) {
                    clearTimeout(_cautionTimer);
                    _cautionTimer = setTimeout(fireVoice, 3000);
                }
            }, { once: true });
        }
    }, 100);
}

// Returns true if guest (greeting suppressed), false if member (caller should play greeting)
export function startCounterFlow(onDone) {
    if (window.currentUser) {
        _startMemberCaution();
        return false;  // ヒントボタンは showRootMenu が常時表示する
    }
    const hasVisited = localStorage.getItem('sophie_visited');
    if (!hasVisited) {
        _showGuestFirst(onDone);
    } else {
        _showGuestReturn(onDone);
    }
    return true;
}
