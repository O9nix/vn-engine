export const NarrationPlugin = {
    name: 'narration',

    install(api) {
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
                            element,
                            data: {
                                text: node.text
                            },
                            meta: {
                                node
                            }
                        }
                    );

                console.log(
                    '[NarrationPlugin] Создан блок:',
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
