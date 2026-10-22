# ShelfSense

**Waste less food. Cook smarter. Shop only what you need.**

ShelfSense tracks what is in your pantry, flags what is about to expire, suggests meals that use it up, and
turns missing ingredients into a shopping list, through a UI and a chat assistant that both talk to the backend
over the **Model Context Protocol (MCP)**.

> **Status honesty:** this README only states what the code does. See [Verification status](#verification-status)
> for exactly what was and was not executed. No live URL, screenshots, Alexa+ integration or certification are claimed.

## Problem and solution
Households throw away food they forgot about, then buy duplicates. ShelfSense keeps per-batch expiry dates, ranks
recipes by how much expiring food they use, shows exactly what is missing, and adds it to the shopping list without duplicates.

## Features
- **Dashboard**: real counts, expiring/expired lists, freshness chart, recent additions, meal ideas, shopping status.
- **Pantry**: add / edit / delete / search / filter / sort; separate batches per expiry date; expired / expiring-soon / fresh badges.
- **Meal planner**: 8 hand-written recipes, matched deterministically (not AI-generated). Shows instructions, servings, time, available vs missing.
- **Shopping list**: add, complete, remove, clear completed; recipe additions are idempotent (no duplicates).
- **Assistant**: deterministic intent router that invokes real MCP tools; shows a chip per tool call that actually finished. Works with no AI key.
- **Settings**: dietary restriction (vegetarian/vegan), preferred cuisine, default servings. Shared by all demo users (there are no accounts).

## Architecture
```
React UI ──► official MCP Client ──► Streamable HTTP  POST /mcp  (Bearer demo token)
                                          │
                                   MCP tools (Zod-validated)
                                          │
                                   shared service modules
                                          │
                                    MongoDB Atlas (db: shelfsense)
```
Details: [docs/architecture.md](docs/architecture.md). The server is **stateless** Streamable HTTP: each POST gets a fresh
server+transport, closed when the response ends. `GET/DELETE /mcp` return 405.

## Install
Requires Node 20+ and a MongoDB Atlas cluster.
```bash
npm install                      # installs both workspaces
cp server/.env.example server/.env
cp client/.env.example client/.env
```
### MongoDB Atlas setup
1. Create a free cluster, a database user, and allow your IP (Network Access).
2. Put the connection string in `server/.env` as `MONGODB_URI`. `DB_NAME` defaults to `shelfsense`.
3. `npm run seed` (collections `pantry_items`, `shopping_items`, `preferences`; indexes are created automatically).

## Environment variables
| Variable | Where | Purpose |
|---|---|---|
| `PORT` | server | HTTP port (default 3001) |
| `MONGODB_URI` | server | Atlas connection string (secret) |
| `DB_NAME` | server | Database name (default `shelfsense`) |
| `CLIENT_ORIGIN` | server | Comma-separated exact CORS origins; `*` is rejected |
| `DEMO_ACCESS_TOKEN` | server | Bearer secret, min 16 chars; server refuses to start without it |
| `APP_TIMEZONE` | server | IANA zone that defines "today" (e.g. `Asia/Karachi`) |
| `MONGODB_URI_TEST` | server | Optional throwaway DB for integration tests |
| `VITE_MCP_URL` | client | Public MCP endpoint URL (no secrets in client env) |

No AI-provider key is used or needed.

## Run
```bash
npm run seed        # idempotent; never deletes. `npm run seed -w server -- --reset --yes` clears the DB first (local only)
npm run dev         # server :3001 + client :5173
```
Open http://localhost:5173 and enter the value of `DEMO_ACCESS_TOKEN` on the access screen (held in `sessionStorage` for the tab only).

## Demo access mechanism
`/mcp` requires `Authorization: Bearer <DEMO_ACCESS_TOKEN>` on **every** request (including `initialize`), compared in constant time,
plus rate limiting (300/min), Helmet, explicit CORS, and a 100 KB body limit. The token is typed by the user at runtime, never baked
into the frontend bundle. This is a demo gate, **not** multi-user auth: all holders of the token share one dataset.

## Tests
```bash
npm test
```
- `server/test/logic.test.js`: dates/expiry, unit conversion, name normalisation, recipe matching, missing amounts, servings scaling, ranking, seed realism.
- `client/test/intent.test.js`: assistant intent parsing.
- `server/test/integration.test.js`: **real MCP client over HTTP against MongoDB**: auth rejection, tool discovery (all 16 required tools), batch merging,
  negative-quantity rejection, invalid/missing IDs, never-negative consumption, incompatible units, idempotent shopping adds, persistence across a fresh connection.
  Runs only when `MONGODB_URI_TEST` is set; uses a random `shelfsense_test_*` database and drops it afterwards. Never point it at real data.

## MCP Inspector
```bash
npm run dev:server
npx @modelcontextprotocol/inspector
```
In the Inspector choose transport **Streamable HTTP**, URL `http://localhost:3001/mcp`, and add header `Authorization: Bearer <DEMO_ACCESS_TOKEN>`.
Verify: (1) Connect succeeds (initialize); (2) *Tools → List* shows 16 required tools + `get_preferences`, `update_preferences`;
(3) call `get_pantry_summary`; (4) call `suggest_recipes {"focus":"expiring"}`; (5) call `delete_pantry_item {"id":"nope"}` and confirm a validation error;
(6) call `mark_item_used {"name":"milk","quantity":999,"unit":"l"}` and confirm `insufficient_quantity`; (7) connect without the header and confirm 401.

## Tools
Pantry: `list_pantry`, `add_pantry_item`, `update_pantry_item`, `delete_pantry_item`, `mark_item_used`, `get_expiring_items`, `get_pantry_summary`.
Recipes: `suggest_recipes`, `get_recipe_details`, `get_missing_ingredients`.
Shopping: `list_shopping_items`, `add_shopping_item`, `add_missing_recipe_ingredients`, `toggle_shopping_item`, `remove_shopping_item`, `clear_completed_shopping_items`.
Extras: `get_preferences`, `update_preferences`. Results use MCP `content` (JSON text) plus `structuredContent`; failures set `isError: true`.

## Data-integrity notes
- Dates are `YYYY-MM-DD` strings; "today" is computed in `APP_TIMEZONE`.
- Unique index on `(nameKey, unit, expiryDate)` merges identical batches atomically (`$inc` upsert).
- `mark_item_used` consumes earliest-expiring first, converts only within mass (g/kg) and volume (ml/l), and decrements with a `quantity >= take` guard so stock cannot go negative.
  Expired items are never counted as available for recipes. `pcs` is never mixed with weights.
- Inputs are typed by Zod (no operator objects reach MongoDB); search text is regex-escaped; IDs must be 24-hex.

## Deployment
- **Frontend (Vercel)**: root directory `client`, build `npm run build`, output `dist`, env `VITE_MCP_URL=https://<api-host>/mcp`. `client/vercel.json` handles SPA routing.
- **Backend (Render / Railway / Fly.io, any Node host with HTTPS)**: root `server`, start `npm start`, set the server env vars above. Set `CLIENT_ORIGIN` to the exact Vercel URL. Add the host's egress IPs (or 0.0.0.0/0 for a demo) to Atlas Network Access. Run `npm run seed` once.
- Serve only over HTTPS in public; keep `DEMO_ACCESS_TOKEN` and `MONGODB_URI` in the host's secret store.

## Alexa+ / hackathon status (not verified)
A locally working MCP server does **not** establish Alexa+ compatibility, and the official hackathon rules and Alexa+ track requirements
were **not checked** (no internet in the build environment). Before claiming anything, confirm against the official rules: required transport/protocol version,
public HTTPS endpoint, account linking / OAuth (the single shared bearer token here is not sufficient for per-user Alexa+ linking),
per-user data isolation, response-size/latency limits, and the testing/certification process. Nothing here claims native Alexa+ integration.

## Verification status
See the final report in the build conversation; summary kept in [docs/architecture.md](docs/architecture.md#verification).

## Hackathon: Alexa+ track
ShelfSense is a self-hosted MCP server (Streamable HTTP, protocol version 2025-11-25 verified)
with a web client that simulates the conversational layer. It is not a native Alexa+ skill, and
Alexa+ account linking and certification have not been tested.

Quick start: see Install / Run above. To test with the MCP Inspector, connect with transport
Streamable HTTP, URL http://localhost:3001/mcp, and a custom header
`Authorization: Bearer <DEMO_ACCESS_TOKEN>`.
Verified: initialize, tools/list (18 tools), tool calls, error handling, 401 without a token.