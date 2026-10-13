/**
 * @apiName normalizePluginRefs
 * @apiGroup PluginLoader
 *
 * Приводит список плагинов проекта к единому виду.
 * Элемент списка может быть строкой (имя) или объектом
 * `{ name, version }`.
 *
 * @param {Array} [refs] Список плагинов из `project.getPlugins()`.
 * Каждый элемент — строка или объект `{ name, version }`.
 * @returns {Object[]} Нормализованный список объектов
 * `{ name, version }` в порядке объявления.
 * @throws {Error} Если элемент некорректен или плагин объявлен дважды.
 *
 * @example
 * normalizePluginRefs(['state', { name: 'choice', version: '0.1.0' }]);
 * // [{ name: 'state', version: undefined },
 * //  { name: 'choice', version: '0.1.0' }]
 */
export function normalizePluginRefs(refs) {
    if (refs === undefined || refs === null) {
        return [];
    }

    if (!Array.isArray(refs)) {
        throw new TypeError(
            'Project: plugins должен быть массивом'
        );
    }

    const seen = new Set();

    return refs.map((ref, index) => {
        const item =
            typeof ref === 'string' ? { name: ref } : ref;

        if (
            !item ||
            typeof item.name !== 'string' ||
            !item.name
        ) {
            throw new TypeError(
                `Project: plugins[${index}] должен быть строкой ` +
                'или объектом с полем name'
            );
        }

        if (seen.has(item.name)) {
            throw new Error(
                `Project: плагин "${item.name}" объявлен дважды`
            );
        }

        seen.add(item.name);

        return { name: item.name, version: item.version };
    });
}

function dependenciesOf(plugin) {
    return Array.isArray(plugin.dependencies)
        ? plugin.dependencies
        : [];
}

/**
 * @apiName orderPlugins
 * @apiGroup PluginLoader
 *
 * Сортирует плагины так, чтобы каждый шёл после своих зависимостей.
 * Среди независимых плагинов сохраняется порядок объявления.
 *
 * @param {Object[]} plugins Плагины в порядке объявления в проекте.
 * @returns {Object[]} Плагины в порядке установки.
 * @throws {Error} Если зависимость не объявлена в проекте
 * или зависимости образуют цикл.
 *
 * @example
 * const ordered = orderPlugins([ChoicePlugin, StatePlugin, ConditionsPlugin]);
 * // state, conditions, choice
 */
export function orderPlugins(plugins) {
    const byName = new Map(
        plugins.map(plugin => [plugin.name, plugin])
    );

    const missing = [];

    for (const plugin of plugins) {
        for (const dependency of dependenciesOf(plugin)) {
            if (!byName.has(dependency)) {
                missing.push(
                    `"${plugin.name}" требует "${dependency}"`
                );
            }
        }
    }

    if (missing.length > 0) {
        throw new Error(
            'PluginLoader: зависимости не объявлены в проекте: ' +
            missing.join('; ')
        );
    }

    const ordered = [];
    const status = new Map(); // 1 — в обработке, 2 — готов

    const visit = (plugin, chain) => {
        const current = status.get(plugin.name);

        if (current === 2) {
            return;
        }

        if (current === 1) {
            const cycle = [
                ...chain.slice(chain.indexOf(plugin.name)),
                plugin.name
            ];

            throw new Error(
                'PluginLoader: циклическая зависимость плагинов: ' +
                cycle.join(' → ')
            );
        }

        status.set(plugin.name, 1);

        for (const dependency of dependenciesOf(plugin)) {
            visit(byName.get(dependency), [...chain, plugin.name]);
        }

        status.set(plugin.name, 2);
        ordered.push(plugin);
    };

    plugins.forEach(plugin => visit(plugin, []));

    return ordered;
}

/**
 * @apiName loadProjectPlugins
 * @apiGroup PluginLoader
 *
 * Устанавливает плагины, объявленные в проекте.
 *
 * Получает плагины из каталога по именам из `project.getPlugins()`,
 * сортирует их по зависимостям и устанавливает через `PluginManager`.
 * Если установка какого-то плагина завершилась ошибкой, уже
 * установленные плагины удаляются, и ошибка пробрасывается дальше.
 *
 * Вызывать нужно до `game.loadProject(project)`, чтобы плагины
 * успели подписаться на `story:loaded`.
 *
 * @param {Project} project Проект с объявленными плагинами.
 * @param {PluginRegistry} registry Каталог доступных плагинов.
 * @param {PluginManager} manager Менеджер, устанавливающий плагины.
 * @returns {Promise} Промис с массивом имён установленных плагинов
 * в порядке установки.
 * @throws {Error} Если плагин не найден, зависимости не объявлены,
 * есть цикл или установка завершилась ошибкой.
 *
 * @example
 * const installed = await loadProjectPlugins(project, registry, plugins);
 * game.loadProject(project);
 */
export async function loadProjectPlugins(project, registry, manager) {
    const refs = normalizePluginRefs(project.getPlugins());
    console.log(refs)
    const results = await Promise.allSettled(
        refs.map(ref => registry.resolve(ref.name, ref.version))
    );

    const resolved = [];
    const failures = [];

    results.forEach((result) => {
        if (result.status === 'fulfilled') {
            resolved.push(result.value);
        } else {
            failures.push(
                result.reason?.message ?? String(result.reason)
            );
        }
    });

    if (failures.length > 0) {
        throw new Error(
            'PluginLoader: не удалось получить плагины:\n- ' +
            failures.join('\n- ')
        );
    }

    const ordered = orderPlugins(resolved);
    const installed = [];

    try {
        for (const plugin of ordered) {
            manager.use(plugin);
            installed.push(plugin.name);
        }
    } catch (error) {
        for (const name of installed.reverse()) {
            try {
                manager.remove(name);
            } catch {
                // Откат best-effort: исходная ошибка важнее.
            }
        }

        throw error;
    }

    return installed;
}
