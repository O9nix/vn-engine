/**
 * Плагин: Инвентарь
 * =================
 * Команды сценария:
 *   предмет меч              — добавить «меч»
 *   предмет меч 3            — добавить 3 штуки
 *   убрать меч               — удалить 1
 *   убрать меч 2             — удалить 2
 *   очистить инвентарь       — сбросить всё
 *
 * В плеере появляется кнопка «Инвентарь» и панель со списком.
 */
VN.plugin({
  id: 'inventory',
  name: 'Инвентарь',
  version: '1.0.0',
  description: 'Предметы в сценарии + панель в плеере',
  targets: ['player', 'app'],

  settings: {
    maxSlots: { default: 20 },
  },

  command: {
    type: 'inventory',
    keywords: ['предмет', 'убрать', 'очистить инвентарь', 'item', 'remove item', 'clear inventory'],
    parse(line) {
      const s = line.trim();

      if (/^(очистить инвентарь|clear inventory)\s*$/i.test(s)) {
        return { type: 'inventory', action: 'clear' };
      }

      let m = s.match(/^(предмет|item)\s+(.+?)(?:\s+(\d+))?\s*$/i);
      if (m) {
        return {
          type: 'inventory',
          action: 'add',
          name: m[2].trim(),
          count: m[3] ? parseInt(m[3], 10) : 1,
        };
      }

      m = s.match(/^(убрать|remove item)\s+(.+?)(?:\s+(\d+))?\s*$/i);
      if (m) {
        return {
          type: 'inventory',
          action: 'remove',
          name: m[2].trim(),
          count: m[3] ? parseInt(m[3], 10) : 1,
        };
      }

      return { type: 'inventory', action: 'noop', raw: s };
    },
  },

  run(ctx, args, settings) {
    const inv = getInventory(ctx);
    const max = settings.maxSlots || 20;

    if (args.action === 'clear') {
      inv.items = {};
      saveInventory(ctx, inv);
      ctx.emit('inventory:change', inv);
      return;
    }

    if (args.action === 'add' && args.name) {
      const key = normalize(args.name);
      const n = Math.max(1, args.count || 1);
      const current = inv.items[key] || { name: args.name, count: 0 };
      if (Object.keys(inv.items).length >= max && !inv.items[key]) {
        console.warn('[inventory] лимит слотов:', max);
        return;
      }
      current.count += n;
      inv.items[key] = current;
      saveInventory(ctx, inv);
      ctx.emit('inventory:change', inv);
      return;
    }

    if (args.action === 'remove' && args.name) {
      const key = normalize(args.name);
      const item = inv.items[key];
      if (!item) return;
      item.count -= Math.max(1, args.count || 1);
      if (item.count <= 0) delete inv.items[key];
      saveInventory(ctx, inv);
      ctx.emit('inventory:change', inv);
    }
  },

  setup(api) {
    // при перезапуске сценария можно сбрасывать или оставлять — здесь оставляем
    api.on('inventory:change', () => {
      // UI обновится через подписку в ui()
    });
  },

  ui(api) {
    api.ui.addStyle(`
      .inv-panel {
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 260px;
        max-height: 50vh;
        overflow: auto;
        z-index: 200;
        display: none;
      }
      .inv-panel.open { display: block; }
      .inv-list { list-style: none; margin: 0; padding: 0; }
      .inv-list li {
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid #2a2a4a;
        font-size: 0.9rem;
      }
      .inv-empty { color: #666; font-size: 0.85rem; padding: 8px 0; }
      .inv-count { color: #a0a0ff; font-variant-numeric: tabular-nums; }
    `, 'vn-inventory-style');

    const panel = api.ui.addPanel('player.bottom', {
      id: 'inv-panel',
      title: 'Инвентарь',
    });
    if (!panel) return;

    panel.classList.add('inv-panel');
    const list = document.createElement('ul');
    list.className = 'inv-list';
    panel.appendChild(list);

    function render() {
      const core = api.core;
      const inv = core ? getInventory({ storage: api.storage, core }) : { items: {} };
      const entries = Object.values(inv.items || {});
      list.innerHTML = '';
      if (!entries.length) {
        const empty = document.createElement('div');
        empty.className = 'inv-empty';
        empty.textContent = 'Пусто';
        list.appendChild(empty);
        return;
      }
      entries.forEach((it) => {
        const li = document.createElement('li');
        li.innerHTML =
          '<span>' + escapeHtml(it.name) + '</span>' +
          '<span class="inv-count">×' + it.count + '</span>';
        list.appendChild(li);
      });
    }

    api.ui.addButton('player.top', {
      label: '🎒 Инвентарь',
      title: 'Показать / скрыть инвентарь',
      onClick() {
        panel.classList.toggle('open');
        render();
      },
    });

    // обновление при изменении
    api.events.on('inventory:change', render);
    api.events.on('load', render);
    render();
  },
});

// --- helpers (общие для run и ui) ---

function normalize(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function getInventory(ctx) {
  const storage = ctx.storage;
  if (storage) {
    return storage.get('items', { items: {} });
  }
  // fallback на переменную ядра
  const core = ctx.core || ctx.engine;
  if (core) {
    const v = core.getVar('__inventory');
    if (v && typeof v === 'object') return v;
  }
  return { items: {} };
}

function saveInventory(ctx, inv) {
  if (ctx.storage) {
    ctx.storage.set('items', inv);
  }
  const core = ctx.core || ctx.engine;
  if (core) {
    core.setVar('__inventory', inv);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}