/**
 * @class PluginManager
 * @apiGroup PluginManager
 * Устанавливает плагины и предоставляет единый Plugin API
 * (`events`, `game`, `player`, `blocks`, `plugins`).
 */
export class PluginManager {
    #plugins = new Map();
    #api;
    /**
     * @apiName constructor
     * @apiGroup PluginManager
     * Собирает объект `api`, который каждый плагин получает в `install(api)`.
     *
     * Структура api:
     * ```
     * api
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
     * ├── blocks          → BlockManager
     * └── plugins         → Proxy
     *     └── <name>.api  → публичный API плагина
     * ```
     *
     * @param {EventBus} bus
     * @param {VN} game
     * @param {Player} player
     * @param {BlockManager} blocks
     */
    constructor(
        bus,
        game,
        player,
        blocks
    ) {
        /**
         * Единый API, передаваемый в `plugin.install(api)`.
         * @type {Object}
         * @property {Object} events
         * @property {function(string, function): function} events.on — подписка; возвращает функцию отписки
         * @property {function(string, *): void} events.emit — эмит события
         * @property {Object} game
         * @property {function(): HTMLElement} game.getPluginLayer — слой плагинов
         * @property {function(string, HTMLElement): function} game.registerLayer — регистрация слоя
         * @property {function(string, function): void} game.registerNodeType — регистрация типа узла
         * @property {function(string): void} game.show — показать слой
         * @property {function(string): void} game.hide — скрыть слой
         * @property {function(string): boolean} game.isVisible — видим ли слой
         * @property {Object} player
         * @property {function(): HTMLElement} player.getPluginLayer
         * @property {function(string, HTMLElement): function} player.registerLayer
         * @property {function(string): void} player.show
         * @property {function(string): void} player.hide
         * @property {function(string): boolean} player.isVisible
         * @property {BlockManager} blocks — менеджер визуальных блоков
         * @property {Object} plugins — Proxy: `api.plugins.<name>.api`
         */
        this.#api = {
            /**
             * @apiName api.events
             * @apiGroup PluginAPI
             * Обёртка над EventBus.
             */
            events: {
                /**
                 * @apiName api.events.on
                 * @apiGroup PluginAPI
                 * Подписка на событие.
                 * @param {string} event Имя события
                 * @param {function} handler Callback
                 * @returns {function} Функция отписки
                 * @example
                 * obj.doThing('x');
                 */
                on: (event, handler) =>
                    bus.on(event, handler),

                /**
                 * @apiName api.events.emit
                 * @apiGroup PluginAPI
                 * Эмит события.
                 * @param {string} event Имя события
                 * @param {*} [payload] Данные
                 */
                emit: (event, payload) =>
                    bus.emit(event, payload)
            },

            /**
             * @apiName api.game
             * @apiGroup PluginAPI
             * Фасад к VN + Player: регистрация типов узлов и работа со слоями.
             */
            game: {
                /**
                 * @apiName api.game.getPluginLayer
                 * @apiGroup PluginAPI
                 * @returns {HTMLElement} DOM-слой плагинов
                 */
                getPluginLayer: () =>
                    player.getPluginLayer(),

                /**
                 * @apiName api.game.registerLayer
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя
                 * @param {HTMLElement} element DOM-элемент
                 * @returns {function} cleanup
                 */
                registerLayer: (name, element) =>
                    player.registerLayer(name, element),

                /**
                 * @apiName api.game.registerNodeType
                 * @apiGroup PluginAPI
                 * Регистрирует обработчик типа узла сценария.
                 * context: { wait(), resume(), goto(nodeId) }
                 * @param {string} type Имя типа узла
                 * @param {function} handler (node, context) => void
                 */
                registerNodeType: (type, handler) =>
                    game.registerNodeType(type, handler),

                /**
                 * @apiName api.game.show
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя
                 */
                show: (name) =>
                    player.show(name),

                /**
                 * @apiName api.game.hide
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя
                 */
                hide: (name) =>
                    player.hide(name),

                /**
                 * @apiName api.game.isVisible
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя
                 * @returns {boolean}
                 */
                isVisible: (name) =>
                    player.isVisible(name)
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
                getPluginLayer: () =>
                    player.getPluginLayer(),

                /**
                 * @apiName api.player.registerLayer
                 * @apiGroup PluginAPI
                 * @param {string} name
                 * @param {HTMLElement} element
                 * @returns {function} cleanup
                 */
                registerLayer: (name, element) =>
                    player.registerLayer(name, element),

                /**
                 * @apiName api.player.show
                 * @apiGroup PluginAPI
                 * @param {string} name
                 */
                show: (name) =>
                    player.show(name),

                /**
                 * @apiName api.player.hide
                 * @apiGroup PluginAPI
                 * @param {string} name
                 */
                hide: (name) =>
                    player.hide(name),

                /**
                 * @apiName api.player.isVisible
                 * @apiGroup PluginAPI
                 * @param {string} name
                 * @returns {boolean}
                 */
                isVisible: (name) =>
                    player.isVisible(name)
            },

            /**
             * @apiName api.blocks
             * @apiGroup PluginAPI
             * Экземпляр BlockManager.
             * Методы: create, get, getAll, getByType, getActiveByChannel,
             * getCurrent, show, hide, remove.
             * @type {BlockManager}
             */
            blocks,

            

            /**
             * @apiName api.plugins
             * @apiGroup PluginAPI
             * Proxy к API установленных плагинов.
             * Доступ: `api.plugins.<name>.api`
             * Если плагин не установлен — null + warning в консоль.
             * @example
             * const state = api.plugins.state.api.get();
             * api.plugins.state.api.set('health', 10);
             */
            plugins: new Proxy(
                {},
                {
                    get: (_, name) => {
                        const entry =
                            this.#plugins.get(name);

                        if (!entry) {
                            console.warn(
                                `[PluginManager] Плагин "${String(name)}" не установлен`
                            );

                            return null;
                        }

                        return {
                            api: entry.api
                        };
                    }
                }
            )
        };
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
    const result = plugin.install(this.#api);

    let pluginApi = {};
    let cleanup = null;

    if (result) {
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
        cleanup
    });

    console.log(
        `[PluginManager] Плагин "${name}" установлен`
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

    if (entry.cleanup) {
        entry.cleanup();
    }

    this.#plugins.delete(name);

    console.log(
        `[PluginManager] Плагин "${name}" удалён`
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