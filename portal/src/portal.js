// Shared core: runs a tool, writes its receipt, shapes the MCP result.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOLS } from "./tools.js";
import { createLedger } from "./receipts.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const RECEIPTS_FILE = path.resolve(process.env.PORTAL_RECEIPTS || path.join(here, "..", "receipts.jsonl"));
const ledger = createLedger(RECEIPTS_FILE);

export const log = (...parts) => process.stderr.write(`[portal] ${parts.join(" ")}\n`);

export async function callTool(name, rawArgs) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) {
    const error = new Error(`Unknown tool ${name}`);
    error.status = 404;
    throw error;
  }
  const args = z.object(tool.input).strict().parse(rawArgs ?? {});
  let result;
  let ok = true;
  try {
    result = await tool.run(args);
  } catch (error) {
    ok = false;
    result = { error: error.message, status: error.status ?? null };
  }
  const { __image, ...data } = (result && typeof result === "object" && !Array.isArray(result)) ? result : { value: result };
  const receipt = ledger.append(name, args, data, ok);
  log(`${name} ${ok ? "ok" : "error"} receipt=${receipt.hash.slice(0, 12)}`);
  return { ok, data, image: __image, receipt };
}

export function buildMcpServer() {
  const server = new McpServer({ name: "fraymus-portal", version: "0.1.0" });
  for (const tool of TOOLS) {
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.input }, async (args) => {
      const { ok, data, image, receipt } = await callTool(tool.name, args);
      const content = [{ type: "text", text: JSON.stringify({ ...data, receipt: receipt.hash }, null, 2) }];
      if (image) content.push({ type: "image", data: image.data, mimeType: image.mimeType });
      return { content, isError: !ok };
    });
  }
  return server;
}
