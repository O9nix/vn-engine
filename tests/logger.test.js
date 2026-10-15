import test from 'node:test';
import assert from 'node:assert/strict';

import { Logger, LOG_LEVELS, logger } from '../logger.js';
import { PluginManager } from '../plugin-manager.js';
import { EventBus } from '../events.js';

function spy(t) {
    const calls = [];

    for (const method of ['log', 'warn', 'error']) {
        t.mock.method(console, method, (...args) => calls.push([method, ...args]));
    }

    return calls;
}

test('Logger: по умолчанию уровень info, debug скрыт', (t) => {
    const calls = spy(t);
    const log = new Logger();

    log.debug('скрыто');
    log.info('видно');

    assert.deepEqual(calls, [['log', 'видно']]);
});

test('Logger: префикс выводится как [префикс] и методы идут в свои каналы console', (t) => {
    const calls = spy(t);
    const log = new Logger({ prefix: 'VN' });

    log.info('a');
    log.warn('b');
    log.error('c', 1);

    assert.deepEqual(calls, [
        ['log', '[VN]', 'a'],
        ['warn', '[VN]', 'b'],
        ['error', '[VN]', 'c', 1]
    ]);
});

test('Logger: уровень фильтрует сообщения, silent отключает всё', (t) => {
    const calls = spy(t);
    const log = new Logger({ level: 'warn' });

    log.info('нет');
    log.warn('да');
    log.error('да');

    assert.equal(calls.length, 2);

    log.setLevel('silent');
    log.error('нет');

    assert.equal(calls.length, 2);

    log.setLevel('debug');
    log.debug('да');

    assert.equal(calls.length, 3);
});

test('Logger: дочерний журнал делит уровень с исходным', (t) => {
    const calls = spy(t);
    const root = new Logger();
    const child = root.child('Player');

    root.setLevel('error');
    child.warn('нет');

    assert.equal(calls.length, 0);

    root.setLevel('debug');
    child.debug('да');

    assert.deepEqual(calls, [['log', '[Player]', 'да']]);
    assert.equal(child.getLevel(), 'debug');
});

test('Logger: неизвестный уровень отклоняется', () => {
    assert.throws(() => new Logger({ level: 'шум' }), /неизвестный уровень/);
    assert.throws(() => new Logger().setLevel('шум'), /неизвестный уровень/);
    assert.ok(LOG_LEVELS.debug < LOG_LEVELS.info);
});

test('api.log плагина использует общий уровень движка и префикс плагина', (t) => {
    const calls = spy(t);
    const game = { registerNodeType() {}, unregisterNodeType() {} };
    const player = { getPluginLayer: () => ({}), registerLayer: () => () => {} };
    const manager = new PluginManager(new EventBus(), game, player, {});

    t.after(() => logger.setLevel('info'));

    manager.use({
        name: 'p',
        install(api) {
            api.log.debug('скрыто');
            logger.setLevel('debug');
            api.log.debug('видно');
        }
    });

    const own = calls.filter(c => c[1] === '[p]');

    assert.deepEqual(own, [['log', '[p]', 'видно']]);
});
