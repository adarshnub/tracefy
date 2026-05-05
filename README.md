# Tracefy

Tracefy is a local-first context-aware debugging prototype for VS Code, Chrome, terminal output, and JavaScript codebases.

## Install From GitHub Releases

1. Open the latest release on GitHub:

   ```txt
   https://github.com/adarshnub/tracefy/releases/latest
   ```

2. Download:

   - `tracefy-0.1.0.vsix`
   - `tracefy-chrome-bridge-0.1.0.zip`

3. Install the VS Code/Cursor extension:

   - Open Cursor or VS Code
   - Press `Ctrl+Shift+P`
   - Run `Extensions: Install from VSIX...`
   - Select the downloaded `.vsix` file

4. Install the Chrome bridge:

   - Unzip `tracefy-chrome-bridge-0.1.0.zip`
   - Open `chrome://extensions`
   - Enable `Developer mode`
   - Click `Load unpacked`
   - Select the unzipped Chrome bridge folder

5. Start Tracefy:

   - Tracefy starts watching automatically when Cursor or VS Code opens
   - Click the Tracefy status bar item or run `Tracefy: Show Timeline`
   - Copy the shown port and token
   - Click the Tracefy Browser Bridge icon in Chrome
   - Paste the port and token
   - Reproduce a browser or terminal error
   - By default, Tracefy asks before diagnosing

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
- Right-side Tracefy chat panel with timeline, diagnosis, patch preview, and follow-up questions.
- Automatic watching on startup with configurable diagnosis behavior.
- Multiple pending failures are sent together in the next diagnosis request.
- Agent handoff via `Tracefy: Copy Agent Context` or the panel's `Copy Context` button.

## Chat And Diff Flow

Tracefy opens as a right-side webview panel. The panel contains a draggable chat surface, a scrollable event timeline, a chat composer, and diagnosis bubbles.

When a diagnosis includes code changes, Tracefy shows them under `Code Diff`. Patch application is still manual in this version.

If several failures happen before you diagnose, Tracefy batches the pending failures and recent surrounding events into one context packet so the AI can propose one coherent fix.

Use `Tracefy: Copy Agent Context` to copy the latest captured failures, selected code context, diagnosis, and diff so another assistant such as Claude, Codex, or Cursor chat can use the same debugging context.

## Development

```bash
npm install
npm run build
npm test
```

To run the VS Code extension, open this repo in VS Code and press `F5` using the `Run Tracefy Extension` launch configuration.

The Chrome extension is in `apps/chrome-extension`. Load it as an unpacked extension and pair it with the port/token shown by `Tracefy: Start Watching`.

## Automation Settings

Tracefy starts automatically by default. You can tune that behavior in Cursor or VS Code settings:

```json
{
  "tracefy.autoStart": true,
  "tracefy.diagnose.mode": "ask",
  "tracefy.autoDiagnose.delayMs": 1500,
  "tracefy.autoDiagnose.cooldownMs": 15000,
  "tracefy.autoDiagnose.openPanel": true
}
```

`ask` is the default. Switch `tracefy.diagnose.mode` to `"automatic"` if you want Tracefy to diagnose failures without prompting.

Manual commands are still available when you want to reopen the timeline, show pairing details, or force a fresh diagnosis.

## Package A Local Release

Build the VSIX:

```bash
npm run package:vscode
```

The VSIX is created at:

```txt
apps/vscode-extension/tracefy-0.1.0.vsix
```

Build the Chrome bridge files:

```bash
npm run build -w @tracefy/chrome-extension
```

Then zip these files from `apps/chrome-extension`:

```txt
manifest.json
popup.html
dist/
```

## Publish A GitHub Release

This repo includes a GitHub Actions workflow that packages release assets when you push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The workflow uploads:

- `tracefy-0.1.0.vsix`
- `tracefy-chrome-bridge-0.1.0.zip`

No VS Code Marketplace account or credit card is required.
