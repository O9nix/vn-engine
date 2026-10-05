export class ConditionEvaluator {
    evaluate(condition, state = {}) {
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
}