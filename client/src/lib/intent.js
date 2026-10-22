// Deterministic intent routing (no AI key needed). Pure and unit-tested.
const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 };
const UNIT_ALIASES = {
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l', ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  g: 'g', gram: 'g', grams: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  piece: 'pcs', pieces: 'pcs', pc: 'pcs', pcs: 'pcs', tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup', can: 'can', cans: 'can', pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack'
};

export function parseNumber(tok) {
  if (tok == null) return null;
  const t = tok.toLowerCase();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return t in NUM_WORDS ? NUM_WORDS[t] : null;
}

export function parseUsed(text) {
  const m = /\bi\s+(?:have\s+)?(?:just\s+)?(?:used|consumed|finished|ate|drank|cooked with)\s+(?:up\s+)?(.+?)[.!?\s]*$/i.exec(text);
  if (!m) return null;
  let toks = m[1].split(/\s+/).filter((t) => !['about', 'around', 'approximately'].includes(t.toLowerCase()));
  let quantity = null;
  // "250g" or "2kg" glued together
  const glued = /^(\d+(?:\.\d+)?)([a-z]+)$/i.exec(toks[0] || '');
  if (glued && UNIT_ALIASES[glued[2].toLowerCase()]) toks = [glued[1], glued[2], ...toks.slice(1)];
  const q = parseNumber(toks[0]);
  if (q !== null) { quantity = q; toks = toks.slice(1); }
  let unit = null;
  if (toks[0] && UNIT_ALIASES[toks[0].toLowerCase()]) { unit = UNIT_ALIASES[toks[0].toLowerCase()]; toks = toks.slice(1); }
  if (toks[0]?.toLowerCase() === 'of') toks = toks.slice(1);
  if (['the', 'my'].includes(toks[0]?.toLowerCase())) toks = toks.slice(1);
  const name = toks.join(' ').trim();
  if (!name) return { clarify: 'What did you use? For example: "I used 250 g of rice".' };
  if (quantity === null) return { clarify: `How much ${name} did you use? For example: "I used 2 ${name}" or "I used 500 g of ${name}".` };
  if (quantity <= 0) return { clarify: 'The quantity must be greater than zero.' };
  return { name, quantity, unit: unit || 'pcs', assumedUnit: !unit };
}

function resolveRecipe(text, ctx) {
  const recipes = ctx.lastRecipes || [];
  const lower = text.toLowerCase();
  const hit = recipes.find((r) => lower.includes(r.title.toLowerCase()));
  if (hit) return hit.id;
  if (ctx.selectedRecipeId) return ctx.selectedRecipeId;
  if (recipes.length === 1) return recipes[0].id;
  return null;
}

/** @returns {{intent:string, [k:string]:any}} */
export function parseIntent(text, ctx = {}) {
  const t = text.trim();
  const lower = t.toLowerCase();
  if (!t) return { intent: 'empty' };

  const used = parseUsed(t);
  if (used) return used.clarify ? { intent: 'clarify', message: used.clarify } : { intent: 'used', ...used };

  if (/\badd\b.*\bmissing\b|\bmissing\b.*\b(to|on)\b.*\bshopping\b/.test(lower)) {
    const recipeId = resolveRecipe(t, ctx);
    return recipeId ? { intent: 'add_missing', recipeId } : { intent: 'clarify', message: 'Which recipe? Ask "What can I cook tonight?" and pick one first, or name the recipe.' };
  }
  if (/\bmissing\b|\bwhat do i need\b|\bwhat (?:else )?do i need to buy\b/.test(lower)) {
    const recipeId = resolveRecipe(t, ctx);
    return recipeId ? { intent: 'missing', recipeId } : { intent: 'clarify', message: 'Which recipe do you mean? Ask "What can I cook tonight?" and pick one first, or name the recipe.' };
  }
  if (/shopping|grocery list|groceries/.test(lower)) return { intent: 'shopping' };
  if (/\b(cook|dinner|lunch|breakfast|tonight|meal|recipe|make)\b/.test(lower)) {
    return { intent: 'cook', focus: /expir|going bad|spoil|use up|soon/.test(lower) ? 'expiring' : 'all' };
  }
  if (/expir|going bad|spoil|use up/.test(lower)) {
    const m = /(\d+|one|two|three|four|five|six|seven|ten)\s+days?/.exec(lower);
    const days = /\btoday\b/.test(lower) ? 0 : /\bweek\b/.test(lower) ? 7 : m ? parseNumber(m[1]) : 3;
    return { intent: 'expiring', days };
  }
  if (/pantry|what do i have|inventory|in stock/.test(lower)) return { intent: 'pantry' };
  return { intent: 'help' };
}
