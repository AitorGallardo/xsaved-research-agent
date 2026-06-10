# How to run & use the Research Agent

The agent answers a question by **driving the whole stack you already built**. It
is an MCP client of `xsaved-mcp`, which calls `xsaved-rag`, which queries Postgres:

```
your question → research-agent (the loop) → xsaved-mcp → HTTP → xsaved-rag → Postgres (pgvector + FTS)
                                                                                        │
            cited report  ◄────────────────────────────────────────────────────────────┘
```

So before you run the agent, the engine underneath it has to be up.

**Prereq:** OrbStack (Docker) running, and an `ANTHROPIC_API_KEY`.

## Terminal 1 — start the RAG engine (leave it running)

```bash
cd xsaved-rag
docker compose up -d --wait   # Postgres + pgvector
npm run db:migrate            # first time only — creates the tables
npm run index                 # first time only — embeds the bookmarks (~$0.0002)
npm run serve                 # http://localhost:8790 — LEAVE THIS RUNNING
```

## One-time — build the MCP server the agent spawns

The agent launches the **built** `dist/index.js`, so build it once (and rebuild
after any change to `xsaved-mcp`):

```bash
cd xsaved-mcp && npm run build
```

## Terminal 2 — run the agent

```bash
cd xsaved-research-agent
npm install
cp .env.example .env          # set ANTHROPIC_API_KEY (MCP_SERVER_PATH/RAG_API_URL default fine)

npm run ask -- "Summarize everything I've saved about prompt caching, with sources"
```

More examples (see `IDEAS.md` for the full list):

```bash
npm run ask -- "Build a reading order to learn about AI agents from my bookmarks, easiest first"
npm run ask -- "What does @elonmusk come up for in my bookmarks? Group by theme."
npm run ask -- "What recurring ideas appear across my mindset and startup bookmarks?"
```

Useful flags:

```bash
# cheaper/faster while iterating (default is Opus 4.8):
AGENT_MODEL=claude-haiku-4-5 npm run ask -- "..."

# save a clean report — progress goes to stderr, the report to stdout:
npm run ask -- "..." 2>/dev/null > report.md
```

## Watching what's happening

You get the full trace across two terminals:

- **Agent terminal (Terminal 2)** shows the loop *and* the MCP server's logs
  (the agent spawns it, so its output appears inline):

  ```
    · tool: hybrid_search_bookmarks({"query":"discipline focus","limit":20})
  [xsaved-mcp] 12:22:35 PM → hybrid_search_bookmarks("discipline focus", limit=20)
  [xsaved-mcp] 12:22:35 PM   ✓ hybrid_search_bookmarks(...) (678ms)
    · tool: get_bookmark({"id":"1974388248689479875"})
    · done after 3 turn(s)
  ```

- **rag terminal (Terminal 1)** shows the searches hitting the engine:

  ```
  12:22:35 PM GET /search?...&strategy=hybrid 200 678ms → 20 hits [hybrid] "discipline focus"
  ```

So you can literally watch one question fan out into searches and come back as a report.

## If it breaks

- Tool says **"could not reach xsaved-rag service"** → Terminal 1 isn't running (`npm run serve`).
- **"Cannot find module .../xsaved-mcp/dist/index.js"** → you didn't build the MCP server (`cd xsaved-mcp && npm run build`), or `MCP_SERVER_PATH` is wrong.
- **`adaptive thinking is not supported on this model`** → you set `AGENT_MODEL` to Haiku/an older model *and* an older build; pull latest (the agent now gates adaptive thinking on model support).
- **`401`/auth error** → `ANTHROPIC_API_KEY` missing or invalid in `.env`.
- **"Reached the 12-turn limit"** → the question was too broad; narrow it (the loop is capped at `MAX_TURNS` so it can't run away).
