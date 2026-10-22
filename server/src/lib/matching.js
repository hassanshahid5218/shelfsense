import { daysBetween, EXPIRING_DAYS } from './dates.js';
import { convert, nameKey, round } from './units.js';

/**
 * Deterministic recipe matching. Expired items never count as available.
 * Units only combine within the same dimension (g/kg, ml/l); 'pcs' never mixes with 'g'.
 */
export function evaluateRecipe(recipe, pantryItems, today, { servings } = {}) {
  const sv = servings || recipe.servings;
  const factor = sv / recipe.servings;
  const usable = pantryItems.filter((i) => i.quantity > 0 && daysBetween(today, i.expiryDate) >= 0);
  const ingredients = recipe.ingredients.map((ing) => {
    const key = nameKey(ing.name);
    const needed = round(ing.quantity * factor, 2);
    let avail = 0;
    let expiringSoon = false;
    for (const b of usable) {
      if (nameKey(b.name) !== key) continue;
      const c = convert(b.quantity, b.unit, ing.unit);
      if (c === null) continue;
      avail += c;
      if (daysBetween(today, b.expiryDate) <= EXPIRING_DAYS) expiringSoon = true;
    }
    const have = avail >= needed - 1e-9;
    return { name: ing.name, unit: ing.unit, needed, available: round(avail, 2), missing: have ? 0 : round(needed - avail, 2), have, expiringSoon: expiringSoon && avail > 0 };
  });
  const haveCount = ingredients.filter((i) => i.have).length;
  return {
    id: recipe.id, title: recipe.title, cuisine: recipe.cuisine, tags: recipe.tags,
    cookTimeMinutes: recipe.cookTimeMinutes, servings: sv,
    matchPercent: Math.round((haveCount / ingredients.length) * 100),
    canCookNow: haveCount === ingredients.length,
    ingredients,
    availableIngredients: ingredients.filter((i) => i.have).map((i) => i.name),
    missingIngredients: ingredients.filter((i) => !i.have).map((i) => ({ name: i.name, quantity: i.missing, unit: i.unit })),
    expiringIngredients: ingredients.filter((i) => i.expiringSoon).map((i) => i.name)
  };
}

export function rankRecipes(evals, preferredCuisine = '') {
  const cu = preferredCuisine.toLowerCase();
  const bonus = (e) => (cu && e.cuisine.toLowerCase() === cu ? 1 : 0);
  return [...evals].sort((a, b) =>
    b.expiringIngredients.length - a.expiringIngredients.length ||
    b.matchPercent - a.matchPercent ||
    bonus(b) - bonus(a) ||
    a.missingIngredients.length - b.missingIngredients.length ||
    a.title.localeCompare(b.title));
}
