/**
 * @apiName localPluginLoader
 * @apiGroup PluginRegistry
 *
 * Загрузчик плагинов из папки `plugins/` рядом с движком.
 *
 * Плагин `choice` ищется в файле `plugins/choice-plugin.js` и должен
 * экспортировать объект плагина через `export default`. Имя плагина
 * проверяет `PluginRegistry` до вызова загрузчика, поэтому в путь
 * попадают только безопасные имена.
 *
 * @param {string} name Имя плагина.
 * @returns {Promise} Промис с объектом плагина.
 * @throws {Error} Если файла нет или модуль не экспортирует
 * плагин через `export default`.
 *
 * @example
 * const registry = new PluginRegistry({ loader: localPluginLoader });
 */
export async function localPluginLoader(name) {
    const url = new URL(
        `./plugins/${name}-plugin.js`,
        import.meta.url
    );

    const module = await import(url.href);

    if (!module.default) {
        throw new Error(
            `модуль ${name}-plugin.js не экспортирует плагин через export default`
        );
    }

    return module.default;
}
