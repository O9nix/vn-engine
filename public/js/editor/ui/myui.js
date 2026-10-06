/* My UI behavior. Loaded explicitly by the UI loader; not embedded in HTML. */
(function myUiRuntime(){
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const escSel = v => {
    const x = String(v ?? '');
    try { return CSS.escape(x); } catch(_) { return x.replace(/[^a-zA-Z0-9_-]/g,'\\$&'); }
  };

  // User-facing performance profile. The slider snaps to 7 practical presets,
  // from maximum performance to maximum detail.
  const PERF_MODES = [
    {level:0,  name:'Максимум производительности', short:'Турбо', note:'Максимально упрощённая отрисовка во время перемещения. Приоритет — плавность на больших проектах.'},
    {level:17, name:'Высокая производительность', short:'Быстро', note:'Сильно снижает стоимость отрисовки при панорамировании и перетаскивании, сохраняя обычный вид в покое.'},
    {level:33, name:'Производительность', short:'Производительно', note:'Заметно облегчает холст во время движения, но сохраняет большую часть визуальных деталей.'},
    {level:50, name:'Сбалансировано', short:'Баланс', note:'Рекомендуемый средний режим: основные оптимизации активны, визуальные детали сохраняются.'},
    {level:67, name:'Качество', short:'Качественно', note:'Оптимизации работают мягче, поэтому холст сохраняет больше деталей при перемещении.'},
    {level:84, name:'Высокая детализация', short:'Детально', note:'Почти все визуальные детали сохраняются. Оптимизации применяются только там, где они мало заметны.'},
    {level:100,name:'Максимальная детализация', short:'Максимум деталей', note:'Оптимизации редактора почти не вмешиваются в отрисовку. Максимум визуальных эффектов.'}
  ];

  function nearestPerfLevel(value){
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    return PERF_MODES.reduce((best, mode) => Math.abs(mode.level-n) < Math.abs(best.level-n) ? mode : best, PERF_MODES[0]).level;
  }

  function getPerfMode(level){
    const n = nearestPerfLevel(level);
    return PERF_MODES.find(mode => mode.level === n) || PERF_MODES[3];
  }

  const perfState = {
    level: (() => {
      try {
        const saved = Number(localStorage.getItem('vn_myui_perf_level'));
        if(Number.isFinite(saved)) return nearestPerfLevel(saved);
        const q = new URLSearchParams(location.search).get('perf');
        if(q === '0' || q === 'off') return 100;
        if(q === '2' || q === 'aggressive') return 0;
      } catch(_) {}
      return 50;
    })(),
    enabled: true,
    flags: {
      lightPan: true,
      deferStoryTree: true,
      rafGrid: true,
      containNodes: true,
      hideNodesDuringPan: false
    },
    stats: { panStarts:0, dragStarts:0, gridFrames:0, perfFrames:0, slowFrames:0, maxFrameMs:0, lineUpdates:0, skippedLineUpdates:0 },
    applyLevel(level){
      this.level = nearestPerfLevel(level);
      // Each preset progressively relaxes the performance layer.
      this.enabled = this.level < 100;
      this.flags.hideNodesDuringPan = this.level <= 33;
      this.flags.containNodes = this.level <= 84;
      this.flags.deferStoryTree = this.level <= 67;
      this.flags.rafGrid = this.level <= 84;
      const root = document.documentElement;
      root.classList.toggle('myui-perf', this.enabled);
      root.classList.toggle('myui-perf-detail', this.level >= 86);
      root.classList.toggle('myui-perf-aggressive', this.level <= 33);
      root.classList.toggle('myui-perf-lite', this.level >= 67 && this.level < 100);
      root.classList.toggle('myui-perf-quality', this.level >= 84 && this.level < 100);
      if(!this.enabled) root.classList.remove('myui-perf-panning','myui-perf-dragging');
      try { localStorage.setItem('vn_myui_perf_level', String(this.level)); } catch(_){}
      this.updateSettingsUI();
      return this.level;
    },
    set(on){ return this.applyLevel(on ? 50 : 100); },
    toggle(){ return this.set(!this.enabled); },
    get(){ return {level:this.level, enabled:this.enabled, flags:{...this.flags}, stats:{...this.stats}}; },
    resetStats(){ this.stats = {panStarts:0, dragStarts:0, gridFrames:0, perfFrames:0, slowFrames:0, maxFrameMs:0, lineUpdates:0, skippedLineUpdates:0}; },
    updateSettingsUI(){
      const slider = $('myuiPerfSlider');
      const value = $('myuiPerfValue');
      const note = $('myuiPerfNote');
      if(!slider) return;
      slider.value = String(this.level);
      const mode = getPerfMode(this.level);
      if(value) value.textContent = mode.name;
      if(note) note.textContent = mode.note;
      document.querySelectorAll('.myui-perf-presets i').forEach((dot, i) => {
        dot.classList.toggle('active', PERF_MODES[i]?.level === mode.level);
      });
    }
  };

  window.VN_MYUI_PERF = perfState;
  perfState.applyLevel(perfState.level);


  function callCore(name, ...args){
    const fn = window[name];
    if(typeof fn !== 'function') return false;
    try { fn(...args); return true; } catch(e){ console.error('[myui]', name, e); return false; }
  }

  // These are our actual UI controls. We deliberately assign onclick after core is loaded,
  // replacing the core's equivalent handler with the same core function. This makes the
  // controls inspectable as real handlers and avoids duplicate actions.
  function bindCoreButtons(){
    const bindings = {
      addBtn: 'addNode',
      addSceneBtn: 'addScene',
      dupBtn: 'duplicateNode',
      txtBtn: 'openTextPanel',
      assetBrowserBtn: 'openAssetBrowser',
      varsBtn: 'openVarsPanel',
      saveBtn: 'saveProject',
    };

    Object.entries(bindings).forEach(([id, fnName]) => {
      const el = $(id);
      if(!el || typeof window[fnName] !== 'function') return;
      if(el.dataset.myuiBound === fnName) return;
      el.onclick = (e) => {
        if(fnName === 'saveProject') return window[fnName]({publish:false});
        return window[fnName]();
      };
      el.dataset.myuiBound = fnName;
    });

    const publish = $('publishBtn');
    if(publish && typeof window.saveProject === 'function' && publish.dataset.myuiBound !== 'savePublish'){
      publish.onclick = () => window.saveProject({publish:true});
      publish.dataset.myuiBound = 'savePublish';
    }

    const play = $('playBtn');
    if(play && typeof window.togglePlayMenu === 'function' && play.dataset.myuiBound !== 'play'){
      play.onclick = (e) => { e.stopPropagation(); window.togglePlayMenu(true); };
      play.dataset.myuiBound = 'play';
    }
  }

  // ---- Full frame editor inside Preview ----------------------------------
  // The preview itself is the editor surface. The legacy standalone stage
  // constructor is intentionally not used by the new UI.
  const inlineStage = {
    active:false, iframe:null, cleanup:null, selected:[],
    history:[], future:[], locked:new Set(), grid:true, snap:false
  };

  function previewDoc(){
    const frame = $('playPreviewFrame');
    if(!frame) return null;
    try { return frame.contentDocument || frame.contentWindow?.document || null; } catch(_) { return null; }
  }
  function currentPreviewNode(){
    let id=null, list=[];
    try { id=typeof _previewCurrentNodeId!=='undefined' ? _previewCurrentNodeId : null; } catch(_){}
    try { list=typeof nodes!=='undefined' && Array.isArray(nodes) ? nodes : []; } catch(_){}
    return id ? list.find(n=>n.id===id)||null : null;
  }
  function inlineMarkDirty(){ try{ if(typeof window.markDirty==='function') window.markDirty(); }catch(_){} }
  function inlineRefreshTree(){
    try{ const n=currentPreviewNode(); if(n&&typeof window.refreshNodeCard==='function') window.refreshNodeCard(n); }catch(_){}
    try{ if(window.VN_MYUI?.renderStoryTree) window.VN_MYUI.renderStoryTree(); }catch(_){}
  }
  function inlineSnapshot(){ const n=currentPreviewNode(); return n ? JSON.parse(JSON.stringify(n)) : null; }
  function inlinePushHistory(){
    const snap=inlineSnapshot(); if(!snap) return;
    inlineStage.history.push(snap); if(inlineStage.history.length>60) inlineStage.history.shift();
    inlineStage.future=[];
  }
  function inlineRestore(snap){
    const n=currentPreviewNode(); if(!n||!snap) return;
    Object.keys(n).forEach(k=>delete n[k]); Object.assign(n,JSON.parse(JSON.stringify(snap)));
    inlineMarkDirty(); inlineRenderFrame(); inlineRefreshTree();
  }
  function inlineUndo(){
    if(!inlineStage.history.length) return;
    const cur=inlineSnapshot(); const prev=inlineStage.history.pop(); if(cur) inlineStage.future.push(cur); inlineRestore(prev);
  }
  function inlineRedo(){
    if(!inlineStage.future.length) return;
    const cur=inlineSnapshot(); const next=inlineStage.future.pop(); if(cur) inlineStage.history.push(cur); inlineRestore(next);
  }
  function inlineEnsureStyle(doc){
    if(doc.getElementById('vnInlineStageStyle')) return;
    const style=doc.createElement('style'); style.id='vnInlineStageStyle';
    style.textContent=`
      #stage.vn-inline-stage-edit{cursor:default!important;user-select:none!important}
      #stage.vn-inline-stage-edit #box,#stage.vn-inline-stage-edit #choices,#stage.vn-inline-stage-edit .sprite{cursor:move!important;pointer-events:auto!important}
      #stage.vn-inline-stage-edit #continue{pointer-events:none!important}
      #stage.vn-inline-stage-edit .choice{pointer-events:auto!important;cursor:move!important}
      #stage.vn-inline-stage-edit .choice.vn-ie-selected{outline:2px solid #c9a24b!important;outline-offset:2px}
      #stage.vn-inline-stage-edit #box{box-sizing:border-box;min-height:0!important}
      #stage.vn-inline-stage-edit #box #name,#stage.vn-inline-stage-edit #box #text{position:absolute!important;margin:0!important;cursor:move!important;max-width:none!important;min-height:0!important}
      #stage.vn-inline-stage-edit #box #name{z-index:3}
      #stage.vn-inline-stage-edit #box #text{z-index:2}
      #stage.vn-inline-stage-edit .vn-ie-text-selected{outline:1px dashed rgba(201,162,75,.9)!important;outline-offset:4px}
      #stage.vn-inline-stage-edit .sprite{outline:1px dashed rgba(201,162,75,.28);outline-offset:2px}
      #stage.vn-inline-stage-edit .vn-ie-selected{outline:2px solid #c9a24b!important;outline-offset:3px;box-shadow:0 0 0 1px rgba(201,162,75,.22),0 10px 32px rgba(0,0,0,.3)!important}
      #stage.vn-inline-stage-edit .vn-ie-handle{display:none;position:absolute;width:10px;height:10px;border-radius:2px;background:#c9a24b;border:2px solid #17131d;z-index:90;box-shadow:0 1px 5px rgba(0,0,0,.45);pointer-events:auto}
      #stage.vn-inline-stage-edit .vn-ie-single .vn-ie-handle{display:block}
      #stage.vn-inline-stage-edit .vn-ie-handle.se{right:-6px;bottom:-6px;cursor:nwse-resize}.vn-ie-handle.sw{left:-6px;bottom:-6px;cursor:nesw-resize}.vn-ie-handle.ne{right:-6px;top:-6px;cursor:nesw-resize}.vn-ie-handle.nw{left:-6px;top:-6px;cursor:nwse-resize}
      #stage.vn-inline-stage-edit .vn-ie-handle.e{right:-6px;top:50%;transform:translateY(-50%);cursor:ew-resize}.vn-ie-handle.w{left:-6px;top:50%;transform:translateY(-50%);cursor:ew-resize}.vn-ie-handle.s{left:50%;bottom:-6px;transform:translateX(-50%);cursor:ns-resize}.vn-ie-handle.n{left:50%;top:-6px;transform:translateX(-50%);cursor:ns-resize}
      #stage.vn-inline-stage-edit.vn-ie-grid{background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px)!important;background-size:5% 5%!important}
      #stage .vn-ie-hud{position:absolute;left:12px;top:12px;z-index:100;padding:7px 9px;border:1px solid rgba(201,162,75,.42);border-radius:8px;background:rgba(18,16,24,.84);backdrop-filter:blur(8px);color:#efe7d6;font:600 10px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.28)}
      #stage .vn-ie-hud span{color:#8f8797;font-weight:500;letter-spacing:.02em;text-transform:none}
      #stage .vn-ie-tip{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:100;padding:6px 9px;border-radius:7px;background:rgba(18,16,24,.72);color:#9f98a7;font:10px/1.2 ui-sans-serif,system-ui,sans-serif;white-space:nowrap;pointer-events:none}
      .vn-motion-float{animation-name:vnIeFloat!important}.vn-motion-bob{animation-name:vnIeBob!important}.vn-motion-sway{animation-name:vnIeSway!important}.vn-motion-pulse{animation-name:vnIePulse!important}.vn-motion-breathe{animation-name:vnIeBreathe!important}.vn-motion-shake{animation-name:vnIeShake!important}.vn-motion-zoom{animation-name:vnIeZoom!important}
      @keyframes vnIeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(var(--vn-motion-y)*-1))}}
      @keyframes vnIeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(calc(var(--vn-motion-y)*-1))}}
      @keyframes vnIeSway{0%,100%{transform:rotate(calc(var(--vn-motion-r)*-1)) translateX(0)}50%{transform:rotate(var(--vn-motion-r)) translateX(var(--vn-motion-y))}}
      @keyframes vnIePulse{0%,100%{transform:scale(1)}50%{transform:scale(var(--vn-motion-scale))}}
      @keyframes vnIeBreathe{0%,100%{transform:scale(1)}50%{transform:scale(var(--vn-motion-scale))}}
      @keyframes vnIeShake{0%,100%{transform:translateX(0) rotate(0)}25%{transform:translateX(calc(var(--vn-motion-y)*.45)) rotate(var(--vn-motion-r))}75%{transform:translateX(calc(var(--vn-motion-y)*-.45)) rotate(calc(var(--vn-motion-r)*-1))}}
      @keyframes vnIeZoom{0%{transform:scale(1)}100%{transform:scale(var(--vn-motion-scale))}}
      .fe-motion-box{margin-top:12px;padding:10px;border:1px solid #302b3a;border-radius:9px;background:#121018}.fe-motion-title{font-size:10px;text-transform:uppercase;letter-spacing:.11em;color:#d4ad62;margin-bottom:8px}.fe-motion-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fe-motion-hint{margin-top:8px;font-size:9px;line-height:1.35;color:#6f6878}
    `;
    doc.head.appendChild(style);
  }
  function inlineKey(type,id){ return type+(id?':'+id:''); }
  function inlineFindEl(doc,key){
    if(key==='box') return doc.getElementById('box');
    if(key==='name') return doc.getElementById('name');
    if(key==='text') return doc.getElementById('text');
    if(key==='choices') return doc.getElementById('choices');
    if(key.startsWith('choice:')) return doc.querySelector('#choices .choice[data-vn-editor-choice="'+CSS.escape(key.slice(7))+ '"]');
    if(key==='background') return doc.getElementById('stage');
    if(key.startsWith('sprite:')) return doc.querySelector('.sprite[data-vn-editor-sid="'+CSS.escape(key.slice(7))+'"]');
    return null;
  }
  function inlineDefaultLayerOrder(node){
    const sprites=(node?.sprites||[]);
    return ['background', ...sprites.map(s=>inlineKey('sprite',s.id)), 'box', 'name', 'text', ...((node?.choices||[]).length?['choices']:[])];
  }
  function inlineLayerOrder(node){
    const all=inlineDefaultLayerOrder(node), cur=Array.isArray(node?.layout?.zOrder)?node.layout.zOrder.map(String):[];
    const seen=new Set(), out=[];
    cur.forEach(k=>{ if(all.includes(k) && !seen.has(k)){seen.add(k);out.push(k);} });
    all.forEach(k=>{if(!seen.has(k)){seen.add(k);out.push(k);}});
    return out;
  }
  function inlineSetLayerOrder(node,order){
    node.layout=node.layout||{}; node.layout.zOrder=order.slice();
  }
  function inlineLayerEntries(node){
    const sprites=(node?.sprites||[]), map=new Map();
    map.set('background',{key:'background',type:'background',label:'Фон',locked:true});
    sprites.forEach(s=>map.set(inlineKey('sprite',s.id),{key:inlineKey('sprite',s.id),type:'sprite',id:s.id,label:s.id||'Персонаж',sprite:s}));
    map.set('box',{key:'box',type:'box',label:'Диалоговое окно',locked:false});
    map.set('name',{key:'name',type:'text',label:'Имя / заголовок',locked:false});
    map.set('text',{key:'text',type:'text',label:'Текст реплики',locked:false});
    if((node?.choices||[]).length) map.set('choices',{key:'choices',type:'choices',label:'Варианты выбора',locked:false});
    return inlineLayerOrder(node).slice().reverse().map(k=>map.get(k)).filter(Boolean);
  }
  function inlineMoveLayer(key,delta){
    const node=currentPreviewNode(); if(!node||key==='background') return;
    const order=inlineLayerOrder(node);
    const dialogKeys=new Set(['box','name','text']);
    if(dialogKeys.has(key)){
      // The three dialogue elements live in one DOM stacking context, so move
      // the whole dialogue group as a unit when changing its layer relative to
      // sprites/choices. Name/text still keep their own internal z-order.
      const group=order.filter(k=>dialogKeys.has(k));
      const first=order.findIndex(k=>dialogKeys.has(k));
      if(first<0)return;
      const non=order.filter(k=>!dialogKeys.has(k));
      const groupRank=non.reduce((acc,k,i)=>order.indexOf(k)<first?i+1:acc,0);
      let target=groupRank+delta;
      target=Math.max(0,Math.min(non.length,target));
      inlinePushHistory();
      const next=non.slice(); next.splice(target,0,...group);
      inlineSetLayerOrder(node,next); inlineApplyNodeToDom(node,previewDoc()); inlineRenderFrameEditorSide(); inlineMarkDirty(); return;
    }
    const i=order.indexOf(key); if(i<0)return;
    const j=Math.max(1,Math.min(order.length-1,i+delta)); if(i===j)return;
    inlinePushHistory(); const [v]=order.splice(i,1); order.splice(j,0,v); inlineSetLayerOrder(node,order);
    inlineApplyNodeToDom(node,previewDoc()); inlineRenderFrameEditorSide(); inlineMarkDirty();
  }
  function inlineSelectedKeys(){ return inlineStage.selected.slice(); }
  function inlineSelectKey(key, additive){
    if(!additive) inlineStage.selected=[];
    if(key!=='background'){
      const i=inlineStage.selected.indexOf(key);
      if(i>=0 && additive) inlineStage.selected.splice(i,1); else inlineStage.selected.push(key);
    }
    inlinePaintSelection(); inlineRenderFrameEditorSide();
  }
  function inlinePaintSelection(){
    const doc=previewDoc(); if(!doc) return;
    doc.querySelectorAll('.vn-ie-selected').forEach(x=>x.classList.remove('vn-ie-selected','vn-ie-single'));
    inlineStage.selected.forEach(k=>{ const el=inlineFindEl(doc,k); if(el) el.classList.add('vn-ie-selected'); });
    if(inlineStage.selected.length===1){ const el=inlineFindEl(doc,inlineStage.selected[0]); if(el) el.classList.add('vn-ie-single'); }
    const hud=doc.querySelector('.vn-ie-hud span');
    if(hud) hud.textContent=inlineStage.selected.length ? (inlineStage.selected.length+' объект'+(inlineStage.selected.length===1?'':'а')) : 'выберите элемент';
  }
  function inlineAttachHandles(doc,el){
    if(el.querySelector('.vn-ie-handle')) return;
    ['nw','n','ne','w','e','sw','s','se'].forEach(kind=>{
      const h=doc.createElement('div'); h.className='vn-ie-handle '+kind; h.dataset.handle=kind;
      el.appendChild(h); h.addEventListener('pointerdown',e=>inlineStartResize(e,el,kind));
    });
  }
  function inlineMatchSprites(node,doc){
    const source=(node?.sprites||[]).filter(s=>!s.hide);
    const dom=[...doc.querySelectorAll('#sprites .sprite.show')], used=new Set();
    dom.forEach((el,idx)=>{
      let match=null;
      for(const s of source){
        if(used.has(String(s.id))) continue;
        const img=el.querySelector('img');
        let abs=''; try{abs=s.src?new URL(s.src,doc.baseURI).href:'';}catch(_){}
        if((s.src&&img&&(img.src===abs||img.getAttribute('src')===s.src))||(!s.src&&!img&&(el.textContent||'').trim()===(s.emoji||'🙂'))){match=s;break;}
      }
      // Fallback to render order. This makes the editor robust when two sprites
      // use the same image or when the preview is still finishing its animation.
      if(!match) match=source.find(s=>!used.has(String(s.id)))||null;
      if(match){used.add(String(match.id));el.dataset.vnEditorSid=String(match.id);inlineAttachHandles(doc,el);}
    });
  }
  function inlineBind(doc){
    const stage=doc.getElementById('stage'); if(!stage) return false;
    const node=currentPreviewNode(); inlineEnsureStyle(doc); stage.classList.add('vn-inline-stage-edit');
    inlineMatchSprites(node,doc); inlineAttachHandles(doc,doc.getElementById('box')); if(doc.getElementById('choices')) inlineAttachHandles(doc,doc.getElementById('choices'));
    let hud=stage.querySelector('.vn-ie-hud'); if(!hud){hud=doc.createElement('div');hud.className='vn-ie-hud';hud.innerHTML='<b>КАДР</b><span>выберите элемент</span>';stage.appendChild(hud);}
    let tip=stage.querySelector('.vn-ie-tip'); if(!tip){tip=doc.createElement('div');tip.className='vn-ie-tip';stage.appendChild(tip);}
    tip.textContent='Перетаскивание · Shift — несколько · ручки — размер';
    const down=e=>{
      if(!inlineStage.active || e.target.closest('.vn-ie-hud,.vn-ie-tip,.vn-ie-handle')) return;
      const el=e.target.closest('#name,#text,.sprite,.choice,#choices,#box');
      if(!el){ if(e.target===stage){inlineStage.selected=[];inlinePaintSelection();inlineRenderFrameEditorSide();} return; }
      const key=el.classList.contains('sprite')?inlineKey('sprite',el.dataset.vnEditorSid):el.classList.contains('choice')?inlineKey('choice',el.dataset.vnEditorChoice):el.id;
      inlineStartDrag(e,el,key);
    };
    stage.addEventListener('pointerdown',down,true);
    const click=e=>{if(inlineStage.active){e.preventDefault();e.stopPropagation();}};
    stage.addEventListener('click',click,true);
    inlineStage.cleanup=()=>{stage.removeEventListener('pointerdown',down,true);stage.removeEventListener('click',click,true);stage.classList.remove('vn-inline-stage-edit','vn-ie-grid');stage.querySelectorAll('.vn-ie-selected').forEach(x=>x.classList.remove('vn-ie-selected','vn-ie-single'));stage.querySelectorAll('.vn-ie-handle,.vn-ie-hud,.vn-ie-tip').forEach(x=>x.remove());};
    inlinePaintSelection(); return true;
  }
  function inlineStartDrag(e,el,key){
    if(!inlineStage.active||e.button!==0||inlineStage.locked.has(key)) return;
    const node=currentPreviewNode(),doc=el.ownerDocument,stage=doc.getElementById('stage'); if(!node||!stage) return;
    e.preventDefault();e.stopPropagation();
    inlineSelectKey(key,e.shiftKey);
    const keys=inlineSelectedKeys().filter(k=>!inlineStage.locked.has(k)); if(!keys.length) return;
    inlinePushHistory();
    const rect=stage.getBoundingClientRect(),sx=e.clientX,sy=e.clientY;
    const initial=keys.map(k=>({key:k,el:inlineFindEl(doc,k),data:inlineReadPosition(node,k)}));
    const move=ev=>{
      const dx=(ev.clientX-sx)/rect.width*100, dy=(ev.clientY-sy)/rect.height*100;
      initial.forEach(item=>inlineWritePosition(node,item.key,item.data,dx,dy));
      inlineApplyNodeToDom(node,doc); inlinePaintSelection(); inlineRefreshUnifiedProperties(); inlineMarkDirty();
    };
    const up=()=>{doc.removeEventListener('pointermove',move);doc.removeEventListener('pointerup',up);inlineRefreshTree();};
    doc.addEventListener('pointermove',move);doc.addEventListener('pointerup',up,{once:true});
  }
  function inlineReadPosition(node,key){
    if(key.startsWith('sprite:')){const s=(node.sprites||[]).find(x=>String(x.id)===key.slice(7));if(!s)return null;const xy=s.x!=null&&s.y!=null?{x:Number(s.x),y:Number(s.y)}:(typeof window.slotXY==='function'?window.slotXY(s.pos||'bottom'):{x:50,y:0});return {type:'sprite',x:xy.x,y:xy.y};}
    const lay=node.layout||{}; if(key==='box'){const b=lay.box||{left:50,bottom:4,width:92,height:24};return {type:'box',x:Number(b.left),y:Number(b.bottom),width:Number(b.width),height:Number(b.height||24)};}
    if(key==='name'){const t=lay.box?.name||{x:3,y:8,width:92};return {type:'text',x:Number(t.x||0),y:Number(t.y||0),width:Number(t.width||92)};}
    if(key==='text'){const t=lay.box?.text||{x:3,y:28,width:94};return {type:'text',x:Number(t.x||0),y:Number(t.y||0),width:Number(t.width||94)};}
    if(key==='choices'){const c=lay.choices||{left:50,top:42,width:56,height:30};return {type:'choices',x:Number(c.left),y:Number(c.top),width:Number(c.width),height:Number(c.height||30)};}
    if(key.startsWith('choice:')){const i=Number(key.slice(7)), c=lay.choices||{}, item=Array.isArray(c.items)?(c.items[i]||{}):((c.items||{})[i]||{}); const el=inlineFindEl(previewDoc(),key); return {type:'choice',index:i,x:Number(item.x||0),y:Number(item.y||0),width:Number(item.width||((el&&el.getBoundingClientRect().width)||160)),height:Number(item.height||((el&&el.getBoundingClientRect().height)||40))};}
    return null;
  }
  function snap(v){return inlineStage.snap?Math.round(v):v;}
  function inlineWritePosition(node,key,data,dx,dy){
    if(!data)return;
    if(data.type==='sprite'){const s=node.sprites.find(x=>String(x.id)===key.slice(7));if(!s)return;s.x=Math.max(-20,Math.min(120,snap(data.x+dx)));s.y=Math.max(-20,Math.min(120,snap(data.y-dy)));s.pos='custom';return;}
    node.layout=node.layout||{};
    if(data.type==='box'){node.layout.box={...(node.layout.box||{}),left:Math.max(5,Math.min(95,snap(data.x+dx))),bottom:Math.max(0,Math.min(90,snap(data.y-dy))),width:data.width,height:data.height};}
    if(data.type==='text'){const prop=key==='name'?'name':'text';const box=node.layout.box||{};const cur=box[prop]||{};node.layout.box={...box,[prop]:{...cur,x:Math.max(-20,Math.min(120,snap(data.x+dx))),y:Math.max(-20,Math.min(120,snap(data.y+dy))),width:data.width}};}
    if(data.type==='choices'){node.layout.choices={...(node.layout.choices||{}),left:Math.max(5,Math.min(95,snap(data.x+dx))),top:Math.max(5,Math.min(90,snap(data.y+dy))),width:data.width,height:data.height};}
    if(data.type==='choice'){const i=data.index,c={...(node.layout.choices||{}),items:Array.isArray(node.layout.choices?.items)?node.layout.choices.items.slice():[]},sr=previewDoc()?.getElementById('stage')?.getBoundingClientRect(),pxdx=sr?dx*sr.width/100:dx,pydy=sr?dy*sr.height/100:dy;c.items[i]={...(c.items[i]||{}),x:snap(data.x+pxdx),y:snap(data.y+pydy),width:data.width,height:data.height};node.layout.choices=c;}
  }
  function inlineStartResize(e,el,handle){
    if(!inlineStage.active||e.button!==0) return; const key=el.classList.contains('sprite')?inlineKey('sprite',el.dataset.vnEditorSid):el.classList.contains('choice')?inlineKey('choice',el.dataset.vnEditorChoice):el.id;
    if(inlineStage.locked.has(key)) return;
    const node=currentPreviewNode(),stage=el.ownerDocument.getElementById('stage'); if(!node||!stage)return;
    e.preventDefault();e.stopPropagation();inlineSelectKey(key,false);inlinePushHistory();
    const rect=stage.getBoundingClientRect(), startX=e.clientX,startY=e.clientY;
    if(key.startsWith('sprite:')){
      const sp=node.sprites.find(s=>String(s.id)===key.slice(7));if(!sp)return;const er=el.getBoundingClientRect(),cx=er.left+er.width/2,cy=er.top+er.height/2,startDist=Math.max(8,Math.hypot(startX-cx,startY-cy)),startScale=Number(sp.scale||100);
      const move=ev=>{let factor=Math.hypot(ev.clientX-cx,ev.clientY-cy)/startDist;if(handle==='e'||handle==='w')factor=Math.abs(ev.clientX-cx)/Math.max(8,Math.abs(startX-cx));if(handle==='n'||handle==='s')factor=Math.abs(ev.clientY-cy)/Math.max(8,Math.abs(startY-cy));sp.scale=Math.max(15,Math.min(300,Math.round(startScale*factor)));inlineApplyNodeToDom(node,el.ownerDocument);inlineRefreshUnifiedProperties();inlineMarkDirty();};
      const up=()=>{el.ownerDocument.removeEventListener('pointermove',move);el.ownerDocument.removeEventListener('pointerup',up);inlineRefreshTree();};el.ownerDocument.addEventListener('pointermove',move);el.ownerDocument.addEventListener('pointerup',up,{once:true});return;
    }
    const base=inlineReadPosition(node,key); if(!base)return;
    if(key.startsWith('choice:')){
      const i=Number(key.slice(7));
      const move=ev=>{const dx=(ev.clientX-startX),dy=(ev.clientY-startY);const c={...(node.layout?.choices||{}),items:Array.isArray(node.layout?.choices?.items)?node.layout.choices.items.slice():[]};const it={...(c.items[i]||{})};if(handle==='e'||handle==='w')it.width=Math.max(60,Math.min(900,base.width+(handle==='e'?dx:-dx)));if(handle==='n'||handle==='s')it.height=Math.max(24,Math.min(300,base.height+(handle==='n'?-dy:dy)));c.items[i]=it;node.layout=node.layout||{};node.layout.choices=c;inlineApplyNodeToDom(node,el.ownerDocument);inlineRefreshUnifiedProperties();inlineMarkDirty();};
      const up=()=>{el.ownerDocument.removeEventListener('pointermove',move);el.ownerDocument.removeEventListener('pointerup',up);inlineRefreshTree();};el.ownerDocument.addEventListener('pointermove',move);el.ownerDocument.addEventListener('pointerup',up,{once:true});return;
    }
    const move=ev=>{const dx=(ev.clientX-startX)/rect.width*100,dy=(ev.clientY-startY)/rect.height*100;node.layout=node.layout||{};if(key==='box'){const b={...(node.layout.box||{}),width:base.width,height:base.height};if(handle==='e'||handle==='w')b.width=Math.max(30,Math.min(95,base.width+(handle==='e'?dx:-dx)));if(handle==='n'||handle==='s')b.height=Math.max(10,Math.min(80,base.height+(handle==='n'?-dy:dy)));node.layout.box=b;}else if(key==='name'||key==='text'){const prop=key==='name'?'name':'text',t={...(node.layout.box?.[prop]||{}),width:base.width};if(handle==='e'||handle==='w')t.width=Math.max(15,Math.min(120,base.width+(handle==='e'?dx:-dx)));node.layout.box={...(node.layout.box||{}),[prop]:t};}else{let width=base.width,height=base.height||30;if(handle==='e'||handle==='w')width=Math.max(20,Math.min(90,base.width+(handle==='e'?dx:-dx)));if(handle==='n'||handle==='s')height=Math.max(10,Math.min(90,height+(handle==='n'?-dy:dy)));node.layout.choices={...(node.layout.choices||{}),width,height};}inlineApplyNodeToDom(node,el.ownerDocument);inlineRefreshUnifiedProperties();inlineMarkDirty();};
    const up=()=>{el.ownerDocument.removeEventListener('pointermove',move);el.ownerDocument.removeEventListener('pointerup',up);inlineRefreshTree();};el.ownerDocument.addEventListener('pointermove',move);el.ownerDocument.addEventListener('pointerup',up,{once:true});
  }
  const INLINE_MOTION_PRESETS = {
    none:{label:'Без анимации'},
    float:{label:'Плавное покачивание'},
    bob:{label:'Плавный подъём'},
    sway:{label:'Покачивание в стороны'},
    pulse:{label:'Мягкий пульс'},
    breathe:{label:'Дыхание / масштаб'},
    shake:{label:'Лёгкая дрожь'},
    zoom:{label:'Медленное приближение'}
  };
  function inlineMotion(s){
    const m=(s&&s.motion)||{};
    return {type:m.type||'none',duration:Number(m.duration)||2.2,delay:Number(m.delay)||0,easing:m.easing||'ease-in-out',iteration:m.iteration||'infinite',intensity:Number(m.intensity)||8,rotate:Number(m.rotate)||2,scale:Number(m.scale)||1.04};
  }
  function inlineApplySpriteMotion(el,s){
    if(!el) return;
    const img=el.querySelector('img');
    const target=img||el;
    target.classList.remove('vn-motion-float','vn-motion-bob','vn-motion-sway','vn-motion-pulse','vn-motion-breathe','vn-motion-shake','vn-motion-zoom');
    target.style.animation='none';
    const m=inlineMotion(s);
    if(m.type==='none') return;
    target.style.setProperty('--vn-motion-y',Math.max(1,Math.min(40,m.intensity))+'px');
    target.style.setProperty('--vn-motion-r',Math.max(0,Math.min(12,m.rotate))+'deg');
    target.style.setProperty('--vn-motion-scale',Math.max(1,Math.min(1.35,m.scale)));
    const cls='vn-motion-'+m.type;
    target.classList.add(cls);
    target.style.animationName='';
    target.style.animationDuration=Math.max(.2,Math.min(30,m.duration))+'s';
    target.style.animationDelay=Math.max(0,m.delay)+'s';
    target.style.animationTimingFunction=m.easing;
    target.style.animationIterationCount=m.iteration==='once'?'1':(m.iteration==='2'?'2':'infinite');
    target.style.animationFillMode='both';
  }
  function inlineApplyNodeToDom(node,doc){
    if(!node||!doc)return;
    const lay=node.layout||{};
    const stageBg=doc.getElementById('stage'); if(stageBg && lay.backgroundColor) stageBg.style.setProperty('background-color',String(lay.backgroundColor),'important');
    inlineMatchSprites(node,doc);
    const domSprites=[...doc.querySelectorAll('#sprites .sprite.show')];
    (node.sprites||[]).filter(s=>!s.hide).forEach((s,idx)=>{
      let el=doc.querySelector('.sprite[data-vn-editor-sid="'+CSS.escape(String(s.id))+'"]');
      if(!el) el=domSprites[idx]||null;
      if(!el)return;
      el.dataset.vnEditorSid=String(s.id);
      let visual=el.querySelector(':scope > .sprite-visual');
      if(!visual){
        visual=doc.createElement('div'); visual.className='sprite-visual';
        while(el.firstChild) visual.appendChild(el.firstChild);
        el.appendChild(visual);
      }
      const xy=s.x!=null&&s.y!=null?{x:Number(s.x),y:Number(s.y)}:(typeof window.slotXY==='function'?window.slotXY(s.pos||'bottom'):{x:50,y:0});
      const sc=Number(s.scale||100)/100;
      const floor=typeof window.isFloorAnchor==='function'?window.isFloorAnchor(s.pos,xy.y):xy.y<=4;
      el.style.setProperty('left',xy.x+'%','important');
      el.style.setProperty('bottom',xy.y+'%','important');
      el.style.setProperty('right','auto','important');
      el.style.setProperty('--sx',String(sc));
      el.style.setProperty('transform-origin',floor?'center bottom':'center center','important');
      el.style.setProperty('transform',floor?'translateX(-50%) scale(var(--sx))':'translate(-50%, 50%) scale(var(--sx))','important');
      el.style.removeProperty('animation');
      inlineApplySpriteMotion(el,s);
    });
    const b=lay.box||{left:50,bottom:4,width:92,height:24},be=doc.getElementById('box');
    if(be){be.style.setProperty('left',b.left+'%','important');be.style.setProperty('bottom',b.bottom+'%','important');be.style.setProperty('width',b.width+'%','important');if(b.height!=null)be.style.setProperty('height',b.height+'%','important');be.style.setProperty('top','auto','important');be.style.setProperty('transform','translateX(-50%)','important');be.style.setProperty('box-sizing','border-box','important');const defs={name:{x:3,y:8,width:92},text:{x:3,y:28,width:94}};for(const prop of ['name','text']){const el=doc.getElementById(prop);if(!el)continue;const st={...defs[prop],...(b[prop]||{})};el.style.setProperty('left',Number(st.x||0)+'%','important');el.style.setProperty('top',Number(st.y||0)+'%','important');el.style.setProperty('width',Number(st.width||defs[prop].width)+'%','important');el.style.setProperty('right','auto','important');el.style.setProperty('bottom','auto','important');el.style.setProperty('margin','0','important');el.style.setProperty('max-width','none','important');el.style.setProperty('min-height','0','important');if(st.color)el.style.setProperty('color',st.color,'important');if(st.fontSize)el.style.setProperty('font-size',st.fontSize+'px','important');if(st.fontFamily)el.style.setProperty('font-family',st.fontFamily,'important');if(st.fontWeight)el.style.setProperty('font-weight',st.fontWeight,'important');if(st.fontStyle)el.style.setProperty('font-style',st.fontStyle,'important');if(st.lineHeight)el.style.setProperty('line-height',st.lineHeight,'important');}if(b.background)be.style.setProperty('background',b.background,'important');if(b.backgroundColor)be.style.setProperty('background-color',b.backgroundColor,'important');const bc=b.borderColor||'#3b3448';be.style.setProperty('border','1px solid '+bc,'important');be.style.setProperty('border-color',bc,'important');be.style.setProperty('border-style','solid','important');if(b.borderWidth!=null)be.style.setProperty('border-width',Number(b.borderWidth)+'px','important');if(b.borderRadius!=null)be.style.setProperty('border-radius',b.borderRadius+'px','important');if(b.opacity!=null)be.style.setProperty('opacity',b.opacity,'important');}
    const c=lay.choices||{left:50,top:42,width:56,height:30},ce=doc.getElementById('choices');
    if(ce){ce.style.setProperty('left',c.left+'%','important');ce.style.setProperty('top',c.top+'%','important');ce.style.setProperty('width',c.width+'%','important');if(c.height!=null)ce.style.setProperty('height',c.height+'%','important');ce.style.setProperty('bottom','auto','important');ce.style.setProperty('transform','translateX(-50%)','important');const it=c.item||{}, items=Array.isArray(c.items)?c.items:[];ce.querySelectorAll('.choice').forEach((ch,i)=>{ch.dataset.vnEditorChoice=String(i);const one={...it,...(items[i]||{})};if(one.background)ch.style.setProperty('background',one.background,'important');if(one.color)ch.style.setProperty('color',one.color,'important');if(one.borderColor)ch.style.setProperty('border-color',one.borderColor,'important');if(one.borderRadius!=null)ch.style.setProperty('border-radius',one.borderRadius+'px','important');if(one.fontSize)ch.style.setProperty('font-size',one.fontSize+'px','important');if(one.fontFamily)ch.style.setProperty('font-family',one.fontFamily,'important');if(one.fontWeight)ch.style.setProperty('font-weight',one.fontWeight,'important');if(one.padding!=null)ch.style.setProperty('padding',one.padding+'px','important');if(one.width!=null)ch.style.setProperty('width',one.width+'px','important');if(one.height!=null)ch.style.setProperty('height',one.height+'px','important');if(one.x!=null||one.y!=null){ch.style.setProperty('position','relative','important');ch.style.setProperty('left',Number(one.x||0)+'px','important');ch.style.setProperty('top',Number(one.y||0)+'px','important');}else{ch.style.setProperty('position','relative','important');ch.style.setProperty('left','0px','important');ch.style.setProperty('top','0px','important');}ch.style.setProperty('box-sizing','border-box','important');inlineAttachHandles(doc,ch);});}
    // Apply the editable layer stack as explicit z-indices. The order is stored
    // separately from sprite array order so text, dialogue and choices can move too.
    const order=inlineLayerOrder(node), z=new Map(order.map((k,i)=>[k,i+1]));
    const boxEl=doc.getElementById('box'), nameEl=doc.getElementById('name'), textEl=doc.getElementById('text'), choicesEl=doc.getElementById('choices');
    if(boxEl) boxEl.style.setProperty('z-index',String(Math.max(z.get('box')||1,z.get('name')||1,z.get('text')||1)),'important');
    if(nameEl) nameEl.style.setProperty('z-index',String(z.get('name')||3),'important');
    if(textEl) textEl.style.setProperty('z-index',String(z.get('text')||2),'important');
    if(choicesEl) choicesEl.style.setProperty('z-index',String(z.get('choices')||6),'important');
    (node.sprites||[]).forEach(s=>{const el=doc.querySelector('.sprite[data-vn-editor-sid="'+CSS.escape(String(s.id))+'"]');if(el)el.style.setProperty('z-index',String(z.get(inlineKey('sprite',s.id))||1),'important');});
    inlinePaintSelection();
  }
  // Single Inspector path for the Frame Editor.
  // Drag/resize updates only the existing properties pane so we do not rebuild
  // the Layers list on every pointermove. Selection/clicks still use the same
  // unified renderer below.
  function inlineRefreshUnifiedProperties(){
    const side=$('playEditSide');
    if(!side || !side.classList.contains('open')) return;
    const props=side.querySelector('.fe-properties');
    if(props) inlineRenderPropertiesInto(props);
    else inlineRenderFrameEditorSide();
  }

  function inlineRenderLayers(){
    const body=$('playEditBody');if(!body)return;const node=currentPreviewNode();if(!node)return;
    const entries=inlineLayerEntries(node);
    body.innerHTML='<div class="fe-layer-head"><span>СЛОИ · сверху вниз</span><span>'+entries.length+'</span></div><div class="fe-layers">'+entries.map(e=>'<div class="fe-layer '+(inlineStage.selected.includes(e.key)?'selected':'')+' '+(e.locked?'locked':'')+'" data-layer="'+esc(e.key)+'"><span class="fe-eye">'+(e.type==='sprite'&&e.sprite?.hide?'○':'●')+'</span><span class="fe-layer-name">'+esc(e.label)+'</span><span class="fe-layer-type">'+(e.type==='sprite'?'IMG':e.type==='box'?'TXT':e.type==='choices'?'CHO':'BG')+'</span><span class="fe-layer-arrows">'+(e.locked?'':'<button type="button" data-layer-move="up" title="Выше">▲</button><button type="button" data-layer-move="down" title="Ниже">▼</button>')+'</span></div>').join('')+'</div><div class="fe-tools"><button class="tb" data-fe="undo" '+(!inlineStage.history.length?'disabled':'')+'>↶</button><button class="tb" data-fe="redo" '+(!inlineStage.future.length?'disabled':'')+'>↷</button><button class="tb" data-fe="grid">▦ Сетка</button><button class="tb" data-fe="snap">⊞ Привязка</button></div>';
    let dragLayerKey=null;
    body.querySelectorAll('.fe-layer').forEach(el=>{
      el.draggable=true;
      el.addEventListener('dragstart',e=>{dragLayerKey=el.dataset.layer;e.dataTransfer?.setData('text/plain',dragLayerKey);el.classList.add('dragging');});
      el.addEventListener('dragend',()=>{dragLayerKey=null;el.classList.remove('dragging');});
      el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('drag-over');});
      el.addEventListener('dragleave',()=>el.classList.remove('drag-over'));
      el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('drag-over');const from=dragLayerKey||e.dataTransfer?.getData('text/plain');const to=el.dataset.layer;if(!from||from===to||from==='background'||to==='background')return;const order=inlineLayerOrder(node),a=order.indexOf(from),b=order.indexOf(to);if(a<0||b<0)return;inlinePushHistory();order.splice(a,1);order.splice(order.indexOf(to)+(a<b?0:1),0,from);inlineSetLayerOrder(node,order);inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();inlineRenderFrameEditorSide();});
      el.onclick=e=>{const k=el.dataset.layer;if(k.startsWith('sprite:')&&e.target.closest('.fe-eye')){const s=node.sprites.find(x=>String(x.id)===k.slice(7));if(s){inlinePushHistory();s.hide=!s.hide;inlineMarkDirty();inlineReloadPreviewFrame();}return;}if(e.target.closest('[data-layer-move]')){e.preventDefault();e.stopPropagation();inlineMoveLayer(k,e.target.closest('[data-layer-move]').dataset.layerMove==='up' ? 1 : -1);return;}inlineSelectKey(k,e.shiftKey);};
    });
    body.querySelector('[data-fe="undo"]').onclick=inlineUndo;body.querySelector('[data-fe="redo"]').onclick=inlineRedo;body.querySelector('[data-fe="grid"]').onclick=()=>{inlineStage.grid=!inlineStage.grid;const d=previewDoc();if(d)d.getElementById('stage')?.classList.toggle('vn-ie-grid',inlineStage.grid);};body.querySelector('[data-fe="snap"]').onclick=()=>{inlineStage.snap=!inlineStage.snap;inlineRenderFrameEditorSide();};
  }
  function inlineRenderFrameEditorSide(){
    const side=$('playEditSide'),body=$('playEditBody'),hint=$('playEditHint');if(!side||!body)return;const n=currentPreviewNode();
    side.classList.add('open','frame-editor');if(hint)hint.textContent=n?('Блок «'+(n.title||n.id)+'» · композиция кадра'):'Выберите блок';
    inlineRenderLayers();
    const props=document.createElement('div');props.className='fe-properties';body.appendChild(props); // layer list remains above properties
    inlineRenderPropertiesInto(props);
    requestAnimationFrame(()=>{ body.scrollTop=0; });
  }
  // Shared Frame Editor helpers. Keep these outside the Inspector renderer so both
  // selection/drag and the unified properties pane use the same actions.
  function inlineWireBoxProps(target,node){
    const b=node.layout?.box||{left:50,bottom:4,width:92,height:24};
    const apply=(a,k,raw)=>{
      inlinePushHistory();
      b[k]=(['x','y','w','h','br','bw'].includes(a))?Number(raw):String(raw);
      node.layout=node.layout||{};
      node.layout.box={...b};
      inlineApplyNodeToDom(node,previewDoc());
      inlineMarkDirty();
      inlineRefreshTree();
    };
    [['x','left'],['y','bottom'],['w','width'],['h','height'],['bg','backgroundColor'],['bc','borderColor'],['br','borderRadius'],['bw','borderWidth']].forEach(([a,k])=>{
      const el=target.querySelector('[data-p="'+a+'"]');
      if(el){
        el.onchange=()=>apply(a,k,el.value);
        if(['bg','bc'].includes(a)) el.oninput=()=>apply(a,k,el.value);
      }
    });
    [['bgColor','bg'],['bcColor','bc']].forEach(([picker,text])=>{
      const el=target.querySelector('[data-p="'+picker+'"]');
      const tx=target.querySelector('[data-p="'+text+'"]');
      if(el&&tx) el.oninput=()=>{tx.value=el.value;tx.dispatchEvent(new Event('change'));};
    });
  }

  function inlineMoveSpriteLayer(id,delta){
    const node=currentPreviewNode();
    if(!node)return;
    const i=(node.sprites||[]).findIndex(s=>String(s.id)===String(id));
    if(i<0)return;
    const j=Math.max(0,Math.min(node.sprites.length-1,i+delta));
    if(i===j)return;
    inlinePushHistory();
    const [sp]=node.sprites.splice(i,1);
    node.sprites.splice(j,0,sp);
    inlineMarkDirty();
    inlineReloadPreviewFrame();
  }

  function inlineDuplicateSprite(id){
    const node=currentPreviewNode();
    if(!node)return;
    const s=(node.sprites||[]).find(x=>String(x.id)===String(id));
    if(!s)return;
    inlinePushHistory();
    const copy=JSON.parse(JSON.stringify(s));
    copy.id=String(s.id||'sprite')+'_copy_'+Date.now().toString(36).slice(-4);
    copy.x=Math.min(120,Number(s.x??50)+4);
    copy.y=Math.min(120,Number(s.y??0)+2);
    copy.pos='custom';
    node.sprites.push(copy);
    inlineStage.selected=['sprite:'+copy.id];
    inlineMarkDirty();
    inlineReloadPreviewFrame();
  }

  function inlineDeleteSelected(){
    const node=currentPreviewNode();
    if(!node)return;
    const ids=inlineSelectedKeys().filter(k=>k.startsWith('sprite:')).map(k=>k.slice(7));
    if(!ids.length)return;
    inlinePushHistory();
    node.sprites=(node.sprites||[]).filter(s=>!ids.includes(String(s.id)));
    inlineStage.selected=[];
    inlineMarkDirty();
    inlineReloadPreviewFrame();
  }

  function inlineGroupAction(action){
    const node=currentPreviewNode();
    if(!node||inlineStage.selected.length<2)return;
    inlinePushHistory();
    const pos=inlineStage.selected.map(k=>({k,d:inlineReadPosition(node,k)})).filter(x=>x.d);
    if(action==='group-left'){
      const min=Math.min(...pos.map(x=>x.d.x));
      pos.forEach(x=>{
        if(x.d.type==='sprite'){
          const s=node.sprites.find(s=>String(s.id)===x.k.slice(7));
          if(s){s.x=min;s.pos='custom';}
        }
      });
    }else if(action==='group-center'){
      const avg=pos.reduce((a,x)=>a+x.d.x,0)/pos.length;
      pos.forEach(x=>{
        if(x.d.type==='sprite'){
          const s=node.sprites.find(s=>String(s.id)===x.k.slice(7));
          if(s){s.x=avg;s.pos='custom';}
        }
      });
    }
    inlineApplyNodeToDom(node,previewDoc());
    inlineMarkDirty();
    inlineRefreshTree();
  }

  function inlineRenderPropertiesInto(target){
    const old=$('playEditBody');if(!target)return;const node=currentPreviewNode();if(!node)return;const keys=inlineSelectedKeys();
    if(!keys.length){target.innerHTML='<div class="fe-empty">Выберите объект в кадре или в слоях.</div>';return;}
    if(keys.length>1){target.innerHTML='<div class="fe-selection-count">Выбрано: <b>'+keys.length+'</b></div><div class="fe-actions"><button class="tb" data-fe="group-left">По левому краю</button><button class="tb" data-fe="group-center">По центру</button></div>';target.querySelector('[data-fe="group-left"]').onclick=()=>inlineGroupAction('group-left');target.querySelector('[data-fe="group-center"]').onclick=()=>inlineGroupAction('group-center');return;}
    const k=keys[0];if(k==='background'){target.innerHTML='<div class="fe-empty"><b>Фон</b><br>Фон сцены используется как нижний слой.</div>';return;}
    if(k.startsWith('sprite:')){
      const s=node.sprites.find(x=>String(x.id)===k.slice(7)); if(!s)return;
      const xy=s.x!=null&&s.y!=null?{x:s.x,y:s.y}:(typeof window.slotXY==='function'?window.slotXY(s.pos||'bottom'):{x:50,y:0});
      const m=inlineMotion(s);
      const opts=Object.entries(INLINE_MOTION_PRESETS).map(([v,o])=>'<option value="'+v+'">'+o.label+'</option>').join('');
      const enterOpts='<option value="none">Без анимации</option><option value="fade">Плавное появление</option><option value="slide-left">Въезд слева</option><option value="slide-right">Въезд справа</option><option value="slide-up">Въезд снизу</option><option value="slide-down">Въезд сверху</option>';
      const exitOpts='<option value="none">Без анимации</option><option value="fade">Плавное исчезновение</option><option value="slide-left">Уход влево</option><option value="slide-right">Уход вправо</option><option value="slide-up">Уход вверх</option><option value="slide-down">Уход вниз</option>';
      const hasMotion=m.type!=='none';
      target.innerHTML='<div class="fe-prop-title">'+esc(s.id||'Персонаж')+'</div>'+
        '<label>X</label><input data-p="sx" type="number" step="0.1" value="'+xy.x+'">'+
        '<label>Y</label><input data-p="sy" type="number" step="0.1" value="'+xy.y+'">'+
        '<label>Масштаб</label><input data-p="ss" type="number" min="15" max="300" step="1" value="'+(s.scale||100)+'">'+
        '<div class="fe-motion-box"><div class="fe-motion-title">Появление и исчезновение</div>'+
        '<div class="fe-motion-grid"><div><label>Появление</label><select data-p="animIn">'+enterOpts+'</select></div>'+
        '<div><label>Длительность, сек</label><input data-p="animInDuration" type="number" min="0.1" max="10" step="0.1" value="'+(Number(s.animInDuration)||0.45)+'"></div></div>'+
        '<div class="fe-motion-grid"><div><label>Исчезновение</label><select data-p="animOut">'+exitOpts+'</select></div>'+
        '<div><label>Длительность, сек</label><input data-p="animOutDuration" type="number" min="0.1" max="10" step="0.1" value="'+(Number(s.animOutDuration)||0.35)+'"></div></div>'+
        '<div class="fe-actions"><button class="tb" data-p="previewIn">▶ Показать появление</button><button class="tb" data-p="previewOut">▶ Показать исчезновение</button></div>'+
        '<div class="fe-motion-hint">Эти параметры сохраняются у картинки и используются при переходе между кадрами.</div></div>'+
        '<div class="fe-motion-box"><div class="fe-motion-title">Постоянная анимация</div>'+
        '<label>Эффект</label><select data-p="motionType">'+opts+'</select>'+
        '<div class="fe-motion-details" data-p="motionDetails">'+
        '<div class="fe-motion-grid"><div><label>Длительность, сек</label><input data-p="motionDuration" type="number" min="0.2" max="30" step="0.1" value="'+m.duration+'"></div>'+
        '<div><label>Задержка, сек</label><input data-p="motionDelay" type="number" min="0" max="30" step="0.1" value="'+m.delay+'"></div></div>'+ 
        '<div class="fe-motion-grid"><div><label>Интенсивность</label><input data-p="motionIntensity" type="number" min="1" max="40" step="1" value="'+m.intensity+'"></div>'+ 
        '<div><label>Поворот, °</label><input data-p="motionRotate" type="number" min="0" max="12" step="0.5" value="'+m.rotate+'"></div></div>'+ 
        '<div class="fe-motion-grid"><div><label>Масштаб пульса</label><input data-p="motionScale" type="number" min="1" max="1.35" step="0.01" value="'+m.scale+'"></div>'+ 
        '<div><label>Повтор</label><select data-p="motionIteration"><option value="infinite">Зациклить</option><option value="once">Один раз</option><option value="2">2 раза</option></select></div></div>'+ 
        '<label>Сглаживание</label><select data-p="motionEasing"><option value="ease-in-out">Плавно</option><option value="linear">Линейно</option><option value="ease-in">С разгоном</option><option value="ease-out">С торможением</option></select>'+ 
        '<div class="fe-motion-hint">Анимация сохраняется у самой картинки и проигрывается в Preview и игре.</div></div>'+ 
        '<div class="fe-actions"><button class="tb" data-p="up">↑ Выше</button><button class="tb" data-p="down">↓ Ниже</button></div>'+ 
        '<div class="fe-actions"><button class="tb" data-p="dup">Дублировать</button><button class="tb" data-p="del">Удалить</button></div>';
      target.querySelector('[data-p="motionType"]').value=m.type;
      target.querySelector('[data-p="motionDetails"]').style.display=hasMotion?'block':'none';
      target.querySelector('[data-p="motionIteration"]').value=m.iteration;
      target.querySelector('[data-p="animIn"]').value=s.animIn != null ? s.animIn : (s.anim != null ? s.anim : 'fade');
      target.querySelector('[data-p="animOut"]').value=s.animOut != null ? s.animOut : (s.animIn != null ? s.animIn : 'fade');
      target.querySelector('[data-p="motionEasing"]').value=m.easing;
      const saveAppear=()=>{
        inlinePushHistory();
        s.animIn=target.querySelector('[data-p="animIn"]').value;
        s.animOut=target.querySelector('[data-p="animOut"]').value;
        s.animInDuration=Math.max(0.1,Math.min(10,Number(target.querySelector('[data-p="animInDuration"]').value)||0.45));
        s.animOutDuration=Math.max(0.1,Math.min(10,Number(target.querySelector('[data-p="animOutDuration"]').value)||0.35));
        // Keep explicit 'none' in the data model; it must not fall back to 'fade'.
        if(s.animIn==='none') s.animIn='none';
        if(s.animOut==='none') s.animOut='none';
        inlineApplyNodeToDom(node,previewDoc()); inlineMarkDirty();
      };
      target.querySelector('[data-p="animIn"]').onchange=saveAppear;
      target.querySelector('[data-p="animOut"]').onchange=saveAppear;
      target.querySelector('[data-p="animInDuration"]').onchange=saveAppear;
      target.querySelector('[data-p="animOutDuration"]').onchange=saveAppear;
      const resetPreviewAnimation=(el)=>{
        if(!el)return;
        try{ el.getAnimations().forEach(a=>a.cancel()); }catch(_){}
        el.style.removeProperty('animation');
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
      };
      target.querySelector('[data-p="previewIn"]').onclick=()=>{
        const d=previewDoc(); const outer=d?.querySelector('.sprite[data-vn-editor-sid="'+String(s.id).replace(/"/g,'\\"')+'"]');
        const el=outer?.querySelector(':scope > .sprite-visual') || outer;
        if(!el)return;
        const type=target.querySelector('[data-p="animIn"]').value;
        const dur=Math.max(0.1,Math.min(10,Number(target.querySelector('[data-p="animInDuration"]').value)||0.45));
        if(type==='none'){resetPreviewAnimation(el);return;}
        const map={fade:{from:{opacity:0,transform:'translate(0,0)'},to:{opacity:1,transform:'translate(0,0)'}},'slide-left':{from:{opacity:0,transform:'translateX(-70px)'},to:{opacity:1,transform:'translateX(0)'}},'slide-right':{from:{opacity:0,transform:'translateX(70px)'},to:{opacity:1,transform:'translateX(0)'}},'slide-up':{from:{opacity:0,transform:'translateY(-40px)'},to:{opacity:1,transform:'translateY(0)'}},'slide-down':{from:{opacity:0,transform:'translateY(50px)'},to:{opacity:1,transform:'translateY(0)'}}};
        resetPreviewAnimation(el);
        try{const a=el.animate([map[type].from,map[type].to],{duration:dur*1000,easing:'ease',fill:'both'});a.finished.then(()=>resetPreviewAnimation(el)).catch(()=>{});}catch(_){}
      };
      target.querySelector('[data-p="previewOut"]').onclick=()=>{
        const d=previewDoc(); const outer=d?.querySelector('.sprite[data-vn-editor-sid="'+String(s.id).replace(/"/g,'\\"')+'"]');
        const el=outer?.querySelector(':scope > .sprite-visual') || outer;
        if(!el)return;
        const type=target.querySelector('[data-p="animOut"]').value;
        const dur=Math.max(0.1,Math.min(10,Number(target.querySelector('[data-p="animOutDuration"]').value)||0.35));
        if(type==='none'){resetPreviewAnimation(el);return;}
        const map={fade:{from:{opacity:1,transform:'translate(0,0)'},to:{opacity:0,transform:'translate(0,0)'}},'slide-left':{from:{opacity:1,transform:'translate(0,0)'},to:{opacity:0,transform:'translateX(-70px)'}},'slide-right':{from:{opacity:1,transform:'translate(0,0)'},to:{opacity:0,transform:'translateX(70px)'}},'slide-up':{from:{opacity:1,transform:'translate(0,0)'},to:{opacity:0,transform:'translateY(-40px)'}},'slide-down':{from:{opacity:1,transform:'translate(0,0)'},to:{opacity:0,transform:'translateY(50px)'}}};
        resetPreviewAnimation(el);
        try{const a=el.animate([map[type].from,map[type].to],{duration:dur*1000,easing:'ease',fill:'forwards'});a.finished.then(()=>resetPreviewAnimation(el)).catch(()=>{});}catch(_){}
      };
      const saveMotion=()=>{
        inlinePushHistory();
        const type=target.querySelector('[data-p="motionType"]').value;
        if(type==='none') delete s.motion;
        else s.motion={type,duration:Number(target.querySelector('[data-p="motionDuration"]').value)||2.2,delay:Number(target.querySelector('[data-p="motionDelay"]').value)||0,easing:target.querySelector('[data-p="motionEasing"]').value,iteration:target.querySelector('[data-p="motionIteration"]').value,intensity:Number(target.querySelector('[data-p="motionIntensity"]').value)||8,rotate:Number(target.querySelector('[data-p="motionRotate"]').value)||2,scale:Number(target.querySelector('[data-p="motionScale"]').value)||1.04};
        const details=target.querySelector('[data-p="motionDetails"]'); if(details) details.style.display=type==='none'?'none':'block';
        inlineApplyNodeToDom(node,previewDoc()); inlineMarkDirty();
      };
      ['motionType','motionDuration','motionDelay','motionIntensity','motionRotate','motionScale','motionIteration','motionEasing'].forEach(a=>{const el=target.querySelector('[data-p="'+a+'"]'); if(el)el.onchange=saveMotion;});
      target.querySelector('[data-p="sx"]').onchange=e=>{inlinePushHistory();s.x=Number(e.target.value);s.pos='custom';inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();inlineRefreshTree();};
      target.querySelector('[data-p="sy"]').onchange=e=>{inlinePushHistory();s.y=Number(e.target.value);s.pos='custom';inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();inlineRefreshTree();};
      target.querySelector('[data-p="ss"]').onchange=e=>{inlinePushHistory();s.scale=Number(e.target.value)||100;inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();inlineRefreshTree();};
      target.querySelector('[data-p="up"]').onclick=()=>inlineMoveSpriteLayer(s.id,1); target.querySelector('[data-p="down"]').onclick=()=>inlineMoveSpriteLayer(s.id,-1); target.querySelector('[data-p="dup"]').onclick=()=>inlineDuplicateSprite(s.id); target.querySelector('[data-p="del"]').onclick=inlineDeleteSelected; return;
    }
    const lay=node.layout||{};
    if(k==='box'){const b=lay.box||{left:50,bottom:4,width:92,height:24},bg=String(b.backgroundColor||'#1f1a2e'),bc=String(b.borderColor||'#3b3448');target.innerHTML='<div class="fe-prop-title">Диалоговое окно</div><label>X</label><input data-p="x" type="number" step="0.1" value="'+(b.left??50)+'"><label>Y</label><input data-p="y" type="number" step="0.1" value="'+(b.bottom??4)+'"><label>Ширина</label><input data-p="w" type="number" min="30" max="95" step="0.5" value="'+(b.width??92)+'"><label>Высота</label><input data-p="h" type="number" min="10" max="80" step="0.5" value="'+(b.height??24)+'"><label>Фон</label><div class="fe-color-row"><input data-p="bgColor" type="color" value="'+(bg.match(/^#[0-9a-f]{6}$/i)?bg:'#1f1a2e')+'"><input data-p="bg" type="text" value="'+esc(bg)+'"></div><label>Рамка</label><div class="fe-color-row"><input data-p="bcColor" type="color" value="'+(bc.match(/^#[0-9a-f]{6}$/i)?bc:'#3b3448')+'"><input data-p="bc" type="text" value="'+esc(bc)+'"></div><label>Толщина рамки, px</label><input data-p="bw" type="number" min="0" max="12" step="1" value="'+(b.borderWidth??1)+'"><label>Скругление, px</label><input data-p="br" type="number" min="0" max="48" step="1" value="'+(b.borderRadius??10)+'">';inlineWireBoxProps(target,node);return;}
    if(k==='name'||k==='text'){const prop=k==='name'?'name':'text',d=k==='name'?{x:3,y:8,width:92,color:'#d9a0b7',fontSize:15,fontFamily:'Georgia, Times New Roman, serif',fontWeight:400,fontStyle:'italic'}:{x:3,y:28,width:94,color:'#efe7d6',fontSize:16.5,fontFamily:'ui-sans-serif, system-ui, sans-serif',fontWeight:400,fontStyle:'normal',lineHeight:1.55},st={...d,...(lay.box?.[prop]||{})};target.innerHTML='<div class="fe-prop-title">'+(k==='name'?'Имя / заголовок':'Текст реплики')+'</div><label>X внутри окна</label><input data-p="tx" type="number" step="0.5" value="'+st.x+'"><label>Y внутри окна</label><input data-p="ty" type="number" step="0.5" value="'+st.y+'"><label>Ширина</label><input data-p="tw" type="number" min="10" max="120" step="0.5" value="'+st.width+'"><label>Размер, px</label><input data-p="fs" type="number" min="6" max="96" step="0.5" value="'+st.fontSize+'"><label>Цвет текста</label><div class="fe-color-row"><input data-p="color" type="color" value="'+(String(st.color).match(/^#[0-9a-f]{6}$/i)?st.color:'#efe7d6')+'"><input data-p="colorText" type="text" value="'+esc(st.color)+'"></div><label>Шрифт</label><input data-p="ff" type="text" value="'+esc(st.fontFamily)+'"><label>Насыщенность</label><select data-p="fw"><option value="400">Обычный</option><option value="500">Средний</option><option value="600">Полужирный</option><option value="700">Жирный</option></select><label>Начертание</label><select data-p="fi"><option value="normal">Обычный</option><option value="italic">Курсив</option></select>'+(k==='text'?'<label>Межстрочный интервал</label><input data-p="lh" type="number" min="0.8" max="3" step="0.05" value="'+(st.lineHeight||1.55)+'">':'');target.querySelector('[data-p="fw"]').value=String(st.fontWeight||400);target.querySelector('[data-p="fi"]').value=st.fontStyle||'normal';target.querySelector('[data-p="color"]').oninput=e=>{target.querySelector('[data-p="colorText"]').value=e.target.value;target.querySelector('[data-p="colorText"]').dispatchEvent(new Event('change'));};['tx','ty','tw','fs','colorText','ff','fw','fi','lh'].forEach(a=>{const el=target.querySelector('[data-p="'+a+'"]');if(el)el.onchange=()=>{inlinePushHistory();const box={...(node.layout?.box||{}),[prop]:{...d,...(node.layout?.box?.[prop]||{})}},t=box[prop];if(a==='tx')t.x=Number(el.value);if(a==='ty')t.y=Number(el.value);if(a==='tw')t.width=Number(el.value);if(a==='fs')t.fontSize=Number(el.value);if(a==='colorText')t.color=el.value.trim();if(a==='ff')t.fontFamily=el.value;if(a==='fw')t.fontWeight=Number(el.value);if(a==='fi')t.fontStyle=el.value;if(a==='lh')t.lineHeight=Number(el.value);node.layout=node.layout||{};node.layout.box=box;inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();};});return;}
    if(k.startsWith('choice:')){const i=Number(k.slice(7)), choice=node.choices?.[i];if(!choice)return;const c=lay.choices||{},items=Array.isArray(c.items)?c.items:[],it={...(c.item||{}),...(items[i]||{})};const bg=(String(it.background||'').match(/^#[0-9a-f]{6}$/i)||[])[0]||'#1f1a2e',fg=(String(it.color||'').match(/^#[0-9a-f]{6}$/i)||[])[0]||'#efe7d6';target.innerHTML='<div class="fe-prop-title">Ответ '+(i+1)+'</div><label>Текст ответа</label><input data-p="label" type="text" value="'+esc(choice.label||'')+'"><label>Ширина, px</label><input data-p="w" type="number" min="60" max="900" step="1" value="'+(it.width||'')+'"><label>Высота, px</label><input data-p="h" type="number" min="24" max="300" step="1" value="'+(it.height||'')+'"><label>Фон</label><div class="fe-color-row"><input data-p="bgColor" type="color" value="'+bg+'"><input data-p="bg" type="text" value="'+esc(it.background||'rgba(31,26,46,.95)')+'"></div><label>Цвет текста</label><div class="fe-color-row"><input data-p="color" type="color" value="'+fg+'"><input data-p="colorText" type="text" value="'+esc(it.color||'#efe7d6')+'"></div><label>Размер текста</label><input data-p="fs" type="number" min="8" max="48" step="0.5" value="'+(it.fontSize||15)+'"><label>Рамка</label><div class="fe-color-row"><input data-p="bcColor" type="color" value="'+((String(it.borderColor||'').match(/^#[0-9a-f]{6}$/i)||[])[0]||'#3b3448')+'"><input data-p="bc" type="text" value="'+esc(it.borderColor||'')+'"></div><label>Скругление, px</label><input data-p="br" type="number" min="0" max="40" step="1" value="'+(it.borderRadius??8)+'"><label>Внутренний отступ, px</label><input data-p="pad" type="number" min="0" max="60" step="1" value="'+(it.padding??10)+'">';
      const update=(field,value)=>{inlinePushHistory();const nc={...(node.layout?.choices||c),items:Array.isArray(node.layout?.choices?.items)?node.layout.choices.items.slice():[]};nc.items[i]={...(nc.items[i]||{}),[field]:value};node.layout=node.layout||{};node.layout.choices=nc;inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();};
      target.querySelector('[data-p="label"]').onchange=e=>{inlinePushHistory();choice.label=e.target.value;inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();};
      [['w','width'],['h','height'],['fs','fontSize'],['br','borderRadius'],['pad','padding']].forEach(([a,f])=>target.querySelector('[data-p="'+a+'"]').onchange=e=>update(f,Number(e.target.value)));
      [['bg','background'],['colorText','color'],['bc','borderColor']].forEach(([a,f])=>target.querySelector('[data-p="'+a+'"]').onchange=e=>update(f,e.target.value.trim()));
      [['bgColor','bg'],['color','colorText'],['bcColor','bc']].forEach(([a,b])=>{const el=target.querySelector('[data-p="'+a+'"]'),tx=target.querySelector('[data-p="'+b+'"]');el.oninput=()=>{tx.value=el.value;tx.dispatchEvent(new Event('change'));};});return;}
    if(k==='choices'){const c=lay.choices||{left:50,top:42,width:56,height:30},it=c.item||{},bg=(String(it.background||'').match(/^#[0-9a-f]{6}$/i)||[])[0]||'#1f1a2e',fg=(String(it.color||'').match(/^#[0-9a-f]{6}$/i)||[])[0]||'#efe7d6';target.innerHTML='<div class="fe-prop-title">Варианты выбора</div><label>X</label><input data-p="x" type="number" step="0.1" value="'+c.left+'"><label>Y</label><input data-p="y" type="number" step="0.1" value="'+c.top+'"><label>Ширина</label><input data-p="w" type="number" min="20" max="90" step="0.5" value="'+c.width+'"><label>Высота</label><input data-p="h" type="number" min="10" max="90" step="0.5" value="'+(c.height||30)+'"><label>Фон кнопок</label><div class="fe-color-row"><input data-p="cbgColor" type="color" value="'+bg+'"><input data-p="cbg" type="text" value="'+esc(it.background||'rgba(31,26,46,.95)')+'"></div><label>Цвет текста</label><div class="fe-color-row"><input data-p="ccColor" type="color" value="'+fg+'"><input data-p="cc" type="text" value="'+esc(it.color||'#efe7d6')+'"></div><label>Размер текста</label><input data-p="cfs" type="number" min="8" max="48" step="0.5" value="'+(it.fontSize||15)+'"><label>Скругление</label><input data-p="cbr" type="number" min="0" max="40" step="1" value="'+(it.borderRadius??8)+'">';[['x','left'],['y','top'],['w','width'],['h','height']].forEach(([a,key])=>target.querySelector('[data-p="'+a+'"]').onchange=e=>{inlinePushHistory();const nc={...(node.layout?.choices||c),[key]:Number(e.target.value)};node.layout=node.layout||{};node.layout.choices=nc;inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();});[['cbg','background'],['cc','color'],['cfs','fontSize'],['cbr','borderRadius']].forEach(([a,key])=>target.querySelector('[data-p="'+a+'"]').onchange=e=>{inlinePushHistory();const nc={...(node.layout?.choices||c),item:{...(node.layout?.choices?.item||it),[key]:(key==='fontSize'||key==='borderRadius')?Number(e.target.value):e.target.value}};node.layout=node.layout||{};node.layout.choices=nc;inlineApplyNodeToDom(node,previewDoc());inlineMarkDirty();});[['cbgColor','cbg'],['ccColor','cc']].forEach(([picker,text])=>{const el=target.querySelector('[data-p="'+picker+'"]'),tx=target.querySelector('[data-p="'+text+'"]');if(el)el.oninput=()=>{tx.value=el.value;tx.dispatchEvent(new Event('change'));};});}
  }
  function inlineReloadPreviewFrame(){
    const n=currentPreviewNode();if(!n)return;
    try{openPlayPreview(n.id);}catch(_){ }
    setTimeout(()=>{if(inlineStage.active)setInlineStageMode(true);},160);
  }
  function inlineRenderFrame(){const d=previewDoc();if(!d)return;inlineBind(d);inlineApplyNodeToDom(currentPreviewNode(),d);}
  // Runtime layout bridge: the editor stores rich frame layout in node.layout,
  // while the legacy VN runtime only consumes box/choices position + width.
  // Re-apply the saved visual properties inside the Preview iframe after the
  // runtime rebuilds #box/#choices. This keeps Preview and Frame Editor in sync
  // without changing the scenario data model.
  function applyRuntimeLayoutBridge(node, doc){
    if(!node || !doc) return;
    const stage=doc.getElementById('stage');
    const lay=node.layout||{};
    const b=lay.box||{};
    const c=lay.choices||{};
    const box=doc.getElementById('box');
    if(box){
      if(b.left!=null) box.style.setProperty('left',Number(b.left)+'%','important');
      if(b.bottom!=null) box.style.setProperty('bottom',Number(b.bottom)+'%','important');
      if(b.width!=null) box.style.setProperty('width',Number(b.width)+'%','important');
      if(b.height!=null) box.style.setProperty('height',Number(b.height)+'%','important');
      box.style.setProperty('max-width','none','important');
      box.style.setProperty('box-sizing','border-box','important');
      box.style.setProperty('top','auto','important');
      box.style.setProperty('right','auto','important');
      box.style.setProperty('transform','translateX(-50%)','important');
      if(b.background) box.style.setProperty('background',String(b.background),'important');
      if(b.backgroundColor) box.style.setProperty('background-color',String(b.backgroundColor),'important');
      if(b.borderColor || b.borderWidth!=null || b.borderRadius!=null){
        box.style.setProperty('border-style','solid','important');
        box.style.setProperty('border-color',String(b.borderColor||'#3b3448'),'important');
        box.style.setProperty('border-width',Number(b.borderWidth!=null?b.borderWidth:1)+'px','important');
        if(b.borderRadius!=null) box.style.setProperty('border-radius',Number(b.borderRadius)+'px','important');
      }
      if(b.opacity!=null) box.style.setProperty('opacity',String(b.opacity),'important');
    }
    const defs={
      name:{x:3,y:8,width:92,color:'#d9a0b7',fontSize:15,fontFamily:'Georgia, Times New Roman, serif',fontWeight:400,fontStyle:'italic'},
      text:{x:3,y:28,width:94,color:'#efe7d6',fontSize:16.5,fontFamily:'ui-sans-serif, system-ui, sans-serif',fontWeight:400,fontStyle:'normal',lineHeight:1.55}
    };
    for(const prop of ['name','text']){
      const el=doc.getElementById(prop), st={...defs[prop],...(b[prop]||{})};
      if(!el) continue;
      el.style.setProperty('position','absolute','important');
      el.style.setProperty('left',Number(st.x||0)+'%','important');
      el.style.setProperty('top',Number(st.y||0)+'%','important');
      el.style.setProperty('width',Number(st.width||defs[prop].width)+'%','important');
      el.style.setProperty('right','auto','important');
      el.style.setProperty('bottom','auto','important');
      el.style.setProperty('margin','0','important');
      el.style.setProperty('max-width','none','important');
      if(st.color) el.style.setProperty('color',String(st.color),'important');
      if(st.fontSize) el.style.setProperty('font-size',Number(st.fontSize)+'px','important');
      if(st.fontFamily) el.style.setProperty('font-family',String(st.fontFamily),'important');
      if(st.fontWeight) el.style.setProperty('font-weight',String(st.fontWeight),'important');
      if(st.fontStyle) el.style.setProperty('font-style',String(st.fontStyle),'important');
      if(st.lineHeight) el.style.setProperty('line-height',String(st.lineHeight),'important');
    }
    const choices=doc.getElementById('choices');
    if(choices){
      if(c.left!=null) choices.style.setProperty('left',Number(c.left)+'%','important');
      if(c.top!=null) choices.style.setProperty('top',Number(c.top)+'%','important');
      if(c.width!=null) choices.style.setProperty('width',Number(c.width)+'%','important');
      if(c.height!=null) choices.style.setProperty('height',Number(c.height)+'%','important');
      choices.style.setProperty('max-width','none','important');
      choices.style.setProperty('bottom','auto','important');
      choices.style.setProperty('transform','translateX(-50%)','important');
      const common=c.item||{};
      const items=Array.isArray(c.items)?c.items:[];
      choices.querySelectorAll('.choice').forEach((el,i)=>{
        const one={...common,...(items[i]||{})};
        if(one.background) el.style.setProperty('background',String(one.background),'important');
        if(one.color) el.style.setProperty('color',String(one.color),'important');
        if(one.borderColor) el.style.setProperty('border-color',String(one.borderColor),'important');
        if(one.borderWidth!=null) el.style.setProperty('border-width',Number(one.borderWidth)+'px','important');
        if(one.borderRadius!=null) el.style.setProperty('border-radius',Number(one.borderRadius)+'px','important');
        if(one.fontSize!=null) el.style.setProperty('font-size',Number(one.fontSize)+'px','important');
        if(one.fontFamily) el.style.setProperty('font-family',String(one.fontFamily),'important');
        if(one.fontWeight!=null) el.style.setProperty('font-weight',String(one.fontWeight),'important');
        if(one.padding!=null) el.style.setProperty('padding',Number(one.padding)+'px','important');
        if(one.width!=null) el.style.setProperty('width',Number(one.width)+'px','important');
        if(one.height!=null) el.style.setProperty('height',Number(one.height)+'px','important');
        if(one.x!=null || one.y!=null){
          el.style.setProperty('position','relative','important');
          el.style.setProperty('left',Number(one.x||0)+'px','important');
          el.style.setProperty('top',Number(one.y||0)+'px','important');
        }
        el.style.setProperty('box-sizing','border-box','important');
      });
    }
    // Apply saved layer ordering to the actual runtime DOM too.
    const order=inlineLayerOrder(node), z=new Map(order.map((k,i)=>[k,i+1]));
    const setZ=(el,key)=>{if(el) el.style.setProperty('z-index',String(z.get(key)||1),'important');};
    setZ(stage,'background'); setZ(box,'box'); setZ(doc.getElementById('name'),'name'); setZ(doc.getElementById('text'),'text'); setZ(choices,'choices');
    (node.sprites||[]).forEach(s=>setZ(doc.querySelector('.sprite[data-vn-editor-sid="'+CSS.escape(String(s.id))+'"]'),inlineKey('sprite',s.id)));
  }

  const runtimeLayoutBridge={iframe:null,observer:null,started:false};
  function startRuntimeLayoutBridge(){
    const frame=$('playPreviewFrame'); if(!frame) return;
    if(runtimeLayoutBridge.started && runtimeLayoutBridge.iframe===frame) return;
    runtimeLayoutBridge.started=true; runtimeLayoutBridge.iframe=frame;
    const sync=()=>{
      const doc=previewDoc(), node=currentPreviewNode();
      if(!doc||!node||!doc.getElementById('stage')) return;
      applyRuntimeLayoutBridge(node,doc);
    };
    frame.addEventListener('load',()=>{setTimeout(sync,0);setTimeout(sync,80);setTimeout(sync,340);setTimeout(sync,700);});
    window.addEventListener('message',e=>{
      if(!e.data || e.data.type!=='vn-preview-progress') return;
      const syncNode=()=>{
        const doc=previewDoc(); if(!doc) return;
        let node=currentPreviewNode();
        if(!node){
          try{ const list=typeof nodes!=='undefined'&&Array.isArray(nodes)?nodes:[]; node=list.find(n=>String(n.id)===String(e.data.nodeId))||null; }catch(_){}
        }
        if(!node) return;
        applyRuntimeLayoutBridge(node,doc);
      };
      setTimeout(syncNode,0); setTimeout(syncNode,70); setTimeout(syncNode,360); setTimeout(syncNode,720);
    });
    const observe=()=>{
      const doc=previewDoc(), stage=doc&&doc.getElementById('stage');
      if(!stage){setTimeout(observe,120);return;}
      if(runtimeLayoutBridge.observer) runtimeLayoutBridge.observer.disconnect();
      runtimeLayoutBridge.observer=new MutationObserver(()=>{
        const node=currentPreviewNode(); if(node) applyRuntimeLayoutBridge(node,doc);
      });
      runtimeLayoutBridge.observer.observe(stage,{childList:true,subtree:true});
      sync();
    };
    observe();
  }
  function setInlineStageMode(on){
    const frame=$('playPreviewFrame'),btn=$('playPreviewStageBtn');if(!frame)return;
    if(!on){try{inlineStage.cleanup?.();}catch(_){} inlineStage.active=false;inlineStage.cleanup=null;inlineStage.selected=[];document.getElementById('playPreviewBody')?.classList.remove('vn-inline-active');$('playEditSide')?.classList.remove('frame-editor');if(btn){btn.classList.remove('active');btn.textContent='✦ Редактор кадра';}return;}
    const doc=previewDoc();if(!doc||!doc.getElementById('stage')){if(typeof window.notify==='function')window.notify('Превью ещё загружается — попробуйте ещё раз','err');return;}
    try{inlineStage.cleanup?.();}catch(_){}
    inlineStage.active=true;inlineStage.iframe=frame;document.getElementById('playPreviewBody')?.classList.add('vn-inline-active');inlineBind(doc);inlineRenderFrameEditorSide();
    if(btn){btn.classList.add('active');btn.textContent='✓ Редактор кадра';}
  }
  // Compatibility with the legacy Preview settings button. The new Frame Editor
  // owns the frame layout, but older core builds still call this global handler.
  window.applyPlayEditAndResume = function(){
    const node=currentPreviewNode();
    if(!node){ try{ if(typeof window.notify==='function') window.notify('Нет текущего блока','err'); }catch(_){} return; }
    const nBgm=document.getElementById('peNodeBgm');
    const nSfx=document.getElementById('peNodeSfx');
    const nVol=document.getElementById('peNodeBgmVol');
    if(nBgm) node.bgm=nBgm.value.trim();
    if(nSfx) node.sfx=nSfx.value.trim();
    if(nVol) node.bgmVol=Number(nVol.value)/100;
    try{ if(typeof window.markDirty==='function') window.markDirty(); }catch(_){}
    try{ if(typeof window.notify==='function') window.notify('Настройки применены','ok'); }catch(_){}
    try{ inlineRenderFrame(); }catch(_){}
  };

  function bindPreviewStageButton(){
    const btn=$('playPreviewStageBtn');if(!btn||btn.dataset.myuiInlineStageBound)return;btn.dataset.myuiInlineStageBound='1';
    btn.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();setInlineStageMode(!inlineStage.active);};
    const frame=$('playPreviewFrame');frame?.addEventListener('load',()=>{if(inlineStage.active)setTimeout(()=>setInlineStageMode(true),80);});
    document.addEventListener('keydown',e=>{if(!inlineStage.active)return;const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?inlineRedo():inlineUndo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();inlineRedo();}else if(e.key==='Delete'){e.preventDefault();inlineDeleteSelected();}else if(e.key==='Escape'){setInlineStageMode(false);}});
  }

  function bindSettingsPanel(){
    const wrap = document.querySelector('.myui-settings');
    const trigger = wrap?.querySelector('.myui-settings-trigger');
    const slider = $('myuiPerfSlider');
    if(!wrap || !trigger || !slider || trigger.dataset.myuiSettingsBound) return;
    trigger.dataset.myuiSettingsBound = '1';
    const close = () => {
      wrap.classList.remove('open');
      trigger.setAttribute('aria-expanded','false');
    };
    trigger.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const open = !wrap.classList.contains('open');
      wrap.classList.toggle('open', open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if(open) perfState.updateSettingsUI();
    });
    slider.addEventListener('input', () => perfState.applyLevel(slider.value));
    document.addEventListener('click', e => {
      if(!e.target.closest('.myui-settings')) close();
    });
    perfState.updateSettingsUI();
  }

  function bindMoreMenu(){
    const wrap = document.querySelector('.myui-more');
    const trigger = wrap?.querySelector('.myui-more-trigger');
    if(!wrap || !trigger || trigger.dataset.myuiMoreBound) return;
    trigger.dataset.myuiMoreBound = '1';
    trigger.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if(!e.target.closest('.myui-more')) wrap.classList.remove('open');
    });
  }

  function bindProxyButtons(){
    document.querySelectorAll('[data-proxy]').forEach(btn => {
      if(btn.dataset.myuiProxyBound) return;
      btn.dataset.myuiProxyBound = '1';
      btn.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        const target = $(btn.dataset.proxy);
        if(target) target.click();
      });
    });
  }


  // ---- Inspector UX layer -----------------------------------------------
  // The core still owns the real inspector/data handlers. This layer only
  // adds hierarchy and presentation after the core renders the inspector.
  function enhanceInspector(){
    const body = document.getElementById('inspBody');
    const title = document.getElementById('inspTitle');
    if(!body) return;
    const sections = Array.from(body.querySelectorAll(':scope > .insp-section'));
    if(!sections.length) return;

    sections.forEach(section => {
      if(section.dataset.myuiEnhanced === '1') return;
      section.dataset.myuiEnhanced = '1';
      const has = sel => !!section.querySelector(sel);
      const hasTitle = has('#iTitle');
      const hasText = has('#iText');
      const hasAudio = has('#iBgm, #iSfx, #iBgmUrl, #iSfxUrl');
      const hasVariants = has('#iTexts, #iAddText');
      const hasChoices = has('#iChoices, #iAddChoice, #iPlainNext');
      const hasSprites = has('#spritesBox, #toggleSprites');
      let kind = 'secondary';
      if(hasTitle || hasText || section.id === 'iSpeakerWrap') kind = 'primary';
      if(hasVariants || hasChoices) kind = 'logic';
      if(hasAudio) kind = 'audio';
      if(hasSprites) kind = 'scene';
      section.dataset.myuiKind = kind;
      section.classList.add('myui-insp-section');
      if(kind === 'audio' || kind === 'scene') section.classList.add('myui-insp-secondary');
      if(hasVariants) section.classList.add('myui-insp-variants');
      if(hasChoices) section.classList.add('myui-insp-choices');
      if(!section.querySelector('.myui-insp-kicker')){
        const kicker=document.createElement('div');
        kicker.className='myui-insp-kicker';
        kicker.textContent = kind==='primary' ? (hasText?'Содержание':'Основное')
          : kind==='logic' ? (hasVariants?'Условная логика':'Переход')
          : kind==='audio' ? 'Звук' : 'Сцена';
        section.insertBefore(kicker, section.firstChild);
      }
    });

    if(title && !title.parentElement.querySelector('.myui-insp-subtitle')){
      const sub=document.createElement('div');
      sub.className='myui-insp-subtitle';
      sub.id='myuiInspSubtitle';
      title.parentElement.insertBefore(sub,title.nextSibling);
    }
    const sub=document.getElementById('myuiInspSubtitle');
    const selected=document.querySelector('.node.selected');
    if(sub) sub.textContent=selected ? ('Блок · '+(selected.dataset.id||'')) : 'Сценарный блок';
  }

  function installInspectorHook(){
    if(typeof window.renderNodeInspector !== 'function' || window.__MYUI_INSPECTOR_HOOK__) return;
    const original=window.renderNodeInspector;
    window.renderNodeInspector=function(){
      const result=original.apply(this,arguments);
      requestAnimationFrame(enhanceInspector);
      return result;
    };
    window.__MYUI_INSPECTOR_HOOK__=true;
  }

  function storyTree(){
    const body = $('storyTreeBody');
    const canvas = $('canvas');
    if(!body || !canvas) return;

    let collapsed = new Set();
    try { collapsed = new Set(JSON.parse(localStorage.getItem('vn_myui_collapsed_scenes') || '[]')); } catch(_){}
    const saveCollapsed = () => localStorage.setItem('vn_myui_collapsed_scenes', JSON.stringify([...collapsed]));

    function sceneInfo(){
      return [...canvas.querySelectorAll('.scene-bg')].map(bg => {
        const id = bg.dataset.id;
        const header = [...canvas.querySelectorAll('.scene-header')].find(x => x.dataset.id === id);
        const input = header?.querySelector('input');
        const st = bg.style;
        return {
          id,
          name: input?.value || 'Без названия',
          color: header?.style.background || '',
          x: parseFloat(st.left) || 0,
          y: parseFloat(st.top) || 0,
          w: parseFloat(st.width) || 0,
          h: parseFloat(st.height) || 0
        };
      });
    }

    function nodeInfo(){
      return [...canvas.querySelectorAll('.node')].map(el => ({
        el,
        id: el.dataset.id,
        title: el.querySelector('.node-title')?.textContent?.trim() || '',
        speaker: el.querySelector('.node-speaker')?.textContent?.trim() || '',
        preview: el.querySelector('.node-preview')?.textContent?.trim() || '',
        badge: el.querySelector('.node-badge')?.textContent?.trim() || 'реплика',
        meta: [...el.querySelectorAll('.node-chip')].map(x => x.textContent.trim()).filter(Boolean),
        x: parseFloat(el.style.left) || 0,
        y: parseFloat(el.style.top) || 0
      }));
    }

    function owner(n, scenes){
      // Keep the same ownership rule as the core: node center point inside scene.
      const cx = n.x + 100, cy = n.y + 18;
      return scenes.find(s => cx >= s.x && cx <= s.x + s.w && cy >= s.y && cy <= s.y + s.h) || null;
    }

    function focusElement(el){
      const viewport = $('viewport');
      if(!viewport || !el) return;
      try{
        const vr = viewport.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const dx = (vr.left + vr.width / 2) - (er.left + er.width / 2);
        const dy = (vr.top + vr.height / 2) - (er.top + er.height / 2);
        const current = getComputedStyle(canvas).transform;
        let panX = 0, panY = 0, zoom = 1;
        const m = current && current !== 'none' ? new DOMMatrix(current) : null;
        if(m){ panX = m.e; panY = m.f; zoom = m.a || 1; }
        // Canvas is transformed; compensate in screen pixels.
        canvas.style.transform = `translate(${panX + dx}px,${panY + dy}px) scale(${zoom})`;
      }catch(_){}
    }

    function selectNode(id){
      const el = canvas.querySelector('.node[data-id="'+escSel(id)+'"]');
      if(!el) return;
      el.click();
      setTimeout(() => focusElement(el), 0);
    }

    function selectScene(id){
      const el = [...canvas.querySelectorAll('.scene-header')].find(x => x.dataset.id === id);
      if(!el) return;
      const props = el.querySelector('.sc-props');
      (props || el).click();
      setTimeout(() => focusElement(el), 0);
    }

    function toggleScene(id){
      if(collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
      saveCollapsed();
      render();
    }

    function nodeRow(n){
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'story-node';
      row.dataset.node = n.id;

      const mark = n.badge === 'описание' ? '✦' : '●';
      const title = n.title || n.speaker || 'Без названия';
      const detail = n.preview || (n.speaker ? 'Пустая реплика' : 'Пустой блок');
      const meta = n.meta.slice(0, 2).join(' · ');

      row.innerHTML =
        '<span class="story-node-mark">'+mark+'</span>' +
        '<span class="story-node-copy">' +
          '<strong>'+esc(title)+'</strong>' +
          '<small>'+esc(detail)+'</small>' +
          (meta ? '<em>'+esc(meta)+'</em>' : '') +
        '</span>';
      row.title = n.preview || title;
      row.addEventListener('click', () => selectNode(n.id));
      return row;
    }

    function render(){
      const scenes = sceneInfo();
      const nodes = nodeInfo();
      body.innerHTML = '';

      if(!scenes.length && !nodes.length){
        body.innerHTML =
          '<div class="story-empty">' +
            '<b>История пока пуста</b>' +
            '<span>Создайте сцену или первый блок сверху.</span>' +
          '</div>';
        syncSelected();
        return;
      }

      // Keep the same visual order as the canvas: top-to-bottom, then left-to-right.
      scenes.sort((a,b) => a.y - b.y || a.x - b.x);
      nodes.sort((a,b) => a.y - b.y || a.x - b.x);

      scenes.forEach(scene => {
        const wrap = document.createElement('section');
        wrap.className = 'story-scene';
        wrap.dataset.scene = scene.id;

        const owned = nodes
          .filter(n => owner(n, scenes)?.id === scene.id)
          .sort((a,b) => a.y - b.y || a.x - b.x);
        const isCollapsed = collapsed.has(scene.id);

        const head = document.createElement('div');
        head.className = 'story-scene-head';
        head.setAttribute('role','button');
        head.setAttribute('tabindex','0');
        head.setAttribute('aria-expanded', String(!isCollapsed));
        head.innerHTML =
          '<button type="button" class="story-chevron" aria-label="Свернуть сцену">'+(isCollapsed?'›':'⌄')+'</button>' +
          '<span class="story-scene-dot"></span>' +
          '<span class="story-scene-name">'+esc(scene.name)+'</span>' +
          '<span class="story-count">'+owned.length+'</span>';

        const chevron = head.querySelector('.story-chevron');
        chevron.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();
          toggleScene(scene.id);
        });
        head.addEventListener('click', () => selectScene(scene.id));
        head.addEventListener('keydown', e => {
          if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); selectScene(scene.id); }
        });

        const list = document.createElement('div');
        list.className = 'story-scene-list';
        list.hidden = isCollapsed;
        owned.forEach(n => list.appendChild(nodeRow(n)));

        wrap.append(head, list);
        body.appendChild(wrap);
      });

      const loose = nodes.filter(n => !owner(n, scenes));
      if(loose.length){
        const wrap = document.createElement('section');
        wrap.className = 'story-scene story-loose';
        wrap.innerHTML =
          '<div class="story-unassigned"><span>Вне сцен</span><span class="story-count">'+loose.length+'</span></div>';
        const list = document.createElement('div');
        list.className = 'story-scene-list';
        loose.forEach(n => list.appendChild(nodeRow(n)));
        wrap.appendChild(list);
        body.appendChild(wrap);
      }

      syncSelected();
    }

    function syncSelected(){
      body.querySelectorAll('.story-node.active,.story-scene.active').forEach(x => x.classList.remove('active'));

      const selectedNode = canvas.querySelector('.node.selected')?.dataset.id;
      if(selectedNode){
        const row = body.querySelector('.story-node[data-node="'+escSel(selectedNode)+'"]');
        if(row){
          row.classList.add('active');
          const scene = row.closest('.story-scene');
          if(scene){
            const list = scene.querySelector('.story-scene-list');
            if(list?.hidden){
              collapsed.delete(scene.dataset.scene);
              saveCollapsed();
              render();
              return;
            }
            row.scrollIntoView({block:'nearest'});
          }
        }
        return;
      }

      const selectedScene = canvas.querySelector('.scene-header.selected')?.dataset.id;
      if(selectedScene){
        const wrap = body.querySelector('.story-scene[data-scene="'+escSel(selectedScene)+'"]');
        if(wrap) wrap.classList.add('active');
      }
    }

    $('storyRefresh')?.addEventListener('click', render);

    // Scene names are edited by the core through the input value property, so an
    // attribute-only MutationObserver would not see the change. Listen directly.
    canvas.addEventListener('input', e => {
      if(e.target.closest('.scene-header input')) setTimeout(render, 0);
    });

    const observer = new MutationObserver(() => {
      // During a block drag the core mutates left/top on every pointermove.
      // Rebuilding the whole Story Tree here is unnecessary work; the final
      // pointerup path already refreshes it once.
      if(perfState.enabled && document.documentElement.classList.contains('myui-perf-dragging')) return;
      clearTimeout(observer._t);
      observer._t = setTimeout(render, perfState.enabled && perfState.flags.deferStoryTree ? 120 : 50);
    });
    observer.observe(canvas, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:['class','style','data-id']
    });

    document.addEventListener('click', e => {
      if(e.target.closest('.node,.scene-header,.story-node,.story-scene-head')) setTimeout(syncSelected,0);
    });
    window.addEventListener('resize', () => setTimeout(render,0));

    window.VN_MYUI = { renderStoryTree: render, bindCoreButtons, performance: perfState };
    render();
  }

  // Keep the editor grid visually infinite while preserving the same world-space
  // rhythm during pan/zoom. The grid lives on #viewport; this observer mirrors
  // the core canvas transform without touching core state or data.
  function syncInfiniteGrid(){
    const canvasEl = document.getElementById('canvas');
    const viewportEl = document.getElementById('viewport');
    if(!canvasEl || !viewportEl) return;
    const tr = canvasEl.style.transform || '';
    const m = tr.match(/translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)\s*scale\(\s*([\d.]+)\s*\)/);
    if(!m) return;
    const x = Number(m[1]) || 0;
    const y = Number(m[2]) || 0;
    const z = Number(m[3]) || 1;
    const step = 32 * z;
    viewportEl.style.setProperty('--myui-grid-size', step + 'px');
    viewportEl.style.setProperty('--myui-grid-x', x + 'px');
    viewportEl.style.setProperty('--myui-grid-y', y + 'px');
  }
  const gridCanvas = document.getElementById('canvas');
  if(gridCanvas){
    let gridRaf = 0;
    const scheduleGridSync = () => {
      if(!perfState.enabled || !perfState.flags.rafGrid){
        syncInfiniteGrid();
        return;
      }
      if(gridRaf) return;
      gridRaf = requestAnimationFrame(() => {
        gridRaf = 0;
        perfState.stats.gridFrames++;
        syncInfiniteGrid();
      });
    };
    const gridObserver = new MutationObserver(scheduleGridSync);
    gridObserver.observe(gridCanvas, {attributes:true, attributeFilter:['style']});
    requestAnimationFrame(scheduleGridSync);
  }

  // The core owns actual pan/drag state. This capture-only layer adds a cheap
  // rendering hint while those gestures are active, without replacing core handlers.
  function installPerfGestureHints(){
    const viewport = $('viewport');
    if(!viewport || viewport.dataset.myuiPerfBound) return;
    viewport.dataset.myuiPerfBound = '1';
    const root = document.documentElement;
    let raf = 0;
    let last = 0;
    const sampleFrame = (ts) => {
      raf = 0;
      if(!root.classList.contains('myui-perf-panning') && !root.classList.contains('myui-perf-dragging')) return;
      if(last){
        const dt = ts - last;
        perfState.stats.perfFrames++;
        if(dt > 20) perfState.stats.slowFrames++;
        if(dt > perfState.stats.maxFrameMs) perfState.stats.maxFrameMs = Math.round(dt * 10) / 10;
      }
      last = ts;
      raf = requestAnimationFrame(sampleFrame);
    };
    const startSample = () => {
      if(!raf) { last = 0; raf = requestAnimationFrame(sampleFrame); }
    };
    const clear = () => {
      root.classList.remove('myui-perf-panning','myui-perf-dragging');
      if(raf){ cancelAnimationFrame(raf); raf = 0; }
      last = 0;
    };
    viewport.addEventListener('pointerdown', e => {
      if(!perfState.enabled || e.button !== 0) return;
      const isCanvasDrag = !!e.target.closest('.node,.scene-header,.scene-handle');
      root.classList.toggle('myui-perf-dragging', isCanvasDrag);
      root.classList.toggle('myui-perf-panning', !isCanvasDrag);
      root.classList.toggle('myui-perf-aggressive', perfState.enabled && perfState.flags.hideNodesDuringPan);
      if(isCanvasDrag) perfState.stats.dragStarts++;
      else perfState.stats.panStarts++;
      startSample();
    }, true);
    window.addEventListener('pointerup', clear, true);
    window.addEventListener('pointercancel', clear, true);
    window.addEventListener('blur', clear);
  }
  installPerfGestureHints();

  // Hot-path optimization: core's drag handlers call updateLines() on every
  // pointermove. Rebuilding every SVG connection while the user is merely
  // dragging one object is the main thing we want to avoid. Keep the core
  // function/data model intact, but temporarily make that call a no-op during
  // an active drag. The normal full line rebuild happens on pointerup via the
  // core's existing updateMembership()/updateLines() path.
  function installPerfHotpaths(){
    if(window.__MYUI_PERF_HOTPATHS__) return;
    if(typeof window.updateLines !== 'function') return;

    const originalUpdateLines = window.updateLines;
    window.__MYUI_PERF_ORIGINAL_UPDATE_LINES__ = originalUpdateLines;

    window.updateLines = function myuiPerfUpdateLines(){
      if(perfState.enabled && (
        document.documentElement.classList.contains('myui-perf-dragging') ||
        document.documentElement.classList.contains('myui-perf-panning')
      )){
        perfState.stats.skippedLineUpdates = (perfState.stats.skippedLineUpdates || 0) + 1;
        return;
      }
      perfState.stats.lineUpdates = (perfState.stats.lineUpdates || 0) + 1;
      return originalUpdateLines.apply(this, arguments);
    };

    window.__MYUI_PERF_HOTPATHS__ = true;
  }

  bindProxyButtons();
  bindMoreMenu();
  bindSettingsPanel();
  storyTree();
  startRuntimeLayoutBridge();

  // Core is loaded immediately after this UI script. Poll briefly until its global
  // functions exist, then install real handlers on our controls and refresh the tree.
  let ticks=0;
  const wait=()=>{
    bindCoreButtons(); bindProxyButtons(); bindMoreMenu(); bindSettingsPanel(); bindPreviewStageButton(); startRuntimeLayoutBridge();
    if(typeof window.rebuildAll === 'function' && typeof window.addNode === 'function'){
      installInspectorHook();
      installPerfHotpaths();
      window.VN_MYUI_CORE_READY=true;
      window.VN_MYUI?.renderStoryTree?.();
      requestAnimationFrame(enhanceInspector);
    }
    if(ticks++ < 100) setTimeout(wait,100);
  };
  wait();
  [100,500,1200,2500,5000].forEach(ms=>setTimeout(()=>{
    bindCoreButtons(); bindMoreMenu(); bindSettingsPanel(); bindPreviewStageButton(); startRuntimeLayoutBridge(); installInspectorHook(); window.VN_MYUI?.renderStoryTree?.(); enhanceInspector();
  },ms));
})();
