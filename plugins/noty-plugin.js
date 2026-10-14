/**
 * @class NotyPlugin
 * @apiGroup Plugins
 *
 * Показывает всплывающие уведомления в правом верхнем углу.
 *
 * Сам реагирует на события движка:
 * `validator:errors` (ошибки проверки проекта),
 * `plugin:error` (плагин не загрузился или не установился),
 * `story:error` (ошибка во время выполнения узла).
 *
 * Публичный API: `api.plugins.noty.api`
 * (`notify`, `success`, `error`, `warning`, `info`).
 */
export const NotyPlugin = {
    name: 'noty',
    version: '0.1.0',
    nodeTypes: [],

    install(api) {
        const LAYER_NAME = 'noty';
        const MAX_DETAILS = 3;
        const ICONS = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

        const timers = new Set();

        function later(fn, ms) {
            const id = setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);

            timers.add(id);
        }

        // Стили лежат внутри контейнера и уходят вместе с ним.
        const container = document.createElement('div');

        container.className = 'notifications-container';

        const style = document.createElement('style');

        style.textContent = `
            .notifications-container {
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                display: flex; flex-direction: column; gap: 10px;
                max-width: 400px; pointer-events: none;
            }
            .notification {
                background: #fff; border-radius: 8px; padding: 16px 20px;
                box-shadow: 0 4px 12px rgba(0,0,0,.15); display: flex;
                align-items: flex-start; gap: 12px; min-width: 300px;
                animation: noty-in .3s ease-out; border-left: 4px solid #3b82f6;
                pointer-events: auto;
            }
            .notification.closing { animation: noty-out .3s ease-in forwards; }
            .notification.success { border-left-color: #10b981; }
            .notification.error { border-left-color: #ef4444; }
            .notification.warning { border-left-color: #f59e0b; }
            .notification.info { border-left-color: #3b82f6; }
            .notification-icon { font-size: 20px; flex-shrink: 0; line-height: 1; }
            .notification.success .notification-icon { color: #10b981; }
            .notification.error .notification-icon { color: #ef4444; }
            .notification.warning .notification-icon { color: #f59e0b; }
            .notification.info .notification-icon { color: #3b82f6; }
            .notification-content { flex: 1; }
            .notification-title { font-weight: 600; margin-bottom: 4px; color: #1f2937; }
            .notification-message {
                color: #6b7280; font-size: 14px; line-height: 1.4;
                word-break: break-word; white-space: pre-line;
            }
            .notification-close {
                background: none; border: none; font-size: 22px; cursor: pointer;
                color: #9ca3af; padding: 0; line-height: 1;
            }
            .notification-close:hover { color: #4b5563; }
            @keyframes noty-in { from { transform: translateX(400px); opacity: 0; } to { transform: none; opacity: 1; } }
            @keyframes noty-out { from { transform: none; opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
        `;

        container.appendChild(style);

        const removeLayer = api.player.registerLayer(LAYER_NAME, container);

        api.player.getPluginLayer().appendChild(container);

        function createNotification(message, options = {}) {
            const { type = 'info', title = '', duration = 3000 } = options;

            const notification = document.createElement('div');

            notification.className = `notification ${type}`;

            const icon = document.createElement('div');

            icon.className = 'notification-icon';
            icon.textContent = ICONS[type] ?? ICONS.info;

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
            messageEl.textContent = String(message);
            content.appendChild(messageEl);

            const closeBtn = document.createElement('button');

            closeBtn.className = 'notification-close';
            closeBtn.textContent = '×';

            const close = () => {
                if (notification.classList.contains('closing')) {
                    return;
                }

                notification.classList.add('closing');
                later(() => notification.remove(), 300);
            };

            closeBtn.addEventListener('click', close);

            notification.append(icon, content, closeBtn);
            container.appendChild(notification);

            if (duration > 0) {
                later(close, duration);
            }

            return notification;
        }

        api.events.on('validator:errors', (data) => {
            const errors = data?.errors ?? (Array.isArray(data) ? data : []);

            if (errors.length === 0) {
                return;
            }

            createNotification(
                `Найдено проблем: ${errors.length}. Подробности в консоли.`,
                { type: 'error', title: 'Ошибка проверки проекта', duration: 5000 }
            );

            errors.slice(0, MAX_DETAILS).forEach((err, index) => {
                const msg = err.message ?? (typeof err === 'string' ? err : JSON.stringify(err));
                const full = err.path ? `${msg}\n(${err.path})` : msg;

                later(() => createNotification(full, {
                    type: 'error',
                    title: `Ошибка #${index + 1}`,
                    duration: 6000
                }), index * 250);
            });

            if (errors.length > MAX_DETAILS) {
                later(() => createNotification(
                    `И ещё ${errors.length - MAX_DETAILS} скрытых ошибок`,
                    { type: 'warning', title: 'Внимание', duration: 4000 }
                ), MAX_DETAILS * 250 + 100);
            }
        });

        api.events.on('plugin:error', (data) => {
            createNotification(
                data?.message ?? 'Неизвестная ошибка',
                {
                    type: 'error',
                    title: `Плагин "${data?.name ?? '?'}" не работает`,
                    duration: 0
                }
            );
        });

        api.events.on('story:error', (data) => {
            createNotification(
                data?.message ?? 'Неизвестная ошибка',
                {
                    type: 'error',
                    title: `Ошибка в узле "${data?.node?.id ?? '?'}", проект остановлен`,
                    duration: 0
                }
            );
        });

        return {
            api: {
                notify: (message, options = {}) => createNotification(message, options),
                success: (message, title = 'Успешно') =>
                    createNotification(message, { type: 'success', title }),
                error: (message, title = 'Ошибка') =>
                    createNotification(message, { type: 'error', title, duration: 5000 }),
                warning: (message, title = 'Внимание') =>
                    createNotification(message, { type: 'warning', title }),
                info: (message, title = 'Информация') =>
                    createNotification(message, { type: 'info', title })
            },

            cleanup() {
                for (const id of timers) {
                    clearTimeout(id);
                }

                timers.clear();
                removeLayer();
            }
        };
    }
};

export default NotyPlugin;
