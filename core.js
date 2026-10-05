import { EventBus } from './events.js';

export class VN {
    #bus = new EventBus();

    #project = null;
    #state = {};
    #currentNodeId = null;
    #isWaiting = false;

    #nodeTypes = new Map();

    constructor() {
        this.#bus.on('click-game', () => {
            this.#continue();
        });
    }

    getBus() {
        return this.#bus;
    }

    getState() {
        return { ...this.#state };
    }

    registerNodeType(type, handler) {
        if (this.#nodeTypes.has(type)) {
            throw new Error(
                `Тип узла "${type}" уже зарегистрирован`
            );
        }

        if (typeof handler !== 'function') {
            throw new TypeError(
                `Обработчик узла "${type}" должен быть функцией`
            );
        }

        this.#nodeTypes.set(type, handler);
    }

    loadProject(project) {
        this.#project = project;
        this.#state = {
            health: 7
        };
        this.#currentNodeId = null;
        this.#isWaiting = false;

        this.#bus.emit('story:loaded');

        const scenes = project.getScenes();

        console.log(
            'Проект загружен, сцен:',
            scenes.length
        );

        const firstScene = scenes[0];

        if (!firstScene?.nodes?.length) {
            console.warn(
                'Проект не содержит узлов'
            );

            return;
        }

        this.#currentNodeId =
            firstScene.nodes[0].id;

        this.next();
    }

    next() {
        if (this.#isWaiting) {
            return;
        }

        const node = this.#project?.getNode(
            this.#currentNodeId
        );

        if (!node) {
            this.#bus.emit('story:end');

            console.log(
                'История завершена'
            );

            return;
        }

        this.#processNode(node);
    }
#goto(nodeId) {
    const node = this.#project.getNode(nodeId);

    if (!node) {
        console.warn(
            `VN.goto(): узел "${nodeId}" не найден`
        );

        return;
    }

    this.#currentNodeId = nodeId;
    this.#isWaiting = false;

    this.next();
}
    #processNode(node) {
        this.#bus.emit('node:start', node);

        const handler =
            this.#nodeTypes.get(node.type);

        if (!handler) {
            console.warn(
                `Неизвестный тип узла: ${node.type}`
            );

            this.#moveToNextNode(node);

            return;
        }

        handler(node, {
            wait: () => {
                this.#isWaiting = true;
            },

            resume: () => {
                this.#continue();
            },

            getState: () => {
                return this.getState();
            },
            goto: (nodeId) => {
    this.#goto(nodeId);
},
        });

        if (!this.#isWaiting) {
            this.#moveToNextNode(node);
        }
    }

    #moveToNextNode(node) {
    if (node.end === true) {
        this.#currentNodeId = null;

        this.#bus.emit('story:end');

        console.log(
            'История завершена'
        );

        return;
    }

    const nextNode =
        this.#project.getNextNode(node.id);

    if (!nextNode) {
        this.#currentNodeId = null;

        this.#bus.emit('story:end');

        console.log(
            'История завершена'
        );

        return;
    }

    this.#currentNodeId = nextNode.id;

    this.next();
}

    #continue() {
        if (!this.#isWaiting) {
            return;
        }

        this.#isWaiting = false;

        const node =
            this.#project.getNode(
                this.#currentNodeId
            );

        if (!node) {
            return;
        }

        this.#moveToNextNode(node);
    }
}