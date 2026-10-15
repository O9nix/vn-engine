import { logger } from './logger.js';

const log = logger.child('BlockManager');

/**
 * @class BlockManager
 * @apiGroup BlockManager
 * Хранит визуальные блоки (диалог, выбор и т.п.) и размещает их в корневом элементе.
 *
 * @example
 * const blocks = new BlockManager(document.getElementById('game'));
 *
 * const element = document.createElement('div');
 * const block = blocks.create('note', { channel: 'overlay', element });
 *
 * blocks.hide(block.id);
 * blocks.remove(block.id);
 */
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

    /**
     * @apiName BlockManager.create
     * @apiGroup BlockManager
     *
     * Создаёт блок и добавляет его элемент в корень.
     *
     * Опции: `channel` (строка, по умолчанию default), `element` (HTMLElement),
     * `data`, `meta` и `replace` (true — сначала удалить все блоки этого канала,
     * чтобы старые не накапливались).
     *
     * @param {string} type Тип блока.
     * @param {Object} [options] Параметры блока.
     * @returns {Object} Созданный блок.
     *
     * @example
     * const element = document.createElement('div');
     * element.textContent = 'Привет';
     *
     * const block = blocks.create('hello', {
     *     channel: 'overlay',
     *     element,
     *     data: { text: 'Привет' },
     *     replace: true
     * });
     *
     * console.log(block.id);
     */
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
            meta = {},
            replace = false
        } = options;

        if (!(element instanceof HTMLElement)) {
            throw new TypeError(
                `BlockManager.create(): element для блока "${type}" должен быть HTMLElement`
            );
        }

        if (replace) {
            for (const old of this.getAll()) {
                if (old.channel === channel) {
                    this.remove(old.id);
                }
            }
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

    /**
     * @apiName BlockManager.get
     * @apiGroup BlockManager
     *
     * Возвращает блок по id.
     *
     * @param {string} id Id блока (например, `dialogue-1`).
     * @returns {Object} Блок или null, если такого нет.
     *
     * @example
     * const block = blocks.get('dialogue-1');
     * if (block) {
     *     console.log(block.state); // visible или hidden
     * }
     */
    get(id) {
        return this.#blocks.get(id) ?? null;
    }

    /**
     * @apiName BlockManager.getAll
     * @apiGroup BlockManager
     *
     * Возвращает все существующие блоки в порядке создания.
     *
     * @returns {Object[]} Массив блоков.
     *
     * @example
     * for (const block of blocks.getAll()) {
     *     console.log(block.id, block.channel);
     * }
     */
    getAll() {
        return [...this.#blocks.values()];
    }

    /**
     * @apiName BlockManager.getByType
     * @apiGroup BlockManager
     *
     * Возвращает блоки одного типа.
     *
     * @param {string} type Тип блока, например choice.
     * @returns {Object[]} Массив блоков.
     *
     * @example
     * const choices = blocks.getByType('choice');
     * console.log(choices.length);
     */
    getByType(type) {
        return this.getAll().filter(
            block => block.type === type
        );
    }

    /**
     * @apiName BlockManager.getActiveByChannel
     * @apiGroup BlockManager
     *
     * Возвращает видимые блоки канала. Скрытые блоки в результат не попадают.
     *
     * @param {string} channel Имя канала, например overlay.
     * @returns {Object[]} Массив блоков.
     *
     * @example
     * const visible = blocks.getActiveByChannel('overlay');
     */
    getActiveByChannel(channel) {
        return this.getAll().filter(
            block =>
                block.channel === channel &&
                block.state === 'visible'
        );
    }

    /**
     * @apiName BlockManager.getCurrent
     * @apiGroup BlockManager
     *
     * Возвращает последний созданный блок канала.
     *
     * @param {string} channel Имя канала.
     * @returns {Object} Блок или null, если в канале блоков нет.
     *
     * @example
     * const current = blocks.getCurrent('dialogue');
     * if (current) {
     *     blocks.hide(current.id);
     * }
     */
    getCurrent(channel) {
        const id = this.#current.get(channel);

        if (!id) {
            return null;
        }

        return this.#blocks.get(id) ?? null;
    }

    /**
     * @apiName BlockManager.show
     * @apiGroup BlockManager
     *
     * Показывает скрытый блок. Если блока нет, пишет предупреждение в консоль.
     *
     * @param {string} id Id блока.
     *
     * @example
     * blocks.show('dialogue-1');
     */
    show(id) {
        const block = this.#blocks.get(id);

        if (!block) {
            log.warn(
                `show(): блок "${id}" не найден`
            );
            return;
        }

        block.state = 'visible';
        block.element.style.display = '';
    }

    /**
     * @apiName BlockManager.hide
     * @apiGroup BlockManager
     *
     * Скрывает блок, не удаляя его. Если блока нет, пишет предупреждение в консоль.
     *
     * @param {string} id Id блока.
     *
     * @example
     * blocks.hide('dialogue-1');
     */
    hide(id) {
        const block = this.#blocks.get(id);

        if (!block) {
            log.warn(
                `hide(): блок "${id}" не найден`
            );
            return;
        }

        block.state = 'hidden';
        block.element.style.display = 'none';
    }

    /**
     * @apiName BlockManager.remove
     * @apiGroup BlockManager
     *
     * Удаляет блок вместе с его DOM-элементом. Если блока нет, пишет предупреждение в консоль.
     *
     * @param {string} id Id блока.
     *
     * @example
     * const block = blocks.create('note', { element });
     * blocks.remove(block.id);
     */
    remove(id) {
        const block = this.#blocks.get(id);

        if (!block) {
            log.warn(
                `remove(): блок "${id}" не найден`
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
