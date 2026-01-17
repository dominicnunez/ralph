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

## Usage

### Ralph with Claude Code

```bash
./ralphcc.sh [max_iterations] [sleep_seconds]
```

**Examples:**
```bash
./ralphcc.sh           # 100 iterations, 2 second delay
./ralphcc.sh 50 5      # 50 iterations, 5 second delay
```

**Requirements:** [Claude CLI](https://github.com/anthropics/claude-code) (`claude` command)

### Ralph with OpenCode

```bash
./ralphoc.sh [max_iterations] [sleep_seconds]
```

**Environment variables:**
- `OPENCODE_MODEL` - AI model (default: `openai/o3-opus-4.5`)
- `OPENCODE_AGENT` - OpenCode agent profile
- `OPENCODE_ARGS` - Additional CLI arguments

**Example:**
```bash
OPENCODE_MODEL=anthropic/claude-3-opus ./ralphoc.sh 50
```

**Requirements:** OpenCode CLI (`opencode` command)

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

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `max_iterations` | 100 | Maximum number of AI iterations |
| `sleep_seconds` | 2 | Delay between iterations |

## Key Features

- **One task per iteration** - Ensures atomic, testable changes
- **Test-gated completion** - Never marks tasks done if tests fail
- **Progress persistence** - Learnings survive across iterations
- **Auto-commit** - Commits changes automatically with descriptive messages
- **Multiple backends** - Supports Claude CLI and OpenCode CLI

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tasks completed successfully |
| 1 | Max iterations reached or error occurred |

## License

MIT
