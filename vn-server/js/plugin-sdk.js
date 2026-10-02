/**
 * VN Plugin SDK 1.0
 * =================
 * Единый публичный API для расширения движка и интерфейса приложения.
 *
 * Подключается после extensions-host.js в плеере и может подключаться
 * самостоятельно в editor/index/preview.
 */
(function (global) {
  'use strict';

  const VN = global.VN || (global.VN = {});
  const plugins = VN._plugins || (VN._plugins = []);
  const pendingEventSubscriptions = [];

  function currentTarget() {
    if (typeof document === 'undefined') return 'unknown';
    return document.body && document.body.dataset.vnContext
      ? document.body.dataset.vnContext
      : 'app';
  }

  function normalizeTargets(targets) {
    if (!targets) return ['app', 'editor', 'player', 'preview'];
    if (!Array.isArray(targets)) targets = [targets];
    return targets.map(String);
  }

  function createStorage(id) {
    const prefix = 'vn_plugin:' + id + ':';
    return {
      get(key, fallback) {
        try {
          const raw = localStorage.getItem(prefix + key);
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set(key, value) {
        try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch (e) {}
        return value;
      },
      remove(key) {
        try { localStorage.removeItem(prefix + key); } catch (e) {}
      },
    };
  }

  function createUI(id) {
    const doc = typeof document !== 'undefined' ? document : null;

    function slot(name) {
      if (!doc) return null;
      let el = doc.querySelector('[data-vn-slot="' + name + '"]');
      if (!el) {
        el = doc.createElement('div');
        el.dataset.vnSlot = name;
        el.className = 'vn-plugin-slot vn-plugin-slot-' + String(name).replace(/[^a-z0-9_-]/gi, '-');
        (doc.body || doc.documentElement).appendChild(el);
      }
      return el;
    }

    return {
      document: doc,
      window: typeof window !== 'undefined' ? window : null,
      context: currentTarget(),
      pluginId: id,
      get core() { return VN._activeCore || null; },
      root: doc ? doc.body : null,
      slot,
      find(selector) {
        return doc ? doc.querySelector(selector) : null;
      },
      findAll(selector) {
        return doc ? Array.from(doc.querySelectorAll(selector)) : [];
      },
      createElement(tag, props) {
        if (!doc) return null;
        const el = doc.createElement(tag || 'div');
        Object.assign(el, props || {});
        return el;
      },
      mount(target, content) {
        if (!doc) return null;
        const parent = typeof target === 'string' ? doc.querySelector(target) : target;
        if (!parent) throw new Error('[VN.plugin:' + id + '] UI target not found: ' + target);
        const node = typeof content === 'function' ? content(doc) : content;
        if (node) parent.appendChild(node);
        return node;
      },
      addStyle(css, styleId) {
        if (!doc) return null;
        const idAttr = styleId || ('vn-plugin-style-' + id);
        let style = doc.getElementById(idAttr);
        if (!style) {
          style = doc.createElement('style');
          style.id = idAttr;
          (doc.head || doc.documentElement).appendChild(style);
        }
        style.textContent = String(css || '');
        return style;
      },
      addButton(slotName, options) {
        const opts = options || {};
        const parent = slot(slotName);
        if (!parent) return null;
        const button = doc.createElement('button');
        button.type = 'button';
        button.textContent = opts.label || opts.text || 'Кнопка';
        if (opts.id) button.id = opts.id;
        if (opts.title) button.title = opts.title;
        if (typeof opts.onClick === 'function') button.addEventListener('click', opts.onClick);
        parent.appendChild(button);
        return button;
      },
      addPanel(slotName, options) {
        const opts = options || {};
        const parent = slot(slotName);
        if (!parent) return null;
        const panel = doc.createElement('section');
        panel.className = 'vn-plugin-panel';
        if (opts.id) panel.id = opts.id;
        if (opts.title) {
          const title = doc.createElement('h3');
          title.textContent = opts.title;
          panel.appendChild(title);
        }
        if (opts.content) {
          if (typeof opts.content === 'string') panel.insertAdjacentHTML('beforeend', opts.content);
          else if (opts.content.nodeType) panel.appendChild(opts.content);
        }
        parent.appendChild(panel);
        return panel;
      },
    };
  }

  function subscribeLater(event, fn, once) {
    const item = { event, fn, once };
    pendingEventSubscriptions.push(item);
    return function () {
      const i = pendingEventSubscriptions.indexOf(item);
      if (i >= 0) pendingEventSubscriptions.splice(i, 1);
    };
  }

  function createAPI(def) {
    return {
      id: def.id,
      pluginId: def.id,
      plugin: def,
      ui: createUI(def.id),
      storage: createStorage(def.id),
      get core() { return VN._activeCore || null; },
      get engine() { return VN._activeCore || null; },
      get scene() {
        const core = VN._activeCore;
        return core && VN._createSceneAPI ? VN._createSceneAPI(core) : null;
      },
      get scenes() {
        const core = VN._activeCore;
        return core ? { current: () => (VN._createSceneAPI ? VN._createSceneAPI(core) : null) } : null;
      },
      get variables() {
        const core = VN._activeCore;
        return core ? {
          get: (key, fallback) => core.getVar(key, fallback),
          set: (key, value) => core.setVar(key, value),
          list: () => Object.assign({}, core.variables || {}),
        } : null;
      },
      events: {
        // если ядра ещё нет — подписка откладывается до его создания
        on(event, fn) {
          const core = VN._activeCore;
          return core ? core.on(event, fn) : subscribeLater(event, fn, false);
        },
        once(event, fn) {
          const core = VN._activeCore;
          return core ? core.once(event, fn) : subscribeLater(event, fn, true);
        },
        emit(event, payload) {
          const core = VN._activeCore;
          if (core) core.emit(event, payload);
        },
      },
      runtime: {
        next() { const core = VN._activeCore; return core && core.next(); },
        restart() { const core = VN._activeCore; return core && core.restart(); },
        wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); },
      },
    };
  }

  function registerPlugin(def) {
    if (!def || !def.id) {
      console.error('[VN.plugin] нужен уникальный id');
      return null;
    }

    const plugin = Object.assign({}, def, { targets: normalizeTargets(def.targets) });
    const i = plugins.findIndex((p) => p.id === plugin.id);
    if (i >= 0) plugins[i] = plugin;
    else plugins.push(plugin);

    // Совместимость с системой команд расширений (если host подключён).
    if (typeof VN.extension === 'function') {
      const extension = Object.assign({}, plugin);
      if (typeof plugin.setup === 'function') {
        extension.setup = function () {
          try { plugin.setup(createAPI(plugin)); } catch (err) {
            console.error('[VN.plugin:' + plugin.id + '] setup failed:', err);
          }
        };
      }
      VN.extension(extension);
    }

    mountPluginUI(plugin);
    return plugin;
  }

  function mountPluginUI(plugin) {
    if (typeof document === 'undefined') return;
    const target = currentTarget();
    if (plugin.targets.indexOf(target) < 0 && plugin.targets.indexOf('*') < 0) return;
    if (typeof plugin.ui !== 'function') return;

    const marker = 'vn-plugin-mounted-' + plugin.id;
    const mounted = document.documentElement.__vnMountedPlugins ||
      (document.documentElement.__vnMountedPlugins = new Set());
    if (mounted.has(marker)) return;

    const run = () => {
      if (mounted.has(marker)) return;
      mounted.add(marker);
      try { plugin.ui(createAPI(plugin)); } catch (err) {
        console.error('[VN.plugin:' + plugin.id + '] UI failed:', err);
      }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  VN.plugin = registerPlugin;
  VN.listPlugins = () => plugins.slice();
  VN.getPlugin = (id) => plugins.find((p) => p.id === id) || null;
  VN.getContext = currentTarget;

  // Вызывается host'ом, когда создан core: оформляем отложенные подписки.
  VN._notifyCoreReady = function (core) {
    const items = pendingEventSubscriptions.splice(0);
    items.forEach((item) => {
      try {
        if (item.once) core.once(item.event, item.fn);
        else core.on(item.event, item.fn);
      } catch (err) {
        console.error('[VN.plugin] event subscription failed:', err);
      }
    });
  };

  // Единые реализации ui/storage — host использует их же.
  VN._createUI = createUI;
  VN._createStorage = createStorage;
  VN._createPluginAPI = createAPI;
  VN._mountPluginUI = mountPluginUI;

  // ---------------------------------------------------------------------------
  // Установленные плагины (список проекта хранится в localStorage)
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'vn_plugins';

  function saveInstalled(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      throw new Error('Не удалось сохранить список плагинов (возможно, переполнен localStorage).');
    }
  }

  VN.plugins = VN.plugins || {};

  VN.plugins.listInstalled = function () {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  };

  VN.plugins.install = function (plugin) {
    if (!plugin || !plugin.id) throw new Error('VN.plugins.install: нужен id');
    if (!plugin.src && !plugin.code) throw new Error('VN.plugins.install: нужен src или code');
    const list = VN.plugins.listInstalled().filter((p) => p.id !== plugin.id);
    const item = {
      id: plugin.id,
      src: plugin.src || '',
      code: plugin.code || '',
      source: plugin.source || 'url',
      name: plugin.name || plugin.id,
      version: plugin.version || '',
      description: plugin.description || '',
      targets: Array.isArray(plugin.targets) ? plugin.targets.slice() : [],
      enabled: plugin.enabled !== false,
    };
    list.push(item);
    saveInstalled(list); // бросает ошибку, если сохранить не удалось
    return item;
  };

  VN.plugins.uninstall = function (id) {
    const list = VN.plugins.listInstalled().filter((p) => p.id !== id);
    saveInstalled(list);
    return list;
  };

  VN.plugins.setEnabled = function (id, enabled) {
    const list = VN.plugins.listInstalled();
    const item = list.find((p) => p.id === id);
    if (item) {
      item.enabled = !!enabled;
      saveInstalled(list);
    }
    return item || null;
  };

  VN.plugins.load = function (src) {
    return new Promise((resolve, reject) => {
      if (!src) return reject(new Error('VN.plugins.load: пустой src'));
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error('Не удалось загрузить плагин: ' + src));
      (document.head || document.documentElement).appendChild(script);
    });
  };

  /** Возвращает Promise — дождитесь его, прежде чем разбирать сценарий. */
  VN.plugins.loadInstalled = async function () {
    const list = VN.plugins.listInstalled().filter((p) => p.enabled !== false);
    for (const item of list) {
      try {
        if (item.code) {
          const blob = new Blob([String(item.code)], { type: 'text/javascript' });
          const src = URL.createObjectURL(blob);
          try { await VN.plugins.load(src); }
          finally { URL.revokeObjectURL(src); }
        } else if (item.src) {
          await VN.plugins.load(item.src);
        }
      } catch (err) {
        console.error('[VN.plugins] load failed:', item.id, err);
      }
    }
    return list;
  };
})(typeof window !== 'undefined' ? window : globalThis);
