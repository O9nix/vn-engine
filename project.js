export class Project {
    #metadata;
    #scenes;
    #config;
    #assets;

    constructor(data = {}) {
        this.#metadata = data.metadata ?? {};
        this.#scenes = data.scenes ?? [];
        this.#config = data.config ?? {};
        this.#assets = data.assets ?? {};
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
}