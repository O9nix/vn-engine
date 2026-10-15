import test from 'node:test';
import assert from 'node:assert/strict';

import { ProjectValidator } from '../project-validator.js';
import { Project } from '../project.js';
import { EventBus } from '../events.js';
import { PluginManager } from '../plugin-manager.js';
import { AST } from '../AST.js';

function quiet(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'error', () => {});
}

const project = (nodes, extra = {}) =>
    new Project({ scenes: [{ id: 's', nodes }], ...extra });

const manifest = (name, nodeTypes = [], dependencies = []) =>
    ({ name, nodeTypes, dependencies });

// ───────────────────────── встроенные проверки ─────────────────────────

test('validate: корректный проект проходит, результат содержит поля valid/errors/warnings/checksRun', async () => {
    const v = new ProjectValidator();
    const r = await v.validate(project([
        { id: 'a', type: 'say', goto: 'b' },
        { id: 'b', type: 'say' }
    ]));

    assert.equal(r.valid, true);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.checksRun, 4);
});

test('validate: goto на несуществующий узел — ошибка с кодом, путём и плагином core', async () => {
    const r = await new ProjectValidator().validate(project([
        { id: 'a', type: 'say', goto: 'нет' }
    ]));

    assert.equal(r.valid, false);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].code, 'goto.missing-target');
    assert.equal(r.errors[0].severity, 'error');
    assert.equal(r.errors[0].plugin, 'core');
    assert.equal(r.errors[0].path, 'scenes[0].nodes[0].goto');
    assert.match(r.errors[0].message, /"нет"/);
});

test('validate: дубли id узлов — ошибка на втором узле', async () => {
    const r = await new ProjectValidator().validate(project([
        { id: 'a', type: 'say' },
        { id: 'a', type: 'say' },
        { type: 'say' }
    ]));

    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].code, 'node.duplicate-id');
    assert.equal(r.errors[0].path, 'scenes[0].nodes[1]');
    assert.match(r.errors[0].message, /scenes\[0\]\.nodes\[0\]/);
});

test('validate: типы узлов проверяются по плагинам, без списка плагинов проверка пропускается', async () => {
    const p = project([
        { id: 'a', type: 'say' },
        { id: 'b', type: 'nobody' },
        { id: 'c' }
    ]);
    const v = new ProjectValidator();

    const without = await v.validate(p);

    assert.equal(without.valid, true);

    const withPlugins = await v.validate(p, { plugins: [manifest('say-plugin', ['say'])] });
    const codes = withPlugins.errors.map(e => e.code).sort();

    assert.deepEqual(codes, ['node.no-type', 'node.unknown-type']);
});

test('validate: зависимость установленного плагина, не объявленная в проекте, — ошибка', async () => {
    const p = project([{ id: 'a', type: 'x' }], { plugins: ['choice'] });
    const r = await new ProjectValidator().validate(p, {
        plugins: [manifest('choice', ['x'], ['state'])]
    });

    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].code, 'plugin.undeclared-dependency');
    assert.match(r.errors[0].message, /"choice" требует "state"/);

    const declared = project([{ id: 'a', type: 'x' }], {
        plugins: ['choice', { name: 'state' }]
    });

    assert.equal((await new ProjectValidator().validate(declared, {
        plugins: [manifest('choice', ['x'], ['state'])]
    })).valid, true);
});

test('validate: без проекта бросает TypeError', async () => {
    await assert.rejects(new ProjectValidator().validate(null), TypeError);
});

// ───────────────────────── реестр проверок ─────────────────────────

test('register: проверяет форму, не допускает повтор id, возвращает функцию снятия', () => {
    const v = new ProjectValidator();

    assert.throws(() => v.register(null), TypeError);
    assert.throws(() => v.register({ id: 'x' }), TypeError);
    assert.throws(() => v.register({ run() {} }), TypeError);

    const off = v.register({ id: 'x', run: () => [] });

    assert.throws(() => v.register({ id: 'x', run: () => [] }), /уже зарегистрирована/);
    assert.ok(v.list().some(c => c.id === 'x'));

    off();

    assert.ok(!v.list().some(c => c.id === 'x'));
    assert.equal(v.unregister('x'), false);
});

test('unregisterPlugin снимает все проверки плагина', () => {
    const v = new ProjectValidator();

    v.register({ id: 'a:1', plugin: 'a', run: () => [] });
    v.register({ id: 'a:2', plugin: 'a', run: () => [] });
    v.register({ id: 'b:1', plugin: 'b', run: () => [] });

    assert.equal(v.unregisterPlugin('a'), 2);
    assert.equal(v.unregisterPlugin('a'), 0);
    assert.ok(v.list().some(c => c.id === 'b:1'));
});

test('запись проверки нормализуется: строка, умолчания code/plugin/severity/path', async () => {
    const v = new ProjectValidator();

    v.register({ id: 'p:one', plugin: 'p', run: () => ['просто текст'] });
    v.register({
        id: 'p:two', plugin: 'p', severity: 'warning',
        run: () => [{ message: 'м' }, { message: 'ошибка', severity: 'error', code: 'p.err', path: 'x' }]
    });

    const r = await v.validate(project([]));

    const one = r.errors.find(e => e.message === 'просто текст');

    assert.deepEqual(
        { code: one.code, plugin: one.plugin, severity: one.severity, path: one.path },
        { code: 'p:one', plugin: 'p', severity: 'error', path: '' }
    );

    assert.equal(r.warnings.length, 1);
    assert.equal(r.warnings[0].code, 'p:two');
    assert.equal(r.errors.find(e => e.code === 'p.err').path, 'x');
});

test('предупреждения не делают проект невалидным, ошибки делают', async () => {
    const v = new ProjectValidator();

    v.register({ id: 'w', severity: 'warning', run: () => [{ message: 'осторожно' }] });

    const r1 = await v.validate(project([]));

    assert.equal(r1.valid, true);
    assert.equal(r1.warnings.length, 1);

    v.register({ id: 'e', run: () => [{ message: 'плохо' }] });

    assert.equal((await v.validate(project([]))).valid, false);
});

test('асинхронная проверка работает', async () => {
    const v = new ProjectValidator();

    v.register({
        id: 'a', run: async () => {
            await new Promise(r => setTimeout(r, 5));

            return [{ message: 'позже' }];
        }
    });

    assert.equal((await v.validate(project([]))).errors[0].message, 'позже');
});

test('упавшая проверка не ломает остальные: запись check.crashed с severity warning', async (t) => {
    quiet(t);
    const v = new ProjectValidator();

    v.register({ id: 'bad', plugin: 'p', run: () => { throw new Error('сбой'); } });
    v.register({ id: 'good', run: () => [{ message: 'нашла' }] });

    const r = await v.validate(project([]));

    assert.equal(r.valid, false);
    assert.ok(r.errors.some(e => e.message === 'нашла'));

    const crashed = r.warnings.find(w => w.code === 'check.crashed');

    assert.match(crashed.message, /"bad".*сбой/);
    assert.equal(crashed.plugin, 'p');
});

test('проверка, не уложившаяся во время, даёт check.timeout и не подвешивает validate', async (t) => {
    quiet(t);
    const v = new ProjectValidator();

    v.register({ id: 'slow', run: () => new Promise(() => {}) });
    v.register({ id: 'own-limit', timeout: 10, run: () => new Promise(() => {}) });

    const started = Date.now();
    const r = await v.validate(project([]), {}, { timeout: 30 });

    assert.ok(Date.now() - started < 1000);
    assert.deepEqual(
        r.warnings.filter(w => w.code === 'check.timeout').map(w => w.message.includes('slow') || w.message.includes('own-limit')),
        [true, true]
    );
    assert.equal(r.valid, true);
});

// ───────────────────────── правила узлов ─────────────────────────

test('registerNodeRule вызывается только для узлов своего типа, путь подставляется сам', async () => {
    const v = new ProjectValidator();
    const seen = [];

    v.registerNodeRule('choice', {
        id: 'choice:options',
        plugin: 'choice',
        run(node) {
            seen.push(node.id);

            return node.options ? [] : [{ code: 'choice.no-options', message: 'нет options' }];
        }
    });

    const r = await v.validate(project([
        { id: 'a', type: 'say' },
        { id: 'b', type: 'choice' },
        { id: 'c', type: 'choice', options: [] }
    ]));

    assert.deepEqual(seen, ['b', 'c']);
    assert.equal(r.errors.length, 1);
    assert.equal(r.errors[0].path, 'scenes[0].nodes[1]');
    assert.equal(r.errors[0].plugin, 'choice');

    assert.throws(() => v.registerNodeRule('', { id: 'x', run() {} }), TypeError);
});

// ───────────────────────── события и совместимость ─────────────────────────

test('validate шлёт validator:done, а при ошибках ещё и validator:errors', async () => {
    const bus = new EventBus();
    const done = [];
    const errors = [];

    bus.on('validator:done', r => done.push(r));
    bus.on('validator:errors', e => errors.push(e));

    const v = new ProjectValidator(bus);

    await v.validate(project([{ id: 'a', type: 'x' }]));

    assert.equal(done.length, 1);
    assert.equal(errors.length, 0);

    const r = await v.validate(project([{ id: 'a', type: 'x', goto: 'нет' }]));

    assert.equal(done.length, 2);
    assert.equal(done[1], r);
    assert.equal(errors.length, 1);
    assert.equal(errors[0].errors.length, 1);
});

test('validateGotos (старый API): форма результата и событие validator:errors сохранены', () => {
    const bus = new EventBus();
    const events = [];

    bus.on('validator:errors', e => events.push(e));

    const p = project([{ id: 'a', type: 'x', goto: 'нет' }]);
    const data = new ProjectValidator(p, bus).validateGotos();

    assert.equal(data.valid, false);
    assert.equal(data.hasGoto, true);
    assert.equal(data.gotoCount, 1);
    assert.equal(data.nodeCount, 1);
    assert.equal(data.errors[0].target, 'нет');
    assert.equal(events.length, 1);

    const ok = new ProjectValidator(project([{ id: 'a', type: 'x' }]), bus).validateGotos();

    assert.equal(ok.valid, true);
    assert.equal(events.length, 1);

    assert.throws(() => new ProjectValidator(bus).validateGotos(), /не передан/);
});

// ───────────────────────── api.validation в PluginManager ─────────────────────────

function managerWith(validator) {
    const game = { registerNodeType() {}, unregisterNodeType() {} };
    const player = { getPluginLayer: () => ({}), registerLayer: () => () => {} };

    return new PluginManager(new EventBus(), game, player, {}, new AST(), validator);
}

test('api.validation: проверка плагина получает его имя и префикс id, снимается при удалении', async (t) => {
    quiet(t);
    const v = new ProjectValidator();
    const m = managerWith(v);

    m.use({
        name: 'inventory',
        install(api) {
            api.validation.register({ id: 'items', run: () => [{ message: 'нет предметов' }] });
            api.validation.registerNodeRule('take', { id: 'take', run: () => [] });
        }
    });

    assert.ok(v.list().some(c => c.id === 'inventory:items' && c.plugin === 'inventory'));
    assert.ok(v.list().some(c => c.id === 'inventory:take' && c.kind === 'node'));

    const r = await v.validate(project([]));

    assert.equal(r.errors[0].plugin, 'inventory');
    assert.equal(r.errors[0].code, 'inventory:items');

    m.remove('inventory');

    assert.ok(!v.list().some(c => c.plugin === 'inventory'));
    assert.equal((await v.validate(project([]))).valid, true);
});

test('api.validation: сбой install снимает уже добавленные проверки', (t) => {
    quiet(t);
    const v = new ProjectValidator();
    const m = managerWith(v);

    assert.throws(() => m.use({
        name: 'p',
        install(api) {
            api.validation.register({ id: 'x', run: () => [] });

            throw new Error('сбой');
        }
    }), /сбой/);

    assert.ok(!v.list().some(c => c.plugin === 'p'));
});

test('api.validation: без валидатора понятная ошибка, плагин не устанавливается', (t) => {
    quiet(t);
    const m = managerWith(undefined);

    assert.throws(() => m.use({
        name: 'p',
        install(api) {
            api.validation.register({ id: 'x', run: () => [] });
        }
    }), /без валидатора/);
    assert.ok(!m.has('p'));
});

test('getManifests объединяет nodeTypes манифеста и реально зарегистрированные типы', (t) => {
    quiet(t);
    const m = managerWith(new ProjectValidator());

    m.use({ name: 'a', version: '1', nodeTypes: ['declared'], install(api) {
        api.game.registerNodeType('actual', () => {});
    } });
    m.use({ name: 'b', dependencies: ['a'], install() {} });

    assert.deepEqual(m.getManifests(), [
        { name: 'a', version: '1', dependencies: [], nodeTypes: ['declared', 'actual'] },
        { name: 'b', version: undefined, dependencies: ['a'], nodeTypes: [] }
    ]);
});

// ───────────────────────── реальные плагины ─────────────────────────

test('реальные плагины: валидатор видит типы установленных плагинов и находит неизвестный тип', async (t) => {
    quiet(t);
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const { loadProjectPlugins } = await import('../plugin-loader.js');
    const { PluginRegistry } = await import('../plugin-registry.js');

    const names = ['state', 'conditions', 'dialogue', 'narration', 'choice', 'wait'];
    const v = new ProjectValidator();
    const m = managerWith(v);
    const p = project([
        { id: 'a', type: 'dialogue', text: 'x' },
        { id: 'b', type: 'narration', text: 'x' },
        { id: 'c', type: 'teleport' }
    ], { plugins: names });

    const report = await loadProjectPlugins(
        p, new PluginRegistry({ loader: localPluginLoader }), m
    ).catch(error => ({ failed: [error] }));

    // DOM-плагины не устанавливаются без браузера; важно, что валидатор работает с тем, что поставилось.
    const r = await v.validate(p, { plugins: m.getManifests() });

    assert.ok(Array.isArray(report.failed));
    assert.ok(r.errors.every(e => e.severity === 'error'));
    assert.ok(r.errors.some(e => e.code === 'node.unknown-type' && /teleport/.test(e.message)));
});

test('choice: правила находят узел без options и вариант без variants', async (t) => {
    quiet(t);
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const v = new ProjectValidator();
    const m = managerWith(v);

    for (const name of ['state', 'conditions', 'choice']) {
        m.use(await localPluginLoader(name));
    }

    const r = await v.validate(project([
        { id: 'a', type: 'choice', text: 'Пусто' },
        { id: 'b', type: 'choice', options: [{ id: 'o1', variants: [] }] },
        { id: 'c', type: 'choice', options: [{ id: 'o2', variants: [{ text: 'ок' }] }] }
    ], { plugins: ['state', 'conditions', 'choice'] }), { plugins: m.getManifests() });

    assert.ok(r.errors.some(e => /нет вариантов/.test(e.message) && e.path === 'scenes[0].nodes[0]'));
    assert.ok(r.errors.some(e => /нет variants/.test(e.message) && e.path === 'scenes[0].nodes[1]'));
    assert.equal(r.errors.length, 2);
    assert.ok(r.errors.every(e => e.plugin === 'choice'));
    assert.deepEqual(
        r.errors.map(e => e.code),
        ['choice.no-options', 'choice.no-variants']
    );
});

test('choice: переменная условия берётся из config.state и даёт только предупреждение', async (t) => {
    quiet(t);
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const v = new ProjectValidator();
    const m = managerWith(v);

    for (const name of ['state', 'conditions', 'choice']) {
        m.use(await localPluginLoader(name));
    }

    const nodes = [{
        id: 'a',
        type: 'choice',
        options: [
            { id: 'o1', variants: [{ text: 'x', condition: { variable: 'health', operator: '>', value: 1 } }] },
            { id: 'o2', variants: [{ text: 'y', condition: { variable: 'gold', operator: '>', value: 1 } }] }
        ]
    }];

    const r = await v.validate(
        project(nodes, {
            plugins: ['state', 'conditions', 'choice'],
            config: { state: { health: 3 } }
        }),
        { plugins: m.getManifests() }
    );

    assert.equal(r.valid, true);
    assert.equal(r.warnings.length, 1);
    assert.match(r.warnings[0].message, /gold/);
    assert.equal(r.warnings[0].severity, 'warning');
});
