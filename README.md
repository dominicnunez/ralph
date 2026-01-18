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
| `ralphcc.sh` | Runner using Claude Code CLI |
| `ralphoc.sh` | Runner using OpenCode CLI |
| `ralph.env.example` | Configuration template with all options |

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
   # Using Claude Code
   ./ralphcc.sh

   # Using OpenCode
   ./ralphoc.sh
   ```

Ralph will work through each task, running tests and committing progress automatically.

## Configuration

Copy `ralph.env.example` to `ralph.env` to customize settings. If no config file exists, scripts use built-in defaults.

See `ralph.env.example` for all available options including model selection, reasoning variants, iteration limits, and commit behavior.

### Script Defaults (No Config File)

**`ralphcc.sh`:**

| Setting | Default |
|---------|---------|
| `MAX_ITERATIONS` | `10` |
| `SLEEP_SECONDS` | `2` |
| `CLAUDE_MODEL` | `opus` |

Note: Fallback not supported (Claude CLI only supports Claude models).

**`ralphoc.sh`:**

| Setting | Default |
|---------|---------|
| `MAX_ITERATIONS` | `10` |
| `SLEEP_SECONDS` | `2` |
| `PRIMARY_MODEL` | `opencode/glm-4.7-free` |
| `FALLBACK_MODEL` | `opencode/minimax-m2.1-free` |

To disable fallback, set `FALLBACK_MODEL=` (empty) in your config.

## Project Files

| File | Description |
|------|-------------|
| `PRD.md` | Task list with checkbox format (required) |
| `progress.txt` | Created automatically to track learnings across iterations |
| `AGENTS.md` | Reusable patterns for the codebase (optional) |

## Key Features

- **One task per iteration** - Ensures atomic, testable changes
- **Test-gated completion** - Never marks tasks done if tests fail
- **Progress persistence** - Learnings survive across iterations
- **Auto-commit** - Commits changes automatically with descriptive messages
- **Automatic fallback** - `ralphoc.sh` switches to fallback model on rate limits
- **Skip commits** - Test PRDs without polluting git history
- **Configurable** - Central config file for customization

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
