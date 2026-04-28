export type TracefyEventKind =
  | "browser.console"
  | "browser.error"
  | "browser.network.failed"
  | "terminal.command.started"
  | "terminal.command.finished"
  | "workspace.file.changed"
  | "vscode.diagnostic.changed"
  | "git.diff.changed";

export type TracefySeverity = "debug" | "info" | "warning" | "error";

export interface TracefyBaseEvent {
  id: string;
  kind: TracefyEventKind;
  timestamp: number;
  workspaceRoot?: string;
  source: "browser" | "terminal" | "workspace" | "vscode" | "git";
}

export interface BrowserConsoleEvent extends TracefyBaseEvent {
  kind: "browser.console";
  source: "browser";
  level: TracefySeverity;
  message: string;
  url?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export interface BrowserErrorEvent extends TracefyBaseEvent {
  kind: "browser.error";
  source: "browser";
  message: string;
  url?: string;
  line?: number;
  column?: number;
  stack?: string;
  componentStack?: string;
}

export interface BrowserNetworkFailedEvent extends TracefyBaseEvent {
  kind: "browser.network.failed";
  source: "browser";
  method?: string;
  url: string;
  status?: number;
  statusText?: string;
  message?: string;
}

export interface TerminalCommandStartedEvent extends TracefyBaseEvent {
  kind: "terminal.command.started";
  source: "terminal";
  command: string;
  cwd?: string;
}

export interface TerminalCommandFinishedEvent extends TracefyBaseEvent {
  kind: "terminal.command.finished";
  source: "terminal";
  command: string;
  cwd?: string;
  exitCode?: number;
  output: string;
}

export interface WorkspaceFileChangedEvent extends TracefyBaseEvent {
  kind: "workspace.file.changed";
  source: "workspace";
  path: string;
}

export interface DiagnosticItem {
  file: string;
  line: number;
  column: number;
  severity: TracefySeverity;
  message: string;
  source?: string;
}

export interface VscodeDiagnosticChangedEvent extends TracefyBaseEvent {
  kind: "vscode.diagnostic.changed";
  source: "vscode";
  diagnostics: DiagnosticItem[];
}

export interface GitDiffChangedEvent extends TracefyBaseEvent {
  kind: "git.diff.changed";
  source: "git";
  diff: string;
}

export type TracefyEvent =
  | BrowserConsoleEvent
  | BrowserErrorEvent
  | BrowserNetworkFailedEvent
  | TerminalCommandStartedEvent
  | TerminalCommandFinishedEvent
  | WorkspaceFileChangedEvent
  | VscodeDiagnosticChangedEvent
  | GitDiffChangedEvent;

export interface SourceSnippet {
  path: string;
  language?: string;
  startLine: number;
  endLine: number;
  content: string;
  reason: string;
}

export interface ContextPacket {
  episodeId: string;
  createdAt: number;
  workspaceRoot?: string;
  trigger: TracefyEvent;
  timeline: TracefyEvent[];
  activeFile?: SourceSnippet;
  relevantFiles: SourceSnippet[];
  packageManifest?: string;
  diagnostics: DiagnosticItem[];
  gitDiff?: string;
  notes: string[];
}

export interface DiagnosisEvidence {
  label: string;
  detail: string;
  file: string | null;
  line: number | null;
}

export interface TracefyDiagnosis {
  summary: string;
  rootCause: string;
  evidence: DiagnosisEvidence[];
  confidence: "low" | "medium" | "high";
  suggestedFix: string;
  diff: string | null;
  testCommand: string | null;
  risks: string[];
}

export interface BrowserBridgeMessage {
  type: "tracefy.browserEvent";
  token: string;
  event: Omit<TracefyEvent, "id" | "timestamp" | "workspaceRoot"> & {
    timestamp?: number;
  };
}

export interface PairingInfo {
  port: number;
  token: string;
}
