// Fusión a tres bandas: base (lo último sincronizado), local (este móvil) y remote (el broker).
// Se compara elemento a elemento por id. Si solo cambió un lado, gana ese lado.
// Si cambiaron los dos de forma distinta, es un conflicto y decide el usuario.

const sortKeys = (_k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {})
  : v);
export const stable = (v) => (v === undefined ? 'undefined' : JSON.stringify(v, sortKeys));
export const eq = (a, b) => stable(a) === stable(b);

const isItemList = (v) => Array.isArray(v) && v.every((i) => i && typeof i === 'object' && 'id' in i);

function mergeList(b, l, r, choices, prefix, conflicts) {
  const byId = (arr) => new Map((arr || []).map((i) => [i.id, i]));
  const B = byId(b); const L = byId(l); const R = byId(r);
  const ids = [...R.keys()];
  for (const id of L.keys()) if (!R.has(id)) ids.push(id);

  const out = [];
  for (const id of ids) {
    const bi = B.get(id); const li = L.get(id); const ri = R.get(id);
    const key = prefix + id;
    let pick;
    if (eq(li, bi)) pick = ri;                   // solo cambió el otro móvil (o nadie)
    else if (eq(ri, bi) || eq(li, ri)) pick = li; // solo cambió este móvil (o igual en ambos)
    else if (choices[key]) pick = choices[key] === 'local' ? li : ri;
    else { conflicts.push({ key, local: li, remote: ri }); pick = li; }
    if (pick) out.push(pick);
  }
  return out;
}

// Devuelve { value, conflicts }. choices: { [key]: 'local' | 'remote' }
export function merge3(base, local, remote, choices = {}) {
  const conflicts = [];
  if (Array.isArray(local) || Array.isArray(remote)) {
    return { value: mergeList(base, local, remote, choices, '', conflicts), conflicts };
  }
  const value = {};
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const k of keys) {
    const bk = base ? base[k] : undefined;
    const lk = local ? local[k] : undefined;
    const rk = remote ? remote[k] : undefined;
    let v;
    if (isItemList(lk) && isItemList(rk)) v = mergeList(bk, lk, rk, choices, k + ':', conflicts);
    else if (eq(lk, bk)) v = rk;
    else if (eq(rk, bk) || eq(lk, rk)) v = lk;
    else if (choices[k]) v = choices[k] === 'local' ? lk : rk;
    else { conflicts.push({ key: k, local: { id: k, value: lk }, remote: { id: k, value: rk } }); v = lk; }
    if (v !== undefined) value[k] = v;
  }
  return { value, conflicts };
}
