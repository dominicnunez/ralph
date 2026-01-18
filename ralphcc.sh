#!/bin/bash
set -e

if ! command -v claude &>/dev/null; then
    echo "Error: 'claude' command not found. Please install Claude CLI." >&2
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
ENV_CLAUDE_MODEL=${CLAUDE_MODEL-}
ENV_SKIP_COMMIT=${SKIP_COMMIT-}

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
if [[ -n "$ENV_CLAUDE_MODEL" ]]; then
    CLAUDE_MODEL="$ENV_CLAUDE_MODEL"
fi
if [[ -n "$ENV_SKIP_COMMIT" ]]; then
    SKIP_COMMIT="$ENV_SKIP_COMMIT"
fi

# Set defaults (env vars -> config file -> built-in defaults)
MAX=${MAX_ITERATIONS:-10}
SLEEP=${SLEEP_SECONDS:-2}
CLAUDE_MODEL=${CLAUDE_MODEL:-opus}
SKIP_COMMIT=${SKIP_COMMIT:-0}

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
    echo "Starting Ralph (claude) - Infinite mode (until complete)"
else
    echo "Starting Ralph (claude) - Max $MAX iterations"
fi
echo "Using model: $CLAUDE_MODEL"
if [[ "$SKIP_COMMIT" == "1" ]]; then
    echo "Commits disabled for this run"
fi
echo ""

i=0
while [[ "$MAX" -eq -1 ]] || [[ "$i" -lt "$MAX" ]]; do
    ((++i))
    if [[ "$MAX" -eq -1 ]]; then
        echo "==========================================="
        echo "  Iteration $i (infinite mode)"
        echo "==========================================="
    else
        echo "==========================================="
        echo "  Iteration $i of $MAX"
        echo "==========================================="
    fi

    result=$(claude --model "$CLAUDE_MODEL" --dangerously-skip-permissions -p "$PROMPT")

    echo "$result"
    echo ""

    if [[ "$result" == *"$COMPLETE_MARKER"* ]]; then
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
