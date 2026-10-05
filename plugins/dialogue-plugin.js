export const DialoguePlugin = {
    name: 'dialogue',

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

                element.innerHTML = `
                    <strong
                        style="color: #ffd700;"
                    >
                        ${node.character ?? ''}
                    </strong>

                    <br>

                    ${node.text ?? ''}
                `;

                const block =
                    api.blocks.create(
                        'dialogue',
                        {
                            channel: 'content',
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

        return () => {
            // Пока нечего удалять.
        };
    }
};
