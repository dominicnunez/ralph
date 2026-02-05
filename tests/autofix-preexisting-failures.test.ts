import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Task 3: Optional pre-existing failure fix iteration", () => {
  const ralphPath = join(import.meta.dir, "..", "ralph.sh");
  const content = readFileSync(ralphPath, "utf-8");

  describe("Code structure", () => {
    test("has AUTO-FIX PRE-EXISTING TEST FAILURES section comment", () => {
      expect(content).toContain("# AUTO-FIX PRE-EXISTING TEST FAILURES");
    });

    test("checks for SKIP_TEST_VERIFY before running auto-fix", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );
      expect(autofixSection).toContain('SKIP_TEST_VERIFY" != "1"');
    });

    test("checks for DETECTED_TEST_CMD before running auto-fix", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );
      expect(autofixSection).toContain('DETECTED_TEST_CMD"');
    });

    test("checks for BASELINE_FILE existence before running auto-fix", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );
      expect(autofixSection).toContain('BASELINE_FILE"');
      expect(autofixSection).toMatch(/\[\[ -f.*BASELINE_FILE.*\]\]/);
      expect(autofixSection).toMatch(/\[\[ -s.*BASELINE_FILE.*\]\]/);
    });

    test("reads baseline exit code from first line of BASELINE_FILE", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );
      expect(autofixSection).toContain('baseline_exit_code=$(head -1 "$BASELINE_FILE")');
    });

    test("reads baseline output from BASELINE_FILE (skipping first 2 lines)", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );
      expect(autofixSection).toContain('baseline_output=$(tail -n +3 "$BASELINE_FILE")');
    });

    test("only runs auto-fix if baseline_exit_code is not 0", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );
      expect(autofixSection).toContain('baseline_exit_code" != "0"');
    });
  });

  describe("Auto-fix loop configuration", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("initializes autofix_attempts counter", () => {
      expect(autofixSection).toContain("autofix_attempts=0");
    });

    test("initializes autofix_success flag", () => {
      expect(autofixSection).toContain("autofix_success=0");
    });

    test("loops up to MAX_CONSECUTIVE_FAILURES attempts", () => {
      expect(autofixSection).toContain("while [[ $autofix_attempts -lt $MAX_CONSECUTIVE_FAILURES ]]");
    });

    test("increments autofix_attempts counter", () => {
      expect(autofixSection).toContain("((autofix_attempts++))");
    });

    test("displays attempt number", () => {
      expect(autofixSection).toMatch(/Auto-fix Attempt.*autofix_attempts/);
    });

    test("logs attempt number to LOG_FILE", () => {
      expect(autofixSection).toMatch(/log.*Auto-fix attempt.*autofix_attempts/);
    });
  });

  describe("Fix prompt and execution", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("builds fix prompt using build_fix_tests_prompt with baseline output", () => {
      expect(autofixSection).toContain('autofix_prompt=$(build_fix_tests_prompt "$baseline_output")');
    });

    test("runs AI engine with fix prompt", () => {
      expect(autofixSection).toContain('run_engine "$autofix_prompt"');
    });

    test("uses mktemp for capturing AI output", () => {
      expect(autofixSection).toContain("tmpfile=$(mktemp)");
    });

    test("cleans up tmpfile after use", () => {
      expect(autofixSection).toContain('rm -f "$tmpfile"');
    });

    test("logs AI output to LOG_FILE (truncated)", () => {
      expect(autofixSection).toMatch(/echo.*result.*head.*LOG_FILE/);
    });

    test("handles engine errors during auto-fix", () => {
      expect(autofixSection).toMatch(/if \[\[ \$exit_code -ne 0 \]\]/);
      expect(autofixSection).toMatch(/Handle engine errors/);
      expect(autofixSection).toMatch(/ENGINE failed during auto-fix/);
    });
  });

  describe("Test re-run after auto-fix", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("re-runs tests after auto-fix attempt", () => {
      expect(autofixSection).toMatch(/Re-running tests after auto-fix/);
      expect(autofixSection).toContain('test_output=$(eval "$DETECTED_TEST_CMD" 2>&1)');
    });

    test("captures test exit code", () => {
      expect(autofixSection).toContain("test_exit_code=$?");
    });

    test("displays test output", () => {
      expect(autofixSection).toContain('echo "$test_output"');
    });
  });

  describe("Success handling", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("checks if tests now pass (exit code 0)", () => {
      expect(autofixSection).toMatch(/if \[\[ \$test_exit_code -eq 0 \]\]/);
    });

    test("logs success message when tests pass", () => {
      expect(autofixSection).toMatch(/Auto-fix successful.*All tests now passing/);
    });

    test("updates BASELINE_FILE with new passing status", () => {
      expect(autofixSection).toContain('echo "0" > "$BASELINE_FILE"');
      expect(autofixSection).toContain('echo "---BASELINE-OUTPUT---" >> "$BASELINE_FILE"');
    });

    test("writes updated test output to BASELINE_FILE", () => {
      expect(autofixSection).toContain('echo "$test_output" >> "$BASELINE_FILE"');
    });

    test("sets autofix_success flag to 1", () => {
      expect(autofixSection).toContain("autofix_success=1");
    });

    test("breaks out of loop on success", () => {
      const successBlock = autofixSection.slice(
        autofixSection.indexOf("Auto-fix successful"),
        autofixSection.indexOf("Auto-fix successful") + 1000
      );
      expect(successBlock).toContain("break");
    });

    test("logs success to PROGRESS_FILE", () => {
      expect(autofixSection).toMatch(/Auto-fix Success.*Attempt/);
      expect(autofixSection).toMatch(/All pre-existing test failures have been fixed/);
      expect(autofixSection).toMatch(/Baseline updated.*All tests now passing/);
      expect(autofixSection).toMatch(/Proceeding with PRD tasks/);
    });
  });

  describe("Failure handling", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("logs warning when tests still fail after attempt", () => {
      expect(autofixSection).toMatch(/Tests still failing after auto-fix attempt/);
    });

    test("updates baseline_output for next attempt", () => {
      expect(autofixSection).toContain('baseline_output="$test_output"');
    });
  });

  describe("Max attempts exhausted handling", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("checks if auto-fix was unsuccessful after loop", () => {
      expect(autofixSection).toMatch(/if \[\[ \$autofix_success -eq 0 \]\]/);
    });

    test("logs warning that auto-fix could not resolve failures", () => {
      expect(autofixSection).toMatch(/Auto-fix could not resolve all pre-existing failures/);
    });

    test("indicates proceeding with differential verification", () => {
      expect(autofixSection).toMatch(/Proceeding with PRD tasks.*differential verification/i);
    });

    test("logs to PROGRESS_FILE when unsuccessful", () => {
      expect(autofixSection).toMatch(/Auto-fix Incomplete.*After.*Attempts/);
      expect(autofixSection).toMatch(/Could not fix all pre-existing test failures/);
      expect(autofixSection).toMatch(/Proceeding with PRD tasks using differential verification/);
      expect(autofixSection).toMatch(/Only NEW test failures will block PRD work/);
    });
  });

  describe("Integration with main loop", () => {
    test("auto-fix section is before main loop (i=0)", () => {
      const autofixIndex = content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const mainLoopIndex = content.indexOf("i=0\nconsecutive_failures=0");
      expect(autofixIndex).toBeLessThan(mainLoopIndex);
    });

    test("auto-fix section is after pre-flight baseline section", () => {
      const preflightIndex = content.indexOf("# PRE-FLIGHT TEST BASELINE");
      const autofixIndex = content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      expect(preflightIndex).toBeLessThan(autofixIndex);
    });
  });

  describe("Progress file logging", () => {
    const autofixSection = content.slice(
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
      content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
    );

    test("logs start of auto-fix to PROGRESS_FILE", () => {
      expect(autofixSection).toMatch(/Auto-fix Pre-existing Failures.*date/);
      expect(autofixSection).toMatch(/Pre-existing test failures detected in baseline/);
      expect(autofixSection).toMatch(/Attempting to fix before starting PRD tasks/);
      expect(autofixSection).toMatch(/Max attempts.*MAX_CONSECUTIVE_FAILURES/);
    });

    test("uses structured format with section headers", () => {
      expect(autofixSection).toMatch(/##.*Auto-fix/);
      expect(autofixSection).toContain("---");
    });

    test("includes timestamp in logging", () => {
      expect(autofixSection).toMatch(/date.*%Y-%m-%d %H:%M:%S/);
    });
  });

  describe("End-to-end flow", () => {
    test("complete flow: check baseline → loop → fix prompt → run engine → test → success/fail → update baseline/log", () => {
      const autofixSection = content.slice(
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES"),
        content.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES") + 5000
      );

      // 1. Check baseline
      expect(autofixSection).toContain('baseline_exit_code=$(head -1 "$BASELINE_FILE")');
      expect(autofixSection).toContain('baseline_exit_code" != "0"');

      // 2. Loop with attempts
      expect(autofixSection).toContain("while [[ $autofix_attempts -lt $MAX_CONSECUTIVE_FAILURES ]]");

      // 3. Build fix prompt
      expect(autofixSection).toContain("build_fix_tests_prompt");

      // 4. Run engine
      expect(autofixSection).toContain("run_engine");

      // 5. Test
      expect(autofixSection).toContain('eval "$DETECTED_TEST_CMD"');

      // 6. Check success
      expect(autofixSection).toMatch(/if \[\[ \$test_exit_code -eq 0 \]\]/);

      // 7. Update baseline on success
      expect(autofixSection).toContain('echo "0" > "$BASELINE_FILE"');

      // 8. Log to progress file
      expect(autofixSection).toContain("PROGRESS_FILE");
    });
  });
});
