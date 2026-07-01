'use strict';
// ===== TAKERU 地図ツール フェーズB =====
// 透明レイヤー上に 部隊記号/矢印/矩形/テキスト/★拠点 を配置・編集する。
// 既存（県塗り・背景・境界線・凡例・タイトル・出力サイズ・保存）はフェーズAから継続。

// ---------- 定数 ----------
const SVGNS='http://www.w3.org/2000/svg';
const STAGE_W=960, STAGE_H=720;
const SIZES={ S:[960,720], M:[1440,1080], L:[1920,1440] };
const AUTOSAVE_KEY='takeru_maptool_autosave';
const PALETTE_KEY='takeru_maptool_palette';
const LIBRARY_KEY='takeru_maptool_library';
const SCHEMA_VERSION='2.3';
const PAINT_COLORS=['#4a7fb5','#5a9e5a','#e08a3c','#e3c34a','#d05050','#8a6db0','#9098a0'];
const BG_PRESETS=[{c:'#F5F0E8',n:'クリーム'},{c:'#FFFFFF',n:'白'},{c:'#E8F0F5',n:'淡い水色'},{c:'#ECECEC',n:'薄灰'}];
const DEFAULT_PALETTE=['#E24B4A','#3B8BD4','#2D5A27','#000000'];
const BASE_FILL='#EEEEEE';
const MAX_PALETTE=8;
const TYPE_LABEL={unit:'部隊記号',arrow:'矢印',rect:'矩形',text:'テキスト',star:'拠点',symbol:'補助記号',group:'グループ',polygon:'多角形'};
const TYPE_ICON={unit:'凸',arrow:'➤',rect:'▭',text:'あ',star:'★',symbol:'⚓',group:'□'};

// ---------- 状態 ----------
let tool='select';
let paintColor='#4a7fb5', opacity=0.8, borderMode='normal';
let fills={}, legend=[], legendPos='bl', outputSize='S';
let layerElements=[];          // 配列順=z順（後ろほど前面）
let backgrounds=[];            // 下絵（地図の下）。配列末尾ほど前面
let mapVisible=true;           // 地図SVGの表示
let selectedIds=[];
let drag=null, arrowDraft=null, inlineEl=null;
let uidCounter=0, nameCounter={};
let restoring=false, autosaveTimer=null;
let userPalette=[], library=[], nudgeTimer=null;
let zoom=1.0, activeSymbolType='ship';
// アンドゥ/リドゥ（最大3段階）
let undoStack=[], redoStack=[], txBefore=null;
const HIST_MAX=3;
// 地図マルチ対応
let currentMapId='japan';
let mapFillsAll={};            // { mapId: { regionId: color } }
let mapPanZoom={ tx:0, ty:0, scale:1 };
let mapPanDrag=null;

// ---------- ショートカット ----------
const $=id=>document.getElementById(id);
function svg(tag,attrs){ const e=document.createElementNS(SVGNS,tag); if(attrs) for(const k in attrs) e.setAttribute(k,attrs[k]); return e; }
const ax=r=>r*STAGE_W, ay=r=>r*STAGE_H, rx=x=>x/STAGE_W, ry=y=>y/STAGE_H;
function pad2(n){return String(n).padStart(2,'0');}
function pad3(n){return String(n).padStart(3,'0');}
function uid(){ return 'el_'+pad3(++uidCounter); }
function autoName(type){ nameCounter[type]=(nameCounter[type]||0)+1; return (TYPE_LABEL[type]||type)+' '+nameCounter[type]; }
function getEl(id){ return layerElements.find(e=>e.id===id); }
function contrast(hex){ try{const c=hex.replace('#','');const r=parseInt(c.substr(0,2),16),g=parseInt(c.substr(2,2),16),b=parseInt(c.substr(4,2),16);return (0.299*r+0.587*g+0.114*b)>150?'#000000':'#ffffff';}catch(e){return '#000000';} }
function nowISO(){ const d=new Date(),o=-d.getTimezoneOffset(),s=o>=0?'+':'-';return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}${s}${pad2(Math.abs(o)/60|0)}:${pad2(Math.abs(o)%60)}`; }
function stamp(){ const d=new Date();return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; }
function setActive(sel,attr,val){ document.querySelectorAll(sel+' [data-'+attr+']').forEach(b=>b.classList.toggle('active',b.getAttribute('data-'+attr)===val)); }

const stage=$('stage'), mapSvg=$('mapSvg');
function clientToStage(ev){ const pt=stage.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY; return pt.matrixTransform(stage.getScreenCTM().inverse()); }
function stageToClient(x,y){ const m=stage.getScreenCTM(); return {x:m.a*x+m.c*y+m.e, y:m.b*x+m.d*y+m.f}; }

// ================= 初期化 =================
function init(){
  applyZoom();
  // 背景プリセット
  BG_PRESETS.forEach((p,i)=>{ const d=document.createElement('div'); d.className='sw'+(i===0?' active':''); d.style.background=p.c; d.title=p.n;
    d.onclick=()=>{ setBg(p.c); document.querySelectorAll('#bgPresets .sw').forEach(s=>s.classList.remove('active')); d.classList.add('active'); $('bgPicker').value=p.c; };
    $('bgPresets').appendChild(d); });
  // 塗りパレット
  PAINT_COLORS.forEach((c,i)=>{ const d=document.createElement('div'); d.className='sw'+(i===0?' active':''); d.style.background=c; d.dataset.c=c;
    d.onclick=()=>{ pickPaint(c); $('paintPicker').value=c; }; $('paintSwatches').appendChild(d); });
  // mapSvg: 右クリックドラッグでパン、スクロールでズーム
  mapSvg.addEventListener('contextmenu',e=>e.preventDefault());
  mapSvg.addEventListener('mousedown',onMapMouseDown);
  mapSvg.addEventListener('wheel',onMapWheel,{passive:false});
  window.addEventListener('mousemove',onMapMouseMove);
  window.addEventListener('mouseup',e=>{ if(e.button===2) mapPanDrag=null; });
  // ステージ操作
  stage.addEventListener('pointerdown',onStageDown);
  stage.addEventListener('pointermove',onStageMove);
  window.addEventListener('pointerup',onUp);
  stage.addEventListener('dblclick',onDblClick);
  document.addEventListener('keydown',onKey);
  // インライン編集
  $('inlineEdit').addEventListener('blur',commitInline);
  $('inlineEdit').addEventListener('keydown',e=>{ if(e.key==='Escape'){ e.preventDefault(); $('inlineEdit').blur(); } });
  // プロパティ入力欄：フォーカス開始〜離脱を1件のアンドゥ単位にする
  $('propPanel').addEventListener('focusin',()=>txBegin());
  $('propPanel').addEventListener('focusout',()=>txCommit());

  // 復元 or 新規
  let saved=null; try{ saved=localStorage.getItem(AUTOSAVE_KEY); }catch(e){}
  if(saved){ let s=null; try{ s=JSON.parse(saved); }catch(e){ s=null; }
    if(s && (s.version==='2.0'||s.version==='2.1'||s.version==='2.2'||s.version==='2.3'||s.version==='1.0')){
      const when=(s.savedAt||'').replace('T',' ').slice(0,19);
      if(confirm('前回の作業を復元しますか？\n（保存日時：'+when+'）\n\n［OK］復元する　／　［キャンセル］新規に始める')){ applyState(s); return; }
    }
    try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(e){}
  }
  initPalette(); initLibrary();
  freshStart();
}

// ================= ツール切替 =================
const HINTS={ select:'選択ツール：要素をクリックで選択・ドラッグで移動（Shiftで複数選択／Deleteで削除）',
  paint:'地域塗り：色を選んで地域をクリック（同色再クリックで消去）　右ドラッグ：地図を移動　スクロール：拡縮', unit:'部隊記号：地図をクリックで配置',
  arrow:'矢印：ドラッグで直線／クリックで点追加→ダブルクリック(Enter)で確定', rect:'矩形：ドラッグで描画',
  text:'テキスト：クリックで配置（ダブルクリックで編集）', star:'拠点★：クリックで配置',
  symbol:'補助記号：地図をクリックで配置（艦隊・航空・基地・都市・戦闘）' };
function setTool(t){
  if(tool==='arrow' && t!=='arrow') cancelArrowDraft();
  tool=t; setActive('#toolBtns','t',t);
  $('modeHint').textContent=HINTS[t]||'';
  stage.style.cursor = (t==='select')?'default':'crosshair';
  const ss=$('symbolTypeSec'); if(ss) ss.style.display=t==='symbol'?'block':'none';
}

// ================= 地域塗り・背景・境界線 =================
function setBg(c){ $('bg').setAttribute('fill',c); autosave(); }
function pickPaint(c){ paintColor=c; document.querySelectorAll('#paintSwatches .sw').forEach(s=>s.classList.toggle('active',s.dataset.c===c)); }
function setOpacity(v){ opacity=v/100; $('opacityVal').textContent=v+'%'; applyFills(); autosave(); }
function setBorder(level){ borderMode=level; applyFills(); setActive('#borderBtns','b',level); autosave(); }
function getRegionId(el){ return el.dataset.code || el.id || ''; }
function onRegionClick(el){ pushUndo(); const rid=getRegionId(el); if(!rid) return; if(fills[rid]===paintColor) delete fills[rid]; else fills[rid]=paintColor; applyFills(); autosave(); }
function applyFills(){
  mapSvg.querySelectorAll('.prefecture,.region').forEach(g=>{
    const rid=getRegionId(g); const painted=rid?fills[rid]:null; const fcol=painted||BASE_FILL; const fop=painted?opacity:1;
    g.setAttribute('fill',fcol); g.setAttribute('fill-opacity',fop);
    if(borderMode==='none'){ g.setAttribute('stroke',fcol); g.setAttribute('stroke-opacity',fop); g.setAttribute('stroke-width','1.2'); }
    else { g.setAttribute('stroke',borderMode==='light'?'#9aa0a6':'#000000'); g.setAttribute('stroke-opacity','1'); g.setAttribute('stroke-width','1.0'); } });
}

// ================= 地図ロード / パン・ズーム =================
function switchMap(mapId){
  // 現在の fills を保存
  mapFillsAll[currentMapId]={...fills};
  loadMap(mapId);
}
function loadMap(mapId){
  const data=window.MAPS&&window.MAPS[mapId];
  if(!data){ showToast('地図データがありません: maps/'+mapId+'.js'); return; }
  currentMapId=mapId;
  fills={...(mapFillsAll[mapId]||{})};
  mapSvg.setAttribute('viewBox',data.viewBox||'0 0 1000 1000');
  mapSvg.innerHTML=`<g id="mapTransformGroup" transform="translate(0,0) scale(1)">${data.svg}</g>`;
  // クリックイベントをバインド
  mapSvg.querySelectorAll('.prefecture,.region').forEach(el=>{
    el.addEventListener('click',ev=>{ if(tool==='paint'){ ev.stopPropagation(); onRegionClick(el); } }); });
  resetMapView();
  applyFills();
  setActive('#mapBtns','m',mapId);
  autosave();
}
function onCustomSvg(ev){
  const file=ev.target.files[0]; ev.target.value=''; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    const parser=new DOMParser();
    const doc=parser.parseFromString(r.result,'image/svg+xml');
    const svgEl=doc.querySelector('svg');
    if(!svgEl){ showToast('有効なSVGではありません'); return; }
    const viewBox=svgEl.getAttribute('viewBox')||'0 0 1000 1000';
    const inner=svgEl.innerHTML;
    const mapId='custom_'+file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_]/g,'_');
    window.MAPS=window.MAPS||{};
    window.MAPS[mapId]={ name:file.name, viewBox, svg:inner };
    // ボタン追加
    let btn=document.querySelector('#mapBtns [data-m="'+mapId+'"]');
    if(!btn){ btn=document.createElement('button'); btn.className='mode-btn'; btn.dataset.m=mapId;
      btn.style.cssText='font-size:0.72rem;padding:5px 4px'; btn.textContent='📁 '+file.name.replace(/\.svg$/i,'');
      btn.onclick=()=>switchMap(mapId); $('mapBtns').appendChild(btn); }
    switchMap(mapId);
    showToast('カスタムSVGを読み込みました: '+file.name);
  };
  r.readAsText(file);
}
function resetMapView(){ mapPanZoom={tx:0,ty:0,scale:1}; applyMapTransform(); }
function applyMapTransform(){
  const g=mapSvg.querySelector('#mapTransformGroup'); if(!g) return;
  const {tx,ty,scale}=mapPanZoom;
  g.setAttribute('transform',`translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${scale.toFixed(4)})`);
  const lbl=$('mapZoomLabel'); if(lbl) lbl.textContent=Math.round(scale*100)+'%';
}
function onMapMouseDown(e){
  if(e.button!==2) return;
  e.preventDefault(); e.stopPropagation();
  const pt=mapSvg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
  const ctm=mapSvg.getScreenCTM().inverse();
  const vb=pt.matrixTransform(ctm);
  mapPanDrag={ctm, startVb:vb, startTx:mapPanZoom.tx, startTy:mapPanZoom.ty};
}
function onMapMouseMove(e){
  if(!mapPanDrag) return;
  const pt=mapSvg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
  const vb=pt.matrixTransform(mapPanDrag.ctm);
  mapPanZoom.tx=mapPanDrag.startTx+(vb.x-mapPanDrag.startVb.x);
  mapPanZoom.ty=mapPanDrag.startTy+(vb.y-mapPanDrag.startVb.y);
  applyMapTransform();
}
function onMapWheel(e){
  e.preventDefault();
  const f=e.deltaY<0?1.15:0.87;
  const newScale=Math.max(0.15,Math.min(12,mapPanZoom.scale*f));
  const ratio=newScale/mapPanZoom.scale;
  const pt=mapSvg.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
  const vb=pt.matrixTransform(mapSvg.getScreenCTM().inverse());
  mapPanZoom.tx=vb.x-(vb.x-mapPanZoom.tx)*ratio;
  mapPanZoom.ty=vb.y-(vb.y-mapPanZoom.ty)*ratio;
  mapPanZoom.scale=newScale;
  applyMapTransform();
}

// ================= 凡例（フェーズA継続）=================
function addLegend(){ legend.push({color:PAINT_COLORS[legend.length%PAINT_COLORS.length],text:''}); renderLegendList(); renderLegend(); autosave(); }
function renderLegendList(){ const el=$('legendList'); el.innerHTML='';
  legend.forEach((lg,i)=>{ const row=document.createElement('div'); row.className='list-item';
    const sw=document.createElement('input'); sw.type='color'; sw.value=lg.color; sw.className='mini-sw'; sw.oninput=()=>{ lg.color=sw.value; renderLegend(); autosave(); };
    const tx=document.createElement('input'); tx.type='text'; tx.value=lg.text; tx.placeholder='名前'; tx.oninput=()=>{ lg.text=tx.value; renderLegend(); autosave(); };
    const del=document.createElement('button'); del.className='del'; del.textContent='✕'; del.onclick=()=>{ legend.splice(i,1); renderLegendList(); renderLegend(); autosave(); };
    row.append(sw,tx,del); el.appendChild(row); }); }
function setLegendPos(p){ legendPos=p; setActive('#legendPos','p',p); renderLegend(); autosave(); }
function renderLegend(){ const layer=$('legendLayer'); layer.innerHTML=''; if(legendPos==='none'||!legend.length) return;
  const rowH=26,padX=12,padY=10,swSize=18; let maxChars=0; legend.forEach(l=>maxChars=Math.max(maxChars,(l.text||'').length));
  const boxW=padX*2+swSize+8+Math.max(60,maxChars*16), boxH=padY*2+legend.length*rowH; let bx,by; const M=14;
  if(legendPos==='tl'){bx=M;by=62;}else if(legendPos==='tr'){bx=960-boxW-M;by=62;}else if(legendPos==='bl'){bx=M;by=720-boxH-M;}
  else if(legendPos==='br'){bx=960-boxW-M;by=720-boxH-M;}else if(legendPos==='center'){bx=(960-boxW)/2;by=(720-boxH)/2;}
  const g=svg('g',{transform:`translate(${bx},${by})`});
  g.appendChild(svg('rect',{width:boxW,height:boxH,rx:6,fill:'#ffffff','fill-opacity':0.88,stroke:'#888','stroke-width':1}));
  legend.forEach((l,i)=>{ const y=padY+i*rowH; g.appendChild(svg('rect',{x:padX,y,width:swSize,height:swSize,rx:3,fill:l.color,stroke:'#555','stroke-width':0.5}));
    const t=svg('text',{x:padX+swSize+8,y:y+swSize-3,'font-family':"'Noto Sans JP','Yu Gothic',sans-serif",'font-size':17,fill:'#222'}); t.textContent=l.text||'（名前を入力）'; g.appendChild(t); });
  layer.appendChild(g); }

// ================= タイトル・出力サイズ（フェーズA継続）=================
function updateTitle(){ $('title').textContent=$('titleInput').value; autosave(); }
function setOutputSize(s,silent){ if(!SIZES[s])return; outputSize=s; setActive('#sizeBtns','s',s); $('fnSuffix').textContent='_'+s+'.png'; if(!silent) autosave(); }

// ================= 要素モデル =================
function defaultLabel(pos){ return {text:'',position:pos||'bottom',offsetX:0,offsetY:0,fontSize:13,color:'#000000',bold:false}; }
function createDefault(type,x,y){
  const base={id:uid(),type,name:autoName(type),hidden:false,x,y};
  if(type==='unit') return Object.assign(base,{width:0.05,height:0.055,rotation:0,fillColor:'#3B8BD4',opacity:1,infantry:true,infantryType:'armor',label:defaultLabel('bottom')});
  if(type==='rect') return Object.assign(base,{width:0.14,height:0.10,fillColor:$('bg').getAttribute('fill')||'#F5F0E8',fillOpacity:1,borderEnabled:false,borderColor:'#000000',borderWidth:1,borderStyle:'solid'});
  if(type==='text') return Object.assign(base,{text:'テキスト',fontSize:16,color:'#000000',bold:false,bgEnabled:false,bgColor:'#FFFFFF',bgOpacity:0.8});
  if(type==='star') return Object.assign(base,{size:16,color:'#D32F2F',label:defaultLabel('right')});
  if(type==='symbol') return Object.assign(base,{symbolType:activeSymbolType,size:24,rotation:0,color:'#3B8BD4',opacity:1,label:defaultLabel('bottom')});
  return base;
}
function addElement(el){ pushUndo(); layerElements.push(el); renderAll(); autosave(); }
function deleteSelected(){ if(!selectedIds.length)return; pushUndo();
  const toDelete=new Set(selectedIds);
  selectedIds.forEach(id=>{ const el=getEl(id); if(el&&el.type==='group') (el.children||[]).forEach(cid=>toDelete.add(cid)); });
  layerElements=layerElements.filter(e=>!toDelete.has(e.id)); backgrounds=backgrounds.filter(b=>!toDelete.has(b.id)); selectedIds=[]; renderAll(); autosave(); }
function selectOnly(id){ selectedIds=[id]; renderAll(); }
function selectEl(id,additive){ if(additive){ const i=selectedIds.indexOf(id); if(i>=0) selectedIds.splice(i,1); else selectedIds.push(id); } else if(!selectedIds.includes(id)){ selectedIds=[id]; } renderSelection(); renderLayerList(); renderProps(); }
// z順
function bringForward(){ pushUndo(); selectedIds.forEach(id=>{ const i=layerElements.findIndex(e=>e.id===id); if(i>=0&&i<layerElements.length-1){ const [e]=layerElements.splice(i,1); layerElements.splice(i+1,0,e);} }); renderAll(); autosave(); }
function sendBackward(){ pushUndo(); selectedIds.slice().reverse().forEach(id=>{ const i=layerElements.findIndex(e=>e.id===id); if(i>0){ const [e]=layerElements.splice(i,1); layerElements.splice(i-1,0,e);} }); renderAll(); autosave(); }

// ================= レンダリング =================
function renderAll(){ renderBackgrounds(); renderLayer(); renderSelection(); renderLayerList(); renderProps(); }
function reRender(){ renderBackgrounds(); renderLayer(); renderSelection(); }   // ドラッグ中の軽量再描画
function renderLayer(){
  const layer=$('layerEls'); layer.innerHTML='';
  const groupChildIds=new Set(layerElements.filter(e=>e.type==='group').flatMap(e=>e.children||[]));
  layerElements.forEach(el=>{ if(el.hidden) return;
    if(el.type==='group'){
      (el.children||[]).forEach(cid=>{ const c=getEl(cid); if(!c||c.hidden) return; let cn=null;
        if(c.type==='unit') cn=buildUnit(c); else if(c.type==='arrow') cn=buildArrow(c);
        else if(c.type==='rect') cn=buildRect(c); else if(c.type==='text') cn=buildText(c);
        else if(c.type==='star') cn=buildStar(c); else if(c.type==='symbol') cn=buildSymbol(c);
        if(cn){ layer.appendChild(cn); if(c.type==='text') sizeTextBg(cn,c); }
      }); return;
    }
    if(groupChildIds.has(el.id)) return;
    let node=null;
    if(el.type==='unit') node=buildUnit(el); else if(el.type==='arrow') node=buildArrow(el);
    else if(el.type==='rect') node=buildRect(el); else if(el.type==='text') node=buildText(el);
    else if(el.type==='star') node=buildStar(el); else if(el.type==='symbol') node=buildSymbol(el);
    if(node){ layer.appendChild(node); if(el.type==='text') sizeTextBg(node,el); } });
  if(arrowDraft) renderArrowDraft();
}

// --- テキスト多行 ---
function mtext(lines,x,y,opt){ const t=svg('text',{x,y,'text-anchor':opt.anchor||'middle','dominant-baseline':opt.baseline||'auto',
    'font-family':"'Noto Sans JP','Yu Gothic',sans-serif",'font-size':opt.size,'font-weight':opt.bold?'700':'400',fill:opt.color});
  if(opt.halo){ t.setAttribute('stroke','#ffffff'); t.setAttribute('stroke-width',Math.max(2,opt.size*0.18)); t.setAttribute('paint-order','stroke'); t.setAttribute('stroke-linejoin','round'); }
  lines.forEach((ln,i)=>{ const ts=svg('tspan',{x,dy:i===0?0:opt.size*1.25}); ts.textContent=ln; t.appendChild(ts); }); return t; }
function labelLines(s){ return String(s||'').split('\n').slice(0,3); }

// --- 凸型部隊記号 ---
function unitPath(W,H){ const bw=W/2, protH=H*0.22, top=-H/2, bodyTop=-H/2+protH, bot=H/2, pw=W/3/2;
  return `M${-bw},${bodyTop} L${-pw},${bodyTop} L${-pw},${top} L${pw},${top} L${pw},${bodyTop} L${bw},${bodyTop} L${bw},${bot} L${-bw},${bot} Z`; }
function branchSymbol(type,W,H,col){ const cy=H*0.11; const bw=W, bh=H*0.78; const g=svg('g',{}); const s={fill:'none',stroke:col,'stroke-width':Math.max(1.4,W*0.04),'stroke-linecap':'round','stroke-linejoin':'round'};
  if(type==='armor'){ const e=svg('ellipse',{cx:0,cy,rx:bw*0.30,ry:bh*0.22}); Object.entries(s).forEach(([k,v])=>e.setAttribute(k,v)); g.appendChild(e); }
  else if(type==='artillery'){ const r=svg('line',{x1:0,y1:cy-bh*0.26,x2:0,y2:cy+bh*0.26}); Object.entries(s).forEach(([k,v])=>r.setAttribute(k,v)); r.setAttribute('stroke-width',Math.max(2,W*0.10)); g.appendChild(r); }
  else if(type==='cavalry'){ const l=svg('line',{x1:-bw*0.28,y1:cy+bh*0.24,x2:bw*0.28,y2:cy-bh*0.24}); Object.entries(s).forEach(([k,v])=>l.setAttribute(k,v)); g.appendChild(l); }
  else if(type==='engineer'){ const p=svg('polyline',{points:`${-bw*0.26},${cy+bh*0.20} 0,${cy-bh*0.22} ${bw*0.26},${cy+bh*0.20}`}); Object.entries(s).forEach(([k,v])=>p.setAttribute(k,v)); g.appendChild(p); }
  else if(type==='airborne'){ const r=bw*0.28; const p=svg('path',{d:`M${-r},${cy+r*0.5} A${r},${r} 0 0 1 ${r},${cy+r*0.5}`}); Object.entries(s).forEach(([k,v])=>p.setAttribute(k,v)); g.appendChild(p); }
  return g; }
function buildUnit(el){ const g=svg('g',{class:'el-g movable','data-id':el.id});
  const cx=ax(el.x),cy=ay(el.y),W=ax(el.width),H=ay(el.height);
  const inner=svg('g',{transform:`translate(${cx},${cy}) rotate(${el.rotation||0})`});
  const p=svg('path',{d:unitPath(W,H),fill:el.fillColor,'fill-opacity':el.opacity==null?1:el.opacity,stroke:'#222','stroke-width':1.2,'stroke-linejoin':'round'}); inner.appendChild(p);
  if(!el.infantry) inner.appendChild(branchSymbol(el.infantryType,W,H,contrast(el.fillColor)));
  g.appendChild(inner);
  if(el.label && el.label.text) g.appendChild(buildLabel(el,W/2,H/2));
  return g; }

// --- ラベル（常に水平）---
function labelAnchorPos(el,halfW,halfH){ const cx=ax(el.x),cy=ay(el.y),L=el.label,gap=6; let x=cx,y=cy,anchor='middle';
  if(L.position==='top'){ y=cy-halfH-gap; anchor='middle'; } else if(L.position==='bottom'){ y=cy+halfH+gap+L.fontSize; anchor='middle'; }
  else if(L.position==='left'){ x=cx-halfW-gap; y=cy+L.fontSize*0.35; anchor='end'; } else if(L.position==='right'){ x=cx+halfW+gap; y=cy+L.fontSize*0.35; anchor='start'; }
  x+=ax(L.offsetX||0); y+=ay(L.offsetY||0); return {x,y,anchor}; }
function buildLabel(el,halfW,halfH){ const L=el.label; const pos=labelAnchorPos(el,halfW,halfH);
  const t=mtext(labelLines(L.text),pos.x,pos.y,{size:L.fontSize,color:L.color,bold:L.bold,anchor:pos.anchor,halo:true});
  t.setAttribute('class','lbl-text'); t.setAttribute('data-id',el.id); t.setAttribute('data-label','1'); return t; }

// --- 矢印 ---
function catmullRom(pts){ if(pts.length<3) return 'M'+pts.map(p=>p.x+','+p.y).join(' L');
  let d='M'+pts[0].x+','+pts[0].y; for(let i=0;i<pts.length-1;i++){ const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
    const c1x=p1.x+(p2.x-p0.x)/6,c1y=p1.y+(p2.y-p0.y)/6,c2x=p2.x-(p3.x-p1.x)/6,c2y=p2.y-(p3.y-p1.y)/6; d+=` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`; } return d; }
function dashArray(style,w){ if(style==='dashed') return `${w*3},${w*2}`; if(style==='dotted') return `${Math.max(0.1,w*0.1)},${w*2}`; return ''; }
function arrowHeadNode(tip,from,kind,w,color){ if(kind==='none')return null; const dx=tip.x-from.x,dy=tip.y-from.y,len=Math.hypot(dx,dy)||1; const ux=dx/len,uy=dy/len; const px=-uy,py=ux; const s=Math.max(8,w*3.2);
  const bx=tip.x-ux*s, by=tip.y-uy*s; const l={x:bx+px*s*0.55,y:by+py*s*0.55}, r={x:bx-px*s*0.55,y:by-py*s*0.55};
  if(kind==='open'){ const g=svg('g',{}); [l,r].forEach(pt=>{ const ln=svg('line',{x1:tip.x,y1:tip.y,x2:pt.x,y2:pt.y,stroke:color,'stroke-width':w,'stroke-linecap':'round'}); g.appendChild(ln); }); return g; }
  return svg('path',{d:`M${tip.x},${tip.y} L${l.x},${l.y} L${r.x},${r.y} Z`,fill:color}); }
function buildArrow(el){ const g=svg('g',{class:'el-g movable','data-id':el.id}); const pts=el.points.map(p=>({x:ax(p.x),y:ay(p.y)})); if(pts.length<2) return g;
  const d=el.curved?catmullRom(pts):('M'+pts.map(p=>p.x+','+p.y).join(' L')); const op=el.opacity==null?1:el.opacity;
  // 当たり判定用の太い透明線
  g.appendChild(svg('path',{d,fill:'none',stroke:'#000','stroke-opacity':0,'stroke-width':Math.max(el.lineWidth,12),'data-id':el.id}));
  const line=svg('path',{d,fill:'none',stroke:el.color,'stroke-width':el.lineWidth,'stroke-linecap':'round','stroke-linejoin':'round','stroke-opacity':op}); const da=dashArray(el.lineStyle,el.lineWidth); if(da) line.setAttribute('stroke-dasharray',da); g.appendChild(line);
  const head=arrowHeadNode(pts[pts.length-1],pts[pts.length-2],el.arrowHead,el.lineWidth,el.color); if(head){ head.setAttribute('opacity',op); g.appendChild(head); }
  if(el.arrowPosition==='both'){ const h2=arrowHeadNode(pts[0],pts[1],el.arrowHead,el.lineWidth,el.color); if(h2){ h2.setAttribute('opacity',op); g.appendChild(h2);} }
  return g; }

// --- 矩形 ---
function buildRect(el){ const r=svg('rect',{class:'el-g movable','data-id':el.id,x:ax(el.x),y:ay(el.y),width:ax(el.width),height:ay(el.height),fill:el.fillColor,'fill-opacity':el.fillOpacity==null?1:el.fillOpacity});
  if(el.borderEnabled){ r.setAttribute('stroke',el.borderColor); r.setAttribute('stroke-width',el.borderWidth); const da=dashArray(el.borderStyle,el.borderWidth); if(da) r.setAttribute('stroke-dasharray',da); } else r.setAttribute('stroke','none'); return r; }

// --- テキスト ---
function buildText(el){ const g=svg('g',{class:'el-g movable','data-id':el.id});
  if(el.bgEnabled) g.appendChild(svg('rect',{class:'txtbg',fill:el.bgColor,'fill-opacity':el.bgOpacity==null?0.8:el.bgOpacity,rx:3}));
  const t=mtext(labelLines(el.text),ax(el.x),ay(el.y)+el.fontSize,{size:el.fontSize,color:el.color,bold:el.bold,anchor:'start',halo:!el.bgEnabled}); t.setAttribute('data-id',el.id); g.appendChild(t); return g; }
function sizeTextBg(g,el){ if(!el.bgEnabled) return; const t=g.querySelector('text'), bg=g.querySelector('.txtbg'); if(!t||!bg) return; const b=t.getBBox(); const pad=4;
  bg.setAttribute('x',b.x-pad); bg.setAttribute('y',b.y-pad); bg.setAttribute('width',b.width+pad*2); bg.setAttribute('height',b.height+pad*2); }

// --- ★拠点 ---
function starPoints(cx,cy,r){ let p=[]; const inner=r*0.42; for(let i=0;i<10;i++){ const a=-Math.PI/2+i*Math.PI/5,rad=(i%2===0)?r:inner; p.push((cx+rad*Math.cos(a)).toFixed(1)+','+(cy+rad*Math.sin(a)).toFixed(1)); } return p.join(' '); }
function buildStar(el){ const g=svg('g',{class:'el-g movable','data-id':el.id}); const cx=ax(el.x),cy=ay(el.y);
  g.appendChild(svg('polygon',{points:starPoints(cx,cy,el.size),fill:el.color,stroke:'#333','stroke-width':1,'data-id':el.id}));
  if(el.label && el.label.text) g.appendChild(buildLabel(el,el.size,el.size)); return g; }

// ================= 選択オーバーレイ（ハンドル）=================
function elBBox(el){ // 概算AABB（選択枠・移動用）
  if(el.type==='image'){ return {x:ax(el.x),y:ay(el.y),w:ax(el.width),h:ay(el.height)}; }
  if(el.type==='unit'||el.type==='rect'){ const W=ax(el.width),H=ay(el.height); return {x:ax(el.x)-(el.type==='unit'?W/2:0),y:ay(el.y)-(el.type==='unit'?H/2:0),w:W,h:H}; }
  if(el.type==='star'){ const s=el.size; return {x:ax(el.x)-s,y:ay(el.y)-s,w:s*2,h:s*2}; }
  if(el.type==='symbol'){ const s=el.size||24,hw=el.symbolType==='ship'?s*0.75:s/2; return {x:ax(el.x)-hw,y:ay(el.y)-s/2,w:hw*2,h:s}; }
  if(el.type==='group'){ return groupBBox(el); }
  if(el.type==='text'){ const node=$('layerEls').querySelector('[data-id="'+el.id+'"] text'); if(node){ const b=node.getBBox(); return {x:b.x,y:b.y,w:b.width,h:b.height}; } return {x:ax(el.x),y:ay(el.y),w:60,h:el.fontSize}; }
  if(el.type==='arrow'){ const xs=el.points.map(p=>ax(p.x)),ys=el.points.map(p=>ay(p.y)); const minx=Math.min(...xs),miny=Math.min(...ys); return {x:minx,y:miny,w:Math.max(...xs)-minx,h:Math.max(...ys)-miny}; }
  return {x:ax(el.x),y:ay(el.y),w:10,h:10}; }
function mkHandle(x,y,cls,onDown){ const h=svg('rect',{x:x-5,y:y-5,width:10,height:10,rx:2,fill:'#fff',stroke:'#4caf50','stroke-width':1.5,class:cls}); h.addEventListener('pointerdown',e=>{ e.stopPropagation(); onDown(e); }); return h; }
function mkCircle(x,y,cls,onDown,fill){ const h=svg('circle',{cx:x,cy:y,r:6,fill:fill||'#fff',stroke:'#4caf50','stroke-width':1.5,class:cls}); h.addEventListener('pointerdown',e=>{ e.stopPropagation(); onDown(e); }); return h; }
function startMoveItem(e,item){ const p=clientToStage(e); if(!selectedIds.includes(item.id)) selectedIds=[item.id]; txBegin();
  drag={mode:'move',sx:p.x,sy:p.y,orig:selectedIds.map(i=>({el:findItem(i),snap:snap(findItem(i))})).filter(o=>o.el)}; renderSelection(); renderProps(); }
function renderSelection(){ const ov=$('selOverlay'); ov.innerHTML=''; if(tool!=='select'){ return; }
  selectedIds.forEach(id=>{ const el=findItem(id); if(!el||el.hidden) return;
    if(el.type==='image'){ if(el.visible===false) return; const b=elBBox(el);
      const mv=svg('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:'#4caf50','fill-opacity':0.06,stroke:'#4caf50','stroke-width':1.5,'stroke-dasharray':'6,4'}); mv.style.cursor='move';
      mv.addEventListener('pointerdown',e=>{ e.stopPropagation(); startMoveItem(e,el); }); ov.appendChild(mv);
      [[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].forEach((c,i)=>ov.appendChild(mkHandle(c[0],c[1],'handle',e=>startResizeRect(e,el,i)))); return; }
    if(el.type==='unit'){ const cx=ax(el.x),cy=ay(el.y),W=ax(el.width),H=ay(el.height),rot=(el.rotation||0)*Math.PI/180;
      const corners=[[-W/2,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]].map(([lx,ly])=>({x:cx+lx*Math.cos(rot)-ly*Math.sin(rot),y:cy+lx*Math.sin(rot)+ly*Math.cos(rot)}));
      const poly=svg('polygon',{points:corners.map(c=>c.x+','+c.y).join(' '),fill:'none',stroke:'#4caf50','stroke-width':1,'stroke-dasharray':'4,3'}); ov.appendChild(poly);
      corners.forEach((c,i)=>ov.appendChild(mkHandle(c.x,c.y,'handle',e=>startResizeUnit(e,el,i))));
      const topMid={x:(corners[0].x+corners[1].x)/2,y:(corners[0].y+corners[1].y)/2}; const rh={x:topMid.x-Math.sin(rot)*28*0+ (topMid.x-cx)*0, y:topMid.y};
      const rhx=cx+(0)*Math.cos(rot)-(-H/2-26)*Math.sin(rot), rhy=cy+(0)*Math.sin(rot)+(-H/2-26)*Math.cos(rot);
      ov.appendChild(svg('line',{x1:topMid.x,y1:topMid.y,x2:rhx,y2:rhy,stroke:'#4caf50','stroke-width':1}));
      ov.appendChild(mkCircle(rhx,rhy,'rot-handle',e=>startRotate(e,el),'#81c784'));
      if(el.label && el.label.text){ const lp=labelAnchorPos(el,W/2,H/2); ov.appendChild(mkCircle(lp.x,lp.y,'lbl-handle',e=>startLabel(e,el),'#e3c34a')); }
    } else if(el.type==='rect'){ const b=elBBox(el); ov.appendChild(svg('rect',{x:b.x,y:b.y,width:b.w,height:b.h,fill:'none',stroke:'#4caf50','stroke-width':1,'stroke-dasharray':'4,3'}));
      [[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].forEach((c,i)=>ov.appendChild(mkHandle(c[0],c[1],'handle',e=>startResizeRect(e,el,i))));
    } else if(el.type==='arrow'){ el.points.forEach((p,i)=>ov.appendChild(mkHandle(ax(p.x),ay(p.y),'pt-handle',e=>startPoint(e,el,i)))); }
    else if(el.type==='group'){
      const b=groupBBox(el); const mv=svg('rect',{x:b.x-2,y:b.y-2,width:b.w+4,height:b.h+4,fill:'rgba(76,175,80,0.06)',stroke:'#4caf50','stroke-width':2,'stroke-dasharray':'6,4'}); mv.style.cursor='move';
      mv.addEventListener('pointerdown',e=>{ e.stopPropagation(); startMoveItem(e,el); }); ov.appendChild(mv);
    }
    else { const b=elBBox(el); ov.appendChild(svg('rect',{x:b.x-2,y:b.y-2,width:b.w+4,height:b.h+4,fill:'none',stroke:'#4caf50','stroke-width':1,'stroke-dasharray':'4,3'}));
      if(el.type==='star' && el.label && el.label.text){ const lp=labelAnchorPos(el,el.size,el.size); ov.appendChild(mkCircle(lp.x,lp.y,'lbl-handle',e=>startLabel(e,el),'#e3c34a')); }
      if(el.type==='symbol' && el.label && el.label.text){ const hw=el.symbolType==='ship'?(el.size||24)*0.75:(el.size||24)/2; const lp=labelAnchorPos(el,hw,(el.size||24)/2); ov.appendChild(mkCircle(lp.x,lp.y,'lbl-handle',e=>startLabel(e,el),'#e3c34a')); } }
  }); }

// ================= 操作（ポインタ）=================
function onStageDown(ev){ if(ev.button!==0) return; const p=clientToStage(ev);
  if(tool==='paint') return;
  if(tool==='select'){ const node=ev.target.closest('[data-id]');
    if(node){ let id=node.dataset.id; const grp=findGroup(id); if(grp) id=grp.id;
      selectEl(id,ev.shiftKey); txBegin();
      drag={mode:'move',sx:p.x,sy:p.y,orig:selectedIds.map(i=>({el:findItem(i),snap:snap(findItem(i))})).filter(o=>o.el)}; }
    else { if(!ev.shiftKey){ selectedIds=[]; renderSelection(); renderLayerList(); renderProps(); } }
    return; }
  if(tool==='unit'||tool==='text'||tool==='star'||tool==='symbol'){ pushUndo(); const el=createDefault(tool,rx(p.x),ry(p.y)); layerElements.push(el); selectedIds=[el.id]; setTool('select'); renderAll(); autosave(); return; }
  if(tool==='rect'){ pushUndo(); const el=createDefault('rect',rx(p.x),ry(p.y)); el.width=0; el.height=0; layerElements.push(el); selectedIds=[el.id]; drag={mode:'createRect',el,x0:p.x,y0:p.y}; renderAll(); return; }
  if(tool==='arrow'){ if(!arrowDraft) arrowDraft={points:[]}; arrowDraft.points.push({x:rx(p.x),y:ry(p.y)});
    arrowDraft.down=true; arrowDraft.moved=false; arrowDraft.startSx=p.x; arrowDraft.startSy=p.y; arrowDraft.preview=null; renderArrowDraft(); return; }
}
function snap(el){ const s={}; if(el.x!=null)s.x=el.x; if(el.y!=null)s.y=el.y; if(el.points)s.points=el.points.map(p=>({x:p.x,y:p.y})); if(el.label)s.label={offsetX:el.label.offsetX,offsetY:el.label.offsetY};
  if(el.type==='group') s.children=(el.children||[]).map(cid=>{ const c=getEl(cid); if(!c)return null; const cs={id:cid}; if(c.x!=null)cs.x=c.x; if(c.y!=null)cs.y=c.y; if(c.points)cs.points=c.points.map(p=>({x:p.x,y:p.y})); return cs; }).filter(Boolean);
  return s; }
function onStageMove(ev){
  if(tool==='arrow' && arrowDraft && arrowDraft.down){ const q=clientToStage(ev); arrowDraft.moved=Math.hypot(q.x-arrowDraft.startSx,q.y-arrowDraft.startSy)>5; arrowDraft.preview={x:rx(q.x),y:ry(q.y)}; renderArrowDraft(); return; }
  if(!drag) return; const p=clientToStage(ev);
  if(drag.mode==='move'){ const ddx=(p.x-drag.sx)/STAGE_W, ddy=(p.y-drag.sy)/STAGE_H;
    drag.orig.forEach(o=>{ const el=o.el;
      if(el.type==='group' && o.snap.children){ o.snap.children.forEach(cs=>{ const c=getEl(cs.id); if(!c)return; if(cs.points) c.points=cs.points.map(pt=>({x:pt.x+ddx,y:pt.y+ddy})); else{ c.x=cs.x+ddx; c.y=cs.y+ddy; } }); }
      else if(el.points) el.points=o.snap.points.map(pt=>({x:pt.x+ddx,y:pt.y+ddy})); else { el.x=o.snap.x+ddx; el.y=o.snap.y+ddy; } });
    reRender(); }
  else if(drag.mode==='createRect'){ const el=drag.el; el.x=rx(Math.min(drag.x0,p.x)); el.y=ry(Math.min(drag.y0,p.y)); el.width=Math.abs(p.x-drag.x0)/STAGE_W; el.height=Math.abs(p.y-drag.y0)/STAGE_H; reRender(); }
  else if(drag.mode==='resizeUnit'){ const el=drag.el; const rot=(el.rotation||0)*Math.PI/180; const dx=p.x-ax(el.x),dy=p.y-ay(el.y); const lx=dx*Math.cos(-rot)-dy*Math.sin(-rot), ly=dx*Math.sin(-rot)+dy*Math.cos(-rot); el.width=Math.max(12,Math.abs(lx)*2)/STAGE_W; el.height=Math.max(12,Math.abs(ly)*2)/STAGE_H; reRender(); }
  else if(drag.mode==='rotate'){ const el=drag.el; let a=Math.atan2(p.y-ay(el.y),p.x-ax(el.x))*180/Math.PI+90; if(ev.shiftKey) a=Math.round(a/15)*15; el.rotation=(a%360+360)%360; reRender(); }
  else if(drag.mode==='resizeRect'){ const el=drag.el; const fx=drag.fx,fy=drag.fy; el.x=rx(Math.min(fx,p.x)); el.y=ry(Math.min(fy,p.y)); el.width=Math.abs(p.x-fx)/STAGE_W; el.height=Math.abs(p.y-fy)/STAGE_H; reRender(); }
  else if(drag.mode==='point'){ const el=drag.el; el.points[drag.idx]={x:rx(p.x),y:ry(p.y)}; reRender(); }
  else if(drag.mode==='label'){ const el=drag.el; el.label.offsetX=drag.ox+(p.x-drag.sx)/STAGE_W; el.label.offsetY=drag.oy+(p.y-drag.sy)/STAGE_H; reRender(); }
}
function onUp(){
  if(tool==='arrow' && arrowDraft && arrowDraft.down){ arrowDraft.down=false;
    if(arrowDraft.moved && arrowDraft.preview){ arrowDraft.points.push(arrowDraft.preview); arrowDraft.preview=null; finishArrow(); }
    else { arrowDraft.preview=null; renderArrowDraft(); } return; }
  if(drag){ drag=null; txCommit(); renderProps(); autosave(); } }
function startResizeUnit(e,el,i){ txBegin(); drag={mode:'resizeUnit',el,corner:i}; }
function startRotate(e,el){ txBegin(); drag={mode:'rotate',el}; }
function startResizeRect(e,el,i){ txBegin(); const b=elBBox(el); const opp=[[b.x+b.w,b.y+b.h],[b.x,b.y+b.h],[b.x,b.y],[b.x+b.w,b.y]][i]; drag={mode:'resizeRect',el,fx:opp[0],fy:opp[1]}; }
function startPoint(e,el,i){ txBegin(); drag={mode:'point',el,idx:i}; }
function startLabel(e,el){ txBegin(); const p=clientToStage(e); drag={mode:'label',el,sx:p.x,sy:p.y,ox:el.label.offsetX||0,oy:el.label.offsetY||0}; }

// 矢印ドラフト
function renderArrowDraft(){ let g=$('arrowDraft'); if(g) g.remove(); if(!arrowDraft||!arrowDraft.points.length) return;
  g=svg('g',{id:'arrowDraft'}); let pts=arrowDraft.points.map(p=>({x:ax(p.x),y:ay(p.y)}));
  if(arrowDraft.preview) pts=pts.concat([{x:ax(arrowDraft.preview.x),y:ay(arrowDraft.preview.y)}]);
  if(pts.length>=2) g.appendChild(svg('path',{d:'M'+pts.map(p=>p.x+','+p.y).join(' L'),fill:'none',stroke:'#E24B4A','stroke-width':3,'stroke-dasharray':'5,4'}));
  pts.forEach(p=>g.appendChild(svg('circle',{cx:p.x,cy:p.y,r:4,fill:'#E24B4A'}))); $('selOverlay').appendChild(g); }
function finishArrow(){ if(!arrowDraft) return; let pts=arrowDraft.points.slice();
  while(pts.length>2){ const a=pts[pts.length-1],b=pts[pts.length-2]; if(Math.hypot(ax(a.x)-ax(b.x),ay(a.y)-ay(b.y))<6) pts.pop(); else break; }
  if(pts.length>=2){ pushUndo(); const el=createDefault('arrow',0,0); delete el.x; delete el.y; el.points=pts.map(p=>({x:p.x,y:p.y})); Object.assign(el,{curved:false,lineStyle:'solid',lineWidth:3,color:'#E24B4A',arrowHead:'triangle',arrowPosition:'end',opacity:1}); layerElements.push(el); selectedIds=[el.id]; }
  arrowDraft=null; const d=$('arrowDraft'); if(d)d.remove(); setTool('select'); renderAll(); autosave(); }
function cancelArrowDraft(){ arrowDraft=null; const d=$('arrowDraft'); if(d)d.remove(); }
function onDblClick(ev){ if(tool==='arrow'){ ev.preventDefault(); finishArrow(); return; }
  const node=ev.target.closest('[data-id]'); if(node){ const el=getEl(node.dataset.id); if(el&&el.type==='text'){ startInlineEdit(el); } } }
function onKey(e){ if(document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
  const ctrl=e.ctrlKey||e.metaKey;
  if(ctrl && (e.key==='d'||e.key==='D')){ e.preventDefault(); duplicate(); return; }
  if(ctrl && (e.key==='z'||e.key==='Z') && !e.shiftKey){ e.preventDefault(); undo(); return; }
  if(ctrl && ((e.key==='y'||e.key==='Y') || ((e.key==='z'||e.key==='Z')&&e.shiftKey))){ e.preventDefault(); redo(); return; }
  if(ctrl && (e.key==='g'||e.key==='G') && !e.shiftKey){ e.preventDefault(); groupSelected(); return; }
  if(ctrl && (e.key==='g'||e.key==='G') && e.shiftKey){ e.preventDefault(); ungroupSelected(); return; }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && selectedIds.length){
    e.preventDefault(); const step=e.shiftKey?10:1;
    const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;
    const dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
    nudgeSelected(dx,dy); return; }
  if((e.key==='Delete'||e.key==='Backspace') && selectedIds.length){ e.preventDefault(); deleteSelected(); }
  else if(e.key==='Enter'){ if(tool==='arrow'&&arrowDraft){ e.preventDefault(); finishArrow(); } }
  else if(e.key==='Escape'){ if(arrowDraft) cancelArrowDraft(); selectedIds=[]; renderAll(); } }

// インラインテキスト編集
function startInlineEdit(el){ inlineEl=el; const ta=$('inlineEdit'); const sc=stage.getScreenCTM().a; const pos=stageToClient(ax(el.x),ay(el.y));
  ta.value=el.text; ta.style.left=pos.x+'px'; ta.style.top=pos.y+'px'; ta.style.fontSize=(el.fontSize*sc)+'px'; ta.style.minWidth=(80)+'px'; ta.style.width=Math.max(80,el.text.length*el.fontSize*sc*0.6)+'px'; ta.style.height=(el.fontSize*sc*1.4*Math.max(1,labelLines(el.text).length))+'px';
  ta.style.color=el.color; ta.style.display='block'; ta.focus(); ta.select(); }
function commitInline(){ const ta=$('inlineEdit'); if(!inlineEl){ ta.style.display='none'; return; } inlineEl.text=labelLines(ta.value).join('\n'); ta.style.display='none'; const el=inlineEl; inlineEl=null; renderAll(); autosave(); }

// ================= プロパティパネル =================
function prow(label,node){ const d=document.createElement('div'); d.className='prow'; if(label){ const l=document.createElement('label'); l.textContent=label; d.appendChild(l);} (Array.isArray(node)?node:[node]).forEach(n=>d.appendChild(n)); return d; }
function inColor(v,on){ const i=document.createElement('input'); i.type='color'; i.value=v||'#000000'; i.className='mini-sw'; i.oninput=()=>{on(i.value);}; return i; }
function inNum(v,min,max,on){ const i=document.createElement('input'); i.type='number'; i.value=v; if(min!=null)i.min=min; if(max!=null)i.max=max; i.oninput=()=>on(parseFloat(i.value)); return i; }
function inText(v,on){ const i=document.createElement('input'); i.type='text'; i.value=v||''; i.oninput=()=>on(i.value); return i; }
function inRange(v,on){ const i=document.createElement('input'); i.type='range'; i.min=0;i.max=100;i.value=Math.round(v*100); i.oninput=()=>on(i.value/100); return i; }
function inArea(v,on){ const t=document.createElement('textarea'); t.value=v||''; t.oninput=()=>on(t.value); return t; }
function seg(opts,cur,on){ const d=document.createElement('div'); d.className='seg'; opts.forEach(o=>{ const b=document.createElement('button'); b.textContent=o.l; if(o.v===cur)b.classList.add('on'); b.onclick=()=>record(()=>on(o.v)); d.appendChild(b); }); return d; }
function chk(label,v,on){ const w=document.createElement('label'); w.style.fontSize='0.74rem'; const i=document.createElement('input'); i.type='checkbox'; i.checked=!!v; i.onchange=()=>record(()=>on(i.checked)); w.appendChild(i); w.appendChild(document.createTextNode(' '+label)); return w; }
function upd(el,patch){ Object.assign(el,patch); renderLayer(); renderSelection(); autosave(); }
function updL(el,patch){ Object.assign(el.label,patch); renderLayer(); renderSelection(); autosave(); }

function renderProps(){ const sec=$('propSec'), pp=$('propPanel'); pp.innerHTML='';
  if(selectedIds.length!==1){ if(selectedIds.length>1){ sec.style.display='block'; const d=document.createElement('div'); d.className='note'; d.textContent=selectedIds.length+'個を選択中（ドラッグで一括移動・Deleteで削除）'; pp.appendChild(d);
      // 整列
      const ah=document.createElement('div'); ah.style.cssText='font-size:0.72rem;color:var(--accent2);margin-top:10px;margin-bottom:4px;'; ah.textContent='整列'; pp.appendChild(ah);
      const ag=document.createElement('div'); ag.className='align-grid';
      [['左揃え','left'],['右揃え','right'],['上揃え','top'],['下揃え','bottom'],['水平中央','centerH'],['垂直中央','centerV']].forEach(([l,m])=>{ const b=document.createElement('button'); b.textContent=l; b.onclick=()=>alignSelected(m); ag.appendChild(b); });
      [['水平等間隔','h'],['垂直等間隔','v']].forEach(([l,axis])=>{ const b=document.createElement('button'); b.textContent=l; b.disabled=selectedIds.length<3; b.onclick=()=>distributeSelected(axis); ag.appendChild(b); });
      pp.appendChild(ag);
      const gr=document.createElement('div'); gr.style.marginTop='8px';
      const gb=document.createElement('button'); gb.className='btn-sm'; gb.textContent='グループ化 (Ctrl+G)'; gb.onclick=groupSelected; gr.appendChild(gb); pp.appendChild(gr);
      const del=document.createElement('button'); del.className='btn-sm'; del.textContent='選択を削除'; del.style.marginTop='8px'; del.style.color='#d05050'; del.onclick=deleteSelected; pp.appendChild(del); } else sec.style.display='none'; return; }
  sec.style.display='block'; const el=findItem(selectedIds[0]); if(!el){ sec.style.display='none'; return; }
  // 共通：名前
  pp.appendChild(prow('名前',inText(el.name,v=>{el.name=v;renderLayerList();autosave();})));
  if(el.type==='image'){ propsBg(pp,el); return; }
  if(el.type==='unit') propsUnit(pp,el); else if(el.type==='arrow') propsArrow(pp,el); else if(el.type==='rect') propsRect(pp,el); else if(el.type==='text') propsText(pp,el); else if(el.type==='star') propsStar(pp,el); else if(el.type==='symbol') propsSymbol(pp,el); else if(el.type==='group') propsGroup(pp,el);
  // z順・削除
  const zr=document.createElement('div'); zr.className='prow'; const fb=document.createElement('button'); fb.className='btn-sm'; fb.textContent='前面へ'; fb.onclick=bringForward; const bb=document.createElement('button'); bb.className='btn-sm'; bb.textContent='背面へ'; bb.onclick=sendBackward; const db=document.createElement('button'); db.className='btn-sm'; db.textContent='削除'; db.style.color='#d05050'; db.onclick=deleteSelected; zr.append(fb,bb,db); pp.appendChild(zr);
}
function labelEditor(pp,el){ const L=el.label;
  pp.appendChild(prow('ラベル',inArea(L.text,v=>updL(el,{text:v}))));
  pp.appendChild(prow('位置',seg([{l:'上',v:'top'},{l:'下',v:'bottom'},{l:'左',v:'left'},{l:'右',v:'right'}],L.position,v=>updL(el,{position:v,offsetX:0,offsetY:0}))));
  pp.appendChild(prow('文字',[inColor(L.color,v=>updL(el,{color:v})),inNum(L.fontSize,8,48,v=>updL(el,{fontSize:v})),chk('太字',L.bold,v=>updL(el,{bold:v}))])); }
function propsUnit(pp,el){
  pp.appendChild(prow('色',[inColor(el.fillColor,v=>upd(el,{fillColor:v})),document.createTextNode('濃さ'),inRange(el.opacity==null?1:el.opacity,v=>upd(el,{opacity:v}))]));
  pp.appendChild(prow('回転',inNum(Math.round(el.rotation||0),0,359,v=>upd(el,{rotation:(v%360+360)%360}))));
  pp.appendChild(prow('兵科',chk('歩兵（記号なし）',el.infantry,v=>upd(el,{infantry:v}))));
  if(!el.infantry) pp.appendChild(prow('種別',seg([{l:'機甲',v:'armor'},{l:'砲兵',v:'artillery'},{l:'騎兵',v:'cavalry'},{l:'工兵',v:'engineer'},{l:'空挺',v:'airborne'}],el.infantryType,v=>upd(el,{infantryType:v}))));
  labelEditor(pp,el); }
function propsArrow(pp,el){
  pp.appendChild(prow('色',[inColor(el.color,v=>upd(el,{color:v})),document.createTextNode('太さ'),inNum(el.lineWidth,1,20,v=>upd(el,{lineWidth:v}))]));
  pp.appendChild(prow('線種',seg([{l:'実線',v:'solid'},{l:'破線',v:'dashed'},{l:'点線',v:'dotted'}],el.lineStyle,v=>upd(el,{lineStyle:v}))));
  pp.appendChild(prow('形状',seg([{l:'折れ線',v:false},{l:'曲線',v:true}],el.curved,v=>upd(el,{curved:v}))));
  pp.appendChild(prow('矢頭',seg([{l:'三角',v:'triangle'},{l:'開矢',v:'open'},{l:'なし',v:'none'}],el.arrowHead,v=>upd(el,{arrowHead:v}))));
  pp.appendChild(prow('矢の位置',seg([{l:'終点',v:'end'},{l:'両端',v:'both'}],el.arrowPosition,v=>upd(el,{arrowPosition:v})))); }
function propsRect(pp,el){
  pp.appendChild(prow('塗り',[inColor(el.fillColor,v=>upd(el,{fillColor:v})),document.createTextNode('透明度'),inRange(el.fillOpacity==null?1:el.fillOpacity,v=>upd(el,{fillOpacity:v}))]));
  const bgb=document.createElement('button'); bgb.className='btn-sm'; bgb.textContent='背景色と同色（目隠し）'; bgb.onclick=()=>{ upd(el,{fillColor:$('bg').getAttribute('fill'),fillOpacity:1}); renderProps(); }; pp.appendChild(prow('',bgb));
  pp.appendChild(prow('枠線',chk('枠線あり',el.borderEnabled,v=>{upd(el,{borderEnabled:v});renderProps();})));
  if(el.borderEnabled){ pp.appendChild(prow('枠',[inColor(el.borderColor,v=>upd(el,{borderColor:v})),inNum(el.borderWidth,1,10,v=>upd(el,{borderWidth:v}))]));
    pp.appendChild(prow('枠線種',seg([{l:'実線',v:'solid'},{l:'破線',v:'dashed'},{l:'点線',v:'dotted'}],el.borderStyle,v=>upd(el,{borderStyle:v})))); } }
function propsText(pp,el){
  pp.appendChild(prow('文章',inArea(el.text,v=>upd(el,{text:v}))));
  pp.appendChild(prow('文字',[inColor(el.color,v=>upd(el,{color:v})),inNum(el.fontSize,8,48,v=>upd(el,{fontSize:v})),chk('太字',el.bold,v=>upd(el,{bold:v}))]));
  pp.appendChild(prow('背景',chk('背景塗りあり',el.bgEnabled,v=>{upd(el,{bgEnabled:v});renderProps();})));
  if(el.bgEnabled) pp.appendChild(prow('背景色',[inColor(el.bgColor,v=>upd(el,{bgColor:v})),document.createTextNode('透明度'),inRange(el.bgOpacity==null?0.8:el.bgOpacity,v=>upd(el,{bgOpacity:v}))])); }
function propsStar(pp,el){
  pp.appendChild(prow('色',[inColor(el.color,v=>upd(el,{color:v})),document.createTextNode('大きさ'),inNum(el.size,6,48,v=>upd(el,{size:v}))]));
  labelEditor(pp,el); }
function updBg(el,patch){ Object.assign(el,patch); renderBackgrounds(); renderSelection(); autosave(); }
function propsBg(pp,el){
  pp.appendChild(prow('透明度',inRange(el.opacity==null?1:el.opacity,v=>updBg(el,{opacity:v}))));
  const fit=document.createElement('button'); fit.className='btn-sm'; fit.textContent='地図全体に合わせる'; fit.style.width='100%'; fit.onclick=()=>bgFit(el); pp.appendChild(prow('',fit));
  pp.appendChild(prow('',chk('PNG出力に含める',el.includeInExport!==false,v=>{el.includeInExport=v;autosave();})));
  pp.appendChild(prow('',chk('表示する',el.visible!==false,v=>{el.visible=v;renderAll();autosave();})));
  const zr=document.createElement('div'); zr.className='prow';
  const fb=document.createElement('button'); fb.className='btn-sm'; fb.textContent='前面へ'; fb.onclick=()=>bgForward(el.id);
  const bb=document.createElement('button'); bb.className='btn-sm'; bb.textContent='背面へ'; bb.onclick=()=>bgBackward(el.id);
  const db=document.createElement('button'); db.className='btn-sm'; db.textContent='削除'; db.style.color='#d05050'; db.onclick=()=>bgDelete(el.id);
  zr.append(fb,bb,db); pp.appendChild(zr); }

// ================= レイヤー一覧 =================
function renderLayerList(){ const list=$('layerList'); list.innerHTML='';
  if(!layerElements.length && !backgrounds.length){ const d=document.createElement('div'); d.className='note'; d.textContent='まだ要素がありません。ツールを選んで地図に配置してください。'; list.appendChild(d); return; }
  const groupChildIds=new Set(layerElements.filter(e=>e.type==='group').flatMap(e=>e.children||[]));
  // 要素：前面（配列末尾）を上に表示
  layerElements.slice().reverse().forEach(el=>{ if(groupChildIds.has(el.id)) return; // グループ子は個別表示しない
    const item=document.createElement('div'); item.className='layer-item'+(selectedIds.includes(el.id)?' sel':'')+(el.hidden?' hidden-el':''); item.draggable=true; item.dataset.id=el.id;
    const vis=document.createElement('button'); vis.className='lbtn'; vis.textContent=el.hidden?'🚫':'👁'; vis.title='表示/非表示'; vis.onclick=e=>{ e.stopPropagation(); el.hidden=!el.hidden; renderAll(); autosave(); };
    const ic=document.createElement('span'); ic.className='licon'; ic.textContent=TYPE_ICON[el.type]||'•';
    const nm=document.createElement('span'); nm.className='lname'; nm.textContent=el.type==='group'?el.name+` (${(el.children||[]).length})`:el.name;
    const up=document.createElement('button'); up.className='lbtn'; up.textContent='▲'; up.title='前面へ'; up.onclick=e=>{ e.stopPropagation(); selectedIds=[el.id]; bringForward(); };
    const dn=document.createElement('button'); dn.className='lbtn'; dn.textContent='▼'; dn.title='背面へ'; dn.onclick=e=>{ e.stopPropagation(); selectedIds=[el.id]; sendBackward(); };
    const del=document.createElement('button'); del.className='lbtn'; del.textContent='✕'; del.title='削除'; del.style.color='#d05050'; del.onclick=e=>{ e.stopPropagation(); selectedIds=[el.id]; deleteSelected(); };
    item.append(vis,ic,nm,up,dn,del);
    item.onclick=()=>{ if(tool!=='select') setTool('select'); selectedIds=[el.id]; renderAll(); };
    item.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',el.id); });
    item.addEventListener('dragover',e=>{ e.preventDefault(); item.classList.add('drag-over'); });
    item.addEventListener('dragleave',()=>item.classList.remove('drag-over'));
    item.addEventListener('drop',e=>{ e.preventDefault(); item.classList.remove('drag-over'); const srcId=e.dataTransfer.getData('text/plain'); reorderDrop(srcId,el.id); });
    list.appendChild(item); });
  // 下絵：地図の下。要素一覧の下に表示
  backgrounds.slice().reverse().forEach(b=>{ const item=document.createElement('div'); item.className='layer-item'+(selectedIds.includes(b.id)?' sel':'')+(b.visible===false?' hidden-el':'');
    const vis=document.createElement('button'); vis.className='lbtn'; vis.textContent=(b.visible===false)?'🚫':'👁'; vis.title='表示/非表示'; vis.onclick=e=>{ e.stopPropagation(); b.visible=!(b.visible!==false); renderAll(); autosave(); };
    const ic=document.createElement('span'); ic.className='licon'; ic.textContent='🖼';
    const nm=document.createElement('span'); nm.className='lname'; nm.textContent=b.name||'下絵';
    const up=document.createElement('button'); up.className='lbtn'; up.textContent='▲'; up.title='前面へ'; up.onclick=e=>{ e.stopPropagation(); bgForward(b.id); };
    const dn=document.createElement('button'); dn.className='lbtn'; dn.textContent='▼'; dn.title='背面へ'; dn.onclick=e=>{ e.stopPropagation(); bgBackward(b.id); };
    const del=document.createElement('button'); del.className='lbtn'; del.textContent='✕'; del.title='削除'; del.style.color='#d05050'; del.onclick=e=>{ e.stopPropagation(); bgDelete(b.id); };
    item.append(vis,ic,nm,up,dn,del);
    item.onclick=()=>{ if(tool!=='select') setTool('select'); selectedIds=[b.id]; renderAll(); };
    list.appendChild(item); }); }
function reorderDrop(srcId,dstId){ if(srcId===dstId) return; const si=layerElements.findIndex(e=>e.id===srcId); if(si<0) return; pushUndo(); const [moved]=layerElements.splice(si,1); let di=layerElements.findIndex(e=>e.id===dstId);
  // リストは前面が上。dstの「前面側」に置く＝配列上はdstの直後（+1）
  layerElements.splice(di+1,0,moved); renderAll(); autosave(); }

// ================= アンドゥ / リドゥ =================
function snapState(){ return JSON.stringify({ layerElements, backgrounds, fills, mapVisible, currentMapId, mapFillsAll }); }
function applySnap(s){ const o=JSON.parse(s); layerElements=o.layerElements||[]; backgrounds=o.backgrounds||[]; fills=o.fills||{}; mapVisible=o.mapVisible!==false;
  if(o.currentMapId && o.currentMapId!==currentMapId){ currentMapId=o.currentMapId; mapFillsAll=o.mapFillsAll||{}; loadMap(currentMapId); }
  else { mapFillsAll=o.mapFillsAll||{}; } }
function pushSnap(s){ undoStack.push(s); if(undoStack.length>HIST_MAX) undoStack.shift(); redoStack=[]; updateHistButtons(); }
function pushUndo(){ pushSnap(snapState()); }                 // 離散操作の直前に呼ぶ
function record(fn){ const b=snapState(); fn(); if(snapState()!==b) pushSnap(b); }   // 変化があった時だけ積む
function txBegin(){ if(txBefore===null) txBefore=snapState(); }   // ドラッグ・入力の開始
function txCommit(){ if(txBefore!==null){ if(snapState()!==txBefore) pushSnap(txBefore); txBefore=null; } }
function updateHistButtons(){ const u=$('btnUndo'),r=$('btnRedo'); if(u)u.disabled=!undoStack.length; if(r)r.disabled=!redoStack.length; }
function undo(){ if(!undoStack.length) return; redoStack.push(snapState()); if(redoStack.length>HIST_MAX) redoStack.shift(); applySnap(undoStack.pop()); afterHist(); }
function redo(){ if(!redoStack.length) return; undoStack.push(snapState()); if(undoStack.length>HIST_MAX) undoStack.shift(); applySnap(redoStack.pop()); afterHist(); }
function afterHist(){ selectedIds=[]; applyMapVisibility(); applyFills(); $('mapVisChk').checked=mapVisible; renderAll(); updateHistButtons(); autosave(); applyMapTransform(); }

// ================= 複製（Ctrl+D） =================
function duplicate(){ if(!selectedIds.length) return; pushUndo();
  const dxr=20/STAGE_W, dyr=20/STAGE_H, copies=[];
  selectedIds.forEach(id=>{ const el=getEl(id); if(!el) return; const c=JSON.parse(JSON.stringify(el)); c.id=uid(); c.name=autoName(el.type);
    if(c.points) c.points=c.points.map(p=>({x:p.x+dxr,y:p.y+dyr})); else { c.x=(c.x||0)+dxr; c.y=(c.y||0)+dyr; }
    layerElements.push(c); copies.push(c.id); });
  if(copies.length){ selectedIds=copies; } renderAll(); autosave(); }

// ================= 下絵（背景画像）=================
function applyMapVisibility(){ mapSvg.style.display=mapVisible?'':'none'; }
function toggleMap(v){ mapVisible=v; applyMapVisibility(); autosave(); }
function onBgFile(ev){ const file=ev.target.files[0]; ev.target.value=''; if(!file) return;
  const r=new FileReader();
  r.onload=()=>{
    const img=new Image();
    img.onload=()=>{
      const origW=img.naturalWidth, origH=img.naturalHeight, maxLong=1920;
      const longSide=Math.max(origW,origH);
      let dataUrl=r.result;
      if(longSide>maxLong){
        const scale=maxLong/longSide, w=Math.round(origW*scale), h=Math.round(origH*scale);
        const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(img,0,0,w,h);
        dataUrl=cv.toDataURL('image/jpeg',0.88);
        showToast(`画像を縮小して取り込みました（元: ${origW}×${origH} → ${w}×${h}）`);
      }
      pushUndo();
      const bg={ id:uid(), type:'image', src:dataUrl, x:0, y:0, width:1, height:1, opacity:1, visible:true, includeInExport:true, name:'下絵 '+((nameCounter.bg=(nameCounter.bg||0)+1)) };
      backgrounds.push(bg); selectedIds=[bg.id]; renderAll(); autosave();
    };
    img.src=r.result;
  };
  r.readAsDataURL(file); }
function getBg(id){ return backgrounds.find(b=>b.id===id); }
function findItem(id){ return getEl(id)||getBg(id); }
function isBg(item){ return !!item && item.type==='image'; }
function bgFit(b){ pushUndo(); b.x=0; b.y=0; b.width=1; b.height=1; renderAll(); autosave(); }
function bgDelete(id){ pushUndo(); backgrounds=backgrounds.filter(b=>b.id!==id); selectedIds=selectedIds.filter(s=>s!==id); renderAll(); autosave(); }
function bgForward(id){ const i=backgrounds.findIndex(b=>b.id===id); if(i>=0&&i<backgrounds.length-1){ pushUndo(); const [b]=backgrounds.splice(i,1); backgrounds.splice(i+1,0,b); renderAll(); autosave(); } }
function bgBackward(id){ const i=backgrounds.findIndex(b=>b.id===id); if(i>0){ pushUndo(); const [b]=backgrounds.splice(i,1); backgrounds.splice(i-1,0,b); renderAll(); autosave(); } }
function renderBackgrounds(){ const layer=$('bgLayer'); layer.innerHTML='';
  backgrounds.forEach(b=>{ if(!b.visible) return; const im=svg('image',{x:ax(b.x),y:ay(b.y),width:ax(b.width),height:ay(b.height),opacity:b.opacity==null?1:b.opacity,preserveAspectRatio:'none','data-id':b.id});
    im.setAttributeNS('http://www.w3.org/1999/xlink','href',b.src); im.setAttribute('href',b.src); layer.appendChild(im); }); }

// ================= PNG出力 =================
function exportPNG(){ selectedIds=[]; cancelArrowDraft(); renderSelection();
  // 「出力に含めない」下絵は一時的に非表示にして出力
  const hidden=backgrounds.filter(b=>b.includeInExport===false && b.visible);
  hidden.forEach(b=>b.visible=false); if(hidden.length) renderBackgrounds();
  const [W,H]=SIZES[outputSize]; const xml=new XMLSerializer().serializeToString(stage); const svgStr='<?xml version="1.0" encoding="UTF-8"?>\n'+xml;
  hidden.forEach(b=>b.visible=true); if(hidden.length) renderBackgrounds();
  const blob=new Blob([svgStr],{type:'image/svg+xml;charset=utf-8'}); const url=URL.createObjectURL(blob); const img=new Image();
  img.onload=()=>{ const cv=document.createElement('canvas'); cv.width=W; cv.height=H; cv.getContext('2d').drawImage(img,0,0,W,H); URL.revokeObjectURL(url);
    cv.toBlob(b=>{ const a=document.createElement('a'); let fn=($('fileName').value||'map').trim().replace(/\.png$/i,''); a.href=URL.createObjectURL(b); a.download=fn+'_'+outputSize+'.png'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); },'image/png'); };
  img.onerror=()=>alert('PNG変換に失敗しました。'); img.src=url; }

// ================= 保存 / 読み込み / 自動保存 =================
function serializeState(){
  const allFills={...mapFillsAll,[currentMapId]:{...fills}};
  return { version:SCHEMA_VERSION, savedAt:nowISO(), title:$('titleInput').value, backgroundColor:$('bg').getAttribute('fill'),
    borderMode, opacity, legendPos, outputSize, mapVisible,
    currentMapId, mapFillsAll:allFills, mapPanZoom,
    prefectures:[], legend:legend.map((l,i)=>({id:'leg_'+pad3(i+1),color:l.color,label:l.text})),
    backgrounds:backgrounds, layerElements:layerElements }; }

function migrateStar(s){ return { id:s.id||uid(), type:'star', name:autoName('star'), hidden:false, x:+s.x||0, y:+s.y||0, size:+s.size||16, color:s.color||'#D32F2F',
  label:{ text:(typeof s.label==='string')?s.label:((s.label&&s.label.text)||''), position:'right', offsetX:0, offsetY:0, fontSize:13, color:'#000000', bold:false } }; }
function normEl(el){ if(!el||!el.type) return null; if(!el.id) el.id=uid(); if(!el.name) el.name=autoName(el.type); if(el.hidden==null) el.hidden=false;
  if((el.type==='unit'||el.type==='star') && !el.label) el.label=defaultLabel(el.type==='star'?'right':'bottom');
  if(el.label){ const L=el.label; if(L.offsetX==null)L.offsetX=0; if(L.offsetY==null)L.offsetY=0; if(L.fontSize==null)L.fontSize=13; if(!L.color)L.color='#000000'; if(!L.position)L.position='bottom'; }
  return el; }

function applyState(s){ restoring=true;
  $('titleInput').value=s.title||''; $('title').textContent=s.title||'';
  const bg=s.backgroundColor||'#F5F0E8'; $('bg').setAttribute('fill',bg); $('bgPicker').value=bg;
  document.querySelectorAll('#bgPresets .sw').forEach((d,i)=>d.classList.toggle('active',(BG_PRESETS[i]&&BG_PRESETS[i].c.toUpperCase())===bg.toUpperCase()));
  opacity=(typeof s.opacity==='number')?s.opacity:0.8; $('opacity').value=Math.round(opacity*100); $('opacityVal').textContent=Math.round(opacity*100)+'%';
  borderMode=s.borderMode||'normal'; setActive('#borderBtns','b',borderMode);
  // v2.3: mapFillsAll / v2.2以前: prefectures (Japan only)
  if(s.mapFillsAll){ mapFillsAll={...s.mapFillsAll}; }
  else { mapFillsAll={}; const legacyFills={}; (s.prefectures||[]).forEach(p=>{ if(p&&p.id) legacyFills[p.id]=p.color; }); mapFillsAll['japan']=legacyFills; }
  currentMapId=s.currentMapId||'japan';
  fills={...(mapFillsAll[currentMapId]||{})};
  legend=(s.legend||[]).map(l=>({color:l.color||'#4a7fb5',text:l.label||''})); renderLegendList();
  legendPos=s.legendPos||'bl'; setActive('#legendPos','p',legendPos); renderLegend();
  setOutputSize(SIZES[s.outputSize]?s.outputSize:'S',true);
  // 要素（v1→v2移行）
  uidCounter=0; nameCounter={};
  if(s.version==='1.0'){ layerElements=(s.stars||[]).map(migrateStar); }
  else { layerElements=(s.layerElements||[]).map(normEl).filter(Boolean); }
  // 下絵・地図表示
  backgrounds=(s.backgrounds||[]).map(normBg).filter(Boolean);
  mapVisible=s.mapVisible!==false; $('mapVisChk').checked=mapVisible; applyMapVisibility();
  // uidCounter を既存IDの最大に合わせる
  [...layerElements,...backgrounds].forEach(e=>{ const m=/el_(\d+)/.exec(e.id||''); if(m) uidCounter=Math.max(uidCounter,+m[1]); });
  undoStack=[]; redoStack=[]; txBefore=null; updateHistButtons();
  selectedIds=[]; setTool('select');
  // 地図ロード（restoring=trueのまま行う）
  loadMap(currentMapId);
  // loadMap が resetMapView を呼ぶので、保存値を上書きで復元
  mapPanZoom=s.mapPanZoom||{tx:0,ty:0,scale:1};
  applyMapTransform();
  renderAll(); restoring=false; }
function normBg(b){ if(!b||!b.src) return null; return { id:b.id||uid(), type:'image', src:b.src, x:+b.x||0, y:+b.y||0, width:b.width==null?1:+b.width, height:b.height==null?1:+b.height, opacity:b.opacity==null?1:+b.opacity, visible:b.visible!==false, includeInExport:b.includeInExport!==false, name:b.name||'下絵' }; }

function autosave(){ if(restoring) return; clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>{ try{ localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(serializeState())); }catch(e){} },500); }
function saveWork(){ const def='mapwork_'+stamp()+'.json'; let name=prompt('作業ファイル名を入力してください：',def); if(name===null) return; name=name.trim()||def; if(!/\.json$/i.test(name)) name+='.json';
  const blob=new Blob([JSON.stringify(serializeState(),null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function loadWork(){ if(!confirm('現在の作業が破棄されます。よろしいですか？')) return; $('loadFile').click(); }
function onLoadFile(ev){ const file=ev.target.files[0]; ev.target.value=''; if(!file) return; const r=new FileReader();
  r.onload=()=>{ let s; try{ s=JSON.parse(r.result); }catch(e){ alert('ファイルを読み込めませんでした（JSONの形式が不正です）。現在の状態は維持されます。'); return; }
    if(!s || !['1.0','2.0','2.1','2.2','2.3'].includes(s.version)){ alert('このファイルは未対応のバージョンです（version: '+((s&&s.version)||'不明')+'）。現在の状態は維持されます。'); return; }
    applyState(s); try{ localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(serializeState())); }catch(e){} };
  r.onerror=()=>alert('ファイルを読み込めませんでした。'); r.readAsText(file); }

function resetAll(){ if(!confirm('塗り・レイヤー要素・下絵・凡例・タイトルをすべて消去します。よろしいですか？')) return; restoring=true;
  fills={}; mapFillsAll={}; layerElements=[]; backgrounds=[]; mapVisible=true; selectedIds=[]; legend=[]; legendPos='bl'; uidCounter=0; nameCounter={};
  undoStack=[]; redoStack=[]; txBefore=null; updateHistButtons(); applyMapVisibility(); $('mapVisChk').checked=true;
  $('titleInput').value=''; $('title').textContent=''; setActive('#legendPos','p','bl'); legend.push({color:PAINT_COLORS[0],text:''}); renderLegendList(); renderLegend();
  setOutputSize('S',true); setTool('select'); loadMap(currentMapId); renderAll(); restoring=false; try{ localStorage.removeItem(AUTOSAVE_KEY); }catch(e){} }

function freshStart(){ restoring=true; fills={}; mapFillsAll={}; layerElements=[]; backgrounds=[]; mapVisible=true; selectedIds=[]; legend=[]; legendPos='bl'; outputSize='S'; uidCounter=0; nameCounter={}; currentMapId='japan'; mapPanZoom={tx:0,ty:0,scale:1};
  undoStack=[]; redoStack=[]; txBefore=null; updateHistButtons(); applyMapVisibility();
  legend.push({color:PAINT_COLORS[0],text:''}); renderLegendList(); renderLegend(); setActive('#legendPos','p','bl'); setOutputSize('S',true); setTool('select'); loadMap('japan'); renderAll(); restoring=false; }

window.addEventListener('beforeunload',()=>{ try{ localStorage.setItem(AUTOSAVE_KEY,JSON.stringify(serializeState())); }catch(e){} });

// ================= 補助記号 =================
function buildSymbol(el){ const g=svg('g',{class:'el-g movable','data-id':el.id});
  const cx=ax(el.x),cy=ay(el.y),S=el.size||24,col=el.color||'#000',sw=Math.max(2,S*0.12);
  const inner=svg('g',{transform:`translate(${cx},${cy}) rotate(${el.rotation||0})`});
  if(el.symbolType==='ship'){ const W=S*1.5,H=S*0.65; inner.appendChild(svg('path',{d:`M${-W/2},${-H/2} L${W*0.3},${-H/2} L${W/2},0 L${W*0.3},${H/2} L${-W/2},${H/2} Z`,fill:col,stroke:'#222','stroke-width':1})); }
  else if(el.symbolType==='aircraft'){ const R=S/2;
    inner.appendChild(svg('ellipse',{cx:0,cy:0,rx:R*0.13,ry:R*0.95,fill:col}));
    inner.appendChild(svg('polygon',{points:`${-R*0.13},${-R*0.15} ${-R*0.95},${R*0.35} ${-R*0.13},${R*0.3}`,fill:col}));
    inner.appendChild(svg('polygon',{points:`${R*0.13},${-R*0.15} ${R*0.95},${R*0.35} ${R*0.13},${R*0.3}`,fill:col}));
    inner.appendChild(svg('polygon',{points:`${-R*0.13},${R*0.6} ${-R*0.38},${R*0.95} ${-R*0.13},${R*0.85}`,fill:col}));
    inner.appendChild(svg('polygon',{points:`${R*0.13},${R*0.6} ${R*0.38},${R*0.95} ${R*0.13},${R*0.85}`,fill:col})); }
  else if(el.symbolType==='base'){ inner.appendChild(svg('rect',{x:-S/2,y:-S/2,width:S,height:S,fill:col,stroke:'#222','stroke-width':1})); }
  else if(el.symbolType==='city'){ inner.appendChild(svg('circle',{cx:0,cy:0,r:S/2,fill:'none',stroke:col,'stroke-width':sw})); inner.appendChild(svg('circle',{cx:0,cy:0,r:S/4,fill:'none',stroke:col,'stroke-width':sw})); }
  else if(el.symbolType==='battle'){ const h=S/2; inner.appendChild(svg('line',{x1:-h,y1:-h,x2:h,y2:h,stroke:col,'stroke-width':sw*1.5,'stroke-linecap':'round'})); inner.appendChild(svg('line',{x1:h,y1:-h,x2:-h,y2:h,stroke:col,'stroke-width':sw*1.5,'stroke-linecap':'round'})); }
  g.appendChild(inner);
  const halfW=el.symbolType==='ship'?S*0.75:S/2;
  if(el.label&&el.label.text) g.appendChild(buildLabel(el,halfW,S/2));
  return g; }
function propsSymbol(pp,el){
  pp.appendChild(prow('種別',seg([{l:'艦隊',v:'ship'},{l:'航空',v:'aircraft'},{l:'基地',v:'base'},{l:'都市',v:'city'},{l:'戦闘',v:'battle'}],el.symbolType,v=>upd(el,{symbolType:v}))));
  pp.appendChild(prow('色',[inColor(el.color,v=>upd(el,{color:v})),document.createTextNode('大きさ'),inNum(el.size||24,8,80,v=>upd(el,{size:v}))]));
  pp.appendChild(prow('回転',inNum(Math.round(el.rotation||0),0,359,v=>upd(el,{rotation:(v%360+360)%360}))));
  labelEditor(pp,el); }

// ================= グループ =================
function groupBBox(el){ const children=(el.children||[]).map(id=>getEl(id)).filter(Boolean); if(!children.length) return {x:0,y:0,w:10,h:10};
  const boxes=children.map(c=>elBBox(c)); const minx=Math.min(...boxes.map(b=>b.x)),miny=Math.min(...boxes.map(b=>b.y)),maxx=Math.max(...boxes.map(b=>b.x+b.w)),maxy=Math.max(...boxes.map(b=>b.y+b.h));
  return {x:minx,y:miny,w:Math.max(10,maxx-minx),h:Math.max(10,maxy-miny)}; }
function findGroup(id){ return layerElements.find(el=>el.type==='group'&&(el.children||[]).includes(id))||null; }
function groupSelected(){ if(selectedIds.length<2) return; pushUndo();
  const grp={id:uid(),type:'group',name:autoName('group'),hidden:false,children:[...selectedIds]};
  const topIdx=Math.max(...selectedIds.map(id=>layerElements.findIndex(e=>e.id===id)));
  layerElements.splice(topIdx+1,0,grp); selectedIds=[grp.id]; renderAll(); autosave(); }
function ungroupSelected(){ if(selectedIds.length!==1) return; const grp=getEl(selectedIds[0]); if(!grp||grp.type!=='group') return;
  pushUndo(); const idx=layerElements.findIndex(e=>e.id===grp.id); layerElements.splice(idx,1); selectedIds=[...grp.children]; renderAll(); autosave(); }
function propsGroup(pp,el){ const note=document.createElement('div'); note.className='note'; note.textContent=`グループ（${(el.children||[]).length}要素）`; pp.appendChild(note);
  const ub=document.createElement('button'); ub.className='btn-sm'; ub.textContent='グループ解除 (Ctrl+Shift+G)'; ub.style.marginTop='8px'; ub.onclick=ungroupSelected; pp.appendChild(ub); }

// ================= 矢印キー微調整 =================
function nudgeSelected(dx,dy){ if(!selectedIds.length) return;
  const rdx=dx/STAGE_W, rdy=dy/STAGE_H; txBegin();
  selectedIds.forEach(id=>{ const el=getEl(id); if(!el) return; moveEl(el,rdx,rdy); }); reRender();
  clearTimeout(nudgeTimer); nudgeTimer=setTimeout(()=>{ txCommit(); autosave(); },500); }
function moveEl(el,rdx,rdy){ if(el.type==='group'){ (el.children||[]).forEach(cid=>{ const c=getEl(cid); if(!c) return; if(c.points) c.points=c.points.map(p=>({x:p.x+rdx,y:p.y+rdy})); else{ c.x=(c.x||0)+rdx; c.y=(c.y||0)+rdy; } }); }
  else if(el.points) el.points=el.points.map(p=>({x:p.x+rdx,y:p.y+rdy})); else{ el.x=(el.x||0)+rdx; el.y=(el.y||0)+rdy; } }

// ================= 整列・等間隔 =================
function alignSelected(mode){ if(selectedIds.length<2) return; pushUndo();
  const items=selectedIds.map(id=>getEl(id)).filter(Boolean);
  const boxes=items.map(el=>({el,b:elBBox(el)}));
  const minX=Math.min(...boxes.map(({b})=>b.x)),maxX=Math.max(...boxes.map(({b})=>b.x+b.w));
  const minY=Math.min(...boxes.map(({b})=>b.y)),maxY=Math.max(...boxes.map(({b})=>b.y+b.h));
  const centerX=(minX+maxX)/2, centerY=(minY+maxY)/2;
  boxes.forEach(({el,b})=>{ let dx=0,dy=0;
    if(mode==='left') dx=minX-b.x; else if(mode==='right') dx=maxX-(b.x+b.w);
    else if(mode==='top') dy=minY-b.y; else if(mode==='bottom') dy=maxY-(b.y+b.h);
    else if(mode==='centerH') dx=centerX-(b.x+b.w/2); else if(mode==='centerV') dy=centerY-(b.y+b.h/2);
    moveEl(el,dx/STAGE_W,dy/STAGE_H); });
  renderAll(); autosave(); }
function distributeSelected(axis){ if(selectedIds.length<3) return; pushUndo();
  const items=selectedIds.map(id=>getEl(id)).filter(Boolean);
  const boxes=items.map(el=>({el,b:elBBox(el)}));
  if(axis==='h'){ boxes.sort((a,b)=>(a.b.x+a.b.w/2)-(b.b.x+b.b.w/2));
    const step=((boxes[boxes.length-1].b.x+boxes[boxes.length-1].b.w/2)-(boxes[0].b.x+boxes[0].b.w/2))/(boxes.length-1);
    const startCx=boxes[0].b.x+boxes[0].b.w/2;
    boxes.forEach(({el,b},i)=>{ if(i===0||i===boxes.length-1) return; const dx=startCx+step*i-(b.x+b.w/2); moveEl(el,dx/STAGE_W,0); });
  } else { boxes.sort((a,b)=>(a.b.y+a.b.h/2)-(b.b.y+b.b.h/2));
    const step=((boxes[boxes.length-1].b.y+boxes[boxes.length-1].b.h/2)-(boxes[0].b.y+boxes[0].b.h/2))/(boxes.length-1);
    const startCy=boxes[0].b.y+boxes[0].b.h/2;
    boxes.forEach(({el,b},i)=>{ if(i===0||i===boxes.length-1) return; const dy=startCy+step*i-(b.y+b.h/2); moveEl(el,0,dy/STAGE_H); });
  }
  renderAll(); autosave(); }

// ================= トースト =================
function showToast(msg,duration=2500){ const t=document.getElementById('toastMsg'); if(!t) return; t.textContent=msg; t.style.display='block'; clearTimeout(t._timer); t._timer=setTimeout(()=>{ t.style.display='none'; },duration); }

// ================= カラーパレット =================
function initPalette(){ try{ const s=localStorage.getItem(PALETTE_KEY); userPalette=s?JSON.parse(s):[...DEFAULT_PALETTE]; }catch(e){ userPalette=[...DEFAULT_PALETTE]; } renderPalette(); }
function savePalette(){ try{ localStorage.setItem(PALETTE_KEY,JSON.stringify(userPalette)); }catch(e){} }
function renderPalette(){ const c=document.getElementById('userPalette'); if(!c) return; c.innerHTML='';
  for(let i=0;i<MAX_PALETTE;i++){ const color=userPalette[i]; const sw=document.createElement('div');
    sw.className='user-sw'+(color?'':' empty'); if(color){ sw.style.background=color; sw.title=color; sw.onclick=()=>applyPaletteColor(color); sw.oncontextmenu=e=>{ e.preventDefault(); removePaletteColor(i); }; } else sw.title='（空）'; c.appendChild(sw); } }
function applyPaletteColor(color){ if(!selectedIds.length){ document.getElementById('palettePickerAdd').value=color; return; }
  txBegin(); selectedIds.forEach(id=>{ const el=getEl(id); if(!el) return;
    if(el.type==='unit') upd(el,{fillColor:color}); else if(el.type==='rect') upd(el,{fillColor:color});
    else if(el.type==='arrow'||el.type==='text'||el.type==='star'||el.type==='symbol') upd(el,{color}); }); txCommit(); renderProps(); }
function addPaletteColor(){ const color=document.getElementById('palettePickerAdd').value;
  if(userPalette.includes(color)){ showToast('すでに登録済みです'); return; }
  if(userPalette.length>=MAX_PALETTE){ showToast('パレットが満杯です（最大'+MAX_PALETTE+'色）'); return; }
  userPalette.push(color); savePalette(); renderPalette(); }
function removePaletteColor(idx){ userPalette.splice(idx,1); savePalette(); renderPalette(); }

// ================= 部品ライブラリ =================
function initLibrary(){ try{ const s=localStorage.getItem(LIBRARY_KEY); library=s?(JSON.parse(s).items||[]):[];}catch(e){ library=[]; } renderLibrary(); }
function saveLibraryToStorage(){ try{ localStorage.setItem(LIBRARY_KEY,JSON.stringify({version:'1.0',items:library})); }catch(e){} }
function saveToLibrary(){ if(!selectedIds.length){ showToast('要素を選択してください'); return; }
  const items=selectedIds.map(id=>getEl(id)).filter(Boolean); if(!items.length) return;
  const name=prompt('部品の名前を入力してください：','部品 '+(library.length+1)); if(name===null) return;
  items.forEach((el,idx)=>{ const item={id:'lib_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), name:items.length>1?(name+' '+(idx+1)):name, createdAt:nowISO(), element:JSON.parse(JSON.stringify(el)) };
    delete item.element.id; delete item.element.x; delete item.element.y;
    if(item.element.points){ const xs=item.element.points.map(p=>p.x),ys=item.element.points.map(p=>p.y); const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2; item.element.points=item.element.points.map(p=>({x:p.x-cx,y:p.y-cy})); }
    library.push(item); });
  saveLibraryToStorage(); renderLibrary(); showToast('部品を保存しました'); }
function buildLibThumb(el){ const g=svg('g',{});
  const col=el.fillColor||el.color||'#888';
  try{
    if(el.type==='unit'){ g.appendChild(svg('path',{d:unitPath(18,20),fill:col,stroke:'#222','stroke-width':'1'})); }
    else if(el.type==='star'){ g.appendChild(svg('polygon',{points:starPoints(0,0,12),fill:col})); }
    else if(el.type==='symbol'){ const S=12,c=el.color||'#000';
      if(el.symbolType==='ship'){const W=S*1.5,H=S*0.65;g.appendChild(svg('path',{d:`M${-W/2},${-H/2} L${W*0.3},${-H/2} L${W/2},0 L${W*0.3},${H/2} L${-W/2},${H/2} Z`,fill:c}));}
      else if(el.symbolType==='base'){g.appendChild(svg('rect',{x:-S/2,y:-S/2,width:S,height:S,fill:c}));}
      else if(el.symbolType==='city'){g.appendChild(svg('circle',{cx:0,cy:0,r:S/2,fill:'none',stroke:c,'stroke-width':'2'}));g.appendChild(svg('circle',{cx:0,cy:0,r:S/4,fill:'none',stroke:c,'stroke-width':'2'}));}
      else if(el.symbolType==='battle'){const h=S/2;g.appendChild(svg('line',{x1:-h,y1:-h,x2:h,y2:h,stroke:c,'stroke-width':'3','stroke-linecap':'round'}));g.appendChild(svg('line',{x1:h,y1:-h,x2:-h,y2:h,stroke:c,'stroke-width':'3','stroke-linecap':'round'}));}
      else if(el.symbolType==='aircraft'){const R=S/2;g.appendChild(svg('ellipse',{cx:0,cy:0,rx:R*0.13,ry:R*0.95,fill:c}));g.appendChild(svg('polygon',{points:`${-R*0.13},${-R*0.15} ${-R*0.95},${R*0.35} ${-R*0.13},${R*0.3}`,fill:c}));g.appendChild(svg('polygon',{points:`${R*0.13},${-R*0.15} ${R*0.95},${R*0.35} ${R*0.13},${R*0.3}`,fill:c}));g.appendChild(svg('polygon',{points:`${-R*0.13},${R*0.6} ${-R*0.38},${R*0.95} ${-R*0.13},${R*0.85}`,fill:c}));g.appendChild(svg('polygon',{points:`${R*0.13},${R*0.6} ${R*0.38},${R*0.95} ${R*0.13},${R*0.85}`,fill:c}));}
      else{g.appendChild(svg('rect',{x:-S,y:-S*0.4,width:S*2,height:S*0.8,fill:c}));} }
    else if(el.type==='arrow'){ g.appendChild(svg('line',{x1:-14,y1:5,x2:14,y2:-5,stroke:el.color||'#E24B4A','stroke-width':'2.5','stroke-linecap':'round'})); }
    else{ g.appendChild(svg('rect',{x:-12,y:-7,width:24,height:14,fill:col,rx:'2'})); }
  }catch(e){}
  return g; }
function renderLibrary(){ const panel=document.getElementById('libPanel'); if(!panel) return; panel.innerHTML='';
  if(!library.length){ const n=document.createElement('div'); n.className='note'; n.textContent='保存された部品はありません。'; panel.appendChild(n); return; }
  library.forEach((item,i)=>{ const row=document.createElement('div'); row.className='lib-item';
    const thumb=document.createElementNS(SVGNS,'svg'); thumb.setAttribute('width','40'); thumb.setAttribute('height','40'); thumb.setAttribute('viewBox','-20 -20 40 40'); thumb.className='lib-thumb';
    try{ thumb.appendChild(buildLibThumb(item.element)); }catch(e){}
    const nm=document.createElement('span'); nm.className='lib-name'; nm.textContent=item.name;
    const del=document.createElement('button'); del.className='lib-del'; del.textContent='✕'; del.title='削除';
    del.onclick=e=>{ e.stopPropagation(); library.splice(i,1); saveLibraryToStorage(); renderLibrary(); };
    row.append(thumb,nm,del); row.onclick=()=>placeFromLibrary(item); panel.appendChild(row); }); }
function placeFromLibrary(item){ pushUndo(); const el=JSON.parse(JSON.stringify(item.element)); el.id=uid(); el.name=item.name;
  el.x=0.5; el.y=0.5; if(el.type==='arrow'&&el.points) el.points=el.points.map(p=>({x:0.5+p.x,y:0.5+p.y}));
  layerElements.push(el); selectedIds=[el.id]; setTool('select'); renderAll(); autosave(); showToast('配置しました。ドラッグで移動できます。'); }
function exportLibrary(){ if(!library.length){ showToast('ライブラリが空です'); return; }
  const blob=new Blob([JSON.stringify({version:'1.0',items:library},null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='takeru_library_'+stamp()+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
function importLibrary(ev){ const file=ev.target.files[0]; ev.target.value=''; if(!file) return;
  const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); let added=0;
    (data.items||[]).forEach(item=>{ if(!library.find(l=>l.id===item.id)){ library.push(item); added++; } });
    saveLibraryToStorage(); renderLibrary(); showToast(added+'件の部品を読み込みました（重複スキップ）'); }catch(e){ alert('ライブラリファイルの読み込みに失敗しました。'); } };
  r.readAsText(file); }

// ================= ズーム =================
function applyZoom(){
  stage.style.width =(STAGE_W*zoom)+'px';
  stage.style.height=(STAGE_H*zoom)+'px';
  const sl=$('zoomSlider'); if(sl) sl.value=Math.round(zoom*100);
  const dp=$('zoomDisp');  if(dp) dp.textContent=Math.round(zoom*100)+'%'; }
function setZoom(z){ zoom=Math.max(0.3,Math.min(2.0,parseFloat(z))); applyZoom(); }

init();
