# Architecture

```
client/  React + Vite + Tailwind        src/lib/mcp.js (official Client + StreamableHTTPClientTransport)
server/  Express                         src/app.js     (/health, POST /mcp, auth, CORS, limits)
         MCP server                      src/mcp.js     (registerTool + Zod schemas, error mapping)
         Services                        src/services/index.js (all business logic + Mongo ops)
         Pure logic (no deps)            src/lib/{dates,units,matching,recipes,seedData}.js
         MongoDB                         src/db.js      (connect + indexes)
```

**Request flow:** UI → `callTool(name,args)` → SDK client → `POST /mcp` with Bearer token → auth middleware → new `McpServer` +
`StreamableHTTPServerTransport` (stateless) → tool handler → service → MongoDB → `{content, structuredContent}` → UI.

**Why stateless:** no session affinity, trivially scalable and serverless-friendly; each request is fully authenticated.

**Assistant:** `client/src/lib/intent.js` maps text to an intent; the page then calls real tools and renders only returned data.
A tool-call chip is added only after the call settles. Ambiguous input (no recipe in context, missing quantity) returns a clarifying question, not an action.

**Collections:** `pantry_items {name,nameKey,category,quantity,unit,expiryDate,createdAt,updatedAt}`,
`shopping_items {name,nameKey,quantity,unit,done,source,createdAt,updatedAt}`, `preferences {_id:'default',dietary,cuisine,servings}`.

## Verification
Recorded in the final build report; integration tests require `MONGODB_URI_TEST`.
