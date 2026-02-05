import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Task 2: Differential test verification", () => {
  const ralphPath = join(import.meta.dir, "..", "ralph.sh");
  const content = readFileSync(ralphPath, "utf-8");

  describe("Code structure", () => {
    test("has DIFFERENTIAL TEST VERIFICATION section", () => {
      expect(content).toContain("# DIFFERENTIAL TEST VERIFICATION");
    });

    test("defines extract_failing_tests function", () => {
      expect(content).toContain("extract_failing_tests() {");
    });

    test("defines compare_test_failures function", () => {
      expect(content).toContain("compare_test_failures() {");
    });
  });

  describe("extract_failing_tests implementation", () => {
    test("filters for failure keywords with grep -E", () => {
      expect(content).toMatch(/grep -E.*FAIL/);
    });

    test("extracts patterns with grep -oE", () => {
      expect(content).toContain("grep -oE");
    });

    test("sorts and deduplicates with sort -u", () => {
      expect(content).toContain("sort -u");
    });

    test("handles empty output with || true", () => {
      expect(content).toContain("|| true");
    });
  });

  describe("compare_test_failures implementation", () => {
    test("accepts baseline_file and current_output parameters", () => {
      expect(content).toContain('local baseline_file="$1"');
      expect(content).toContain('local current_output="$2"');
    });

    test("handles missing baseline file", () => {
      expect(content).toMatch(/if \[\[ ! -f.*baseline_file.*\]\]/);
    });

    test("reads baseline exit code from first line", () => {
      expect(content).toContain("baseline_exit_code=$(head -1");
    });

    test("extracts baseline output after separator", () => {
      expect(content).toContain("baseline_output=$(tail -n +3");
    });

    test("treats failures as new when baseline passed", () => {
      expect(content).toMatch(/if \[\[.*baseline_exit_code.*==.*0/);
    });

    test("calls extract_failing_tests for baseline and current", () => {
      expect(content).toContain("baseline_failures=$(extract_failing_tests");
      expect(content).toContain("current_failures=$(extract_failing_tests");
    });

    test("returns success when no current failures", () => {
      expect(content).toMatch(/if \[\[ -z.*current_failures.*\]\]/);
    });

    test("compares current failures against baseline with grep -qF", () => {
      expect(content).toMatch(/grep -qF.*test_name/);
    });

    test("detects new failures", () => {
      expect(content).toContain("new_failure_found");
    });

    test("returns NO_NEW_FAILURES and success code", () => {
      expect(content).toContain("NO_NEW_FAILURES");
      expect(content).toContain("return 0");
    });

    test("returns NEW_FAILURES and failure code", () => {
      expect(content).toContain("NEW_FAILURES");
      expect(content).toContain("return 1");
    });

    test("iterates through current failures with while loop", () => {
      expect(content).toMatch(/while IFS=.*read -r/);
    });
  });

  describe("run_tests integration", () => {
    test("checks if BASELINE_FILE exists and is not empty", () => {
      expect(content).toMatch(/if \[\[ -f "\$BASELINE_FILE" \]\]/);
      expect(content).toMatch(/\[\[ -s "\$BASELINE_FILE" \]\]/);
    });

    test("calls compare_test_failures with BASELINE_FILE", () => {
      expect(content).toMatch(/compare_test_failures "\$BASELINE_FILE"/);
    });

    test("logs differential verification message", () => {
      expect(content).toContain("differential verification");
    });

    test("returns success when no new failures", () => {
      expect(content).toContain("No new test failures");
    });

    test("returns failure when new failures detected", () => {
      expect(content).toContain("New test failures detected");
    });

    test("has fallback for no baseline", () => {
      expect(content).toMatch(/else[\s\S]*Tests failed \(exit code/);
    });

    test("mentions pre-existing failures", () => {
      expect(content).toContain("pre-existing failures");
    });

    test("stores test output in last_test_output", () => {
      expect(content).toContain("last_test_output=");
    });
  });

  describe("Section placement", () => {
    test("DIFFERENTIAL TEST VERIFICATION after verify_tests_written", () => {
      const verifyPos = content.indexOf("verify_tests_written() {");
      const diffPos = content.indexOf("# DIFFERENTIAL TEST VERIFICATION");
      expect(diffPos).toBeGreaterThan(verifyPos);
    });

    test("extract_failing_tests before compare_test_failures", () => {
      const extractPos = content.indexOf("extract_failing_tests() {");
      const comparePos = content.indexOf("compare_test_failures() {");
      expect(comparePos).toBeGreaterThan(extractPos);
    });
  });

  describe("End-to-end flow", () => {
    test("creates BASELINE_FILE with mktemp", () => {
      expect(content).toContain("BASELINE_FILE=$(mktemp)");
      expect(content).toContain('trap "rm -f $BASELINE_FILE" EXIT');
    });

    test("stores baseline in correct format", () => {
      expect(content).toContain('echo "$baseline_exit_code" > "$BASELINE_FILE"');
      expect(content).toContain('echo "---BASELINE-OUTPUT---" >> "$BASELINE_FILE"');
      expect(content).toContain('echo "$baseline_output" >> "$BASELINE_FILE"');
    });

    test("differential verification only runs when baseline exists", () => {
      expect(content).toMatch(/if \[\[ -f "\$BASELINE_FILE" \]\]/);
    });
  });
});
