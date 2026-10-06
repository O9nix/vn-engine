const viewport = document.getElementById('viewport');
const canvas = document.getElementById('canvas');
const svg = document.getElementById('lines');
const inspector = document.getElementById('inspector');
const inspBody = document.getElementById('inspBody');
if(inspBody){
  inspBody.addEventListener('input', () => { try{ markDirty(); }catch(_){} });
  inspBody.addEventListener('change', () => { try{ markDirty(); }catch(_){} });
}
const PALETTE = ['#5b7fa6','#a65b7f','#7fa65b','#a6935b','#8a5ba6','#5ba695'];
let nodes = [], scenes = [], assets = [], variables = [];
let projectTitle = '';
let projectBgm = '', projectBgmVol = 0.55, projectSfxVol = 1, projectMasterVol = 1;
let projectId = localStorage.getItem('vn_project_id') || ('p' + Math.random().toString(36).slice(2, 8));
localStorage.setItem('vn_project_id', projectId);

/** Upload image to VN server; returns relative URL or null if offline */
async function uploadAssetToServer(name, dataUrl, type){
  try{
    const res = await fetch('/api/assets', { credentials: 'same-origin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, name, dataUrl, type })
    });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if(!data.ok || !data.url) throw new Error(data.error || 'no url');
    return data.url;
  } catch(e){
    console.warn('Upload failed, keeping data URL:', e.message);
    return null;
  }
}

async function fetchRemoteAssetToServer(remoteUrl, name, type){
  try{
    const res = await fetch('/api/assets/fetch', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, url: remoteUrl, name: name || 'asset', type: type || 'char' })
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok || !data.ok || !data.url){
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    return data.url;
  }catch(e){
    console.warn('fetchRemoteAsset', remoteUrl, e.message);
    throw e;
  }
}

async function ensureServerUrl(src, name, type){
  if(!src) return src;
  if(src.startsWith('data:')){
    const url = await uploadAssetToServer(name || 'image', src, type);
    return url || src;
  }
  if(/^https?:\/\//i.test(src)){
    try{
      return await fetchRemoteAssetToServer(src, name, type);
    }catch(e){
      return null;
    }
  }
  return src;
}

async function hydrateRemoteAssets(options){
  options = options || {};
  const showNotify = options.notify !== false;
  const all = (assets || []).filter(a => a && a.src && (/^https?:\/\//i.test(a.src) || a.src.startsWith('data:')));
  if(!all.length) return { ok: 0, fail: 0, errors: [] };

  if(showNotify && typeof notify === 'function'){
    notify('Загрузка ' + all.length + ' внешних ассетов на сервер…', 'ok');
  }
  let ok = 0, fail = 0;
  const errors = [];
  const rewrite = (from, to) => {
    if(!from || !to || from === to) return;
    (assets||[]).forEach(a => { if(a.src === from) a.src = to; });
    (nodes||[]).forEach(n => {
      if(n.bg === from) n.bg = to;
      if(n.bgm === from) n.bgm = to;
      if(n.music === from) n.music = to;
      if(n.sfx === from) n.sfx = to;
      (n.sprites||[]).forEach(sp => { if(sp.src === from) sp.src = to; });
    });
    (scenes||[]).forEach(sc => {
      if(sc.bg === from) sc.bg = to;
      if(sc.bgm === from) sc.bgm = to;
      if(sc.music === from) sc.music = to;
    });
    if(typeof projectBgm !== 'undefined' && projectBgm === from) projectBgm = to;
  };

  for(const a of all){
    const oldSrc = a.src;
    try{
      let local = null;
      if(oldSrc.startsWith('data:')){
        local = await uploadAssetToServer(a.name || a.id, oldSrc, a.type);
      } else {
        local = await fetchRemoteAssetToServer(oldSrc, a.name || a.id, a.type);
      }
      if(local){
        rewrite(oldSrc, local);
        ok++;
      } else {
        fail++;
        errors.push((a.name || a.id) + ': не удалось сохранить');
      }
    }catch(e){
      fail++;
      errors.push((a.name || a.id) + ': ' + (e.message || 'ошибка'));
    }
  }

  if(typeof normalizeAssetTypes === 'function') try{ normalizeAssetTypes(); }catch(_){}
  if(typeof renderAssets === 'function') try{ renderAssets(); }catch(_){}
  if(typeof renderAbGrid === 'function') try{ renderAbGrid(); }catch(_){}
  try{ markDirty(); }catch(_){}

  if(showNotify && typeof notify === 'function'){
    if(fail === 0){
      notify('Ассеты на сервере: ' + ok + ' ок', 'ok');
    } else {
      notify('Ассеты: ' + ok + ' ок, ' + fail + ' с ошибкой. ' + errors.slice(0, 3).join('; '), 'err');
      console.warn('Asset hydrate errors', errors);
    }
  }
  return { ok, fail, errors };
}

/** Rewrite asset src everywhere it is referenced */
function rewriteAssetSrc(from, to){
  if(!from || !to || from === to) return;
  (assets||[]).forEach(a => { if(a.src === from) a.src = to; });
  (nodes||[]).forEach(n => {
    if(n.bg === from) n.bg = to;
    if(n.bgm === from) n.bgm = to;
    if(n.music === from) n.music = to;
    if(n.sfx === from) n.sfx = to;
    (n.sprites||[]).forEach(sp => { if(sp.src === from) sp.src = to; });
  });
  (scenes||[]).forEach(sc => {
    if(sc.bg === from) sc.bg = to;
    if(sc.bgm === from) sc.bgm = to;
    if(sc.music === from) sc.music = to;
  });
  if(typeof projectBgm !== 'undefined' && projectBgm === from) projectBgm = to;
}

function isBrokenAsset(a){
  if(!a) return false;
  if(a.error || a.remoteFailed) return true;
  // external http(s) still not on our server after import attempt
  if(a.src && /^https?:\/\//i.test(a.src)) return true;
  if(a.src && a.src.startsWith('data:')) return true;
  return false;
}

/** Replace asset content keeping the same id/name/type — from File or URL */
async function replaceAssetContent(assetId, opts){
  opts = opts || {};
  const a = (assets||[]).find(x => x.id === assetId);
  if(!a){
    if(typeof notify === 'function') notify('Ассет не найден', 'err');
    return false;
  }
  const oldSrc = a.src;
  let local = null;
  try{
    if(opts.file){
      const dataUrl = await fileToDataURL(opts.file);
      local = await uploadAssetToServer(opts.file.name || a.name || a.id, dataUrl, a.type);
      if(!local) local = dataUrl; // fallback keep data if upload fails but allow local preview
    } else if(opts.url){
      const url = String(opts.url).trim();
      if(!url) throw new Error('Пустой URL');
      if(/^https?:\/\//i.test(url)){
        local = await fetchRemoteAssetToServer(url, a.name || a.id, a.type);
      } else {
        local = url; // already /assets/...
      }
    } else {
      throw new Error('Нужен файл или URL');
    }
    if(!local) throw new Error('Не удалось загрузить замену');
    rewriteAssetSrc(oldSrc, local);
    a.src = local;
    a.error = false;
    a.errorMsg = '';
    a.remoteFailed = false;
    try{ markDirty(); }catch(_){}
    if(typeof renderAssetBrowser === 'function') renderAssetBrowser();
    else if(typeof renderAbGrid === 'function') renderAbGrid();
    if(typeof renderAssets === 'function') try{ renderAssets(); }catch(_){}
    if(typeof notify === 'function') notify('Ассет «' + (a.name||a.id) + '» заменён', 'ok');
    return true;
  }catch(e){
    a.error = true;
    a.errorMsg = e.message || 'ошибка замены';
    if(typeof renderAbGrid === 'function') renderAbGrid();
    if(typeof notify === 'function') notify('Замена «' + (a.name||a.id) + '»: ' + (e.message||'ошибка'), 'err');
    return false;
  }
}

function openReplaceAssetDialog(assetId){
  const a = (assets||[]).find(x => x.id === assetId);
  if(!a) return;
  // remove previous
  const prev = document.getElementById('abReplaceDlg');
  if(prev) prev.remove();
  const dlg = document.createElement('div');
  dlg.id = 'abReplaceDlg';
  dlg.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px';
  dlg.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--edge);border-radius:12px;padding:16px 18px;max-width:400px;width:100%;box-shadow:0 16px 48px rgba(0,0,0,.5)">
      <div style="font-family:Georgia,serif;font-style:italic;color:var(--rose);margin-bottom:6px">Заменить ассет</div>
      <div style="font-size:12px;color:var(--dim);margin-bottom:10px">«${esc(a.name||a.id)}» · ${esc(abTypeLabel(a.type, a.src))}${a.errorMsg ? '<br><span style="color:var(--rose)">ошибка: '+esc(a.errorMsg)+'</span>' : ''}</div>
      <label style="font-size:11px;color:var(--dim)">Файл с компьютера</label>
      <input type="file" id="abReplaceFile" style="width:100%;margin:4px 0 10px;font-size:12px">
      <label style="font-size:11px;color:var(--dim)">Или URL</label>
      <input type="text" id="abReplaceUrl" placeholder="https://… или /assets/…" style="width:100%;margin:4px 0 12px;background:#0f0c18;color:var(--ink);border:1px solid var(--edge);border-radius:6px;padding:7px 9px;font-size:12px">
      <div style="display:flex;gap:8px">
        <button type="button" class="tb" id="abReplaceGo" style="flex:1">Заменить</button>
        <button type="button" class="tb" id="abReplaceCancel" style="flex:1">Отмена</button>
      </div>
    </div>`;
  document.body.appendChild(dlg);
  const close = () => dlg.remove();
  dlg.addEventListener('click', e => { if(e.target === dlg) close(); });
  dlg.querySelector('#abReplaceCancel').onclick = close;
  dlg.querySelector('#abReplaceGo').onclick = async () => {
    const fileInp = dlg.querySelector('#abReplaceFile');
    const urlInp = dlg.querySelector('#abReplaceUrl');
    const file = fileInp.files && fileInp.files[0];
    const url = (urlInp.value || '').trim();
    if(!file && !url){
      if(typeof notify === 'function') notify('Выберите файл или вставьте URL', 'err');
      return;
    }
    dlg.querySelector('#abReplaceGo').disabled = true;
    dlg.querySelector('#abReplaceGo').textContent = 'Загрузка…';
    await replaceAssetContent(assetId, file ? { file } : { url });
    close();
  };
}

let counter = 1, sceneCounter = 1, assetCounter = 1;
let zoom = 1, panX = 60, panY = 20;
let selectedId = null;   // node id
let selectedSceneId = null; // scene id for scene inspector
const uid = () => 'n' + (counter++);
const aid = () => 'a' + (assetCounter++);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/* 3×3 sprite slots: x% left, y% from bottom — point = anchor of sprite */
const SPRITE_SLOTS = {
  'top-left':     { x: 18, y: 62 },
  'top':          { x: 50, y: 62 },
  'top-right':    { x: 82, y: 62 },
  'left':         { x: 18, y: 38 },
  'center':       { x: 50, y: 38 },
  'right':        { x: 82, y: 38 },
  'bottom-left':  { x: 18, y: 0 },
  'bottom':       { x: 50, y: 0 },
  'bottom-right': { x: 82, y: 0 },
  'bl': { x: 18, y: 0 }, 'bc': { x: 50, y: 0 }, 'br': { x: 82, y: 0 },
  'ml': { x: 18, y: 38 }, 'mc': { x: 50, y: 38 }, 'mr': { x: 82, y: 38 },
  'tl': { x: 18, y: 62 }, 'tc': { x: 50, y: 62 }, 'tr': { x: 82, y: 62 }
};
function slotXY(pos){
  const p = SPRITE_SLOTS[pos] || SPRITE_SLOTS['bottom'] || { x: 50, y: 0 };
  return { x: p.x, y: p.y };
}
/** нижний ряд — якорь в ногах; иначе якорь в центре картинки */
function isFloorAnchor(pos, y){
  if(pos && /^(bottom|bl|bc|br)(-|$)/.test(pos) || pos === 'bottom-left' || pos === 'bottom-right' || pos === 'bottom')
    return true;
  if(pos && SPRITE_SLOTS[pos] && SPRITE_SLOTS[pos].y === 0) return true;
  if((pos == null || pos === 'custom') && y != null && Number(y) <= 4) return true;
  return false;
}
function spriteAnchorTransform(pos, scale, y){
  const sc = scale != null ? Number(scale) : 1;
  if(isFloorAnchor(pos, y)){
    return { transform: `translateX(-50%) scale(${sc})`, origin: 'center bottom' };
  }
  // центр спрайта = точка (left, bottom)
  return { transform: `translate(-50%, 50%) scale(${sc})`, origin: 'center center' };
}
function bgFitCss(fit){
  if(fit === 'contain') return 'contain';
  if(fit === 'fill' || fit === 'stretch') return '100% 100%';
  if(fit === 'actual' || fit === 'auto') return 'auto';
  return 'cover'; // cover default
}
function applySceneBgStyle(el, bg, fit, pos){
  if(!el) return;
  fit = fit || 'cover';
  pos = pos || 'center';
  if(!bg){
    el.style.background = '#241c38';
    el.style.backgroundImage = 'none';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.backgroundRepeat = '';
    return;
  }
  if(String(bg).startsWith('#')){
    el.style.background = bg;
    el.style.backgroundImage = 'none';
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.backgroundRepeat = '';
    return;
  }
  el.style.backgroundColor = '#241c38';
  el.style.backgroundImage = 'url("' + String(bg).replace(/"/g, '\\"') + '")';
  el.style.backgroundSize = bgFitCss(fit);
  el.style.backgroundPosition = pos;
  el.style.backgroundRepeat = (fit === 'actual' || fit === 'auto') ? 'repeat' : 'no-repeat';
}

/** In-editor notifications (replaces alert) */
function notify(message, type, ms){
  type = type || 'info'; // info | ok | err
  ms = ms == null ? (type === 'err' ? 5500 : 3200) : ms;
  let host = document.getElementById('vnToastHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'vnToastHost';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'vn-toast ' + type;
  const msg = document.createElement('div');
  msg.className = 'vn-toast-msg';
  msg.textContent = String(message == null ? '' : message);
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'vn-toast-x';
  x.setAttribute('aria-label', 'Закрыть');
  x.textContent = '×';
  el.appendChild(msg);
  el.appendChild(x);
  host.appendChild(el);
  let closed = false;
  const close = () => {
    if(closed) return;
    closed = true;
    el.classList.add('out');
    setTimeout(() => el.remove(), 280);
  };
  x.onclick = close;
  if(ms > 0) setTimeout(close, ms);
  return { close };
}
function notifyConfirm(message){
  // lightweight modal confirm inside editor
  return new Promise(resolve => {
    let host = document.getElementById('vnToastHost');
    if(!host){
      host = document.createElement('div');
      host.id = 'vnToastHost';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'vn-toast info';
    el.style.pointerEvents = 'auto';
    el.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'vn-toast-msg';
    msg.textContent = String(message);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;margin-top:8px;width:100%';
    const yes = document.createElement('button');
    yes.className = 'tb';
    yes.textContent = 'Да';
    yes.style.flex = '1';
    const no = document.createElement('button');
    no.className = 'tb';
    no.textContent = 'Нет';
    no.style.flex = '1';
    row.appendChild(yes);
    row.appendChild(no);
    el.appendChild(msg);
    el.appendChild(row);
    host.appendChild(el);
    const done = (v) => { el.classList.add('out'); setTimeout(() => el.remove(), 280); resolve(v); };
    yes.onclick = () => done(true);
    no.onclick = () => done(false);
  });
}

function syncSpriteInspector(node){
  if(!node) return;
  refreshNodeCard(node);
  if(typeof selectedId !== 'undefined' && selectedId === node.id && typeof renderInspSprites === 'function'){
    try { renderInspSprites(node); } catch(_){}
  }
}

const isImageSrc = (u) => !!u && !String(u).startsWith('#') && (
  String(u).startsWith('data:image') || String(u).startsWith('blob:') ||
  String(u).startsWith('http://') || String(u).startsWith('https://') ||
  String(u).startsWith('/') || /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(String(u))
);
const hexA = (hex,a) => { const n=parseInt(hex.slice(1),16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; };

const OPS_NUM = [['eq','='],['neq','≠'],['gt','>'],['gte','≥'],['lt','<'],['lte','≤']];
const OPS_BOOL = [['eq','='],['neq','≠']];
const OPS_STR = [['eq','='],['neq','≠']];
const EFF_OPS = [['set','='],['add','+'],['sub','−'],['toggle','⇄']];

function varById(id){ return variables.find(v => v.id === id); }
function varOptions(selected){
  return '<option value="">— переменная —</option>' +
    variables.map(v => `<option value="${esc(v.id)}" ${selected===v.id?'selected':''}>${esc(v.name||v.id)} (${v.type})</option>`).join('');
}
function opsForType(type, selected){
  const list = type==='number' ? OPS_NUM : (type==='bool' ? OPS_BOOL : OPS_STR);
  return list.map(([k,l]) => `<option value="${k}" ${selected===k?'selected':''}>${l}</option>`).join('');
}
function effOpsHtml(selected){
  return EFF_OPS.map(([k,l]) => `<option value="${k}" ${selected===k?'selected':''}>${l}</option>`).join('');
}
function emptyCond(){ return { var:'', op:'eq', value:'' }; }
function emptyEff(){ return { var:'', op:'add', value:1 }; }

function renderVarsPanel(){
  const wrap = document.getElementById('varsList');
  if(!wrap) return;
  wrap.innerHTML = '';
  if(!variables.length){
    wrap.innerHTML = '<div class="empty-hint" style="padding:12px">Нет переменных. Добавьте, например «Доверие Юки».</div>';
    return;
  }
  variables.forEach((v, i) => {
    const row = document.createElement('div');
    row.className = 'var-row';
    row.innerHTML = `
      <input class="vName" value="${esc(v.name)}" placeholder="Название" style="flex:1.4">
      <select class="vType" style="flex:0.8">
        <option value="number" ${v.type==='number'?'selected':''}>число</option>
        <option value="bool" ${v.type==='bool'?'selected':''}>да/нет</option>
        <option value="string" ${v.type==='string'?'selected':''}>строка</option>
      </select>
      <input class="vDef" value="${esc(String(v.default ?? ''))}" placeholder="default" style="flex:0.7">
      <button class="small vDel">✕</button>`;
    row.querySelector('.vName').oninput = e => { v.name = e.target.value; };
    row.querySelector('.vType').onchange = e => { v.type = e.target.value; };
    row.querySelector('.vDef').oninput = e => {
      const t = v.type;
      let val = e.target.value;
      if(t==='number') val = Number(val) || 0;
      else if(t==='bool') val = val === 'true' || val === '1';
      v.default = val;
    };
    row.querySelector('.vDel').onclick = () => { variables.splice(i,1); renderVarsPanel(); };
    wrap.appendChild(row);
  });
}


function applyTransform(){
  canvas.style.transform = `translate(${panX}px,${panY}px) scale(${zoom})`;
  document.getElementById('zoomLabel').textContent = Math.round(zoom*100) + '%';
}
function zoomAt(mx, my, factor){
  const nz = Math.min(2.2, Math.max(0.25, zoom*factor));
  const wx = (mx - panX) / zoom, wy = (my - panY) / zoom;
  panX = mx - wx*nz; panY = my - wy*nz; zoom = nz;
  applyTransform();
}
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  const r = viewport.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.1 : 0.9);
}, {passive:false});
document.getElementById('zoomIn').onclick = () => zoomAt(viewport.clientWidth/2, viewport.clientHeight/2, 1.2);
document.getElementById('zoomOut').onclick = () => zoomAt(viewport.clientWidth/2, viewport.clientHeight/2, 0.8);
document.getElementById('zoomReset').onclick = () => { zoom=1; panX=60; panY=20; applyTransform(); };

viewport.addEventListener('pointerdown', e => {
  if(e.target.closest('.node') || e.target.closest('.scene-header') || e.target.closest('.scene-handle')) return;
  selectNothing();
  viewport.classList.add('panning');
  const sx=e.clientX, sy=e.clientY, ox=panX, oy=panY;
  function move(ev){ panX=ox+(ev.clientX-sx); panY=oy+(ev.clientY-sy); applyTransform(); }
  function up(){ viewport.classList.remove('panning'); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); }
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
});

function selectNothing(){
  selectedId = null; selectedSceneId = null;
  document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.scene-bg.selected, .scene-header.selected').forEach(el => el.classList.remove('selected'));
  inspector.classList.remove('open');
  viewport.classList.remove('has-inspector');
}
function openInspector(){
  inspector.classList.add('open');
  viewport.classList.add('has-inspector');
}
function selectNode(id){
  selectedId = id; selectedSceneId = null;
  document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.scene-bg.selected, .scene-header.selected').forEach(el => el.classList.remove('selected'));
  if(!id){ selectNothing(); return; }
  const el = canvas.querySelector(`.node[data-id="${id}"]`);
  if(el) el.classList.add('selected');
  openInspector();
  renderNodeInspector();
}
function selectScene(id){
  selectedSceneId = id; selectedId = null;
  document.querySelectorAll('.node.selected').forEach(el => el.classList.remove('selected'));
  document.querySelectorAll('.scene-bg.selected, .scene-header.selected').forEach(el => el.classList.remove('selected'));
  const s = scenes.find(x => x.id === id);
  if(s && s._els){
    if(s._els.bg) s._els.bg.classList.add('selected');
    if(s._els.header) s._els.header.classList.add('selected');
  }
  openInspector();
  renderSceneInspector();
}
document.getElementById('closeInsp').onclick = () => selectNothing();

function nodeLabel(id){
  const n = nodes.find(x => x.id === id);
  return n ? (n.title || n.id) : (id || '—');
}
function sceneOfNode(node){
  return scenes.find(s => s.id === node.sceneId) || null;
}

/* ---- scene inspector: name + background ---- */
function renderSceneInspector(){
  const s = scenes.find(x => x.id === selectedSceneId);
  if(!s){ inspBody.innerHTML = '<div class="empty-hint">Сцена не найдена</div>'; return; }
  document.getElementById('inspTitle').textContent = '🎬 ' + (s.name || 'Сцена');
  const bg = s.bg || '';
  const bgmVal = s.bgm || s.music || '';
  const bgmVolPct = Math.round((s.bgmVol != null ? s.bgmVol : 0.55) * 100);
  inspBody.innerHTML = `
    <div class="insp-section">
      <label>Название сцены</label>
      <input id="sName" value="${esc(s.name)}">
    </div>
    <div class="insp-section">
      <label>🖼 Фон сцены</label>
      <p class="hint" style="margin:0 0 8px">Общий фон для всех блоков сцены. JPG, PNG, WebP, <b>GIF</b>.</p>
      <div class="insp-row" style="margin-bottom:6px">
        <input type="color" id="sBgColor" value="${bg.startsWith('#')?bg:'#1c2b3a'}">
        <input type="text" id="sBgUrl" value="${esc(bg)}" placeholder="#цвет или URL / .gif">
      </div>
      <select id="sBgAsset">${assetOptions('bg')}</select>
      <label style="margin-top:10px">Растягивание</label>
      <select id="sBgFit">
        <option value="cover">cover — заполнить кадр</option>
        <option value="contain">contain — вписать</option>
        <option value="fill">fill — растянуть</option>
        <option value="actual">actual — исходный размер</option>
      </select>
      <label style="margin-top:8px">Позиция</label>
      <select id="sBgPos">
        <option value="center">Центр</option>
        <option value="top">Сверху</option>
        <option value="bottom">Снизу</option>
        <option value="left">Слева</option>
        <option value="right">Справа</option>
        <option value="top left">Верх-лево</option>
        <option value="top right">Верх-право</option>
        <option value="bottom left">Низ-лево</option>
        <option value="bottom right">Низ-право</option>
      </select>
      ${bg && !bg.startsWith('#') ? `<div style="margin-top:8px"><img src="${esc(bg)}" style="max-width:100%;max-height:100px;border-radius:6px;object-fit:contain;background:#0f0c18" alt=""></div>` : ''}
    </div>
    <div class="insp-section">
      <label>🎵 Музыка сцены (BGM)</label>
      <p class="hint" style="margin:0 0 8px">Звучит во <b>всех блоках</b> этой сцены. У блока поле BGM оставьте <b>пустым</b>, чтобы наследовать. Напишите <code>none</code> в блоке, чтобы выключить только там.</p>
      <select id="sBgm">
        <option value="">— нет / из проекта —</option>
        ${assetOptions('music')}
      </select>
      <input id="sBgmUrl" type="text" placeholder="пусто · URL · none · или перетащите 🎵" data-bgm-target="scene" value="${esc(bgmVal)}" style="margin-top:6px">
      <label style="margin-top:10px">Громкость: <span id="sBgmVolLbl">${bgmVolPct}</span>%</label>
      <input id="sBgmVol" type="range" min="0" max="100" value="${bgmVolPct}" style="width:100%">
      <div class="insp-row" style="margin-top:8px;gap:6px">
        <button type="button" class="tb" id="sBgmClear" style="flex:1">Очистить (наследовать проект)</button>
        <button type="button" class="tb" id="sBgmStop" style="flex:1">none (тишина в сцене)</button>
      </div>
    </div>
    <p class="hint">Клик по рамке сцены или ⚙ открывает эту панель. Аудио проекта — в «𝑥 Переменные».</p>
  `;
  inspBody.querySelector('#sName').oninput = e => {
    s.name = e.target.value;
    document.getElementById('inspTitle').textContent = '🎬 ' + s.name;
    if(s._els) s._els.header.querySelector('input').value = s.name;
    try{ markDirty(); }catch(_){}
  };
  const color = inspBody.querySelector('#sBgColor');
  const url = inspBody.querySelector('#sBgUrl');
  const asset = inspBody.querySelector('#sBgAsset');
  color.oninput = () => { s.bg = color.value; url.value = s.bg; refreshSceneBgChip(s); try{ markDirty(); }catch(_){} };
  url.oninput = () => { s.bg = url.value.trim() || ''; refreshSceneBgChip(s); try{ markDirty(); }catch(_){} };
  asset.onchange = () => {
    const a = assets.find(x => x.id === asset.value);
    if(a){ s.bg = a.src; url.value = a.src; refreshSceneBgChip(s); try{ markDirty(); }catch(_){} }
  };
  const fitEl = inspBody.querySelector('#sBgFit');
  const posEl = inspBody.querySelector('#sBgPos');
  if(fitEl){
    fitEl.value = s.bgFit || 'cover';
    fitEl.onchange = () => { s.bgFit = fitEl.value; refreshSceneBgChip(s); try{ markDirty(); }catch(_){} };
  }
  if(posEl){
    posEl.value = s.bgPos || 'center';
    posEl.onchange = () => { s.bgPos = posEl.value; refreshSceneBgChip(s); try{ markDirty(); }catch(_){} };
  }
  const sBgm = inspBody.querySelector('#sBgm');
  const sBgmUrl = inspBody.querySelector('#sBgmUrl');
  const sBgmVol = inspBody.querySelector('#sBgmVol');
  const sBgmVolLbl = inspBody.querySelector('#sBgmVolLbl');
  if(sBgm && bgmVal){
    const opt = [...sBgm.options].find(o => {
      if(!o.value) return false;
      const a = assets.find(x => x.id === o.value);
      return (a && a.src === bgmVal) || o.value === bgmVal;
    });
    if(opt) sBgm.value = opt.value;
  }
  if(sBgm){
    sBgm.onchange = () => {
      const a = assets.find(x => x.id === sBgm.value);
      s.bgm = a ? a.src : (sBgm.value || '');
      if(sBgmUrl) sBgmUrl.value = s.bgm;
      try{ markDirty(); }catch(_){}
    };
  }
  if(sBgmUrl){
    sBgmUrl.oninput = () => { s.bgm = sBgmUrl.value.trim(); try{ markDirty(); }catch(_){} };
  }
  if(sBgmVol){
    sBgmVol.oninput = () => {
      s.bgmVol = Number(sBgmVol.value) / 100;
      if(sBgmVolLbl) sBgmVolLbl.textContent = sBgmVol.value;
      try{ markDirty(); }catch(_){}
    };
  }
  const clearBtn = inspBody.querySelector('#sBgmClear');
  const stopBtn = inspBody.querySelector('#sBgmStop');
  if(clearBtn) clearBtn.onclick = () => {
    s.bgm = '';
    if(sBgmUrl) sBgmUrl.value = '';
    if(sBgm) sBgm.value = '';
    try{ markDirty(); }catch(_){}
  };
  if(stopBtn) stopBtn.onclick = () => {
    s.bgm = 'none';
    if(sBgmUrl) sBgmUrl.value = 'none';
    try{ markDirty(); }catch(_){}
  };
}

function refreshSceneBgChip(s){
  // update node cards in this scene to show/hide bg chip via rebuild meta
  nodes.filter(n => n.sceneId === s.id).forEach(n => refreshNodeCard(n));
}

/* ---- node inspector: text + transitions; sprites folded ---- */
function renderNodeInspector(){
  const node = nodes.find(n => n.id === selectedId);
  if(!node){ inspBody.innerHTML = '<div class="empty-hint">Выберите блок</div>'; return; }
  document.getElementById('inspTitle').textContent = node.title || node.id;
  const type = node.type === 'narration' ? 'narration' : 'say';
  const scene = sceneOfNode(node);
  const sceneBgHint = scene
    ? (scene.bg ? `Фон сцены: ${scene.bg.startsWith('#')?scene.bg:'картинка'}` : 'Фон сцены не задан')
    : 'Блок вне сцены';

  inspBody.innerHTML = `
    <div class="insp-section">
      <label>Название</label>
      <input id="iTitle" value="${esc(node.title||'')}" placeholder="${esc(node.id)}">
    </div>
    <div class="insp-section">
      <label>Тип</label>
      <select id="iType">
        <option value="say" ${type==='say'?'selected':''}>Реплика</option>
        <option value="narration" ${type==='narration'?'selected':''}>Описание</option>
      </select>
    </div>
    <div class="insp-section" id="iSpeakerWrap" style="${type==='narration'?'display:none':''}">
      <label>Говорящий</label>
      <input id="iSpeaker" value="${esc(node.speaker||'')}" placeholder="Имя">
    </div>
    <div class="insp-section">
      <label>Текст</label>
      <textarea id="iText" placeholder="Текст">${esc(node.text||'')}</textarea>
    </div>
    <div class="insp-section">
      <label>🎵 Аудио блока</label>
      <p class="hint" style="margin:0 0 6px">BGM переопределяет музыку сцены. SFX — один раз при входе.</p>
      <label>BGM <span style="color:var(--dim);font-weight:normal">(пусто = сцена/проект · none = стоп)</span></label>
      <select id="iBgm"><option value="">— наследовать —</option>${assetOptions('music')}</select>
      <input id="iBgmUrl" type="text" placeholder="пусто / URL / none · или перетащите 🎵" data-bgm-target="node" value="${esc(node.bgm||node.music||'')}">
      <label style="margin-top:6px">Громкость BGM блока: <span id="iBgmVolLbl">${Math.round((node.bgmVol!=null?node.bgmVol:0.55)*100)}</span>%</label>
      <input id="iBgmVol" type="range" min="0" max="100" value="${Math.round((node.bgmVol!=null?node.bgmVol:0.55)*100)}" style="width:100%">
      <label style="margin-top:6px">SFX при входе</label>
      <select id="iSfx">${assetOptions('sfx')}</select>
      <input id="iSfxUrl" type="text" placeholder="URL / id" value="${esc(node.sfx||'')}">
    </div>
    <div class="insp-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <label style="margin:0;flex:1">📝 Текст (с условиями)</label>
        <button class="small" id="iAddText">+ вариант</button>
      </div>
      <p class="hint" style="margin:0 0 6px">Если заданы варианты — берётся первый, у которого условие выполнено (последний без условия = запасной).</p>
      <div id="iTexts"></div>
    </div>
    <div class="insp-section">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <label style="margin:0;flex:1">🔗 Переходы</label>
        <button class="small" id="iAddChoice">+ вариант</button>
      </div>
      <div id="iChoices"></div>
      <div id="iPlainNext"></div>
    </div>
    <div class="insp-section">
      <p class="hint" style="margin:0">${esc(sceneBgHint)}. Фон задаётся в свойствах сцены (кнопка ⚙ на рамке).</p>
      <button type="button" class="details-toggle" id="toggleSprites">▶ Персонажи на кадре (${(node.sprites||[]).filter(s=>!s.hide).length})</button>
      <div class="details-box" id="spritesBox">
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <select id="quickSprite" style="flex:1">${assetOptions('char')}</select>
          <button class="small" id="iAddSprite">+</button>
        </div>
        <div id="iSprites"></div>
        <p class="hint">Сначала загрузите портреты в «Ассеты».</p>
      </div>
    </div>
  `;

  inspBody.querySelector('#iTitle').oninput = e => {
    node.title = e.target.value;
    document.getElementById('inspTitle').textContent = node.title || node.id;
    refreshNodeCard(node); refreshAllSelects();
  };
  inspBody.querySelector('#iType').onchange = e => {
    node.type = e.target.value === 'narration' ? 'narration' : 'say';
    if(node.type === 'narration') node.speaker = '';
    const w = inspBody.querySelector('#iSpeakerWrap');
    if(w) w.style.display = node.type === 'narration' ? 'none' : '';
    refreshNodeCard(node);
  };
  const spk = inspBody.querySelector('#iSpeaker');
  if(spk) spk.oninput = e => { node.speaker = e.target.value; refreshNodeCard(node); };
  inspBody.querySelector('#iText').oninput = e => { node.text = e.target.value; refreshNodeCard(node); refreshAllSelects(); };
  const iBgm = inspBody.querySelector('#iBgm');
  const iBgmUrl = inspBody.querySelector('#iBgmUrl');
  const iSfx = inspBody.querySelector('#iSfx');
  const iSfxUrl = inspBody.querySelector('#iSfxUrl');
  if(iBgm){
    const m = assets.find(a => a.type==='music' && (a.id === (node.bgm||node.music) || a.src === (node.bgm||node.music)));
    if(m) iBgm.value = m.id;
    iBgm.onchange = () => {
      const a = assets.find(x => x.id === iBgm.value);
      node.bgm = a ? a.src : '';
      if(iBgmUrl) iBgmUrl.value = node.bgm;
    };
  }
  if(iBgmUrl) iBgmUrl.oninput = () => { node.bgm = iBgmUrl.value.trim(); try{ markDirty(); }catch(_){} };
  const iBgmVol = inspBody.querySelector('#iBgmVol');
  const iBgmVolLbl = inspBody.querySelector('#iBgmVolLbl');
  if(iBgmVol){
    iBgmVol.oninput = () => {
      node.bgmVol = Number(iBgmVol.value) / 100;
      if(iBgmVolLbl) iBgmVolLbl.textContent = iBgmVol.value;
      try{ markDirty(); }catch(_){}
    };
  }
  if(iSfx){
    const m = assets.find(a => a.type==='sfx' && (a.id === node.sfx || a.src === node.sfx));
    if(m) iSfx.value = m.id;
    iSfx.onchange = () => {
      const a = assets.find(x => x.id === iSfx.value);
      node.sfx = a ? a.src : '';
      if(iSfxUrl) iSfxUrl.value = node.sfx;
    };
  }
  if(iSfxUrl) iSfxUrl.oninput = () => { node.sfx = iSfxUrl.value.trim(); };


  renderInspTexts(node);
  const addTextBtn = inspBody.querySelector('#iAddText');
  if(addTextBtn) addTextBtn.onclick = () => {
    if(!node.texts) node.texts = [];
    // seed from main text if empty
    if(!node.texts.length && node.text) node.texts.push({ text: node.text, condition: null });
    node.texts.push({ text: '', condition: null });
    renderInspTexts(node);
  };
  renderInspChoices(node);
  inspBody.querySelector('#iAddChoice').onclick = () => {
    node.choices.push({label:'', next:'', condition:null, effects:[]});
    node.next = '';
    renderInspChoices(node); refreshNodeCard(node); updateLines();
  };

  const box = inspBody.querySelector('#spritesBox');
  const tog = inspBody.querySelector('#toggleSprites');
  tog.onclick = () => {
    box.classList.toggle('open');
    const n = (node.sprites||[]).filter(s=>!s.hide).length;
    tog.textContent = (box.classList.contains('open') ? '▼' : '▶') + ' Персонажи на кадре (' + n + ')';
  };
  inspBody.querySelector('#iAddSprite').onclick = () => {
    if(!node.sprites) node.sprites = [];
    const sel = inspBody.querySelector('#quickSprite');
    const a = assets.find(x => x.id === sel.value);
    node.sprites.push({
      id: 's'+Date.now(),
      src: a ? a.src : '',
      emoji: (a && a.src) ? '' : '🙂',
      pos: 'center', hide: false, anim: 'fade', animOut: 'fade'
    });
    box.classList.add('open');
    renderInspSprites(node);
    refreshNodeCard(node);
    tog.textContent = '▼ Персонажи на кадре (' + node.sprites.filter(s=>!s.hide).length + ')';
  };
  renderInspSprites(node);
}

function renderInspSprites(node){
  const wrap = inspBody.querySelector('#iSprites');
  if(!wrap) return;
  wrap.innerHTML = '';
  if(!node.sprites) node.sprites = [];
  node.sprites.forEach((sp, i) => {
    const row = document.createElement('div');
    row.className = 'spr-line';
    const hasImg = isImageSrc(sp.src);
    row.innerHTML = `
      ${hasImg ? `<img src="${esc(sp.src)}">` : `<div class="em">${esc(sp.emoji||'🙂')}</div>`}
      <select class="spPos">
        <option value="top-left">↖ верх-лево</option>
        <option value="top">↑ верх</option>
        <option value="top-right">↗ верх-право</option>
        <option value="left">← центр-лево</option>
        <option value="center">● центр</option>
        <option value="right">→ центр-право</option>
        <option value="bottom-left">↙ низ-лево</option>
        <option value="bottom">↓ низ</option>
        <option value="bottom-right">↘ низ-право</option>
      </select>
      <button class="small rm">✕</button>`;
    const curPos = sp.pos || 'bottom';
    row.querySelector('.spPos').value = SPRITE_SLOTS[curPos] ? curPos : 'bottom';
    row.querySelector('.spPos').onchange = e => {
      sp.pos = e.target.value;
      const xy = slotXY(sp.pos);
      sp.x = xy.x; sp.y = xy.y;
      refreshNodeCard(node);
    };
    row.querySelector('.rm').onclick = () => {
      node.sprites.splice(i, 1);
      renderInspSprites(node); refreshNodeCard(node);
      const tog = inspBody.querySelector('#toggleSprites');
      if(tog) tog.textContent = (inspBody.querySelector('#spritesBox').classList.contains('open')?'▼':'▶') +
        ' Персонажи на кадре (' + node.sprites.filter(s=>!s.hide).length + ')';
    };
    wrap.appendChild(row);
  });
}


function renderInspTexts(node){
  const wrap = inspBody.querySelector('#iTexts');
  if(!wrap) return;
  wrap.innerHTML = '';
  if(!node.texts) node.texts = [];
  // If no alternatives, show hint only - main textarea is the default
  if(!node.texts.length){
    wrap.innerHTML = '<div class="empty-hint" style="padding:6px">Один текст выше. Нажмите «+ вариант», чтобы добавить условные реплики.</div>';
    return;
  }
  node.texts.forEach((t, i) => {
    const card = document.createElement('div');
    card.className = 'sub-card';
    const hasCond = t.condition && t.condition.var;
    card.innerHTML = `
      <div class="sub-label">Вариант ${i+1}${!hasCond && i===node.texts.length-1 ? ' (fallback)' : ''}</div>
      <textarea class="tText" rows="2" placeholder="Текст">${esc(t.text||'')}</textarea>
      <div class="cond-row" style="margin-top:6px">
        <select class="tVar">${varOptions(t.condition&&t.condition.var)}</select>
        <select class="tOp" style="flex:0.5"></select>
        <input class="tVal" placeholder="знач." value="${esc(t.condition&&t.condition.value!==undefined&&t.condition.value!==null?String(t.condition.value):'')}">
        <button class="small tRm">✕</button>
      </div>`;
    const ta = card.querySelector('.tText');
    const vSel = card.querySelector('.tVar');
    const oSel = card.querySelector('.tOp');
    const vInp = card.querySelector('.tVal');
    function syncOp(){
      const v = varById(vSel.value);
      oSel.innerHTML = opsForType(v?v.type:'number', (t.condition&&t.condition.op)||'eq');
    }
    syncOp();
    function write(){
      t.text = ta.value;
      if(!vSel.value){ t.condition = null; }
      else {
        let val = vInp.value;
        const v = varById(vSel.value);
        if(v&&v.type==='number') val = Number(val);
        else if(v&&v.type==='bool') val = val==='true'||val==='1';
        t.condition = { var: vSel.value, op: oSel.value||'eq', value: val };
      }
      refreshNodeCard(node);
    }
    ta.oninput = write;
    vSel.onchange = () => { syncOp(); write(); };
    oSel.onchange = write;
    vInp.oninput = write;
    card.querySelector('.tRm').onclick = () => {
      node.texts.splice(i,1);
      if(!node.texts.length) node.texts = [];
      renderInspTexts(node);
      refreshNodeCard(node);
    };
    wrap.appendChild(card);
  });
}

function renderInspChoices(node){
  const cWrap = inspBody.querySelector('#iChoices');
  const pWrap = inspBody.querySelector('#iPlainNext');
  if(!cWrap || !pWrap) return;
  cWrap.innerHTML = ''; pWrap.innerHTML = '';
  if(node.choices && node.choices.length){
    node.choices.forEach((c, i) => {
      if(!c.condition) c.condition = null;
      if(!c.effects) c.effects = [];
      const card = document.createElement('div');
      card.className = 'sub-card';
      const hasCond = c.condition && (c.condition.var || c.condition.all || c.condition.any || c.condition.not);
      const hasEff = c.effects && c.effects.length;
      card.innerHTML = `
        <div class="choice-row">
          <input class="cLabel" placeholder="Текст варианта" value="${esc(c.label||'')}">
          <select class="cNext">${optionsHtml()}</select>
          <button class="small cRm">✕</button>
        </div>
        <button type="button" class="details-toggle cToggleCond">${hasCond?'▼':'▶'} Условие показа</button>
        <div class="details-box ${hasCond?'open':''} cCondBox">
          <div class="cond-row">
            <select class="cCondVar">${varOptions(c.condition&&c.condition.var)}</select>
            <select class="cCondOp" style="flex:0.5"></select>
            <input class="cCondVal" placeholder="значение" value="${esc(c.condition&&c.condition.value!==undefined&&c.condition.value!==null?String(c.condition.value):'')}">
          </div>
          <button class="small cClearCond" style="margin-top:4px">Сбросить условие</button>
        </div>
        <button type="button" class="details-toggle cToggleEff">${hasEff?'▼':'▶'} Эффекты (${(c.effects||[]).length})</button>
        <div class="details-box ${hasEff?'open':''} cEffBox">
          <div class="cEffList"></div>
          <button class="small cAddEff" style="margin-top:4px">+ эффект</button>
        </div>`;
      const label = card.querySelector('.cLabel');
      const next = card.querySelector('.cNext');
      const rm = card.querySelector('.cRm');
      next.value = c.next || '';
      label.oninput = e => { c.label = e.target.value; refreshNodeCard(node); };
      next.onchange = e => { c.next = e.target.value; updateLines(); refreshNodeCard(node); };
      rm.onclick = () => { node.choices.splice(i,1); renderInspChoices(node); refreshNodeCard(node); updateLines(); };

      const condBox = card.querySelector('.cCondBox');
      const togCond = card.querySelector('.cToggleCond');
      togCond.onclick = () => {
        condBox.classList.toggle('open');
        togCond.textContent = (condBox.classList.contains('open')?'▼':'▶') + ' Условие показа';
      };
      const condVar = card.querySelector('.cCondVar');
      const condOp = card.querySelector('.cCondOp');
      const condVal = card.querySelector('.cCondVal');
      function syncCondOp(){
        const v = varById(condVar.value);
        const t = v ? v.type : 'number';
        const cur = (c.condition && c.condition.op) || 'eq';
        condOp.innerHTML = opsForType(t, cur);
      }
      syncCondOp();
      function writeCond(){
        if(!condVar.value){ c.condition = null; return; }
        let val = condVal.value;
        const v = varById(condVar.value);
        if(v && v.type==='number') val = Number(val);
        else if(v && v.type==='bool') val = val==='true' || val==='1';
        c.condition = { var: condVar.value, op: condOp.value || 'eq', value: val };
      }
      condVar.onchange = () => { syncCondOp(); writeCond(); };
      condOp.onchange = writeCond;
      condVal.oninput = writeCond;
      card.querySelector('.cClearCond').onclick = () => {
        c.condition = null; condVar.value = ''; condVal.value = ''; syncCondOp();
      };

      const effBox = card.querySelector('.cEffBox');
      const togEff = card.querySelector('.cToggleEff');
      const effList = card.querySelector('.cEffList');
      function renderEffs(){
        effList.innerHTML = '';
        (c.effects||[]).forEach((ef, ei) => {
          const er = document.createElement('div');
          er.className = 'eff-row';
          er.innerHTML = `
            <select class="eVar">${varOptions(ef.var)}</select>
            <select class="eOp" style="flex:0.4">${effOpsHtml(ef.op||'add')}</select>
            <input class="eVal" value="${esc(String(ef.value??''))}" style="flex:0.6">
            <button class="small eRm">✕</button>`;
          er.querySelector('.eVar').onchange = e => { ef.var = e.target.value; };
          er.querySelector('.eOp').onchange = e => { ef.op = e.target.value; };
          er.querySelector('.eVal').oninput = e => {
            let val = e.target.value;
            const v = varById(ef.var);
            if(v && v.type==='number') val = Number(val);
            else if(v && v.type==='bool') val = val==='true'||val==='1';
            ef.value = val;
          };
          er.querySelector('.eRm').onclick = () => {
            c.effects.splice(ei,1);
            renderEffs();
            togEff.textContent = (effBox.classList.contains('open')?'▼':'▶') + ' Эффекты (' + c.effects.length + ')';
          };
          effList.appendChild(er);
        });
      }
      renderEffs();
      togEff.onclick = () => {
        effBox.classList.toggle('open');
        togEff.textContent = (effBox.classList.contains('open')?'▼':'▶') + ' Эффекты (' + (c.effects||[]).length + ')';
      };
      card.querySelector('.cAddEff').onclick = () => {
        if(!c.effects) c.effects = [];
        c.effects.push(emptyEff());
        effBox.classList.add('open');
        renderEffs();
        togEff.textContent = '▼ Эффекты (' + c.effects.length + ')';
      };
      cWrap.appendChild(card);
    });
  } else {
    pWrap.innerHTML = `<label class="insp-label">Далее →</label><select id="iNext">${optionsHtml()}</select>`;
    const sel = pWrap.querySelector('#iNext');
    sel.value = node.next || '';
    sel.onchange = e => { node.next = e.target.value; updateLines(); refreshNodeCard(node); };
  }
}

function refreshAllSelects(){
  if(selectedId){ const n = nodes.find(x => x.id === selectedId); if(n) renderInspChoices(n); }
}

/* ---- assets ---- */
function renderAssets(){
  const grid = document.getElementById('assetGrid');
  grid.innerHTML = '';
  assets.forEach(a => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    const isData = (a.src||'').startsWith('data:');
    const short = isData ? 'data URL (локально)' : (a.src||'');
    card.innerHTML = `<button class="adel">✕</button><img src="${esc(a.src)}" alt="">
      <div class="aname">${esc(a.name)}</div>
      <div class="atype">${abTypeLabel(a.type, a.src)}${isData?' · не на сервере':''}</div>
      <div class="aname" title="${esc(a.src||'')}" style="color:var(--gold);font-size:9px">${esc(short.slice(0,36))}</div>`;
    card.querySelector('.adel').onclick = () => {
      assets = assets.filter(x => x.id !== a.id);
      renderAssets();
      if(selectedId) renderNodeInspector();
      if(selectedSceneId) renderSceneInspector();
    };
    grid.appendChild(card);
  });
}

/* ========== Asset browser (folders) ========== */
let abFolder = ''; // current path, '' = root
let assetFolders = []; // explicit folder paths

function normalizeFolder(p){
  return String(p || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}
function assetFolderOf(a){
  return normalizeFolder(a.folder || '');
}
function listAllFolders(){
  const set = new Set(assetFolders.map(normalizeFolder).filter(Boolean));
  assets.forEach(a => {
    const f = assetFolderOf(a);
    if(!f) return;
    const parts = f.split('/');
    let cur = '';
    parts.forEach(part => {
      cur = cur ? cur + '/' + part : part;
      set.add(cur);
    });
  });
  return [...set].sort((a,b) => a.localeCompare(b));
}
function childFolders(parent){
  parent = normalizeFolder(parent);
  const all = listAllFolders();
  return all.filter(f => {
    if(parent){
      if(!f.startsWith(parent + '/')) return false;
      const rest = f.slice(parent.length + 1);
      return rest && !rest.includes('/');
    }
    return f && !f.includes('/');
  });
}
function assetsInFolder(folder, typeFilter, search){
  folder = normalizeFolder(folder);
  const q = (search || '').toLowerCase();
  return assets.filter(a => {
    if(assetFolderOf(a) !== folder) return false;
    if(typeFilter && a.type !== typeFilter) return false;
    if(q && !(a.name||'').toLowerCase().includes(q) && !(a.id||'').toLowerCase().includes(q)) return false;
    return true;
  });
}
function openAssetBrowser(){
  document.getElementById('assetBrowser').classList.add('open');
  document.body.classList.add('ab-open');
  initAbResize();
  renderAssetBrowser();
}
function closeAssetBrowser(){
  document.getElementById('assetBrowser').classList.remove('open');
  document.body.classList.remove('ab-open');
}

function setAbHeight(h){
  h = Math.max(120, Math.min(window.innerHeight * 0.85, h));
  document.documentElement.style.setProperty('--ab-h', h + 'px');
  try { localStorage.setItem('vn-ab-h', String(h)); } catch(_){}
}
function initAbResize(){
  const handle = document.getElementById('abResize');
  if(!handle || handle._bound) return;
  handle._bound = true;
  let startY = 0, startH = 0;
  handle.addEventListener('pointerdown', e => {
    if(e.button != null && e.button !== 0) return;
    e.preventDefault();
    handle.classList.add('dragging');
    startY = e.clientY;
    const panel = document.getElementById('assetBrowser');
    startH = panel.getBoundingClientRect().height;
    try { handle.setPointerCapture(e.pointerId); } catch(_){}
    const move = ev => {
      const dy = startY - ev.clientY; // drag up → taller
      setAbHeight(startH + dy);
    };
    const up = () => {
      handle.classList.remove('dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  try {
    const saved = localStorage.getItem('vn-ab-h');
    if(saved) setAbHeight(Number(saved));
  } catch(_){}
}

function renderAssetBrowser(){
  renderAbTree();
  renderAbPath();
  renderAbGrid();
}
function renderAbTree(){
  const tree = document.getElementById('abTree');
  if(!tree) return;
  const folders = listAllFolders();
  let html = `<div class="ab-folder ${abFolder===''?'active':''}" data-folder=""><span class="ic">📁</span> Корень</div>`;
  folders.forEach(f => {
    const depth = f.split('/').length - 1;
    const name = f.split('/').pop();
    const pad = 8 + depth * 12;
    html += `<div class="ab-folder ${abFolder===f?'active':''}" data-folder="${esc(f)}" style="padding-left:${pad}px"><span class="ic">📂</span> ${esc(name)}</div>`;
  });
  tree.innerHTML = html;
  tree.querySelectorAll('.ab-folder').forEach(el => {
    el.onclick = () => { abFolder = el.dataset.folder || ''; renderAssetBrowser(); };
    el.ondragover = e => { e.preventDefault(); el.classList.add('ab-drop-folder'); };
    el.ondragleave = () => el.classList.remove('ab-drop-folder');
    el.ondrop = e => {
      e.preventDefault();
      el.classList.remove('ab-drop-folder');
      const id = e.dataTransfer.getData('text/asset-id');
      if(!id) return;
      const a = assets.find(x => x.id === id);
      if(!a) return;
      a.folder = el.dataset.folder || '';
      renderAssetBrowser();
      if(typeof renderAssets === 'function') renderAssets();
    };
  });
}
function renderAbPath(){
  const el = document.getElementById('abPath');
  if(!el) return;
  const parts = abFolder ? abFolder.split('/') : [];
  let acc = '';
  let html = `<span class="crumb" data-folder="">Корень</span>`;
  parts.forEach(p => {
    acc = acc ? acc + '/' + p : p;
    html += ` <span style="opacity:.4">/</span> <span class="crumb" data-folder="${esc(acc)}">${esc(p)}</span>`;
  });
  el.innerHTML = html;
  el.querySelectorAll('.crumb').forEach(c => {
    c.onclick = () => { abFolder = c.dataset.folder || ''; renderAssetBrowser(); };
  });
}
function abFileExt(src){
  if(!src || typeof src !== 'string') return '';
  if(src.startsWith('data:')){
    const m = src.slice(5).match(/^[^/;]+\/([a-z0-9.+-]+)/i);
    return m ? m[1].replace('jpeg','jpg').replace('mpeg','mp3') : '';
  }
  try {
    const path = src.split('?')[0].split('#')[0];
    const m = path.match(/\.([a-z0-9]{2,5})$/i);
    return m ? m[1].toLowerCase() : '';
  } catch(_){ return ''; }
}
function abTypeLabel(t, src){
  const base = t==='bg'?'фон':t==='music'?'музыка':t==='sfx'?'звук':'персонаж';
  const ext = abFileExt(src);
  return ext ? (base + ' · .' + ext) : base;
}
function renderAbGrid(){
  const grid = document.getElementById('abGrid');
  if(!grid) return;
  const typeF = (document.getElementById('abTypeFilter')||{}).value || '';
  const search = (document.getElementById('abSearch')||{}).value || '';
  // subfolders as items
  const subs = childFolders(abFolder);
  let html = '';
  subs.forEach(f => {
    const name = f.split('/').pop();
    html += `<div class="ab-item ab-subfolder" data-folder="${esc(f)}" draggable="false">
      <div class="ab-ico">📁</div>
      <div class="ab-name">${esc(name)}</div>
      <div class="ab-type">папка</div>
    </div>`;
  });
  const list = assetsInFolder(abFolder, typeF, search);
  list.forEach(a => {
    const isAud = a.type==='music'||a.type==='sfx';
    const preview = isAud
      ? `<div class="ab-ico">${a.type==='music'?'🎵':'🔊'}</div>`
      : `<img src="${esc(a.src)}" alt="" draggable="false">`;
    const broken = isBrokenAsset(a);
    const typeLbl = abTypeLabel(a.type, a.src) + (broken ? ' · ⚠' : '');
    const title = broken ? ((a.errorMsg || 'не на сервере / ошибка загрузки') + ' — нажмите ↻ чтобы заменить') : a.name;
    html += `<div class="ab-item${broken ? ' broken' : ''}" draggable="true" data-id="${esc(a.id)}" title="${esc(title)}">
      <button type="button" class="ab-replace" data-id="${esc(a.id)}" title="Заменить файл">↻</button>
      <button type="button" class="ab-del" data-id="${esc(a.id)}">✕</button>
      ${preview}
      <div class="ab-name">${esc(a.name)}</div>
      <div class="ab-type">${esc(typeLbl)}</div>
    </div>`;
  });
  if(!subs.length && !list.length){
    html = `<div style="grid-column:1/-1;color:var(--dim);font-size:13px;padding:24px;text-align:center">Пусто. Создайте папку или загрузите файлы.</div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.ab-subfolder').forEach(el => {
    el.onclick = () => { abFolder = el.dataset.folder || ''; renderAssetBrowser(); };
  });
  grid.querySelectorAll('.ab-item[data-id]').forEach(el => {
    el.addEventListener('dragstart', e => {
      el.classList.add('dragging');
      e.dataTransfer.setData('text/asset-id', el.dataset.id);
      e.dataTransfer.effectAllowed = 'copyMove';
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  });
  grid.querySelectorAll('.ab-del').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      assets = assets.filter(x => x.id !== btn.dataset.id);
      renderAssetBrowser();
      if(typeof renderAssets === 'function') renderAssets();
      try{ markDirty(); }catch(_){}
    };
  });
  grid.querySelectorAll('.ab-replace').forEach(btn => {
    btn.onclick = e => {
      e.stopPropagation();
      openReplaceAssetDialog(btn.dataset.id);
    };
  });
  // double-click broken item → replace
  grid.querySelectorAll('.ab-item.broken').forEach(el => {
    el.addEventListener('dblclick', e => {
      e.stopPropagation();
      openReplaceAssetDialog(el.dataset.id);
    });
  });
}
function abNewFolder(){
  const name = prompt('Имя папки', 'персонажи');
  if(!name) return;
  const safe = name.trim().replace(/[\\/]+/g, '-').replace(/[^\w\u0400-\u04FF\- ]+/g, '');
  if(!safe) return;
  const path = normalizeFolder(abFolder ? abFolder + '/' + safe : safe);
  if(!assetFolders.includes(path)) assetFolders.push(path);
  abFolder = path;
  renderAssetBrowser();
  if(typeof notify === 'function') notify('Папка «' + path + '» создана', 'ok');
}
function abAddByUrl(){
  try{ markDirty(); }catch(_){}

  const url = ((document.getElementById('abUrl')||{}).value || '').trim();
  if(!url){
    if(typeof notify === 'function') notify('Вставьте URL', 'err');
    return;
  }
  let type = (document.getElementById('abAddType')||{}).value || 'char';
  // auto-detect by extension
  if(/\.(mp3|ogg|wav|m4a|aac|flac)(\?|$)/i.test(url)) type = type === 'sfx' ? 'sfx' : 'music';
  else if(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url) && (type==='music'||type==='sfx')) type = 'char';
  const name = url.split('/').pop().split('?')[0].replace(/\.[^.]+$/, '') || 'asset';
  assets.push({ id: aid(), name, type, src: url, folder: abFolder || '' });
  const u = document.getElementById('abUrl');
  if(u) u.value = '';
  renderAssetBrowser();
  if(typeof renderAssets === 'function') renderAssets();
  if(typeof notify === 'function') notify('Добавлено по URL: ' + name, 'ok');
}
async function abUploadFiles(files){
  let type = (document.getElementById('abAddType')||{}).value || 'char';
  if(!type) type = 'char';
  for(const f of files){
    const isImg = f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.name);
    const isAud = f.type.startsWith('audio/') || /\.(mp3|ogg|wav|m4a|aac|flac|webm)$/i.test(f.name);
    if(!isImg && !isAud) continue;
    let useType = type;
    if(isAud && type !== 'music' && type !== 'sfx') useType = 'music';
    if(isImg && (type === 'music' || type === 'sfx')) useType = 'char';
    const name = f.name.replace(/\.[^.]+$/,'');
    const dataUrl = await fileToDataURL(f);
    let src = dataUrl;
    const remote = await uploadAssetToServer(f.name, dataUrl, useType);
    if(remote) src = remote;
    assets.push({ id: aid(), name, type: useType, src, folder: abFolder || '' });
  }
  renderAssetBrowser();
  if(typeof renderAssets === 'function') renderAssets();
}

/** Drop asset onto node: char→sprite, bg→ignored on node, music/sfx→node audio */
function applyAssetToNode(node, asset){
  if(!node || !asset) return;
  if(asset.type === 'char' || (!asset.type && asset.src && !AudioBus?.isAudioUrl?.(asset.src))){
    if(!node.sprites) node.sprites = [];
    node.sprites.push({
      id: asset.id || ('sp' + Date.now()),
      src: asset.src,
      emoji: '',
      pos: 'bottom',
      hide: false,
      anim: 'fade',
      animOut: 'fade'
    });
    if(typeof notify === 'function') notify('Спрайт «' + asset.name + '» → блок «' + (node.title||node.id) + '»', 'ok');
  } else if(asset.type === 'bg'){
    // set scene bg if node in scene
    const sc = scenes.find(s => s.id === node.sceneId);
    if(sc){ sc.bg = asset.src; if(typeof notify === 'function') notify('Фон сцены: ' + asset.name, 'ok'); }
  } else if(asset.type === 'music'){
    node.bgm = asset.src;
    if(typeof notify === 'function') notify('🎵 BGM блока «' + (node.title||node.id) + '»: ' + asset.name, 'ok');
  } else if(asset.type === 'sfx'){
    node.sfx = asset.src;
    if(typeof notify === 'function') notify('SFX блока: ' + asset.name, 'ok');
  }
  try{ markDirty(); }catch(_){}
  if(selectedId === node.id && typeof renderNodeInspector === 'function') renderNodeInspector();
  if(typeof refreshNodeCard === 'function') refreshNodeCard(node);
  if(selectedId === node.id && typeof renderNodeInspector === 'function') renderNodeInspector();
}
function applyAssetToScene(scene, asset){
  if(!scene || !asset) return;
  if(asset.type === 'bg'){
    scene.bg = asset.src;
    if(typeof notify === 'function') notify('🖼 Фон сцены «' + (scene.name||scene.id) + '»: ' + asset.name, 'ok');
  } else if(asset.type === 'music'){
    scene.bgm = asset.src;
    if(typeof notify === 'function') notify('🎵 BGM сцены «' + (scene.name||scene.id) + '»: ' + asset.name, 'ok');
  } else if(asset.type === 'sfx'){
    if(typeof notify === 'function') notify('SFX обычно вешают на блок, не на сцену', 'err');
    return;
  } else {
    if(typeof notify === 'function') notify('На сцену: фон или музыка', 'err');
    return;
  }
  try{ markDirty(); }catch(_){}
  if(selectedSceneId === scene.id && typeof renderSceneInspector === 'function') renderSceneInspector();
}

function applyAssetToBgmField(target, asset){
  if(!asset || asset.type !== 'music'){
    if(typeof notify === 'function') notify('Сюда можно только музыку (BGM)', 'err');
    return;
  }
  const kind = target && target.dataset && target.dataset.bgmTarget;
  if(kind === 'project'){
    projectBgm = asset.src;
    const inp = document.getElementById('projBgmUrl');
    if(inp) inp.value = asset.src;
    if(typeof notify === 'function') notify('🎵 BGM проекта: ' + asset.name, 'ok');
  } else if(kind === 'scene'){
    const s = scenes.find(x => x.id === selectedSceneId);
    if(!s){ if(typeof notify === 'function') notify('Сначала выберите сцену', 'err'); return; }
    s.bgm = asset.src;
    const inp = document.getElementById('sBgmUrl');
    if(inp) inp.value = asset.src;
    if(typeof notify === 'function') notify('🎵 BGM сцены: ' + asset.name, 'ok');
    if(typeof renderSceneInspector === 'function') renderSceneInspector();
  } else if(kind === 'node'){
    const n = nodes.find(x => x.id === selectedId);
    if(!n){ if(typeof notify === 'function') notify('Сначала выберите блок', 'err'); return; }
    n.bgm = asset.src;
    const inp = document.getElementById('iBgmUrl');
    if(inp) inp.value = asset.src;
    if(typeof notify === 'function') notify('🎵 BGM блока: ' + asset.name, 'ok');
    if(typeof renderNodeInspector === 'function') renderNodeInspector();
  }
  try{ markDirty(); }catch(_){}
}
function setupAbGridFileDrop(){
  const grid = document.getElementById('abGrid');
  if(!grid || grid._fileDrop) return;
  grid._fileDrop = true;
  grid.addEventListener('dragover', e => {
    if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  });
  grid.addEventListener('drop', e => {
    if(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length){
      e.preventDefault();
      e.stopPropagation();
      abUploadFiles(e.dataTransfer.files);
    }
  });
}
function setupCanvasAssetDrop(){
  const vp = document.getElementById('viewport') || document.getElementById('canvas');
  if(!vp || vp._abDropBound) return;
  vp._abDropBound = true;
  vp.addEventListener('dragover', e => {
    if([...e.dataTransfer.types].includes('text/asset-id')) e.preventDefault();
  });
  document.addEventListener('dragover', e => {
    if(!e.dataTransfer || ![...e.dataTransfer.types].includes('text/asset-id')) return;
    document.querySelectorAll('.ab-drop-target').forEach(n => n.classList.remove('ab-drop-target'));
    const bgmField = e.target.closest && e.target.closest('[data-bgm-target]');
    const nodeEl = e.target.closest && e.target.closest('.node');
    const sceneEl = e.target.closest && e.target.closest('.scene-bg, .scene-header');
    if(bgmField || nodeEl || sceneEl){
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if(bgmField) bgmField.classList.add('ab-drop-target');
      else if(nodeEl) nodeEl.classList.add('ab-drop-target');
      else if(sceneEl){
        sceneEl.classList.add('ab-drop-target');
        const sid = sceneEl.dataset.id;
        const s = scenes.find(x => x.id === sid);
        if(s && s._els){
          if(s._els.bg) s._els.bg.classList.add('ab-drop-target');
          if(s._els.header) s._els.header.classList.add('ab-drop-target');
        }
      }
    }
  });
  document.addEventListener('dragleave', e => {
    // cleaned on next dragover / drop
  });
  document.addEventListener('drop', e => {
    const id = e.dataTransfer && e.dataTransfer.getData('text/asset-id');
    document.querySelectorAll('.ab-drop-target').forEach(n => n.classList.remove('ab-drop-target'));
    if(!id) return;
    const asset = assets.find(a => a.id === id);
    if(!asset) return;
    const bgmField = e.target.closest && e.target.closest('[data-bgm-target]');
    if(bgmField){
      e.preventDefault();
      applyAssetToBgmField(bgmField, asset);
      return;
    }
    const nodeEl = e.target.closest && e.target.closest('.node');
    if(nodeEl){
      e.preventDefault();
      const node = nodes.find(n => n.id === nodeEl.dataset.id);
      applyAssetToNode(node, asset);
      return;
    }
    const sceneEl = e.target.closest && e.target.closest('.scene-bg, .scene-header');
    if(sceneEl){
      e.preventDefault();
      const scene = scenes.find(s => s.id === sceneEl.dataset.id);
      applyAssetToScene(scene, asset);
    }
  });
}


function addAsset(name, type, src){
  assets.push({ id: aid(), name, type, src, folder: (document.getElementById('assetBrowser')||{}).classList.contains('open') ? (abFolder||'') : '' });
  renderAssets();
  if(selectedId) renderNodeInspector();
  if(selectedSceneId) renderSceneInspector();
}
function fileToDataURL(file){
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}
async function handleFiles(files){
  try{ markDirty(); }catch(_){}

  const type = document.getElementById('assetType').value;
  const zone = document.getElementById('uploadZone');
  const prev = zone ? zone.innerHTML : '';
  if(zone) zone.textContent = 'Загрузка…';
  for(const f of files){
    if(!f.type.startsWith('image/')) continue;
    const name = f.name.replace(/\.[^.]+$/,'');
    const dataUrl = await fileToDataURL(f);
    let src = dataUrl;
    const remote = await uploadAssetToServer(f.name, dataUrl, type);
    if(remote) src = remote;
    addAsset(name, type, src);
  }
  if(zone) zone.innerHTML = 'Перетащите файлы или нажмите<input type="file" id="assetFile" accept="image/*" multiple>';
  // rebind file input after innerHTML replace
  const inp = document.getElementById('assetFile');
  if(inp) inp.onchange = e => { handleFiles(e.target.files); e.target.value=''; };
  document.getElementById('uploadZone').onclick = () => document.getElementById('assetFile').click();
}
document.getElementById('uploadZone').onclick = () => document.getElementById('assetFile').click();
document.getElementById('assetFile').onchange = e => { handleFiles(e.target.files); e.target.value=''; };
document.getElementById('uploadZone').ondragover = e => e.preventDefault();
document.getElementById('uploadZone').ondrop = e => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
document.getElementById('addUrlBtn').onclick = () => {
  const url = document.getElementById('assetUrl').value.trim();
  if(!url) return;
  addAsset(url.split('/').pop().split('?')[0] || 'image', document.getElementById('assetType').value, url);
  document.getElementById('assetUrl').value = '';
};
document.getElementById('assetBrowserBtn').onclick = () => openAssetBrowser();
document.getElementById('abCloseBtn').onclick = () => closeAssetBrowser();
document.getElementById('abNewFolder').onclick = () => abNewFolder();
document.getElementById('abUpload').onclick = () => document.getElementById('abFile').click();
document.getElementById('abFile').onchange = e => { abUploadFiles(e.target.files); e.target.value=''; };
document.getElementById('abAddUrl').onclick = () => abAddByUrl();
document.getElementById('abUrl').addEventListener('keydown', e => { if(e.key === 'Enter') abAddByUrl(); });
document.getElementById('abTypeFilter').onchange = () => renderAbGrid();
document.getElementById('abSearch').oninput = () => renderAbGrid();
setupCanvasAssetDrop();
setupAbGridFileDrop();
// legacy assets panel (hidden entry)
const _assetsBtn = document.getElementById('assetsBtn');
if(_assetsBtn) _assetsBtn.onclick = () => {
  document.getElementById('assetsPanel').style.display = 'block';
  document.getElementById('jsonPanel').style.display = 'none';
  const vp = document.getElementById('varsPanel');
  if(vp) vp.style.display = 'none';
  const pid = document.getElementById('projectIdInput');
  if(pid){
    pid.value = projectId;
    pid.onchange = () => {
      projectId = (pid.value || 'common').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64) || 'common';
      localStorage.setItem('vn_project_id', projectId);
    };
  }
  renderAssets();
};
document.getElementById('closeAssetsBtn').onclick = () => { document.getElementById('assetsPanel').style.display = 'none'; };

document.getElementById('varsBtn').onclick = () => {
  document.getElementById('varsPanel').style.display = 'block';
  document.getElementById('assetsPanel').style.display = 'none';
  document.getElementById('jsonPanel').style.display = 'none';
  renderVarsPanel();
};
document.getElementById('closeVarsBtn').onclick = () => { document.getElementById('varsPanel').style.display = 'none'; };
document.getElementById('addVarBtn').onclick = () => {
  const id = 'var_' + Math.random().toString(36).slice(2, 8);
  variables.push({ id, name: 'Новая переменная', type: 'number', default: 0 });
  renderVarsPanel();
};


function assetOptions(type){
  const list = assets.filter(a => !type || a.type === type);
  return '<option value="">— нет —</option>' + list.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('');
}
function optionsHtml(){
  return '<option value="">— конец —</option>' +
    nodes.map(n => `<option value="${n.id}">${esc(n.title||n.id)} — ${esc((n.text||'').slice(0,14))||'(пусто)'}</option>`).join('');
}
function dragNode(e, node, el){
  e.stopPropagation();
  const sx=e.clientX, sy=e.clientY, ox=node.x, oy=node.y;
  function move(ev){ node.x=ox+(ev.clientX-sx)/zoom; node.y=oy+(ev.clientY-sy)/zoom;
    el.style.left=node.x+'px'; el.style.top=node.y+'px'; updateLines(); }
  function up(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); updateMembership(); }
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}

/* ---- scenes ---- */
function addScene(){
  try{ markDirty(); }catch(_){}

  const s = {
    id:'s'+(sceneCounter++), name:'Новая сцена', color: PALETTE[(sceneCounter-2)%PALETTE.length],
    bg: '#1c2b3a',
    x: (viewport.clientWidth/2 - panX)/zoom - 150, y: (viewport.clientHeight/2 - panY)/zoom - 100, w:400, h:260
  };
  scenes.push(s); createSceneEl(s); updateMembership(); selectScene(s.id);
}
function positionSceneEls(s){
  const {bg,header,handle} = s._els;
  bg.style.left=s.x+'px'; bg.style.top=s.y+'px'; bg.style.width=s.w+'px'; bg.style.height=s.h+'px';
  bg.style.borderColor=s.color; bg.style.background=hexA(s.color,0.07);
  header.style.left=(s.x-2)+'px'; header.style.top=(s.y-30)+'px';
  handle.style.left=(s.x+s.w-8)+'px'; handle.style.top=(s.y+s.h-8)+'px';
}
function createSceneEl(s){
  if(!s.bg) s.bg = '';
  const bg=document.createElement('div'); bg.className='scene-bg'; bg.dataset.id=s.id;
  const header=document.createElement('div'); header.className='scene-header'; header.dataset.id=s.id; header.style.background=s.color;
  header.innerHTML=`<input value="${esc(s.name)}"><button class="sc-props" title="Свойства сцены">⚙</button><button class="sc-del">✕</button>`;
  const handle=document.createElement('div'); handle.className='scene-handle'; handle.style.background=s.color;
  canvas.appendChild(bg); canvas.appendChild(header); canvas.appendChild(handle);
  s._els = {bg, header, handle};
  positionSceneEls(s);

  header.querySelector('input').oninput = e => { s.name = e.target.value; if(selectedSceneId===s.id) document.getElementById('inspTitle').textContent = s.name; };
  header.querySelector('.sc-props').onclick = e => { e.stopPropagation(); selectScene(s.id); };
  header.addEventListener('pointerdown', e => {
    if(e.target.tagName==='INPUT' || e.target.tagName==='BUTTON') return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let dragged = false;
    function move(ev){
      if(Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy) > 4) dragged = true;
    }
    function up(ev){
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if(!dragged) selectScene(s.id);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    startSceneDrag(e, s);
  });
  bg.addEventListener('pointerdown', e => {
    // click empty scene area → open scene panel (not when starting on a node)
    if(e.target !== bg) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY;
    let dragged = false;
    function move(ev){
      if(Math.abs(ev.clientX-sx)+Math.abs(ev.clientY-sy) > 5) dragged = true;
    }
    function up(){
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if(!dragged) selectScene(s.id);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  header.querySelector('.sc-del').onclick = () => {
    scenes = scenes.filter(x => x.id!==s.id);
    bg.remove(); header.remove(); handle.remove();
    nodes.forEach(n => { if(n.sceneId===s.id) n.sceneId=null; });
    if(selectedSceneId===s.id) selectNothing();
    updateMembership();
  };
  handle.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation();
    const sx=e.clientX, sy=e.clientY, ow=s.w, oh=s.h;
    function move(ev){ s.w=Math.max(200,ow+(ev.clientX-sx)/zoom); s.h=Math.max(150,oh+(ev.clientY-sy)/zoom);
      positionSceneEls(s); updateLines(); }
    function up(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); updateMembership(); }
    window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
  });
}
function startSceneDrag(e, s){
  const members = nodes.filter(n => n.sceneId === s.id).map(n => ({n, x:n.x, y:n.y}));
  const sx=e.clientX, sy=e.clientY, osx=s.x, osy=s.y;
  function move(ev){
    const dx=(ev.clientX-sx)/zoom, dy=(ev.clientY-sy)/zoom;
    s.x=osx+dx; s.y=osy+dy; positionSceneEls(s);
    members.forEach(m => {
      m.n.x=m.x+dx; m.n.y=m.y+dy;
      const el = canvas.querySelector(`.node[data-id="${m.n.id}"]`);
      if(el){ el.style.left=m.n.x+'px'; el.style.top=m.n.y+'px'; }
    });
    updateLines();
  }
  function up(){ window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); updateMembership(); }
  window.addEventListener('pointermove',move); window.addEventListener('pointerup',up);
}
function updateMembership(){
  nodes.forEach(n => {
    const el = canvas.querySelector(`.node[data-id="${n.id}"]`); if(!el) return;
    const cx = n.x + 100, cy = n.y + 16;
    const s = scenes.find(sc => cx>=sc.x && cx<=sc.x+sc.w && cy>=sc.y && cy<=sc.y+sc.h);
    el.style.borderLeftColor = s ? s.color : 'var(--edge)';
    n.sceneId = s ? s.id : null;
  });
  updateLines();
}

function refreshNodeCard(node){
  const el = canvas.querySelector(`.node[data-id="${node.id}"]`);
  if(!el) return;
  const badge = node.type === 'narration' ? 'narration' : 'say';
  const badgeLabel = badge === 'narration' ? 'описание' : 'реплика';
  const title = node.title || node.id;
  const speaker = node.type !== 'narration' && node.speaker ? node.speaker : '';
  const scene = sceneOfNode(node);
  let chips = '';
  if(scene && scene.bg) chips += `<span class="node-chip" title="фон сцены">🖼</span>`;
  (node.sprites||[]).filter(s => !s.hide).forEach(s => {
    if(s.src) chips += `<span class="node-chip"><img src="${esc(s.src)}" alt=""></span>`;
    else if(s.emoji) chips += `<span class="node-chip">${esc(s.emoji)}</span>`;
  });
  if(node.choices && node.choices.length) chips += `<span class="node-chip">${node.choices.length} вар.</span>`;
  let nextLine = '';
  if(node.choices && node.choices.length){
    nextLine = node.choices.map(c => c.label || '…').slice(0,2).join(' · ');
    if(node.choices.length > 2) nextLine += '…';
  } else if(node.next) nextLine = '→ ' + nodeLabel(node.next);

  el.innerHTML = `
    <div class="node-top">
      <span class="node-badge ${badge}">${badgeLabel}</span>
      <span class="node-title">${esc(title)}</span>
      <button class="node-del">✕</button>
    </div>
    ${speaker ? `<div class="node-speaker">${esc(speaker)}</div>` : ''}
    <div class="node-preview">${esc((node.text||'').trim() || '— пусто —')}</div>
    ${chips ? `<div class="node-meta">${chips}</div>` : ''}
    ${nextLine ? `<div class="node-next">${esc(nextLine)}</div>` : ''}
  `;
  el.querySelector('.node-del').onclick = e => { e.stopPropagation(); deleteNode(node.id); };
  el.querySelector('.node-top').onpointerdown = e => {
    if(e.target.closest('.node-del')) return;
    e.preventDefault();
    dragNode(e, node, el);
  };
}

function createNodeEl(node){
  const el = document.createElement('div');
  el.className = 'node' + (selectedId === node.id ? ' selected' : '');
  el.style.left = node.x + 'px'; el.style.top = node.y + 'px';
  el.dataset.id = node.id;
  canvas.appendChild(el);
  el.onclick = e => {
    if(e.target.closest('.node-del')) return;
    e.stopPropagation();
    selectNode(node.id);
  };
  refreshNodeCard(node);
  return el;
}

function rebuildAll(){
  canvas.querySelectorAll('.node, .scene-bg, .scene-header, .scene-handle').forEach(e => e.remove());
  scenes.forEach(s => createSceneEl(s));
  nodes.forEach(n => createNodeEl(n));
  updateMembership();
  if(selectedId && !nodes.find(n => n.id === selectedId)) selectNothing();
  else if(selectedId){ const el = canvas.querySelector(`.node[data-id="${selectedId}"]`); if(el) el.classList.add('selected'); renderNodeInspector(); }
  else if(selectedSceneId) renderSceneInspector();
}
function updateLines(){
  svg.innerHTML = '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#c9a24b"/></marker></defs>';
  nodes.forEach(n => {
    const ax = n.x + 200, ay = n.y + 18;
    const targets = (n.choices && n.choices.length) ? n.choices.map(c => c.next) : [n.next];
    targets.forEach(t => {
      if(!t) return;
      const nb = nodes.find(x => x.id === t); if(!nb) return;
      const bx = nb.x, by = nb.y + 18, mx = (ax+bx)/2;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.setAttribute('d', `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`);
      path.setAttribute('stroke','#c9a24b'); path.setAttribute('fill','none');
      path.setAttribute('stroke-width','2'); path.setAttribute('opacity','0.75');
      path.setAttribute('marker-end','url(#arrow)');
      svg.appendChild(path);
    });
  });
}
function addNode(){
  try{ markDirty(); }catch(_){}

  const n = {
    id: uid(), title:'', x: (viewport.clientWidth/2-panX)/zoom + (nodes.length%3)*40 - 80,
    y: (viewport.clientHeight/2-panY)/zoom + Math.floor(nodes.length/3)*40 - 40,
    speaker:'', text:'', choices:[], next:'', type:'say', sprites:[]
  };
  nodes.push(n); createNodeEl(n); updateMembership(); selectNode(n.id);
}

function deepClone(obj){
  return JSON.parse(JSON.stringify(obj));
}
function duplicateNode(id){
  try{ markDirty(); }catch(_){}

  const src = nodes.find(n => n.id === (id || selectedId));
  if(!src){
    if(typeof notify === 'function') notify('Сначала выберите блок', 'err');
    return null;
  }
  const copy = deepClone(src);
  copy.id = (typeof uid === 'function' ? uid() : ('n' + Date.now()));
  copy.title = (src.title || src.id || 'блок') + ' (копия)';
  copy.x = (Number(src.x) || 0) + 40;
  copy.y = (Number(src.y) || 0) + 40;
  // keep choices/next targets, sprites, layout, texts, condition
  nodes.push(copy);
  if(typeof createNodeEl === 'function') createNodeEl(copy);
  else if(typeof rebuildAll === 'function') rebuildAll();
  if(typeof updateMembership === 'function') updateMembership();
  if(typeof updateLines === 'function') updateLines();
  if(typeof selectNode === 'function') selectNode(copy.id);
  if(typeof notify === 'function') notify('Блок «' + (src.title || src.id) + '» скопирован', 'ok');
  return copy;
}

function deleteNode(id){
  try{ markDirty(); }catch(_){}

  nodes = nodes.filter(n => n.id !== id);
  nodes.forEach(n => {
    if(n.next === id) n.next = '';
    (n.choices||[]).forEach(c => { if(c.next === id) c.next = ''; });
  });
  if(selectedId === id) selectNothing();
  rebuildAll();
}



/* ========== Stage / frame constructor ========== */
let stageNodeId = null;
let stageSelected = null; // {type:'sprite'|'box'|'choices', id?}
let stageDragging = false;

function defaultLayout(){
  return {
    box: { left: 50, bottom: 6, width: 70 },
    choices: { left: 50, top: 42, width: 50 }
  };
}
function nodeLayout(node){
  if(!node) return defaultLayout();
  if(!node.layout){
    // наследование: layout сцены → дефолт
    const sc = scenes.find(s => s.id === node.sceneId);
    if(sc && sc.layout) node.layout = JSON.parse(JSON.stringify(sc.layout));
    else node.layout = defaultLayout();
  }
  if(!node.layout.box) node.layout.box = defaultLayout().box;
  if(!node.layout.choices) node.layout.choices = defaultLayout().choices;
  return node.layout;
}

function cloneLayout(layout){
  // Preserve the complete frame-editor layout, not only the legacy position fields.
  const src = layout || defaultLayout();
  const out = JSON.parse(JSON.stringify(src));
  out.box = Object.assign({}, defaultLayout().box, src.box || {});
  out.choices = Object.assign({}, defaultLayout().choices, src.choices || {});
  if(Array.isArray(src.choices && src.choices.items)) out.choices.items = src.choices.items.map(x => ({...(x || {})}));
  if(Array.isArray(src.zOrder)) out.zOrder = src.zOrder.map(String);
  return out;
}

/** Применить layout текущего кадра ко всем блокам сцены (и сохранить как layout сцены) */
function applyLayoutToScene(fromNodeId){
  const node = nodes.find(n => n.id === (fromNodeId || stageNodeId));
  if(!node){
    if(typeof notify === 'function') notify('Нет выбранного блока', 'err');
    return 0;
  }
  const layout = cloneLayout(nodeLayout(node));
  const sid = node.sceneId;
  const sc = scenes.find(s => s.id === sid);
  if(sc) sc.layout = cloneLayout(layout);
  let n = 0;
  nodes.forEach(nd => {
    if(sid && nd.sceneId !== sid) return;
    if(!sid && nd.sceneId) return;
    nd.layout = cloneLayout(layout);
    n++;
  });
  if(typeof notify === 'function'){
    notify('Layout применён к ' + n + ' блок(ам) сцены' + (sc ? ' «' + (sc.name||sc.id) + '»' : '') + '. Опубликуйте проект, чтобы увидеть в игре.', 'ok', 5000);
  }
  return n;
}

/** Применить layout ко всему проекту */
function applyLayoutToProject(fromNodeId){
  const node = nodes.find(n => n.id === (fromNodeId || stageNodeId));
  if(!node){
    if(typeof notify === 'function') notify('Нет выбранного блока', 'err');
    return 0;
  }
  const layout = cloneLayout(nodeLayout(node));
  // сохранить как дефолт каждой сцены + всех блоков
  scenes.forEach(sc => { sc.layout = cloneLayout(layout); });
  nodes.forEach(nd => { nd.layout = cloneLayout(layout); });
  if(typeof notify === 'function'){
    notify('Layout применён ко всем блокам (' + nodes.length + '). Опубликуйте проект, чтобы увидеть в игре.', 'ok', 5000);
  }
  return nodes.length;
}



function isStageFullscreen(){
  const p = document.getElementById('stagePanel');
  return !!(p && p.classList.contains('fs'));
}
function setStageFullscreen(on){
  const panel = document.getElementById('stagePanel');
  const btn = document.getElementById('stageFsBtn');
  if(!panel) return;
  panel.classList.toggle('fs', !!on);
  if(btn){
    btn.classList.toggle('active', !!on);
    btn.textContent = on ? '⛶ Окно' : '⛶ На весь экран';
  }
  requestAnimationFrame(() => {
    if(typeof renderStage === 'function') renderStage();
  });
}
function toggleStageFullscreen(){
  setStageFullscreen(!isStageFullscreen());
}


/** Ordered list of node ids for stage navigation (scene-first, then graph depth) */
function stageNodeOrder(){
  const list = nodes.slice();
  // prefer nodes of current stage scene near current node
  const cur = nodes.find(n => n.id === stageNodeId);
  const preferScene = cur && cur.sceneId;
  // build depth from graph
  const outs = Object.create(null);
  nodes.forEach(n => { outs[n.id] = []; });
  nodes.forEach(n => {
    if(n.next && outs[n.next]) outs[n.id].push(n.next);
    (n.choices||[]).forEach(c => { if(c.next && outs[c.next]) outs[n.id].push(c.next); });
  });
  const depth = Object.create(null);
  const roots = nodes.filter(n => {
    return !nodes.some(m => m.next === n.id || (m.choices||[]).some(c => c.next === n.id));
  });
  const q = (roots.length ? roots : nodes.slice(0,1)).map(n => n.id);
  q.forEach(id => { depth[id] = 0; });
  for(let i = 0; i < q.length; i++){
    const id = q[i];
    (outs[id]||[]).forEach(t => {
      if(depth[t] == null){ depth[t] = depth[id] + 1; q.push(t); }
    });
  }
  list.sort((a, b) => {
    if(preferScene){
      const as = a.sceneId === preferScene ? 0 : 1;
      const bs = b.sceneId === preferScene ? 0 : 1;
      if(as !== bs) return as - bs;
    }
    const da = depth[a.id] != null ? depth[a.id] : 999;
    const db = depth[b.id] != null ? depth[b.id] : 999;
    if(da !== db) return da - db;
    return (a.x||0) - (b.x||0) || (a.y||0) - (b.y||0);
  });
  return list.map(n => n.id);
}
function stageGoRelative(delta){
  const order = stageNodeOrder();
  if(!order.length) return;
  let idx = order.indexOf(stageNodeId);
  if(idx < 0) idx = 0;
  const next = order[(idx + delta + order.length * 10) % order.length];
  if(!next || next === stageNodeId) return;
  stageNodeId = next;
  const sel = document.getElementById('stageNodeSel');
  if(sel) sel.value = next;
  stageSelected = null;
  if(typeof renderStage === 'function') renderStage();
  if(typeof renderStageProps === 'function') renderStageProps();
  if(typeof selectNode === 'function') selectNode(next);
}

function openStageEditor(){
  let nid = selectedId;
  if(!nid && selectedSceneId){
    const n = nodes.find(x => x.sceneId === selectedSceneId);
    if(n) nid = n.id;
  }
  if(!nid && nodes[0]) nid = nodes[0].id;
  if(!nid){ notify('Сначала добавьте блок', 'err'); return; }
  stageNodeId = nid;
  stageSelected = null;
  stageDragging = false;
  document.getElementById('stagePanel').classList.add('open');
  // setStageFullscreen(false); // keep preference
  fillStageNodeSelect();
  renderStage();
}
function closeStageEditor(){
  setStageFullscreen(false);
  document.getElementById('stagePanel').classList.remove('open');
  stageSelected = null;
  stageDragging = false;
  const n = nodes.find(x => x.id === stageNodeId);
  if(n) refreshNodeCard(n);
}
function fillStageNodeSelect(){
  const sel = document.getElementById('stageNodeSel');
  sel.innerHTML = nodes.map(n =>
    `<option value="${n.id}" ${n.id===stageNodeId?'selected':''}>${esc(n.title||n.id)} — ${esc((n.text||'').slice(0,24))}</option>`
  ).join('');
  sel.onchange = () => {
    stageNodeId = sel.value;
    stageSelected = null;
    renderStage();
  };
}

function markStageSelection(){
  const frame = document.getElementById('stageFrame');
  if(!frame) return;
  frame.querySelectorAll('.st-sprite, .st-box, .st-choices').forEach(el => el.classList.remove('selected'));
  if(!stageSelected) return;
  if(stageSelected.type === 'sprite'){
    const el = frame.querySelector(`.st-sprite[data-sid="${CSS.escape(stageSelected.id)}"]`);
    if(el) el.classList.add('selected');
  } else if(stageSelected.type === 'box'){
    const el = frame.querySelector('.st-box');
    if(el) el.classList.add('selected');
  } else if(stageSelected.type === 'choices'){
    const el = frame.querySelector('.st-choices');
    if(el) el.classList.add('selected');
  }
}

function renderStage(){
  const node = nodes.find(n => n.id === stageNodeId);
  const frame = document.getElementById('stageFrame');
  if(!node || !frame){ if(frame) frame.innerHTML = ''; return; }
  const scene = scenes.find(s => s.id === node.sceneId);
  const layout = nodeLayout(node);
  const bg = (scene && scene.bg) || '';
  applySceneBgStyle(frame, bg, scene && scene.bgFit, scene && scene.bgPos);

  let sprHtml = '';
  (node.sprites||[]).filter(s => !s.hide).forEach(s => {
    const hasImg = isImageSrc(s.src);
    let left, bottom;
    if(s.x != null && s.y != null){
      left = Number(s.x); bottom = Number(s.y);
    } else {
      const xy = slotXY(s.pos || 'bottom');
      left = xy.x; bottom = xy.y;
    }
    const sc = (s.scale != null ? Number(s.scale) : 100) / 100;
    const anc = spriteAnchorTransform(s.pos, sc, bottom);
    const floorCls = isFloorAnchor(s.pos, bottom) ? ' floor' : '';
    const handles = ['nw','n','ne','e','se','s','sw','w'].map(h =>
      `<div class="st-handle ${h}" data-handle="${h}" data-sid="${esc(s.id)}"></div>`
    ).join('');
    sprHtml += `<div class="st-sprite${floorCls}" data-sid="${esc(s.id)}" style="left:${left}%;bottom:${bottom}%;transform:${anc.transform};transform-origin:${anc.origin};--sx:${sc}">
      ${hasImg?`<img src="${esc(s.src)}" alt="">`:`<div class="st-em">${esc(s.emoji||'🙂')}</div>`}
      ${handles}
    </div>`;
  });

  const box = layout.box;
  const speaker = node.type==='narration' ? '' : (node.speaker||'');
  const textPreview = (node.texts && node.texts[0] ? node.texts[0].text : node.text) || '…';
  const boxHtml = `<div class="st-box" data-el="box" style="left:${box.left}%;bottom:${box.bottom}%;width:${box.width}%;transform:translateX(-50%)">
    ${speaker?`<div class="st-name">${esc(speaker)}</div>`:''}
    <div class="st-text">${esc(String(textPreview).slice(0,120))}</div>
  </div>`;

  const ch = layout.choices;
  const choiceItems = (node.choices||[]).length
    ? node.choices.map(c => `<div class="st-choice">${esc(c.label||'…')}</div>`).join('')
    : `<div class="st-choice">нажмите, чтобы продолжить ▾</div>`;
  const choicesHtml = `<div class="st-choices" data-el="choices" style="left:${ch.left}%;top:${ch.top}%;width:${ch.width}%;transform:translateX(-50%)">
    ${choiceItems}
  </div>`;

  frame.innerHTML = sprHtml + boxHtml + choicesHtml;

  frame.querySelectorAll('.st-sprite').forEach(el => {
    el.addEventListener('pointerdown', e => {
      if(e.target.classList.contains('st-handle')) return;
      startStageDrag(e, el, 'sprite', el.dataset.sid);
    });
  });
  frame.querySelectorAll('.st-handle').forEach(h => {
    h.addEventListener('pointerdown', e => {
      e.preventDefault();
      e.stopPropagation();
      startSpriteResize(e, h.dataset.sid, h.dataset.handle);
    });
  });
  const boxEl = frame.querySelector('.st-box');
  if(boxEl) boxEl.addEventListener('pointerdown', e => startStageDrag(e, boxEl, 'box'));
  const chEl = frame.querySelector('.st-choices');
  if(chEl) chEl.addEventListener('pointerdown', e => startStageDrag(e, chEl, 'choices'));

  frame.addEventListener('pointerdown', e => {
    if(e.target === frame){
      stageSelected = null;
      markStageSelection();
      renderStageProps();
    }
  });

  markStageSelection();
  renderStageProps();
}


function startSpriteResize(e, sid, handle){
  if(e.button != null && e.button !== 0) return;
  const frame = document.getElementById('stageFrame');
  const node = nodes.find(n => n.id === stageNodeId);
  if(!node || !frame) return;
  const sp = (node.sprites || []).find(s => s.id === sid);
  const el = frame.querySelector('.st-sprite[data-sid="' + CSS.escape(sid) + '"]');
  if(!sp || !el) return;

  stageSelected = { type: 'sprite', id: sid };
  markStageSelection();
  renderStageProps();

  const rect = frame.getBoundingClientRect();
  const startScale = sp.scale != null ? Number(sp.scale) : 100;
  const startX = e.clientX, startY = e.clientY;
  // distance from sprite anchor to pointer at start (in frame %)
  const elRect = el.getBoundingClientRect();
  const cx = elRect.left + elRect.width / 2;
  const cy = elRect.top + elRect.height / 2;
  const startDist = Math.max(8, Math.hypot(startX - cx, startY - cy));

  try { e.target.setPointerCapture(e.pointerId); } catch(_){}

  function move(ev){
    const dist = Math.hypot(ev.clientX - cx, ev.clientY - cy);
    let factor = dist / startDist;
    // edge handles: use dominant axis
    if(handle === 'e' || handle === 'w'){
      factor = Math.abs(ev.clientX - cx) / Math.max(8, Math.abs(startX - cx));
    } else if(handle === 'n' || handle === 's'){
      factor = Math.abs(ev.clientY - cy) / Math.max(8, Math.abs(startY - cy));
    }
    let next = Math.round(startScale * factor);
    next = Math.max(15, Math.min(300, next));
    sp.scale = next;
    const sc = next / 100;
    el.style.setProperty('--sx', String(sc));
    const y = sp.y != null ? Number(sp.y) : (slotXY(sp.pos || 'bottom').y);
    const anc = spriteAnchorTransform(sp.pos, sc, y);
    el.style.transform = anc.transform;
    el.style.transformOrigin = anc.origin;
    // live update scale input if open
    const inp = document.getElementById('spScale');
    if(inp) inp.value = next;
  }
  function up(){
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    renderStageProps();
    syncSpriteInspector(node);
  }
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function startStageDrag(e, el, type, sid){
  if(e.button != null && e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const frame = document.getElementById('stageFrame');
  const rect = frame.getBoundingClientRect();
  const node = nodes.find(n => n.id === stageNodeId);
  if(!node) return;
  const layout = nodeLayout(node);

  // select without full re-render (keeps the same DOM node under the pointer)
  stageSelected = type === 'sprite' ? { type, id: sid } : { type };
  markStageSelection();
  renderStageProps();

  stageDragging = false;
  const startX = e.clientX, startY = e.clientY;
  let moved = false;

  let origLeft, origBottom, origTop;
  if(type === 'sprite'){
    const sp = (node.sprites||[]).find(s => s.id === sid);
    if(!sp) return;
    if(sp.x != null && sp.y != null){
      origLeft = Number(sp.x); origBottom = Number(sp.y);
    } else {
      const pos = sp.pos || 'center';
      const xy = slotXY(pos);
      origLeft = xy.x; origBottom = xy.y;
    }
  } else if(type === 'box'){
    origLeft = Number(layout.box.left);
    origBottom = Number(layout.box.bottom);
  } else {
    origLeft = Number(layout.choices.left);
    origTop = Number(layout.choices.top);
  }

  try { el.setPointerCapture(e.pointerId); } catch(_){}

  function move(ev){
    const dxPx = ev.clientX - startX;
    const dyPx = ev.clientY - startY;
    if(!moved && Math.abs(dxPx) < 2 && Math.abs(dyPx) < 2) return;
    moved = true;
    stageDragging = true;

    const dx = (dxPx / rect.width) * 100;
    const dy = (dyPx / rect.height) * 100;

    if(type === 'sprite'){
      const sp = (node.sprites||[]).find(s => s.id === sid);
      if(!sp) return;
      sp.x = Math.round(Math.max(0, Math.min(100, origLeft + dx)) * 10) / 10;
      sp.y = Math.round(Math.max(0, Math.min(90, origBottom - dy)) * 10) / 10;
      sp.pos = 'custom';
      const sc = (sp.scale != null ? Number(sp.scale) : 100) / 100;
      const anc = spriteAnchorTransform(sp.pos, sc, sp.y);
      el.style.left = sp.x + '%';
      el.style.bottom = sp.y + '%';
      el.style.right = 'auto';
      el.style.transform = anc.transform;
      el.style.transformOrigin = anc.origin;
      el.classList.toggle('floor', isFloorAnchor(sp.pos, sp.y));
    } else if(type === 'box'){
      layout.box.left = Math.round(Math.max(5, Math.min(95, origLeft + dx)) * 10) / 10;
      layout.box.bottom = Math.round(Math.max(0, Math.min(80, origBottom - dy)) * 10) / 10;
      el.style.left = layout.box.left + '%';
      el.style.bottom = layout.box.bottom + '%';
      el.style.transform = 'translateX(-50%)';
    } else {
      layout.choices.left = Math.round(Math.max(5, Math.min(95, origLeft + dx)) * 10) / 10;
      layout.choices.top = Math.round(Math.max(5, Math.min(90, origTop + dy)) * 10) / 10;
      el.style.left = layout.choices.left + '%';
      el.style.top = layout.choices.top + '%';
      el.style.transform = 'translateX(-50%)';
    }
    // live update side panel numbers if visible
    syncStagePropInputs();
  }

  function up(ev){
    stageDragging = false;
    try { el.releasePointerCapture(ev.pointerId); } catch(_){}
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    // refresh props only; do NOT rebuild frame (keeps position)
    renderStageProps();
    if(type === 'sprite') syncSpriteInspector(node);
  }

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}

function syncStagePropInputs(){
  const wrap = document.getElementById('stageProps');
  if(!wrap || !stageSelected) return;
  const node = nodes.find(n => n.id === stageNodeId);
  if(!node) return;
  const layout = nodeLayout(node);
  if(stageSelected.type === 'sprite'){
    const sp = (node.sprites||[]).find(s => s.id === stageSelected.id);
    if(!sp) return;
    const x = wrap.querySelector('#spX');
    const y = wrap.querySelector('#spY');
    if(x) x.value = sp.x != null ? sp.x : 50;
    if(y) y.value = sp.y != null ? sp.y : 0;
  } else if(stageSelected.type === 'box'){
    const bx = wrap.querySelector('#bx'), bb = wrap.querySelector('#bb'), bw = wrap.querySelector('#bw');
    if(bx) bx.value = layout.box.left;
    if(bb) bb.value = layout.box.bottom;
    if(bw) bw.value = layout.box.width;
  } else if(stageSelected.type === 'choices'){
    const cx = wrap.querySelector('#cx'), ct = wrap.querySelector('#ct'), cw = wrap.querySelector('#cw');
    if(cx) cx.value = layout.choices.left;
    if(ct) ct.value = layout.choices.top;
    if(cw) cw.value = layout.choices.width;
  }
}

function renderStageProps(){
  const wrap = document.getElementById('stageProps');
  const node = nodes.find(n => n.id === stageNodeId);
  if(!wrap) return;
  if(!node){ wrap.innerHTML = ''; return; }
  const layout = nodeLayout(node);

  if(!stageSelected){
    wrap.innerHTML = `<div class="hint">Кадр для блока: <b style="color:var(--ink)">${esc(node.title||node.id)}</b><br>Кликните спрайт, окно диалога или варианты. Layout хранится у этого блока.</div>`;
    return;
  }
  if(stageSelected.type === 'sprite'){
    const sp = (node.sprites||[]).find(s => s.id === stageSelected.id);
    if(!sp){ wrap.innerHTML = ''; return; }
    const slot = (sp.x != null && sp.y != null) ? null : slotXY(sp.pos || 'bottom');
    const curX = sp.x != null ? sp.x : (slot ? slot.x : 50);
    const curY = sp.y != null ? sp.y : (slot ? slot.y : 0);
    wrap.innerHTML = `
      <label>Спрайт · блок «${esc(node.title||node.id)}»</label>
      <div style="font-size:13px;margin-bottom:6px">${esc(sp.emoji||'')} ${sp.src?'картинка':''}</div>
      <label>Положение (сетка 3×3)</label>
      <div class="pos-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:10px;max-width:160px">
        <button type="button" class="tb spPreset" data-p="top-left" title="верх-лево">↖</button>
        <button type="button" class="tb spPreset" data-p="top" title="верх">↑</button>
        <button type="button" class="tb spPreset" data-p="top-right" title="верх-право">↗</button>
        <button type="button" class="tb spPreset" data-p="left" title="центр-лево">←</button>
        <button type="button" class="tb spPreset" data-p="center" title="центр">●</button>
        <button type="button" class="tb spPreset" data-p="right" title="центр-право">→</button>
        <button type="button" class="tb spPreset" data-p="bottom-left" title="низ-лево">↙</button>
        <button type="button" class="tb spPreset" data-p="bottom" title="низ">↓</button>
        <button type="button" class="tb spPreset" data-p="bottom-right" title="низ-право">↘</button>
      </div>
      <label>X % (слева)</label>
      <input type="number" id="spX" min="0" max="100" step="0.5" value="${curX}">
      <label>Y % (снизу)</label>
      <input type="number" id="spY" min="0" max="90" step="0.5" value="${curY}">
      <label>Масштаб % <span style="color:var(--dim);font-weight:normal">(тяните углы/края на кадре)</span></label>
      <input type="number" id="spScale" min="15" max="300" step="5" value="${sp.scale!=null?sp.scale:100}">
      <label>Появление</label>
      <select id="spAnimIn">
        <option value="fade">Прозрачность</option>
        <option value="slide-left">Слайд слева</option>
        <option value="slide-right">Слайд справа</option>
        <option value="slide-up">Слайд снизу</option>
        <option value="slide-down">Слайд сверху</option>
        <option value="none">Без анимации</option>
      </select>
      <label>Исчезновение</label>
      <select id="spAnimOut">
        <option value="fade">Прозрачность</option>
        <option value="slide-left">Слайд влево</option>
        <option value="slide-right">Слайд вправо</option>
        <option value="slide-up">Слайд вверх</option>
        <option value="slide-down">Слайд вниз</option>
        <option value="none">Без анимации</option>
      </select>
      <button class="tb" id="spApply" style="width:100%;margin-top:10px">Применить</button>`;
    const PRESETS = SPRITE_SLOTS;
    wrap.querySelector('#spAnimIn').value = sp.anim || sp.animIn || 'fade';
    wrap.querySelector('#spAnimOut').value = sp.animOut || sp.anim || 'fade';
    wrap.querySelectorAll('.spPreset').forEach(btn => {
      const key = btn.dataset.p;
      if(sp.pos === key || (sp.x == null && (sp.pos||'bottom') === key)){
        btn.style.borderColor = 'var(--gold)';
        btn.style.color = 'var(--gold)';
      }
      btn.onclick = () => {
        const p = PRESETS[key] || slotXY(key);
        sp.pos = key;
        sp.x = p.x; sp.y = p.y;
        renderStage();
        syncSpriteInspector(node);
      };
    });
    wrap.querySelector('#spApply').onclick = () => {
      sp.x = Number(wrap.querySelector('#spX').value);
      sp.y = Number(wrap.querySelector('#spY').value);
      sp.scale = Number(wrap.querySelector('#spScale').value) || 100;
      sp.anim = wrap.querySelector('#spAnimIn').value;
      sp.animIn = sp.anim;
      sp.animOut = wrap.querySelector('#spAnimOut').value;
      sp.pos = 'custom';
      renderStage();
      syncSpriteInspector(node);
    };
    return;
  }
  if(stageSelected.type === 'box'){
    wrap.innerHTML = `
      <label>Окно диалога · «${esc(node.title||node.id)}»</label>
      <label>Центр X %</label>
      <input type="number" id="bx" min="5" max="95" step="0.5" value="${layout.box.left}">
      <label>Отступ снизу %</label>
      <input type="number" id="bb" min="0" max="80" step="0.5" value="${layout.box.bottom}">
      <label>Ширина %</label>
      <input type="number" id="bw" min="30" max="95" step="0.5" value="${layout.box.width}">
      <button class="tb" id="bApply" style="width:100%;margin-top:10px">Применить</button>`;
    wrap.querySelector('#bApply').onclick = () => {
      layout.box.left = Number(wrap.querySelector('#bx').value);
      layout.box.bottom = Number(wrap.querySelector('#bb').value);
      layout.box.width = Number(wrap.querySelector('#bw').value);
      renderStage();
    };
    return;
  }
  if(stageSelected.type === 'choices'){
    wrap.innerHTML = `
      <label>Варианты · «${esc(node.title||node.id)}»</label>
      <label>Центр X %</label>
      <input type="number" id="cx" min="5" max="95" step="0.5" value="${layout.choices.left}">
      <label>Отступ сверху %</label>
      <input type="number" id="ct" min="5" max="90" step="0.5" value="${layout.choices.top}">
      <label>Ширина %</label>
      <input type="number" id="cw" min="20" max="90" step="0.5" value="${layout.choices.width}">
      <button class="tb" id="cApply" style="width:100%;margin-top:10px">Применить</button>`;
    wrap.querySelector('#cApply').onclick = () => {
      layout.choices.left = Number(wrap.querySelector('#cx').value);
      layout.choices.top = Number(wrap.querySelector('#ct').value);
      layout.choices.width = Number(wrap.querySelector('#cw').value);
      renderStage();
    };
  }
}

document.getElementById('stageBtn').onclick = openStageEditor;
document.getElementById('stageCloseBtn').onclick = () => {
  setStageFullscreen(false);
  closeStageEditor();
};
document.getElementById('stagePrevBtn').onclick = () => stageGoRelative(-1);
document.getElementById('stageNextBtn').onclick = () => stageGoRelative(1);
document.getElementById('stageFsBtn').onclick = () => toggleStageFullscreen();
document.addEventListener('keydown', e => {
  const panel = document.getElementById('stagePanel');
  if(!panel || !panel.classList.contains('open')) return;
  if(e.key === 'Escape'){
    if(isStageFullscreen()){ setStageFullscreen(false); e.preventDefault(); return; }
  } else if(e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey){
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    stageGoRelative(-1); e.preventDefault();
  } else if(e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey){
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    stageGoRelative(1); e.preventDefault();
  } else if((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey){
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    toggleStageFullscreen();
  }
});
document.getElementById('stageApplyScene').onclick = () => {
  applyLayoutToScene();
  if(typeof renderStage === 'function') renderStage();
};
document.getElementById('stageApplyProject').onclick = () => {
  if(typeof notifyConfirm === 'function'){
    notifyConfirm('Применить layout диалога и ответов ко ВСЕМ блокам проекта?').then(ok => {
      if(!ok) return;
      applyLayoutToProject();
      if(typeof renderStage === 'function') renderStage();
    });
  } else {
    applyLayoutToProject();
    if(typeof renderStage === 'function') renderStage();
  }
};
document.getElementById('stageResetBtn').onclick = () => {
  const node = nodes.find(n => n.id === stageNodeId);
  if(!node) return;
  node.layout = defaultLayout();
  (node.sprites||[]).forEach(s => {
    delete s.x;
    delete s.y;
    if(s.pos === 'custom') s.pos = 'center';
    delete s.scale;
  });
  stageSelected = null;
  renderStage();
};


async function migrateDataUrlsToServer(){
  let changed = false;
  for(const a of assets){
    if(a.src && a.src.startsWith('data:')){
      const url = await uploadAssetToServer(a.name || 'asset', a.src, a.type);
      if(url){ a.src = url; changed = true; }
    }
  }
  for(const n of nodes){
    if(n.bg && n.bg.startsWith('data:')){
      const url = await uploadAssetToServer('bg', n.bg, 'bg');
      if(url){ n.bg = url; changed = true; }
    }
    for(const s of (n.sprites||[])){
      if(s.src && s.src.startsWith('data:')){
        const url = await uploadAssetToServer(s.id || 'sprite', s.src, 'char');
        if(url){ s.src = url; changed = true; }
      }
    }
  }
  for(const sc of scenes){
    if(sc.bg && sc.bg.startsWith('data:')){
      const url = await uploadAssetToServer('scene-bg', sc.bg, 'bg');
      if(url){ sc.bg = url; changed = true; }
    }
  }
  if(changed){
    renderAssets();
    rebuildAll();
  }
  return changed;
}


/* ========== Text script → nodes ========== */

/** "trust >= 2 && met == true" → compound condition */
function parseConditionAtom(str){
  const m = String(str||'').trim().match(/^([a-zA-Z_][\w]*)\s*(==|!=|>=|<=|>|<|=)\s*(.+)$/);
  if(!m) return null;
  let op = m[2];
  if(op === '==' || op === '=') op = 'eq';
  else if(op === '!=') op = 'neq';
  else if(op === '>') op = 'gt';
  else if(op === '>=') op = 'gte';
  else if(op === '<') op = 'lt';
  else if(op === '<=') op = 'lte';
  let value = m[3].trim();
  if((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    value = value.slice(1, -1);
  else if(value === 'true') value = true;
  else if(value === 'false') value = false;
  else if(value !== '' && !isNaN(Number(value))) value = Number(value);
  return { var: m[1], op, value };
}
function parseConditionExpr(str){
  str = String(str || '').trim();
  if(!str) return null;
  if(str.startsWith('?')) str = str.slice(1).trim();
  if(/\|\|/.test(str)){
    const any = str.split(/\|\|/).map(s => parseConditionExpr(s.trim())).filter(Boolean);
    if(!any.length) return null;
    return any.length === 1 ? any[0] : { any };
  }
  if(/&&/.test(str)){
    const all = str.split(/&&/).map(s => parseConditionAtom(s.trim()) || parseConditionExpr(s.trim())).filter(Boolean);
    if(!all.length) return null;
    return all.length === 1 ? all[0] : { all };
  }
  return parseConditionAtom(str);
}
function conditionToLabel(cond){
  if(!cond) return '';
  if(cond.all) return cond.all.map(conditionToLabel).join(' && ');
  if(cond.any) return cond.any.map(conditionToLabel).join(' || ');
  if(cond.not) return '!(' + conditionToLabel(cond.not) + ')';
  if(!cond.var) return '';
  const opMap = {eq:'==',neq:'!=',gt:'>',gte:'>=',lt:'<',lte:'<='};
  return cond.var + ' ' + (opMap[cond.op]||'==') + ' ' + cond.value;
}

function parseNovelText(src){
  const lines = String(src || '').replace(/\r\n/g, '\n').split('\n');
  const result = {
    title: '',
    variables: [],
    assets: [],
    scenes: [],
    nodes: [],
    warnings: []
  };
  const assetMap = Object.create(null); // id -> {id,name,type,src}
  function registerAsset(id, type, src, name){
    id = String(id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    if(!id || !src) return;
    src = String(src).trim();
    let t = String(type || 'char').toLowerCase();
    if(t === 'character' || t === 'person' || t === 'персонаж') t = 'char';
    if(t === 'background' || t === 'фон') t = 'bg';
    if(t === 'музыка') t = 'music';
    if(t === 'звук') t = 'sfx';
    if(['char','bg','music','sfx'].indexOf(t) < 0){
      // guess from URL
      if(/\.(mp3|ogg|wav|m4a|aac|flac)(\?|$)/i.test(src) || /\/audio\//i.test(src))
        t = /sfx|sound|effect/i.test(id) ? 'sfx' : 'music';
      else if(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(src))
        t = /bg|фон|background|scene/i.test(id) ? 'bg' : 'char';
      else t = 'char';
    }
    const a = { id, name: name || id, type: t, src };
    const existing = result.assets.findIndex(x => x.id === id);
    if(existing >= 0) result.assets[existing] = a;
    else result.assets.push(a);
    assetMap[id] = a;
  }
  function resolveBg(token){
    token = String(token || '').trim();
    if(!token) return '';
    if(token.startsWith('#') || token.startsWith('/') || token.startsWith('http://') || token.startsWith('https://') || token.startsWith('data:'))
      return token;
    if(assetMap[token]) return assetMap[token].src;
    return token;
  }
  function resolveCharSrc(id){
    if(assetMap[id] && assetMap[id].type !== 'bg') return assetMap[id].src;
    // also allow any asset id
    if(assetMap[id]) return assetMap[id].src;
    return '';
  }

  const PAL = ['#5b7fa6','#a65b7f','#7fa65b','#a6935b','#8a5ba6','#5ba695'];
  let sceneCounter = 0;
  let currentScene = null;
  let node = null;
  let textBuf = [];
  let pendingCond = null;

  function flushText(){
    if(!node) return;
    const t = textBuf.join('\n').trim();
    textBuf = [];
    if(!t) return;
    if(pendingCond){
      if(!node.texts) node.texts = [];
      if(!node.texts.length && node.text){
        node.texts.push({ text: node.text, condition: null });
      }
      node.texts.push({ text: t, condition: pendingCond });
      node.text = node.texts[0].text;
      pendingCond = null;
    } else if(node.texts && node.texts.length){
      node.texts.push({ text: t, condition: null });
      node.text = node.texts[0].text;
    } else {
      node.text = t;
    }
  }

  function ensureScene(){
    if(currentScene) return currentScene;
    currentScene = {
      id: 's1', name: 'Сцена 1', color: PAL[0], bg: '#1c2b3a',
      x: 20, y: 20, w: 560, h: 320
    };
    result.scenes.push(currentScene);
    sceneCounter = 1;
    return currentScene;
  }
  function startNode(id){
    flushText();
    ensureScene();
    id = String(id || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || ('n' + (result.nodes.length+1));
    node = {
      id,
      title: id,
      speaker: '',
      text: '',
      type: 'say',
      choices: [],
      next: '',
      sprites: [],
      sceneId: currentScene.id,
      x: 40 + (result.nodes.length % 3) * 220,
      y: 50 + Math.floor(result.nodes.length / 3) * 140
    };
    result.nodes.push(node);
  }
  function parseEffectToken(tok){
    // trust_yuki +1 | trust_yuki -1 | trust_yuki =5 | trust_yuki true
    const m = tok.trim().match(/^([a-zA-Z_][\w]*)\s*([+\-=])\s*(.+)$/);
    if(!m) return null;
    const id = m[1], opCh = m[2], raw = m[3].trim();
    let op = 'set', value = raw;
    if(opCh === '+'){ op = 'add'; value = Number(raw); }
    else if(opCh === '-'){ op = 'sub'; value = Number(raw); }
    else {
      if(raw === 'true' || raw === 'false') value = raw === 'true';
      else if(!isNaN(Number(raw)) && raw !== '') value = Number(raw);
    }
    return { var: id, op, value };
  }

  for(let i = 0; i < lines.length; i++){
    let line = lines[i];
    const trimmed = line.trim();
    if(!trimmed){ textBuf.push(''); continue; }

    // @title Название проекта
    if(/^@title\b/i.test(trimmed)){
      const t = trimmed.replace(/^@title\s+/i, '').trim();
      if(t) result.title = t;
      continue;
    }
    // title: first single-# heading at top of file
    if(trimmed.startsWith('#') && !trimmed.startsWith('##') && !result.title && result.nodes.length === 0 && !(result.scenes && result.scenes.length) && !trimmed.startsWith('# ─') && !trimmed.startsWith('# -') && !trimmed.startsWith('#=')){
      const t = trimmed.replace(/^#+\s*/, '').trim();
      const skip = /^(Перемен|Сцена|Узел|Ассет|Шпаргалка|или |id |──|Первая|@var|narration|Фоны|Персонаж|Аудио|Условия)/i;
      if(t && !skip.test(t) && !t.startsWith('@')){
        result.title = t;
      }
      continue;
    }
    // comments / cheat sheet lines starting with # (not ##)
    if(trimmed.startsWith('#') && !trimmed.startsWith('##')) continue;

    // @var
    if(trimmed.startsWith('@var ')){
      const parts = trimmed.slice(5).trim().split(/\s+/);
      const id = parts[0];
      const type = parts[1] || 'number';
      let def = parts.slice(2).join(' ');
      if(type === 'number') def = Number(def) || 0;
      else if(type === 'bool') def = def === 'true' || def === '1';
      else def = def || '';
      result.variables.push({ id, name: id, type, default: def });
      continue;
    }

    // @asset id char|bg URL
    if(trimmed.startsWith('@asset ')){
      const rest = trimmed.slice(7).trim();
      // id type url (url may contain spaces? no — take last tokens)
      const m = rest.match(/^([\w-]+)\s+(char|bg|music|sfx|character|background|person|фон|персонаж|музыка|звук)\s+(.+)$/i);
      if(m){
        let type = m[2].toLowerCase();
        if(type === 'character' || type === 'person' || type === 'персонаж') type = 'char';
        if(type === 'background' || type === 'фон') type = 'bg';
        if(type === 'музыка') type = 'music';
        if(type === 'звук') type = 'sfx';
        registerAsset(m[1], type, m[3].trim());
      } else {
        // @asset id URL  → guess by extension or default char
        const p = rest.split(/\s+/);
        if(p.length >= 2){
          const id = p[0];
          const src = p.slice(1).join(' ');
          const type = /\/(bg|background|fond|scene)/i.test(src) ? 'bg' : 'char';
          registerAsset(id, type, src);
        }
      }
      continue;
    }
    // @char id URL
    if(trimmed.startsWith('@char ')){
      const rest = trimmed.slice(6).trim();
      const m = rest.match(/^([\w-]+)\s+(.+)$/);
      if(m) registerAsset(m[1], 'char', m[2].trim());
      continue;
    }
    // @bg id URL
    if(trimmed.startsWith('@bg ')){
      const rest = trimmed.slice(4).trim();
      const m = rest.match(/^([\w-]+)\s+(.+)$/);
      if(m) registerAsset(m[1], 'bg', m[2].trim());
      continue;
    }

    // scene
    if(trimmed.startsWith('##')){
      flushText();
      node = null;
      sceneCounter++;
      const name = trimmed.replace(/^##\s*/, '').trim() || ('Сцена ' + sceneCounter);
      currentScene = {
        id: 's' + sceneCounter,
        name,
        color: PAL[(sceneCounter - 1) % PAL.length],
        bg: '#1c2b3a',
        x: 20 + ((sceneCounter - 1) % 2) * 600,
        y: 20 + Math.floor((sceneCounter - 1) / 2) * 400,
        w: 560, h: 320
      };
      result.scenes.push(currentScene);
      continue;
    }

    // [bg id|url] [fit] [pos]   optional: next line or same-line ? cond → bgVariants
    if(/^\[bg\s+/i.test(trimmed)){
      ensureScene();
      let inner = trimmed.replace(/^\[bg\s+/i, '').replace(/\]\s*$/, '').trim();
      let bgCond = pendingCond;
      pendingCond = null;
      // condition after ] on same conceptual line was already in trimmed without ]; support "? ..." in inner
      const qIn = inner.indexOf('?');
      if(qIn >= 0){
        bgCond = parseConditionExpr(inner.slice(qIn+1)) || bgCond;
        inner = inner.slice(0, qIn).trim();
      }
      const parts = inner.split(/\s+/);
      const fits = new Set(['cover','contain','fill','stretch','actual','auto']);
      let token = parts[0] || '';
      let fi = 1;
      let fit = currentScene.bgFit || 'cover';
      let pos = currentScene.bgPos || 'center';
      if(parts[1] && fits.has(parts[1].toLowerCase())){
        fit = parts[1].toLowerCase() === 'stretch' ? 'fill' : parts[1].toLowerCase();
        fi = 2;
      }
      if(parts[fi]) pos = parts.slice(fi).join(' ');
      const resolved = resolveBg(token);
      if(bgCond){
        if(!currentScene.bgVariants) currentScene.bgVariants = [];
        currentScene.bgVariants.push({ bg: resolved, bgFit: fit, bgPos: pos, condition: bgCond });
        if(!currentScene.bg) currentScene.bg = resolved;
      } else {
        currentScene.bg = resolved;
        currentScene.bgFit = fit;
        currentScene.bgPos = pos;
      }
      continue;
    }
    if(/^\[bg-fit\s+/i.test(trimmed)){
      ensureScene();
      const v = trimmed.replace(/^\[bg-fit\s+/i, '').replace(/\]\s*$/, '').trim().toLowerCase();
      currentScene.bgFit = v === 'stretch' ? 'fill' : (v || 'cover');
      continue;
    }

    // === node  or  === id ? cond
    if(trimmed.startsWith('===')){
      let rest = trimmed.replace(/^===+\s*/, '').trim();
      let ncond = null;
      const qm = rest.match(/^(.*?)\s*\?\s*(.+)$/);
      if(qm){ rest = qm[1].trim(); ncond = parseConditionExpr(qm[2]); }
      startNode(rest);
      if(ncond) node.condition = ncond;
      pendingCond = null;
      continue;
    }

    if(!node){
      // ignore orphan lines before first node
      if(trimmed.startsWith('-') || trimmed.startsWith('->') || trimmed.startsWith('@')) continue;
      continue;
    }

    // ? condition — for next text / choice / sprite / bg
    if(trimmed.startsWith('?') || /^если\s+/i.test(trimmed) || /^if\s+/i.test(trimmed)){
      const expr = trimmed.replace(/^(\?|если\s+|if\s+)/i, '').trim();
      pendingCond = parseConditionExpr(expr);
      continue;
    }

    // narration marker
    if(trimmed === 'narration' || trimmed === 'описание'){
      node.type = 'narration';
      node.speaker = '';
      continue;
    }

    // @music id [url]  or  @music id   (from assets) — BGM for current scene / node
    if(trimmed.startsWith('@music ')){
      const parts = trimmed.slice(7).trim().split(/\s+/);
      const id = parts[0];
      const url = parts[1] || '';
      if(url) registerAsset(id, 'music', url, id);
      const src = url || (result.assets.find(a => a.id === id) || {}).src || id;
      if(node) node.bgm = src;
      else { ensureScene(); currentScene.bgm = src; }
      continue;
    }
    if(trimmed.startsWith('@sfx ')){
      const parts = trimmed.slice(5).trim().split(/\s+/);
      const id = parts[0];
      const url = parts[1] || '';
      if(url) registerAsset(id, 'sfx', url, id);
      const src = url || (result.assets.find(a => a.id === id) || {}).src || id;
      if(node) node.sfx = src;
      continue;
    }
        // @sprite id [pos] [? cond]
    if(trimmed.startsWith('@sprite ')){
      let rest = trimmed.slice(8).trim();
      let sprCond = pendingCond;
      pendingCond = null;
      const qi = rest.indexOf('?');
      if(qi >= 0){
        sprCond = parseConditionExpr(rest.slice(qi + 1)) || sprCond;
        rest = rest.slice(0, qi).trim();
      }
      const parts = rest.split(/\s+/);
      const sid = parts[0] || 'char';
      const posRaw = (parts[1] || 'bottom').toLowerCase();
      const pos = SPRITE_SLOTS[posRaw] ? posRaw : 'bottom';
      const src = resolveCharSrc(sid);
      const xy = slotXY(pos);
      node.sprites.push({
        id: sid,
        emoji: src ? '' : '🙂',
        pos, x: xy.x, y: xy.y,
        hide: false, anim: 'fade', animOut: 'fade',
        src: src || '',
        condition: sprCond
      });
      continue;
    }

    // choice: - label -> next [effects]
    if((trimmed.startsWith('- ') || trimmed.startsWith('* ')) && /->/.test(trimmed)){
      flushText();
      let body = trimmed.replace(/^[-*—]\s+/, '');
      let choiceCond = pendingCond;
      pendingCond = null;
      const arrowParts = body.split(/->/);
      if(arrowParts[1] && arrowParts[1].includes('?')){
        const qi = body.lastIndexOf('?');
        choiceCond = parseConditionExpr(body.slice(qi+1)) || choiceCond;
        body = body.slice(0, qi).trim();
      }
      const arrow = body.split(/->/);
      const label = (arrow[0] || '').trim();
      let rest = (arrow[1] || '').trim();
      let next = rest;
      let effects = [];
      const em = rest.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
      if(em){
        next = em[1].trim();
        effects = em[2].split(/[,;]/).map(parseEffectToken).filter(Boolean);
      }
      next = next.replace(/[^a-zA-Z0-9_-]/g, '_') || '';
      node.choices.push({ label, next, condition: choiceCond, effects });
      node.next = '';
      continue;
    }

    // next only: -> id
    if(trimmed.startsWith('->')){
      flushText();
      const next = trimmed.replace(/^->\s*/, '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      if(!node.choices.length) node.next = next;
      continue;
    }

    // Speaker: text
    const sp = trimmed.match(/^([^:]{1,40}):\s*(.*)$/);
    if(sp && !trimmed.startsWith('http') && sp[1].length < 40){
      flushText();
      node.speaker = sp[1].trim();
      node.type = 'say';
      if(sp[2]) textBuf.push(sp[2]);
      continue;
    }

    // plain text
    textBuf.push(line.replace(/^\s+/, ''));
  }
  flushText();
  if(!result.scenes.length) ensureScene();
  if(!result.nodes.length) result.warnings.push('Не найдено ни одного узла (=== id)');
  return result;
}


/** Hierarchical L→R layout for node graph after text import */
function autoLayoutGraph(nodeList, sceneList){
  if(!nodeList || !nodeList.length) return;

  const outs = Object.create(null);
  const ins = Object.create(null);
  nodeList.forEach(n => {
    outs[n.id] = [];
    if(!ins[n.id]) ins[n.id] = [];
  });
  function link(a, b){
    if(!a || !b || a === b) return;
    if(!outs[a]) return;
    if(!nodeList.find(n => n.id === b)) return;
    if(!outs[a].includes(b)) outs[a].push(b);
    if(!ins[b]) ins[b] = [];
    if(!ins[b].includes(a)) ins[b].push(a);
  }
  nodeList.forEach(n => {
    if(n.next) link(n.id, n.next);
    (n.choices || []).forEach(c => { if(c.next) link(n.id, c.next); });
  });

  const roots = nodeList.filter(n => !(ins[n.id] && ins[n.id].length)).map(n => n.id);
  if(!roots.length) roots.push(nodeList[0].id);

  const depth = Object.create(null);
  const queue = [];
  roots.forEach(r => { depth[r] = 0; queue.push(r); });
  while(queue.length){
    const id = queue.shift();
    (outs[id] || []).forEach(t => {
      if(depth[t] == null || depth[t] > depth[id] + 1){
        depth[t] = depth[id] + 1;
        queue.push(t);
      }
    });
  }
  nodeList.forEach(n => { if(depth[n.id] == null) depth[n.id] = 0; });

  const maxD = Math.max(0, ...Object.values(depth));
  const layers = Array.from({ length: maxD + 1 }, () => []);
  nodeList.forEach(n => layers[depth[n.id]].push(n.id));

  for(let pass = 0; pass < 3; pass++){
    for(let L = 1; L <= maxD; L++){
      layers[L].sort((a, b) => {
        const pa = ins[a] || [], pb = ins[b] || [];
        const ba = pa.length ? pa.reduce((s, p) => s + layers[L-1].indexOf(p), 0) / pa.length : 0;
        const bb = pb.length ? pb.reduce((s, p) => s + layers[L-1].indexOf(p), 0) / pb.length : 0;
        return ba - bb;
      });
    }
    for(let L = maxD - 1; L >= 0; L--){
      layers[L].sort((a, b) => {
        const ca = outs[a] || [], cb = outs[b] || [];
        const ba = ca.length ? ca.reduce((s, t) => s + (layers[L+1] ? layers[L+1].indexOf(t) : 0), 0) / ca.length : 0;
        const bb = cb.length ? cb.reduce((s, t) => s + (layers[L+1] ? layers[L+1].indexOf(t) : 0), 0) / cb.length : 0;
        return ba - bb;
      });
    }
  }

  const sceneOrder = {};
  (sceneList || []).forEach((s, i) => { sceneOrder[s.id] = i; });
  const nodeById = Object.create(null);
  nodeList.forEach(n => { nodeById[n.id] = n; });
  layers.forEach(layer => {
    const indexed = layer.map((id, i) => ({ id, i }));
    indexed.sort((a, b) => {
      const sa = sceneOrder[nodeById[a.id].sceneId] ?? 99;
      const sb = sceneOrder[nodeById[b.id].sceneId] ?? 99;
      if(sa !== sb) return sa - sb;
      return a.i - b.i;
    });
    layer.splice(0, layer.length, ...indexed.map(x => x.id));
  });

  const COL_W = 280;
  const ROW_H = 160;
  const ORIGIN_X = 60;
  const ORIGIN_Y = 80;

  const sceneY0 = Object.create(null);
  let sceneYCursor = 0;
  const sceneHeights = Object.create(null);
  (sceneList || []).forEach(s => {
    let maxInScene = 0;
    layers.forEach(layer => {
      const c = layer.filter(id => nodeById[id].sceneId === s.id).length;
      if(c > maxInScene) maxInScene = c;
    });
    sceneHeights[s.id] = Math.max(1, maxInScene);
    sceneY0[s.id] = sceneYCursor;
    sceneYCursor += sceneHeights[s.id] * ROW_H + 100;
  });
  const fallbackY0 = sceneYCursor;

  layers.forEach((layer, d) => {
    const rowInScene = Object.create(null);
    layer.forEach(id => {
      const n = nodeById[id];
      const sid = n.sceneId || '_';
      if(rowInScene[sid] == null) rowInScene[sid] = 0;
      const row = rowInScene[sid]++;
      const baseY = sceneY0[sid] != null ? sceneY0[sid] : fallbackY0;
      n.x = ORIGIN_X + d * COL_W;
      n.y = ORIGIN_Y + baseY + row * ROW_H;
    });
  });

  (sceneList || []).forEach(s => {
    const ns = nodeList.filter(n => n.sceneId === s.id);
    if(!ns.length){
      s.x = 40; s.y = 40; s.w = 400; s.h = 260;
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ns.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 220);
      maxY = Math.max(maxY, n.y + 120);
    });
    s.x = minX - 36;
    s.y = minY - 48;
    s.w = Math.max(320, maxX - minX + 72);
    s.h = Math.max(200, maxY - minY + 64);
  });
}

function applyParsedNovel(parsed){
  if(parsed.title) projectTitle = String(parsed.title).trim();
  try{ syncProjectTitleInput(); }catch(_){}
  variables = (parsed.variables || []).map(v => ({
    id: v.id, name: v.name || v.id, type: v.type || 'number', default: v.default
  }));
  assets = (parsed.assets || []).map((a, i) => ({
    id: a.id || ('a'+(i+1)),
    name: a.name || a.id || 'asset',
    type: (a.type==='bg'||a.type==='music'||a.type==='sfx')?a.type:'char',
    src: a.src || '', folder: a.folder || '', folder: a.folder || ''
  }));
  if(typeof assetCounter === 'number') assetCounter = assets.length + 1;
  if(typeof renderAssets === 'function') try{ renderAssets(); }catch(_){}
  scenes = (parsed.scenes || []).map((s, i) => ({
    id: s.id || ('s'+(i+1)), name: s.name || 'Сцена', color: s.color || '#5b7fa6',
    bg: s.bg || '', bgFit: s.bgFit || 'cover', bgPos: s.bgPos || 'center', bgVariants: s.bgVariants || [], layout: s.layout || null, bgm: s.bgm || s.music || '', bgmVol: s.bgmVol, x: s.x??20, y: s.y??20, w: s.w??560, h: s.h??320
  }));
  nodes = (parsed.nodes || []).map((n, i) => ({
    id: n.id || ('n'+(i+1)),
    title: n.title || n.id,
    speaker: n.speaker || '',
    text: n.text || '',
    type: n.type === 'narration' ? 'narration' : 'say',
    condition: n.condition || null,
    bgm: n.bgm || n.music || '',
    sfx: n.sfx || '',
    choices: (n.choices || []).map(c => ({
      label: c.label || '', next: c.next || '',
      condition: c.condition || null,
      effects: Array.isArray(c.effects) ? c.effects : []
    })),
    next: n.next || '',
    sprites: (n.sprites || []).map(s => ({
      id: s.id, src: s.src || '', emoji: s.emoji || '🙂',
      pos: s.pos || 'center', hide: !!s.hide, anim: s.animIn != null ? s.animIn : (s.anim != null ? s.anim : 'fade'), animOut: s.animOut != null ? s.animOut : (s.animIn != null ? s.animIn : (s.anim != null ? s.anim : 'fade')), animInDuration: s.animInDuration, animOutDuration: s.animOutDuration,
      condition: s.condition || null,
      x: s.x, y: s.y, scale: s.scale
    })),
    texts: Array.isArray(n.texts) ? n.texts.map(t => ({ text: t.text || '', condition: t.condition || null })) : [],
    sceneId: n.sceneId || (scenes[0] && scenes[0].id),
    x: n.x ?? (40+(i%3)*220),
    y: n.y ?? (50+Math.floor(i/3)*140)
  }));
  counter = nodes.length + 2;
  sceneCounter = scenes.length + 2;
  autoLayoutGraph(nodes, scenes);
  selectNothing();
  rebuildAll();
  // center view on first node
  if(nodes[0] && typeof setView === 'function'){
    try { setView(Math.max(0, nodes[0].x - 80), Math.max(0, nodes[0].y - 60), typeof scale === 'number' ? scale : 1); } catch(_){}
  } else if(nodes[0] && typeof panX !== 'undefined'){
    try {
      panX = Math.max(0, nodes[0].x - 100);
      panY = Math.max(0, nodes[0].y - 80);
      if(typeof applyTransform === 'function') applyTransform();
    } catch(_){}
  }
}

document.getElementById('txtBtn').onclick = () => {
  document.getElementById('txtPanel').style.display = 'block';
  document.getElementById('jsonPanel').style.display = 'none';
  document.getElementById('assetsPanel').style.display = 'none';
  const vp = document.getElementById('varsPanel');
  if(vp) vp.style.display = 'none';
};
document.getElementById('txtCloseBtn').onclick = () => {
  document.getElementById('txtPanel').style.display = 'none';
};
document.getElementById('txtFileBtn').onclick = () => document.getElementById('txtFile').click();
document.getElementById('txtFile').onchange = async (e) => {
  const f = e.target.files && e.target.files[0];
  if(!f) return;
  document.getElementById('txtArea').value = await f.text();
  e.target.value = '';
};
document.getElementById('txtParseBtn').onclick = () => {
  const src = document.getElementById('txtArea').value;
  const parsed = parseNovelText(src);
  const st = document.getElementById('txtStatus');
  if(!parsed.nodes.length){
    st.textContent = 'Нет узлов. Нужны блоки вида: === id';
    st.style.color = 'var(--rose)';
    return;
  }
  notifyConfirm('Собрать ' + parsed.nodes.length + ' узлов и ' + parsed.scenes.length + ' сцен?\nТекущий граф будет заменён.\nВнешние ссылки будут скачаны на сервер.').then(async ok => {
    if(!ok) return;
    applyParsedNovel(parsed);
    st.style.color = 'var(--dim)';
    st.textContent = 'Импорт… загрузка ассетов на сервер';
    document.getElementById('txtPanel').style.display = 'none';
    notify('Сценарий собран, качаем внешние ассеты…', 'ok');
    const res = await hydrateRemoteAssets({ notify: true });
    st.textContent = 'Готово: ' + parsed.nodes.length + ' узлов, ' + parsed.scenes.length + ' сцен, '
      + parsed.variables.length + ' перем., ' + (parsed.assets||[]).length + ' ассетов'
      + (res.fail ? (' · ошибок загрузки: ' + res.fail) : (' · на сервере: ' + res.ok))
      + (parsed.title ? ' · «' + parsed.title + '»' : '');
    if(res.fail) st.style.color = 'var(--rose)';
  });
};


/** Build runtime project JSON from current editor state (same shape as publish) */
function buildRuntimePayload(){
  return {
    version: 2,
    bgm: projectBgm || '',
    bgmVol: projectBgmVol,
    sfxVol: projectSfxVol,
    masterVol: projectMasterVol,
    title: projectTitle || (scenes[0] && scenes[0].name) || (typeof projectId !== 'undefined' ? projectId : 'preview'),
    variables: (variables || []).map(v => ({
      id: v.id, name: v.name || v.id, type: v.type || 'number', default: v.default
    })),
    assets: (assets || []).map(a => ({
      id: a.id, name: a.name, type: a.type, src: a.src, folder: a.folder || ''
    })),
    scenes: (scenes || []).map(s => ({
      id: s.id, name: s.name, color: s.color,
      bg: s.bg || '', bgFit: s.bgFit || 'cover', bgPos: s.bgPos || 'center',
      bgVariants: s.bgVariants || [], layout: s.layout || null,
      bgm: s.bgm || s.music || '', bgmVol: s.bgmVol
    })),
    nodes: (nodes || []).map(n => {
      const scene = scenes.find(s => s.id === n.sceneId);
      const o = {
        id: n.id,
        speaker: n.speaker || '',
        text: n.text || '',
        sceneId: n.sceneId || undefined,
        type: n.type === 'narration' ? 'narration' : 'say'
      };
      if(n.title) o.title = n.title;
      if(n.next) o.next = n.next;
      if(n.condition) o.condition = n.condition;
      if(n.bgm) o.bgm = n.bgm;
      if(n.sfx) o.sfx = n.sfx;
      if(n.bgmVol != null) o.bgmVol = n.bgmVol;
      const lay = n.layout || (scene && scene.layout) || null;
      if(lay) o.layout = JSON.parse(JSON.stringify(lay));
      if(scene && scene.bg) o.bg = scene.bg;
      if(scene && scene.bgFit) o.bgFit = scene.bgFit;
      if(scene && scene.bgPos) o.bgPos = scene.bgPos;
      if(scene && scene.bgVariants && scene.bgVariants.length) o.bgVariants = scene.bgVariants;
      if(n.texts && n.texts.length){
        o.texts = n.texts.map(t => {
          const to = { text: t.text || '' };
          if(t.condition) to.condition = t.condition;
          return to;
        });
      }
      if(n.sprites && n.sprites.length){
        o.sprites = n.sprites.map(s => {
          const so = { id: s.id };
          if(s.src) so.src = s.src;
          if(s.emoji) so.emoji = s.emoji;
          if(s.pos) so.pos = s.pos;
          if(s.hide) so.hide = true;
          if(s.anim) so.anim = s.anim;
          if(s.animOut) so.animOut = s.animOut;
          if(s.animInDuration != null) so.animInDuration = s.animInDuration;
          if(s.animOutDuration != null) so.animOutDuration = s.animOutDuration;
          if(s.condition) so.condition = s.condition;
          if(s.x != null) so.x = s.x;
          if(s.y != null) so.y = s.y;
          if(s.scale != null) so.scale = s.scale;
          return so;
        });
      }
      if(n.choices && n.choices.length){
        o.choices = n.choices.map(c => {
          const co = { label: c.label || '', next: c.next || '' };
          if(c.condition) co.condition = c.condition;
          if(c.effects && c.effects.length) co.effects = c.effects;
          if(c.sfx) co.sfx = c.sfx;
          return co;
        });
      }
      return o;
    })
  };
}

function resolvePreviewStartId(mode){
  if(mode === 'node'){
    if(!selectedId){
      if(typeof notify === 'function') notify('Выберите блок на холсте', 'err');
      return null;
    }
    return selectedId;
  }
  if(mode === 'scene'){
    const sid = selectedSceneId || (nodes.find(n => n.id === selectedId) || {}).sceneId;
    if(!sid){
      if(typeof notify === 'function') notify('Выберите сцену или блок внутри сцены', 'err');
      return null;
    }
    const inScene = nodes.filter(n => n.sceneId === sid);
    if(!inScene.length) return null;
    // если выделен блок этой сцены — стартуем с него (явный выбор)
    if(selectedId && inScene.some(n => n.id === selectedId)){
      return selectedId;
    }
    // вход в сцену: нет входящих рёбер из ВСЕГО графа (не только из сцены)
    const incoming = new Set();
    nodes.forEach(n => {
      if(n.next) incoming.add(n.next);
      (n.choices||[]).forEach(c => { if(c.next) incoming.add(c.next); });
    });
    const roots = inScene.filter(n => !incoming.has(n.id));
    const pool = roots.length ? roots : inScene;
    return pool.slice().sort((a,b)=>(a.x||0)-(b.x||0) || (a.y||0)-(b.y||0))[0].id;
  }
  // all: first root of whole graph or first node
  const targets = new Set();
  nodes.forEach(n => {
    if(n.next) targets.add(n.next);
    (n.choices||[]).forEach(c => { if(c.next) targets.add(c.next); });
  });
  const roots = nodes.filter(n => !targets.has(n.id));
  if(roots.length) return roots.slice().sort((a,b)=>(a.x||0)-(b.x||0))[0].id;
  return nodes[0] && nodes[0].id;
}

let _previewStartId = null;
let _previewReady = false;

function closePlayPreview(){
  const ov = document.getElementById('playPreview');
  const frame = document.getElementById('playPreviewFrame');
  if(ov) ov.classList.remove('open');
  if(frame) frame.src = 'about:blank';
  _previewReady = false;
}

let _previewSession = null;


let _previewCurrentNodeId = null;
let _previewCurrentSceneId = null;

function renderPlayEditSide(){
  const body = document.getElementById('playEditBody');
  const hint = document.getElementById('playEditHint');
  if(!body) return;
  const node = nodes.find(n => n.id === _previewCurrentNodeId);
  if(!node){
    body.innerHTML = '<div class="pe-hint">Дождитесь появления блока в превью (кликните по экрану игры).</div>';
    return;
  }
  const sc = node.sceneId ? scenes.find(s => s.id === node.sceneId) : null;
  if(hint){
    hint.textContent = 'Блок «' + (node.title || node.id) + '»'
      + (sc ? (' · сцена «' + (sc.name || sc.id) + '»') : '');
  }
  const musicOpts = (typeof assetOptions === 'function') ? assetOptions('music') : '<option value="">—</option>';
  const sfxOpts = (typeof assetOptions === 'function') ? assetOptions('sfx') : '<option value="">—</option>';
  const nBgm = node.bgm || node.music || '';
  const nVol = Math.round((node.bgmVol != null ? node.bgmVol : 0.55) * 100);
  const sBgm = sc ? (sc.bgm || sc.music || '') : '';
  const sVol = sc ? Math.round((sc.bgmVol != null ? sc.bgmVol : 0.55) * 100) : 55;
  body.innerHTML =
    '<h3>🎵 Блок</h3>' +
    '<label>BGM блока (пусто = сцена/проект, none = стоп)</label>' +
    '<select id="peNodeBgmSel">' + musicOpts + '</select>' +
    '<input type="text" id="peNodeBgm" value="' + esc(nBgm) + '" placeholder="пусто / URL / none">' +
    '<label>Громкость BGM блока: <span id="peNodeBgmVolLbl">' + nVol + '</span>%</label>' +
    '<input type="range" id="peNodeBgmVol" min="0" max="100" value="' + nVol + '">' +
    '<label>SFX при входе в блок</label>' +
    '<select id="peNodeSfxSel">' + sfxOpts + '</select>' +
    '<input type="text" id="peNodeSfx" value="' + esc(node.sfx || '') + '" placeholder="пусто / URL">' +
    (sc
      ? ('<h3 style="margin-top:14px">🎬 Сцена «' + esc(sc.name || sc.id) + '»</h3>' +
         '<label>BGM сцены</label>' +
         '<select id="peSceneBgmSel">' + musicOpts + '</select>' +
         '<input type="text" id="peSceneBgm" value="' + esc(sBgm) + '" placeholder="пусто / URL / none">' +
         '<label>Громкость BGM сцены: <span id="peSceneBgmVolLbl">' + sVol + '</span>%</label>' +
         '<input type="range" id="peSceneBgmVol" min="0" max="100" value="' + sVol + '">')
      : '<p class="pe-hint">Блок вне сцены — только настройки блока.</p>');

  function wireSel(selId, inpId, onPick){
    const sel = body.querySelector('#' + selId);
    const inp = body.querySelector('#' + inpId);
    if(!sel || !inp) return;
    const cur = inp.value;
    if(cur){
      const opt = [...sel.options].find(o => {
        if(!o.value) return false;
        const a = assets.find(x => x.id === o.value);
        return (a && a.src === cur) || o.value === cur;
      });
      if(opt) sel.value = opt.value;
    }
    sel.onchange = () => {
      const a = assets.find(x => x.id === sel.value);
      inp.value = a ? a.src : (sel.value || '');
      onPick(inp.value);
    };
    inp.oninput = () => onPick(inp.value.trim());
  }
  wireSel('peNodeBgmSel', 'peNodeBgm', v => { node.bgm = v; try{ markDirty(); }catch(_){} });
  wireSel('peNodeSfxSel', 'peNodeSfx', v => { node.sfx = v; try{ markDirty(); }catch(_){} });
  const nv = body.querySelector('#peNodeBgmVol');
  const nvl = body.querySelector('#peNodeBgmVolLbl');
  if(nv) nv.oninput = () => {
    node.bgmVol = Number(nv.value) / 100;
    if(nvl) nvl.textContent = nv.value;
    try{ markDirty(); }catch(_){}
  };
  if(sc){
    wireSel('peSceneBgmSel', 'peSceneBgm', v => { sc.bgm = v; try{ markDirty(); }catch(_){} });
    const sv = body.querySelector('#peSceneBgmVol');
    const svl = body.querySelector('#peSceneBgmVolLbl');
    if(sv) sv.oninput = () => {
      sc.bgmVol = Number(sv.value) / 100;
      if(svl) svl.textContent = sv.value;
      try{ markDirty(); }catch(_){}
    };
  }
}

function applyPlayEditAndResume(){
  const node = nodes.find(n => n.id === _previewCurrentNodeId);
  if(!node){
    if(typeof notify === 'function') notify('Нет текущего блока', 'err');
    return;
  }
  const nBgm = document.getElementById('peNodeBgm');
  const nSfx = document.getElementById('peNodeSfx');
  const nVol = document.getElementById('peNodeBgmVol');
  if(nBgm) node.bgm = nBgm.value.trim();
  if(nSfx) node.sfx = nSfx.value.trim();
  if(nVol) node.bgmVol = Number(nVol.value) / 100;
  const sc = node.sceneId ? scenes.find(s => s.id === node.sceneId) : null;
  if(sc){
    const sBgm = document.getElementById('peSceneBgm');
    const sVol = document.getElementById('peSceneBgmVol');
    if(sBgm) sc.bgm = sBgm.value.trim();
    if(sVol) sc.bgmVol = Number(sVol.value) / 100;
  }
  try{ markDirty(); }catch(_){}
  if(typeof notify === 'function') notify('Применено — перезапуск с «' + (node.title||node.id) + '»', 'ok');
  openPlayPreview(node.id);
}

function openStageFromPreview(){
  const nid = _previewCurrentNodeId || _previewStartId || (nodes[0] && nodes[0].id);
  if(!nid){
    if(typeof notify === 'function') notify('Нет блока для кадра', 'err');
    return;
  }
  selectedId = nid;
  stageNodeId = nid;
  if(typeof openStageEditor === 'function') openStageEditor();
  if(typeof notify === 'function') notify('Кадр блока «' + nid + '». После «Готово» нажмите «Применить» в превью.', 'ok');
}

function openPlayPreview(startId){
  if(!nodes.length){
    if(typeof notify === 'function') notify('Нет блоков для запуска', 'err');
    return;
  }
  if(typeof updateMembership === 'function') updateMembership();

  // startId только явный — без повторного «угадывания» по текущему клику
  _previewStartId = startId || resolvePreviewStartIdFrom('all', _playSnap);
  if(!_previewStartId){
    if(typeof notify === 'function') notify('Не удалось определить стартовый блок', 'err');
    return;
  }

  const ov = document.getElementById('playPreview');
  const frame = document.getElementById('playPreviewFrame');
  const info = document.getElementById('playPreviewInfo');
  if(!ov || !frame) return;

  const project = buildRuntimePayload();
  if(!project.nodes || !project.nodes.length){
    if(typeof notify === 'function') notify('Пустой сценарий', 'err');
    return;
  }
  if(!project.nodes.some(n => n.id === _previewStartId)){
    if(typeof notify === 'function') notify('Стартовый блок не найден в сценарии: ' + _previewStartId, 'err');
    _previewStartId = project.nodes[0].id;
  }

  if(info){
    const n = nodes.find(x => x.id === _previewStartId);
    const sc = n && scenes.find(s => s.id === n.sceneId);
    const blockName = n ? (n.title || n.id) : _previewStartId;
    const sceneName = sc ? (sc.name || sc.id) : 'без сцены';
    info.textContent = 'Сцена: «' + sceneName + '»  ·  Блок: «' + blockName + '» (' + _previewStartId + ')  ·  блоков: ' + project.nodes.length;
  }

  if(_previewSession){
    try { window.removeEventListener('message', _previewSession.onMsg); } catch(_){}
    if(_previewSession.timer) clearTimeout(_previewSession.timer);
    _previewSession = null;
  }

  const session = {
    acked: false,
    tries: 0,
    timer: null,
    payload: {
      type: 'vn-preview',
      project,
      startId: String(_previewStartId)
    },
    onMsg: null
  };
  const send = () => {
    if(!_previewSession || _previewSession !== session || session.acked) return;
    session.tries++;
    try {
      if(frame.contentWindow) frame.contentWindow.postMessage(session.payload, '*');
    } catch(err){ console.warn('preview post', err); }
    if(!session.acked && session.tries < 30){
      session.timer = setTimeout(send, 100);
    }
  };
  session.onMsg = (e) => {
    if(!_previewSession || _previewSession !== session || !e.data) return;
    if(e.data.type === 'vn-preview-ready') send();
    if(e.data.type === 'vn-preview-ack'){
      session.acked = true;
      if(session.timer) clearTimeout(session.timer);
    }
    if(e.data.type === 'vn-preview-progress'){
      const now = document.getElementById('playPreviewNow');
      const d = e.data;
      if(d.nodeId) _previewCurrentNodeId = d.nodeId;
      if(d.sceneId) _previewCurrentSceneId = d.sceneId;
      if(now){
        const sc = d.sceneName ? ('«' + d.sceneName + '»') : 'без сцены';
        const bl = d.nodeTitle ? ('«' + d.nodeTitle + '»') : (d.nodeId || '—');
        now.textContent = sc + ' · ' + bl + (d.nodeId ? ' (' + d.nodeId + ')' : '');
        now.title = now.textContent;
      }
      const side = document.getElementById('playEditSide');
      if(side && side.classList.contains('open') && typeof renderPlayEditSide === 'function'){
        renderPlayEditSide();
      }
    }
  };
  _previewSession = session;
  window.addEventListener('message', session.onMsg);

  ov.classList.add('open');
  const nowEl = document.getElementById('playPreviewNow');
  if(nowEl) nowEl.textContent = 'загрузка…';
  frame.onload = () => {
    if(_previewSession !== session) return;
    session.tries = 0;
    session.acked = false;
    setTimeout(send, 40);
  };
  frame.src = '/studio?preview=1&t=' + Date.now();
}

/** Снимок выбора на момент открытия меню «Играть» — не зависит от последующих кликов */
let _playSnap = { nodeId: null, sceneId: null };

function nodeLabel(id){
  const n = nodes.find(x => x.id === id);
  if(!n) return id || '—';
  return (n.title || n.id) + (n.title && n.title !== n.id ? ' [' + n.id + ']' : '');
}
function sceneLabel(id){
  const s = scenes.find(x => x.id === id);
  return s ? (s.name || s.id) : (id || '—');
}

function resolvePreviewStartIdFrom(mode, snap){
  snap = snap || _playSnap || {};
  const selNode = snap.nodeId;
  const selScene = snap.sceneId;
  if(mode === 'node'){
    if(!selNode){
      if(typeof notify === 'function') notify('Выберите блок на холсте', 'err');
      return null;
    }
    return selNode;
  }
  if(mode === 'scene'){
    const sid = selScene || (nodes.find(n => n.id === selNode) || {}).sceneId;
    if(!sid){
      if(typeof notify === 'function') notify('Выберите сцену или блок внутри сцены', 'err');
      return null;
    }
    const inScene = nodes.filter(n => n.sceneId === sid);
    if(!inScene.length) return null;
    // Всегда с НАЧАЛА сцены: нет входящих из всего графа, иначе самый левый/верхний
    const incoming = new Set();
    nodes.forEach(n => {
      if(n.next) incoming.add(n.next);
      (n.choices||[]).forEach(c => { if(c.next) incoming.add(c.next); });
    });
    const roots = inScene.filter(n => !incoming.has(n.id));
    const pool = roots.length ? roots : inScene;
    return pool.slice().sort((a,b)=>(a.x||0)-(b.x||0)||(a.y||0)-(b.y||0))[0].id;
  }
  // all
  const incoming = new Set();
  nodes.forEach(n => {
    if(n.next) incoming.add(n.next);
    (n.choices||[]).forEach(c => { if(c.next) incoming.add(c.next); });
  });
  const roots = nodes.filter(n => !incoming.has(n.id));
  if(roots.length) return roots.slice().sort((a,b)=>(a.x||0)-(b.x||0))[0].id;
  return nodes[0] && nodes[0].id;
}

function refreshPlayMenuHints(){
  if(typeof updateMembership === 'function') updateMembership();
  _playSnap = {
    nodeId: selectedId || null,
    sceneId: selectedSceneId || (selectedId ? (nodes.find(n => n.id === selectedId)||{}).sceneId : null) || null
  };
  const allId = resolvePreviewStartIdFrom('all', _playSnap);
  const sceneId = _playSnap.sceneId ? resolvePreviewStartIdFrom('scene', _playSnap) : null;
  const nodeId = _playSnap.nodeId || null;

  const elAll = document.getElementById('pmAllHint');
  const elSc = document.getElementById('pmSceneHint');
  const elNd = document.getElementById('pmNodeHint');
  if(elAll) elAll.textContent = allId ? ('→ ' + nodeLabel(allId)) : '';
  if(elSc){
    if(!_playSnap.sceneId) elSc.textContent = '(сцена не выбрана)';
    else elSc.textContent = '«' + sceneLabel(_playSnap.sceneId) + '» → ' + nodeLabel(sceneId);
  }
  if(elNd){
    if(!nodeId) elNd.textContent = '(блок не выбран)';
    else {
      const n = nodes.find(x => x.id === nodeId);
      const sc = n && n.sceneId ? sceneLabel(n.sceneId) : null;
      elNd.textContent = (sc ? '«' + sc + '» · ' : '') + nodeLabel(nodeId);
    }
  }
}

function togglePlayMenu(show){
  const m = document.getElementById('playMenu');
  if(!m) return;
  const open = show == null ? !m.classList.contains('open') : !!show;
  m.classList.toggle('open', open);
  if(open) refreshPlayMenuHints();
}


function exportJSON(){
  const nodesOut = nodes.map(n => {
    const scene = scenes.find(s => s.id === n.sceneId);
    const o = { id:n.id, speaker:n.speaker||'', text:n.text||'', x:n.x, y:n.y };
    if(n.sceneId) o.sceneId = n.sceneId;
    {
      const scene = scenes.find(s => s.id === n.sceneId);
      const lay = n.layout || (scene && scene.layout) || null;
      if(lay) o.layout = JSON.parse(JSON.stringify(lay));
    }
    if(n.title) o.title = n.title;
    if(n.type === 'narration') o.type = 'narration';
    if(n.condition && (n.condition.var || n.condition.all || n.condition.any || n.condition.not)) o.condition = n.condition;
    if(n.bgm) o.bgm = n.bgm;
    if(n.music && !o.bgm) o.bgm = n.music;
    if(n.sfx) o.sfx = n.sfx;
    if(n.bgmVol != null) o.bgmVol = n.bgmVol;
    if(scene && scene.bg) o.bg = scene.bg;
        if(scene && scene.bgFit) o.bgFit = scene.bgFit;
        if(scene && scene.bgPos) o.bgPos = scene.bgPos;
    if(scene && scene.bgVariants && scene.bgVariants.length) o.bgVariants = scene.bgVariants;
    if(n.texts && n.texts.length){
      o.texts = n.texts.map(t => {
        const to = { text: t.text||'' };
        if(t.condition && (t.condition.var || t.condition.all || t.condition.any || t.condition.not)) to.condition = t.condition;
        return to;
      });
    }
    if(n.sprites && n.sprites.length){
      o.sprites = n.sprites.map(s => {
        const so = { id: s.id };
        if(s.src) so.src = s.src;
        if(s.emoji) so.emoji = s.emoji;
        if(s.pos && s.pos !== 'center') so.pos = s.pos;
        if(s.hide) so.hide = true;
        if(s.anim) so.anim = s.anim;
        if(s.animOut && s.animOut !== s.anim) so.animOut = s.animOut;
        if(s.animInDuration != null) so.animInDuration = s.animInDuration;
        if(s.animOutDuration != null) so.animOutDuration = s.animOutDuration;
        if(s.condition && (s.condition.var || s.condition.all || s.condition.any || s.condition.not)) so.condition = s.condition;
        if(s.x != null) so.x = s.x;
        if(s.y != null) so.y = s.y;
        if(s.scale != null && s.scale !== 100) so.scale = s.scale;
        if(s.pos === 'custom') so.pos = 'custom';
        return so;
      });
    }
    if(n.choices && n.choices.length){
      o.choices = n.choices.map(c => {
        const co = { label: c.label||'', next: c.next||'' };
        if(c.condition && (c.condition.var || c.condition.all || c.condition.any || c.condition.not)) co.condition = c.condition;
        if(c.effects && c.effects.length){
          co.effects = c.effects.filter(e => e.var).map(e => ({
            var: e.var, op: e.op||'set', value: e.value
          }));
        }
        return co;
      });
    } else {
      o.next = n.next || undefined;
    }
    return o;
  });
  const data = {
    version: 2,
    title: projectTitle || '',
    bgm: projectBgm || '',
    bgmVol: projectBgmVol,
    sfxVol: projectSfxVol,
    masterVol: projectMasterVol,
    variables: variables.map(v => ({
      id: v.id, name: v.name, type: v.type||'number', default: v.default ?? 0
    })),
    assets: assets.map(a => ({id:a.id, name:a.name, type:a.type, src:a.src, folder:a.folder||''})),
    assetFolders: listAllFolders ? listAllFolders() : (assetFolders||[]),
    scenes: scenes.map(s => ({id:s.id,name:s.name,color:s.color,bg:s.bg||'',bgFit:s.bgFit||'cover',bgPos:s.bgPos||'center',bgVariants:s.bgVariants||[],layout:s.layout||null,bgm:s.bgm||s.music||'',bgmVol:s.bgmVol,x:s.x,y:s.y,w:s.w,h:s.h})),
    nodes: nodesOut
  };
  document.getElementById('jsonArea').value = JSON.stringify(data, null, 2);
  document.getElementById('jsonPanel').style.display = 'block';
  document.getElementById('assetsPanel').style.display = 'none';
  const vp = document.getElementById('varsPanel');
  if(vp) vp.style.display = 'none';
}

function normalizeAssetTypes(){
  (assets||[]).forEach(a => {
    if(!a || !a.src) return;
    const src = a.src;
    const isAud = /\.(mp3|ogg|wav|m4a|aac|flac)(\?|$)/i.test(src) || /^data:audio\//i.test(src) || /\/audio\//i.test(src);
    if(isAud && a.type !== 'music' && a.type !== 'sfx'){
      a.type = /sfx|sound|effect|rustle|magic/i.test(a.id||a.name||'') ? 'sfx' : 'music';
    }
  });
}

function importJSON(){
  try{
    projectDirty = false;
    const raw = JSON.parse(document.getElementById('jsonArea').value);
    const data = Array.isArray(raw) ? {nodes:raw, scenes:[], assets:[], variables:[]} : raw;
    projectTitle = data.title || '';
    try{ syncProjectTitleInput(); }catch(_){}
    projectBgm = data.bgm || data.music || '';
    projectBgmVol = data.bgmVol != null ? data.bgmVol : 0.55;
    projectSfxVol = data.sfxVol != null ? data.sfxVol : 1;
    projectMasterVol = data.masterVol != null ? data.masterVol : 1;
    variables = (data.variables||[]).map((v,i) => ({
      id: v.id || ('var_'+(i+1)),
      name: v.name || v.id || 'var',
      type: v.type || 'number',
      default: v.default !== undefined ? v.default : (v.type==='bool'?false:0)
    }));
    assetFolders = Array.isArray(data.assetFolders) ? data.assetFolders.slice() : [];
    assets = (data.assets||[]).map((a,i) => ({
      id: a.id || ('a'+(i+1)), name: a.name||'asset', type: a.type||'char', src: a.src||''
    }));
    normalizeAssetTypes();
    assetCounter = assets.length + 1;
    scenes = (data.scenes||[]).map((s,i) => ({
      id: s.id || ('s'+(i+1)), name: s.name||'Сцена', color: s.color||PALETTE[i%PALETTE.length],
      bg: s.bg || '', bgFit: s.bgFit || 'cover', bgPos: s.bgPos || 'center', x: s.x??0, y: s.y??0, w: s.w??400, h: s.h??260
    }));
    nodes = (data.nodes||[]).map((n,i) => ({
      id: n.id || ('n'+(i+1)), title: n.title||'', speaker: n.speaker||'', text: n.text||'',
      x: n.x ?? (40+(i%4)*220), y: n.y ?? (40+Math.floor(i/4)*120),
      choices: n.choices ? n.choices.map(c => ({
        label: c.label||'', next: c.next||'',
        condition: c.condition && (c.condition.var || c.condition.all || c.condition.any || c.condition.not) ? c.condition : null,
        effects: Array.isArray(c.effects) ? c.effects.map(e => ({var:e.var,op:e.op||'set',value:e.value})) : []
      })) : [],
      next: n.next || '', type: n.type === 'narration' ? 'narration' : 'say',
      layout: n.layout || null,
      texts: Array.isArray(n.texts) ? n.texts.map(t => ({
        text: t.text||'', condition: t.condition&&t.condition.var ? t.condition : null
      })) : [],
      sprites: (n.sprites||[]).map(s => ({
        id: s.id || ('s'+Math.random().toString(36).slice(2,7)),
        src: s.src||'', emoji: s.emoji||'🙂', pos: s.pos||'center', hide: !!s.hide,
        anim: s.animIn != null ? s.animIn : (s.anim != null ? s.anim : 'fade'),
        animOut: s.animOut != null ? s.animOut : (s.animIn != null ? s.animIn : (s.anim != null ? s.anim : 'fade')),
        animInDuration: s.animInDuration, animOutDuration: s.animOutDuration,
        condition: s.condition&&s.condition.var ? s.condition : null,
        x: s.x, y: s.y, scale: s.scale
      }))
    }));
    counter = nodes.length + 1; sceneCounter = scenes.length + 1;
    selectNothing();
    rebuildAll();
    (data.nodes||[]).forEach(n => {
      if(!n.bg) return;
      const node = nodes.find(x => x.id === n.id);
      if(node && node.sceneId){
        const sc = scenes.find(s => s.id === node.sceneId);
        if(sc && !sc.bg) sc.bg = n.bg;
      }
    });
    renderAssets();
    document.getElementById('jsonPanel').style.display = 'none';
  } catch(e){ notify('Ошибка в JSON: ' + e.message, 'err'); }
}

document.getElementById('dupBtn').onclick = () => duplicateNode();
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')){
    const t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    e.preventDefault();
    duplicateNode();
  }
});
document.getElementById('addBtn').onclick = addNode;
document.getElementById('addSceneBtn').onclick = addScene;

document.getElementById('playBtn').onclick = (e) => {
  e.stopPropagation();
  togglePlayMenu(true);
};
document.getElementById('playMenu').querySelectorAll('button[data-mode]').forEach(btn => {
  btn.onclick = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    // startId ТОЛЬКО из снимка на момент открытия меню
    const startId = resolvePreviewStartIdFrom(btn.dataset.mode, _playSnap);
    togglePlayMenu(false);
    if(!startId) return;
    console.log('[preview] mode=', btn.dataset.mode, 'startId=', startId, 'snap=', JSON.stringify(_playSnap));
    openPlayPreview(startId);
  };
});
document.getElementById('playPreviewClose').onclick = () => closePlayPreview();
document.getElementById('playPreviewReload').onclick = () => openPlayPreview(_previewCurrentNodeId || _previewStartId);
document.getElementById('playPreviewEditBtn')?.addEventListener('click', () => {
  const side = document.getElementById('playEditSide');
  if(!side) return;
  side.classList.toggle('open');
  if(side.classList.contains('open')) renderPlayEditSide();
});
document.getElementById('playPreviewStageBtn')?.addEventListener('click', () => openStageFromPreview());
document.getElementById('playEditApply')?.addEventListener('click', () => applyPlayEditAndResume());
document.getElementById('playEditStage')?.addEventListener('click', () => openStageFromPreview());
document.addEventListener('click', e => {
  const m = document.getElementById('playMenu');
  if(!m || !m.classList.contains('open')) return;
  if(e.target.closest && (e.target.closest('#playMenu') || e.target.closest('#playBtn'))) return;
  togglePlayMenu(false);
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && document.getElementById('playPreview')?.classList.contains('open')){
    closePlayPreview();
  }
});

let projectDirty = false;
let projectPublished = false;
let _saveInFlight = false;
let _lastSaveAt = 0;

function markDirty(){
  projectDirty = true;
  const st = document.getElementById('saveStatus');
  if(st && !st.dataset.saving) st.textContent = '• есть изменения';
}


function syncProjectTitleInput(){
  const el = document.getElementById('projectTitleInput');
  if(!el) return;
  el.value = projectTitle || '';
}
function bindProjectTitleInput(){
  const el = document.getElementById('projectTitleInput');
  if(!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.oninput = () => {
    projectTitle = el.value.trim();
    try{ markDirty(); }catch(_){}
  };
}
function buildSavePayload(opts){
  opts = opts || {};
  return {
    id: projectId,
    title: projectTitle || (scenes[0] && scenes[0].name) || projectId,
    version: 2,
    bgm: projectBgm || '',
    bgmVol: projectBgmVol,
    sfxVol: projectSfxVol,
    masterVol: projectMasterVol,
    published: opts.publish ? true : (opts.published != null ? opts.published : projectPublished),
    variables,
    assets: assets.map(a => ({id:a.id, name:a.name, type:a.type, src:a.src, folder:a.folder||''})),
    assetFolders: (typeof listAllFolders === 'function' ? listAllFolders() : (assetFolders||[])),
    scenes: scenes.map(s => ({
      id:s.id, name:s.name, color:s.color,
      bg:s.bg||'', bgFit:s.bgFit||'cover', bgPos:s.bgPos||'center',
      bgVariants:s.bgVariants||[], layout:s.layout||null,
      bgm:s.bgm||s.music||'', bgmVol:s.bgmVol,
      x:s.x, y:s.y, w:s.w, h:s.h
    })),
    nodes: nodes.map(n => {
      const scene = scenes.find(s => s.id === n.sceneId);
      const o = { id:n.id, speaker:n.speaker||'', text:n.text||'', x:n.x, y:n.y };
      if(n.title) o.title = n.title;
      if(n.sceneId) o.sceneId = n.sceneId;
      const lay = n.layout || (scene && scene.layout) || null;
      if(lay) o.layout = JSON.parse(JSON.stringify(lay));
      if(n.type === 'narration') o.type = 'narration';
      if(n.condition && (n.condition.var || n.condition.all || n.condition.any || n.condition.not)) o.condition = n.condition;
      if(n.bgm) o.bgm = n.bgm;
      if(n.music && !o.bgm) o.bgm = n.music;
      if(n.sfx) o.sfx = n.sfx;
      if(n.bgmVol != null) o.bgmVol = n.bgmVol;
      if(scene && scene.bg) o.bg = scene.bg;
      if(scene && scene.bgFit) o.bgFit = scene.bgFit;
      if(scene && scene.bgPos) o.bgPos = scene.bgPos;
      if(scene && scene.bgVariants && scene.bgVariants.length) o.bgVariants = scene.bgVariants;
      if(n.texts && n.texts.length) o.texts = n.texts;
      if(n.sprites && n.sprites.length) o.sprites = n.sprites;
      if(n.choices && n.choices.length) o.choices = n.choices;
      else o.next = n.next || undefined;
      return o;
    })
  };
}

async function saveProject(opts){
  opts = opts || {};
  if(_saveInFlight) return null;
  _saveInFlight = true;
  const st = document.getElementById('saveStatus');
  if(st){ st.dataset.saving = '1'; st.textContent = opts.publish ? 'публикация…' : 'сохранение…'; }
  try{
    if(typeof migrateDataUrlsToServer === 'function') await migrateDataUrlsToServer();
    const payload = buildSavePayload(opts);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if(res.status === 401){
      throw new Error('Войдите в аккаунт (ссылка «Вход» на главной), чтобы сохранять проекты');
    }
    if(!data.ok) throw new Error(data.error || 'save failed');
    projectId = data.id || projectId;
    localStorage.setItem('vn_project_id', projectId);
    if(opts.publish) projectPublished = true;
    projectDirty = false;
    _lastSaveAt = Date.now();
    if(st){
      delete st.dataset.saving;
      const t = new Date();
      st.textContent = (opts.publish ? 'опубликовано ' : 'сохранено ') + t.toLocaleTimeString();
    }
    if(opts.publish){
      const url = location.origin + (data.url || ('/play/' + projectId));
      if(typeof notify === 'function') notify('Опубликовано!\n' + url, 'ok', 6000);
    } else if(!opts.silent){
      if(typeof notify === 'function') notify('Черновик сохранён', 'ok', 2500);
    }
    return data;
  } catch(e){
    if(st){ delete st.dataset.saving; st.textContent = 'ошибка сохранения'; }
    if(!opts.silent && typeof notify === 'function'){
      notify((opts.publish ? 'Публикация' : 'Сохранение') + ' не удалось: ' + e.message + '\nСервер запущен (node server.js)?', 'err', 7000);
    }
    return null;
  } finally {
    _saveInFlight = false;
  }
}

// автосохранение каждые 2 минуты при изменениях
setInterval(() => {
  if(!projectDirty || _saveInFlight) return;
  if(!nodes.length && !assets.length) return;
  saveProject({ silent: true });
}, 2 * 60 * 1000);


bindProjectTitleInput();
syncProjectTitleInput();
document.getElementById('saveBtn').onclick = () => saveProject({ publish: false });
document.getElementById('publishBtn').onclick = () => saveProject({ publish: true });
document.addEventListener('keydown', e => {
  if((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')){
    e.preventDefault();
    saveProject({ publish: false });
  }
});

document.getElementById('exportBtn').onclick = async () => {
  try{
    await migrateDataUrlsToServer();
  } catch(e){ console.warn(e); }
  exportJSON();
};
document.getElementById('importBtn').onclick = () => {
  document.getElementById('jsonArea').value='';
  document.getElementById('jsonPanel').style.display='block';
  document.getElementById('assetsPanel').style.display='none';
};
document.getElementById('loadBtn').onclick = importJSON;
document.getElementById('closeBtn').onclick = () => document.getElementById('jsonPanel').style.display='none';
document.getElementById('copyBtn').onclick = async () => {
  try{ await navigator.clipboard.writeText(document.getElementById('jsonArea').value); }catch(e){}
};

variables = [
  { id: 'trust_yuki', name: 'Доверие Юки', type: 'number', default: 0 }
];
scenes = [{ id:'s1', name:'Вокзал', color:PALETTE[0], bg:'#1c2b3a', x:20, y:20, w:520, h:200 }];
nodes = [
  { id:'start', title:'Вступление', x:40, y:50, speaker:'', text:'Дождь стучит по крыше вокзала...', choices:[], next:'meet', type:'narration', sprites:[] },
  { id:'meet', title:'Встреча', x:300, y:50, speaker:'Юки', text:'Ты тоже опоздала на автобус?', choices:[
      {label:'«Да, ужасно не повезло»', next:'', condition:null, effects:[{var:'trust_yuki',op:'add',value:1}]},
      {label:'Промолчать', next:'', condition:null, effects:[{var:'trust_yuki',op:'sub',value:1}]}
    ], next:'', type:'say', sprites:[{id:'yuki', emoji:'🧑‍🎓', pos:'right', hide:false, anim:'fade'}] },
];
counter = 3; sceneCounter = 2;
applyTransform();
rebuildAll();

/* Load project from ?id= or create empty */
(async function bootFromQuery(){
  const params = new URLSearchParams(location.search);
  const qid = (params.get('id') || params.get('project') || '').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);
  if(qid){
    projectId = qid;
    localStorage.setItem('vn_project_id', projectId);
  }
  if(!qid) return; // keep starter demo data
  try{
    const res = await fetch('/api/projects/' + encodeURIComponent(qid), { credentials: 'same-origin' });
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    // reuse import logic shape
    document.getElementById('jsonArea').value = JSON.stringify(data);
    projectPublished = data.published !== false;
    if(typeof importJSON === 'function'){
      importJSON();
    } else {
      variables = data.variables || [];
      assets = data.assets || [];
      scenes = data.scenes || [];
      nodes = data.nodes || [];
      if(typeof rebuildAll === 'function') rebuildAll();
    }
    projectDirty = false;
    const title = data.title || qid;
    document.title = 'VN Editor — ' + title;
  } catch(e){
    console.warn('Не удалось загрузить проект', qid, e);
    notify('Проект «' + qid + '» не найден на сервере. Можно создать новый на главной.', 'err', 6000);
  }
})();
