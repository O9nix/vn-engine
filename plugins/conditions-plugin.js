const OPERATORS = ['==', '!=', '>', '>=', '<', '<='];

/**
 * @class ConditionsPlugin
 * @apiGroup Plugins
 *
 * Проверяет игровые условия.
 *
 * Предоставляет другим плагинам методы evaluate(), validate()
 * и variables() через api.plugins.conditions.api.
 *
 * Виды условий:
 *
 * - сравнение: `{ variable, operator, value }`, операторы
 *   ==, !=, >, >=, <, <=;
 * - флаг: `{ flag: 'met_anna' }` (истинно, если флаг поставлен)
 *   или `{ flag: 'met_anna', value: false }` (истинно, если не поставлен);
 * - «и»: `{ all: [условие, условие] }`;
 * - «или»: `{ any: [условие, условие] }`;
 * - «не»: `{ not: условие }`.
 *
 * Условия можно вкладывать друг в друга. Пустое условие считается истинным.
 *
 * @example
 * const { evaluate } = api.plugins.conditions.api;
 *
 * evaluate({ variable: 'health', operator: '>=', value: 3 }, { health: 3 }); // true
 *
 * evaluate({
 *     all: [
 *         { flag: 'met_anna' },
 *         { not: { variable: 'gold', operator: '<', value: 5 } }
 *     ]
 * }, { met_anna: true, gold: 7 }); // true
 */
export const ConditionsPlugin = {
    name: 'conditions',
    version: '0.2.0',
    nodeTypes: [],

    install(api) {
        api.log.info('Conditions plugin installed');

        /**
         * @apiName ConditionsPlugin.evaluate
         * @apiGroup ConditionsPlugin
         *
         * Проверяет условие относительно переданного состояния.
         *
         * Если условие не задано, возвращает true.
         *
         * @param {Object} condition Условие проверки.
         * @param {Object} state Состояние, относительно которого
         * проверяется условие.
         * @returns {boolean} Результат проверки.
         *
         * @throws {Error} Если оператор или вид условия неизвестен.
         *
         * @example
         * const result =
         *     api.plugins.conditions.api.evaluate(
         *         {
         *             variable: 'health',
         *             operator: '>',
         *             value: 5
         *         },
         *         { health: 10 }
         *     );
         */
        function evaluate(condition, state = {}) {
            if (!condition) {
                return true;
            }

            if (Array.isArray(condition.all)) {
                return condition.all.every(item => evaluate(item, state));
            }

            if (Array.isArray(condition.any)) {
                return condition.any.some(item => evaluate(item, state));
            }

            if ('not' in condition) {
                return !evaluate(condition.not, state);
            }

            if ('flag' in condition) {
                const expected = condition.value ?? true;

                return Boolean(state[condition.flag]) === Boolean(expected);
            }

            const {
                variable,
                operator,
                value
            } = condition;

            const actualValue = state[variable];

            switch (operator) {
                case '==':
                    return actualValue == value;

                case '!=':
                    return actualValue != value;

                case '>':
                    return actualValue > value;

                case '>=':
                    return actualValue >= value;

                case '<':
                    return actualValue < value;

                case '<=':
                    return actualValue <= value;

                default:
                    throw new Error(
                        `Неизвестный оператор условия: ${operator}`
                    );
            }
        }

        /**
         * @apiName ConditionsPlugin.validate
         * @apiGroup ConditionsPlugin
         *
         * Проверяет форму условия, не вычисляя его. Нужна валидаторам
         * проекта: ошибку в условии лучше найти до запуска игры.
         *
         * @param {Object} condition Условие.
         * @returns {string[]} Описания проблем; пустой массив, если условие верно.
         *
         * @example
         * const problems = api.plugins.conditions.api.validate({
         *     variable: 'health',
         *     operator: '=>',
         *     value: 1
         * });
         * // ['неизвестный оператор "=>"']
         */
        function validate(condition) {
            if (condition === undefined || condition === null) {
                return [];
            }

            if (typeof condition !== 'object' || Array.isArray(condition)) {
                return ['условие должно быть объектом'];
            }

            const forms = ['all', 'any', 'not', 'flag', 'variable']
                .filter(key => key in condition);

            if (forms.length === 0) {
                return ['в условии нет variable, flag, all, any или not'];
            }

            if (forms.length > 1) {
                return [`в одном условии смешаны поля ${forms.join(', ')}`];
            }

            const [form] = forms;

            if (form === 'all' || form === 'any') {
                const list = condition[form];

                if (!Array.isArray(list) || list.length === 0) {
                    return [`${form} должен быть непустым массивом условий`];
                }

                return list.flatMap(validate);
            }

            if (form === 'not') {
                return condition.not === null || typeof condition.not !== 'object'
                    ? ['not должен содержать условие']
                    : validate(condition.not);
            }

            if (form === 'flag') {
                return typeof condition.flag === 'string' && condition.flag
                    ? []
                    : ['flag должен быть непустой строкой'];
            }

            const problems = [];

            if (typeof condition.variable !== 'string' || !condition.variable) {
                problems.push('variable должен быть непустой строкой');
            }

            if (!OPERATORS.includes(condition.operator)) {
                problems.push(`неизвестный оператор "${condition.operator}"`);
            }

            if (!('value' in condition)) {
                problems.push('не указано value');
            }

            return problems;
        }

        /**
         * @apiName ConditionsPlugin.variables
         * @apiGroup ConditionsPlugin
         *
         * Собирает имена переменных и флагов, которые использует условие,
         * в том числе во вложенных условиях.
         *
         * @param {Object} condition Условие.
         * @returns {string[]} Имена без повторов.
         *
         * @example
         * api.plugins.conditions.api.variables({
         *     any: [
         *         { flag: 'met_anna' },
         *         { variable: 'gold', operator: '>', value: 5 }
         *     ]
         * }); // ['met_anna', 'gold']
         */
        function variables(condition) {
            const found = new Set();

            const walk = (item) => {
                if (item === null || typeof item !== 'object') {
                    return;
                }

                for (const child of item.all ?? []) {
                    walk(child);
                }

                for (const child of item.any ?? []) {
                    walk(child);
                }

                walk(item.not);

                if (typeof item.variable === 'string') {
                    found.add(item.variable);
                }

                if (typeof item.flag === 'string') {
                    found.add(item.flag);
                }
            };

            walk(condition);

            return [...found];
        }

        return {
            api: {
                evaluate,
                validate,
                variables
            },

            cleanup() {
                // Плагин не создаёт ресурсов,
                // требующих очистки.
            }
        };
    }
};

export default ConditionsPlugin;
