// Допускаются относительные пути, http(s) и data:image. Кавычки, скобки
// и переводы строк запрещены, чтобы адрес не вышел за пределы url(...).
function isSafeImageUrl(value) {
    if (typeof value !== 'string' || /["'()\\\s]/.test(value)) {
        return false;
    }

    if (/^(https?:\/\/|data:image\/|\.{0,2}\/)/i.test(value)) {
        return true;
    }

    return !/^[a-z][a-z0-9+.-]*:/i.test(value);
}

/**
 * @class BackgroundPlugin
 * @apiGroup Plugins
 *
 * Узел `background`: ставит картинку фоном страницы.
 * Допустимы относительные пути, http(s) и data:image без кавычек, скобок
 * и пробелов. Небезопасный адрес находит валидатор (`background.unsafe-image`),
 * а если он всё же попал в игру, историю останавливает ошибка.
 *
 * @example
 * {
 *     id: 'bg1',
 *     type: 'background',
 *     image: 'assets/forest.jpg'
 * }
 */
export const BackgroundPlugin = {
    name: 'background',
    version: '0.1.0',
    nodeTypes: ['background'],

    install(api) {
        api.game.registerNodeType(
            'background',
            (node) => {
                if (!node.image) {
                    api.log.warn(
                        'Не указано изображение'
                    );
                    return;
                }

                if (!isSafeImageUrl(node.image)) {
                    throw new Error(
                        `Недопустимый адрес изображения: ${node.image}`
                    );
                }

                document.body.style.backgroundImage =
                    `url(${JSON.stringify(node.image)})`;

                document.body.style.backgroundSize =
                    'cover';

                document.body.style.backgroundPosition =
                    'center';

                document.body.style.backgroundRepeat =
                    'no-repeat';

                api.log.debug(
                    'Установлен фон:',
                    node.image
                );
            }
        );

        // Небезопасный или пропущенный адрес лучше найти до запуска истории,
        // а не остановить проект посреди игры.
        api.validation.registerNodeRule('background', {
            id: 'image',
            run(node) {
                if (!node.image) {
                    return [{
                        code: 'background.no-image',
                        message: `У узла background "${node.id}" не указано изображение (image)`,
                        severity: 'warning'
                    }];
                }

                return isSafeImageUrl(node.image)
                    ? []
                    : [{
                        code: 'background.unsafe-image',
                        message: `У узла background "${node.id}" недопустимый адрес изображения`
                    }];
            }
        });

        // Типы узлов движок снимает сам.
    }
};

export default BackgroundPlugin;
