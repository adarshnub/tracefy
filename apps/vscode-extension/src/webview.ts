import * as path from "node:path";
import * as vscode from "vscode";
import type { ContextPacket, PairingInfo, TracefyDiagnosis, TracefyEvent } from "@tracefy/protocol";

export class TracefyPanel {
  private panel?: vscode.WebviewPanel;
  private lastState?: {
    events: TracefyEvent[];
    diagnosis?: TracefyDiagnosis;
    context?: ContextPacket;
    pairing?: PairingInfo;
  };

  constructor(private readonly extensionUri: vscode.Uri) {}

  show(state: {
    events: TracefyEvent[];
    diagnosis?: TracefyDiagnosis;
    context?: ContextPacket;
    pairing?: PairingInfo;
  }): void {
    this.lastState = state;
    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        "tracefy.timeline",
        "Tracefy",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [this.extensionUri]
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage((message) => {
        if (message?.type === "openFile" && typeof message.path === "string") {
          void this.openWorkspaceFile(message.path, message.line);
        }
      });
    }

    this.panel.webview.html = this.render(this.panel.webview, state);
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  update(state: {
    events: TracefyEvent[];
    diagnosis?: TracefyDiagnosis;
    context?: ContextPacket;
    pairing?: PairingInfo;
  }): void {
    this.lastState = state;
    if (!this.panel) {
      return;
    }

    this.panel.webview.html = this.render(this.panel.webview, state);
  }

  isOpen(): boolean {
    return Boolean(this.panel);
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private async openWorkspaceFile(relativePath: string, line?: number): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return;
    }

    const uri = vscode.Uri.file(path.join(workspaceRoot, relativePath));
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    if (typeof line === "number" && line > 0) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  }

  private render(webview: vscode.Webview, state: {
    events: TracefyEvent[];
    diagnosis?: TracefyDiagnosis;
    context?: ContextPacket;
    pairing?: PairingInfo;
  }): string {
    const nonce = createNonce();
    const events = state.events.slice(-40).reverse();
    const diagnosis = state.diagnosis;
    const context = state.context;
    const pairing = state.pairing;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tracefy</title>
  <style>
    :root {
      --trace-bg: var(--vscode-editor-background);
      --trace-fg: var(--vscode-editor-foreground);
      --trace-muted: var(--vscode-descriptionForeground);
      --trace-border: color-mix(in srgb, var(--vscode-editor-foreground) 18%, transparent);
      --trace-accent: var(--vscode-charts-yellow);
      --trace-danger: var(--vscode-errorForeground);
      --trace-ok: var(--vscode-testing-iconPassed);
      --trace-panel: color-mix(in srgb, var(--vscode-editor-background) 84%, var(--vscode-editor-foreground) 16%);
      --trace-code: var(--vscode-textCodeBlock-background);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background: var(--trace-bg);
      color: var(--trace-fg);
      font: 13px/1.45 var(--vscode-font-family);
    }

    .shell {
      display: grid;
      grid-template-columns: minmax(240px, 34%) minmax(0, 1fr);
      min-height: 100vh;
    }

    aside {
      border-right: 1px solid var(--trace-border);
      padding: 18px;
      overflow: auto;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--trace-accent) 12%, transparent), transparent 56%),
        var(--trace-bg);
    }

    main { padding: 18px 20px 32px; overflow: auto; }
    h1, h2, h3 { margin: 0; font-weight: 650; letter-spacing: 0; }
    h1 { font-size: 20px; }
    h2 { font-size: 13px; color: var(--trace-muted); text-transform: uppercase; margin: 22px 0 10px; }
    h3 { font-size: 15px; margin-bottom: 8px; }
    p { margin: 0 0 10px; }

    .status {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-top: 10px;
      color: var(--trace-muted);
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--trace-ok);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--trace-ok) 18%, transparent);
      flex: 0 0 auto;
    }

    .pairing, .empty, .diagnosis, .evidence, .diff {
      border: 1px solid var(--trace-border);
      background: var(--trace-panel);
      border-radius: 6px;
      padding: 12px;
    }

    .pairing code, pre {
      background: var(--trace-code);
      color: var(--trace-fg);
      border-radius: 4px;
    }

    .pairing code { padding: 2px 5px; }

    .event {
      display: grid;
      grid-template-columns: 88px 1fr;
      gap: 10px;
      padding: 9px 0;
      border-bottom: 1px solid var(--trace-border);
    }

    .event:last-child { border-bottom: 0; }
    .time { color: var(--trace-muted); font-variant-numeric: tabular-nums; }
    .kind { font-weight: 650; }
    .kind.error { color: var(--trace-danger); }
    .message { color: var(--trace-muted); overflow-wrap: anywhere; }

    .diagnosis {
      border-left: 3px solid var(--trace-accent);
      margin-bottom: 14px;
    }

    .confidence {
      display: inline-flex;
      align-items: center;
      min-height: 20px;
      padding: 1px 8px;
      border: 1px solid var(--trace-border);
      border-radius: 999px;
      color: var(--trace-muted);
      margin-left: 8px;
      font-size: 12px;
    }

    .evidence-list {
      display: grid;
      gap: 10px;
      margin: 12px 0;
    }

    button.link {
      all: unset;
      cursor: pointer;
      color: var(--vscode-textLink-foreground);
      overflow-wrap: anywhere;
    }

    pre {
      margin: 8px 0 0;
      padding: 12px;
      overflow: auto;
      max-height: 420px;
      white-space: pre-wrap;
    }

    ul { margin: 8px 0 0 18px; padding: 0; }

    @media (max-width: 760px) {
      .shell { grid-template-columns: 1fr; }
      aside { border-right: 0; border-bottom: 1px solid var(--trace-border); }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <h1>Tracefy</h1>
      <div class="status"><span class="dot"></span><span>${pairing ? "Watching browser and terminal signals" : "Timeline ready"}</span></div>
      ${pairing ? `<h2>Browser Pairing</h2><div class="pairing"><p>Chrome extension bridge:</p><p>Port <code>${pairing.port}</code></p><p>Token <code>${escapeHtml(pairing.token)}</code></p></div>` : ""}
      <h2>Timeline</h2>
      ${events.length ? events.map(renderEvent).join("") : `<div class="empty">No events captured yet. Run <strong>Tracefy: Start Watching</strong>, then reproduce a browser or terminal failure.</div>`}
    </aside>
    <main>
      ${diagnosis ? renderDiagnosis(diagnosis) : `<div class="empty"><h3>No diagnosis yet</h3><p>Run <strong>Tracefy: Diagnose Current Failure</strong> after a failure is captured.</p></div>`}
      ${context ? renderContext(context) : ""}
    </main>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll("[data-open-file]").forEach((button) => {
      button.addEventListener("click", () => {
        vscode.postMessage({
          type: "openFile",
          path: button.getAttribute("data-open-file"),
          line: Number(button.getAttribute("data-line") || "1")
        });
      });
    });
  </script>
</body>
</html>`;
  }
}

function renderDiagnosis(diagnosis: TracefyDiagnosis): string {
  return `<section class="diagnosis">
    <h3>${escapeHtml(diagnosis.summary)} <span class="confidence">${diagnosis.confidence}</span></h3>
    <p>${escapeHtml(diagnosis.rootCause)}</p>
    <h2>Suggested Fix</h2>
    <p>${escapeHtml(diagnosis.suggestedFix)}</p>
    ${diagnosis.testCommand ? `<h2>Verify</h2><pre>${escapeHtml(diagnosis.testCommand)}</pre>` : ""}
    ${diagnosis.diff ? `<h2>Patch Preview</h2><pre>${escapeHtml(diagnosis.diff)}</pre>` : ""}
    ${diagnosis.risks.length ? `<h2>Risks</h2><ul>${diagnosis.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>` : ""}
  </section>
  <h2>Evidence</h2>
  <div class="evidence-list">
    ${diagnosis.evidence
      .map(
        (item) => `<div class="evidence">
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(item.detail)}</p>
          ${item.file ? `<button class="link" data-open-file="${escapeAttr(item.file)}" data-line="${item.line ?? 1}">${escapeHtml(item.file)}:${item.line ?? 1}</button>` : ""}
        </div>`
      )
      .join("")}
  </div>`;
}

function renderContext(context: ContextPacket): string {
  const snippets = [context.activeFile, ...context.relevantFiles].filter(Boolean);
  return `<h2>Selected Code Context</h2>
    <div class="evidence-list">
      ${snippets
        .map(
          (snippet) => `<div class="evidence">
            <strong><button class="link" data-open-file="${escapeAttr(snippet!.path)}" data-line="${snippet!.startLine}">${escapeHtml(snippet!.path)}</button></strong>
            <p>${escapeHtml(snippet!.reason)}</p>
            <pre>${escapeHtml(snippet!.content.slice(0, 4000))}</pre>
          </div>`
        )
        .join("")}
    </div>`;
}

function renderEvent(event: TracefyEvent): string {
  const message =
    "message" in event
      ? event.message
      : "command" in event
        ? `${event.command}${"exitCode" in event && event.exitCode !== undefined ? ` exited ${event.exitCode}` : ""}`
        : event.kind;

  const isError = event.kind.includes("error") || (event.kind === "terminal.command.finished" && event.exitCode !== 0);
  return `<div class="event">
    <div class="time">${new Date(event.timestamp).toLocaleTimeString()}</div>
    <div>
      <div class="kind ${isError ? "error" : ""}">${escapeHtml(event.kind)}</div>
      <div class="message">${escapeHtml(message)}</div>
    </div>
  </div>`;
}

function createNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let i = 0; i < 32; i += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
