export const TopLeftHUDPlugin = {
    name: 'topLeftHUD',

    install(api) {
        console.log('[TopLeftHUD] Начало установки плагина...');

        // 1. Создание UI-элемента
        const element = document.createElement('div');
        element.className = 'top-left-hud';
        
        // ДОБАВЛЕНО: display: 'block' и яркая рамка для отладки
        Object.assign(element.style, {
            position: 'absolute',
            top: '20px',
            left: '20px',
            display: 'block', // Явно указываем, что элемент должен быть видимым
            minWidth: '260px',
            padding: '15px',
            background: 'rgba(255, 0, 0, 0.5)', // Временно красный полупрозрачный фон, чтобы точно увидеть!
            color: '#ffffff',
            borderRadius: '8px',
            fontSize: '16px',
            lineHeight: '1.5',
            border: '2px solid yellow', // Яркая рамка для отладки
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none',
            zIndex: '9999', // Максимальный z-index, чтобы быть поверх всего
            transition: 'opacity 0.3s ease'
        });

        const displayData = {
            title: 'Отладка HUD',
            items: { 'Статус': 'Ожидание данных...' }
        };

        function render() {
            console.log('[TopLeftHUD] Вызов render(). Данные:', displayData);
            let html = `
                <div style="
                    font-weight: bold; 
                    color: #ffff00; 
                    margin-bottom: 12px; 
                    padding-bottom: 8px; 
                    border-bottom: 1px solid rgba(255,255,255,0.5);
                    font-size: 18px;
                ">
                    ${displayData.title}
                </div>
            `;

            for (const [key, value] of Object.entries(displayData.items)) {
                html += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span>${key}:</span>
                        <span style="font-weight: bold;">${value}</span>
                    </div>
                `;
            }
            element.innerHTML = html;
        }

        // Первичный рендер (обязательно!)
        render();
        console.log('[TopLeftHUD] Первичный рендер выполнен. Элемент:', element);

             // 2. Регистрация слоя и явное добавление в DOM
        if (api.player && typeof api.player.registerLayer === 'function') {
            api.player.registerLayer('top-left-hud', element);
            console.log('[TopLeftHUD] Слой зарегистрирован в api.player');
        }

        // ГАРАНТИРОВАННОЕ ДОБАВЛЕНИЕ В DOM:
        // Получаем корневой контейнер для плагинов и добавляем наш элемент туда
        const pluginLayer = api.player.getPluginLayer();
        if (pluginLayer && !pluginLayer.contains(element)) {
            pluginLayer.appendChild(element);
            console.log('[TopLeftHUD] Элемент явно добавлен в DOM через getPluginLayer()');
        }

        if (api.player && typeof api.player.show === 'function') {
            api.player.show('top-left-hud');
            console.log('[TopLeftHUD] Вызован api.player.show("top-left-hud")');
        }

        // 3. Подписка на события
        api.events.on('story:loaded', ({ project }) => {
    const config = project.getConfig();
    // Если в конфиге есть ключ state, берем его. Иначе берем весь конфиг.
   let state = config.state || config; 
    console.log('[StatePlugin] Инициализированное состояние:', state);
});

              const unsubscribeStoryLoaded = api.events.on('story:loaded', () => {
            console.log('[TopLeftHUD] Получено событие story:loaded');
            
            if (api.plugins && api.plugins.state) {
                const stateApi = api.plugins.state.api;
                let state = stateApi.get();
                
                // Защита от вложенности (если state всё ещё вернется как { state: {...} })
                if (state.state && typeof state.state === 'object') {
                    state = state.state;
                }
                
                console.log('[TopLeftHUD] Итоговое состояние для рендера:', state);
                
                const displayKeys = ['health', 'mana', 'gold', 'score', 'level'];
                let hasData = false;
                for (const key of displayKeys) {
                    if (state[key] !== undefined) {
                        displayData.items[key] = state[key];
                        hasData = true;
                    }
                }
                
                if (hasData) {
                    displayData.title = 'Статус героя';
                    render();
                }
            }
        });

        // 4. Возврат API
        return {
            api: {
                set(key, value) {
                    displayData.items[key] = value;
                    render();
                },
                setTitle(title) {
                    displayData.title = title;
                    render();
                },
                update(values) {
                    Object.assign(displayData.items, values);
                    render();
                },
                show() {
                    element.style.display = 'block';
                    if (api.player?.show) api.player.show('top-left-hud');
                },
                hide() {
                    element.style.display = 'none';
                    if (api.player?.hide) api.player.hide('top-left-hud');
                }
            },

            cleanup() {
                console.log('[TopLeftHUD] Очистка плагина');
                unsubscribeStoryLoaded();
                unsubscribeStateChange();
                if (api.player?.hide) api.player.hide('top-left-hud');
            }
        };
    }
};