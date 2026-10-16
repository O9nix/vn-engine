/**
 * @class JumpPlugin
 * @apiGroup Plugins
 *
 * Узел `jump`: безусловный переход на другой узел или на сцену.
 * Поле `goto` — id узла или id сцены (тогда история продолжится
 * с первого узла сцены).
 *
 * Метки `goto` проверяет валидатор ещё до запуска истории.
 *
 * Текстовая запись (AST): `JUMP home`, `JUMP scene-2`.
 *
 * @example
 * { id: 'j1', type: 'jump', goto: 'home' }
 * { id: 'j2', type: 'jump', goto: 'scene-2' }
 */
export const JumpPlugin = {
    name: 'jump',
    version: '0.1.0',
    nodeTypes: ['jump'],

    install(api) {
        // JUMP ending
        // JUMP scene-2
        api.ast.addCommand(
            /^JUMP\s+(\S+)$/i,
            'jump',
            (match, _line, index) => ({
                _id: `jump_${index}`,
                type: 'jump',
                goto: match[1]
            })
        );

        api.game.registerNodeType('jump', (node, context) => {
            if (typeof node.goto !== 'string' || !node.goto) {
                throw new Error(
                    `jump "${node.id}": не указан узел или сцена (goto)`
                );
            }

            context.goto(node.goto);
        });

        api.validation.registerNodeRule('jump', {
            id: 'target',
            run(node) {
                return typeof node.goto === 'string' && node.goto
                    ? []
                    : [{
                        code: 'jump.no-target',
                        message: `У узла jump "${node.id}" не указано поле goto`
                    }];
            }
        });
    }
};

export default JumpPlugin;