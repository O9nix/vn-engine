export class PluginManager {
    #plugins = new Map();
    #services = new Map();
    #api;

    constructor(
        bus,
        game,
        player,
        blocks,
        conditions
    ) {
        this.#api = {
            events: {
                on: (event, handler) =>
                    bus.on(event, handler),

                emit: (event, payload) =>
                    bus.emit(event, payload)
            },

            game: {
                getPluginLayer: () =>
                    player.getPluginLayer(),

                registerLayer: (name, element) =>
                    player.registerLayer(name, element),

                registerNodeType: (type, handler) =>
                    game.registerNodeType(type, handler),

                show: (name) =>
                    player.show(name),

                hide: (name) =>
                    player.hide(name),

                isVisible: (name) =>
                    player.isVisible(name)
            },

            player: {
                getPluginLayer: () =>
                    player.getPluginLayer(),

                registerLayer: (name, element) =>
                    player.registerLayer(name, element),

                show: (name) =>
                    player.show(name),

                hide: (name) =>
                    player.hide(name),

                isVisible: (name) =>
                    player.isVisible(name)
            },

            blocks,

            conditions: {
                evaluate: (condition, state) =>
                    conditions.evaluate(
                        condition,
                        state
                    )
            },

            services: {
                register: (name, service) => {
                    if (!name) {
                        throw new Error(
                            'Имя сервиса обязательно'
                        );
                    }

                    if (this.#services.has(name)) {
                        throw new Error(
                            `Сервис "${name}" уже зарегистрирован`
                        );
                    }

                    this.#services.set(
                        name,
                        service
                    );

                    return () => {
                        this.#services.delete(name);
                    };
                },

                get: (name) => {
                    return this.#services.get(name) ?? null;
                },

                has: (name) => {
                    return this.#services.has(name);
                }
            }
        };
    }

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

        const cleanup = plugin.install(
            this.#api
        );

        this.#plugins.set(name, {
            plugin,
            cleanup:
                typeof cleanup === 'function'
                    ? cleanup
                    : null
        });

        console.log(
            `[PluginManager] Плагин "${name}" установлен`
        );

        return this;
    }

    remove(name) {
        const entry =
            this.#plugins.get(name);

        if (!entry) {
            return false;
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

    has(name) {
        return this.#plugins.has(name);
    }

    get(name) {
        return this.#plugins.get(name)?.plugin;
    }

    list() {
        return [
            ...this.#plugins.keys()
        ];
    }
}