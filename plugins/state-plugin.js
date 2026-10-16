/**
 * @class StatePlugin
 * @apiGroup Plugins
 *
 * Управляет runtime-состоянием игры: переменными и флагами.
 *
 * Плагин хранит состояние независимо от Project.
 * Начальное состояние загружается из `project.config.state`
 * при событии `story:loaded`.
 *
 * Состояние изменяется через публичный API плагина или узлами сценария
 * и доступно другим плагинам через `api.plugins.state.api`.
 *
 * События плагина:
 *
 * - `state:changed` с данными `{ name, value, oldValue }` при изменении переменной;
 * - `state:loaded` с данными `{ state }` после загрузки проекта или восстановления
 *   снимка: подписчикам нужно перечитать всё состояние.
 *
 * Узлы:
 *
 * - `setvar`: `{ type: 'setvar', variable: 'gold', value: 5, op: 'add' }`,
 *   где `op` равен `set` (по умолчанию), `add` или `sub`;
 * - `setflag`: `{ type: 'setflag', flag: 'met_anna', value: true }`,
 *   значение по умолчанию — true.
 *
 * Текстовый сценарий (AST):
 *
 * - `SET gold = 10`, `SET gold + 5`, `SET gold - 1`;
 * - `FLAG met_anna`, `FLAG met_anna = false`.
 *
 * Плагин участвует в снимках игры: состояние сохраняется и восстанавливается
 * вместе с позицией в истории.
 *
 * @example
 * const state = api.plugins.state.api;
 *
 * state.set('health', 3);
 * state.update({ gold: 10 });
 * state.get(); // { health: 3, gold: 10 }
 */
export const StatePlugin = {
    name: 'state',
    version: '0.2.0',
    nodeTypes: ['setvar', 'setflag'],

    install(api) {
        const state = {};

        function replaceAll(values) {
            Object.keys(state).forEach(
                key => delete state[key]
            );

            Object.assign(state, values);
        }

        /**
         * @apiName StatePlugin.get
         * @apiGroup StatePlugin
         *
         * Возвращает копию текущего runtime-состояния.
         *
         * @returns {Object} Копия текущего состояния.
         *
         * @example
         * const state = api.plugins.state.api.get();
         * console.log(state.health);
         */
        function get() {
            return { ...state };
        }

        /**
         * @apiName StatePlugin.getValue
         * @apiGroup StatePlugin
         *
         * Возвращает значение переменной состояния.
         *
         * @param {string} name Имя переменной.
         * @returns {*} Значение переменной.
         *
         * @example
         * const health =
         *     api.plugins.state.api.getValue('health');
         */
        function getValue(name) {
            return state[name];
        }

        /**
         * @apiName StatePlugin.has
         * @apiGroup StatePlugin
         *
         * Проверяет, есть ли переменная в состоянии.
         *
         * @param {string} name Имя переменной.
         * @returns {boolean} true, если переменная задана.
         *
         * @example
         * if (api.plugins.state.api.has('met_anna')) {
         *     api.log.info('Уже знакомы');
         * }
         */
        function has(name) {
            return Object.prototype.hasOwnProperty.call(state, name);
        }

        /**
         * @apiName StatePlugin.set
         * @apiGroup StatePlugin
         *
         * Устанавливает значение переменной состояния. Если значение
         * изменилось, приходит событие `state:changed`.
         *
         * @param {string} name Имя переменной.
         * @param {*} value Новое значение.
         *
         * @example
         * api.plugins.state.api.set('health', 10);
         */
        function set(name, value) {
            const oldValue = state[name];

            state[name] = value;

            if (oldValue !== value) {
                api.events.emit('state:changed', { name, value, oldValue });
            }
        }

        /**
         * @apiName StatePlugin.update
         * @apiGroup StatePlugin
         *
         * Обновляет несколько переменных состояния. Для каждой изменившейся
         * переменной приходит своё событие `state:changed`.
         *
         * @param {Object} values Объект с новыми значениями.
         *
         * @example
         * api.plugins.state.api.update({
         *     health: 10,
         *     money: 100
         * });
         */
        function update(values) {
            for (const [name, value] of Object.entries(values ?? {})) {
                set(name, value);
            }
        }

        /**
         * @apiName StatePlugin.add
         * @apiGroup StatePlugin
         *
         * Прибавляет число к числовой переменной. Если переменной нет,
         * она считается нулём. Для вычитания передайте отрицательное число.
         *
         * @param {string} name Имя переменной.
         * @param {number} delta Сколько прибавить.
         * @returns {number} Новое значение.
         * @throws {TypeError} Если переменная или delta не число.
         *
         * @example
         * api.plugins.state.api.add('gold', 5);
         * api.plugins.state.api.add('health', -1);
         */
        function add(name, delta) {
            const current = state[name] ?? 0;

            if (typeof current !== 'number' || typeof delta !== 'number' || Number.isNaN(delta)) {
                throw new TypeError(
                    `add(): "${name}" и значение должны быть числами`
                );
            }

            set(name, current + delta);

            return state[name];
        }

        /**
         * @apiName StatePlugin.format
         * @apiGroup StatePlugin
         *
         * Подставляет значения переменных в текст: `{имя}` заменяется на
         * значение. Если переменной нет, запись остаётся в тексте как есть.
         *
         * @param {string} text Текст с записями вида `{health}`.
         * @returns {string} Текст с подставленными значениями.
         *
         * @example
         * api.plugins.state.api.set('gold', 5);
         * api.plugins.state.api.format('У тебя {gold} монет'); // 'У тебя 5 монет'
         */
        function format(text) {
            return String(text).replace(
                /\{([\p{L}_][\p{L}\p{N}_]*)\}/gu,
                (whole, name) => has(name) ? String(state[name]) : whole
            );
        }

        /**
         * @apiName StatePlugin.storyLoaded
         * @apiGroup StatePlugin
         *
         * Инициализирует runtime-состояние из конфигурации проекта
         * после загрузки истории и сообщает об этом событием `state:loaded`.
         *
         * @example
         * // Срабатывает само. После загрузки проекта:
         * // config: { state: { health: 3 } }
         * api.plugins.state.api.getValue('health'); // 3
         */
        api.events.on(
            'story:loaded',
            ({ project }) => {
                replaceAll(
                    project?.getConfig()?.state ?? {}
                );

                api.events.emit('state:loaded', { state: get() });
            }
        );

        // Снимок игры: состояние сохраняется и возвращается целиком.
        api.snapshot.register({
            save: () => get(),
            load: (data) => {
                replaceAll(data);

                api.events.emit('state:loaded', { state: get() });
            }
        });

        /**
         * Разбор значения из текстовой команды AST.
         * Число → number, true/false → boolean, иначе строка.
         */
        function parseAstValue(raw) {
            const text = String(raw).trim();

            if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) {
                return Number(text);
            }

            if (text === 'true') {
                return true;
            }

            if (text === 'false') {
                return false;
            }

            return text;
        }

        // Текстовые команды AST:
        //   SET gold = 10
        //   SET gold + 5
        //   SET gold - 1
        //   FLAG met_anna
        //   FLAG met_anna = false
        api.ast.addCommand(
            /^SET\s+([A-Za-z_][\w]*)\s*(=|\+|-)\s*(.+)$/i,
            'setvar',
            (match, _line, index) => {
                const variable = match[1];
                const sign = match[2];
                const value = parseAstValue(match[3]);

                const op = sign === '='
                    ? 'set'
                    : sign === '+'
                        ? 'add'
                        : 'sub';

                return {
                    _id: `setvar_${index}`,
                    type: 'setvar',
                    variable,
                    value,
                    op
                };
            }
        );

        api.ast.addCommand(
            /^FLAG\s+([A-Za-z_][\w]*)(?:\s*=\s*(true|false))?$/i,
            'setflag',
            (match, _line, index) => {
                const flag = match[1];
                const value = match[2] === undefined
                    ? true
                    : match[2].toLowerCase() === 'true';

                return {
                    _id: `setflag_${index}`,
                    type: 'setflag',
                    flag,
                    value
                };
            }
        );

        /**
         * @apiName StatePlugin.setvar
         * @apiGroup StatePlugin
         *
         * Узел `setvar` меняет переменную и сразу идёт дальше.
         *
         * Поля узла: `variable` (имя), `value` (значение) и необязательное `op`:
         * `set` (записать, по умолчанию), `add` (прибавить) или `sub` (вычесть).
         *
         * Текстовая запись (AST):
         * `SET gold = 10`, `SET gold + 5`, `SET gold - 1`.
         *
         * @example
         * { id: 'g1', type: 'setvar', variable: 'gold', value: 5, op: 'add' }
         */
        api.game.registerNodeType('setvar', (node) => {
            if (typeof node.variable !== 'string' || !node.variable) {
                throw new Error(
                    `setvar "${node.id}": не указано имя переменной (variable)`
                );
            }

            const op = node.op ?? 'set';

            if (op === 'set') {
                set(node.variable, node.value);
            } else if (op === 'add') {
                add(node.variable, node.value);
            } else if (op === 'sub') {
                if (typeof node.value !== 'number') {
                    throw new TypeError(
                        `setvar "${node.id}": для sub нужно число в value`
                    );
                }

                add(node.variable, -node.value);
            } else {
                throw new Error(
                    `setvar "${node.id}": неизвестная операция "${op}"`
                );
            }
        });

        /**
         * @apiName StatePlugin.setflag
         * @apiGroup StatePlugin
         *
         * Узел `setflag` ставит или снимает флаг (переменную со значением
         * true или false) и сразу идёт дальше.
         *
         * Поля узла: `flag` (имя) и `value` (по умолчанию true).
         *
         * Текстовая запись (AST): `FLAG met_anna`, `FLAG met_anna = false`.
         *
         * @example
         * { id: 'f1', type: 'setflag', flag: 'met_anna' }
         * { id: 'f2', type: 'setflag', flag: 'met_anna', value: false }
         */
        api.game.registerNodeType('setflag', (node) => {
            if (typeof node.flag !== 'string' || !node.flag) {
                throw new Error(
                    `setflag "${node.id}": не указано имя флага (flag)`
                );
            }

            set(node.flag, node.value ?? true);
        });

        // Проверка узлов до запуска истории.
        api.validation.registerNodeRule('setvar', {
            id: 'setvar',
            run(node, context) {
                const found = [];
                const op = node.op ?? 'set';

                if (typeof node.variable !== 'string' || !node.variable) {
                    found.push({
                        code: 'setvar.no-variable',
                        message: `У узла setvar "${node.id}" не указано имя переменной (variable)`
                    });
                }

                if (!['set', 'add', 'sub'].includes(op)) {
                    found.push({
                        code: 'setvar.bad-op',
                        message: `У узла setvar "${node.id}" неизвестная операция "${op}" (нужна set, add или sub)`
                    });

                    return found;
                }

                if (!('value' in node)) {
                    found.push({
                        code: 'setvar.no-value',
                        message: `У узла setvar "${node.id}" не указано value`
                    });

                    return found;
                }

                if (op !== 'set' && typeof node.value !== 'number') {
                    found.push({
                        code: 'setvar.not-number',
                        message: `Для ${op} у узла setvar "${node.id}" value должно быть числом`
                    });
                }

                const initial = context?.project?.getConfig?.()?.state?.[node.variable];

                if (op === 'set' && initial !== undefined && typeof initial !== typeof node.value) {
                    found.push({
                        code: 'setvar.type-mismatch',
                        message: `Переменная "${node.variable}" в config.state имеет тип ${typeof initial}, а узел setvar "${node.id}" записывает ${typeof node.value}`,
                        severity: 'warning'
                    });
                }

                return found;
            }
        });

        api.validation.registerNodeRule('setflag', {
            id: 'setflag',
            run(node) {
                const found = [];

                if (typeof node.flag !== 'string' || !node.flag) {
                    found.push({
                        code: 'setflag.no-flag',
                        message: `У узла setflag "${node.id}" не указано имя флага (flag)`
                    });
                }

                if ('value' in node && typeof node.value !== 'boolean') {
                    found.push({
                        code: 'setflag.not-boolean',
                        message: `У узла setflag "${node.id}" value должно быть true или false`
                    });
                }

                return found;
            }
        });

        return {
            api: {
                get,
                getValue,
                has,
                set,
                update,
                add,
                format
            },

            cleanup() {
                Object.keys(state).forEach(
                    key => delete state[key]
                );
            }
        };
    }
};

export default StatePlugin;