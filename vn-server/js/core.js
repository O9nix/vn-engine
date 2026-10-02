/**
 * VNCore — ядро движка визуальных новелл
 * ======================================
 * Не рисует UI самостоятельно. Всё отображение идёт через:
 *   1) события (on / once / off / emit)
 *   2) опциональный renderer (setRenderer)
 *
 * Подключай parser.js до core.js (нужен VNParser).
 *
 * @example
 *   const vn = new VNCore({ typingSpeed: 20 });
 *   vn.on('say', ({ speaker, text }) => { ... });
 *   vn.load(scriptText);
 *   vn.next();
 */
(function (global) {
  'use strict';

  const VERSION = '0.3.0';

  // ---------------------------------------------------------------------------
  // Утилиты
  // ---------------------------------------------------------------------------

  function normalizeLabel(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_');
  }

  function normalizePosition(pos) {
    if (!pos) return 'center';
    const p = String(pos).toLowerCase().trim();
    if (['left', 'слева', 'лево', 'л', 'l'].includes(p)) return 'left';
    if (['right', 'справа', 'право', 'п', 'r'].includes(p)) return 'right';
    return 'center';
  }

  // ---------------------------------------------------------------------------
  // EventEmitter
  // ---------------------------------------------------------------------------

  class Emitter {
    constructor() {
      this._handlers = Object.create(null);
    }

    on(event, fn) {
      if (!this._handlers[event]) this._handlers[event] = [];
      this._handlers[event].push(fn);
      return () => this.off(event, fn);
    }

    once(event, fn) {
      const wrap = (...args) => {
        this.off(event, wrap);
        fn(...args);
      };
      wrap._original = fn;
      return this.on(event, wrap);
    }

    off(event, fn) {
      const list = this._handlers[event];
      if (!list) return;
      this._handlers[event] = list.filter(
        (h) => h !== fn && h._original !== fn
      );
    }

    emit(event, payload) {
      const list = this._handlers[event];
      if (!list || !list.length) return;
      // копия — обработчик может отписаться
      list.slice().forEach((fn) => {
        try {
          fn(payload);
        } catch (err) {
          console.error('[VNCore] handler error on "' + event + '":', err);
        }
      });
    }

    clearListeners(event) {
      if (event) delete this._handlers[event];
      else this._handlers = Object.create(null);
    }
  }

  // ---------------------------------------------------------------------------
  // VNCore
  // ---------------------------------------------------------------------------

  class VNCore extends Emitter {
    /**
     * @param {object} [options]
     * @param {string} [options.assetsPath='assets/']
     * @param {number} [options.typingSpeed=30]  мс на символ; 0 = мгновенно
     * @param {boolean} [options.autoAdvance=false]
     * @param {object} [options.initialVariables={}]
     */
    constructor(options = {}) {
      super();

      this.version = VERSION;

      this.options = Object.assign(
        {
          assetsPath: 'assets/',
          typingSpeed: 30,
          autoAdvance: false,
          initialVariables: {},
        },
        options
      );

      /** @type {VNParser|null} */
      this.parser =
        typeof VNParser !== 'undefined' ? new VNParser() : null;

      /** Распарсенный сценарий { labels, lines } */
      this.script = null;

      /** Исходный текст сценария */
      this.scriptText = '';

      /** Индекс текущей команды */
      this.index = 0;

      /** Переменные сценария */
      this.variables = Object.assign({}, this.options.initialVariables);

      /**
       * Состояние сцены (логическое, без DOM)
       * characters[name] = { name, emotion, position, visible }
       */
      this.state = {
        background: null,
        characters: {},
        speaker: null,
        text: '',
        menu: null, // null | { choices: [...] }
        ended: false,
        waiting: false, // ждём клика после say / menu
      };

      /** Кастомные команды: type → handler(cmd, core) */
      this._commands = Object.create(null);

      /** Опциональный UI-адаптер */
      this.renderer = null;

      // Публичный SDK получает активное ядро через VN._activeCore.
      // Это позволяет плагинам работать с engine API без доступа к внутреннему DOM.
      if (global.VN) global.VN._activeCore = this;

      /** Флаг печатной машинки (логика; UI может игнорировать) */
      this.isTyping = false;
      this.skipTyping = false;

      this._registerBuiltinCommands();

      // Автоподключение VN.extension(...), если host уже загружен
      if (
        typeof VN !== 'undefined' &&
        typeof VN.applyExtensionsToCore === 'function'
      ) {
        VN.applyExtensionsToCore(this);
      }

      if (global.VN && typeof global.VN._notifyCoreReady === 'function') {
        global.VN._notifyCoreReady(this);
      }
    }

    // -----------------------------------------------------------------------
    // Renderer
    // -----------------------------------------------------------------------

    /**
     * Подключить UI-адаптер.
     * Ожидаемый интерфейс (все методы опциональны):
     *   onBackground({ value, path })
     *   onShowCharacter({ name, emotion, position })
     *   onHideCharacter({ name })
     *   onSay({ speaker, text })
     *   onMenu({ choices })
     *   onMenuClose()
     *   onJump({ target })
     *   onEnd()
     *   onRestart()
     *   onVariable({ key, value })
     *   onClear()
     *   destroy()
     *
     * @param {object|null} renderer
     */
    setRenderer(renderer) {
      if (this.renderer && typeof this.renderer.destroy === 'function') {
        try {
          this.renderer.destroy();
        } catch (e) {}
      }
      this.renderer = renderer || null;
      return this;
    }

    _callRenderer(method, payload) {
      if (this.renderer && typeof this.renderer[method] === 'function') {
        try {
          this.renderer[method](payload);
        } catch (err) {
          console.error('[VNCore] renderer.' + method + ' error:', err);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Загрузка / управление
    // -----------------------------------------------------------------------

    /**
     * Загрузить текст сценария и начать с первой команды.
     * @param {string} scriptText
     * @returns {VNCore}
     */
    load(scriptText) {
      if (!this.parser) {
        throw new Error(
          'VNCore: VNParser не найден. Подключи js/parser.js перед core.js'
        );
      }

      this.scriptText = String(scriptText || '');
      this.script = this.parser.parse(this.scriptText);
      this.index = 0;
      this.variables = Object.assign({}, this.options.initialVariables);
      this.state = {
        background: null,
        characters: {},
        speaker: null,
        text: '',
        menu: null,
        ended: false,
        waiting: false,
      };
      this.isTyping = false;
      this.skipTyping = false;

      this.emit('load', { script: this.script, text: this.scriptText });
      this._callRenderer('onClear');
      this.emit('clear');

      this.next();
      return this;
    }

    /**
     * Перезапуск с начала текущего сценария (переменные сбрасываются).
     */
    restart() {
      if (!this.script) return this;
      const text = this.scriptText;
      this.emit('restart');
      this._callRenderer('onRestart');
      return this.load(text);
    }

    /**
     * Выполнить следующую команду (или продолжить после say).
     * Если открыто меню — игнорируется (нужен choose).
     */
    next() {
      if (!this.script) return this;
      if (this.state.ended) return this;
      if (this.state.menu) return this; // ждём choose()

      // если шла печать — «допечатать» и ждать ещё один next
      if (this.isTyping) {
        this.skipTyping = true;
        return this;
      }

      if (this.state.waiting) {
        this.state.waiting = false;
      }

      if (this.index >= this.script.lines.length) {
        this._end();
        return this;
      }

      const cmd = this.script.lines[this.index];
      this.index += 1;

      this.emit('command', { cmd, index: this.index - 1 });
      this._execute(cmd);
      return this;
    }

    /**
     * Прыжок на метку (# сцена).
     * @param {string} target
     */
    jump(target) {
      const key = normalizeLabel(target);
      if (!this.script || this.script.labels[key] === undefined) {
        console.warn('[VNCore] метка не найдена:', target);
        this.emit('error', { type: 'label_not_found', target: key });
        return this;
      }
      this.index = this.script.labels[key];
      this.state.menu = null;
      this.state.waiting = false;
      this.isTyping = false;
      this.emit('jump', { target: key });
      this._callRenderer('onJump', { target: key });
      this._callRenderer('onMenuClose');
      this.next();
      return this;
    }

    /**
     * Выбор пункта меню по индексу (0-based).
     * @param {number} choiceIndex
     */
    choose(choiceIndex) {
      if (!this.state.menu) return this;
      const choices = this.state.menu.choices || [];
      const ch = choices[choiceIndex];
      this.state.menu = null;
      this.state.waiting = false;
      this.emit('choice', { index: choiceIndex, choice: ch });
      this._callRenderer('onMenuClose');

      if (ch && ch.target) {
        this.jump(ch.target);
      } else {
        this.next();
      }
      return this;
    }

    /**
     * Сообщить ядру, что печать текста закончена (вызывает UI).
     * После этого next() снова двигает сценарий.
     */
    notifyTypingDone() {
      this.isTyping = false;
      this.skipTyping = false;
      this.state.waiting = true;
      this.emit('typing:done', {
        speaker: this.state.speaker,
        text: this.state.text,
      });
      return this;
    }

    /**
     * Пропустить текущую печать (UI должен дописать текст сразу).
     */
    skipTypewriter() {
      this.skipTyping = true;
      this.emit('typing:skip');
      return this;
    }

    // -----------------------------------------------------------------------
    // Переменные
    // -----------------------------------------------------------------------

    setVar(key, value) {
      this.variables[key] = value;
      this.emit('variable', { key, value });
      this._callRenderer('onVariable', { key, value });
      return this;
    }

    getVar(key, defaultValue) {
      return Object.prototype.hasOwnProperty.call(this.variables, key)
        ? this.variables[key]
        : defaultValue;
    }

    // -----------------------------------------------------------------------
    // Расширение команд
    // -----------------------------------------------------------------------

    /**
     * Зарегистрировать обработчик команды сценария.
     * handler(cmd, core) — если нужно остановить авто-next, верни false
     * или вызови core.wait() логикой waiting самостоятельно.
     *
     * @param {string} type  например 'shake' или 'inventory'
     * @param {function} handler
     */
    registerCommand(type, handler) {
      this._commands[type] = handler;
      return this;
    }

    unregisterCommand(type) {
      delete this._commands[type];
      return this;
    }

    // -----------------------------------------------------------------------
    // Состояние / отладка
    // -----------------------------------------------------------------------

    getState() {
      return {
        index: this.index,
        variables: Object.assign({}, this.variables),
        background: this.state.background,
        characters: JSON.parse(JSON.stringify(this.state.characters)),
        speaker: this.state.speaker,
        text: this.state.text,
        menu: this.state.menu
          ? { choices: this.state.menu.choices.slice() }
          : null,
        ended: this.state.ended,
        waiting: this.state.waiting,
        isTyping: this.isTyping,
      };
    }

    /**
     * Граф сцен для редактора / предпросмотра.
     * @returns {{ nodes: array, edges: array }}
     */
    getGraph() {
      if (!this.script || !this.parser) return { nodes: [], edges: [] };
      return this.parser.buildGraph(this.script);
    }

    getLabels() {
      return this.script ? Object.keys(this.script.labels) : [];
    }

    // -----------------------------------------------------------------------
    // Внутреннее выполнение
    // -----------------------------------------------------------------------

    _registerBuiltinCommands() {
      this.registerCommand('label', () => {
        /* метки только для jump */
      });

      this.registerCommand('background', (cmd) => {
        const value = cmd.value;
        const path =
          this.options.assetsPath + 'backgrounds/' + value;
        this.state.background = value;
        this.emit('background', { value, path });
        this._callRenderer('onBackground', { value, path });
      });

      this.registerCommand('show', (cmd) => {
        const name = cmd.name;
        const emotion = cmd.emotion || 'default';
        const position = normalizePosition(cmd.position);
        this.state.characters[name] = {
          name,
          emotion,
          position,
          visible: true,
        };
        const payload = { name, emotion, position };
        this.emit('show', payload);
        this._callRenderer('onShowCharacter', payload);
      });

      this.registerCommand('hide', (cmd) => {
        const name = cmd.name;
        if (this.state.characters[name]) {
          this.state.characters[name].visible = false;
        }
        this.emit('hide', { name });
        this._callRenderer('onHideCharacter', { name });
      });

      this.registerCommand('say', (cmd) => {
        this.state.speaker = cmd.speaker || null;
        this.state.text = cmd.text || '';
        this.state.waiting = true;
        this.isTyping = this.options.typingSpeed > 0;
        this.skipTyping = false;

        const payload = {
          speaker: this.state.speaker,
          text: this.state.text,
          typingSpeed: this.options.typingSpeed,
        };
        this.emit('say', payload);
        this._callRenderer('onSay', payload);

        // если typingSpeed = 0 — сразу считаем печать завершённой
        if (!this.isTyping) {
          this.notifyTypingDone();
        }
        // не вызываем next — ждём пользователя
        return false;
      });

      this.registerCommand('menu', (cmd) => {
        const choices = (cmd.choices || []).map((c, i) => ({
          index: i,
          text: c.text,
          target: c.target,
        }));
        this.state.menu = { choices };
        this.state.waiting = true;
        this.emit('menu', { choices });
        this._callRenderer('onMenu', { choices });
        return false;
      });

      this.registerCommand('jump', (cmd) => {
        this.jump(cmd.target);
        return false; // jump сам вызовет next
      });

      this.registerCommand('end', () => {
        this._end();
        return false;
      });

      this.registerCommand('music', (cmd) => {
        this.emit('music', { value: cmd.value });
        this._callRenderer('onMusic', { value: cmd.value });
      });

      this.registerCommand('sound', (cmd) => {
        this.emit('sound', { value: cmd.value });
        this._callRenderer('onSound', { value: cmd.value });
      });
    }

    _execute(cmd) {
      if (!cmd || !cmd.type) return;

      const handler = this._commands[cmd.type];
      if (handler) {
        const result = handler.call(this, cmd, this);
        // false = не продолжать автоматически
        if (result === false) return;
        // для «мгновенных» команд сразу идём дальше
        this.next();
        return;
      }

      // неизвестная команда
      this.emit('unknown', { cmd });
      this.next();
    }

    _end() {
      this.state.ended = true;
      this.state.waiting = false;
      this.state.menu = null;
      this.emit('end');
      this._callRenderer('onEnd');
    }
  }

  // Публичный API на global
  global.VNCore = VNCore;
  global.VNCoreVersion = VERSION;
})(typeof window !== 'undefined' ? window : globalThis);
