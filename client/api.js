// ═══════════════════════════════════════════════════════════
//  api.js  —  thin client wrapper around the Landlord REST API
//  Include via <script src="/api.js"></script> in the frontend.
// ═══════════════════════════════════════════════════════════

const API_BASE = window.API_BASE || '';   // empty = same origin

class LandlordAPI {
  constructor() {
    this._token = localStorage.getItem('ll_token') || null;
  }

  // ── Internal ──────────────────────────────────────────────
  _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    if (this._token) h['Authorization'] = `Bearer ${this._token}`;
    return h;
  }

  async _request(method, path, body) {
    const opts = { method, headers: this._headers() };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(API_BASE + path, opts);
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  // ── Auth ──────────────────────────────────────────────────
  async register(nickname, password) {
    const data = await this._request('POST', '/api/auth/register', { nickname, password });
    this._token = data.token;
    localStorage.setItem('ll_token', this._token);
    return data;
  }

  async login(nickname, password) {
    const data = await this._request('POST', '/api/auth/login', { nickname, password });
    this._token = data.token;
    localStorage.setItem('ll_token', this._token);
    return data;
  }

  logout() {
    this._token = null;
    localStorage.removeItem('ll_token');
  }

  isLoggedIn() { return !!this._token; }

  // ── Player ────────────────────────────────────────────────
  getMe()           { return this._request('GET',  '/api/player/me'); }
  getLeaderboard()  { return this._request('GET',  '/api/player/leaderboard'); }
  getTransactions(limit = 50, offset = 0) {
    return this._request('GET', `/api/player/transactions?limit=${limit}&offset=${offset}`);
  }

  // ── Properties ────────────────────────────────────────────
  getProperties()      { return this._request('GET', '/api/properties'); }
  getProperty(id)      { return this._request('GET', `/api/properties/${id}`); }

  // ── Game actions ──────────────────────────────────────────
  buyShare(propertyId, pct) {
    return this._request('POST', '/api/game/buy', { propertyId, pct });
  }
  upgradeProperty(propertyId) {
    return this._request('POST', '/api/game/upgrade/property', { propertyId });
  }
  upgradeGlobal(upgradeKey) {
    return this._request('POST', '/api/game/upgrade/global', { upgradeKey });
  }

  // ── Health ────────────────────────────────────────────────
  health() { return this._request('GET', '/api/health'); }
}

// Singleton
window.api = new LandlordAPI();
