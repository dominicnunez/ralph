#!/usr/bin/env bun
import { parseArgs, mergeOptions } from "./cli/args.js";
import { loadConfig } from "./config/loader.js";
import { runLoop, runSingleTask } from "./cli/commands/run.js";
import { logError } from "./ui/logger.js";

async function main(): Promise<void> {
  try {
    // Parse CLI arguments
    const { options } = parseArgs(process.argv);

    // Load config from ralph.env
    const config = loadConfig();

    // Merge CLI options with config (CLI takes precedence)
    const finalConfig = mergeOptions(config, options);

    const runOptions = {
      prdPath: options.prd || "PRD.md",
      verbose: options.verbose,
    };

    if (options.singleTask) {
      await runSingleTask(finalConfig, runOptions, options.singleTask);
      return;
    }

    // Run the main loop
    await runLoop(finalConfig, runOptions);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

main();
