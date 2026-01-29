import { Command } from "commander";
import type { Config, EngineType } from "../config/loader.js";

export interface CliOptions {
  engine?: EngineType;
  model?: string;
  maxIterations?: number;
  sleepSeconds?: number;
  skipCommit?: boolean;
  skipTestVerify?: boolean;
  testCmd?: string;
  prd?: string;
  verbose?: boolean;
}

export interface ParsedArgs {
  options: CliOptions;
}

const VERSION = "1.0.0";

export function parseArgs(argv: string[]): ParsedArgs {
  const program = new Command();

  program
    .name("sfs")
    .description("Autonomous AI coding agent with enforced test verification")
    .version(VERSION)
    .option("--engine <type>", "AI engine to use: opencode or claude", "opencode")
    .option("--opencode", "Use OpenCode engine (shortcut for --engine opencode)")
    .option("--claude", "Use Claude Code engine (shortcut for --engine claude)")
    .option("--model <name>", "Override the model for the selected engine")
    .option("--max-iterations <n>", "Maximum iterations (-1 for infinite)", parseInt)
    .option("--sleep <seconds>", "Seconds to sleep between iterations", parseInt)
    .option("--skip-commit", "Do not auto-commit changes")
    .option("--no-tests", "Skip test verification (not recommended)")
    .option("--test-cmd <cmd>", "Custom test command")
    .option("--prd <path>", "Path to PRD.md file", "PRD.md")
    .option("-v, --verbose", "Enable verbose output");

  program.parse(argv);
  const opts = program.opts();

  // Handle engine shortcuts
  let engine: EngineType | undefined;
  if (opts.claude) {
    engine = "claude";
  } else if (opts.opencode) {
    engine = "opencode";
  } else if (opts.engine === "claude" || opts.engine === "opencode") {
    engine = opts.engine;
  }

  const options: CliOptions = {
    engine,
    model: opts.model,
    maxIterations: opts.maxIterations,
    sleepSeconds: opts.sleep,
    skipCommit: opts.skipCommit,
    skipTestVerify: opts.tests === false, // --no-tests sets tests to false
    testCmd: opts.testCmd,
    prd: opts.prd,
    verbose: opts.verbose,
  };

  return { options };
}

/**
 * Merge CLI options with loaded config
 * CLI options take precedence
 */
export function mergeOptions(config: Config, cliOptions: CliOptions): Config {
  const merged = { ...config };

  if (cliOptions.engine) {
    merged.engine = cliOptions.engine;
  }

  if (cliOptions.model) {
    // Model override applies to the current engine
    if (merged.engine === "claude") {
      merged.claudeModel = cliOptions.model;
    } else {
      merged.opencodeModel = cliOptions.model;
    }
  }

  if (cliOptions.maxIterations !== undefined) {
    merged.maxIterations = cliOptions.maxIterations;
  }

  if (cliOptions.sleepSeconds !== undefined) {
    merged.sleepSeconds = cliOptions.sleepSeconds;
  }

  if (cliOptions.skipCommit !== undefined) {
    merged.skipCommit = cliOptions.skipCommit;
  }

  if (cliOptions.skipTestVerify !== undefined) {
    merged.skipTestVerify = cliOptions.skipTestVerify;
  }

  if (cliOptions.testCmd) {
    merged.testCmd = cliOptions.testCmd;
  }

  return merged;
}
