/**
 * @class AST
 * @apiGroup AST
 *
 * Парсер текста сценария в структуру сцен и узлов.
 *
 * Сам парсер умеет только делить текст на сцены (строка `# Название`).
 * Остальные строки распознают команды, которые регистрируют плагины
 * через `api.ast.addCommand`. Строка, которую не узнала ни одна команда,
 * становится узлом `text`.
 *
 * @example
 * const parser = new AST();
 *
 * parser.addCommand(/^\/\/\s*(.*)$/, 'narration', (match) => ({
 *     type: 'narration',
 *     text: match[1].trim()
 * }));
 *
 * const project = parser.parse('# Сцена\n// Тихая ночь.');
 */
export class AST {
    // Команды хранятся по ключу-источнику регулярки: key -> { pattern, nodeType, handler }
    #commands = new Map();

    static #keyOf(pattern) {
        return `${pattern.source}/${pattern.flags}`;
    }

    /**
     * @apiName AST.constructor
     * @apiGroup AST
     * Создаёт парсер без команд.
     * @param {Object} [parameters] Настройки парсера (пока не используются).
     *
     * @example
     * const parser = new AST();
     * parser.addCommand(/^!/, 'bang', () => ({ type: 'bang' }));
     */
    constructor(parameters = {}) {
        // parameters можно использовать для настроек парсера, если нужно
    }

    /**
     * @apiName AST.addCommand
     * @apiGroup AST
     *
     * Регистрирует команду для парсера.
     *
     * @param {RegExp} pattern Регулярное выражение для поиска строки.
     * @param {string} nodeType Тип узла, который создаст команда (например, dialogue).
     * @param {function} handler Функция (match, line, index, scene), которая
     * превращает совпавшую строку в узел или возвращает null, если строка не подошла.
     * @returns {function} Функция, снимающая команду.
     * @throws {Error} Если pattern не RegExp, handler не функция
     * или команда с таким же регулярным выражением уже есть.
     *
     * @example
     * parser.addCommand(/^\[([^\]]+)\]\s*(.*)$/, 'dialogue', (match, line, index) => ({
     *     type: 'dialogue',
     *     character: match[1],
     *     text: match[2].trim()
     * }));
     */
    addCommand(pattern, nodeType, handler) {
        if (!(pattern instanceof RegExp)) {
            throw new Error('Первый аргумент addCommand должен быть RegExp');
        }
        if (typeof handler !== 'function') {
            throw new Error('Третий аргумент addCommand должен быть функцией-обработчиком');
        }

        const key = AST.#keyOf(pattern); // источник регулярки и флаги — уникальный ключ

        if (this.#commands.has(key)) {
            throw new Error(
                `Команда парсера ${pattern} уже зарегистрирована`
            );
        }

        this.#commands.set(key, { pattern, nodeType, handler });

        return () => this.removeCommand(pattern);
    }

    /**
     * @apiName AST.removeCommand
     * @apiGroup AST
     *
     * Снимает команду парсера.
     *
     * @param {RegExp} pattern Регулярное выражение, с которым команда была добавлена.
     * @returns {boolean} true, если команда была зарегистрирована.
     *
     * @example
     * const pattern = /^!/;
     * parser.addCommand(pattern, 'bang', () => ({ type: 'bang' }));
     * parser.removeCommand(pattern); // true
     */
    removeCommand(pattern) {
        return this.#commands.delete(AST.#keyOf(pattern));
    }

    /**
     * @apiName AST.getCommands
     * @apiGroup AST
     *
     * Возвращает зарегистрированные команды в порядке добавления.
     * Парсер перебирает их в цикле.
     *
     * @returns {Object[]} Массив объектов { pattern, nodeType, handler }.
     *
     * @example
     * for (const command of parser.getCommands()) {
     *     console.log(command.nodeType, command.pattern);
     * }
     */
    getCommands() {
        return Array.from(this.#commands.values());
    }

    /**
     * @apiName AST.parse
     * @apiGroup AST
     *
     * Разбирает текст сценария.
     *
     * @param {string} source Текст сценария.
     * @returns {Object} Объект { scenes }: массив сцен { id, name, nodes }.
     *
     * @example
     * const result = parser.parse('# Сцена\n[Анна] Привет');
     * // result.scenes[0].nodes[0].type === 'dialogue'
     */
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