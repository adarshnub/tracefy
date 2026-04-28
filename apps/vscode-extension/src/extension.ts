import * as vscode from "vscode";
import { diagnoseContext } from "@tracefy/ai";
import { EventBuffer, normalizeIncomingEvent } from "@tracefy/core";
import type { PairingInfo, TracefyDiagnosis, TracefyEvent } from "@tracefy/protocol";
import { BrowserBridge } from "./browserBridge";
import { ContextCollector } from "./contextCollector";
import { JsonlEventStore } from "./eventStore";
import { TerminalCapture } from "./terminalCapture";
import { TracefyPanel } from "./webview";

class TracefyRuntime {
  private readonly workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  private readonly events = new EventBuffer();
  private readonly store = new JsonlEventStore(this.workspaceRoot);
  private readonly collector = new ContextCollector(this.workspaceRoot);
  private readonly panel: TracefyPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private bridge?: BrowserBridge;
  private terminal?: TerminalCapture;
  private pairing?: PairingInfo;
  private latestDiagnosis?: TracefyDiagnosis;

  constructor(extensionUri: vscode.Uri) {
    this.panel = new TracefyPanel(extensionUri);
  }

  async startWatching(): Promise<void> {
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

    this.panel.show({ events: this.events.all(), pairing: this.pairing, diagnosis: this.latestDiagnosis });
    vscode.window.showInformationMessage(
      `Tracefy is watching. Pair Chrome with port ${this.pairing?.port} and token ${this.pairing?.token}.`
    );
  }

  async diagnoseCurrentFailure(): Promise<void> {
    if (!this.events.latestEpisode()) {
      vscode.window.showWarningMessage("Tracefy has not captured a browser, terminal, or diagnostic failure yet.");
      this.panel.show({ events: this.events.all(), pairing: this.pairing });
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Tracefy is building context and diagnosing the failure...",
        cancellable: false
      },
      async () => {
        const context = await this.collector.collect(this.events.all());
        if (!context) {
          vscode.window.showWarningMessage("Tracefy could not build a context packet for the latest failure.");
          return;
        }

        const config = vscode.workspace.getConfiguration("tracefy");
        const apiKey = config.get<string>("openai.apiKey") || process.env.OPENAI_API_KEY;
        const model = config.get<string>("openai.model") || "gpt-5.2";

        try {
          this.latestDiagnosis = await diagnoseContext(context, { apiKey, model });
          this.panel.show({
            events: this.events.all(),
            pairing: this.pairing,
            diagnosis: this.latestDiagnosis,
            context
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`Tracefy diagnosis failed: ${message}`);
        }
      }
    );
  }

  showTimeline(): void {
    this.panel.show({ events: this.events.all(), pairing: this.pairing, diagnosis: this.latestDiagnosis });
  }

  dispose(): void {
    this.bridge?.dispose();
    this.terminal?.dispose();
    this.panel.dispose();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async addEvent(event: TracefyEvent): Promise<void> {
    this.events.add(event);
    await this.store.append(event);
    if (this.panel.isOpen()) {
      this.panel.update({
        events: this.events.all(),
        pairing: this.pairing,
        diagnosis: this.latestDiagnosis
      });
    }
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
    vscode.commands.registerCommand("tracefy.startWatching", () => runtime.startWatching()),
    vscode.commands.registerCommand("tracefy.diagnoseCurrentFailure", () => runtime.diagnoseCurrentFailure()),
    vscode.commands.registerCommand("tracefy.showTimeline", () => runtime.showTimeline())
  );
}

export function deactivate(): void {}
