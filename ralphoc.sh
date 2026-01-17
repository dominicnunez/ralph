#!/bin/bash
set -e

if ! command -v opencode &>/dev/null; then
    echo "Error: 'opencode' command not found. Please install OpenCode CLI." >&2
    exit 1
fi

# Determine script directory for config file location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/ralph.env"
EXAMPLE_FILE="$SCRIPT_DIR/ralph.env.example"

# Create default config from example if it doesn't exist
if [[ ! -f "$CONFIG_FILE" && -f "$EXAMPLE_FILE" ]]; then
    echo "Creating ralph.env from ralph.env.example..."
    cp "$EXAMPLE_FILE" "$CONFIG_FILE"
fi

# Preserve environment overrides before sourcing config
ENV_RALPH_MAX_ITERATIONS=${RALPH_MAX_ITERATIONS-}
ENV_RALPH_SLEEP_SECONDS=${RALPH_SLEEP_SECONDS-}
ENV_RALPH_SKIP_COMMIT=${RALPH_SKIP_COMMIT-}
ENV_RALPH_OPENCODE_MODEL=${RALPH_OPENCODE_MODEL-}
ENV_RALPH_OPENCODE_ARGS=${RALPH_OPENCODE_ARGS-}

# Load config file if it exists
if [[ -f "$CONFIG_FILE" ]]; then
    source "$CONFIG_FILE"
fi

# Restore environment overrides (env vars take precedence over config)
if [[ -n "$ENV_RALPH_MAX_ITERATIONS" ]]; then
    RALPH_MAX_ITERATIONS="$ENV_RALPH_MAX_ITERATIONS"
fi
if [[ -n "$ENV_RALPH_SLEEP_SECONDS" ]]; then
    RALPH_SLEEP_SECONDS="$ENV_RALPH_SLEEP_SECONDS"
fi
if [[ -n "$ENV_RALPH_SKIP_COMMIT" ]]; then
    RALPH_SKIP_COMMIT="$ENV_RALPH_SKIP_COMMIT"
fi
if [[ -n "$ENV_RALPH_OPENCODE_MODEL" ]]; then
    RALPH_OPENCODE_MODEL="$ENV_RALPH_OPENCODE_MODEL"
fi
if [[ -n "$ENV_RALPH_OPENCODE_ARGS" ]]; then
    RALPH_OPENCODE_ARGS="$ENV_RALPH_OPENCODE_ARGS"
fi

# Set defaults (CLI args -> env vars -> config file -> built-in defaults)
MAX=${1:-${RALPH_MAX_ITERATIONS:-100}}
SLEEP=${2:-${RALPH_SLEEP_SECONDS:-2}}
SKIP_COMMIT=${RALPH_SKIP_COMMIT:-0}

# OpenCode-specific settings (env vars override config for backwards compatibility)
OPENCODE_MODEL=${OPENCODE_MODEL:-${RALPH_OPENCODE_MODEL:-anthropic/claude-opus-4-5}}
# Note: OPENCODE_ARGS splits on whitespace. Arguments containing spaces are not supported.
OPENCODE_ARGS=${OPENCODE_ARGS:-${RALPH_OPENCODE_ARGS:-}}

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
echo "Using model: $OPENCODE_MODEL"
if [[ "$SKIP_COMMIT" == "1" ]]; then
    echo "Commits disabled for this run"
fi
echo ""

i=0
while [[ "$MAX" -eq -1 ]] || [[ "$i" -lt "$MAX" ]]; do
    ((i++))
    if [[ "$MAX" -eq -1 ]]; then
        echo "==========================================="
        echo "  Iteration $i (infinite mode)"
        echo "==========================================="
    else
        echo "==========================================="
        echo "  Iteration $i of $MAX"
        echo "==========================================="
    fi

    cmd=(opencode run)
    if [[ -n "$OPENCODE_MODEL" ]]; then
        cmd+=(--model "$OPENCODE_MODEL")
    fi
    if [[ -n "$OPENCODE_ARGS" ]]; then
        read -r -a extra_args <<< "$OPENCODE_ARGS"
        cmd+=("${extra_args[@]}")
    fi

    result=$("${cmd[@]}" "$PROMPT")

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
