/** VN Engine official plugin: example-plugin */
VN.plugin({
  id: 'example-plugin',
  name: 'Пример плагина',
  version: '1.0.0',
  category: 'developer',
  description: 'Минимальный пример публичного Plugin SDK.',
  targets: ['player'],

  command: {
    type: 'example',
    match: [/^пример(?=\s|$)/i, /^example(?=\s|$)/i],
    syntax: 'пример [текст]',
    insertText: 'пример',
    label: 'Пример плагина',
    parse(line) {
      const text = line.trim().replace(/^(пример|example)\s*/i, '').trim();
      return { type: 'example', text: text || 'Привет от плагина!' };
    },
  },

  run(ctx, args) {
    ctx.emit('example:run', { text: args.text });
  },

  setup(api) {
    if (api.ui.context !== 'player') return;
    api.ui.addStyle(`
      .vn-example-message{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:9100;padding:10px 16px;border-radius:8px;background:rgba(80,70,180,.94);color:white;font:14px system-ui;opacity:0;pointer-events:none;transition:opacity .18s}
      .vn-example-message.show{opacity:1}
    `, 'vn-example-plugin-style');
    const msg = api.ui.createElement('div', { className: 'vn-example-message' });
    api.ui.mount(api.ui.document.body, msg);
    const button = api.ui.addButton('player.top', { label: 'Пример', title: 'Проверить пример плагина' });
    function show(text) {
      msg.textContent = text;
      msg.classList.add('show');
      clearTimeout(show.timer);
      show.timer = setTimeout(() => msg.classList.remove('show'), 1400);
    }
    button && button.addEventListener('click', () => show('Кнопка создана через Plugin SDK'));
    api.events.on('example:run', payload => show(payload && payload.text || 'Привет от плагина!'));
  },
});
