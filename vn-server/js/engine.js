/**
 * Совместимость со старым именем VNEngine.
 * Новый код должен использовать VNCore + createVN / VNDefaultUI.
 * @deprecated
 */
(function (global) {
  'use strict';

  if (typeof createVN === 'function') {
    global.VNEngine = function VNEngine(container, options) {
      console.warn(
        '[VNEngine] устарел. Используйте createVN(container, options) или VNCore + setRenderer.'
      );
      return createVN(container, options);
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
