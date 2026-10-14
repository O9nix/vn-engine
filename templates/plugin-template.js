// Шаблон плагина VNEngine.
//
// Как использовать:
//   1. Скопируйте файл в plugins/<имя>-plugin.js
//      (имя: строчные латинские буквы, цифры и дефисы, например "inventory").
//   2. Поле name должно совпадать с <имя> в названии файла.
//   3. Добавьте имя плагина в список plugins вашего Project:
//        new Project({ plugins: ['state', 'inventory'], ... })
//   4. Плагин должен быть экспортирован через export default.
//
// Файлы из папки templates/ движок не загружает.

export const ExamplePlugin = {
    // Уникальное имя. Совпадает с названием файла: example-plugin.js
    name: 'example',

    // Версия плагина. Если в проекте указана версия, она должна совпасть.
    version: '0.1.0',

    // Имена плагинов, которые должны быть установлены раньше этого.
    // Они обязаны быть объявлены в списке plugins проекта.
    dependencies: [],

    // Версия Plugin API движка (необязательно). Если указана и не совпадает
    // с версией движка, плагин не устанавливается.
    apiVersion: 1,

    // Типы узлов, которые плагин обрабатывает (для проверок и редактора).
    nodeTypes: ['example'],

    install(api) {
        // Обработчик узла: node — данные узла, context — управление ходом.
        //   context.wait()   остановить выполнение до resume() или клика игрока
        //   context.wait({ lock: true })  то же, но клик не продолжает (только resume/goto)
        //   context.resume() продолжить со следующего узла
        //   context.goto(id) перейти к узлу с этим id
        api.game.registerNodeType('example', (node, context) => {
            console.log('example:', node.text);
        });

        // Всё, что плагин регистрирует через api (события, слои, типы узлов,
        // блоки), движок снимает сам при удалении плагина или сбое установки.
        // Ошибка в обработчике узла останавливает проект и даёт событие story:error.
        // Логи с именем плагина: api.log.info / warn / error.
        // Подписка на события: api.events.on('story:loaded', ({ project }) => {...});
        // Другие плагины: api.plugins.state.api.get();
        // Визуальные блоки: api.blocks.create('example', { channel, element });

        return {
            // Публичный API плагина: доступен другим как
            // api.plugins.example.api
            api: {},

            // Освобождение ресурсов при удалении плагина.
            cleanup() {},
        };
    },
};

export default ExamplePlugin;
