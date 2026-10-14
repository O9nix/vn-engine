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
 *
 * Сбой одного плагина не отменяет остальные: плагин, который не удалось
 * получить или установить, попадает в `failed`, а плагины, которые от него
 * зависят, пропускаются (тоже попадают в `failed`). Остальные плагины
 * остаются установленными. Решение, запускать ли историю при наличии
 * сбоев, принимает вызывающий код.
 *
 * Вызывать нужно до `game.loadProject(project)`, чтобы плагины
 * успели подписаться на `story:loaded`.
 *
 * Ошибки в самом описании проекта (некорректный список плагинов,
 * зависимость, не объявленная в проекте, цикл) пробрасываются исключением:
 * с таким проектом работать нельзя.
 *
 * @param {Project} project Проект с объявленными плагинами.
 * @param {PluginRegistry} registry Каталог доступных плагинов.
 * @param {PluginManager} manager Менеджер, устанавливающий плагины.
 * @returns {Promise} Промис с отчётом `{ installed, failed }`:
 * `installed` — имена установленных плагинов в порядке установки,
 * `failed` — массив объектов `{ name, stage, message, error }`,
 * где `stage` — `load`, `install` или `dependency`.
 * @throws {Error} Если описание плагинов в проекте некорректно.
 *
 * @example
 * const report = await loadProjectPlugins(project, registry, plugins);
 * if (report.failed.length === 0) {
 *     game.loadProject(project);
 * }
 */
export async function loadProjectPlugins(project, registry, manager) {
    const refs = normalizePluginRefs(project.getPlugins());

    const results = await Promise.allSettled(
        refs.map(ref => registry.resolve(ref.name, ref.version))
    );

    const failed = [];
    const failedNames = new Set();
    let resolved = [];

    const fail = (name, stage, error) => {
        failedNames.add(name);

        failed.push({
            name,
            stage,
            message: error?.message ?? String(error),
            error
        });
    };

    results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
            resolved.push(result.value);
        } else {
            fail(refs[index].name, 'load', result.reason);
        }
    });

    // Плагины, зависящие от не загрузившихся, пропускаем (цепочкой).
    let changed = true;

    while (changed) {
        changed = false;

        resolved = resolved.filter((plugin) => {
            const broken = dependenciesOf(plugin).filter(
                dependency => failedNames.has(dependency)
            );

            if (broken.length === 0) {
                return true;
            }

            fail(
                plugin.name,
                'dependency',
                new Error(
                    `не установлен, так как не работают его зависимости: ${broken.join(', ')}`
                )
            );

            changed = true;

            return false;
        });
    }

    const ordered = orderPlugins(resolved);
    const installed = [];

    for (const plugin of ordered) {
        const broken = dependenciesOf(plugin).filter(
            dependency => failedNames.has(dependency)
        );

        if (broken.length > 0) {
            fail(
                plugin.name,
                'dependency',
                new Error(
                    `не установлен, так как не работают его зависимости: ${broken.join(', ')}`
                )
            );

            continue;
        }

        try {
            manager.use(plugin);
            installed.push(plugin.name);
        } catch (error) {
            fail(plugin.name, 'install', error);
        }
    }

    return { installed, failed };
}
