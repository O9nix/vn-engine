import test from 'node:test';
import assert from 'node:assert/strict';

import { VN } from '../core.js';
import { Project } from '../project.js';
import { EventBus } from '../events.js';

// Ядро пишет в консоль; в тестах это шум.
function quiet(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
}

function setup(t, nodes) {
    quiet(t);

    const vn = new VN();
    const bus = vn.getBus();
    const events = [];

    for (const name of ['story:loaded', 'node:start', 'story:end']) {
        bus.on(name, payload => events.push(
            payload?.id ? `${name}:${payload.id}` : name
        ));
    }

    const log = [];

    // «say» — обычный узел без ожидания.
    vn.registerNodeType('say', node => log.push(node.id));

    const project = new Project({ scenes: [{ id: 's', nodes }] });

    return { vn, bus, events, log, project };
}

const say = id => ({ id, type: 'say' });

// ───────────────────────── VN ─────────────────────────

test('VN: узлы выполняются по порядку, история завершается', (t) => {
    const { vn, project, log, events } = setup(t, [say('a'), say('b'), say('c')]);

    vn.loadProject(project);

    assert.deepEqual(log, ['a', 'b', 'c']);
    assert.deepEqual(events, [
        'story:loaded', 'node:start:a', 'node:start:b', 'node:start:c', 'story:end'
    ]);
});

test('VN: story:loaded приходит до первого узла и содержит проект', (t) => {
    const { vn, bus, project } = setup(t, [say('a')]);
    let received;

    bus.on('story:loaded', payload => { received = payload; });
    vn.loadProject(project);

    assert.equal(received.project, project);
});

test('VN: wait() останавливает историю, resume() продолжает', (t) => {
    const { vn, project, log, events } = setup(t, [
        { id: 'ask', type: 'ask' }, say('after')
    ]);
    let context;

    vn.registerNodeType('ask', (node, ctx) => {
        ctx.wait();
        context = ctx;
    });

    vn.loadProject(project);

    assert.deepEqual(log, []);
    assert.ok(!events.includes('story:end'));

    context.resume();

    assert.deepEqual(log, ['after']);
    assert.ok(events.includes('story:end'));
});

test('VN: click-game продолжает историю, пока она ждёт', (t) => {
    const { vn, bus, project, log } = setup(t, [
        { id: 'ask', type: 'ask' }, say('after')
    ]);

    vn.registerNodeType('ask', (node, ctx) => ctx.wait());
    vn.loadProject(project);

    assert.deepEqual(log, []);

    bus.emit('click-game');

    assert.deepEqual(log, ['after']);
});

test('VN: click-game без ожидания ничего не меняет', (t) => {
    const { vn, bus, project, log, events } = setup(t, [say('a')]);

    vn.loadProject(project);
    const before = [...events];

    bus.emit('click-game');

    assert.deepEqual(log, ['a']);
    assert.deepEqual(events, before);
});

test('VN: goto переходит к указанному узлу и пропускает промежуточные', (t) => {
    const { vn, project, log } = setup(t, [
        { id: 'jump', type: 'jump', to: 'c' }, say('b'), say('c')
    ]);

    vn.registerNodeType('jump', (node, ctx) => {
        ctx.goto(node.to);
        ctx.wait();
    });

    vn.loadProject(project);

    assert.deepEqual(log, ['c']);
});

test('VN: end: true завершает историю на этом узле', (t) => {
    const { vn, project, log, events } = setup(t, [
        { id: 'a', type: 'say', end: true }, say('b')
    ]);

    vn.loadProject(project);

    assert.deepEqual(log, ['a']);
    assert.ok(events.includes('story:end'));
});

test('VN: узел неизвестного типа пропускается', (t) => {
    const { vn, project, log } = setup(t, [
        { id: 'x', type: 'nobody-handles-this' }, say('a')
    ]);

    vn.loadProject(project);

    assert.deepEqual(log, ['a']);
});

test('VN: проект без узлов не запускает историю и не падает', (t) => {
    const { vn, project, events } = setup(t, []);

    vn.loadProject(project);

    assert.deepEqual(events, ['story:loaded']);
});

test('VN: registerNodeType отклоняет повтор и не-функцию', (t) => {
    quiet(t);
    const vn = new VN();

    vn.registerNodeType('x', () => {});

    assert.throws(() => vn.registerNodeType('x', () => {}), /уже зарегистрирован/);
    assert.throws(() => vn.registerNodeType('y', 'не функция'), TypeError);
});

// Желаемое поведение этапа 0.1.4: пока не реализовано (todo).

test('VN: исключение в обработчике узла останавливает историю и даёт story:error', (t) => {
    t.mock.method(console, 'error', () => {});
    const { vn, bus, project, log, events } = setup(t, [
        { id: 'boom', type: 'boom' }, say('after')
    ]);
    const errors = [];

    vn.registerNodeType('boom', () => { throw new Error('сбой'); });
    bus.on('story:error', e => errors.push(e));

    vn.loadProject(project);

    assert.equal(errors.length, 1);
    assert.equal(errors[0].node.id, 'boom');
    assert.equal(errors[0].message, 'сбой');
    assert.deepEqual(log, []);
    assert.ok(!events.includes('story:end'));

    // Клик после ошибки ничего не продолжает.
    bus.emit('click-game');

    assert.deepEqual(log, []);
});

test('VN: после story:error новая загрузка проекта снова работает', (t) => {
    t.mock.method(console, 'error', () => {});
    const { vn, project, log } = setup(t, [{ id: 'boom', type: 'boom' }]);

    vn.registerNodeType('boom', () => { throw new Error('сбой'); });
    vn.loadProject(project);

    const second = new Project({ scenes: [{ id: 's', nodes: [say('ok')] }] });

    vn.loadProject(second);

    assert.deepEqual(log, ['ok']);
});

test('VN: ошибка в узле после goto тоже останавливает историю', (t) => {
    t.mock.method(console, 'error', () => {});
    const { vn, bus, project, log } = setup(t, [
        { id: 'jump', type: 'jump', to: 'boom' },
        { id: 'boom', type: 'boom' },
        say('after')
    ]);
    let errors = 0;

    vn.registerNodeType('jump', (node, ctx) => { ctx.goto(node.to); ctx.wait(); });
    vn.registerNodeType('boom', () => { throw new Error('сбой'); });
    bus.on('story:error', () => errors++);

    vn.loadProject(project);

    assert.equal(errors, 1);
    assert.deepEqual(log, []);
});

test('VN: тип узла можно снять (unregisterNodeType) и зарегистрировать заново', (t) => {
    quiet(t);
    const vn = new VN();

    vn.registerNodeType('x', () => {});

    assert.equal(vn.unregisterNodeType('x'), true);
    assert.equal(vn.unregisterNodeType('x'), false);

    vn.registerNodeType('x', () => {});
});

test('VN: клик не пропускает узел, который ждёт с lock, а resume продолжает', (t) => {
    const { vn, bus, project, log } = setup(t, [
        { id: 'ask', type: 'ask' }, say('after')
    ]);
    let context;

    vn.registerNodeType('ask', (node, ctx) => { context = ctx; ctx.wait({ lock: true }); });
    vn.loadProject(project);

    bus.emit('click-game');

    assert.deepEqual(log, []);

    context.resume();

    assert.deepEqual(log, ['after']);
});

// ───────────────────────── Project ─────────────────────────

test('Project: значения по умолчанию', () => {
    const project = new Project();

    assert.deepEqual(project.getScenes(), []);
    assert.deepEqual(project.getConfig(), {});
    assert.deepEqual(project.getAssets(), {});
    assert.deepEqual(project.getMetadata(), {});
    assert.deepEqual(project.getPlugins(), []);
});

test('Project: getNode ищет узел во всех сценах', () => {
    const project = new Project({
        scenes: [
            { id: 's1', nodes: [{ id: 'a' }] },
            { id: 's2', nodes: [{ id: 'b' }] }
        ]
    });

    assert.equal(project.getNode('b').id, 'b');
    assert.equal(project.getNode('нет'), null);
});

test('Project: getNextNode идёт по порядку внутри сцены и не выходит за её конец', () => {
    const project = new Project({
        scenes: [
            { id: 's1', nodes: [{ id: 'a' }, { id: 'b' }] },
            { id: 's2', nodes: [{ id: 'c' }] }
        ]
    });

    assert.equal(project.getNextNode('a').id, 'b');
    assert.equal(project.getNextNode('b'), null);
    assert.equal(project.getNextNode('нет'), null);
});

test('Project: getScene и getSceneForNode', () => {
    const project = new Project({
        scenes: [{ id: 's1', nodes: [{ id: 'a' }] }]
    });

    assert.equal(project.getScene('s1').id, 's1');
    assert.equal(project.getScene('нет'), null);
    assert.equal(project.getSceneForNode('a').id, 's1');
    assert.equal(project.getSceneForNode('нет'), null);
});

// ───────────────────────── EventBus ─────────────────────────

test('EventBus: подписчики вызываются в порядке подписки', () => {
    const bus = new EventBus();
    const calls = [];

    bus.on('x', () => calls.push(1));
    bus.on('x', () => calls.push(2));
    bus.emit('x');

    assert.deepEqual(calls, [1, 2]);
});

test('EventBus: on возвращает функцию отписки, off снимает подписчика', () => {
    const bus = new EventBus();
    const calls = [];
    const handler = () => calls.push('h');

    const unsubscribe = bus.on('x', handler);
    bus.emit('x');
    unsubscribe();
    bus.emit('x');

    const other = () => calls.push('o');
    bus.on('x', other);
    bus.off('x', other);
    bus.emit('x');

    assert.deepEqual(calls, ['h']);
});

test('EventBus: payload доходит до подписчика, emit без подписчиков безопасен', () => {
    const bus = new EventBus();
    let received;

    bus.emit('nobody');
    bus.on('x', p => { received = p; });
    bus.emit('x', { a: 1 });

    assert.deepEqual(received, { a: 1 });
});

test('EventBus: ошибка одного подписчика не мешает остальным и даёт handler:error', (t) => {
    t.mock.method(console, 'error', () => {});
    const bus = new EventBus();
    const calls = [];
    const reported = [];

    bus.on('handler:error', e => reported.push(e));
    bus.on('x', () => { throw new Error('сбой'); });
    bus.on('x', () => calls.push('второй'));
    bus.emit('x');

    assert.deepEqual(calls, ['второй']);
    assert.equal(reported.length, 1);
    assert.equal(reported[0].event, 'x');
});

test('EventBus: сбой в handler:error не зацикливает шину', (t) => {
    t.mock.method(console, 'error', () => {});
    const bus = new EventBus();

    bus.on('handler:error', () => { throw new Error('снова'); });
    bus.on('x', () => { throw new Error('сбой'); });

    bus.emit('x');
});

test('EventBus: подписчик может отписаться во время emit', () => {
    const bus = new EventBus();
    const calls = [];
    const off = bus.on('x', () => { calls.push(1); off(); });

    bus.on('x', () => calls.push(2));
    bus.emit('x');
    bus.emit('x');

    assert.deepEqual(calls, [1, 2, 2]);
});
