# VN Engine — API Documentation

## 1. Кратко о проекте

VN Engine — JavaScript-движок визуальной новеллы на ES Modules.

Главный принцип:

> Core исполняет сценарий, а конкретная игровая механика находится в плагинах.

Основные компоненты:

- `VN` — выполнение сценария и навигация.
- `Project` — модель проекта и сценария.
- `EventBus` — события.
- `Player` — визуальный корень.
- `BlockManager` — визуальные блоки.
- `PluginManager` — установка и управление плагинами.
- `ConditionEvaluator` — проверка условий в текущей реализации.
- Plugins — конкретная игровая функциональность.

---

# 2. VN API

Файл: `core.js`.

## `getBus()`

Возвращает `EventBus` экземпляра `VN`.

```js
const bus = game.getBus();
```

## `getState()`

Возвращает копию текущего состояния, которое сейчас хранится внутри `VN`.

> Это переходная часть архитектуры. В целевой модели runtime state должен принадлежать `StatePlugin`.

## `registerNodeType(type, handler)`

Регистрирует обработчик типа узла.

```js
game.registerNodeType('custom', (node, context) => {
    // обработка node
});
```

## `loadProject(project)`

Загружает проект и начинает выполнение с первого узла первой сцены.

```js
game.loadProject(project);
```

## `next()`

Запускает текущий узел, если VN не находится в состоянии ожидания.

---

# 3. Контекст Node Handler

При регистрации типа узла handler получает:

```js
(node, context)
```

Контекст содержит:

## `context.wait()`

Переводит VN в состояние ожидания.

```js
context.wait();
```

## `context.resume()`

Продолжает выполнение текущего сценария.

```js
context.resume();
```

## `context.goto(nodeId)`

Переходит к конкретному узлу.

```js
context.goto('hospital');
```

Навигация принадлежит `VN`, а не EventBus.

## `context.getState()`

Возвращает состояние Core в текущей переходной реализации.

---

# 4. Project API

Файл: `project.js`.

Создание:

```js
const project = new Project({
    metadata: {},
    scenes: [],
    config: {},
    assets: {}
});
```

## `getMetadata()`

Возвращает metadata.

## `getScenes()`

Возвращает массив сцен.

## `getScene(id)`

Возвращает сцену по идентификатору.

## `getNode(id)`

Ищет узел среди всех сцен.

## `getSceneForNode(nodeId)`

Возвращает сцену, содержащую узел.

## `getNextNode(nodeId)`

Возвращает следующий узел внутри той же сцены.

## `getConfig()`

Возвращает `config` проекта.

## `getAssets()`

Возвращает `assets` проекта.

---

# 5. EventBus API

Файл: `events.js`.

## `on(type, handler)`

Подписывает обработчик на событие.

```js
const off = bus.on('node:start', node => {
    console.log(node);
});
```

Возвращает функцию отписки.

## `off(type, handler)`

Удаляет обработчик.

## `emit(type, payload)`

Отправляет событие.

```js
bus.emit('my-event', data);
```

EventBus предназначен для сообщений о событиях/фактах. Он не является механизмом переходов.

---

# 6. PluginManager API

PluginManager — обязательная точка установки плагинов.

```js
const plugins = new PluginManager(
    bus,
    game,
    player,
    blocks,
    conditions
);
```

## `use(plugin)`

Устанавливает плагин.

```js
plugins.use(DialoguePlugin);
```

Плагин обязан иметь:

```js
{
    name: 'plugin-name',
    install(api) {}
}
```

## `remove(name)`

Удаляет плагин и вызывает его cleanup, если он есть.

```js
plugins.remove('dialogue');
```

## `has(name)`

Проверяет наличие плагина.

```js
plugins.has('dialogue');
```

## `get(name)`

Возвращает исходный объект установленного плагина.

## `list()`

Возвращает имена установленных плагинов.

---

# 7. API, доступный плагину

`install(api)` получает:

```text
api
├── events
├── game
├── player
├── blocks
├── conditions
└── plugins
```

## `api.events`

```js
api.events.on(event, handler);
api.events.emit(event, payload);
```

## `api.game`

```js
api.game.getPluginLayer();
api.game.registerLayer(name, element);
api.game.registerNodeType(type, handler);
api.game.show(name);
api.game.hide(name);
api.game.isVisible(name);
```

## `api.player`

```js
api.player.getPluginLayer();
api.player.registerLayer(name, element);
api.player.show(name);
api.player.hide(name);
api.player.isVisible(name);
```

## `api.blocks`

Это экземпляр `BlockManager`.

## `api.conditions`

В текущей реализации:

```js
api.conditions.evaluate(condition, state);
```

---

# 8. Публичный API плагина

Плагин может вернуть:

```js
export const MyPlugin = {
    name: 'my-plugin',

    install(api) {
        return {
            api: {
                hello() {
                    return 'hello';
                }
            },

            cleanup() {
                // очистка
            }
        };
    }
};
```

Другой плагин получает его через имя плагина:

```js
const state = api.plugins.state;

state.api.getValue('health');
```

Такой подход изолирует API конкретного плагина и не создаёт глобального пространства имён сервисов.

---

# 9. BlockManager API

Block имеет форму:

```js
{
    id,
    type,
    channel,
    state,
    element,
    data,
    meta
}
```

## `create(type, options)`

```js
const block = api.blocks.create('dialogue', {
    channel: 'content',
    element,
    data: {},
    meta: {}
});
```

Новый блок получает `state: 'visible'` и становится текущим для своего `channel`.

## `get(id)`

Получить блок по id.

## `getAll()`

Получить все блоки.

## `getByType(type)`

Получить блоки типа.

## `getActiveByChannel(channel)`

Получить видимые блоки канала.

## `getCurrent(channel)`

Получить текущий блок канала.

`current` и `visible` — разные понятия.

## `show(id)`

Показать блок.

## `hide(id)`

Скрыть блок.

## `remove(id)`

Удалить DOM-элемент и блок из менеджера.

---

# 10. Player API

Файл: `player.js`.

```js
player.getPluginLayer();
player.registerLayer(name, element);
player.show(name);
player.hide(name);
player.isVisible(name);
```

Основной контейнер плагинов создаётся автоматически.

---

# 11. ConditionEvaluator API

Файл: `core/condition-evaluator.js`.

```js
conditions.evaluate(condition, state);
```

Поддерживаемые операторы:

```text
==
!=
>
>=
<
<=
```

Если `condition` отсутствует, возвращается `true`.

Пример:

```js
{
    variable: 'health',
    operator: '<=',
    value: 5
}
```

---

# 12. Block channels

Основные логические каналы:

```text
content
overlay
background
```

Канал не является DOM-слоем.

Например:

```text
content
├── dialogue
└── narration

overlay
├── choice
└── wait
```

---

# 13. Плагины

## DialoguePlugin

Имя:

```text
dialogue
```

Node type:

```text
dialogue
```

Создаёт `content` Block и вызывает `context.wait()`.

## NarrationPlugin

Имя:

```text
narration
```

Создаёт `content` Block и ожидает продолжения.

## BackgroundPlugin

Имя:

```text
background
```

Node type:

```text
background
```

Устанавливает background у `document.body`.

## WaitPlugin

Имя:

```text
wait
```

Использует текущий `content` Block, показывает progress bar и после `duration` вызывает `context.resume()`.

## ChoicePlugin

Имя:

```text
choice
```

Создаёт `overlay` Block.

Модель:

```js
{
    id: 'go',
    variants: [
        {
            condition: {
                variable: 'health',
                operator: '<=',
                value: 5
            },
            text: 'Сначала в больницу',
            goto: 'hospital'
        },
        {
            text: 'Пойдём домой',
            goto: 'home'
        }
    ]
}
```

Если `goto` отсутствует, Choice вызывает `context.resume()`.

## StatePlugin

Файл:

```text
plugins/state-plugin.js
```

API:

```js
api.get();
api.getValue(name);
api.set(name, value);
api.update(values);
```

Пример:

```js
api.plugins.state.api.set('health', 10);

const health =
    api.plugins.state.api.getValue('health');
```

В текущем `main.js` StatePlugin пока не подключён. Кроме того, `VN` всё ещё хранит собственный state. Следующий архитектурный шаг — убрать state из VN и оставить его только в StatePlugin.

---

# 14. Choice и conditions

Choice состоит из `options`, а option может иметь несколько `variants`.

```text
Choice
└── option
    └── variants
        ├── condition
        ├── text
        └── goto
```

`option` — логический выбор игрока.

`variant` — конкретный результат, подходящий текущему состоянию.

---

# 15. Project пример

```js
const project = new Project({
    scenes: [
        {
            id: 'scene-1',
            nodes: [
                {
                    id: 'start',
                    type: 'dialogue',
                    character: 'Аня',
                    text: 'Как себя чувствуешь?'
                },
                {
                    id: 'choice-1',
                    type: 'choice',
                    text: 'Куда пойдём?',
                    options: [
                        {
                            id: 'go',
                            variants: [
                                {
                                    condition: {
                                        variable: 'health',
                                        operator: '<=',
                                        value: 5
                                    },
                                    text: 'Сначала в больницу',
                                    goto: 'hospital'
                                },
                                {
                                    text: 'Пойдём домой',
                                    goto: 'home'
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
});

game.loadProject(project);
```

---

# 16. Архитектурные правила

1. `VN` владеет текущим узлом и навигацией.
2. `Project` хранит структуру проекта.
3. EventBus передаёт события, но не управляет переходами.
4. Плагины добавляют конкретную игровую механику.
5. Плагин устанавливается через `PluginManager`.
6. Плагины могут публиковать собственный API.
7. Межплагинное обращение идёт через `api.plugins.<plugin>.api`.
8. BlockManager не знает о конкретной игровой механике.
9. `current` и `visible` у Block — разные понятия.
10. FlowResolver не является частью целевой архитектуры.

---

# 17. План развития

1. Сделать `StatePlugin` единственным владельцем runtime state.
2. Перевести ChoicePlugin на StatePlugin API.
3. Вынести condition-механику в плагинную модель.
4. Добавить зависимости плагинов.
5. Добавить эффекты изменения состояния.
6. Развивать Inventory, Quest и другие механики отдельными плагинами.
