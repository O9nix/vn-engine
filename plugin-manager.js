import { logger } from './logger.js';

const log = logger.child('PluginManager');

/**
 * Версия Plugin API, которую поддерживает движок. Плагин может указать
 * `apiVersion` в манифесте; несовпадение версии — ошибка установки.
 */
export const PLUGIN_API_VERSION = 1;

/**
 * @class PluginManager
 * @apiGroup PluginManager
 * Устанавливает плагины и выдаёт каждому из них собственный Plugin API
 * (`plugin`, `log`, `events`, `game`, `player`, `blocks`, `ast`, `plugins`).
 *
 * Всё, что плагин занял через свой `api` (подписки на события, слои,
 * типы узлов, блоки, команды парсера), движок снимает сам при удалении
 * плагина или при сбое его установки.
 */
export class PluginManager {
    #plugins = new Map();
    #bus;
    #game;
    #player;
    #blocks;
    #ast;
    #pluginsProxy;

    /**
     * @apiName constructor
     * @apiGroup PluginManager
     * Запоминает зависимости движка. Для каждого плагина при установке
     * создаётся собственный `api`, который передаётся в `install(api)`.
     *
     * Структура api:
     * ```
     * api
     * ├── plugin
     * │   └── name                → имя этого плагина
     * ├── log
     * │   ├── info(...args)
     * │   ├── warn(...args)
     * │   └── error(...args)
     * ├── events
     * │   ├── on(event, handler) → unsubscribe
     * │   └── emit(event, payload)
     * ├── game
     * │   ├── getPluginLayer() → HTMLElement
     * │   ├── registerLayer(name, element) → cleanup
     * │   ├── registerNodeType(type, handler)
     * │   ├── show(name)
     * │   ├── hide(name)
     * │   └── isVisible(name) → boolean
     * ├── player
     * │   ├── getPluginLayer() → HTMLElement
     * │   ├── registerLayer(name, element) → cleanup
     * │   ├── show(name)
     * │   ├── hide(name)
     * │   └── isVisible(name) → boolean
     * ├── blocks                  → BlockManager
     * ├── ast
     * │   └── addCommand(pattern, nodeType, handler)
     * └── plugins                 → Proxy
     *     └── <name>.api          → публичный API плагина
     * ```
     *
     * @param {EventBus} bus Шина событий.
     * @param {VN} game Ядро: выполняет узлы истории.
     * @param {Player} player Плеер со слоями страницы.
     * @param {BlockManager} blocks Менеджер визуальных блоков.
     * @param {AST} [ast] Парсер сценария. Без него `api.ast.addCommand` выбрасывает ошибку.
     */
    constructor(
        bus,
        game,
        player,
        blocks,
        ast
    ) {
        this.#bus = bus;
        this.#game = game;
        this.#player = player;
        this.#blocks = blocks;
        this.#ast = ast ?? null;

        // Общий для всех плагинов доступ к публичным API друг друга.
        this.#pluginsProxy = new Proxy(
            {},
            {
                get: (_, name) => {
                    const entry = this.#plugins.get(name);

                    if (!entry) {
                        log.warn(
                            `Плагин "${String(name)}" не установлен`
                        );

                        return null;
                    }

                    return {
                        api: entry.api
                    };
                }
            }
        );
    }

    /**
     * Создаёт собственный api плагина и учёт его ресурсов.
     * Ресурсы записываются в `release` и снимаются в обратном порядке.
     */
    #createScope(pluginName) {
        const release = [];
        const bus = this.#bus;
        const game = this.#game;
        const player = this.#player;
        const ast = this.#ast;
        const blocks = this.#blocks;
        const pluginLog = logger.child(pluginName);

        const track = (fn) => {
            release.push(fn);
        };

        const registerLayer = (name, element) => {
            const remove = player.registerLayer(name, element);

            track(remove);

            return remove;
        };

        // Блоки, созданные плагином, удаляются вместе с ним.
        const ownBlocks = new Set();

        const scopedBlocks = {
            create: (type, options) => {
                const block = blocks.create(type, options);

                ownBlocks.add(block.id);

                return block;
            },
            get: (id) => blocks.get(id),
            getAll: () => blocks.getAll(),
            getByType: (type) => blocks.getByType(type),
            getActiveByChannel: (channel) => blocks.getActiveByChannel(channel),
            getCurrent: (channel) => blocks.getCurrent(channel),
            show: (id) => blocks.show(id),
            hide: (id) => blocks.hide(id),
            remove: (id) => {
                ownBlocks.delete(id);

                return blocks.remove(id);
            }
        };

        track(() => {
            for (const id of ownBlocks) {
                if (blocks.get?.(id)) {
                    blocks.remove(id);
                }
            }

            ownBlocks.clear();
        });

        const api = {
            /**
             * @apiName api.plugin
             * @apiGroup PluginAPI
             * Сведения о самом плагине.
             * @property {string} name Имя плагина из манифеста.
             */
            plugin: { name: pluginName },

            /**
             * @apiName api.log
             * @apiGroup PluginAPI
             * Сообщения в консоль с именем плагина: `[имя] сообщение`.
             * Методы: debug, info, warn, error. Уровень общий для движка (logger.setLevel).
             * @example
             * api.log.info('Плагин установлен');
             */
            log: {
                /**
                 * @apiName api.log.debug
                 * @apiGroup PluginAPI
                 * Подробное сообщение для отладки (по умолчанию скрыто).
                 * @param {*} args Что вывести.
                 */
                debug: (...args) => pluginLog.debug(...args),

                /**
                 * @apiName api.log.info
                 * @apiGroup PluginAPI
                 * @param {*} args Что вывести.
                 */
                info: (...args) => pluginLog.info(...args),

                /**
                 * @apiName api.log.warn
                 * @apiGroup PluginAPI
                 * @param {*} args Что вывести.
                 */
                warn: (...args) => pluginLog.warn(...args),

                /**
                 * @apiName api.log.error
                 * @apiGroup PluginAPI
                 * @param {*} args Что вывести.
                 */
                error: (...args) => pluginLog.error(...args)
            },

            /**
             * @apiName api.events
             * @apiGroup PluginAPI
             * Обёртка над EventBus. Подписки плагина снимаются автоматически
             * при его удалении.
             */
            events: {
                /**
                 * @apiName api.events.on
                 * @apiGroup PluginAPI
                 * Подписка на событие.
                 * @param {string} event Имя события.
                 * @param {function} handler Обработчик.
                 * @returns {function} Функция отписки.
                 * @example
                 * api.events.on('story:loaded', (data) => {
                 *     api.log.info('Проект загружен', data.project);
                 * });
                 */
                on: (event, handler) => {
                    const off = bus.on(event, handler);

                    track(off);

                    return off;
                },

                /**
                 * @apiName api.events.emit
                 * @apiGroup PluginAPI
                 * Эмит события.
                 * @param {string} event Имя события.
                 * @param {*} [payload] Данные события.
                 */
                emit: (event, payload) => bus.emit(event, payload)
            },

            /**
             * @apiName api.game
             * @apiGroup PluginAPI
             * Фасад к VN и Player: регистрация типов узлов и работа со слоями.
             * Типы узлов и слои плагина снимаются автоматически.
             */
            game: {
                /**
                 * @apiName api.game.getPluginLayer
                 * @apiGroup PluginAPI
                 * @returns {HTMLElement} DOM-слой плагинов.
                 */
                getPluginLayer: () => player.getPluginLayer(),

                /**
                 * @apiName api.game.registerLayer
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @param {HTMLElement} element DOM-элемент.
                 * @returns {function} Функция, удаляющая слой.
                 */
                registerLayer,

                /**
                 * @apiName api.game.registerNodeType
                 * @apiGroup PluginAPI
                 * Регистрирует обработчик типа узла сценария.
                 * context: { wait(options), resume(), goto(nodeId) }.
                 * `wait({ lock: true })` — ожидание, которое клик не пропускает.
                 * @param {string} type Имя типа узла.
                 * @param {function} handler (node, context) => void
                 */
                registerNodeType: (type, handler) => {
                    game.registerNodeType(type, handler);

                    track(() => game.unregisterNodeType?.(type));
                },

                /**
                 * @apiName api.game.show
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 */
                show: (name) => player.show(name),

                /**
                 * @apiName api.game.hide
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 */
                hide: (name) => player.hide(name),

                /**
                 * @apiName api.game.isVisible
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @returns {boolean}
                 */
                isVisible: (name) => player.isVisible(name)
            },

            /**
             * @apiName api.player
             * @apiGroup PluginAPI
             * Прямой доступ к Player (слои). Те же методы, что api.game.* для слоёв.
             */
            player: {
                /**
                 * @apiName api.player.getPluginLayer
                 * @apiGroup PluginAPI
                 * @returns {HTMLElement}
                 */
                getPluginLayer: () => player.getPluginLayer(),

                /**
                 * @apiName api.player.registerLayer
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @param {HTMLElement} element DOM-элемент.
                 * @returns {function} Функция, удаляющая слой.
                 */
                registerLayer,

                /**
                 * @apiName api.player.show
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 */
                show: (name) => player.show(name),

                /**
                 * @apiName api.player.hide
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 */
                hide: (name) => player.hide(name),

                /**
                 * @apiName api.player.isVisible
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @returns {boolean}
                 */
                isVisible: (name) => player.isVisible(name)
            },

            /**
             * @apiName api.blocks
             * @apiGroup PluginAPI
             * Менеджер блоков. Методы: create, get, getAll, getByType,
             * getActiveByChannel, getCurrent, show, hide, remove.
             * Блоки, созданные плагином, удаляются вместе с ним.
             * `create(type, { replace: true })` сначала убирает блоки того же канала.
             * @type {BlockManager}
             */
            blocks: scopedBlocks,

            /**
             * @apiName api.ast
             * @apiGroup PluginAPI
             * Доступ к парсеру сценария: плагин учит его распознавать
             * свои строки текста. Команды плагина снимаются при его удалении.
             */
            ast: {
                /**
                 * @apiName api.ast.addCommand
                 * @apiGroup PluginAPI
                 * Регистрирует текстовую команду парсера.
                 * @param {RegExp} pattern Регулярное выражение для строки сценария.
                 * @param {string} nodeType Тип узла, который создаёт команда.
                 * @param {function} handler (match, line, index, scene) => узел
                 * @throws {Error} Если PluginManager создан без парсера
                 * или такая команда уже зарегистрирована.
                 * @example
                 * api.ast.addCommand(/^\/\/\s*(.*)$/, 'narration', (match, line, index) => ({
                 *     type: 'narration',
                 *     text: match[1].trim()
                 * }));
                 */
                addCommand: (pattern, nodeType, handler) => {
                    if (!ast) {
                        throw new Error(
                            `PluginManager: плагин "${pluginName}" использует api.ast, ` +
                            'но менеджер создан без парсера'
                        );
                    }

                    ast.addCommand(pattern, nodeType, handler);

                    track(() => ast.removeCommand?.(pattern));
                }
            },

            /**
             * @apiName api.plugins
             * @apiGroup PluginAPI
             * Proxy к API установленных плагинов.
             * Доступ: `api.plugins.<name>.api`.
             * Если плагин не установлен — null + warning в консоль.
             * @example
             * const state = api.plugins.state.api.get();
             * api.plugins.state.api.set('health', 10);
             */
            plugins: this.#pluginsProxy
        };

        const dispose = () => {
            while (release.length) {
                try {
                    release.pop()();
                } catch (error) {
                    log.warn(
                        `Ошибка при освобождении ресурсов плагина "${pluginName}":`,
                        error
                    );
                }
            }
        };

        return { api, dispose };
    }

/**
 * @apiName PluginManager.use
 * @apiGroup PluginManager
 *
 * Устанавливает плагин после проверки его зависимостей.
 *
 * @param {Object} plugin Устанавливаемый плагин.
 * @returns {PluginManager} Текущий экземпляр менеджера.
 * @throws {Error} Если плагин некорректен, уже установлен
 * или его зависимости отсутствуют.
 *
 * @example
 * plugins.use(ConditionsPlugin);
 * plugins.use(ChoicePlugin);
 */
use(plugin) {
    if (
        !plugin ||
        typeof plugin.install !== 'function'
    ) {
        throw new TypeError(
            'Плагин должен содержать метод install(api)'
        );
    }

    const name = plugin.name;

    if (!name) {
        throw new Error(
            'У плагина должно быть имя'
        );
    }

    if (this.#plugins.has(name)) {
        throw new Error(
            `Плагин "${name}" уже установлен`
        );
    }

    if (
        plugin.apiVersion !== undefined &&
        plugin.apiVersion !== PLUGIN_API_VERSION
    ) {
        throw new Error(
            `PluginManager: плагин "${name}" рассчитан на Plugin API v${plugin.apiVersion}, ` +
            `движок поддерживает v${PLUGIN_API_VERSION}`
        );
    }

    const dependencies = plugin.dependencies ?? [];

    if (!Array.isArray(dependencies)) {
        throw new TypeError(
            `PluginManager: dependencies плагина "${name}" должны быть массивом`
        );
    }

     let dep = []
    for (const dependency of dependencies) {
        if (!this.#plugins.has(dependency)) {
            dep.push(dependency)
           
        }
    }


        if(dep.length){
         throw new Error(
                `PluginManager: плагин "${name}" требует установленный плагины "${dep.join(', ')}"`
            );

            }
    const scope = this.#createScope(name);

    let result;

    try {
        result = plugin.install(scope.api);
    } catch (error) {
        // Сбой установки: освобождаем всё, что плагин успел занять.
        scope.dispose();

        throw error;
    }

    let pluginApi = {};
    let cleanup = null;

    if (typeof result === 'function') {
        cleanup = result;
    } else if (result) {
        if (
            result.api &&
            typeof result.api === 'object'
        ) {
            pluginApi = result.api;
        }

        if (typeof result.cleanup === 'function') {
            cleanup = result.cleanup;
        }
    }

    this.#plugins.set(name, {
        plugin,
        api: pluginApi,
        cleanup,
        dispose: scope.dispose
    });

    log.info(
        `Плагин "${name}" установлен`
    );

    return this;
}



    /**
 * @apiName PluginManager.remove
 * @apiGroup PluginManager
 *
 * Удаляет установленный плагин, если от него
 * не зависят другие установленные плагины.
 *
 * @param {string} name Имя удаляемого плагина.
 * @returns {boolean} true, если плагин удалён,
 * или false, если он не был установлен.
 * @throws {Error} Если от плагина зависят другие
 * установленные плагины.
 *
 * @example
 * plugins.remove('choice');
 */
remove(name) {
    const entry = this.#plugins.get(name);

    if (!entry) {
        return false;
    }

    const dependents = [];

    for (const [pluginName, pluginEntry] of this.#plugins) {
        if (pluginName === name) {
            continue;
        }

        const dependencies =
            pluginEntry.plugin.dependencies ?? [];

        if (dependencies.includes(name)) {
            dependents.push(pluginName);
        }
    }

    if (dependents.length > 0) {
        throw new Error(
            `PluginManager: нельзя удалить плагин "${name}", ` +
            `поскольку от него зависят: ${dependents.join(', ')}`
        );
    }

    try {
        entry.cleanup?.();
    } catch (error) {
        log.warn(
            `Ошибка в cleanup плагина "${name}":`,
            error
        );
    }

    // Освобождаем то, что плагин не снял сам.
    entry.dispose();

    this.#plugins.delete(name);

    log.info(
        `Плагин "${name}" удалён`
    );

    return true;
}

    /**
     * @apiName has
     * @apiGroup PluginManager
     * @param {string} name Имя плагина
     * @returns {boolean}
     */
    has(name) {
        return this.#plugins.has(name);
    }

    /**
     * @apiName get
     * @apiGroup PluginManager
     * @param {string} name Имя плагина
     * @returns {Object|undefined} Исходный объект плагина
     */
    get(name) {
        return this.#plugins.get(name)?.plugin;
    }

    /**
     * @apiName list
     * @apiGroup PluginManager
     * @returns {string[]} Имена установленных плагинов
     */
    list() {
        return [
            ...this.#plugins.keys()
        ];
    }
}