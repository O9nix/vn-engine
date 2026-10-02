/**
 * Простой парсер сценария визуальной новеллы.
 * Формат рассчитан на людей без опыта программирования.
 *
 * Пример:
 *
 * # Начало
 * фон парк.jpg
 * показать Алиса счастливая слева
 *
 * Алиса: Привет! Как дела?
 *
 * выбор:
 *   - Хорошо → сцена_хорошо
 *   - Плохо → сцена_плохо
 *
 * # сцена_хорошо
 * Алиса: Отлично!
 * конец
 */

class VNParser {
  constructor() {
    this.labels = {};   // имя метки → индекс в this.lines
    this.lines = [];    // массив команд
  }

  parse(text) {
    this.labels = {};
    this.lines = [];
    const raw = text.split(/\r?\n/);
    let i = 0;

    while (i < raw.length) {
      let line = raw[i].trim();
      i++;

      // пустые строки и комментарии
      if (!line || line.startsWith('//') || line.startsWith('/*')) continue;

      // метка сцены: # Название или #название
      if (line.startsWith('#')) {
        const label = line.slice(1).trim().toLowerCase().replace(/\s+/g, '_');
        this.labels[label] = this.lines.length;
        this.lines.push({ type: 'label', name: label });
        continue;
      }

      // фон
      if (/^фон\s+/i.test(line) || /^background\s+/i.test(line)) {
        const bg = line.replace(/^(фон|background)\s+/i, '').trim();
        this.lines.push({ type: 'background', value: bg });
        continue;
      }

      // показать персонажа
      // показать Имя эмоция позиция
      if (/^показать\s+/i.test(line) || /^show\s+/i.test(line)) {
        const rest = line.replace(/^(показать|show)\s+/i, '').trim();
        const parts = rest.split(/\s+/);
        const name = parts[0] || '???';
        const emotion = parts[1] || 'default';
        const position = parts[2] || 'center';
        this.lines.push({ type: 'show', name, emotion, position });
        continue;
      }

      // спрятать
      if (/^спрятать\s+/i.test(line) || /^hide\s+/i.test(line)) {
        const name = line.replace(/^(спрятать|hide)\s+/i, '').trim();
        this.lines.push({ type: 'hide', name });
        continue;
      }

      // музыка / звук
      if (/^музыка\s+/i.test(line) || /^music\s+/i.test(line)) {
        const track = line.replace(/^(музыка|music)\s+/i, '').trim();
        this.lines.push({ type: 'music', value: track });
        continue;
      }
      if (/^звук\s+/i.test(line) || /^sound\s+/i.test(line)) {
        const sfx = line.replace(/^(звук|sound)\s+/i, '').trim();
        this.lines.push({ type: 'sound', value: sfx });
        continue;
      }

      // переход / прыжок
      if (/^(перейти|прыгнуть|jump)\s+/i.test(line)) {
        const target = line.replace(/^(перейти|прыгнуть|jump)\s+/i, '').trim().toLowerCase().replace(/\s+/g, '_');
        this.lines.push({ type: 'jump', target });
        continue;
      }

      // конец
      if (/^(конец|end|finish)$/i.test(line)) {
        this.lines.push({ type: 'end' });
        continue;
      }

      // выбор (многострочный блок)
      if (/^выбор\s*:?\s*$/i.test(line) || /^menu\s*:?\s*$/i.test(line) || /^выбор\s+/i.test(line)) {
        const choices = [];
        // читаем следующие строки, начинающиеся с - или *
        while (i < raw.length) {
          const next = raw[i].trim();
          if (!next) { i++; continue; }
          if (/^[-*•]\s+/.test(next)) {
            // формат: - Текст → метка   или  - Текст -> метка
            const m = next.match(/^[-*•]\s+(.+?)(?:\s*(?:→|->|=>)\s*(.+))?$/);
            if (m) {
              choices.push({
                text: m[1].trim(),
                target: m[2] ? m[2].trim().toLowerCase().replace(/\s+/g, '_') : null
              });
            }
            i++;
          } else {
            break;
          }
        }
        this.lines.push({ type: 'menu', choices });
        continue;
      }

      // --- расширения (VN.extension → command.match) ---
      if (typeof VN !== 'undefined' && typeof VN._matchExtensionLine === 'function') {
        // матчеры могли ещё не повесить на этот инстанс
        if (typeof VN.applyExtensionsToParser === 'function') {
          VN.applyExtensionsToParser(this);
        }
        const extCmd = VN._matchExtensionLine(this, line);
        if (extCmd) {
          this.lines.push(extCmd);
          continue;
        }
      }

      // диалог: Имя: текст   или   "текст"   или просто текст
      const dialogMatch = line.match(/^([^:：]+)[:：]\s*(.+)$/);
      if (dialogMatch) {
        this.lines.push({
          type: 'say',
          speaker: dialogMatch[1].trim(),
          text: dialogMatch[2].trim()
        });
        continue;
      }

      // просто реплика без имени (narrator)
      if (line.startsWith('"') && line.endsWith('"')) {
        this.lines.push({ type: 'say', speaker: null, text: line.slice(1, -1) });
        continue;
      }

      // всё остальное считаем текстом рассказчика
      this.lines.push({ type: 'say', speaker: null, text: line });
    }

    return {
      labels: this.labels,
      lines: this.lines
    };
  }

  // Строим граф сцен для предпросмотра
  buildGraph(parsed) {
    const nodes = [];
    const edges = [];
    const labelToNode = {};

    // создаём узлы для каждой метки
    Object.keys(parsed.labels).forEach((label, idx) => {
      const id = 'n' + idx;
      labelToNode[label] = id;
      nodes.push({
        id,
        label: label,
        type: 'scene'
      });
    });

    // если нет ни одной метки — одна большая сцена
    if (nodes.length === 0) {
      nodes.push({ id: 'n0', label: 'начало', type: 'scene' });
      labelToNode['начало'] = 'n0';
    }

    // проходим по командам и ищем jump + menu
    let currentLabel = Object.keys(parsed.labels)[0] || 'начало';

    parsed.lines.forEach((cmd, idx) => {
      if (cmd.type === 'label') {
        currentLabel = cmd.name;
      }
      if (cmd.type === 'jump' && cmd.target) {
        const from = labelToNode[currentLabel];
        const to = labelToNode[cmd.target];
        if (from && to) {
          edges.push({ from, to, label: '→' });
        }
      }
      if (cmd.type === 'menu') {
        cmd.choices.forEach(ch => {
          if (ch.target) {
            const from = labelToNode[currentLabel];
            const to = labelToNode[ch.target];
            if (from && to) {
              edges.push({ from, to, label: ch.text.slice(0, 20) });
            }
          }
        });
      }
    });

    return { nodes, edges };
  }
}

// экспорт для браузера
window.VNParser = VNParser;
