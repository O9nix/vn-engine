import { logger } from './logger.js';

const log = logger.child('Player');

/**
 * @class Player
 * @apiGroup Player
 *
 * Отображение игры: хранит корневой элемент и именованные слои,
 * которые плагины показывают и скрывают.
 *
 * @example
 * const player = new Player(document.getElementById('game'));
 *
 * const hud = document.createElement('div');
 * player.registerLayer('hud', hud);
 * player.hide('hud');
 */
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

    /**
     * @apiName Player.getPluginLayer
     * @apiGroup Player
     *
     * Возвращает общий DOM-слой, в который плагины могут добавлять свои элементы.
     *
     * @returns {HTMLElement} Слой плагинов.
     *
     * @example
     * const layer = player.getPluginLayer();
     * layer.appendChild(document.createElement('div'));
     */
    getPluginLayer() {
        return this.#pluginLayer;
    }

    /**
     * @apiName Player.registerLayer
     * @apiGroup Player
     *
     * Регистрирует именованный слой, которым потом можно управлять через show и hide.
     *
     * @param {string} name Уникальное имя слоя.
     * @param {HTMLElement} element DOM-элемент слоя.
     * @returns {function} Функция, удаляющая слой.
     *
     * @example
     * const hud = document.createElement('div');
     * const remove = player.registerLayer('hud', hud);
     * player.show('hud');
     *
     * remove(); // слой и его элемент удалены
     */
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

    /**
     * @apiName Player.show
     * @apiGroup Player
     *
     * Показывает слой. Если слоя нет, пишет предупреждение в консоль.
     *
     * @param {string} name Имя слоя.
     *
     * @example
     * player.show('hud');
     */
    show(name) {
        const element = this.#layers.get(name);

        if (!element) {
            log.warn(
                `Визуальный слой "${name}" не зарегистрирован`
            );
            return;
        }

        element.style.display = 'block';
    }

    /**
     * @apiName Player.hide
     * @apiGroup Player
     *
     * Скрывает слой. Если слоя нет, пишет предупреждение в консоль.
     *
     * @param {string} name Имя слоя.
     *
     * @example
     * player.hide('hud');
     */
    hide(name) {
        const element = this.#layers.get(name);

        if (!element) {
            log.warn(
                `Визуальный слой "${name}" не зарегистрирован`
            );
            return;
        }

        element.style.display = 'none';
    }

    /**
     * @apiName Player.isVisible
     * @apiGroup Player
     *
     * Проверяет, показан ли слой.
     *
     * @param {string} name Имя слоя.
     * @returns {boolean} true, если слой есть и не скрыт.
     *
     * @example
     * if (!player.isVisible('hud')) {
     *     player.show('hud');
     * }
     */
    isVisible(name) {
        const element = this.#layers.get(name);

        if (!element) {
            return false;
        }

        return element.style.display !== 'none';
    }
}
