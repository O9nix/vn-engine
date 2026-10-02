/**
 * VN Plugin Manager 2.0
 * ======================
 * Менеджер плагинов:
 * - Каталог
 * - Установленные
 * - Мои расширения
 * - локальная установка .js
 * - установка по URL
 * - публикация расширения
 * - включение / выключение
 * - удаление
 * - просмотр метаданных и исходного кода
 */

(function (global) {
  'use strict';

  const VN = global.VN || (global.VN = {});
  const manager = VN.plugins || {};

  const PLUG_SERVER_URL =
    (VN.PLUG_SERVER_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function extractPluginMeta(code) {
    const text = String(code || '');

    const read = (name) => {
      const re = new RegExp(
        '\\b' + name + '\\s*:\\s*["\\\']([^"\\\']+)["\\\']'
      );

      const match = text.match(re);
      return match ? match[1].trim() : '';
    };

    const targetsMatch = text.match(/\btargets\s*:\s*\[([^\]]*)\]/);

    const targets = targetsMatch
      ? Array.from(
          targetsMatch[1].matchAll(/["']([^"']+)["']/g)
        ).map((m) => m[1])
      : [];

    return {
      id: read('id'),
      name: read('name'),
      version: read('version'),
      description: read('description'),
      targets,
    };
  }

  function normalizeTargets(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function getInstalled(id) {
    if (!manager.listInstalled) return null;

    return manager.listInstalled().find(
      (item) => item.id === id
    ) || null;
  }

  function isInstalled(id) {
    return !!getInstalled(id);
  }

  function getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (
      global.VNAuth &&
      typeof global.VNAuth.getAccessToken === 'function'
    ) {
      const token = global.VNAuth.getAccessToken();

      if (token) {
        headers.Authorization = 'Bearer ' + token;
      }
    }

    return headers;
  }

  async function apiRequest(path, options) {
    const opts = Object.assign(
      {
        method: 'GET',
      },
      options || {}
    );

    opts.headers = Object.assign(
      {},
      getAuthHeaders(),
      opts.headers || {}
    );

    const response = await fetch(
      PLUG_SERVER_URL + path,
      opts
    );

    let data = null;

    const contentType =
      response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();

      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {
          message: text,
        };
      }
    }

    if (!response.ok) {
      const message =
        data && (data.error || data.message)
          ? data.error || data.message
          : 'HTTP ' + response.status;

      throw new Error(message);
    }

    return data;
  }

  function ensureUI() {
    if (document.getElementById('vn-plugin-manager')) {
      return;
    }

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

      #vn-plugin-manager.open {
        display: flex;
      }

      .vn-pm-window {
        width: min(980px, calc(100vw - 32px));
        max-height: min(820px, calc(100vh - 32px));
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
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid #2a2a4a;
      }

      .vn-pm-header h2 {
        margin: 0;
        font-size: 18px;
      }

      .vn-pm-header small {
        color: #888;
        display: block;
        margin-top: 3px;
      }

      .vn-pm-close {
        border: 0;
        background: transparent;
        color: #aaa;
        font-size: 22px;
        cursor: pointer;
      }

      .vn-pm-tabs {
        display: flex;
        gap: 4px;
        padding: 10px 18px 0;
        border-bottom: 1px solid #2a2a4a;
      }

      .vn-pm-tab {
        border: 1px solid transparent;
        border-bottom: 0;
        background: transparent;
        color: #aaa;
        padding: 9px 13px;
        border-radius: 7px 7px 0 0;
        cursor: pointer;
      }

      .vn-pm-tab:hover {
        background: #20203a;
        color: #eee;
      }

      .vn-pm-tab.active {
        background: #20203a;
        color: #fff;
        border-color: #35355a;
      }

      .vn-pm-toolbar {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        padding: 12px 18px;
        border-bottom: 1px solid #2a2a4a;
      }

      .vn-pm-toolbar input,
      .vn-pm-form input,
      .vn-pm-form textarea,
      .vn-pm-install-url input {
        background: #0d0d18;
        border: 1px solid #34345a;
        color: #eee;
        border-radius: 7px;
        padding: 8px 10px;
        box-sizing: border-box;
      }

      .vn-pm-search {
        flex: 1;
        min-width: 220px;
      }

      .vn-pm-button {
        border: 1px solid #3b3b68;
        background: #20203a;
        color: #eee;
        padding: 8px 11px;
        border-radius: 7px;
        cursor: pointer;
      }

      .vn-pm-button:hover {
        background: #2b2b4b;
      }

      .vn-pm-button.danger {
        color: #ff9b9b;
      }

      .vn-pm-button.success {
        color: #9be0ae;
      }

      .vn-pm-install-url {
        display: flex;
        gap: 8px;
        width: 100%;
      }

      .vn-pm-install-url input {
        flex: 1;
        min-width: 0;
      }

      .vn-pm-list {
        overflow: auto;
        padding: 12px 18px;
        flex: 1;
      }

      .vn-pm-item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        padding: 13px;
        margin-bottom: 9px;
        background: #1b1b30;
        border: 1px solid #2d2d4b;
        border-radius: 9px;
      }

      .vn-pm-item.disabled {
        opacity: .58;
      }

      .vn-pm-name {
        font-weight: 600;
      }

      .vn-pm-meta {
        color: #888;
        font-size: 12px;
        margin-top: 4px;
        line-height: 1.45;
      }

      .vn-pm-description {
        color: #aaa;
        font-size: 13px;
        margin-top: 7px;
      }

      .vn-pm-buttons {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .vn-pm-empty {
        padding: 30px;
        text-align: center;
        color: #777;
      }

      .vn-pm-status {
        padding: 8px 18px;
        border-top: 1px solid #2a2a4a;
        color: #888;
        font-size: 12px;
      }

      .vn-pm-status.error {
        color: #ff9b9b;
      }

      .vn-pm-status.ok {
        color: #9be0ae;
      }

      .vn-pm-restart {
        display: none;
      }

      .vn-pm-restart.visible {
        display: inline-block;
      }

      .vn-pm-details {
        position: absolute;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        background: rgba(0,0,0,.72);
        padding: 16px;
      }

      .vn-pm-details.open {
        display: flex;
      }

      .vn-pm-details-window {
        width: min(900px, 100%);
        max-height: min(820px, 100%);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #111122;
        border: 1px solid #3a3a62;
        border-radius: 12px;
        box-shadow: 0 24px 90px rgba(0,0,0,.6);
      }

      .vn-pm-details-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 18px;
        border-bottom: 1px solid #292944;
      }

      .vn-pm-details-title {
        font-size: 20px;
        font-weight: 700;
      }

      .vn-pm-details-id {
        margin-top: 4px;
        color: #777;
        font: 12px monospace;
      }

      .vn-pm-details-close {
        border: 0;
        background: transparent;
        color: #aaa;
        font-size: 22px;
        cursor: pointer;
      }

      .vn-pm-details-body {
        overflow: auto;
        padding: 18px;
      }

      .vn-pm-detail-grid {
        display: grid;
        grid-template-columns: 130px 1fr;
        gap: 8px 16px;
        margin-bottom: 18px;
      }

      .vn-pm-detail-label {
        color: #777;
      }

      .vn-pm-detail-value {
        color: #eee;
        word-break: break-word;
      }

      .vn-pm-detail-description {
        margin: 12px 0 18px;
        color: #bbb;
        line-height: 1.55;
      }

      .vn-pm-code-title {
        color: #aaa;
        margin: 0 0 8px;
      }

      .vn-pm-code {
        width: 100%;
        min-height: 280px;
        box-sizing: border-box;
        resize: vertical;
        background: #080810;
        color: #d8d8e8;
        border: 1px solid #2c2c48;
        border-radius: 8px;
        padding: 12px;
        font: 12px/1.5 monospace;
      }

      .vn-pm-form {
        display: grid;
        gap: 10px;
      }

      .vn-pm-form label {
        display: grid;
        gap: 5px;
        color: #aaa;
        font-size: 12px;
      }

      .vn-pm-form textarea {
        min-height: 220px;
        resize: vertical;
        font: 12px/1.5 monospace;
      }

      .vn-pm-form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 8px;
      }

      .vn-pm-section-title {
        margin: 4px 0 12px;
        color: #ddd;
        font-size: 14px;
      }

      @media (max-width: 650px) {
        .vn-pm-item {
          grid-template-columns: 1fr;
        }

        .vn-pm-buttons {
          justify-content: flex-start;
        }

        .vn-pm-detail-grid {
          grid-template-columns: 1fr;
          gap: 4px;
        }
      }
    `;

    document.head.appendChild(style);

    const root = document.createElement('div');

    root.id = 'vn-plugin-manager';

    root.innerHTML = `
      <div
        class="vn-pm-window"
        role="dialog"
        aria-modal="true"
        aria-label="Менеджер плагинов"
      >
        <div class="vn-pm-header">
          <div>
            <h2>Плагины</h2>
            <small>
              Каталог, установленные плагины и ваши расширения.
            </small>
          </div>

          <button
            class="vn-pm-close"
            data-action="close"
            title="Закрыть"
          >×</button>
        </div>

        <div class="vn-pm-tabs">
          <button
            class="vn-pm-tab active"
            data-tab="catalog"
          >Каталог</button>

          <button
            class="vn-pm-tab"
            data-tab="installed"
          >Установленные</button>

          <button
            class="vn-pm-tab"
            data-tab="mine"
          >Мои расширения</button>
        </div>

        <div class="vn-pm-toolbar">
          <input
            class="vn-pm-search"
            data-search
            placeholder="Поиск плагинов..."
          />

          <button
            class="vn-pm-button"
            data-action="refresh"
          >Обновить</button>

          <button
            class="vn-pm-button"
            data-action="file"
          >Установить .js</button>

          <button
            class="vn-pm-button vn-pm-restart"
            data-action="restart"
          >Перезапустить</button>
        </div>

        <div
          class="vn-pm-install-url"
          style="padding:0 18px 12px;"
        >
          <input
            data-url
            placeholder="URL JavaScript-плагина"
          />

          <button
            class="vn-pm-button"
            data-action="url"
          >Установить URL</button>
        </div>

        <input
          data-file
          type="file"
          accept=".js,text/javascript,application/javascript"
          hidden
        />

        <div
          class="vn-pm-list"
          data-list
        ></div>

        <div
          class="vn-pm-status"
          data-status
        >Готово.</div>

        <div
          class="vn-pm-details"
          data-details
        >
          <div
            class="vn-pm-details-window"
            role="dialog"
            aria-modal="true"
          >
            <div class="vn-pm-details-header">
              <div>
                <div
                  class="vn-pm-details-title"
                  data-detail-title
                >Плагин</div>

                <div
                  class="vn-pm-details-id"
                  data-detail-id
                ></div>
              </div>

              <button
                class="vn-pm-details-close"
                data-action="details-close"
              >×</button>
            </div>

            <div class="vn-pm-details-body">
              <div class="vn-pm-detail-grid">
                <div class="vn-pm-detail-label">Версия</div>
                <div
                  class="vn-pm-detail-value"
                  data-detail-version
                >—</div>

                <div class="vn-pm-detail-label">Источник</div>
                <div
                  class="vn-pm-detail-value"
                  data-detail-source
                >—</div>

                <div class="vn-pm-detail-label">Контексты</div>
                <div
                  class="vn-pm-detail-value"
                  data-detail-targets
                >—</div>

                <div class="vn-pm-detail-label">Состояние</div>
                <div
                  class="vn-pm-detail-value"
                  data-detail-enabled
                >—</div>
              </div>

              <div
                class="vn-pm-detail-description"
                data-detail-description
              ></div>

              <h4 class="vn-pm-code-title">
                Исходный JavaScript
              </h4>

              <textarea
                class="vn-pm-code"
                data-detail-code
                readonly
                spellcheck="false"
              ></textarea>
            </div>
          </div>
        </div>

        <div
          class="vn-pm-details"
          data-publish
        >
          <div
            class="vn-pm-details-window"
            role="dialog"
            aria-modal="true"
          >
            <div class="vn-pm-details-header">
              <div>
                <div class="vn-pm-details-title">
                  Опубликовать расширение
                </div>

                <div class="vn-pm-details-id">
                  Плагин будет опубликован в Plug Server
                </div>
              </div>

              <button
                class="vn-pm-details-close"
                data-action="publish-close"
              >×</button>
            </div>

            <div class="vn-pm-details-body">
              <form class="vn-pm-form" data-publish-form>

                <label>
                  ID
                  <input
                    name="id"
                    required
                    placeholder="my-plugin"
                  />
                </label>

                <label>
                  Название
                  <input
                    name="name"
                    required
                    placeholder="My Plugin"
                  />
                </label>

                <label>
                  Версия
                  <input
                    name="version"
                    required
                    placeholder="1.0.0"
                  />
                </label>

                <label>
                  Описание
                  <input
                    name="description"
                    placeholder="Описание плагина"
                  />
                </label>

                <label>
                  Targets
                  <input
                    name="targets"
                    placeholder="app, editor, player, preview"
                  />
                </label>

                <label>
                  JavaScript
                  <textarea
                    name="code"
                    required
                    spellcheck="false"
                    placeholder="VN.plugin({...})"
                  ></textarea>
                </label>

                <div class="vn-pm-form-actions">
                  <button
                    type="button"
                    class="vn-pm-button"
                    data-action="publish-close"
                  >Отмена</button>

                  <button
                    type="submit"
                    class="vn-pm-button success"
                  >Опубликовать</button>
                </div>

              </form>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(root);

    root.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-tab]');

      if (tab) {
        switchTab(tab.dataset.tab);
        return;
      }

      const actionButton =
        event.target.closest('[data-action]');

      if (!actionButton) return;

      const action = actionButton.dataset.action;

      if (action === 'close') close();
      if (action === 'file') {
        root.querySelector('[data-file]').click();
      }

      if (action === 'url') installUrl();
      if (action === 'restart') location.reload();
      if (action === 'refresh') refreshCurrentTab();

      if (action === 'details-close') {
        closeDetails();
      }

      if (action === 'publish') {
        openPublish();
      }

      if (action === 'publish-close') {
        closePublish();
      }
    });

    root.addEventListener('click', (event) => {
      const button =
        event.target.closest('[data-plugin-action]');

      if (!button) return;

      handlePluginAction(
        button.dataset.pluginAction,
        button.dataset.pluginId
      );
    });

    root.addEventListener('click', (event) => {
      if (event.target === root) {
        close();
      }

      if (
        event.target === root.querySelector('[data-details]')
      ) {
        closeDetails();
      }

      if (
        event.target === root.querySelector('[data-publish]')
      ) {
        closePublish();
      }
    });

    root
      .querySelector('[data-file]')
      .addEventListener('change', (event) => {
        const file =
          event.target.files &&
          event.target.files[0];

        if (file) {
          installFile(file);
        }

        event.target.value = '';
      });

    root
      .querySelector('[data-url]')
      .addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          installUrl();
        }

        if (event.key === 'Escape') {
          close();
        }
      });

    root
      .querySelector('[data-search]')
      .addEventListener('input', () => {
        renderCurrentTab();
      });

    root
      .querySelector('[data-publish-form]')
      .addEventListener('submit', (event) => {
        event.preventDefault();
        publishPlugin();
      });
  }

  function setStatus(text, type) {
    const el =
      document.querySelector(
        '#vn-plugin-manager [data-status]'
      );

    if (!el) return;

    el.textContent = text;
    el.className =
      'vn-pm-status ' + (type || '');
  }

  function markRestartNeeded() {
    const button =
      document.querySelector(
        '#vn-plugin-manager [data-action="restart"]'
      );

    if (button) {
      button.classList.add('visible');
    }
  }

  function getCurrentTab() {
    const root =
      document.getElementById('vn-plugin-manager');

    if (!root) return 'catalog';

    const tab =
      root.querySelector(
        '.vn-pm-tab.active'
      );

    return tab
      ? tab.dataset.tab
      : 'catalog';
  }

  function switchTab(tab) {
    const root =
      document.getElementById('vn-plugin-manager');

    if (!root) return;

    root
      .querySelectorAll('.vn-pm-tab')
      .forEach((button) => {
        button.classList.toggle(
          'active',
          button.dataset.tab === tab
        );
      });

    const search =
      root.querySelector('[data-search]');

    if (search) {
      search.value = '';
      search.placeholder =
        tab === 'catalog'
          ? 'Поиск по каталогу...'
          : tab === 'mine'
            ? 'Поиск по моим расширениям...'
            : 'Поиск установленных плагинов...';
    }

    renderCurrentTab();
  }

  function renderCurrentTab() {
    const tab = getCurrentTab();

    if (tab === 'catalog') {
      loadCatalog();
      return;
    }

    if (tab === 'mine') {
      loadMine();
      return;
    }

    renderInstalled();
  }

  async function refreshCurrentTab() {
    renderCurrentTab();
  }

  function getSearchValue() {
    const input =
      document.querySelector(
        '#vn-plugin-manager [data-search]'
      );

    return input
      ? input.value.trim().toLowerCase()
      : '';
  }

  function pluginMatches(plugin, search) {
    if (!search) return true;

    const text = [
      plugin.id,
      plugin.name,
      plugin.description,
      plugin.version,
      ...(plugin.targets || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return text.includes(search);
  }

  async function loadCatalog() {
    const listEl =
      document.querySelector(
        '#vn-plugin-manager [data-list]'
      );

    if (!listEl) return;

    listEl.innerHTML =
      '<div class="vn-pm-empty">Загрузка каталога…</div>';

    try {
      const data =
        await apiRequest('/api/plugins');

      const plugins =
        Array.isArray(data)
          ? data
          : Array.isArray(data.plugins)
            ? data.plugins
            : [];

      const search = getSearchValue();

      const filtered =
        plugins.filter((plugin) =>
          pluginMatches(plugin, search)
        );

      if (!filtered.length) {
        listEl.innerHTML =
          '<div class="vn-pm-empty">В каталоге ничего не найдено.</div>';
        return;
      }

      listEl.innerHTML =
        filtered.map(renderCatalogItem).join('');

      setStatus(
        'Каталог загружен: ' +
        filtered.length +
        ' плагинов.',
        'ok'
      );
    } catch (err) {
      listEl.innerHTML =
        '<div class="vn-pm-empty">' +
        escapeHtml(err.message || String(err)) +
        '</div>';

      setStatus(
        'Не удалось загрузить каталог: ' +
        (err.message || String(err)),
        'error'
      );
    }
  }

  function renderCatalogItem(plugin) {
    const id = plugin.id || '';
    const installed = getInstalled(id);

    const version =
      plugin.version ||
      plugin.latestVersion ||
      '';

    const targets =
      Array.isArray(plugin.targets)
        ? plugin.targets.join(', ')
        : '';

    let action;

    if (installed) {
      if (
        version &&
        installed.version &&
        installed.version !== version
      ) {
        action =
          '<button class="vn-pm-button success" ' +
          'data-plugin-action="install-catalog" ' +
          'data-plugin-id="' +
          escapeHtml(id) +
          '">Обновить</button>';
      } else {
        action =
          '<button class="vn-pm-button" disabled>' +
          'Установлен</button>';
      }
    } else {
      action =
        '<button class="vn-pm-button success" ' +
        'data-plugin-action="install-catalog" ' +
        'data-plugin-id="' +
        escapeHtml(id) +
        '">Установить</button>';
    }

    return `
      <div class="vn-pm-item">
        <div>
          <div class="vn-pm-name">
            ${escapeHtml(plugin.name || id)}
          </div>

          <div class="vn-pm-meta">
            ${escapeHtml(id)}
            ${version ? ' · v' + escapeHtml(version) : ''}
            ${targets ? ' · ' + escapeHtml(targets) : ''}
          </div>

          ${
            plugin.description
              ? '<div class="vn-pm-description">' +
                escapeHtml(plugin.description) +
                '</div>'
              : ''
          }
        </div>

        <div class="vn-pm-buttons">
          <button
            class="vn-pm-button"
            data-plugin-action="catalog-details"
            data-plugin-id="${escapeHtml(id)}"
          >Подробнее</button>

          ${action}
        </div>
      </div>
    `;
  }

  async function installCatalogPlugin(id) {
    setStatus(
      'Получаю информацию о плагине…'
    );

    try {
      const data =
        await apiRequest(
          '/api/plugins/' +
          encodeURIComponent(id)
        );

      const plugin =
        data.plugin || data;

      if (!plugin || !plugin.id) {
        throw new Error(
          'Сервер не вернул данные плагина.'
        );
      }

      const version =
        plugin.version ||
        plugin.latestVersion ||
        '';

      let code =
        plugin.code ||
        plugin.source ||
        '';

      let src =
        plugin.src ||
        plugin.entry ||
        plugin.entryUrl ||
        '';

      /*
       * Если основной endpoint не отдал код,
       * пробуем получить конкретную версию.
       */
      if (!code && version) {
        try {
          const versionData =
            await apiRequest(
              '/api/plugins/' +
              encodeURIComponent(id) +
              '/' +
              encodeURIComponent(version)
            );

          const versionPlugin =
            versionData.plugin ||
            versionData;

          code =
            versionPlugin.code ||
            versionPlugin.source ||
            '';

          src =
            versionPlugin.src ||
            versionPlugin.entry ||
            versionPlugin.entryUrl ||
            src;
        } catch (_) {
          // Не все серверы обязаны иметь version endpoint.
        }
      }

      if (!code && !src) {
        throw new Error(
          'Сервер не вернул код или URL плагина.'
        );
      }

      manager.install({
        id: plugin.id,
        src,
        code,
        source: 'catalog',
        name: plugin.name || plugin.id,
        version,
        description: plugin.description || '',
        targets: normalizeTargets(plugin.targets),
        enabled: true,
      });

      setStatus(
        'Плагин установлен. Перезапустите приложение.',
        'ok'
      );

      markRestartNeeded();
      renderCurrentTab();
    } catch (err) {
      setStatus(
        'Ошибка установки: ' +
        (err.message || String(err)),
        'error'
      );
    }
  }

  async function openCatalogDetails(id) {
    try {
      const data =
        await apiRequest(
          '/api/plugins/' +
          encodeURIComponent(id)
        );

      const plugin =
        data.plugin || data;

      openGenericDetails(plugin);
    } catch (err) {
      setStatus(
        'Не удалось получить данные плагина: ' +
        (err.message || String(err)),
        'error'
      );
    }
  }

  function renderInstalled() {
    const listEl =
      document.querySelector(
        '#vn-plugin-manager [data-list]'
      );

    if (!listEl || !manager.listInstalled) {
      return;
    }

    const search = getSearchValue();

    const list =
      manager
        .listInstalled()
        .filter((item) =>
          pluginMatches(item, search)
        );

    if (!list.length) {
      listEl.innerHTML =
        '<div class="vn-pm-empty">' +
        'Пока нет установленных плагинов.' +
        '</div>';
      return;
    }

    listEl.innerHTML =
      list.map((item) => {
        const meta = [
          item.version
            ? 'v' + item.version
            : '',
          item.source === 'file'
            ? 'локальный файл'
            : item.source === 'catalog'
              ? 'каталог'
              : item.src,
          item.enabled === false
            ? 'выключен'
            : 'включён',
        ]
          .filter(Boolean)
          .join(' · ');

        return `
          <div
            class="vn-pm-item ${
              item.enabled === false
                ? 'disabled'
                : ''
            }"
          >
            <div>
              <div class="vn-pm-name">
                ${escapeHtml(
                  item.name || item.id
                )}
              </div>

              <div class="vn-pm-meta">
                ${escapeHtml(item.id)}
                · ${escapeHtml(meta)}
              </div>

              ${
                item.description
                  ? '<div class="vn-pm-description">' +
                    escapeHtml(item.description) +
                    '</div>'
                  : ''
              }
            </div>

            <div class="vn-pm-buttons">
              <button
                class="vn-pm-button"
                data-plugin-action="details"
                data-plugin-id="${escapeHtml(item.id)}"
              >Подробнее</button>

              <button
                class="vn-pm-button"
                data-plugin-action="toggle"
                data-plugin-id="${escapeHtml(item.id)}"
              >${
                item.enabled === false
                  ? 'Включить'
                  : 'Выключить'
              }</button>

              <button
                class="vn-pm-button danger"
                data-plugin-action="remove"
                data-plugin-id="${escapeHtml(item.id)}"
              >Удалить</button>
            </div>
          </div>
        `;
      }).join('');
  }

  async function loadMine() {
    const listEl =
      document.querySelector(
        '#vn-plugin-manager [data-list]'
      );

    if (!listEl) return;

    listEl.innerHTML =
      '<div class="vn-pm-empty">Загрузка ваших расширений…</div>';

    try {
      const data =
        await apiRequest('/api/plugins/mine');

      const plugins =
        Array.isArray(data)
          ? data
          : Array.isArray(data.plugins)
            ? data.plugins
            : [];

      const search = getSearchValue();

      const filtered =
        plugins.filter((plugin) =>
          pluginMatches(plugin, search)
        );

      if (!filtered.length) {
        listEl.innerHTML = `
          <div class="vn-pm-empty">
            У вас пока нет опубликованных расширений.
            <br><br>
            <button
              class="vn-pm-button success"
              data-action="publish"
            >Опубликовать расширение</button>
          </div>
        `;
        return;
      }

      listEl.innerHTML = `
        <div class="vn-pm-section-title">
          Мои расширения
        </div>

        ${filtered.map(renderMineItem).join('')}
      `;

      setStatus(
        'Загружено расширений: ' +
        filtered.length,
        'ok'
      );
    } catch (err) {
      listEl.innerHTML = `
        <div class="vn-pm-empty">
          Не удалось загрузить ваши расширения.
          <br><br>
          ${escapeHtml(
            err.message || String(err)
          )}
          <br><br>
          <button
            class="vn-pm-button success"
            data-action="publish"
          >Опубликовать расширение</button>
        </div>
      `;

      setStatus(
        err.message || String(err),
        'error'
      );
    }
  }

  function renderMineItem(plugin) {
    const id = plugin.id || '';

    const version =
      plugin.version ||
      plugin.latestVersion ||
      '';

    const owner =
      plugin.ownerUsername ||
      plugin.ownerId ||
      '';

    const targets =
      Array.isArray(plugin.targets)
        ? plugin.targets.join(', ')
        : '';

    return `
      <div class="vn-pm-item">
        <div>
          <div class="vn-pm-name">
            ${escapeHtml(plugin.name || id)}
          </div>

          <div class="vn-pm-meta">
            ${escapeHtml(id)}
            ${version ? ' · v' + escapeHtml(version) : ''}
            ${owner ? ' · ' + escapeHtml(owner) : ''}
            ${targets ? ' · ' + escapeHtml(targets) : ''}
          </div>

          ${
            plugin.description
              ? '<div class="vn-pm-description">' +
                escapeHtml(plugin.description) +
                '</div>'
              : ''
          }
        </div>

        <div class="vn-pm-buttons">
          <button
            class="vn-pm-button"
            data-plugin-action="mine-details"
            data-plugin-id="${escapeHtml(id)}"
          >Подробнее</button>

          <button
            class="vn-pm-button success"
            data-plugin-action="publish-same"
            data-plugin-id="${escapeHtml(id)}"
          >Новая версия</button>
        </div>
      </div>
    `;
  }

  async function installFile(file) {
    setStatus('Читаю файл…');

    try {
      const code = await file.text();

      if (
        !/VN\.plugin\s*\(/.test(code) &&
        !/VN\.extension\s*\(/.test(code)
      ) {
        throw new Error(
          'Файл не похож на плагин: не найден VN.plugin(...) или VN.extension(...).'
        );
      }

      const meta =
        extractPluginMeta(code);

      const id =
        meta.id ||
        ('local-' +
          Date.now().toString(36));

      const item =
        manager.install({
          id,
          src: '',
          code,
          source: 'file',
          name:
            meta.name ||
            file.name,
          version:
            meta.version ||
            '',
          description:
            meta.description ||
            '',
          targets:
            meta.targets ||
            [],
          enabled: true,
        });

      if (item) {
        setStatus(
          'Плагин установлен. Перезапустите приложение.',
          'ok'
        );

        markRestartNeeded();
        renderCurrentTab();
      }
    } catch (err) {
      setStatus(
        err.message || String(err),
        'error'
      );
    }
  }

  function installUrl() {
    const input =
      document.querySelector(
        '#vn-plugin-manager [data-url]'
      );

    const src =
      input &&
      input.value.trim();

    if (!src) {
      setStatus(
        'Укажите URL JavaScript-файла.',
        'error'
      );

      return;
    }

    if (
      !/^https?:\/\//i.test(src) &&
      !src.startsWith('./') &&
      !src.startsWith('../') &&
      !src.startsWith('/')
    ) {
      setStatus(
        'Нужен URL или путь к JS-файлу.',
        'error'
      );

      return;
    }

    try {
      const id =
        'url-' +
        btoa(
          unescape(
            encodeURIComponent(src)
          )
        )
          .replace(/[^a-z0-9]/gi, '')
          .slice(0, 32)
          .toLowerCase();

      manager.install({
        id,
        src,
        source: 'url',
        name:
          src.split('/').pop() ||
          id,
        enabled: true,
      });

      input.value = '';

      setStatus(
        'URL-плагин добавлен. Перезапустите приложение.',
        'ok'
      );

      markRestartNeeded();
      renderCurrentTab();
    } catch (err) {
      setStatus(
        err.message || String(err),
        'error'
      );
    }
  }

  function openDetails(id) {
    const item =
      manager
        .listInstalled()
        .find((plugin) =>
          plugin.id === id
        );

    if (!item) return;

    openGenericDetails(item);
  }

  function openGenericDetails(item) {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (!root || !item) return;

    root.querySelector(
      '[data-detail-title]'
    ).textContent =
      item.name ||
      item.id ||
      'Плагин';

    root.querySelector(
      '[data-detail-id]'
    ).textContent =
      item.id || '';

    root.querySelector(
      '[data-detail-version]'
    ).textContent =
      item.version
        ? 'v' + item.version
        : 'Не указана';

    root.querySelector(
      '[data-detail-source]'
    ).textContent =
      item.source === 'file'
        ? 'Локальный JavaScript-файл'
        : item.source === 'catalog'
          ? 'Каталог Plug Server'
          : (
              item.src ||
              item.entry ||
              'URL не указан'
            );

    root.querySelector(
      '[data-detail-targets]'
    ).textContent =
      Array.isArray(item.targets) &&
      item.targets.length
        ? item.targets.join(', ')
        : 'Не указаны';

    root.querySelector(
      '[data-detail-enabled]'
    ).textContent =
      item.enabled === false
        ? 'Выключен'
        : 'Включён';

    root.querySelector(
      '[data-detail-description]'
    ).textContent =
      item.description ||
      'Описание отсутствует.';

    root.querySelector(
      '[data-detail-code]'
    ).value =
      item.code ||
      item.sourceCode ||
      (
        '// Исходный код недоступен.\n' +
        '// URL: ' +
        (
          item.src ||
          item.entry ||
          ''
        )
      );

    root
      .querySelector('[data-details]')
      .classList.add('open');
  }

  function closeDetails() {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (root) {
      root
        .querySelector('[data-details]')
        ?.classList.remove('open');
    }
  }

  function openPublish() {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (!root) return;

    root
      .querySelector('[data-publish]')
      .classList.add('open');
  }

  function closePublish() {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (root) {
      root
        .querySelector('[data-publish]')
        ?.classList.remove('open');
    }
  }

  function fillPublishForm(item) {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (!root) return;

    const form =
      root.querySelector(
        '[data-publish-form]'
      );

    if (!form) return;

    form.elements.id.value =
      item?.id || '';

    form.elements.name.value =
      item?.name || '';

    form.elements.version.value =
      item?.version || '';

    form.elements.description.value =
      item?.description || '';

    form.elements.targets.value =
      Array.isArray(item?.targets)
        ? item.targets.join(', ')
        : '';

    form.elements.code.value =
      item?.code || '';
  }

  function openPublishForItem(item) {
    fillPublishForm(item);
    openPublish();
  }

  async function publishPlugin() {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (!root) return;

    const form =
      root.querySelector(
        '[data-publish-form]'
      );

    if (!form) return;

    const id =
      form.elements.id.value.trim();

    const name =
      form.elements.name.value.trim();

    const version =
      form.elements.version.value.trim();

    const description =
      form.elements.description.value.trim();

    const targets =
      normalizeTargets(
        form.elements.targets.value
      );

    const code =
      form.elements.code.value;

    if (!id) {
      setStatus(
        'Укажите ID расширения.',
        'error'
      );
      return;
    }

    if (!name) {
      setStatus(
        'Укажите название расширения.',
        'error'
      );
      return;
    }

    if (!version) {
      setStatus(
        'Укажите версию расширения.',
        'error'
      );
      return;
    }

    if (!code.trim()) {
      setStatus(
        'Добавьте JavaScript-код.',
        'error'
      );
      return;
    }

    if (
      !/VN\.plugin\s*\(/.test(code) &&
      !/VN\.extension\s*\(/.test(code)
    ) {
      setStatus(
        'Код не похож на VN-плагин: не найден VN.plugin(...) или VN.extension(...).',
        'error'
      );
      return;
    }

    setStatus(
      'Публикую расширение…'
    );

    try {
      const result =
        await apiRequest(
          '/api/plugins',
          {
            method: 'POST',
            body: JSON.stringify({
              manifest: {
                id,
                name,
                version,
                description,
                targets,
                entry: 'extension.js',
              },
              code,
            }),
          }
        );

      const published =
        result.plugin ||
        result;

      setStatus(
        'Расширение опубликовано: ' +
        (
          published.id ||
          id
        ) +
        '@' +
        (
          published.version ||
          version
        ),
        'ok'
      );

      closePublish();

      if (
        getCurrentTab() === 'mine'
      ) {
        loadMine();
      }
    } catch (err) {
      setStatus(
        'Ошибка публикации: ' +
        (err.message || String(err)),
        'error'
      );
    }
  }

  async function openMineDetails(id) {
    try {
      const data =
        await apiRequest(
          '/api/plugins/' +
          encodeURIComponent(id)
        );

      openGenericDetails(
        data.plugin || data
      );
    } catch (err) {
      setStatus(
        'Не удалось получить данные: ' +
        (err.message || String(err)),
        'error'
      );
    }
  }

  async function handlePluginAction(
    action,
    id
  ) {
    try {
      if (
        action === 'details'
      ) {
        openDetails(id);
        return;
      }

      if (
        action === 'catalog-details'
      ) {
        await openCatalogDetails(id);
        return;
      }

      if (
        action === 'mine-details'
      ) {
        await openMineDetails(id);
        return;
      }

      if (
        action === 'install-catalog'
      ) {
        await installCatalogPlugin(id);
        return;
      }

      if (
        action === 'publish-same'
      ) {
        const item =
          manager
            .listInstalled()
            .find(
              (plugin) =>
                plugin.id === id
            );

        if (item) {
          openPublishForItem(item);
        } else {
          setStatus(
            'Локальная версия плагина не найдена.',
            'error'
          );
        }

        return;
      }

      if (
        action === 'toggle'
      ) {
        const list =
          manager.listInstalled();

        const item =
          list.find(
            (plugin) =>
              plugin.id === id
          );

        if (!item) return;

        manager.setEnabled(
          id,
          item.enabled === false
        );

        setStatus(
          'Состояние изменено. Перезапустите приложение для применения.',
          'ok'
        );

        markRestartNeeded();
        renderInstalled();

        return;
      }

      if (
        action === 'remove'
      ) {
        if (
          !confirm(
            'Удалить плагин «' +
            id +
            '» из проекта?'
          )
        ) {
          return;
        }

        manager.uninstall(id);

        setStatus(
          'Плагин удалён. Перезапустите приложение для применения.',
          'ok'
        );

        markRestartNeeded();
        renderInstalled();
      }
    } catch (err) {
      setStatus(
        err.message || String(err),
        'error'
      );
    }
  }

  function open() {
    ensureUI();

    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    root.classList.add('open');

    switchTab('catalog');
  }

  function close() {
    const root =
      document.getElementById(
        'vn-plugin-manager'
      );

    if (root) {
      root.classList.remove('open');
      closeDetails();
      closePublish();
    }
  }

  function init() {
    ensureUI();

    const slot =
      document.querySelector(
        '[data-vn-slot="app.toolbar"]'
      );

    if (!slot) return;

    if (
      document.getElementById(
        'btn-plugin-manager'
      )
    ) {
      return;
    }

    const button =
      document.createElement('button');

    button.type = 'button';
    button.id = 'btn-plugin-manager';
    button.textContent = '⚙ Плагины';
    button.title =
      'Управление плагинами проекта';

    button.addEventListener(
      'click',
      open
    );

    slot.appendChild(button);
  }

  VN.pluginManager = {
    open,
    close,
    render: renderCurrentTab,
    openDetails,
    closeDetails,
    openPublish,
    closePublish,
  };

  if (
    document.readyState === 'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init,
      { once: true }
    );
  } else {
    init();
  }

})(typeof window !== 'undefined'
  ? window
  : globalThis);