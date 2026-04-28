import { describe, expect, it } from "vitest";
import { buildContextPacket, normalizeIncomingEvent } from "../src";

describe("context packet", () => {
  it("builds context from a browser runtime error", () => {
    const event = normalizeIncomingEvent({
      kind: "browser.error",
      source: "browser",
      message: "TypeError: users.map is not a function",
      stack: "at UserList (src/UserList.tsx:12:4)"
    });

    const packet = buildContextPacket({
      events: [event],
      files: [
        {
          path: "src/UserList.tsx",
          language: "tsx",
          content: "export function UserList({ users }) {\n  return users.map((u) => u.name);\n}"
        }
      ],
      diagnostics: [],
      gitDiff: "diff --git a/src/UserList.tsx b/src/UserList.tsx"
    });

    expect(packet?.trigger.kind).toBe("browser.error");
    expect(packet?.relevantFiles[0].path).toBe("src/UserList.tsx");
  });
});
