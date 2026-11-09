// Casa · Tareas — PWA mínima con estado compartido vía MQTT.
// El broker guarda la lista como mensaje "retained": hace de base de datos provisional.

const TOPIC = 'casa/todos/lista';

const $ = (id) => document.getElementById(id);
let client = null;
let todos = JSON.parse(localStorage.getItem('todos') || '[]');

// ---------- Configuración (se guarda solo en el móvil, nunca en Git) ----------
function loadCfg() {
  return JSON.parse(localStorage.getItem('mqttCfg') || '{}');
}

function fillCfgForm() {
  const cfg = loadCfg();
  $('cfg-url').value = cfg.url || '';
  $('cfg-user').value = cfg.user || '';
  $('cfg-pass').value = cfg.pass || '';
  if (!cfg.url) $('settings').open = true;
}

$('cfg-form').addEventListener('submit', (e) => {
  e.preventDefault();
  localStorage.setItem('mqttCfg', JSON.stringify({
    url: $('cfg-url').value.trim(),
    user: $('cfg-user').value.trim(),
    pass: $('cfg-pass').value,
  }));
  $('settings').open = false;
  connect();
});

// ---------- MQTT ----------
function setStatus(text, ok = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('ok', ok);
}

function connect() {
  const cfg = loadCfg();
  if (!cfg.url) { setStatus('sin configurar'); return; }
  if (typeof mqtt === 'undefined') { setStatus('sin red (mqtt.js no cargó)'); return; }
  if (client) client.end(true);

  client = mqtt.connect(cfg.url, {
    username: cfg.user,
    password: cfg.pass,
    clientId: 'casa-pwa-' + Math.random().toString(16).slice(2, 10),
    reconnectPeriod: 3000,
    clean: true,
  });

  client.on('connect', () => {
    setStatus('conectado', true);
    client.subscribe(TOPIC, { qos: 1 });
  });
  client.on('reconnect', () => setStatus('reconectando…'));
  client.on('close', () => setStatus('desconectado'));
  client.on('error', (err) => setStatus('error: ' + err.message));

  client.on('message', (topic, payload) => {
    if (topic !== TOPIC) return;
    try {
      const data = JSON.parse(payload.toString());
      if (Array.isArray(data)) {
        todos = data;
        saveLocal();
        render();
      }
    } catch (_) { /* mensaje no válido: se ignora */ }
  });
}

// Publica la lista completa como retained → el broker la recuerda para quien se conecte después.
function commit() {
  saveLocal();
  render();
  if (client && client.connected) {
    client.publish(TOPIC, JSON.stringify(todos), { qos: 1, retain: true });
  }
}

function saveLocal() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

// ---------- UI ----------
function render() {
  const list = $('list');
  list.innerHTML = '';
  for (const t of todos) {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = t.done;
    cb.addEventListener('change', () => { t.done = cb.checked; commit(); });

    const span = document.createElement('span');
    span.textContent = t.text; // textContent: evita inyectar HTML

    const del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'del';
    del.addEventListener('click', () => {
      todos = todos.filter((x) => x.id !== t.id);
      commit();
    });

    li.append(cb, span, del);
    list.append(li);
  }
}

$('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('new-todo').value.trim();
  if (!text) return;
  todos.push({ id: Date.now().toString(36), text, done: false });
  $('new-todo').value = '';
  commit();
});

// ---------- Arranque ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
fillCfgForm();
render();
connect();
