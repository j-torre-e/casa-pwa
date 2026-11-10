// Capa de datos única. Las vistas NUNCA hablan con MQTT directamente: usan get/update/subscribe.
// Cuando llegue la Raspberry o la cola sin conexión, solo cambia este archivo.
//
// Cada sección es un documento JSON publicado como retained en casa/<seccion>.

const PREFIX = 'casa/';

const DEFAULTS = {
  batch: [],          // [{id, name, qty, desc}]
  compra: [],         // [{id, name, qty, desc}]
  tareas: [],         // [{id, title, done, date, notes}]
  calendario: [],     // [{id, title, type, start, end, notes}]
  almacen: [],        // [{id, name, qty, desc, roomId, locationId}]
  config: { rooms: [] },               // rooms: [{id, name, locations: [{id, name}]}]
  mapa: { plan: null, devices: [] },   // futuro: devices [{id, name, kind, roomId, x, y, topic}]
};

export const SECTIONS = Object.keys(DEFAULTS);

const clone = (v) => JSON.parse(JSON.stringify(v));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- Estado local (caché en el móvil) ----------
const state = {};
const listeners = {};
for (const s of SECTIONS) {
  listeners[s] = new Set();
  try {
    const raw = localStorage.getItem('casa:' + s);
    state[s] = raw ? JSON.parse(raw) : clone(DEFAULTS[s]);
  } catch {
    state[s] = clone(DEFAULTS[s]);
  }
}

function persist(s) {
  try { localStorage.setItem('casa:' + s, JSON.stringify(state[s])); } catch { /* sin espacio */ }
}
function emit(s) {
  listeners[s].forEach((fn) => fn(state[s]));
}

export function get(s) {
  return state[s];
}

export function set(s, value) {
  state[s] = value;
  persist(s);
  emit(s);
  if (client && client.connected) {
    client.publish(PREFIX + s, JSON.stringify(value), { qos: 1, retain: true });
  }
}

// Modifica una copia y la guarda. fn puede mutar la copia o devolver un valor nuevo.
export function update(s, fn) {
  const copy = clone(state[s]);
  const result = fn(copy);
  set(s, result === undefined ? copy : result);
}

export function subscribe(s, fn) {
  listeners[s].add(fn);
  return () => listeners[s].delete(fn);
}

// Atajo: lista de habitaciones (siempre un array)
export const rooms = () => (state.config && state.config.rooms) || [];

// ---------- Estado de conexión ----------
let status = { text: 'sin configurar', ok: false };
const statusListeners = new Set();

export function onStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}
function setStatus(text, ok = false) {
  status = { text, ok };
  statusListeners.forEach((fn) => fn(status));
}

// ---------- Configuración del broker (solo en este móvil) ----------
export function getConn() {
  try {
    const c = localStorage.getItem('casa:conn') || localStorage.getItem('mqttCfg'); // mqttCfg = prueba anterior
    return c ? JSON.parse(c) : {};
  } catch {
    return {};
  }
}
export function setConn(c) {
  localStorage.setItem('casa:conn', JSON.stringify(c));
  connect();
}

// ---------- MQTT ----------
let client = null;
let lastError = '';

export function connect() {
  const c = getConn();
  if (!c.url) { setStatus('sin configurar'); return; }
  if (typeof mqtt === 'undefined') { setStatus('sin red'); return; }
  if (client) client.end(true);

  lastError = '';
  setStatus('conectando…');
  client = mqtt.connect(c.url, {
    username: c.user,
    password: c.pass,
    clientId: 'casa-' + Math.random().toString(16).slice(2, 10),
    reconnectPeriod: 4000,
    connectTimeout: 10000,
    clean: true,
  });

  client.on('connect', () => {
    lastError = '';
    setStatus('conectado', true);
    client.subscribe(PREFIX + '+', { qos: 1 });
  });
  // El error se mantiene visible hasta que la conexión se recupere.
  client.on('error', (err) => { lastError = err.message; setStatus('error: ' + lastError); });
  client.on('reconnect', () => setStatus(lastError ? 'error: ' + lastError : 'reconectando…'));
  client.on('close', () => setStatus(lastError ? 'error: ' + lastError : 'desconectado'));

  client.on('message', (topic, payload) => {
    const s = topic.slice(PREFIX.length);
    if (!SECTIONS.includes(s)) return;
    try {
      state[s] = JSON.parse(payload.toString());
      persist(s);
      emit(s);
    } catch { /* mensaje no válido: se ignora */ }
  });
}
