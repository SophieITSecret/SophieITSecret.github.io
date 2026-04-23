/**
 * favorite.js — ソフィーのノート ＆ じゃんけんゲーム ＆ お知らせ
 * ★ 銘柄名表示 ＆ リストからのジャンプ対応 ＆ 音楽ボタン修正版
 */

import { setListView, clean } from './utils.js';
import * as nav from './navigation.js';
import { priceBadge, showCardById } from './liquor.js';

const STORAGE_KEY = 'bar_sophie_techo';

function getTechoData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { favorites: [], gameLog: [], lastGameDate: '', gameCount: 0 };
    return JSON.parse(data);
}

function saveTechoData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function toggleFavorite(id) {
    const data = getTechoData();
    const index = data.favorites.indexOf(id);
    if (index === -1) {
        data.favorites.push(id);
    } else {
        data.favorites.splice(index, 1);
    }
    saveTechoData(data);
    return index === -1;
}

export function isFavorite(id) {
    return getTechoData().favorites.includes(id);
}

export function getGameStatus() {
    const data = getTechoData();
    const d = new Date();
    const today = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    if (data.lastGameDate !== today) {
        data.gameCount = 0;
        data.lastGameDate = today;
        saveTechoData(data);
    }
    return { count: data.gameCount, limit: 3 };
}

export function incrementGameCount() {
    const data = getTechoData();
    data.gameCount++;
    saveTechoData(data);
}

function addGameLog(text) {
    const data = getTechoData();
    const d = new Date();
    const timeStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    data.gameLog.unshift(`[${timeStr}] ${text}`);
    if (data.gameLog.length > 30) data.gameLog.pop();
    saveTechoData(data);
}

export function openNotice() {
    nav.updateNav("notice");
    let h = `<div class="label" style="background:#1a5276;">📢 お知らせ・使い方</div>
    <div style="padding:20px; color:#ddd; line-height:1.7; font-size:0.95rem;">
        <h3 style="color:var(--accent); border-bottom:1px solid #555; padding-bottom:5px; margin-top:0;">🍸 BARソフィーへようこそ</h3>
        <p style="margin-top:10px;">ここでは1970〜80年代の名曲と、マスター厳選のお酒をお楽しみいただけます。</p>
        <h3 style="color:#1e90ff; border-bottom:1px solid #555; padding-bottom:5px; margin-top:25px;">📖 ソフィーのノート</h3>
        <p style="margin-top:10px;">お酒のカードや曲名の横にある「♡」を押すと「❤️」に変わり、ノートに記録されます。カウンター画面下の「📖」ボタンからいつでも見返せます。</p>
        <h3 style="color:var(--pink); border-bottom:1px solid #555; padding-bottom:5px; margin-top:25px;">🎲 秘密のSボタン</h3>
        <p style="margin-top:10px;">お酒のカードにある「S」ボタンを押すと、1日3回限定で私（ソフィー）と勝負ができます。勝てばご褒美があるかも…💋</p>
    </div>`;
    setListView(h, false);
}

// --- 手帳（ノート）画面の描画 ---
export function openTecho() {
    nav.updateNav("techo");
    const data = getTechoData();
    
    let h = `<div class="label" style="background:#333; display:flex; justify-content:space-between; align-items:center;">
                <span>📖 ソフィーのノート</span>
             </div>`;
    
    if (data.favorites.length === 0 && data.gameLog.length === 0) {
        h += `<div style="padding:40px 20px; color:#888; text-align:center; line-height:1.6;">まだ白紙のページですね...<br><br>お酒や音楽の画面で「♡」を押して<br>あなただけの記録を。</div>`;
    } else {
        const categories = {
            'L': { title: '🍷 キープしたお酒', list: [] },
            'S': { title: '🎵 お気に入りの曲', list: [] },
            'N': { title: '📝 備忘録ノート', list: [] },
            'O': { title: '🔖 その他', list: [] }
        };

        data.favorites.forEach(id => {
            const type = id.charAt(0);
            if (categories[type]) categories[type].list.push(id);
            else categories['O'].list.push(id); 
        });

        for (const key in categories) {
            const cat = categories[key];
            if (cat.list.length > 0) {
                h += `<div class="scr-title" style="margin-top:15px; color:var(--blue); padding-left:10px;">${cat.title}</div>`;
                cat.list.forEach(id => {
                    // ★ お酒の場合は銘柄名とグラス・価格バッジを表示
                    if (key === 'L') {
                        const numStr = id.replace(/[^0-9]/g, '');
                        const lq = nav.liquorData.find(d => {
                            const rawNo = d["No."] || d["No"] || d["番号"] || "";
                            return String(rawNo).trim() === numStr;
                        });
                        if (lq) {
                            const badge = priceBadge(lq["市販価格"], lq["大分類"]);
                            h += `<div class="item fav-item lq-fav" data-id="${id}" style="color:#eee; border-bottom:1px solid #222; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                    ${badge}<span style="overflow:hidden; text-overflow:ellipsis;">${clean(lq['銘柄名'])}</span>
                                  </div>`;
                        } else {
                            h += `<div class="item fav-item" style="color:#888; border-bottom:1px solid #222;">🔖 ${id} (データなし)</div>`;
                        }
                    } else {
                        h += `<div class="item fav-item" style="color:#eee; border-bottom:1px solid #222;">🔖 ${id}</div>`;
                    }
                });
            }
        }

        if (data.gameLog.length > 0) {
            h += `<div class="scr-title" style="margin-top:25px; color:var(--accent); padding-left:10px;">🎲 ソフィーとの思い出</div>`;
            data.gameLog.slice(0, 10).forEach(log => {
                h += `<div style="font-size:0.75rem; color:#888; padding:6px 15px; border-bottom:1px dashed #222;">${log}</div>`;
            });
        }
    }

    setListView(h, false);

    // ★ リストをクリックしたら鑑定カードへ飛ぶ
    document.querySelectorAll('.lq-fav').forEach(el => {
        el.onclick = () => showCardById(el.dataset.id);
    });
}

// --- 🎵 音楽ページへの自動ハッキング（イベント破壊回避版） ---
export function initMusicPatch() {
    const observer = new MutationObserver(() => {
        if (!nav.state || !nav.state.startsWith('music')) return;
        const lv = document.getElementById('list-view');
        if (!lv) return;

        // 1. 歌手名バー（.label）の右端に📖ボタンを追加
        const labels = lv.querySelectorAll('.label');
        labels.forEach(label => {
            if (!label.dataset.patched && label.innerText.length > 0 && label.id !== 'lbl-back-res') {
                label.dataset.patched = "true";
                label.style.display = 'flex';
                label.style.justifyContent = 'space-between';
                label.style.alignItems = 'center';
                const btn = document.createElement('span');
                btn.innerText = '📖';
                btn.style.cursor = 'pointer';
                btn.style.padding = '0 10px';
                btn.style.fontSize = '1.2rem';
                btn.onclick = (e) => { e.stopPropagation(); openTecho(); };
                label.appendChild(btn);
            }
        });

        // 2. リストの「♪♪」を安全にハートボタンに置換（既存イベントを壊さない）
        const items = lv.querySelectorAll('.item');
        items.forEach(item => {
            if (item.innerText.includes('♪♪') && !item.dataset.favPatched) {
                item.dataset.favPatched = "true";
                
                let songId = item.innerText.replace('♪♪', '').trim();
                const match = songId.match(/S-\d{4}/);
                if (match) songId = match[0];

                const isFav = isFavorite(songId);
                const heart = isFav ? '❤️' : '♡';

                // DOMのテキストから「♪♪」だけを消去
                Array.from(item.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes('♪♪')) {
                        node.nodeValue = node.nodeValue.replace('♪♪', '');
                    }
                });

                const btn = document.createElement('span');
                btn.className = 'music-fav-btn';
                btn.dataset.id = songId;
                btn.style.cssText = 'cursor:pointer; display:inline-block; width:28px; text-align:center; color:var(--pink); font-size:1.1rem; margin-right:5px;';
                btn.innerText = heart;
                
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation(); // ★曲の再生を止める
                    const id = btn.getAttribute('data-id');
                    const added = toggleFavorite(id);
                    btn.innerText = added ? '❤️' : '♡';
                };

                // 曲名の前にボタンを挿入
                item.insertBefore(btn, item.firstChild);
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function playJanken() {
    const status = getGameStatus();
    if (status.count >= status.limit) {
        import('./media.js').then(media => media.speak("あら、そんなに私と遊びたいの？ でも、しつこい男性は嫌われるわよ。続きはまた明日、ね？"));
        alert("ソフィー「あら、そんなに私と遊びたいの？ でも、しつこい男性は嫌われるわよ。続きはまた明日、ね？」\n\n（※本日の勝負は終了しました）");
        return;
    }

    const h = `
        <div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif;">
            <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:20px; text-align:center;">ソフィーと勝負する？<br><span style="font-size:0.8rem; color:#aaa;">（本日あと ${status.limit - status.count} 回）</span></div>
            <div style="display:flex; gap:15px; margin-bottom:30px;">
                <button class="j-btn" data-hand="✊" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✊</button>
                <button class="j-btn" data-hand="✌️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✌️</button>
                <button class="j-btn" data-hand="🖐️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">🖐️</button>
            </div>
            <button id="j-cancel" style="padding:10px 25px; border-radius:20px; background:#333; color:#fff; border:1px solid #555; font-size:1rem;">やめる</button>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', h);
    document.getElementById('j-cancel').onclick = () => document.getElementById('janken-overlay').remove();

    document.querySelectorAll('.j-btn').forEach(btn => {
        btn.onclick = (e) => {
            const myHand = e.currentTarget.dataset.hand;
            const hands = ["✊", "✌️", "🖐️"];
            const sHand = hands[Math.floor(Math.random() * hands.length)];
            let resultStr = "", msg = "";

            if (myHand === sHand) {
                resultStr = "引き分け"; msg = "あーら、気が合うわね。引き分けよ。";
            } else if ((myHand==="✊"&&sHand==="✌️")||(myHand==="✌️"&&sHand==="🖐️")||(myHand==="🖐️"&&sHand==="✊")) {
                resultStr = "勝ち"; msg = "うふふ、私の負けね。約束通り……チュッ💋";
            } else {
                resultStr = "負け"; msg = "あら、私の勝ち！それじゃあ一番高いシャンパン、開けてもらおうかしら？";
            }

            incrementGameCount();
            addGameLog(`じゃんけん (${resultStr}) ｜ あなた:${myHand} ソフィー:${sHand}`);

            document.getElementById('janken-overlay').innerHTML = `
                <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:10px; text-align:center; padding:0 20px; line-height:1.5;">${msg}</div>
                <div style="font-size:5rem; margin-bottom:30px; animation: pop 0.5s ease-out;">${sHand}</div>
                <button id="j-close" style="padding:12px 35px; border-radius:25px; background:var(--blue); color:#000; border:none; font-weight:bold; font-size:1.1rem; box-shadow:0 0 10px var(--blue);">戻る</button>
                <style>@keyframes pop { 0% {transform:scale(0.5); opacity:0;} 100% {transform:scale(1); opacity:1;} }</style>
            `;
            import('./media.js').then(media => media.speak(clean(msg)));
            document.getElementById('j-close').onclick = () => document.getElementById('janken-overlay').remove();
        };
    });
}