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

        // Типы узлов движок снимает сам.
    }
};

export default BackgroundPlugin;
