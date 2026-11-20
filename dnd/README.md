# Sagas of Europe (/dnd)

## Run locally
    cp .env.example .env     # add OPENROUTER_API_KEY (optional; without it narration is templated)
    npm install
    npm test
    npm run dev:server       # terminal 1 (port 8787)
    npm run dev:client       # terminal 2, open http://localhost:5173/dnd/

## Production (next to your existing ritammisra.com root site)
    npm run build && npm start   # serves dist at /dnd, API at /dnd/api, /dnd-co redirects
Route only /dnd* and /dnd-co to this Node service. nginx example:
    location /dnd { proxy_pass http://127.0.0.1:8787; proxy_set_header Host $host; }
    location = /dnd-co { proxy_pass http://127.0.0.1:8787; }
Homepage tile on the root site: <a href="/dnd">Sagas of Europe</a>

## Env vars (server-only, never VITE_-prefixed)
OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL, DATABASE_URL, AI_BUDGET_TOKENS_GLOBAL, AI_BUDGET_TOKENS_PER_ROOM, PORT

## Add a country
Copy `iceland` in shared/countries.ts, fill regions/encounters, register in COUNTRIES. The id must equal the lowercased Natural Earth country name.
