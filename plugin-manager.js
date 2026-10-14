/**
 * @class PluginManager
 * @apiGroup PluginManager
 * Устанавливает плагины и предоставляет единый Plugin API
 * (`events`, `game`, `player`, `blocks`, `plugins`).
 */
/**
 * Версия Plugin API, которую поддерживает движок. Плагин может указать
 * `apiVersion` в манифесте; несовпадение версии — ошибка установки.
 */
export const PLUGIN_API_VERSION = 1;

export class PluginManager {
    #plugins = new Map();
    #bus;
    #game;
    #player;
    #blocks;
    #pluginsProxy;
    #parser;
    /**
     * @apiName constructor
     * @apiGroup PluginManager
     * Запоминает зависимости движка. Для каждого плагина при установке
     * создаётся собственный `api`: всё, что плагин через него зарегистрировал
     * (подписки на события, слои, типы узлов), движок снимает сам при удалении
     * плагина или при сбое установки.
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
        blocks,
        // validator,
        parser
    ) {
        this.#bus = bus;
        this.#game = game;
        this.#player = player;
        this.#blocks = blocks;
        this.#parser = parser;
        // Общий для всех плагинов доступ к публичным API друг друга.
        this.#pluginsProxy = new Proxy(
            {},
            {
                get: (_, name) => {
                    const entry = this.#plugins.get(name);

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
        const parser = this.#parser;
        const track = (fn) => {
            release.push(fn);
        };

        const registerLayer = (name, element) => {
            const remove = player.registerLayer(name, element);

            track(remove);

            return remove;
        };

        // Блоки, созданные плагином, удаляются вместе с ним.
        const blocks = this.#blocks;
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
            plugin: { name: pluginName },

            // Сообщения в консоль с именем плагина.
            log: {
                info: (...args) => console.log(`[${pluginName}]`, ...args),
                warn: (...args) => console.warn(`[${pluginName}]`, ...args),
                error: (...args) => console.error(`[${pluginName}]`, ...args)
            },

            events: {
                on: (event, handler) => {
                    const off = bus.on(event, handler);

                    track(off);

                    return off;
                },
                emit: (event, payload) => bus.emit(event, payload)
            },

            game: {
                getPluginLayer: () => player.getPluginLayer(),
                registerLayer,
                registerNodeType: (type, handler) => {
                    game.registerNodeType(type, handler);

                    track(() => game.unregisterNodeType?.(type));
                },
                show: (name) => player.show(name),
                hide: (name) => player.hide(name),
                isVisible: (name) => player.isVisible(name)
            },

            player: {
                getPluginLayer: () => player.getPluginLayer(),
                registerLayer,
                show: (name) => player.show(name),
                hide: (name) => player.hide(name),
                isVisible: (name) => player.isVisible(name)
            },
            ast: {
                addCommand: (pattern,node,handler)=> {
                    console.log(parser)
                     if (!parser) {
                        console.error(`[PluginManager] Ошибка: parser не передан в менеджер! Плагин "${pluginName}" не может зарегистрировать команду.`);
                        return;
                    }
                        parser.addCommand(pattern,node,handler)
                } 
            },
            blocks: scopedBlocks,

            plugins: this.#pluginsProxy
        };

        const dispose = () => {
            while (release.length) {
                try {
                    release.pop()();
                } catch (error) {
                    console.warn(
                        `[PluginManager] Ошибка при освобождении ресурсов плагина "${pluginName}":`,
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

    try {
        entry.cleanup?.();
    } catch (error) {
        console.warn(
            `[PluginManager] Ошибка в cleanup плагина "${name}":`,
            error
        );
    }

    // Освобождаем то, что плагин не снял сам.
    entry.dispose();

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