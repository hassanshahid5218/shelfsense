import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, parseUsed } from '../src/lib/intent.js';

const ctx = { lastRecipes: [{ id: 'a', title: 'Spinach Omelette' }, { id: 'b', title: 'French Toast' }] };
test('pantry / shopping / expiring', () => {
  assert.equal(parseIntent("What is in my pantry?").intent, 'pantry');
  assert.equal(parseIntent('Show my shopping list').intent, 'shopping');
  assert.deepEqual(parseIntent('What expires within three days?'), { intent: 'expiring', days: 3 });
  assert.deepEqual(parseIntent('what expires within 5 days'), { intent: 'expiring', days: 5 });
});
test('cook intents', () => {
  assert.deepEqual(parseIntent('What can I cook tonight?'), { intent: 'cook', focus: 'all' });
  assert.deepEqual(parseIntent('What can I cook using ingredients that will expire soon?'), { intent: 'cook', focus: 'expiring' });
});
test('missing ingredients need a resolvable recipe', () => {
  assert.equal(parseIntent('What ingredients am I missing for this recipe?').intent, 'clarify');
  assert.deepEqual(parseIntent('What am I missing for the French Toast?', ctx), { intent: 'missing', recipeId: 'b' });
  assert.deepEqual(parseIntent('Add missing ingredients to my shopping list', { selectedRecipeId: 'a' }), { intent: 'add_missing', recipeId: 'a' });
  assert.equal(parseIntent('Add missing ingredients to my shopping list', ctx).intent, 'clarify');
});
test('used parsing', () => {
  assert.deepEqual(parseIntent('I used one liter of milk'), { intent: 'used', name: 'milk', quantity: 1, unit: 'l', assumedUnit: false });
  assert.deepEqual(parseUsed('I used 250g of rice'), { name: 'rice', quantity: 250, unit: 'g', assumedUnit: false });
  assert.deepEqual(parseUsed('I used 3 eggs'), { name: 'eggs', quantity: 3, unit: 'pcs', assumedUnit: true });
  assert.equal(parseIntent('I used milk').intent, 'clarify');
  assert.equal(parseIntent('I used 0 eggs').intent, 'clarify');
});
test('unknown falls back to help', () => assert.equal(parseIntent('sing me a song').intent, 'help'));
