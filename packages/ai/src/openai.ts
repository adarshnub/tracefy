import type { ContextPacket, TracefyDiagnosis } from "@tracefy/protocol";
import { diagnosisJsonSchema, validateDiagnosis } from "./schema";

export interface DiagnoseOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export interface TracefyChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const DEFAULT_DIAGNOSIS_MODEL = "gpt-5.2";
export const DEFAULT_PATCH_MODEL = "gpt-5.2-codex";
export const DEFAULT_SUMMARY_MODEL = "gpt-5-mini";

export async function diagnoseContext(
  context: ContextPacket,
  options: DiagnoseOptions = {}
): Promise<TracefyDiagnosis> {
  if (!options.apiKey) {
    return createFallbackDiagnosis(context);
  }

  const fetcher = options.fetchImpl ?? fetch;
  const response = await fetcher(options.endpoint ?? "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_DIAGNOSIS_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are Tracefy, a local-first debugging assistant. Diagnose only from the supplied evidence. Return a concrete root cause, confidence, and a patch diff when there is enough evidence. Never invent files or APIs."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(context, null, 2)
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "tracefy_diagnosis",
          strict: true,
          schema: diagnosisJsonSchema
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI diagnosis failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  const text = extractOutputText(json);
  return validateDiagnosis(JSON.parse(text));
}

export async function chatWithContext(
  context: ContextPacket | undefined,
  messages: TracefyChatMessage[],
  question: string,
  options: DiagnoseOptions = {}
): Promise<string> {
  if (!options.apiKey) {
    return "OpenAI is not configured yet. I can still show captured events and local context, but chat answers need `tracefy.openai.apiKey` or `OPENAI_API_KEY`.";
  }

  const fetcher = options.fetchImpl ?? fetch;
  const response = await fetcher(options.endpoint ?? "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.apiKey}`
    },
    body: JSON.stringify({
      model: options.model ?? DEFAULT_DIAGNOSIS_MODEL,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are Tracefy inside a developer IDE. Answer like a concise debugging partner. Use the supplied captured failures, code context, diagnostics, git diff, and prior chat. If code changes are needed, include a unified diff when you have enough evidence."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify(
                {
                  tracefyContext: context,
                  priorMessages: messages.slice(-12),
                  question
                },
                null,
                2
              )
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI chat failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  return extractOutputText(json);
}

export function extractOutputText(response: unknown): string {
  const maybe = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };

  if (typeof maybe.output_text === "string") {
    return maybe.output_text;
  }

  for (const item of maybe.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new Error("OpenAI response did not include output text");
}

export function createFallbackDiagnosis(context: ContextPacket): TracefyDiagnosis {
  const trigger = context.trigger;
  const triggerSummary = "message" in trigger ? trigger.message : "command" in trigger ? trigger.command : trigger.kind;
  const firstFile = context.relevantFiles[0] ?? context.activeFile;

  return {
    summary: `Tracefy captured a ${trigger.kind} failure${triggerSummary ? `: ${triggerSummary}` : "."}`,
    rootCause:
      "OpenAI is not configured, so this is a local fallback. The most likely root cause is near the captured failure output and the highest-ranked file evidence.",
    evidence: [
      {
        label: "Trigger",
        detail: JSON.stringify(trigger).slice(0, 1000),
        file: null,
        line: null
      },
      ...(firstFile
        ? [
            {
              label: "Relevant file",
              detail: firstFile.reason,
              file: firstFile.path,
              line: firstFile.startLine
            }
          ]
        : [])
    ],
    confidence: firstFile ? "medium" : "low",
    suggestedFix:
      "Set OPENAI_API_KEY for a model-backed diagnosis. Until then, inspect the trigger output, the active file, and the ranked snippets in the Tracefy panel.",
    diff: null,
    testCommand: null,
    risks: ["Fallback diagnosis cannot reason deeply across the codebase."]
  };
}
