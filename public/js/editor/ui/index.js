/** UI packs for VN Editor. UI behavior is loaded separately from the HTML shell. */
export const UI_PACKS = {
  default: {
    name: 'Default',
    css: '/css/editor/default.css',
    html: '/js/editor/ui/default.html'
  },
  myui: {
    name: 'My UI',
    css: '/css/editor/myui.css',
    html: '/js/editor/ui/myui.html',
    js: '/js/editor/ui/myui.js'
  },
};

export function resolveUiPack(id) {
  const key = (id || 'myui').toLowerCase();
  return UI_PACKS[key] || UI_PACKS.myui;
}
