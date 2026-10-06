# Changelog

История изменений VN Engine.

Проект использует Semantic Versioning: `MAJOR.MINOR.PATCH`. В период `0.x` API считается нестабильным; версии фиксируют состояние архитектуры и публичного API на момент релиза. urlSemantic Versioning 2.0.0https://semver.org/lang/ru/spec/v2.0.0.html

## [0.1.0] — Initial Architecture

Первая зафиксированная версия проекта.

### Added

- VN Core для исполнения сценария.
- EventBus.
- Project как источник истины структуры сценария.
- Player.
- BlockManager.
- PluginManager.
- DialoguePlugin.
- NarrationPlugin.
- BackgroundPlugin.
- WaitPlugin.
- ChoicePlugin.
- ConditionEvaluator.
- StatePlugin как подготовленный, но ещё не подключённый плагин.
- Plugin API и межплагинный доступ через `api.plugins.<plugin>.api`.
- Поддержка `context.wait()`, `context.resume()` и `context.goto(nodeId)`.
- Условия для вариантов Choice.

### Changed

- Навигация принадлежит `VN`, а не отдельному FlowResolver.
- Визуальные блоки отделены от логики сценария через BlockManager.

### Known limitations

- Runtime state фактически хранится внутри `VN`.
- StatePlugin пока не подключён в `main.js`.
- Зависимости плагинов пока не валидируются автоматически.
- `FlowResolver` существует в дереве проекта, но не участвует в текущем runtime-потоке.

### API snapshot

Полная документация API версии находится в:

`docs/versions/0.1.0/api.md`

Обзор состояния версии:

`docs/versions/0.1.0/overview.md`
