import { VN } from './core.js';
import { Player } from './player.js';
import { BlockManager } from './block-manager.js';
import { Project } from './project.js';
import { FlowResolver } from './flow.js';
import { ConditionEvaluator } from './core/condition-evaluator.js';


import { PluginManager }
    from './plugin-manager.js';

import { DialoguePlugin }
    from './plugins/dialogue-plugin.js';

import { NarrationPlugin }
    from './plugins/narration-plugin.js';

import { BackgroundPlugin }
    from './plugins/background-plugin.js';

import { WaitPlugin }
    from './plugins/wait-plugin.js';
import { ChoicePlugin }
    from './plugins/choice-plugin.js';


export const TestPluginB = {
    name: 'test-b',

    install(api) {
        const pluginA =
            api.plugins['test-a'];

        console.log(
            pluginA.api.hello()
        );
    }
};
export const TestPluginA = {
    name: 'test-a',

    install(api) {
        return {
            api: {
                hello() {
                    return 'Hello from A';
                }
            }
        };
    }
};
const game = new VN();

const bus = game.getBus();

const player = new Player();

const blocks = new BlockManager(
    player.getPluginLayer()
);
const conditions = new ConditionEvaluator();
const plugins = new PluginManager(
    bus,
    game,
    player,
    blocks,
    conditions
);

plugins.use(DialoguePlugin);
plugins.use(NarrationPlugin);
plugins.use(BackgroundPlugin);
plugins.use(WaitPlugin);
plugins.use(ChoicePlugin);


plugins.use(TestPluginA);
plugins.use(TestPluginB);


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

const project = new Project({
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

                                    goto: 'home'
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


game.loadProject(project);
