export class FlowResolver {
    #project;

    constructor(project) {
        this.#project = project;
    }

    resolve(nodeId) {
        const node = this.#project.getNode(nodeId);

        if (!node) {
            return null;
        }

        if (node.goto) {
            return this.#project.getNode(node.goto);
        }

        return this.#project.getNextNode(nodeId);
    }

    resolveChoice(nodeId, optionId) {
        const node = this.#project.getNode(nodeId);

        if (!node || node.type !== 'choice') {
            return null;
        }

        if (!Array.isArray(node.options)) {
            return null;
        }

        const option = node.options.find(
            option => option.id === optionId
        );

        if (!option) {
            return null;
        }

        /*
         * Пока условий у нас ещё нет.
         * Поэтому если у option есть прямой goto,
         * используем его.
         */
        if (option.goto) {
            return this.#project.getNode(option.goto);
        }

        return this.#project.getNextNode(nodeId);
    }
}