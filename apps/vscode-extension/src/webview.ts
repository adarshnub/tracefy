import * as path from "node:path";
import * as vscode from "vscode";
import type { ContextPacket, PairingInfo, TracefyDiagnosis, TracefyEvent } from "@tracefy/protocol";
import type { TracefyChatMessage } from "@tracefy/ai";

export type TracefyDiagnosisMode = "ask" | "automatic";

export type TracefyPanelState = {
  events: TracefyEvent[];
  diagnosis?: TracefyDiagnosis;
  context?: ContextPacket;
  pairing?: PairingInfo;
  hasFailure?: boolean;
  diagnosisMode?: TracefyDiagnosisMode;
  pendingFailureCount?: number;
  chatMessages?: TracefyChatMessage[];
};

export class TracefyChatPanel {
  private panel?: vscode.WebviewPanel;
  private lastState: TracefyPanelState = { events: [] };

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onDiagnose: () => void,
    private readonly onChat: (message: string) => void
  ) {}

  reveal(state?: TracefyPanelState): void {
    if (state) {
      this.lastState = state;
    }

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel("tracefy.chat", "Tracefy", vscode.ViewColumn.Beside, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [this.extensionUri]
      });

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });

      this.panel.webview.onDidReceiveMessage((message) => {
        if (message?.type === "openFile" && typeof message.path === "string") {
          void this.openWorkspaceFile(message.path, message.line);
          return;
        }

        if (message?.type === "diagnose") {
          this.onDiagnose();
          return;
        }

        if (message?.type === "copyAgentContext") {
          void vscode.commands.executeCommand("tracefy.copyAgentContext");
          return;
        }

        if (message?.type === "chat" && typeof message.message === "string") {
          this.onChat(message.message);
        }
      });
    }

    this.renderCurrentView();
    this.panel.reveal(vscode.ViewColumn.Beside);
  }

  update(state: TracefyPanelState): void {
    this.lastState = state;
    this.renderCurrentView();
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private renderCurrentView(): void {
    if (!this.panel) {
      return;
    }

    this.panel.webview.html = renderHtml(this.panel.webview, this.lastState);
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
}

function renderHtml(webview: vscode.Webview, state: TracefyPanelState): string {
  const nonce = createNonce();
  const events = state.events.slice(-40).reverse();
  const diagnosis = state.diagnosis;
  const context = state.context;
  const pairing = state.pairing;
  const hasFailure = state.hasFailure ?? false;
  const diagnosisMode = state.diagnosisMode ?? "ask";
  const pendingFailureCount = state.pendingFailureCount ?? 0;
  const chatMessages = state.chatMessages ?? [];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tracefy</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --muted: var(--vscode-descriptionForeground);
      --border: color-mix(in srgb, var(--vscode-editor-foreground) 14%, transparent);
      --panel: color-mix(in srgb, var(--vscode-editor-background) 86%, var(--vscode-editor-foreground) 14%);
      --panel-2: color-mix(in srgb, var(--vscode-editor-background) 78%, var(--vscode-editor-foreground) 22%);
      --accent: var(--vscode-charts-yellow);
      --danger: var(--vscode-errorForeground);
      --link: var(--vscode-textLink-foreground);
      --code: var(--vscode-textCodeBlock-background);
      --input: var(--vscode-input-background);
      --input-border: var(--vscode-input-border);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      overflow: hidden;
      background:
        linear-gradient(135deg, color-mix(in srgb, var(--accent) 13%, transparent), transparent 34%),
        radial-gradient(circle at 82% 16%, color-mix(in srgb, var(--link) 10%, transparent), transparent 25%),
        var(--bg);
      color: var(--fg);
      font: 13px/1.45 var(--vscode-font-family);
    }

    .stage {
      position: relative;
      width: 100vw;
      height: 100vh;
      padding: 18px;
    }

    .console {
      position: absolute;
      inset: 18px;
      min-width: 320px;
      min-height: 420px;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr) auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: color-mix(in srgb, var(--bg) 92%, black 8%);
      box-shadow: 0 18px 60px color-mix(in srgb, black 45%, transparent);
      overflow: hidden;
    }

    .topbar {
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 44px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 88%, var(--accent) 12%);
      user-select: none;
    }

    .brand {
      display: flex;
      gap: 10px;
      align-items: center;
      min-width: 0;
    }

    .mark {
      width: 10px;
      height: 10px;
      border-radius: 99px;
      background: var(--accent);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent);
      flex: 0 0 auto;
    }

    h1, h2, h3, p { margin: 0; }
    h1 { font-size: 14px; font-weight: 700; letter-spacing: 0; }
    h2 {
      margin: 0 0 8px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    h3 { font-size: 13px; margin-bottom: 6px; }

    .meta {
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .chip {
      min-height: 22px;
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 1px 8px;
      color: var(--muted);
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      font-size: 12px;
      white-space: nowrap;
    }

    .content {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(220px, 32%) minmax(0, 1fr);
    }

    .rail {
      min-height: 0;
      overflow: auto;
      padding: 12px;
      border-right: 1px solid var(--border);
      background: color-mix(in srgb, var(--panel) 35%, transparent);
    }

    .chat {
      min-height: 0;
      overflow: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card, .bubble {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel);
      padding: 12px;
    }

    .bubble.assistant {
      border-left: 3px solid var(--accent);
    }

    .bubble.user {
      margin-left: 24px;
      background: var(--panel-2);
    }

    .bubble.system {
      color: var(--muted);
    }

    .stack {
      display: grid;
      gap: 10px;
    }

    .event {
      display: grid;
      gap: 2px;
      padding-bottom: 9px;
      border-bottom: 1px solid var(--border);
    }

    .event:last-child { border-bottom: 0; padding-bottom: 0; }
    .time { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 11px; }
    .kind { font-weight: 700; overflow-wrap: anywhere; }
    .kind.error { color: var(--danger); }
    .message { color: var(--muted); overflow-wrap: anywhere; }

    .pairing {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 10px;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }

    button {
      min-height: 30px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: color-mix(in srgb, var(--accent) 22%, var(--panel));
      color: var(--fg);
      cursor: pointer;
      font: inherit;
      font-weight: 650;
      padding: 0 11px;
    }

    button.secondary {
      background: var(--panel);
      color: var(--muted);
    }

    .composer {
      border-top: 1px solid var(--border);
      padding: 10px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      background: color-mix(in srgb, var(--panel) 70%, transparent);
    }

    .send-stack {
      display: grid;
      gap: 6px;
      align-content: start;
    }

    textarea {
      width: 100%;
      min-height: 42px;
      max-height: 130px;
      resize: vertical;
      border: 1px solid var(--input-border, var(--border));
      border-radius: 6px;
      background: var(--input);
      color: var(--fg);
      padding: 10px;
      font: inherit;
    }

    pre, code {
      background: var(--code);
      color: var(--fg);
      border-radius: 4px;
    }

    pre {
      max-height: 320px;
      overflow: auto;
      padding: 10px;
      white-space: pre-wrap;
    }

    code { padding: 2px 5px; overflow-wrap: anywhere; }

    .link {
      all: unset;
      color: var(--link);
      cursor: pointer;
      overflow-wrap: anywhere;
    }

    ul { margin: 8px 0 0 18px; padding: 0; }

    @media (max-width: 760px) {
      .stage { padding: 0; }
      .console { inset: 0; border-radius: 0; }
      .content { grid-template-columns: 1fr; }
      .rail { max-height: 34vh; border-right: 0; border-bottom: 1px solid var(--border); }
    }
  </style>
</head>
<body>
  <div class="stage">
    <section class="console" id="console">
      <header class="topbar" id="dragHandle">
        <div class="brand">
          <span class="mark"></span>
          <div>
            <h1>Tracefy</h1>
            <div class="meta">${pendingFailureCount ? `${pendingFailureCount} pending issue${pendingFailureCount === 1 ? "" : "s"}` : "Context-aware debug chat"}</div>
          </div>
        </div>
        <div class="chip-row">
          <span class="chip">${diagnosisMode}</span>
          <span class="chip">${events.length} events</span>
        </div>
      </header>

      <main class="content">
        <aside class="rail">
          <div class="stack">
            ${pairing ? `<section class="card"><h2>Browser Pairing</h2><div class="pairing"><span>Port</span><code>${pairing.port}</code><span>Token</span><code>${escapeHtml(pairing.token)}</code></div></section>` : ""}
            <section class="card">
              <h2>Timeline</h2>
              ${events.length ? `<div class="stack">${events.map(renderEvent).join("")}</div>` : `<p class="message">No captured events yet.</p>`}
            </section>
          </div>
        </aside>

        <section class="chat" id="chat">
          ${renderLeadBubble(hasFailure, diagnosisMode, pendingFailureCount, diagnosis)}
          ${diagnosis ? renderDiagnosis(diagnosis) : ""}
          ${chatMessages.map(renderChatMessage).join("")}
          ${context ? renderContext(context) : ""}
        </section>
      </main>

      <form class="composer" id="composer">
        <textarea id="prompt" placeholder="Ask about the captured failures, logs, code context, or suggested fix..."></textarea>
        <div class="send-stack">
          <button type="submit">Send</button>
          <button type="button" class="secondary" data-copy-agent-context="true">Copy Context</button>
        </div>
      </form>
    </section>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const consoleEl = document.getElementById("console");
    const handle = document.getElementById("dragHandle");
    const chat = document.getElementById("chat");

    document.querySelectorAll("[data-open-file]").forEach((button) => {
      button.addEventListener("click", () => {
        vscode.postMessage({
          type: "openFile",
          path: button.getAttribute("data-open-file"),
          line: Number(button.getAttribute("data-line") || "1")
        });
      });
    });

    document.querySelectorAll("[data-diagnose]").forEach((button) => {
      button.addEventListener("click", () => vscode.postMessage({ type: "diagnose" }));
    });

    document.querySelectorAll("[data-copy-agent-context]").forEach((button) => {
      button.addEventListener("click", () => vscode.postMessage({ type: "copyAgentContext" }));
    });

    document.getElementById("composer").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("prompt");
      const message = input.value.trim();
      if (!message) return;
      vscode.postMessage({ type: "chat", message });
      input.value = "";
    });

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    handle.addEventListener("pointerdown", (event) => {
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = consoleEl.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const nextLeft = Math.max(0, Math.min(window.innerWidth - 320, startLeft + event.clientX - startX));
      const nextTop = Math.max(0, Math.min(window.innerHeight - 220, startTop + event.clientY - startY));
      consoleEl.style.inset = "auto";
      consoleEl.style.left = nextLeft + "px";
      consoleEl.style.top = nextTop + "px";
      consoleEl.style.width = Math.min(window.innerWidth, consoleEl.offsetWidth) + "px";
      consoleEl.style.height = Math.min(window.innerHeight, consoleEl.offsetHeight) + "px";
    });

    handle.addEventListener("pointerup", () => {
      dragging = false;
    });

    chat.scrollTop = chat.scrollHeight;
  </script>
</body>
</html>`;
}

function renderLeadBubble(
  hasFailure: boolean,
  diagnosisMode: TracefyDiagnosisMode,
  pendingFailureCount: number,
  diagnosis: TracefyDiagnosis | undefined
): string {
  if (diagnosis) {
    return `<div class="bubble system">Diagnosis complete. You can ask follow-up questions using the same captured context.</div>`;
  }

  if (hasFailure && diagnosisMode === "ask") {
    return `<div class="bubble assistant">
      <h3>${pendingFailureCount || 1} captured issue${pendingFailureCount === 1 ? "" : "s"} ready</h3>
      <p>Tracefy will send all pending failures together in one diagnosis request.</p>
      <div class="actions"><button data-diagnose="true">Diagnose together</button></div>
    </div>`;
  }

  if (hasFailure) {
    return `<div class="bubble assistant"><p>Tracefy captured failures and will diagnose them together after the configured delay.</p></div>`;
  }

  return `<div class="bubble system">Reproduce a browser or terminal failure, then ask Tracefy what happened.</div>`;
}

function renderDiagnosis(diagnosis: TracefyDiagnosis): string {
  return `<div class="bubble assistant">
    <h3>${escapeHtml(diagnosis.summary)} <span class="chip">${diagnosis.confidence}</span></h3>
    <p>${escapeHtml(diagnosis.rootCause)}</p>
    <h2>Suggested Fix</h2>
    <p>${escapeHtml(diagnosis.suggestedFix)}</p>
    ${diagnosis.testCommand ? `<h2>Verify</h2><pre>${escapeHtml(diagnosis.testCommand)}</pre>` : ""}
    ${diagnosis.diff ? `<h2>Code Diff</h2><pre>${escapeHtml(diagnosis.diff)}</pre>` : ""}
    ${diagnosis.risks.length ? `<h2>Risks</h2><ul>${diagnosis.risks.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>` : ""}
  </div>
  <div class="stack">
    <h2>Evidence</h2>
    ${diagnosis.evidence.map((item) => `<div class="card">
      <strong>${escapeHtml(item.label)}</strong>
      <p>${escapeHtml(item.detail)}</p>
      ${item.file ? `<button class="link" data-open-file="${escapeAttr(item.file)}" data-line="${item.line ?? 1}">${escapeHtml(item.file)}:${item.line ?? 1}</button>` : ""}
    </div>`).join("")}
  </div>`;
}

function renderChatMessage(message: TracefyChatMessage): string {
  return `<div class="bubble ${message.role}">${renderMarkdownish(message.content)}</div>`;
}

function renderContext(context: ContextPacket): string {
  const snippets = [context.activeFile, ...context.relevantFiles].filter(Boolean);
  if (!snippets.length) {
    return "";
  }

  return `<div class="stack">
    <h2>Selected Code Context</h2>
    ${snippets.map((snippet) => `<div class="card">
      <strong><button class="link" data-open-file="${escapeAttr(snippet!.path)}" data-line="${snippet!.startLine}">${escapeHtml(snippet!.path)}</button></strong>
      <p>${escapeHtml(snippet!.reason)}</p>
      <pre>${escapeHtml(snippet!.content.slice(0, 4000))}</pre>
    </div>`).join("")}
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
    <div class="kind ${isError ? "error" : ""}">${escapeHtml(event.kind)}</div>
    <div class="message">${escapeHtml(message)}</div>
  </div>`;
}

function renderMarkdownish(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre>${code}</pre>`).replace(/\n/g, "<br>");
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
