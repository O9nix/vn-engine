export const ChoicePlugin = {
    name: 'choice',
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

                context.wait();
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