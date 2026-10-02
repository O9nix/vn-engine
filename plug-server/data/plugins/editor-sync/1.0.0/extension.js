/**
 * Синхронизация нескольких окон редактора
 */
VN.plugin({
  id: 'editor-sync',
  name: 'Синхронизация редактора',
  version: '1.0.0',
  description: 'Синхронизирует текст между iframe и отдельными окнами редактора',
  targets: ['editor'],

  ui(api) {
    const editor = document.getElementById('script-editor');
    if (!editor) return;

    let applyingRemote = false; // чтобы не зациклить запись

    // 1) Другое окно/вкладка изменило vn_script
    window.addEventListener('storage', (e) => {
      if (e.key !== 'vn_script' || e.newValue == null) return;
      if (editor.value === e.newValue) return;

      applyingRemote = true;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = e.newValue;
      // курсор — по возможности сохраняем
      try {
        editor.selectionStart = Math.min(start, editor.value.length);
        editor.selectionEnd = Math.min(end, editor.value.length);
      } catch (_) {}
      applyingRemote = false;
    });

    // 2) Если мы — popup, дублируем обновление в opener (главное окно),
    //    чтобы iframe-плеер/граф получили postMessage без задержки
    function notifyOpener() {
      if (applyingRemote) return;
      if (!window.opener || window.opener.closed) return;
      try {
        window.opener.postMessage(
          { type: 'script-updated', text: editor.value },
          '*'
        );
      } catch (_) {}
    }

    editor.addEventListener('input', () => {
      // localStorage уже пишет сам editor.html (debounce 200ms);
      // opener уведомляем чуть позже тем же темпом
      clearTimeout(notifyOpener._t);
      notifyOpener._t = setTimeout(notifyOpener, 200);
    });

    // 3) Опционально: BroadcastChannel — надёжнее storage между всеми окнами
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('vn_script_sync');

      editor.addEventListener('input', () => {
        if (applyingRemote) return;
        clearTimeout(bc._t);
        bc._t = setTimeout(() => {
          bc.postMessage({ type: 'script-updated', text: editor.value });
        }, 200);
      });

      bc.onmessage = (ev) => {
        const data = ev.data;
        if (!data || data.type !== 'script-updated') return;
        if (typeof data.text !== 'string') return;
        if (editor.value === data.text) return;

        applyingRemote = true;
        editor.value = data.text;
        applyingRemote = false;
      };
    }
  },
});