import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { TracefyEvent } from "@tracefy/protocol";

export class JsonlEventStore {
  constructor(private readonly workspaceRoot: string | undefined) {}

  async append(event: TracefyEvent): Promise<void> {
    if (!this.workspaceRoot) {
      return;
    }

    const dir = path.join(this.workspaceRoot, ".tracefy");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, "events.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
  }
}
