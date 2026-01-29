import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

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

const DEFAULT_CONFIG: Config = {
  engine: "opencode",
  maxIterations: 10,
  sleepSeconds: 2,
  skipCommit: false,
  claudeModel: "opus",
  opencodeModel: "big-pickle",
  fallbackModel: undefined,
  testCmd: undefined,
  skipTestVerify: false,
  logDir: join(process.env.HOME || "~", ".ralph", "logs"),
};

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
 * Load config from ralph.env file
 */
export function loadConfig(configPath?: string): Config {
  const config = { ...DEFAULT_CONFIG };

  // Determine config file path
  const envFile = configPath || join(process.cwd(), "ralph.env");
  
  // Load from file if exists
  if (existsSync(envFile)) {
    const content = readFileSync(envFile, "utf-8");
    const env = parseEnvFile(content);

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
    }

    // Logging
    if (env.RALPH_LOG_DIR && env.RALPH_LOG_DIR.trim()) {
      config.logDir = env.RALPH_LOG_DIR;
    }
  }

  // Environment variables override everything
  if (process.env.ENGINE === "claude" || process.env.ENGINE === "opencode") {
    config.engine = process.env.ENGINE;
  }
  if (process.env.MAX_ITERATIONS) {
    config.maxIterations = parseInt(process.env.MAX_ITERATIONS, 10);
  }
  if (process.env.SLEEP_SECONDS) {
    config.sleepSeconds = parseInt(process.env.SLEEP_SECONDS, 10);
  }
  if (process.env.SKIP_COMMIT === "1" || process.env.SKIP_COMMIT === "true") {
    config.skipCommit = true;
  }
  if (process.env.CLAUDE_MODEL) {
    config.claudeModel = process.env.CLAUDE_MODEL;
  }
  if (process.env.OPENCODE_MODEL) {
    config.opencodeModel = process.env.OPENCODE_MODEL;
  }
  if (process.env.FALLBACK_MODEL && process.env.FALLBACK_MODEL.trim()) {
    config.fallbackModel = process.env.FALLBACK_MODEL;
  }
  if (process.env.TEST_CMD && process.env.TEST_CMD.trim()) {
    config.testCmd = process.env.TEST_CMD;
  }
  if (process.env.SKIP_TEST_VERIFY === "1" || process.env.SKIP_TEST_VERIFY === "true") {
    config.skipTestVerify = true;
  }
  if (process.env.RALPH_LOG_DIR && process.env.RALPH_LOG_DIR.trim()) {
    config.logDir = process.env.RALPH_LOG_DIR;
  }

  return config;
}

/**
 * Get the current model based on engine type
 */
export function getCurrentModel(config: Config): string {
  return config.engine === "claude" ? config.claudeModel : config.opencodeModel;
}
