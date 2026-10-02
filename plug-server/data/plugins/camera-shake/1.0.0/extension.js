/** VN Engine official plugin: camera-shake */
VN.plugin({
  id: 'camera-shake',
  name: 'Тряска камеры',
  version: '1.0.0',
  category: 'camera',
  description: 'Трясёт игровую сцену.',
  targets: ['player'],

  command: {
    type: 'shake',
    match: [/^тряска(?=\s|$)/i, /^shake(?=\s|$)/i],
    syntax: 'тряска [сила] [секунды]',
    insertText: 'тряска',
    label: 'Тряска экрана',
    parse(line) {
      const parts = line.trim().split(/\s+/);
      const intensity = parts[1] != null ? Number(parts[1]) : undefined;
      const duration = parts[2] != null ? Number(parts[2]) : undefined;
      return {
        type: 'shake',
        intensity: Number.isFinite(intensity) ? intensity : undefined,
        duration: Number.isFinite(duration) ? duration : undefined,
      };
    },
  },

  settings: {
    intensity: { type: 'number', label: 'Сила', default: 10, min: 1, max: 40 },
    duration: { type: 'number', label: 'Длительность (сек)', default: 0.45, min: 0.1, max: 3, step: 0.05 },
  },

  run(ctx, args, settings) {
    ctx.shake(
      args.intensity != null ? args.intensity : settings.intensity,
      args.duration != null ? args.duration : settings.duration
    );
  },
});
