/* VN Auth client for the development auth-server. */
(function () {
  'use strict';

  const AUTH_URL = (window.VN_AUTH_URL || localStorage.getItem('vn_auth_url') || 'http://127.0.0.1:8090').replace(/\/$/, '');
  const ACCESS_KEY = 'vn_auth_access_token';
  const REFRESH_KEY = 'vn_auth_refresh_token';
  const USER_KEY = 'vn_auth_user';

  function getAccessToken() { return localStorage.getItem(ACCESS_KEY) || ''; }
  function getRefreshToken() { return localStorage.getItem(REFRESH_KEY) || ''; }
  function getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (_) { return null; }
  }
  function saveSession(data) {
    if (data.accessToken) localStorage.setItem(ACCESS_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    window.dispatchEvent(new CustomEvent('vn-auth-changed', { detail: data.user || null }));
  }
  function clearSession() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new CustomEvent('vn-auth-changed', { detail: null }));
  }

  async function request(path, options) {
    const opts = Object.assign({ method: 'GET' }, options || {});
    opts.headers = Object.assign({}, opts.headers || {});
    const token = getAccessToken();
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }

    let res = await fetch(AUTH_URL + path, opts);
    if (res.status === 401 && getRefreshToken() && path !== '/api/auth/refresh') {
      const refreshed = await refresh();
      if (refreshed) {
        opts.headers.Authorization = 'Bearer ' + getAccessToken();
        res = await fetch(AUTH_URL + path, opts);
      }
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && (data.message || data.error)) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function login(username, password) {
    const data = await request('/api/auth/login', { method: 'POST', body: { username, password } });
    saveSession(data);
    return data.user;
  }

  async function register(username, password, displayName) {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: { username, password, displayName: displayName || username }
    });
    saveSession(data);
    return data.user;
  }

  async function refresh() {
    const token = getRefreshToken();
    if (!token) return false;
    try {
      const data = await fetch(AUTH_URL + '/api/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: token })
      }).then(async r => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.message || d.error || ('HTTP ' + r.status));
        return d;
      });
      saveSession(data);
      return true;
    } catch (_) {
      clearSession();
      return false;
    }
  }

  async function me() {
    const token = getAccessToken();
    if (!token) return null;
    try {
      const data = await request('/api/auth/me');
      if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user || null;
    } catch (_) {
      clearSession();
      return null;
    }
  }

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      await fetch(AUTH_URL + '/api/auth/logout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
    } catch (_) {}
    clearSession();
  }

  window.VNAuth = { AUTH_URL, getAccessToken, getRefreshToken, getUser, login, register, refresh, me, logout, request, clearSession };
})();
