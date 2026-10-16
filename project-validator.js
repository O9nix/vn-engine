import { builtinChecks, validateProjectScenes } from './builtin-checks.js';
import { logger } from './logger.js';

const log = logger.child('ProjectValidator');

const DEFAULT_TIMEOUT_MS = 3000;

function scenesOf(project) {
    return typeof project?.getScenes === 'function'
        ? project.getScenes()
        : project?.scenes ?? [];
}

/**
 * @class ProjectValidator
 * @apiGroup ProjectValidator
 *
 * Проверяет проект. Ядро регистрирует общие проверки (метки goto, дубли id,
 * неизвестные типы узлов, необъявленные зависимости плагинов), а плагины
 * добавляют свои через `api.validation`.
 *
 * Запись о проблеме: `{ code, message, path, plugin, severity }`,
 * где `severity` — `error` или `warning`. Ошибки означают, что проект
 * запускать нельзя, предупреждения не блокируют запуск.
 *
 * Проверка, которая упала или не уложилась во время, не ломает проверку проекта:
 * она превращается в предупреждение с кодом `check.crashed` или `check.timeout`.
 *
 * @example
 * const validator = new ProjectValidator(bus);
 * const result = await validator.validate(project, { plugins: plugins.getManifests() });
 * if (!result.valid) {
 *     // result.errors, result.warnings
 * }
 */
export class ProjectValidator {
    #bus;
    #project = null;
    #checks = new Map();

    /**
     * @apiName constructor
     * @apiGroup ProjectValidator
     * Создаёт валидатор со встроенными проверками ядра.
     *
     * Старая форма `new ProjectValidator(project, bus)` по-прежнему работает
     * вместе с методом validateGotos().
     *
     * @param {EventBus} [bus] Шина событий: валидатор шлёт validator:done.
     *
     * @example
     * const validator = new ProjectValidator(bus);
     * bus.on('validator:done', (result) => {
     *     console.log(result.valid, result.errors.length);
     * });
     */
    constructor(first, second) {
        if (typeof first?.getScenes === 'function') {
            this.#project = first;
            this.#bus = second ?? null;
        } else {
            this.#bus = first ?? null;
        }

        for (const check of builtinChecks) {
            this.register(check);
        }
    }

    #add(kind, check, nodeType) {
        if (
            !check ||
            typeof check.id !== 'string' ||
            !check.id ||
            typeof check.run !== 'function'
        ) {
            throw new TypeError(
                'ProjectValidator: проверка должна быть объектом с полями id (строка) и run (функция)'
            );
        }

        if (this.#checks.has(check.id)) {
            throw new Error(
                `ProjectValidator: проверка "${check.id}" уже зарегистрирована`
            );
        }

        const severity = check.severity === 'warning' ? 'warning' : 'error';

        this.#checks.set(check.id, {
            id: check.id,
            plugin: check.plugin ?? 'core',
            severity,
            timeout: check.timeout,
            kind,
            nodeType,
            run: check.run
        });

        return () => this.unregister(check.id);
    }

    /**
     * @apiName ProjectValidator.register
     * @apiGroup ProjectValidator
     *
     * Регистрирует проверку всего проекта.
     *
     * @param {Object} check Проверка: `id` (уникальная строка), `run(project, context)`,
     * необязательные `plugin`, `severity` (error или warning, по умолчанию error)
     * и `timeout` в миллисекундах. Функция `run` (может быть async) возвращает
     * массив записей.
     * @returns {function} Функция, снимающая проверку.
     * @throws {Error} Если проверка некорректна или её id уже занят.
     *
     * @example
     * validator.register({
     *     id: 'inventory:items',
     *     plugin: 'inventory',
     *     run(project) {
     *         return [];
     *     }
     * });
     */
    register(check) {
        return this.#add('project', check);
    }

    /**
     * @apiName ProjectValidator.registerNodeRule
     * @apiGroup ProjectValidator
     *
     * Регистрирует правило для узлов одного типа. Валидатор сам обходит
     * проект и вызывает `run(node, context)` только для узлов этого типа.
     * Путь к узлу подставляется в запись, если её `path` пуст.
     *
     * @param {string} nodeType Тип узла, например choice.
     * @param {Object} rule Правило: те же поля, что у register().
     * @returns {function} Функция, снимающая правило.
     * @throws {TypeError} Если тип узла не строка или пустой.
     *
     * @example
     * validator.registerNodeRule('take', {
     *     id: 'inventory:item',
     *     plugin: 'inventory',
     *     run(node) {
     *         if (node.item) {
     *             return [];
     *         }
     *
     *         // path подставится сам: scenes[0].nodes[2]
     *         return [{
     *             code: 'take.no-item',
     *             message: `У узла "${node.id}" не задан item`
     *         }];
     *     }
     * });
     */
    registerNodeRule(nodeType, rule) {
        if (typeof nodeType !== 'string' || !nodeType) {
            throw new TypeError(
                'ProjectValidator: тип узла должен быть непустой строкой'
            );
        }

        return this.#add('node', rule, nodeType);
    }

    /**
     * @apiName ProjectValidator.unregister
     * @apiGroup ProjectValidator
     *
     * Снимает проверку по id.
     *
     * @param {string} id Id проверки.
     * @returns {boolean} true, если проверка была зарегистрирована.
     *
     * @example
     * validator.unregister('inventory:items');
     */
    unregister(id) {
        return this.#checks.delete(id);
    }

    /**
     * @apiName ProjectValidator.unregisterPlugin
     * @apiGroup ProjectValidator
     *
     * Снимает все проверки плагина.
     *
     * @param {string} plugin Имя плагина.
     * @returns {number} Сколько проверок снято.
     *
     * @example
     * const removed = validator.unregisterPlugin('inventory');
     * console.log(`Снято проверок: ${removed}`);
     */
    unregisterPlugin(plugin) {
        let removed = 0;

        for (const [id, check] of [...this.#checks]) {
            if (check.plugin === plugin) {
                this.#checks.delete(id);
                removed++;
            }
        }

        return removed;
    }

    /**
     * @apiName ProjectValidator.list
     * @apiGroup ProjectValidator
     *
     * @returns {Object[]} Зарегистрированные проверки: `{ id, plugin, kind }`.
     *
     * @example
     * for (const check of validator.list()) {
     *     console.log(check.id, check.kind); // core:goto project
     * }
     */
    list() {
        return [...this.#checks.values()].map(
            ({ id, plugin, kind }) => ({ id, plugin, kind })
        );
    }

    #normalize(raw, check) {
        const entry = raw !== null && typeof raw === 'object'
            ? raw
            : { message: String(raw) };

        const severity =
            entry.severity === 'warning' || entry.severity === 'error'
                ? entry.severity
                : check.severity;

        return {
            ...entry,
            code: entry.code ?? check.id,
            message: entry.message ?? `проверка "${check.id}" нашла проблему`,
            path: entry.path ?? '',
            plugin: entry.plugin ?? check.plugin,
            severity
        };
    }

    async #execute(check, project, context) {
        if (check.kind === 'project') {
            return (await check.run(project, context)) ?? [];
        }

        const found = [];

        const scenes = scenesOf(project);

        for (let s = 0; s < scenes.length; s++) {
            const nodes = scenes[s]?.nodes ?? [];

            for (let n = 0; n < nodes.length; n++) {
                if (nodes[n]?.type !== check.nodeType) {
                    continue;
                }

                const path = `scenes[${s}].nodes[${n}]`;
                const result = (await check.run(nodes[n], context)) ?? [];

                for (const raw of [].concat(result)) {
                    found.push(
                        raw !== null && typeof raw === 'object'
                            ? { path, ...raw }
                            : { path, message: String(raw) }
                    );
                }
            }
        }

        return found;
    }

    async #runCheck(check, project, context, timeoutMs) {
        const limit = check.timeout ?? timeoutMs;
        let timer;

        const timeout = new Promise((resolve, reject) => {
            timer = setTimeout(() => reject(new Error('__timeout__')), limit);
        });

        try {
            const result = await Promise.race([
                this.#execute(check, project, context),
                timeout
            ]);

            return [].concat(result);
        } catch (error) {
            const timedOut = error?.message === '__timeout__';

            log.warn(
                timedOut
                    ? `Проверка "${check.id}" не уложилась в ${limit} мс`
                    : `Проверка "${check.id}" завершилась ошибкой:`,
                timedOut ? '' : error
            );

            return [{
                code: timedOut ? 'check.timeout' : 'check.crashed',
                message: timedOut
                    ? `проверка "${check.id}" не уложилась в ${limit} мс`
                    : `проверка "${check.id}" завершилась ошибкой: ${error?.message ?? error}`,
                severity: 'warning'
            }];
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * @apiName ProjectValidator.validate
     * @apiGroup ProjectValidator
     *
     * Запускает все проверки по очереди и собирает результат.
     * После завершения шлёт событие `validator:done` с полным результатом;
     * если есть ошибки, дополнительно шлёт `validator:errors` с `{ errors }`
     * (для совместимости).
     *
     * @param {Object} project Проект (`Project` или объект со сценами).
     * @param {Object} [extra] Дополнительные данные для проверок. Поле
     * `plugins` — манифесты установленных плагинов (`PluginManager.getManifests()`):
     * без него проверки типов узлов и зависимостей пропускаются. Поле `project`
     * валидатор добавляет сам.
     * @param {Object} [options] Параметры: `timeout` — предел времени на одну
     * проверку в миллисекундах (по умолчанию 3000).
     * @returns {Promise} Результат `{ valid, errors, warnings, checksRun }`.
     * @throws {TypeError} Если проект не передан.
     *
     * @example
     * const result = await validator.validate(project, { plugins: plugins.getManifests() });
     */
    async validate(project, extra = {}, options = {}) {
        if (!project) {
            throw new TypeError('ProjectValidator.validate(): не передан проект');
        }

        // Проверки получают проект и в контексте: правилам для узлов он нужен,
        // чтобы смотреть настройки (config) и соседние узлы.
        const context = { ...extra, project };

        const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
        const errors = [];
        const warnings = [];
        let checksRun = 0;

        for (const check of [...this.#checks.values()]) {
            checksRun++;

            const entries = await this.#runCheck(check, project, context, timeoutMs);

            for (const raw of entries) {
                const entry = this.#normalize(raw, check);

                (entry.severity === 'warning' ? warnings : errors).push(entry);
            }
        }

        const result = {
            valid: errors.length === 0,
            errors,
            warnings,
            checksRun
        };

        this.#bus?.emit('validator:done', result);

        if (errors.length > 0) {
            this.#bus?.emit('validator:errors', { errors });
        }

        return result;
    }

    /**
     * @apiName ProjectValidator.validateGotos
     * @apiGroup ProjectValidator
     *
     * Проверяет только метки goto. Оставлено для совместимости:
     * работает с проектом, переданным в конструктор `new ProjectValidator(project, bus)`.
     * Новый код использует validate().
     *
     * @returns {Object} Объект `{ valid, hasGoto, gotoCount, nodeCount, errors }`,
     * где `errors` — массив `{ target, path, message }`.
     * @throws {Error} Если проект не был передан в конструктор.
     *
     * @example
     * const validator = new ProjectValidator(project, bus);
     * const result = validator.validateGotos();
     */
    validateGotos() {
        if (!this.#project) {
            throw new Error(
                'ProjectValidator.validateGotos(): проект не передан в конструктор, используйте validate(project)'
            );
        }

        const data = validateProjectScenes(scenesOf(this.#project));

        if (data.errors.length > 0) {
            this.#bus?.emit('validator:errors', { errors: data.errors });
        }

        return data;
    }
}
