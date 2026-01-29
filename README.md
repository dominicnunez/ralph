# Ralph

An autonomous AI coding agent runner that orchestrates iterative development workflows. Ralph automates the process of having an AI agent work through a task list one task at a time, with built-in progress tracking and learning mechanisms.

**Key differentiator:** Enforced test verification - Ralph won't mark tasks complete unless tests are written and passing.

## Install

**Option A: npm** (recommended)

```bash
npm install -g sfs-cli

# Then use anywhere
sfs                        # Uses PRD.md with OpenCode (default)
sfs --claude               # Use Claude Code
sfs --model sonnet         # Override model
```

**Option B: Clone + Bash**

```bash
git clone https://github.com/dominicnunez/ralph.git
cd ralph && chmod +x ralph.sh

./ralph.sh                 # Uses ralph.env for configuration
```

Both versions have identical features.

## Overview

Ralph runs an AI coding assistant in a loop, feeding it tasks from a PRD (Product Requirements Document) and tracking progress across iterations. Each iteration:

1. Reads `PRD.md` to find the first incomplete task
2. Reads `progress.txt` to learn from previous iterations
3. Implements exactly ONE task
4. **Verifies test files were created/modified**
5. **Runs tests to verify the implementation**
6. If tests pass: marks task complete, commits, and logs progress
7. If tests fail: logs failure details for the next iteration

## Quick Start

1. Create a `PRD.md` in your project with tasks:
   ```markdown
   ## Tasks
   - [ ] Implement user authentication
   - [ ] Add database migrations
   - [ ] Set up API endpoints
   ```

2. Run Ralph:
   ```bash
   # Using npm CLI
   sfs

   # Using bash script
   ./ralph.sh
   ```

Ralph will work through each task, running tests and committing progress automatically.

## CLI Usage

```bash
sfs                        # Uses PRD.md, OpenCode engine (default)
sfs --opencode             # Explicit OpenCode
sfs --claude               # Use Claude Code
sfs --model big-pickle     # Override model
sfs --max-iterations 20    # Custom iteration limit
sfs --skip-commit          # Don't auto-commit
sfs --no-tests             # Skip test verification (not recommended)
sfs --prd tasks.md         # Use different PRD file
sfs -v                     # Verbose output
sfs --help                 # Show all options
```

## Configuration

Copy `ralph.env.example` to `ralph.env` to customize settings:

```bash
# Engine selection: "opencode" or "claude"
ENGINE=opencode

# Model settings
CLAUDE_MODEL=opus
OPENCODE_MODEL=big-pickle
# FALLBACK_MODEL=          # Optional fallback for rate limits

# Iteration settings
MAX_ITERATIONS=-1          # -1 for infinite
SLEEP_SECONDS=2

# Behavior
SKIP_COMMIT=0
SKIP_TEST_VERIFY=0

# Test command (auto-detected if not set)
TEST_CMD=
```

CLI arguments override config file settings.

### Defaults

| Setting | Default |
|---------|---------|
| `ENGINE` | `opencode` |
| `OPENCODE_MODEL` | `big-pickle` |
| `CLAUDE_MODEL` | `opus` |
| `MAX_ITERATIONS` | `10` |
| `SLEEP_SECONDS` | `2` |

## Project Files

| File | Description |
|------|-------------|
| `PRD.md` | Task list with checkbox format (required) |
| `progress.txt` | Created automatically to track learnings across iterations |
| `AGENTS.md` | Reusable patterns for the codebase (optional) |

## Key Features

- **One task per iteration** - Ensures atomic, testable changes
- **Enforced test writing** - Verifies test files were actually created/modified
- **Test-gated completion** - Runs test suite after each iteration, blocks progress on failure
- **Double verification** - PRD.md check + final test suite before declaring complete
- **Progress persistence** - Learnings survive across iterations (progress.txt)
- **External logging** - Per-project logs at `~/.ralph/logs/ralph-<project>.log`
- **Auto-commit** - Commits changes automatically with descriptive messages
- **Automatic fallback** - Switches to fallback model on rate limits (OpenCode)
- **Skip commits** - Test PRDs without polluting git history
- **Configurable** - Central config file for customization

## Test Verification Flow

```
Task 1 -> AI implements -> tests written? -> NO -> retry iteration
                                          -> YES -> run tests -> FAIL -> retry
                                                              -> PASS -> Task 2 -> ...
All [x] -> final test suite -> PASS -> done
                            -> FAIL -> keep iterating
```

The script independently verifies:
1. Test files were created/modified (*.test.ts, *.spec.ts, etc.)
2. Full test suite passes after each iteration
3. Final test suite passes before declaring complete

This prevents the AI from marking tasks complete without actually writing tests.

## AI Engines

| Engine | CLI | Default Model |
|--------|-----|---------------|
| OpenCode | `opencode` | `big-pickle` |
| Claude | `claude` | `opus` |

### Rate Limit Handling (OpenCode)

If a rate limit is detected and `FALLBACK_MODEL` is configured, Ralph automatically switches to the fallback model and retries.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tasks completed successfully |
| 1 | Max iterations reached or error occurred |

## Requirements

**npm version (`sfs-cli`):**
- Node.js 18+ or Bun

**Bash version (`ralph.sh`):**
- Bash

**Both versions:**
- [OpenCode CLI](https://opencode.ai) (`opencode` command) - for OpenCode engine
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` command) - for Claude engine

## Development

```bash
# Clone and install
git clone https://github.com/dominicnunez/ralph.git
cd ralph/cli
npm install

# Run in dev mode
npx tsx src/index.ts --help

# Build binaries (requires Bun)
bun run build:all
```

## License

MIT
