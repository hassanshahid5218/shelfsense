import crypto from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcp.js';
import { createServices } from './services/index.js';

const safeEq = (a, b) => {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export function createApp({ db, config }) {
  const app = express();
  const svc = createServices(db, { tz: config.timezone });
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => (!origin || config.clientOrigins.includes(origin) ? cb(null, true) : cb(null, false)),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Mcp-Session-Id', 'Mcp-Protocol-Version', 'Last-Event-ID'],
    exposedHeaders: ['Mcp-Session-Id']
  }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    try { await db.command({ ping: 1 }); res.json({ status: 'ok', database: 'up' }); }
    catch { res.status(503).json({ status: 'degraded', database: 'down' }); }
  });

  const limiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false });
  const auth = (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!m || !safeEq(m[1], config.demoToken)) {
      return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: missing or invalid demo access token' }, id: null });
    }
    next();
  };

  // Stateless Streamable HTTP: a fresh server+transport per request, closed when the response ends.
  app.post('/mcp', limiter, auth, async (req, res) => {
    const server = createMcpServer(svc);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error('[mcp] request failed', e);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  });
  const notAllowed = (_req, res) => res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed (stateless server)' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);

  app.use((err, _req, res, _next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}
