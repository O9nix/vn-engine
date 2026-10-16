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
 * и приходит событие `story:error`. Когда сцена заканчивается, история
 * продолжается с первого узла следующей; о смене сцены сообщают события
 * `scene:start` и `scene:end`. Метка `goto` может вести на узел или на сцену.
 *
 * Игру можно сохранить и вернуть к сохранённой точке: `snapshot()` и `restore()`.
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

    #currentSceneId = null;

    #nodeTypes = new Map();
    #snapshotProviders = new Map();

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
     * @apiName VN.registerSnapshotProvider
     * @apiGroup VN
     *
     * Подключает источник данных для снимка. Плагин, у которого есть
     * состояние (переменные, инвентарь), сообщает, как его сохранить
     * и как восстановить. Плагинам удобнее `api.snapshot.register`:
     * имя берётся из плагина, а при удалении плагина источник снимается.
     *
     * @param {string} name Имя источника, обычно имя плагина.
     * @param {Object} provider Объект `{ save(), load(data) }`. Функция `save`
     * возвращает данные, которые можно сериализовать в JSON; `load` принимает их же.
     * @returns {function} Функция, снимающая источник.
     * @throws {Error} Если имя занято или у источника нет save и load.
     *
     * @example
     * let gold = 0;
     *
     * game.registerSnapshotProvider('purse', {
     *     save: () => ({ gold }),
     *     load: (data) => { gold = data.gold; }
     * });
     */
    registerSnapshotProvider(name, provider) {
        if (this.#snapshotProviders.has(name)) {
            throw new Error(
                `Источник снимка "${name}" уже зарегистрирован`
            );
        }

        if (
            typeof provider?.save !== 'function' ||
            typeof provider?.load !== 'function'
        ) {
            throw new TypeError(
                `Источник снимка "${name}" должен иметь функции save и load`
            );
        }

        this.#snapshotProviders.set(name, provider);

        return () => this.#snapshotProviders.delete(name);
    }

    /**
     * @apiName VN.snapshot
     * @apiGroup VN
     *
     * Делает снимок игры: текущий узел плюс данные всех источников
     * (например, состояние из плагина `state`). Результат не связан
     * с живыми объектами игры и пригоден для JSON.
     *
     * @returns {Object} Снимок `{ version, nodeId, data }`.
     * @throws {Error} Если проект ещё не загружен.
     *
     * @example
     * const saved = game.snapshot();
     * localStorage.setItem('save', JSON.stringify(saved));
     */
    snapshot() {
        if (!this.#project) {
            throw new Error('snapshot(): проект ещё не загружен');
        }

        const data = {};

        for (const [name, provider] of this.#snapshotProviders) {
            data[name] = provider.save();
        }

        return structuredClone({
            version: 1,
            nodeId: this.#currentNodeId,
            data
        });
    }

    /**
     * @apiName VN.restore
     * @apiGroup VN
     *
     * Возвращает игру к снимку: загружает данные источников и заново
     * запускает узел, на котором был сделан снимок. Состояние ошибки
     * сбрасывается, поэтому восстановление помогает продолжить игру
     * после `story:error`.
     *
     * Перед восстановлением приходит событие `story:restoring`: плагины
     * убирают с экрана то, что относилось к старой позиции (кнопки выбора,
     * таймеры). После загрузки данных приходит `story:restored`.
     *
     * @param {Object} snapshot Снимок из `snapshot()`.
     * @throws {Error} Если проект не загружен, снимок неверен
     * или его узла в проекте нет. В этих случаях игра не меняется.
     *
     * @example
     * const saved = JSON.parse(localStorage.getItem('save'));
     * game.restore(saved);
     */
    restore(snapshot) {
        if (!this.#project) {
            throw new Error('restore(): проект ещё не загружен');
        }

        if (snapshot?.version !== 1 || typeof snapshot.data !== 'object' || snapshot.data === null) {
            throw new Error('restore(): неверный формат снимка');
        }

        const nodeId = snapshot.nodeId ?? null;

        if (nodeId !== null && !this.#project.getNode(nodeId)) {
            throw new Error(
                `restore(): узла "${nodeId}" нет в проекте`
            );
        }

        this.#bus.emit('story:restoring', { snapshot });

        this.#isWaiting = false;
        this.#isLocked = false;
        this.#failed = false;

        for (const name of Object.keys(snapshot.data)) {
            const provider = this.#snapshotProviders.get(name);

            if (!provider) {
                log.warn(
                    `restore(): источник "${name}" не установлен, его данные пропущены`
                );

                continue;
            }

            provider.load(structuredClone(snapshot.data[name]));
        }

        this.#currentSceneId = null;
        this.#setCurrent(nodeId);

        this.#bus.emit('story:restored', { snapshot });

        this.next();
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
        this.#currentSceneId = null;
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

        this.#setCurrent(firstScene.nodes[0].id);

        this.next();
    }

    // Меняет текущий узел и сообщает о смене сцены.
    #setCurrent(nodeId) {
        this.#currentNodeId = nodeId;

        const scene = nodeId === null
            ? null
            : this.#project?.getSceneForNode(nodeId);

        const sceneId = scene?.id ?? null;

        if (sceneId === this.#currentSceneId) {
            return;
        }

        if (this.#currentSceneId !== null) {
            this.#bus.emit('scene:end', { sceneId: this.#currentSceneId });
        }

        this.#currentSceneId = sceneId;

        if (sceneId !== null) {
            this.#bus.emit('scene:start', { sceneId, scene });
        }
    }

    // Узел, с которого начинается переход: узел по id или первый узел сцены.
    #resolveTarget(target) {
        const node = this.#project.getNode(target);

        if (node) {
            return node;
        }

        return this.#project.getScene(target)?.nodes?.[0] ?? null;
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

    const node = this.#resolveTarget(nodeId);

    if (!node) {
        log.warn(
            `goto(): узел или сцена "${nodeId}" не найдены`
        );

        return;
    }

    this.#setCurrent(node.id);
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

        // Если обработчик сам перешёл на другой узел (goto), история
        // уже пошла оттуда: двигаться дальше от этого узла не нужно.
        if (this.#currentNodeId !== node.id) {
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
        this.#setCurrent(null);

        this.#bus.emit('story:end');

        log.info(
            'История завершена'
        );

        return;
    }

    const nextNode =
        this.#project.getNextNode(node.id) ??
        this.#firstNodeOfNextScene(node.id);

    if (!nextNode) {
        this.#setCurrent(null);

        this.#bus.emit('story:end');

        log.info(
            'История завершена'
        );

        return;
    }

    this.#setCurrent(nextNode.id);

    this.next();
}

    // Когда сцена закончилась, история продолжается с начала следующей.
    #firstNodeOfNextScene(nodeId) {
        const scenes = this.#project.getScenes();
        const index = scenes.findIndex(
            scene => scene.nodes?.some(node => node.id === nodeId)
        );

        for (let i = index + 1; index !== -1 && i < scenes.length; i++) {
            if (scenes[i].nodes?.length) {
                return scenes[i].nodes[0];
            }
        }

        return null;
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