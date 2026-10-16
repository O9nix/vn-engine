import { VN } from './core.js';
import { Player } from './player.js';
import { BlockManager } from './block-manager.js';
import { Project } from './project.js';
import { ProjectValidator } from './project-validator.js';
import { PluginRegistry } from './plugin-registry.js';
import { localPluginLoader } from './local-plugin-loader.js';
import { loadProjectPlugins } from './plugin-loader.js';
import { PluginManager } from './plugin-manager.js';
import {AST} from './AST.js'
import { logger, LOG_LEVELS } from './logger.js';

// Уровень журнала можно выбрать в адресе страницы: ?log=debug
const requestedLevel = new URLSearchParams(location.search).get('log');

if (requestedLevel in LOG_LEVELS) {
    logger.setLevel(requestedLevel);
}

// 1. Создаем парсер
const parser = new AST();

// Плагины загружаются по именам из проекта. Позже загрузчик можно
// заменить на получение плагинов из внешнего сервиса
const registry = new PluginRegistry({ loader: localPluginLoader });

// Фоны для демонстрации: простые градиенты, зашитые прямо в адрес.
const gradient = (top, bottom) =>
    ('data:image/svg+xml,' + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" preserveAspectRatio="none">' +
        '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
        `<stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>` +
        '</linearGradient></defs><rect width="10" height="10" fill="url(#g)"/></svg>'
    // Скобки в адресе фона запрещены плагином background: кодируем их.
    )).replace(/\(/g, '%28').replace(/\)/g, '%29');

// Демонстрация версии 0.1.6: состояние, флаги, переходы между сценами,
// выбор с таймером, условия, подстановка значений в текст.
const project = new Project({
    // Плагины, нужные проекту. Порядок зависимостей определяется автоматически.
    plugins: [
        'noty',
        'state',
        'top-left-hud',
        'dialogue',
        'narration',
        'background',
        'wait',
        'conditions',
        'choice',
        'jump'
    ],

    config: {
        state: {
            health: 7,
            gold: 0
        }
    },

    scenes: [
        {
            id: 'street',

            nodes: [
                { id: 'bg1', type: 'background', image: gradient('#0b132b', '#3a506b') },

                { id: 'n1', type: 'narration', text: 'Вечер. Улица пуста, только фонари горят вполнакала.' },

                {
                    id: 'd1',
                    type: 'dialogue',
                    character: 'Аня',
                    text: 'У тебя {health} здоровья и {gold} монет. Что будем делать?'
                },

                // Пауза с полосой прогресса; клик пропускает её.
                { id: 'w1', type: 'wait', duration: 1500 },

                // Выбор с таймером: не успеешь за 12 секунд — уйдёшь в too-slow.
                {
                    id: 'ask',
                    type: 'choice',
                    text: 'Куда пойдём? ({gold} монет, здоровье {health})',
                    timeout: 12000,
                    timeoutGoto: 'too-slow',
                    options: [
                        {
                            id: 'coins',
                            variants: [{ text: 'Подобрать монеты у фонаря (+5 монет, −1 здоровья)', goto: 'coins' }]
                        },
                        {
                            // Условия: показывается первый подходящий вариант.
                            id: 'rest',
                            variants: [
                                {
                                    condition: { variable: 'health', operator: '<=', value: 5 },
                                    text: 'Сначала в больницу',
                                    goto: 'hospital'
                                },
                                {
                                    condition: { variable: 'health', operator: '>', value: 5 },
                                    text: 'Пойдём домой',
                                    goto: 'home'
                                }
                            ]
                        },
                        {
                            // Составное условие: all, затем запасной вариант без условия.
                            id: 'shop',
                            variants: [
                                {
                                    condition: {
                                        all: [
                                            { variable: 'gold', operator: '>=', value: 5 },
                                            { flag: 'has_key', value: false }
                                        ]
                                    },
                                    text: 'Купить ключ в лавке (5 монет)',
                                    goto: 'shop'
                                },
                                {
                                    condition: { flag: 'has_key' },
                                    text: 'Ключ уже куплен',
                                    goto: 'ask'
                                },
                                {
                                    text: 'Лавка закрыта: нужно 5 монет',
                                    goto: 'closed'
                                }
                            ]
                        }
                    ]
                },

                // ── ветки ──
                { id: 'coins', type: 'setvar', variable: 'gold', value: 5, op: 'add' },
                { id: 'coins-hp', type: 'setvar', variable: 'health', value: 1, op: 'sub' },
                { id: 'coins-say', type: 'dialogue', character: 'Аня', text: 'Нашла! Теперь у тебя {gold} монет, здоровье {health}.' },
                { id: 'coins-back', type: 'jump', goto: 'ask' },

                { id: 'hospital', type: 'setvar', variable: 'health', value: 3, op: 'add' },
                { id: 'hospital-say', type: 'dialogue', character: 'Врач', text: 'Вот, выпейте. Здоровье теперь {health}.' },
                { id: 'hospital-back', type: 'jump', goto: 'ask' },

                { id: 'shop', type: 'setvar', variable: 'gold', value: 5, op: 'sub' },
                { id: 'shop-flag', type: 'setflag', flag: 'has_key' },
                { id: 'shop-say', type: 'narration', text: 'Ты купил старый ключ. Монет осталось: {gold}.' },
                { id: 'shop-back', type: 'jump', goto: 'ask' },

                { id: 'closed', type: 'dialogue', character: 'Аня', text: 'Лавка закрыта. Сначала нужно набрать монет.' },
                { id: 'closed-back', type: 'jump', goto: 'ask' },

                { id: 'home', type: 'dialogue', character: 'Аня', text: 'Тогда идём домой.' },
                // Переход на другую сцену по её id.
                { id: 'home-go', type: 'jump', goto: 'house' },

                { id: 'too-slow', type: 'setvar', variable: 'health', value: 2, op: 'sub' },
                { id: 'too-slow-say', type: 'dialogue', character: 'Аня', text: 'Ты слишком долго думал, стало холодно. Здоровье {health}. Пойдём домой.' },
                { id: 'too-slow-go', type: 'jump', goto: 'house' }
            ]
        },

        {
            id: 'house',

            nodes: [
                { id: 'bg2', type: 'background', image: gradient('#432818', '#bb9457') },

                { id: 'n2', type: 'narration', text: 'В доме тепло. На двери подвала висит замок.' },

                {
                    id: 'door',
                    type: 'choice',
                    text: 'Что сделаешь?',
                    options: [
                        {
                            id: 'open',
                            variants: [
                                {
                                    condition: { flag: 'has_key' },
                                    text: 'Открыть подвал ключом',
                                    goto: 'ending-key'
                                },
                                {
                                    text: 'Постучать в подвал',
                                    goto: 'ending-knock'
                                }
                            ]
                        }
                    ]
                },

                {
                    id: 'ending-key',
                    type: 'dialogue',
                    character: 'Аня',
                    text: 'Замок щёлкнул! Здоровье {health}, монет {gold}. Это хорошая концовка.',
                    end: true
                },

                {
                    id: 'ending-knock',
                    type: 'dialogue',
                    character: 'Аня',
                    text: 'Никто не ответил. Здоровье {health}, монет {gold}. Попробуй ещё раз, но с ключом.',
                    end: true
                }
            ]
        }
    ]
});


const game = new VN();

const bus = game.getBus();

const player = new Player();

const blocks = new BlockManager(
    player.getPluginLayer()
);

const validator = new ProjectValidator(bus);

const plugins = new PluginManager(
    bus,
    game,
    player,
    blocks,
    parser,
    validator
);

document.addEventListener(
    'click',
    (event) => {
        if (event.target.closest('button')) {
            return;
        }

        bus.emit(
            'click-game',
            event
        );
    }
);

function showFatal(text) {
    // Запасной вывод, если уведомления недоступны.
    const box = document.createElement('pre');
    box.className =
                    'box-fatal-error';

                Object.assign(
                    box.style,
                    {
                        position: 'absolute',
    top: '10px'
                    }
                );
    
    box.textContent = text;
    document.body.appendChild(box);
}

async function start() {
    const report = await loadProjectPlugins(project, registry, plugins);

    // Интерфейс плеера и плагины уведомлений уже работают; сообщаем о сбоях.
    for (const failure of report.failed) {
        logger.error(
            `Плагин "${failure.name}" (${failure.stage}):`,
            failure.error
        );

        bus.emit('plugin:error', {
            name: failure.name,
            stage: failure.stage,
            message: failure.message
        });
    }

    if (report.failed.length > 0) {
        if (!plugins.has('noty')) {
            showFatal(
                'Проект не запущен, плагины с ошибками:\n' +
                report.failed.map(f => `- ${f.name}: ${f.message}`).join('\n')
            );
        }

        // История не запускается, пока не работают все плагины проекта.
        return;
    }

    // Ошибки проекта блокируют запуск, предупреждения не мешают.
    const validation = await validator.validate(
        project,
        { plugins: plugins.getManifests() }
    );

    if (!validation.valid) {
        logger.error(
            `Проект содержит ошибки (${validation.errors.length}), история не запущена`
        );

        if (!plugins.has('noty')) {
            showFatal(
                'Проект не запущен, найдены ошибки:\n' +
                validation.errors.map(e => `- ${e.message} (${e.path})`).join('\n')
            );
        }

        return;
    }




// --- ДЕМО: сохранение и загрузка (game.snapshot / game.restore) ---
const SAVE_KEY = 'vnengine-demo-save';

const demoPanel = document.createElement('div');
const demoStatus = document.createElement('span');

Object.assign(demoPanel.style, {
    position: 'fixed',
    top: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    zIndex: '200',
    font: '14px sans-serif',
    color: '#fff'
});

demoStatus.style.opacity = '0.8';

function addDemoButton(label, onClick) {
    const button = document.createElement('button');

    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    demoPanel.appendChild(button);
}

addDemoButton('Сохранить', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.snapshot()));
    demoStatus.textContent = `Сохранено ${new Date().toLocaleTimeString()}`;
});

addDemoButton('Загрузить', () => {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
        demoStatus.textContent = 'Сохранения нет';

        return;
    }

    game.restore(JSON.parse(raw));
    demoStatus.textContent = 'Загружено';
});

addDemoButton('Заново', () => location.reload());

demoPanel.appendChild(demoStatus);
document.body.appendChild(demoPanel);

// --- ТЕСТОВЫЙ БЛОК: проверка парсера AST на DSL-синтаксисе ---
console.group('🧪 Тест парсера AST (DSL → AST)');

// 1. Создаём "сырой" текст сценария в твоём DSL-формате.
// Здесь мы проверяем сразу три плагина: Dialogue, Narration, Choice.
const rawSource = `
# Название сцены
[Аня] У тебя {health} здоровья.
SET gold + 10
FLAG met_anna
// Монета в кармане.
CHOICE: Куда дальше? | Домой → home | Дальше → road
JUMP home
`;

console.log('Сырой текст для парсинга:\n', rawSource);

// 2. Прогоняем через парсер
const astResult = parser.parse(rawSource);
console.log('AST результат:', astResult);

// 3. Проверки по типам узлов
const hasDialogueNodes = astResult.scenes.some(scene =>
    scene.nodes.some(node => node.type === 'dialogue')
);

const hasNarrationNodes = astResult.scenes.some(scene =>
    scene.nodes.some(node => node.type === 'narration')
);

const hasChoiceNodes = astResult.scenes.some(scene =>
    scene.nodes.some(node => node.type === 'choice')
);

// Вывод результатов проверки
if (hasDialogueNodes) {
    console.log('✅ Парсер успешно распознал узлы типа dialogue.');
} else {
    console.warn('⚠️ Парсер НЕ создал узлы типа dialogue. Проверь плагин DialoguePlugin.');
}

if (hasNarrationNodes) {
    console.log('✅ Парсер успешно распознал узлы типа narration (строки //).');
} else {
    console.warn('⚠️ Парсер НЕ создал узлы типа narration. Проверь regex в NarrationPlugin (/^\\/\\/\\s*(.*)$/).');
}

if (hasChoiceNodes) {
    const choiceScene = astResult.scenes.find(s => s.nodes.some(n => n.type === 'choice'));
    if (choiceScene) {
        const choiceNode = choiceScene.nodes.find(n => n.type === 'choice');
        const optionsCount = choiceNode?.options?.length || 0;
        if (optionsCount >= 3) {
            console.log(`✅ Парсер успешно распознал узел choice и распарсил ${optionsCount} вариантов.`);
        } else {
            console.warn(`⚠️ Парсер создал узел choice, но внутри мало вариантов (${optionsCount}). Проверь логику парсинга блока [[...]] в ChoicePlugin.`);
        }
    } else {
        console.warn('⚠️ Парсер не нашёл узел choice в AST.');
    }
} else {
    console.warn('⚠️ Парсер НЕ создал узлы типа choice. Проверь установку ChoicePlugin и его regex.');
}

// 4. (Опционально) Быстрая проверка структуры первого choice-узла
const firstChoiceNode = astResult.scenes
    .flatMap(s => s.nodes)
    .find(n => n.type === 'choice');

if (firstChoiceNode) {
    console.log('🔍 Детали первого узла choice:', {
        text: firstChoiceNode.text,
        optionsCount: firstChoiceNode.options?.length,
        firstOption: firstChoiceNode.options?.[0]?.variants?.[0]
    });
}

console.groupEnd();
// -----------------------------------------------

game.loadProject(project);
}

start().catch((error) => {
    logger.error(error);

    showFatal(`Не удалось запустить проект:\n${error.message}`);
});
