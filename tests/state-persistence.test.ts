import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";

const RALPH_SH = "./ralph.sh";

describe("Task 5: State Persistence for Resume Capability", () => {
  const ralphContent = readFileSync(RALPH_SH, "utf-8");

  describe("Code Structure - State Directory Configuration", () => {
    test("STATE_DIR variable is defined", () => {
      expect(ralphContent).toMatch(/STATE_DIR=/);
    });

    test("STATE_DIR uses per-project structure under ~/.ralph/state", () => {
      expect(ralphContent).toMatch(/STATE_DIR="\$HOME\/\.ralph\/state\/\$\{PROJECT_NAME\}"/);
    });

    test("STATE_DIR is created in setup_logging function", () => {
      const setupLoggingMatch = ralphContent.match(/setup_logging\(\)\s*\{[\s\S]*?^\}/m);
      expect(setupLoggingMatch).toBeTruthy();
      const setupLogging = setupLoggingMatch![0];
      expect(setupLogging).toMatch(/mkdir -p "\$STATE_DIR"/);
    });

    test("STATE_DIR mkdir is placed after PROGRESS_DIR mkdir", () => {
      const progressMkdir = ralphContent.indexOf('mkdir -p "$PROGRESS_DIR"');
      const stateMkdir = ralphContent.indexOf('mkdir -p "$STATE_DIR"');
      expect(progressMkdir).toBeGreaterThan(0);
      expect(stateMkdir).toBeGreaterThan(progressMkdir);
    });
  });

  describe("Code Structure - Iteration State Saving", () => {
    test("last_iteration file is written on each iteration start", () => {
      expect(ralphContent).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
    });

    test("last_task file is written on each iteration start", () => {
      expect(ralphContent).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
    });

    test("state saving happens after current_task is retrieved", () => {
      const currentTaskLine = ralphContent.indexOf("current_task=$(get_current_task)");
      const lastIterationLine = ralphContent.indexOf('echo "$i" > "$STATE_DIR/last_iteration"');
      expect(currentTaskLine).toBeGreaterThan(0);
      expect(lastIterationLine).toBeGreaterThan(currentTaskLine);
    });

    test("state saving happens before log_iteration", () => {
      const lastIterationLine = ralphContent.indexOf('echo "$i" > "$STATE_DIR/last_iteration"');
      const logIterationLine = ralphContent.indexOf('log_iteration "$i" "$current_task"');
      expect(lastIterationLine).toBeGreaterThan(0);
      expect(logIterationLine).toBeGreaterThan(lastIterationLine);
    });

    test("state files are saved together (consecutive lines)", () => {
      const lastIterationMatch = ralphContent.match(/echo "\$i" > "\$STATE_DIR\/last_iteration"\s+echo "\$current_task" > "\$STATE_DIR\/last_task"/);
      expect(lastIterationMatch).toBeTruthy();
    });
  });

  describe("Code Structure - Signal Handler Integration", () => {
    test("handle_signal function exists", () => {
      expect(ralphContent).toMatch(/handle_signal\(\)\s*\{/);
    });

    test("handle_signal logs state directory location", () => {
      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      expect(handleSignalMatch).toBeTruthy();
      const handleSignal = handleSignalMatch![0];
      expect(handleSignal).toMatch(/log "INFO" "State saved in: \$STATE_DIR"/);
    });

    test("state directory log comes after current task logging", () => {
      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      expect(handleSignalMatch).toBeTruthy();
      const handleSignal = handleSignalMatch![0];
      const currentTaskPos = handleSignal.indexOf('log "WARN" "Current task:');
      const stateDirPos = handleSignal.indexOf('log "INFO" "State saved in:');
      expect(currentTaskPos).toBeGreaterThan(0);
      expect(stateDirPos).toBeGreaterThan(currentTaskPos);
    });

    test("state directory log comes before exit", () => {
      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      expect(handleSignalMatch).toBeTruthy();
      const handleSignal = handleSignalMatch![0];
      const stateDirPos = handleSignal.indexOf('log "INFO" "State saved in:');
      const exitPos = handleSignal.indexOf('exit 130');
      expect(stateDirPos).toBeGreaterThan(0);
      expect(exitPos).toBeGreaterThan(stateDirPos);
    });
  });

  describe("State File Format Verification", () => {
    test("last_iteration file contains only iteration number", () => {
      // File should contain: echo "$i" > file (not echo "iteration: $i")
      const iterationWrite = ralphContent.match(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      expect(iterationWrite).toBeTruthy();
      // Verify there's no prefix like "iteration:" before $i
      expect(iterationWrite![0]).toBe('echo "$i" > "$STATE_DIR/last_iteration"');
    });

    test("last_task file contains only task description", () => {
      // File should contain: echo "$current_task" > file (not echo "task: $current_task")
      const taskWrite = ralphContent.match(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
      expect(taskWrite).toBeTruthy();
      // Verify there's no prefix like "task:" before $current_task
      expect(taskWrite![0]).toBe('echo "$current_task" > "$STATE_DIR/last_task"');
    });

    test("state files use redirect (>) not append (>>)", () => {
      expect(ralphContent).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      expect(ralphContent).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
      // Should not have >>
      expect(ralphContent).not.toMatch(/echo "\$i" >> "\$STATE_DIR\/last_iteration"/);
      expect(ralphContent).not.toMatch(/echo "\$current_task" >> "\$STATE_DIR\/last_task"/);
    });
  });

  describe("Task 5 Requirements Verification", () => {
    test("Requirement 1: Write current iteration to STATE_DIR/last_iteration", () => {
      expect(ralphContent).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
    });

    test("Requirement 2: Write current task to STATE_DIR/last_task", () => {
      expect(ralphContent).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
    });

    test("Requirement 3: State is saved on each iteration start", () => {
      // Verify state saving is in main loop after current_task retrieval
      const mainLoopMatch = ralphContent.match(/while \[\[.*MAX.*\]\][\s\S]{1,5000}?log_resources/);
      expect(mainLoopMatch).toBeTruthy();
      const mainLoop = mainLoopMatch![0];
      expect(mainLoop).toMatch(/current_task=\$\(get_current_task\)/);
      expect(mainLoop).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      expect(mainLoop).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
    });

    test("Requirement 4: Signal handler references state directory", () => {
      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      expect(handleSignalMatch).toBeTruthy();
      const handleSignal = handleSignalMatch![0];
      expect(handleSignal).toMatch(/\$STATE_DIR/);
    });

    test("All PRD requirements are met", () => {
      // Per PRD: save iteration state for resume capability
      // - On each iteration start: write current iteration to $STATE_DIR/last_iteration
      // - On each iteration start: write current task to $STATE_DIR/last_task
      // - On signal: state is already saved, log points to it
      expect(ralphContent).toMatch(/STATE_DIR=/);
      expect(ralphContent).toMatch(/mkdir -p "\$STATE_DIR"/);
      expect(ralphContent).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      expect(ralphContent).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);

      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      expect(handleSignalMatch).toBeTruthy();
      expect(handleSignalMatch![0]).toMatch(/State saved in: \$STATE_DIR/);
    });
  });

  describe("Integration with Main Loop", () => {
    test("State saving is scoped within main loop", () => {
      const mainLoopMatch = ralphContent.match(/while \[\[.*MAX.*\]\][\s\S]{1,5000}?log_resources/);
      expect(mainLoopMatch).toBeTruthy();
      const mainLoop = mainLoopMatch![0];
      expect(mainLoop).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      expect(mainLoop).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
    });

    test("State saving uses correct variable names", () => {
      // Should use $i (iteration counter) not $iteration
      expect(ralphContent).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      // Should use $current_task (from get_current_task) not $task
      expect(ralphContent).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);
    });

    test("State directory is defined early in script", () => {
      const stateDirPos = ralphContent.indexOf('STATE_DIR=');
      const setupLoggingPos = ralphContent.indexOf('setup_logging()');
      expect(stateDirPos).toBeGreaterThan(0);
      expect(setupLoggingPos).toBeGreaterThan(stateDirPos);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("STATE_DIR uses PROJECT_NAME variable", () => {
      expect(ralphContent).toMatch(/STATE_DIR=.*\$\{PROJECT_NAME\}/);
    });

    test("State files use absolute paths via STATE_DIR", () => {
      // Should not use relative paths like ./state/
      expect(ralphContent).toMatch(/"\$STATE_DIR\/last_iteration"/);
      expect(ralphContent).toMatch(/"\$STATE_DIR\/last_task"/);
    });

    test("State directory comment indicates resume capability", () => {
      const stateDirMatch = ralphContent.match(/# State.*\n.*STATE_DIR=/);
      expect(stateDirMatch).toBeTruthy();
      expect(stateDirMatch![0]).toMatch(/resume/i);
    });
  });

  describe("End-to-End Flow Verification", () => {
    test("Complete state persistence flow is implemented", () => {
      // 1. STATE_DIR defined
      expect(ralphContent).toMatch(/STATE_DIR="\$HOME\/\.ralph\/state\/\$\{PROJECT_NAME\}"/);

      // 2. Directory created in setup
      expect(ralphContent).toMatch(/mkdir -p "\$STATE_DIR"/);

      // 3. State saved on each iteration
      expect(ralphContent).toMatch(/echo "\$i" > "\$STATE_DIR\/last_iteration"/);
      expect(ralphContent).toMatch(/echo "\$current_task" > "\$STATE_DIR\/last_task"/);

      // 4. Signal handler references state
      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      expect(handleSignalMatch![0]).toMatch(/State saved in: \$STATE_DIR/);
    });

    test("State files location follows convention", () => {
      // Pattern matches other directories: LOG_DIR, PROGRESS_DIR, STATE_DIR
      expect(ralphContent).toMatch(/LOG_DIR="\$\{RALPH_LOG_DIR:-\$HOME\/\.ralph\/logs\}"/);
      expect(ralphContent).toMatch(/PROGRESS_DIR="\$HOME\/\.ralph\/progress"/);
      expect(ralphContent).toMatch(/STATE_DIR="\$HOME\/\.ralph\/state\/\$\{PROJECT_NAME\}"/);
    });

    test("PRD specification compliance", () => {
      // Per PRD Task 5:
      // - Save iteration state for resume capability ✓
      // - On each iteration start: write current iteration to $STATE_DIR/last_iteration ✓
      // - On each iteration start: write current task to $STATE_DIR/last_task ✓
      // - On signal: state is already saved, log points to it ✓

      const hasStateDir = ralphContent.includes('STATE_DIR=');
      const hasStateDirCreation = ralphContent.includes('mkdir -p "$STATE_DIR"');
      const hasIterationSave = ralphContent.includes('echo "$i" > "$STATE_DIR/last_iteration"');
      const hasTaskSave = ralphContent.includes('echo "$current_task" > "$STATE_DIR/last_task"');

      const handleSignalMatch = ralphContent.match(/handle_signal\(\)\s*\{[\s\S]*?^}/m);
      const hasSignalReference = handleSignalMatch && handleSignalMatch[0].includes('$STATE_DIR');

      expect(hasStateDir).toBe(true);
      expect(hasStateDirCreation).toBe(true);
      expect(hasIterationSave).toBe(true);
      expect(hasTaskSave).toBe(true);
      expect(hasSignalReference).toBe(true);
    });
  });
});
