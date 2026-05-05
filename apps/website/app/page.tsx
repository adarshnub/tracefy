import Image from "next/image";
import icon from "../../vscode-extension/assets/icon.png";

const releaseUrl = "https://github.com/adarshnub/tracefy/releases/latest";
const downloads = [
  {
    title: "VS Code / Cursor extension",
    file: "tracefy-0.1.0.vsix",
    href: "https://github.com/adarshnub/tracefy/releases/latest/download/tracefy-0.1.0.vsix",
    body: "Install from VSIX in VS Code or Cursor."
  },
  {
    title: "Chrome bridge",
    file: "tracefy-chrome-bridge-0.1.0.zip",
    href: "https://github.com/adarshnub/tracefy/releases/latest/download/tracefy-chrome-bridge-0.1.0.zip",
    body: "Unzip and load as an unpacked Chrome extension."
  }
];

const setupFlow = [
  "Install the VSIX",
  "Load the Chrome bridge",
  "Paste port + token",
  "Reproduce the failure",
  "Diagnose or use MCP"
];

const signals = [
  "browser console errors",
  "runtime exceptions",
  "failed network requests",
  "terminal command failures",
  "VS Code diagnostics",
  "active code and git diff"
];

const steps = [
  {
    label: "Install",
    title: "Install the extension",
    body: "Add the Tracefy VSIX to VS Code or Cursor."
  },
  {
    label: "Pair",
    title: "Pair Chrome",
    body: "Paste Tracefy's port and token into the Chrome bridge."
  },
  {
    label: "Capture",
    title: "Capture the failure",
    body: "Tracefy gathers logs, diagnostics, snippets, and git diff."
  },
  {
    label: "Diagnose",
    title: "Ask an agent",
    body: "Use Tracefy chat, copy context, or MCP handoff."
  }
];

const tools = [
  {
    title: "Local-first evidence",
    body: "Events stay in your workspace under .tracefy."
  },
  {
    title: "Redacted context packets",
    body: "Secret-like values are masked before handoff."
  },
  {
    title: "Agent MCP",
    body: "Agents can call tracefy_latest_context."
  },
  {
    title: "Open source, MIT licensed",
    body: "Inspect it, fork it, ship your own version."
  }
];

const commands = [
  "Tracefy: Start Watching",
  "Tracefy: Show Timeline",
  "Tracefy: Diagnose Current Failure",
  "Tracefy: Copy Agent Context",
  "Tracefy: Configure MCP for agents"
];

export default function Home() {
  return (
    <main>
      <Hero />
      <Problem />
      <SignalRail />
      <DownloadSetup />
      <HowItWorks />
      <AgentHandoff />
      <OpenSource />
    </main>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="heroTexture" aria-hidden="true" />
      <nav className="nav" aria-label="Primary">
        <a className="brand" href="#top">
          <Image src={icon} alt="" width={34} height={34} priority />
          <span>Tracefy</span>
        </a>
        <div className="navLinks">
          <a href="#download">Download</a>
          <a href="#steps">Setup</a>
          <a href="#mcp">MCP</a>
          <a href="#license">MIT</a>
        </div>
      </nav>

      <div className="heroGrid">
        <div className="heroCopy reveal">
          <p className="eyebrow">Local-first AI debugging</p>
          <h1>Clean agent context from messy failures.</h1>
          <p className="lede">
            Tracefy captures browser, terminal, diagnostics, code snippets, and git diff, then turns them into one
            useful debugging packet.
          </p>
          <div className="heroActions" aria-label="Primary actions">
            <a className="button primary" href="#download">
              Download
            </a>
            <a className="button secondary" href="#mcp">
              See agent handoff
            </a>
          </div>
          <div className="trustRow" aria-label="Project facts">
            <span>MIT licensed</span>
            <span>Open source</span>
            <span>VS Code + agents</span>
          </div>
        </div>

        <div className="consoleScene reveal delay1" aria-label="Animated Tracefy debugging preview">
          <div className="consoleTop">
            <span className="dot red" />
            <span className="dot amber" />
            <span className="dot green" />
            <strong>Tracefy timeline</strong>
          </div>
          <div className="stream">
            <div className="logLine error">browser.error TypeError: users.map is not a function</div>
            <div className="logLine">network.failed GET /api/users 500</div>
            <div className="logLine">vscode.diagnostic src/UserList.tsx:12</div>
            <div className="logLine">terminal.finished npm test exited 1</div>
            <div className="contextCard">
              <span>context packet</span>
              <strong>trigger + timeline + snippets + git diff</strong>
            </div>
          </div>
          <div className="diagnosis">
            <span>root cause</span>
            <p>The UI expected an array. The failed API returned an error object.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="section problem">
      <div className="sectionHeader reveal">
        <p className="eyebrow">The debugging gap</p>
        <h2>Agents need evidence, not guesses.</h2>
      </div>
      <div className="problemGrid">
        <div className="largeStatement reveal">
          One stack trace rarely tells the whole story.
        </div>
        <div className="painList reveal delay1">
          <p>Tracefy gathers the clues when something breaks.</p>
          <ul>
            <li>Browser logs</li>
            <li>Terminal failures</li>
            <li>Diagnostics and changed code</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function SignalRail() {
  return (
    <section className="signalBand">
      <div className="ticker" aria-label="Captured signals">
        {[...signals, ...signals].map((signal, index) => (
          <span key={`${signal}-${index}`}>{signal}</span>
        ))}
      </div>
    </section>
  );
}

function DownloadSetup() {
  return (
    <section className="section download" id="download">
      <div className="downloadGrid">
        <div className="sectionHeader reveal">
          <p className="eyebrow">Download</p>
          <h2>Two extensions. One debugging loop.</h2>
          <p className="downloadLead">
            Install the IDE extension, pair the Chrome bridge, then let Tracefy capture the evidence.
          </p>
          <a className="releaseLink" href={releaseUrl} target="_blank" rel="noreferrer">
            View all release assets
          </a>
        </div>

        <div className="downloadCards">
          {downloads.map((item, index) => (
            <article className="downloadCard reveal" style={{ animationDelay: `${index * 120}ms` }} key={item.file}>
              <span>{item.title}</span>
              <h3>{item.file}</h3>
              <p>{item.body}</p>
              <a className="button primary" href={item.href}>
                Download
              </a>
            </article>
          ))}
        </div>
      </div>

      <div className="setupFlow reveal">
        {setupFlow.map((item, index) => (
          <div className="flowItem" key={item}>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="section" id="steps">
      <div className="sectionHeader reveal">
        <p className="eyebrow">Step by step</p>
        <h2>Break. Capture. Diagnose.</h2>
      </div>
      <div className="steps">
        {steps.map((step, index) => (
          <article className="step reveal" style={{ animationDelay: `${index * 120}ms` }} key={step.label}>
            <div className="stepNumber">{String(index + 1).padStart(2, "0")}</div>
            <p>{step.label}</p>
            <h3>{step.title}</h3>
            <span>{step.body}</span>
          </article>
        ))}
      </div>
      <div className="commandPanel reveal">
        <div>
          <p className="eyebrow">Commands</p>
          <h3>Command palette ready.</h3>
        </div>
        <div className="commandList">
          {commands.map((command) => (
            <code key={command}>{command}</code>
          ))}
        </div>
      </div>
    </section>
  );
}

function AgentHandoff() {
  return (
    <section className="section mcp" id="mcp">
      <div className="mcpGrid">
        <div className="reveal">
          <p className="eyebrow">Cursor, Codex, Claude Code</p>
          <h2>No more copy/paste handoff.</h2>
          <p className="bodyText">
            Tracefy exposes a read-only MCP server. Your agent can pull the latest packet when you ask.
          </p>
          <div className="miniSteps">
            <span>Configure MCP</span>
            <span>Reproduce the failure</span>
            <span>Ask: Use Tracefy context</span>
          </div>
        </div>
        <div className="mcpCard reveal delay1">
          <div className="mcpHeader">
            <span>MCP tools</span>
            <strong>read-only</strong>
          </div>
          <code>tracefy_latest_context</code>
          <code>tracefy_recent_events</code>
          <code>tracefy_latest_diagnosis</code>
          <p>Reads .tracefy locally. No model calls.</p>
        </div>
      </div>
    </section>
  );
}

function OpenSource() {
  return (
    <section className="section final" id="license">
      <div className="sectionHeader reveal">
        <p className="eyebrow">Built in the open</p>
        <h2>MIT licensed. Open source. Local-first.</h2>
      </div>
      <div className="toolGrid">
        {tools.map((tool, index) => (
          <article className="toolCard reveal" style={{ animationDelay: `${index * 110}ms` }} key={tool.title}>
            <h3>{tool.title}</h3>
            <p>{tool.body}</p>
          </article>
        ))}
      </div>
      <div className="releaseStrip reveal">
        <span>Release assets</span>
        <strong>tracefy-0.1.0.vsix</strong>
        <strong>tracefy-chrome-bridge-0.1.0.zip</strong>
      </div>
    </section>
  );
}
