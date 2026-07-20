let cardData=[], imageMap={}, selectedIdx=-1, dirty=false, curUnit='', filteredList=[];
let editDirty=false;
let readingScripts={}, showingReadScript=false, _readScriptSaveTimer=null;
let mp3Ids=new Set();

// ===== 初期化：サーバーからCSVと画像一覧を自動読み込み =====
async function init() {
  const status=document.getElementById('fileStatus');
  try {
    const res=await fetch('/api/csv');
    if(!res.ok) throw new Error('CSVの読み込みに失敗しました');
    const text=await res.text();
    cardData=parseCSV(text);

    // 画像一覧・MP3一覧を並行取得
    imageMap={};
    mp3Ids=new Set();
    await Promise.all([
      fetch('/api/images').then(r=>r.ok?r.json():null).then(map=>{
        if(map) for(const [id,file] of Object.entries(map)) imageMap[id]='/api/images/'+encodeURIComponent(file);
      }).catch(()=>{}),
      fetch('/api/voice/list').then(r=>r.ok?r.json():null).then(j=>{
        if(j?.ids) mp3Ids=new Set(j.ids);
      }).catch(()=>{}),
      loadPrompts()
    ]);

    buildUnitSelect();
    status.textContent=`✅ TAKERUcard.csv（${cardData.length}枚）　🖼 ${Object.keys(imageMap).length}枚`;
    document.getElementById('btnSave').disabled=false;
    document.getElementById('btnImport').disabled=false;
    document.getElementById('btnExport').disabled=false;
    document.getElementById('btnRename').disabled=false;
    document.getElementById('btnProgress').disabled=false;
    document.getElementById('btnBatchRecord').disabled=false;
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
    published:(r[6]||'').trim()==='1',   // 7列目「公開」。空欄・旧CSV(undefined)は非公開
    _header:hdr
  })).filter(d=>d.id);
}

function buildUnitSelect() {
  const sel=document.getElementById('unitSelect');

  // CSV登場順を保ちながら subject → [genre,...] のグループを作る
  const subjectOrder=[], subjectMap=new Map();
  for(const c of cardData){
    if(!c.genre) continue;
    if(!subjectMap.has(c.subject)){
      subjectMap.set(c.subject,[]);
      subjectOrder.push(c.subject);
    }
    if(!subjectMap.get(c.subject).includes(c.genre))
      subjectMap.get(c.subject).push(c.genre);
  }

  sel.innerHTML='<option value="">── ユニットを選択 ──</option>';
  for(const subj of subjectOrder){
    const genres=subjectMap.get(subj);
    if(subj){
      const grp=document.createElement('optgroup');
      grp.label=subj;
      genres.forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=g;grp.appendChild(o);});
      sel.appendChild(grp);
    } else {
      genres.forEach(g=>{const o=document.createElement('option');o.value=g;o.textContent=g;sel.appendChild(o);});
    }
  }

  const firstGenre=cardData.find(c=>c.genre)?.genre||'';
  if(firstGenre){sel.value=firstGenre;filterCards();}
}

function filterCards() {
  curUnit=document.getElementById('unitSelect').value;
  filteredList=curUnit?cardData.filter(d=>d.genre===curUnit):cardData;
  document.getElementById('cardCount').textContent=`${filteredList.length}枚`;
  updateUnitNavBtns();
  renderList();
}

function updateUnitNavBtns() {
  const units=[...new Set(cardData.map(d=>d.genre))];
  const idx=units.indexOf(curUnit);
  document.getElementById('btnPrevUnit').disabled=idx<=0;
  document.getElementById('btnNextUnit').disabled=idx<0||idx>=units.length-1;
}

function prevUnit() {
  const units=[...new Set(cardData.map(d=>d.genre))];
  const idx=units.indexOf(curUnit);
  if(idx>0){ document.getElementById('unitSelect').value=units[idx-1]; filterCards(); }
}

function nextUnit() {
  const units=[...new Set(cardData.map(d=>d.genre))];
  const idx=units.indexOf(curUnit);
  if(idx>=0&&idx<units.length-1){ document.getElementById('unitSelect').value=units[idx+1]; filterCards(); }
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
    const showBadge = card.subject && !card.subject.includes('軍事と戦略');
    const badge=showBadge?(isC?'<span class="badge badge-c">解説</span>':''):'';
    const hasBody=hasRealBody(card.body);
    const hasImg=!!imageMap[card.id];
    const hasMp3=mp3Ids.has(card.id);
    const dots=`<span class="status-dots"><span class="sdot ${card.published?'sdot-pub':'sdot-off'}" title="公開">公</span><span class="sdot ${hasBody?'sdot-body':'sdot-off'}" title="本文">文</span><span class="sdot ${hasImg?'sdot-img':'sdot-off'}" title="画像">画</span><span class="sdot ${hasMp3?'sdot-mp3':'sdot-off'}" title="MP3">音</span></span>`;
    const active=gIdx===selectedIdx?' active':'';
    html+=`<div class="card-item${active}" onclick="showCard(${gIdx})">${badge}<span class="item-code">${esc(card.id)}</span><span class="item-title">${esc(card.title)||'（タイトルなし）'}</span>${dots}</div>`;
  });
  el.innerHTML=html;
}

function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function isCommentary(id){return /C\d+$/.test(id)||id.endsWith('C');}

// 本文が「未作成」か。プレースホルダ丸ごと1文だけの場合に限り未作成とみなす。
// includes判定にすると、プレースホルダを消さずに書き足した本文を
// まるごと未作成扱いしてしまうため完全一致で見る。
const WIP_PLACEHOLDER='（準備中）このカードは現在作成中です。';
function hasRealBody(s){
  const t=String(s==null?'':s).trim();
  return t!=='' && t!==WIP_PLACEHOLDER;
}

function showCard(gIdx) {
  if(editDirty && !confirm('本文が未適用です。移動すると変更が失われます。\n移動しますか？')) return;
  editDirty=false;
  stopVoice();
  if(showingReadScript){
    clearTimeout(_readScriptSaveTimer);
    saveReadingScript();
    _exitReadScriptMode();
  }
  selectedIdx=gIdx;
  const card0=cardData[gIdx];
  // 矢印で別ユニットのカードに入ったら、左の一覧フィルターも追従させて表示を一致させる
  if(curUnit && card0.genre!==curUnit){
    curUnit=card0.genre;
    const sel=document.getElementById('unitSelect');
    if(sel) sel.value=card0.genre;
    filteredList=cardData.filter(d=>d.genre===curUnit);
    document.getElementById('cardCount').textContent=`${filteredList.length}枚`;
    updateUnitNavBtns();
  }
  renderList();
  renderCard(gIdx);
  const card=cardData[gIdx];
  document.getElementById('editArea').style.display='flex';
  document.getElementById('voiceArea').style.display='flex';
  document.getElementById('editCode').value=card.id;
  document.getElementById('editTitle').value=card.title;
  document.getElementById('editBody').value=card.body;
  document.getElementById('editPublished').checked=!!card.published;
  countChars();
  setTimeout(()=>{const a=document.querySelector('.card-item.active');if(a)a.scrollIntoView({block:'nearest'});},50);
  checkVoiceStatus(card.id);
  _updateReadScriptBtn(card.id);
}

function renderCard(gIdx) {
  const card=cardData[gIdx];
  const imgUrl=imageMap[card.id]||'';
  const imgHtml=imgUrl?`<img src="${imgUrl}" alt="">`:'<div class="card-img-ph">🗂</div>';
  const hasBody=hasRealBody(card.body);
  const bodyHtml=hasBody?esc(card.body):'（本文未作成）';
  const fi=filteredList.indexOf(card);
  // ◀▶ボタンも矢印キーと同じく全カード通し送り
  const prevGIdx=gIdx>0?gIdx-1:-1;
  const nextGIdx=gIdx<cardData.length-1?gIdx+1:-1;
  document.getElementById('paneCard').innerHTML=`
    <div class="card-shell">
      <div class="card-img-area">${imgHtml}</div>
      <div class="card-divider"></div>
      <div class="card-text">
        <div class="card-unit">${esc(card.genre)}</div>
        ${card.section?`<div class="card-section">${esc(card.section)}</div>`:''}
        <div class="card-title-row">
          <div class="card-title-disp" id="prevTitle">${esc(card.title)||'（タイトルなし）'}</div>
          <div class="card-nav">
            <button class="btn-nav" onclick="showCard(${prevGIdx})" ${prevGIdx<0?'disabled':''}>◀</button>
            <span class="nav-info">${fi+1}/${filteredList.length}</span>
            <button class="btn-nav" onclick="showCard(${nextGIdx})" ${nextGIdx<0?'disabled':''}>▶</button>
          </div>
        </div>
        <div class="card-body-disp${hasBody?'':' wip'}" id="prevBody">${bodyHtml}</div>
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
    const hasBody=hasRealBody(v);
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
  dirty=true; editDirty=false;
  renderList();
  renderCard(selectedIdx);
}

// 公開チェックの切り替え（即座にデータへ反映。確定を待たずCSV保存対象になる）
function onPublishedChange(){
  if(selectedIdx<0) return;
  cardData[selectedIdx].published=document.getElementById('editPublished').checked;
  dirty=true;
  renderList();
}

function cancelEdit(){ editDirty=false; if(selectedIdx>=0) showCard(selectedIdx); }

function copyCardText(){
  if(selectedIdx<0) return;
  const card=cardData[selectedIdx];
  const text=`**カードコード**：【${card.id}】\n\n**カードタイトル**：【${card.title}】\n\n**解説文**： 【${card.body}】`;
  navigator.clipboard.writeText(text).then(()=>{
    const btn=document.querySelector('.btn-copy');
    const orig=btn.textContent;
    btn.textContent='✅ コピー済み';
    setTimeout(()=>btn.textContent=orig,2000);
  }).catch(()=>alert('コピーに失敗しました'));
}

// ===== 画像取り込み（960×720へ強制伸縮 → SVG合成 → JPEG保存） =====
// JPEG品質。PNGで保存していた頃はカード画像1枚が約1.5MBあり、
// 118枚で141MBに達していた（sw.jsが端末にキャッシュするため実害が大きい）。
// 960x720は「寸法」の指定でしかなく、PNGは可逆圧縮なので細密な絵は縮まない。
// q90なら目視で劣化が分からないまま約1/7に収まる（実測14%）。
const IMG_JPEG_QUALITY=0.9;
let pendingImageData=null, baseImage=null, svgInputTimer=null;

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

// 元画像＋SVGをcanvasに合成して pendingImageData を更新
async function recomposite(){
  if(!baseImage) return;
  const cv=document.getElementById('imgCanvas');
  const ctx=cv.getContext('2d');
  ctx.clearRect(0,0,960,720);
  // JPEGは透過を持てない。白地を敷かないと透明部分が黒く潰れる
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,960,720);
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
  pendingImageData=cv.toDataURL('image/jpeg', IMG_JPEG_QUALITY);
  document.getElementById('imgPreview').src=pendingImageData;
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
  pendingImageData=null;
  baseImage=null;
  document.getElementById('svgOverlayInput').value='';
  document.getElementById('imgStage').style.display='none';
}

async function saveImage(){
  if(selectedIdx<0||!pendingImageData) return;
  const card=cardData[selectedIdx];
  if(imageMap[card.id] && !confirm(card.id+' の画像を差し替えます。よろしいですか？\n（元の画像は image_backup フォルダに退避されます）')) return;
  const btn=document.getElementById('btnSaveImg');
  btn.disabled=true; btn.textContent='保存中…';
  try{
    const res=await fetch('/api/images/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:card.id,dataUrl:pendingImageData})});
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

// ==========================================
// ユニット名・サブユニット名の変更
//
// サブユニット名はユニットをまたいで重複しうる（例：「概論」が
// 「日本周辺の軍事情勢」と「世界の軍事情勢」の両方に存在する）。
// 名前だけで置換すると別ユニットまで巻き込むため、サブユニットの
// 変更は必ず「ユニット×サブユニット」の両方で絞り込む。
// ==========================================
function openRename(){
  if(!cardData.length) return;
  const units=[];
  for(const c of cardData){ if(c.genre && !units.includes(c.genre)) units.push(c.genre); }
  const uSel=document.getElementById('renameUnit');
  uSel.innerHTML=units.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');
  if(curUnit && units.includes(curUnit)) uSel.value=curUnit;
  document.querySelector('input[name="rnKind"][value="unit"]').checked=true;
  onRenameKindChange();
  document.getElementById('renameModal').style.display='flex';
}
function closeRename(){ document.getElementById('renameModal').style.display='none'; }

function _rnKind(){ return document.querySelector('input[name="rnKind"]:checked').value; }

function onRenameKindChange(){
  const isSec=_rnKind()==='section';
  document.getElementById('renameSecRow').style.display=isSec?'':'none';
  onRenameUnitChange();
}

// 選択中ユニットに属するサブユニットだけを候補に出す
function onRenameUnitChange(){
  const unit=document.getElementById('renameUnit').value;
  const secs=[];
  for(const c of cardData){
    if(c.genre===unit && c.section && !secs.includes(c.section)) secs.push(c.section);
  }
  const sSel=document.getElementById('renameSection');
  sSel.innerHTML=secs.length
    ? secs.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('')
    : '<option value="">（このユニットにサブユニットはありません）</option>';
  sSel.disabled=!secs.length;
  _rnFillCurrentName();
  updateRenameInfo();
}

// 新しい名前の初期値に現在の名前を入れておく（部分的な手直しがしやすい）
function _rnFillCurrentName(){
  const box=document.getElementById('renameNew');
  box.value=_rnKind()==='unit'
    ? document.getElementById('renameUnit').value
    : document.getElementById('renameSection').value;
}

function _rnTargets(){
  const unit=document.getElementById('renameUnit').value;
  if(_rnKind()==='unit') return { old:unit, cards:cardData.filter(c=>c.genre===unit) };
  const sec=document.getElementById('renameSection').value;
  // ユニットとサブユニットの両方で絞る（同名サブユニットの巻き込み防止）
  return { old:sec, cards:cardData.filter(c=>c.genre===unit && c.section===sec) };
}

function updateRenameInfo(){
  const el=document.getElementById('renameInfo');
  const btn=document.getElementById('btnDoRename');
  const kind=_rnKind(), isSec=kind==='section';
  const unit=document.getElementById('renameUnit').value;
  const { old, cards }=_rnTargets();
  const now=document.getElementById('renameNew').value.trim();

  if(isSec && !document.getElementById('renameSection').value){
    el.innerHTML='<span class="exp-warn">このユニットにはサブユニットがありません。</span>';
    btn.disabled=true; return;
  }
  if(!now){ el.innerHTML='<span class="exp-hint">新しい名前を入力してください。</span>'; btn.disabled=true; return; }
  if(now===old){ el.innerHTML='<span class="exp-hint">現在の名前と同じです。</span>'; btn.disabled=true; return; }
  if(now.includes(',')||now.includes('"')){
    el.innerHTML='<span class="exp-warn">⚠ 名前に , や " は使えません。</span>'; btn.disabled=true; return;
  }
  btn.disabled=false;

  let html=`<strong>${cards.length}枚</strong> のカードの`+(isSec?'サブユニット名':'ユニット名')+
    `を<br>「${esc(old)}」→ <strong>「${esc(now)}」</strong> に変更します`;

  // 既存の名前に変えると2つが統合される。事故になりやすいので明示する
  const existing = kind==='unit'
    ? cardData.some(c=>c.genre===now)
    : cardData.some(c=>c.genre===unit && c.section===now);
  if(existing){
    const n = kind==='unit'
      ? cardData.filter(c=>c.genre===now).length
      : cardData.filter(c=>c.genre===unit && c.section===now).length;
    html+=`<br><span class="exp-warn">⚠ 「${esc(now)}」は既に存在します（${n}枚）。`+
      `変更すると2つが<strong>統合</strong>され、合計${cards.length+n}枚が同じ名前になります。</span>`;
  }
  if(isSec){
    const others=[...new Set(cardData.filter(c=>c.section===old && c.genre!==unit).map(c=>c.genre))];
    if(others.length){
      html+=`<br><span class="exp-hint">「${esc(old)}」は ${others.map(esc).join('・')} にもありますが、`+
        `そちらは変更されません（このユニット内だけが対象）。</span>`;
    }
  }
  el.innerHTML=html;
}

function doRename(){
  const kind=_rnKind();
  const unit=document.getElementById('renameUnit').value;
  const now=document.getElementById('renameNew').value.trim();
  const { old, cards }=_rnTargets();
  if(!now || now===old || !cards.length) return;

  for(const c of cards){ if(kind==='unit') c.genre=now; else c.section=now; }
  dirty=true;
  closeRename();

  // ユニット名が変わるとセレクトの中身も変わるため作り直し、選択を維持する
  buildUnitSelect();
  const sel=document.getElementById('unitSelect');
  sel.value = kind==='unit' ? now : unit;
  filterCards();
  if(selectedIdx>=0) showCard(selectedIdx);

  document.getElementById('fileStatus').textContent=
    `✏️ ${cards.length}枚を「${now}」に変更しました（未保存 — 「CSVを保存」で確定）`;
}

// ==========================================
// レビュー用 書き出し（MD / 自己完結HTML）
// MD  … AIに貼って内容チェックしてもらう用
// HTML… 画像をdata URIで埋め込んだ1枚もの。
//        ブラウザで開いて Ctrl+P → PDF、Wordでもそのまま開ける。
//        pandoc等の外部ツールに依存させないための選択。
// ==========================================
function openExport(){
  if(!cardData.length) return;

  const units=[];
  for(const c of cardData){ if(c.genre && !units.includes(c.genre)) units.push(c.genre); }
  const uSel=document.getElementById('exportUnit');
  uSel.innerHTML=units.map(u=>`<option value="${esc(u)}">${esc(u)}</option>`).join('');
  if(curUnit && units.includes(curUnit)) uSel.value=curUnit;

  const subjects=[];
  for(const c of cardData){ if(c.subject && !subjects.includes(c.subject)) subjects.push(c.subject); }
  const sSel=document.getElementById('exportSubject');
  sSel.innerHTML=subjects.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  const curSubj=selectedIdx>=0?cardData[selectedIdx].subject:'';
  if(curSubj && subjects.includes(curSubj)) sSel.value=curSubj;

  onExportScopeChange();
  document.getElementById('exportModal').style.display='flex';
}
function closeExport(){ document.getElementById('exportModal').style.display='none'; }

function _expScope(){ return document.querySelector('input[name="expScope"]:checked').value; }
function _expFmt(){ return document.querySelector('input[name="expFmt"]:checked').value; }

function onExportScopeChange(){
  const s=_expScope();
  document.getElementById('exportUnit').disabled = s!=='unit';
  document.getElementById('exportSubject').disabled = s!=='subject';
  const card=selectedIdx>=0?cardData[selectedIdx]:null;
  document.getElementById('exportCardName').textContent =
    card ? `${card.id}　${card.title||'（タイトルなし）'}` : '（カード未選択）';
  renderExportList();
}

// 範囲で絞り込んだ候補（チェックを外す前の全件）
function getScopeCards(){
  const s=_expScope();
  if(s==='card') return selectedIdx>=0?[cardData[selectedIdx]]:[];
  if(s==='unit'){
    const u=document.getElementById('exportUnit').value;
    return cardData.filter(c=>c.genre===u);
  }
  const sub=document.getElementById('exportSubject').value;
  return cardData.filter(c=>c.subject===sub);
}

// 実際に書き出す対象（チェックが入っているものだけ）
function getExportCards(){
  const checked=new Set([...document.querySelectorAll('.exp-cb:checked')].map(cb=>cb.dataset.id));
  return getScopeCards().filter(c=>checked.has(c.id));
}

// 範囲を変えるたびに一覧を作り直す。未作成カードも既定では入れておく
// （「ここはこれから書く」という全体構成を見せたい場合があるため）。
function renderExportList(){
  const cards=getScopeCards();
  const el=document.getElementById('exportList');
  if(!cards.length){
    el.innerHTML='<div class="empty-state" style="padding:20px;font-size:0.8rem">対象がありません</div>';
    updateExportInfo();
    return;
  }
  let html='', curSec=null;
  for(const c of cards){
    if(c.section!==curSec){
      curSec=c.section;
      if(curSec) html+=`<div class="exp-sec">📂 ${esc(curSec)}</div>`;
    }
    const hasBody=hasRealBody(c.body), hasImg=!!imageMap[c.id], hasMp3=mp3Ids.has(c.id);
    html+=`<label class="batch-item${hasBody?'':' exp-wip'}">
      <input type="checkbox" class="exp-cb" data-id="${esc(c.id)}" checked onchange="updateExportInfo()">
      <span class="batch-code">${esc(c.id)}</span>
      <span class="batch-title">${esc(c.title||'（タイトルなし）')}</span>
      <span class="status-dots">
        <span class="sdot ${hasBody?'sdot-body':'sdot-off'}">文</span>
        <span class="sdot ${hasImg?'sdot-img':'sdot-off'}">画</span>
        <span class="sdot ${hasMp3?'sdot-mp3':'sdot-off'}">音</span>
      </span>
    </label>`;
  }
  el.innerHTML=html;
  updateExportInfo();
}

function expCheckAll(v){
  document.querySelectorAll('.exp-cb').forEach(cb=>cb.checked=v);
  updateExportInfo();
}

// 本文が書けているものだけ残す
function expCheckWritten(){
  const byId={};
  for(const c of getScopeCards()) byId[c.id]=c;
  document.querySelectorAll('.exp-cb').forEach(cb=>{
    cb.checked=hasRealBody(byId[cb.dataset.id]?.body);
  });
  updateExportInfo();
}

function getExportTitle(){
  const s=_expScope();
  if(s==='card') return selectedIdx>=0?cardData[selectedIdx].id:'card';
  if(s==='unit') return document.getElementById('exportUnit').value;
  return document.getElementById('exportSubject').value;
}

function updateExportInfo(){
  const scoped=getScopeCards();
  const cards=getExportCards();
  const el=document.getElementById('exportInfo');
  const btn=document.getElementById('btnDoExport');

  document.getElementById('exportCheckCount').textContent =
    scoped.length ? `${cards.length} / ${scoped.length}枚` : '0枚';

  if(!scoped.length){
    el.innerHTML='<span class="exp-warn">⚠ 書き出す対象がありません。'+
      (_expScope()==='card'?'左の一覧からカードを選んでください。':'')+'</span>';
    btn.disabled=true;
    return;
  }
  if(!cards.length){
    el.innerHTML='<span class="exp-warn">⚠ カードが1枚も選ばれていません。</span>';
    btn.disabled=true;
    return;
  }
  btn.disabled=false;

  const nBody=cards.filter(c=>hasRealBody(c.body)).length;
  const nImg=cards.filter(c=>imageMap[c.id]).length;
  const fmt=_expFmt();
  const withImg=document.getElementById('exportWithImg').checked;

  const files=[];
  if(fmt==='both'||fmt==='md')   files.push('.md');
  if(fmt==='both'||fmt==='html') files.push('.html');

  const nOff=scoped.length-cards.length;
  let html=`<strong>${cards.length}枚</strong> を書き出します`+
    `（本文あり ${nBody}枚／画像あり ${nImg}枚`+
    (nOff?`／<span class="exp-warn">${nOff}枚を除外</span>`:'')+`）<br>`+
    `ファイル：<strong>${files.join('　+　')}</strong>`;

  if(nBody<cards.length){
    html+=`<br><span class="exp-warn">⚠ 本文未作成が ${cards.length-nBody}枚 含まれます（「（本文未作成）」と出力されます）</span>`;
  }
  if((fmt==='both'||fmt==='html') && withImg && nImg>0){
    // 目安（960x720のPNGをJPEG化すると1枚あたり概ね0.2MB）
    const mb=(nImg*0.2).toFixed(1);
    html+=`<br><span class="exp-hint">画像${nImg}枚をJPEG化して埋め込みます（HTMLは ${mb}MB 前後の見込み）</span>`;
  }
  el.innerHTML=html;
}

function _sanitizeFile(s){ return String(s).replace(/[\\/:*?"<>|]/g,'_').trim(); }

function _mb(n){ return n<1024*1024 ? Math.round(n/1024)+'KB' : (n/1024/1024).toFixed(1)+'MB'; }

function _stamp(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
}

function downloadFile(name, content, mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}

// 埋め込み用に縮小＋JPEG化する。
// 元のカード画像は1枚あたり約1.5MBのPNGで、data URIにすると約2MBに膨らむ。
// 16枚のユニットをそのまま埋めると30MB超となりメール添付できないため、
// レビューに十分な画質を保ったままJPEGへ変換して1/10程度に落とす。
async function imgToDataUrl(url, maxW=960, quality=0.82){
  try{
    const res=await fetch(url);
    if(!res.ok) return null;
    const blob=await res.blob();
    const bmp=await createImageBitmap(blob);
    const scale=Math.min(1, maxW/bmp.width);
    const w=Math.round(bmp.width*scale), h=Math.round(bmp.height*scale);
    const cv=document.createElement('canvas');
    cv.width=w; cv.height=h;
    const cx=cv.getContext('2d');
    cx.fillStyle='#fff'; cx.fillRect(0,0,w,h);  // JPEGは透過を持てないので白地を敷く
    cx.drawImage(bmp,0,0,w,h);
    if(bmp.close) bmp.close();
    return cv.toDataURL('image/jpeg', quality);
  }catch{ return null; }
}

function buildExportMD(cards, title){
  const now=new Date().toLocaleString('ja-JP');
  let md=`# ${title}\n\n`;
  md+=`TAKERU カード原稿　／　全 ${cards.length} 枚　／　書き出し：${now}\n\n`;
  md+=`---\n\n`;
  let curSec=null;
  for(const c of cards){
    if(c.section!==curSec){
      curSec=c.section;
      if(curSec) md+=`## ${curSec}\n\n`;
    }
    md+=`### ${c.id}　${c.title||'（タイトルなし）'}\n\n`;
    const body=hasRealBody(c.body)?c.body.trim():'（本文未作成）';
    md+=body+'\n\n';
    const meta=[`${body.length}字`];
    meta.push(imageMap[c.id]?'画像あり':'画像なし');
    meta.push(mp3Ids.has(c.id)?'音声あり':'音声なし');
    md+=`\`${meta.join(' / ')}\`\n\n---\n\n`;
  }
  return md;
}

async function buildExportHTML(cards, title, withImg){
  const now=new Date().toLocaleString('ja-JP');
  const imgs={};
  if(withImg){
    for(const c of cards){
      if(imageMap[c.id]) imgs[c.id]=await imgToDataUrl(imageMap[c.id]);
    }
  }
  let body='';
  let curSec=null;
  for(const c of cards){
    if(c.section!==curSec){
      curSec=c.section;
      if(curSec) body+=`<h2 class="sec">${esc(curSec)}</h2>\n`;
    }
    const has=hasRealBody(c.body);
    const text=has?c.body.trim():'（本文未作成）';
    const d=imgs[c.id];
    // 画像が無いのは「不要」ではなく「未作成」なので、レビュアーに作業中と伝わる文言にする
    const imgHtml=d?`<div class="cimg"><img src="${d}" alt="${esc(c.id)}"></div>`
                  :(imageMap[c.id]?'<div class="cimg noimg">［画像あり・このファイルには未収録］</div>'
                                  :'<div class="cimg noimg pending">［画像はこれから］</div>');
    const meta=[`${text.length}字`, imageMap[c.id]?'画像あり':'画像なし', mp3Ids.has(c.id)?'音声あり':'音声なし'];
    body+=`<article class="card">
  <div class="chead"><span class="cid">${esc(c.id)}</span><h3>${esc(c.title)||'（タイトルなし）'}</h3></div>
  ${imgHtml}
  <div class="cbody${has?'':' wip'}">${esc(text)}</div>
  <div class="cmeta">${meta.map(esc).join('　/　')}</div>
</article>\n`;
  }

  return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Noto Sans JP','Yu Gothic',sans-serif; background:#f4f4f4; color:#1a1a1a;
         line-height:1.9; padding:28px 16px; }
  .wrap { max-width:760px; margin:0 auto; }
  header.doc { border-bottom:3px solid #2e7d32; padding-bottom:12px; margin-bottom:8px; }
  header.doc h1 { font-size:1.5rem; color:#1b5e20; }
  header.doc .sub { font-size:0.8rem; color:#666; margin-top:6px; }
  h2.sec { font-size:1rem; color:#1b5e20; background:#e4efe4; border-left:5px solid #2e7d32;
           padding:7px 12px; margin:26px 0 12px; border-radius:0 4px 4px 0; }
  .card { background:#fff; border:1px solid #ddd; border-radius:8px; padding:18px 20px;
          margin-bottom:16px; page-break-inside:avoid; break-inside:avoid; }
  .chead { display:flex; align-items:baseline; gap:10px; border-bottom:1px solid #eee;
           padding-bottom:8px; margin-bottom:12px; }
  .cid { font-family:Consolas,monospace; font-size:0.75rem; color:#fff; background:#2e7d32;
         padding:2px 8px; border-radius:3px; flex-shrink:0; }
  .chead h3 { font-size:1.05rem; }
  .cimg { margin-bottom:12px; }
  .cimg img { width:100%; border-radius:5px; display:block; border:1px solid #e5e5e5; }
  .cimg.noimg { font-size:0.75rem; color:#aaa; background:#fafafa; border:1px dashed #ddd;
                border-radius:5px; padding:16px; text-align:center; }
  .cimg.noimg.pending { color:#a97514; background:#fdf7e8; border-color:#e5cf94; }
  .cbody { white-space:pre-wrap; font-size:0.95rem; }
  .cbody.wip { color:#b00; font-style:italic; }
  .cmeta { margin-top:12px; padding-top:8px; border-top:1px dotted #ddd;
           font-size:0.7rem; color:#999; text-align:right; }
  @media print {
    body { background:#fff; padding:0; }
    .card { border:1px solid #ccc; }
    header.doc { border-bottom-color:#333; }
  }
</style></head>
<body><div class="wrap">
<header class="doc">
  <h1>${esc(title)}</h1>
  <div class="sub">TAKERU カード原稿　／　全 ${cards.length} 枚　／　書き出し：${esc(now)}</div>
</header>
${body}</div></body></html>`;
}

async function doExport(){
  const cards=getExportCards();
  if(!cards.length) return;
  const title=getExportTitle();
  const fmt=_expFmt();
  const withImg=document.getElementById('exportWithImg').checked;
  const btn=document.getElementById('btnDoExport');
  const orig=btn.textContent;
  btn.disabled=true; btn.textContent='書き出し中…';

  try{
    const base=`TAKERU_${_sanitizeFile(title)}_${_stamp()}`;
    const done=[];
    if(fmt==='both'||fmt==='md'){
      const md=buildExportMD(cards,title);
      downloadFile(base+'.md', md, 'text/markdown;charset=utf-8');
      done.push(`.md ${_mb(md.length)}`);
    }
    if(fmt==='both'||fmt==='html'){
      const html=await buildExportHTML(cards,title,withImg);
      downloadFile(base+'.html', html, 'text/html;charset=utf-8');
      done.push(`.html ${_mb(html.length)}`);
    }
    closeExport();
    document.getElementById('fileStatus').textContent=
      `📤 ${cards.length}枚を書き出しました（${base}　${done.join('／')}）`;
  }catch(err){
    alert('書き出しに失敗しました: '+err.message);
  }finally{
    btn.disabled=false; btn.textContent=orig;
  }
}

// ===== 保存：サーバーに直接上書き（バックアップ自動作成） =====
async function saveCSV(){
  if(!cardData.length) return;
  if(editDirty && selectedIdx >= 0) applyEdit();
  const hdr=(cardData[0]._header||['コード','ユニット','サブユニット','タイトル','説明','']).slice();
  hdr[6]='公開';   // 7列目ヘッダを保証（旧6列CSVから読んでも付与される）
  const rows=[hdr,...cardData.map(d=>[d.id,d.genre,d.section,d.title,d.body,d.subject,d.published?'1':''])];
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

// ==================== 音声パネル ====================
const VOICE_KEY = 'takeru_voice_settings';
const VOICE_VER = 2;
const SLOT_DEFAULTS = [
  { narrator:'Japanese Male 2',   speed:100, pitch:50, happy:40, fun:30, sad:0, angry:0 },
  { narrator:'Japanese Female 3', speed:100, pitch:50, happy:40, fun:30, sad:0, angry:0 },
  { narrator:'Japanese Female 1', speed:100, pitch:50, happy:40, fun:30, sad:0, angry:0 },
];
let activeSlot = 0;
let currentAudio = null;
let voiceMsgTimer = null;

// ---- スロット管理 ----
let _vsCache = null;

function loadVS(){ return _vsCache || (()=>{ try{ return JSON.parse(localStorage.getItem(VOICE_KEY))||{}; }catch{ return {}; } })(); }

async function loadVSFromServer(){
  try{
    const r = await fetch('/api/voice-settings', { signal: AbortSignal.timeout(2000) });
    if(r.ok){
      _vsCache = await r.json();
      localStorage.setItem(VOICE_KEY, JSON.stringify(_vsCache));
    }
  } catch {}
  if(!_vsCache) _vsCache = (()=>{ try{ return JSON.parse(localStorage.getItem(VOICE_KEY))||{}; }catch{ return {}; } })();
}

function ensureSlots(vs){
  if(!Array.isArray(vs.slots) || vs.slots.length < 3 || vs.ver !== VOICE_VER){
    vs.slots = [0,1,2].map(i => ({...SLOT_DEFAULTS[i]}));
    vs.ver = VOICE_VER;
  }
  return vs.slots;
}

function saveVoiceSettings(){
  const vs=loadVS();
  const slots=ensureSlots(vs);
  slots[activeSlot] = { narrator:getNarrator(), ...getSliderParams() };
  vs.slots=slots; vs.activeSlot=activeSlot;
  _vsCache = vs;
  localStorage.setItem(VOICE_KEY, JSON.stringify(vs));
  fetch('/api/voice-settings', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(vs) }).catch(()=>{});
  updateSlotButtons(slots);
}

function switchSlot(idx){
  saveVoiceSettings();
  activeSlot=idx;
  const vs=loadVS();
  const slots=ensureSlots(vs);
  applySlot(slots[activeSlot]);
  updateSlotButtons(slots);
}

function applySlot(slot){
  const s={...SLOT_DEFAULTS[activeSlot],...slot};
  const sel=document.getElementById('narratorSelect'), inp=document.getElementById('narratorInput');
  if(sel.style.display!=='none'){ sel.value=s.narrator; if(sel.value!==s.narrator) sel.value=sel.options[0]?.value||''; }
  else { inp.value=s.narrator; }
  [['vpSpeed','vpSpeedN',s.speed],['vpPitch','vpPitchN',s.pitch],
   ['emHappy','emHappyN',s.happy],['emFun','emFunN',s.fun],
   ['emSad','emSadN',s.sad],['emAngry','emAngryN',s.angry]
  ].forEach(([r,n,v])=>{ document.getElementById(r).value=v; document.getElementById(n).value=v; });
}

function updateSlotButtons(slots){
  for(let i=0;i<3;i++){
    const btn=document.getElementById(`slot${i}Btn`);
    if(!btn) continue;
    const raw=slots[i]?.narrator||'';
    const name=raw?friendlyNarrator(raw):`スロット${i+1}`;
    btn.textContent=name;
    btn.title=raw||`スロット${i+1}`;
    btn.className='btn-slot'+(i===activeSlot?' active':'');
  }
}

// ---- UI ユーティリティ ----
function friendlyNarrator(n){
  if(n==='Japanese Female Child') return '女の子';
  return n.replace('Japanese Female','女性').replace('Japanese Male','男性').replace(/\s+/g,'');
}

function syncNum(rId,nId){ document.getElementById(nId).value=document.getElementById(rId).value; }
function syncRange(nId,rId){ document.getElementById(rId).value=document.getElementById(nId).value; }

function getSliderParams(){
  const g=id=>+document.getElementById(id).value;
  return {speed:g('vpSpeed'),pitch:g('vpPitch'),happy:g('emHappy'),fun:g('emFun'),sad:g('emSad'),angry:g('emAngry')};
}

function buildEmotion(){
  const p=getSliderParams(), parts=[];
  if(p.happy>0) parts.push(`happy=${p.happy}`);
  if(p.fun>0)   parts.push(`fun=${p.fun}`);
  if(p.sad>0)   parts.push(`sad=${p.sad}`);
  if(p.angry>0) parts.push(`angry=${p.angry}`);
  return parts.join(',')||'happy=0';
}

function getNarrator(){
  const sel=document.getElementById('narratorSelect'), inp=document.getElementById('narratorInput');
  return (sel.style.display!=='none'?sel.value:inp.value)||SLOT_DEFAULTS.narrator;
}

function onNarratorChange(){ saveVoiceSettings(); }

// ---- 初期化 ----
async function initVoicePanel(){
  await loadVSFromServer();
  const vs=loadVS();
  activeSlot=vs.activeSlot||0;
  const slots=ensureSlots(vs);
  try{
    const res=await fetch('/api/voice/narrators',{signal:AbortSignal.timeout(3000)});
    const json=await res.json();
    if(json.ok&&json.narrators.length){
      const sel=document.getElementById('narratorSelect');
      sel.innerHTML=json.narrators.map(n=>`<option value="${n}">${friendlyNarrator(n)}</option>`).join('');
      applySlot(slots[activeSlot]);
    } else { fallbackNarratorInput(slots); }
  } catch { fallbackNarratorInput(slots); }
  updateSlotButtons(slots);
}

function fallbackNarratorInput(slots){
  document.getElementById('narratorSelect').style.display='none';
  const inp=document.getElementById('narratorInput'); inp.style.display='';
  applySlot(slots?.[activeSlot]||SLOT_DEFAULTS[activeSlot]);
}

// ---- 録音 / 再生 / 確定 ----
async function checkVoiceStatus(code){
  const dot=document.getElementById('voiceDot'), txt=document.getElementById('voiceStatusText');
  if(!code){ dot.textContent='○'; dot.className='dot-none'; txt.textContent='--'; return; }
  try{
    const json=await(await fetch(`/api/voice/status/${code}`,{signal:AbortSignal.timeout(2000)})).json();
    if(json.exists){ dot.textContent='●'; dot.className='dot-exists'; txt.textContent='MP3あり'; }
    else { dot.textContent='○'; dot.className='dot-none'; txt.textContent='未生成'; }
  } catch { dot.textContent='?'; dot.className='dot-none'; txt.textContent='サーバー未接続'; }
}

let _recordAbort = null;

async function recordVoice(){
  if(selectedIdx<0) return;
  const code=cardData[selectedIdx].id;
  const text = showingReadScript
    ? document.getElementById('editReadScript').value.trim()
    : document.getElementById('editBody').value.trim();
  if(!text){ alert('テキストが空です'); return; }
  const btn=document.getElementById('btnRecord');
  const btnAbort=document.getElementById('btnRecordAbort');
  _recordAbort = new AbortController();
  btn.disabled=true; btn.textContent='⏳ 生成中...';
  if(btnAbort) btnAbort.style.display='';
  try{
    const p=getSliderParams();
    const json=await(await fetch('/api/voice/generate',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({code,text,narrator:getNarrator(),emotion:buildEmotion(),speed:p.speed,pitch:p.pitch}),
      signal:_recordAbort.signal
    })).json();
    if(json.ok){ mp3Ids.add(code); renderList(); showVoiceMsg('✅ '+json.message); checkVoiceStatus(code); }
    else showVoiceMsg('⚠ '+json.error);
  } catch(e){
    if(e.name==='AbortError') showVoiceMsg('🚫 録音を中止しました');
    else showVoiceMsg('⚠ '+e.message);
  } finally{
    btn.disabled=false; btn.textContent='🎙 録音';
    if(btnAbort) btnAbort.style.display='none';
    _recordAbort=null;
  }
}

function abortRecord(){
  if(_recordAbort){ _recordAbort.abort(); }
}

// ============ 設定の比較サンプル ============
// 1つのパラメータを 中心±差分 の3値で生成し、その場で聴き比べる。
const CMP_PARAM_LABEL = { speed:'スピード', pitch:'ピッチ', happy:'喜び', fun:'楽しさ', sad:'悲しみ', angry:'怒り' };
const CMP_PARAM_RANGE = { speed:[50,200], pitch:[0,100], happy:[0,100], fun:[0,100], sad:[0,100], angry:[0,100] };
let _cmpAudio = null;

function openCompare(){
  onCmpParamChange();                       // 中心の初期値を今の設定から拾う
  document.getElementById('cmpResults').style.display='none';
  document.getElementById('cmpResults').innerHTML='';
  document.getElementById('compareModal').style.display='flex';
}
function closeCompare(){
  if(_cmpAudio){ _cmpAudio.pause(); _cmpAudio=null; }
  document.getElementById('compareModal').style.display='none';
}

// 対象パラメータを変えたら、中心の初期値を現在のスライダー値にする
function onCmpParamChange(){
  const param=document.getElementById('cmpParam').value;
  const cur=getSliderParams();
  const map={ speed:cur.speed, pitch:cur.pitch, happy:cur.happy, fun:cur.fun, sad:cur.sad, angry:cur.angry };
  document.getElementById('cmpCenter').value=map[param];
  updateCmpInfo();
}

function updateCmpInfo(){
  const param=document.getElementById('cmpParam').value;
  const [lo,hi]=CMP_PARAM_RANGE[param];
  const center=Math.round(+document.getElementById('cmpCenter').value);
  const delta=Math.round(+document.getElementById('cmpDelta').value);
  const clamp=v=>Math.max(lo,Math.min(hi,v));
  const vals=[clamp(center-delta),clamp(center),clamp(center+delta)];
  const el=document.getElementById('cmpInfo');
  el.innerHTML=`「${CMP_PARAM_LABEL[param]}」を <strong>${vals[0]} / ${vals[1]} / ${vals[2]}</strong> の3つで生成します`+
    (vals[0]===vals[1]||vals[1]===vals[2] ? '<br><span class="exp-warn">⚠ 端に達して同じ値が含まれます（差分を小さく／中心をずらしてください）</span>' : '');
}

async function doCompare(){
  const param=document.getElementById('cmpParam').value;
  const center=Math.round(+document.getElementById('cmpCenter').value);
  const delta=Math.round(+document.getElementById('cmpDelta').value);
  const text=document.getElementById('cmpText').value.trim();
  if(!text){ alert('サンプル文を入れてください'); return; }
  const btn=document.getElementById('btnDoCompare');
  const orig=btn.textContent; btn.disabled=true; btn.textContent='⏳ 生成中…（3件）';
  const results=document.getElementById('cmpResults');
  results.style.display='block';
  results.innerHTML='<div class="cmp-wait">VOICEPEAKで3件生成しています。少しお待ちください…</div>';
  try{
    const body={ text, narrator:getNarrator(), param, center, delta, base:getSliderParams() };
    const json=await(await fetch('/api/voice/compare',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })).json();
    if(!json.ok){ results.innerHTML='<div class="cmp-wait">⚠ '+json.error+'</div>'; return; }
    const t=Date.now();
    const labels=['中心－差分','中心','中心＋差分'];
    results.innerHTML = json.values.map((v,i)=>`
      <div class="cmp-row">
        <span class="cmp-label">${labels[i]}</span>
        <span class="cmp-val">${CMP_PARAM_LABEL[param]} = <b>${v}</b></span>
        <button class="btn-voice" onclick="playCmp(${i})">▶ 再生</button>
        <button class="btn-apply cmp-pick" onclick="pickCmp('${param}',${v})">これに決める</button>
      </div>`).join('') + '<div class="cmp-hint">気に入ったものを「これに決める」→ その値が本体の設定に入ります。差分を小さくしてまた3つ、で追い込めます。</div>';
    results._t=t;
  }catch(e){
    results.innerHTML='<div class="cmp-wait">⚠ '+e.message+'</div>';
  }finally{
    btn.disabled=false; btn.textContent=orig;
  }
}

function playCmp(i){
  if(_cmpAudio){ _cmpAudio.pause(); }
  _cmpAudio=new Audio(`/api/voice/compare-audio/${i}?t=${Date.now()}`);
  _cmpAudio.play().catch(()=>alert('再生できませんでした'));
}

// 選んだ値を本体スライダーに反映（次はここを中心にまた比較できる）
function pickCmp(param, value){
  const rangeId={ speed:'vpSpeed', pitch:'vpPitch', happy:'emHappy', fun:'emFun', sad:'emSad', angry:'emAngry' }[param];
  document.getElementById(rangeId).value=value;
  document.getElementById(rangeId+'N').value=value;
  saveVoiceSettings();
  showVoiceMsg(`✅ ${CMP_PARAM_LABEL[param]} を ${value} に設定しました`);
  document.getElementById('cmpCenter').value=value;   // 次の比較はこの値を中心に
  updateCmpInfo();
}

function fmtTime(s){
  const m=Math.floor(s/60), sec=Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,'0')}`;
}

function _resetSeek(){
  document.getElementById('playSeekRow').style.display='none';
  document.getElementById('playSlider').value=0;
  document.getElementById('playTimeCur').textContent='0:00';
  document.getElementById('btnPlay').textContent='▶ 再生';
}

function togglePlay(){
  if(selectedIdx<0) return;
  // 再生中 → 一時停止
  if(currentAudio && !currentAudio.paused){
    currentAudio.pause();
    document.getElementById('btnPlay').textContent='▶ 再生';
    return;
  }
  // 一時停止中 → 再開
  if(currentAudio && currentAudio.paused){
    currentAudio.play();
    document.getElementById('btnPlay').textContent='⏸ 停止';
    return;
  }
  // 新規再生
  currentAudio=new Audio(`/api/voice/audio/${cardData[selectedIdx].id}`);
  currentAudio.onerror=()=>{ alert('音声ファイルがありません。\nまず「🎙 録音」を実行してください。'); currentAudio=null; _resetSeek(); };
  const slider=document.getElementById('playSlider');
  const cur=document.getElementById('playTimeCur');
  const dur=document.getElementById('playTimeDur');
  const row=document.getElementById('playSeekRow');
  currentAudio.addEventListener('loadedmetadata',()=>{
    slider.max=currentAudio.duration;
    dur.textContent=fmtTime(currentAudio.duration);
    row.style.display='flex';
  });
  currentAudio.addEventListener('timeupdate',()=>{
    if(_seeking) return;
    slider.value=currentAudio.currentTime;
    cur.textContent=fmtTime(currentAudio.currentTime);
  });
  currentAudio.addEventListener('ended',()=>{ currentAudio=null; _resetSeek(); });
  currentAudio.play();
  document.getElementById('btnPlay').textContent='⏸ 停止';
}

function stopVoice(){
  if(currentAudio){ currentAudio.pause(); currentAudio=null; }
  _resetSeek();
}

let _seeking = false;
function seekStart(){ _seeking = true; }
function seekEnd(val){
  _seeking = false;
  if(currentAudio){ currentAudio.currentTime=+val; }
}
function seekVoice(val){
  document.getElementById('playTimeCur').textContent=fmtTime(+val);
}

// ---- 一括録音 ----
let _batchCancel = false;

function recordUnitBatch() {
  if (!curUnit) { alert('ユニットを選択してください'); return; }
  const cards = filteredList.filter(c => (c.body||'').trim());
  if (!cards.length) { alert('本文のあるカードがありません'); return; }
  _renderBatchList(cards);
  document.getElementById('batchModal').style.display = 'flex';
}

function _renderBatchList(cards) {
  const el = document.getElementById('batchList');
  el.innerHTML = cards.map(c => {
    const hasMp3 = mp3Ids.has(c.id);
    const dot = hasMp3
      ? '<span class="bdot bdot-mp3">音</span>'
      : '<span class="bdot bdot-off">音</span>';
    return `<label class="batch-item">
      <input type="checkbox" class="batch-cb" data-id="${c.id}" ${hasMp3?'':'checked'} onchange="_updateBatchCount()">
      <span class="batch-code">${esc(c.id)}</span>
      ${dot}
      <span class="batch-title">${esc(c.title||'')}</span>
    </label>`;
  }).join('');
  _updateBatchCount();
}

function _updateBatchCount() {
  const n = document.querySelectorAll('.batch-cb:checked').length;
  document.getElementById('batchCheckCount').textContent = `${n}枚選択`;
  document.getElementById('btnStartBatch').disabled = n === 0;
}

function batchCheckAll(v) {
  document.querySelectorAll('.batch-cb').forEach(cb => cb.checked = v);
  _updateBatchCount();
}

function batchCheckUngenerated() {
  document.querySelectorAll('.batch-cb').forEach(cb => {
    cb.checked = !mp3Ids.has(cb.dataset.id);
  });
  _updateBatchCount();
}

async function startBatch() {
  const ids = [...document.querySelectorAll('.batch-cb:checked')].map(cb => cb.dataset.id);
  if (!ids.length) return;

  // モーダルを閉じてフローティングバーを表示
  closeBatchModal();
  const floating = document.getElementById('batchFloating');
  const floatCard = document.getElementById('batchFloatCard');
  const floatFill = document.getElementById('batchFloatFill');
  const floatFrac = document.getElementById('batchFloatFrac');
  floating.style.display = 'flex';

  _batchCancel = false;
  let done = 0, failed = 0;
  const total = ids.length;

  for (const id of ids) {
    if (_batchCancel) break;
    floatFrac.textContent = `${done}/${total}`;
    floatFill.style.width = `${Math.round(done / total * 100)}%`;
    const card = cardData.find(c => c.id === id);
    floatCard.textContent = `🎙 ${id}`;
    if (!card) { done++; continue; }
    const text = (readingScripts[id] || card.body || '').trim();
    if (!text) { done++; continue; }
    try {
      const p = getSliderParams();
      const json = await (await fetch('/api/voice/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: id, text, narrator: getNarrator(), emotion: buildEmotion(), speed: p.speed, pitch: p.pitch })
      })).json();
      if (json.ok) mp3Ids.add(id);
      else failed++;
    } catch { failed++; }
    done++;
  }

  renderList();
  floatFill.style.width = '100%';
  floatFrac.textContent = `${done}/${total}`;
  floatCard.textContent = _batchCancel ? '⏹ 中断' : '✅ 完了';
  setTimeout(() => { floating.style.display = 'none'; }, 3000);

  const btn = document.getElementById('btnBatchRecord');
  btn.textContent = '🎙 一括';
  btn.onclick = recordUnitBatch;
}

function closeBatchModal() {
  document.getElementById('batchModal').style.display = 'none';
  // 次回のために選択画面に戻す
  document.getElementById('batchList').style.display = '';
  document.getElementById('batchProgress').style.display = 'none';
  document.querySelector('.batch-toolbar').style.display = '';
  document.getElementById('btnStartBatch').style.display = '';
  document.getElementById('btnBatchCancel').textContent = 'キャンセル';
  document.getElementById('btnBatchCancel').onclick = closeBatchModal;
}

function confirmVoice(){
  if(selectedIdx<0) return;
  document.getElementById('editBody').value=cardData[selectedIdx].body;
  updatePreview(); countChars(); showVoiceMsg('✅ 確定しました（本文を元に戻しました）');
}

function showVoiceMsg(msg){
  document.getElementById('voiceStatusText').textContent=msg;
  clearTimeout(voiceMsgTimer);
  voiceMsgTimer=setTimeout(()=>{ if(selectedIdx>=0) checkVoiceStatus(cardData[selectedIdx].id); },3000);
}

initVoicePanel();
loadReadingScripts();

// 起動
init();

// ==================== 全画面 ====================
document.addEventListener('click', function _autoFS() {
  document.documentElement.requestFullscreen().catch(() => {});
  document.removeEventListener('click', _autoFS);
}, { once: true });

document.addEventListener('fullscreenchange', () => {
  const btn = document.getElementById('btnFullscreen');
  if (btn) btn.textContent = document.fullscreenElement ? '⛶ 全画面解除' : '⛶ 全画面';
});

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

// ==================== メモ ====================
let promptData = [], selectedPromptIdx = -1, _memoSaveTimer = null;
let _memoDrag = null, _memoDragInit = false;

async function loadPrompts() {
  try {
    const res = await fetch('/api/prompts', { signal: AbortSignal.timeout(2000) });
    if (res.ok) promptData = await res.json();
  } catch {}
}

function _initMemoDrag() {
  if (_memoDragInit) return;
  _memoDragInit = true;
  const box = document.querySelector('.memo-modal-box');
  box.querySelector('.modal-head').addEventListener('mousedown', e => {
    if (e.target.tagName === 'BUTTON') return;
    const r = box.getBoundingClientRect();
    box.style.position = 'fixed';
    box.style.left = r.left + 'px';
    box.style.top  = r.top  + 'px';
    box.style.transform = 'none';
    _memoDrag = { sx: e.clientX, sy: e.clientY, ol: r.left, ot: r.top };
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!_memoDrag) return;
    box.style.left = (_memoDrag.ol + e.clientX - _memoDrag.sx) + 'px';
    box.style.top  = (_memoDrag.ot + e.clientY - _memoDrag.sy) + 'px';
  });
  document.addEventListener('mouseup', () => { _memoDrag = null; });
}

function openMemo() {
  document.getElementById('memoModal').style.display = 'flex';
  _initMemoDrag();
  renderMemoList();
  if (promptData.length > 0 && selectedPromptIdx < 0) selectPrompt(0);
}

function closeMemo() {
  document.getElementById('memoModal').style.display = 'none';
}

function renderMemoList() {
  const el = document.getElementById('memoList');
  if (!promptData.length) {
    el.innerHTML = '<div style="padding:14px;font-size:0.75rem;color:var(--text3)">テンプレートがありません</div>';
    return;
  }
  el.innerHTML = promptData.map((p, i) =>
    `<div class="memo-item${i === selectedPromptIdx ? ' active' : ''}" onclick="selectPrompt(${i})">${esc(p.name || '（名前なし）')}</div>`
  ).join('');
}

function selectPrompt(idx) {
  selectedPromptIdx = idx;
  const p = promptData[idx];
  document.getElementById('memoName').value = p.name || '';
  document.getElementById('memoBody').value = p.body || '';
  document.getElementById('memoStatus').textContent = '';
  renderMemoList();
}

function newPrompt() {
  const p = { id: Date.now().toString(), name: '新しいテンプレート', body: '' };
  promptData.push(p);
  selectedPromptIdx = promptData.length - 1;
  renderMemoList();
  document.getElementById('memoName').value = p.name;
  document.getElementById('memoBody').value = '';
  document.getElementById('memoName').focus();
  document.getElementById('memoName').select();
  savePrompts();
}

function deletePrompt() {
  if (selectedPromptIdx < 0 || !promptData.length) return;
  if (!confirm(`「${promptData[selectedPromptIdx].name}」を削除しますか？`)) return;
  promptData.splice(selectedPromptIdx, 1);
  selectedPromptIdx = Math.min(selectedPromptIdx, promptData.length - 1);
  if (promptData.length === 0) {
    selectedPromptIdx = -1;
    document.getElementById('memoName').value = '';
    document.getElementById('memoBody').value = '';
  } else {
    selectPrompt(selectedPromptIdx);
  }
  savePrompts();
}

function onMemoEdit() {
  if (selectedPromptIdx < 0) return;
  promptData[selectedPromptIdx].name = document.getElementById('memoName').value;
  promptData[selectedPromptIdx].body = document.getElementById('memoBody').value;
  renderMemoList();
  document.getElementById('memoStatus').textContent = '● 未保存';
}

function saveAsPrompt() {
  const name = document.getElementById('memoName').value.trim() || '新しいテンプレート';
  const body = document.getElementById('memoBody').value;
  const p = { id: Date.now().toString(), name, body };
  promptData.push(p);
  selectedPromptIdx = promptData.length - 1;
  renderMemoList();
  savePrompts();
}

async function savePrompts() {
  try {
    await fetch('/api/prompts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promptData)
    });
    const s = document.getElementById('memoStatus');
    s.textContent = '✓ 保存済み';
    setTimeout(() => { s.textContent = ''; }, 2000);
  } catch {}
}

async function copyPrompt() {
  const text = document.getElementById('memoBody').value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  const btn = document.querySelector('#memoModal .btn-apply');
  const orig = btn.textContent;
  btn.textContent = '✅ コピー済み';
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ==================== 進捗ボード ====================
let progressTab = '';

// ===== アクセス計測（本番集計をSSHで取得して表示） =====
let accessStats = { daily: {}, cards: {}, loaded: false, error: null };

async function loadAccessStats() {
  const dash = document.getElementById('accessDash');
  if (dash) dash.innerHTML = '<span class="dash-loading">本番のアクセス集計を取得中…</span>';
  try {
    const r = await fetch('/api/access-stats');
    const j = await r.json();
    accessStats = { daily: j.daily || {}, cards: j.cards || {}, loaded: true, error: j.ok ? null : (j.error || '取得失敗') };
  } catch (e) {
    accessStats = { daily: {}, cards: {}, loaded: true, error: e.message };
  }
  renderAccessDash();
  renderProgressBody();   // タイルの閲覧数を反映
}

function renderAccessDash() {
  const dash = document.getElementById('accessDash');
  if (!dash) return;
  const daily = accessStats.daily || {};
  const dates = Object.keys(daily).sort().slice(-7);   // 直近7日
  const sum = (t) => dates.reduce((a, d) => a + ((daily[d] && daily[d][t]) || 0), 0);

  if (!accessStats.loaded) { dash.innerHTML = ''; return; }

  let note = '';
  if (accessStats.error) note = `<span class="dash-err">⚠ 本番未接続（${esc(accessStats.error)}）</span>`;
  else if (!dates.length) note = '<span class="dash-empty">まだ記録がありません（公開後のアクセスから溜まります）</span>';

  // 日付を列にした横並びの表にする
  const head = dates.map(d => `<th>${d.slice(5)}</th>`).join('');
  const row = (label, t) => `<tr><th class="dl">${label}</th>${dates.map(d => `<td>${(daily[d] && daily[d][t]) || 0}</td>`).join('')}</tr>`;

  dash.innerHTML = `
    <div class="dash-head">
      <span class="dash-title">📈 本番アクセス（直近7日）</span>
      <span class="dash-tot">トップ計 ${sum('top_view')}／カード計 ${sum('card_view')}／追加 ${sum('pwa_installed')}</span>
      <button class="dash-refresh" onclick="loadAccessStats()" title="本番から再取得">↻ 更新</button>
    </div>
    ${note || `<table class="dash-table"><tr><th></th>${head}</tr>${row('トップ', 'top_view')}${row('カード', 'card_view')}${row('追加', 'pwa_installed')}</table>`}
  `;
}

function openProgress() {
  loadAccessStats();   // 開くたびに本番から最新を取得（非同期・失敗しても表示は続く）
  // subject一覧を収集（CSV登場順）
  const subjects = [];
  for(const c of cardData){
    if(c.subject && !subjects.includes(c.subject)) subjects.push(c.subject);
  }
  if(!subjects.length) return;

  // タブ描画
  const tabsEl = document.getElementById('progressTabs');
  tabsEl.innerHTML = subjects.map(s =>
    `<button class="progress-tab${s===progressTab?' active':''}" onclick="switchProgressTab('${esc(s)}')">${esc(s)}</button>`
  ).join('');

  if(!progressTab || !subjects.includes(progressTab)) progressTab = subjects[0];
  renderProgressBody();
  document.getElementById('progressModal').style.display = 'flex';
}

function closeProgress() {
  document.getElementById('progressModal').style.display = 'none';
}

function switchProgressTab(subj) {
  progressTab = subj;
  document.querySelectorAll('.progress-tab').forEach(b => {
    b.classList.toggle('active', b.textContent === subj);
  });
  renderProgressBody();
}

function renderProgressBody() {
  const body = document.getElementById('progressBody');

  // 選択subjectのユニット一覧（登場順）
  const units = [];
  for(const c of cardData){
    if(c.subject === progressTab && c.genre && !units.includes(c.genre)) units.push(c.genre);
  }

  let html = '';
  for(const unit of units){
    const cards = cardData.filter(c => c.subject === progressTab && c.genre === unit);
    const total = cards.length;
    const nTtl  = cards.filter(c => c.title && c.title.trim()).length;
    const nBody = cards.filter(c => hasRealBody(c.body)).length;
    const nImg  = cards.filter(c => !!imageMap[c.id]).length;
    const nMp3  = cards.filter(c => mp3Ids.has(c.id)).length;
    const nPub  = cards.filter(c => c.published).length;
    const unitViews = cards.reduce((a, c) => a + (accessStats.cards[c.id] || 0), 0);

    const tiles = cards.map(c => {
      const gIdx = cardData.indexOf(c);
      const hT = !!(c.title && c.title.trim());
      const hB = hasRealBody(c.body);
      const hI = !!imageMap[c.id];
      const hM = mp3Ids.has(c.id);
      const complete = hT && hB && hI && hM;
      const views = accessStats.cards[c.id] || 0;
      const viewTag = views > 0 ? `<span class="ptile-views" title="本番での累計閲覧数">👁${views}</span>` : '';
      return `<div class="ptile${complete?' ptile-complete':''}${c.published?' ptile-pub':''}" onclick="pickProgressCard(${gIdx})" title="${esc(c.title||c.id)}">
        <span class="ptile-code">${esc(c.id)}${viewTag}</span>
        <span class="ptile-dots">
          <span class="sdot ${c.published?'sdot-pub':'sdot-off'}" onclick="togglePub(event,${gIdx})" title="クリックで公開切替">公</span>
          <span class="sdot ${hT?'sdot-title':'sdot-off'}">題</span>
          <span class="sdot ${hB?'sdot-body':'sdot-off'}">文</span>
          <span class="sdot ${hI?'sdot-img':'sdot-off'}">画</span>
          <span class="sdot ${hM?'sdot-mp3':'sdot-off'}">音</span>
        </span>
      </div>`;
    }).join('');

    const allPub = nPub===total && total>0;
    html += `<div class="progress-unit">
      <div class="progress-unit-head">
        <span class="progress-unit-name" onclick="openUnitDetail('${esc(unit).replace(/'/g,"&#39;")}')" style="cursor:pointer;text-decoration:underline dotted">${esc(unit)}</span>
        <span class="progress-unit-stats">
          <span class="pus-pub">公 ${nPub}/${total}</span>
          <span class="pus-ttl">題 ${nTtl}/${total}</span>
          <span class="pus-body">文 ${nBody}/${total}</span>
          <span class="pus-img">画 ${nImg}/${total}</span>
          <span class="pus-mp3">音 ${nMp3}/${total}</span>
          ${unitViews > 0 ? `<span class="pus-views" title="このユニットの本番累計閲覧数">👁 ${unitViews}</span>` : ''}
          <button class="pub-bulk-btn" onclick="bulkPub('${esc(unit).replace(/'/g,"&#39;")}',${allPub?0:1})" title="このユニットをまとめて公開/非公開">${allPub?'全非公開':'全公開'}</button>
        </span>
      </div>
      <div class="progress-tiles">${tiles}</div>
    </div>`;
  }
  body.innerHTML = html;
}

// 進捗ボード：タイルの「公」を個別にトグル（カードは開かない）
function togglePub(ev, gIdx){
  ev.stopPropagation();
  cardData[gIdx].published = !cardData[gIdx].published;
  dirty = true;
  renderProgressBody();
  renderList();
  if(gIdx===selectedIdx) document.getElementById('editPublished').checked = cardData[gIdx].published;
}

// 進捗ボード：ユニット単位で公開を一括ON/OFF
function bulkPub(unit, on){
  const targets = cardData.filter(c => c.subject===progressTab && c.genre===unit);
  if(!targets.length) return;
  const verb = on ? '公開' : '非公開';
  if(!confirm(`「${unit}」の ${targets.length}枚 をまとめて${verb}にします。よろしいですか？`)) return;
  targets.forEach(c => c.published = !!on);
  dirty = true;
  renderProgressBody();
  renderList();
  if(selectedIdx>=0) document.getElementById('editPublished').checked = !!cardData[selectedIdx].published;
  document.getElementById('fileStatus').textContent = `🌐 「${unit}」を${verb}にしました（未保存 — 「CSVを保存」で確定）`;
}

let _udAudio = null;

function openUnitDetail(unit) {
  stopUdAudio();
  closeBodyPopup();
  const listEl = document.getElementById('unitDetailList');
  document.getElementById('unitDetailTitle').textContent = unit;

  const cards = cardData.filter(c => c.subject === progressTab && c.genre === unit);
  listEl.innerHTML = cards.map(c => {
    const gIdx = cardData.indexOf(c);
    const imgSrc = imageMap[c.id];
    const thumbHtml = imgSrc
      ? `<img class="unit-card-thumb" src="${imgSrc}" alt="" onclick="pickProgressCard(${gIdx})">`
      : `<div class="unit-card-thumb-ph" onclick="pickProgressCard(${gIdx})">🗂</div>`;
    const hasMp3 = mp3Ids.has(c.id);
    const hasBody = hasRealBody(c.body);
    const audioBtn = hasMp3
      ? `<button class="btn-ud" id="aud-${c.id}" onclick="playUdAudio('${c.id}')">▶ 音声</button>`
      : '';
    const bodyBtn = hasBody
      ? `<button class="btn-ud" onclick="showBodyPopup(event,'${c.id}')">文 本文</button>`
      : '';
    return `<div class="unit-card-row">
      ${thumbHtml}
      <div class="unit-card-info">
        <span class="unit-card-code">${esc(c.id)}</span>
        <span class="unit-card-title" onclick="pickProgressCard(${gIdx})">${esc(c.title || '（タイトルなし）')}</span>
        <div class="unit-card-btns">${audioBtn}${bodyBtn}</div>
      </div>
    </div>`;
  }).join('');

  // 進捗ボードの右隣に配置
  const modalBox = document.querySelector('.progress-modal-box');
  const r = modalBox.getBoundingClientRect();
  const panel = document.getElementById('unitDetailPanel');
  panel.style.left = (r.right + 12) + 'px';
  panel.style.top  = r.top + 'px';
  panel.style.height = r.height + 'px';
  panel.style.display = 'flex';
}

function closeUnitDetail() {
  stopUdAudio();
  closeBodyPopup();
  document.getElementById('unitDetailPanel').style.display = 'none';
}

function playUdAudio(id) {
  const btn = document.getElementById('aud-' + id);
  if(_udAudio) {
    _udAudio.pause();
    const prevId = _udAudio._id;
    _udAudio = null;
    const prevBtn = document.getElementById('aud-' + prevId);
    if(prevBtn){ prevBtn.textContent='▶ 音声'; prevBtn.classList.remove('playing'); }
    if(prevId === id) return; // 同じボタンなら停止だけ
  }
  const audio = new Audio(`/api/voice/audio/${id}`);
  audio._id = id;
  audio.onerror = () => { if(btn){btn.textContent='▶ 音声';btn.classList.remove('playing');} _udAudio=null; };
  audio.onended = () => { if(btn){btn.textContent='▶ 音声';btn.classList.remove('playing');} _udAudio=null; };
  audio.play();
  _udAudio = audio;
  if(btn){ btn.textContent='■ 停止'; btn.classList.add('playing'); }
}

function stopUdAudio() {
  if(_udAudio){ _udAudio.pause(); _udAudio=null; }
}

function showBodyPopup(e, id) {
  const card = cardData.find(c => c.id === id);
  if(!card) return;
  const popup = document.getElementById('bodyPopup');
  popup.textContent = card.body;
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const top = Math.min(rect.bottom + 6, window.innerHeight - 300);
  const left = Math.max(10, Math.min(rect.left - 180, window.innerWidth - 380));
  popup.style.top = top + 'px';
  popup.style.left = left + 'px';
  popup.style.display = 'block';
  e.stopPropagation();
}

function closeBodyPopup() {
  document.getElementById('bodyPopup').style.display = 'none';
}

// ポップアップ外クリックで閉じる
document.addEventListener('click', e => {
  const popup = document.getElementById('bodyPopup');
  if(popup && popup.style.display !== 'none' && !popup.contains(e.target)) closeBodyPopup();
});

function pickProgressCard(gIdx) {
  closeProgress();
  // ユニットフィルターを合わせてカードを開く
  const card = cardData[gIdx];
  curUnit = card.genre;
  const sel = document.getElementById('unitSelect');
  if(sel) sel.value = card.genre;
  filteredList = cardData.filter(d => d.genre === curUnit);
  document.getElementById('cardCount').textContent = `${filteredList.length}枚`;
  updateUnitNavBtns();
  showCard(gIdx);
}

// ==================== 読み上げ原稿 ====================
async function loadReadingScripts(){
  try{
    const res=await fetch('/api/reading-scripts',{signal:AbortSignal.timeout(2000)});
    if(res.ok) readingScripts=await res.json();
  } catch{}
}

function _updateReadScriptBtn(id){
  const btn=document.getElementById('btnReadScript');
  const hasScript=!!(readingScripts[id]||'').trim();
  btn.classList.toggle('rs-has-script', hasScript);
  btn.title=hasScript?'読み上げ原稿あり':'読み上げ原稿なし';
}

function toggleReadScript(){
  if(!showingReadScript){
    if(selectedIdx<0) return;
    const id=cardData[selectedIdx].id;
    const rsArea=document.getElementById('editReadScript');
    rsArea.value=readingScripts[id]||document.getElementById('editBody').value;
    document.getElementById('editBody').style.display='none';
    rsArea.style.display='';
    document.getElementById('bodyTabLabel').innerHTML='<span class="rs-label">読み上げ原稿</span>';
    document.getElementById('btnReadScript').textContent='← 本文に戻す';
    document.getElementById('btnReadScript').classList.add('rs-active');
    showingReadScript=true;
  } else {
    clearTimeout(_readScriptSaveTimer);
    saveReadingScript();
    _exitReadScriptMode();
  }
}

function _exitReadScriptMode(){
  showingReadScript=false;
  document.getElementById('editReadScript').style.display='none';
  document.getElementById('editBody').style.display='';
  document.getElementById('bodyTabLabel').textContent='本文';
  document.getElementById('btnReadScript').textContent='📝 読み修正';
  document.getElementById('btnReadScript').classList.remove('rs-active');
}

function onReadScriptInput(){
  clearTimeout(_readScriptSaveTimer);
  _readScriptSaveTimer=setTimeout(saveReadingScript, 800);
}

async function saveReadingScript(){
  if(selectedIdx<0) return;
  const id=cardData[selectedIdx].id;
  const text=document.getElementById('editReadScript').value.trim();
  if(text) readingScripts[id]=text; else delete readingScripts[id];
  _updateReadScriptBtn(id);
  try{
    await fetch('/api/reading-scripts',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id, text})
    });
  } catch{}
}
