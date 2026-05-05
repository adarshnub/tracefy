import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { normalizeIncomingEvent, tracefyExportPaths, writeLatestContext, writeLatestDiagnosis } from "../../core/src";
import type { ContextPacket } from "@tracefy/protocol";
import { afterEach, describe, expect, it } from "vitest";
import { callTracefyTool } from "../src";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("Tracefy MCP tools", () => {
  it("returns compact latest context markdown", async () => {
    const root = await createFixtureWorkspace();
    const result = await callTracefyTool(root, "tracefy_latest_context");

    expect(result.content[0].text).toContain("# Tracefy Latest Context");
    expect(result.content[0].text).toContain("TypeError: users.map is not a function");
    expect(result.content[0].text).toContain("src/UserList.tsx");
  });

  it("returns recent events with limit support", async () => {
    const root = await createFixtureWorkspace();
    const result = await callTracefyTool(root, "tracefy_recent_events", { limit: 1 });

    expect(result.content[0].text).toContain("# Tracefy Recent Events");
    expect(result.content[0].text.match(/browser\.error/g)?.length).toBe(1);
  });

  it("returns the latest diagnosis", async () => {
    const root = await createFixtureWorkspace();
    const result = await callTracefyTool(root, "tracefy_latest_diagnosis");

    expect(result.content[0].text).toContain("# Tracefy Latest Diagnosis");
    expect(result.content[0].text).toContain("Guard users before mapping");
  });
});

async function createFixtureWorkspace(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "tracefy-mcp-"));
  roots.push(root);

  const event = normalizeIncomingEvent(
    {
      kind: "browser.error",
      source: "browser",
      message: "TypeError: users.map is not a function",
      stack: "at UserList (src/UserList.tsx:12:4)"
    },
    root
  );

  const context: ContextPacket = {
    episodeId: "episode_test",
    createdAt: Date.now(),
    workspaceRoot: root,
    trigger: event,
    timeline: [event],
    activeFile: {
      path: "src/UserList.tsx",
      language: "tsx",
      startLine: 1,
      endLine: 3,
      reason: "Active editor when diagnosis was requested",
      content: "export function UserList({ users }) {\n  return users.map((u) => u.name);\n}"
    },
    relevantFiles: [],
    diagnostics: [],
    notes: ["Fixture context"]
  };

  await writeLatestContext(root, context);
  await writeLatestDiagnosis(root, {
    summary: "Guard users before mapping",
    rootCause: "The component assumes users is always an array.",
    evidence: [],
    confidence: "high",
    suggestedFix: "Normalize users to an empty array before rendering.",
    diff: null,
    testCommand: "npm test",
    risks: []
  });

  const paths = tracefyExportPaths(root);
  await fs.appendFile(paths.events, `${JSON.stringify(event)}\n`, "utf8");

  return root;
}
