/**
 * favorite.js — ソフィーのノート ＆ じゃんけんゲーム ＆ お知らせ
 * ★ 音楽エリア独立・ソフィー口調（ですます調）洗練・テスト用リセット機能追加
 */

import { setListView, clean } from './utils.js';
import * as nav from './navigation.js';
import { priceBadge, showCardById } from './liquor.js';

const STORAGE_KEY = 'bar_sophie_techo';

function getTechoData() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { 
        favorites: [], 
        gameLog: [], 
        lastGameDate: '', 
        gameCount: 0, 
        janken: { myWins: 0, sophieWins: 0 } 
    };
    const parsed = JSON.parse(data);
    if (!parsed.janken) parsed.janken = { myWins: 0, sophieWins: 0 };
    return parsed;
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
        data.janken = { myWins: 0, sophieWins: 0 };
        data.lastGameDate = today;
        saveTechoData(data);
    }
    return { 
        count: data.gameCount, 
        limit: 1, // 1日1マッチ（どちらかが3本先取で終了）
        myWins: data.janken.myWins,
        sophieWins: data.janken.sophieWins
    };
}

export function updateGameScore(winner) {
    const data = getTechoData();
    if (winner === "my") data.janken.myWins++;
    if (winner === "sophie") data.janken.sophieWins++;
    
    if (data.janken.myWins >= 3 || data.janken.sophieWins >= 3) {
        data.gameCount++;
    }
    saveTechoData(data);
    return { myWins: data.janken.myWins, sophieWins: data.janken.sophieWins };
}

function addGameLog(text) {
    const data = getTechoData();
    const d = new Date();
    const timeStr = `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
    data.gameLog.unshift(`[${timeStr}] ${text}`);
    if (data.gameLog.length > 30) data.gameLog.pop();
    saveTechoData(data);
}

// ★ テスト用：じゃんけんの記録をリセットする機能
function resetJankenTest() {
    const data = getTechoData();
    data.lastGameDate = '';
    data.gameCount = 0;
    data.janken = { myWins: 0, sophieWins: 0 };
    saveTechoData(data);
    alert("【テスト機能】\nじゃんけんの回数と戦績をリセットしました。\nお酒の画面から「S」ボタンを押すと再挑戦できます！");
}

export async function openNotice() {
    nav.updateNav("notice");
    let content = "";
    
    try {
        const res = await fetch('お知らせ.txt');
        if (res.ok) {
            const text = await res.text();
            content = `<div style="white-space: pre-wrap; margin-top:10px;">${clean(text)}</div>`;
        } else {
            throw new Error("File not found");
        }
    } catch (e) {
        content = `
            <h3 style="color:var(--accent); border-bottom:1px solid #555; padding-bottom:5px; margin-top:0;">🍸 BARソフィーへようこそ</h3>
            <p style="margin-top:10px;">ここでは1970〜80年代の名曲と、マスター厳選のお酒をお楽しみいただけます。</p>
            <h3 style="color:#1e90ff; border-bottom:1px solid #555; padding-bottom:5px; margin-top:25px;">📖 ソフィーのノート</h3>
            <p style="margin-top:10px;">お酒のカードや曲名の横にある「♡」を押すと「❤️」に変わり、ノートに記録されます。</p>
            <h3 style="color:var(--pink); border-bottom:1px solid #555; padding-bottom:5px; margin-top:25px;">🎲 秘密のSボタン</h3>
            <p style="margin-top:10px;">お酒のカードにある「S」ボタンを押すと、1日1回限定（3本先取）で私（ソフィー）と勝負ができます。</p>
        `;
    }

    let h = `<div class="label" style="background:#1a5276;">📢 お知らせ・使い方</div>
    <div style="padding:20px; color:#ddd; line-height:1.7; font-size:0.95rem;">
        ${content}
        <div style="text-align:right; margin-top:50px;">
            <button id="btn-reset-janken" style="background:transparent; border:none; color:#777; font-size:0.8rem; text-decoration:underline; padding:10px;">[テスト用] じゃんけんリセット</button>
        </div>
    </div>`;
    
    setListView(h, false);
    
    document.getElementById('btn-reset-janken').onclick = resetJankenTest;
}

export function openTecho() {
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
                    if (key === 'L') {
                        const numStr = id.replace(/[^0-9]/g, '');
                        if (!numStr) {
                            h += `<div class="item fav-item" data-id="${id}" style="color:#888; border-bottom:1px solid #222; font-size:0.8rem; cursor:pointer;">⚠️ 古いデータです。タップして削除してください。</div>`;
                            return;
                        }
                        
                        // ★データ照合をより強固に修正（どの列名でも見つけ出す）
                        const lq = nav.liquorData.find(d => {
                            const rawNo = String(d["No."] || d["No"] || d["番号"] || d["NO"] || d["NO."] || "");
                            const rNum = rawNo.replace(/[^0-9]/g, '');
                            return rNum !== "" && parseInt(rNum, 10) === parseInt(numStr, 10);
                        });
                        
                        if (lq) {
                            const badge = priceBadge(lq["市販価格"], lq["大分類"]);
                            h += `<div class="item fav-item lq-fav" data-id="${id}" style="color:#eee; border-bottom:1px solid #222; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                    ${badge}<span style="overflow:hidden; text-overflow:ellipsis;">${clean(lq['銘柄名'])}</span>
                                  </div>`;
                        } else {
                            h += `<div class="item fav-item lq-fav" data-id="${id}" style="color:#888; border-bottom:1px solid #222; font-size:0.8rem; cursor:pointer;">⚠️ 見つかりません。タップして削除してください。</div>`;
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

    document.querySelectorAll('.fav-item').forEach(el => {
        el.onclick = () => {
            if (el.innerText.includes('⚠️')) {
                toggleFavorite(el.dataset.id);
                openTecho(); // リロードして削除を反映
            } else if (el.classList.contains('lq-fav')) {
                showCardById(el.dataset.id);
            }
        };
    });
}

// --- 🎵 音楽ページパッチ（「♪♪」を消し、右端にハートを配置して独立させる） ---
export function initMusicPatch() {
    const observer = new MutationObserver(() => {
        if (!nav.state || !nav.state.startsWith('music')) return;
        const lv = document.getElementById('list-view');
        if (!lv) return;

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
                btn.onclick = (e) => { 
                    e.stopPropagation(); 
                    nav.updateNav("techo"); 
                    openTecho(); 
                    const app = document.getElementById('btn-techo');
                    if(app) app.click(); 
                };
                label.appendChild(btn);
            }
        });

        const items = lv.querySelectorAll('.item');
        items.forEach(item => {
            if (item.innerText.includes('♪♪') && !item.dataset.favPatched) {
                item.dataset.favPatched = "true";
                
                let songId = item.innerText.replace('♪♪', '').trim();
                const match = songId.match(/S-\d{4}/);
                if (match) songId = match[0];

                const isFav = isFavorite(songId);
                const heart = isFav ? '❤️' : '♡';

                // ★ 元の「♪♪」を綺麗に消し去る
                Array.from(item.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes('♪♪')) {
                        node.nodeValue = node.nodeValue.replace(/♪♪/g, '');
                    }
                });

                // アイテムをフレックスボックス化し、右端にスペースを作る
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';

                const btn = document.createElement('div');
                btn.className = 'music-fav-btn';
                btn.dataset.id = songId;
                
                // ★ 再生エリアとは切り離された、右端の大きなクリックエリアを構築
                btn.style.cssText = 'padding:10px 15px; margin:-10px -15px -10px auto; color:var(--pink); font-size:1.3rem; z-index:999; position:relative; cursor:pointer;';
                btn.innerText = heart;
                
                // 親要素（曲の再生）にクリックを一切伝えない魔法のシールド
                const blockEvent = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                };
                btn.addEventListener('pointerdown', blockEvent);
                btn.addEventListener('mousedown', blockEvent);
                btn.addEventListener('touchstart', blockEvent, {passive: false});

                btn.addEventListener('click', (e) => {
                    blockEvent(e);
                    const id = btn.getAttribute('data-id');
                    const added = toggleFavorite(id);
                    btn.innerText = added ? '❤️' : '♡';
                });

                item.appendChild(btn);
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

// --- 🎮 ソフィーとのじゃんけん勝負（3本先取ルール・ですます調） ---
export function playJanken() {
    const status = getGameStatus();
    
    if (status.count >= status.limit) {
        import('./media.js').then(media => media.speak("あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？"));
        alert(`ソフィー「あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？」\n\n（※本日のマッチは終了しました。現在の戦績：あなた ${status.myWins} - ${status.sophieWins} ソフィー）`);
        return;
    }

    const h = `
        <div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif;">
            <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:10px; text-align:center;">ソフィーと勝負しますか？<br>（3本先取マッチ）</div>
            <div style="font-size:1.5rem; font-weight:bold; margin-bottom:20px; color:#1e90ff;">
                あなた ${status.myWins} <span style="color:#fff;">-</span> ${status.sophieWins} ソフィー
            </div>
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
            let winner = "";

            if (myHand === sHand) {
                winner = "draw";
            } else if ((myHand==="✊"&&sHand==="✌️")||(myHand==="✌️"&&sHand==="🖐️")||(myHand==="🖐️"&&sHand==="✊")) {
                winner = "my";
            } else {
                winner = "sophie";
            }

            const newScore = updateGameScore(winner);
            let msg = "";

            // ★ ソフィーのセリフ（です・ます調、上品な小悪魔感）
            if (newScore.myWins >= 3) {
                msg = "ふふっ……私の完全な負けですね。お約束通り、ご褒美です……チュッ💋";
                addGameLog(`【マッチ勝利】3勝${newScore.sophieWins}敗でソフィーから💋をもらった`);
            } else if (newScore.sophieWins >= 3) {
                msg = "私の勝ちですね！それじゃあ、一番高いドンペリ、開けてもらってもいいですか？ふふっ。（※仮想請求書 10万円）";
                addGameLog(`【マッチ敗北】${newScore.myWins}勝3敗でドンペリを入れさせられた💸`);
            } else {
                if (winner === "my") msg = "お見事、あなたの勝ちです。次いきますよ！";
                else if (winner === "sophie") msg = "ふふっ、私の勝ちですね。まだまだこれからですよ！";
                else msg = "あら、気が合いますね。引き分けです。";
            }

            document.getElementById('janken-overlay').innerHTML = `
                <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:10px; text-align:center; padding:0 20px; line-height:1.5;">${msg}</div>
                <div style="font-size:5rem; margin-bottom:20px; animation: pop 0.5s ease-out;">${sHand}</div>
                <div style="font-size:1.5rem; font-weight:bold; margin-bottom:30px; color:#1e90ff;">
                    あなた ${newScore.myWins} <span style="color:#fff;">-</span> ${newScore.sophieWins} ソフィー
                </div>
                <button id="j-close" style="padding:12px 35px; border-radius:25px; background:var(--blue); color:#000; border:none; font-weight:bold; font-size:1.1rem; box-shadow:0 0 10px var(--blue);">戻る</button>
                <style>@keyframes pop { 0% {transform:scale(0.5); opacity:0;} 100% {transform:scale(1); opacity:1;} }</style>
            `;
            import('./media.js').then(media => media.speak(clean(msg)));
            document.getElementById('j-close').onclick = () => document.getElementById('janken-overlay').remove();
        };
    });
}