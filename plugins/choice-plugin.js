export const ChoicePlugin = {
    name: 'choice',
    version: '0.1.0',
    nodeTypes: ['choice'],
    dependencies: [ 'state', 'conditions' ],
    install(api) {
        let activeBlock = null;

function resolveVariant(option, state) {
    for (const variant of option.variants ?? []) {
        if (
            api.plugins.conditions.api.evaluate(
                variant.condition,
                state
            )
        ) {
            return variant;
        }
    }

    return null;
}

        api.log.info('Choice plugin (parser + renderer) installed');

    // Паттерн: CHOICE: Заголовок | Вариант → label | Вариант → label
const choiceRegex = /^CHOICE:\s*(.+?)(\s*\|\s*(.+?)\s+→\s+([a-zA-Z0-9_]+))+$/i;

api.ast.addCommand(
    choiceRegex,
    'choice',
    (match, originalLine, index, scene) => {
        // match[0] = вся строка
        // match[1] = заголовок
        // match[2] = последний найденный фрагмент "| Вариант → label" (регулярка так работает)
        
        const title = match[1].trim();
        const options = [];

        // Нам нужно распарсить все варианты. 
        // Так как стандартная регулярка с + не даёт массив всех совпадений,
        // используем простой split по разделителю "|"
        
        const parts = originalLine.replace(/^CHOICE:\s*/i, '').split(/\|/);
        
        parts.forEach((part, idx) => {
            const trimmed = part.trim();
            if (!trimmed) return;

            // Пропускаем заголовок, если он первый, или обрабатываем его как первый вариант?
            // Логичнее: первый элемент после CHOICE: — это заголовок, остальные — варианты.
            if (idx === 0) {
                // Заголовок уже есть в переменной title, но на всякий случай проверим
                return; 
            }

            // Ищем паттерн "Текст → label" внутри части
            const variantRegex = /^(.+?)\s+→\s+([a-zA-Z0-9_]+)$/;
            const m = variantRegex.exec(trimmed);

            if (m) {
                const text = m[1].trim();
                const goto = m[2].trim();

                options.push({
                    id: `opt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    variants: [
                        {
                            condition: null,
                            text,
                            goto
                        }
                    ]
                });
            } else {
                console.warn(`[ChoicePlugin] Не удалось распарсить вариант в строке ${index}: "${trimmed}"`);
            }
        });

        if (options.length === 0) {
            console.warn(`[ChoicePlugin] В строке ${index} не найдено валидных вариантов выбора.`);
            return null; // Или вернуть заглушку, чтобы не ломать сцену
        }

        return {
            _id: `node_${index}`,
            type: 'choice',
            text: title, // Заголовок выбора
            options
        };
    }
);


        api.game.registerNodeType(
            'choice',
            (node, context) => {
                if (!Array.isArray(node.options)) {
                    console.warn(
                        '[ChoicePlugin] У choice нет options'
                    );

                    context.resume();

                    return;
                }

                const state =
                    api.plugins.state.api.get();

                const element =
                    document.createElement('div');

                element.className = 'choice-block';

                Object.assign(element.style, {
                    position: 'absolute',
                    left: '50%',
                    bottom: '30px',
                    transform: 'translateX(-50%)',
                    width: '80%',
                    padding: '20px',
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: '#fff',
                    borderRadius: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    pointerEvents: 'auto',
                    zIndex: '100'
                });

                element.addEventListener(
                    'click',
                    event => {
                        event.stopPropagation();
                    }
                );

                if (node.text) {
                    const title =
                        document.createElement('div');

                    title.textContent = node.text;

                    Object.assign(title.style, {
                        marginBottom: '10px',
                        fontSize: '20px',
                        fontWeight: 'bold',
                        textAlign: 'center'
                    });

                    element.appendChild(title);
                }

                for (const option of node.options) {
                    const variant =
                        resolveVariant(
                            option,
                            state
                        );

                    if (!variant) {
                        console.warn(
                            `[ChoicePlugin] Для option "${option.id}" нет подходящего variant`
                        );

                        continue;
                    }

                    const button =
                        document.createElement('button');

                    button.type = 'button';

                    button.textContent =
                        variant.text ?? option.id;

                    Object.assign(button.style, {
                        padding: '10px 15px',
                        fontSize: '16px',
                        cursor: 'pointer'
                    });

                    button.addEventListener(
                        'click',
                        () => {
                            if (!activeBlock) {
                                return;
                            }

                            api.blocks.remove(
                                activeBlock.id
                            );

                            activeBlock = null;

                            if (variant.goto) {
                                context.goto(
                                    variant.goto
                                );
                            } else {
                                context.resume();
                            }
                        }
                    );

                    element.appendChild(button);
                }

                activeBlock =
                    api.blocks.create(
                        'choice',
                        {
                            channel: 'overlay',
                            element,
                            data: {
                                text: node.text,
                                options: node.options
                            },
                            meta: {
                                node
                            }
                        }
                    );

                context.wait({ lock: true });
            }
        );

        return {
            api: {},

            cleanup() {
                if (activeBlock) {
                    api.blocks.remove(
                        activeBlock.id
                    );

                    activeBlock = null;
                }
            }
        };
    }
};

export default ChoicePlugin;
