import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type Anthropic from "@anthropic-ai/sdk";

// --- The agent's connection to the xsaved-mcp server ------------------------
//
// This is the "connect the 3 systems" seam. The agent is an MCP *client*: it
// spawns the xsaved-mcp server as a subprocess (exactly like Claude Desktop
// does), lists its tools, and calls them. xsaved-mcp forwards to the xsaved-rag
// HTTP service, which queries Postgres. So:
//
//   research-agent (MCP client) → xsaved-mcp (MCP server) → xsaved-rag (HTTP) → Postgres
//
// No data is mocked and no search logic is re-implemented — the agent reuses
// the real tools we already built.

export interface McpConnection {
  /** The live MCP client — call `.callTool({name, arguments})` to run a tool. */
  client: Client;
  /** The server's tools, already converted to Anthropic's tool format. */
  anthropicTools: Anthropic.Tool[];
  close: () => Promise<void>;
}

export async function connectMcp(): Promise<McpConnection> {
  const serverPath = resolve(
    process.env.MCP_SERVER_PATH ?? "../xsaved-mcp/dist/index.js"
  );

  // Launch the MCP server as a child process and talk to it over stdio.
  // We pass RAG_API_URL through so the server can reach the rag service.
  const transport = new StdioClientTransport({
    command: process.execPath, // the current `node` binary
    args: [serverPath],
    env: {
      ...(process.env as Record<string, string>),
      RAG_API_URL: process.env.RAG_API_URL ?? "http://localhost:8790",
    },
  });

  const client = new Client({ name: "xsaved-research-agent", version: "0.1.0" });
  await client.connect(transport); // runs the MCP handshake

  // Ask the server what it can do, then translate MCP tool schemas → the shape
  // Claude's API expects. They're nearly identical: name, description, and the
  // JSON Schema for inputs (MCP calls it `inputSchema`, Anthropic `input_schema`).
  const { tools } = await client.listTools();
  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  return { client, anthropicTools, close: () => client.close() };
}
