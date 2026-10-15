import { EventBus } from './events.js';
import { logger } from './logger.js';

const log = logger.child('VN');

/**
 * @class VN
 * @apiGroup VN
 *
 * Ядро игры: проходит по узлам проекта и вызывает обработчики типов узлов,
 * которые зарегистрировали плагины. Само ничего не рисует.
 *
 * Если обработчик узла бросает ошибку, история останавливается
 * и приходит событие `story:error`.
 *
 * @example
 * const game = new VN();
 *
 * game.registerNodeType('log', (node) => console.log(node.text));
 * game.getBus().on('story:end', () => console.log('Конец'));
 * game.loadProject(project);
 */
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

    /**
     * @apiName VN.getBus
     * @apiGroup VN
     *
     * Возвращает шину событий игры. Через неё приходят события `story:loaded`, `node:start`, `story:end`, `story:error` и событие клика `click-game`.
     *
     * @returns {EventBus} Шина событий.
     *
     * @example
     * const bus = game.getBus();
     * bus.on('story:end', () => console.log('Конец'));
     */
    getBus() {
        return this.#bus;
    }

    /**
     * @apiName VN.registerNodeType
     * @apiGroup VN
     *
     * Регистрирует обработчик типа узла. Без `wait()` история сама идёт дальше, с `wait()` останавливается до `resume()` или клика. Плагинам удобнее `api.game.registerNodeType`: он сам снимает тип при удалении плагина.
     *
     * @param {string} type Имя типа узла.
     * @param {function} handler Функция (node, context); context содержит wait(options), resume() и goto(nodeId).
     *
     * @example
     * game.registerNodeType('pause', (node, context) => {
     *     context.wait();
     *     setTimeout(() => context.resume(), node.ms);
     * });
     */
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
     *
     * @example
     * game.registerNodeType('flash', () => {});
     * game.unregisterNodeType('flash'); // true
     */
    unregisterNodeType(type) {
        return this.#nodeTypes.delete(type);
    }

    /**
     * @apiName VN.loadProject
     * @apiGroup VN
     *
     * Загружает проект, шлёт `story:loaded` и запускает историю с первого узла первой сцены. Плагины и проверку проекта нужно выполнить до этого вызова.
     *
     * @param {Project} project Проект игры.
     *
     * @example
     * const project = new Project({ scenes });
     * game.loadProject(project);
     */
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

        log.info(
            'Проект загружен, сцен:',
            scenes.length
        );

        const firstScene = scenes[0];

        if (!firstScene?.nodes?.length) {
            log.warn(
                'Проект не содержит узлов'
            );

            return;
        }

        this.#currentNodeId =
            firstScene.nodes[0].id;

        this.next();
    }

    /**
     * @apiName VN.next
     * @apiGroup VN
     *
     * Выполняет текущий узел. Ничего не делает, пока история ждёт или остановлена ошибкой. Обычно вызывать не нужно: ядро идёт дальше само и по клику игрока.
     *
     *
     * @example
     * game.next();
     */
    next() {
        if (this.#isWaiting || this.#failed) {
            return;
        }

        const node = this.#project?.getNode(
            this.#currentNodeId
        );

        if (!node) {
            this.#bus.emit('story:end');

            log.info(
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
        log.warn(
            `goto(): узел "${nodeId}" не найден`
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
            log.warn(
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

        log.error(
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

        log.info(
            'История завершена'
        );

        return;
    }

    const nextNode =
        this.#project.getNextNode(node.id);

    if (!nextNode) {
        this.#currentNodeId = null;

        this.#bus.emit('story:end');

        log.info(
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