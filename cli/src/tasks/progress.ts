import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";

const PROGRESS_FILE = "progress.txt";

export interface IterationResult {
  iteration: number;
  taskName: string;
  success: boolean;
  message: string;
  testFile?: string;
  filesChanged?: string[];
}

/**
 * Read the progress file content
 */
export function readProgress(): string {
  if (!existsSync(PROGRESS_FILE)) {
    return "";
  }
  return readFileSync(PROGRESS_FILE, "utf-8");
}

/**
 * Append an iteration result to progress.txt
 */
export function appendProgress(result: IterationResult): void {
  const entry = formatProgressEntry(result);
  appendFileSync(PROGRESS_FILE, entry);
}

/**
 * Append a failure message to progress.txt
 */
export function appendFailure(iteration: number, reason: string, details?: string): void {
  const entry = [
    "",
    `## FAILED - Iteration ${iteration}`,
    `- Reason: ${reason}`,
    details ? `- Details: ${details}` : "",
    "---",
    "",
  ].filter(Boolean).join("\n");
  
  appendFileSync(PROGRESS_FILE, entry);
}

/**
 * Format a progress entry
 */
function formatProgressEntry(result: IterationResult): string {
  const lines = [
    "",
    `## Iteration ${result.iteration} - ${result.taskName}`,
    `- Status: ${result.success ? "SUCCESS" : "FAILED"}`,
    `- ${result.message}`,
  ];

  if (result.testFile) {
    lines.push(`- Test file: ${result.testFile}`);
  }

  if (result.filesChanged && result.filesChanged.length > 0) {
    lines.push(`- Files changed: ${result.filesChanged.join(", ")}`);
  }

  lines.push("---");
  lines.push("");

  return lines.join("\n");
}

/**
 * Initialize progress file if it doesn't exist
 */
export function initProgress(): void {
  if (!existsSync(PROGRESS_FILE)) {
    writeFileSync(PROGRESS_FILE, "# Progress Log\n\n");
  }
}
