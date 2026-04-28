import { describe, expect, it } from "vitest";
import { extractOutputText, validateDiagnosis } from "../src";

describe("diagnosis schema", () => {
  it("accepts a valid diagnosis", () => {
    expect(
      validateDiagnosis({
        summary: "Build failed",
        rootCause: "Missing import",
        evidence: [{ label: "Terminal", detail: "Cannot find module", file: null, line: null }],
        confidence: "high",
        suggestedFix: "Restore the import",
        diff: null,
        testCommand: null,
        risks: []
      }).confidence
    ).toBe("high");
  });

  it("rejects missing evidence", () => {
    expect(() =>
      validateDiagnosis({
        summary: "Build failed",
        rootCause: "Missing import",
        evidence: [],
        confidence: "high",
        suggestedFix: "Restore the import",
        diff: null,
        testCommand: null,
        risks: []
      })
    ).toThrow(/evidence/);
  });

  it("extracts output text from responses output shape", () => {
    expect(
      extractOutputText({
        output: [{ content: [{ type: "output_text", text: "{\"summary\":\"ok\"}" }] }]
      })
    ).toBe("{\"summary\":\"ok\"}");
  });
});
