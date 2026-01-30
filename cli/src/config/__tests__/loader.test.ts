import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Since loadConfig() reads from real filesystem and caches module state,
 * we test the underlying logic by recreating the parsing functions here.
 * This tests the same logic without filesystem side effects.
 */

// Copied from loader.ts for isolated testing
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

interface Config {
  engine: "opencode" | "claude";
  maxIterations: number;
  sleepSeconds: number;
  skipCommit: boolean;
  claudeModel: string;
  ocPrimeModel: string;
  ocFallModel: string | undefined;
  testCmd: string | undefined;
  skipTestVerify: boolean;
  logDir: string;
  btcaEnabled: boolean;
  btcaResources: string[];
}

function getDefaultConfig(): Config {
  return {
    engine: "opencode",
    maxIterations: 10,
    sleepSeconds: 2,
    skipCommit: false,
    claudeModel: "sonnet",
    ocPrimeModel: "big-pickle",
    ocFallModel: undefined,
    testCmd: undefined,
    skipTestVerify: false,
    logDir: "/tmp/logs",
    btcaEnabled: false,
    btcaResources: [],
  };
}

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
  if (env.OC_PRIME_MODEL) {
    config.ocPrimeModel = env.OC_PRIME_MODEL;
  }
  if (env.OC_FALL_MODEL && env.OC_FALL_MODEL.trim()) {
    config.ocFallModel = env.OC_FALL_MODEL;
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

  // BTCA
  if (env.BTCA_ENABLED === "1" || env.BTCA_ENABLED === "true") {
    config.btcaEnabled = true;
  } else if (env.BTCA_ENABLED === "0" || env.BTCA_ENABLED === "false") {
    config.btcaEnabled = false;
  }
  if (env.BTCA_RESOURCES && env.BTCA_RESOURCES.trim()) {
    config.btcaResources = env.BTCA_RESOURCES.split(",").map(r => r.trim()).filter(r => r);
  }
}

describe("config/loader", () => {
  describe("parseEnvFile", () => {
    test("parses simple key=value pairs", () => {
      const content = `
ENGINE=claude
MAX_ITERATIONS=5
SKIP_COMMIT=1
`;
      const result = parseEnvFile(content);
      expect(result.ENGINE).toBe("claude");
      expect(result.MAX_ITERATIONS).toBe("5");
      expect(result.SKIP_COMMIT).toBe("1");
    });

    test("ignores comments and empty lines", () => {
      const content = `
# This is a comment
ENGINE=opencode

# Another comment
MAX_ITERATIONS=10
`;
      const result = parseEnvFile(content);
      expect(result.ENGINE).toBe("opencode");
      expect(result.MAX_ITERATIONS).toBe("10");
      expect(Object.keys(result).length).toBe(2);
    });

    test("handles quoted values with double quotes", () => {
      const content = `TEST_CMD="npm run test:ci"`;
      const result = parseEnvFile(content);
      expect(result.TEST_CMD).toBe("npm run test:ci");
    });

    test("handles quoted values with single quotes", () => {
      const content = `OC_PRIME_MODEL='claude-opus'`;
      const result = parseEnvFile(content);
      expect(result.OC_PRIME_MODEL).toBe("claude-opus");
    });

    test("handles values with equals signs", () => {
      const content = `SOME_VAR=value=with=equals`;
      const result = parseEnvFile(content);
      expect(result.SOME_VAR).toBe("value=with=equals");
    });

    test("handles empty values", () => {
      const content = `EMPTY_VAR=`;
      const result = parseEnvFile(content);
      expect(result.EMPTY_VAR).toBe("");
    });

    test("trims whitespace around keys and values", () => {
      const content = `  SPACED_KEY  =  spaced value  `;
      const result = parseEnvFile(content);
      expect(result.SPACED_KEY).toBe("spaced value");
    });
  });

  describe("applyEnvToConfig", () => {
    test("applies engine setting", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { ENGINE: "claude" });
      expect(config.engine).toBe("claude");
    });

    test("ignores invalid engine values", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { ENGINE: "invalid" });
      expect(config.engine).toBe("opencode"); // default unchanged
    });

    test("applies numeric settings", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { MAX_ITERATIONS: "25", SLEEP_SECONDS: "5" });
      expect(config.maxIterations).toBe(25);
      expect(config.sleepSeconds).toBe(5);
    });

    test("applies boolean settings with 1/0", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { SKIP_COMMIT: "1", SKIP_TEST_VERIFY: "0" });
      expect(config.skipCommit).toBe(true);
      expect(config.skipTestVerify).toBe(false);
    });

    test("applies boolean settings with true/false", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { SKIP_COMMIT: "true", SKIP_TEST_VERIFY: "false" });
      expect(config.skipCommit).toBe(true);
      expect(config.skipTestVerify).toBe(false);
    });

    test("applies model settings", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { 
        CLAUDE_MODEL: "opus",
        OC_PRIME_MODEL: "gpt-5",
        OC_FALL_MODEL: "claude-sonnet"
      });
      expect(config.claudeModel).toBe("opus");
      expect(config.ocPrimeModel).toBe("gpt-5");
      expect(config.ocFallModel).toBe("claude-sonnet");
    });

    test("applies test command", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { TEST_CMD: "bun test" });
      expect(config.testCmd).toBe("bun test");
    });

    test("ignores empty test command", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { TEST_CMD: "  " });
      expect(config.testCmd).toBeUndefined();
    });
  });

  describe("btca config", () => {
    test("enables btca with BTCA_ENABLED=1", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { BTCA_ENABLED: "1" });
      expect(config.btcaEnabled).toBe(true);
    });

    test("enables btca with BTCA_ENABLED=true", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { BTCA_ENABLED: "true" });
      expect(config.btcaEnabled).toBe(true);
    });

    test("disables btca with BTCA_ENABLED=0", () => {
      const config = getDefaultConfig();
      config.btcaEnabled = true; // Start enabled
      applyEnvToConfig(config, { BTCA_ENABLED: "0" });
      expect(config.btcaEnabled).toBe(false);
    });

    test("parses comma-separated resources", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { BTCA_RESOURCES: "gin,sqlx,solana-go" });
      expect(config.btcaResources).toEqual(["gin", "sqlx", "solana-go"]);
    });

    test("trims whitespace in resources", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { BTCA_RESOURCES: " gin , sqlx , solana-go " });
      expect(config.btcaResources).toEqual(["gin", "sqlx", "solana-go"]);
    });

    test("filters empty resources", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { BTCA_RESOURCES: "gin,,sqlx,," });
      expect(config.btcaResources).toEqual(["gin", "sqlx"]);
    });

    test("handles empty resources string", () => {
      const config = getDefaultConfig();
      applyEnvToConfig(config, { BTCA_RESOURCES: "" });
      expect(config.btcaResources).toEqual([]);
    });
  });

  describe("config priority simulation", () => {
    test("later config overrides earlier", () => {
      const config = getDefaultConfig();
      
      // Simulate global config
      applyEnvToConfig(config, { MAX_ITERATIONS: "100", ENGINE: "claude" });
      
      // Simulate project config (overrides global)
      applyEnvToConfig(config, { MAX_ITERATIONS: "5" });
      
      expect(config.maxIterations).toBe(5); // Project override
      expect(config.engine).toBe("claude"); // From global (not overridden)
    });

    test("env vars override all", () => {
      const config = getDefaultConfig();
      
      // Simulate global config
      applyEnvToConfig(config, { MAX_ITERATIONS: "100" });
      
      // Simulate project config
      applyEnvToConfig(config, { MAX_ITERATIONS: "50" });
      
      // Simulate env vars (should win)
      applyEnvToConfig(config, { MAX_ITERATIONS: "3" });
      
      expect(config.maxIterations).toBe(3);
    });
  });

  describe("defaults", () => {
    test("provides sensible defaults", () => {
      const config = getDefaultConfig();
      
      expect(config.engine).toBe("opencode");
      expect(config.maxIterations).toBe(10);
      expect(config.sleepSeconds).toBe(2);
      expect(config.skipCommit).toBe(false);
      expect(config.claudeModel).toBe("sonnet");
      expect(config.ocPrimeModel).toBe("big-pickle");
      expect(config.ocFallModel).toBeUndefined();
      expect(config.testCmd).toBeUndefined();
      expect(config.skipTestVerify).toBe(false);
      expect(config.btcaEnabled).toBe(false);
      expect(config.btcaResources).toEqual([]);
    });
  });
});
