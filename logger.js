/**
 * Порядок уровней журнала: чем больше число, тем важнее сообщение.
 * Сообщения ниже выбранного уровня не выводятся.
 */
export const LOG_LEVELS = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    silent: 99
};

/**
 * @class Logger
 * @apiGroup Logger
 *
 * Журнал с уровнями и префиксом. Все журналы, созданные через `child`,
 * делят один уровень с исходным, поэтому его можно менять в одном месте.
 *
 * Сообщения выводятся в консоль в виде `[префикс] сообщение`.
 *
 * @example
 * import { logger } from './logger.js';
 *
 * const log = logger.child('VN');
 * log.warn('Узел не найден');
 * logger.setLevel('debug');
 */
export class Logger {
    #shared;
    #prefix;

    /**
     * @apiName Logger.constructor
     * @apiGroup Logger
     * Создаёт журнал.
     * @param {Object} [options] Параметры: `level` (по умолчанию info) и `prefix`.
     * @param {Object} [shared] Общее состояние уровня (используется методом child).
     *
     * @example
     * const log = new Logger({ level: 'warn', prefix: 'Моё' });
     * log.warn('Что-то не так'); // [Моё] Что-то не так
     */
    constructor(options = {}, shared = null) {
        const level = options.level ?? 'info';

        if (!(level in LOG_LEVELS)) {
            throw new Error(`Logger: неизвестный уровень "${level}"`);
        }

        this.#prefix = options.prefix ?? '';
        this.#shared = shared ?? { level };
    }

    /**
     * @apiName Logger.setLevel
     * @apiGroup Logger
     * Меняет уровень для этого журнала и всех его дочерних.
     * @param {string} level Один из уровней: debug, info, warn, error, silent.
     * @throws {Error} Если уровень неизвестен.
     *
     * @example
     * logger.setLevel('debug'); // показывать всё
     * logger.setLevel('silent'); // ничего не показывать
     */
    setLevel(level) {
        if (!(level in LOG_LEVELS)) {
            throw new Error(`Logger: неизвестный уровень "${level}"`);
        }

        this.#shared.level = level;
    }

    /**
     * @apiName Logger.getLevel
     * @apiGroup Logger
     * @returns {string} Текущий уровень.
     *
     * @example
     * if (logger.getLevel() === 'debug') {
     *     console.log('Включён подробный режим');
     * }
     */
    getLevel() {
        return this.#shared.level;
    }

    /**
     * @apiName Logger.child
     * @apiGroup Logger
     * Создаёт журнал с другим префиксом и общим уровнем.
     * @param {string} prefix Префикс сообщений, например имя класса или плагина.
     * @returns {Logger}
     *
     * @example
     * const log = logger.child('inventory');
     * log.info('Готово'); // [inventory] Готово
     */
    child(prefix) {
        return new Logger({ prefix }, this.#shared);
    }

    #write(level, method, args) {
        if (LOG_LEVELS[level] < LOG_LEVELS[this.#shared.level]) {
            return;
        }

        const head = this.#prefix ? [`[${this.#prefix}]`] : [];

        console[method](...head, ...args);
    }

    /**
     * @apiName Logger.debug
     * @apiGroup Logger
     * Подробное сообщение для отладки (по умолчанию скрыто).
     * @param {*} args Что вывести.
     *
     * @example
     * log.debug('Состояние', { health: 3 });
     */
    debug(...args) {
        this.#write('debug', 'log', args);
    }

    /**
     * @apiName Logger.info
     * @apiGroup Logger
     * Обычное сообщение о ходе работы.
     * @param {*} args Что вывести.
     *
     * @example
     * log.info('Проект загружен');
     */
    info(...args) {
        this.#write('info', 'log', args);
    }

    /**
     * @apiName Logger.warn
     * @apiGroup Logger
     * Предупреждение: работа продолжается.
     * @param {*} args Что вывести.
     *
     * @example
     * log.warn('Узел не найден:', nodeId);
     */
    warn(...args) {
        this.#write('warn', 'warn', args);
    }

    /**
     * @apiName Logger.error
     * @apiGroup Logger
     * Ошибка.
     * @param {*} args Что вывести.
     *
     * @example
     * log.error('Не удалось загрузить плагин', error);
     */
    error(...args) {
        this.#write('error', 'error', args);
    }
}

/**
 * Общий журнал движка. От него создаются дочерние журналы ядра и плагинов.
 */
export const logger = new Logger();
