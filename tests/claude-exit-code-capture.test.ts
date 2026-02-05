import { test, expect } from "bun:test";
import { readFileSync } from "fs";

const RALPH_SCRIPT = readFileSync("ralph.sh", "utf-8");

test("exit code is captured after claude command execution", () => {
  // Verify exit_code is captured from PIPESTATUS after run_engine
  const exitCodePattern = /run_engine[^}]+exit_code=\$\{PIPESTATUS\[0\]\}/s;
  expect(RALPH_SCRIPT).toMatch(exitCodePattern);
});

test("exit code capture uses PIPESTATUS[0] for correct process", () => {
  // PIPESTATUS[0] captures the first command in the pipeline (run_engine)
  // not the tee command which always succeeds
  expect(RALPH_SCRIPT).toContain("exit_code=${PIPESTATUS[0]}");
});

test("non-zero exit code handling section exists", () => {
  // Verify there's a section that checks if exit_code is non-zero
  const nonZeroCheckPattern = /if \[\[ \$exit_code -ne 0 \]\]; then/;
  expect(RALPH_SCRIPT).toMatch(nonZeroCheckPattern);
});

test("error log contains 'Claude Code exited with code' message", () => {
  // Verify the exact error message format from PRD Task 3
  expect(RALPH_SCRIPT).toContain('log "ERROR" "Claude Code exited with code $exit_code"');
});

test("last 500 chars of output are logged on non-zero exit", () => {
  // Verify that last 500 characters are extracted using tail -c 500
  const lastOutputPattern = /last_output=\$\(echo "\$result" \| tail -c 500\)/;
  expect(RALPH_SCRIPT).toMatch(lastOutputPattern);
});

test("last output is logged to progress file", () => {
  // Verify the last output is logged with ERROR level
  const logLastOutputPattern = /log "ERROR" "Last 500 chars of output: \$last_output"/;
  expect(RALPH_SCRIPT).toMatch(logLastOutputPattern);
});

test("exit code handling occurs after rate limit handling", () => {
  // Find the positions of rate limit section and exit code handling
  const rateLimitPos = RALPH_SCRIPT.indexOf("# RATE LIMIT HANDLING");
  const exitCodeHandlingPos = RALPH_SCRIPT.indexOf("# Handle non-rate-limit errors");

  expect(rateLimitPos).toBeGreaterThan(-1);
  expect(exitCodeHandlingPos).toBeGreaterThan(-1);
  expect(exitCodeHandlingPos).toBeGreaterThan(rateLimitPos);
});

test("script exits with the same exit code on failure", () => {
  // Verify the script propagates the exit code
  const exitCodeSection = RALPH_SCRIPT.match(/if \[\[ \$exit_code -ne 0 \]\]; then[\s\S]*?fi/m);
  expect(exitCodeSection).toBeTruthy();
  expect(exitCodeSection![0]).toContain("exit $exit_code");
});

test("exit code handling is inside the main loop", () => {
  // Find main loop start
  const mainLoopStart = RALPH_SCRIPT.indexOf("while [[ \"$MAX\" -eq -1 ]] || [[ \"$i\" -lt \"$MAX\" ]]; do");
  const exitCodeHandling = RALPH_SCRIPT.indexOf("# Handle non-rate-limit errors");
  const mainLoopEnd = RALPH_SCRIPT.lastIndexOf("done");

  expect(mainLoopStart).toBeGreaterThan(-1);
  expect(exitCodeHandling).toBeGreaterThan(mainLoopStart);
  expect(exitCodeHandling).toBeLessThan(mainLoopEnd);
});

test("result variable is captured before exit code handling", () => {
  // Verify that result=$(cat "$tmpfile") happens before exit code check
  const resultCapturePos = RALPH_SCRIPT.indexOf('result=$(cat "$tmpfile")');
  const exitCodeHandlingPos = RALPH_SCRIPT.indexOf("# Handle non-rate-limit errors");

  expect(resultCapturePos).toBeGreaterThan(-1);
  expect(exitCodeHandlingPos).toBeGreaterThan(resultCapturePos);
});

test("tail -c 500 extracts exactly last 500 characters", () => {
  // Verify the command uses -c flag (character count) not -n (line count)
  expect(RALPH_SCRIPT).toContain("tail -c 500");
});

test("last output uses echo to pipe result variable", () => {
  // Verify proper piping of result variable to tail command
  expect(RALPH_SCRIPT).toContain('echo "$result" | tail -c 500');
});

// Test complete flow of exit code capture and error logging
test("complete exit code handling flow verification", () => {
  const flowPattern = /exit_code=\$\{PIPESTATUS\[0\]\}[\s\S]*if \[\[ \$exit_code -ne 0 \]\]; then[\s\S]*log "ERROR" "Claude Code exited with code \$exit_code"[\s\S]*last_output=[\s\S]*log "ERROR" "Last 500 chars of output: \$last_output"[\s\S]*exit \$exit_code[\s\S]*fi/;
  expect(RALPH_SCRIPT).toMatch(flowPattern);
});

// Test that error handling doesn't interfere with rate limit logic
test("exit code handling is separate from rate limit handling", () => {
  const rateLimitSection = RALPH_SCRIPT.match(/# RATE LIMIT HANDLING[\s\S]*?# Handle non-rate-limit errors/);
  expect(rateLimitSection).toBeTruthy();
  expect(rateLimitSection![0]).toContain("rate_limit_handled");
});

// Verify Task 3 requirements are met
test("Task 3 requirement: exit code is stored", () => {
  // PRD: "Store exit code after claude command completes"
  expect(RALPH_SCRIPT).toContain("exit_code=${PIPESTATUS[0]}");
});

test("Task 3 requirement: error logged on non-zero exit", () => {
  // PRD: "On non-zero exit: log [ERROR] Claude Code exited with code $exit_code"
  expect(RALPH_SCRIPT).toContain('log "ERROR" "Claude Code exited with code $exit_code"');
});

test("Task 3 requirement: last 500 chars logged on non-zero exit", () => {
  // PRD: "On non-zero exit: log last 500 chars of output"
  const lastOutputFlow = /last_output=\$\(echo "\$result" \| tail -c 500\)[\s\S]*log "ERROR" "Last 500 chars of output: \$last_output"/;
  expect(RALPH_SCRIPT).toMatch(lastOutputFlow);
});

// Edge case: verify tmpfile cleanup happens before exit code handling
test("tmpfile is cleaned up before error handling", () => {
  const tmpfileCleanupPos = RALPH_SCRIPT.indexOf('rm -f "$tmpfile"');
  const exitCodeHandlingPos = RALPH_SCRIPT.indexOf("# Handle non-rate-limit errors");

  expect(tmpfileCleanupPos).toBeGreaterThan(-1);
  expect(exitCodeHandlingPos).toBeGreaterThan(tmpfileCleanupPos);
});

// Verify set +e is used to allow capturing exit code
test("set +e allows exit code capture without script termination", () => {
  // Find the set +e that's right before run_engine in the main loop
  const runEnginePos = RALPH_SCRIPT.indexOf('run_engine "$current_prompt"');
  const setPlusEBeforeRunEngine = RALPH_SCRIPT.lastIndexOf("set +e", runEnginePos);
  const exitCodeCapturePos = RALPH_SCRIPT.indexOf("exit_code=${PIPESTATUS[0]}");

  expect(setPlusEBeforeRunEngine).toBeGreaterThan(-1);
  expect(runEnginePos).toBeGreaterThan(setPlusEBeforeRunEngine);
  expect(exitCodeCapturePos).toBeGreaterThan(setPlusEBeforeRunEngine);
});

// Verify the output is already in the result variable
test("result variable contains full output from run_engine", () => {
  const resultPattern = /result=\$\(cat "\$tmpfile"\)/;
  expect(RALPH_SCRIPT).toMatch(resultPattern);
});

// Test error message is shown to user (not just logged)
test("error message is echoed to user on non-zero exit", () => {
  const exitCodeSection = RALPH_SCRIPT.match(/if \[\[ \$exit_code -ne 0 \]\]; then[\s\S]*?^    fi$/m);
  expect(exitCodeSection).toBeTruthy();
  expect(exitCodeSection![0]).toContain('echo "Error from $ENGINE (exit code $exit_code)"');
});

// Verify proper variable scoping
test("exit_code variable is not declared local", () => {
  // exit_code should be in script scope, not local to a function
  const exitCodeLine = RALPH_SCRIPT.split('\n').find(line => line.includes("exit_code=${PIPESTATUS[0]}"));
  expect(exitCodeLine).toBeTruthy();
  expect(exitCodeLine).not.toContain("local exit_code");
});

// Verify last_output variable is used only in error context
test("last_output variable is created only on error", () => {
  const lastOutputMatches = RALPH_SCRIPT.match(/last_output=/g);
  expect(lastOutputMatches).toBeTruthy();
  // Should only appear once in the error handling section
  expect(lastOutputMatches!.length).toBe(1);
});

// Test integration with existing error handling
test("error handling maintains existing behavior", () => {
  const errorSection = RALPH_SCRIPT.match(/if \[\[ \$exit_code -ne 0 \]\]; then[\s\S]*?exit \$exit_code[\s\S]*?fi/);
  expect(errorSection).toBeTruthy();
  // Should still exit with the error code
  expect(errorSection![0]).toContain("exit $exit_code");
  // Should still echo to user
  expect(errorSection![0]).toContain('echo "Error from $ENGINE');
});

// Verify specification compliance: exactly 500 characters
test("specification compliance: exactly 500 chars not more", () => {
  // tail -c 500 gives exactly last 500 bytes/chars
  expect(RALPH_SCRIPT).toContain("tail -c 500");
  expect(RALPH_SCRIPT).not.toContain("tail -c 501");
  expect(RALPH_SCRIPT).not.toContain("tail -c 499");
});

// Verify error log format matches PRD exactly
test("error log format matches PRD specification exactly", () => {
  // PRD specifies: [ERROR] Claude Code exited with code $exit_code
  // log() function adds the [ERROR] prefix, so we just need the message
  expect(RALPH_SCRIPT).toContain('log "ERROR" "Claude Code exited with code $exit_code"');
});
