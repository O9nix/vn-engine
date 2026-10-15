/**
 * @class Project
 * @apiGroup Project
 *
 * Единый источник данных игры: сцены, узлы, конфигурация,
 * ресурсы и список плагинов, которые нужны проекту.
 *
 * @example
 * const project = new Project({
 *     plugins: ['state', 'dialogue'],
 *     config: { state: { health: 3 } },
 *     scenes: [{
 *         id: 'scene-1',
 *         nodes: [{ id: 'a', type: 'dialogue', character: 'Анна', text: 'Привет!' }]
 *     }]
 * });
 *
 * project.getNode('a');
 */
export class Project {
    #plugins;
    #metadata;
    #scenes;
    #config;
    #assets;

    constructor(data = {}) {
        this.#plugins = data.plugins ?? [];
        this.#metadata = data.metadata ?? {};
        this.#scenes = data.scenes ?? [];
        this.#config = data.config ?? {};
        this.#assets = data.assets ?? {};
    }

    /**
     * @apiName Project.getPlugins
     * @apiGroup Project
     *
     * Возвращает плагины, которые объявлены в проекте.
     * Элемент списка — имя плагина или объект `{ name, version }`.
     * Сами плагины устанавливает `loadProjectPlugins()`.
     *
     * @returns {Array} Список объявленных плагинов: строки
     * или объекты `{ name, version }`.
     *
     * @example
     * const project = new Project({
     *     plugins: ['state', { name: 'choice', version: '0.1.0' }]
     * });
     * project.getPlugins();
     */
    getPlugins() {
        return this.#plugins;
    }

    /**
     * @apiName Project.getMetadata
     * @apiGroup Project
     *
     * Возвращает описание проекта (название, автор и т.п.).
     *
     * @returns {Object} Метаданные; пустой объект, если не заданы.
     *
     * @example
     * const project = new Project({ metadata: { title: 'Демо' } });
     * project.getMetadata().title; // 'Демо'
     */
    getMetadata() {
        return this.#metadata;
    }
    /**
     * @apiName Project.getNode
     * @apiGroup Project
     *
     * Ищет узел по id во всех сценах.
     *
     * @param {string} id Id узла.
     * @returns {Object} Узел или null.
     *
     * @example
     * const node = project.getNode('intro');
     * if (!node) {
     *     console.warn('Узла нет');
     * }
     */
getNode(id) {
    for (const scene of this.#scenes) {
        const node = scene.nodes.find(
            node => node.id === id
        );

        if (node) {
            return node;
        }
    }

    return null;
}
    /**
     * @apiName Project.getNextNode
     * @apiGroup Project
     *
     * Возвращает узел, который идёт следом за указанным в той же сцене.
     *
     * @param {string} nodeId Id текущего узла.
     * @returns {Object} Следующий узел или null, если узел последний.
     *
     * @example
     * const next = project.getNextNode('intro');
     */
getNextNode(nodeId) {
    const scene = this.getSceneForNode(nodeId);

    if (!scene) {
        return null;
    }

    const index = scene.nodes.findIndex(
        node => node.id === nodeId
    );

    if (index === -1) {
        return null;
    }

    return scene.nodes[index + 1] ?? null;
}
    /**
     * @apiName Project.getSceneForNode
     * @apiGroup Project
     *
     * Находит сцену, в которой лежит узел.
     *
     * @param {string} nodeId Id узла.
     * @returns {Object} Сцена или null.
     *
     * @example
     * const scene = project.getSceneForNode('intro');
     * console.log(scene?.id);
     */
getSceneForNode(nodeId) {
    return this.#scenes.find(
        scene => scene.nodes.some(
            node => node.id === nodeId
        )
    ) ?? null;
}
    /**
     * @apiName Project.getScenes
     * @apiGroup Project
     *
     * Возвращает все сцены проекта.
     *
     * @returns {Object[]} Массив сцен `{ id, nodes }`.
     *
     * @example
     * for (const scene of project.getScenes()) {
     *     console.log(scene.id, scene.nodes.length);
     * }
     */
    getScenes() {
        return this.#scenes;
    }

    /**
     * @apiName Project.getScene
     * @apiGroup Project
     *
     * Возвращает сцену по id.
     *
     * @param {string} id Id сцены.
     * @returns {Object} Сцена или null.
     *
     * @example
     * const scene = project.getScene('scene-1');
     */
    getScene(id) {
        return this.#scenes.find(
            scene => scene.id === id
        ) ?? null;
    }

    /**
     * @apiName Project.getConfig
     * @apiGroup Project
     *
     * Возвращает настройки проекта. Здесь лежит, например, начальное состояние игры в `config.state`.
     *
     * @returns {Object} Конфигурация; пустой объект, если не задана.
     *
     * @example
     * const project = new Project({ config: { state: { health: 3 } } });
     * project.getConfig().state.health; // 3
     */
    getConfig() {
        return this.#config;
    }

    /**
     * @apiName Project.getAssets
     * @apiGroup Project
     *
     * Возвращает ресурсы проекта (картинки, звуки и т.п.).
     *
     * @returns {Object} Ресурсы; пустой объект, если не заданы.
     *
     * @example
     * const assets = project.getAssets();
     */
    getAssets() {
        return this.#assets;
    }

}