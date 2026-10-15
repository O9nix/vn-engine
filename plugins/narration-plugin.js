/**
 * @class NarrationPlugin
 * @apiGroup Plugins
 *
 * Узел `narration`: текст от автора без имени персонажа.
 * История ждёт клика игрока.
 *
 * Для текстового сценария добавляет команду парсера `// Текст`.
 *
 * @example
 * // Узел в проекте
 * { id: 'n1', type: 'narration', text: 'Тихая ночь.' }
 *
 * // Строка в текстовом сценарии
 * // Тихая ночь.
 */
export const NarrationPlugin = {
    name: 'narration',
    version: '0.1.0',
    nodeTypes: ['narration'],


    install(api) {
 api.log.info('Narration plugin installed');

        // Паттерн: строка начинается с //, дальше любой текст
        api.ast.addCommand(
            /^\/\/\s*(.*)$/,
            'narration',
            (match, originalLine, index, scene) => {
                return {
                    _id: `node_${index}`,
                    type: 'narration',
                    text: match[1].trim()
                };
            }
        );

        api.game.registerNodeType(
            'narration',
            (node, context) => {
                const element =
                    document.createElement('div');

                element.className =
                    'narration-block';

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
                            'rgba(0, 0, 0, 0.6)',
                        color: '#ccc',
                        borderRadius: '10px',
                        fontSize: '18px',
                        textAlign: 'center',
                        fontStyle: 'italic',
                        pointerEvents: 'none'
                    }
                );

                element.textContent =
                    node.text ?? '';

                const block =
                    api.blocks.create(
                        'narration',
                        {
                            channel: 'content',
                            replace: true,
                            element,
                            data: {
                                text: node.text
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

export default NarrationPlugin;
