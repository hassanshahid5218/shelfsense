// Idempotent, additive seed. Dates are relative to today. Never deletes data
// unless run with --reset --yes (explicit, local use only).
import { config, assertConfig } from './config.js';
import { connectDb } from './db.js';
import { addDays, todayStr } from './lib/dates.js';
import { nameKey } from './lib/units.js';
import { PANTRY_SEED } from './lib/seedData.js';
import { pathToFileURL } from 'node:url';

const SHOP_SEED = [['Coffee beans', 1, 'pack'], ['Dish soap', 1, 'pcs']];

async function main() {
  assertConfig();
  const { client, db } = await connectDb(config.mongoUri, config.dbName);
  try {
    if (process.argv.includes('--reset')) {
      if (!process.argv.includes('--yes')) throw new Error('--reset deletes data in DB "' + config.dbName + '". Re-run with --reset --yes to confirm.');
      for (const c of ['pantry_items', 'shopping_items', 'preferences']) await db.collection(c).deleteMany({});
      console.log('Collections cleared.');
    }
    const t = todayStr(new Date(), config.timezone);
    const now = new Date();
    let inserted = 0;
    for (const [name, category, quantity, unit, off] of PANTRY_SEED) {
      const seedKey = `seed:${nameKey(name)}:${unit}:${off}`;
      const r = await db.collection('pantry_items').updateOne(
        { seedKey },
        { $setOnInsert: { seedKey, name, nameKey: nameKey(name), category, quantity, unit, expiryDate: addDays(t, off), createdAt: now, updatedAt: now } },
        { upsert: true });
      inserted += r.upsertedCount;
    }
    for (const [name, quantity, unit] of SHOP_SEED) {
      const seedKey = `seed:${nameKey(name)}`;
      const r = await db.collection('shopping_items').updateOne({ seedKey },
        { $setOnInsert: { seedKey, name, nameKey: nameKey(name), quantity, unit, done: false, source: 'manual', createdAt: now, updatedAt: now } }, { upsert: true });
      inserted += r.upsertedCount;
    }
    await db.collection('preferences').updateOne({ _id: 'default' }, { $setOnInsert: { dietary: [], cuisine: '', servings: 2, createdAt: now, updatedAt: now } }, { upsert: true });
    console.log(`Seed complete in "${config.dbName}": ${inserted} new documents (existing data untouched).`);
  } finally { await client.close(); }
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });