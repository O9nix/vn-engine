export const BackgroundPlugin = {
    name: 'background',
    version: '0.1.0',
    nodeTypes: ['background'],

    install(api) {
        api.game.registerNodeType(
            'background',
            (node) => {
                if (!node.image) {
                    console.warn(
                        '[BackgroundPlugin] Не указано изображение'
                    );
                    return;
                }

                document.body.style.backgroundImage =
                    `url("${node.image}")`;

                document.body.style.backgroundSize =
                    'cover';

                document.body.style.backgroundPosition =
                    'center';

                document.body.style.backgroundRepeat =
                    'no-repeat';

                console.log(
                    '[BackgroundPlugin] Установлен фон:',
                    node.image
                );
            }
        );

        return () => {
            // Пока нечего очищать.
        };
    }
};

export default BackgroundPlugin;
