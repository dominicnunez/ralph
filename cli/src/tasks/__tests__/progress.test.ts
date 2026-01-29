import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  readProgress,
  appendProgress,
  appendFailure,
  initProgress,
  type IterationResult,
} from "../progress.js";

describe("tasks/progress", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), "ralph-progress-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("initProgress", () => {
    test("creates progress.txt if it doesn't exist", () => {
      expect(existsSync("progress.txt")).toBe(false);
      initProgress();
      expect(existsSync("progress.txt")).toBe(true);
    });

    test("initializes with header", () => {
      initProgress();
      const content = readFileSync("progress.txt", "utf-8");
      expect(content).toBe("# Progress Log\n\n");
    });

    test("does not overwrite existing file", () => {
      initProgress();
      appendProgress({
        iteration: 1,
        taskName: "Test task",
        success: true,
        message: "Done",
      });
      const contentBefore = readFileSync("progress.txt", "utf-8");
      
      initProgress();
      const contentAfter = readFileSync("progress.txt", "utf-8");
      
      expect(contentAfter).toBe(contentBefore);
    });
  });

  describe("readProgress", () => {
    test("returns empty string for non-existent file", () => {
      expect(readProgress()).toBe("");
    });

    test("returns file content", () => {
      initProgress();
      expect(readProgress()).toBe("# Progress Log\n\n");
    });
  });

  describe("appendProgress", () => {
    test("appends successful iteration", () => {
      initProgress();
      const result: IterationResult = {
        iteration: 1,
        taskName: "Add feature X",
        success: true,
        message: "Feature implemented successfully",
      };
      
      appendProgress(result);
      const content = readProgress();
      
      expect(content).toContain("## Iteration 1 - Add feature X");
      expect(content).toContain("Status: SUCCESS");
      expect(content).toContain("Feature implemented successfully");
    });

    test("appends failed iteration", () => {
      initProgress();
      const result: IterationResult = {
        iteration: 2,
        taskName: "Fix bug Y",
        success: false,
        message: "Tests still failing",
      };
      
      appendProgress(result);
      const content = readProgress();
      
      expect(content).toContain("## Iteration 2 - Fix bug Y");
      expect(content).toContain("Status: FAILED");
      expect(content).toContain("Tests still failing");
    });

    test("includes test file when provided", () => {
      initProgress();
      const result: IterationResult = {
        iteration: 1,
        taskName: "Add tests",
        success: true,
        message: "Tests added",
        testFile: "src/__tests__/feature.test.ts",
      };
      
      appendProgress(result);
      const content = readProgress();
      
      expect(content).toContain("Test file: src/__tests__/feature.test.ts");
    });

    test("includes files changed when provided", () => {
      initProgress();
      const result: IterationResult = {
        iteration: 1,
        taskName: "Refactor",
        success: true,
        message: "Refactored",
        filesChanged: ["src/a.ts", "src/b.ts", "src/c.ts"],
      };
      
      appendProgress(result);
      const content = readProgress();
      
      expect(content).toContain("Files changed: src/a.ts, src/b.ts, src/c.ts");
    });

    test("appends multiple iterations in order", () => {
      initProgress();
      
      appendProgress({
        iteration: 1,
        taskName: "Task 1",
        success: true,
        message: "Done 1",
      });
      
      appendProgress({
        iteration: 2,
        taskName: "Task 2",
        success: true,
        message: "Done 2",
      });
      
      const content = readProgress();
      const idx1 = content.indexOf("Iteration 1");
      const idx2 = content.indexOf("Iteration 2");
      
      expect(idx1).toBeLessThan(idx2);
    });
  });

  describe("appendFailure", () => {
    test("appends failure with reason", () => {
      initProgress();
      appendFailure(3, "Tests did not pass");
      
      const content = readProgress();
      expect(content).toContain("## FAILED - Iteration 3");
      expect(content).toContain("Reason: Tests did not pass");
    });

    test("includes details when provided", () => {
      initProgress();
      appendFailure(4, "Build failed", "Missing dependency: lodash");
      
      const content = readProgress();
      expect(content).toContain("## FAILED - Iteration 4");
      expect(content).toContain("Reason: Build failed");
      expect(content).toContain("Details: Missing dependency: lodash");
    });

    test("omits details line when not provided", () => {
      initProgress();
      appendFailure(5, "Unknown error");
      
      const content = readProgress();
      expect(content).toContain("Reason: Unknown error");
      expect(content).not.toContain("Details:");
    });
  });
});
