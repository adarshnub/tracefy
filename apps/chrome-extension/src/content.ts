interface PairingState {
  port?: number;
  token?: string;
}

let socket: WebSocket | undefined;
let pairing: PairingState = {};

injectPageBridge();
void loadPairing();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") {
    return;
  }
  if (changes.tracefyPort || changes.tracefyToken) {
    void loadPairing();
  }
});

window.addEventListener("message", (message) => {
  if (message.source !== window || message.data?.type !== "tracefy.pageEvent") {
    return;
  }
  sendEvent(message.data.event);
});

async function loadPairing(): Promise<void> {
  const stored = await chrome.storage.local.get(["tracefyPort", "tracefyToken"]);
  pairing = {
    port: Number(stored.tracefyPort) || undefined,
    token: typeof stored.tracefyToken === "string" ? stored.tracefyToken : undefined
  };
  connect();
}

function connect(): void {
  socket?.close();
  socket = undefined;

  if (!pairing.port || !pairing.token) {
    return;
  }

  socket = new WebSocket(`ws://127.0.0.1:${pairing.port}`);
  socket.addEventListener("close", () => {
    setTimeout(connect, 2500);
  });
}

function sendEvent(event: Record<string, unknown>): void {
  if (!pairing.token || socket?.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "tracefy.browserEvent",
      token: pairing.token,
      event
    })
  );
}

function injectPageBridge(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("dist/pageBridge.js");
  script.async = false;
  script.onload = () => script.remove();
  (document.head || document.documentElement).appendChild(script);
}
