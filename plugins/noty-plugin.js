export const NotyPlugin = {
    name: 'noty',
    version: '0.1.0',
    nodeTypes: [],

    install(api) {
        console.log('[Noty] Начало установки плагина...');

        // ==========================================
        // 1. ИНЪЕКЦИЯ СТИЛЕЙ
        // ==========================================
        if (!document.getElementById('noty-plugin-styles')) {
            const style = document.createElement('style');
            style.id = 'noty-plugin-styles';
            style.textContent = `
                .notifications-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    max-width: 400px;
                    pointer-events: none;
                }

                .notification {
                    background: white;
                    border-radius: 8px;
                    padding: 16px 20px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                    min-width: 300px;
                    animation: slideIn 0.3s ease-out;
                    border-left: 4px solid #3b82f6;
                    pointer-events: auto;
                }

                .notification.closing {
                    animation: slideOut 0.3s ease-in forwards;
                }

                .notification.success { border-left-color: #10b981; }
                .notification.error { border-left-color: #ef4444; }
                .notification.warning { border-left-color: #f59e0b; }
                .notification.info { border-left-color: #3b82f6; }

                .notification-icon {
                    font-size: 20px;
                    flex-shrink: 0;
                    line-height: 1;
                }

                .notification.success .notification-icon::before { content: '✓'; color: #10b981; }
                .notification.error .notification-icon::before { content: '✕'; color: #ef4444; }
                .notification.warning .notification-icon::before { content: ''; color: #f59e0b; }
                .notification.info .notification-icon::before { content: 'ℹ'; color: #3b82f6; }

                .notification-content {
                    flex: 1;
                }

                .notification-title {
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: #1f2937;
                }

                .notification-message {
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.4;
                    word-break: break-word;
                }

                .notification-close {
                    background: none;
                    border: none;
                    font-size: 22px;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 0;
                    line-height: 1;
                    transition: color 0.2s;
                }

                .notification-close:hover {
                    color: #4b5563;
                }

                @keyframes slideIn {
                    from { transform: translateX(400px); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(400px); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        // ==========================================
        // 2. КОНТЕЙНЕР И ФУНКЦИЯ СОЗДАНИЯ УВЕДОМЛЕНИЙ
        // ==========================================
        const notifContainer = document.createElement('div');
        notifContainer.className = 'notifications-container';
        document.body.appendChild(notifContainer);

        function createNotification(message, options = {}) {
            const { type = 'info', title = '', duration = 3000 } = options;

            const notification = document.createElement('div');
            notification.className = `notification ${type}`;

            const icon = document.createElement('div');
            icon.className = 'notification-icon';

            const content = document.createElement('div');
            content.className = 'notification-content';

            if (title) {
                const titleEl = document.createElement('div');
                titleEl.className = 'notification-title';
                titleEl.textContent = title;
                content.appendChild(titleEl);
            }

            const messageEl = document.createElement('div');
            messageEl.className = 'notification-message';
            messageEl.textContent = message;
            content.appendChild(messageEl);

            const closeBtn = document.createElement('button');
            closeBtn.className = 'notification-close';
            closeBtn.innerHTML = '×';

            const closeAction = () => {
                if (notification.classList.contains('closing')) return;
                notification.classList.add('closing');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            };

            closeBtn.onclick = closeAction;

            notification.appendChild(icon);
            notification.appendChild(content);
            notification.appendChild(closeBtn);
            notifContainer.appendChild(notification);

            if (duration > 0) {
                setTimeout(closeAction, duration);
            }

            return notification;
        }

        // ==========================================
        // 3. ПОДПИСКА НА СОБЫТИЯ
        // ==========================================
        
        // 🚨 ОБРАБОТКА ОШИБОК ВАЛИДАТОРА
        const unsubscribeValidatorErrors = api.events.on('validator:errors', (data ) => {
            console.log('[Noty] Получены ошибки валидации:', data);

            const errors = data?.errors || (Array.isArray(data) ? data : []);

            if (errors && errors.length > 0) {
                // 1. Общее уведомление о количестве ошибок
                createNotification(
                    `Найдено проблем: ${errors.length}. Проверьте консоль для деталей.`,
                    { type: 'error', title: 'Ошибка валидации проекта', duration: 5000 }
                );

                // 2. Детальные уведомления (максимум 3)
                errors.slice(0, 3).forEach((err, index) => {
                    const msg = err.message || (typeof err === 'string' ? err : JSON.stringify(err));
                    const path = err.path ? `Путь: ${err.path}` : '';
                    const fullMessage = path ? `${msg}\n(${path})` : msg;
                    
                    setTimeout(() => {
                        createNotification(fullMessage, { 
                            type: 'error', 
                            title: `Ошибка #${index + 1}`,
                            duration: 6000 
                        });
                    }, index * 250);
                });

                // 3. Предупреждение, если ошибок больше 3
                if (errors.length > 3) {
                    setTimeout(() => {
                        createNotification(`И ещё ${errors.length - 3} скрытых ошибок`, { 
                            type: 'warning', 
                            title: 'Внимание',
                            duration: 4000 
                        });
                    }, 3 * 250 + 100);
                }
            }
        });

        // ==========================================
        // 4. ВОЗВРАТ API И ОЧИСТКА
        // ==========================================
        return {
            api: {
                // Метод для ручного вызова уведомления извне
                notify(message, options = {}) {
                    return createNotification(message, options);
                },
                // Удобные обёртки
                success(message, title = 'Успешно') {
                    return createNotification(message, { type: 'success', title });
                },
                error(message, title = 'Ошибка') {
                    return createNotification(message, { type: 'error', title, duration: 5000 });
                },
                warning(message, title = 'Внимание') {
                    return createNotification(message, { type: 'warning', title });
                },
                info(message, title = 'Информация') {
                    return createNotification(message, { type: 'info', title });
                }
            },

            cleanup() {
                console.log('[Noty] Очистка плагина');
                
                // Отписка от событий
                if (typeof unsubscribeValidatorErrors === 'function') unsubscribeValidatorErrors();
                
                // Удаление контейнера уведомлений
                if (notifContainer.parentNode) {
                    notifContainer.parentNode.removeChild(notifContainer);
                }

                // Удаление injected стилей
                const styleEl = document.getElementById('noty-plugin-styles');
                if (styleEl) {
                    styleEl.remove();
                }
            }
        };
    }
};

export default NotyPlugin;