/**
 * VN Identity client
 *
 * Browser-side OIDC bridge for the VN platform.
 * Top-level app owns the Keycloak session. Child iframes receive the
 * current auth state through postMessage.
 */
(function (global) {
  'use strict';

  const VN = global.VN || (global.VN = {});
  const CONFIG = {
    url: 'http://127.0.0.1:8090',
    realm: 'vn',
    clientId: 'vn-web',
  };

  let keycloak = null;
  let state = {
    ready: false,
    authenticated: false,
    user: null,
    token: null,
    tokenParsed: null,
    error: null,
  };
  const listeners = new Set();

  function userFromToken(tokenParsed) {
    if (!tokenParsed || !tokenParsed.sub) return null;
    return {
      userId: String(tokenParsed.sub),
      username: tokenParsed.preferred_username || null,
      email: tokenParsed.email || null,
      name: tokenParsed.name || [tokenParsed.given_name, tokenParsed.family_name].filter(Boolean).join(' ') || null,
    };
  }

  function snapshot(includeToken) {
    return {
      ready: !!state.ready,
      authenticated: !!state.authenticated,
      user: state.user ? { ...state.user } : null,
      token: includeToken ? state.token : null,
      tokenParsed: state.tokenParsed ? { ...state.tokenParsed } : null,
      error: state.error || null,
    };
  }

  function emit() {
    const value = snapshot(false);
    listeners.forEach(fn => { try { fn(value); } catch (e) {} });
  }

  function setState(next, broadcast) {
    state = Object.assign({}, state, next);
    emit();
    if (broadcast && window.parent !== window) return;
    if (broadcast && window.parent === window) {
      document.querySelectorAll('iframe').forEach(frame => {
        try {
          frame.contentWindow.postMessage({ type: 'vn-auth-state', auth: snapshot(true) }, '*');
        } catch (e) {}
      });
    }
  }

  function receiveChildState(auth) {
    if (!auth) return;
    state = {
      ready: !!auth.ready,
      authenticated: !!auth.authenticated,
      user: auth.user || null,
      token: auth.token || null,
      tokenParsed: auth.tokenParsed || null,
      error: auth.error || null,
    };
    emit();
  }

  async function initTopLevel() {
    if (state.ready) return snapshot(false);
    if (typeof global.Keycloak !== 'function') {
      state = { ...state, ready: true, error: 'Keycloak JS adapter не загружен.' };
      emit();
      return snapshot(false);
    }

    keycloak = new global.Keycloak(CONFIG);
    try {
      const authenticated = await keycloak.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: global.location.origin + '/silent-check-sso.html',
      });
      state = {
        ready: true,
        authenticated: !!authenticated,
        user: authenticated ? userFromToken(keycloak.tokenParsed) : null,
        token: authenticated ? keycloak.token : null,
        tokenParsed: authenticated ? keycloak.tokenParsed : null,
        error: null,
      };
      keycloak.onAuthSuccess = () => updateFromKeycloak(true);
      keycloak.onAuthRefreshSuccess = () => updateFromKeycloak(true);
      keycloak.onAuthLogout = () => updateFromKeycloak(true);
      keycloak.onTokenExpired = () => updateToken(true);
      emit();
      broadcast();
      return snapshot(false);
    } catch (error) {
      state = { ...state, ready: true, authenticated: false, error: error.message || String(error) };
      emit();
      return snapshot(false);
    }
  }

  function updateFromKeycloak(broadcastState) {
    if (!keycloak) return;
    state = {
      ...state,
      ready: true,
      authenticated: !!keycloak.authenticated,
      user: keycloak.authenticated ? userFromToken(keycloak.tokenParsed) : null,
      token: keycloak.authenticated ? keycloak.token : null,
      tokenParsed: keycloak.authenticated ? keycloak.tokenParsed : null,
      error: null,
    };
    emit();
    if (broadcastState) broadcast();
  }

  function broadcast() {
    if (window.parent !== window) return;
    document.querySelectorAll('iframe').forEach(frame => {
      try { frame.contentWindow.postMessage({ type: 'vn-auth-state', auth: snapshot(true) }, '*'); } catch (e) {}
    });
  }

  async function login() {
    if (!keycloak) return;
    await keycloak.login({ redirectUri: global.location.href });
  }

  async function logout() {
    if (!keycloak) return;
    await keycloak.logout({ redirectUri: global.location.origin + '/' });
  }

  async function updateToken(minValidity = 30) {
    if (!keycloak || !keycloak.authenticated) return false;
    try {
      const refreshed = await keycloak.updateToken(minValidity);
      updateFromKeycloak(true);
      return refreshed;
    } catch (error) {
      state = { ...state, authenticated: false, user: null, token: null, tokenParsed: null, error: error.message || String(error) };
      emit();
      broadcast();
      return false;
    }
  }

  async function authFetch(url, options) {
    const opts = Object.assign({}, options || {});
    opts.headers = new Headers(opts.headers || {});
    if (keycloak && keycloak.authenticated) {
      await updateToken(30);
    }
    if (state.token) opts.headers.set('Authorization', 'Bearer ' + state.token);
    return fetch(url, opts);
  }

  VN.auth = {
    config: CONFIG,
    get ready() { return state.ready; },
    get isAuthenticated() { return state.authenticated; },
    get user() { return state.user ? { ...state.user } : null; },
    get userId() { return state.user ? state.user.userId : null; },
    get token() { return state.token; },
    get tokenParsed() { return state.tokenParsed ? { ...state.tokenParsed } : null; },
    init: initTopLevel,
    login,
    logout,
    updateToken,
    fetch: authFetch,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    _receive: receiveChildState,
    _broadcast: broadcast,
  };

  window.addEventListener('message', event => {
    if (event.data && event.data.type === 'vn-auth-state') receiveChildState(event.data.auth);
  });

  if (window.parent !== window) {
    try { window.parent.postMessage({ type: 'vn-auth-request' }, '*'); } catch (e) {}
  }
})(typeof window !== 'undefined' ? window : globalThis);
