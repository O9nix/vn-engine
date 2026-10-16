// Поля, которые содержат переход: обычный и по таймеру выбора.
const GOTO_KEYS = ['goto', 'timeoutGoto'];

function collectGotosFromValue(value, path, acc) {
    if (value === null || typeof value !== 'object') {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectGotosFromValue(item, `${path}[${index}]`, acc);
        });

        return;
    }

    for (const key of GOTO_KEYS) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            const target = value[key];

            if (target !== undefined && target !== null) {
                acc.push({
                    target,
                    path: `${path}.${key}`,
                });
            }
        }
    }

    for (const [key, nestedValue] of Object.entries(value)) {
        if (GOTO_KEYS.includes(key)) {
            continue;
        }

        collectGotosFromValue(nestedValue, `${path}.${key}`, acc);
    }
}

/**
 * @apiName validateProjectScenes
 * @apiGroup ProjectValidator
 *
 * Проверяет переходы в сценах (`goto` и `timeoutGoto`): каждый должен вести
 * на существующий узел или на сцену.
 *
 * @param {Object[]} scenes Сцены проекта.
 * @returns {Object} Объект `{ valid, hasGoto, gotoCount, nodeCount, errors }`,
 * где `errors` — массив записей `{ target, path, message }`.
 *
 * @example
 * const result = validateProjectScenes(project.getScenes());
 */
export function validateProjectScenes(scenes) {
    const safeScenes = Array.isArray(scenes) ? scenes : [];

    const nodeIds = new Set();
    const sceneIds = new Set();
    const gotoLinks = [];

    safeScenes.forEach((scene, sceneIndex) => {
        const nodes = scene?.nodes ?? [];

        if (scene?.id !== undefined && scene?.id !== null) {
            sceneIds.add(scene.id);
        }

        nodes.forEach((node, nodeIndex) => {
            if (node?.id !== undefined && node?.id !== null) {
                nodeIds.add(node.id);
            }

            const basePath = `scenes[${sceneIndex}].nodes[${nodeIndex}]`;

            collectGotosFromValue(node, basePath, gotoLinks);
        });
    });

    const errors = [];

    for (const link of gotoLinks) {
        if (!nodeIds.has(link.target) && !sceneIds.has(link.target)) {
            errors.push({
                target: link.target,
                path: link.path,
                message: `goto "${link.target}" не ведёт на существующий узел или сцену`,
            });
        }
    }

    return {
        valid: errors.length === 0,
        hasGoto: gotoLinks.length > 0,
        gotoCount: gotoLinks.length,
        nodeCount: nodeIds.size,
        errors,
    };
}

function scenesOf(project) {
    return typeof project?.getScenes === 'function'
        ? project.getScenes()
        : project?.scenes ?? [];
}

function declaredPluginNames(project) {
    const refs = typeof project?.getPlugins === 'function'
        ? project.getPlugins()
        : project?.plugins ?? [];

    return new Set(
        refs.map(ref => (typeof ref === 'string' ? ref : ref?.name))
    );
}

/**
 * Встроенные проверки ядра. Каждая получает `(project, context)` и возвращает
 * массив записей. Проверки, которым нужно знать установленные плагины,
 * пропускаются, если в `context.plugins` ничего не передано.
 */
export const builtinChecks = [
    {
        id: 'core:goto',
        plugin: 'core',
        run(project) {
            return validateProjectScenes(scenesOf(project)).errors.map(error => ({
                code: 'goto.missing-target',
                message: error.message,
                path: error.path,
                target: error.target
            }));
        }
    },

    {
        id: 'core:duplicate-ids',
        plugin: 'core',
        run(project) {
            const seen = new Map();
            const found = [];

            scenesOf(project).forEach((scene, sceneIndex) => {
                (scene?.nodes ?? []).forEach((node, nodeIndex) => {
                    const id = node?.id;

                    if (id === undefined || id === null) {
                        return;
                    }

                    const path = `scenes[${sceneIndex}].nodes[${nodeIndex}]`;

                    if (seen.has(id)) {
                        found.push({
                            code: 'node.duplicate-id',
                            message: `id "${id}" уже используется (${seen.get(id)})`,
                            path
                        });
                    } else {
                        seen.set(id, path);
                    }
                });
            });

            return found;
        }
    },

    {
        id: 'core:node-types',
        plugin: 'core',
        run(project, context) {
            if (!Array.isArray(context?.plugins)) {
                return [];
            }

            const known = new Set(
                context.plugins.flatMap(plugin => plugin.nodeTypes ?? [])
            );
            const found = [];

            scenesOf(project).forEach((scene, sceneIndex) => {
                (scene?.nodes ?? []).forEach((node, nodeIndex) => {
                    const path = `scenes[${sceneIndex}].nodes[${nodeIndex}]`;

                    if (typeof node?.type !== 'string' || !node.type) {
                        found.push({
                            code: 'node.no-type',
                            message: 'у узла не указан type',
                            path
                        });
                    } else if (!known.has(node.type)) {
                        found.push({
                            code: 'node.unknown-type',
                            message: `тип узла "${node.type}" не обрабатывает ни один установленный плагин`,
                            path: `${path}.type`
                        });
                    }
                });
            });

            return found;
        }
    },

    {
        id: 'core:plugin-dependencies',
        plugin: 'core',
        run(project, context) {
            if (!Array.isArray(context?.plugins)) {
                return [];
            }

            const declared = declaredPluginNames(project);
            const found = [];

            for (const plugin of context.plugins) {
                for (const dependency of plugin.dependencies ?? []) {
                    if (!declared.has(dependency)) {
                        found.push({
                            code: 'plugin.undeclared-dependency',
                            message: `плагин "${plugin.name}" требует "${dependency}", но тот не объявлен в проекте`,
                            path: 'plugins'
                        });
                    }
                }
            }

            return found;
        }
    }
];
