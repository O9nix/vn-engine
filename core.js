import { EventBus } from './events.js';

export class VN {
    #bus = new EventBus();
    #script = [];
    #state = {};
    #currentIndex = 0;
    #isWaiting = false;
    #nodeTypes = new Map();

    constructor() {
        this.#bus.on('click-game', () => {
            this.#continue();
        });
    }

    getBus() {
        return this.#bus;
    }

    getState() {
        return { ...this.#state };
    }

    registerNodeType(type, handler) {
        if (this.#nodeTypes.has(type)) {
            throw new Error(`Тип узла "${type}" уже зарегистрирован`);
        }

        if (typeof handler !== 'function') {
            throw new TypeError(
                `Обработчик узла "${type}" должен быть функцией`
            );
        }

        this.#nodeTypes.set(type, handler);
    }

    loadScript(script) {
        this.#script = script;
        this.#state = {};
        this.#currentIndex = 0;
        this.#isWaiting = false;

        this.#bus.emit('story:loaded');

        console.log(
            'Сценарий загружен, узлов:',
            this.#script.length
        );

        this.next();
    }

    next() {
        if (this.#isWaiting) {
            return;
        }

        while (this.#currentIndex < this.#script.length) {
            const node = this.#script[this.#currentIndex];

            this.#processNode(node);

            if (this.#isWaiting) {
                return;
            }

            this.#currentIndex++;
        }

        this.#bus.emit('story:end');

        console.log('История завершена');
    }

    #processNode(node) {
        this.#bus.emit('node:start', node);

        const handler = this.#nodeTypes.get(node.type);

        if (!handler) {
            console.warn(
                `Неизвестный тип узла: ${node.type}`
            );
            return;
        }

        handler(node, {
            wait: () => {
                this.#isWaiting = true;
            },

            resume: () => {
                this.#continue();
            },

            getState: () => {
                return this.getState();
            }
        });
    }

    #continue() {
        if (!this.#isWaiting) {
            return;
        }

        this.#isWaiting = false;

        this.#currentIndex++;

        this.next();
    }
}
