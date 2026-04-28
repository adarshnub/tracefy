import { describe, expect, it } from "vitest";
import { EventBuffer, normalizeIncomingEvent } from "../src";

describe("events", () => {
  it("groups the latest failed terminal command into an episode", () => {
    const buffer = new EventBuffer();
    buffer.add(
      normalizeIncomingEvent({
        kind: "terminal.command.finished",
        source: "terminal",
        command: "npm run build",
        exitCode: 1,
        output: "Cannot find module './Widget'"
      })
    );

    expect(buffer.latestEpisode()?.trigger.kind).toBe("terminal.command.finished");
  });

  it("treats console.error as a diagnosable browser failure", () => {
    const buffer = new EventBuffer();
    buffer.add(
      normalizeIncomingEvent({
        kind: "browser.console",
        source: "browser",
        level: "error",
        message: "Tracefy browser test error",
        url: "https://example.com"
      })
    );

    expect(buffer.latestEpisode()?.trigger.kind).toBe("browser.console");
  });
});
