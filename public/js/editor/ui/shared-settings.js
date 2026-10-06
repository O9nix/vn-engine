/**
 * Shared system settings for all UI packs:
 * - Interface (UI pack) switcher
 * - Graphics / performance profile (same model as My UI)
 *
 * Works with existing #vnSysSettings / #myui* controls if present,
 * otherwise injects a floating settings panel.
 */
(function vnSharedSettings() {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  const UI_PACKS = {
    default: {
      name: 'Classic',
      description: 'Классический редактор: холст и инспектор',
    },
    myui: {
      name: 'My UI',
      description: 'Дерево сценария, настройки графики, компактная панель',
    },
  };

  const PERF_MODES = [
    {
      level: 0,
      name: 'Максимум производительности',
      short: 'Турбо',
      note: 'Максимально упрощённая отрисовка во время перемещения.',
    },
    {
      level: 17,
      name: 'Высокая производительность',
      short: 'Быстро',
      note: 'Сильно снижает стоимость отрисовки при панорамировании.',
    },
    {
      level: 33,
      name: 'Производительность',
      short: 'Производительно',
      note: 'Заметно облегчает холст во время движения.',
    },
    {
      level: 50,
      name: 'Сбалансировано',
      short: 'Баланс',
      note: 'Рекомендуемый режим: основные оптимизации и детали.',
    },
    {
      level: 67,
      name: 'Качество',
      short: 'Качественно',
      note: 'Оптимизации мягче — больше деталей при перемещении.',
    },
    {
      level: 84,
      name: 'Высокая детализация',
      short: 'Детально',
      note: 'Почти все детали сохраняются.',
    },
    {
      level: 100,
      name: 'Максимальная детализация',
      short: 'Максимум',
      note: 'Оптимизации почти не вмешиваются в отрисовку.',
    },
  ];

  function nearestPerfLevel(value) {
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    return PERF_MODES.reduce(
      (best, mode) =>
        Math.abs(mode.level - n) < Math.abs(best.level - n) ? mode : best,
      PERF_MODES[0]
    ).level;
  }

  function getPerfMode(level) {
    const n = nearestPerfLevel(level);
    return PERF_MODES.find((m) => m.level === n) || PERF_MODES[3];
  }

  // Prefer My UI runtime if already loaded
  const existing = window.VN_MYUI_PERF;

  const perfState =
    existing ||
    {
      level: (() => {
        try {
          const saved = Number(localStorage.getItem('vn_myui_perf_level'));
          if (Number.isFinite(saved)) return nearestPerfLevel(saved);
          const q = new URLSearchParams(location.search).get('perf');
          if (q === '0' || q === 'off') return 100;
          if (q === '2' || q === 'aggressive') return 0;
        } catch (_) {}
        return 50;
      })(),
      enabled: true,
      flags: {
        hideNodesDuringPan: false,
        deferStoryTree: true,
        containNodes: true,
        rafGrid: true,
      },
      applyLevel(level) {
        this.level = nearestPerfLevel(level);
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
        if (!this.enabled) root.classList.remove('myui-perf-panning', 'myui-perf-dragging');
        try {
          localStorage.setItem('vn_myui_perf_level', String(this.level));
        } catch (_) {}
        this.updateSettingsUI && this.updateSettingsUI();
        return this.level;
      },
      updateSettingsUI() {
        syncPerfUI(this);
      },
    };

  if (!existing) {
    window.VN_MYUI_PERF = perfState;
    if (typeof perfState.applyLevel === 'function') perfState.applyLevel(perfState.level);
  }

  function currentUiId() {
    try {
      return (
        window.VN_EDITOR_UI_ID ||
        localStorage.getItem('vn_editor_ui') ||
        new URLSearchParams(location.search).get('ui') ||
        'default'
      );
    } catch (_) {
      return 'default';
    }
  }

  function switchUi(id) {
    const key = String(id || 'default').toLowerCase();
    if (!UI_PACKS[key]) return;
    try {
      localStorage.setItem('vn_editor_ui', key);
    } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.set('ui', key);
    // keep project id if present
    location.href = url.pathname + url.search + url.hash;
  }

  function syncPerfUI(state) {
    const st = state || window.VN_MYUI_PERF || perfState;
    if (!st) return;
    if (typeof st.updateSettingsUI === 'function' && st !== perfState && existing) {
      // myui owns richer UI — still fill shared selects
    }
    const slider = $('myuiPerfSlider') || $('vnPerfSlider');
    const value = $('myuiPerfValue') || $('vnPerfValue');
    const note = $('myuiPerfNote') || $('vnPerfNote');
    if (slider) slider.value = String(st.level ?? 50);
    const mode = getPerfMode(st.level ?? 50);
    if (value) value.textContent = mode.name;
    if (note) note.textContent = mode.note;
    document.querySelectorAll('.myui-perf-presets i, .vn-perf-presets i').forEach((dot, i) => {
      const lvl = PERF_MODES[i]?.level;
      dot.classList.toggle('active', lvl === mode.level);
    });
  }

  function fillUiSelect(sel) {
    if (!sel) return;
    const cur = currentUiId();
    sel.innerHTML = Object.entries(UI_PACKS)
      .map(
        ([id, p]) =>
          `<option value="${esc(id)}" ${id === cur ? 'selected' : ''}>${esc(p.name)}</option>`
      )
      .join('');
    sel.onchange = () => {
      if (sel.value && sel.value !== cur) switchUi(sel.value);
    };
  }

  function ensureDefaultSettingsChrome() {
    // If myui settings already exist, only inject UI switcher into that panel
    const myuiPanel = document.querySelector('.myui-settings-panel');
    if (myuiPanel) {
      if (!myuiPanel.querySelector('#vnUiSelect')) {
        const block = document.createElement('div');
        block.className = 'vn-ui-switch-block';
        block.innerHTML = `
          <div class="myui-menu-group" style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(58,49,83,.55)">Интерфейс</div>
          <label style="display:block;font-size:10px;color:#77717f;margin:6px 0 4px">Вариант UI</label>
          <select id="vnUiSelect" style="width:100%;background:#111018;color:#efe7d6;border:1px solid #34303f;border-radius:7px;padding:7px 8px;font-size:12px"></select>
          <p style="font-size:10px;color:#706977;margin:6px 0 0;line-height:1.4">Смена интерфейса перезагрузит редактор. Данные проекта сохраняются на сервере.</p>
        `;
        myuiPanel.appendChild(block);
      }
      fillUiSelect($('vnUiSelect'));
      // wire perf slider if myui has it
      const slider = $('myuiPerfSlider');
      if (slider && !slider.dataset.vnSharedBound) {
        slider.dataset.vnSharedBound = '1';
        slider.addEventListener('input', () => {
          const st = window.VN_MYUI_PERF || perfState;
          if (st.applyLevel) st.applyLevel(slider.value);
          else syncPerfUI(st);
        });
        slider.addEventListener('change', () => {
          const st = window.VN_MYUI_PERF || perfState;
          if (st.applyLevel) st.applyLevel(slider.value);
        });
      }
      return;
    }

    // Classic UI: inject settings button + panel
    if ($('vnSysSettingsBtn')) {
      fillUiSelect($('vnUiSelect'));
      return;
    }
    const toolbar = $('toolbar');
    if (!toolbar) return;

    const wrap = document.createElement('div');
    wrap.className = 'vn-sys-settings';
    wrap.id = 'vnSysSettings';
    wrap.innerHTML = `
      <button type="button" class="tb" id="vnSysSettingsBtn" title="Системные настройки">⚙ Настройки</button>
      <div class="vn-sys-settings-panel" id="vnSysSettingsPanel" role="dialog" aria-label="Системные настройки">
        <div class="vn-sys-head">
          <strong>Системные настройки</strong>
          <button type="button" class="tb" id="vnSysSettingsClose" aria-label="Закрыть">✕</button>
        </div>
        <div class="vn-sys-section">
          <div class="vn-sys-label">Интерфейс</div>
          <select id="vnUiSelect"></select>
          <p class="vn-sys-hint">Смена UI перезагрузит страницу. Проект на сервере не теряется.</p>
        </div>
        <div class="vn-sys-section">
          <div class="vn-sys-label">Графика / производительность</div>
          <div class="vn-sys-perf-value" id="vnPerfValue">Сбалансировано</div>
          <div class="vn-sys-perf-row">
            <span>Скорость</span>
            <input id="vnPerfSlider" type="range" min="0" max="100" step="1" value="50">
            <span>Детали</span>
          </div>
          <div class="vn-perf-presets" aria-hidden="true">
            <i></i><i></i><i></i><i></i><i></i><i></i><i></i>
          </div>
          <p class="vn-sys-hint" id="vnPerfNote">Сбалансированный режим.</p>
        </div>
      </div>
    `;
    // insert before zoom block if present
    const zoom = toolbar.querySelector('#zoomOut')?.parentElement || toolbar.querySelector('#zoomLabel');
    if (zoom && zoom.parentElement === toolbar) toolbar.insertBefore(wrap, zoom);
    else toolbar.appendChild(wrap);

    // minimal CSS for classic settings
    if (!document.getElementById('vnSharedSettingsCss')) {
      const style = document.createElement('style');
      style.id = 'vnSharedSettingsCss';
      style.textContent = `
        .vn-sys-settings{position:relative;display:flex;align-items:center;margin-left:4px}
        .vn-sys-settings-panel{
          display:none;position:absolute;right:0;top:calc(100% + 8px);width:min(320px,92vw);
          background:#191620;border:1px solid #3a3153;border-radius:10px;padding:14px;
          box-shadow:0 16px 40px rgba(0,0,0,.4);z-index:140;
        }
        .vn-sys-settings.open .vn-sys-settings-panel{display:block}
        .vn-sys-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
        .vn-sys-head strong{font-size:13px}
        .vn-sys-section{margin-bottom:14px}
        .vn-sys-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#77717f;margin-bottom:6px}
        .vn-sys-settings-panel select,.vn-sys-settings-panel input[type=range]{width:100%}
        .vn-sys-settings-panel select{
          background:#111018;color:#efe7d6;border:1px solid #34303f;border-radius:7px;padding:7px 8px;font-size:12px
        }
        .vn-sys-hint{font-size:10px;color:#706977;line-height:1.4;margin:6px 0 0}
        .vn-sys-perf-value{font-size:12px;color:#c9a24b;margin-bottom:8px}
        .vn-sys-perf-row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;font-size:9px;color:#817987}
        .vn-sys-perf-row input{accent-color:#c9a24b}
        .vn-perf-presets{display:grid;grid-template-columns:repeat(7,1fr);margin-top:6px;gap:4px}
        .vn-perf-presets i{display:block;width:4px;height:4px;margin:auto;border-radius:50%;background:#514a59}
        .vn-perf-presets i.active{background:#c9a24b;transform:scale(1.6)}
        /* perf classes (shared with myui) */
        html.myui-perf #canvas{will-change:transform;contain:layout style}
        html.myui-perf .node{content-visibility:auto;contain-intrinsic-size:228px 150px}
        html.myui-perf-panning .node,html.myui-perf-dragging .node{transition:none!important;box-shadow:none!important}
        html.myui-perf-panning.myui-perf-aggressive .node,
        html.myui-perf-dragging.myui-perf-aggressive .node{content-visibility:hidden!important}
      `;
      document.head.appendChild(style);
    }

    fillUiSelect($('vnUiSelect'));

    const btn = $('vnSysSettingsBtn');
    const panel = $('vnSysSettingsPanel');
    const close = $('vnSysSettingsClose');
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      wrap.classList.toggle('open');
      syncPerfUI(window.VN_MYUI_PERF || perfState);
    });
    close?.addEventListener('click', () => wrap.classList.remove('open'));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.vn-sys-settings')) wrap.classList.remove('open');
    });

    const slider = $('vnPerfSlider');
    if (slider) {
      slider.value = String((window.VN_MYUI_PERF || perfState).level ?? 50);
      const apply = () => {
        const st = window.VN_MYUI_PERF || perfState;
        if (typeof st.applyLevel === 'function') st.applyLevel(slider.value);
        syncPerfUI(st);
      };
      slider.addEventListener('input', apply);
      slider.addEventListener('change', apply);
    }
    syncPerfUI(window.VN_MYUI_PERF || perfState);

    // lightweight pan/drag hints for classic UI (same as myui idea)
    installClassicPerfGestures();
  }

  function installClassicPerfGestures() {
    if (document.documentElement.dataset.vnPerfGestures) return;
    document.documentElement.dataset.vnPerfGestures = '1';
    const viewport = $('viewport');
    if (!viewport) return;
    const root = document.documentElement;
    const clear = () => root.classList.remove('myui-perf-panning', 'myui-perf-dragging');
    viewport.addEventListener(
      'pointerdown',
      (e) => {
        const st = window.VN_MYUI_PERF || perfState;
        if (!st || st.enabled === false) return;
        if (e.button !== 0) return;
        const isDrag = !!e.target.closest('.node,.scene-header,.scene-handle');
        root.classList.toggle('myui-perf-dragging', isDrag);
        root.classList.toggle('myui-perf-panning', !isDrag);
        root.classList.toggle(
          'myui-perf-aggressive',
          !!(st.flags && st.flags.hideNodesDuringPan)
        );
      },
      true
    );
    window.addEventListener('pointerup', clear, true);
    window.addEventListener('pointercancel', clear, true);
  }

  // boot after a tick so myui.js finished binding
  function boot() {
    ensureDefaultSettingsChrome();
    // re-fill if myui panel appears later
    setTimeout(ensureDefaultSettingsChrome, 300);
    setTimeout(ensureDefaultSettingsChrome, 1200);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.VN_EDITOR_SETTINGS = {
    switchUi,
    currentUiId,
    packs: UI_PACKS,
    syncPerfUI,
  };
})();
