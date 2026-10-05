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
}