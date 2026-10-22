import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, expiryStatus, isValidDateStr, todayStr } from '../src/lib/dates.js';
import { convert, nameKey, round } from '../src/lib/units.js';
import { RECIPES } from '../src/lib/recipes.js';
import { evaluateRecipe, rankRecipes } from '../src/lib/matching.js';
import { PANTRY_SEED } from '../src/lib/seedData.js';

const T = '2026-10-21';
const seedItems = (today = T) => PANTRY_SEED.map(([name, category, quantity, unit, off]) => ({ name, category, quantity, unit, expiryDate: addDays(today, off) }));

test('date validation', () => {
  assert.ok(isValidDateStr('2026-02-28'));
  assert.ok(!isValidDateStr('2026-02-30'));
  assert.ok(!isValidDateStr('26-1-1'));
  assert.ok(!isValidDateStr(null));
});
test('date arithmetic and status', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-10-21', '2026-10-24'), 3);
  assert.equal(expiryStatus('2026-10-20', T), 'expired');
  assert.equal(expiryStatus('2026-10-21', T), 'expiring-soon');
  assert.equal(expiryStatus('2026-10-24', T), 'expiring-soon');
  assert.equal(expiryStatus('2026-10-25', T), 'fresh');
  assert.match(todayStr(new Date(), 'Asia/Karachi'), /^\d{4}-\d{2}-\d{2}$/);
  // timezone changes the calendar date
  assert.equal(todayStr(new Date('2026-10-21T22:00:00Z'), 'UTC'), '2026-10-21');
  assert.equal(todayStr(new Date('2026-10-21T22:00:00Z'), 'Asia/Karachi'), '2026-10-22');
});
test('unit conversion never mixes dimensions', () => {
  assert.equal(convert(1, 'l', 'ml'), 1000);
  assert.equal(convert(500, 'g', 'kg'), 0.5);
  assert.equal(convert(1, 'kg', 'ml'), null);
  assert.equal(convert(1, 'pcs', 'g'), null);
  assert.equal(convert(2, 'can', 'can'), 2);
  assert.equal(convert(2, 'can', 'pack'), null);
  assert.equal(round(0.1 + 0.2), 0.3);
});
test('nameKey normalises plurals and case', () => {
  assert.equal(nameKey('  Tomatoes '), 'tomato');
  assert.equal(nameKey('Eggs'), 'egg');
  assert.equal(nameKey('Berries'), 'berry');
  assert.equal(nameKey('Hummus'), 'hummus');
  assert.equal(nameKey('Cheddar   Cheese'), 'cheddar cheese');
});
test('recipe matching: have vs missing, unit conversion, expired excluded', () => {
  const omelette = RECIPES.find((r) => r.id === 'spinach-cheese-omelette');
  const e = evaluateRecipe(omelette, seedItems(), T);
  assert.ok(e.canCookNow);
  assert.deepEqual(e.expiringIngredients, ['spinach']);
  const pancakes = evaluateRecipe(RECIPES.find((r) => r.id === 'banana-oat-pancakes'), seedItems(), T);
  assert.equal(pancakes.canCookNow, false);
  assert.deepEqual(pancakes.missingIngredients, [{ name: 'banana', quantity: 2, unit: 'pcs' }]); // bananas are expired
  const frittata = evaluateRecipe(RECIPES.find((r) => r.id === 'potato-onion-frittata'), seedItems(), T);
  assert.ok(frittata.ingredients.find((i) => i.name === 'potato').have); // 1 kg covers 300 g
});
test('partial quantity produces a precise missing amount', () => {
  const items = [{ name: 'Spinach', quantity: 40, unit: 'g', expiryDate: '2026-10-25' }];
  const e = evaluateRecipe(RECIPES[0], items, T);
  assert.deepEqual(e.missingIngredients.find((m) => m.name === 'spinach'), { name: 'spinach', quantity: 60, unit: 'g' });
});
test('servings scale needed quantities', () => {
  const e = evaluateRecipe(RECIPES[0], seedItems(), T, { servings: 4 });
  assert.equal(e.ingredients.find((i) => i.name === 'eggs').needed, 8);
});
test('ranking prioritises expiring ingredients', () => {
  const ranked = rankRecipes(RECIPES.map((r) => evaluateRecipe(r, seedItems(), T)));
  assert.ok(ranked[0].expiringIngredients.length >= ranked[ranked.length - 1].expiringIngredients.length);
  assert.ok(ranked[0].expiringIngredients.length > 0);
});
test('seed data is realistic: mix of expired, expiring, fresh', () => {
  const st = seedItems().map((i) => expiryStatus(i.expiryDate, T));
  for (const s of ['expired', 'expiring-soon', 'fresh']) assert.ok(st.includes(s), s);
});
test('every recipe ingredient unit is valid and quantities positive', () => {
  for (const r of RECIPES) for (const i of r.ingredients) assert.ok(i.quantity > 0 && i.unit && i.name, r.id);
});
