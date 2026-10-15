const PLUGIN_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * @class PluginRegistry
 * @apiGroup PluginRegistry
 *
 * Каталог доступных плагинов: по имени отдаёт объект плагина.
 *
 * Плагин можно добавить вручную (`register()`) или дать каталогу
 * загрузчик (`loader`), который получает плагин по имени. Интерфейс
 * `resolve()` асинхронный, поэтому загрузчик может быть как
 * локальным, так и обращаться к внешнему сервису: остальной код
 * движка об этом не знает.
 *
 * Имя плагина должно состоять из строчных латинских букв, цифр
 * и дефисов (`choice`, `top-left-hud`). Это проверяется до вызова
 * загрузчика, потому что имя приходит из данных проекта.
 *
 * Минимальный манифест плагина:
 * ```
 * {
 *     name: 'choice',                        // обязательно, уникальное имя
 *     version: '0.1.0',                      // версия плагина
 *     dependencies: ['state', 'conditions'], // имена нужных плагинов
 *     nodeTypes: ['choice'],                 // типы узлов, которые даёт плагин
 *     install(api) { ... }                   // обязательно
 * }
 * ```
 *
 * @example
 * const registry = new PluginRegistry({ loader: localPluginLoader });
 *
 * registry.register({ name: 'hello', install() {} });
 * const plugin = await registry.resolve('choice');
 */
export class PluginRegistry {
    #plugins = new Map();
    #loading = new Map();
    #loader;

    /**
     * @apiName PluginRegistry.constructor
     * @apiGroup PluginRegistry
     *
     * Создаёт каталог.
     *
     * @param {Object} [options] Параметры каталога.
     * @param {function} [options.loader]
     * Загрузчик `(name) => Promise`: по имени плагина возвращает
     * промис с его объектом. Вызывается,
     * только если плагина нет среди добавленных вручную или уже
     * загруженных. Результат запоминается.
     *
     * @example
     * const registry = new PluginRegistry({ loader: localPluginLoader });
     */
    constructor({ loader } = {}) {
        if (loader !== undefined && typeof loader !== 'function') {
            throw new TypeError(
                'PluginRegistry: loader должен быть функцией'
            );
        }

        this.#loader = loader ?? null;
    }

    /**
     * @apiName PluginRegistry.register
     * @apiGroup PluginRegistry
     *
     * Добавляет плагин в каталог вручную.
     *
     * @param {Object} plugin Плагин с полями `name` и `install`.
     * @returns {PluginRegistry} Текущий каталог (для цепочки вызовов).
     * @throws {Error} Если у плагина нет имени или метода `install`,
     * либо плагин с таким именем уже есть.
     *
     * @example
     * const registry = new PluginRegistry();
     * registry.register(StatePlugin).register(ChoicePlugin);
     */
    register(plugin) {
        this.#validate(plugin);

        if (this.#plugins.has(plugin.name)) {
            throw new Error(
                `PluginRegistry: плагин "${plugin.name}" уже зарегистрирован`
            );
        }

        this.#plugins.set(plugin.name, plugin);

        return this;
    }

    #validate(plugin) {
        if (!plugin || typeof plugin.install !== 'function') {
            throw new TypeError(
                'PluginRegistry: плагин должен содержать метод install(api)'
            );
        }

        if (typeof plugin.name !== 'string' || !plugin.name) {
            throw new Error(
                'PluginRegistry: у плагина должно быть имя'
            );
        }
    }

    /**
     * @apiName PluginRegistry.resolve
     * @apiGroup PluginRegistry
     *
     * Возвращает плагин по имени. Если плагина нет среди добавленных
     * вручную или уже загруженных, вызывает загрузчик.
     *
     * Версия сейчас сравнивается только на точное совпадение
     * (диапазоны вроде `^1.0` пока не поддерживаются).
     *
     * @param {string} name Имя плагина.
     * @param {string} [version] Требуемая версия. Если не указана,
     * подойдёт любая.
     * @returns {Promise} Промис с объектом плагина.
     * @throws {Error} Если имя недопустимо, плагин не найден или не
     * загрузился, имя загруженного плагина не совпадает с запрошенным
     * либо версия не совпадает с требуемой.
     *
     * @example
     * const plugin = await registry.resolve('choice');
     */
    async resolve(name, version) {
        const plugin = await this.#find(name);

        if (
            version !== undefined &&
            plugin.version !== undefined &&
            plugin.version !== version
        ) {
            throw new Error(
                `плагин "${name}": требуется версия ${version}, ` +
                `доступна ${plugin.version}`
            );
        }

        return plugin;
    }

    async #find(name) {
        if (typeof name !== 'string' || !PLUGIN_NAME_PATTERN.test(name)) {
            throw new Error(
                `недопустимое имя плагина "${String(name)}" ` +
                '(разрешены строчные латинские буквы, цифры и дефисы)'
            );
        }

        const known = this.#plugins.get(name);

        if (known) {
            return known;
        }

        if (!this.#loader) {
            throw new Error(`плагин "${name}" не найден в каталоге`);
        }

        // Два параллельных resolve() одного имени грузят плагин один раз.
        if (!this.#loading.has(name)) {
            this.#loading.set(name, this.#load(name));
        }

        try {
            return await this.#loading.get(name);
        } finally {
            this.#loading.delete(name);
        }
    }

    async #load(name) {
        let plugin;

        try {
            plugin = await this.#loader(name);
        } catch (error) {
            throw new Error(
                `плагин "${name}" не удалось загрузить: ` +
                (error?.message ?? String(error))
            );
        }

        try {
            this.#validate(plugin);
        } catch (error) {
            throw new Error(
                `плагин "${name}" некорректен: ${error.message}`
            );
        }

        if (plugin.name !== name) {
            throw new Error(
                `загружен плагин "${plugin.name}" вместо запрошенного "${name}"`
            );
        }

        this.#plugins.set(name, plugin);

        return plugin;
    }

    /**
     * @apiName PluginRegistry.has
     * @apiGroup PluginRegistry
     * @param {string} name Имя плагина
     * @returns {boolean} Есть ли плагин среди добавленных или
     * уже загруженных
     *
     * @example
     * if (!registry.has('noty')) {
     *     registry.register(NotyPlugin);
     * }
     */
    has(name) {
        return this.#plugins.has(name);
    }

    /**
     * @apiName PluginRegistry.list
     * @apiGroup PluginRegistry
     * @returns {string[]} Имена добавленных и уже загруженных плагинов
     *
     * @example
     * console.log(registry.list()); // ['state', 'noty']
     */
    list() {
        return [...this.#plugins.keys()];
    }
}
