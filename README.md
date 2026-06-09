# XSaved Research Agent

An **autonomous research agent** over a Twitter/X bookmark corpus. You ask a question; it searches your bookmarks across multiple tool calls **on its own**, then writes a **cited report**.

```bash
npm run ask -- "What have I saved about discipline, focus, or hard work?"
```

> *"## Key Ideas on Discipline, Focus, and Hard Work*
> *1. Pay Yourself First [1974388248689479875] — DHH argues you must protect your own meaningful work first…*
> *…*
> *Sources: [1974388248689479875], [2033571479665746287], …"*

It produced that by calling `hybrid_search_bookmarks`, then `get_bookmark` four times to read the strongest hits, then synthesizing — **a 3-turn agentic loop, fully autonomous.**

---

## What it is (and the pattern it teaches)

This is the **agentic tool-use loop** — the pattern behind every modern AI agent (Claude Code, Cursor, …):

```
ask Claude → it requests a tool → run the tool → return the result → repeat → until it answers
```

It's hand-rolled with the Anthropic SDK (no agent framework) — the loop *is* the skill. The whole thing is ~15 lines of real logic in `src/agent.ts`.

---

## How it connects to the other projects (no mocked data)

The agent doesn't re-implement search or mock a corpus. It's an **MCP client** of the `xsaved-mcp` server — exactly like Claude Desktop — so it reuses the real tools end-to-end:

```
your question
   │
   ▼  (the agentic loop — src/agent.ts)
research-agent  ── is an MCP client of ──►  xsaved-mcp  ── HTTP ──►  xsaved-rag  ──►  Postgres
   ▲                                        (the tools)            (the search)    (pgvector + FTS)
   └────────── cited report ◄───────────────────────────────────────────────────────────────────
```

Four systems, one data path, zero duplication. Add a better search to rag and the agent gets it for free; add a tool to mcp and the agent discovers it automatically.

---

## Architecture

| File | Role |
|---|---|
| `src/cli.ts` | Entry point — takes the question, prints the report (progress → stderr, report → stdout). |
| `src/mcp-client.ts` | Spawns `xsaved-mcp`, lists its tools, converts them to Anthropic's tool format. The bridge. |
| `src/agent.ts` | The agentic loop: call Claude → run requested tools via MCP → feed results back → repeat. |

Engineering choices worth noting:

- **Hand-rolled manual loop** — so cost control, error handling, and the `tool_use` → `tool_result` round-trip are explicit and yours.
- **Adaptive thinking** where the model supports it (Opus 4.6/4.7/4.8, Sonnet 4.6); omitted on Haiku (which rejects it).
- **Prompt caching** on the system prompt — it's resent every loop iteration, so it's marked cacheable.
- **Bounded cost** — `MAX_TURNS` ceiling, `max_tokens` cap, and a swappable model (`AGENT_MODEL`).
- **Graceful tool errors** — a failed tool returns `is_error: true` so Claude can react instead of the loop crashing.
- **Citations** — every claim is tagged with the `[bookmark_id]` it came from; the report ends with a Sources list.

---

## Usage

The agent drives `xsaved-mcp`, which talks to `xsaved-rag`, so the rag service must be running.

```bash
# 1. Start the rag engine (separate terminal) — see ../xsaved-rag
cd ../xsaved-rag && docker compose up -d --wait && npm run serve   # http://localhost:8790

# 2. Build the MCP server the agent will spawn
cd ../xsaved-mcp && npm run build

# 3. Run the agent
cd ../xsaved-research-agent
npm install
cp .env.example .env          # set ANTHROPIC_API_KEY
npm run ask -- "Summarize what I've saved about AI agents, with sources"

# cheaper/faster while iterating:
AGENT_MODEL=claude-haiku-4-5 npm run ask -- "..."
# clean report to a file (progress goes to stderr):
npm run ask -- "..." 2>/dev/null > report.md
```

Example questions:
- *"What have I bookmarked about prompt caching?"*
- *"Build a reading order to learn MCP from my saved bookmarks."*
- *"What does @elonmusk show up for in my bookmarks?"*

---

## Stack

`@anthropic-ai/sdk` (the agent's brain + tool-use loop) · `@modelcontextprotocol/sdk` (MCP client) · `dotenv` · `chalk` · `tsx`

No database and no search code — those belong to `xsaved-rag`, reached through `xsaved-mcp`.

---

## What this project is part of

This is the **research agent** (the "consumer") in a sequenced AI Engineer roadmap covering the Claude API, MCP, RAG, agentic patterns, multi-agent orchestration, and evaluation — all built around the same XSaved bookmark corpus.

See [../ROADMAP.md](../ROADMAP.md), and the engine + doorway it consumes: [../xsaved-rag/README.md](../xsaved-rag/README.md) and [../xsaved-mcp/README.md](../xsaved-mcp/README.md).
