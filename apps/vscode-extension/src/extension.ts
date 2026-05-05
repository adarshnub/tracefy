import * as path from "node:path";
import * as vscode from "vscode";
import { chatWithContext, diagnoseContext, type TracefyChatMessage } from "@tracefy/ai";
import {
  EventBuffer,
  isFailureEvent,
  normalizeIncomingEvent,
  tracefyExportPaths,
  writeLatestContext,
  writeLatestDiagnosis
} from "@tracefy/core";
import type { PairingInfo, TracefyDiagnosis, TracefyEvent } from "@tracefy/protocol";
import { BrowserBridge } from "./browserBridge";
import { ContextCollector } from "./contextCollector";
import { JsonlEventStore } from "./eventStore";
import { TerminalCapture } from "./terminalCapture";
import { TracefyChatPanel } from "./webview";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

class TracefyRuntime {
  private readonly workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  private readonly events = new EventBuffer();
  private readonly store = new JsonlEventStore(this.workspaceRoot);
  private readonly collector = new ContextCollector(this.workspaceRoot);
  private readonly panel: TracefyChatPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private bridge?: BrowserBridge;
  private terminal?: TerminalCapture;
  private pairing?: PairingInfo;
  private latestDiagnosis?: TracefyDiagnosis;
  private latestContext?: Awaited<ReturnType<ContextCollector["collect"]>>;
  private statusBar?: vscode.StatusBarItem;
  private autoDiagnoseTimer?: NodeJS.Timeout;
  private autoStartTimer?: NodeJS.Timeout;
  private pendingFailure = false;
  private pendingFailureEvents: TracefyEvent[] = [];
  private pendingFailureStartedAt?: number;
  private chatMessages: TracefyChatMessage[] = [];
  private lastAutoDiagnosisAt = 0;
  private lastDiagnosedTriggerId?: string;
  private diagnosing = false;

  constructor(extensionUri: vscode.Uri) {
    this.panel = new TracefyChatPanel(
      extensionUri,
      () => void this.diagnoseCurrentFailure(),
      (message) => void this.sendChatMessage(message)
    );
  }

  async startWatching(options: { revealPanel?: boolean; notify?: boolean } = {}): Promise<void> {
    const revealPanel = options.revealPanel ?? true;
    const notify = options.notify ?? true;

    if (!this.bridge) {
      this.bridge = new BrowserBridge(this.workspaceRoot, (event) => void this.addEvent(event));
      this.pairing = await this.bridge.start();
    }

    if (!this.terminal) {
      this.terminal = new TerminalCapture(this.workspaceRoot, (event) => void this.addEvent(event));
      this.terminal.start();
    }

    if (this.disposables.length === 0) {
      this.watchWorkspaceSignals();
    }

    this.updateStatusBar();

    if (revealPanel) {
      this.panel.reveal(this.getPanelState());
    }

    if (notify) {
      vscode.window.showInformationMessage(
        `Tracefy is watching. Pair Chrome with port ${this.pairing?.port} and token ${this.pairing?.token}.`
      );
    }
  }

  async diagnoseCurrentFailure(): Promise<void> {
    await this.runDiagnosis({ revealPanel: true, notifyNoFailure: true, showProgress: true });
  }

  async copyAgentContext(): Promise<void> {
    const context = this.latestContext ?? (await this.collector.collect(this.getDiagnosisEvents()));
    const payload = [
      "# Tracefy Agent Context",
      "",
      `Pending failures: ${this.pendingFailureEvents.length}`,
      "",
      "## Latest Diagnosis",
      this.latestDiagnosis ? JSON.stringify(this.latestDiagnosis, null, 2) : "No diagnosis has been run yet.",
      "",
      "## Captured Context",
      context ? JSON.stringify(context, null, 2) : "No context packet is available yet."
    ].join("\n");

    await vscode.env.clipboard.writeText(payload);
    vscode.window.showInformationMessage("Tracefy agent context copied to clipboard.");
  }

  async autoStart(): Promise<void> {
    const config = vscode.workspace.getConfiguration("tracefy");
    if (!config.get<boolean>("autoStart", true)) {
      return;
    }

    await this.startWatching({ revealPanel: false, notify: false });
  }

  private async runDiagnosis(options: {
    revealPanel: boolean;
    notifyNoFailure: boolean;
    showProgress: boolean;
  }): Promise<void> {
    if (!this.events.latestEpisode()) {
      if (options.notifyNoFailure) {
        vscode.window.showWarningMessage("Tracefy has not captured a browser, terminal, or diagnostic failure yet.");
        this.panel.reveal(this.getPanelState());
      }
      return;
    }

    if (this.diagnosing) {
      return;
    }

    const task = async () => {
      this.diagnosing = true;
      this.updateStatusBar("diagnosing");
      try {
        await this.diagnoseLatestEpisode(options.revealPanel);
        this.pendingFailure = false;
        this.pendingFailureStartedAt = undefined;
        this.panel.update(this.getPanelState());
      } finally {
        this.diagnosing = false;
        this.updateStatusBar();
      }
    };

    if (options.showProgress) {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Tracefy is building context and diagnosing the failure...",
          cancellable: false
        },
        task
      );
    } else {
      await task();
    }
  }

  showTimeline(): void {
    this.panel.reveal(this.getPanelState());
  }

  dispose(): void {
    if (this.autoDiagnoseTimer) {
      clearTimeout(this.autoDiagnoseTimer);
    }
    if (this.autoStartTimer) {
      clearTimeout(this.autoStartTimer);
    }
    this.bridge?.dispose();
    this.terminal?.dispose();
    this.panel.dispose();
    this.statusBar?.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async addEvent(event: TracefyEvent): Promise<void> {
    this.events.add(event);
    await this.store.append(event);
    this.updateStatusBar();
    this.scheduleAutoDiagnosis(event);
    if (isFailureEvent(event)) {
      void this.exportLatestContext(this.getDiagnosisEvents());
    }
    this.panel.update(this.getPanelState());
  }

  private async diagnoseLatestEpisode(revealPanel: boolean): Promise<void> {
    const diagnosisEvents = this.getDiagnosisEvents();
    const context = await this.collector.collect(diagnosisEvents);
    if (!context) {
      vscode.window.showWarningMessage("Tracefy could not build a context packet for the latest failure.");
      return;
    }
    this.latestContext = context;
    await writeLatestContext(this.workspaceRoot, context);

    const config = vscode.workspace.getConfiguration("tracefy");
    const apiKey = config.get<string>("openai.apiKey") || process.env.OPENAI_API_KEY;
    const model = config.get<string>("openai.model") || "gpt-5.2";

    try {
      this.latestDiagnosis = await diagnoseContext(context, { apiKey, model });
      await writeLatestDiagnosis(this.workspaceRoot, this.latestDiagnosis);
      this.lastDiagnosedTriggerId = context.trigger.id;
      this.pendingFailureEvents = [];

      if (revealPanel) {
        this.panel.reveal(this.getPanelState());
      } else {
        this.panel.update(this.getPanelState());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Tracefy diagnosis failed: ${message}`);
    }
  }

  private scheduleAutoDiagnosis(event: TracefyEvent): void {
    if (!isFailureEvent(event)) {
      return;
    }
    this.pendingFailure = true;
    this.pendingFailureStartedAt ??= event.timestamp;
    this.pendingFailureEvents.push(event);
    this.panel.update(this.getPanelState());

    if (this.getDiagnosisMode() !== "automatic") {
      return;
    }

    if (this.lastDiagnosedTriggerId === event.id) {
      return;
    }

    const config = vscode.workspace.getConfiguration("tracefy");
    const cooldownMs = Math.max(1000, config.get<number>("autoDiagnose.cooldownMs", 15000));
    const elapsed = Date.now() - this.lastAutoDiagnosisAt;
    if (elapsed < cooldownMs) {
      return;
    }

    const delayMs = Math.max(250, config.get<number>("autoDiagnose.delayMs", 1500));
    const revealPanel = config.get<boolean>("autoDiagnose.openPanel", true);

    if (this.autoDiagnoseTimer) {
      clearTimeout(this.autoDiagnoseTimer);
    }

    this.autoDiagnoseTimer = setTimeout(() => {
      this.lastAutoDiagnosisAt = Date.now();
      void this.runDiagnosis({
        revealPanel,
        notifyNoFailure: false,
        showProgress: false
      });
    }, delayMs);
  }

  private updateStatusBar(mode: "watching" | "diagnosing" = "watching"): void {
    if (!this.statusBar) {
      this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
      this.statusBar.command = "tracefy.showTimeline";
      this.statusBar.tooltip = "Tracefy is watching browser, terminal, and workspace signals. Click to open the Tracefy sidebar.";
      this.statusBar.show();
    }

    const eventCount = this.events.all().length;
    this.statusBar.text =
      mode === "diagnosing"
        ? "$(sync~spin) Tracefy diagnosing"
        : this.pendingFailure && this.getDiagnosisMode() === "ask"
          ? "$(debug-alt-small) Tracefy diagnose?"
          : `$(bug) Tracefy ${eventCount ? `${eventCount} events` : "watching"}`;
  }

  private getDiagnosisMode(): "ask" | "automatic" {
    const config = vscode.workspace.getConfiguration("tracefy");
    return config.get<"ask" | "automatic">("diagnose.mode", "ask");
  }

  private async sendChatMessage(message: string): Promise<void> {
    this.chatMessages.push({ role: "user", content: message });
    this.panel.update(this.getPanelState());

    const context = this.latestContext ?? (await this.collector.collect(this.pendingFailureEvents.length > 0 ? this.pendingFailureEvents : this.events.all()));
    const config = vscode.workspace.getConfiguration("tracefy");
    const apiKey = config.get<string>("openai.apiKey") || process.env.OPENAI_API_KEY;
    const model = config.get<string>("openai.model") || "gpt-5.2";

    try {
      const answer = await chatWithContext(context, this.chatMessages, message, { apiKey, model });
      this.chatMessages.push({ role: "assistant", content: answer });
      if (context) {
        this.latestContext = context;
      }
      this.panel.update(this.getPanelState());
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.chatMessages.push({ role: "assistant", content: `Tracefy chat failed: ${text}` });
      this.panel.update(this.getPanelState());
    }
  }

  private async exportLatestContext(events: TracefyEvent[]): Promise<void> {
    try {
      const context = await this.collector.collect(events);
      if (!context) {
        return;
      }
      this.latestContext = context;
      await writeLatestContext(this.workspaceRoot, context);
      this.panel.update(this.getPanelState());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Tracefy context export failed: ${message}`);
    }
  }

  private getPanelState() {
    return {
      events: this.events.all(),
      pairing: this.pairing,
      diagnosis: this.latestDiagnosis,
      context: this.latestContext,
      hasFailure: this.pendingFailure,
      diagnosisMode: this.getDiagnosisMode(),
      pendingFailureCount: this.pendingFailureEvents.length,
      chatMessages: this.chatMessages
    };
  }

  private getDiagnosisEvents(): TracefyEvent[] {
    if (!this.pendingFailureStartedAt) {
      return this.events.all();
    }

    const contextLeadMs = 1000 * 60;
    const start = this.pendingFailureStartedAt - contextLeadMs;
    return this.events.all().filter((event) => event.timestamp >= start).slice(-80);
  }

  private watchWorkspaceSignals(): void {
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.{ts,tsx,js,jsx,vue,svelte,json}");
    const onFile = (uri: vscode.Uri) => {
      void this.addEvent(
        normalizeIncomingEvent(
          {
            kind: "workspace.file.changed",
            source: "workspace",
            path: this.relative(uri.fsPath)
          },
          this.workspaceRoot
        )
      );
    };

    this.disposables.push(
      watcher,
      watcher.onDidChange(onFile),
      watcher.onDidCreate(onFile),
      vscode.languages.onDidChangeDiagnostics((event) => {
        const diagnostics = event.uris.flatMap((uri) =>
          vscode.languages.getDiagnostics(uri).map((diagnostic) => ({
            file: this.relative(uri.fsPath),
            line: diagnostic.range.start.line + 1,
            column: diagnostic.range.start.character + 1,
            severity: diagnostic.severity === vscode.DiagnosticSeverity.Error ? "error" as const : diagnostic.severity === vscode.DiagnosticSeverity.Warning ? "warning" as const : "info" as const,
            message: diagnostic.message,
            source: diagnostic.source
          }))
        );

        if (diagnostics.length > 0) {
          void this.addEvent(
            normalizeIncomingEvent(
              {
                kind: "vscode.diagnostic.changed",
                source: "vscode",
                diagnostics
              },
              this.workspaceRoot
            )
          );
        }
      })
    );
  }

  scheduleAutoStart(): void {
    const config = vscode.workspace.getConfiguration("tracefy");
    if (!config.get<boolean>("autoStart", true)) {
      return;
    }

    this.autoStartTimer = setTimeout(() => {
      void this.autoStart().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showWarningMessage(`Tracefy auto-start failed: ${message}`);
      });
    }, 1000);
  }

  async configureMcp(): Promise<void> {
    if (!this.workspaceRoot) {
      vscode.window.showWarningMessage("Tracefy needs an open workspace to configure MCP.");
      return;
    }

    const mcpServerPath = await this.resolveMcpServerPath();
    if (!mcpServerPath) {
      vscode.window.showWarningMessage("Tracefy MCP server is not built yet. Run `npm run build -w @tracefy/mcp` and try again.");
      return;
    }

    const serverConfig = {
      command: "node",
      args: [mcpServerPath, "--workspace", this.workspaceRoot]
    };

    const cursorConfigUri = vscode.Uri.file(path.join(this.workspaceRoot, ".cursor", "mcp.json"));
    const claudeCodeConfigUri = vscode.Uri.file(path.join(this.workspaceRoot, ".mcp.json"));

    await this.upsertMcpServer(cursorConfigUri, serverConfig);
    await this.upsertMcpServer(claudeCodeConfigUri, serverConfig);

    const paths = tracefyExportPaths(this.workspaceRoot);
    const codexSnippet = [
      "[mcp_servers.tracefy]",
      "command = \"node\"",
      `args = [${JSON.stringify(mcpServerPath)}, "--workspace", ${JSON.stringify(this.workspaceRoot)}]`
    ].join("\n");

    await vscode.env.clipboard.writeText(codexSnippet);
    vscode.window.showInformationMessage(
      `Tracefy MCP configured for Cursor and Claude Code. Codex config snippet copied to clipboard. Context will be read from ${paths.dir}.`
    );
  }

  private async upsertMcpServer(
    configUri: vscode.Uri,
    serverConfig: { command: string; args: string[] }
  ): Promise<void> {
    const existing = await this.readJsonObject(configUri);
    const existingServers = isRecord(existing.mcpServers) ? existing.mcpServers : {};
    const next = {
      ...existing,
      mcpServers: {
        ...existingServers,
        tracefy: serverConfig
      }
    };

    await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(configUri.fsPath)));
    await vscode.workspace.fs.writeFile(configUri, Buffer.from(`${JSON.stringify(next, null, 2)}\n`, "utf8"));
  }

  private async readJsonObject(uri: vscode.Uri): Promise<Record<string, unknown>> {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const parsed = JSON.parse(Buffer.from(bytes).toString("utf8"));
      return isRecord(parsed) ? parsed : {};
    } catch (error) {
      const code = isRecord(error) ? error.code : undefined;
      if (code === "FileNotFound" || code === "ENOENT") {
        return {};
      }
      throw error;
    }
  }

  private async resolveMcpServerPath(): Promise<string | undefined> {
    const candidates = [
      path.join(__dirname, "mcp-server.js"),
      path.join(this.workspaceRoot ?? "", "packages", "mcp", "dist", "index.js"),
      path.join(__dirname, "..", "..", "packages", "mcp", "dist", "index.js"),
      path.join(__dirname, "node_modules", "@tracefy", "mcp", "dist", "index.js"),
      path.join(__dirname, "..", "node_modules", "@tracefy", "mcp", "dist", "index.js")
    ].filter(Boolean);

    for (const candidate of candidates) {
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(candidate));
        return candidate;
      } catch {
        // Continue checking known development and packaged layouts.
      }
    }

    return undefined;
  }

  private relative(fsPath: string): string {
    if (!this.workspaceRoot) {
      return fsPath;
    }
    return vscode.workspace.asRelativePath(vscode.Uri.file(fsPath), false).replace(/\\/g, "/");
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const runtime = new TracefyRuntime(context.extensionUri);

  context.subscriptions.push(
    runtime,
    vscode.commands.registerCommand("tracefy.startWatching", () => runtime.startWatching({ revealPanel: true, notify: true })),
    vscode.commands.registerCommand("tracefy.diagnoseCurrentFailure", () => runtime.diagnoseCurrentFailure()),
    vscode.commands.registerCommand("tracefy.showTimeline", () => runtime.showTimeline()),
    vscode.commands.registerCommand("tracefy.copyAgentContext", () => runtime.copyAgentContext()),
    vscode.commands.registerCommand("tracefy.configureMcp", () => runtime.configureMcp())
  );

  runtime.scheduleAutoStart();
}

export function deactivate(): void {}
