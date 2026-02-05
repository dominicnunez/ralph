import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";

const RALPH_SCRIPT = "/home/kai/pets/ralph/ralph.sh";

describe("Task 2: Iteration Timing", () => {
  const script = readFileSync(RALPH_SCRIPT, "utf-8");
  const lines = script.split("\n");

  describe("Code Structure", () => {
    test("records iteration start time after log_resources", () => {
      const pattern = /iteration_start_time=\$\(date \+%s\)/;
      expect(script).toMatch(pattern);
    });

    test("start time recording appears after log_resources call", () => {
      const logResourcesIndex = lines.findIndex(line =>
        line.includes("log_resources") && !line.trim().startsWith("#")
      );
      const startTimeIndex = lines.findIndex(line =>
        line.includes("iteration_start_time=$(date +%s)")
      );

      expect(logResourcesIndex).toBeGreaterThan(-1);
      expect(startTimeIndex).toBeGreaterThan(-1);
      expect(startTimeIndex).toBeGreaterThan(logResourcesIndex);
    });

    test("calculates iteration duration before sleep", () => {
      const durationCalcPattern = /iteration_duration=\$\(\(iteration_end_time - iteration_start_time\)\)/;
      expect(script).toMatch(durationCalcPattern);
    });

    test("duration calculation appears before sleep command", () => {
      const sleepIndex = lines.findIndex(line =>
        line.trim() === 'sleep "$SLEEP"'
      );
      const durationIndex = lines.findIndex(line =>
        line.includes("iteration_duration=$((iteration_end_time - iteration_start_time))")
      );

      expect(sleepIndex).toBeGreaterThan(-1);
      expect(durationIndex).toBeGreaterThan(-1);
      expect(durationIndex).toBeLessThan(sleepIndex);
    });

    test("logs completion time with INFO level", () => {
      const logPattern = /log "INFO" "Iteration \$i completed in \$\{iteration_duration\}s"/;
      expect(script).toMatch(logPattern);
    });
  });

  describe("Timing Format", () => {
    test("uses Unix epoch timestamp for start time", () => {
      const pattern = /iteration_start_time=\$\(date \+%s\)/;
      expect(script).toMatch(pattern);
    });

    test("uses Unix epoch timestamp for end time", () => {
      const pattern = /iteration_end_time=\$\(date \+%s\)/;
      expect(script).toMatch(pattern);
    });

    test("calculates duration as integer seconds", () => {
      const pattern = /iteration_duration=\$\(\(iteration_end_time - iteration_start_time\)\)/;
      expect(script).toMatch(pattern);
    });

    test("log message includes iteration number", () => {
      const pattern = /log "INFO" "Iteration \$i completed in/;
      expect(script).toMatch(pattern);
    });

    test("log message includes duration in seconds with 's' suffix", () => {
      const pattern = /log "INFO" "Iteration \$i completed in \$\{iteration_duration\}s"/;
      expect(script).toMatch(pattern);
    });
  });

  describe("Integration with Main Loop", () => {
    test("timing variables are scoped to iteration loop", () => {
      const whileIndex = lines.findIndex(line =>
        line.includes('while [[ "$MAX" -eq -1 ]]')
      );
      const startTimeIndex = lines.findIndex(line =>
        line.includes("iteration_start_time=$(date +%s)")
      );
      const doneIndex = lines.findIndex(line =>
        line.trim() === "done" && line.length === 4
      );

      expect(whileIndex).toBeGreaterThan(-1);
      expect(startTimeIndex).toBeGreaterThan(whileIndex);
      expect(doneIndex).toBeGreaterThan(startTimeIndex);
    });

    test("timing log appears before sleep in iteration", () => {
      const logIndex = lines.findIndex(line =>
        line.includes('log "INFO" "Iteration $i completed in')
      );
      const sleepIndex = lines.findIndex(line =>
        line.trim() === 'sleep "$SLEEP"'
      );

      expect(logIndex).toBeGreaterThan(-1);
      expect(sleepIndex).toBeGreaterThan(-1);
      expect(logIndex).toBeLessThan(sleepIndex);
    });

    test("end time calculation appears before duration calculation", () => {
      const endTimeIndex = lines.findIndex(line =>
        line.includes("iteration_end_time=$(date +%s)")
      );
      const durationIndex = lines.findIndex(line =>
        line.includes("iteration_duration=$((iteration_end_time - iteration_start_time))")
      );

      expect(endTimeIndex).toBeGreaterThan(-1);
      expect(durationIndex).toBeGreaterThan(-1);
      expect(endTimeIndex).toBeLessThan(durationIndex);
    });

    test("timing log appears after duration calculation", () => {
      const durationIndex = lines.findIndex(line =>
        line.includes("iteration_duration=$((iteration_end_time - iteration_start_time))")
      );
      const logIndex = lines.findIndex(line =>
        line.includes('log "INFO" "Iteration $i completed in')
      );

      expect(durationIndex).toBeGreaterThan(-1);
      expect(logIndex).toBeGreaterThan(-1);
      expect(logIndex).toBeGreaterThan(durationIndex);
    });
  });

  describe("Task 2 Requirements", () => {
    test("records start time at iteration begin", () => {
      // Start time should be recorded early in the iteration
      const pattern = /iteration_start_time=\$\(date \+%s\)/;
      expect(script).toMatch(pattern);
    });

    test("logs duration at iteration end with correct format", () => {
      // Format: [INFO] Iteration $i completed in ${duration}s
      const pattern = /log "INFO" "Iteration \$i completed in \$\{iteration_duration\}s"/;
      expect(script).toMatch(pattern);
    });

    test("duration value is calculated correctly", () => {
      // Duration = end_time - start_time
      const pattern = /iteration_duration=\$\(\(iteration_end_time - iteration_start_time\)\)/;
      expect(script).toMatch(pattern);
    });

    test("all timing variables are properly named", () => {
      expect(script).toMatch(/iteration_start_time/);
      expect(script).toMatch(/iteration_end_time/);
      expect(script).toMatch(/iteration_duration/);
    });
  });

  describe("Edge Cases", () => {
    test("timing variables use consistent naming convention", () => {
      const startMatches = script.match(/iteration_start_time/g);
      const endMatches = script.match(/iteration_end_time/g);
      const durationMatches = script.match(/iteration_duration/g);

      expect(startMatches).not.toBeNull();
      expect(endMatches).not.toBeNull();
      expect(durationMatches).not.toBeNull();

      expect(startMatches!.length).toBeGreaterThanOrEqual(1);
      expect(endMatches!.length).toBeGreaterThanOrEqual(1);
      expect(durationMatches!.length).toBeGreaterThanOrEqual(1);
    });

    test("uses arithmetic expansion for duration calculation", () => {
      // Should use $((...)) not expr or bc
      const pattern = /\$\(\(iteration_end_time - iteration_start_time\)\)/;
      expect(script).toMatch(pattern);
    });

    test("timing does not interfere with sleep command", () => {
      const sleepPattern = /sleep "\$SLEEP"/;
      expect(script).toMatch(sleepPattern);

      // Verify sleep is on its own line, not combined with timing
      const sleepLine = lines.find(line => line.trim() === 'sleep "$SLEEP"');
      expect(sleepLine).toBeDefined();
    });
  });

  describe("End-to-End Behavior", () => {
    test("complete timing flow is present in correct order", () => {
      const startTimeIndex = lines.findIndex(line =>
        line.includes("iteration_start_time=$(date +%s)")
      );
      const endTimeIndex = lines.findIndex(line =>
        line.includes("iteration_end_time=$(date +%s)")
      );
      const durationIndex = lines.findIndex(line =>
        line.includes("iteration_duration=$((iteration_end_time - iteration_start_time))")
      );
      const logIndex = lines.findIndex(line =>
        line.includes('log "INFO" "Iteration $i completed in')
      );

      expect(startTimeIndex).toBeLessThan(endTimeIndex);
      expect(endTimeIndex).toBeLessThan(durationIndex);
      expect(durationIndex).toBeLessThan(logIndex);
    });

    test("timing log format matches specification exactly", () => {
      // Specification: [INFO] Iteration $i completed in ${duration}s
      const pattern = /log "INFO" "Iteration \$i completed in \$\{iteration_duration\}s"/;
      expect(script).toMatch(pattern);
    });

    test("timing measurements are in seconds unit", () => {
      // date +%s gives seconds since epoch
      expect(script).toMatch(/date \+%s/);
      // Log message uses 's' suffix
      expect(script).toMatch(/\$\{iteration_duration\}s"/);
    });
  });
});
