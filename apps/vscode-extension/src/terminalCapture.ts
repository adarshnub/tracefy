import * as vscode from "vscode";
import type { TracefyEvent } from "@tracefy/protocol";
import { normalizeIncomingEvent } from "@tracefy/core";

interface RunningCommand {
  command: string;
  cwd?: string;
  output: string;
}

const ANSI_RE = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;

export class TerminalCapture {
  private readonly running = new WeakMap<object, RunningCommand>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly workspaceRoot: string | undefined,
    private readonly onEvent: (event: TracefyEvent) => void
  ) {}

  start(): void {
    const windowAny = vscode.window as unknown as {
      onDidStartTerminalShellExecution?: (listener: (event: any) => void) => vscode.Disposable;
      onDidEndTerminalShellExecution?: (listener: (event: any) => void) => vscode.Disposable;
    };

    if (!windowAny.onDidStartTerminalShellExecution || !windowAny.onDidEndTerminalShellExecution) {
      return;
    }

    this.disposables.push(
      windowAny.onDidStartTerminalShellExecution((event) => {
        const command = readCommandLine(event.execution);
        const cwd = event.execution?.cwd?.fsPath ?? event.shellIntegration?.cwd?.fsPath;
        const running: RunningCommand = { command, cwd, output: "" };
        this.running.set(event.execution, running);
        this.onEvent(
          normalizeIncomingEvent(
            {
              kind: "terminal.command.started",
              source: "terminal",
              command,
              cwd
            },
            this.workspaceRoot
          )
        );

        void this.captureOutput(event.execution, running);
      }),
      windowAny.onDidEndTerminalShellExecution((event) => {
        const running = this.running.get(event.execution);
        if (!running) {
          return;
        }
        this.onEvent(
          normalizeIncomingEvent(
            {
              kind: "terminal.command.finished",
              source: "terminal",
              command: running.command,
              cwd: running.cwd,
              exitCode: event.exitCode,
              output: running.output.slice(-20000)
            },
            this.workspaceRoot
          )
        );
      })
    );
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private async captureOutput(execution: any, running: RunningCommand): Promise<void> {
    if (typeof execution?.read !== "function") {
      return;
    }

    try {
      for await (const chunk of execution.read()) {
        running.output = `${running.output}${String(chunk).replace(ANSI_RE, "")}`.slice(-30000);
      }
    } catch {
      // Terminal output capture is best-effort; shell integration support varies by shell.
    }
  }
}

function readCommandLine(execution: any): string {
  const value = execution?.commandLine;
  if (typeof value === "string") {
    return value;
  }
  if (typeof value?.value === "string") {
    return value.value;
  }
  return "unknown command";
}
