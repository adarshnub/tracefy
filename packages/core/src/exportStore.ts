import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ContextPacket, TracefyDiagnosis } from "@tracefy/protocol";
import { redactObject } from "./redaction";

export const TRACEFY_DIR_NAME = ".tracefy";
export const LATEST_CONTEXT_FILE = "latest-context.json";
export const LATEST_DIAGNOSIS_FILE = "latest-diagnosis.json";

export interface TracefyExportPaths {
  dir: string;
  latestContext: string;
  latestDiagnosis: string;
  events: string;
}

export function tracefyExportPaths(workspaceRoot: string): TracefyExportPaths {
  const dir = path.join(workspaceRoot, TRACEFY_DIR_NAME);
  return {
    dir,
    latestContext: path.join(dir, LATEST_CONTEXT_FILE),
    latestDiagnosis: path.join(dir, LATEST_DIAGNOSIS_FILE),
    events: path.join(dir, "events.jsonl")
  };
}

export async function writeLatestContext(workspaceRoot: string | undefined, context: ContextPacket): Promise<void> {
  if (!workspaceRoot) {
    return;
  }

  const paths = tracefyExportPaths(workspaceRoot);
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.latestContext, `${JSON.stringify(redactObject(context), null, 2)}\n`, "utf8");
}

export async function writeLatestDiagnosis(
  workspaceRoot: string | undefined,
  diagnosis: TracefyDiagnosis
): Promise<void> {
  if (!workspaceRoot) {
    return;
  }

  const paths = tracefyExportPaths(workspaceRoot);
  await fs.mkdir(paths.dir, { recursive: true });
  await fs.writeFile(paths.latestDiagnosis, `${JSON.stringify(redactObject(diagnosis), null, 2)}\n`, "utf8");
}
