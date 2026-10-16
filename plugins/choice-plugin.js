/**
 * @class ChoicePlugin
 * @apiGroup Plugins
 *
 * Узел `choice`: кнопки выбора с условными вариантами и переходом goto.
 * Зависит от плагинов `state` и `conditions`.
 *
 * Для текстового сценария добавляет команду парсера:
 *
 * `CHOICE: Вопрос | Вариант 1 → метка1 | Вариант 2 → метка2`
 *
 * Вместо стрелки можно писать `->`. Вариант без стрелки создаётся
 * без перехода: история просто продолжится со следующего узла.
 * Условия в текстовой записи пока не поддерживаются.
 *
 * Пока выбор не сделан, клик по экрану историю не продолжает. Блоки диалога
 * и повествования на время выбора скрываются.
 *
 * Выбор с таймером: поле `timeout` (миллисекунды) включает отсчёт, который
 * виден на экране. Если игрок не успел, история переходит к `timeoutGoto`
 * (узел или сцена) или, если поля нет, идёт дальше по порядку.
 *
 * Условия вариантов: см. плагин `conditions` (сравнения, флаги, all, any, not).
 * Текст вопроса и вариантов поддерживает подстановку `{имя}` из состояния.
 *
 * Проверки проекта (через `api.validation`):
 *
 * - `choice.no-options` (ошибка): у узла нет `options`;
 * - `choice.no-variants` (ошибка): у варианта нет `variants`;
 * - `choice.bad-condition` (ошибка): условие записано неверно;
 * - `choice.bad-timeout` (ошибка): `timeout` не положительное число;
 * - `choice.unknown-variable` (предупреждение): условие ссылается
 *   на переменную, которой нет ни в `config.state`, ни среди узлов
 *   `setvar` и `setflag`.
 *
 * @example
 * // Узел в проекте
 * {
 *     id: 'ask',
 *     type: 'choice',
 *     text: 'Куда пойдём?',
 *     options: [
 *         { id: 'o1', variants: [{ text: 'В подвал', goto: 'basement' }] },
 *         {
 *             id: 'o2',
 *             variants: [{
 *                 text: 'Открыть дверь',
 *                 goto: 'door',
 *                 condition: { variable: 'health', operator: '>', value: 1 }
 *             }]
 *         }
 *     ]
 * }
 *
 * // Строка в текстовом сценарии
 * CHOICE: Куда пойдём? | В подвал → basement | На улицу -> street
 */
export const ChoicePlugin = {
    name: 'choice',
    version: '0.1.0',
    nodeTypes: ['choice'],
    dependencies: [ 'state', 'conditions' ],
    install(api) {
        let activeBlock = null;
        let timeoutId = null;
        let animationId = null;

        // Убирает блок выбора и останавливает отсчёт.
        function closeBlock() {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }

            if (animationId !== null) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }

            if (activeBlock) {
                api.blocks.remove(activeBlock.id);
                activeBlock = null;
            }
        }

        // Возврат к снимку: кнопки и отсчёт старой позиции не нужны.
        api.events.on('story:restoring', closeBlock);

        // Текстовая запись выбора для парсера сценария.
        api.ast.addCommand(
            /^CHOICE:\s*(.+)$/,
            'choice',
            (match, originalLine, index) => {
                const parts = match[1]
                    .split('|')
                    .map(part => part.trim())
                    .filter(Boolean);

                const [text, ...rawOptions] = parts;

                if (rawOptions.length === 0) {
                    api.log.warn(
                        `CHOICE без вариантов, строка пропущена: ${originalLine}`
                    );

                    return null;
                }

                const options = rawOptions.map((raw, i) => {
                    const found = raw.match(/^(.*?)\s*(?:→|->)\s*(\S+)$/);
                    const variant = found
                        ? { text: found[1], goto: found[2] }
                        : { text: raw };

                    return {
                        id: `option_${i + 1}`,
                        variants: [variant]
                    };
                });

                return {
                    _id: `node_${index}`,
                    type: 'choice',
                    text,
                    options
                };
            }
        );

        // Проверка структуры каждого узла choice до запуска истории.
        api.validation.registerNodeRule('choice', {
            id: 'options',
            run(node) {
                const found = [];

                if (!Array.isArray(node.options) || node.options.length === 0) {
                    found.push({
                        code: 'choice.no-options',
                        message: `У выбора "${node.id}" нет вариантов (options)`
                    });

                    return found;
                }

                for (const option of node.options) {
                    if (!option.variants?.length) {
                        found.push({
                            code: 'choice.no-variants',
                            message: `У варианта "${option.id}" выбора "${node.id}" нет variants`
                        });
                    }
                }

                return found;
            }
        });

        // Таймер и условия вариантов.
        api.validation.registerNodeRule('choice', {
            id: 'details',
            run(node) {
                const found = [];

                if (
                    node.timeout !== undefined &&
                    !(typeof node.timeout === 'number' && node.timeout > 0)
                ) {
                    found.push({
                        code: 'choice.bad-timeout',
                        message: `У выбора "${node.id}" timeout должен быть положительным числом (миллисекунды)`
                    });
                }

                for (const option of node.options ?? []) {
                    for (const variant of option.variants ?? []) {
                        for (const problem of api.plugins.conditions.api.validate(variant.condition)) {
                            found.push({
                                code: 'choice.bad-condition',
                                message: `Условие варианта "${option.id}" выбора "${node.id}": ${problem}`
                            });
                        }
                    }
                }

                return found;
            }
        });

        // Предупреждение: условие ссылается на переменную, которой нет.
        // Известны переменные из config.state и те, что задают узлы
        // setvar и setflag. Читаем данные проекта, а не runtime-состояние:
        // при проверке история ещё не загружена, и state пуст.
        api.validation.register({
            id: 'unknown-variables',
            severity: 'warning',
            run(project) {
                const known = new Set(Object.keys(project.getConfig()?.state ?? {}));

                for (const scene of project.getScenes()) {
                    for (const node of scene.nodes ?? []) {
                        if (node.type === 'setvar' && typeof node.variable === 'string') {
                            known.add(node.variable);
                        }

                        if (node.type === 'setflag' && typeof node.flag === 'string') {
                            known.add(node.flag);
                        }
                    }
                }

                const found = [];

                for (const scene of project.getScenes()) {
                    for (const node of scene.nodes ?? []) {
                        for (const option of node.options ?? []) {
                            for (const variant of option.variants ?? []) {
                                const names = api.plugins.conditions.api.variables(variant.condition);

                                for (const name of names) {
                                    if (!known.has(name)) {
                                        found.push({
                                            code: 'choice.unknown-variable',
                                            message: `Переменной "${name}" нет в config.state и ни один узел её не задаёт`,
                                            path: `узел "${node.id}"`
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                return found;
            }
        });

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
                    api.log.warn(
                        'У choice нет options'
                    );

                    context.resume();

                    return;
                }

                const state =
                    api.plugins.state.api.get();

                let buttons = 0;
                let startTimer = null;

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

                    title.textContent =
                        api.plugins.state.api.format(node.text);

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
                        api.log.warn(
                            `Для option "${option.id}" нет подходящего variant`
                        );

                        continue;
                    }

                    const button =
                        document.createElement('button');

                    button.type = 'button';

                    button.textContent =
                        api.plugins.state.api.format(
                            variant.text ?? option.id
                        );

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

                            closeBlock();

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
                    buttons++;
                }

                const timeout =
                    typeof node.timeout === 'number' && node.timeout > 0
                        ? node.timeout
                        : 0;

                // Без доступных вариантов и без таймера выбор завис бы навсегда.
                if (buttons === 0 && timeout === 0) {
                    api.log.warn(
                        `У выбора "${node.id}" нет доступных вариантов, узел пропущен`
                    );

                    return;
                }

                if (timeout > 0) {
                    const label =
                        document.createElement('div');

                    const track =
                        document.createElement('div');

                    const bar =
                        document.createElement('div');

                    Object.assign(label.style, {
                        fontSize: '14px',
                        textAlign: 'center',
                        opacity: '0.8'
                    });

                    Object.assign(track.style, {
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.25)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                    });

                    Object.assign(bar.style, {
                        height: '100%',
                        width: '100%',
                        background: '#fff'
                    });

                    track.appendChild(bar);
                    element.append(label, track);

                    // Отсчёт запускается после показа блока.
                    startTimer = () => {
                        const start = performance.now();

                        const tick = (now) => {
                            const left = Math.max(timeout - (now - start), 0);

                            bar.style.width = `${(left / timeout) * 100}%`;
                            label.textContent =
                                `Осталось: ${Math.ceil(left / 1000)} с`;

                            animationId = left > 0
                                ? requestAnimationFrame(tick)
                                : null;
                        };

                        animationId = requestAnimationFrame(tick);

                        timeoutId = setTimeout(() => {
                            timeoutId = null;

                            closeBlock();

                            if (node.timeoutGoto) {
                                context.goto(node.timeoutGoto);
                            } else {
                                context.resume();
                            }
                        }, timeout);
                    };
                }

                // Текст предыдущей реплики под кнопками выбора только мешает.
                for (const block of api.blocks.getActiveByChannel('content')) {
                    api.blocks.hide(block.id);
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

                startTimer?.();

                context.wait({ lock: true });
            }
        );

        return {
            api: {},

            cleanup() {
                closeBlock();
            }
        };
    }
};

export default ChoicePlugin;
