export const StatePlugin = {
    name: 'state',

    install(api) {
        let state = {};
                    api.events.on('story:loaded', ({ project }) => {
                       
    state = project.getConfig()
    console.log(state)
});
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
                     // Эмитим событие об изменении
                    api.events.emit('state:changed', { key: name, value });
                },

                update(values) {
                    Object.assign(state, values);
                     for (const [key, value] of Object.entries(values)) {
                        api.events.emit('state:changed', { key, value });
                    }
                }
            },

            cleanup() {
                // Пока ничего не нужно
            }
        };
    }
};