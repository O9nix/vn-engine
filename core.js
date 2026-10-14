import { EventBus } from './events.js';

export class VN {
    #bus = new EventBus();

    #project = null;
    #currentNodeId = null;
    #isWaiting = false;
    #failed = false;
    #isLocked = false;

    #nodeTypes = new Map();

    constructor() {
        this.#bus.on('click-game', () => {
            // Ожидание с lock (например, выбор) клик не пропускает.
            if (this.#isLocked) {
                return;
            }

            this.#continue();
        });
    }

    getBus() {
        return this.#bus;
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

    /**
     * @apiName VN.unregisterNodeType
     * @apiGroup VN
     *
     * Снимает обработчик типа узла. Нужен, чтобы плагин можно было
     * удалить и поставить заново.
     *
     * @param {string} type Имя типа узла.
     * @returns {boolean} true, если тип был зарегистрирован.
     */
    unregisterNodeType(type) {
        return this.#nodeTypes.delete(type);
    }

    loadProject(project) {
        this.#project = project;
        this.#currentNodeId = null;
        this.#isWaiting = false;
        this.#isLocked = false;
        this.#failed = false;

        this.#bus.emit('story:loaded', {
    project: this.#project
});

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
        if (this.#isWaiting || this.#failed) {
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
    if (this.#failed) {
        return;
    }

    const node = this.#project.getNode(nodeId);

    if (!node) {
        console.warn(
            `VN.goto(): узел "${nodeId}" не найден`
        );

        return;
    }

    this.#currentNodeId = nodeId;
    this.#isWaiting = false;
    this.#isLocked = false;

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

        try {
            this.#runHandler(handler, node);
        } catch (error) {
            this.#fail(node, error);

            return;
        }

        if (!this.#isWaiting && !this.#failed) {
            this.#moveToNextNode(node);
        }
    }

    // Ошибка узла останавливает выполнение проекта.
    #fail(node, error) {
        this.#failed = true;
        this.#isWaiting = false;
        this.#isLocked = false;

        console.error(
            `Ошибка в узле "${node?.id}" (тип "${node?.type}"):`,
            error
        );

        this.#bus.emit('story:error', {
            node,
            error,
            message: error?.message ?? String(error)
        });
    }

    #runHandler(handler, node) {
        handler(node, {
            wait: (options) => {
                this.#isWaiting = true;
                this.#isLocked = options?.lock === true;
            },

            resume: () => {
                this.#continue();
            },
            goto: (nodeId) => {
    this.#goto(nodeId);
},
        });
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
        this.#isLocked = false;

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