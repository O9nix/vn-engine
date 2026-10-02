(function () {
  'use strict';

  VN.plugin({
    id: 'debug-panel',
    name: 'Debug Panel',
    version: '1.0.1',
    description: 'Небольшая панель для просмотра состояния движка и переменных сценария.',
    // движок (VNCore) существует только в плеере
    targets: ['player'],

    ui(api) {
      const { ui } = api;

      ui.addStyle(`
        .vn-debug-panel {
          position: absolute;
          top: 8px;
          right: 8px;
          margin: 0;
          padding: 12px;
          min-width: 240px;
          max-width: 420px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 10px;
          background: rgba(15,15,28,.96);
          color: #eee;
          font: 12px/1.45 system-ui, sans-serif;
          box-shadow: 0 12px 35px rgba(0,0,0,.35);
          z-index: 1000;
        }
        .vn-debug-panel h3 { margin: 0 0 8px; font-size: 14px; }
        .vn-debug-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          padding: 4px 0;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .vn-debug-key { color: #999; }
        .vn-debug-value { color: #b9d8ff; text-align: right; word-break: break-all; }
        .vn-debug-empty { color: #777; }
        .vn-debug-refresh {
          margin-top: 9px;
          padding: 5px 8px;
          border: 1px solid #3d3d66;
          border-radius: 6px;
          background: #20203a;
          color: #eee;
          cursor: pointer;
        }
      `, 'vn-debug-panel-style');

      const panel = ui.addPanel('player.top', {
        id: 'vn-debug-panel',
        title: 'Debug Panel',
      });
      if (!panel) return;

      const content = ui.createElement('div');
      const refresh = ui.createElement('button');
      refresh.type = 'button';
      refresh.className = 'vn-debug-refresh';
      refresh.textContent = 'Обновить';

      panel.appendChild(content);
      panel.appendChild(refresh);

      function addRow(key, value) {
        const row = ui.createElement('div');
        row.className = 'vn-debug-row';

        const keyEl = ui.createElement('span');
        keyEl.className = 'vn-debug-key';
        keyEl.textContent = key;

        const valueEl = ui.createElement('span');
        valueEl.className = 'vn-debug-value';
        valueEl.textContent = value;

        row.appendChild(keyEl);
        row.appendChild(valueEl);
        content.appendChild(row);
      }

      function render() {
        content.innerHTML = '';

        const core = api.core;
        if (!core) {
          const empty = ui.createElement('div');
          empty.className = 'vn-debug-empty';
          empty.textContent = 'Движок ещё не создан.';
          content.appendChild(empty);
          return;
        }

        addRow('Контекст', ui.context);
        addRow('Индекс', String(core.index));
        addRow('Спикер', core.state.speaker || '—');
        addRow('Текст', core.state.text || '—');
        addRow('Фон', core.state.background || '—');
        addRow('Переменные', String(Object.keys(core.variables || {}).length));
      }

      refresh.addEventListener('click', render);
      ['variable', 'load', 'restart', 'say', 'background', 'show', 'hide'].forEach((ev) =>
        api.events.on(ev, render)
      );
      render();
    },
  });
})();
