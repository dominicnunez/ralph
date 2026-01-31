import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface IterationResult {
  iteration: number;
  taskName: string;
  success: boolean;
  message: string;
  testFile?: string;
  filesChanged?: string[];
}

/**
 * Get the progress file path for a project
 */
export function getProgressFile(projectName: string, progressDir: string): string {
  return join(progressDir, `progress-${projectName}.log`);
}

/**
 * Read the progress file content
 */
export function readProgress(progressFile: string): string {
  if (!existsSync(progressFile)) {
    return "";
  }
  return readFileSync(progressFile, "utf-8");
}

/**
 * Append an iteration result to the progress file
 */
export function appendProgress(progressFile: string, result: IterationResult): void {
  const entry = formatProgressEntry(result);
  appendFileSync(progressFile, entry);
}

/**
 * Append a failure message to the progress file
 */
export function appendFailure(progressFile: string, iteration: number, reason: string, details?: string): void {
  const entry = [
    "",
    `## FAILED - Iteration ${iteration}`,
    `- Reason: ${reason}`,
    details ? `- Details: ${details}` : "",
    "---",
    "",
  ].filter(Boolean).join("\n");
  
  appendFileSync(progressFile, entry);
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
 * Initialize progress directory and file if they don't exist
 */
export function initProgress(progressDir: string, progressFile: string): void {
  // Create directory if it doesn't exist
  if (!existsSync(progressDir)) {
    mkdirSync(progressDir, { recursive: true });
  }
  
  // Create file if it doesn't exist
  if (!existsSync(progressFile)) {
    writeFileSync(progressFile, "# Progress Log\n\n");
  }
}
