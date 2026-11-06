// One shared room on the same server for every visitor and device.
export function getTopMerit(players) {
  const seen = new Set();
  return players.filter(p => {
    const identity = p.meritIdentity ?? p.id;
    if (p.meritBlocked || seen.has(identity)) return false;
    seen.add(identity); return true;
  }).sort((a, b) => (b.merit ?? 0) - (a.merit ?? 0)
    || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 5);
}

export class SharedRoom {
  constructor({ getState, onPlayers, onChat, onStatus, onRitual = () => {}, onMerit = () => {}, onTables = () => {} }) {
    Object.assign(this, { getState, onPlayers, onChat, onStatus, onRitual, onMerit, onTables });
    this.session = null;
    this.source = null;
    this.ready = false;
    this.seen = new Set();
    this.retryDelay = 1000;
  }
  async connect() {
    this.onStatus('connecting');
    try {
      if (!this.session) {
        const response = await fetch('/api/join', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...this.getState(), protocol: 2 }), signal: AbortSignal.timeout(8000),
        });
        if (response.status === 426) { this.onStatus('outdated'); return; }
        if (!response.ok) throw new Error('Không thể vào phòng.');
        this.session = await response.json();
        if (this.session.account) this.onMerit(this.session.account, false);
      }
      const { id, token } = this.session;
      const source = this.source = new EventSource(`/api/events?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
      this.connectTimeout = setTimeout(() => this.retry(), 10000);
      source.addEventListener('welcome', (event) => {
        clearTimeout(this.connectTimeout);
        const data = JSON.parse(event.data);
        this.ready = true; this.retryDelay = 1000;
        this.onStatus('connected');
        if (data.account) this.onMerit(data.account, false);
        this.onPlayers(data.players, id);
        this.onTables(data.tables ?? [], true);
        data.history.forEach(entry => this.receiveChat(entry, false));
        (data.rituals ?? []).forEach(entry => this.onRitual(entry, false));
      });
      source.addEventListener('players', event => this.onPlayers(JSON.parse(event.data), id));
      source.addEventListener('chat', event => this.receiveChat(JSON.parse(event.data), true));
      source.addEventListener('ritual', event => this.onRitual(JSON.parse(event.data), true));
      source.addEventListener('merit', event => this.onMerit(JSON.parse(event.data), true));
      source.addEventListener('tables', event => this.onTables(JSON.parse(event.data)));
      source.onerror = () => this.retry();
      this.syncTimer ??= setInterval(() => this.sync(), 100);
    } catch { this.retry(); }
  }
  receiveChat(entry, live) {
    if (this.seen.has(entry.id)) return;
    this.seen.add(entry.id);
    if (this.seen.size > 300) this.seen.delete(this.seen.values().next().value);
    this.onChat(entry, live);
  }
  retry() {
    clearTimeout(this.connectTimeout);
    this.source?.close(); this.source = null; this.ready = false;
    this.onStatus('offline');
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      // Reuse a live session. A restarted server rejects it; then join afresh.
      this.connect();
    }, this.retryDelay);
    this.retryDelay = Math.min(15000, this.retryDelay * 2);
  }
  async post(route, data) {
    if (!this.session) throw new Error('Chưa kết nối phòng chung.');
    const response = await fetch(`/api/${route}?id=${encodeURIComponent(this.session.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.session.token}` },
      body: JSON.stringify(data), signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) { this.session = null; this.retry(); }
    const result = await response.json();
    if (result.account) this.onMerit(result.account, true);
    if (!response.ok) {
      const error = new Error(result.error || 'Không thể gửi, vui lòng thử lại.');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  async sync() {
    if (!this.session || this.sending) return;
    this.sending = true;
    try { await this.post('state', this.getState()); }
    catch (error) { if (this.ready && (!error.status || error.status >= 500)) this.retry(); }
    finally { this.sending = false; }
  }
  async chat(text) {
    if (!this.ready) throw new Error('Đang kết nối lại, lời nhắn chưa được gửi.');
    await this.post('chat', { text });
  }
}
