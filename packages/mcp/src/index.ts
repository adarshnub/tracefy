#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { callTracefyTool } from "./tools";

export { callTracefyTool, formatContextMarkdown } from "./tools";

export function createTracefyMcpServer(workspaceRoot: string): McpServer {
  const server = new McpServer({
    name: "tracefy",
    version: "0.1.0"
  });
  const registerTool = server.registerTool.bind(server) as (
    name: string,
    config: {
      title: string;
      description: string;
      inputSchema?: Record<string, unknown>;
    },
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ) => void;

  registerTool(
    "tracefy_latest_context",
    {
      title: "Tracefy Latest Context",
      description:
        "Read the latest redacted Tracefy context packet with consolidated browser, terminal, diagnostic, code, and git-diff evidence.",
      inputSchema: {
        rawJson: z.boolean().optional().describe("Return the raw ContextPacket JSON instead of compact Markdown.")
      }
    },
    async ({ rawJson }) => callTracefyTool(workspaceRoot, "tracefy_latest_context", { rawJson: Boolean(rawJson) })
  );

  registerTool(
    "tracefy_recent_events",
    {
      title: "Tracefy Recent Events",
      description: "Read recent Tracefy browser, terminal, diagnostic, workspace, and git events.",
      inputSchema: {
        limit: z.number().int().min(1).max(80).optional().describe("Maximum number of recent events to return."),
        rawJson: z.boolean().optional().describe("Return raw event JSON instead of compact Markdown.")
      }
    },
    async ({ limit, rawJson }) =>
      callTracefyTool(workspaceRoot, "tracefy_recent_events", {
        limit: typeof limit === "number" ? limit : undefined,
        rawJson: Boolean(rawJson)
      })
  );

  registerTool(
    "tracefy_latest_diagnosis",
    {
      title: "Tracefy Latest Diagnosis",
      description: "Read the latest Tracefy diagnosis, if a diagnosis has been run.",
      inputSchema: {
        rawJson: z.boolean().optional().describe("Return raw diagnosis JSON instead of compact Markdown.")
      }
    },
    async ({ rawJson }) => callTracefyTool(workspaceRoot, "tracefy_latest_diagnosis", { rawJson: Boolean(rawJson) })
  );

  return server;
}

async function main(): Promise<void> {
  const workspaceRoot = parseWorkspaceRoot(process.argv.slice(2));
  const server = createTracefyMcpServer(workspaceRoot);
  await server.connect(new StdioServerTransport());
}

function parseWorkspaceRoot(args: string[]): string {
  const index = args.indexOf("--workspace");
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return process.cwd();
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
