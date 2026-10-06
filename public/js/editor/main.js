/**
 * VN Editor entry: load UI pack, optional UI behavior, then core app logic.
 * UI variant: ?ui=myui  or  localStorage vn_editor_ui
 */
import { resolveUiPack } from './ui/index.js';

function getUiId() {
  try {
    const q = new URLSearchParams(location.search).get('ui');
    if (q) return q;
    if (window.VN_EDITOR_UI) return window.VN_EDITOR_UI;
    return localStorage.getItem('vn_editor_ui') || 'myui';
  } catch (_) {
    return 'myui';
  }
}

async function loadCss(href) {
  return new Promise((resolve, reject) => {
    document.querySelectorAll('link[data-vn-ui-css]').forEach((el) => el.remove());
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href + (href.includes('?') ? '&' : '?') + 'v=' + Date.now();
    link.dataset.vnUiCss = '1';
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('CSS load failed: ' + href));
    document.head.appendChild(link);
  });
}

async function loadHtml(url) {
  const res = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
  if (!res.ok) throw new Error('HTML load failed: ' + url + ' ' + res.status);
  return res.text();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + Date.now();
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Script load failed: ' + src));
    document.body.appendChild(s);
  });
}

async function boot() {
  const uiId = getUiId();
  const pack = resolveUiPack(uiId);
  window.VN_EDITOR_UI_PACK = pack;
  window.VN_EDITOR_UI_ID = pack === resolveUiPack(uiId) ? uiId : 'default';

  const root = document.getElementById('editor-root');
  if (!root) throw new Error('#editor-root missing');

  root.innerHTML = '<div style="padding:24px;color:#a79bc2;font-family:sans-serif">Загрузка интерфейса…</div>';

  try {
    await loadCss(pack.css);
    const html = await loadHtml(pack.html);
    root.innerHTML = html;

    // IMPORTANT: HTML is inserted with innerHTML, so scripts embedded in the UI HTML
    // do not execute. UI-specific behavior must therefore be loaded explicitly here.
    if (pack.js) await loadScript(pack.js);

    // Core app expects the DOM to already exist.
    await loadScript('/js/editor/core/app.js');
  } catch (e) {
    console.error(e);
    root.innerHTML =
      '<div style="padding:24px;color:#b0658a;font-family:sans-serif">' +
      '<b>Не удалось загрузить UI «' + uiId + '»</b><br>' +
      String(e && e.message ? e.message : e) +
      '<br><br><a href="?ui=myui" style="color:#c9a24b">Открыть My UI</a></div>';
  }
}

boot();
