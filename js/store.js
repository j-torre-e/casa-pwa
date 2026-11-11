// Capa de datos única. Las vistas NUNCA hablan con MQTT directamente: usan get/update/subscribe.
//
// Cada sección es un documento JSON publicado como retained en casa/<seccion>.
// Sincronización:
//  - Todo cambio se guarda primero en el móvil y queda marcado como "sin enviar".
//  - Se envía en cuanto hay conexión y el broker lo confirma.
//  - Al reconectar con cambios sin enviar, se fusiona lo del móvil con lo del broker
//    (sync.js). Si los dos móviles cambiaron lo mismo, se avisa para que decidas.

import { merge3, eq, eqItem } from './sync.js';

const PREFIX = 'casa/';
const WAIT_RETAINED_MS = 3000;  // espera a recibir lo del broker antes de enviar lo pendiente
const RECONNECT_MS = 4000;

const DEFAULTS = {
  batch: [],          // [{id, name, qty, desc}]
  compra: [],         // [{id, name, qty, desc}]
  tareas: [],         // [{id, title, done, date, notes}]
  calendario: [],     // [{id, title, type, start, end, notes}]
  almacen: [],        // [{id, name, qty, desc, roomId, locationId}]
  mejoras: [],        // [{id, name, desc, section, newSection, status, blockedReason, done, doneAt}]
  semanal: [],        // un elemento por día con algo escrito: [{id: 'AAAA-MM-DD', comida, cena}]
  config: { rooms: [] },               // rooms: [{id, name, locations: [{id, name}]}]
  mapa: { plan: null, devices: [] },   // futuro: devices [{id, name, kind, roomId, x, y, topic}]
};

export const SECTIONS = Object.keys(DEFAULTS);

const clone = (v) => JSON.parse(JSON.stringify(v));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const load = (key, fallback) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};
const save = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* sin espacio */ } };

// ---------- Estado en el móvil ----------
const state = {};      // lo que ve el usuario
const base = {};       // lo último que sabemos que tiene el broker
const listeners = {};
const dirty = load('casa:dirty', {});   // secciones con cambios sin enviar
for (const s of SECTIONS) {
  listeners[s] = new Set();
  state[s] = load('casa:' + s, clone(DEFAULTS[s]));
  base[s] = load('casa:base:' + s, undefined);
}

const persist = (s) => save('casa:' + s, state[s]);
const saveBase = (s) => save('casa:base:' + s, base[s]);
function setDirty(s, v) {
  dirty[s] = v;
  save('casa:dirty', dirty);
  paintStatus();
}
const emit = (s) => listeners[s].forEach((fn) => fn(state[s]));

export function get(s) { return state[s]; }

export function set(s, value) {
  state[s] = value;
  persist(s);
  emit(s);
  setDirty(s, true);
  send(s);
}

// ---------- Quién usa este móvil (solo en este móvil, no se sincroniza) ----------
export const getUserName = () => localStorage.getItem('casa:user') || '';
export const setUserName = (n) => localStorage.setItem('casa:user', n.trim());

// Autoría: en estas secciones cada elemento guarda quién y cuándo lo creó y lo modificó.
const AUDITED = new Set(['batch', 'compra', 'tareas', 'calendario', 'almacen', 'mejoras']);

function stamp(s, prev, next) {
  if (!AUDITED.has(s) || !Array.isArray(next)) return next;
  const who = getUserName() || 'Sin nombre';
  const at = new Date().toISOString();
  const before = new Map((prev || []).map((i) => [i.id, i]));
  return next.map((i) => {
    const p = before.get(i.id);
    if (!p) return { ...i, createdBy: i.createdBy || who, createdAt: i.createdAt || at, updatedBy: who, updatedAt: at };
    if (eqItem(p, i)) return i;
    return { ...i, updatedBy: who, updatedAt: at };
  });
}

// Modifica una copia y la guarda. fn puede mutar la copia o devolver un valor nuevo.
export function update(s, fn) {
  const prev = state[s];
  const copy = clone(prev);
  const result = fn(copy);
  set(s, stamp(s, prev, result === undefined ? copy : result));
}

export function subscribe(s, fn) {
  listeners[s].add(fn);
  return () => listeners[s].delete(fn);
}

export const rooms = () => (state.config && state.config.rooms) || [];

// ---------- Estado de conexión ----------
let raw = { text: 'sin configurar', ok: false };
let status = raw;
const statusListeners = new Set();

export function onStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}
function paintStatus() {
  const pending = Object.values(dirty).some(Boolean);
  status = { text: raw.text + (pending && !raw.ok ? ' · cambios sin enviar' : ''), ok: raw.ok };
  statusListeners.forEach((fn) => fn(status));
}
function setStatus(text, ok = false) {
  raw = { text, ok };
  paintStatus();
}

// ---------- Conflictos ----------
const conflicts = {};                 // seccion -> { remote } mientras el usuario decide
const conflictListeners = new Set();
const pendingConflictEvents = [];

export function onConflict(fn) {
  conflictListeners.add(fn);
  pendingConflictEvents.splice(0).forEach(fn);
}
function raiseConflict(s, list) {
  const ev = { section: s, conflicts: list };
  if (conflictListeners.size) conflictListeners.forEach((fn) => fn(ev));
  else pendingConflictEvents.push(ev);
}

// choices: { [key]: 'local' | 'remote' }
export function resolve(s, choices) {
  const ctx = conflicts[s];
  if (!ctx) return;
  const { value, conflicts: still } = merge3(base[s], state[s], ctx.remote, choices);
  if (still.length) { raiseConflict(s, still); return; } // el broker cambió mientras decidías
  delete conflicts[s];
  applyMerged(s, value, ctx.remote);
}

function applyMerged(s, value, remote) {
  base[s] = remote;
  saveBase(s);
  state[s] = value;
  persist(s);
  emit(s);
  if (eq(value, remote)) setDirty(s, false);
  else { setDirty(s, true); send(s); }
}

// ---------- Configuración del broker (solo en este móvil) ----------
export function getConn() {
  return load('casa:conn', null) || load('mqttCfg', {}); // mqttCfg = prueba anterior
}
export function setConn(c) {
  save('casa:conn', c);
  connect();
}

// ---------- MQTT ----------
let client = null;
let lastError = '';
let reconnectTimer = null;
let waitTimer = null;
const awaiting = new Set();   // secciones de las que aún no ha llegado lo del broker tras conectar
const lastSent = {};          // último JSON enviado por sección (para reconocer el eco)

function send(s) {
  if (!client || !client.connected || conflicts[s] || awaiting.has(s) || !dirty[s]) return;
  const json = JSON.stringify(state[s]);
  lastSent[s] = json;
  client.publish(PREFIX + s, json, { qos: 1, retain: true }, (err) => {
    if (err) return;              // sigue "sin enviar"; se reintentará al reconectar
    base[s] = JSON.parse(json);
    saveBase(s);
    if (JSON.stringify(state[s]) === json) setDirty(s, false);
  });
}

function onMessage(topic, payload) {
  const s = topic.slice(PREFIX.length);
  if (!SECTIONS.includes(s)) return;
  const json = payload.toString();
  let remote;
  try { remote = JSON.parse(json); } catch { return; }
  awaiting.delete(s);

  if (json === lastSent[s]) {     // el broker tiene justo lo último que enviamos
    base[s] = remote;
    saveBase(s);
    if (JSON.stringify(state[s]) === json) setDirty(s, false);
    else send(s);                 // lo cambiado después es solo nuestro: se envía
    return;
  }
  if (conflicts[s]) { conflicts[s].remote = remote; return; }

  if (!dirty[s]) {                // sin cambios locales: manda el broker
    state[s] = remote; persist(s);
    base[s] = remote; saveBase(s);
    emit(s);
    return;
  }

  const { value, conflicts: list } = merge3(base[s], state[s], remote);
  if (list.length) {
    conflicts[s] = { remote };
    raiseConflict(s, list);
    return;
  }
  applyMerged(s, value, remote);
}

function scheduleReconnect(delay = RECONNECT_MS) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, delay);
}

export function connect() {
  clearTimeout(reconnectTimer);
  const c = getConn();
  if (!c.url) { setStatus('sin configurar'); return; }
  if (typeof mqtt === 'undefined') { setStatus('sin red'); return; }
  if (client) { client.removeAllListeners(); client.end(true); }

  // Reconexión manual con un cliente nuevo cada vez: así no se reenvían envíos antiguos
  // al volver la conexión; lo pendiente pasa siempre por la fusión.
  lastError = '';
  setStatus('conectando…');
  const cl = mqtt.connect(c.url, {
    username: c.user,
    password: c.pass,
    clientId: 'casa-' + Math.random().toString(16).slice(2, 10),
    reconnectPeriod: 0,
    connectTimeout: 10000,
    clean: true,
  });
  client = cl;

  cl.on('connect', () => {
    lastError = '';
    setStatus('conectado', true);
    SECTIONS.forEach((s) => awaiting.add(s));
    cl.subscribe(PREFIX + '+', { qos: 1 });
    clearTimeout(waitTimer);
    waitTimer = setTimeout(() => {            // secciones que el broker aún no tiene
      [...awaiting].forEach((s) => { awaiting.delete(s); send(s); });
    }, WAIT_RETAINED_MS);
  });
  cl.on('message', onMessage);
  cl.on('error', (err) => { lastError = err.message; setStatus('error: ' + lastError); });
  cl.on('close', () => {
    if (client !== cl) return;
    awaiting.clear();
    setStatus(lastError ? 'error: ' + lastError : 'desconectado');
    scheduleReconnect();
  });
}

// Reconectar en cuanto vuelve la red o la app pasa a primer plano.
const reconnectNow = () => { if (!client || !client.connected) scheduleReconnect(0); };
window.addEventListener('online', reconnectNow);
document.addEventListener('visibilitychange', () => { if (!document.hidden) reconnectNow(); });
