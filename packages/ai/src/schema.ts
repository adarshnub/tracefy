import type { TracefyDiagnosis } from "@tracefy/protocol";

export const diagnosisJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "rootCause", "evidence", "confidence", "suggestedFix", "diff", "testCommand", "risks"],
  properties: {
    summary: { type: "string" },
    rootCause: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "detail", "file", "line"],
        properties: {
          label: { type: "string" },
          detail: { type: "string" },
          file: { type: ["string", "null"] },
          line: { type: ["number", "null"] }
        }
      }
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    suggestedFix: { type: "string" },
    diff: { type: ["string", "null"] },
    testCommand: { type: ["string", "null"] },
    risks: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;

export function validateDiagnosis(value: unknown): TracefyDiagnosis {
  if (!value || typeof value !== "object") {
    throw new Error("Diagnosis must be an object");
  }

  const candidate = value as Partial<TracefyDiagnosis>;
  requireString(candidate.summary, "summary");
  requireString(candidate.rootCause, "rootCause");
  requireString(candidate.suggestedFix, "suggestedFix");
  if (!["low", "medium", "high"].includes(candidate.confidence ?? "")) {
    throw new Error("Diagnosis confidence must be low, medium, or high");
  }
  if (!Array.isArray(candidate.evidence) || candidate.evidence.length === 0) {
    throw new Error("Diagnosis must include at least one evidence item");
  }
  if (!Array.isArray(candidate.risks)) {
    throw new Error("Diagnosis risks must be an array");
  }

  return candidate as TracefyDiagnosis;
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Diagnosis ${field} must be a non-empty string`);
  }
}
