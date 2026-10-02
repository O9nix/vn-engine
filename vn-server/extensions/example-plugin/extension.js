/**
 * Пример плагина для разработчиков.
 * Его можно удалить из загрузки, не меняя SDK.
 */
VN.plugin({
  id: 'example-plugin',
  name: 'Пример Plugin SDK',
  version: '1.0.0',
  description: 'Показывает, как расширять editor, app, player и preview одним плагином.',
  targets: ['app', 'editor', 'player', 'preview'],

  ui(api) {
    const { ui } = api;

    ui.addStyle(`
      .vn-plugin-example-panel { padding: 8px 10px; font-size: 12px; opacity: .9; }
      .vn-plugin-example-panel strong { color: #a0a0ff; }
      .vn-plugin-example-button { margin-left: 6px; }
    `, 'vn-plugin-example-style');

    if (ui.context === 'editor') {
      const button = ui.addButton('editor.toolbar', {
        label: 'Плагин API',
        title: 'Пример доступа плагина к редактору',
      });
      if (button) {
        button.className = 'vn-plugin-example-button';
        button.addEventListener('click', () => {
          const panel = ui.addPanel('editor.toolbar', {
            title: 'Plugin API',
            content: '<div class="vn-plugin-example-panel">Этот UI создан сторонним плагином.</div>',
          });
          if (panel) setTimeout(() => panel.remove(), 2500);
        });
      }
    }

    if (ui.context === 'app') {
      ui.addButton('app.toolbar', {
        label: 'SDK',
        title: 'Plugin SDK подключён',
        onClick: () => alert('VN Plugin SDK работает в основном приложении.'),
      });
    }

    if (ui.context === 'player') {
      const panel = ui.addPanel('player.top', {
        title: 'Plugin API',
        content: '<div class="vn-plugin-example-panel">Плеер также расширяется плагинами.</div>',
      });
      if (panel) {
        panel.style.pointerEvents = 'none';
      }
    }

    if (ui.context === 'preview') {
      ui.addButton('preview.toolbar', {
        label: 'SDK',
        title: 'Плагин подключён к preview',
        onClick: () => console.log('[example-plugin] preview API работает'),
      });
    }
  },
});
