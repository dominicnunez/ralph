#!/bin/bash
set -e

if ! command -v opencode &>/dev/null; then
    echo "Error: 'opencode' command not found. Please install OpenCode CLI." >&2
    exit 1
fi

# Determine script directory for config file location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/ralph.env"

# Preserve environment overrides before sourcing config
# NOTE: Env var overrides are intentionally undocumented in README.
# This is a power-user feature for one-off runs.
ENV_MAX_ITERATIONS=${MAX_ITERATIONS-}
ENV_SLEEP_SECONDS=${SLEEP_SECONDS-}
ENV_SKIP_COMMIT=${SKIP_COMMIT-}
ENV_PRIMARY_MODEL=${PRIMARY_MODEL-}
ENV_PRIMARY_MODEL_REASONING=${PRIMARY_MODEL_REASONING-}
ENV_FALLBACK_MODEL=${FALLBACK_MODEL-}
ENV_FALLBACK_MODEL_REASONING=${FALLBACK_MODEL_REASONING-}

# Load config file if it exists
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Restore environment overrides (env vars take precedence over config)
if [[ -n "$ENV_MAX_ITERATIONS" ]]; then
    MAX_ITERATIONS="$ENV_MAX_ITERATIONS"
fi
if [[ -n "$ENV_SLEEP_SECONDS" ]]; then
    SLEEP_SECONDS="$ENV_SLEEP_SECONDS"
fi
if [[ -n "$ENV_SKIP_COMMIT" ]]; then
    SKIP_COMMIT="$ENV_SKIP_COMMIT"
fi
if [[ -n "$ENV_PRIMARY_MODEL" ]]; then
    PRIMARY_MODEL="$ENV_PRIMARY_MODEL"
fi
if [[ -n "$ENV_PRIMARY_MODEL_REASONING" ]]; then
    PRIMARY_MODEL_REASONING="$ENV_PRIMARY_MODEL_REASONING"
fi
if [[ -n "$ENV_FALLBACK_MODEL" ]]; then
    FALLBACK_MODEL="$ENV_FALLBACK_MODEL"
fi
if [[ -n "$ENV_FALLBACK_MODEL_REASONING" ]]; then
    FALLBACK_MODEL_REASONING="$ENV_FALLBACK_MODEL_REASONING"
fi

# Set defaults (env vars -> config file -> built-in defaults)
MAX=${MAX_ITERATIONS:-10}
SLEEP=${SLEEP_SECONDS:-2}
SKIP_COMMIT=${SKIP_COMMIT:-0}

# Primary model settings
PRIMARY_MODEL=${PRIMARY_MODEL:-opencode/glm-4.7-free}
PRIMARY_MODEL_REASONING=${PRIMARY_MODEL_REASONING:-}

# Fallback model settings (used when primary hits rate limits)
FALLBACK_MODEL=${FALLBACK_MODEL:-opencode/minimax-m2.1-free}
FALLBACK_MODEL_REASONING=${FALLBACK_MODEL_REASONING:-}

# Track which model is currently active
CURRENT_MODEL="$PRIMARY_MODEL"
CURRENT_REASONING="$PRIMARY_MODEL_REASONING"
USING_FALLBACK=0

COMPLETE_MARKER="<promise>COMPLETE</promise>"

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
4. Run tests/typecheck to verify it works.

## Critical: Only Complete If Tests Pass

$COMMIT_INSTRUCTIONS

- If tests FAIL:
  - Do NOT mark the task complete
  - Do NOT commit broken code
  - Append what went wrong to progress.txt (so next iteration can learn)

## Progress Notes Format

Append to progress.txt using this format:

## Iteration [N] - [Task Name]
- What was implemented
- Files changed
- Learnings for future iterations:
  - Patterns discovered
  - Gotchas encountered
  - Useful context
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

if [[ "$MAX" -eq -1 ]]; then
    echo "Starting Ralph (opencode) - Infinite mode (until complete)"
else
    echo "Starting Ralph (opencode) - Max $MAX iterations"
fi
echo "Using model: $PRIMARY_MODEL"
if [[ -n "$PRIMARY_MODEL_REASONING" ]]; then
    echo "Reasoning variant: $PRIMARY_MODEL_REASONING"
fi
if [[ -n "$FALLBACK_MODEL" ]]; then
    echo "Fallback model: $FALLBACK_MODEL"
    if [[ -n "$FALLBACK_MODEL_REASONING" ]]; then
        echo "Fallback reasoning variant: $FALLBACK_MODEL_REASONING"
    fi
fi
if [[ "$SKIP_COMMIT" == "1" ]]; then
    echo "Commits disabled for this run"
fi
echo ""

# Function to check if output indicates a rate limit error
is_rate_limited() {
    local output="$1"
    # Check for common rate limit indicators
    echo "$output" | grep -qiE 'rate.?limit|quota|429|too.?many.?request|exhausted|overloaded|capacity'
}

# Function to switch to fallback model
switch_to_fallback() {
    if [[ -n "$FALLBACK_MODEL" && "$USING_FALLBACK" -eq 0 ]]; then
        echo ""
        echo "==========================================="
        echo "  Rate limit detected on $CURRENT_MODEL"
        echo "  Switching to fallback: $FALLBACK_MODEL"
        echo "==========================================="
        echo ""
        CURRENT_MODEL="$FALLBACK_MODEL"
        CURRENT_REASONING="$FALLBACK_MODEL_REASONING"
        USING_FALLBACK=1
        return 0
    fi
    return 1
}

i=0
while [[ "$MAX" -eq -1 ]] || [[ "$i" -lt "$MAX" ]]; do
    ((++i))
    if [[ "$MAX" -eq -1 ]]; then
        echo "==========================================="
        echo "  Iteration $i (infinite mode) - $CURRENT_MODEL"
        echo "==========================================="
    else
        echo "==========================================="
        echo "  Iteration $i of $MAX - $CURRENT_MODEL"
        echo "==========================================="
    fi

    cmd=(opencode run)
    if [[ -n "$CURRENT_MODEL" ]]; then
        cmd+=(--model "$CURRENT_MODEL")
    fi
    if [[ -n "$CURRENT_REASONING" ]]; then
        cmd+=(--variant "$CURRENT_REASONING")
    fi

    # Run command with real-time output streaming while capturing for rate limit detection
    set +e
    tmpfile=$(mktemp)
    "${cmd[@]}" "$PROMPT" 2>&1 | tee "$tmpfile"
    exit_code=${PIPESTATUS[0]}
    result=$(cat "$tmpfile")
    rm -f "$tmpfile"
    set -e

    # Check for rate limit errors
    if [[ $exit_code -ne 0 ]] && is_rate_limited "$result"; then
        if switch_to_fallback; then
            # Retry this iteration with fallback model
            ((--i))
            continue
        else
            # No fallback available or already using fallback
            echo "Rate limit error and no fallback available:"
            echo "$result"
            exit 1
        fi
    elif [[ $exit_code -ne 0 ]]; then
        # Non-rate-limit error (output already streamed)
        echo "Error from opencode (exit code $exit_code)"
        exit $exit_code
    fi

    # Output already streamed via tee, just add spacing
    echo ""

    if [[ "$result" == *"$COMPLETE_MARKER"* ]]; then
        # Verify completion by checking PRD.md for incomplete tasks
        if [[ -f "PRD.md" ]]; then
            incomplete_count=$(grep -cE '^\s*-\s*\[ \]' PRD.md 2>/dev/null || true)
            if [[ "$incomplete_count" -gt 0 ]]; then
                echo ""
                echo "==========================================="
                echo "  Warning: Completion marker found but $incomplete_count tasks remain incomplete"
                echo "  Continuing to next iteration..."
                echo "==========================================="
                sleep "$SLEEP"
                continue
            fi
        fi
        echo "==========================================="
        echo "  All tasks complete after $i iterations!"
        echo "==========================================="
        exit 0
    fi

    sleep "$SLEEP"
done

echo "==========================================="
echo "  Reached max iterations ($MAX)"
echo "==========================================="
exit 1
