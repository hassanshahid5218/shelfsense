// Integration tests: real MCP client <-> Streamable HTTP <-> tools <-> services <-> MongoDB.
// Requires MONGODB_URI_TEST pointing at a THROWAWAY cluster. Uses a random shelfsense_test_* database
// that is dropped afterwards. Skipped (not failed) when MONGODB_URI_TEST is unset.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const URI = process.env.MONGODB_URI_TEST;
const skip = URI ? false : 'MONGODB_URI_TEST not set';
const TOKEN = 'test-token-0123456789abcdef';

test('MCP integration', { skip }, async (t) => {
  const { MongoClient } = await import('mongodb');
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const { createApp } = await import('../src/app.js');
  const { ensureIndexes } = await import('../src/db.js');
  const { TOOL_NAMES } = await import('../src/mcp.js');
  const { addDays, todayStr } = await import('../src/lib/dates.js');

  const dbName = `shelfsense_test_${crypto.randomBytes(4).toString('hex')}`;
  assert.ok(dbName.startsWith('shelfsense_test_'));
  const mongo = new MongoClient(URI);
  await mongo.connect();
  const db = mongo.db(dbName);
  await ensureIndexes(db);
  const app = createApp({ db, config: { clientOrigins: ['http://localhost:5173'], demoToken: TOKEN, timezone: 'UTC' } });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
  const today = todayStr();

  const connect = async (token = TOKEN) => {
    const transport = new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
    const client = new Client({ name: 'test', version: '1.0.0' });
    await client.connect(transport);
    return client;
  };
  const call = async (c, name, args = {}) => {
    const r = await c.callTool({ name, arguments: args });
    return { isError: !!r.isError, data: r.structuredContent, text: r.content?.[0]?.text };
  };

  try {
    await t.test('rejects missing/invalid token', async () => {
      assert.equal((await fetch(url, { method: 'POST' })).status, 401);
      await assert.rejects(() => connect('wrong'));
    });
    const c = await connect();
    await t.test('tool discovery registers all required tools', async () => {
      const { tools } = await c.listTools();
      const names = tools.map((x) => x.name);
      for (const n of TOOL_NAMES) assert.ok(names.includes(n), `missing ${n}`);
    });
    await t.test('add, merge batches, validation', async () => {
      const a = await call(c, 'add_pantry_item', { name: 'Milk', category: 'dairy', quantity: 1, unit: 'l', expiryDate: addDays(today, 2) });
      assert.ok(!a.isError);
      await call(c, 'add_pantry_item', { name: 'milk', category: 'dairy', quantity: 1, unit: 'l', expiryDate: addDays(today, 2) });
      await call(c, 'add_pantry_item', { name: 'Milk', category: 'dairy', quantity: 2, unit: 'l', expiryDate: addDays(today, 9) });
      const list = await call(c, 'list_pantry', { search: 'milk' });
      assert.equal(list.data.count, 2);
      assert.equal(list.data.items[0].quantity, 2);
      // Zod rejects negative quantities: SDK versions either throw or return isError.
      const bad = await c.callTool({ name: 'add_pantry_item', arguments: { name: 'x', category: 'dairy', quantity: -1, unit: 'l', expiryDate: today } }).catch(() => ({ isError: true }));
      assert.equal(bad.isError, true);
      assert.equal((await call(c, 'list_pantry', { search: 'x' })).data.count, 0);
    });
    await t.test('invalid and missing IDs', async () => {
      const badId = await c.callTool({ name: 'delete_pantry_item', arguments: { id: 'nope' } }).catch(() => ({ isError: true }));
      assert.equal(badId.isError, true);
      assert.match((await call(c, 'delete_pantry_item', { id: 'a'.repeat(24) })).text, /not_found/);
    });
    await t.test('mark_item_used drains earliest batch, never negative', async () => {
      const u = await call(c, 'mark_item_used', { name: 'milk', quantity: 1500, unit: 'ml' });
      assert.ok(!u.isError);
      const list = await call(c, 'list_pantry', { search: 'milk' });
      assert.ok(list.data.items.every((i) => i.quantity > 0));
      assert.equal(list.data.items.reduce((s, i) => s + i.quantity, 0), 3.5);
      assert.match((await call(c, 'mark_item_used', { name: 'milk', quantity: 10, unit: 'l' })).text, /insufficient_quantity/);
      assert.match((await call(c, 'mark_item_used', { name: 'milk', quantity: 1, unit: 'kg' })).text, /incompatible_unit/);
    });
    await t.test('recipes and shopping: missing, idempotent add, persistence', async () => {
      await call(c, 'add_pantry_item', { name: 'Eggs', category: 'dairy', quantity: 4, unit: 'pcs', expiryDate: addDays(today, 7) });
      const miss = await call(c, 'get_missing_ingredients', { recipeId: 'spinach-cheese-omelette' });
      assert.ok(miss.data.missing.length > 0);
      const a1 = await call(c, 'add_missing_recipe_ingredients', { recipeId: 'spinach-cheese-omelette' });
      const a2 = await call(c, 'add_missing_recipe_ingredients', { recipeId: 'spinach-cheese-omelette' });
      assert.ok(a1.data.changed > 0);
      assert.equal(a2.data.changed, 0);
      const c2 = await connect(); // brand-new client/connection => state came from MongoDB
      const shop = await call(c2, 'list_shopping_items');
      assert.equal(shop.data.count, miss.data.missing.length);
      const first = shop.data.items[0];
      assert.equal((await call(c2, 'toggle_shopping_item', { id: first.id })).data.item.done, true);
      assert.equal((await call(c2, 'clear_completed_shopping_items')).data.removedCount, 1);
      await c2.close();
    });
    await t.test('unknown recipe is a handled error', async () => {
      assert.match((await call(c, 'get_recipe_details', { recipeId: 'nope' })).text, /not_found/);
    });
    await c.close();
  } finally {
    server.close();
    await db.dropDatabase();
    await mongo.close();
  }
});
