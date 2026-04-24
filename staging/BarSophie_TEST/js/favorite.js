/**
 * favorite.js — ソフィーのノート ＆ じゃんけんゲーム ＆ お知らせ
 * ★ Claude氏指示対応版（曲名完全マッチ・ハート二重防止）
 */

import { setListView, clean } from './utils.js';
import * as nav from './navigation.js';

const STORAGE_KEY = 'bar_sophie_techo';
let currentFolder = null; 

export function getCurrentFolder() {
    return currentFolder;
}

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
        limit: 1, 
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

export async function openTecho(folder = null) {
    nav.updateNav("techo");
    currentFolder = folder; 
    const data = getTechoData();
    const lq = await import('./liquor.js').catch(e => { return null; });
    
    let h = `<div class="label" style="background:#333; display:flex; justify-content:space-between; align-items:center;">
                <span>📖 ソフィーのノート</span>
             </div>`;

    if (folder === null) {
        h += `<div style="padding:20px;">
                <button class="act-btn" id="f-lq" style="width:100%; background:var(--talk); margin-bottom:15px;">🍷 好きなお酒</button>
                <button class="act-btn" id="f-mu" style="width:100%; background:var(--green); margin-bottom:15px;">🎵 好きな歌</button>
                <button class="act-btn" id="f-gm" style="width:100%; background:#e67e22; margin-bottom:15px;">🎲 ソフィーとの記録</button>
              </div>`;
        setListView(h, false);
        document.getElementById('f-lq').onclick = () => openTecho('L');
        document.getElementById('f-mu').onclick = () => openTecho('S');
        document.getElementById('f-gm').onclick = () => openTecho('G');
        return;
    }

    const categories = { 'L': [], 'S': [], 'O': [] };
    data.favorites.forEach(id => {
        const type = id.charAt(0);
        if (categories[type]) categories[type].push(id);
        else categories['O'].push(id); 
    });

    if (folder === 'L') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--talk); padding-left:10px;">🍷 好きなお酒</div>`;
        if (categories['L'].length === 0) {
            h += `<div style="padding:40px 20px; color:#888; text-align:center;">まだお酒が記録されていません</div>`;
        } else {
            categories['L'].forEach(id => {
                if (lq) {
                    const numStr = id.replace(/[^0-9]/g, '');
                    if (!numStr) {
                        h += `<div class="item fav-item" data-id="${id}" style="color:#888; border-bottom:1px solid #222; font-size:0.8rem; cursor:pointer;">⚠️ 古いデータです。タップして削除してください。</div>`;
                        return;
                    }
                    const lqData = nav.liquorData.find(d => {
                        const noKey = Object.keys(d).find(k => k.replace(/\s/g,'').toUpperCase().startsWith('NO') || k === '番号');
                        const rawNo = noKey ? String(d[noKey]) : "";
                        const rNum = rawNo.replace(/[^0-9]/g, '');
                        return rNum !== "" && parseInt(rNum, 10) === parseInt(numStr, 10);
                    });
                    if (lqData) {
                        const badge = lq.priceBadge(lqData["市販価格"], lqData["大分類"]);
                        h += `<div class="item fav-item lq-fav" data-id="${id}" style="color:#eee; border-bottom:1px solid #222; display:flex; align-items:center; gap:4px; cursor:pointer;">
                                ${badge}<span style="overflow:hidden; text-overflow:ellipsis;">${clean(lqData['銘柄名'])}</span>
                              </div>`;
                    } else {
                        h += `<div class="item fav-item lq-fav" data-id="${id}" style="color:#888; border-bottom:1px solid #222; font-size:0.8rem; cursor:pointer;">⚠️ 見つかりません。タップして削除してください。</div>`;
                    }
                }
            });
        }
    } else if (folder === 'S') {
        h += `<div class="scr-title" style="margin-top:15px; color:var(--green); padding-left:10px;">🎵 好きな歌</div>`;
        if (categories['S'].length === 0) {
            h += `<div style="padding:40px 20px; color:#888; text-align:center;">まだ曲が記録されていません</div>`;
        } else {
            let finalData = [];
            if (nav.jData && Array.isArray(nav.jData)) {
                finalData = nav.jData;
            } else {
                for (let key in nav) {
                    if (Array.isArray(nav[key]) && nav[key].length > 0) {
                        const firstItem = nav[key][0];
                        if (firstItem.hasOwnProperty('ti') || firstItem.hasOwnProperty('code') || firstItem.hasOwnProperty('u')) {
                            finalData = finalData.concat(nav[key]);
                        }
                    }
                }
            }

            categories['S'].forEach(id => {
                const numStr = id.replace(/[^0-9]/g, '');
                let displayTitle = `曲ID: ${numStr}`;
                
                if (finalData.length > 0) {
                    // ★ 修正1：parseInt を使った完全な比較
                    const songRecord = finalData.find(d => {
                        const rawCode = parseInt(String(d.code || "").replace(/[^0-9]/g, ''), 10);
                        return rawCode === parseInt(numStr, 10);
                    });
                    if (songRecord) {
                        const title  = songRecord.ti || "";
                        const artist = songRecord.a  || "";
                        if (title) displayTitle = artist ? `${artist} ／ ${title}` : title;
                    }
                }

                h += `
                <div class="item fav-item music-row" data-id="${id}" style="border-bottom:1px solid #222; display:flex; justify-content:space-between; align-items:center; padding:0.4em 15px;">
                    <div class="fav-music-play" style="flex:1; color:#eee; cursor:pointer; line-height:1.2; padding-right:10px; font-size:0.95rem;">
                        🎵 ${clean(displayTitle)}
                    </div>
                    <div class="fav-music-del" style="color:#ff69b4; font-size:1.4rem; cursor:pointer; padding:5px 0 5px 15px;">
                        ❤️
                    </div>
                </div>`;
            });
        }
    } else if (folder === 'G') {
        h += `<div class="scr-title" style="margin-top:15px; color:#e67e22; padding-left:10px;">🎲 ソフィーとの思い出</div>`;
        if (data.gameLog.length === 0) {
            h += `<div style="padding:40px 20px; color:#888; text-align:center;">まだ勝負の記録がありません</div>`;
        } else {
            data.gameLog.slice(0, 30).forEach(log => {
                h += `<div style="font-size:0.75rem; color:#888; padding:6px 15px; border-bottom:1px dashed #222;">${log}</div>`;
            });
        }
    }

    setListView(h, false);

    // ★ 修正3：f-back の onclick を削除しました

    document.querySelectorAll('.fav-item').forEach(el => {
        if (el.classList.contains('music-row')) return;

        el.onclick = () => {
            if (el.innerText.includes('⚠️')) {
                toggleFavorite(el.dataset.id);
                openTecho(folder); 
            } else if (el.classList.contains('lq-fav') && lq) {
                lq.showCardById(el.dataset.id);
            }
        };
    });

    document.querySelectorAll('.music-row').forEach(row => {
        const id = row.dataset.id;
        const playBtn = row.querySelector('.fav-music-play');
        const delBtn = row.querySelector('.fav-music-del');
        
        delBtn.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(id);
            openTecho(folder); 
        };
        
        playBtn.onclick = (e) => {
            e.stopPropagation();
            const songName = playBtn.innerText.replace('🎵', '').trim();
            alert(`【準備中】\n「${songName}」を再生します。\n※再生機能は music.js との連携コードが必要です。`);
        };
    });
}

let isEventDelegated = false;
function setupDelegation() {
    if (isEventDelegated) return;
    const lv = document.getElementById('list-view');
    if (lv) {
        lv.addEventListener('click', (e) => {
            const musicBtn = e.target.closest('.music-fav-btn');
            if (musicBtn) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const id = musicBtn.getAttribute('data-id');
                const added = toggleFavorite(id);
                musicBtn.style.color = added ? '#ff69b4' : '#555';
                musicBtn.innerText = added ? '❤️' : '♡';
                return;
            }
        }, true);
        isEventDelegated = true;
    }
}

// --- 🎵 音楽ページパッチ ---
export function initMusicPatch() {
    setupDelegation();

    const observer = new MutationObserver(() => {
        const lv = document.getElementById('list-view');
        if (!lv) return;

        let finalData = [];
        if (nav.jData && Array.isArray(nav.jData)) {
            finalData = nav.jData;
        } else {
            for (let key in nav) {
                if (Array.isArray(nav[key]) && nav[key].length > 0) {
                    const firstItem = nav[key][0];
                    if (firstItem.hasOwnProperty('ti') || firstItem.hasOwnProperty('code') || firstItem.hasOwnProperty('u')) {
                        finalData = finalData.concat(nav[key]);
                    }
                }
            }
        }

        const labels = lv.querySelectorAll('.label');
        labels.forEach(label => {
            if (!label.dataset.heightPatched) {
                label.dataset.heightPatched = "true";
                label.style.height = '28px';
                label.style.padding = '0 10px';
                label.style.display = 'flex';
                label.style.alignItems = 'center';
            }
        });

        const items = lv.querySelectorAll('.item');
        items.forEach(item => {
            if (!item.dataset.spacingPatched) {
                item.dataset.spacingPatched = "true";
                item.style.padding = '0.4em 15px';
                item.style.lineHeight = '1.0';
                item.style.display = 'flex';
                item.style.alignItems = 'center';
            }

            // ★ 修正2：二重追加防止
            if (item.querySelector('.music-fav-btn')) return;

            if (item.innerHTML.includes('🎵') && !item.dataset.favPatched) {
                item.dataset.favPatched = "true";
                
                let songId = null;
                if (finalData.length > 0) {
                    const sortedData = [...finalData].sort((a, b) => (b.ti || "").length - (a.ti || "").length);
                    const t = sortedData.find(d => {
                        const title = d.ti || "";
                        return title && item.innerText.includes(title);
                    });
                    if (t && t.code) {
                        songId = t.code;
                    }
                }

                if (!songId) {
                    let attrId = item.dataset.id || item.dataset.code || item.id || item.getAttribute('onclick') || "";
                    let m = attrId.match(/(\d+)/);
                    if (m) songId = m[1];
                }

                if (songId) {
                    const numStr = String(songId).replace(/[^0-9]/g, '');
                    if (numStr) {
                        songId = 'S-' + numStr.padStart(4, '0');
                    } else {
                        songId = 'S-UNK-' + Math.random().toString(36).substr(2, 5);
                    }
                } else {
                    songId = 'S-UNK-' + Math.random().toString(36).substr(2, 5);
                }

                const isFav = isFavorite(songId);
                const heart = isFav ? '❤️' : '♡';
                const heartColor = isFav ? '#ff69b4' : '#555'; 

                Array.from(item.childNodes).forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE && node.nodeValue.includes('🎵')) {
                        node.nodeValue = node.nodeValue.replace(/🎵/g, '');
                    }
                });

                item.style.justifyContent = 'space-between';

                const btnContainer = document.createElement('div');
                btnContainer.className = 'music-fav-btn';
                btnContainer.dataset.id = songId;
                
                btnContainer.style.cssText = `padding: 8px 12px; margin: -8px -5px -8px auto; color: ${heartColor}; font-size: 1.2rem; z-index: 100; cursor: pointer; line-height: 1;`;
                btnContainer.innerText = heart;
                
                item.appendChild(btnContainer);
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function playJanken() {
    const status = getGameStatus();
    
    if (status.count >= status.limit) {
        import('./media.js').then(media => media.speak("あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？"));
        alert(`ソフィー「あら、そんなに私と勝負したいんですか？ ふふっ、でも本日の勝負はもうおしまいです。また明日いらしてくださいね？」\n\n（※本日のマッチは終了しました。現在の戦績：あなた ${status.myWins} - ${status.sophieWins} ソフィー）`);
        return;
    }

    const h = `
        <div id="janken-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:10000; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#fff; font-family:sans-serif;">
            <div style="font-size:1.2rem; color:var(--accent); font-weight:bold; margin-bottom:10px; text-align:center;" id="j-title">ソフィーと勝負しますか？<br>（3本先取マッチ）</div>
            <div style="font-size:1.5rem; font-weight:bold; margin-bottom:20px; color:#1e90ff;" id="j-score">
                あなた ${status.myWins} <span style="color:#fff;">-</span> ${status.sophieWins} ソフィー
            </div>
            <img id="j-img" src="./front_sophie.jpeg" style="width:200px; height:200px; object-fit:cover; border-radius:50%; margin-bottom:20px; box-shadow:0 0 15px rgba(255,255,255,0.2);">
            <div id="j-btns" style="display:flex; gap:15px; margin-bottom:30px;">
                <button class="j-btn" data-hand="✊" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✊</button>
                <button class="j-btn" data-hand="✌️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">✌️</button>
                <button class="j-btn" data-hand="🖐️" style="font-size:3.5rem; background:transparent; border:none; cursor:pointer; filter:drop-shadow(0 0 5px #fff);">🖐️</button>
            </div>
            <button id="j-cancel" style="padding:10px 35px; border-radius:25px; background:#444; color:#fff; border:1px solid #777; font-size:1.1rem; font-weight:bold;">やめる</button>
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
            let imgSrc = "./front_sophie.jpeg";

            if (newScore.myWins >= 3) {
                if (newScore.sophieWins === 0) {
                    msg = "ふふっ……ストレート負けなんて久しぶりです。お約束通り、特別なご褒美……チュッ💋";
                    addGameLog(`【完全勝利】3連勝でソフィーから💋をもらった`);
                } else {
                    msg = "お見事です。今日のところは私の負けですね。";
                    addGameLog(`【マッチ勝利】3-${newScore.sophieWins}で勝利`);
                }
            } else if (newScore.sophieWins >= 3) {
                if (newScore.myWins === 0) {
                    msg = "私のストレート勝ちですね！さぁ、約束のドンペリ、開けていただきますよ？ふふっ。（※仮想請求書 10万円）";
                    addGameLog(`【完全敗北】3連敗でドンペリを入れさせられた💸`);
                } else {
                    msg = "私の勝ちですね。ふふっ、また明日挑戦してくださいな。";
                    addGameLog(`【マッチ敗北】${newScore.myWins}-3で敗北`);
                }
            } else {
                if (winner === "my") msg = "やりますね、あなたの勝ちです。次いきますよ！";
                else if (winner === "sophie") msg = "ふふっ、私の勝ちですね。まだまだこれからですよ！";
                else msg = "あら、気が合いますね。引き分けです。";
            }

            document.getElementById('j-title').innerHTML = msg;
            document.getElementById('j-score').innerHTML = `あなた ${newScore.myWins} <span style="color:#fff;">-</span> ${newScore.sophieWins} ソフィー`;
            document.getElementById('j-img').src = imgSrc;
            document.getElementById('j-btns').innerHTML = `<div style="font-size:6rem; animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">${sHand}</div>`;
            
            const cancelBtn = document.getElementById('j-cancel');
            cancelBtn.style.background = "var(--blue)";
            cancelBtn.style.color = "#000";
            
            if (newScore.myWins >= 3 || newScore.sophieWins >= 3) {
                cancelBtn.innerText = "戻る";
                cancelBtn.onclick = () => document.getElementById('janken-overlay').remove();
            } else {
                cancelBtn.innerText = "次へ";
                cancelBtn.onclick = () => {
                    document.getElementById('janken-overlay').remove();
                    playJanken(); 
                };
            }

            import('./media.js').then(media => media.speak(clean(msg)));
            
            if (!document.getElementById('janken-style')) {
                const style = document.createElement('style');
                style.id = 'janken-style';
                style.innerHTML = `@keyframes pop { 0% {transform:scale(0.2) rotate(-20deg); opacity:0;} 100% {transform:scale(1) rotate(0deg); opacity:1;} }`;
                document.head.appendChild(style);
            }
        };
    });
}