import type {
  ContextPacket,
  DiagnosticItem,
  SourceSnippet,
  TracefyEvent
} from "@tracefy/protocol";
import { createEpisode } from "./events";
import { redactObject, redactText } from "./redaction";

export interface FileSnapshot {
  path: string;
  content: string;
  language?: string;
}

export interface ContextBuildInput {
  events: TracefyEvent[];
  workspaceRoot?: string;
  activeFile?: FileSnapshot;
  files: FileSnapshot[];
  packageManifest?: string;
  diagnostics?: DiagnosticItem[];
  gitDiff?: string;
}

const STACK_PATH_RE = /(?:webpack:\/\/\/|file:\/\/\/)?([A-Za-z]:[\\/][^\s:)]+|[\w./-]+\.(?:tsx?|jsx?|vue|svelte))(?::(\d+))?(?::(\d+))?/g;

export function extractPathHints(text: string): string[] {
  const hints = new Set<string>();
  for (const match of text.matchAll(STACK_PATH_RE)) {
    hints.add(normalizePathHint(match[1]));
  }
  return [...hints];
}

export function buildContextPacket(input: ContextBuildInput): ContextPacket | undefined {
  const episode = createEpisode(input.events);
  if (!episode) {
    return undefined;
  }

  const triggerText = JSON.stringify(episode.trigger);
  const timelineText = episode.events.map((event) => JSON.stringify(event)).join("\n");
  const pathHints = new Set([...extractPathHints(triggerText), ...extractPathHints(timelineText)]);
  const relevantFiles = rankRelevantFiles(input.files, pathHints, episode.events).slice(0, 6);

  const packet: ContextPacket = {
    episodeId: episode.id,
    createdAt: Date.now(),
    workspaceRoot: input.workspaceRoot,
    trigger: episode.trigger,
    timeline: episode.events.slice(-25),
    activeFile: input.activeFile
      ? toSnippet(input.activeFile, "Active editor when diagnosis was requested")
      : undefined,
    relevantFiles,
    packageManifest: redactText(input.packageManifest),
    diagnostics: input.diagnostics ?? [],
    gitDiff: trimText(redactText(input.gitDiff), 12000),
    notes: [
      "Context is selected locally from recent runtime signals, diagnostics, active editor, package manifest, and git diff.",
      "Patch suggestions must be grounded in the evidence above."
    ]
  };

  return redactObject(packet);
}

function rankRelevantFiles(
  files: FileSnapshot[],
  pathHints: Set<string>,
  events: TracefyEvent[]
): SourceSnippet[] {
  const eventText = events.map((event) => JSON.stringify(event)).join("\n").toLowerCase();

  return files
    .map((file) => {
      const normalizedPath = normalizePathHint(file.path);
      const stackMatch = [...pathHints].some((hint) => normalizedPath.endsWith(hint) || hint.endsWith(normalizedPath));
      const nameMatch = eventText.includes(file.path.toLowerCase()) || eventText.includes(basename(file.path).toLowerCase());
      const configBonus = /(^|[\\/])(package\.json|tsconfig\.json|vite\.config\.[tj]s|next\.config\.[tj]s)$/.test(file.path);
      const score = (stackMatch ? 100 : 0) + (nameMatch ? 40 : 0) + (configBonus ? 15 : 0);
      return { file, score, reason: stackMatch ? "Matched runtime stack trace" : nameMatch ? "Mentioned in recent failure output" : "Project context" };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => toSnippet(item.file, item.reason));
}

function toSnippet(file: FileSnapshot, reason: string): SourceSnippet {
  const maxLines = 220;
  const lines = file.content.split(/\r?\n/);
  const content = lines.slice(0, maxLines).join("\n");
  return {
    path: file.path,
    language: file.language,
    startLine: 1,
    endLine: Math.min(lines.length, maxLines),
    content: trimText(redactText(content), 16000) ?? "",
    reason
  };
}

function trimText(value: string | undefined, max: number): string | undefined {
  if (!value || value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)}\n...[trimmed ${value.length - max} chars]`;
}

function normalizePathHint(value: string): string {
  return value.replace(/\\/g, "/").replace(/^.*?\/src\//, "src/");
}

function basename(value: string): string {
  return value.replace(/\\/g, "/").split("/").pop() ?? value;
}
