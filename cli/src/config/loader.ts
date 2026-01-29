import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type EngineType = "opencode" | "claude";

export interface Config {
  // Engine
  engine: EngineType;

  // General
  maxIterations: number;
  sleepSeconds: number;
  skipCommit: boolean;

  // Claude
  claudeModel: string;

  // OpenCode
  opencodeModel: string;
  fallbackModel: string | undefined;

  // Test verification
  testCmd: string | undefined;
  skipTestVerify: boolean;

  // Logging
  logDir: string;
}

// Config file paths
const GLOBAL_CONFIG_DIR = join(homedir(), ".config", "ralph");
const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, "ralph.env");
const PROJECT_CONFIG_DIR = ".ralph";
const PROJECT_CONFIG_FILE = join(PROJECT_CONFIG_DIR, "ralph.env");

// Default config content (used for self-healing)
const DEFAULT_CONFIG_CONTENT = `# Ralph Global Configuration
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

/**
 * Parse a simple .env file format
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

/**
 * Apply env values to config object
 */
function applyEnvToConfig(config: Config, env: Record<string, string>): void {
  // Engine
  if (env.ENGINE === "claude" || env.ENGINE === "opencode") {
    config.engine = env.ENGINE;
  }

  // General
  if (env.MAX_ITERATIONS) {
    config.maxIterations = parseInt(env.MAX_ITERATIONS, 10);
  }
  if (env.SLEEP_SECONDS) {
    config.sleepSeconds = parseInt(env.SLEEP_SECONDS, 10);
  }
  if (env.SKIP_COMMIT === "1" || env.SKIP_COMMIT === "true") {
    config.skipCommit = true;
  } else if (env.SKIP_COMMIT === "0" || env.SKIP_COMMIT === "false") {
    config.skipCommit = false;
  }

  // Claude
  if (env.CLAUDE_MODEL) {
    config.claudeModel = env.CLAUDE_MODEL;
  }

  // OpenCode
  if (env.OPENCODE_MODEL) {
    config.opencodeModel = env.OPENCODE_MODEL;
  }
  if (env.FALLBACK_MODEL && env.FALLBACK_MODEL.trim()) {
    config.fallbackModel = env.FALLBACK_MODEL;
  }

  // Test verification
  if (env.TEST_CMD && env.TEST_CMD.trim()) {
    config.testCmd = env.TEST_CMD;
  }
  if (env.SKIP_TEST_VERIFY === "1" || env.SKIP_TEST_VERIFY === "true") {
    config.skipTestVerify = true;
  } else if (env.SKIP_TEST_VERIFY === "0" || env.SKIP_TEST_VERIFY === "false") {
    config.skipTestVerify = false;
  }

  // Logging
  if (env.RALPH_LOG_DIR && env.RALPH_LOG_DIR.trim()) {
    config.logDir = env.RALPH_LOG_DIR;
  }
}

/**
 * Ensure global config exists (self-healing)
 */
function ensureGlobalConfig(): void {
  if (!existsSync(GLOBAL_CONFIG_FILE)) {
    if (!existsSync(GLOBAL_CONFIG_DIR)) {
      mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true });
    }
    writeFileSync(GLOBAL_CONFIG_FILE, DEFAULT_CONFIG_CONTENT);
  }
}

/**
 * Load config with priority:
 * 1. CLI arguments (handled separately in args.ts)
 * 2. Environment variables
 * 3. Project config (.ralph/ralph.env)
 * 4. Global config (~/.config/ralph/ralph.env)
 */
export function loadConfig(): Config {
  // Ensure global config exists (self-healing)
  ensureGlobalConfig();

  // Start with empty config - will be filled from global config
  const config: Config = {
    engine: "opencode",
    maxIterations: -1,
    sleepSeconds: 2,
    skipCommit: false,
    claudeModel: "sonnet",
    opencodeModel: "big-pickle",
    fallbackModel: undefined,
    testCmd: undefined,
    skipTestVerify: false,
    logDir: join(homedir(), ".ralph", "logs"),
  };

  // Load global config (always exists due to self-healing)
  const globalContent = readFileSync(GLOBAL_CONFIG_FILE, "utf-8");
  const globalEnv = parseEnvFile(globalContent);
  applyEnvToConfig(config, globalEnv);

  // Load project config if exists (overrides global)
  const projectConfigPath = join(process.cwd(), PROJECT_CONFIG_FILE);
  if (existsSync(projectConfigPath)) {
    const projectContent = readFileSync(projectConfigPath, "utf-8");
    const projectEnv = parseEnvFile(projectContent);
    applyEnvToConfig(config, projectEnv);
  }

  // Environment variables override everything
  const processEnv: Record<string, string> = {};
  if (process.env.ENGINE) processEnv.ENGINE = process.env.ENGINE;
  if (process.env.MAX_ITERATIONS) processEnv.MAX_ITERATIONS = process.env.MAX_ITERATIONS;
  if (process.env.SLEEP_SECONDS) processEnv.SLEEP_SECONDS = process.env.SLEEP_SECONDS;
  if (process.env.SKIP_COMMIT) processEnv.SKIP_COMMIT = process.env.SKIP_COMMIT;
  if (process.env.CLAUDE_MODEL) processEnv.CLAUDE_MODEL = process.env.CLAUDE_MODEL;
  if (process.env.OPENCODE_MODEL) processEnv.OPENCODE_MODEL = process.env.OPENCODE_MODEL;
  if (process.env.FALLBACK_MODEL) processEnv.FALLBACK_MODEL = process.env.FALLBACK_MODEL;
  if (process.env.TEST_CMD) processEnv.TEST_CMD = process.env.TEST_CMD;
  if (process.env.SKIP_TEST_VERIFY) processEnv.SKIP_TEST_VERIFY = process.env.SKIP_TEST_VERIFY;
  if (process.env.RALPH_LOG_DIR) processEnv.RALPH_LOG_DIR = process.env.RALPH_LOG_DIR;
  
  applyEnvToConfig(config, processEnv);

  return config;
}

/**
 * Get the current model based on engine type
 */
export function getCurrentModel(config: Config): string {
  return config.engine === "claude" ? config.claudeModel : config.opencodeModel;
}

/**
 * Get global config path (for documentation purposes)
 */
export function getGlobalConfigPath(): string {
  return GLOBAL_CONFIG_FILE;
}

/**
 * Get project config path (for documentation purposes)
 */
export function getProjectConfigPath(): string {
  return PROJECT_CONFIG_FILE;
}
