import { describe, expect, it } from "vitest";
import { redactObject, redactText } from "../src";

describe("redaction", () => {
  it("redacts common secret strings", () => {
    const result = redactText("Authorization: Bearer sk-testtoken1234567890 api_key=abc123");
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("abc123");
  });

  it("redacts sensitive object keys", () => {
    const result = redactObject({ token: "abc", nested: { cookie: "session=1" } });
    expect(result).toEqual({ token: "[REDACTED]", nested: { cookie: "[REDACTED]" } });
  });
});
