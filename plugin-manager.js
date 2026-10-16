import { logger } from './logger.js';

const log = logger.child('PluginManager');

/**
 * Версия Plugin API, которую поддерживает движок. Плагин может указать
 * `apiVersion` в манифесте; несовпадение версии — ошибка установки.
 */
export const PLUGIN_API_VERSION = 1;

function requireValidator(pluginName, validator) {
    if (!validator) {
        throw new Error(
            `PluginManager: плагин "${pluginName}" использует api.validation, ` +
            'но менеджер создан без валидатора'
        );
    }
}

// Проверка плагина получает его имя и id с префиксом, чтобы id разных плагинов не пересекались.
function scopedCheck(pluginName, check) {
    return {
        ...check,
        plugin: pluginName,
        id: `${pluginName}:${check?.id}`
    };
}

/**
 * @class PluginManager
 * @apiGroup PluginManager
 * Устанавливает плагины и выдаёт каждому из них собственный Plugin API
 * (`plugin`, `log`, `events`, `game`, `player`, `blocks`, `ast`, `validation`, `plugins`).
 *
 * Всё, что плагин занял через свой `api` (подписки на события, слои,
 * типы узлов, блоки, команды парсера, проверки валидатора), движок снимает сам при удалении
 * плагина или при сбое его установки.
 *
 * @example
 * const plugins = new PluginManager(bus, game, player, blocks, ast, validator);
 *
 * plugins.use(StatePlugin);
 * plugins.has('state');   // true
 * plugins.list();         // ['state']
 * plugins.remove('state');
 */
export class PluginManager {
    #plugins = new Map();
    #bus;
    #game;
    #player;
    #blocks;
    #ast;
    #validator;
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
     * ├── validation
     * │   ├── register(check) → unregister
     * │   └── registerNodeRule(nodeType, rule) → unregister
     * └── plugins                 → Proxy
     *     └── <name>.api          → публичный API плагина
     * ```
     *
     * @param {EventBus} bus Шина событий.
     * @param {VN} game Ядро: выполняет узлы истории.
     * @param {Player} player Плеер со слоями страницы.
     * @param {BlockManager} blocks Менеджер визуальных блоков.
     * @param {AST} [ast] Парсер сценария. Без него `api.ast.addCommand` выбрасывает ошибку.
     * @param {ProjectValidator} [validator] Валидатор проекта. Без него `api.validation` выбрасывает ошибку.
     *
     * @example
     * const plugins = new PluginManager(bus, game, player, blocks, ast, validator);
     * plugins.use(StatePlugin);
     */
    constructor(
        bus,
        game,
        player,
        blocks,
        ast,
        validator
    ) {
        this.#bus = bus;
        this.#game = game;
        this.#player = player;
        this.#blocks = blocks;
        this.#ast = ast ?? null;
        this.#validator = validator ?? null;

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
        const validator = this.#validator;
        const nodeTypes = new Set();
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
             * @example
             * api.log.info('Я плагин', api.plugin.name);
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
                 *
                 * @example
                 * api.log.debug('Подробности', { step: 1 });
                 */
                debug: (...args) => pluginLog.debug(...args),

                /**
                 * @apiName api.log.info
                 * @apiGroup PluginAPI
                 * @param {*} args Что вывести.
                 *
                 * @example
                 * api.log.info('Плагин готов');
                 */
                info: (...args) => pluginLog.info(...args),

                /**
                 * @apiName api.log.warn
                 * @apiGroup PluginAPI
                 * @param {*} args Что вывести.
                 *
                 * @example
                 * api.log.warn('Файл не найден, беру значение по умолчанию');
                 */
                warn: (...args) => pluginLog.warn(...args),

                /**
                 * @apiName api.log.error
                 * @apiGroup PluginAPI
                 * @param {*} args Что вывести.
                 *
                 * @example
                 * api.log.error('Не удалось прочитать данные', error);
                 */
                error: (...args) => pluginLog.error(...args)
            },

            /**
             * @apiName api.events
             * @apiGroup PluginAPI
             * Обёртка над EventBus. Подписки плагина снимаются автоматически
             * при его удалении.
             *
             * @example
             * const off = api.events.on('story:end', () => {
             *     api.log.info('История закончилась');
             * });
             *
             * api.events.emit('my-plugin:ready');
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
                 *
                 * @example
                 * api.events.emit('inventory:changed', { item: 'key', count: 1 });
                 */
                emit: (event, payload) => bus.emit(event, payload)
            },

            /**
             * @apiName api.game
             * @apiGroup PluginAPI
             * Фасад к VN и Player: регистрация типов узлов и работа со слоями.
             * Типы узлов и слои плагина снимаются автоматически.
             *
             * @example
             * api.game.registerNodeType('flash', () => {});
             * api.game.show('hud');
             */
            game: {
                /**
                 * @apiName api.game.getPluginLayer
                 * @apiGroup PluginAPI
                 * @returns {HTMLElement} DOM-слой плагинов.
                 *
                 * @example
                 * const layer = api.game.getPluginLayer();
                 * layer.appendChild(document.createElement('div'));
                 */
                getPluginLayer: () => player.getPluginLayer(),

                /**
                 * @apiName api.game.registerLayer
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @param {HTMLElement} element DOM-элемент.
                 * @returns {function} Функция, удаляющая слой.
                 * @example
                 * const hud = document.createElement('div');
                 * api.game.registerLayer('hud', hud);
                 * api.game.show('hud');
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
                 * @example
                 * api.game.registerNodeType('flash', (node, context) => {
                 *     api.log.info('Вспышка', node.color);
                 *     // без wait() история сама перейдёт к следующему узлу
                 * });
                 *
                 * api.game.registerNodeType('pause', (node, context) => {
                 *     context.wait();                 // ждём клика игрока
                 *     setTimeout(() => context.resume(), node.ms);
                 * });
                 */
                registerNodeType: (type, handler) => {
                    game.registerNodeType(type, handler);

                    nodeTypes.add(type);

                    track(() => game.unregisterNodeType?.(type));
                },

                /**
                 * @apiName api.game.show
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @example
                 * api.game.show('hud');
                 */
                show: (name) => player.show(name),

                /**
                 * @apiName api.game.hide
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @example
                 * api.game.hide('hud');
                 */
                hide: (name) => player.hide(name),

                /**
                 * @apiName api.game.isVisible
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @returns {boolean}
                 * @example
                 * if (!api.game.isVisible('hud')) {
                 *     api.game.show('hud');
                 * }
                 */
                isVisible: (name) => player.isVisible(name)
            },

            /**
             * @apiName api.player
             * @apiGroup PluginAPI
             * Прямой доступ к Player (слои). Те же методы, что api.game.* для слоёв.
             *
             * @example
             * api.player.registerLayer('hud', document.createElement('div'));
             * api.player.show('hud');
             */
            player: {
                /**
                 * @apiName api.player.getPluginLayer
                 * @apiGroup PluginAPI
                 * @returns {HTMLElement}
                 *
                 * @example
                 * const layer = api.player.getPluginLayer();
                 */
                getPluginLayer: () => player.getPluginLayer(),

                /**
                 * @apiName api.player.registerLayer
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @param {HTMLElement} element DOM-элемент.
                 * @returns {function} Функция, удаляющая слой.
                 * @example
                 * const box = document.createElement('div');
                 * const removeLayer = api.player.registerLayer('my-layer', box);
                 * // removeLayer() уберёт слой раньше, чем плагин будет удалён
                 */
                registerLayer,

                /**
                 * @apiName api.player.show
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 *
                 * @example
                 * api.player.show('hud');
                 */
                show: (name) => player.show(name),

                /**
                 * @apiName api.player.hide
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 *
                 * @example
                 * api.player.hide('hud');
                 */
                hide: (name) => player.hide(name),

                /**
                 * @apiName api.player.isVisible
                 * @apiGroup PluginAPI
                 * @param {string} name Имя слоя.
                 * @returns {boolean}
                 *
                 * @example
                 * const visible = api.player.isVisible('hud');
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
             * @example
             * const element = document.createElement('div');
             * element.textContent = 'Привет';
             *
             * const block = api.blocks.create('hello', {
             *     channel: 'overlay',
             *     element,
             *     replace: true
             * });
             *
             * api.blocks.remove(block.id);
             */
            blocks: scopedBlocks,

            /**
             * @apiName api.ast
             * @apiGroup PluginAPI
             * Доступ к парсеру сценария: плагин учит его распознавать
             * свои строки текста. Команды плагина снимаются при его удалении.
             *
             * @example
             * api.ast.addCommand(/^!(.*)$/, 'shout', (match) => ({
             *     type: 'shout',
             *     text: match[1].trim()
             * }));
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
             * @apiName api.validation
             * @apiGroup PluginAPI
             * Доступ к валидатору проекта: плагин добавляет собственные проверки.
             * Проверки плагина снимаются при его удалении, а их id получают
             * префикс `имя-плагина:`.
             *
             * Есть два вида проверок: `register` смотрит на проект целиком,
             * `registerNodeRule` вызывается для каждого узла своего типа.
             * Запись `{ code, message, path }` описывает одну проблему.
             * Ошибка (`error`) не даёт запустить историю, предупреждение
             * (`warning`) только показывается игроку и разработчику.
             * @example
             * install(api) {
             *     // Проверка узлов типа take
             *     api.validation.registerNodeRule('take', {
             *         id: 'item',
             *         run(node) {
             *             return node.item
             *                 ? []
             *                 : [{ code: 'take.no-item', message: 'У узла take нет item' }];
             *         }
             *     });
             *
             *     // Проверка проекта целиком, только предупреждение
             *     api.validation.register({
             *         id: 'items-config',
             *         severity: 'warning',
             *         run(project) {
             *             const items = project.getConfig().items;
             *             return items
             *                 ? []
             *                 : [{ code: 'inventory.no-items', message: 'В config нет items' }];
             *         }
             *     });
             * }
             */
            validation: {
                /**
                 * @apiName api.validation.register
                 * @apiGroup PluginAPI
                 * Регистрирует проверку всего проекта.
                 *
                 * Функция `run(project, context)` возвращает массив записей
                 * (пустой массив значит «всё хорошо»). В записи можно указать
                 * `code`, `message`, `path` и `severity`; имя плагина валидатор
                 * подставит сам. `context.plugins` содержит манифесты
                 * установленных плагинов, `context.project` — проверяемый проект.
                 *
                 * Проверка выполняется до запуска истории, поэтому читать нужно
                 * данные проекта (`project.getConfig()`, `project.getScenes()`),
                 * а не runtime-состояние плагинов: оно ещё пустое.
                 *
                 * @param {Object} check Проверка: `id`, `run(project, context)`,
                 * необязательные `severity` (error или warning, по умолчанию error)
                 * и `timeout` в миллисекундах (по умолчанию 3000).
                 * @returns {function} Функция, снимающая проверку.
                 * @throws {Error} Если PluginManager создан без валидатора.
                 * @example
                 * api.validation.register({
                 *     id: 'unknown-variables',
                 *     severity: 'warning',
                 *     run(project) {
                 *         const known = project.getConfig().state ?? {};
                 *         const found = [];
                 *
                 *         for (const scene of project.getScenes()) {
                 *             for (const node of scene.nodes ?? []) {
                 *                 if (node.variable && !(node.variable in known)) {
                 *                     found.push({
                 *                         code: 'my.unknown-variable',
                 *                         message: `Переменной "${node.variable}" нет в config.state`,
                 *                         path: `узел "${node.id}"`
                 *                     });
                 *                 }
                 *             }
                 *         }
                 *
                 *         return found;
                 *     }
                 * });
                 */
                register: (check) => {
                    requireValidator(pluginName, validator);

                    const off = validator.register(
                        scopedCheck(pluginName, check)
                    );

                    track(off);

                    return off;
                },

                /**
                 * @apiName api.validation.registerNodeRule
                 * @apiGroup PluginAPI
                 * Регистрирует правило для узлов одного типа: валидатор сам
                 * обходит проект и вызывает `run(node, context)`.
                 *
                 * Путь к узлу (`scenes[0].nodes[2]`) подставляется в запись сам,
                 * если плагин не указал свой `path`. Возвращать нужно массив
                 * записей; пустой массив значит «узел в порядке».
                 *
                 * @param {string} nodeType Тип узла.
                 * @param {Object} rule Правило: те же поля, что у register().
                 * @returns {function} Функция, снимающая правило.
                 * @throws {Error} Если PluginManager создан без валидатора.
                 * @example
                 * api.validation.registerNodeRule('take', {
                 *     id: 'item',
                 *     run(node, context) {
                 *         const found = [];
                 *
                 *         if (!node.item) {
                 *             found.push({
                 *                 code: 'take.no-item',
                 *                 message: `У узла "${node.id}" не задан item`
                 *             });
                 *         }
                 *
                 *         if (node.count !== undefined && node.count < 1) {
                 *             found.push({
                 *                 code: 'take.bad-count',
                 *                 message: 'count должен быть больше нуля',
                 *                 severity: 'warning'
                 *             });
                 *         }
                 *
                 *         return found;
                 *     }
                 * });
                 */
                registerNodeRule: (nodeType, rule) => {
                    requireValidator(pluginName, validator);

                    const off = validator.registerNodeRule(
                        nodeType,
                        scopedCheck(pluginName, rule)
                    );

                    track(off);

                    return off;
                }
            },

            /**
             * @apiName api.snapshot
             * @apiGroup PluginAPI
             * Участие плагина в снимках игры (`game.snapshot()` и `game.restore()`).
             * Если у плагина есть собственное состояние, он говорит, как его
             * сохранить и вернуть. Источник снимается при удалении плагина.
             *
             * @example
             * api.snapshot.register({
             *     save: () => ({ keys: 2 }),
             *     load: (data) => api.log.info('Ключей:', data.keys)
             * });
             */
            snapshot: {
                /**
                 * @apiName api.snapshot.register
                 * @apiGroup PluginAPI
                 * Подключает источник данных снимка под именем плагина.
                 * @param {Object} provider Объект `{ save(), load(data) }`.
                 * Данные должны сериализоваться в JSON.
                 * @returns {function} Функция, снимающая источник.
                 * @throws {Error} Если игра не умеет делать снимки
                 * или у плагина уже есть источник.
                 * @example
                 * let gold = 0;
                 *
                 * api.snapshot.register({
                 *     save: () => ({ gold }),
                 *     load: (data) => { gold = data.gold; }
                 * });
                 */
                register: (provider) => {
                    if (typeof game.registerSnapshotProvider !== 'function') {
                        throw new Error(
                            `PluginManager: плагин "${pluginName}" использует api.snapshot, ` +
                            'но игра не поддерживает снимки'
                        );
                    }

                    const off = game.registerSnapshotProvider(pluginName, provider);

                    track(off);

                    return off;
                }
            },

            /**
             * @apiName api.hasPlugin
             * @apiGroup PluginAPI
             * Проверяет, установлен ли другой плагин. В отличие от `api.plugins.<имя>`,
             * ничего не пишет в консоль, поэтому подходит для необязательных зависимостей.
             * @param {string} name Имя плагина.
             * @returns {boolean} true, если плагин установлен.
             * @example
             * if (api.hasPlugin('state')) {
             *     text = api.plugins.state.api.format(text);
             * }
             */
            hasPlugin: (name) => this.#plugins.has(name),

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

        return { api, dispose, nodeTypes };
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
        dispose: scope.dispose,
        nodeTypes: scope.nodeTypes
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
     * @example
     * if (!plugins.has('noty')) {
     *     console.warn('Уведомления недоступны');
     * }
     */
    has(name) {
        return this.#plugins.has(name);
    }

    /**
     * @apiName get
     * @apiGroup PluginManager
     * @param {string} name Имя плагина
     * @returns {Object|undefined} Исходный объект плагина
     * @example
     * const plugin = plugins.get('state');
     * console.log(plugin.version);
     */
    get(name) {
        return this.#plugins.get(name)?.plugin;
    }

    /**
     * @apiName PluginManager.getManifests
     * @apiGroup PluginManager
     *
     * Описывает установленные плагины для валидатора.
     *
     * @returns {Object[]} Массив `{ name, version, dependencies, nodeTypes }`.
     * В `nodeTypes` входят типы из манифеста и типы, которые плагин
     * реально зарегистрировал через `api.game.registerNodeType`.
     *
     * @example
     * const result = await validator.validate(project, { plugins: plugins.getManifests() });
     */
    getManifests() {
        return [...this.#plugins.values()].map(({ plugin, nodeTypes }) => ({
            name: plugin.name,
            version: plugin.version,
            dependencies: [...(plugin.dependencies ?? [])],
            nodeTypes: [
                ...new Set([...(plugin.nodeTypes ?? []), ...nodeTypes])
            ]
        }));
    }

    /**
     * @apiName list
     * @apiGroup PluginManager
     * @returns {string[]} Имена установленных плагинов
     * @example
     * console.log(plugins.list()); // ['state', 'conditions', 'choice']
     */
    list() {
        return [
            ...this.#plugins.keys()
        ];
    }
}