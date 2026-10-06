# VN Editor frontend

```
public/
  editor.html
  css/editor/
    default.css
    myui.css
  js/editor/
    main.js                 # boot
    core/app.js             # logic
    ui/
      index.js              # UI pack registry
      default.html
      myui.html
      myui.js
      shared-settings.js    # UI switcher + graphics (all packs)
```

## Switch UI

- `/editor?ui=default` — Classic
- `/editor?ui=myui` — My UI
- Settings → **Интерфейс** (works in both packs)
- `localStorage.vn_editor_ui`

## Graphics

Performance profile is shared (`localStorage vn_myui_perf_level`).
Available in **⚙ Настройки** for Classic and in My UI settings panel.
