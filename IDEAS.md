# Ideas — what this unlocks

Two halves: what the **research agent** can do for you today, and how the same
engine could power the real **XSaved** product (Chrome extension, Mac, iOS).

---

## Part 1 — What the agent can do right now

**Setup** (two terminals):

```bash
# Terminal 1 — the search engine
cd xsaved-rag && docker compose up -d --wait && npm run serve   # http://localhost:8790

# Terminal 2 — build the MCP bridge the agent drives
cd xsaved-mcp && npm run build
```

Then from `xsaved-research-agent`, run any of these. (Default model is Opus 4.8;
set `AGENT_MODEL=claude-haiku-4-5` for cheap/fast iteration. Add
`2>/dev/null > report.md` to save a clean report.)

### 1. Theme synthesis — "what have I saved about X?"

```bash
npm run ask -- "Summarize everything I've saved about prompt caching, with sources"
```

Searches semantically, reads the strongest hits, writes a **cited** summary. The
core "ask your bookmarks" move.

### 2. Build a learning path — turn saved links into a curriculum

```bash
npm run ask -- "Build a reading order to learn about AI agents from my bookmarks, easiest first"
```

Finds the relevant saves and **sequences** them. Multi-step reasoning, not just search.

### 3. Author lens — what a person shows up for

```bash
npm run ask -- "What does @elonmusk come up for in my bookmarks? Group by theme."
```

Uses the `author` filter + clustering. "What do I keep saving from this person?"

### 4. Cross-cutting connections — find the throughline

```bash
npm run ask -- "What recurring ideas appear across my mindset and startup bookmarks? Where do they agree or conflict?"
```

Runs several searches from different angles and compares them — the most
"agentic" one, since it decides how many searches it needs.

---

## Part 2 — How the real product could benefit

**The unlock:** this isn't a toy — it's a **service** (`xsaved-rag` HTTP API)
wrapped by a **protocol** (`xsaved-mcp`). One engine, many clients: the Chrome
extension, the Mac app, the iOS app, and even Claude Desktop can all call the
same thing. Build the intelligence once; every surface gets it.

> **One prerequisite (honest):** today the engine runs on the local demo corpus.
> To power the real product it needs each user's **actual bookmark text** in the
> backend — exactly the `POST /api/bookmarks/sync` (premium, opt-in) step already
> in the roadmap. Once that's flowing, every idea below runs on real per-user data.

### 1. "Ask your bookmarks" (everywhere)

Augment the keyword search box with natural-language Q&A: *"that thread about
Postgres indexes I saved last month."* Today's search is exact-word (BM25/Dexie);
semantic + hybrid retrieval finds it by **meaning**. Ships to all three surfaces
from the same `/search` endpoint — **iOS and Mac get good search for free**, no
native search code.

### 2. Weekly digest agent

A scheduled agent clusters what you saved this week, summarizes the themes, and
resurfaces forgotten gems (*"3 saves about hiring you never reopened"*). The
research loop on a cron — lands as an iOS push or an extension card.

### 3. Auto-tagging on save

When a user saves a tweet, suggest tags/topics from **their own taxonomy** (this
is `xsaved-topics` wired live). Turns the save dialog from manual typing into a
one-tap accept.

### 4. "Related bookmarks" / connection graph

Every bookmark is embedded as a vector, so *"you also saved these related ones"*
comes for free (nearest-neighbor by meaning). Powers a "related" rail on a card
or a graph view — a strong fit for the iOS masonry/visual surface.

### 5. Cross-device + assistant reach via MCP

The MCP server lets a user point **Claude Desktop** (or any AI client) at *their*
bookmarks: *"draft a thread from what I saved about X."* A premium differentiator
no keyword bookmark app has — your data becomes usable by the AI tools people
already live in, across Mac/iOS/web, from one backend.

---

**The throughline:** `xsaved-rag` = the brain, `xsaved-mcp` = the universal plug,
the research agent = proof you can build features on top. The same three pieces
serve a CLI today and the whole product tomorrow — just pointed at real data
instead of the demo file.
