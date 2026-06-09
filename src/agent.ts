import Anthropic from "@anthropic-ai/sdk";
import type { McpConnection } from "./mcp-client.js";

// --- The agentic loop -------------------------------------------------------
//
// This is THE pattern behind every modern AI agent (Claude Code, Cursor, …):
//   ask Claude → it asks for a tool → we run the tool → give it the result →
//   repeat → until Claude says it's done.
//
// We hand-roll it (no framework) because the loop IS the skill worth learning.

const SYSTEM_PROMPT = `You are a research assistant for the user's personal Twitter/X bookmark collection.

You have tools to search their bookmarks (keyword, semantic, hybrid), fetch one by ID, get corpus stats, and list tags. Answer using ONLY what the user has actually saved.

How to work:
1. Plan which searches will surface the relevant bookmarks. Prefer hybrid_search_bookmarks for general questions; use the author/tag/since/until filters to narrow when helpful.
2. Search from a few angles if one query isn't enough. Fetch full bookmarks with get_bookmark when a snippet looks important.
3. Stop searching once you have enough — do not loop forever.
4. Write a concise, structured answer.

Rules:
- Ground every claim in retrieved bookmarks. Cite them inline by their [bookmark_id].
- If the bookmarks don't contain enough to answer, say so plainly. Never invent.
- Prefer paraphrase over long quotes. End with a short "Sources:" list of the bookmark IDs you used.`;

const MAX_TURNS = 12; // hard cost ceiling — the loop can't run away

export async function runResearch(
  question: string,
  mcp: McpConnection,
  log: (msg: string) => void
): Promise<string> {
  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const model = process.env.AGENT_MODEL ?? "claude-opus-4-8";

  // Adaptive thinking exists only on Opus 4.6/4.7/4.8 and Sonnet 4.6 — Haiku and
  // older models reject it. Enable it where supported; omit it otherwise.
  const adaptiveThinking =
    /opus-4-[678]/.test(model) || model === "claude-sonnet-4-6";

  // The conversation. The API is stateless, so we resend the whole history
  // every turn — appending Claude's replies and our tool results as we go.
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: question },
  ];

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      // let Claude decide when/how much to think (where the model supports it)
      ...(adaptiveThinking ? { thinking: { type: "adaptive" as const } } : {}),
      // System prompt + tools are identical every turn → cache them so we don't
      // pay to re-read them each loop. (Only kicks in above the model's cache
      // minimum; harmless otherwise.)
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      tools: mcp.anthropicTools,
      messages,
    });

    // ALWAYS append the full response (text + thinking + tool_use blocks) —
    // dropping any of it corrupts the next turn.
    messages.push({ role: "assistant", content: response.content });

    // Surface any text Claude wrote this turn (its reasoning-out-loud / progress).
    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        log(`thinking: ${block.text.trim().slice(0, 100)}…`);
      }
    }

    // If Claude didn't ask for a tool, it's done — return its answer.
    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      log(`done after ${turn} turn(s)`);
      return text || "(no answer produced)";
    }

    // Claude asked for one or more tools. Run each via the MCP server and
    // collect the results into a single user turn.
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      log(`tool: ${block.name}(${JSON.stringify(block.input)})`);
      try {
        const result = await mcp.client.callTool({
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
        const text = (result.content as Array<{ type: string; text?: string }>)
          .filter((c) => c.type === "text")
          .map((c) => c.text ?? "")
          .join("\n");
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: text,
          is_error: Boolean(result.isError),
        });
      } catch (e) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `Tool failed: ${(e as Error).message}`,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return `Reached the ${MAX_TURNS}-turn limit without finishing. Try a narrower question.`;
}
