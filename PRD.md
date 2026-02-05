# PRD: Ralph Logging Improvements

## Context
Ralph processes get SIGKILL'd unexpectedly with no diagnostic information in logs. Need better visibility into process state and resource usage to diagnose failures post-mortem.

## Goals
1. Log resource usage at each iteration start
2. Capture Claude Code exit codes and last output on failure
3. Trap catchable signals and log state before exit
4. Track iteration timing to identify hangs

## Non-Goals
- Can't trap SIGKILL (impossible by design)
- Not implementing external watchdog monitoring (separate concern)

## Tasks

### Phase 1: Core Logging Infrastructure
- [x] **Task 1:** Add `log_resources()` function that logs memory usage and system load
  - Log format: `[INFO] Resources: Memory ${used}/${total}MB, Load: ${load}`
  - Call at the start of each iteration
  - Test: Verify resource log line appears in output

- [x] **Task 2:** Add iteration timing
  - Record start time at iteration begin
  - Log duration at iteration end: `[INFO] Iteration $i completed in ${duration}s`
  - Test: Verify timing log appears with reasonable duration value

### Phase 2: Error Capture
- [ ] **Task 3:** Capture Claude Code exit code
  - Store exit code after claude command completes
  - On non-zero exit: log `[ERROR] Claude Code exited with code $exit_code`
  - On non-zero exit: log last 500 chars of output
  - Test: Simulate non-zero exit and verify error logging

- [ ] **Task 4:** Add signal trapping for graceful shutdown
  - Trap SIGTERM, SIGINT, SIGHUP
  - On signal: log `[WARN] Received signal: $signal`
  - On signal: log current iteration number and task name
  - Test: Send SIGTERM to process and verify signal log appears

### Phase 3: State Persistence
- [ ] **Task 5:** Save iteration state for resume capability
  - On each iteration start: write current iteration to `$STATE_DIR/last_iteration`
  - On each iteration start: write current task to `$STATE_DIR/last_task`
  - On signal: state is already saved, log points to it
  - Test: Verify state files are created and contain correct values

## Acceptance Criteria
- All tests pass
- Resource logging appears at each iteration
- Timing logging appears at each iteration end
- Non-zero exits are logged with context
- Trapped signals are logged with state info
- No regressions in existing functionality
