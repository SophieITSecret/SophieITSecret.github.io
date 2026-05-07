// js/fortune.js
import { showCompatibility } from './compatibility.js';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwA1C22UhKroCFC_EPC-ugR5efyXVHlbkWywfD21HfD3-J4vm-b4ZjvIshO-i3fKk9W/exec';

export function showFortune() {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const prevHtml = lv ? lv.innerHTML : '';
    const prevDisplay = lv ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const formHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                ソフィーの運勢鑑定
            </div>
            <div style="padding:10px;">
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">生年月日</div>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <input type="number" id="ft-year" placeholder="1980" min="1900" max="2010"
                            style="width:72px; background:#000; border:1px solid #555; color:#fff;
                                   height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                        <span style="color:#aaa; font-size:0.8rem;">年</span>
                        <input type="number" id="ft-month" placeholder="1" min="1" max="12"
                            style="width:48px; background:#000; border:1px solid #555; color:#fff;
                                   height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                        <span style="color:#aaa; font-size:0.8rem;">月</span>
                        <input type="number" id="ft-day" placeholder="1" min="1" max="31"
                            style="width:48px; background:#000; border:1px solid #555; color:#fff;
                                   height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                        <span style="color:#aaa; font-size:0.8rem;">日</span>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">性別</div>
                    <div style="display:flex; gap:8px;">
                        <button class="ft-gender" data-val="男性"
                            style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.85rem;">男性</button>
                        <button class="ft-gender" data-val="女性"
                            style="flex:1; background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.85rem;">女性</button>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">鑑定テーマ</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                        <button class="ft-theme" data-val="総合運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">🌟 総合運</button>
                        <button class="ft-theme" data-val="仕事運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💼 仕事運</button>
                        <button class="ft-theme" data-val="恋愛運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💕 恋愛運</button>
                        <button class="ft-theme" data-val="金運"
                            style="background:#1a1a1a; color:#888; border:1px solid #444;
                                   height:36px; border-radius:4px; font-size:0.8rem;">💰 金運</button>
                    </div>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">今の悩みや状況（任意）</div>
                    <textarea id="ft-worry" rows="3" placeholder="例：仕事で大きな決断を迫られている、新しい出会いがほしい、など"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               padding:8px 10px; border-radius:4px; font-size:0.85rem;
                               resize:none; font-family:inherit;"></textarea>
                </div>
                <button id="ft-submit" style="width:100%; background:#0096BF; color:#ff69b4;
                    border:2px solid #ff51a8; height:44px; border-radius:4px;
                    font-size:0.95rem; font-weight:bold; margin-bottom:8px;">
                    ソフィーに鑑定してもらう
                </button>
                <button id="ft-close" style="width:100%; background:#34495e; color:#fff;
                    border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = formHtml; }
    if (nm) nm.style.display = 'none';

    let selectedGender = '';
    let selectedTheme = '';

    document.querySelectorAll('.ft-gender').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ft-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
            selectedGender = btn.dataset.val;
        });
    });

    document.querySelectorAll('.ft-theme').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ft-theme').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#8e44ad'; btn.style.color = '#fff'; btn.style.borderColor = '#9b59b6';
            selectedTheme = btn.dataset.val;
        });
    });

    document.getElementById('ft-close').onclick = () => {
        if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
        if (nm) nm.style.display = prevNm;
    };

    document.getElementById('ft-submit').onclick = async () => {
        const year = document.getElementById('ft-year').value;
        const month = document.getElementById('ft-month').value;
        const day = document.getElementById('ft-day').value;

        if (!year || !month || !day) { alert('生年月日を入力してください'); return; }
        if (!selectedGender) { alert('性別を選択してください'); return; }
        if (!selectedTheme) { alert('鑑定テーマを選択してください'); return; }

        const worry = document.getElementById('ft-worry').value.trim();
        const btn = document.getElementById('ft-submit');
        btn.textContent = '鑑定中…';
        btn.disabled = true;

        const prompt = `あなたは四柱推命を極めた占い師であり、BARソフィーのバーテンダー「ソフィー」です。
カウンターでお客様の悩みに寄り添いながら、深みのある鑑定をしてください。

【鑑定対象】
生年月日：${year}年${month}月${day}日
性別：${selectedGender}
鑑定テーマ：${selectedTheme}
今の悩み・状況：${worry || 'なし'}

【鑑定の進め方】
1. 四柱推命で命式を算出し、この方の本質的な性格・才能・宿命を読む
2. 現在の大運・年運（2026年）の流れを読む
3. 悩みや状況と命式・運気を照らし合わせて具体的なアドバイスをする
4. 最後にソフィーらしい温かいひとことで締める

【注意】
・占い師として深みと説得力のある鑑定をすること
・単なる一般論ではなく、命式に基づいた具体的な言葉で語ること
・ソフィーとして品があり温かみのある語り口で`;

        const messages = [{ role: 'user', content: prompt }];
        const url = GAS_URL + '?messages=' + encodeURIComponent(JSON.stringify(messages));

        try {
            const res = await fetch(url);
            const data = await res.json();

            const resultText = data.ok ? data.text : 'エラーが発生しました。もう一度お試しください。';
            const formatted = resultText
            .replace(/\*([^*]+)\*/g, '')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^#{1,3}\s*/gm, '')
            .replace(/^-{2,}$/gm, '')
            .replace(/\n{3,}/g, '\n\n')
            .replace(/\n{2,}/g, '\n')
            .replace(/\n/g, '<br>');

            const resultHtml = `
                <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                            background: linear-gradient(#111, #111) padding-box,
                            linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                    <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                                border-bottom:1px solid #333; height:28px; line-height:28px;
                                border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                        <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                        ソフィーの鑑定結果
                    </div>
                    <div style="padding:12px; color:#ddd; font-size:0.85rem; line-height:1.9;">${formatted}</div>
                    <div style="padding:0 10px 10px;">
                        <button id="ft-retry" style="width:100%; background:#2a1a3a; color:#c39bd3;
                            border:1px solid #6a3a8a; height:40px; border-radius:4px;
                            font-size:0.85rem; margin-bottom:6px;">もう一度鑑定する</button>
                        <button id="ft-done" style="width:100%; background:#34495e; color:#fff;
                            border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
                    </div>
                </div>`;

            if (lv) { lv.innerHTML = resultHtml; }

            document.getElementById('ft-retry').onclick = () => showFortune();
            document.getElementById('ft-done').onclick = () => {
                if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
                if (nm) nm.style.display = prevNm;
            };

        } catch (e) {
            alert('通信エラーが発生しました。');
            btn.textContent = 'ソフィーに鑑定してもらう';
            btn.disabled = false;
        }
    };
}

export function showFortuneMenu() {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const prevHtml = lv ? lv.innerHTML : '';
    const prevDisplay = lv ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const menuHtml = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                🔮 ソフィーの推命占い
            </div>
            <div style="padding:10px;">
                <button id="fm-fortune" class="act-btn" style="background:#2a1a3a; color:#c39bd3;
                    border:1px solid #6a3a8a; margin-bottom:8px;">🌟 運勢を鑑定してもらう</button>
                <button id="fm-compat" class="act-btn" style="background:#1a2a3a; color:#5ba3d9;
                    border:1px solid #1a5276; margin-bottom:8px;">💑 相性を見てもらう</button>
                <button id="fm-close" class="act-btn" style="background:#34495e;">閉じる</button>
            </div>
        </div>`;

    if (lv) { lv.style.display = 'block'; lv.innerHTML = menuHtml; }
    if (nm) nm.style.display = 'none';

    document.getElementById('fm-fortune').onclick = () => showFortune();
    document.getElementById('fm-compat').onclick = () => showCompatibility();
    document.getElementById('fm-close').onclick = () => {
        if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
        if (nm) nm.style.display = prevNm;
    };
}