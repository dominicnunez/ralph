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

# Engine selection: "opencode" or "claude"
ENGINE=opencode

# Model settings
OPENCODE_MODEL=big-pickle
CLAUDE_MODEL=sonnet

# Iteration settings
MAX_ITERATIONS=-1
SLEEP_SECONDS=2

# Behavior
SKIP_COMMIT=0
SKIP_TEST_VERIFY=0
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
