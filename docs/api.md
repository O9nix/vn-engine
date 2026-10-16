# VN Engine API

**Версия 0.1.6** · Дата 2026-10-16 · 147 записей

<!-- Файл создан автоматически: apiscribe 0.4.0. Вручную не редактируйте. -->

## Содержание

- **AST**
  - [AST](#ast)
    - [AST.constructor(parameters)](#ast-constructor)
    - [AST.addCommand(pattern, nodeType, handler)](#ast-addcommand)
    - [AST.removeCommand(pattern)](#ast-removecommand)
    - [AST.getCommands()](#ast-getcommands)
    - [AST.parse(source)](#ast-parse)
- **BlockManager**
  - [BlockManager](#blockmanager)
    - [BlockManager.create(type, options)](#blockmanager-create)
    - [BlockManager.get(id)](#blockmanager-get)
    - [BlockManager.getAll()](#blockmanager-getall)
    - [BlockManager.getByType(type)](#blockmanager-getbytype)
    - [BlockManager.getActiveByChannel(channel)](#blockmanager-getactivebychannel)
    - [BlockManager.getCurrent(channel)](#blockmanager-getcurrent)
    - [BlockManager.show(id)](#blockmanager-show)
    - [BlockManager.hide(id)](#blockmanager-hide)
    - [BlockManager.remove(id)](#blockmanager-remove)
- **ProjectValidator**
  - [validateProjectScenes(scenes)](#validateprojectscenes)
  - [ProjectValidator](#projectvalidator)
    - [ProjectValidator.constructor(bus)](#projectvalidator-constructor)
    - [ProjectValidator.register(check)](#projectvalidator-register)
    - [ProjectValidator.registerNodeRule(nodeType, rule)](#projectvalidator-registernoderule)
    - [ProjectValidator.unregister(id)](#projectvalidator-unregister)
    - [ProjectValidator.unregisterPlugin(plugin)](#projectvalidator-unregisterplugin)
    - [ProjectValidator.list()](#projectvalidator-list)
    - [ProjectValidator.validate(project, extra, options)](#projectvalidator-validate)
    - [ProjectValidator.validateGotos()](#projectvalidator-validategotos)
- **VN**
  - [VN](#vn)
    - [VN.getBus()](#vn-getbus)
    - [VN.registerNodeType(type, handler)](#vn-registernodetype)
    - [VN.unregisterNodeType(type)](#vn-unregisternodetype)
    - [VN.registerSnapshotProvider(name, provider)](#vn-registersnapshotprovider)
    - [VN.snapshot()](#vn-snapshot)
    - [VN.restore(snapshot)](#vn-restore)
    - [VN.loadProject(project)](#vn-loadproject)
    - [VN.next()](#vn-next)
- **EventBus**
  - [EventBus](#eventbus)
    - [EventBus.on(type, handler)](#eventbus-on)
    - [EventBus.off(type, handler)](#eventbus-off)
    - [EventBus.emit(type, payload)](#eventbus-emit)
- **PluginRegistry**
  - [localPluginLoader(name)](#localpluginloader)
  - [PluginRegistry](#pluginregistry)
    - [PluginRegistry.constructor(options)](#pluginregistry-constructor)
    - [PluginRegistry.register(plugin)](#pluginregistry-register)
    - [PluginRegistry.resolve(name, version)](#pluginregistry-resolve)
    - [PluginRegistry.has(name)](#pluginregistry-has)
    - [PluginRegistry.list()](#pluginregistry-list)
- **Logger**
  - [Logger](#logger)
    - [Logger.constructor(options, shared)](#logger-constructor)
    - [Logger.setLevel(level)](#logger-setlevel)
    - [Logger.getLevel()](#logger-getlevel)
    - [Logger.child(prefix)](#logger-child)
    - [Logger.debug(args)](#logger-debug)
    - [Logger.info(args)](#logger-info)
    - [Logger.warn(args)](#logger-warn)
    - [Logger.error(args)](#logger-error)
- **Player**
  - [Player](#player)
    - [Player.getPluginLayer()](#player-getpluginlayer)
    - [Player.registerLayer(name, element)](#player-registerlayer)
    - [Player.show(name)](#player-show)
    - [Player.hide(name)](#player-hide)
    - [Player.isVisible(name)](#player-isvisible)
- **PluginLoader**
  - [normalizePluginRefs(refs)](#normalizepluginrefs)
  - [orderPlugins(plugins)](#orderplugins)
  - [loadProjectPlugins(project, registry, manager)](#loadprojectplugins)
- **PluginManager**
  - [PluginManager](#pluginmanager)
    - [PluginManager.constructor(bus, game, player, blocks, ast, validator)](#pluginmanager-constructor)
    - [PluginManager.use(plugin)](#pluginmanager-use)
    - [PluginManager.remove(name)](#pluginmanager-remove)
    - [PluginManager.has(name)](#pluginmanager-has)
    - [PluginManager.get(name)](#pluginmanager-get)
    - [PluginManager.getManifests()](#pluginmanager-getmanifests)
    - [PluginManager.list()](#pluginmanager-list)
- **PluginAPI**
  - [api.plugin](#api-plugin)
  - [api.log](#api-log)
    - [api.log.debug(args)](#api-log-debug)
    - [api.log.info(args)](#api-log-info)
    - [api.log.warn(args)](#api-log-warn)
    - [api.log.error(args)](#api-log-error)
  - [api.events](#api-events)
    - [api.events.on(event, handler)](#api-events-on)
    - [api.events.emit(event, payload)](#api-events-emit)
  - [api.game](#api-game)
    - [api.game.getPluginLayer()](#api-game-getpluginlayer)
    - [api.game.registerLayer(name, element)](#api-game-registerlayer)
    - [api.game.registerNodeType(type, handler)](#api-game-registernodetype)
    - [api.game.show(name)](#api-game-show)
    - [api.game.hide(name)](#api-game-hide)
    - [api.game.isVisible(name)](#api-game-isvisible)
  - [api.player](#api-player)
    - [api.player.getPluginLayer()](#api-player-getpluginlayer)
    - [api.player.registerLayer(name, element)](#api-player-registerlayer)
    - [api.player.show(name)](#api-player-show)
    - [api.player.hide(name)](#api-player-hide)
    - [api.player.isVisible(name)](#api-player-isvisible)
  - [api.blocks](#api-blocks)
  - [api.ast](#api-ast)
    - [api.ast.addCommand(pattern, nodeType, handler)](#api-ast-addcommand)
  - [api.validation](#api-validation)
    - [api.validation.register(check)](#api-validation-register)
    - [api.validation.registerNodeRule(nodeType, rule)](#api-validation-registernoderule)
  - [api.snapshot](#api-snapshot)
    - [api.snapshot.register(provider)](#api-snapshot-register)
  - [api.hasPlugin(name)](#api-hasplugin)
  - [api.plugins](#api-plugins)
- **Plugins**
  - [BackgroundPlugin](#backgroundplugin)
  - [ChoicePlugin](#choiceplugin)
  - [ConditionsPlugin](#conditionsplugin)
  - [DialoguePlugin](#dialogueplugin)
  - [JumpPlugin](#jumpplugin)
  - [NarrationPlugin](#narrationplugin)
  - [NotyPlugin](#notyplugin)
  - [StatePlugin](#stateplugin)
  - [TopLeftHUDPlugin](#toplefthudplugin)
  - [WaitPlugin](#waitplugin)
- **ConditionsPlugin**
  - [ConditionsPlugin.evaluate(condition, state)](#conditionsplugin-evaluate)
  - [ConditionsPlugin.validate(condition)](#conditionsplugin-validate)
  - [ConditionsPlugin.variables(condition)](#conditionsplugin-variables)
- **NotyPlugin**
  - [NotyPlugin.notify(message, options)](#notyplugin-notify)
  - [NotyPlugin.success(message, title)](#notyplugin-success)
  - [NotyPlugin.error(message, title)](#notyplugin-error)
  - [NotyPlugin.warning(message, title)](#notyplugin-warning)
  - [NotyPlugin.info(message, title)](#notyplugin-info)
- **StatePlugin**
  - [StatePlugin.get()](#stateplugin-get)
  - [StatePlugin.getValue(name)](#stateplugin-getvalue)
  - [StatePlugin.has(name)](#stateplugin-has)
  - [StatePlugin.set(name, value)](#stateplugin-set)
  - [StatePlugin.update(values)](#stateplugin-update)
  - [StatePlugin.add(name, delta)](#stateplugin-add)
  - [StatePlugin.format(text)](#stateplugin-format)
  - [StatePlugin.storyLoaded](#stateplugin-storyloaded)
  - [StatePlugin.setvar](#stateplugin-setvar)
  - [StatePlugin.setflag](#stateplugin-setflag)
- **TopLeftHUDPlugin**
  - [TopLeftHUDPlugin.set(key, value)](#toplefthudplugin-set)
  - [TopLeftHUDPlugin.setTitle(title)](#toplefthudplugin-settitle)
  - [TopLeftHUDPlugin.update(values)](#toplefthudplugin-update)
  - [TopLeftHUDPlugin.show()](#toplefthudplugin-show)
  - [TopLeftHUDPlugin.hide()](#toplefthudplugin-hide)
- **Project**
  - [Project](#project)
    - [Project.getPlugins()](#project-getplugins)
    - [Project.getMetadata()](#project-getmetadata)
    - [Project.getNode(id)](#project-getnode)
    - [Project.getNextNode(nodeId)](#project-getnextnode)
    - [Project.getSceneForNode(nodeId)](#project-getscenefornode)
    - [Project.getScenes()](#project-getscenes)
    - [Project.getScene(id)](#project-getscene)
    - [Project.getConfig()](#project-getconfig)
    - [Project.getAssets()](#project-getassets)
- [История изменений](#changelog)

## AST

<a id="ast"></a>

### `AST`

*Класс*

Парсер текста сценария в структуру сцен и узлов.

Сам парсер умеет только делить текст на сцены (строка `# Название`).
Остальные строки распознают команды, которые регистрируют плагины
через `api.ast.addCommand`. Строка, которую не узнала ни одна команда,
становится узлом `text`.

#### Примеры

```js
const parser = new AST();

parser.addCommand(/^\/\/\s*(.*)$/, 'narration', (match) => ({
    type: 'narration',
    text: match[1].trim()
}));

const project = parser.parse('# Сцена\n// Тихая ночь.');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`AST.constructor(parameters)`](#ast-constructor) | Создаёт парсер без команд. |
| [`AST.addCommand(pattern, nodeType, handler)`](#ast-addcommand) | Регистрирует команду для парсера. |
| [`AST.removeCommand(pattern)`](#ast-removecommand) | Снимает команду парсера. |
| [`AST.getCommands()`](#ast-getcommands) | Возвращает зарегистрированные команды в порядке добавления. Парсер перебирает их в цикле. |
| [`AST.parse(source)`](#ast-parse) | Разбирает текст сценария. |

<sub>Исходник: AST.js:1</sub>

<a id="ast-constructor"></a>

#### `AST.constructor(parameters)`

*Метод*

Создаёт парсер без команд.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `parameters` *(необязательное)* | `Object` | Настройки парсера (пока не используются). |

##### Примеры

```js
const parser = new AST();
parser.addCommand(/^!/, 'bang', () => ({ type: 'bang' }));
```

<sub>Исходник: AST.js:30</sub>

<a id="ast-addcommand"></a>

#### `AST.addCommand(pattern, nodeType, handler)`

*Метод*

Регистрирует команду для парсера.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `pattern` *(обязательное)* | `RegExp` | Регулярное выражение для поиска строки. |
| `nodeType` *(обязательное)* | `string` | Тип узла, который создаст команда (например, dialogue). |
| `handler` *(обязательное)* | `function` | Функция (match, line, index, scene), которая превращает совпавшую строку в узел или возвращает null, если строка не подошла. |

##### Возвращает

`function` — Функция, снимающая команду.

##### Исключения

- `Error` — Если pattern не RegExp, handler не функция или команда с таким же регулярным выражением уже есть.

##### Примеры

```js
parser.addCommand(/^\[([^\]]+)\]\s*(.*)$/, 'dialogue', (match, line, index) => ({
    type: 'dialogue',
    character: match[1],
    text: match[2].trim()
}));
```

<sub>Исходник: AST.js:44</sub>

<a id="ast-removecommand"></a>

#### `AST.removeCommand(pattern)`

*Метод*

Снимает команду парсера.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `pattern` *(обязательное)* | `RegExp` | Регулярное выражение, с которым команда была добавлена. |

##### Возвращает

`boolean` — true, если команда была зарегистрирована.

##### Примеры

```js
const pattern = /^!/;
parser.addCommand(pattern, 'bang', () => ({ type: 'bang' }));
parser.removeCommand(pattern); // true
```

<sub>Исходник: AST.js:86</sub>

<a id="ast-getcommands"></a>

#### `AST.getCommands()`

*Метод*

Возвращает зарегистрированные команды в порядке добавления.
Парсер перебирает их в цикле.

##### Возвращает

`Object[]` — Массив объектов { pattern, nodeType, handler }.

##### Примеры

```js
for (const command of parser.getCommands()) {
    console.log(command.nodeType, command.pattern);
}
```

<sub>Исходник: AST.js:104</sub>

<a id="ast-parse"></a>

#### `AST.parse(source)`

*Метод*

Разбирает текст сценария.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `source` *(обязательное)* | `string` | Текст сценария. |

##### Возвращает

`Object` — Объект { scenes }: массив сцен { id, name, nodes }.

##### Примеры

```js
const result = parser.parse('# Сцена\n[Анна] Привет');
// result.scenes[0].nodes[0].type === 'dialogue'
```

<sub>Исходник: AST.js:122</sub>

## BlockManager

<a id="blockmanager"></a>

### `BlockManager`

*Класс*

Хранит визуальные блоки (диалог, выбор и т.п.) и размещает их в корневом элементе.

#### Примеры

```js
const blocks = new BlockManager(document.getElementById('game'));

const element = document.createElement('div');
const block = blocks.create('note', { channel: 'overlay', element });

blocks.hide(block.id);
blocks.remove(block.id);
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`BlockManager.create(type, options)`](#blockmanager-create) | Создаёт блок и добавляет его элемент в корень. |
| [`BlockManager.get(id)`](#blockmanager-get) | Возвращает блок по id. |
| [`BlockManager.getAll()`](#blockmanager-getall) | Возвращает все существующие блоки в порядке создания. |
| [`BlockManager.getByType(type)`](#blockmanager-getbytype) | Возвращает блоки одного типа. |
| [`BlockManager.getActiveByChannel(channel)`](#blockmanager-getactivebychannel) | Возвращает видимые блоки канала. Скрытые блоки в результат не попадают. |
| [`BlockManager.getCurrent(channel)`](#blockmanager-getcurrent) | Возвращает последний созданный блок канала. |
| [`BlockManager.show(id)`](#blockmanager-show) | Показывает скрытый блок. Если блока нет, пишет предупреждение в консоль. |
| [`BlockManager.hide(id)`](#blockmanager-hide) | Скрывает блок, не удаляя его. Если блока нет, пишет предупреждение в консоль. |
| [`BlockManager.remove(id)`](#blockmanager-remove) | Удаляет блок вместе с его DOM-элементом. Если блока нет, пишет предупреждение в консоль. |

<sub>Исходник: block-manager.js:5</sub>

<a id="blockmanager-create"></a>

#### `BlockManager.create(type, options)`

*Метод*

Создаёт блок и добавляет его элемент в корень.

Опции: `channel` (строка, по умолчанию default), `element` (HTMLElement),
`data`, `meta` и `replace` (true — сначала удалить все блоки этого канала,
чтобы старые не накапливались).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Тип блока. |
| `options` *(необязательное)* | `Object` | Параметры блока. |

##### Возвращает

`Object` — Созданный блок.

##### Примеры

```js
const element = document.createElement('div');
element.textContent = 'Привет';

const block = blocks.create('hello', {
    channel: 'overlay',
    element,
    data: { text: 'Привет' },
    replace: true
});

console.log(block.id);
```

<sub>Исходник: block-manager.js:35</sub>

<a id="blockmanager-get"></a>

#### `BlockManager.get(id)`

*Метод*

Возвращает блок по id.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id блока (например, `dialogue-1`). |

##### Возвращает

`Object` — Блок или null, если такого нет.

##### Примеры

```js
const block = blocks.get('dialogue-1');
if (block) {
    console.log(block.state); // visible или hidden
}
```

<sub>Исходник: block-manager.js:112</sub>

<a id="blockmanager-getall"></a>

#### `BlockManager.getAll()`

*Метод*

Возвращает все существующие блоки в порядке создания.

##### Возвращает

`Object[]` — Массив блоков.

##### Примеры

```js
for (const block of blocks.getAll()) {
    console.log(block.id, block.channel);
}
```

<sub>Исходник: block-manager.js:131</sub>

<a id="blockmanager-getbytype"></a>

#### `BlockManager.getByType(type)`

*Метод*

Возвращает блоки одного типа.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Тип блока, например choice. |

##### Возвращает

`Object[]` — Массив блоков.

##### Примеры

```js
const choices = blocks.getByType('choice');
console.log(choices.length);
```

<sub>Исходник: block-manager.js:148</sub>

<a id="blockmanager-getactivebychannel"></a>

#### `BlockManager.getActiveByChannel(channel)`

*Метод*

Возвращает видимые блоки канала. Скрытые блоки в результат не попадают.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `channel` *(обязательное)* | `string` | Имя канала, например overlay. |

##### Возвращает

`Object[]` — Массив блоков.

##### Примеры

```js
const visible = blocks.getActiveByChannel('overlay');
```

<sub>Исходник: block-manager.js:167</sub>

<a id="blockmanager-getcurrent"></a>

#### `BlockManager.getCurrent(channel)`

*Метод*

Возвращает последний созданный блок канала.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `channel` *(обязательное)* | `string` | Имя канала. |

##### Возвращает

`Object` — Блок или null, если в канале блоков нет.

##### Примеры

```js
const current = blocks.getCurrent('dialogue');
if (current) {
    blocks.hide(current.id);
}
```

<sub>Исходник: block-manager.js:187</sub>

<a id="blockmanager-show"></a>

#### `BlockManager.show(id)`

*Метод*

Показывает скрытый блок. Если блока нет, пишет предупреждение в консоль.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id блока. |

##### Примеры

```js
blocks.show('dialogue-1');
```

<sub>Исходник: block-manager.js:212</sub>

<a id="blockmanager-hide"></a>

#### `BlockManager.hide(id)`

*Метод*

Скрывает блок, не удаляя его. Если блока нет, пишет предупреждение в консоль.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id блока. |

##### Примеры

```js
blocks.hide('dialogue-1');
```

<sub>Исходник: block-manager.js:237</sub>

<a id="blockmanager-remove"></a>

#### `BlockManager.remove(id)`

*Метод*

Удаляет блок вместе с его DOM-элементом. Если блока нет, пишет предупреждение в консоль.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id блока. |

##### Примеры

```js
const block = blocks.create('note', { element });
blocks.remove(block.id);
```

<sub>Исходник: block-manager.js:262</sub>

## ProjectValidator

<a id="validateprojectscenes"></a>

### `validateProjectScenes(scenes)`

*Метод*

Проверяет переходы в сценах (`goto` и `timeoutGoto`): каждый должен вести
на существующий узел или на сцену.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `scenes` *(обязательное)* | `Object[]` | Сцены проекта. |

#### Возвращает

`Object` — Объект `{ valid, hasGoto, gotoCount, nodeCount, errors }`,
где `errors` — массив записей `{ target, path, message }`.

#### Примеры

```js
const result = validateProjectScenes(project.getScenes());
```

<sub>Исходник: builtin-checks.js:39</sub>

<a id="projectvalidator"></a>

### `ProjectValidator`

*Класс*

Проверяет проект. Ядро регистрирует общие проверки (метки goto, дубли id,
неизвестные типы узлов, необъявленные зависимости плагинов), а плагины
добавляют свои через `api.validation`.

Запись о проблеме: `{ code, message, path, plugin, severity }`,
где `severity` — `error` или `warning`. Ошибки означают, что проект
запускать нельзя, предупреждения не блокируют запуск.

Проверка, которая упала или не уложилась во время, не ломает проверку проекта:
она превращается в предупреждение с кодом `check.crashed` или `check.timeout`.

#### Примеры

```js
const validator = new ProjectValidator(bus);
const result = await validator.validate(project, { plugins: plugins.getManifests() });
if (!result.valid) {
    // result.errors, result.warnings
}
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`ProjectValidator.constructor(bus)`](#projectvalidator-constructor) | Создаёт валидатор со встроенными проверками ядра. |
| [`ProjectValidator.register(check)`](#projectvalidator-register) | Регистрирует проверку всего проекта. |
| [`ProjectValidator.registerNodeRule(nodeType, rule)`](#projectvalidator-registernoderule) | Регистрирует правило для узлов одного типа. Валидатор сам обходит проект и вызывает `run(node, context)` только для узлов этого типа. Пут... |
| [`ProjectValidator.unregister(id)`](#projectvalidator-unregister) | Снимает проверку по id. |
| [`ProjectValidator.unregisterPlugin(plugin)`](#projectvalidator-unregisterplugin) | Снимает все проверки плагина. |
| [`ProjectValidator.list()`](#projectvalidator-list) |  |
| [`ProjectValidator.validate(project, extra, options)`](#projectvalidator-validate) | Запускает все проверки по очереди и собирает результат. После завершения шлёт событие `validator:done` с полным результатом; если есть ош... |
| [`ProjectValidator.validateGotos()`](#projectvalidator-validategotos) | Проверяет только метки goto. Оставлено для совместимости: работает с проектом, переданным в конструктор `new ProjectValidator(project, bu... |

<sub>Исходник: project-validator.js:14</sub>

<a id="projectvalidator-constructor"></a>

#### `ProjectValidator.constructor(bus)`

*Метод*

Создаёт валидатор со встроенными проверками ядра.

Старая форма `new ProjectValidator(project, bus)` по-прежнему работает
вместе с методом validateGotos().

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `bus` *(необязательное)* | `EventBus` | Шина событий: валидатор шлёт validator:done. |

##### Примеры

```js
const validator = new ProjectValidator(bus);
bus.on('validator:done', (result) => {
    console.log(result.valid, result.errors.length);
});
```

<sub>Исходник: project-validator.js:41</sub>

<a id="projectvalidator-register"></a>

#### `ProjectValidator.register(check)`

*Метод*

Регистрирует проверку всего проекта.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `check` *(обязательное)* | `Object` | Проверка: `id` (уникальная строка), `run(project, context)`, необязательные `plugin`, `severity` (error или warning, по умолчанию error) и `timeout` в миллисекундах. Функция `run` (может быть async) возвращает массив записей. |

##### Возвращает

`function` — Функция, снимающая проверку.

##### Исключения

- `Error` — Если проверка некорректна или её id уже занят.

##### Примеры

```js
validator.register({
    id: 'inventory:items',
    plugin: 'inventory',
    run(project) {
        return [];
    }
});
```

<sub>Исходник: project-validator.js:103</sub>

<a id="projectvalidator-registernoderule"></a>

#### `ProjectValidator.registerNodeRule(nodeType, rule)`

*Метод*

Регистрирует правило для узлов одного типа. Валидатор сам обходит
проект и вызывает `run(node, context)` только для узлов этого типа.
Путь к узлу подставляется в запись, если её `path` пуст.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `nodeType` *(обязательное)* | `string` | Тип узла, например choice. |
| `rule` *(обязательное)* | `Object` | Правило: те же поля, что у register(). |

##### Возвращает

`function` — Функция, снимающая правило.

##### Исключения

- `TypeError` — Если тип узла не строка или пустой.

##### Примеры

```js
validator.registerNodeRule('take', {
    id: 'inventory:item',
    plugin: 'inventory',
    run(node) {
        if (node.item) {
            return [];
        }

        // path подставится сам: scenes[0].nodes[2]
        return [{
            code: 'take.no-item',
            message: `У узла "${node.id}" не задан item`
        }];
    }
});
```

<sub>Исходник: project-validator.js:129</sub>

<a id="projectvalidator-unregister"></a>

#### `ProjectValidator.unregister(id)`

*Метод*

Снимает проверку по id.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id проверки. |

##### Возвращает

`boolean` — true, если проверка была зарегистрирована.

##### Примеры

```js
validator.unregister('inventory:items');
```

<sub>Исходник: project-validator.js:169</sub>

<a id="projectvalidator-unregisterplugin"></a>

#### `ProjectValidator.unregisterPlugin(plugin)`

*Метод*

Снимает все проверки плагина.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugin` *(обязательное)* | `string` | Имя плагина. |

##### Возвращает

`number` — Сколько проверок снято.

##### Примеры

```js
const removed = validator.unregisterPlugin('inventory');
console.log(`Снято проверок: ${removed}`);
```

<sub>Исходник: project-validator.js:185</sub>

<a id="projectvalidator-list"></a>

#### `ProjectValidator.list()`

*Метод*

##### Возвращает

`Object[]` — Зарегистрированные проверки: `{ id, plugin, kind }`.

##### Примеры

```js
for (const check of validator.list()) {
    console.log(check.id, check.kind); // core:goto project
}
```

<sub>Исходник: project-validator.js:211</sub>

<a id="projectvalidator-validate"></a>

#### `ProjectValidator.validate(project, extra, options)`

*Метод*

Запускает все проверки по очереди и собирает результат.
После завершения шлёт событие `validator:done` с полным результатом;
если есть ошибки, дополнительно шлёт `validator:errors` с `{ errors }`
(для совместимости).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `project` *(обязательное)* | `Object` | Проект (`Project` или объект со сценами). |
| `extra` *(необязательное)* | `Object` | Дополнительные данные для проверок. Поле `plugins` — манифесты установленных плагинов (`PluginManager.getManifests()`): без него проверки типов узлов и зависимостей пропускаются. Поле `project` валидатор добавляет сам. |
| `options` *(необязательное)* | `Object` | Параметры: `timeout` — предел времени на одну проверку в миллисекундах (по умолчанию 3000). |

##### Возвращает

`Promise` — Результат `{ valid, errors, warnings, checksRun }`.

##### Исключения

- `TypeError` — Если проект не передан.

##### Примеры

```js
const result = await validator.validate(project, { plugins: plugins.getManifests() });
```

<sub>Исходник: project-validator.js:318</sub>

<a id="projectvalidator-validategotos"></a>

#### `ProjectValidator.validateGotos()`

*Метод*

Проверяет только метки goto. Оставлено для совместимости:
работает с проектом, переданным в конструктор `new ProjectValidator(project, bus)`.
Новый код использует validate().

##### Возвращает

`Object` — Объект `{ valid, hasGoto, gotoCount, nodeCount, errors }`,
где `errors` — массив `{ target, path, message }`.

##### Исключения

- `Error` — Если проект не был передан в конструктор.

##### Примеры

```js
const validator = new ProjectValidator(project, bus);
const result = validator.validateGotos();
```

<sub>Исходник: project-validator.js:382</sub>

## VN

<a id="vn"></a>

### `VN`

*Класс*

Ядро игры: проходит по узлам проекта и вызывает обработчики типов узлов,
которые зарегистрировали плагины. Само ничего не рисует.

Если обработчик узла бросает ошибку, история останавливается
и приходит событие `story:error`. Когда сцена заканчивается, история
продолжается с первого узла следующей; о смене сцены сообщают события
`scene:start` и `scene:end`. Метка `goto` может вести на узел или на сцену.

Игру можно сохранить и вернуть к сохранённой точке: `snapshot()` и `restore()`.

#### Примеры

```js
const game = new VN();

game.registerNodeType('log', (node) => console.log(node.text));
game.getBus().on('story:end', () => console.log('Конец'));
game.loadProject(project);
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`VN.getBus()`](#vn-getbus) | Возвращает шину событий игры. Через неё приходят события `story:loaded`, `node:start`, `story:end`, `story:error` и событие клика `click-... |
| [`VN.registerNodeType(type, handler)`](#vn-registernodetype) | Регистрирует обработчик типа узла. Без `wait()` история сама идёт дальше, с `wait()` останавливается до `resume()` или клика. Плагинам уд... |
| [`VN.unregisterNodeType(type)`](#vn-unregisternodetype) | Снимает обработчик типа узла. Нужен, чтобы плагин можно было удалить и поставить заново. |
| [`VN.registerSnapshotProvider(name, provider)`](#vn-registersnapshotprovider) | Подключает источник данных для снимка. Плагин, у которого есть состояние (переменные, инвентарь), сообщает, как его сохранить и как восст... |
| [`VN.snapshot()`](#vn-snapshot) | Делает снимок игры: текущий узел плюс данные всех источников (например, состояние из плагина `state`). Результат не связан с живыми объек... |
| [`VN.restore(snapshot)`](#vn-restore) | Возвращает игру к снимку: загружает данные источников и заново запускает узел, на котором был сделан снимок. Состояние ошибки сбрасываетс... |
| [`VN.loadProject(project)`](#vn-loadproject) | Загружает проект, шлёт `story:loaded` и запускает историю с первого узла первой сцены. Плагины и проверку проекта нужно выполнить до этог... |
| [`VN.next()`](#vn-next) | Выполняет текущий узел. Ничего не делает, пока история ждёт или остановлена ошибкой. Обычно вызывать не нужно: ядро идёт дальше само и по... |

<sub>Исходник: core.js:6</sub>

<a id="vn-getbus"></a>

#### `VN.getBus()`

*Метод*

Возвращает шину событий игры. Через неё приходят события `story:loaded`, `node:start`, `story:end`, `story:error` и событие клика `click-game`.

##### Возвращает

`EventBus` — Шина событий.

##### Примеры

```js
const bus = game.getBus();
bus.on('story:end', () => console.log('Конец'));
```

<sub>Исходник: core.js:52</sub>

<a id="vn-registernodetype"></a>

#### `VN.registerNodeType(type, handler)`

*Метод*

Регистрирует обработчик типа узла. Без `wait()` история сама идёт дальше, с `wait()` останавливается до `resume()` или клика. Плагинам удобнее `api.game.registerNodeType`: он сам снимает тип при удалении плагина.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя типа узла. |
| `handler` *(обязательное)* | `function` | Функция (node, context); context содержит wait(options), resume() и goto(nodeId). |

##### Примеры

```js
game.registerNodeType('pause', (node, context) => {
    context.wait();
    setTimeout(() => context.resume(), node.ms);
});
```

<sub>Исходник: core.js:68</sub>

<a id="vn-unregisternodetype"></a>

#### `VN.unregisterNodeType(type)`

*Метод*

Снимает обработчик типа узла. Нужен, чтобы плагин можно было
удалить и поставить заново.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя типа узла. |

##### Возвращает

`boolean` — true, если тип был зарегистрирован.

##### Примеры

```js
game.registerNodeType('flash', () => {});
game.unregisterNodeType('flash'); // true
```

<sub>Исходник: core.js:99</sub>

<a id="vn-registersnapshotprovider"></a>

#### `VN.registerSnapshotProvider(name, provider)`

*Метод*

Подключает источник данных для снимка. Плагин, у которого есть
состояние (переменные, инвентарь), сообщает, как его сохранить
и как восстановить. Плагинам удобнее `api.snapshot.register`:
имя берётся из плагина, а при удалении плагина источник снимается.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя источника, обычно имя плагина. |
| `provider` *(обязательное)* | `Object` | Объект `{ save(), load(data) }`. Функция `save` возвращает данные, которые можно сериализовать в JSON; `load` принимает их же. |

##### Возвращает

`function` — Функция, снимающая источник.

##### Исключения

- `Error` — Если имя занято или у источника нет save и load.

##### Примеры

```js
let gold = 0;

game.registerSnapshotProvider('purse', {
    save: () => ({ gold }),
    load: (data) => { gold = data.gold; }
});
```

<sub>Исходник: core.js:117</sub>

<a id="vn-snapshot"></a>

#### `VN.snapshot()`

*Метод*

Делает снимок игры: текущий узел плюс данные всех источников
(например, состояние из плагина `state`). Результат не связан
с живыми объектами игры и пригоден для JSON.

##### Возвращает

`Object` — Снимок `{ version, nodeId, data }`.

##### Исключения

- `Error` — Если проект ещё не загружен.

##### Примеры

```js
const saved = game.snapshot();
localStorage.setItem('save', JSON.stringify(saved));
```

<sub>Исходник: core.js:161</sub>

<a id="vn-restore"></a>

#### `VN.restore(snapshot)`

*Метод*

Возвращает игру к снимку: загружает данные источников и заново
запускает узел, на котором был сделан снимок. Состояние ошибки
сбрасывается, поэтому восстановление помогает продолжить игру
после `story:error`.

Перед восстановлением приходит событие `story:restoring`: плагины
убирают с экрана то, что относилось к старой позиции (кнопки выбора,
таймеры). После загрузки данных приходит `story:restored`.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `snapshot` *(обязательное)* | `Object` | Снимок из `snapshot()`. |

##### Исключения

- `Error` — Если проект не загружен, снимок неверен или его узла в проекте нет. В этих случаях игра не меняется.

##### Примеры

```js
const saved = JSON.parse(localStorage.getItem('save'));
game.restore(saved);
```

<sub>Исходник: core.js:194</sub>

<a id="vn-loadproject"></a>

#### `VN.loadProject(project)`

*Метод*

Загружает проект, шлёт `story:loaded` и запускает историю с первого узла первой сцены. Плагины и проверку проекта нужно выполнить до этого вызова.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `project` *(обязательное)* | `Project` | Проект игры. |

##### Примеры

```js
const project = new Project({ scenes });
game.loadProject(project);
```

<sub>Исходник: core.js:260</sub>

<a id="vn-next"></a>

#### `VN.next()`

*Метод*

Выполняет текущий узел. Ничего не делает, пока история ждёт или остановлена ошибкой. Обычно вызывать не нужно: ядро идёт дальше само и по клику игрока.

##### Примеры

```js
game.next();
```

<sub>Исходник: core.js:342</sub>

## EventBus

<a id="eventbus"></a>

### `EventBus`

*Класс*

Шина событий. Ошибка в одном подписчике не мешает остальным:
она попадает в консоль и в событие `handler:error`
с данными `{ event, error }`.

#### Примеры

```js
const bus = new EventBus();

const off = bus.on('hello', (name) => console.log('Привет,', name));
bus.emit('hello', 'мир');
off();
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`EventBus.on(type, handler)`](#eventbus-on) | Подписывает обработчик на событие. |
| [`EventBus.off(type, handler)`](#eventbus-off) | Снимает обработчик с события. |
| [`EventBus.emit(type, payload)`](#eventbus-emit) | Вызывает всех подписчиков события по порядку подписки. |

<sub>Исходник: events.js:5</sub>

<a id="eventbus-on"></a>

#### `EventBus.on(type, handler)`

*Метод*

Подписывает обработчик на событие.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя события. |
| `handler` *(обязательное)* | `function` | Обработчик. |

##### Возвращает

`function` — Функция отписки.

##### Примеры

```js
const off = bus.on('node:start', (node) => {
    console.log('Начался узел', node.id);
});

off(); // отписка
```

<sub>Исходник: events.js:23</sub>

<a id="eventbus-off"></a>

#### `EventBus.off(type, handler)`

*Метод*

Снимает обработчик с события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя события. |
| `handler` *(обязательное)* | `function` | Ранее добавленный обработчик. |

##### Примеры

```js
const handler = (node) => console.log(node.id);
bus.on('node:start', handler);
bus.off('node:start', handler);
```

<sub>Исходник: events.js:50</sub>

<a id="eventbus-emit"></a>

#### `EventBus.emit(type, payload)`

*Метод*

Вызывает всех подписчиков события по порядку подписки.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя события. |
| `payload` *(необязательное)* | `*` | Данные события. |

##### Примеры

```js
bus.emit('my-plugin:ready', { version: 1 });
```

<sub>Исходник: events.js:68</sub>

## PluginRegistry

<a id="localpluginloader"></a>

### `localPluginLoader(name)`

*Метод*

Загрузчик плагинов из папки `plugins/` рядом с движком.

Плагин `choice` ищется в файле `plugins/choice-plugin.js` и должен
экспортировать объект плагина через `export default`. Имя плагина
проверяет `PluginRegistry` до вызова загрузчика, поэтому в путь
попадают только безопасные имена.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина. |

#### Возвращает

`Promise` — Промис с объектом плагина.

#### Исключения

- `Error` — Если файла нет или модуль не экспортирует плагин через `export default`.

#### Примеры

```js
const registry = new PluginRegistry({ loader: localPluginLoader });
```

<sub>Исходник: local-plugin-loader.js:1</sub>

<a id="pluginregistry"></a>

### `PluginRegistry`

*Класс*

Каталог доступных плагинов: по имени отдаёт объект плагина.

Плагин можно добавить вручную (`register()`) или дать каталогу
загрузчик (`loader`), который получает плагин по имени. Интерфейс
`resolve()` асинхронный, поэтому загрузчик может быть как
локальным, так и обращаться к внешнему сервису: остальной код
движка об этом не знает.

Имя плагина должно состоять из строчных латинских букв, цифр
и дефисов (`choice`, `top-left-hud`). Это проверяется до вызова
загрузчика, потому что имя приходит из данных проекта.

Минимальный манифест плагина:
```
{
    name: 'choice',                        // обязательно, уникальное имя
    version: '0.1.0',                      // версия плагина
    dependencies: ['state', 'conditions'], // имена нужных плагинов
    nodeTypes: ['choice'],                 // типы узлов, которые даёт плагин
    install(api) { ... }                   // обязательно
}
```

#### Примеры

```js
const registry = new PluginRegistry({ loader: localPluginLoader });

registry.register({ name: 'hello', install() {} });
const plugin = await registry.resolve('choice');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`PluginRegistry.constructor(options)`](#pluginregistry-constructor) | Создаёт каталог. |
| [`PluginRegistry.register(plugin)`](#pluginregistry-register) | Добавляет плагин в каталог вручную. |
| [`PluginRegistry.resolve(name, version)`](#pluginregistry-resolve) | Возвращает плагин по имени. Если плагина нет среди добавленных вручную или уже загруженных, вызывает загрузчик. |
| [`PluginRegistry.has(name)`](#pluginregistry-has) |  |
| [`PluginRegistry.list()`](#pluginregistry-list) |  |

<sub>Исходник: plugin-registry.js:3</sub>

<a id="pluginregistry-constructor"></a>

#### `PluginRegistry.constructor(options)`

*Метод*

Создаёт каталог.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `options` *(необязательное)* | `Object` | Параметры каталога. |
| `options.loader` *(необязательное)* | `function` | Загрузчик `(name) => Promise`: по имени плагина возвращает промис с его объектом. Вызывается, только если плагина нет среди добавленных вручную или уже загруженных. Результат запоминается. |

##### Примеры

```js
const registry = new PluginRegistry({ loader: localPluginLoader });
```

<sub>Исходник: plugin-registry.js:41</sub>

<a id="pluginregistry-register"></a>

#### `PluginRegistry.register(plugin)`

*Метод*

Добавляет плагин в каталог вручную.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugin` *(обязательное)* | `Object` | Плагин с полями `name` и `install`. |

##### Возвращает

`PluginRegistry` — Текущий каталог (для цепочки вызовов).

##### Исключения

- `Error` — Если у плагина нет имени или метода `install`, либо плагин с таким именем уже есть.

##### Примеры

```js
const registry = new PluginRegistry();
registry.register(StatePlugin).register(ChoicePlugin);
```

<sub>Исходник: plugin-registry.js:67</sub>

<a id="pluginregistry-resolve"></a>

#### `PluginRegistry.resolve(name, version)`

*Метод*

Возвращает плагин по имени. Если плагина нет среди добавленных
вручную или уже загруженных, вызывает загрузчик.

Версия сейчас сравнивается только на точное совпадение
(диапазоны вроде `^1.0` пока не поддерживаются).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина. |
| `version` *(необязательное)* | `string` | Требуемая версия. Если не указана, подойдёт любая. |

##### Возвращает

`Promise` — Промис с объектом плагина.

##### Исключения

- `Error` — Если имя недопустимо, плагин не найден или не загрузился, имя загруженного плагина не совпадает с запрошенным либо версия не совпадает с требуемой.

##### Примеры

```js
const plugin = await registry.resolve('choice');
```

<sub>Исходник: plugin-registry.js:110</sub>

<a id="pluginregistry-has"></a>

#### `PluginRegistry.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean` — Есть ли плагин среди добавленных или
уже загруженных

##### Примеры

```js
if (!registry.has('noty')) {
    registry.register(NotyPlugin);
}
```

<sub>Исходник: plugin-registry.js:209</sub>

<a id="pluginregistry-list"></a>

#### `PluginRegistry.list()`

*Метод*

##### Возвращает

`string[]` — Имена добавленных и уже загруженных плагинов

##### Примеры

```js
console.log(registry.list()); // ['state', 'noty']
```

<sub>Исходник: plugin-registry.js:225</sub>

## Logger

<a id="logger"></a>

### `Logger`

*Класс*

Журнал с уровнями и префиксом. Все журналы, созданные через `child`,
делят один уровень с исходным, поэтому его можно менять в одном месте.

Сообщения выводятся в консоль в виде `[префикс] сообщение`.

#### Примеры

```js
import { logger } from './logger.js';

const log = logger.child('VN');
log.warn('Узел не найден');
logger.setLevel('debug');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`Logger.constructor(options, shared)`](#logger-constructor) | Создаёт журнал. |
| [`Logger.setLevel(level)`](#logger-setlevel) | Меняет уровень для этого журнала и всех его дочерних. |
| [`Logger.getLevel()`](#logger-getlevel) |  |
| [`Logger.child(prefix)`](#logger-child) | Создаёт журнал с другим префиксом и общим уровнем. |
| [`Logger.debug(args)`](#logger-debug) | Подробное сообщение для отладки (по умолчанию скрыто). |
| [`Logger.info(args)`](#logger-info) | Обычное сообщение о ходе работы. |
| [`Logger.warn(args)`](#logger-warn) | Предупреждение: работа продолжается. |
| [`Logger.error(args)`](#logger-error) | Ошибка. |

<sub>Исходник: logger.js:13</sub>

<a id="logger-constructor"></a>

#### `Logger.constructor(options, shared)`

*Метод*

Создаёт журнал.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `options` *(необязательное)* | `Object` | Параметры: `level` (по умолчанию info) и `prefix`. |
| `shared` *(необязательное)* | `Object` | Общее состояние уровня (используется методом child). |

##### Примеры

```js
const log = new Logger({ level: 'warn', prefix: 'Моё' });
log.warn('Что-то не так'); // [Моё] Что-то не так
```

<sub>Исходник: logger.js:33</sub>

<a id="logger-setlevel"></a>

#### `Logger.setLevel(level)`

*Метод*

Меняет уровень для этого журнала и всех его дочерних.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `level` *(обязательное)* | `string` | Один из уровней: debug, info, warn, error, silent. |

##### Исключения

- `Error` — Если уровень неизвестен.

##### Примеры

```js
logger.setLevel('debug'); // показывать всё
logger.setLevel('silent'); // ничего не показывать
```

<sub>Исходник: logger.js:55</sub>

<a id="logger-getlevel"></a>

#### `Logger.getLevel()`

*Метод*

##### Возвращает

`string` — Текущий уровень.

##### Примеры

```js
if (logger.getLevel() === 'debug') {
    console.log('Включён подробный режим');
}
```

<sub>Исходник: logger.js:74</sub>

<a id="logger-child"></a>

#### `Logger.child(prefix)`

*Метод*

Создаёт журнал с другим префиксом и общим уровнем.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `prefix` *(обязательное)* | `string` | Префикс сообщений, например имя класса или плагина. |

##### Возвращает

`Logger`

##### Примеры

```js
const log = logger.child('inventory');
log.info('Готово'); // [inventory] Готово
```

<sub>Исходник: logger.js:88</sub>

<a id="logger-debug"></a>

#### `Logger.debug(args)`

*Метод*

Подробное сообщение для отладки (по умолчанию скрыто).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
log.debug('Состояние', { health: 3 });
```

<sub>Исходник: logger.js:113</sub>

<a id="logger-info"></a>

#### `Logger.info(args)`

*Метод*

Обычное сообщение о ходе работы.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
log.info('Проект загружен');
```

<sub>Исходник: logger.js:126</sub>

<a id="logger-warn"></a>

#### `Logger.warn(args)`

*Метод*

Предупреждение: работа продолжается.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
log.warn('Узел не найден:', nodeId);
```

<sub>Исходник: logger.js:139</sub>

<a id="logger-error"></a>

#### `Logger.error(args)`

*Метод*

Ошибка.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
log.error('Не удалось загрузить плагин', error);
```

<sub>Исходник: logger.js:152</sub>

## Player

<a id="player"></a>

### `Player`

*Класс*

Отображение игры: хранит корневой элемент и именованные слои,
которые плагины показывают и скрывают.

#### Примеры

```js
const player = new Player(document.getElementById('game'));

const hud = document.createElement('div');
player.registerLayer('hud', hud);
player.hide('hud');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`Player.getPluginLayer()`](#player-getpluginlayer) | Возвращает общий DOM-слой, в который плагины могут добавлять свои элементы. |
| [`Player.registerLayer(name, element)`](#player-registerlayer) | Регистрирует именованный слой, которым потом можно управлять через show и hide. |
| [`Player.show(name)`](#player-show) | Показывает слой. Если слоя нет, пишет предупреждение в консоль. |
| [`Player.hide(name)`](#player-hide) | Скрывает слой. Если слоя нет, пишет предупреждение в консоль. |
| [`Player.isVisible(name)`](#player-isvisible) | Проверяет, показан ли слой. |

<sub>Исходник: player.js:5</sub>

<a id="player-getpluginlayer"></a>

#### `Player.getPluginLayer()`

*Метод*

Возвращает общий DOM-слой, в который плагины могут добавлять свои элементы.

##### Возвращает

`HTMLElement` — Слой плагинов.

##### Примеры

```js
const layer = player.getPluginLayer();
layer.appendChild(document.createElement('div'));
```

<sub>Исходник: player.js:44</sub>

<a id="player-registerlayer"></a>

#### `Player.registerLayer(name, element)`

*Метод*

Регистрирует именованный слой, которым потом можно управлять через show и hide.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Уникальное имя слоя. |
| `element` *(обязательное)* | `HTMLElement` | DOM-элемент слоя. |

##### Возвращает

`function` — Функция, удаляющая слой.

##### Примеры

```js
const hud = document.createElement('div');
const remove = player.registerLayer('hud', hud);
player.show('hud');

remove(); // слой и его элемент удалены
```

<sub>Исходник: player.js:60</sub>

<a id="player-show"></a>

#### `Player.show(name)`

*Метод*

Показывает слой. Если слоя нет, пишет предупреждение в консоль.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Примеры

```js
player.show('hud');
```

<sub>Исходник: player.js:98</sub>

<a id="player-hide"></a>

#### `Player.hide(name)`

*Метод*

Скрывает слой. Если слоя нет, пишет предупреждение в консоль.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Примеры

```js
player.hide('hud');
```

<sub>Исходник: player.js:122</sub>

<a id="player-isvisible"></a>

#### `Player.isVisible(name)`

*Метод*

Проверяет, показан ли слой.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Возвращает

`boolean` — true, если слой есть и не скрыт.

##### Примеры

```js
if (!player.isVisible('hud')) {
    player.show('hud');
}
```

<sub>Исходник: player.js:146</sub>

## PluginLoader

<a id="normalizepluginrefs"></a>

### `normalizePluginRefs(refs)`

*Метод*

Приводит список плагинов проекта к единому виду.
Элемент списка может быть строкой (имя) или объектом
`{ name, version }`.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `refs` *(необязательное)* | `Array` | Список плагинов из `project.getPlugins()`. Каждый элемент — строка или объект `{ name, version }`. |

#### Возвращает

`Object[]` — Нормализованный список объектов
`{ name, version }` в порядке объявления.

#### Исключения

- `Error` — Если элемент некорректен или плагин объявлен дважды.

#### Примеры

```js
normalizePluginRefs(['state', { name: 'choice', version: '0.1.0' }]);
// [{ name: 'state', version: undefined },
//  { name: 'choice', version: '0.1.0' }]
```

<sub>Исходник: plugin-loader.js:1</sub>

<a id="orderplugins"></a>

### `orderPlugins(plugins)`

*Метод*

Сортирует плагины так, чтобы каждый шёл после своих зависимостей.
Среди независимых плагинов сохраняется порядок объявления.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugins` *(обязательное)* | `Object[]` | Плагины в порядке объявления в проекте. |

#### Возвращает

`Object[]` — Плагины в порядке установки.

#### Исключения

- `Error` — Если зависимость не объявлена в проекте или зависимости образуют цикл.

#### Примеры

```js
const ordered = orderPlugins([ChoicePlugin, StatePlugin, ConditionsPlugin]);
// state, conditions, choice
```

<sub>Исходник: plugin-loader.js:66</sub>

<a id="loadprojectplugins"></a>

### `loadProjectPlugins(project, registry, manager)`

*Метод*

Устанавливает плагины, объявленные в проекте.

Получает плагины из каталога по именам из `project.getPlugins()`,
сортирует их по зависимостям и устанавливает через `PluginManager`.

Сбой одного плагина не отменяет остальные: плагин, который не удалось
получить или установить, попадает в `failed`, а плагины, которые от него
зависят, пропускаются (тоже попадают в `failed`). Остальные плагины
остаются установленными. Решение, запускать ли историю при наличии
сбоев, принимает вызывающий код.

Вызывать нужно до `game.loadProject(project)`, чтобы плагины
успели подписаться на `story:loaded`.

Ошибки в самом описании проекта (некорректный список плагинов,
зависимость, не объявленная в проекте, цикл) пробрасываются исключением:
с таким проектом работать нельзя.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `project` *(обязательное)* | `Project` | Проект с объявленными плагинами. |
| `registry` *(обязательное)* | `PluginRegistry` | Каталог доступных плагинов. |
| `manager` *(обязательное)* | `PluginManager` | Менеджер, устанавливающий плагины. |

#### Возвращает

`Promise` — Промис с отчётом `{ installed, failed }`:
`installed` — имена установленных плагинов в порядке установки,
`failed` — массив объектов `{ name, stage, message, error }`,
где `stage` — `load`, `install` или `dependency`.

#### Исключения

- `Error` — Если описание плагинов в проекте некорректно.

#### Примеры

```js
const report = await loadProjectPlugins(project, registry, plugins);
if (report.failed.length === 0) {
    game.loadProject(project);
}
```

<sub>Исходник: plugin-loader.js:143</sub>

## PluginManager

<a id="pluginmanager"></a>

### `PluginManager`

*Класс*

Устанавливает плагины и выдаёт каждому из них собственный Plugin API
(`plugin`, `log`, `events`, `game`, `player`, `blocks`, `ast`, `validation`, `plugins`).

Всё, что плагин занял через свой `api` (подписки на события, слои,
типы узлов, блоки, команды парсера, проверки валидатора), движок снимает сам при удалении
плагина или при сбое его установки.

#### Примеры

```js
const plugins = new PluginManager(bus, game, player, blocks, ast, validator);

plugins.use(StatePlugin);
plugins.has('state');   // true
plugins.list();         // ['state']
plugins.remove('state');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`PluginManager.constructor(bus, game, player, blocks, ast, validator)`](#pluginmanager-constructor) | Запоминает зависимости движка. Для каждого плагина при установке создаётся собственный `api`, который передаётся в `install(api)`. |
| [`PluginManager.use(plugin)`](#pluginmanager-use) | Устанавливает плагин после проверки его зависимостей. |
| [`PluginManager.remove(name)`](#pluginmanager-remove) | Удаляет установленный плагин, если от него не зависят другие установленные плагины. |
| [`PluginManager.has(name)`](#pluginmanager-has) |  |
| [`PluginManager.get(name)`](#pluginmanager-get) |  |
| [`PluginManager.getManifests()`](#pluginmanager-getmanifests) | Описывает установленные плагины для валидатора. |
| [`PluginManager.list()`](#pluginmanager-list) |  |

<sub>Исходник: plugin-manager.js:29</sub>

<a id="pluginmanager-constructor"></a>

#### `PluginManager.constructor(bus, game, player, blocks, ast, validator)`

*Метод*

Запоминает зависимости движка. Для каждого плагина при установке
создаётся собственный `api`, который передаётся в `install(api)`.

Структура api:
```
api
├── plugin
│   └── name                → имя этого плагина
├── log
│   ├── info(...args)
│   ├── warn(...args)
│   └── error(...args)
├── events
│   ├── on(event, handler) → unsubscribe
│   └── emit(event, payload)
├── game
│   ├── getPluginLayer() → HTMLElement
│   ├── registerLayer(name, element) → cleanup
│   ├── registerNodeType(type, handler)
│   ├── show(name)
│   ├── hide(name)
│   └── isVisible(name) → boolean
├── player
│   ├── getPluginLayer() → HTMLElement
│   ├── registerLayer(name, element) → cleanup
│   ├── show(name)
│   ├── hide(name)
│   └── isVisible(name) → boolean
├── blocks                  → BlockManager
├── ast
│   └── addCommand(pattern, nodeType, handler)
├── validation
│   ├── register(check) → unregister
│   └── registerNodeRule(nodeType, rule) → unregister
└── plugins                 → Proxy
    └── <name>.api          → публичный API плагина
```

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `bus` *(обязательное)* | `EventBus` | Шина событий. |
| `game` *(обязательное)* | `VN` | Ядро: выполняет узлы истории. |
| `player` *(обязательное)* | `Player` | Плеер со слоями страницы. |
| `blocks` *(обязательное)* | `BlockManager` | Менеджер визуальных блоков. |
| `ast` *(необязательное)* | `AST` | Парсер сценария. Без него `api.ast.addCommand` выбрасывает ошибку. |
| `validator` *(необязательное)* | `ProjectValidator` | Валидатор проекта. Без него `api.validation` выбрасывает ошибку. |

##### Примеры

```js
const plugins = new PluginManager(bus, game, player, blocks, ast, validator);
plugins.use(StatePlugin);
```

<sub>Исходник: plugin-manager.js:57</sub>

<a id="pluginmanager-use"></a>

#### `PluginManager.use(plugin)`

*Метод*

Устанавливает плагин после проверки его зависимостей.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `plugin` *(обязательное)* | `Object` | Устанавливаемый плагин. |

##### Возвращает

`PluginManager` — Текущий экземпляр менеджера.

##### Исключения

- `Error` — Если плагин некорректен, уже установлен или его зависимости отсутствуют.

##### Примеры

```js
plugins.use(ConditionsPlugin);
plugins.use(ChoicePlugin);
```

<sub>Исходник: plugin-manager.js:777</sub>

<a id="pluginmanager-remove"></a>

#### `PluginManager.remove(name)`

*Метод*

Удаляет установленный плагин, если от него
не зависят другие установленные плагины.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя удаляемого плагина. |

##### Возвращает

`boolean` — true, если плагин удалён,
или false, если он не был установлен.

##### Исключения

- `Error` — Если от плагина зависят другие установленные плагины.

##### Примеры

```js
plugins.remove('choice');
```

<sub>Исходник: plugin-manager.js:897</sub>

<a id="pluginmanager-has"></a>

#### `PluginManager.has(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`boolean`

##### Примеры

```js
if (!plugins.has('noty')) {
    console.warn('Уведомления недоступны');
}
```

<sub>Исходник: plugin-manager.js:963</sub>

<a id="pluginmanager-get"></a>

#### `PluginManager.get(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина |

##### Возвращает

`Object|undefined` — Исходный объект плагина

##### Примеры

```js
const plugin = plugins.get('state');
console.log(plugin.version);
```

<sub>Исходник: plugin-manager.js:977</sub>

<a id="pluginmanager-getmanifests"></a>

#### `PluginManager.getManifests()`

*Метод*

Описывает установленные плагины для валидатора.

##### Возвращает

`Object[]` — Массив `{ name, version, dependencies, nodeTypes }`.
В `nodeTypes` входят типы из манифеста и типы, которые плагин
реально зарегистрировал через `api.game.registerNodeType`.

##### Примеры

```js
const result = await validator.validate(project, { plugins: plugins.getManifests() });
```

<sub>Исходник: plugin-manager.js:990</sub>

<a id="pluginmanager-list"></a>

#### `PluginManager.list()`

*Метод*

##### Возвращает

`string[]` — Имена установленных плагинов

##### Примеры

```js
console.log(plugins.list()); // ['state', 'conditions', 'choice']
```

<sub>Исходник: plugin-manager.js:1014</sub>

## PluginAPI

<a id="api-plugin"></a>

### `api.plugin`

*Свойство*

Сведения о самом плагине.

#### Свойства

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` | `string` | Имя плагина из манифеста. |

#### Примеры

```js
api.log.info('Я плагин', api.plugin.name);
```

<sub>Исходник: plugin-manager.js:210</sub>

<a id="api-log"></a>

### `api.log`

*Группа*

Сообщения в консоль с именем плагина: `[имя] сообщение`.
Методы: debug, info, warn, error. Уровень общий для движка (logger.setLevel).

#### Примеры

```js
api.log.info('Плагин установлен');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.log.debug(args)`](#api-log-debug) | Подробное сообщение для отладки (по умолчанию скрыто). |
| [`api.log.info(args)`](#api-log-info) |  |
| [`api.log.warn(args)`](#api-log-warn) |  |
| [`api.log.error(args)`](#api-log-error) |  |

<sub>Исходник: plugin-manager.js:220</sub>

<a id="api-log-debug"></a>

#### `api.log.debug(args)`

*Метод*

Подробное сообщение для отладки (по умолчанию скрыто).

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
api.log.debug('Подробности', { step: 1 });
```

<sub>Исходник: plugin-manager.js:229</sub>

<a id="api-log-info"></a>

#### `api.log.info(args)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
api.log.info('Плагин готов');
```

<sub>Исходник: plugin-manager.js:240</sub>

<a id="api-log-warn"></a>

#### `api.log.warn(args)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
api.log.warn('Файл не найден, беру значение по умолчанию');
```

<sub>Исходник: plugin-manager.js:250</sub>

<a id="api-log-error"></a>

#### `api.log.error(args)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `args` *(обязательное)* | `*` | Что вывести. |

##### Примеры

```js
api.log.error('Не удалось прочитать данные', error);
```

<sub>Исходник: plugin-manager.js:260</sub>

<a id="api-events"></a>

### `api.events`

*Группа*

Обёртка над EventBus. Подписки плагина снимаются автоматически
при его удалении.

#### Примеры

```js
const off = api.events.on('story:end', () => {
    api.log.info('История закончилась');
});

api.events.emit('my-plugin:ready');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.events.on(event, handler)`](#api-events-on) | Подписка на событие. |
| [`api.events.emit(event, payload)`](#api-events-emit) | Эмит события. |

<sub>Исходник: plugin-manager.js:271</sub>

<a id="api-events-on"></a>

#### `api.events.on(event, handler)`

*Метод*

Подписка на событие.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события. |
| `handler` *(обязательное)* | `function` | Обработчик. |

##### Возвращает

`function` — Функция отписки.

##### Примеры

```js
api.events.on('story:loaded', (data) => {
    api.log.info('Проект загружен', data.project);
});
```

<sub>Исходник: plugin-manager.js:285</sub>

<a id="api-events-emit"></a>

#### `api.events.emit(event, payload)`

*Метод*

Эмит события.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `event` *(обязательное)* | `string` | Имя события. |
| `payload` *(необязательное)* | `*` | Данные события. |

##### Примеры

```js
api.events.emit('inventory:changed', { item: 'key', count: 1 });
```

<sub>Исходник: plugin-manager.js:305</sub>

<a id="api-game"></a>

### `api.game`

*Группа*

Фасад к VN и Player: регистрация типов узлов и работа со слоями.
Типы узлов и слои плагина снимаются автоматически.

#### Примеры

```js
api.game.registerNodeType('flash', () => {});
api.game.show('hud');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.game.getPluginLayer()`](#api-game-getpluginlayer) |  |
| [`api.game.registerLayer(name, element)`](#api-game-registerlayer) |  |
| [`api.game.registerNodeType(type, handler)`](#api-game-registernodetype) | Регистрирует обработчик типа узла сценария. context: { wait(options), resume(), goto(nodeId) }. `wait({ lock: true })` — ожидание, которо... |
| [`api.game.show(name)`](#api-game-show) |  |
| [`api.game.hide(name)`](#api-game-hide) |  |
| [`api.game.isVisible(name)`](#api-game-isvisible) |  |

<sub>Исходник: plugin-manager.js:318</sub>

<a id="api-game-getpluginlayer"></a>

#### `api.game.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement` — DOM-слой плагинов.

##### Примеры

```js
const layer = api.game.getPluginLayer();
layer.appendChild(document.createElement('div'));
```

<sub>Исходник: plugin-manager.js:329</sub>

<a id="api-game-registerlayer"></a>

#### `api.game.registerLayer(name, element)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |
| `element` *(обязательное)* | `HTMLElement` | DOM-элемент. |

##### Возвращает

`function` — Функция, удаляющая слой.

##### Примеры

```js
const hud = document.createElement('div');
api.game.registerLayer('hud', hud);
api.game.show('hud');
```

<sub>Исходник: plugin-manager.js:340</sub>

<a id="api-game-registernodetype"></a>

#### `api.game.registerNodeType(type, handler)`

*Метод*

Регистрирует обработчик типа узла сценария.
context: { wait(options), resume(), goto(nodeId) }.
`wait({ lock: true })` — ожидание, которое клик не пропускает.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `type` *(обязательное)* | `string` | Имя типа узла. |
| `handler` *(обязательное)* | `function` | (node, context) => void |

##### Примеры

```js
api.game.registerNodeType('flash', (node, context) => {
    api.log.info('Вспышка', node.color);
    // без wait() история сама перейдёт к следующему узлу
});

api.game.registerNodeType('pause', (node, context) => {
    context.wait();                 // ждём клика игрока
    setTimeout(() => context.resume(), node.ms);
});
```

<sub>Исходник: plugin-manager.js:353</sub>

<a id="api-game-show"></a>

#### `api.game.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Примеры

```js
api.game.show('hud');
```

<sub>Исходник: plugin-manager.js:380</sub>

<a id="api-game-hide"></a>

#### `api.game.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Примеры

```js
api.game.hide('hud');
```

<sub>Исходник: plugin-manager.js:389</sub>

<a id="api-game-isvisible"></a>

#### `api.game.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Возвращает

`boolean`

##### Примеры

```js
if (!api.game.isVisible('hud')) {
    api.game.show('hud');
}
```

<sub>Исходник: plugin-manager.js:398</sub>

<a id="api-player"></a>

### `api.player`

*Группа*

Прямой доступ к Player (слои). Те же методы, что api.game.* для слоёв.

#### Примеры

```js
api.player.registerLayer('hud', document.createElement('div'));
api.player.show('hud');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.player.getPluginLayer()`](#api-player-getpluginlayer) |  |
| [`api.player.registerLayer(name, element)`](#api-player-registerlayer) |  |
| [`api.player.show(name)`](#api-player-show) |  |
| [`api.player.hide(name)`](#api-player-hide) |  |
| [`api.player.isVisible(name)`](#api-player-isvisible) |  |

<sub>Исходник: plugin-manager.js:411</sub>

<a id="api-player-getpluginlayer"></a>

#### `api.player.getPluginLayer()`

*Метод*

##### Возвращает

`HTMLElement`

##### Примеры

```js
const layer = api.player.getPluginLayer();
```

<sub>Исходник: plugin-manager.js:421</sub>

<a id="api-player-registerlayer"></a>

#### `api.player.registerLayer(name, element)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |
| `element` *(обязательное)* | `HTMLElement` | DOM-элемент. |

##### Возвращает

`function` — Функция, удаляющая слой.

##### Примеры

```js
const box = document.createElement('div');
const removeLayer = api.player.registerLayer('my-layer', box);
// removeLayer() уберёт слой раньше, чем плагин будет удалён
```

<sub>Исходник: plugin-manager.js:431</sub>

<a id="api-player-show"></a>

#### `api.player.show(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Примеры

```js
api.player.show('hud');
```

<sub>Исходник: plugin-manager.js:444</sub>

<a id="api-player-hide"></a>

#### `api.player.hide(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Примеры

```js
api.player.hide('hud');
```

<sub>Исходник: plugin-manager.js:454</sub>

<a id="api-player-isvisible"></a>

#### `api.player.isVisible(name)`

*Метод*

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя слоя. |

##### Возвращает

`boolean`

##### Примеры

```js
const visible = api.player.isVisible('hud');
```

<sub>Исходник: plugin-manager.js:464</sub>

<a id="api-blocks"></a>

### `api.blocks`

*Свойство · Тип: BlockManager*

Менеджер блоков. Методы: create, get, getAll, getByType,
getActiveByChannel, getCurrent, show, hide, remove.
Блоки, созданные плагином, удаляются вместе с ним.
`create(type, { replace: true })` сначала убирает блоки того же канала.

#### Примеры

```js
const element = document.createElement('div');
element.textContent = 'Привет';

const block = api.blocks.create('hello', {
    channel: 'overlay',
    element,
    replace: true
});

api.blocks.remove(block.id);
```

<sub>Исходник: plugin-manager.js:476</sub>

<a id="api-ast"></a>

### `api.ast`

*Группа*

Доступ к парсеру сценария: плагин учит его распознавать
свои строки текста. Команды плагина снимаются при его удалении.

#### Примеры

```js
api.ast.addCommand(/^!(.*)$/, 'shout', (match) => ({
    type: 'shout',
    text: match[1].trim()
}));
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.ast.addCommand(pattern, nodeType, handler)`](#api-ast-addcommand) | Регистрирует текстовую команду парсера. |

<sub>Исходник: plugin-manager.js:498</sub>

<a id="api-ast-addcommand"></a>

#### `api.ast.addCommand(pattern, nodeType, handler)`

*Метод*

Регистрирует текстовую команду парсера.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `pattern` *(обязательное)* | `RegExp` | Регулярное выражение для строки сценария. |
| `nodeType` *(обязательное)* | `string` | Тип узла, который создаёт команда. |
| `handler` *(обязательное)* | `function` | (match, line, index, scene) => узел |

##### Исключения

- `Error` — Если PluginManager создан без парсера или такая команда уже зарегистрирована.

##### Примеры

```js
api.ast.addCommand(/^\/\/\s*(.*)$/, 'narration', (match, line, index) => ({
    type: 'narration',
    text: match[1].trim()
}));
```

<sub>Исходник: plugin-manager.js:511</sub>

<a id="api-validation"></a>

### `api.validation`

*Группа*

Доступ к валидатору проекта: плагин добавляет собственные проверки.
Проверки плагина снимаются при его удалении, а их id получают
префикс `имя-плагина:`.

Есть два вида проверок: `register` смотрит на проект целиком,
`registerNodeRule` вызывается для каждого узла своего типа.
Запись `{ code, message, path }` описывает одну проблему.
Ошибка (`error`) не даёт запустить историю, предупреждение
(`warning`) только показывается игроку и разработчику.

#### Примеры

```js
install(api) {
    // Проверка узлов типа take
    api.validation.registerNodeRule('take', {
        id: 'item',
        run(node) {
            return node.item
                ? []
                : [{ code: 'take.no-item', message: 'У узла take нет item' }];
        }
    });

    // Проверка проекта целиком, только предупреждение
    api.validation.register({
        id: 'items-config',
        severity: 'warning',
        run(project) {
            const items = project.getConfig().items;
            return items
                ? []
                : [{ code: 'inventory.no-items', message: 'В config нет items' }];
        }
    });
}
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.validation.register(check)`](#api-validation-register) | Регистрирует проверку всего проекта. |
| [`api.validation.registerNodeRule(nodeType, rule)`](#api-validation-registernoderule) | Регистрирует правило для узлов одного типа: валидатор сам обходит проект и вызывает `run(node, context)`. |

<sub>Исходник: plugin-manager.js:540</sub>

<a id="api-validation-register"></a>

#### `api.validation.register(check)`

*Метод*

Регистрирует проверку всего проекта.

Функция `run(project, context)` возвращает массив записей
(пустой массив значит «всё хорошо»). В записи можно указать
`code`, `message`, `path` и `severity`; имя плагина валидатор
подставит сам. `context.plugins` содержит манифесты
установленных плагинов, `context.project` — проверяемый проект.

Проверка выполняется до запуска истории, поэтому читать нужно
данные проекта (`project.getConfig()`, `project.getScenes()`),
а не runtime-состояние плагинов: оно ещё пустое.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `check` *(обязательное)* | `Object` | Проверка: `id`, `run(project, context)`, необязательные `severity` (error или warning, по умолчанию error) и `timeout` в миллисекундах (по умолчанию 3000). |

##### Возвращает

`function` — Функция, снимающая проверку.

##### Исключения

- `Error` — Если PluginManager создан без валидатора.

##### Примеры

```js
api.validation.register({
    id: 'unknown-variables',
    severity: 'warning',
    run(project) {
        const known = project.getConfig().state ?? {};
        const found = [];

        for (const scene of project.getScenes()) {
            for (const node of scene.nodes ?? []) {
                if (node.variable && !(node.variable in known)) {
                    found.push({
                        code: 'my.unknown-variable',
                        message: `Переменной "${node.variable}" нет в config.state`,
                        path: `узел "${node.id}"`
                    });
                }
            }
        }

        return found;
    }
});
```

<sub>Исходник: plugin-manager.js:578</sub>

<a id="api-validation-registernoderule"></a>

#### `api.validation.registerNodeRule(nodeType, rule)`

*Метод*

Регистрирует правило для узлов одного типа: валидатор сам
обходит проект и вызывает `run(node, context)`.

Путь к узлу (`scenes[0].nodes[2]`) подставляется в запись сам,
если плагин не указал свой `path`. Возвращать нужно массив
записей; пустой массив значит «узел в порядке».

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `nodeType` *(обязательное)* | `string` | Тип узла. |
| `rule` *(обязательное)* | `Object` | Правило: те же поля, что у register(). |

##### Возвращает

`function` — Функция, снимающая правило.

##### Исключения

- `Error` — Если PluginManager создан без валидатора.

##### Примеры

```js
api.validation.registerNodeRule('take', {
    id: 'item',
    run(node, context) {
        const found = [];

        if (!node.item) {
            found.push({
                code: 'take.no-item',
                message: `У узла "${node.id}" не задан item`
            });
        }

        if (node.count !== undefined && node.count < 1) {
            found.push({
                code: 'take.bad-count',
                message: 'count должен быть больше нуля',
                severity: 'warning'
            });
        }

        return found;
    }
});
```

<sub>Исходник: plugin-manager.js:634</sub>

<a id="api-snapshot"></a>

### `api.snapshot`

*Группа*

Участие плагина в снимках игры (`game.snapshot()` и `game.restore()`).
Если у плагина есть собственное состояние, он говорит, как его
сохранить и вернуть. Источник снимается при удалении плагина.

#### Примеры

```js
api.snapshot.register({
    save: () => ({ keys: 2 }),
    load: (data) => api.log.info('Ключей:', data.keys)
});
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`api.snapshot.register(provider)`](#api-snapshot-register) | Подключает источник данных снимка под именем плагина. |

<sub>Исходник: plugin-manager.js:687</sub>

<a id="api-snapshot-register"></a>

#### `api.snapshot.register(provider)`

*Метод*

Подключает источник данных снимка под именем плагина.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `provider` *(обязательное)* | `Object` | Объект `{ save(), load(data) }`. Данные должны сериализоваться в JSON. |

##### Возвращает

`function` — Функция, снимающая источник.

##### Исключения

- `Error` — Если игра не умеет делать снимки или у плагина уже есть источник.

##### Примеры

```js
let gold = 0;

api.snapshot.register({
    save: () => ({ gold }),
    load: (data) => { gold = data.gold; }
});
```

<sub>Исходник: plugin-manager.js:701</sub>

<a id="api-hasplugin"></a>

### `api.hasPlugin(name)`

*Метод*

Проверяет, установлен ли другой плагин. В отличие от `api.plugins.<имя>`,
ничего не пишет в консоль, поэтому подходит для необязательных зависимостей.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя плагина. |

#### Возвращает

`boolean` — true, если плагин установлен.

#### Примеры

```js
if (api.hasPlugin('state')) {
    text = api.plugins.state.api.format(text);
}
```

<sub>Исходник: plugin-manager.js:734</sub>

<a id="api-plugins"></a>

### `api.plugins`

*Свойство*

Proxy к API установленных плагинов.
Доступ: `api.plugins.<name>.api`.
Если плагин не установлен — null + warning в консоль.

#### Примеры

```js
const state = api.plugins.state.api.get();
api.plugins.state.api.set('health', 10);
```

<sub>Исходник: plugin-manager.js:748</sub>

## Plugins

<a id="backgroundplugin"></a>

### `BackgroundPlugin`

*Класс*

Узел `background`: ставит картинку фоном страницы.
Допустимы относительные пути, http(s) и data:image без кавычек, скобок
и пробелов. Небезопасный адрес находит валидатор (`background.unsafe-image`),
а если он всё же попал в игру, историю останавливает ошибка.

#### Примеры

```js
{
    id: 'bg1',
    type: 'background',
    image: 'assets/forest.jpg'
}
```

<sub>Исходник: plugins/background-plugin.js:15</sub>

<a id="choiceplugin"></a>

### `ChoicePlugin`

*Класс*

Узел `choice`: кнопки выбора с условными вариантами и переходом goto.
Зависит от плагинов `state` и `conditions`.

Для текстового сценария добавляет команду парсера:

`CHOICE: Вопрос | Вариант 1 → метка1 | Вариант 2 → метка2`

Вместо стрелки можно писать `->`. Вариант без стрелки создаётся
без перехода: история просто продолжится со следующего узла.
Условия в текстовой записи пока не поддерживаются.

Пока выбор не сделан, клик по экрану историю не продолжает. Блоки диалога
и повествования на время выбора скрываются.

Выбор с таймером: поле `timeout` (миллисекунды) включает отсчёт, который
виден на экране. Если игрок не успел, история переходит к `timeoutGoto`
(узел или сцена) или, если поля нет, идёт дальше по порядку.

Условия вариантов: см. плагин `conditions` (сравнения, флаги, all, any, not).
Текст вопроса и вариантов поддерживает подстановку `{имя}` из состояния.

Проверки проекта (через `api.validation`):

- `choice.no-options` (ошибка): у узла нет `options`;
- `choice.no-variants` (ошибка): у варианта нет `variants`;
- `choice.bad-condition` (ошибка): условие записано неверно;
- `choice.bad-timeout` (ошибка): `timeout` не положительное число;
- `choice.unknown-variable` (предупреждение): условие ссылается
  на переменную, которой нет ни в `config.state`, ни среди узлов
  `setvar` и `setflag`.

#### Примеры

```js
// Узел в проекте
{
    id: 'ask',
    type: 'choice',
    text: 'Куда пойдём?',
    options: [
        { id: 'o1', variants: [{ text: 'В подвал', goto: 'basement' }] },
        {
            id: 'o2',
            variants: [{
                text: 'Открыть дверь',
                goto: 'door',
                condition: { variable: 'health', operator: '>', value: 1 }
            }]
        }
    ]
}

// Строка в текстовом сценарии
CHOICE: Куда пойдём? | В подвал → basement | На улицу -> street
```

<sub>Исходник: plugins/choice-plugin.js:1</sub>

<a id="conditionsplugin"></a>

### `ConditionsPlugin`

*Класс*

Проверяет игровые условия.

Предоставляет другим плагинам методы evaluate(), validate()
и variables() через api.plugins.conditions.api.

Виды условий:

- сравнение: `{ variable, operator, value }`, операторы
  ==, !=, >, >=, <, <=;
- флаг: `{ flag: 'met_anna' }` (истинно, если флаг поставлен)
  или `{ flag: 'met_anna', value: false }` (истинно, если не поставлен);
- «и»: `{ all: [условие, условие] }`;
- «или»: `{ any: [условие, условие] }`;
- «не»: `{ not: условие }`.

Условия можно вкладывать друг в друга. Пустое условие считается истинным.

#### Примеры

```js
const { evaluate } = api.plugins.conditions.api;

evaluate({ variable: 'health', operator: '>=', value: 3 }, { health: 3 }); // true

evaluate({
    all: [
        { flag: 'met_anna' },
        { not: { variable: 'gold', operator: '<', value: 5 } }
    ]
}, { met_anna: true, gold: 7 }); // true
```

<sub>Исходник: plugins/conditions-plugin.js:3</sub>

<a id="dialogueplugin"></a>

### `DialoguePlugin`

*Класс*

Узел `dialogue`: реплика персонажа. История ждёт клика игрока.

Для текстового сценария добавляет команду парсера `[Имя] Текст`.

#### Примеры

```js
// Узел в проекте
{ id: 'd1', type: 'dialogue', character: 'Анна', text: 'Привет!' }

// Строка в текстовом сценарии
[Анна] Привет!
```

<sub>Исходник: plugins/dialogue-plugin.js:1</sub>

<a id="jumpplugin"></a>

### `JumpPlugin`

*Класс*

Узел `jump`: безусловный переход на другой узел или на сцену.
Поле `goto` — id узла или id сцены (тогда история продолжится
с первого узла сцены).

Метки `goto` проверяет валидатор ещё до запуска истории.

Текстовая запись (AST): `JUMP home`, `JUMP scene-2`.

#### Примеры

```js
{ id: 'j1', type: 'jump', goto: 'home' }
{ id: 'j2', type: 'jump', goto: 'scene-2' }
```

<sub>Исходник: plugins/jump-plugin.js:1</sub>

<a id="narrationplugin"></a>

### `NarrationPlugin`

*Класс*

Узел `narration`: текст от автора без имени персонажа.
История ждёт клика игрока.

Для текстового сценария добавляет команду парсера `// Текст`.

#### Примеры

```js
// Узел в проекте
{ id: 'n1', type: 'narration', text: 'Тихая ночь.' }

// Строка в текстовом сценарии
// Тихая ночь.
```

<sub>Исходник: plugins/narration-plugin.js:1</sub>

<a id="notyplugin"></a>

### `NotyPlugin`

*Класс*

Показывает всплывающие уведомления в правом верхнем углу.

Сам реагирует на события движка:
`validator:done` (результат проверки проекта: ошибки и предупреждения),
`plugin:error` (плагин не загрузился или не установился),
`story:error` (ошибка во время выполнения узла).

Публичный API: `api.plugins.noty.api`
(`notify`, `success`, `error`, `warning`, `info`).

#### Примеры

```js
api.plugins.noty.api.success('Сохранено');
api.plugins.noty.api.notify('Привет', { type: 'info', duration: 2000 });
```

<sub>Исходник: plugins/noty-plugin.js:1</sub>

<a id="stateplugin"></a>

### `StatePlugin`

*Класс*

Управляет runtime-состоянием игры: переменными и флагами.

Плагин хранит состояние независимо от Project.
Начальное состояние загружается из `project.config.state`
при событии `story:loaded`.

Состояние изменяется через публичный API плагина или узлами сценария
и доступно другим плагинам через `api.plugins.state.api`.

События плагина:

- `state:changed` с данными `{ name, value, oldValue }` при изменении переменной;
- `state:loaded` с данными `{ state }` после загрузки проекта или восстановления
  снимка: подписчикам нужно перечитать всё состояние.

Узлы:

- `setvar`: `{ type: 'setvar', variable: 'gold', value: 5, op: 'add' }`,
  где `op` равен `set` (по умолчанию), `add` или `sub`;
- `setflag`: `{ type: 'setflag', flag: 'met_anna', value: true }`,
  значение по умолчанию — true.

Текстовый сценарий (AST):

- `SET gold = 10`, `SET gold + 5`, `SET gold - 1`;
- `FLAG met_anna`, `FLAG met_anna = false`.

Плагин участвует в снимках игры: состояние сохраняется и восстанавливается
вместе с позицией в истории.

#### Примеры

```js
const state = api.plugins.state.api;

state.set('health', 3);
state.update({ gold: 10 });
state.get(); // { health: 3, gold: 10 }
```

<sub>Исходник: plugins/state-plugin.js:1</sub>

<a id="toplefthudplugin"></a>

### `TopLeftHUDPlugin`

*Класс*

Показывает в левом верхнем углу панель статуса героя.

Панель выводит из состояния игры значения `health`, `mana`, `gold`,
`score` и `level`: сразу после загрузки истории (событие `state:loaded`)
и при каждом их изменении (событие `state:changed`). Остальные
значения можно выводить через публичный API плагина:

`api.plugins['top-left-hud'].api`

Плагин зависит от `state`: он должен быть установлен раньше,
чтобы подписаться на его события.

#### Примеры

```js
const hud = api.plugins['top-left-hud'].api;

hud.setTitle('Герой');
hud.update({ health: 3, gold: 10 });
```

<sub>Исходник: plugins/top-left-hud-plugin.js:1</sub>

<a id="waitplugin"></a>

### `WaitPlugin`

*Класс*

Узел `wait`: пауза в миллисекундах с полосой прогресса.
Игрок может пропустить паузу кликом. Работает после узла,
который создаёт блок в канале `content` (dialogue или narration).

#### Примеры

```js
{ id: 'w1', type: 'wait', duration: 2000 }
```

<sub>Исходник: plugins/wait-plugin.js:1</sub>

## ConditionsPlugin

<a id="conditionsplugin-evaluate"></a>

### `ConditionsPlugin.evaluate(condition, state)`

*Метод*

Проверяет условие относительно переданного состояния.

Если условие не задано, возвращает true.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `condition` *(обязательное)* | `Object` | Условие проверки. |
| `state` *(обязательное)* | `Object` | Состояние, относительно которого проверяется условие. |

#### Возвращает

`boolean` — Результат проверки.

#### Исключения

- `Error` — Если оператор или вид условия неизвестен.

#### Примеры

```js
const result =
    api.plugins.conditions.api.evaluate(
        {
            variable: 'health',
            operator: '>',
            value: 5
        },
        { health: 10 }
    );
```

<sub>Исходник: plugins/conditions-plugin.js:44</sub>

<a id="conditionsplugin-validate"></a>

### `ConditionsPlugin.validate(condition)`

*Метод*

Проверяет форму условия, не вычисляя его. Нужна валидаторам
проекта: ошибку в условии лучше найти до запуска игры.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `condition` *(обязательное)* | `Object` | Условие. |

#### Возвращает

`string[]` — Описания проблем; пустой массив, если условие верно.

#### Примеры

```js
const problems = api.plugins.conditions.api.validate({
    variable: 'health',
    operator: '=>',
    value: 1
});
// ['неизвестный оператор "=>"']
```

<sub>Исходник: plugins/conditions-plugin.js:127</sub>

<a id="conditionsplugin-variables"></a>

### `ConditionsPlugin.variables(condition)`

*Метод*

Собирает имена переменных и флагов, которые использует условие,
в том числе во вложенных условиях.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `condition` *(обязательное)* | `Object` | Условие. |

#### Возвращает

`string[]` — Имена без повторов.

#### Примеры

```js
api.plugins.conditions.api.variables({
    any: [
        { flag: 'met_anna' },
        { variable: 'gold', operator: '>', value: 5 }
    ]
}); // ['met_anna', 'gold']
```

<sub>Исходник: plugins/conditions-plugin.js:206</sub>

## NotyPlugin

<a id="notyplugin-notify"></a>

### `NotyPlugin.notify(message, options)`

*Метод*

Показывает уведомление.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `message` *(обязательное)* | `string` | Текст уведомления. |
| `options` *(необязательное)* | `Object` | Параметры: `type` (success, error, warning или info), `title` и `duration` в миллисекундах (0 — не закрывать само). |

#### Примеры

```js
api.plugins.noty.api.notify('Игра сохранена', {
    type: 'success',
    title: 'Сохранение',
    duration: 2000
});
```

<sub>Исходник: plugins/noty-plugin.js:213</sub>

<a id="notyplugin-success"></a>

### `NotyPlugin.success(message, title)`

*Метод*

Уведомление об успехе.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `message` *(обязательное)* | `string` | Текст уведомления. |
| `title` *(необязательное)* | `string` | Заголовок (по умолчанию «Успешно»). |

#### Примеры

```js
api.plugins.noty.api.success('Предмет получен');
```

<sub>Исходник: plugins/noty-plugin.js:232</sub>

<a id="notyplugin-error"></a>

### `NotyPlugin.error(message, title)`

*Метод*

Уведомление об ошибке (закрывается через 5 секунд).

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `message` *(обязательное)* | `string` | Текст уведомления. |
| `title` *(необязательное)* | `string` | Заголовок (по умолчанию «Ошибка»). |

#### Примеры

```js
api.plugins.noty.api.error('Не удалось загрузить файл');
```

<sub>Исходник: plugins/noty-plugin.js:247</sub>

<a id="notyplugin-warning"></a>

### `NotyPlugin.warning(message, title)`

*Метод*

Предупреждающее уведомление.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `message` *(обязательное)* | `string` | Текст уведомления. |
| `title` *(необязательное)* | `string` | Заголовок (по умолчанию «Внимание»). |

#### Примеры

```js
api.plugins.noty.api.warning('Здоровье почти на нуле');
```

<sub>Исходник: plugins/noty-plugin.js:262</sub>

<a id="notyplugin-info"></a>

### `NotyPlugin.info(message, title)`

*Метод*

Информационное уведомление.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `message` *(обязательное)* | `string` | Текст уведомления. |
| `title` *(необязательное)* | `string` | Заголовок (по умолчанию «Информация»). |

#### Примеры

```js
api.plugins.noty.api.info('Новая глава');
```

<sub>Исходник: plugins/noty-plugin.js:277</sub>

## StatePlugin

<a id="stateplugin-get"></a>

### `StatePlugin.get()`

*Метод*

Возвращает копию текущего runtime-состояния.

#### Возвращает

`Object` — Копия текущего состояния.

#### Примеры

```js
const state = api.plugins.state.api.get();
console.log(state.health);
```

<sub>Исходник: plugins/state-plugin.js:58</sub>

<a id="stateplugin-getvalue"></a>

### `StatePlugin.getValue(name)`

*Метод*

Возвращает значение переменной состояния.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя переменной. |

#### Возвращает

`*` — Значение переменной.

#### Примеры

```js
const health =
    api.plugins.state.api.getValue('health');
```

<sub>Исходник: plugins/state-plugin.js:74</sub>

<a id="stateplugin-has"></a>

### `StatePlugin.has(name)`

*Метод*

Проверяет, есть ли переменная в состоянии.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя переменной. |

#### Возвращает

`boolean` — true, если переменная задана.

#### Примеры

```js
if (api.plugins.state.api.has('met_anna')) {
    api.log.info('Уже знакомы');
}
```

<sub>Исходник: plugins/state-plugin.js:91</sub>

<a id="stateplugin-set"></a>

### `StatePlugin.set(name, value)`

*Метод*

Устанавливает значение переменной состояния. Если значение
изменилось, приходит событие `state:changed`.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя переменной. |
| `value` *(обязательное)* | `*` | Новое значение. |

#### Примеры

```js
api.plugins.state.api.set('health', 10);
```

<sub>Исходник: plugins/state-plugin.js:109</sub>

<a id="stateplugin-update"></a>

### `StatePlugin.update(values)`

*Метод*

Обновляет несколько переменных состояния. Для каждой изменившейся
переменной приходит своё событие `state:changed`.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `values` *(обязательное)* | `Object` | Объект с новыми значениями. |

#### Примеры

```js
api.plugins.state.api.update({
    health: 10,
    money: 100
});
```

<sub>Исходник: plugins/state-plugin.js:132</sub>

<a id="stateplugin-add"></a>

### `StatePlugin.add(name, delta)`

*Метод*

Прибавляет число к числовой переменной. Если переменной нет,
она считается нулём. Для вычитания передайте отрицательное число.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `name` *(обязательное)* | `string` | Имя переменной. |
| `delta` *(обязательное)* | `number` | Сколько прибавить. |

#### Возвращает

`number` — Новое значение.

#### Исключения

- `TypeError` — Если переменная или delta не число.

#### Примеры

```js
api.plugins.state.api.add('gold', 5);
api.plugins.state.api.add('health', -1);
```

<sub>Исходник: plugins/state-plugin.js:153</sub>

<a id="stateplugin-format"></a>

### `StatePlugin.format(text)`

*Метод*

Подставляет значения переменных в текст: `{имя}` заменяется на
значение. Если переменной нет, запись остаётся в тексте как есть.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `text` *(обязательное)* | `string` | Текст с записями вида `{health}`. |

#### Возвращает

`string` — Текст с подставленными значениями.

#### Примеры

```js
api.plugins.state.api.set('gold', 5);
api.plugins.state.api.format('У тебя {gold} монет'); // 'У тебя 5 монет'
```

<sub>Исходник: plugins/state-plugin.js:183</sub>

<a id="stateplugin-storyloaded"></a>

### `StatePlugin.storyLoaded`

*Свойство*

Инициализирует runtime-состояние из конфигурации проекта
после загрузки истории и сообщает об этом событием `state:loaded`.

#### Примеры

```js
// Срабатывает само. После загрузки проекта:
// config: { state: { health: 3 } }
api.plugins.state.api.getValue('health'); // 3
```

<sub>Исходник: plugins/state-plugin.js:204</sub>

<a id="stateplugin-setvar"></a>

### `StatePlugin.setvar`

*Свойство*

Узел `setvar` меняет переменную и сразу идёт дальше.

Поля узла: `variable` (имя), `value` (значение) и необязательное `op`:
`set` (записать, по умолчанию), `add` (прибавить) или `sub` (вычесть).

Текстовая запись (AST):
`SET gold = 10`, `SET gold + 5`, `SET gold - 1`.

#### Примеры

```js
{ id: 'g1', type: 'setvar', variable: 'gold', value: 5, op: 'add' }
```

<sub>Исходник: plugins/state-plugin.js:307</sub>

<a id="stateplugin-setflag"></a>

### `StatePlugin.setflag`

*Свойство*

Узел `setflag` ставит или снимает флаг (переменную со значением
true или false) и сразу идёт дальше.

Поля узла: `flag` (имя) и `value` (по умолчанию true).

Текстовая запись (AST): `FLAG met_anna`, `FLAG met_anna = false`.

#### Примеры

```js
{ id: 'f1', type: 'setflag', flag: 'met_anna' }
{ id: 'f2', type: 'setflag', flag: 'met_anna', value: false }
```

<sub>Исходник: plugins/state-plugin.js:350</sub>

## TopLeftHUDPlugin

<a id="toplefthudplugin-set"></a>

### `TopLeftHUDPlugin.set(key, value)`

*Метод*

Выводит значение в панели.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `key` *(обязательное)* | `string` | Название строки. |
| `value` *(обязательное)* | `*` | Значение строки. |

#### Примеры

```js
api.plugins['top-left-hud'].api.set('gold', 50);
```

<sub>Исходник: plugins/top-left-hud-plugin.js:142</sub>

<a id="toplefthudplugin-settitle"></a>

### `TopLeftHUDPlugin.setTitle(title)`

*Метод*

Меняет заголовок панели.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `title` *(обязательное)* | `string` | Новый заголовок. |

#### Примеры

```js
api.plugins['top-left-hud'].api.setTitle('Статус героя');
```

<sub>Исходник: plugins/top-left-hud-plugin.js:159</sub>

<a id="toplefthudplugin-update"></a>

### `TopLeftHUDPlugin.update(values)`

*Метод*

Выводит сразу несколько значений.

#### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `values` *(обязательное)* | `Object` | Объект вида `{ название: значение }`. |

#### Примеры

```js
api.plugins['top-left-hud'].api.update({ gold: 50, level: 2 });
```

<sub>Исходник: plugins/top-left-hud-plugin.js:175</sub>

<a id="toplefthudplugin-show"></a>

### `TopLeftHUDPlugin.show()`

*Метод*

Показывает панель.

#### Примеры

```js
api.plugins['top-left-hud'].api.show();
```

<sub>Исходник: plugins/top-left-hud-plugin.js:191</sub>

<a id="toplefthudplugin-hide"></a>

### `TopLeftHUDPlugin.hide()`

*Метод*

Скрывает панель.

#### Примеры

```js
api.plugins['top-left-hud'].api.hide();
```

<sub>Исходник: plugins/top-left-hud-plugin.js:204</sub>

## Project

<a id="project"></a>

### `Project`

*Класс*

Единый источник данных игры: сцены, узлы, конфигурация,
ресурсы и список плагинов, которые нужны проекту.

#### Примеры

```js
const project = new Project({
    plugins: ['state', 'dialogue'],
    config: { state: { health: 3 } },
    scenes: [{
        id: 'scene-1',
        nodes: [{ id: 'a', type: 'dialogue', character: 'Анна', text: 'Привет!' }]
    }]
});

project.getNode('a');
```

#### Содержимое

| Имя | Описание |
| --- | --- |
| [`Project.getPlugins()`](#project-getplugins) | Возвращает плагины, которые объявлены в проекте. Элемент списка — имя плагина или объект `{ name, version }`. Сами плагины устанавливает ... |
| [`Project.getMetadata()`](#project-getmetadata) | Возвращает описание проекта (название, автор и т.п.). |
| [`Project.getNode(id)`](#project-getnode) | Ищет узел по id во всех сценах. |
| [`Project.getNextNode(nodeId)`](#project-getnextnode) | Возвращает узел, который идёт следом за указанным в той же сцене. |
| [`Project.getSceneForNode(nodeId)`](#project-getscenefornode) | Находит сцену, в которой лежит узел. |
| [`Project.getScenes()`](#project-getscenes) | Возвращает все сцены проекта. |
| [`Project.getScene(id)`](#project-getscene) | Возвращает сцену по id. |
| [`Project.getConfig()`](#project-getconfig) | Возвращает настройки проекта. Здесь лежит, например, начальное состояние игры в `config.state`. |
| [`Project.getAssets()`](#project-getassets) | Возвращает ресурсы проекта (картинки, звуки и т.п.). |

<sub>Исходник: project.js:1</sub>

<a id="project-getplugins"></a>

#### `Project.getPlugins()`

*Метод*

Возвращает плагины, которые объявлены в проекте.
Элемент списка — имя плагина или объект `{ name, version }`.
Сами плагины устанавливает `loadProjectPlugins()`.

##### Возвращает

`Array` — Список объявленных плагинов: строки
или объекты `{ name, version }`.

##### Примеры

```js
const project = new Project({
    plugins: ['state', { name: 'choice', version: '0.1.0' }]
});
project.getPlugins();
```

<sub>Исходник: project.js:35</sub>

<a id="project-getmetadata"></a>

#### `Project.getMetadata()`

*Метод*

Возвращает описание проекта (название, автор и т.п.).

##### Возвращает

`Object` — Метаданные; пустой объект, если не заданы.

##### Примеры

```js
const project = new Project({ metadata: { title: 'Демо' } });
project.getMetadata().title; // 'Демо'
```

<sub>Исходник: project.js:56</sub>

<a id="project-getnode"></a>

#### `Project.getNode(id)`

*Метод*

Ищет узел по id во всех сценах.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id узла. |

##### Возвращает

`Object` — Узел или null.

##### Примеры

```js
const node = project.getNode('intro');
if (!node) {
    console.warn('Узла нет');
}
```

<sub>Исходник: project.js:71</sub>

<a id="project-getnextnode"></a>

#### `Project.getNextNode(nodeId)`

*Метод*

Возвращает узел, который идёт следом за указанным в той же сцене.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `nodeId` *(обязательное)* | `string` | Id текущего узла. |

##### Возвращает

`Object` — Следующий узел или null, если узел последний.

##### Примеры

```js
const next = project.getNextNode('intro');
```

<sub>Исходник: project.js:99</sub>

<a id="project-getscenefornode"></a>

#### `Project.getSceneForNode(nodeId)`

*Метод*

Находит сцену, в которой лежит узел.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `nodeId` *(обязательное)* | `string` | Id узла. |

##### Возвращает

`Object` — Сцена или null.

##### Примеры

```js
const scene = project.getSceneForNode('intro');
console.log(scene?.id);
```

<sub>Исходник: project.js:128</sub>

<a id="project-getscenes"></a>

#### `Project.getScenes()`

*Метод*

Возвращает все сцены проекта.

##### Возвращает

`Object[]` — Массив сцен `{ id, nodes }`.

##### Примеры

```js
for (const scene of project.getScenes()) {
    console.log(scene.id, scene.nodes.length);
}
```

<sub>Исходник: project.js:148</sub>

<a id="project-getscene"></a>

#### `Project.getScene(id)`

*Метод*

Возвращает сцену по id.

##### Параметры

| Поле | Тип | Описание |
| --- | --- | --- |
| `id` *(обязательное)* | `string` | Id сцены. |

##### Возвращает

`Object` — Сцена или null.

##### Примеры

```js
const scene = project.getScene('scene-1');
```

<sub>Исходник: project.js:165</sub>

<a id="project-getconfig"></a>

#### `Project.getConfig()`

*Метод*

Возвращает настройки проекта. Здесь лежит, например, начальное состояние игры в `config.state`.

##### Возвращает

`Object` — Конфигурация; пустой объект, если не задана.

##### Примеры

```js
const project = new Project({ config: { state: { health: 3 } } });
project.getConfig().state.health; // 3
```

<sub>Исходник: project.js:183</sub>

<a id="project-getassets"></a>

#### `Project.getAssets()`

*Метод*

Возвращает ресурсы проекта (картинки, звуки и т.п.).

##### Возвращает

`Object` — Ресурсы; пустой объект, если не заданы.

##### Примеры

```js
const assets = project.getAssets();
```

<sub>Исходник: project.js:199</sub>

<a id="changelog"></a>

## История изменений

### 0.1.6 (2026-10-16)

**Добавлено (14)**

- `VN.registerSnapshotProvider`
- `VN.snapshot`
- `VN.restore`
- `api.snapshot`
- `api.snapshot.register`
- `api.hasPlugin`
- `ConditionsPlugin.validate`
- `ConditionsPlugin.variables`
- `JumpPlugin`
- `StatePlugin.has`
- `StatePlugin.add`
- `StatePlugin.format`
- `StatePlugin.setvar`
- `StatePlugin.setflag`

**Изменено (13)**

- `validateProjectScenes`
- `VN`
- `api.validation.register`
- `BackgroundPlugin`
- `ChoicePlugin`
- `ConditionsPlugin`
- `ConditionsPlugin.evaluate`
- `StatePlugin`
- `StatePlugin.set`
- `StatePlugin.update`
- `StatePlugin.storyLoaded`
- `TopLeftHUDPlugin`
- `ProjectValidator.validate`

### 0.1.5 (2026-10-15)

**Добавлено (47)**

- `BlockManager.get`
- `BlockManager.getAll`
- `BlockManager.getByType`
- `BlockManager.getActiveByChannel`
- `BlockManager.getCurrent`
- `BlockManager.show`
- `BlockManager.hide`
- `BlockManager.remove`
- `validateProjectScenes`
- `VN`
- `VN.getBus`
- `VN.registerNodeType`
- `VN.loadProject`
- `VN.next`
- `Player`
- `Player.getPluginLayer`
- `Player.registerLayer`
- `Player.show`
- `Player.hide`
- `Player.isVisible`
- `api.validation`
- `api.validation.register`
- `api.validation.registerNodeRule`
- `PluginManager.getManifests`
- `BackgroundPlugin`
- `DialoguePlugin`
- `NarrationPlugin`
- `NotyPlugin.notify`
- `NotyPlugin.success`
- `NotyPlugin.error`
- `NotyPlugin.warning`
- `NotyPlugin.info`
- `WaitPlugin`
- `ProjectValidator.register`
- `ProjectValidator.registerNodeRule`
- `ProjectValidator.unregister`
- `ProjectValidator.unregisterPlugin`
- `ProjectValidator.list`
- `ProjectValidator.validate`
- `Project.getMetadata`
- `Project.getNode`
- `Project.getNextNode`
- `Project.getSceneForNode`
- `Project.getScenes`
- `Project.getScene`
- `Project.getConfig`
- `Project.getAssets`

**Изменено (62)**

- `AST`
- `AST.constructor`
- `AST.removeCommand`
- `AST.getCommands`
- `BlockManager`
- `BlockManager.create`
- `VN.unregisterNodeType`
- `EventBus`
- `EventBus.on`
- `EventBus.off`
- `EventBus.emit`
- `Logger.constructor`
- `Logger.setLevel`
- `Logger.getLevel`
- `Logger.child`
- `Logger.debug`
- `Logger.info`
- `Logger.warn`
- `Logger.error`
- `PluginManager`
- `PluginManager.constructor`
- `api.plugin`
- `api.log.debug`
- `api.log.info`
- `api.log.warn`
- `api.log.error`
- `api.events`
- `api.events.emit`
- `api.game`
- `api.game.getPluginLayer`
- `api.game.registerLayer`
- `api.game.registerNodeType`
- `api.game.show`
- `api.game.hide`
- `api.game.isVisible`
- `api.player`
- `api.player.getPluginLayer`
- `api.player.registerLayer`
- `api.player.show`
- `api.player.hide`
- `api.player.isVisible`
- `api.blocks`
- `api.ast`
- `PluginManager.has`
- `PluginManager.get`
- `PluginManager.list`
- `PluginRegistry`
- `PluginRegistry.has`
- `PluginRegistry.list`
- `ChoicePlugin`
- `ConditionsPlugin`
- `NotyPlugin`
- `StatePlugin`
- `StatePlugin.storyLoaded`
- `TopLeftHUDPlugin`
- `TopLeftHUDPlugin.setTitle`
- `TopLeftHUDPlugin.show`
- `TopLeftHUDPlugin.hide`
- `ProjectValidator`
- `ProjectValidator.constructor`
- `ProjectValidator.validateGotos`
- `Project`

### 0.1.4 (2026-10-14)

**Добавлено (32)**

- `AST`
- `AST.constructor`
- `AST.addCommand`
- `AST.removeCommand`
- `AST.getCommands`
- `AST.parse`
- `BlockManager`
- `BlockManager.create`
- `VN.unregisterNodeType`
- `EventBus`
- `EventBus.on`
- `EventBus.off`
- `EventBus.emit`
- `Logger`
- `Logger.constructor`
- `Logger.setLevel`
- `Logger.getLevel`
- `Logger.child`
- `Logger.debug`
- `Logger.info`
- `Logger.warn`
- `Logger.error`
- `api.plugin`
- `api.log`
- `api.log.debug`
- `api.log.info`
- `api.log.warn`
- `api.log.error`
- `api.ast`
- `api.ast.addCommand`
- `ChoicePlugin`
- `NotyPlugin`

**Изменено (19)**

- `loadProjectPlugins`
- `PluginManager`
- `PluginManager.constructor`
- `api.events`
- `api.events.on`
- `api.events.emit`
- `api.game`
- `api.game.getPluginLayer`
- `api.game.registerLayer`
- `api.game.registerNodeType`
- `api.game.show`
- `api.game.hide`
- `api.game.isVisible`
- `api.player.registerLayer`
- `api.player.show`
- `api.player.hide`
- `api.player.isVisible`
- `api.blocks`
- `api.plugins`

### 0.1.3 (2026-10-13)

**Добавлено (18)**

- `localPluginLoader`
- `normalizePluginRefs`
- `orderPlugins`
- `loadProjectPlugins`
- `PluginRegistry`
- `PluginRegistry.constructor`
- `PluginRegistry.register`
- `PluginRegistry.resolve`
- `PluginRegistry.has`
- `PluginRegistry.list`
- `TopLeftHUDPlugin`
- `TopLeftHUDPlugin.set`
- `TopLeftHUDPlugin.setTitle`
- `TopLeftHUDPlugin.update`
- `TopLeftHUDPlugin.show`
- `TopLeftHUDPlugin.hide`
- `Project`
- `Project.getPlugins`

### 0.1.2 (2026-10-08)

**Добавлено (11)**

- `ConditionsPlugin`
- `ConditionsPlugin.evaluate`
- `StatePlugin`
- `StatePlugin.get`
- `StatePlugin.getValue`
- `StatePlugin.set`
- `StatePlugin.update`
- `StatePlugin.storyLoaded`
- `ProjectValidator`
- `ProjectValidator.constructor`
- `ProjectValidator.validateGotos`

**Изменено (4)**

- `PluginManager`
- `PluginManager.constructor`
- `PluginManager.use`
- `PluginManager.remove`

**Удалено (2)**

- `api.conditions`
- `api.conditions.evaluate`

### 0.1.1 (2026-10-07)

Изменений нет

### 0.1.0 (2026-10-07)

Первая версия: 27 записей
