#!/usr/bin/env node
import "dotenv/config";
import chalk from "chalk";
import { connectMcp } from "./mcp-client.js";
import { runResearch } from "./agent.js";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: npm run ask -- "your research question"');
  process.exit(1);
}

// All progress goes to stderr so the final report on stdout stays clean
// (you can pipe `npm run ask -- "..." 2>/dev/null > report.md`).
const log = (msg: string) => console.error(chalk.dim(`  · ${msg}`));

console.error(chalk.bold.cyan(`\n🔎 Researching: ${question}\n`));

const mcp = await connectMcp();
console.error(
  chalk.dim(`  connected to xsaved-mcp — ${mcp.anthropicTools.length} tools available\n`)
);

try {
  const report = await runResearch(question, mcp, log);
  console.error(chalk.bold("\n── Report ──\n"));
  console.log(report);
} finally {
  await mcp.close();
}
