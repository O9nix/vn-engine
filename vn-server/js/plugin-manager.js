/**
 * VN Plugin Manager 1.0
 * UI менеджер подключаемых плагинов для index.html.
 *
 * Возможности:
 * - список установленных плагинов;
 * - включение/выключение;
 * - удаление;
 * - установка JS-файла через file input;
 * - установка по URL;
 * - просмотр метаданных;
 * - перезапуск приложения после изменения списка.
 *
 * Внимание: плагин — это произвольный JavaScript с полным доступом к странице.
 * Устанавливайте только код, которому доверяете.
 */
(function (global) {
  'use strict';

  const VN = global.VN || (global.VN = {});
  const manager = VN.plugins || {};

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Читаем простые метаданные без выполнения загруженного кода.
  // Это позволяет показать карточку плагина ещё до его запуска.
  function extractPluginMeta(code) {
    const text = String(code || '');
    const read = (name) => {
      const re = new RegExp('\\b' + name + '\\s*:\\s*[\"\\\']([^\"\\\']+)[\"\\\']');
      const m = text.match(re);
      return m ? m[1].trim() : '';
    };
    const targetsMatch = text.match(/\btargets\s*:\s*\[([^\]]*)\]/);
    const targets = targetsMatch
      ? Array.from(targetsMatch[1].matchAll(/[\"']([^\"']+)[\"']/g)).map(m => m[1])
      : [];
    return {
      id: read('id'),
      name: read('name'),
      version: read('version'),
      description: read('description'),
      targets,
    };
  }

  function ensureUI() {
    if (document.getElementById('vn-plugin-manager')) return;

    const style = document.createElement('style');
    style.id = 'vn-plugin-manager-style';
    style.textContent = `
      #vn-plugin-manager {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: none;
        background: rgba(0,0,0,.68);
        align-items: center;
        justify-content: center;
      }
      #vn-plugin-manager.open { display: flex; }
      .vn-pm-window {
        width: min(860px, calc(100vw - 32px));
        max-height: min(760px, calc(100vh - 32px));
        display: flex;
        flex-direction: column;
        background: #141425;
        color: #eee;
        border: 1px solid #35355a;
        border-radius: 12px;
        box-shadow: 0 20px 80px rgba(0,0,0,.5);
        overflow: hidden;
      }
      .vn-pm-header {
        display:flex;
        align-items:center;
        justify-content:space-between;
        padding:16px 18px;
        border-bottom:1px solid #2a2a4a;
      }
      .vn-pm-header h2 { margin:0; font-size:18px; }
      .vn-pm-header small { color:#888; display:block; margin-top:3px; }
      .vn-pm-close { border:0; background:transparent; color:#aaa; font-size:22px; cursor:pointer; }
      .vn-pm-actions {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        padding:12px 18px;
        border-bottom:1px solid #2a2a4a;
      }
      .vn-pm-actions button, .vn-pm-install-url button {
        border:1px solid #3b3b68;
        background:#20203a;
        color:#eee;
        padding:8px 11px;
        border-radius:7px;
        cursor:pointer;
      }
      .vn-pm-actions button:hover, .vn-pm-install-url button:hover { background:#2b2b4b; }
      .vn-pm-install-url { display:flex; gap:8px; flex:1; min-width:280px; }
      .vn-pm-install-url input {
        flex:1;
        min-width:0;
        background:#0d0d18;
        border:1px solid #34345a;
        color:#eee;
        border-radius:7px;
        padding:8px 10px;
      }
      .vn-pm-list { overflow:auto; padding:12px 18px; }
      .vn-pm-item {
        display:grid;
        grid-template-columns: 1fr auto;
        gap:12px;
        padding:13px;
        margin-bottom:9px;
        background:#1b1b30;
        border:1px solid #2d2d4b;
        border-radius:9px;
      }
      .vn-pm-item.disabled { opacity:.58; }
      .vn-pm-name { font-weight:600; }
      .vn-pm-meta { color:#888; font-size:12px; margin-top:4px; line-height:1.45; }
      .vn-pm-description { color:#aaa; font-size:13px; margin-top:7px; }
      .vn-pm-buttons { display:flex; gap:6px; align-items:center; }
      .vn-pm-buttons button {
        border:1px solid #3a3a5f;
        background:#23233e;
        color:#ddd;
        border-radius:6px;
        padding:7px 9px;
        cursor:pointer;
      }
      .vn-pm-buttons .danger { color:#ff9b9b; }
      .vn-pm-empty { padding:30px; text-align:center; color:#777; }
      .vn-pm-status { padding:8px 18px; border-top:1px solid #2a2a4a; color:#888; font-size:12px; }
      .vn-pm-status.error { color:#ff9b9b; }
      .vn-pm-status.ok { color:#9be0ae; }
      .vn-pm-restart { margin-left:auto; display:none; }
      .vn-pm-restart.visible { display:block; }
      .vn-pm-details {
        position:absolute; inset:0; display:none; align-items:center; justify-content:center;
        background:rgba(0,0,0,.72); padding:16px;
      }
      .vn-pm-details.open { display:flex; }
      .vn-pm-details-window {
        width:min(900px,100%); max-height:min(820px,100%); overflow:hidden;
        display:flex; flex-direction:column; background:#111122; border:1px solid #3a3a62;
        border-radius:12px; box-shadow:0 24px 90px rgba(0,0,0,.6);
      }
      .vn-pm-details-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:18px; border-bottom:1px solid #292944; }
      .vn-pm-details-title { font-size:20px; font-weight:700; }
      .vn-pm-details-id { margin-top:4px; color:#777; font:12px monospace; }
      .vn-pm-details-close { border:0; background:transparent; color:#aaa; font-size:22px; cursor:pointer; }
      .vn-pm-details-body { overflow:auto; padding:18px; }
      .vn-pm-detail-grid { display:grid; grid-template-columns:130px 1fr; gap:8px 16px; margin-bottom:18px; }
      .vn-pm-detail-label { color:#777; }
      .vn-pm-detail-value { color:#eee; word-break:break-word; }
      .vn-pm-detail-description { margin:12px 0 18px; color:#bbb; line-height:1.55; }
      .vn-pm-code-title { color:#aaa; margin:0 0 8px; }
      .vn-pm-code { width:100%; min-height:280px; box-sizing:border-box; resize:vertical; background:#080810; color:#d8d8e8; border:1px solid #2c2c48; border-radius:8px; padding:12px; font:12px/1.5 monospace; }
      @media (max-width:650px) {
        .vn-pm-item { grid-template-columns:1fr; }
        .vn-pm-buttons { justify-content:flex-start; }
      }
    `;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'vn-plugin-manager';
    root.innerHTML = `
      <div class="vn-pm-window" role="dialog" aria-modal="true" aria-label="Менеджер плагинов">
        <div class="vn-pm-header">
          <div>
            <h2>Плагины</h2>
            <small>Расширяйте редактор, плеер, preview и движок без изменения ядра. Плагин — это произвольный JavaScript: ставьте только доверенный код.</small>
          </div>
          <button class="vn-pm-close" data-action="close" title="Закрыть">×</button>
        </div>
        <div class="vn-pm-actions">
          <button data-action="file">Установить .js</button>
          <div class="vn-pm-install-url">
            <input data-url placeholder="URL JavaScript-плагина" />
            <button data-action="url">Установить URL</button>
          </div>
          <button class="vn-pm-restart" data-action="restart">Перезапустить</button>
        </div>
        <input data-file type="file" accept=".js,text/javascript,application/javascript" hidden />
        <div class="vn-pm-list" data-list></div>
        <div class="vn-pm-status" data-status>Готово.</div>
        <div class="vn-pm-details" data-details>
          <div class="vn-pm-details-window" role="dialog" aria-modal="true">
            <div class="vn-pm-details-header">
              <div>
                <div class="vn-pm-details-title" data-detail-title>Плагин</div>
                <div class="vn-pm-details-id" data-detail-id></div>
              </div>
              <button class="vn-pm-details-close" data-action="details-close" title="Закрыть">×</button>
            </div>
            <div class="vn-pm-details-body">
              <div class="vn-pm-detail-grid">
                <div class="vn-pm-detail-label">Версия</div><div class="vn-pm-detail-value" data-detail-version>—</div>
                <div class="vn-pm-detail-label">Источник</div><div class="vn-pm-detail-value" data-detail-source>—</div>
                <div class="vn-pm-detail-label">Контексты</div><div class="vn-pm-detail-value" data-detail-targets>—</div>
                <div class="vn-pm-detail-label">Состояние</div><div class="vn-pm-detail-value" data-detail-enabled>—</div>
              </div>
              <div class="vn-pm-detail-description" data-detail-description></div>
              <h4 class="vn-pm-code-title">Исходный JavaScript</h4>
              <textarea class="vn-pm-code" data-detail-code readonly spellcheck="false"></textarea>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    root.addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'close') close();
      if (action === 'file') root.querySelector('[data-file]').click();
      if (action === 'url') installUrl();
      if (action === 'restart') location.reload();
      if (action === 'details-close') closeDetails();
    });

    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-plugin-action]');
      if (!button) return;
      handlePluginAction(button.dataset.pluginAction, button.dataset.pluginId);
    });

    root.addEventListener('click', (event) => {
      if (event.target === root) close();
    });

    root.querySelector('[data-file]').addEventListener('change', (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) installFile(file);
      event.target.value = '';
    });

    root.querySelector('[data-url]').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') installUrl();
      if (event.key === 'Escape') close();
    });
  }

  function setStatus(text, type) {
    const el = document.querySelector('#vn-plugin-manager [data-status]');
    if (!el) return;
    el.textContent = text;
    el.className = 'vn-pm-status ' + (type || '');
  }

  function markRestartNeeded() {
    const button = document.querySelector('#vn-plugin-manager [data-action="restart"]');
    if (button) button.classList.add('visible');
  }

  function render() {
    const listEl = document.querySelector('#vn-plugin-manager [data-list]');
    if (!listEl || !manager.listInstalled) return;
    const list = manager.listInstalled();

    if (!list.length) {
      listEl.innerHTML = '<div class="vn-pm-empty">Пока нет установленных плагинов.</div>';
      return;
    }

    listEl.innerHTML = list.map(item => {
      const meta = [
        item.version ? 'v' + item.version : '',
        item.source === 'file' ? 'локальный файл' : item.src,
        item.enabled === false ? 'выключен' : 'включён',
      ].filter(Boolean).join(' · ');
      return `
        <div class="vn-pm-item ${item.enabled === false ? 'disabled' : ''}">
          <div>
            <div class="vn-pm-name">${escapeHtml(item.name || item.id)}</div>
            <div class="vn-pm-meta">${escapeHtml(item.id)} · ${escapeHtml(meta)}</div>
            ${item.description ? '<div class="vn-pm-description">' + escapeHtml(item.description) + '</div>' : ''}
          </div>
          <div class="vn-pm-buttons">
            <button data-plugin-action="details" data-plugin-id="${escapeHtml(item.id)}">Подробнее</button>
            <button data-plugin-action="toggle" data-plugin-id="${escapeHtml(item.id)}">${item.enabled === false ? 'Включить' : 'Выключить'}</button>
            <button class="danger" data-plugin-action="remove" data-plugin-id="${escapeHtml(item.id)}">Удалить</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function installFile(file) {
    setStatus('Читаю файл…');
    try {
      const code = await file.text();
      if (!/VN\.plugin\s*\(/.test(code) && !/VN\.extension\s*\(/.test(code)) {
        throw new Error('Файл не похож на плагин: не найден VN.plugin(...) или VN.extension(...).');
      }

      const meta = extractPluginMeta(code);
      const id = meta.id || ('local-' + Date.now().toString(36));
      const item = manager.install({
        id,
        src: '',
        code,
        source: 'file',
        name: meta.name || file.name,
        version: meta.version || '',
        description: meta.description || '',
        targets: meta.targets || [],
        enabled: true,
      });
      if (item) {
        setStatus('Плагин установлен. Перезапустите приложение, чтобы загрузить его.', 'ok');
        markRestartNeeded();
        render();
      }
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  function installUrl() {
    const input = document.querySelector('#vn-plugin-manager [data-url]');
    const src = input && input.value.trim();
    if (!src) return setStatus('Укажите URL JavaScript-файла.', 'error');
    if (!/^https?:\/\//i.test(src) && !src.startsWith('./') && !src.startsWith('../') && !src.startsWith('/')) {
      return setStatus('Нужен URL или путь к JS-файлу.', 'error');
    }

    try {
      const id = 'url-' + btoa(unescape(encodeURIComponent(src))).replace(/[^a-z0-9]/gi, '').slice(0, 32).toLowerCase();
      manager.install({ id, src, source: 'url', name: src.split('/').pop() || id, enabled: true });
      input.value = '';
      setStatus('URL-плагин добавлен. Перезапустите приложение.', 'ok');
      markRestartNeeded();
      render();
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  function openDetails(id) {
    const item = manager.listInstalled().find(p => p.id === id);
    if (!item) return;
    const root = document.getElementById('vn-plugin-manager');
    if (!root) return;
    root.querySelector('[data-detail-title]').textContent = item.name || item.id;
    root.querySelector('[data-detail-id]').textContent = item.id;
    root.querySelector('[data-detail-version]').textContent = item.version ? 'v' + item.version : 'Не указана';
    root.querySelector('[data-detail-source]').textContent = item.source === 'file' ? 'Локальный JavaScript-файл' : (item.src || 'URL не указан');
    root.querySelector('[data-detail-targets]').textContent = (item.targets && item.targets.length) ? item.targets.join(', ') : 'Не указаны';
    root.querySelector('[data-detail-enabled]').textContent = item.enabled === false ? 'Выключен' : 'Включён';
    root.querySelector('[data-detail-description]').textContent = item.description || 'Описание отсутствует.';
    root.querySelector('[data-detail-code]').value = item.code || '// Исходный код недоступен для URL-плагина.\n// URL: ' + (item.src || '');
    root.querySelector('[data-details]').classList.add('open');
  }

  function closeDetails() {
    const root = document.getElementById('vn-plugin-manager');
    if (root) root.querySelector('[data-details]')?.classList.remove('open');
  }

  function handlePluginAction(action, id) {
    try {
      if (action === 'details') {
        openDetails(id);
        return;
      }

      if (action === 'toggle') {
        const list = manager.listInstalled();
        const item = list.find(p => p.id === id);
        if (!item) return;
        manager.setEnabled(id, item.enabled === false);
        setStatus('Состояние изменено. Перезапустите приложение для применения.', 'ok');
        markRestartNeeded();
        render();
        return;
      }

      if (action === 'remove') {
        if (!confirm('Удалить плагин «' + id + '» из проекта?')) return;
        manager.uninstall(id);
        setStatus('Плагин удалён. Перезапустите приложение для применения.', 'ok');
        markRestartNeeded();
        render();
      }
    } catch (err) {
      setStatus(err.message || String(err), 'error');
    }
  }

  function open() {
    ensureUI();
    render();
    document.getElementById('vn-plugin-manager').classList.add('open');
  }

  function close() {
    const root = document.getElementById('vn-plugin-manager');
    if (root) root.classList.remove('open');
  }

  function init() {
    ensureUI();
    const slot = document.querySelector('[data-vn-slot="app.toolbar"]');
    if (!slot) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'btn-plugin-manager';
    button.textContent = '⚙ Плагины';
    button.title = 'Управление плагинами проекта';
    button.addEventListener('click', open);
    slot.appendChild(button);
  }

  VN.pluginManager = { open, close, render, openDetails, closeDetails };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
