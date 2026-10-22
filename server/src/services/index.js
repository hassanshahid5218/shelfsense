import { ObjectId } from 'mongodb';
import { ServiceError } from '../errors.js';
import { addDays, expiryStatus, daysBetween, isValidDateStr, todayStr, EXPIRING_DAYS } from '../lib/dates.js';
import { convert, escapeRegex, nameKey, round } from '../lib/units.js';
import { RECIPES, getRecipe } from '../lib/recipes.js';
import { evaluateRecipe, rankRecipes } from '../lib/matching.js';

const EPS = 1e-6;
const DEFAULT_PREFS = { dietary: [], cuisine: '', servings: 2 };

const oid = (id) => {
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id)) throw new ServiceError('invalid_id', 'Invalid ID format');
  return new ObjectId(id);
};
const isDup = (e) => e?.code === 11000;

export function createServices(db, { tz = 'UTC', today: todayFn } = {}) {
  const pantry = db.collection('pantry_items');
  const shop = db.collection('shopping_items');
  const prefsCol = db.collection('preferences');
  const today = todayFn || (() => todayStr(new Date(), tz));

  const decoratePantry = (d, t = today()) => ({
    id: String(d._id), name: d.name, category: d.category, quantity: round(d.quantity), unit: d.unit,
    expiryDate: d.expiryDate, daysUntilExpiry: daysBetween(t, d.expiryDate), status: expiryStatus(d.expiryDate, t),
    createdAt: d.createdAt, updatedAt: d.updatedAt
  });
  const decorateShop = (d) => ({ id: String(d._id), name: d.name, quantity: d.quantity, unit: d.unit, done: !!d.done, source: d.source || 'manual', createdAt: d.createdAt });

  // ---------- Pantry ----------
  const listPantry = async ({ search, category, status, sortBy = 'expiryDate', sortDir = 'asc' } = {}) => {
    const t = today();
    const q = {};
    if (search) q.name = { $regex: escapeRegex(search), $options: 'i' };
    if (category) q.category = category;
    if (status === 'expired') q.expiryDate = { $lt: t };
    else if (status === 'expiring-soon') q.expiryDate = { $gte: t, $lte: addDays(t, EXPIRING_DAYS) };
    else if (status === 'fresh') q.expiryDate = { $gt: addDays(t, EXPIRING_DAYS) };
    const field = { name: 'nameKey', expiryDate: 'expiryDate', quantity: 'quantity', category: 'category', createdAt: 'createdAt' }[sortBy] || 'expiryDate';
    const docs = await pantry.find(q).sort({ [field]: sortDir === 'desc' ? -1 : 1, nameKey: 1 }).toArray();
    return { today: t, count: docs.length, items: docs.map((d) => decoratePantry(d, t)) };
  };

  const addPantryItem = async ({ name, category, quantity, unit, expiryDate }) => {
    if (!isValidDateStr(expiryDate)) throw new ServiceError('invalid_date', 'expiryDate must be a valid YYYY-MM-DD date');
    const now = new Date();
    const key = nameKey(name);
    // Same name+unit+expiry merges into one batch atomically; different expiry = separate batch.
    const doc = await pantry.findOneAndUpdate(
      { nameKey: key, unit, expiryDate },
      { $inc: { quantity }, $set: { name: name.trim(), category, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true, returnDocument: 'after' }
    );
    return { item: decoratePantry(doc) };
  };

  const updatePantryItem = async ({ id, name, category, quantity, unit, expiryDate }) => {
    const _id = oid(id);
    if (expiryDate !== undefined && !isValidDateStr(expiryDate)) throw new ServiceError('invalid_date', 'expiryDate must be a valid YYYY-MM-DD date');
    const set = { updatedAt: new Date() };
    if (name !== undefined) { set.name = name.trim(); set.nameKey = nameKey(name); }
    for (const [k, v] of Object.entries({ category, quantity, unit, expiryDate })) if (v !== undefined) set[k] = v;
    if (Object.keys(set).length === 1) throw new ServiceError('no_changes', 'Provide at least one field to update');
    try {
      const doc = await pantry.findOneAndUpdate({ _id }, { $set: set }, { returnDocument: 'after' });
      if (!doc) throw new ServiceError('not_found', 'Pantry item not found');
      return { item: decoratePantry(doc) };
    } catch (e) {
      if (isDup(e)) throw new ServiceError('conflict', 'A batch with the same name, unit and expiry date already exists');
      throw e;
    }
  };

  const deletePantryItem = async ({ id }) => {
    const r = await pantry.findOneAndDelete({ _id: oid(id) });
    if (!r) throw new ServiceError('not_found', 'Pantry item not found');
    return { deleted: true, id, name: r.name };
  };

  const markItemUsed = async ({ name, quantity, unit }) => {
    const key = nameKey(name);
    const batches = await pantry.find({ nameKey: key }).sort({ expiryDate: 1 }).toArray();
    if (!batches.length) throw new ServiceError('not_found', `No "${name}" in the pantry`);
    const compat = batches.filter((b) => convert(1, unit, b.unit) !== null);
    if (!compat.length) throw new ServiceError('incompatible_unit', `"${name}" is stored in ${[...new Set(batches.map((b) => b.unit))].join(', ')}, which cannot be converted to ${unit}`);
    const total = compat.reduce((s, b) => s + convert(b.quantity, b.unit, unit), 0);
    if (total < quantity - EPS) throw new ServiceError('insufficient_quantity', `Only ${round(total)} ${unit} of ${name} available, cannot use ${quantity} ${unit}`);
    let remaining = quantity;
    for (const b of compat) {
      if (remaining <= EPS) break;
      const inReq = convert(b.quantity, b.unit, unit);
      const takeReq = Math.min(inReq, remaining);
      const take = round(convert(takeReq, unit, b.unit), 6);
      // Atomic guard: only decrement if enough stock is still there.
      const r = await pantry.findOneAndUpdate({ _id: b._id, quantity: { $gte: take - EPS } }, { $inc: { quantity: -take }, $set: { updatedAt: new Date() } }, { returnDocument: 'after' });
      if (!r) throw new ServiceError('conflict', 'Inventory changed while updating; please retry');
      remaining -= takeReq;
    }
    await pantry.deleteMany({ nameKey: key, quantity: { $lte: EPS } });
    const after = await pantry.find({ nameKey: key }).sort({ expiryDate: 1 }).toArray();
    return { used: { name, quantity, unit }, remainingBatches: after.map((d) => decoratePantry(d)) };
  };

  const getExpiringItems = async ({ days = EXPIRING_DAYS, includeExpired = true } = {}) => {
    const t = today();
    const range = { $lte: addDays(t, days) };
    if (!includeExpired) range.$gte = t;
    const docs = await pantry.find({ expiryDate: range }).sort({ expiryDate: 1, nameKey: 1 }).toArray();
    return { today: t, days, count: docs.length, items: docs.map((d) => decoratePantry(d, t)) };
  };

  const getPantrySummary = async () => {
    const t = today();
    const docs = await pantry.find({}).toArray();
    const items = docs.map((d) => decoratePantry(d, t));
    const byCategory = {};
    for (const i of items) byCategory[i.category] = (byCategory[i.category] || 0) + 1;
    const by = (s) => items.filter((i) => i.status === s);
    return {
      today: t,
      totalBatches: items.length,
      distinctIngredients: new Set(docs.map((d) => d.nameKey)).size,
      counts: { expired: by('expired').length, expiringSoon: by('expiring-soon').length, fresh: by('fresh').length },
      byCategory,
      expiringSoon: by('expiring-soon').sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
      expired: by('expired'),
      recentlyAdded: [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5)
    };
  };

  // ---------- Preferences ----------
  const getPreferences = async () => {
    const d = await prefsCol.findOne({ _id: 'default' });
    return { ...DEFAULT_PREFS, ...(d ? { dietary: d.dietary, cuisine: d.cuisine, servings: d.servings } : {}) };
  };
  const updatePreferences = async ({ dietary, cuisine, servings }) => {
    const set = { updatedAt: new Date() };
    if (dietary !== undefined) set.dietary = dietary;
    if (cuisine !== undefined) set.cuisine = cuisine;
    if (servings !== undefined) set.servings = servings;
    await prefsCol.updateOne({ _id: 'default' }, { $set: set, $setOnInsert: { createdAt: new Date() } }, { upsert: true });
    return { preferences: await getPreferences() };
  };

  // ---------- Recipes ----------
  const evalAll = async (servings) => {
    const [docs, prefs] = await Promise.all([pantry.find({}).toArray(), getPreferences()]);
    const t = today();
    const sv = servings || prefs.servings;
    const pool = RECIPES.filter((r) => prefs.dietary.every((d) => r.tags.includes(d)));
    return { prefs, evals: pool.map((r) => evaluateRecipe(r, docs, t, { servings: sv })), docs, t, sv };
  };

  const suggestRecipes = async ({ focus = 'all', maxMissing = 10, limit = 5, servings } = {}) => {
    const { prefs, evals } = await evalAll(servings);
    let list = evals.filter((e) => e.missingIngredients.length <= maxMissing);
    if (focus === 'expiring') list = list.filter((e) => e.expiringIngredients.length > 0);
    const ranked = rankRecipes(list, prefs.cuisine).slice(0, limit);
    return { focus, appliedPreferences: prefs, count: ranked.length, recipes: ranked };
  };

  const getRecipeDetails = async ({ recipeId, servings }) => {
    const recipe = getRecipe(recipeId);
    if (!recipe) throw new ServiceError('not_found', `Recipe "${recipeId}" not found`);
    const { docs, t, sv } = await evalAll(servings);
    return { recipe: { ...evaluateRecipe(recipe, docs, t, { servings: sv }), instructions: recipe.instructions } };
  };

  const getMissingIngredients = async ({ recipeId, servings }) => {
    const { recipe } = await getRecipeDetails({ recipeId, servings });
    return { recipeId, title: recipe.title, servings: recipe.servings, missing: recipe.missingIngredients, canCookNow: recipe.canCookNow };
  };

  // ---------- Shopping ----------
  const listShoppingItems = async () => {
    const docs = await shop.find({}).sort({ done: 1, createdAt: -1 }).toArray();
    const items = docs.map(decorateShop);
    return { count: items.length, open: items.filter((i) => !i.done).length, completed: items.filter((i) => i.done).length, items };
  };

  const upsertOpen = async ({ name, quantity, unit, source }, mode) => {
    const now = new Date();
    const update = { $set: { updatedAt: now, name: name.trim() }, $setOnInsert: { createdAt: now, source } };
    update[mode === 'max' ? '$max' : '$inc'] = { quantity };
    try {
      return await shop.findOneAndUpdate({ nameKey: nameKey(name), unit, done: false }, update, { upsert: true, returnDocument: 'after' });
    } catch (e) {
      if (isDup(e)) return shop.findOneAndUpdate({ nameKey: nameKey(name), unit, done: false }, update, { returnDocument: 'after' });
      throw e;
    }
  };

  const addShoppingItem = async ({ name, quantity = 1, unit = 'pcs' }) => {
    const doc = await upsertOpen({ name, quantity, unit, source: 'manual' }, 'inc');
    return { item: decorateShop(doc) };
  };

  const addMissingRecipeIngredients = async ({ recipeId, servings }) => {
    const { recipe } = await getRecipeDetails({ recipeId, servings });
    const added = [];
    for (const m of recipe.missingIngredients) {
      const existing = await shop.findOne({ nameKey: nameKey(m.name), unit: m.unit, done: false });
      if (existing && existing.quantity >= m.quantity - EPS) { added.push({ ...m, action: 'already_listed' }); continue; }
      // $max keeps this idempotent: re-running never inflates quantities.
      await upsertOpen({ name: m.name, quantity: m.quantity, unit: m.unit, source: `recipe:${recipeId}` }, 'max');
      added.push({ ...m, action: existing ? 'updated' : 'created' });
    }
    return { recipeId, title: recipe.title, added, changed: added.filter((a) => a.action !== 'already_listed').length };
  };

  const toggleShoppingItem = async ({ id }) => {
    try {
      const doc = await shop.findOneAndUpdate({ _id: oid(id) }, [{ $set: { done: { $not: ['$done'] }, updatedAt: '$$NOW' } }], { returnDocument: 'after' });
      if (!doc) throw new ServiceError('not_found', 'Shopping item not found');
      return { item: decorateShop(doc) };
    } catch (e) {
      if (isDup(e)) throw new ServiceError('conflict', 'An identical open item already exists; remove one first');
      throw e;
    }
  };
  const removeShoppingItem = async ({ id }) => {
    const r = await shop.findOneAndDelete({ _id: oid(id) });
    if (!r) throw new ServiceError('not_found', 'Shopping item not found');
    return { removed: true, id, name: r.name };
  };
  const clearCompletedShoppingItems = async () => ({ removedCount: (await shop.deleteMany({ done: true })).deletedCount });

  return {
    today, listPantry, addPantryItem, updatePantryItem, deletePantryItem, markItemUsed, getExpiringItems, getPantrySummary,
    getPreferences, updatePreferences, suggestRecipes, getRecipeDetails, getMissingIngredients,
    listShoppingItems, addShoppingItem, addMissingRecipeIngredients, toggleShoppingItem, removeShoppingItem, clearCompletedShoppingItems
  };
}
