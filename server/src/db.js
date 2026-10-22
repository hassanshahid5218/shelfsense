import { MongoClient } from 'mongodb';

export async function connectDb(uri, dbName) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  await ensureIndexes(db);
  return { client, db };
}

export async function ensureIndexes(db) {
  await db.collection('pantry_items').createIndexes([
    { key: { nameKey: 1, unit: 1, expiryDate: 1 }, unique: true, name: 'batch_unique' },
    { key: { expiryDate: 1 }, name: 'expiry' },
    { key: { seedKey: 1 }, unique: true, partialFilterExpression: { seedKey: { $type: 'string' } }, name: 'seed_key' }
  ]);
  await db.collection('shopping_items').createIndexes([
    { key: { nameKey: 1, unit: 1 }, unique: true, partialFilterExpression: { done: false }, name: 'open_item_unique' },
    { key: { seedKey: 1 }, unique: true, partialFilterExpression: { seedKey: { $type: 'string' } }, name: 'seed_key' }
  ]);
}
