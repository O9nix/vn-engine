/** VN Engine official plugin: debug-panel */
VN.plugin({
  id: 'debug-panel',
  name: 'Панель отладки',
  version: '1.0.0',
  category: 'tools',
  description: 'Инспектор runtime-состояния.',
  targets: ['player'],

  setup(api) {
    if (api.ui.context === 'player') mountPanel(api);
  },
});

function mountPanel(api) {
  const ui = api.ui;
  ui.addStyle(`
    .vn-debug-panel{position:fixed;left:12px;bottom:12px;z-index:9001;width:330px;max-height:52vh;overflow:auto;padding:12px;background:rgba(12,12,22,.97);border:1px solid #3a3a62;border-radius:10px;box-shadow:0 14px 50px rgba(0,0,0,.45);color:#ddd;font:12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;display:none}
    .vn-debug-panel.open{display:block}.vn-debug-panel h3{margin:0 0 8px;font:600 14px system-ui}.vn-debug-panel pre{white-space:pre-wrap;word-break:break-word;margin:0;color:#bfc0d8}.vn-debug-panel .vn-debug-error{color:#ff8f8f}
  `, 'vn-debug-panel-style');

  const slot = api.ui.context === 'player' ? 'player.top' : 'preview.toolbar';
  const button = ui.addButton(slot, { label: 'Отладка', title: 'Панель отладки VN Engine' });
  const panel = ui.createElement('section', { className: 'vn-debug-panel' });
  panel.innerHTML = '<h3>VN Engine Debug</h3><pre></pre>';
  ui.mount(ui.document.body, panel);
  const pre = panel.querySelector('pre');

  function snapshot() {
    const core = api.core;
    if (!core) return { status: 'Ожидание VNCore…' };
    try {
      return core.getState();
    } catch (err) {
      return { error: err.message || String(err) };
    }
  }
  function render() { pre.textContent = JSON.stringify(snapshot(), null, 2); }

  button && button.addEventListener('click', () => { panel.classList.toggle('open'); render(); });
  ['load', 'command', 'say', 'choice', 'jump', 'background', 'show', 'hide', 'variable', 'clear', 'restart', 'end', 'typing:done'].forEach(event => api.events.on(event, render));
  render();
}
