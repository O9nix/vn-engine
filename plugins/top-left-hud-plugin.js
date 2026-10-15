/**
 * @class TopLeftHUDPlugin
 * @apiGroup Plugins
 *
 * Показывает в левом верхнем углу панель статуса героя.
 *
 * После загрузки истории панель подхватывает из состояния игры
 * значения `health`, `mana`, `gold`, `score` и `level`. Остальные
 * значения можно выводить через публичный API плагина:
 *
 * `api.plugins['top-left-hud'].api`
 *
 * Плагин зависит от `state`: он должен быть установлен раньше,
 * чтобы состояние уже было готово к моменту события `story:loaded`.
 *
 * @example
 * const hud = api.plugins['top-left-hud'].api;
 *
 * hud.setTitle('Герой');
 * hud.update({ health: 3, gold: 10 });
 */
export const TopLeftHUDPlugin = {
    name: 'top-left-hud',
    version: '0.1.0',
    dependencies: ['state'],
    nodeTypes: [],

    install(api) {
        const LAYER_NAME = 'top-left-hud';
        const STATE_KEYS = ['health', 'mana', 'gold', 'score', 'level'];

        const element = document.createElement('div');

        element.className = 'top-left-hud';

        Object.assign(element.style, {
            position: 'absolute',
            top: '20px',
            left: '20px',
            minWidth: '220px',
            padding: '12px 15px',
            background: 'rgba(0, 0, 0, 0.6)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            fontSize: '16px',
            lineHeight: '1.5',
            pointerEvents: 'none',
            zIndex: '50'
        });

        const data = {
            title: 'Статус',
            items: {}
        };

        // Текст выводится через textContent: значения состояния
        // не должны интерпретироваться как HTML.
        function render() {
            element.replaceChildren();

            const title = document.createElement('div');

            title.textContent = data.title;

            Object.assign(title.style, {
                fontWeight: 'bold',
                marginBottom: '8px',
                paddingBottom: '6px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.4)'
            });

            element.appendChild(title);

            for (const [key, value] of Object.entries(data.items)) {
                const row = document.createElement('div');

                Object.assign(row.style, {
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '16px'
                });

                const name = document.createElement('span');
                const val = document.createElement('span');

                name.textContent = `${key}:`;
                val.textContent = String(value);
                val.style.fontWeight = 'bold';

                row.append(name, val);
                element.appendChild(row);
            }
        }

        render();

        const removeLayer = api.player.registerLayer(
            LAYER_NAME,
            element
        );

        api.player.getPluginLayer().appendChild(element);

        const unsubscribeStoryLoaded = api.events.on(
            'story:loaded',
            () => {
                const state = api.plugins.state.api.get();

                let found = false;

                for (const key of STATE_KEYS) {
                    if (state[key] !== undefined) {
                        data.items[key] = state[key];
                        found = true;
                    }
                }

                if (found) {
                    data.title = 'Статус героя';
                }

                render();
            }
        );

        return {
            api: {
                /**
                 * @apiName TopLeftHUDPlugin.set
                 * @apiGroup TopLeftHUDPlugin
                 *
                 * Выводит значение в панели.
                 *
                 * @param {string} key Название строки.
                 * @param {*} value Значение строки.
                 *
                 * @example
                 * api.plugins['top-left-hud'].api.set('gold', 50);
                 */
                set(key, value) {
                    data.items[key] = value;
                    render();
                },

                /**
                 * @apiName TopLeftHUDPlugin.setTitle
                 * @apiGroup TopLeftHUDPlugin
                 *
                 * Меняет заголовок панели.
                 *
                 * @param {string} title Новый заголовок.
                 *
                 * @example
                 * api.plugins['top-left-hud'].api.setTitle('Статус героя');
                 */
                setTitle(title) {
                    data.title = title;
                    render();
                },

                /**
                 * @apiName TopLeftHUDPlugin.update
                 * @apiGroup TopLeftHUDPlugin
                 *
                 * Выводит сразу несколько значений.
                 *
                 * @param {Object} values Объект вида `{ название: значение }`.
                 *
                 * @example
                 * api.plugins['top-left-hud'].api.update({ gold: 50, level: 2 });
                 */
                update(values) {
                    Object.assign(data.items, values);
                    render();
                },

                /**
                 * @apiName TopLeftHUDPlugin.show
                 * @apiGroup TopLeftHUDPlugin
                 *
                 * Показывает панель.
                 *
                 * @example
                 * api.plugins['top-left-hud'].api.show();
                 */
                show() {
                    api.player.show(LAYER_NAME);
                },

                /**
                 * @apiName TopLeftHUDPlugin.hide
                 * @apiGroup TopLeftHUDPlugin
                 *
                 * Скрывает панель.
                 *
                 * @example
                 * api.plugins['top-left-hud'].api.hide();
                 */
                hide() {
                    api.player.hide(LAYER_NAME);
                }
            },

            cleanup() {
                unsubscribeStoryLoaded();
                removeLayer();
            }
        };
    }
};

export default TopLeftHUDPlugin;
