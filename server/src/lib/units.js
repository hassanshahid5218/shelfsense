export const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'tbsp', 'tsp', 'cup', 'can', 'pack'];
export const CATEGORIES = ['produce', 'dairy', 'meat', 'grains', 'pantry', 'bakery', 'frozen', 'beverages', 'other'];

// Only same-dimension units convert. Everything else is its own family (never summed across).
const FAM = { g: ['mass', 1], kg: ['mass', 1000], ml: ['volume', 1], l: ['volume', 1000] };
const info = (u) => FAM[u] || [u, 1];

/** Convert q from one unit to another, or null if incompatible. */
export function convert(q, from, to) {
  const [ff, fm] = info(from);
  const [tf, tm] = info(to);
  return ff === tf ? (q * fm) / tm : null;
}
export const round = (n, d = 3) => {
  const p = 10 ** d;
  return Math.round((n + Number.EPSILON) * p) / p;
};
/** Normalised lookup key: lowercase, collapsed spaces, naive singular. */
export function nameKey(name) {
  let k = String(name).toLowerCase().trim().replace(/\s+/g, ' ');
  if (k.endsWith('ies') && k.length > 4) k = `${k.slice(0, -3)}y`;
  else if (k.endsWith('oes')) k = k.slice(0, -2);
  else if (k.endsWith('s') && !k.endsWith('ss') && !k.endsWith('us')) k = k.slice(0, -1);
  return k;
}
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
