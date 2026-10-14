/**
 * @class Project
 * @apiGroup Project
 *
 * Единый источник данных игры: сцены, узлы, конфигурация,
 * ресурсы и список плагинов, которые нужны проекту.
 */
export class Project {
    #plugins;
    #metadata;
    #scenes;
    #config;
    #assets;
#sourceText;

    constructor(data = {}) {
        this.#plugins = data.plugins ?? [];
        this.#metadata = data.metadata ?? {};
        this.#scenes = data.scenes ?? [];
        this.#config = data.config ?? {};
        this.#assets = data.assets ?? {};
        this.#sourceText = data.sourceText ?? ''; // <-- принимаем исходный текст
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

    getMetadata() {
        return this.#metadata;
    }
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
getSceneForNode(nodeId) {
    return this.#scenes.find(
        scene => scene.nodes.some(
            node => node.id === nodeId
        )
    ) ?? null;
}
    getScenes() {
        return this.#scenes;
    }

    getScene(id) {
        return this.#scenes.find(
            scene => scene.id === id
        ) ?? null;
    }

    getConfig() {
        return this.#config;
    }

    getAssets() {
        return this.#assets;
    }
    /**
     * Возвращает исходный текст сценария (DSL-текст), если он был передан при создании.
     * Полезно для редактора и отладки.
     */
    getSourceText() {
        return this.#sourceText;
    }

}