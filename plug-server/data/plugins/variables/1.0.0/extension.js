/** VN Engine official plugin: variables */
VN.plugin({
  id: 'variables',
  name: 'Переменные',
  version: '1.0.0',
  category: 'gameplay',
  description: 'Работа с переменными сценария и runtime-панель.',
  targets: ['player'],

  command: {
    type: 'set-variable',
    match: [/^переменная(?=\s|$)/i, /^setvar(?=\s|$)/i],
    syntax: 'переменная имя значение',
    insertText: 'переменная ',
    label: 'Установить переменную',
    parse(line) {
      const raw = line.trim().replace(/^(переменная|setvar)\s*/i, '');
      const m = raw.match(/^(\S+)\s+(.+)$/);
      if (!m) return { type: 'set-variable', key: '', value: null };
      return { type: 'set-variable', key: m[1], value: parseValue(m[2]) };
    },
  },

  run(ctx, args) {
    if (!args.key) return;
    ctx.setVar(args.key, args.value);
  },

  setup(api) {
    if (api.ui.context === 'player') mountPanel(api);
  },
});

function parseValue(raw) {
  const value = String(raw == null ? '' : raw).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
  return value;
}

function mountPanel(api) {
  const ui = api.ui;
  ui.addStyle(`
    .vn-vars-panel{position:fixed;right:12px;top:48px;z-index:9000;width:280px;max-height:55vh;overflow:auto;padding:12px;background:rgba(15,15,28,.96);border:1px solid #35355a;border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.4);color:#eee;font:13px system-ui;display:none}
    .vn-vars-panel.open{display:block}.vn-vars-panel h3{margin:0 0 8px;font-size:14px}.vn-vars-row{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid #292940}.vn-vars-key{flex:1;color:#aaa;overflow:hidden;text-overflow:ellipsis}.vn-vars-value{max-width:120px;color:#fff}
  `, 'vn-variables-style');

  const button = ui.addButton(api.ui.context === 'player' ? 'player.top' : 'preview.toolbar', {
    label: 'Переменные',
    title: 'Показать runtime-переменные',
  });
  const panel = ui.createElement('section', { className: 'vn-vars-panel' });
  panel.innerHTML = '<h3>Runtime-переменные</h3><div class="vn-vars-list"></div>';
  ui.mount(ui.document.body, panel);
  const list = panel.querySelector('.vn-vars-list');

  function render() {
    const vars = api.variables ? api.variables.list() : {};
    const keys = Object.keys(vars);
    list.innerHTML = keys.length ? keys.map(key =>
      '<div class="vn-vars-row"><span class="vn-vars-key"></span><span class="vn-vars-value"></span></div>'
    ).join('') : '<div style="color:#777">Нет переменных</div>';
    keys.forEach((key, i) => {
      const row = list.children[i];
      row.children[0].textContent = key;
      row.children[1].textContent = format(vars[key]);
    });
  }
  function format(v) { return typeof v === 'string' ? v : JSON.stringify(v); }

  button && button.addEventListener('click', () => { panel.classList.toggle('open'); render(); });
  api.events.on('variable', render);
  api.events.on('load', render);
  api.events.on('restart', render);
  render();
}
