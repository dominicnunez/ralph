#!/usr/bin/env node

/**
 * Postinstall script for sfs-cli
 * Creates global config at ~/.config/ralph/ralph.env if it doesn't exist
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CONFIG_DIR = join(homedir(), ".config", "ralph");
const CONFIG_FILE = join(CONFIG_DIR, "ralph.env");

const DEFAULT_CONFIG = `# Ralph Global Configuration
# Created by: npm install -g sfs-cli
#
# Override per-project: .ralph/ralph.env
# Docs: https://github.com/dominicnunez/ralph

# ─────────────────────────────────────────────────────────────
# Engine Selection
# ─────────────────────────────────────────────────────────────

# AI engine: "opencode" or "claude"
ENGINE=opencode

# ─────────────────────────────────────────────────────────────
# Model Settings
# ─────────────────────────────────────────────────────────────

# OpenCode model (big-pickle is free tier)
OPENCODE_MODEL=big-pickle

# Claude model (sonnet balances cost/capability)
# Options: opus, sonnet, haiku
CLAUDE_MODEL=sonnet

# Fallback model when primary hits rate limits (optional)
# FALLBACK_MODEL=

# ─────────────────────────────────────────────────────────────
# Iteration Settings
# ─────────────────────────────────────────────────────────────

# Maximum iterations (-1 = infinite, run until all tasks complete)
MAX_ITERATIONS=10

# Seconds to pause between iterations
SLEEP_SECONDS=2

# ─────────────────────────────────────────────────────────────
# Behavior Settings
# ─────────────────────────────────────────────────────────────

# Skip git commits (1 = don't commit, useful for testing)
SKIP_COMMIT=0

# Skip test verification (1 = don't check for tests, not recommended)
SKIP_TEST_VERIFY=0

# ─────────────────────────────────────────────────────────────
# Test Settings
# ─────────────────────────────────────────────────────────────

# Test command - how Ralph runs your tests after each task
# Auto-detected from: package.json, vitest, jest, pytest, go, cargo
# Set manually if auto-detection fails or you need a custom command
# Examples: "npm run test:ci", "pytest -x", "go test ./... -v"
# TEST_CMD=

# ─────────────────────────────────────────────────────────────
# Logging Settings
# ─────────────────────────────────────────────────────────────

# Log directory for Ralph session logs
# Default: ~/.ralph/logs
# Logs are named: ralph-<projectname>.log
# RALPH_LOG_DIR=
`;

// Only create if doesn't exist (don't overwrite user config)
if (!existsSync(CONFIG_FILE)) {
  // Create directory if needed
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  // Write default config
  writeFileSync(CONFIG_FILE, DEFAULT_CONFIG);
}
