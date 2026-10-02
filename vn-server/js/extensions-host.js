/**
 * VN Extensions Host
 * ==================
 * Один файл расширения → команда в сценарии + действие + настройки.
 *
 * Порядок скриптов:
 *   parser.js → extensions-host.js → extensions/.../extension.js → core.js → ui.js
 * (расширения можно грузить и после core — тогда вызови VN.applyExtensionsToCore(vn))
 */
(function (global) {
  'use strict';

  const registry = [];

  function defineExtension(def) {
    if (!def || !def.id) {
      console.error('[VN.extension] нужен уникальный id');
      return;
    }
    const i = registry.findIndex((e) => e.id === def.id);
    if (i >= 0) registry[i] = def;
    else registry.push(def);
  }

  function listExtensions() {
    return registry.slice();
  }

  function getExtension(id) {
    return registry.find((e) => e.id === id) || null;
  }

  function defaultSettings(def) {
    const out = {};
    const schema = def.settings || {};
    Object.keys(schema).forEach((key) => {
      const field = schema[key];
      out[key] =
        field && Object.prototype.hasOwnProperty.call(field, 'default')
          ? field.default
          : null;
    });
    return out;
  }

  /**
   * Повесить матчеры команд расширений на инстанс VNParser.
   */
  function applyToParser(parser) {
    if (!parser) return parser;
    parser._extMatchers = [];

    registry.forEach((def) => {
      const cmd = def.command;
      if (!cmd) return;

      const patterns = []
        .concat(cmd.match || [])
        .concat(cmd.keywords || [])
        .map((p) => {
          if (p instanceof RegExp) {
            // \b плохо работает с кириллицей — оставляем как есть, автор match сам отвечает
            return p;
          }
          const esc = String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // конец слова: пробел, конец строки или знак препинания (юникод-буквы ок)
          return new RegExp('^' + esc + '(?=\\s|$|[.,!?:;])', 'i');
        });

      if (!patterns.length) return;

      parser._extMatchers.push({
        extensionId: def.id,
        type: cmd.type || def.id,
        patterns,
        parse:
          typeof cmd.parse === 'function'
            ? cmd.parse
            : function (line) {
                return { type: cmd.type || def.id, raw: line };
              },
      });
    });

    return parser;
  }

  /**
   * Попробовать разобрать строку сценария как команду расширения.
   * Вызывается из parser.js
   */
  function matchExtensionLine(parser, line) {
    if (!parser) return null;
    if (!parser._extMatchers || !parser._extMatchers.length) {
      applyToParser(parser);
    }
    const matchers = parser._extMatchers || [];
    for (let m = 0; m < matchers.length; m++) {
      const mat = matchers[m];
      for (let p = 0; p < mat.patterns.length; p++) {
        if (!mat.patterns[p].test(line)) continue;
        try {
          const cmd = mat.parse(line) || {};
          if (!cmd.type) cmd.type = mat.type;
          cmd._extensionId = mat.extensionId;
          return cmd;
        } catch (err) {
          console.error('[VN] parse extension', mat.extensionId, err);
        }
      }
    }
    return null;
  }

  /**
   * Подключить расширения к VNCore: registerCommand + setup.
   */
  function applyToCore(core) {
    if (!core) return null;
    if (core.parser) applyToParser(core.parser);

    core._extensions = core._extensions || {};

    registry.forEach((def) => {
      // не регистрировать команду дважды при повторном apply
      if (core._extensions[def.id] && core._extensions[def.id]._bound) {
        return;
      }

      core._extensions[def.id] = {
        def,
        settings: Object.assign({}, defaultSettings(def)),
        _bound: true,
      };

      const cmdType = (def.command && def.command.type) || def.id;

      core.registerCommand(cmdType, function extensionCommand(cmd) {
        const entry = core._extensions[def.id];
        const settings = Object.assign({}, entry.settings);
        const args = Object.assign({}, cmd);
        delete args.type;
        delete args._extensionId;

        const ctx = createRunContext(core, def);
        let result;

        if (typeof def.run === 'function') {
          result = def.run(ctx, args, settings);
        }

        core.emit('extension:' + def.id, { args, settings });
        core.emit('extension', { id: def.id, args, settings });

        // false — не вызывать next (расширение само вызовет ctx.next())
        if (result === false) return false;
        return undefined;
      });

      if (typeof def.setup === 'function') {
        try {
          def.setup(createSetupAPI(core, def));
        } catch (err) {
          console.error('[VN] setup failed:', def.id, err);
        }
      }
    });

    core.emit('extensions:ready', { list: listExtensions() });
    return core;
  }

  function createSetupAPI(core, def) {
    return {
      core,
      id: def.id,
      on: (ev, fn) => core.on(ev, fn),
      once: (ev, fn) => core.once(ev, fn),
      emit: (ev, payload) => core.emit(ev, payload),
      getSettings: () =>
        Object.assign({}, (core._extensions[def.id] || {}).settings),
      setSettings: (partial) => {
        if (!core._extensions[def.id]) return;
        Object.assign(core._extensions[def.id].settings, partial || {});
      },
    };
  }

  function createRunContext(core, def) {
    const renderer = core.renderer;
    const stage =
      (renderer && renderer.el && renderer.el.stage) ||
      document.querySelector('.vn-stage');

    return {
      core,
      extensionId: def.id,
      stage,
      emit: (ev, payload) => core.emit(ev, payload),
      next: () => core.next(),
      getVar: (k, d) => core.getVar(k, d),
      setVar: (k, v) => core.setVar(k, v),
      wait: (ms) => new Promise((r) => setTimeout(r, ms)),

      /** Встроенный эффект тряски сцены */
      shake(intensity, durationSec) {
        const el = stage;
        if (!el) return;
        const amp = intensity != null ? Number(intensity) : 10;
        const dur =
          durationSec != null ? Number(durationSec) * 1000 : 500;
        let start = null;
        const tick = (ts) => {
          if (!start) start = ts;
          const t = ts - start;
          if (t >= dur) {
            el.style.transform = '';
            return;
          }
          const decay = 1 - t / dur;
          const x = (Math.random() * 2 - 1) * amp * decay;
          const y = (Math.random() * 2 - 1) * amp * decay * 0.55;
          el.style.transform = 'translate(' + x + 'px,' + y + 'px)';
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
    };
  }

  /**
   * Удобный хелпер: createVN + расширения.
   */
  function createVNWithExtensions(container, options) {
    if (typeof createVN !== 'function') {
      throw new Error('Подключи ui.js (createVN) до createVNWithExtensions');
    }
    const core = createVN(container, options);
    applyToCore(core);
    return core;
  }

  const VN = global.VN || {};
  VN.extension = defineExtension;
  VN.listExtensions = listExtensions;
  VN.getExtension = getExtension;
  VN.applyExtensionsToParser = applyToParser;
  VN.applyExtensionsToCore = applyToCore;
  VN.createVNWithExtensions = createVNWithExtensions;
  VN._matchExtensionLine = matchExtensionLine;
  VN._registry = registry;
  global.VN = VN;
})(typeof window !== 'undefined' ? window : globalThis);
