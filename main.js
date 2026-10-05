import { VN } from './core.js';
import { Player } from './player.js';
import { BlockManager } from './block-manager.js';
import { Project } from './project.js';


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
    blocks
);

plugins.use(DialoguePlugin);
plugins.use(NarrationPlugin);
plugins.use(BackgroundPlugin);
plugins.use(WaitPlugin);

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
    story: [
        {
            type: 'background',
            image: 'bg_room.jpg'
        },

        {
            type: 'dialogue',
            character: 'Аня',
            text: 'Привет!'
        },

        {
            type: 'wait',
            duration: 2000
        },

        {
            type: 'narration',
            text: 'Прошло две секунды...'
        },

        {
            type: 'dialogue',
            character: 'Аня',
            text: 'Теперь сценарий находится внутри Project!'
        }
    ],

    config: {},

    assets: {}
});
console.log(project.getStory())
game.loadScript(
    project.getStory()
);
