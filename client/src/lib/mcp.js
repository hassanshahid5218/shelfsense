// Genuine MCP client: official SDK + Streamable HTTP transport. No REST shims.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const MCP_URL = import.meta.env.VITE_MCP_URL || 'http://localhost:3001/mcp';
let client = null;
let transport = null;

/** Initialize the session (MCP handshake) and discover tools. */
export async function connect(token) {
  await disconnect();
  const t = new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers: { Authorization: `Bearer ${token}` } } });
  const c = new Client({ name: 'shelfsense-web', version: '1.0.0' });
  try {
    await c.connect(t);
    const { tools } = await c.listTools();
    client = c;
    transport = t;
    return tools;
  } catch (e) {
    await t.close().catch(() => {});
    throw e;
  }
}
export async function disconnect() {
  const t = transport;
  client = null;
  transport = null;
  if (t) await t.close().catch(() => {});
}
export const isAuthError = (e) => /401|unauthori[sz]ed/i.test(e?.message || '');

/**
 * Call a real MCP tool. If `trace` (array) is passed, an entry is pushed only after the
 * call actually finishes, so the UI can never show a fabricated tool call.
 */
export async function callTool(name, args = {}, trace) {
  if (!client) throw new Error('Not connected to the MCP server');
  const started = performance.now();
  let ok = false;
  try {
    const res = await client.callTool({ name, arguments: args });
    const text = res.content?.find((c) => c.type === 'text')?.text;
    if (res.isError) throw new Error(text || 'Tool call failed');
    ok = true;
    return res.structuredContent ?? (text ? JSON.parse(text) : null);
  } finally {
    trace?.push({ name, args, ok, ms: Math.round(performance.now() - started) });
  }
}
if (typeof window !== 'undefined') window.addEventListener('beforeunload', () => { transport?.close(); });
