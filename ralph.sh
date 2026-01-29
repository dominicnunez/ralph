#!/bin/bash
set -e

# ─────────────────────────────────────────────────────────────
# Ralph - Unified AI Coding Agent Runner
# Supports both Claude Code and OpenCode engines
# ─────────────────────────────────────────────────────────────

# Determine script directory for config file location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/ralph.env"

# Get project name from current directory
PROJECT_NAME=$(basename "$(pwd)")

# Log directory and file (external to project)
LOG_DIR="${RALPH_LOG_DIR:-$HOME/.ralph/logs}"
LOG_FILE="$LOG_DIR/ralph-${PROJECT_NAME}.log"

# ─────────────────────────────────────────────────────────────
# PRESERVE ENVIRONMENT OVERRIDES BEFORE SOURCING CONFIG
# ─────────────────────────────────────────────────────────────

ENV_ENGINE=${ENGINE-}
ENV_MAX_ITERATIONS=${MAX_ITERATIONS-}
ENV_SLEEP_SECONDS=${SLEEP_SECONDS-}
ENV_SKIP_COMMIT=${SKIP_COMMIT-}

# Claude settings
ENV_CLAUDE_MODEL=${CLAUDE_MODEL-}

# OpenCode settings
ENV_OPENCODE_MODEL=${OPENCODE_MODEL-}
ENV_FALLBACK_MODEL=${FALLBACK_MODEL-}

# Test settings
ENV_TEST_CMD=${TEST_CMD-}
ENV_SKIP_TEST_VERIFY=${SKIP_TEST_VERIFY-}

# ─────────────────────────────────────────────────────────────
# LOAD CONFIG FILE
# ─────────────────────────────────────────────────────────────

if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# ─────────────────────────────────────────────────────────────
# RESTORE ENVIRONMENT OVERRIDES (env vars take precedence)
# ─────────────────────────────────────────────────────────────

[[ -n "$ENV_ENGINE" ]] && ENGINE="$ENV_ENGINE"
[[ -n "$ENV_MAX_ITERATIONS" ]] && MAX_ITERATIONS="$ENV_MAX_ITERATIONS"
[[ -n "$ENV_SLEEP_SECONDS" ]] && SLEEP_SECONDS="$ENV_SLEEP_SECONDS"
[[ -n "$ENV_SKIP_COMMIT" ]] && SKIP_COMMIT="$ENV_SKIP_COMMIT"
[[ -n "$ENV_CLAUDE_MODEL" ]] && CLAUDE_MODEL="$ENV_CLAUDE_MODEL"
[[ -n "$ENV_OPENCODE_MODEL" ]] && OPENCODE_MODEL="$ENV_OPENCODE_MODEL"
[[ -n "$ENV_FALLBACK_MODEL" ]] && FALLBACK_MODEL="$ENV_FALLBACK_MODEL"
[[ -n "$ENV_TEST_CMD" ]] && TEST_CMD="$ENV_TEST_CMD"
[[ -n "$ENV_SKIP_TEST_VERIFY" ]] && SKIP_TEST_VERIFY="$ENV_SKIP_TEST_VERIFY"

# ─────────────────────────────────────────────────────────────
# SET DEFAULTS
# ─────────────────────────────────────────────────────────────

ENGINE=${ENGINE:-opencode}
MAX=${MAX_ITERATIONS:-10}
SLEEP=${SLEEP_SECONDS:-2}
SKIP_COMMIT=${SKIP_COMMIT:-0}
SKIP_TEST_VERIFY=${SKIP_TEST_VERIFY:-0}

# Claude defaults
CLAUDE_MODEL=${CLAUDE_MODEL:-opus}

# OpenCode defaults
OPENCODE_MODEL=${OPENCODE_MODEL:-big-pickle}
FALLBACK_MODEL=${FALLBACK_MODEL:-}

# Track which model is currently active (for OpenCode fallback)
CURRENT_OPENCODE_MODEL="$OPENCODE_MODEL"
USING_FALLBACK=0

COMPLETE_MARKER="<promise>COMPLETE</promise>"

# ─────────────────────────────────────────────────────────────
# VALIDATE ENGINE
# ─────────────────────────────────────────────────────────────

case "$ENGINE" in
    claude|opencode)
        ;;
    *)
        echo "Error: Invalid ENGINE '$ENGINE'. Must be 'claude' or 'opencode'." >&2
        exit 1
        ;;
esac

# Check if the selected engine's CLI is available
if [[ "$ENGINE" == "claude" ]]; then
    if ! command -v claude &>/dev/null; then
        echo "Error: 'claude' command not found. Please install Claude CLI." >&2
        exit 1
    fi
elif [[ "$ENGINE" == "opencode" ]]; then
    if ! command -v opencode &>/dev/null; then
        echo "Error: 'opencode' command not found. Please install OpenCode CLI." >&2
        exit 1
    fi
fi

# ─────────────────────────────────────────────────────────────
# LOGGING FUNCTIONS
# ─────────────────────────────────────────────────────────────

setup_logging() {
    mkdir -p "$LOG_DIR"
    echo "" >> "$LOG_FILE"
    echo "═══════════════════════════════════════════════════════════════" >> "$LOG_FILE"
    echo "  Ralph Session Started: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
    echo "  Project: $PROJECT_NAME" >> "$LOG_FILE"
    echo "  Engine: $ENGINE" >> "$LOG_FILE"
    if [[ "$ENGINE" == "claude" ]]; then
        echo "  Model: $CLAUDE_MODEL" >> "$LOG_FILE"
    else
        echo "  Model: $OPENCODE_MODEL" >> "$LOG_FILE"
    fi
    echo "═══════════════════════════════════════════════════════════════" >> "$LOG_FILE"
}

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Also print to stdout for certain levels
    case "$level" in
        ERROR|WARN)
            echo "[$level] $message"
            ;;
    esac
}

log_iteration() {
    local iteration="$1"
    local task="$2"
    echo "" >> "$LOG_FILE"
    echo "───────────────────────────────────────────────────────────────" >> "$LOG_FILE"
    echo "  Iteration $iteration - $(date '+%H:%M:%S')" >> "$LOG_FILE"
    echo "  Task: $task" >> "$LOG_FILE"
    echo "───────────────────────────────────────────────────────────────" >> "$LOG_FILE"
}

# ─────────────────────────────────────────────────────────────
# TEST COMMAND DETECTION
# ─────────────────────────────────────────────────────────────

detect_test_cmd() {
    # If explicitly configured, use that
    if [[ -n "$TEST_CMD" ]]; then
        echo "$TEST_CMD"
        return
    fi
    
    # Auto-detect based on project files
    if [[ -f "package.json" ]]; then
        if grep -q '"test"' package.json 2>/dev/null; then
            if [[ -f "bun.lockb" ]]; then
                echo "bun test"
            elif [[ -f "pnpm-lock.yaml" ]]; then
                echo "pnpm test"
            elif [[ -f "yarn.lock" ]]; then
                echo "yarn test"
            else
                echo "npm test"
            fi
            return
        fi
    fi
    
    # Check for common test runners directly
    if [[ -f "vitest.config.ts" ]] || [[ -f "vitest.config.js" ]]; then
        echo "npx vitest run"
        return
    fi
    
    if [[ -f "jest.config.ts" ]] || [[ -f "jest.config.js" ]]; then
        echo "npx jest"
        return
    fi
    
    # Python
    if [[ -f "pytest.ini" ]] || [[ -f "pyproject.toml" ]]; then
        echo "pytest"
        return
    fi
    
    # Go
    if [[ -f "go.mod" ]]; then
        echo "go test ./..."
        return
    fi
    
    # Rust
    if [[ -f "Cargo.toml" ]]; then
        echo "cargo test"
        return
    fi
    
    echo ""
}

# ─────────────────────────────────────────────────────────────
# TEST VERIFICATION
# ─────────────────────────────────────────────────────────────

verify_tests_written() {
    # Get the last commit (or staged changes if no commits yet)
    local test_changes=""
    
    # Check for test files in staged/unstaged changes
    test_changes=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(test|spec)\.(ts|js|tsx|jsx|py)$' || true)
    
    # Also check staged files
    local staged_tests=$(git diff --cached --name-only 2>/dev/null | grep -E '\.(test|spec)\.(ts|js|tsx|jsx|py)$' || true)
    
    # Combine
    if [[ -n "$staged_tests" ]]; then
        test_changes="$test_changes"$'\n'"$staged_tests"
    fi
    
    # Also check for test files in recent commits (in case AI committed)
    local recent_test_commits=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | grep -E '\.(test|spec)\.(ts|js|tsx|jsx|py)$' || true)
    if [[ -n "$recent_test_commits" ]]; then
        test_changes="$test_changes"$'\n'"$recent_test_commits"
    fi
    
    # Remove empty lines and duplicates
    test_changes=$(echo "$test_changes" | grep -v '^$' | sort -u)
    
    if [[ -z "$test_changes" ]]; then
        log "WARN" "No test files were created or modified"
        echo "❌ No test files were created or modified this iteration"
        return 1
    fi
    
    log "INFO" "Test files changed: $(echo "$test_changes" | tr '\n' ', ')"
    echo "✅ Test files changed:"
    echo "$test_changes" | sed 's/^/   /'
    return 0
}

run_tests() {
    local test_cmd="$1"
    
    if [[ -z "$test_cmd" ]]; then
        log "WARN" "No test command detected, skipping verification"
        echo "⚠️  No test command detected, skipping verification"
        return 0
    fi
    
    echo ""
    echo "🧪 Running test verification: $test_cmd"
    echo "-------------------------------------------"
    log "INFO" "Running tests: $test_cmd"
    
    set +e
    local test_output
    test_output=$(eval "$test_cmd" 2>&1)
    local exit_code=$?
    set -e
    
    echo "$test_output"
    echo "-------------------------------------------"
    
    # Log test output (truncated)
    echo "$test_output" | tail -20 >> "$LOG_FILE"
    
    if [[ $exit_code -eq 0 ]]; then
        log "INFO" "Tests passed"
        echo "✅ Tests passed!"
        return 0
    else
        log "ERROR" "Tests failed (exit code: $exit_code)"
        echo "❌ Tests failed (exit code: $exit_code)"
        return 1
    fi
}

get_current_task() {
    # Extract the first incomplete task from PRD.md
    if [[ -f "PRD.md" ]]; then
        grep -m1 -E '^\s*-\s*\[ \]' PRD.md 2>/dev/null | sed 's/^\s*-\s*\[ \]\s*//' || echo "unknown"
    else
        echo "unknown"
    fi
}

# ─────────────────────────────────────────────────────────────
# RATE LIMIT HANDLING (OpenCode only)
# ─────────────────────────────────────────────────────────────

is_rate_limited() {
    local output="$1"
    echo "$output" | grep -qiE 'rate.?limit|quota|429|too.?many.?request|exhausted|overloaded|capacity'
}

switch_to_fallback() {
    if [[ -n "$FALLBACK_MODEL" && "$USING_FALLBACK" -eq 0 ]]; then
        echo ""
        echo "==========================================="
        echo "  Rate limit detected on $CURRENT_OPENCODE_MODEL"
        echo "  Switching to fallback: $FALLBACK_MODEL"
        echo "==========================================="
        echo ""
        log "WARN" "Rate limit on $CURRENT_OPENCODE_MODEL, switching to $FALLBACK_MODEL"
        CURRENT_OPENCODE_MODEL="$FALLBACK_MODEL"
        USING_FALLBACK=1
        return 0
    fi
    return 1
}

# ─────────────────────────────────────────────────────────────
# PROMPT
# ─────────────────────────────────────────────────────────────

if [[ "$SKIP_COMMIT" == "1" ]]; then
    COMMIT_INSTRUCTIONS=$(cat <<'EOF'
- If tests PASS:
  - Update PRD.md to mark the task complete (change [ ] to [x])
  - Do NOT commit any changes in this run
  - Append what worked to progress.txt
EOF
)
else
    COMMIT_INSTRUCTIONS=$(cat <<'EOF'
- If tests PASS:
  - Update PRD.md to mark the task complete (change [ ] to [x])
  - Commit your changes with message: feat: [task description] (do NOT add Co-Authored-By)
  - Append what worked to progress.txt
EOF
)
fi

PROMPT=$(cat <<EOF
You are Ralph, an autonomous coding agent. Do exactly ONE task per iteration.

## Steps

1. Read PRD.md and find the first task that is NOT complete (marked [ ]).
2. Read progress.txt - check the Learnings section first for patterns from previous iterations.
3. Implement that ONE task only.
4. **CRITICAL: You MUST write tests for your implementation.**
5. **CRITICAL: You MUST run tests and ensure ALL tests pass.**

## Test Requirement (MANDATORY)

You MUST:
- Create or modify a test file (e.g., *.test.ts, *.spec.ts)
- Write at least one test for the feature you implement
- Run the full test suite
- Verify ALL tests pass before marking the task complete

If you do not write tests, the task will be rejected and you must try again.

## Only Complete If Tests Pass

$COMMIT_INSTRUCTIONS

- If tests FAIL:
  - Do NOT mark the task complete
  - Do NOT commit broken code
  - Append what went wrong to progress.txt (so next iteration can learn)

## Progress Notes Format

Append to progress.txt using this format:

## Iteration [N] - [Task Name]
- What was implemented
- Test file created/modified: [filename]
- Tests written: [brief description]
- Test results: PASS/FAIL
- Files changed
- Learnings for future iterations
---

## Update AGENTS.md (If Applicable)

If you discover a reusable pattern that future work should know about:
- Check if AGENTS.md exists in the project root
- Add patterns like: 'This codebase uses X for Y' or 'Always do Z when changing W'
- Only add genuinely reusable knowledge, not task-specific details

## End Condition

After completing your task, check PRD.md:
- If ALL tasks are [x], output exactly: $COMPLETE_MARKER
- If tasks remain [ ], just end your response (next iteration will continue)
EOF
)

# ─────────────────────────────────────────────────────────────
# RUN ENGINE
# ─────────────────────────────────────────────────────────────

run_claude() {
    claude --model "$CLAUDE_MODEL" --dangerously-skip-permissions -p "$PROMPT"
}

run_opencode() {
    opencode run --model "$CURRENT_OPENCODE_MODEL" "$PROMPT"
}

run_engine() {
    if [[ "$ENGINE" == "claude" ]]; then
        run_claude
    else
        run_opencode
    fi
}

# ─────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────

# Setup logging
setup_logging

# Detect test command at startup
DETECTED_TEST_CMD=$(detect_test_cmd)

# Print startup info
if [[ "$MAX" -eq -1 ]]; then
    echo "Starting Ralph ($ENGINE) - Infinite mode (until complete)"
else
    echo "Starting Ralph ($ENGINE) - Max $MAX iterations"
fi

if [[ "$ENGINE" == "claude" ]]; then
    echo "Using model: $CLAUDE_MODEL"
else
    echo "Using model: $OPENCODE_MODEL"
    [[ -n "$FALLBACK_MODEL" ]] && echo "Fallback model: $FALLBACK_MODEL"
fi

[[ "$SKIP_COMMIT" == "1" ]] && echo "Commits disabled for this run"

if [[ "$SKIP_TEST_VERIFY" == "1" ]]; then
    echo "⚠️  Test verification DISABLED"
    log "WARN" "Test verification disabled"
elif [[ -n "$DETECTED_TEST_CMD" ]]; then
    echo "🧪 Test command: $DETECTED_TEST_CMD"
    log "INFO" "Test command: $DETECTED_TEST_CMD"
else
    echo "⚠️  No test command detected (configure TEST_CMD in ralph.env)"
    log "WARN" "No test command detected"
fi

echo "📝 Log file: $LOG_FILE"
echo ""

i=0
consecutive_failures=0
MAX_CONSECUTIVE_FAILURES=3

while [[ "$MAX" -eq -1 ]] || [[ "$i" -lt "$MAX" ]]; do
    ((++i))
    
    current_task=$(get_current_task)
    log_iteration "$i" "$current_task"
    
    # Build display model name
    if [[ "$ENGINE" == "claude" ]]; then
        display_model="$CLAUDE_MODEL"
    else
        display_model="$CURRENT_OPENCODE_MODEL"
    fi
    
    if [[ "$MAX" -eq -1 ]]; then
        echo "==========================================="
        echo "  Iteration $i (infinite mode) - $display_model"
        echo "  Task: $current_task"
        echo "==========================================="
    else
        echo "==========================================="
        echo "  Iteration $i of $MAX - $display_model"
        echo "  Task: $current_task"
        echo "==========================================="
    fi

    # Run AI agent
    set +e
    tmpfile=$(mktemp)
    run_engine 2>&1 | tee "$tmpfile"
    exit_code=${PIPESTATUS[0]}
    result=$(cat "$tmpfile")
    rm -f "$tmpfile"
    set -e
    
    # Log AI output (truncated)
    echo "$result" | head -50 >> "$LOG_FILE"
    echo "[... truncated ...]" >> "$LOG_FILE"

    # Handle errors (rate limiting for OpenCode)
    if [[ $exit_code -ne 0 ]]; then
        if [[ "$ENGINE" == "opencode" ]] && is_rate_limited "$result"; then
            if switch_to_fallback; then
                ((--i))
                continue
            else
                log "ERROR" "Rate limit and no fallback available"
                echo "Rate limit error and no fallback available"
                exit 1
            fi
        else
            log "ERROR" "$ENGINE failed with exit code $exit_code"
            echo "Error from $ENGINE (exit code $exit_code)"
            exit $exit_code
        fi
    fi

    echo ""

    # ─────────────────────────────────────────────────────────
    # TEST VERIFICATION GATE
    # ─────────────────────────────────────────────────────────
    
    if [[ "$SKIP_TEST_VERIFY" != "1" ]]; then
        verification_failed=0
        
        # Step 1: Verify tests were written
        if [[ -n "$DETECTED_TEST_CMD" ]]; then
            echo ""
            echo "📋 Checking if tests were written..."
            if ! verify_tests_written; then
                log "WARN" "No tests written, iteration failed"
                verification_failed=1
                
                # Append to progress.txt so AI knows
                echo "" >> progress.txt
                echo "## FAILED - Iteration $i" >> progress.txt
                echo "- Reason: No test files were created or modified" >> progress.txt
                echo "- You MUST write tests before the task can be completed" >> progress.txt
                echo "---" >> progress.txt
            fi
        fi
        
        # Step 2: Run tests (only if tests were written or we're checking anyway)
        if [[ $verification_failed -eq 0 ]] && [[ -n "$DETECTED_TEST_CMD" ]]; then
            if ! run_tests "$DETECTED_TEST_CMD"; then
                log "WARN" "Tests failed, iteration failed"
                verification_failed=1
                
                # Append to progress.txt so AI knows
                echo "" >> progress.txt
                echo "## FAILED - Iteration $i" >> progress.txt
                echo "- Reason: Tests failed" >> progress.txt
                echo "- Fix the failing tests before marking the task complete" >> progress.txt
                echo "---" >> progress.txt
            fi
        fi
        
        # Handle verification failure
        if [[ $verification_failed -eq 1 ]]; then
            ((consecutive_failures++))
            echo ""
            echo "⚠️  Verification failed ($consecutive_failures/$MAX_CONSECUTIVE_FAILURES)"
            log "WARN" "Consecutive failures: $consecutive_failures"
            
            if [[ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]]; then
                log "ERROR" "Too many consecutive failures, stopping"
                echo "❌ Too many consecutive failures on this task"
                echo "   Manual intervention required"
                echo "   Check log: $LOG_FILE"
                exit 1
            fi
            
            echo "   Continuing to next iteration to fix..."
            sleep "$SLEEP"
            continue
        fi
        
        # Reset failure counter on success
        consecutive_failures=0
        log "INFO" "Verification passed"
    fi

    # ─────────────────────────────────────────────────────────
    # COMPLETION CHECK
    # ─────────────────────────────────────────────────────────

    if [[ "$result" == *"$COMPLETE_MARKER"* ]]; then
        # Verify 1: Check PRD.md for incomplete tasks
        if [[ -f "PRD.md" ]]; then
            incomplete_count=$(grep -cE '^\s*-\s*\[ \]' PRD.md 2>/dev/null || true)
            if [[ "$incomplete_count" -gt 0 ]]; then
                echo ""
                echo "==========================================="
                echo "  ⚠️  AI claimed complete but $incomplete_count tasks remain"
                echo "  Continuing to next iteration..."
                echo "==========================================="
                log "WARN" "AI claimed complete but $incomplete_count tasks remain"
                sleep "$SLEEP"
                continue
            fi
        fi
        
        # Verify 2: Final test run
        if [[ "$SKIP_TEST_VERIFY" != "1" ]] && [[ -n "$DETECTED_TEST_CMD" ]]; then
            echo ""
            echo "🔒 Final verification: running full test suite..."
            log "INFO" "Final test verification"
            if ! run_tests "$DETECTED_TEST_CMD"; then
                echo ""
                echo "==========================================="
                echo "  ❌ Final tests failed!"
                echo "  Continuing to fix..."
                echo "==========================================="
                log "ERROR" "Final verification failed"
                sleep "$SLEEP"
                continue
            fi
        fi
        
        log "INFO" "All tasks completed successfully!"
        echo "==========================================="
        echo "  ✅ All tasks complete after $i iterations!"
        echo "  ✅ All tests passing!"
        echo "  📝 Log: $LOG_FILE"
        echo "==========================================="
        exit 0
    fi

    sleep "$SLEEP"
done

log "WARN" "Reached max iterations ($MAX)"
echo "==========================================="
echo "  Reached max iterations ($MAX)"
echo "  📝 Log: $LOG_FILE"
echo "==========================================="
exit 1
