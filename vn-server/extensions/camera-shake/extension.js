/**
 * Расширение: тряска камеры / сцены
 * =================================
 * В сценарии:
 *   тряска
 *   тряска 15
 *   тряска 12 0.8
 *   shake 10 0.5
 *
 * Подключение: <script src="extensions/camera-shake/extension.js"></script>
 * (после extensions-host.js)
 */
VN.extension({
  id: 'camera-shake',
  name: 'Тряска камеры',
  category: 'Камера',
  description: 'Трясёт игровой экран. Пишется одной строкой в сценарии.',

  /**
   * targets — для чего расширение (документация + будущий редактор):
   *   command  — новая строка в текстовом сценарии
   *   runtime  — действие во время игры
   *   scene    — объекты/эффекты на сцене
   *   editor   — панели редактора (пока не используется UI)
   */
  targets: ['command', 'runtime', 'scene'],

  command: {
    type: 'shake',
    // как узнать строку в сценарии
    match: [/^тряска(?=\s|$)/i, /^shake(?=\s|$)/i],
    syntax: 'тряска [сила] [секунды]',
    insertText: 'тряска',
    label: 'Тряска экрана',

    // разобрать строку → поля команды
    parse(line) {
      const parts = line.trim().split(/\s+/);
      // parts[0] = тряска|shake
      const intensity = parts[1] != null ? Number(parts[1]) : undefined;
      const duration = parts[2] != null ? Number(parts[2]) : undefined;
      return {
        type: 'shake',
        intensity: Number.isFinite(intensity) ? intensity : undefined,
        duration: Number.isFinite(duration) ? duration : undefined,
      };
    },
  },

  // настройки по умолчанию (если в строке не указано)
  settings: {
    intensity: {
      type: 'number',
      label: 'Сила',
      default: 10,
      min: 1,
      max: 40,
    },
    duration: {
      type: 'number',
      label: 'Длительность (сек)',
      default: 0.45,
      min: 0.1,
      max: 3,
      step: 0.05,
    },
  },

  /**
   * @param {object} ctx       — контекст (shake, stage, core, next, ...)
   * @param {object} args      — что распарсили из строки
   * @param {object} settings  — дефолты из settings + сохранённые
   */
  run(ctx, args, settings) {
    const intensity =
      args.intensity != null ? args.intensity : settings.intensity;
    const duration =
      args.duration != null ? args.duration : settings.duration;

    ctx.shake(intensity, duration);
  },
});
