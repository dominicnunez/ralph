# Ralph

An autonomous AI coding agent runner that orchestrates iterative development workflows. Ralph automates the process of having an AI agent work through a task list one task at a time, with built-in progress tracking and learning mechanisms.

## Overview

Ralph runs an AI coding assistant in a loop, feeding it tasks from a PRD (Product Requirements Document) and tracking progress across iterations. Each iteration:

1. Reads `PRD.md` to find the first incomplete task
2. Reads `progress.txt` to learn from previous iterations
3. Implements exactly ONE task
4. Runs tests to verify the implementation
5. If tests pass: marks task complete, commits, and logs progress
6. If tests fail: logs failure details for the next iteration

## Files

| File | Description |
|------|-------------|
| `ralphcc.sh` | Main runner using Claude Code CLI |
| `ralphoc.sh` | Alternative runner using OpenCode CLI |
| `ralph.env.example` | Configuration template with all options |
| `ralph.env` | Your local configuration (auto-created on first run) |

## Quick Start

```bash
# Using Claude Code
./ralphcc.sh

# Using OpenCode
./ralphoc.sh

# Infinite mode (run until all tasks complete)
./ralphcc.sh -1
./ralphoc.sh -1
```

## Configuration

Ralph uses a `ralph.env` file for configuration. On first run, it's auto-created from `ralph.env.example`.

### Config File (`ralph.env`)

```bash
# Maximum iterations (-1 for infinite)
RALPH_MAX_ITERATIONS=10

# Sleep seconds between iterations
RALPH_SLEEP_SECONDS=2

# Claude Code model (for ralphcc.sh)
# Options: opus, sonnet, haiku
RALPH_CLAUDE_MODEL=opus

# OpenCode model (for ralphoc.sh)
# See ralph.env.example for full model list
RALPH_OPENCODE_MODEL=anthropic/claude-opus-4-5

# Skip commits during runs (useful for testing)
RALPH_SKIP_COMMIT=0

# Additional OpenCode CLI arguments
# Example: --variant xhigh (for reasoning models)
RALPH_OPENCODE_ARGS=
```

### Priority Order

Settings are applied in this order (highest priority first):

1. CLI arguments (`./ralphcc.sh 50 5`)
2. Environment variables (`RALPH_MAX_ITERATIONS=50 ./ralphcc.sh`)
3. Config file (`ralph.env`)
4. Built-in defaults

### Available Models

**Claude Code (`ralphcc.sh`):**
- `opus` - Claude Opus (most capable)
- `sonnet` - Claude Sonnet (balanced)
- `haiku` - Claude Haiku (fastest)

**OpenCode (`ralphoc.sh`):**

Run `opencode models` for full list. Common options:

| Provider | Models |
|----------|--------|
| OpenCode | `opencode/big-pickle`, `opencode/glm-4.7-free`, `opencode/gpt-5-nano` |
| Anthropic | `anthropic/claude-opus-4-5`, `anthropic/claude-sonnet-4-5` |
| OpenAI | `openai/gpt-5.2-codex`, `openai/gpt-5.2` |

## Usage Examples

```bash
# Default settings from config
./ralphcc.sh

# Override max iterations via CLI
./ralphcc.sh 50

# Override via environment variable
RALPH_MAX_ITERATIONS=50 ./ralphcc.sh

# Infinite mode until all tasks complete
./ralphcc.sh -1

# Use specific OpenCode model with reasoning
OPENCODE_MODEL="openai/gpt-5.2-codex" OPENCODE_ARGS="--variant xhigh" ./ralphoc.sh

# Test run without commits
RALPH_SKIP_COMMIT=1 ./ralphoc.sh
```

## Project Setup

Your project needs:

1. **`PRD.md`** - Task list with checkbox format:
   ```markdown
   ## Tasks
   - [ ] Implement user authentication
   - [ ] Add database migrations
   - [x] Set up project structure
   ```

2. **`progress.txt`** - Created automatically by Ralph to track learnings across iterations

3. **`AGENTS.md`** (optional) - Reusable patterns for the codebase

## Key Features

- **One task per iteration** - Ensures atomic, testable changes
- **Test-gated completion** - Never marks tasks done if tests fail
- **Progress persistence** - Learnings survive across iterations
- **Auto-commit** - Commits changes automatically with descriptive messages
- **Infinite mode** - Run until all tasks complete with `-1`
- **Skip commits** - Test PRDs without polluting git history
- **Multiple backends** - Supports Claude Code CLI and OpenCode CLI
- **Configurable** - Central config file with env var and CLI overrides

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tasks completed successfully |
| 1 | Max iterations reached or error occurred |

## Requirements

- **Claude Code:** [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` command)
- **OpenCode:** [OpenCode CLI](https://opencode.ai) (`opencode` command)

## License

MIT
