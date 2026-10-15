/**
 * @class DialoguePlugin
 * @apiGroup Plugins
 *
 * Узел `dialogue`: реплика персонажа. История ждёт клика игрока.
 *
 * Для текстового сценария добавляет команду парсера `[Имя] Текст`.
 *
 * @example
 * // Узел в проекте
 * { id: 'd1', type: 'dialogue', character: 'Анна', text: 'Привет!' }
 *
 * // Строка в текстовом сценарии
 * [Анна] Привет!
 */
export const DialoguePlugin = {
    name: 'dialogue',
    version: '0.1.0',
    nodeTypes: ['dialogue'],
   

    install(api) {
        api.log.info('DialoguePlugin успешно установлен')

        // Регистрируем команду через общий API
        api.ast.addCommand(
            /^\[([^\]]+)\]\s*(.*)$/, // Регулярка: [Имя] Текст
            'dialogue',              // Тип узла
            (match, originalLine, index, scene) => {
                // Это функция-обработчик. Она выполняется, когда строка совпала.
                // match[1] = имя персонажа, match[2] = текст
                return {
                    _id: `node_${index}`,
                    type: 'dialogue',
                    character: match[1],
                    text: match[2].trim()
                };
            }
        );
        api.game.registerNodeType(
            'dialogue',
            (node, context) => {
                const element =
                    document.createElement('div');

                element.className =
                    'dialogue-block';

                Object.assign(
                    element.style,
                    {
                        position: 'absolute',
                        left: '50%',
                        bottom: '30px',
                        transform: 'translateX(-50%)',
                        width: '80%',
                        padding: '20px',
                        background:
                            'rgba(0, 0, 0, 0.8)',
                        color: '#fff',
                        borderRadius: '10px',
                        fontSize: '20px',
                        textAlign: 'center',
                        pointerEvents: 'none'
                    }
                );

                // Текст выводится через textContent: сценарий
                // не должен вставлять в страницу произвольный HTML.
                const name = document.createElement('strong');

                name.style.color = '#ffd700';
                name.textContent = node.character ?? '';

                element.append(
                    name,
                    document.createElement('br'),
                    document.createTextNode(node.text ?? '')
                );

                const block =
                    api.blocks.create(
                        'dialogue',
                        {
                            channel: 'content',
                            replace: true,
                            element,
                            data: {
                                character:
                                    node.character,
                                text:
                                    node.text
                            },
                            meta: {
                                node
                            }
                        }
                    );

                api.log.debug(
                    'Создан блок:',
                    block
                );

                context.wait();
            }
        );

        // Блоки и типы узлов движок снимает сам.
    }
};

export default DialoguePlugin;
