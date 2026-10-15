import { VN } from './core.js';
import { Player } from './player.js';
import { BlockManager } from './block-manager.js';
import { Project } from './project.js';
import { ProjectValidator } from './ProjectValidator.js';
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
        'choice'
    ],

     config:{state :{
            health: 7
        }},
    scenes: [
        {
            id: 'scene-1',

            nodes: [

                {
                    id: 'start',

                    type: 'dialogue',

                    character: 'Аня',

                    text: 'Как себя чувствуешь?'
                },
                {
                    id: 'ddd',
                    type: 'narration',
                    text: 'sssssssssssssssssss'
                },
                {
                    id: 'choice-1',

                    type: 'choice',

                    text: 'Куда пойдём?',

                    options: [
                        {
                            id: 'go',

                            variants: [
                                {
                                    condition: {
                                        variable: 'health',
                                        operator: '<=',
                                        value: 5
                                    },

                                    text: 'Сначала в больницу',

                                    goto: 'hospital'
                                },

                                {
                                   
                                    text: 'Пойдём домой',

                                    goto: 'home1'
                                }
                            ]
                        }
                    ]
                },

                {
                    id: 'hospital',

                    type: 'dialogue',

                    character: 'Аня',

                    text: 'Хорошо, сначала в больницу.',

                    end: true
                },

                {
                    id: 'home',

                    type: 'dialogue',

                    character: 'Аня',

                    text: 'Тогда идём домой.',

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

const plugins = new PluginManager(
    bus,
    game,
    player,
    blocks,
    parser
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

    const validator = new ProjectValidator(project, bus);

    validator.validateGotos();




// --- ТЕСТОВЫЙ БЛОК: проверка парсера AST на DSL-синтаксисе ---
console.group('🧪 Тест парсера AST (DSL → AST)');

// 1. Создаём "сырой" текст сценария в твоём DSL-формате.
// Здесь мы проверяем сразу три плагина: Dialogue, Narration, Choice.
const rawSource = `
# Сцена проверки

// Туман стелется по земле, скрывая очертания домов.
[Анна] Что это за шум? Мне страшно...
[Макс] Не волнуйся, я рядом.
// Макс крепче сжимает рукоять меча.

CHOICE: Куда пойдём дальше? | В подвал → basement | На улицу → street | Подождать здесь → wait

// Тишина повисла в воздухе.
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
