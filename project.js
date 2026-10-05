export class Project {
    #story = [];
    #config = {};
    #assets = {};

    constructor(data = {}) {
        this.#story = data.story ?? [];
        this.#config = data.config ?? {};
        this.#assets = data.assets ?? {};
    }

    getStory() {
        return this.#story;
    }

    getConfig() {
        return this.#config;
    }

    getAssets() {
        return this.#assets;
    }
}