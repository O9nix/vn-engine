/**
 * VN Plugin Manager 2.0
 * Каталог + установленные + локальная установка.
 *
 * Каталог берётся с VN Plug Server. По умолчанию:
 *   http://127.0.0.1:8787
 */
(function (global) {
  'use strict';

  const VN = global.VN || (global.VN = {});
  const manager = VN.plugins || {};
  const CATALOG_KEY = 'vn_plugin_catalog_url';
  const DEFAULT_CATALOG = 'http://127.0.0.1:8787';
  const ENGINE_VERSION = String(global.VNCoreVersion || '0.3.0');
  const SDK_VERSION = String(VN.PluginSDKVersion || '1.0.0');

  let catalog = [];
  let activeTab = 'catalog';
  let catalogFilter = '';
  let catalogLoading = false;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function catalogUrl() {
    try { return localStorage.getItem(CATALOG_KEY) || DEFAULT_CATALOG; }
    catch (_) { return DEFAULT_CATALOG; }
  }

  function setCatalogUrl(value) {
    const url = String(value || '').trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(url)) throw new Error('Источник каталога должен быть HTTP(S)-адресом.');
    try { localStorage.setItem(CATALOG_KEY, url); } catch (_) {}
    return url;
  }

  function normalizeVersion(v) {
    const m = String(v || '0').match(/\d+(?:\.\d+){0,2}/);
    return (m ? m[0] : '0').split('.').map(Number);
  }

  function compareVersions(a, b) {
    const aa = normalizeVersion(a), bb = normalizeVersion(b);
    for (let i = 0; i < 3; i++) {
      if ((aa[i] || 0) !== (bb[i] || 0)) return (aa[i] || 0) - (bb[i] || 0);
    }
    return 0;
  }

  function satisfies(version, range) {
    if (!range) return true;
    const r = String(range).trim();
    if (!r) return true;
    if (/^[xX*]$/.test(r) || /^\d+\.x$/i.test(r) || /^\d+\.\d+\.x$/i.test(r)) {
      const parts = r.toLowerCase().split('.');
      const vp = normalizeVersion(version);
      for (let i = 0; i < parts.length; i++) if (parts[i] !== 'x' && parts[i] !== '*' && Number(parts[i]) !== vp[i]) return false;
      return true;
    }
    if (r.includes('||')) return r.split('||').some(x => satisfies(version, x));
    if (r.startsWith('>=')) return compareVersions(version, r.slice(2)) >= 0;
    if (r.startsWith('<=')) return compareVersions(version, r.slice(2)) <= 0;
    if (r.startsWith('>')) return compareVersions(version, r.slice(1)) > 0;
    if (r.startsWith('<')) return compareVersions(version, r.slice(1)) < 0;
    return compareVersions(version, r) === 0;
  }

  function compatibility(item) {
    const engine = item && item.engine;
    const sdk = item && item.sdk;
    if (engine && engine.min && !satisfies(ENGINE_VERSION, '>=' + engine.min)) {
      return { ok: false, reason: 'Требуется Engine >= ' + engine.min };
    }
    if (engine && engine.max && !satisfies(ENGINE_VERSION, '<=' + engine.max)) {
      return { ok: false, reason: 'Требуется Engine <= ' + engine.max };
    }
    if (sdk && sdk.min && !satisfies(SDK_VERSION, '>=' + sdk.min)) {
      return { ok: false, reason: 'Требуется SDK >= ' + sdk.min };
    }
    if (sdk && sdk.max && !satisfies(SDK_VERSION, '<=' + sdk.max)) {
      return { ok: false, reason: 'Требуется SDK <= ' + sdk.max };
    }
    return { ok: true, reason: '' };
  }

  function installedMap() {
    const map = new Map();
    (manager.listInstalled ? manager.listInstalled() : []).forEach(p => map.set(p.id, p));
    return map;
  }

  function ensureUI() {
    if (document.getElementById('vn-plugin-manager')) return;

    const style = document.createElement('style');
    style.id = 'vn-plugin-manager-style';
    style.textContent = `
      #vn-plugin-manager{position:fixed;inset:0;z-index:10000;display:none;background:rgba(0,0,0,.68);align-items:center;justify-content:center}
      #vn-plugin-manager.open{display:flex}
      .vn-pm-window{width:min(1040px,calc(100vw - 32px));height:min(780px,calc(100vh - 32px));display:flex;flex-direction:column;background:#141425;color:#eee;border:1px solid #35355a;border-radius:12px;box-shadow:0 20px 80px rgba(0,0,0,.5);overflow:hidden}
      .vn-pm-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 18px;border-bottom:1px solid #2a2a4a}
      .vn-pm-header h2{margin:0;font-size:18px}.vn-pm-header small{color:#888;display:block;margin-top:4px;line-height:1.4}.vn-pm-close,.vn-pm-details-close{border:0;background:transparent;color:#aaa;font-size:22px;cursor:pointer}
      .vn-pm-tabs{display:flex;padding:0 18px;border-bottom:1px solid #2a2a4a;background:#121221}
      .vn-pm-tab{border:0;border-bottom:2px solid transparent;background:transparent;color:#888;padding:12px 14px;cursor:pointer}.vn-pm-tab.active{color:#e9e9ff;border-bottom-color:#7777ff}
      .vn-pm-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid #2a2a4a}
      .vn-pm-search,.vn-pm-catalog-url{min-width:180px;flex:1;background:#0d0d18;border:1px solid #34345a;color:#eee;border-radius:7px;padding:9px 10px;outline:none}
      .vn-pm-toolbar button,.vn-pm-install-url button{border:1px solid #3b3b68;background:#20203a;color:#eee;padding:9px 11px;border-radius:7px;cursor:pointer}.vn-pm-toolbar button:hover,.vn-pm-install-url button:hover{background:#2b2b4b}
      .vn-pm-list{overflow:auto;padding:14px 18px;flex:1}.vn-pm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}
      .vn-pm-card{background:#1b1b30;border:1px solid #2d2d4b;border-radius:9px;padding:14px;display:flex;flex-direction:column;min-height:190px}.vn-pm-card.installed{border-color:#45456e}.vn-pm-card.disabled{opacity:.58}
      .vn-pm-card-head{display:flex;justify-content:space-between;gap:10px}.vn-pm-name{font-weight:650;font-size:15px}.vn-pm-version{color:#8d8db8;font:12px monospace;white-space:nowrap}.vn-pm-description{color:#aaa;font-size:13px;line-height:1.45;margin:9px 0;flex:1}.vn-pm-meta{color:#777;font-size:12px;line-height:1.45}.vn-pm-tags{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.vn-pm-tag{border:1px solid #353555;border-radius:999px;padding:2px 7px;color:#999;font-size:11px}
      .vn-pm-card-actions{display:flex;gap:6px;margin-top:11px}.vn-pm-card-actions button{flex:1;border:1px solid #3a3a5f;background:#23233e;color:#ddd;border-radius:6px;padding:7px 8px;cursor:pointer}.vn-pm-card-actions button.primary{border-color:#5555a0;background:#30305a}.vn-pm-card-actions button:disabled{opacity:.45;cursor:not-allowed}.vn-pm-card-actions .danger{color:#ff9b9b}
      .vn-pm-empty{padding:34px;text-align:center;color:#777}.vn-pm-status{padding:8px 18px;border-top:1px solid #2a2a4a;color:#888;font-size:12px}.vn-pm-status.error{color:#ff9b9b}.vn-pm-status.ok{color:#9be0ae}
      .vn-pm-local{padding:18px;max-width:720px}.vn-pm-local h3{margin-top:0}.vn-pm-install-row{display:flex;gap:8px;margin:10px 0}.vn-pm-install-row input{flex:1;min-width:0;background:#0d0d18;border:1px solid #34345a;color:#eee;border-radius:7px;padding:9px 10px}.vn-pm-install-row button{border:1px solid #3b3b68;background:#20203a;color:#eee;padding:9px 11px;border-radius:7px;cursor:pointer}
      .vn-pm-details{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.72);padding:16px}.vn-pm-details.open{display:flex}.vn-pm-details-window{width:min(900px,100%);max-height:min(820px,100%);overflow:hidden;display:flex;flex-direction:column;background:#111122;border:1px solid #3a3a62;border-radius:12px;box-shadow:0 24px 90px rgba(0,0,0,.6)}.vn-pm-details-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid #292944}.vn-pm-details-title{font-size:20px;font-weight:700}.vn-pm-details-id{margin-top:4px;color:#777;font:12px monospace}.vn-pm-details-body{overflow:auto;padding:18px}.vn-pm-detail-grid{display:grid;grid-template-columns:140px 1fr;gap:8px 16px;margin-bottom:18px}.vn-pm-detail-label{color:#777}.vn-pm-detail-value{color:#eee;word-break:break-word}.vn-pm-detail-description{margin:12px 0 18px;color:#bbb;line-height:1.55}.vn-pm-code-title{color:#aaa;margin:0 0 8px}.vn-pm-code{width:100%;min-height:260px;box-sizing:border-box;resize:vertical;background:#080810;color:#d8d8e8;border:1px solid #2c2c48;border-radius:8px;padding:12px;font:12px/1.5 monospace}
      @media(max-width:650px){.vn-pm-grid{grid-template-columns:1fr}.vn-pm-toolbar{align-items:stretch}.vn-pm-search,.vn-pm-catalog-url{flex-basis:100%}}
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vn-plugin-manager';
    root.innerHTML = `
      <div class="vn-pm-window" role="dialog" aria-modal="true" aria-label="Менеджер плагинов">
        <div class="vn-pm-header">
          <div><h2>Плагины</h2><small>Каталог расширений для VN Engine. Устанавливайте плагины из Plug Server или подключайте свой JavaScript.</small></div>
          <button class="vn-pm-close" data-action="close" title="Закрыть">×</button>
        </div>
        <div class="vn-pm-tabs">
          <button class="vn-pm-tab active" data-tab="catalog">Каталог</button>
          <button class="vn-pm-tab" data-tab="installed">Установленные</button>
          <button class="vn-pm-tab" data-tab="local">Локальная установка</button>
        </div>
        <div class="vn-pm-toolbar" data-toolbar>
          <input class="vn-pm-search" data-search placeholder="🔎 Поиск плагинов…">
          <button data-action="refresh">Обновить</button>
          <input class="vn-pm-catalog-url" data-catalog-url title="Адрес Plug Server">
          <button data-action="save-catalog">Источник</button>
        </div>
        <input data-file type="file" accept=".js,text/javascript,application/javascript" hidden>
        <div class="vn-pm-list" data-list></div>
        <div class="vn-pm-status" data-status>Готово.</div>
        <div class="vn-pm-details" data-details>
          <div class="vn-pm-details-window" role="dialog" aria-modal="true">
            <div class="vn-pm-details-header"><div><div class="vn-pm-details-title" data-detail-title>Плагин</div><div class="vn-pm-details-id" data-detail-id></div></div><button class="vn-pm-details-close" data-action="details-close">×</button></div>
            <div class="vn-pm-details-body">
              <div class="vn-pm-detail-grid">
                <div class="vn-pm-detail-label">Версия</div><div class="vn-pm-detail-value" data-detail-version>—</div>
                <div class="vn-pm-detail-label">Автор</div><div class="vn-pm-detail-value" data-detail-author>—</div>
                <div class="vn-pm-detail-label">Источник</div><div class="vn-pm-detail-value" data-detail-source>—</div>
                <div class="vn-pm-detail-label">Контексты</div><div class="vn-pm-detail-value" data-detail-targets>—</div>
                <div class="vn-pm-detail-label">Совместимость</div><div class="vn-pm-detail-value" data-detail-compat>—</div>
                <div class="vn-pm-detail-label">Состояние</div><div class="vn-pm-detail-value" data-detail-enabled>—</div>
              </div>
              <div class="vn-pm-detail-description" data-detail-description></div>
              <h4 class="vn-pm-code-title">Исходный JavaScript</h4>
              <textarea class="vn-pm-code" data-detail-code readonly spellcheck="false"></textarea>
            </div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.querySelector('[data-catalog-url]').value = catalogUrl();
    root.addEventListener('click', onClick);
    root.querySelector('[data-search]').addEventListener('input', e => { catalogFilter = e.target.value.trim().toLowerCase(); render(); });
    root.querySelector('[data-catalog-url]').addEventListener('keydown', e => { if (e.key === 'Enter') saveCatalog(); });
    root.querySelector('[data-file]').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) installFile(f); e.target.value = ''; });
  }

  function onClick(event) {
    const tab = event.target.closest('[data-tab]');
    if (tab) { activeTab = tab.dataset.tab; updateTabs(); render(); return; }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'close') close();
    else if (action === 'refresh') loadCatalog();
    else if (action === 'save-catalog') saveCatalog();
    else if (action === 'file') document.querySelector('#vn-plugin-manager [data-file]')?.click();
    else if (action === 'details-close') closeDetails();
    else if (action === 'restart') location.reload();
    else {
      const btn = event.target.closest('[data-plugin-action]');
      if (btn) handlePluginAction(btn.dataset.pluginAction, btn.dataset.pluginId, btn.dataset.source || 'installed');
    }
    if (event.target.id === 'vn-plugin-manager') close();
  }

  function updateTabs() {
    const root = document.getElementById('vn-plugin-manager'); if (!root) return;
    root.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x.dataset.tab === activeTab));
    const toolbar = root.querySelector('[data-toolbar]');
    toolbar.style.display = activeTab === 'local' ? 'none' : 'flex';
    if (activeTab === 'installed') {
      root.querySelector('[data-search]').placeholder = '🔎 Поиск установленных…';
      root.querySelector('[data-catalog-url]').style.display = 'none';
      root.querySelector('[data-action="save-catalog"]').style.display = 'none';
    } else if (activeTab === 'catalog') {
      root.querySelector('[data-search]').placeholder = '🔎 Поиск плагинов…';
      root.querySelector('[data-catalog-url]').style.display = '';
      root.querySelector('[data-action="save-catalog"]').style.display = '';
    }
  }

  function setStatus(text, type) {
    const el = document.querySelector('#vn-plugin-manager [data-status]'); if (!el) return;
    el.textContent = text; el.className = 'vn-pm-status ' + (type || '');
  }

  function markRestartNeeded() {
    const root = document.getElementById('vn-plugin-manager'); if (!root) return;
    let b = root.querySelector('[data-action="restart"]');
    if (!b) {
      b = document.createElement('button'); b.dataset.action = 'restart'; b.textContent = 'Перезапустить';
      root.querySelector('.vn-pm-header').appendChild(b);
    }
  }

  function render() {
    const listEl = document.querySelector('#vn-plugin-manager [data-list]'); if (!listEl) return;
    updateTabs();
    if (activeTab === 'catalog') return renderCatalog(listEl);
    if (activeTab === 'installed') return renderInstalled(listEl);
    return renderLocal(listEl);
  }

  function renderCatalog(listEl) {
    const installed = installedMap();
    let items = catalog.filter(item => {
      if (!catalogFilter) return true;
      return JSON.stringify(item).toLowerCase().includes(catalogFilter);
    });
    if (!items.length) {
      listEl.innerHTML = catalogLoading ? '<div class="vn-pm-empty">Загружаю каталог…</div>' : '<div class="vn-pm-empty">Каталог пуст или ничего не найдено.</div>';
      return;
    }
    listEl.innerHTML = '<div class="vn-pm-grid">' + items.map(item => {
      const p = installed.get(item.id);
      const cmp = compatibility(item);
      const same = p && p.version === item.version;
      const newer = p && compareVersions(item.version, p.version) > 0;
      const tags = [].concat(item.category || [], item.tags || [], item.targets || []).filter(Boolean).slice(0, 5);
      let action = 'install', label = 'Установить', disabled = !cmp.ok;
      if (same) { action = 'installed'; label = '✓ Установлен'; disabled = true; }
      else if (newer) { action = 'install'; label = 'Обновить'; }
      return `<article class="vn-pm-card ${p ? 'installed' : ''}">
        <div class="vn-pm-card-head"><div class="vn-pm-name">${escapeHtml(item.name || item.id)}</div><div class="vn-pm-version">v${escapeHtml(item.version || '?')}</div></div>
        <div class="vn-pm-tags">${tags.map(t => `<span class="vn-pm-tag">${escapeHtml(t)}</span>`).join('')}</div>
        <div class="vn-pm-description">${escapeHtml(item.description || 'Описание отсутствует.')}</div>
        <div class="vn-pm-meta">${escapeHtml(item.author?.name || 'Неизвестный автор')} · ${escapeHtml((item.targets || []).join(', ') || '—')}</div>
        <div class="vn-pm-meta">${cmp.ok ? 'Совместим с текущим Engine/SDK' : escapeHtml(cmp.reason)}</div>
        <div class="vn-pm-card-actions"><button data-plugin-action="catalog-details" data-plugin-id="${escapeHtml(item.id)}" data-source="catalog">Подробнее</button><button class="primary" data-plugin-action="install-catalog" data-plugin-id="${escapeHtml(item.id)}" ${disabled ? 'disabled' : ''}>${label}</button></div>
      </article>`;
    }).join('') + '</div>';
  }

  function renderInstalled(listEl) {
    const filter = catalogFilter;
    let list = manager.listInstalled ? manager.listInstalled() : [];
    if (filter) list = list.filter(x => JSON.stringify(x).toLowerCase().includes(filter));
    if (!list.length) { listEl.innerHTML = '<div class="vn-pm-empty">Пока нет установленных плагинов.</div>'; return; }
    listEl.innerHTML = '<div class="vn-pm-grid">' + list.map(item => `<article class="vn-pm-card ${item.enabled === false ? 'disabled' : ''}">
      <div class="vn-pm-card-head"><div class="vn-pm-name">${escapeHtml(item.name || item.id)}</div><div class="vn-pm-version">${item.version ? 'v' + escapeHtml(item.version) : ''}</div></div>
      <div class="vn-pm-tags">${(item.targets || []).map(t => `<span class="vn-pm-tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="vn-pm-description">${escapeHtml(item.description || 'Описание отсутствует.')}</div>
      <div class="vn-pm-meta">${escapeHtml(item.id)} · ${item.enabled === false ? 'выключен' : 'включён'}</div>
      <div class="vn-pm-card-actions"><button data-plugin-action="details" data-plugin-id="${escapeHtml(item.id)}">Подробнее</button><button data-plugin-action="toggle" data-plugin-id="${escapeHtml(item.id)}">${item.enabled === false ? 'Включить' : 'Выключить'}</button><button class="danger" data-plugin-action="remove" data-plugin-id="${escapeHtml(item.id)}">Удалить</button></div>
    </article>`).join('') + '</div>';
  }

  function renderLocal(listEl) {
    listEl.innerHTML = `<div class="vn-pm-local"><h3>Локальная установка</h3><p>Для разработки можно установить произвольный доверенный JavaScript-файл или подключить плагин по URL.</p>
      <div class="vn-pm-install-row"><button data-action="file">Выбрать .js файл</button></div>
      <div class="vn-pm-install-row"><input data-url placeholder="URL JavaScript-плагина"><button data-action="url">Установить URL</button></div>
      <p class="vn-pm-meta">Плагин получает полный доступ к странице. Устанавливайте только код, которому доверяете.</p></div>`;
    const input = listEl.querySelector('[data-url]'); input.addEventListener('keydown', e => { if (e.key === 'Enter') installUrl(input.value); });
  }

  async function loadCatalog() {
    ensureUI();
    const url = catalogUrl();
    catalogLoading = true; render(); setStatus('Подключаюсь к Plug Server…');
    try {
      const response = await fetch(url + '/api/plugins', { cache: 'no-store' });
      if (!response.ok) throw new Error('Plug Server ответил HTTP ' + response.status);
      const data = await response.json();
      catalog = Array.isArray(data) ? data : [];
      setStatus('Каталог загружен: ' + catalog.length + ' плагинов.', 'ok');
    } catch (err) {
      catalog = [];
      setStatus('Не удалось загрузить каталог: ' + (err.message || err), 'error');
    } finally { catalogLoading = false; render(); }
  }

  function saveCatalog() {
    try {
      const input = document.querySelector('#vn-plugin-manager [data-catalog-url]');
      const url = setCatalogUrl(input.value);
      input.value = url;
      setStatus('Источник каталога сохранён.', 'ok');
      loadCatalog();
    } catch (err) { setStatus(err.message || String(err), 'error'); }
  }

  async function installCatalog(id) {
    const item = catalog.find(x => x.id === id); if (!item) return;
    const cmp = compatibility(item); if (!cmp.ok) return setStatus(cmp.reason, 'error');
    try {
      setStatus('Устанавливаю «' + item.name + '»…');
      const base = catalogUrl();
      const entry = new URL(item.entry, base).href;
      manager.install({
        id: item.id, src: entry, source: 'catalog', name: item.name, version: item.version,
        description: item.description || '', targets: item.targets || [], enabled: true,
        registry: base, registryVersion: item.version, manifest: item,
      });
      setStatus('Плагин установлен. Перезапустите приложение, чтобы загрузить его во все контексты.', 'ok');
      markRestartNeeded(); render();
    } catch (err) { setStatus(err.message || String(err), 'error'); }
  }

  async function installFile(file) {
    try {
      setStatus('Читаю файл…');
      const code = await file.text();
      if (!/VN\.plugin\s*\(/.test(code) && !/VN\.extension\s*\(/.test(code)) throw new Error('Файл не похож на плагин: не найден VN.plugin(...) или VN.extension(...).');
      const meta = extractPluginMeta(code), id = meta.id || ('local-' + Date.now().toString(36));
      manager.install({ id, src: '', code, source: 'file', name: meta.name || file.name, version: meta.version || '', description: meta.description || '', targets: meta.targets || [], enabled: true });
      setStatus('Плагин установлен. Перезапустите приложение.', 'ok'); markRestartNeeded(); render();
    } catch (err) { setStatus(err.message || String(err), 'error'); }
  }

  function installUrl(src) {
    src = String(src || '').trim();
    if (!src) return setStatus('Укажите URL JavaScript-файла.', 'error');
    if (!/^https?:\/\//i.test(src) && !src.startsWith('./') && !src.startsWith('../') && !src.startsWith('/')) return setStatus('Нужен URL или путь к JS-файлу.', 'error');
    try {
      const id = 'url-' + btoa(unescape(encodeURIComponent(src))).replace(/[^a-z0-9]/gi, '').slice(0, 32).toLowerCase();
      manager.install({ id, src, source: 'url', name: src.split('/').pop() || id, enabled: true });
      setStatus('URL-плагин добавлен. Перезапустите приложение.', 'ok'); markRestartNeeded(); render();
    } catch (err) { setStatus(err.message || String(err), 'error'); }
  }

  function extractPluginMeta(code) {
    const text = String(code || '');
    const read = name => { const m = text.match(new RegExp('\\b' + name + '\\s*:\\s*["\\\']([^"\\\']+)["\\\']')); return m ? m[1].trim() : ''; };
    const targetsMatch = text.match(/\btargets\s*:\s*\[([^\]]*)\]/);
    const targets = targetsMatch ? Array.from(targetsMatch[1].matchAll(/["']([^"']+)["']/g)).map(m => m[1]) : [];
    return { id: read('id'), name: read('name'), version: read('version'), description: read('description'), targets };
  }

  function openDetails(id, source) {
    const root = document.getElementById('vn-plugin-manager'); if (!root) return;
    const item = source === 'catalog' ? catalog.find(x => x.id === id) : (manager.listInstalled() || []).find(x => x.id === id);
    if (!item) return;
    root.querySelector('[data-detail-title]').textContent = item.name || item.id;
    root.querySelector('[data-detail-id]').textContent = item.id;
    root.querySelector('[data-detail-version]').textContent = item.version ? 'v' + item.version : 'Не указана';
    root.querySelector('[data-detail-author]').textContent = item.author?.name || '—';
    root.querySelector('[data-detail-source]').textContent = source === 'catalog' ? catalogUrl() : (item.source === 'file' ? 'Локальный JavaScript-файл' : (item.src || 'URL не указан'));
    root.querySelector('[data-detail-targets]').textContent = (item.targets || []).join(', ') || 'Не указаны';
    const cmp = compatibility(item);
    root.querySelector('[data-detail-compat]').textContent = cmp.ok ? 'Совместим с Engine ' + ENGINE_VERSION + ' / SDK ' + SDK_VERSION : cmp.reason;
    root.querySelector('[data-detail-enabled]').textContent = source === 'catalog' ? 'Доступен в каталоге' : (item.enabled === false ? 'Выключен' : 'Включён');
    root.querySelector('[data-detail-description]').textContent = item.description || 'Описание отсутствует.';
    root.querySelector('[data-detail-code]').value = item.code || '// Исходный код доступен по адресу:\n// ' + (item.entry ? new URL(item.entry, catalogUrl()).href : (item.src || 'не указан'));
    root.querySelector('[data-details]').classList.add('open');
  }

  function closeDetails() { document.querySelector('#vn-plugin-manager [data-details]')?.classList.remove('open'); }

  function handlePluginAction(action, id, source) {
    try {
      if (action === 'catalog-details') return openDetails(id, 'catalog');
      if (action === 'install-catalog') return installCatalog(id);
      if (action === 'details') return openDetails(id, 'installed');
      const item = (manager.listInstalled() || []).find(p => p.id === id); if (!item) return;
      if (action === 'toggle') { manager.setEnabled(id, item.enabled === false); setStatus('Состояние изменено. Перезапустите приложение.', 'ok'); markRestartNeeded(); render(); }
      if (action === 'remove') { if (!confirm('Удалить плагин «' + id + '» из проекта?')) return; manager.uninstall(id); setStatus('Плагин удалён. Перезапустите приложение.', 'ok'); markRestartNeeded(); render(); }
    } catch (err) { setStatus(err.message || String(err), 'error'); }
  }

  function open() { ensureUI(); activeTab = 'catalog'; catalogFilter = ''; const search = document.querySelector('#vn-plugin-manager [data-search]'); if (search) search.value = ''; document.getElementById('vn-plugin-manager').classList.add('open'); updateTabs(); render(); loadCatalog(); }
  function close() { document.getElementById('vn-plugin-manager')?.classList.remove('open'); }

  function init() {
    ensureUI();
    const slot = document.querySelector('[data-vn-slot="app.toolbar"]');
    if (!slot || document.getElementById('btn-plugin-manager')) return;
    const button = document.createElement('button'); button.type = 'button'; button.id = 'btn-plugin-manager'; button.textContent = '⚙ Плагины'; button.title = 'Каталог и управление плагинами'; button.addEventListener('click', open); slot.appendChild(button);
  }

  VN.pluginManager = { open, close, render, loadCatalog, openDetails, closeDetails };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})(typeof window !== 'undefined' ? window : globalThis);
