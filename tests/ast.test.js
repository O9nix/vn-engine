import test from 'node:test';
import assert from 'node:assert/strict';

import { AST } from '../AST.js';
import { ProjectValidator } from '../project-validator.js';
import { PluginManager } from '../plugin-manager.js';
import { EventBus } from '../events.js';

function quiet(t) {
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'warn', () => {});
}

// ───────────────────────── AST ─────────────────────────

test('AST: проверяет аргументы addCommand', () => {
    const ast = new AST();

    assert.throws(() => ast.addCommand('x', 't', () => {}), /RegExp/);
    assert.throws(() => ast.addCommand(/x/, 't', 'не функция'), /функцией/);
});

test('AST: повторная команда с тем же выражением отклоняется', () => {
    const ast = new AST();

    ast.addCommand(/x/, 't', () => ({}));

    assert.throws(() => ast.addCommand(/x/, 'u', () => ({})), /уже зарегистрирована/);
});

test('AST: addCommand возвращает функцию снятия, removeCommand снимает команду', () => {
    const ast = new AST();
    const off = ast.addCommand(/a/, 't', () => ({}));

    ast.addCommand(/b/, 't', () => ({}));

    assert.equal(ast.getCommands().length, 2);

    off();

    assert.equal(ast.getCommands().length, 1);
    assert.equal(ast.removeCommand(/a/), false);
    assert.equal(ast.removeCommand(/b/), true);
    assert.equal(ast.getCommands().length, 0);
});

test('AST: делит текст на сцены, строки до первой сцены игнорирует', () => {
    const ast = new AST();
    const result = ast.parse('мусор\n# Первая\nтекст\n# Вторая\nещё');

    assert.deepEqual(result.scenes.map(s => s.name), ['Первая', 'Вторая']);
    assert.equal(result.scenes[0].nodes.length, 1);
});

test('AST: строка, которую не узнала ни одна команда, становится узлом text', () => {
    const ast = new AST();
    const [scene] = ast.parse('# С\nпросто строка').scenes;

    assert.equal(scene.nodes[0].type, 'text');
    assert.equal(scene.nodes[0].text, 'просто строка');
});

test('AST: команды перебираются по порядку, null из обработчика отдаёт строку следующей', () => {
    const ast = new AST();

    ast.addCommand(/^a/, 'first', () => null);
    ast.addCommand(/^a/i, 'second', (m, line) => ({ type: 'second', text: line }));

    const [scene] = ast.parse('# С\nabc').scenes;

    assert.equal(scene.nodes[0].type, 'second');
});

// ───────────────────────── api.ast в PluginManager ─────────────────────────

function manager(ast) {
    const game = { registerNodeType() {}, unregisterNodeType() {} };
    const player = { getPluginLayer: () => ({}), registerLayer: () => () => {} };

    return new PluginManager(new EventBus(), game, player, {}, ast, new ProjectValidator());
}

test('PluginManager: api.ast.addCommand регистрирует команду, remove её снимает', (t) => {
    quiet(t);
    const ast = new AST();
    const m = manager(ast);

    m.use({
        name: 'p',
        install(api) {
            api.ast.addCommand(/^!/, 'bang', (match, line) => ({ type: 'bang', text: line }));
        }
    });

    assert.equal(ast.parse('# С\n!раз').scenes[0].nodes[0].type, 'bang');

    m.remove('p');

    assert.equal(ast.parse('# С\n!раз').scenes[0].nodes[0].type, 'text');
});

test('PluginManager: сбой install снимает уже добавленные команды парсера', (t) => {
    quiet(t);
    const ast = new AST();
    const m = manager(ast);

    assert.throws(() => m.use({
        name: 'p',
        install(api) {
            api.ast.addCommand(/^!/, 'bang', () => ({}));

            throw new Error('сбой');
        }
    }), /сбой/);

    assert.equal(ast.getCommands().length, 0);
});

test('PluginManager: без парсера api.ast.addCommand даёт понятную ошибку', (t) => {
    quiet(t);
    const m = manager(undefined);

    assert.throws(() => m.use({
        name: 'p',
        install(api) {
            api.ast.addCommand(/x/, 't', () => ({}));
        }
    }), /без парсера/);
    assert.ok(!m.has('p'));
});

test('PluginManager: два плагина с одинаковой командой — второй не устанавливается, первый цел', (t) => {
    quiet(t);
    const ast = new AST();
    const m = manager(ast);
    const install = api => api.ast.addCommand(/^!/, 'bang', () => ({}));

    m.use({ name: 'a', install });

    assert.throws(() => m.use({ name: 'b', install }), /уже зарегистрирована/);
    assert.equal(ast.getCommands().length, 1);

    m.remove('a');

    assert.equal(ast.getCommands().length, 0);
});

// ───────────────────────── текстовые команды реальных плагинов ─────────────────────────

async function parserWithPlugins(t, names) {
    quiet(t);
    const { localPluginLoader } = await import('../local-plugin-loader.js');
    const ast = new AST();
    const m = manager(ast);

    for (const name of names) {
        m.use(await localPluginLoader(name));
    }

    return { ast, m };
}

const SOURCE = `
# Сцена проверки

// Туман стелется по земле.
[Анна] Что это за шум?
CHOICE: Куда пойдём? | В подвал → basement | На улицу -> street | Подождать
`;

test('DSL: dialogue, narration и choice превращают строки в узлы', async (t) => {
    const { ast } = await parserWithPlugins(t, [
        'state', 'conditions', 'dialogue', 'narration', 'choice'
    ]);
    const [scene] = ast.parse(SOURCE).scenes;
    const [narration, dialogue, choice] = scene.nodes;

    assert.equal(narration.type, 'narration');
    assert.equal(narration.text, 'Туман стелется по земле.');

    assert.equal(dialogue.type, 'dialogue');
    assert.equal(dialogue.character, 'Анна');
    assert.equal(dialogue.text, 'Что это за шум?');

    assert.equal(choice.type, 'choice');
    assert.equal(choice.text, 'Куда пойдём?');
    assert.deepEqual(
        choice.options.map(o => o.variants[0]),
        [
            { text: 'В подвал', goto: 'basement' },
            { text: 'На улицу', goto: 'street' },
            { text: 'Подождать' }
        ]
    );
});

test('DSL: CHOICE без вариантов не становится узлом choice', async (t) => {
    const { ast } = await parserWithPlugins(t, [
        'state', 'conditions', 'choice'
    ]);
    const [scene] = ast.parse('# С\nCHOICE: Вопрос без вариантов').scenes;

    assert.equal(scene.nodes[0].type, 'text');
});

test('DSL: после удаления плагина его команда больше не работает', async (t) => {
    const { ast, m } = await parserWithPlugins(t, ['dialogue']);

    m.remove('dialogue');

    assert.equal(ast.parse('# С\n[Анна] Привет').scenes[0].nodes[0].type, 'text');
});
