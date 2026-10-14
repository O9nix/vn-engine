import test from 'node:test';
import assert from 'node:assert/strict';

import { PluginManager, PLUGIN_API_VERSION } from '../plugin-manager.js';
import { EventBus } from '../events.js';

function quiet(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
}

// PluginManager не зависит от браузера: Player и BlockManager заменяем заглушками.
function setup(t) {
    quiet(t);

    const bus = new EventBus();
    const nodeTypes = new Map();
    const layers = new Set();

    const game = {
        registerNodeType: (type, handler) => nodeTypes.set(type, handler),
        unregisterNodeType: (type) => nodeTypes.delete(type)
    };

    const player = {
        getPluginLayer: () => ({}),
        registerLayer: (name) => {
            layers.add(name);
            return () => layers.delete(name);
        },
        show() {},
        hide() {},
        isVisible: () => true
    };

    const manager = new PluginManager(bus, game, player, {});

    return { manager, bus, nodeTypes, layers };
}

const plugin = (name, extra = {}) => ({ name, install() {}, ...extra });

test('PluginManager: use() проверяет плагин', (t) => {
    const { manager } = setup(t);

    assert.throws(() => manager.use(null), /install/);
    assert.throws(() => manager.use({ name: 'x' }), /install/);
    assert.throws(() => manager.use({ install() {} }), /имя/);
    assert.throws(
        () => manager.use(plugin('x', { dependencies: 'state' })),
        /массивом/
    );
});

test('PluginManager: повторная установка и отсутствующая зависимость', (t) => {
    const { manager } = setup(t);

    manager.use(plugin('a'));

    assert.throws(() => manager.use(plugin('a')), /уже установлен/);
    assert.throws(
        () => manager.use(plugin('b', { dependencies: ['a', 'x', 'y'] })),
        /"x, y"/
    );
});

test('PluginManager: has, get, list', (t) => {
    const { manager } = setup(t);
    const a = plugin('a');

    manager.use(a).use(plugin('b'));

    assert.ok(manager.has('a'));
    assert.ok(!manager.has('нет'));
    assert.equal(manager.get('a'), a);
    assert.deepEqual(manager.list(), ['a', 'b']);
});

test('PluginManager: публичный api плагина доступен другим плагинам', (t) => {
    const { manager } = setup(t);
    let seen;

    manager.use({
        name: 'state',
        install() {
            return { api: { get: () => 42 } };
        }
    });

    manager.use({
        name: 'user',
        install(api) {
            seen = api.plugins.state.api.get();
        }
    });

    assert.equal(seen, 42);
});

test('PluginManager: обращение к неустановленному плагину даёт null', (t) => {
    const { manager } = setup(t);
    let value = 'не задано';

    manager.use({
        name: 'user',
        install(api) {
            value = api.plugins.nobody;
        }
    });

    assert.equal(value, null);
});

test('PluginManager: api.events связан с шиной, api.game регистрирует типы узлов', (t) => {
    const { manager, bus, nodeTypes } = setup(t);
    const received = [];

    manager.use({
        name: 'p',
        install(api) {
            api.events.on('ping', payload => received.push(payload));
            api.game.registerNodeType('p-node', () => {});
        }
    });

    bus.emit('ping', 1);

    assert.deepEqual(received, [1]);
    assert.ok(nodeTypes.has('p-node'));
});

test('PluginManager: remove вызывает cleanup и убирает плагин', (t) => {
    const { manager } = setup(t);
    let cleaned = false;

    manager.use({
        name: 'a',
        install() {
            return { cleanup() { cleaned = true; } };
        }
    });

    assert.equal(manager.remove('a'), true);
    assert.ok(cleaned);
    assert.ok(!manager.has('a'));
    assert.equal(manager.remove('a'), false);
});

test('PluginManager: нельзя удалить плагин, от которого зависят другие', (t) => {
    const { manager } = setup(t);

    manager.use(plugin('state'));
    manager.use(plugin('choice', { dependencies: ['state'] }));

    assert.throws(() => manager.remove('state'), /зависят: choice/);
    assert.ok(manager.has('state'));

    manager.remove('choice');
    assert.equal(manager.remove('state'), true);
});

// Автоочистка ресурсов плагина (этап 0.1.4).

test('PluginManager: функция, возвращённая из install, считается cleanup',
    (t) => {
    const { manager } = setup(t);
    let cleaned = false;

    manager.use({
        name: 'a',
        install() {
            return () => { cleaned = true; };
        }
    });

    manager.remove('a');

    assert.ok(cleaned);
});

test('PluginManager: подписки плагина на события снимаются при удалении автоматически',
    (t) => {
    const { manager, bus } = setup(t);
    const received = [];

    manager.use({
        name: 'a',
        install(api) {
            api.events.on('ping', () => received.push('a'));
            // cleanup не возвращается: движок должен отписать сам
        }
    });

    manager.remove('a');
    bus.emit('ping');

    assert.deepEqual(received, []);
});

test('PluginManager: типы узлов плагина снимаются при удалении, повторная установка возможна',
    (t) => {
    const { manager } = setup(t);
    let installs = 0;

    const p = {
        name: 'a',
        install(api) {
            installs++;
            api.game.registerNodeType('a-node', () => {});
        }
    };

    manager.use(p);
    manager.remove('a');
    manager.use(p);

    assert.equal(installs, 2);
});

test('PluginManager: слои плагина снимаются автоматически при удалении', (t) => {
    const { manager, layers } = setup(t);

    manager.use({
        name: 'a',
        install(api) {
            api.player.registerLayer('a-layer', {});
        }
    });

    assert.ok(layers.has('a-layer'));

    manager.remove('a');

    assert.ok(!layers.has('a-layer'));
});

test('PluginManager: сбой install освобождает уже занятые ресурсы и плагин не остаётся установленным', (t) => {
    const { manager, bus, nodeTypes, layers } = setup(t);
    const received = [];

    assert.throws(() => manager.use({
        name: 'broken',
        install(api) {
            api.events.on('ping', () => received.push('x'));
            api.game.registerNodeType('broken-node', () => {});
            api.player.registerLayer('broken-layer', {});

            throw new Error('сбой установки');
        }
    }), /сбой установки/);

    bus.emit('ping');

    assert.ok(!manager.has('broken'));
    assert.deepEqual(received, []);
    assert.ok(!nodeTypes.has('broken-node'));
    assert.ok(!layers.has('broken-layer'));
});

test('PluginManager: ошибка в cleanup не мешает удалению и освобождению ресурсов', (t) => {
    const { manager, nodeTypes } = setup(t);

    manager.use({
        name: 'a',
        install(api) {
            api.game.registerNodeType('a-node', () => {});

            return { cleanup() { throw new Error('сбой cleanup'); } };
        }
    });

    assert.equal(manager.remove('a'), true);
    assert.ok(!manager.has('a'));
    assert.ok(!nodeTypes.has('a-node'));
});

test('PluginManager: у каждого плагина свой api, но общий api.plugins', (t) => {
    const { manager } = setup(t);
    const apis = [];

    manager.use({ name: 'a', install(api) { apis.push(api); } });
    manager.use({ name: 'b', install(api) { apis.push(api); } });

    assert.notEqual(apis[0], apis[1]);
    assert.equal(apis[0].plugin.name, 'a');
    assert.equal(apis[1].plugin.name, 'b');
});

test('PluginManager: apiVersion проверяется, отсутствие версии допустимо', (t) => {
    const { manager } = setup(t);

    manager.use(plugin('a'));
    manager.use(plugin('b', { apiVersion: PLUGIN_API_VERSION }));

    assert.throws(
        () => manager.use(plugin('c', { apiVersion: 999 })),
        /Plugin API v999/
    );
    assert.ok(!manager.has('c'));
});

test('PluginManager: api.log пишет с именем плагина', (t) => {
    const { manager } = setup(t);
    const lines = [];

    t.mock.method(console, 'warn', (...args) => lines.push(args));

    manager.use({
        name: 'p',
        install(api) {
            api.log.warn('привет');
        }
    });

    assert.deepEqual(lines.at(-1), ['[p]', 'привет']);
});
