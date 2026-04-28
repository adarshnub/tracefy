import type { ContextPacket, TracefyEvent } from "@tracefy/protocol";
import { createId } from "./id";
import { redactObject } from "./redaction";

type IncomingTracefyEvent = TracefyEvent extends infer Event
  ? Event extends TracefyEvent
    ? Omit<Event, "id" | "timestamp"> & { id?: string; timestamp?: number }
    : never
  : never;

export interface Episode {
  id: string;
  trigger: TracefyEvent;
  events: TracefyEvent[];
}

const FAILURE_KINDS = new Set<TracefyEvent["kind"]>([
  "browser.console",
  "browser.error",
  "browser.network.failed",
  "terminal.command.finished",
  "vscode.diagnostic.changed"
]);

export function normalizeIncomingEvent(
  event: IncomingTracefyEvent,
  workspaceRoot?: string
): TracefyEvent {
  return redactObject({
    ...event,
    id: event.id ?? createId("evt"),
    timestamp: event.timestamp ?? Date.now(),
    workspaceRoot: event.workspaceRoot ?? workspaceRoot
  } as TracefyEvent);
}

export function isFailureEvent(event: TracefyEvent): boolean {
  if (!FAILURE_KINDS.has(event.kind)) {
    return false;
  }
  if (event.kind === "browser.console") {
    return event.level === "error";
  }
  if (event.kind === "terminal.command.finished") {
    return event.exitCode !== undefined && event.exitCode !== 0;
  }
  if (event.kind === "vscode.diagnostic.changed") {
    return event.diagnostics.some((diagnostic) => diagnostic.severity === "error");
  }
  return true;
}

export function createEpisode(events: TracefyEvent[], now = Date.now()): Episode | undefined {
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const trigger = [...sorted].reverse().find(isFailureEvent);
  if (!trigger) {
    return undefined;
  }

  const windowMs = 1000 * 60 * 5;
  const timeline = sorted.filter((event) => {
    const distance = Math.abs(event.timestamp - trigger.timestamp);
    return distance <= windowMs && event.timestamp <= now;
  });

  return {
    id: createId("episode"),
    trigger,
    events: timeline
  };
}

export class EventBuffer {
  private readonly events: TracefyEvent[] = [];

  constructor(private readonly maxEvents = 500) {}

  add(event: TracefyEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  all(): TracefyEvent[] {
    return [...this.events];
  }

  latestEpisode(): Episode | undefined {
    return createEpisode(this.events);
  }

  latestContextShell(): Pick<ContextPacket, "episodeId" | "createdAt" | "trigger" | "timeline" | "notes"> | undefined {
    const episode = this.latestEpisode();
    if (!episode) {
      return undefined;
    }

    return {
      episodeId: episode.id,
      createdAt: Date.now(),
      trigger: episode.trigger,
      timeline: episode.events,
      notes: []
    };
  }
}
