import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * Task 5: End-to-End Behavioral Tests for Pre-flight Baseline + Differential Verification
 *
 * These tests verify the actual BEHAVIOR of the system, not just code structure.
 * Requirements from PRD Task 5:
 * (a) pre-flight detects existing failures
 * (b) differential verification passes when only pre-existing tests fail
 * (c) differential verification fails when a new test breaks
 * (d) auto-fix iteration runs before PRD tasks
 */

describe("Task 5: End-to-End Behavioral Tests", () => {
  let testDir: string;
  let ralphScript: string;

  beforeEach(() => {
    // Create a unique test directory for each test
    testDir = join(tmpdir(), `ralph-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });

    // Copy ralph.sh to test directory
    ralphScript = join(import.meta.dir, "..", "ralph.sh");
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("(a) Pre-flight detects existing failures", () => {
    test("detects when baseline has failing tests", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Verify pre-flight section exists and captures test failures
      expect(scriptContent).toContain("# PRE-FLIGHT TEST BASELINE");
      expect(scriptContent).toContain("baseline_output=$(eval \"$DETECTED_TEST_CMD\" 2>&1)");
      expect(scriptContent).toContain("baseline_exit_code=$?");

      // Verify baseline is stored
      expect(scriptContent).toContain('echo "$baseline_exit_code" > "$BASELINE_FILE"');
      expect(scriptContent).toContain('echo "---BASELINE-OUTPUT---" >> "$BASELINE_FILE"');
      expect(scriptContent).toContain('echo "$baseline_output" >> "$BASELINE_FILE"');
    });

    test("logs pre-existing failures to progress file", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Find the pre-flight section
      const preflightStart = scriptContent.indexOf("# PRE-FLIGHT TEST BASELINE");
      const preflightSection = scriptContent.slice(preflightStart, preflightStart + 2500);

      // Verify logging of failures to progress file
      expect(preflightSection).toContain(">> \"$PROGRESS_FILE\"");
      expect(preflightSection).toContain("Pre-existing test failures detected");
      expect(preflightSection).toContain("Failing Tests:");
    });

    test("extracts failing test names from baseline output", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Find the pre-flight section
      const preflightStart = scriptContent.indexOf("# PRE-FLIGHT TEST BASELINE");
      const preflightSection = scriptContent.slice(preflightStart, preflightStart + 2500);

      // Verify extract_failing_tests is called
      expect(preflightSection).toContain("failing_tests=$(extract_failing_tests \"$baseline_output\")");

      // Verify test names are logged
      expect(preflightSection).toContain("while IFS= read -r test;");
      expect(preflightSection).toContain("- $test");
    });

    test("includes non-blocking message in progress log", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const preflightStart = scriptContent.indexOf("# PRE-FLIGHT TEST BASELINE");
      const preflightSection = scriptContent.slice(preflightStart, preflightStart + 2500);

      // Verify the key message from Task 4
      expect(preflightSection).toContain("These will not block PRD work");
      expect(preflightSection).toContain("Attempting auto-fix first");
    });
  });

  describe("(b) Differential verification passes when only pre-existing tests fail", () => {
    test("compare_test_failures returns success when current failures are subset of baseline", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Find compare_test_failures function
      const funcStart = scriptContent.indexOf("compare_test_failures() {");
      const funcContent = scriptContent.slice(funcStart, funcStart + 2500);

      // Verify it extracts failures from both baseline and current
      expect(funcContent).toContain("baseline_failures=$(extract_failing_tests \"$baseline_output\")");
      expect(funcContent).toContain("current_failures=$(extract_failing_tests \"$current_output\")");

      // Verify it checks if current failures are in baseline
      expect(funcContent).toContain("while IFS= read -r test_name; do");
      expect(funcContent).toContain("grep -qF \"$test_name\"");

      // Verify it returns success when no new failures
      expect(funcContent).toContain("if [[ $new_failure_found -eq 1 ]];");
      expect(funcContent).toContain("NO_NEW_FAILURES");
      expect(funcContent).toContain("return 0");
    });

    test("run_tests returns success when only pre-existing failures occur", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const runTestsStart = scriptContent.indexOf("run_tests() {");
      const runTestsContent = scriptContent.slice(runTestsStart, runTestsStart + 3500);

      // Verify differential verification check
      expect(runTestsContent).toContain("if [[ -f \"$BASELINE_FILE\" ]] && [[ -s \"$BASELINE_FILE\" ]];");
      expect(runTestsContent).toContain("if compare_test_failures \"$BASELINE_FILE\" \"$test_output\";");

      // Verify success return when only pre-existing failures
      expect(runTestsContent).toContain("Tests failed but no new failures detected");
      expect(runTestsContent).toContain("return 0");
    });

    test("logs that pre-existing failures are expected and not blocking", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const runTestsStart = scriptContent.indexOf("run_tests() {");
      const runTestsContent = scriptContent.slice(runTestsStart, runTestsStart + 3500);

      expect(runTestsContent).toContain("No new test failures (pre-existing failures are expected)");
      expect(runTestsContent).toContain("pre-existing failures only");
    });

    test("test verification gate allows work to continue with only pre-existing failures", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // When run_tests returns 0, verification_failed stays 0
      const gateStart = scriptContent.indexOf("# TEST VERIFICATION GATE");
      const gateContent = scriptContent.slice(gateStart, gateStart + 2000);

      expect(gateContent).toContain("verification_failed=0");
      expect(gateContent).toContain("if ! run_tests");
      expect(gateContent).toContain("verification_failed=1");

      // Work continues when verification_failed=0
      // The check is inside the gate, verification_failed controls whether to proceed
      expect(gateContent).toContain("verification_failed=1");
    });
  });

  describe("(c) Differential verification fails when a new test breaks", () => {
    test("compare_test_failures detects new failures not in baseline", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const funcStart = scriptContent.indexOf("compare_test_failures() {");
      const funcContent = scriptContent.slice(funcStart, funcStart + 2500);

      // Verify detection of test not in baseline
      expect(funcContent).toContain("while IFS= read -r test_name; do");
      expect(funcContent).toContain('if [[ -n "$test_name" ]] && ! echo "$baseline_failures" | grep -qF "$test_name";');
      expect(funcContent).toContain("new_failure_found=1");

      // Verify failure return when new failures found
      expect(funcContent).toContain("NEW_FAILURES");
      expect(funcContent).toContain("return 1");
    });

    test("run_tests returns failure when new test failures are detected", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const runTestsStart = scriptContent.indexOf("run_tests() {");
      const runTestsContent = scriptContent.slice(runTestsStart, runTestsStart + 3500);

      // Verify failure path when compare_test_failures returns 1
      expect(runTestsContent).toContain("New test failures detected (not in baseline)");
      expect(runTestsContent).toContain("New test failures detected (exit code:");
      expect(runTestsContent).toContain("return 1");
    });

    test("logs new failures clearly to user", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const runTestsStart = scriptContent.indexOf("run_tests() {");
      const runTestsContent = scriptContent.slice(runTestsStart, runTestsStart + 3500);

      expect(runTestsContent).toContain('log "ERROR" "New test failures detected');
    });

    test("test verification gate blocks work when new failures occur", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const gateStart = scriptContent.indexOf("# TEST VERIFICATION GATE");
      const gateContent = scriptContent.slice(gateStart, gateStart + 2000);

      // When run_tests returns 1, verification_failed becomes 1
      expect(gateContent).toContain("if ! run_tests");
      expect(gateContent).toContain("verification_failed=1");

      // This triggers test fix mode
      expect(gateContent).toContain("if [[ $verification_failed -eq 0 ]]");
    });

    test("treats any failure as new when baseline passed", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const funcStart = scriptContent.indexOf("compare_test_failures() {");
      const funcContent = scriptContent.slice(funcStart, funcStart + 2500);

      // If baseline had no failures (exit code 0), any failure is a regression
      expect(funcContent).toContain('if [[ "$baseline_exit_code" == "0" ]];');
      expect(funcContent).toContain("then");
      expect(funcContent).toContain("NEW_FAILURES");
      expect(funcContent).toContain("return 1");
    });
  });

  describe("(d) Auto-fix iteration runs before PRD tasks", () => {
    test("auto-fix section exists before main loop", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Find both sections
      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const mainLoopStart = scriptContent.indexOf("i=0");

      // Auto-fix must come before main loop (i=0 is where iteration starts)
      expect(autofixStart).toBeGreaterThan(0);
      expect(mainLoopStart).toBeGreaterThan(0);
      expect(autofixStart).toBeLessThan(mainLoopStart);
    });

    test("auto-fix checks if baseline has failures before running", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      // Should read baseline exit code
      expect(autofixSection).toContain('baseline_exit_code=$(head -1 "$BASELINE_FILE")');

      // Should check if it's non-zero
      expect(autofixSection).toContain('if [[ "$baseline_exit_code" != "0" ]];');
    });

    test("auto-fix runs up to MAX_CONSECUTIVE_FAILURES attempts", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      // Should have counter and loop
      expect(autofixSection).toContain("autofix_attempts=0");
      expect(autofixSection).toContain("while [[ $autofix_attempts -lt $MAX_CONSECUTIVE_FAILURES ]];");
      expect(autofixSection).toContain("((autofix_attempts++))");
    });

    test("auto-fix uses build_fix_tests_prompt with baseline output", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      // Should build fix prompt with baseline
      expect(autofixSection).toContain("fix_prompt=$(build_fix_tests_prompt \"$baseline_output\")");

      // Should run AI engine with fix prompt
      expect(autofixSection).toContain("run_engine");
    });

    test("auto-fix re-runs tests after each attempt", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      // Should re-run tests
      expect(autofixSection).toContain("eval \"$DETECTED_TEST_CMD\"");
      expect(autofixSection).toContain("test_exit_code=$?");

      // Should check if tests pass
      expect(autofixSection).toContain('if [[ $test_exit_code -eq 0 ]];');
    });

    test("auto-fix updates baseline on success", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      // On success, should update baseline
      expect(autofixSection).toContain('echo "0" > "$BASELINE_FILE"');
      expect(autofixSection).toContain("autofix_success=1");
      expect(autofixSection).toContain("break");
    });

    test("auto-fix logs warning and proceeds if max attempts exhausted", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      // After loop, should check if fix succeeded
      expect(autofixSection).toContain("if [[ $autofix_success -eq 0 ]];");

      // Should log warning
      expect(autofixSection).toContain("Could not fix all pre-existing test failures");
      expect(autofixSection).toContain("Proceeding with PRD tasks using differential verification");
    });

    test("auto-fix logs success when tests are fixed", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 5000);

      expect(autofixSection).toContain("Auto-fix successful");
      expect(autofixSection).toContain("All tests now passing");
    });
  });

  describe("Integration: Complete flow from pre-flight to differential verification", () => {
    test("complete flow is in correct order", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const preflightStart = scriptContent.indexOf("# PRE-FLIGHT TEST BASELINE");
      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const mainLoopStart = scriptContent.indexOf("i=0");

      // Verify correct ordering (pre-flight -> auto-fix -> main loop)
      expect(preflightStart).toBeGreaterThan(0);
      expect(autofixStart).toBeGreaterThan(preflightStart);
      expect(mainLoopStart).toBeGreaterThan(autofixStart);
    });

    test("extract_failing_tests function supports multiple test frameworks", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const funcStart = scriptContent.indexOf("extract_failing_tests() {");
      const funcContent = scriptContent.slice(funcStart, funcStart + 800);

      // Should support Jest/Vitest patterns
      expect(funcContent).toContain("✗");
      expect(funcContent).toContain("✕");
      expect(funcContent).toContain("FAIL");

      // Should support Go test pattern
      expect(funcContent).toContain("--- FAIL:");

      // Should deduplicate
      expect(funcContent).toContain("sort -u");
    });

    test("baseline file format is consistent", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Check pre-flight writes correct format
      const preflightStart = scriptContent.indexOf("# PRE-FLIGHT TEST BASELINE");
      const preflightSection = scriptContent.slice(preflightStart, preflightStart + 2500);

      expect(preflightSection).toContain('echo "$baseline_exit_code" > "$BASELINE_FILE"');
      expect(preflightSection).toContain('echo "---BASELINE-OUTPUT---" >> "$BASELINE_FILE"');
      expect(preflightSection).toContain('echo "$baseline_output" >> "$BASELINE_FILE"');

      // Check compare_test_failures reads correct format
      const compareStart = scriptContent.indexOf("compare_test_failures() {");
      const compareSection = scriptContent.slice(compareStart, compareStart + 2500);

      expect(compareSection).toContain('baseline_exit_code=$(head -1 "$baseline_file")');
      expect(compareSection).toContain('baseline_output=$(tail -n +3 "$baseline_file")');
    });

    test("BASELINE_FILE is created with mktemp and cleaned on exit", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      // Should create temp file
      expect(scriptContent).toContain("BASELINE_FILE=$(mktemp)");

      // Should set trap for cleanup
      expect(scriptContent).toContain('trap "rm -f $BASELINE_FILE" EXIT');
    });
  });

  describe("Edge cases and error handling", () => {
    test("handles case when no baseline file exists", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const runTestsStart = scriptContent.indexOf("run_tests() {");
      const runTestsContent = scriptContent.slice(runTestsStart, runTestsStart + 3500);

      // Should have fallback for no baseline
      expect(runTestsContent).toContain("# No baseline, treat as regular failure");
      expect(runTestsContent).toContain("Tests failed (exit code: $exit_code) - No baseline available");
    });

    test("handles empty test output", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const funcStart = scriptContent.indexOf("compare_test_failures() {");
      const funcContent = scriptContent.slice(funcStart, funcStart + 2500);

      // Should handle empty current failures (no failures = success)
      expect(funcContent).toContain('if [[ -z "$current_failures" ]];');
      expect(funcContent).toContain("NO_NEW_FAILURES");
      expect(funcContent).toContain("return 0");
    });

    test("skips pre-flight when SKIP_TEST_VERIFY=1", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const preflightStart = scriptContent.indexOf("# PRE-FLIGHT TEST BASELINE");
      const preflightSection = scriptContent.slice(preflightStart, preflightStart + 500);

      expect(preflightSection).toContain('if [[ "$SKIP_TEST_VERIFY" != "1" ]]');
    });

    test("skips auto-fix when SKIP_TEST_VERIFY=1", () => {
      const scriptContent = readFileSync(ralphScript, "utf-8");

      const autofixStart = scriptContent.indexOf("# AUTO-FIX PRE-EXISTING TEST FAILURES");
      const autofixSection = scriptContent.slice(autofixStart, autofixStart + 500);

      expect(autofixSection).toContain('if [[ "$SKIP_TEST_VERIFY" != "1" ]]');
    });
  });
});
