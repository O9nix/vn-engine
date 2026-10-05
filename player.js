export class Player {
    #root;
    #pluginLayer;
    #layers = new Map();

    constructor(root = document.body) {
        this.#root = root;
        this.#createPluginLayer();
    }

    #createPluginLayer() {
        this.#pluginLayer = document.createElement('div');

        this.#pluginLayer.className = 'vn-plugin-layer';

        Object.assign(this.#pluginLayer.style, {
            position: 'absolute',
            inset: '0',
            pointerEvents: 'none',
            zIndex: '0'
        });

        this.#root.appendChild(this.#pluginLayer);
    }

    getPluginLayer() {
        return this.#pluginLayer;
    }

    registerLayer(name, element) {
        if (this.#layers.has(name)) {
            throw new Error(
                `Визуальный слой "${name}" уже зарегистрирован`
            );
        }

        if (!(element instanceof HTMLElement)) {
            throw new TypeError(
                `Слой "${name}" должен быть HTMLElement`
            );
        }

        this.#layers.set(name, element);

        return () => {
            this.#layers.delete(name);
            element.remove();
        };
    }

    show(name) {
        const element = this.#layers.get(name);

        if (!element) {
            console.warn(
                `Визуальный слой "${name}" не зарегистрирован`
            );
            return;
        }

        element.style.display = 'block';
    }

    hide(name) {
        const element = this.#layers.get(name);

        if (!element) {
            console.warn(
                `Визуальный слой "${name}" не зарегистрирован`
            );
            return;
        }

        element.style.display = 'none';
    }

    isVisible(name) {
        const element = this.#layers.get(name);

        if (!element) {
            return false;
        }

        return element.style.display !== 'none';
    }
}
