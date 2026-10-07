export const StatePlugin = {
    name: 'state',

    install(api) {
        const state = {
            health: 7
        };

        return {
            api: {
                get() {
                    return { ...state };
                },

                getValue(name) {
                    return state[name];
                },

                set(name, value) {
                    state[name] = value;
                },

                update(values) {
                    Object.assign(state, values);
                }
            },

            cleanup() {
                // Пока ничего не нужно
            }
        };
    }
};