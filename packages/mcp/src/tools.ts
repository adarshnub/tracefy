import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ContextPacket, TracefyDiagnosis, TracefyEvent } from "@tracefy/protocol";

export type TracefyToolName = "tracefy_latest_context" | "tracefy_recent_events" | "tracefy_latest_diagnosis";

export interface ToolCallResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface LatestContextArgs {
  rawJson?: boolean;
}

export interface RecentEventsArgs {
  limit?: number;
  rawJson?: boolean;
}

export interface LatestDiagnosisArgs {
  rawJson?: boolean;
}

export async function callTracefyTool(
  workspaceRoot: string,
  name: TracefyToolName,
  args: LatestContextArgs | RecentEventsArgs | LatestDiagnosisArgs = {}
): Promise<ToolCallResult> {
  if (name === "tracefy_latest_context") {
    const rawJson = Boolean((args as LatestContextArgs).rawJson);
    return textResult(await latestContext(workspaceRoot, rawJson));
  }

  if (name === "tracefy_recent_events") {
    const options = args as RecentEventsArgs;
    return textResult(await recentEvents(workspaceRoot, options.limit, Boolean(options.rawJson)));
  }

  if (name === "tracefy_latest_diagnosis") {
    const rawJson = Boolean((args as LatestDiagnosisArgs).rawJson);
    return textResult(await latestDiagnosis(workspaceRoot, rawJson));
  }

  return {
    content: [{ type: "text", text: `Unknown Tracefy tool: ${name}` }],
    isError: true
  };
}

async function latestContext(workspaceRoot: string, rawJson: boolean): Promise<string> {
  const context = await readJsonFile<ContextPacket>(tracefyExportPaths(workspaceRoot).latestContext);
  if (!context) {
    return noDataMessage("latest context", workspaceRoot);
  }

  return rawJson ? JSON.stringify(context, null, 2) : formatContextMarkdown(context);
}

async function recentEvents(workspaceRoot: string, limit = 20, rawJson: boolean): Promise<string> {
  const safeLimit = Math.max(1, Math.min(Math.floor(limit || 20), 80));
  const events = await readJsonlFile<TracefyEvent>(tracefyExportPaths(workspaceRoot).events);
  const recent = events.slice(-safeLimit);

  if (recent.length === 0) {
    return noDataMessage("recent events", workspaceRoot);
  }

  if (rawJson) {
    return JSON.stringify(recent, null, 2);
  }

  return [
    "# Tracefy Recent Events",
    "",
    ...recent.map((event) => `- ${formatTime(event.timestamp)} ${event.kind}: ${eventSummary(event)}`)
  ].join("\n");
}

async function latestDiagnosis(workspaceRoot: string, rawJson: boolean): Promise<string> {
  const diagnosis = await readJsonFile<TracefyDiagnosis>(tracefyExportPaths(workspaceRoot).latestDiagnosis);
  if (!diagnosis) {
    return noDataMessage("latest diagnosis", workspaceRoot);
  }

  if (rawJson) {
    return JSON.stringify(diagnosis, null, 2);
  }

  return [
    "# Tracefy Latest Diagnosis",
    "",
    `Summary: ${diagnosis.summary}`,
    `Confidence: ${diagnosis.confidence}`,
    "",
    "## Root Cause",
    diagnosis.rootCause,
    "",
    "## Suggested Fix",
    diagnosis.suggestedFix,
    diagnosis.testCommand ? `\n## Verify\n${diagnosis.testCommand}` : "",
    diagnosis.risks.length ? `\n## Risks\n${diagnosis.risks.map((risk) => `- ${risk}`).join("\n")}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatContextMarkdown(context: ContextPacket): string {
  const files = [context.activeFile, ...context.relevantFiles].filter(Boolean);

  return [
    "# Tracefy Latest Context",
    "",
    `Episode: ${context.episodeId}`,
    `Created: ${formatTime(context.createdAt)}`,
    `Workspace: ${context.workspaceRoot ?? "unknown"}`,
    "",
    "## Trigger",
    `${context.trigger.kind}: ${eventSummary(context.trigger)}`,
    "",
    "## Timeline",
    ...context.timeline.slice(-25).map((event) => `- ${formatTime(event.timestamp)} ${event.kind}: ${eventSummary(event)}`),
    context.diagnostics.length ? "\n## Diagnostics" : "",
    ...context.diagnostics
      .slice(0, 20)
      .map((diagnostic) => `- ${diagnostic.severity} ${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.message}`),
    files.length ? "\n## Selected Code Context" : "",
    ...files.map((snippet) =>
      [
        `### ${snippet!.path}:${snippet!.startLine}`,
        snippet!.reason,
        "```" + (snippet!.language ?? ""),
        snippet!.content.slice(0, 6000),
        "```"
      ].join("\n")
    ),
    context.gitDiff ? "\n## Git Diff\n```diff\n" + context.gitDiff.slice(0, 8000) + "\n```" : "",
    context.notes.length ? "\n## Notes\n" + context.notes.map((note) => `- ${note}`).join("\n") : ""
  ]
    .filter((part) => part !== "")
    .join("\n");
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }
    throw error;
  }
}

async function readJsonlFile<T>(filePath: string): Promise<T[]> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if (isMissingFile(error)) {
      return [];
    }
    throw error;
  }
}

function textResult(text: string): ToolCallResult {
  return { content: [{ type: "text", text }] };
}

function noDataMessage(label: string, workspaceRoot: string): string {
  return `Tracefy has no ${label} for ${workspaceRoot}. Start watching and reproduce a browser, terminal, or diagnostic failure first.`;
}

function eventSummary(event: TracefyEvent): string {
  if ("message" in event && event.message) {
    return trimInline(event.message);
  }
  if ("command" in event) {
    const suffix = "exitCode" in event && event.exitCode !== undefined ? ` exited ${event.exitCode}` : "";
    return trimInline(`${event.command}${suffix}`);
  }
  if ("diagnostics" in event) {
    return `${event.diagnostics.length} diagnostic${event.diagnostics.length === 1 ? "" : "s"}`;
  }
  if ("path" in event) {
    return event.path;
  }
  if ("diff" in event) {
    return trimInline(event.diff);
  }
  return event.kind;
}

function trimInline(value: string): string {
  return value.replace(/\s+/g, " ").slice(0, 500);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function tracefyExportPaths(workspaceRoot: string): { latestContext: string; latestDiagnosis: string; events: string } {
  const dir = path.join(workspaceRoot, ".tracefy");
  return {
    latestContext: path.join(dir, "latest-context.json"),
    latestDiagnosis: path.join(dir, "latest-diagnosis.json"),
    events: path.join(dir, "events.jsonl")
  };
}
