// js/people.js
const PEOPLE_KEY = 'bar_sophie_people';

function getPeople() {
    try {
        const raw = localStorage.getItem(PEOPLE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}

function savePeople(people) {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(people));
}

function getNextId(people) {
    return people.length === 0 ? 1 : Math.max(...people.map(p => p.id)) + 1;
}

export function showPeopleBook(onSelect = null, onClose = null) {
    const lv = document.getElementById('list-view');
    const nm = document.getElementById('nav-main');
    const prevHtml = lv ? lv.innerHTML : '';
    const prevDisplay = lv ? lv.style.display : 'none';
    const prevNm = nm ? nm.style.display : 'none';

    const render = () => {
        const people = getPeople();
        const isSelectMode = onSelect !== null;

        const listHtml = people.length === 0
            ? `<div style="color:#666; text-align:center; padding:20px; font-size:0.85rem;">まだ登録されていません</div>`
            : people.map(p => `
                <div style="display:flex; align-items:center; gap:6px; padding:4px 0; border-bottom:1px solid #1e1e1e;">
                    <div style="flex:1; min-width:0;">
                        <div style="color:#fff; font-size:0.82rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name}</div>
                        <div style="color:#777; font-size:0.68rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.birth}・${p.gender}${p.memo ? '・' + p.memo : ''}</div>
                    </div>
                    ${isSelectMode
                        ? `<button class="pb-select" data-id="${p.id}"
                            style="background:#0096BF; color:#fff; border:none; flex-shrink:0;
                                   padding:2px 10px; border-radius:3px; font-size:0.75rem;">選択</button>`
                        : `<button class="pb-edit" data-id="${p.id}"
                            style="background:#1a3a2a; color:#7fd97f; border:1px solid #3a6a4a; flex-shrink:0;
                                   padding:2px 8px; border-radius:3px; font-size:0.7rem; margin-right:3px;">編集</button>
                           <button class="pb-del" data-id="${p.id}"
                            style="background:#2a1a1a; color:#e74c3c; border:1px solid #6a2a2a; flex-shrink:0;
                                   padding:2px 8px; border-radius:3px; font-size:0.7rem;">削除</button>`
                    }
                </div>`).join('');

        const html = `
            <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                        background: linear-gradient(#111, #111) padding-box,
                        linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
                <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                            border-bottom:1px solid #333; height:28px; line-height:28px;
                            border-radius:8px 8px 0 0; display:flex; align-items:center; gap:6px;">
                    <img src="./sophie_face.png" style="width:20px; height:20px; border-radius:50%; object-fit:cover;">
                    👥 人物帳
                </div>
                <div style="padding:10px;">
                    <div id="pb-list">${listHtml}</div>
                    <button id="pb-add" style="width:100%; background:#2a1a3a; color:#c39bd3;
                        border:1px solid #6a3a8a; height:40px; border-radius:4px;
                        font-size:0.85rem; margin-top:10px; margin-bottom:8px;">＋ 新しく登録する</button>
                    <button id="pb-close" style="width:100%; background:#34495e; color:#fff;
                        border:none; height:36px; border-radius:4px; font-size:0.85rem;">閉じる</button>
                </div>
            </div>`;

        if (lv) { lv.style.display = 'block'; lv.innerHTML = html; }
        if (nm) nm.style.display = 'none';

        document.getElementById('pb-add').onclick = () => showPersonForm(null, render);
        document.getElementById('pb-close').onclick = () => {
            if (onClose) {
                onClose();
            } else {
                if (lv) { lv.style.display = prevDisplay; lv.innerHTML = prevHtml; }
                if (nm) nm.style.display = prevNm;
            }
        };

        document.querySelectorAll('.pb-select').forEach(btn => {
            btn.onclick = () => {
                const person = getPeople().find(p => p.id === parseInt(btn.dataset.id));
                if (person && onSelect) onSelect(person);
            };
        });

        document.querySelectorAll('.pb-edit').forEach(btn => {
            btn.onclick = () => {
                const person = getPeople().find(p => p.id === parseInt(btn.dataset.id));
                if (person) showPersonForm(person, render);
            };
        });

        document.querySelectorAll('.pb-del').forEach(btn => {
            btn.onclick = () => {
                if (!confirm('削除しますか？')) return;
                const people = getPeople().filter(p => p.id !== parseInt(btn.dataset.id));
                savePeople(people);
                render();
            };
        });
    };

    render();
}

function showPersonForm(person, onSave) {
    const lv = document.getElementById('list-view');
    const isEdit = person !== null;

    const html = `
        <div style="margin:10px; border-radius:10px; border:2px solid transparent;
                    background: linear-gradient(#111, #111) padding-box,
                    linear-gradient(120deg, #ff69b4 50%, #00d2ff 100%) border-box;">
            <div style="color:#f0b56e; padding:0 12px; font-size:0.8rem; font-weight:bold;
                        border-bottom:1px solid #333; height:28px; line-height:28px;
                        border-radius:8px 8px 0 0;">
                ${isEdit ? '✏️ 編集' : '＋ 新規登録'}
            </div>
            <div style="padding:10px;">
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">名前</div>
                    <input type="text" id="pf-name" value="${isEdit ? person.name : ''}" placeholder="例：自分、田中さん"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               height:38px; padding:0 10px; border-radius:4px; font-size:0.85rem;">
                </div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">生年月日</div>
                    <div style="display:flex; gap:4px; align-items:center;">
                        <input type="number" id="pf-year" value="${isEdit ? person.birth.split('-')[0] : ''}" placeholder="1980"
                            style="width:72px; background:#000; border:1px solid #555; color:#fff;
                                   height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                        <span style="color:#aaa; font-size:0.8rem;">年</span>
                        <input type="number" id="pf-month" value="${isEdit ? parseInt(person.birth.split('-')[1]) : ''}" placeholder="1"
                            style="width:48px; background:#000; border:1px solid #555; color:#fff;
                                   height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                        <span style="color:#aaa; font-size:0.8rem;">月</span>
                        <input type="number" id="pf-day" value="${isEdit ? parseInt(person.birth.split('-')[2]) : ''}" placeholder="1"
                            style="width:48px; background:#000; border:1px solid #555; color:#fff;
                                   height:38px; padding:0 8px; border-radius:4px; font-size:0.85rem;">
                        <span style="color:#aaa; font-size:0.8rem;">日</span>
                    </div>
                </div>
                <div style="margin-bottom:8px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">性別</div>
                    <div style="display:flex; gap:8px;">
                        <button class="pf-gender" data-val="男性"
                            style="flex:1; background:${isEdit && person.gender === '男性' ? '#0096BF' : '#1a1a1a'};
                                   color:${isEdit && person.gender === '男性' ? '#fff' : '#888'};
                                   border:1px solid ${isEdit && person.gender === '男性' ? '#00d2ff' : '#444'};
                                   height:36px; border-radius:4px; font-size:0.85rem;">男性</button>
                        <button class="pf-gender" data-val="女性"
                            style="flex:1; background:${isEdit && person.gender === '女性' ? '#0096BF' : '#1a1a1a'};
                                   color:${isEdit && person.gender === '女性' ? '#fff' : '#888'};
                                   border:1px solid ${isEdit && person.gender === '女性' ? '#00d2ff' : '#444'};
                                   height:36px; border-radius:4px; font-size:0.85rem;">女性</button>
                    </div>
                </div>
                <div style="margin-bottom:10px;">
                    <div style="color:#aaa; font-size:0.75rem; margin-bottom:4px;">メモ（任意）</div>
                    <input type="text" id="pf-memo" value="${isEdit ? person.memo : ''}" placeholder="例：会社の同僚、家族など"
                        style="width:100%; background:#000; border:1px solid #555; color:#fff;
                               height:38px; padding:0 10px; border-radius:4px; font-size:0.85rem;">
                </div>
                <button id="pf-save" style="width:100%; background:#0096BF; color:#ff69b4;
                    border:2px solid #ff51a8; height:44px; border-radius:4px;
                    font-size:0.95rem; font-weight:bold; margin-bottom:8px;">保存する</button>
                <button id="pf-cancel" style="width:100%; background:#34495e; color:#fff;
                    border:none; height:36px; border-radius:4px; font-size:0.85rem;">キャンセル</button>
            </div>
        </div>`;

    if (lv) { lv.innerHTML = html; }

    let selectedGender = isEdit ? person.gender : '';
    document.querySelectorAll('.pf-gender').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.pf-gender').forEach(b => {
                b.style.background = '#1a1a1a'; b.style.color = '#888'; b.style.borderColor = '#444';
            });
            btn.style.background = '#0096BF'; btn.style.color = '#fff'; btn.style.borderColor = '#00d2ff';
            selectedGender = btn.dataset.val;
        };
    });

    document.getElementById('pf-cancel').onclick = () => onSave();

    document.getElementById('pf-save').onclick = () => {
        const name = document.getElementById('pf-name').value.trim();
        const year = document.getElementById('pf-year').value;
        const month = document.getElementById('pf-month').value;
        const day = document.getElementById('pf-day').value;
        const memo = document.getElementById('pf-memo').value.trim();

        if (!name) { alert('名前を入力してください'); return; }
        if (!year || !month || !day) { alert('生年月日を入力してください'); return; }
        if (!selectedGender) { alert('性別を選択してください'); return; }

        const birth = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const people = getPeople();

        if (isEdit) {
            const idx = people.findIndex(p => p.id === person.id);
            if (idx >= 0) people[idx] = { ...person, name, birth, gender: selectedGender, memo };
        } else {
            people.push({ id: getNextId(people), name, birth, gender: selectedGender, memo });
        }

        savePeople(people);
        onSave();
    };
}