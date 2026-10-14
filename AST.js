export class AST {
    // Используем Map для хранения команд: key -> { pattern, nodeType, handler }
    #commands = new Map();

    constructor(parameters = {}) {
        // parameters можно использовать для настроек парсера, если нужно
    }

    /**
     * Регистрирует команду для парсера.
     * @param {RegExp} pattern - Регулярное выражение для поиска строки.
     * @param {string} nodeType - Тип узла, который создаст эта команда (например, 'dialogue', 'scene').
     * @param {Function} handler - Функция, которая превращает совпавшую строку в AST-узел.
     */
    addCommand(pattern, nodeType, handler) {
        if (!(pattern instanceof RegExp)) {
            throw new Error('Первый аргумент addCommand должен быть RegExp');
        }
        if (typeof handler !== 'function') {
            throw new Error('Третий аргумент addCommand должен быть функцией-обработчиком');
        }

        const key = pattern.source; // Используем источник регулярки как уникальный ключ
        this.#commands.set(key, { pattern, nodeType, handler });
    }

    /**
     * Получает все зарегистрированные команды.
     * Парсер будет перебирать их в цикле.
     */
    getCommands() {
        return Array.from(this.#commands.values());
    }

    parse(source) {
        const ast = { scenes: [] };
        const lines = source.split('\n');
        let currentScene = null;
        
        // Вспомогательная регулярка для сцен (можно тоже вынести в плагин, но пока оставим тут)
        const sceneRegex = /^\s*#\s+(.*)$/;

        lines.forEach((line, index) => {
            if (!line.trim()) return;

            const sceneMatch = line.match(sceneRegex);

            // 1. Обработка начала сцены
            if (sceneMatch) {
                if (currentScene) {
                    ast.scenes.push(currentScene);
                }
                currentScene = {
                    id: `scene_${index}`,
                    name: sceneMatch[1].trim(),
                    nodes: []
                };
                return;
            }

            if (!currentScene) return; // Сцена еще не началась

            // 2. Перебор всех зарегистрированных команд (плагинов)
            let nodeCreated = false;

            for (const cmd of this.getCommands()) {
                const match = cmd.pattern.exec(line);
                
                if (match) {
                    // Вызываем обработчик плагина, он возвращает готовый узел
                    const node = cmd.handler(match, line, index, currentScene);
                    
                    if (node) {
                        currentScene.nodes.push(node);
                        nodeCreated = true;
                        break; // Строка обработана, переходим к следующей строке
                    }
                }
            }

            // 3. Если ни один плагин не распознал строку, считаем её обычным текстом
            if (!nodeCreated) {
                currentScene.nodes.push({
                    _id: `node_${index}`,
                    type: 'text',
                    character: null,
                    text: line.trim()
                });
            }
        });

        if (currentScene) ast.scenes.push(currentScene);

        return ast;
    }
}