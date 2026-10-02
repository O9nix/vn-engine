VN.plugin({
  id: 'multi-window',
  name: 'Отдельные окна',
  version: '1.0.0',
  description: 'Вынести редактор, граф и плеер в отдельные окна',
  targets: ['app'],

  ui(api) {
    const opened = { editor: null, player: null, preview: null };

    function openWin(key, url, features) {
      // если уже открыто — фокус
      if (opened[key] && !opened[key].closed) {
        opened[key].focus();
        return opened[key];
      }
      const w = window.open(url, 'vn-' + key, features || 'width=900,height=700');
      opened[key] = w;
      return w;
    }

    api.ui.addButton('app.toolbar', {
      label: '⧉ Редактор',
      title: 'Открыть редактор в отдельном окне',
      onClick() {
        openWin('editor', 'editor.html', 'width=700,height=800');
      },
    });

    api.ui.addButton('app.toolbar', {
      label: '⧉ Игра',
      title: 'Открыть плеер в отдельном окне',
      onClick() {
        openWin('player', 'player.html', 'width=960,height=540');
      },
    });

    api.ui.addButton('app.toolbar', {
      label: '⧉ Граф',
      title: 'Открыть граф сцен в отдельном окне',
      onClick() {
        openWin('preview', 'preview.html', 'width=800,height=600');
      },
    });

    api.ui.addButton('app.toolbar', {
      label: 'Скрыть панели',
      title: 'Спрятать iframe’ы в главном окне (работа в отдельных)',
      onClick() {
        const layout = document.querySelector('.main-layout');
        if (!layout) return;
        layout.classList.toggle('vn-popout-mode');
      },
    });

    api.ui.addStyle(`
      .main-layout.vn-popout-mode .iframe-container,
      .main-layout.vn-popout-mode .right-panel {
        display: none !important;
      }
      .main-layout.vn-popout-mode {
        grid-template-columns: 1fr;
        grid-template-rows: 48px 1fr;
      }
      .main-layout.vn-popout-mode::after {
        content: 'Редактор, игра и граф открыты в отдельных окнах. Синхронизация через localStorage.';
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        font-size: 1rem;
        grid-column: 1 / -1;
      }
    `);
  },
});