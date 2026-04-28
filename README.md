# Tracefy

Tracefy is a local-first context-aware debugging prototype for VS Code, Chrome, terminal output, and JavaScript codebases.

## What Works In This Slice

- VS Code extension commands:
  - `Tracefy: Start Watching`
  - `Tracefy: Diagnose Current Failure`
  - `Tracefy: Show Timeline`
- Chrome extension bridge for browser console/runtime/network events.
- Terminal shell integration capture for commands and failed output when VS Code exposes shell integration.
- Local JSONL event storage under `.tracefy/events.jsonl`.
- Context packet builder with redaction and relevant code snippets.
- OpenAI Responses API diagnosis client using structured JSON output.
- VS Code Webview timeline with diagnosis and patch preview.

## Development

```bash
npm install
npm run build
npm test
```

To run the VS Code extension, open this repo in VS Code and press `F5` using the `Run Tracefy Extension` launch configuration.

The Chrome extension is in `apps/chrome-extension`. Load it as an unpacked extension and pair it with the port/token shown by `Tracefy: Start Watching`.
