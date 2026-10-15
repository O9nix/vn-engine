import { logger } from './logger.js';

const log = logger.child('EventBus');

/**
 * @class EventBus
 * @apiGroup EventBus
 *
 * Шина событий. Ошибка в одном подписчике не мешает остальным:
 * она попадает в консоль и в событие `handler:error`
 * с данными `{ event, error }`.
 *
 * @example
 * const bus = new EventBus();
 *
 * const off = bus.on('hello', (name) => console.log('Привет,', name));
 * bus.emit('hello', 'мир');
 * off();
 */
export class EventBus {
    #listeners = new Map();

    /**
     * @apiName EventBus.on
     * @apiGroup EventBus
     *
     * Подписывает обработчик на событие.
     *
     * @param {string} type Имя события.
     * @param {function} handler Обработчик.
     * @returns {function} Функция отписки.
     *
     * @example
     * const off = bus.on('node:start', (node) => {
     *     console.log('Начался узел', node.id);
     * });
     *
     * off(); // отписка
     */
    on(type, handler) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set());
        }

        this.#listeners.get(type).add(handler);

        return () => this.off(type, handler);
    }

    /**
     * @apiName EventBus.off
     * @apiGroup EventBus
     *
     * Снимает обработчик с события.
     *
     * @param {string} type Имя события.
     * @param {function} handler Ранее добавленный обработчик.
     *
     * @example
     * const handler = (node) => console.log(node.id);
     * bus.on('node:start', handler);
     * bus.off('node:start', handler);
     */
    off(type, handler) {
        this.#listeners.get(type)?.delete(handler);
    }

    /**
     * @apiName EventBus.emit
     * @apiGroup EventBus
     *
     * Вызывает всех подписчиков события по порядку подписки.
     *
     * @param {string} type Имя события.
     * @param {*} [payload] Данные события.
     *
     * @example
     * bus.emit('my-plugin:ready', { version: 1 });
     */
    emit(type, payload) {
        // Копия: подписчики могут отписываться во время вызова.
        for (const handler of [...(this.#listeners.get(type) ?? [])]) {
            try {
                handler(payload);
            } catch (error) {
                log.error(
                    `Ошибка в обработчике события "${type}":`,
                    error
                );

                // Ошибка обработчика ошибок не должна зацикливать шину.
                if (type !== 'handler:error') {
                    this.emit('handler:error', { event: type, error });
                }
            }
        }
    }
}
