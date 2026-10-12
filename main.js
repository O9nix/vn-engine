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

async function start() {
    await loadProjectPlugins(project, registry, plugins);

    const validator = new ProjectValidator(project, bus);

    const result = validator.validateGotos();

    console.log(result);

    game.loadProject(project);
}

start().catch((error) => {
    console.error(error);

    // Ошибка запуска не должна оставлять пустой экран.
    const box = document.createElement('pre');

    box.textContent =
        `Не удалось запустить проект:\n${error.message}`;

    document.body.appendChild(box);
});
