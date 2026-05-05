import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tracefyExportPaths, writeLatestContext } from "../src";
import type { ContextPacket } from "@tracefy/protocol";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => fs.rm(root, { recursive: true, force: true })));
  roots.length = 0;
});

describe("tracefy export store", () => {
  it("writes a redacted latest context packet", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tracefy-export-"));
    roots.push(root);

    const context: ContextPacket = {
      episodeId: "episode_test",
      createdAt: Date.now(),
      workspaceRoot: root,
      trigger: {
        id: "evt_test",
        kind: "browser.error",
        source: "browser",
        timestamp: Date.now(),
        message: "Request failed with apiKey=sk-test-secret",
        stack: "at App (src/App.tsx:1:1)"
      },
      timeline: [],
      relevantFiles: [],
      diagnostics: [],
      notes: ["token=abc123secret"]
    };

    await writeLatestContext(root, context);

    const text = await fs.readFile(tracefyExportPaths(root).latestContext, "utf8");
    expect(text).toContain("episode_test");
    expect(text).not.toContain("sk-test-secret");
    expect(text).not.toContain("abc123secret");
    expect(text).toContain("[REDACTED]");
  });
});
