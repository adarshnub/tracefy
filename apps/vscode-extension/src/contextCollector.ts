import * as childProcess from "node:child_process";
import * as path from "node:path";
import * as util from "node:util";
import * as vscode from "vscode";
import { buildContextPacket, type FileSnapshot } from "@tracefy/core";
import type { ContextPacket, DiagnosticItem, TracefyEvent } from "@tracefy/protocol";

const execFile = util.promisify(childProcess.execFile);

export class ContextCollector {
  constructor(private readonly workspaceRoot: string | undefined) {}

  async collect(events: TracefyEvent[]): Promise<ContextPacket | undefined> {
    const [activeFile, files, packageManifest, diagnostics, gitDiff] = await Promise.all([
      this.readActiveFile(),
      this.readProjectFiles(),
      this.readPackageManifest(),
      this.readDiagnostics(),
      this.readGitDiff()
    ]);

    return buildContextPacket({
      events,
      workspaceRoot: this.workspaceRoot,
      activeFile,
      files,
      packageManifest,
      diagnostics,
      gitDiff
    });
  }

  private async readActiveFile(): Promise<FileSnapshot | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.isUntitled) {
      return undefined;
    }

    return {
      path: this.relative(editor.document.uri.fsPath),
      language: editor.document.languageId,
      content: editor.document.getText()
    };
  }

  private async readProjectFiles(): Promise<FileSnapshot[]> {
    if (!this.workspaceRoot) {
      return [];
    }

    const pattern = "{src,app,pages,components,lib}/**/*.{ts,tsx,js,jsx,vue,svelte,json}";
    const uris = await vscode.workspace.findFiles(pattern, "**/{node_modules,dist,out,.next,build,coverage}/**", 120);
    const files: FileSnapshot[] = [];

    for (const uri of uris) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const content = Buffer.from(bytes).toString("utf8");
        if (content.length <= 150000) {
          files.push({
            path: this.relative(uri.fsPath),
            language: languageFromPath(uri.fsPath),
            content
          });
        }
      } catch {
        // Ignore unreadable files and continue building a partial context packet.
      }
    }

    return files;
  }

  private async readPackageManifest(): Promise<string | undefined> {
    if (!this.workspaceRoot) {
      return undefined;
    }

    try {
      const uri = vscode.Uri.file(path.join(this.workspaceRoot, "package.json"));
      const bytes = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(bytes).toString("utf8");
    } catch {
      return undefined;
    }
  }

  private readDiagnostics(): DiagnosticItem[] {
    return vscode.languages
      .getDiagnostics()
      .flatMap(([uri, diagnostics]) =>
        diagnostics.slice(0, 20).map((diagnostic) => ({
          file: this.relative(uri.fsPath),
          line: diagnostic.range.start.line + 1,
          column: diagnostic.range.start.character + 1,
          severity: toSeverity(diagnostic.severity),
          message: diagnostic.message,
          source: diagnostic.source
        }))
      )
      .slice(0, 80);
  }

  private async readGitDiff(): Promise<string | undefined> {
    if (!this.workspaceRoot) {
      return undefined;
    }

    try {
      const { stdout } = await execFile("git", ["diff", "--", "."], {
        cwd: this.workspaceRoot,
        maxBuffer: 1024 * 1024
      });
      return stdout;
    } catch {
      return undefined;
    }
  }

  private relative(fsPath: string): string {
    if (!this.workspaceRoot) {
      return fsPath;
    }
    return path.relative(this.workspaceRoot, fsPath).replace(/\\/g, "/");
  }
}

function toSeverity(severity: vscode.DiagnosticSeverity): DiagnosticItem["severity"] {
  switch (severity) {
    case vscode.DiagnosticSeverity.Error:
      return "error";
    case vscode.DiagnosticSeverity.Warning:
      return "warning";
    case vscode.DiagnosticSeverity.Information:
      return "info";
    default:
      return "debug";
  }
}

function languageFromPath(filePath: string): string {
  const ext = path.extname(filePath).slice(1);
  if (ext === "ts" || ext === "tsx") {
    return ext;
  }
  if (ext === "js" || ext === "jsx") {
    return ext;
  }
  return ext || "text";
}
