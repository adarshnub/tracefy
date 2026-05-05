# Tracefy MCP Setup

Tracefy can share its consolidated debugging context with Cursor or Codex through a local MCP server. This replaces the manual copy/paste flow: the agent asks Tracefy for the latest captured context when you tell it to.

## Do I Need To Run The MCP Server?

Usually, no.

For normal users, install the Tracefy VSIX and run `Tracefy: Configure MCP for Cursor/Codex`. Tracefy writes the MCP config for Cursor and gives you the Codex config snippet. Cursor or Codex starts the MCP server automatically when the agent needs it.

You only need to run build commands manually if you are developing Tracefy from this repository instead of using a packaged VSIX.

## Normal User Setup

1. Install the Tracefy VSIX in Cursor or VS Code.
2. Open the project you want to debug.
3. Run `Tracefy: Start Watching` if Tracefy is not already watching.
4. Run `Tracefy: Configure MCP for Cursor/Codex`.
5. For Cursor, Tracefy writes `.cursor/mcp.json` in the current workspace.
6. For Codex, Tracefy copies a TOML snippet to your clipboard. Add that snippet to your Codex MCP config.
7. Restart Cursor/Codex if it does not detect the new MCP server immediately.
8. Reproduce a browser, terminal, or diagnostic failure.
9. Ask your agent something like: `Use Tracefy context to debug the latest failure.`

Tracefy writes MCP-readable data under `.tracefy/` in your workspace. That folder is local-only and should stay gitignored.

## Developer Setup From This Repo

If you are running Tracefy from source, build the workspace first:

```bash
npm install
npm run build
```

Then launch the extension development host or install the locally packaged VSIX:

```bash
npm run package:vscode
```

After that, run `Tracefy: Configure MCP for Cursor/Codex` from the command palette.

## Cursor Config

Tracefy creates this file automatically:

```json
{
  "mcpServers": {
    "tracefy": {
      "command": "node",
      "args": [
        "PATH_TO_TRACEFY_MCP_SERVER",
        "--workspace",
        "PATH_TO_YOUR_WORKSPACE"
      ]
    }
  }
}
```

You normally do not need to edit it. If you move the workspace or reinstall Tracefy, run `Tracefy: Configure MCP for Cursor/Codex` again.

## Codex Config

Tracefy copies a snippet like this:

```toml
[mcp_servers.tracefy]
command = "node"
args = ["PATH_TO_TRACEFY_MCP_SERVER", "--workspace", "PATH_TO_YOUR_WORKSPACE"]
```

Paste it into your Codex MCP configuration. After restarting Codex, the `tracefy` MCP server should be available.

## Available Tools

- `tracefy_latest_context`: latest consolidated context packet as compact Markdown, with optional raw JSON.
- `tracefy_recent_events`: recent captured browser, terminal, diagnostic, workspace, and git events.
- `tracefy_latest_diagnosis`: latest Tracefy diagnosis if one has been run.

## How To Use It In Chat

Use prompts like:

```text
Use Tracefy context to debug the latest failure.
```

```text
Call tracefy_latest_context and explain the likely root cause.
```

```text
Use Tracefy recent events and diagnosis before suggesting a fix.
```

## Troubleshooting

- If the agent says Tracefy has no context, reproduce a failure after Tracefy starts watching.
- If Cursor does not show the server, restart Cursor and check `.cursor/mcp.json`.
- If Codex does not show the server, confirm the copied TOML snippet is in the active Codex MCP config.
- If the server path is missing, rebuild or reinstall Tracefy, then rerun `Tracefy: Configure MCP for Cursor/Codex`.
- If terminal failures are missing, make sure VS Code shell integration is enabled for the terminal.

## Privacy

The MCP server is read-only. It reads local files from `.tracefy/` and does not call OpenAI or send data anywhere by itself. Tracefy redacts secret-like values before writing context for MCP.
