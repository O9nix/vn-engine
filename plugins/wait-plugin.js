export const WaitPlugin = {
    name: 'wait',

    install(api) {
        let timeoutId = null;
        let animationId = null;
        let currentTimer = null;

        api.game.registerNodeType(
            'wait',
            (node, context) => {
                const duration =
                    Number(node.duration) || 0;

                if (duration <= 0) {
                    return;
                }

                const block =
                    api.blocks.getCurrent('content');

                if (!block) {
                    console.warn(
                        '[WaitPlugin] Нет текущего content-блока'
                    );
                    return;
                }

                console.log(
                    '[WaitPlugin] Текущий блок:',
                    block
                );

                context.wait();

                if (timeoutId !== null) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }

                if (animationId !== null) {
                    cancelAnimationFrame(
                        animationId
                    );
                    animationId = null;
                }

                if (currentTimer) {
                    currentTimer.remove();
                    currentTimer = null;
                }

                const container =
                    document.createElement('div');

                const progress =
                    document.createElement('div');

                Object.assign(
                    container.style,
                    {
                        position: 'absolute',
                        left: '20px',
                        right: '20px',
                        bottom: '10px',
                        height: '6px',
                        background:
                            'rgba(255, 255, 255, 0.25)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                        pointerEvents: 'none'
                    }
                );

                Object.assign(
                    progress.style,
                    {
                        width: '0%',
                        height: '100%',
                        background: '#fff'
                    }
                );

                container.appendChild(progress);
                block.element.appendChild(container);

                currentTimer = container;

                const start = performance.now();

                const update = (now) => {
                    const elapsed = now - start;

                    const percent = Math.min(
                        (elapsed / duration) * 100,
                        100
                    );

                    progress.style.width =
                        `${percent}%`;

                    if (elapsed < duration) {
                        animationId =
                            requestAnimationFrame(update);
                    } else {
                        animationId = null;
                    }
                };

                animationId =
                    requestAnimationFrame(update);

                timeoutId = setTimeout(() => {
                    timeoutId = null;

                    if (animationId !== null) {
                        cancelAnimationFrame(
                            animationId
                        );
                        animationId = null;
                    }

                    progress.style.width = '100%';

                    if (currentTimer) {
                        currentTimer.remove();
                        currentTimer = null;
                    }

                    context.resume();
                }, duration);
            }
        );

        return () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (animationId !== null) {
                cancelAnimationFrame(
                    animationId
                );
                animationId = null;
            }

            if (currentTimer) {
                currentTimer.remove();
                currentTimer = null;
            }
        };
    }
};
