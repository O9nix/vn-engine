import { VN } from './core.js';
import { Player } from './player.js';
import { BlockManager } from './block-manager.js';
import { Project } from './project.js';
import { ProjectValidator } from './ProjectValidator.js';
import { PluginRegistry } from './plugin-registry.js';
import { localPluginLoader } from './local-plugin-loader.js';
import { loadProjectPlugins } from './plugin-loader.js';
import { PluginManager } from './plugin-manager.js';

// Плагины загружаются по именам из проекта. Позже загрузчик можно
// заменить на получение плагинов из внешнего сервиса.
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
        // 'conditions',
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
        console.error(
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

    game.loadProject(project);
}

start().catch((error) => {
    console.error(error);

    showFatal(`Не удалось запустить проект:\n${error.message}`);
});
