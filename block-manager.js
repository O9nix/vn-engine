export class BlockManager {
    #root;
    #blocks = new Map();
    #current = new Map();
    #nextId = 1;

    constructor(root) {
        if (!(root instanceof HTMLElement)) {
            throw new TypeError(
                'BlockManager: root должен быть HTMLElement'
            );
        }

        this.#root = root;
    }

    create(type, options = {}) {
        if (!type || typeof type !== 'string') {
            throw new TypeError(
                'BlockManager.create(): type должен быть строкой'
            );
        }

        const {
            channel = 'default',
            element,
            data = {},
            meta = {}
        } = options;

        if (!(element instanceof HTMLElement)) {
            throw new TypeError(
                `BlockManager.create(): element для блока "${type}" должен быть HTMLElement`
            );
        }

        const id = `${type}-${this.#nextId++}`;

        const block = {
            id,
            type,
            channel,
            state: 'visible',
            element,
            data,
            meta
        };

        this.#blocks.set(id, block);

        this.#current.set(channel, id);

        this.#root.appendChild(element);

        return block;
    }

    get(id) {
        return this.#blocks.get(id) ?? null;
    }

    getAll() {
        return [...this.#blocks.values()];
    }

    getByType(type) {
        return this.getAll().filter(
            block => block.type === type
        );
    }

    getActiveByChannel(channel) {
        return this.getAll().filter(
            block =>
                block.channel === channel &&
                block.state === 'visible'
        );
    }

    getCurrent(channel) {
        const id = this.#current.get(channel);

        if (!id) {
            return null;
        }

        return this.#blocks.get(id) ?? null;
    }

    show(id) {
        const block = this.#blocks.get(id);

        if (!block) {
            console.warn(
                `BlockManager.show(): блок "${id}" не найден`
            );
            return;
        }

        block.state = 'visible';
        block.element.style.display = '';
    }

    hide(id) {
        const block = this.#blocks.get(id);

        if (!block) {
            console.warn(
                `BlockManager.hide(): блок "${id}" не найден`
            );
            return;
        }

        block.state = 'hidden';
        block.element.style.display = 'none';
    }

    remove(id) {
        const block = this.#blocks.get(id);

        if (!block) {
            console.warn(
                `BlockManager.remove(): блок "${id}" не найден`
            );
            return;
        }

        block.element.remove();

        this.#blocks.delete(id);

        if (this.#current.get(block.channel) === id) {
            this.#current.delete(block.channel);
        }
    }
}
