/**
 * VNDefaultUI — стандартный DOM-адаптер для VNCore
 * ================================================
 * Можно заменить на свой renderer через core.setRenderer(myUI).
 * Этот файл трогать не обязательно, если пишете свой UI.
 */
(function (global) {
  'use strict';

  class VNDefaultUI {
    /**
     * @param {HTMLElement|string} container
     * @param {VNCore} core
     * @param {object} [options]
     */
    constructor(container, core, options = {}) {
      this.core = core;
      this.options = Object.assign(
        {
          continueKeys: [' ', 'Enter', 'ArrowRight'],
        },
        options
      );

      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;

      if (!this.container) {
        throw new Error('VNDefaultUI: контейнер не найден');
      }

      this._buildDOM();
      this._bindInput();
      this._unsubs = [];

      // Подписка на ядро (на случай, если setRenderer не используется
      // и события всё равно нужны — дублируем через renderer API)
    }

    // ----- Renderer API (вызывается из VNCore) -----

    onClear() {
      this.el.chars.innerHTML = '';
      this.el.menu.classList.add('hidden');
      this.el.menu.innerHTML = '';
      this.el.endScreen.classList.add('hidden');
      this.el.textbox.classList.remove('hidden', 'dimmed');
      this.el.speaker.textContent = '';
      this.el.text.textContent = '';
      this.el.continue.style.opacity = '0';
      this.el.bg.style.backgroundImage = '';
      this._charEls = {};
    }

    onBackground({ path }) {
      this.el.bg.style.backgroundImage = path ? `url('${path}')` : '';
      this.el.bg.style.backgroundColor = '#1a1a2e';
    }

    onShowCharacter({ name, emotion, position }) {
      let node = this._charEls[name];
      if (!node) {
        node = document.createElement('div');
        node.className = 'vn-char';
        node.dataset.name = name;
        node.innerHTML =
          `<div class="vn-char-sprite">${(name && name[0]) || '?'}</div>` +
          `<div class="vn-char-name">${name}</div>`;
        this.el.chars.appendChild(node);
        this._charEls[name] = node;
      }
      node.className = 'vn-char pos-' + (position || 'center') + ' visible';
      node.dataset.emotion = emotion || 'default';
    }

    onHideCharacter({ name }) {
      const node = this._charEls[name];
      if (node) node.classList.remove('visible');
    }

    async onSay({ speaker, text, typingSpeed }) {
      this.el.speaker.textContent = speaker || '';
      this.el.speaker.style.display = speaker ? 'block' : 'none';
      this.el.continue.style.opacity = '0';
      this.el.text.textContent = '';
      this.el.textbox.classList.remove('dimmed');

      const speed = typingSpeed != null ? typingSpeed : 30;

      if (speed <= 0) {
        this.el.text.textContent = text;
        this.el.continue.style.opacity = '1';
        this.core.notifyTypingDone();
        return;
      }

      this._typingToken = (this._typingToken || 0) + 1;
      const token = this._typingToken;

      for (let i = 0; i < text.length; i++) {
        if (token !== this._typingToken || this.core.skipTyping) {
          this.el.text.textContent = text;
          break;
        }
        this.el.text.textContent += text[i];
        await new Promise((r) => setTimeout(r, speed));
      }

      if (token === this._typingToken) {
        this.el.continue.style.opacity = '1';
        this.core.notifyTypingDone();
      }
    }

    onMenu({ choices }) {
      this.el.menu.innerHTML = '';
      this.el.menu.classList.remove('hidden');
      this.el.textbox.classList.add('dimmed');

      choices.forEach((ch) => {
        const btn = document.createElement('button');
        btn.className = 'vn-choice';
        btn.textContent = ch.text;
        btn.type = 'button';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.core.choose(ch.index);
        });
        this.el.menu.appendChild(btn);
      });
    }

    onMenuClose() {
      this.el.menu.classList.add('hidden');
      this.el.menu.innerHTML = '';
      this.el.textbox.classList.remove('dimmed');
    }

    onEnd() {
      this.el.textbox.classList.add('hidden');
      this.el.menu.classList.add('hidden');
      this.el.endScreen.classList.remove('hidden');
    }

    onRestart() {
      this.onClear();
    }

    onJump() {
      /* UI ничего особенного не делает */
    }

    onMusic() {}
    onSound() {}
    onVariable() {}

    destroy() {
      this._unsubs.forEach((u) => u());
      this._unsubs = [];
      if (this._onKey) {
        document.removeEventListener('keydown', this._onKey);
      }
      if (this.container) this.container.innerHTML = '';
    }

    // ----- DOM -----

    _buildDOM() {
      this.container.innerHTML = `
        <div class="vn-stage">
          <div class="vn-background"></div>
          <div class="vn-characters"></div>
          <div class="vn-textbox">
            <div class="vn-speaker"></div>
            <div class="vn-text"></div>
            <div class="vn-continue">▼</div>
          </div>
          <div class="vn-menu hidden"></div>
          <div class="vn-end-screen hidden">
            <h2>Конец</h2>
            <button type="button" class="vn-restart">Начать сначала</button>
          </div>
        </div>
      `;

      this.el = {
        stage: this.container.querySelector('.vn-stage'),
        bg: this.container.querySelector('.vn-background'),
        chars: this.container.querySelector('.vn-characters'),
        textbox: this.container.querySelector('.vn-textbox'),
        speaker: this.container.querySelector('.vn-speaker'),
        text: this.container.querySelector('.vn-text'),
        continue: this.container.querySelector('.vn-continue'),
        menu: this.container.querySelector('.vn-menu'),
        endScreen: this.container.querySelector('.vn-end-screen'),
        restart: this.container.querySelector('.vn-restart'),
      };

      this._charEls = {};
    }

    _bindInput() {
      const advance = (e) => {
        if (e.type === 'keydown') {
          if (!this.options.continueKeys.includes(e.key)) return;
          e.preventDefault();
        }
        // меню открыто — только кнопки
        if (this.core.state.menu) return;

        if (this.core.isTyping) {
          this.core.skipTypewriter();
          return;
        }
        this.core.next();
      };

      this.el.stage.addEventListener('click', advance);
      this._onKey = advance;
      document.addEventListener('keydown', this._onKey);

      this.el.restart.addEventListener('click', (e) => {
        e.stopPropagation();
        this.core.restart();
      });
    }
  }

  /**
   * Удобный хелпер: создать ядро + стандартный UI одной строкой.
   * @param {string|HTMLElement} container
   * @param {object} [options]  опции VNCore + UI
   * @returns {VNCore}
   */
  function createVN(container, options = {}) {
    const core = new VNCore(options);
    const ui = new VNDefaultUI(container, core, options);
    core.setRenderer(ui);
    return core;
  }

  global.VNDefaultUI = VNDefaultUI;
  global.createVN = createVN;
})(typeof window !== 'undefined' ? window : globalThis);

