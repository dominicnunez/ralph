import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

describe("Task 1: Pre-flight test baseline", () => {
  const ralphPath = join(import.meta.dir, "..", "ralph.sh");

  describe("ralph.sh pre-flight baseline code", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("defines BASELINE_FILE variable with mktemp", () => {
      expect(content).toContain("BASELINE_FILE=$(mktemp)");
    });

    test("sets up trap to clean up BASELINE_FILE on exit", () => {
      expect(content).toContain('trap "rm -f $BASELINE_FILE" EXIT');
    });

    test("has PRE-FLIGHT TEST BASELINE section comment", () => {
      expect(content).toContain("# PRE-FLIGHT TEST BASELINE");
    });

    test("runs pre-flight only when tests are enabled", () => {
      expect(content).toMatch(/if \[\[ "\$SKIP_TEST_VERIFY" != "1" \]\] && \[\[ -n "\$DETECTED_TEST_CMD" \]\]/);
    });

    test("logs pre-flight test baseline start", () => {
      expect(content).toContain('echo "🔍 Running pre-flight test baseline..."');
      expect(content).toContain('log "INFO" "Running pre-flight test baseline"');
    });

    test("captures baseline test output and exit code", () => {
      // Should capture output
      expect(content).toContain("baseline_output=$(eval \"$DETECTED_TEST_CMD\" 2>&1)");
      // Should capture exit code
      expect(content).toContain("baseline_exit_code=$?");
    });

    test("stores baseline exit code in BASELINE_FILE", () => {
      expect(content).toContain('echo "$baseline_exit_code" > "$BASELINE_FILE"');
    });

    test("stores baseline output in BASELINE_FILE with separator", () => {
      expect(content).toContain('echo "---BASELINE-OUTPUT---" >> "$BASELINE_FILE"');
      expect(content).toContain('echo "$baseline_output" >> "$BASELINE_FILE"');
    });

    test("reports success when baseline tests pass", () => {
      expect(content).toContain('if [[ $baseline_exit_code -eq 0 ]]; then');
      expect(content).toContain('echo "✅ Pre-flight baseline: All tests passing"');
      expect(content).toContain('log "INFO" "Pre-flight baseline: All tests passing"');
    });

    test("reports failure when baseline tests fail", () => {
      expect(content).toContain('echo "⚠️  Pre-flight baseline: Tests failing');
      expect(content).toContain('log "WARN" "Pre-flight baseline: Tests failing');
    });

    test("logs pre-existing failures to progress file", () => {
      // Should log to progress file
      expect(content).toContain('echo "## Pre-flight Test Baseline - $(date');
      expect(content).toContain('echo "- Exit code: $baseline_exit_code" >> "$PROGRESS_FILE"');
      expect(content).toContain('echo "- Status: Pre-existing test failures detected" >> "$PROGRESS_FILE"');
    });

    test("logs baseline output to progress file (last 50 lines)", () => {
      expect(content).toContain('echo "$baseline_output" | tail -50 >> "$PROGRESS_FILE"');
    });

    test("mentions differential verification in progress log", () => {
      expect(content).toContain("These failures will not block PRD work (differential verification enabled)");
    });

    test("pre-flight section is after test command detection", () => {
      const testDetectPos = content.indexOf("DETECTED_TEST_CMD=$(detect_test_cmd)");
      const preflightPos = content.indexOf("# PRE-FLIGHT TEST BASELINE");
      expect(preflightPos).toBeGreaterThan(testDetectPos);
    });

    test("pre-flight section is before main loop initialization", () => {
      const preflightPos = content.indexOf("# PRE-FLIGHT TEST BASELINE");
      const loopInitPos = content.indexOf("i=0");
      // Find the i=0 that's right before the main loop
      const mainLoopPos = content.indexOf("while [[ \"$MAX\" -eq -1 ]]");
      const relevantI0 = content.lastIndexOf("i=0", mainLoopPos);
      expect(preflightPos).toBeLessThan(relevantI0);
    });

    test("uses set +e around baseline test execution", () => {
      // Find the pre-flight section
      const preflightStart = content.indexOf("# PRE-FLIGHT TEST BASELINE");
      const preflightSection = content.slice(preflightStart, preflightStart + 2000);

      // Should have set +e before test execution
      expect(preflightSection).toContain("set +e");
      expect(preflightSection).toContain("baseline_output=$(eval");

      // Should restore set -e after
      expect(preflightSection).toContain("set -e");
    });
  });

  describe("pre-flight baseline file format verification", () => {
    test("baseline file format is correct", () => {
      // This test verifies the BASELINE_FILE structure
      // by checking the ralph.sh code structure
      const content = readFileSync(ralphPath, "utf-8");

      // Verify the file writing sequence
      const baselineSection = content.match(
        /echo "\$baseline_exit_code" > "\$BASELINE_FILE"[\s\S]*?echo "---BASELINE-OUTPUT---" >> "\$BASELINE_FILE"[\s\S]*?echo "\$baseline_output" >> "\$BASELINE_FILE"/
      );

      expect(baselineSection).not.toBeNull();
    });

    test("baseline file cleanup is configured with trap", () => {
      const content = readFileSync(ralphPath, "utf-8");

      // Should have trap before using BASELINE_FILE
      const trapPos = content.indexOf('trap "rm -f $BASELINE_FILE" EXIT');
      const usePos = content.indexOf('echo "$baseline_exit_code" > "$BASELINE_FILE"');

      expect(trapPos).toBeGreaterThan(0);
      expect(usePos).toBeGreaterThan(0);
      expect(trapPos).toBeLessThan(usePos);
    });
  });

  describe("progress file logging for pre-flight failures", () => {
    test("progress file receives structured failure log", () => {
      const content = readFileSync(ralphPath, "utf-8");

      // Find the pre-flight section that logs to progress file
      const progressLogMatch = content.match(
        /echo "## Pre-flight Test Baseline[\s\S]*?echo "---" >> "\$PROGRESS_FILE"/
      );

      expect(progressLogMatch).not.toBeNull();
      const logBlock = progressLogMatch![0];

      // Check structure
      expect(logBlock).toContain('echo "- Exit code: $baseline_exit_code"');
      expect(logBlock).toContain('echo "- Status: Pre-existing test failures detected"');
      expect(logBlock).toContain('echo "### Baseline Test Output (last 50 lines):"');
      expect(logBlock).toContain('echo "\\`\\`\\`"');
    });
  });
});
