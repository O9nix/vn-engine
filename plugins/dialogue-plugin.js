export const DialoguePlugin = {
    name: 'dialogue',
    version: '0.1.0',
    nodeTypes: ['dialogue'],

    install(api) {
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

                console.log(
                    '[DialoguePlugin] Создан блок:',
                    block
                );

                context.wait();
            }
        );

        // Блоки и типы узлов движок снимает сам.
    }
};

export default DialoguePlugin;
