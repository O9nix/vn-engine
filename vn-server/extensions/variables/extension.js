/**
 * Пример расширения: переменные и условия
 * =======================================
 * Две команды сценария (один файл может регистрировать несколько расширений).
 *
 *   установить доверие = 0        задать значение
 *   установить доверие += 1       прибавить   (также -=)
 *   установить имя = Алиса        строка
 *
 *   если доверие >= 3 перейти хорошая_концовка
 *   (операторы: ==  !=  >  <  >=  <=)
 *
 * Подключение (после extensions-host.js и plugin-sdk.js):
 *   <script src="extensions/variables/extension.js"></script>
 * Подключайте и в player.html, и в preview.html — парсеру нужно знать команды,
 * а граф сцен рисует стрелки условий (блок graph у расширения if-jump).
 */

// Число, true/false или строка
function toValue(raw) {
  const s = String(raw).trim();
  if (s !== '' && Number.isFinite(Number(s))) return Number(s);
  if (s === 'true' || s === 'истина') return true;
  if (s === 'false' || s === 'ложь') return false;
  return s;
}

// ---------------------------------------------------------------------------
// установить <имя> = | += | -= <значение>
// ---------------------------------------------------------------------------
VN.extension({
  id: 'set-var',
  name: 'Установить переменную',
  category: 'Логика',
  description: 'Задаёт, увеличивает или уменьшает переменную сценария.',
  targets: ['command', 'runtime'],

  command: {
    type: 'set-var',
    // строка считается командой, только если в ней есть оператор присваивания
    match: [/^установить\s+\S+\s*(\+=|-=|=)/i],
    syntax: 'установить имя = значение',
    insertText: 'установить счёт = 0',
    label: 'Установить переменную',

    parse(line) {
      const m = line.trim().match(/^установить\s+(\S+?)\s*(\+=|-=|=)\s*(.*)$/i);
      return { type: 'set-var', name: m[1], op: m[2], value: toValue(m[3]) };
    },
  },

  // Синхронный run: хост сам вызовет next()
  run(ctx, args) {
    const current = ctx.variables.get(args.name, 0);
    let result = args.value;
    if (args.op === '+=') result = Number(current) + Number(args.value);
    if (args.op === '-=') result = Number(current) - Number(args.value);
    ctx.variables.set(args.name, result);
  },
});

// ---------------------------------------------------------------------------
// если <имя> <оператор> <значение> перейти <метка>
// ---------------------------------------------------------------------------
const COMPARE = {
  '==': (a, b) => a == b,
  '!=': (a, b) => a != b,
  '>':  (a, b) => a > b,
  '<':  (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
};

VN.extension({
  id: 'if-jump',
  name: 'Условный переход',
  category: 'Логика',
  description: 'Переходит на метку, если условие выполнено.',
  targets: ['command', 'runtime'],

  command: {
    type: 'if-jump',
    match: [/^если\s+\S+\s*(==|!=|>=|<=|>|<)\s*\S+\s+перейти\s+\S+/i],
    syntax: 'если имя > 3 перейти метка',
    insertText: 'если счёт > 0 перейти конец_истории',
    label: 'Условный переход',

    parse(line) {
      const m = line.trim().match(
        /^если\s+(\S+?)\s*(==|!=|>=|<=|>|<)\s*(\S+)\s+перейти\s+(\S+)/i
      );
      return {
        type: 'if-jump',
        name: m[1],
        op: m[2],
        value: toValue(m[3]),
        target: m[4].toLowerCase().replace(/\s+/g, '_'),
      };
    },
  },

  /**
   * Подсказка для графа сцен (preview): куда ведёт эта команда.
   * Условный переход рисуется пунктирной стрелкой с подписью условия;
   * если «если» — последняя команда сцены, к следующей сцене идёт стрелка «иначе».
   */
  graph: {
    edges(cmd) {
      return [{ target: cmd.target, label: cmd.name + ' ' + cmd.op + ' ' + cmd.value }];
    },
    fallthrough() {
      return 'иначе';
    },
  },

  run(ctx, args) {
    const current = ctx.variables.get(args.name, 0);
    if (COMPARE[args.op](current, args.value)) {
      ctx.core.jump(args.target);
      return false; // jump сам продолжит сценарий — авто-next не нужен
    }
    // условие не выполнено — ничего не возвращаем, хост пойдёт дальше
  },
});
