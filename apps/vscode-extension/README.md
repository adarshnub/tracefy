# Tracefy

Tracefy is a local-first debugging assistant for JavaScript developers. It watches the signals around a local failure, builds a compact context packet, and explains the likely root cause with evidence.

## Features

- Capture browser console errors, runtime errors, unhandled promise rejections, and failed network requests through the Tracefy Browser Bridge.
- Capture failed terminal commands when VS Code shell integration is available.
- Collect relevant workspace context from active files, diagnostics, package metadata, snippets, and git diff.
- Send only selected, redacted context to OpenAI for diagnosis.
- Show the timeline, root cause, evidence, and patch preview inside VS Code.

## Commands

- `Tracefy: Start Watching`
- `Tracefy: Show Timeline`
- `Tracefy: Diagnose Current Failure`

## Setup

1. Download the latest `.vsix` from the GitHub Releases page.
2. In VS Code or Cursor, run `Extensions: Install from VSIX...`.
3. Download and unzip `tracefy-chrome-bridge-*.zip` from the same release.
4. In Chrome, open `chrome://extensions`, enable `Developer mode`, click `Load unpacked`, and select the unzipped Chrome bridge folder.
5. Run `Tracefy: Start Watching`.
6. Paste the port and token shown by Tracefy into the browser extension popup.
7. Reproduce a browser or terminal failure.
8. Run `Tracefy: Diagnose Current Failure`.

## OpenAI Configuration

Tracefy can use either a VS Code setting or environment variable:

```json
{
  "tracefy.openai.apiKey": "YOUR_OPENAI_API_KEY",
  "tracefy.openai.model": "gpt-4.1-mini"
}
```

If no API key is configured, Tracefy shows a local fallback diagnosis.

## Privacy

Tracefy stores events locally under `.tracefy/events.jsonl` in the workspace. Secret-like values are redacted before diagnosis requests.

## Current Limitations

- The Chrome bridge must be installed separately.
- Terminal capture depends on VS Code shell integration support.
- Patch application is intentionally not automatic in this version.
