# Tracefy

Tracefy is a local-first debugging assistant for JavaScript developers. It watches the signals around a local failure, builds a compact context packet, and explains the likely root cause with evidence.

## Features

- Capture browser console errors, runtime errors, unhandled promise rejections, and failed network requests through the Tracefy Browser Bridge.
- Capture failed terminal commands when VS Code shell integration is available.
- Collect relevant workspace context from active files, diagnostics, package metadata, snippets, and git diff.
- Send only selected, redacted context to OpenAI for diagnosis.
- Show a right-side chat panel with the timeline, root cause, evidence, patch preview, and follow-up questions.
- Start watching automatically and let the user choose whether Tracefy should ask before diagnosing or diagnose automatically.
- Batch multiple pending failures into one diagnosis request.
- Copy Tracefy context for other agents using `Tracefy: Copy Agent Context`.
- Expose captured context to Cursor, Codex, and Claude Code agents through a local read-only MCP server.

## Commands

- `Tracefy: Start Watching`
- `Tracefy: Show Timeline`
- `Tracefy: Diagnose Current Failure`
- `Tracefy: Copy Agent Context`
- `Tracefy: Configure MCP for Cursor/Codex/Claude Code`

## Setup

1. Download the latest `.vsix` from the GitHub Releases page.
2. In VS Code or Cursor, run `Extensions: Install from VSIX...`.
3. Download and unzip `tracefy-chrome-bridge-*.zip` from the same release.
4. In Chrome, open `chrome://extensions`, enable `Developer mode`, click `Load unpacked`, and select the unzipped Chrome bridge folder.
5. Tracefy starts watching automatically.
6. Click the Tracefy status bar item or run `Tracefy: Show Timeline`.
7. Paste the port and token shown by Tracefy into the browser extension popup.
8. Reproduce a browser or terminal failure.
9. By default, Tracefy asks before diagnosing. Switch the diagnosis mode to automatic if you prefer hands-off behavior.

## Chat Panel

Tracefy opens as a right-side webview panel with a draggable chat surface. You can ask follow-up questions directly in the panel, and Tracefy answers using captured errors, logs, diagnostics, selected code context, and the latest diagnosis.

When a suggested fix includes code changes, Tracefy shows the unified diff under `Code Diff`. Patch application is intentionally manual in this preview.

## Agent MCP

Run `Tracefy: Configure MCP for Cursor/Codex/Claude Code`. The command writes `.cursor/mcp.json` for Cursor, writes `.mcp.json` for Claude Code, and copies the equivalent Codex config snippet to your clipboard.

Normal users do not need to start the MCP server manually. Cursor, Codex, or Claude Code starts it from the generated config when the agent needs Tracefy context.

After configuration, ask your agent to use Tracefy context. The MCP server exposes:

- `tracefy_latest_context`
- `tracefy_recent_events`
- `tracefy_latest_diagnosis`

Tracefy writes the MCP-readable data locally under `.tracefy/`. The server is read-only and does not call OpenAI.

See [MCP_SETUP.md](./MCP_SETUP.md) for normal-user setup, developer setup, and troubleshooting.

## OpenAI Configuration

Tracefy can use either a VS Code setting or environment variable:

```json
{
  "tracefy.openai.apiKey": "YOUR_OPENAI_API_KEY",
  "tracefy.openai.model": "gpt-4.1-mini"
}
```

If no API key is configured, Tracefy shows a local fallback diagnosis.

## Automation

Automatic watching and diagnosis are enabled by default:

```json
{
  "tracefy.autoStart": true,
  "tracefy.diagnose.mode": "ask",
  "tracefy.autoDiagnose.delayMs": 1500,
  "tracefy.autoDiagnose.cooldownMs": 15000,
  "tracefy.autoDiagnose.openPanel": true
}
```

Use `"automatic"` for `tracefy.diagnose.mode` if you want Tracefy to run diagnoses without asking first.

## Privacy

Tracefy stores events locally under `.tracefy/events.jsonl` in the workspace. Secret-like values are redacted before diagnosis requests.

## Current Limitations

- The Chrome bridge must be installed separately.
- Terminal capture depends on VS Code shell integration support.
- Patch application is intentionally not automatic in this version.
