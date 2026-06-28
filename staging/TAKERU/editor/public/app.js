let cardData=[], imageMap={}, selectedIdx=-1, dirty=false, curUnit='', filteredList=[];

// ===== 初期化：サーバーからCSVと画像一覧を自動読み込み =====
async function init() {
  const status=document.getElementById('fileStatus');
  try {
    const res=await fetch('/api/csv');
    if(!res.ok) throw new Error('CSVの読み込みに失敗しました');
    const text=await res.text();
    cardData=parseCSV(text);

    // 画像一覧
    imageMap={};
    try {
      const imgRes=await fetch('/api/images');
      if(imgRes.ok){
        const map=await imgRes.json();
        for(const [id,file] of Object.entries(map)) imageMap[id]='/api/images/'+encodeURIComponent(file);
      }
    } catch(_){}

    buildUnitSelect();
    status.textContent=`✅ TAKERUcard.csv（${cardData.length}枚）　🖼 ${Object.keys(imageMap).length}枚`;
    document.getElementById('btnSave').disabled=false;
    document.getElementById('btnImport').disabled=false;
    dirty=false;
  } catch(err) {
    status.textContent='⚠ '+err.message;
    document.getElementById('listScroll').innerHTML='<div class="empty-state"><div class="icon">⚠</div>'+err.message+'</div>';
  }
}

function reload() {
  if(dirty && !confirm('未保存の変更があります。破棄して再読み込みしますか？')) return;
  selectedIdx=-1;
  document.getElementById('editArea').style.display='none';
  document.getElementById('paneCard').innerHTML='<div class="empty-state"><div class="icon">👆</div>カードを選択してください</div>';
  init();
}

function parseCSV(text) {
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const rows=[]; let cur=[],field='',inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){if(inQ&&text[i+1]==='"'){field+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){cur.push(field);field='';}
    else if((c==='\n'||(c==='\r'&&text[i+1]==='\n'))&&!inQ){if(c==='\r')i++;cur.push(field);field='';if(cur.some(f=>f.trim()))rows.push(cur);cur=[];}
    else field+=c;
  }
  if(field||cur.length){cur.push(field);if(cur.some(f=>f.trim()))rows.push(cur);}
  const hdr=rows[0];
  return rows.slice(1).map(r=>({
    id:(r[0]||'').trim(), genre:(r[1]||'').trim(), section:(r[2]||'').trim(),
    title:(r[3]||'').trim(), body:(r[4]||'').trim(), subject:(r[5]||'').trim(),
    _header:hdr
  })).filter(d=>d.id);
}

function buildUnitSelect() {
  const sel=document.getElementById('unitSelect');
  const units=[...new Set(cardData.map(d=>d.genre))];
  sel.innerHTML='<option value="">── ユニットを選択 ──</option>';
  units.forEach(u=>{const o=document.createElement('option');o.value=u;o.textContent=u;sel.appendChild(o);});
  if(units.length){sel.value=units[0];filterCards();}
}

function filterCards() {
  curUnit=document.getElementById('unitSelect').value;
  filteredList=curUnit?cardData.filter(d=>d.genre===curUnit):cardData;
  document.getElementById('cardCount').textContent=`${filteredList.length}枚`;
  renderList();
}

function renderList() {
  const el=document.getElementById('listScroll');
  if(!filteredList.length){el.innerHTML='<div class="empty-state"><div class="icon">📭</div>カードがありません</div>';return;}
  let html='', curSubject=null, curSec=null;
  filteredList.forEach(card=>{
    const gIdx=cardData.indexOf(card);
    // 講座区切り
    if(card.subject && card.subject!==curSubject){
      curSubject=card.subject;
      curSec=null;
      html+=`<div class="subject-header">▶ ${esc(curSubject)}</div>`;
    }
    // セクション区切り
    if(card.section!==curSec){
      curSec=card.section;
      if(curSec) html+=`<div class="section-header">📂 ${esc(curSec)}</div>`;
    }
    const isC=isCommentary(card.id);
    // 軍事と戦略以外にはバッジを出す
    const showBadge = card.subject && !card.subject.includes('軍事と戦略');
    const badge=showBadge?(isC?'<span class="badge badge-c">解説</span>':''):'';
    const hasBody=card.body&&!card.body.includes('準備中')&&card.body.trim()!=='';
    const wipDot=!hasBody?'<span class="item-wip">●</span>':'';
    const active=gIdx===selectedIdx?' active':'';
    html+=`<div class="card-item${active}" onclick="showCard(${gIdx})">${badge}<span class="item-code">${esc(card.id)}</span><span class="item-title">${esc(card.title)||'（タイトルなし）'}</span>${wipDot}</div>`;
  });
  el.innerHTML=html;
}

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function isCommentary(id){return /C\d+$/.test(id)||id.endsWith('C');}

function showCard(gIdx) {
  selectedIdx=gIdx;
  const card0=cardData[gIdx];
  // 矢印で別ユニットのカードに入ったら、左の一覧フィルターも追従させて表示を一致させる
  if(curUnit && card0.genre!==curUnit){
    curUnit=card0.genre;
    const sel=document.getElementById('unitSelect');
    if(sel) sel.value=card0.genre;
    filteredList=cardData.filter(d=>d.genre===curUnit);
    document.getElementById('cardCount').textContent=`${filteredList.length}枚`;
  }
  renderList();
  renderCard(gIdx);
  const card=cardData[gIdx];
  document.getElementById('editArea').style.display='flex';
  document.getElementById('editCode').value=card.id;
  document.getElementById('editTitle').value=card.title;
  document.getElementById('editBody').value=card.body;
  countChars();
  setTimeout(()=>{const a=document.querySelector('.card-item.active');if(a)a.scrollIntoView({block:'nearest'});},50);
}

function renderCard(gIdx) {
  const card=cardData[gIdx];
  const imgUrl=imageMap[card.id]||'';
  const imgHtml=imgUrl?`<img src="${imgUrl}" alt="">`:'<div class="card-img-ph">🗂</div>';
  const hasBody=card.body&&!card.body.includes('準備中')&&card.body.trim()!=='';
  const bodyHtml=hasBody?esc(card.body):'（本文未作成）';
  const fi=filteredList.indexOf(card);
  // ◀▶ボタンも矢印キーと同じく全カード通し送り
  const prevGIdx=gIdx>0?gIdx-1:-1;
  const nextGIdx=gIdx<cardData.length-1?gIdx+1:-1;
  document.getElementById('paneCard').innerHTML=`
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
      <div class="card-shell">
        <div class="card-img-area">${imgHtml}</div>
        <div class="card-divider"></div>
        <div class="card-text">
          <div class="card-unit">${esc(card.genre)}</div>
          ${card.section?`<div class="card-section">${esc(card.section)}</div>`:''}
          <div class="card-title-disp" id="prevTitle">${esc(card.title)||'（タイトルなし）'}</div>
          <div class="card-body-disp${hasBody?'':' wip'}" id="prevBody">${bodyHtml}</div>
        </div>
      </div>
      <div class="card-nav">
        <button class="btn-nav" onclick="showCard(${prevGIdx})" ${prevGIdx<0?'disabled':''}>◀</button>
        <span class="nav-info">${fi+1} / ${filteredList.length}</span>
        <button class="btn-nav" onclick="showCard(${nextGIdx})" ${nextGIdx<0?'disabled':''}>▶</button>
      </div>
    </div>`;
}

document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) return;
  if(selectedIdx<0) return;
  // 全カードを通し番号で1つずつ送る（CSVの並び順そのまま）。
  // 端まで来たら次のユニットへ自然に流れる。
  if((e.key==='ArrowRight'||e.key==='ArrowDown')&&selectedIdx<cardData.length-1){e.preventDefault();showCard(selectedIdx+1);}
  else if((e.key==='ArrowLeft'||e.key==='ArrowUp')&&selectedIdx>0){e.preventDefault();showCard(selectedIdx-1);}
});

function updatePreview() {
  const t=document.getElementById('prevTitle');
  const b=document.getElementById('prevBody');
  if(t) t.textContent=document.getElementById('editTitle').value;
  if(b){
    const v=document.getElementById('editBody').value;
    const hasBody=v&&!v.includes('準備中')&&v.trim()!=='';
    b.textContent=hasBody?v:'（本文未作成）';
    b.className='card-body-disp'+(hasBody?'':' wip');
  }
}

function countChars(){
  const len=document.getElementById('editBody').value.length;
  const el=document.getElementById('charCount');
  el.textContent=`${len}字`;
  el.className='char-count '+(len<=400?'char-ok':'char-over');
}

function applyEdit(){
  if(selectedIdx<0) return;
  cardData[selectedIdx].title=document.getElementById('editTitle').value;
  cardData[selectedIdx].body=document.getElementById('editBody').value;
  dirty=true;
  renderList();
  renderCard(selectedIdx);
}

function cancelEdit(){ if(selectedIdx>=0) showCard(selectedIdx); }

// ===== 画像取り込み（960×720へ強制伸縮 → SVG合成 → PNG保存） =====
let pendingImagePng=null, baseImage=null, svgInputTimer=null;

function onPickImage(e){
  const file=e.target.files[0];
  if(file) loadImageFile(file);
  e.target.value='';
}

function loadImageFile(file){
  if(selectedIdx<0){ alert('先にカードを選んでください'); return; }
  if(!file.type.startsWith('image/')){ alert('画像ファイルを選んでください'); return; }
  const img=new Image();
  img.onload=()=>{
    baseImage=img;
    recomposite();
    document.getElementById('imgStage').style.display='block';
  };
  img.onerror=()=>alert('画像を読み込めませんでした');
  const r=new FileReader();
  r.onload=ev=>{ img.src=ev.target.result; };
  r.readAsDataURL(file);
}

// PNG＋SVGをcanvasに合成してpendingImagePngを更新
async function recomposite(){
  if(!baseImage) return;
  const cv=document.getElementById('imgCanvas');
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,960,720);
  ctx.drawImage(baseImage,0,0,960,720);
  const svgCode=document.getElementById('svgOverlayInput').value.trim();
  if(svgCode && svgCode.includes('<svg')){
    try{
      const blob=new Blob([svgCode],{type:'image/svg+xml;charset=utf-8'});
      const url=URL.createObjectURL(blob);
      const svgImg=new Image();
      await new Promise((res,rej)=>{ svgImg.onload=res; svgImg.onerror=rej; svgImg.src=url; });
      ctx.drawImage(svgImg,0,0,960,720);
      URL.revokeObjectURL(url);
    }catch(e){
      // SVGが不正な場合はPNGのみで続行
    }
  }
  pendingImagePng=cv.toDataURL('image/png');
  document.getElementById('imgPreview').src=pendingImagePng;
}

// SVG入力600ms後にプレビュー更新（タイピング中の連続再合成を防ぐ）
function onSvgInput(){
  clearTimeout(svgInputTimer);
  svgInputTimer=setTimeout(()=>recomposite(),600);
}

function clearSvg(){
  document.getElementById('svgOverlayInput').value='';
  recomposite();
}

function cancelImage(){
  pendingImagePng=null;
  baseImage=null;
  document.getElementById('svgOverlayInput').value='';
  document.getElementById('imgStage').style.display='none';
}

async function saveImage(){
  if(selectedIdx<0||!pendingImagePng) return;
  const card=cardData[selectedIdx];
  if(imageMap[card.id] && !confirm(card.id+' の画像を差し替えます。よろしいですか？\n（元の画像は image_backup フォルダに退避されます）')) return;
  const btn=document.getElementById('btnSaveImg');
  btn.disabled=true; btn.textContent='保存中…';
  try{
    const res=await fetch('/api/images/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:card.id,dataUrl:pendingImagePng})});
    const j=await res.json();
    if(!res.ok||!j.ok) throw new Error(j.error||'保存に失敗しました');
    imageMap[card.id]='/api/images/'+encodeURIComponent(j.file)+'?t='+Date.now(); // キャッシュ回避
    cancelImage();
    renderCard(selectedIdx);
    document.getElementById('fileStatus').textContent='🖼 '+card.id+' の画像を保存しました'+(j.backup?'（バックアップ: '+j.backup+'）':'');
  }catch(err){
    alert('画像の保存に失敗しました: '+err.message);
  }finally{
    btn.disabled=false; btn.textContent='💾 画像を保存';
  }
}

// 中央プレビューへドラッグ＆ドロップでも取り込み
(function(){
  const pane=document.getElementById('paneCard');
  pane.addEventListener('dragover',e=>{ e.preventDefault(); pane.classList.add('dragover'); });
  pane.addEventListener('dragleave',()=>pane.classList.remove('dragover'));
  pane.addEventListener('drop',e=>{
    e.preventDefault(); pane.classList.remove('dragover');
    const f=e.dataTransfer.files[0];
    if(f) loadImageFile(f);
  });
})();

// クリップボードから貼り付け（Ctrl+V）で取り込み
// AIが生成した画像を「コピー」→ そのままエディタで Ctrl+V するだけ
document.addEventListener('paste',e=>{
  const items=(e.clipboardData||window.clipboardData)?.items;
  if(!items) return;
  for(const it of items){
    if(it.type && it.type.startsWith('image/')){
      const blob=it.getAsFile();
      if(blob){
        e.preventDefault();
        if(selectedIdx<0){ alert('先にカードを選んでから貼り付けてください'); return; }
        loadImageFile(blob);
      }
      return;
    }
  }
});

// ===== 一括取り込み =====
let parsedImport = [];

function openImport(){
  document.getElementById('importModal').style.display='flex';
  document.getElementById('importText').value='';
  document.getElementById('importPreview').innerHTML='';
  document.getElementById('btnDoImport').disabled=true;
  parsedImport=[];
}
function closeImport(){ document.getElementById('importModal').style.display='none'; }

function parseImport(){
  const text=document.getElementById('importText').value;
  parsedImport=[];
  const blocks=text.split(/^@/m).filter(b=>b.trim());
  for(const b of blocks){
    const nl=b.indexOf('\n');
    if(nl<0) continue;
    const code=b.slice(0,nl).trim();
    const body=b.slice(nl+1).trim();
    if(code) parsedImport.push({code,body});
  }
  const prev=document.getElementById('importPreview');
  if(!parsedImport.length){ prev.innerHTML='<span style="color:#e57373">解析できませんでした。@コードの形式を確認してください。</span>'; document.getElementById('btnDoImport').disabled=true; return; }
  let html=`<div style="margin-bottom:6px;color:var(--accent)">${parsedImport.length}枚を検出：</div>`;
  let okCount=0;
  for(const p of parsedImport){
    const card=cardData.find(d=>d.id===p.code);
    if(card){ okCount++; html+=`<div>✅ ${esc(p.code)}（${p.body.length}字）${esc(card.title)}</div>`; }
    else { html+=`<div style="color:#e57373">⚠ ${esc(p.code)} … CSVに該当コードなし（スキップ）</div>`; }
  }
  prev.innerHTML=html;
  document.getElementById('btnDoImport').disabled = okCount===0;
}

function doImport(){
  let n=0;
  for(const p of parsedImport){
    const idx=cardData.findIndex(d=>d.id===p.code);
    if(idx>=0){ cardData[idx].body=p.body; n++; }
  }
  dirty=true;
  closeImport();
  filterCards();
  if(selectedIdx>=0) showCard(selectedIdx);
  alert(`${n}枚の本文を取り込みました。\nプレビューで確認し、問題なければ「CSVを保存」してください。`);
}

// ===== 保存：サーバーに直接上書き（バックアップ自動作成） =====
async function saveCSV(){
  if(!cardData.length) return;
  const hdr=cardData[0]._header||['コード','ユニット','サブユニット','タイトル','説明',''];
  const rows=[hdr,...cardData.map(d=>[d.id,d.genre,d.section,d.title,d.body,d.subject])];
  const csv=rows.map(r=>r.map(c=>{const s=String(c||'');return(s.includes(',')||s.includes('"')||s.includes('\n')||s.includes('\r'))?`"${s.replace(/"/g,'""')}"`:s;}).join(',')).join('\r\n');
  const btn=document.getElementById('btnSave');
  const orig=btn.textContent;
  btn.disabled=true; btn.textContent='保存中…';
  const BOM=String.fromCharCode(0xFEFF);
  try {
    const res=await fetch('/api/csv',{method:'POST',headers:{'Content-Type':'text/plain; charset=utf-8'},body:BOM+csv});
    const j=await res.json();
    if(!res.ok||!j.ok) throw new Error(j.error||'保存に失敗しました');
    dirty=false;
    document.getElementById('fileStatus').textContent=`💾 保存しました${j.backup?'（バックアップ: '+j.backup+'）':''}`;
  } catch(err) {
    alert('保存に失敗しました: '+err.message);
  } finally {
    btn.disabled=false; btn.textContent=orig;
  }
}

window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});

// 起動
init();
