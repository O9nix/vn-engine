/** VN Engine official plugin: wait */
VN.plugin({
  id: 'wait',
  name: 'Пауза',
  version: '1.0.0',
  category: 'timing',
  description: 'Пауза перед следующей командой сценария.',
  targets: ['player'],

  command: {
    type: 'wait',
    match: [/^ждать(?=\s|$)/i, /^wait(?=\s|$)/i],
    syntax: 'ждать [секунды]',
    insertText: 'ждать 1',
    label: 'Пауза',
    parse(line) {
      const parts = line.trim().split(/\s+/);
      const sec = parts[1] != null ? Number(parts[1]) : 1;
      return { type: 'wait', seconds: Number.isFinite(sec) ? sec : 1 };
    },
  },

  settings: {
    seconds: { type: 'number', label: 'Секунды', default: 1, min: 0.1, max: 30 },
  },

  async run(ctx, args, settings) {
    const sec = args.seconds != null ? args.seconds : settings.seconds;
    await ctx.wait(sec * 1000);
    ctx.next();
    return false;
  },
});
