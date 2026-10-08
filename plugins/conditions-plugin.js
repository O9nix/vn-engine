/**
 * @class ConditionsPlugin
 * @apiGroup Plugins
 *
 * Проверяет игровые условия.
 *
 * Предоставляет другим плагинам метод evaluate()
 * через api.plugins.conditions.api.
 *
 * Поддерживаемые операторы:
 * ==, !=, >, >=, <, <=
 */
export const ConditionsPlugin = {
    name: 'conditions',

    install(api) {
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
         * @throws {Error} Если оператор условия неизвестен.
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

        return {
            api: {
                evaluate
            },

            cleanup() {
                // Плагин не создаёт ресурсов,
                // требующих очистки.
            }
        };
    }
};