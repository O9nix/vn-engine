/**
 * @class StatePlugin
 * @apiGroup Plugins
 *
 * Управляет runtime-состоянием игры.
 *
 * Плагин хранит состояние независимо от Project.
 * Начальное состояние загружается из `project.config.state`
 * при событии `story:loaded`.
 *
 * Runtime-состояние изменяется через публичный API плагина
 * и доступно другим плагинам через:
 *
 * `api.plugins.state.api`
 */
export const StatePlugin = {
    name: 'state',

    install(api) {
        const state = {};

        /**
         * @apiName StatePlugin.get
         * @apiGroup StatePlugin
         *
         * Возвращает копию текущего runtime-состояния.
         *
         * @returns {Object} Копия текущего состояния.
         *
         * @example
         * const state = api.plugins.state.api.get();
         * console.log(state.health);
         */
        function get() {
            return { ...state };
        }

        /**
         * @apiName StatePlugin.getValue
         * @apiGroup StatePlugin
         *
         * Возвращает значение переменной состояния.
         *
         * @param {string} name Имя переменной.
         * @returns {*} Значение переменной.
         *
         * @example
         * const health =
         *     api.plugins.state.api.getValue('health');
         */
        function getValue(name) {
            return state[name];
        }

        /**
         * @apiName StatePlugin.set
         * @apiGroup StatePlugin
         *
         * Устанавливает значение переменной состояния.
         *
         * @param {string} name Имя переменной.
         * @param {*} value Новое значение.
         *
         * @example
         * api.plugins.state.api.set('health', 10);
         */
        function set(name, value) {
            state[name] = value;
        }

        /**
         * @apiName StatePlugin.update
         * @apiGroup StatePlugin
         *
         * Обновляет несколько переменных состояния.
         *
         * @param {Object} values Объект с новыми значениями.
         *
         * @example
         * api.plugins.state.api.update({
         *     health: 10,
         *     money: 100
         * });
         */
        function update(values) {
            Object.assign(state, values);
        }

        /**
         * @apiName StatePlugin.storyLoaded
         * @apiGroup StatePlugin
         *
         * Инициализирует runtime-состояние из конфигурации проекта
         * после загрузки истории.
         */
        const unsubscribeStoryLoaded =
            api.events.on(
                'story:loaded',
                ({ project }) => {
                    const initialState =
                        project
                            ?.getConfig()
                            ?.state ?? {};

                    Object.keys(state).forEach(
                        key => delete state[key]
                    );

                    Object.assign(
                        state,
                        initialState
                    );
                }
            );

        return {
            api: {
                get,
                getValue,
                set,
                update
            },

            cleanup() {
                unsubscribeStoryLoaded();

                Object.keys(state).forEach(
                    key => delete state[key]
                );
            }
        };
    }
};