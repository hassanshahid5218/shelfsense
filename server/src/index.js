import { config, assertConfig } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

assertConfig();
const { client, db } = await connectDb(config.mongoUri, config.dbName);
const app = createApp({ db, config });
const server = app.listen(config.port, () => console.log(`ShelfSense MCP server on :${config.port}  (POST /mcp, GET /health)`));

let closing = false;
async function shutdown(sig) {
  if (closing) return;
  closing = true;
  console.log(`${sig} received, shutting down`);
  server.close(async () => { await client.close(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
