import test from 'node:test';
import assert from 'node:assert/strict';

import { VN } from '../core.js';
import { Project } from '../project.js';
import { ProjectValidator } from '../project-validator.js';
import { PluginManager } from '../plugin-manager.js';
import { AST } from '../AST.js';

function quiet(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'error', () => {});
}

const say = id => ({ id, type: 'say' });

// ───────────────────────── ядро: сцены ─────────────────────────

function twoScenes(t) {
    quiet(t);

    const vn = new VN();
    const log = [];
    const events = [];

    vn.registerNodeType('say', node => log.push(node.id));

    for (const name of ['scene:start', 'scene:end', 'story:end']) {
        vn.getBus().on(name, p => events.push(p?.sceneId ? `${name}:${p.sceneId}` : name));
    }

    const project = new Project({
        scenes: [
            { id: 's1', nodes: [say('a'), say('b')] },
            { id: 's2', nodes: [say('c')] }
        ]
    });

    return { vn, log, events, project };
}

test('сцены: история продолжается в следующей сцене, события идут по порядку', (t) => {
    const { vn, log, events, project } = twoScenes(t);

    vn.loadProject(project);

    assert.deepEqual(log, ['a', 'b', 'c']);
    assert.deepEqual(events, [
        'scene:start:s1', 'scene:end:s1', 'scene:start:s2', 'scene:end:s2', 'story:end'
    ]);
});

test('сцены: goto по id сцены ведёт на её первый узел', (t) => {
    quiet(t);
    const vn = new VN();
    const log = [];

    vn.registerNodeType('say', node => log.push(node.id));
    vn.registerNodeType('jump', (node, ctx) => ctx.goto(node.goto));

    vn.loadProject(new Project({
        scenes: [
            { id: 's1', nodes: [say('a'), { id: 'j', type: 'jump', goto: 's2' }, say('skipped')] },
            { id: 's2', nodes: [say('c'), say('d')] }
        ]
    }));

    // «skipped» пропущен, после перехода нет повторного шага от узла j.
    assert.deepEqual(log, ['a', 'c', 'd']);
});

test('сцены: переход goto внутри обработчика не двигает историю дважды', (t) => {
    quiet(t);
    const vn = new VN();
    const log = [];

    vn.registerNodeType('say', node => log.push(node.id));
    vn.registerNodeType('jump', (node, ctx) => ctx.goto(node.goto));

    vn.loadProject(new Project({
        scenes: [{ id: 's', nodes: [
            { id: 'j', type: 'jump', goto: 'z' }, say('x'), say('y'), say('z')
        ] }]
    }));

    assert.deepEqual(log, ['z']);
});

// ───────────────────────── ядро: снимки ─────────────────────────

function waiting(t) {
    quiet(t);

    const vn = new VN();
    const log = [];

    vn.registerNodeType('say', node => log.push(node.id));
    vn.registerNodeType('ask', (node, ctx) => { log.push(`ask:${node.id}`); ctx.wait(); });

    const project = new Project({
        scenes: [{ id: 's', nodes: [say('a'), { id: 'q', type: 'ask' }, say('b'), say('c')] }]
    });

    return { vn, log, project };
}

test('снимок: сохраняет позицию и данные источников, restore возвращает их', (t) => {
    const { vn, log, project } = waiting(t);
    let gold = 5;

    vn.registerSnapshotProvider('purse', {
        save: () => ({ gold }),
        load: (data) => { gold = data.gold; }
    });

    vn.loadProject(project);

    const saved = vn.snapshot();

    assert.equal(saved.nodeId, 'q');
    assert.deepEqual(saved.data, { purse: { gold: 5 } });

    gold = 99;
    vn.getBus().emit('click-game');       // идём дальше: b, c, конец

    assert.deepEqual(log, ['a', 'ask:q', 'b', 'c']);

    vn.restore(saved);

    assert.equal(gold, 5);
    assert.equal(log.at(-1), 'ask:q');    // узел запущен заново и ждёт
});

test('снимок: изменение результата не влияет на игру (копия)', (t) => {
    const { vn, project } = waiting(t);
    const inner = { gold: 1 };

    vn.registerSnapshotProvider('purse', { save: () => inner, load: () => {} });
    vn.loadProject(project);

    const saved = vn.snapshot();

    saved.data.purse.gold = 100;

    assert.equal(inner.gold, 1);
});

test('restore: неверный снимок или неизвестный узел не меняют игру', (t) => {
    const { vn, log, project } = waiting(t);

    vn.loadProject(project);

    const before = log.length;

    assert.throws(() => vn.restore({}), /неверный формат/);
    assert.throws(() => vn.restore({ version: 1, nodeId: 'нет', data: {} }), /нет в проекте/);
    assert.equal(log.length, before);
});

test('restore: шлёт story:restoring до загрузки данных, story:restored после', (t) => {
    const { vn, project } = waiting(t);
    const order = [];

    vn.registerSnapshotProvider('p', { save: () => 1, load: () => order.push('load') });
    vn.getBus().on('story:restoring', () => order.push('restoring'));
    vn.getBus().on('story:restored', () => order.push('restored'));
    vn.loadProject(project);

    vn.restore(vn.snapshot());

    assert.deepEqual(order, ['restoring', 'load', 'restored']);
});

test('restore: после ошибки узла восстановление снимает остановку', (t) => {
    quiet(t);
    const vn = new VN();
    let broken = true;

    vn.registerNodeType('say', () => {});
    vn.registerNodeType('risky', () => { if (broken) throw new Error('сбой'); });

    vn.loadProject(new Project({
        scenes: [{ id: 's', nodes: [say('a'), { id: 'r', type: 'risky' }, say('b')] }]
    }));

    const failed = [];

    vn.getBus().on('story:end', () => failed.push('end'));

    broken = false;
    vn.restore({ version: 1, nodeId: 'r', data: {} });

    assert.deepEqual(failed, ['end']);
});

test('источники снимка: дубль имени и неполный источник — ошибки', (t) => {
    quiet(t);
    const vn = new VN();
    const off = vn.registerSnapshotProvider('p', { save() {}, load() {} });

    assert.throws(() => vn.registerSnapshotProvider('p', { save() {}, load() {} }), /уже зарегистрирован/);
    assert.throws(() => vn.registerSnapshotProvider('q', { save() {} }), /save и load/);

    off();

    assert.doesNotThrow(() => vn.registerSnapshotProvider('p', { save() {}, load() {} }));
    assert.throws(() => new VN().snapshot(), /не загружен/);
});

// ───────────────────────── плагины: state, jump, conditions ─────────────────────────

async function engine(t, names, projectData) {
    quiet(t);
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const vn = new VN();
    const validator = new ProjectValidator(vn.getBus());
    const player = { getPluginLayer: () => ({}), registerLayer: () => () => {} };
    const plugins = new PluginManager(vn.getBus(), vn, player, {}, new AST(), validator);

    // Тип «say» объявляет служебный плагин, чтобы валидатор знал о нём.
    plugins.use({
        name: 'testing',
        nodeTypes: ['say'],
        install(api) { api.game.registerNodeType('say', () => {}); }
    });

    for (const name of names) {
        plugins.use(await localPluginLoader(name));
    }

    const project = new Project({ plugins: names, ...projectData });

    return { vn, plugins, validator, project };
}

// api плагина state: через менеджер, как это делает другой плагин
function stateApi(plugins) {
    let found;

    plugins.use({
        name: `probe-${Math.random().toString(36).slice(2)}`,
        install(api) { found = api.plugins.state.api; }
    });

    return found;
}

test('state: setvar, setflag и события state:changed', async (t) => {
    const { vn, project, plugins } = await engine(t, ['state'], {
        config: { state: { gold: 1 } },
        scenes: [{ id: 's', nodes: [
            { id: 'a', type: 'setvar', variable: 'gold', value: 4, op: 'add' },
            { id: 'b', type: 'setvar', variable: 'gold', value: 2, op: 'sub' },
            { id: 'c', type: 'setvar', variable: 'name', value: 'Аня' },
            { id: 'd', type: 'setflag', flag: 'met' },
            { id: 'e', type: 'setflag', flag: 'met', value: false }
        ] }]
    });

    const changes = [];

    vn.getBus().on('state:changed', c => changes.push(`${c.name}:${c.oldValue}>${c.value}`));
    vn.loadProject(project);

    assert.deepEqual(stateApi(plugins).get(), { gold: 3, name: 'Аня', met: false });
    assert.deepEqual(changes, [
        'gold:1>5', 'gold:5>3', 'name:undefined>Аня', 'met:undefined>true', 'met:true>false'
    ]);
});

test('state: событие state:changed не приходит, если значение то же', async (t) => {
    const { vn, project, plugins } = await engine(t, ['state'], { scenes: [{ id: 's', nodes: [say('a')] }] });
    const changes = [];

    vn.getBus().on('state:changed', c => changes.push(c.name));
    vn.loadProject(project);

    const state = stateApi(plugins);

    state.set('x', 1);
    state.set('x', 1);
    state.update({ x: 1, y: 2 });

    assert.deepEqual(changes, ['x', 'y']);
});

test('state: ошибка в setvar останавливает историю', async (t) => {
    const { vn, project } = await engine(t, ['state'], {
        config: { state: { name: 'Аня' } },
        scenes: [{ id: 's', nodes: [
            { id: 'a', type: 'setvar', variable: 'name', value: 1, op: 'add' },
            say('b')
        ] }]
    });
    let error;

    vn.getBus().on('story:error', e => { error = e; });
    vn.loadProject(project);

    assert.equal(error.node.id, 'a');
    assert.match(error.message, /числами/);
});

test('state: format подставляет значения и оставляет неизвестные записи', async (t) => {
    const { vn, project, plugins } = await engine(t, ['state'], {
        config: { state: { gold: 5, имя: 'Аня' } },
        scenes: [{ id: 's', nodes: [say('a')] }]
    });

    vn.loadProject(project);

    const state = stateApi(plugins);

    assert.equal(state.format('{имя}: {gold} монет, {нет} {1}'), 'Аня: 5 монет, {нет} {1}');
});

test('state: снимок возвращает переменные и шлёт state:loaded', async (t) => {
    const { vn, project, plugins } = await engine(t, ['state'], {
        config: { state: { health: 3 } },
        scenes: [{ id: 's', nodes: [{ id: 'q', type: 'wait-here' }, say('b')] }]
    });

    vn.registerNodeType('wait-here', (n, ctx) => ctx.wait());
    vn.loadProject(project);

    const state = stateApi(plugins);
    const loaded = [];

    vn.getBus().on('state:loaded', p => loaded.push(p.state));

    state.set('health', 1);

    const saved = vn.snapshot();

    state.set('health', 100);
    state.set('extra', true);
    vn.restore(saved);

    assert.deepEqual(state.get(), { health: 1 });
    assert.deepEqual(loaded, [{ health: 1 }]);
});

test('state: story:loaded сбрасывает состояние к config.state', async (t) => {
    const { vn, project, plugins } = await engine(t, ['state'], {
        config: { state: { health: 3 } },
        scenes: [{ id: 's', nodes: [say('a')] }]
    });

    vn.loadProject(project);

    const state = stateApi(plugins);

    state.set('health', 0);
    state.set('extra', 1);
    vn.loadProject(project);

    assert.deepEqual(state.get(), { health: 3 });
});

test('jump: переходит на узел и на сцену', async (t) => {
    const { vn, project } = await engine(t, ['jump'], {
        scenes: [
            { id: 's1', nodes: [{ id: 'j', type: 'jump', goto: 's2' }, say('x')] },
            { id: 's2', nodes: [say('y')] }
        ]
    });
    const started = [];

    vn.getBus().on('node:start', n => started.push(n.id));
    vn.loadProject(project);

    assert.deepEqual(started, ['j', 'y']);
});

test('conditions: все, любое, не, флаг', async (t) => {
    const { plugins } = await engine(t, ['conditions'], {});
    let c;

    plugins.use({ name: 'probe', install(api) { c = api.plugins.conditions.api; } });

    const state = { hp: 3, met: true, gold: 0 };

    assert.equal(c.evaluate({ all: [{ flag: 'met' }, { variable: 'hp', operator: '>', value: 2 }] }, state), true);
    assert.equal(c.evaluate({ all: [{ flag: 'met' }, { variable: 'hp', operator: '>', value: 5 }] }, state), false);
    assert.equal(c.evaluate({ any: [{ variable: 'hp', operator: '>', value: 5 }, { flag: 'met' }] }, state), true);
    assert.equal(c.evaluate({ not: { flag: 'met' } }, state), false);
    assert.equal(c.evaluate({ flag: 'gold' }, state), false);
    assert.equal(c.evaluate({ flag: 'gold', value: false }, state), true);
    assert.equal(c.evaluate({ flag: 'нет', value: false }, state), true);
    assert.equal(c.evaluate(undefined, state), true);
    assert.throws(() => c.evaluate({ variable: 'hp', operator: '=>', value: 1 }, state), /оператор/);
});

test('conditions: validate находит ошибки формы, variables собирает имена', async (t) => {
    const { plugins } = await engine(t, ['conditions'], {});
    let c;

    plugins.use({ name: 'probe', install(api) { c = api.plugins.conditions.api; } });

    assert.deepEqual(c.validate(undefined), []);
    assert.deepEqual(c.validate({ variable: 'a', operator: '>', value: 1 }), []);
    assert.deepEqual(c.validate({ flag: 'f' }), []);
    assert.match(c.validate({ variable: 'a', operator: '=>', value: 1 })[0], /оператор "=>"/);
    assert.match(c.validate({ variable: 'a', operator: '>' })[0], /value/);
    assert.match(c.validate({ all: [] })[0], /непустым/);
    assert.match(c.validate({ not: 5 })[0], /условие/);
    assert.match(c.validate({ flag: 'f', variable: 'a' })[0], /смешаны/);
    assert.match(c.validate({})[0], /нет variable/);
    assert.match(c.validate('x')[0], /объектом/);
    assert.equal(c.validate({ any: [{ flag: 'ok' }, { not: { variable: 'a' } }] }).length, 2);

    assert.deepEqual(
        c.variables({ any: [{ flag: 'f' }, { all: [{ variable: 'g', operator: '>', value: 1 }, { not: { flag: 'f' } }] }] }),
        ['f', 'g']
    );
});

// ───────────────────────── правила валидатора ─────────────────────────

async function validate(t, names, data) {
    const { validator, project, plugins } = await engine(t, names, data);

    return validator.validate(project, { plugins: plugins.getManifests() });
}

test('валидатор: setvar и setflag — ошибки формата и тип значения', async (t) => {
    const r = await validate(t, ['state'], {
        config: { state: { gold: 1 } },
        scenes: [{ id: 's', nodes: [
            { id: 'a', type: 'setvar', value: 1 },
            { id: 'b', type: 'setvar', variable: 'gold' },
            { id: 'c', type: 'setvar', variable: 'gold', value: 'много', op: 'add' },
            { id: 'd', type: 'setvar', variable: 'gold', value: 1, op: 'mul' },
            { id: 'e', type: 'setvar', variable: 'gold', value: 'текст' },
            { id: 'f', type: 'setflag' },
            { id: 'g', type: 'setflag', flag: 'x', value: 'да' }
        ] }]
    });

    assert.deepEqual(
        r.errors.map(e => e.code),
        ['setvar.no-variable', 'setvar.no-value', 'setvar.not-number', 'setvar.bad-op', 'setflag.no-flag', 'setflag.not-boolean']
    );
    assert.deepEqual(r.warnings.map(w => w.code), ['setvar.type-mismatch']);
    assert.equal(r.valid, false);
});

test('валидатор: jump без goto и переход на сцену', async (t) => {
    const r = await validate(t, ['jump'], {
        scenes: [
            { id: 's1', nodes: [{ id: 'a', type: 'jump' }, { id: 'b', type: 'jump', goto: 's2' }, { id: 'c', type: 'jump', goto: 'нет' }] },
            { id: 's2', nodes: [say('x')] }
        ]
    });

    assert.deepEqual(r.errors.map(e => e.code).sort(), ['goto.missing-target', 'jump.no-target']);
    assert.match(r.errors.find(e => e.code === 'goto.missing-target').message, /узел или сцену/);
});

test('валидатор: timeoutGoto проверяется как переход', async (t) => {
    const r = await validate(t, ['state'], {
        scenes: [{ id: 's', nodes: [{ id: 'a', type: 'say', timeoutGoto: 'нет' }] }]
    });

    assert.equal(r.errors[0].code, 'goto.missing-target');
    assert.match(r.errors[0].path, /timeoutGoto/);
});

test('валидатор choice: timeout, условия и переменные из setvar/setflag', async (t) => {
    const r = await validate(t, ['state', 'conditions', 'choice'], {
        config: { state: { hp: 3 } },
        scenes: [{ id: 's', nodes: [
            { id: 'v', type: 'setvar', variable: 'gold', value: 1 },
            { id: 'f', type: 'setflag', flag: 'met' },
            {
                id: 'q', type: 'choice', timeout: -5,
                options: [
                    { id: 'o1', variants: [{ text: 'a', condition: { all: [{ flag: 'met' }, { variable: 'gold', operator: '>', value: 0 }, { variable: 'hp', operator: '>', value: 0 }] } }] },
                    { id: 'o2', variants: [{ text: 'b', condition: { variable: 'hp', operator: '=>', value: 1 } }] },
                    { id: 'o3', variants: [{ text: 'c', condition: { flag: 'ghost' } }] }
                ]
            }
        ] }]
    });

    assert.deepEqual(r.errors.map(e => e.code), ['choice.bad-timeout', 'choice.bad-condition']);
    assert.deepEqual(r.warnings.map(w => w.code), ['choice.unknown-variable']);
    assert.match(r.warnings[0].message, /ghost/);
});

test('валидатор background: небезопасный адрес — ошибка, нет изображения — предупреждение', async (t) => {
    const r = await validate(t, ['background'], {
        scenes: [{ id: 's', nodes: [
            { id: 'a', type: 'background', image: 'url(javascript:1)' },
            { id: 'b', type: 'background' },
            { id: 'c', type: 'background', image: 'assets/forest.jpg' }
        ] }]
    });

    assert.deepEqual(r.errors.map(e => e.code), ['background.unsafe-image']);
    assert.deepEqual(r.warnings.map(w => w.code), ['background.no-image']);
});

// ───────────────────────── текстовые команды SET, FLAG, JUMP ─────────────────────────

test('AST: SET, FLAG и JUMP превращаются в узлы setvar, setflag и jump', async (t) => {
    quiet(t);
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const ast = new AST();
    const plugins = new PluginManager(
        new VN().getBus(),
        { registerNodeType() {}, unregisterNodeType() {}, registerSnapshotProvider: () => () => {} },
        { getPluginLayer: () => ({}), registerLayer: () => () => {} },
        {}, ast, new ProjectValidator()
    );

    for (const name of ['state', 'jump']) {
        plugins.use(await localPluginLoader(name));
    }

    const [scene] = ast.parse([
        '# Сцена',
        'SET gold = 10',
        'SET gold + 5',
        'set gold - 1',
        'SET name = Аня',
        'SET alive = true',
        'FLAG met_anna',
        'FLAG met_anna = false',
        'JUMP home',
        'JUMP scene-2'
    ].join('\n')).scenes;

    const pick = ({ type, variable, flag, value, op, goto }) =>
        JSON.stringify({ type, variable, flag, value, op, goto });

    assert.deepEqual(scene.nodes.map(pick), [
        { type: 'setvar', variable: 'gold', value: 10, op: 'set' },
        { type: 'setvar', variable: 'gold', value: 5, op: 'add' },
        { type: 'setvar', variable: 'gold', value: 1, op: 'sub' },
        { type: 'setvar', variable: 'name', value: 'Аня', op: 'set' },
        { type: 'setvar', variable: 'alive', value: true, op: 'set' },
        { type: 'setflag', flag: 'met_anna', value: true },
        { type: 'setflag', flag: 'met_anna', value: false },
        { type: 'jump', goto: 'home' },
        { type: 'jump', goto: 'scene-2' }
    ].map(pick));
});

// ───────────────────────── jump и порядок сцен ─────────────────────────

test('jump: переход на сцену обходит промежуточные сцены, автопереход идёт по порядку', async (t) => {
    const { vn, project } = await engine(t, ['jump', 'state'], {
        scenes: [
            { id: 'scene-1', nodes: [say('a'), { id: 'j', type: 'jump', goto: 'epilogue' }, say('skipped')] },
            { id: 'epilogue', nodes: [say('epi')] },
            { id: 'unused-middle', nodes: [say('unused')] }
        ]
    });
    const started = [];

    vn.getBus().on('node:start', n => started.push(n.id));
    vn.loadProject(project);

    // Узел после jump пропущен; но после «epilogue» история честно идёт в следующую по порядку сцену.
    assert.deepEqual(started, ['a', 'j', 'epi', 'unused']);

    started.length = 0;

    const second = await engine(t, ['jump'], {
        scenes: [
            { id: 'scene-1', nodes: [say('a'), { id: 'j', type: 'jump', goto: 'epilogue' }] },
            { id: 'unused-middle', nodes: [say('unused')] },
            { id: 'epilogue', nodes: [{ id: 'e', type: 'say', end: true }] }
        ]
    });

    second.vn.getBus().on('node:start', n => started.push(n.id));
    second.vn.loadProject(second.project);

    assert.deepEqual(started, ['a', 'j', 'e']);
});
