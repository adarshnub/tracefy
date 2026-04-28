import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";
import type { BrowserBridgeMessage, PairingInfo, TracefyEvent } from "@tracefy/protocol";
import { normalizeIncomingEvent } from "@tracefy/core";

export class BrowserBridge {
  private server?: WebSocketServer;
  private pairing?: PairingInfo;

  constructor(
    private readonly workspaceRoot: string | undefined,
    private readonly onEvent: (event: TracefyEvent) => void
  ) {}

  async start(): Promise<PairingInfo> {
    if (this.server && this.pairing) {
      return this.pairing;
    }

    const token = randomBytes(18).toString("hex");
    this.server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
    await new Promise<void>((resolve) => this.server?.once("listening", resolve));

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start Tracefy browser bridge");
    }

    this.pairing = { port: address.port, token };
    this.server.on("connection", (socket) => {
      socket.on("message", (raw) => {
        try {
          const message = JSON.parse(String(raw)) as BrowserBridgeMessage;
          if (message.type !== "tracefy.browserEvent" || message.token !== token) {
            return;
          }
          this.onEvent(
            normalizeIncomingEvent(
              {
                ...message.event,
                timestamp: message.event.timestamp ?? Date.now()
              } as TracefyEvent,
              this.workspaceRoot
            )
          );
        } catch {
          // Ignore malformed browser messages. The bridge must never crash the extension host.
        }
      });
    });

    return this.pairing;
  }

  dispose(): void {
    this.server?.close();
  }
}
