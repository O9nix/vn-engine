import test from 'node:test';
import assert from 'node:assert/strict';

import { Project } from '../project.js';
import { PluginRegistry } from '../plugin-registry.js';
import {
    normalizePluginRefs,
    orderPlugins,
    loadProjectPlugins
} from '../plugin-loader.js';

const make = (name, dependencies = [], extra = {}) => ({
    name,
    dependencies,
    install() {},
    ...extra
});

// Минимальный менеджер: повторяет контракт use()/remove().
function fakeManager({ failOn } = {}) {
    const installed = [];
    return {
        installed,
        use(plugin) {
            if (plugin.name === failOn) {
                throw new Error('boom');
            }
            installed.push(plugin.name);
        },
        remove(name) {
            installed.splice(installed.indexOf(name), 1);
        }
    };
}

const names = list => list.map(p => p.name);

test('normalizePluginRefs: строки и объекты', () => {
    assert.deepEqual(
        normalizePluginRefs(['a', { name: 'b', version: '1' }]),
        [
            { name: 'a', version: undefined },
            { name: 'b', version: '1' }
        ]
    );
    assert.deepEqual(normalizePluginRefs(undefined), []);
});

test('normalizePluginRefs: ошибки', () => {
    assert.throws(() => normalizePluginRefs('a'), /массивом/);
    assert.throws(() => normalizePluginRefs([{}]), /plugins\[0\]/);
    assert.throws(() => normalizePluginRefs(['a', 'a']), /дважды/);
});

test('orderPlugins: зависимости идут раньше', () => {
    const state = make('state');
    const cond = make('conditions');
    const choice = make('choice', ['state', 'conditions']);

    assert.deepEqual(
        names(orderPlugins([choice, state, cond])),
        ['state', 'conditions', 'choice']
    );
});

test('orderPlugins: порядок независимых сохраняется', () => {
    const a = make('a');
    const b = make('b');
    const c = make('c');

    assert.deepEqual(names(orderPlugins([c, a, b])), ['c', 'a', 'b']);
});

test('orderPlugins: необъявленная зависимость', () => {
    assert.throws(
        () => orderPlugins([make('choice', ['state'])]),
        /"choice" требует "state"/
    );
});

test('orderPlugins: цикл', () => {
    assert.throws(
        () => orderPlugins([make('a', ['b']), make('b', ['a'])]),
        /a → b → a/
    );
});

test('PluginRegistry: регистрация и resolve', async () => {
    const registry = new PluginRegistry().register(
        make('state', [], { version: '0.1.0' })
    );

    assert.equal((await registry.resolve('state')).name, 'state');
    assert.equal((await registry.resolve('state', '0.1.0')).name, 'state');
    await assert.rejects(registry.resolve('state', '9'), /требуется версия 9/);
    await assert.rejects(registry.resolve('nope'), /не найден/);
    assert.throws(() => registry.register(make('state')), /уже зарегистрирован/);
    assert.deepEqual(registry.list(), ['state']);
});

test('loadProjectPlugins: ставит в порядке зависимостей', async () => {
    const registry = new PluginRegistry()
        .register(make('state'))
        .register(make('choice', ['state']));
    const manager = fakeManager();
    const project = new Project({ plugins: ['choice', 'state'] });

    const result = await loadProjectPlugins(project, registry, manager);

    assert.deepEqual(result, ['state', 'choice']);
    assert.deepEqual(manager.installed, ['state', 'choice']);
});

test('loadProjectPlugins: собирает все ненайденные плагины', async () => {
    const registry = new PluginRegistry();
    const project = new Project({ plugins: ['x', 'y'] });

    await assert.rejects(
        loadProjectPlugins(project, registry, fakeManager()),
        /"x".*\n- .*"y"/s
    );
});

test('loadProjectPlugins: откат при ошибке установки', async () => {
    const registry = new PluginRegistry()
        .register(make('a'))
        .register(make('b'));
    const manager = fakeManager({ failOn: 'b' });
    const project = new Project({ plugins: ['a', 'b'] });

    await assert.rejects(
        loadProjectPlugins(project, registry, manager),
        /boom/
    );
    assert.deepEqual(manager.installed, []);
});

test('loadProjectPlugins: проект без плагинов', async () => {
    const result = await loadProjectPlugins(
        new Project(),
        new PluginRegistry(),
        fakeManager()
    );

    assert.deepEqual(result, []);
});

test('PluginRegistry: загрузчик вызывается один раз и результат кэшируется', async () => {
    let calls = 0;
    const registry = new PluginRegistry({
        loader: async (name) => {
            calls++;
            return make(name);
        }
    });

    const [a, b] = await Promise.all([
        registry.resolve('choice'),
        registry.resolve('choice')
    ]);
    await registry.resolve('choice');

    assert.equal(a, b);
    assert.equal(calls, 1);
    assert.deepEqual(registry.list(), ['choice']);
});

test('PluginRegistry: вручную добавленный плагин приоритетнее загрузчика', async () => {
    let calls = 0;
    const registry = new PluginRegistry({
        loader: async (name) => { calls++; return make(name); }
    }).register(make('state'));

    await registry.resolve('state');
    assert.equal(calls, 0);
});

test('PluginRegistry: небезопасные имена не доходят до загрузчика', async () => {
    let calls = 0;
    const registry = new PluginRegistry({
        loader: async (name) => { calls++; return make(name); }
    });

    for (const bad of [
        '../secret', 'a/b', 'a\\b', 'A', 'a_b', '-a', 'a-', 'a--b',
        '', 'a.js', 'a b', undefined, null, 5
    ]) {
        await assert.rejects(
            registry.resolve(bad),
            /недопустимое имя/,
            `имя ${String(bad)} должно отклоняться`
        );
    }

    assert.equal(calls, 0);
});

test('PluginRegistry: ошибки загрузчика', async () => {
    const failing = new PluginRegistry({
        loader: async () => { throw new Error('нет файла'); }
    });
    await assert.rejects(failing.resolve('x'), /не удалось загрузить: нет файла/);

    const wrongName = new PluginRegistry({ loader: async () => make('other') });
    await assert.rejects(wrongName.resolve('x'), /вместо запрошенного "x"/);

    const broken = new PluginRegistry({ loader: async () => ({ name: 'x' }) });
    await assert.rejects(broken.resolve('x'), /некорректен/);

    // Неудачная загрузка не запоминается: можно повторить.
    let attempt = 0;
    const flaky = new PluginRegistry({
        loader: async (name) => {
            if (attempt++ === 0) throw new Error('сеть');
            return make(name);
        }
    });
    await assert.rejects(flaky.resolve('x'));
    assert.equal((await flaky.resolve('x')).name, 'x');
});

test('PluginRegistry: loader должен быть функцией', () => {
    assert.throws(() => new PluginRegistry({ loader: 'x' }), /функцией/);
});

test('plugins/*-plugin.js: имя файла, name и export default согласованы', async () => {
    const { readdir } = await import('node:fs/promises');
    const { localPluginLoader } = await import('../local-plugin-loader.js');

    const dir = new URL('../plugins/', import.meta.url);
    const files = (await readdir(dir)).filter(f => f.endsWith('-plugin.js'));

    assert.ok(files.length > 0);

    for (const file of files) {
        const name = file.replace(/-plugin\.js$/, '');
        const plugin = await localPluginLoader(name);

        assert.equal(plugin.name, name, `${file}: name должен совпадать с файлом`);
        assert.equal(typeof plugin.install, 'function', `${file}: нет install`);
        assert.ok(Array.isArray(plugin.nodeTypes), `${file}: нет nodeTypes`);
        assert.ok(plugin.version, `${file}: нет version`);
    }
});

test('PluginRegistry + localPluginLoader: реальные плагины и порядок зависимостей', async () => {
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const registry = new PluginRegistry({ loader: localPluginLoader });
    const manager = fakeManager();
    const project = new Project({
        plugins: ['choice', 'state', 'conditions']
    });

    const result = await loadProjectPlugins(project, registry, manager);

    assert.deepEqual(result, ['state', 'conditions', 'choice']);
});

test('plugins/*-plugin.js: dependencies указывают на существующие плагины', async () => {
    const { readdir } = await import('node:fs/promises');
    const { localPluginLoader } = await import('../local-plugin-loader.js');

    const dir = new URL('../plugins/', import.meta.url);
    const names = (await readdir(dir))
        .filter(f => f.endsWith('-plugin.js'))
        .map(f => f.replace(/-plugin\.js$/, ''));

    for (const name of names) {
        const plugin = await localPluginLoader(name);

        for (const dependency of plugin.dependencies ?? []) {
            assert.ok(
                names.includes(dependency),
                `${name}: зависимость "${dependency}" не найдена среди плагинов`
            );
        }
    }
});

test('top-left-hud зависит от state (иначе он увидит пустое состояние)', async () => {
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const hud = await localPluginLoader('top-left-hud');

    assert.ok(hud.dependencies.includes('state'));
});
