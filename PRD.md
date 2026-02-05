# PRD: Pre-flight Test Baseline + Smarter Self-Healing

## Problem

When tests are already failing before Ralph starts (pre-existing failures unrelated to PRD tasks), Ralph's self-healing loop wastes iterations trying to "fix" failures he didn't cause, then exits after MAX_CONSECUTIVE_FAILURES.

**Current behavior:**
1. Ralph implements a task
2. ralph.sh runs full test suite
3. Pre-existing test failures trigger fix mode
4. Ralph burns 3 iterations confused about failures he didn't cause
5. Exits with error — blocks all PRD work

**Expected behavior:**
Ralph should detect pre-existing failures, handle them separately, and not let them block PRD task work.

## Tasks

- [x] **Task 1: Pre-flight test baseline** — Before iteration 1, run the test suite and capture results. Store which tests were already failing (test names + exit code) in a variable/temp file. Log the baseline to the progress file so Ralph has context.

- [x] **Task 2: Differential test verification** — Change the test verification gate to compare against the baseline. A verification PASSES if no NEW test failures appear (tests that weren't already failing). Pre-existing failures are ignored during per-iteration checks. Use test output parsing to compare failing test names, not just exit codes.

- [x] **Task 3: Optional pre-existing failure fix iteration** — If the pre-flight baseline has failures, inject an automatic "fix pre-existing test failures" iteration BEFORE starting PRD tasks. This iteration gets the fix-tests prompt with the baseline output. If it fixes them, great — update the baseline. If it can't fix them after MAX_CONSECUTIVE_FAILURES attempts, log a warning and proceed with PRD tasks anyway (using differential verification from Task 2).

- [x] **Task 4: Update progress file logging** — When pre-existing failures are detected, log them clearly to the progress file at session start: "Pre-existing test failures detected: [list]. These will not block PRD work. Attempting auto-fix first."

- [x] **Task 5: Tests for the new behavior** — Add test cases (can be shell-based or a test script) covering: (a) pre-flight detects existing failures, (b) differential verification passes when only pre-existing tests fail, (c) differential verification fails when a new test breaks, (d) auto-fix iteration runs before PRD tasks.
