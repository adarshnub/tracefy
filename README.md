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

   - Run `Tracefy: Start Watching`
   - Copy the shown port and token
   - Click the Tracefy Browser Bridge icon in Chrome
   - Paste the port and token
   - Reproduce a browser or terminal error
   - Run `Tracefy: Diagnose Current Failure`

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
