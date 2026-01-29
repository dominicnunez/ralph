import { join, basename } from "node:path";
import type { Config } from "../../config/loader.js";
import { getCurrentModel } from "../../config/loader.js";
import { ClaudeEngine } from "../../engines/claude.js";
import { OpenCodeEngine } from "../../engines/opencode.js";
import { COMPLETE_MARKER, generatePrompt, generateSingleTaskPrompt, type Engine } from "../../engines/base.js";
import { parsePrd, getFirstIncompleteTask, countIncompleteTasks, allTasksComplete } from "../../tasks/parser.js";
import { appendFailure, initProgress } from "../../tasks/progress.js";
import { detectTestCommand, verify } from "../../tasks/verification.js";
import {
  initLogger,
  logInfo,
  logSuccess,
  logWarning,
  logError,
  logIteration,
  logSessionStart,
  logAiOutput,
} from "../../ui/logger.js";
import pc from "picocolors";

const MAX_CONSECUTIVE_FAILURES = 3;

export interface RunOptions {
  prdPath: string;
  verbose?: boolean;
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function runLoop(config: Config, options: RunOptions): Promise<void> {
  const projectName = basename(process.cwd());
  const logFile = join(config.logDir, `ralph-${projectName}.log`);
  
  // Initialize
  initLogger({ logFile, verbose: options.verbose });
  initProgress();
  
  // Create engine
  const engine: Engine = config.engine === "claude"
    ? new ClaudeEngine(config.claudeModel)
    : new OpenCodeEngine(config.ocPrimeModel, config.ocFallModel);

  // Verify engine is available
  if (!engine.isAvailable()) {
    logError(`'${engine.name}' command not found. Please install ${engine.name === "claude" ? "Claude CLI" : "OpenCode CLI"}.`);
    process.exit(1);
  }

  // Detect test command
  const testCmd = config.testCmd || detectTestCommand();
  
  // Log session start
  logSessionStart(projectName, config.engine, getCurrentModel(config));
  
  // Print startup info
  const iterStr = config.maxIterations === -1 ? "Infinite mode" : `Max ${config.maxIterations} iterations`;
  console.log(`Starting Ralph (${config.engine}) - ${iterStr}`);
  console.log(`Using model: ${getCurrentModel(config)}`);
  
  if (config.engine === "opencode" && config.ocFallModel) {
    console.log(`Fallback model: ${config.ocFallModel}`);
  }
  
  if (config.skipCommit) {
    console.log("Commits disabled for this run");
  }

  if (config.skipTestVerify) {
    console.log(pc.yellow("  Test verification DISABLED"));
    logWarning("Test verification disabled");
  } else if (testCmd) {
    console.log(`  Test command: ${testCmd}`);
    logInfo(`Test command: ${testCmd}`);
  } else {
    console.log(pc.yellow("  No test command detected (configure TEST_CMD in ralph.env)"));
    logWarning("No test command detected");
  }

  console.log(`  Log file: ${logFile}`);
  console.log("");

  // Generate prompt
  const prompt = generatePrompt(config.skipCommit);
  
  // Main loop
  let iteration = 0;
  let consecutiveFailures = 0;

  while (config.maxIterations === -1 || iteration < config.maxIterations) {
    iteration++;
    
    // Parse PRD and get current task
    const tasks = parsePrd(options.prdPath);
    const currentTask = getFirstIncompleteTask(tasks);
    const taskName = currentTask?.text || "unknown";
    
    // Check if already complete
    if (allTasksComplete(tasks) && tasks.length > 0) {
      logSuccess("All tasks already complete!");
      console.log(pc.green("==========================================="));
      console.log(pc.green("  All tasks already complete!"));
      console.log(pc.green("==========================================="));
      process.exit(0);
    }

    // Log iteration
    logIteration(iteration, config.maxIterations, taskName, engine.model);

    // Run engine
    const result = await engine.run(prompt);
    logAiOutput(result.output);
    console.log("");

    // Handle errors
    if (!result.success) {
      if (result.rateLimited && engine.switchToFallback?.()) {
        // Retry with fallback
        iteration--;
        continue;
      }
      
      logError(`${engine.name} failed with exit code ${result.exitCode}`);
      process.exit(result.exitCode);
    }

    // Test verification gate
    if (!config.skipTestVerify && testCmd) {
      const verification = verify(testCmd);
      
      if (!verification.testsWritten) {
        consecutiveFailures++;
        logWarning(`No tests written, iteration failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
        
        appendFailure(
          iteration,
          "No test files were created or modified",
          "You MUST write tests before the task can be completed"
        );

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logError("Too many consecutive failures, stopping");
          console.log(pc.red("  Too many consecutive failures on this task"));
          console.log(pc.red("  Manual intervention required"));
          console.log(`  Check log: ${logFile}`);
          process.exit(1);
        }

        console.log(`  Verification failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
        console.log("  Continuing to next iteration to fix...");
        await sleep(config.sleepSeconds);
        continue;
      }

      if (!verification.testsPassed) {
        consecutiveFailures++;
        logWarning(`Tests failed, iteration failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
        
        appendFailure(
          iteration,
          "Tests failed",
          "Fix the failing tests before marking the task complete"
        );

        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          logError("Too many consecutive failures, stopping");
          console.log(pc.red("  Too many consecutive failures on this task"));
          console.log(pc.red("  Manual intervention required"));
          console.log(`  Check log: ${logFile}`);
          process.exit(1);
        }

        console.log(`  Verification failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES})`);
        console.log("  Continuing to next iteration to fix...");
        await sleep(config.sleepSeconds);
        continue;
      }

      // Reset failure counter on success
      consecutiveFailures = 0;
      logInfo("Verification passed");
    }

    // Check for completion marker
    if (result.output.includes(COMPLETE_MARKER)) {
      // Re-parse PRD to verify
      const finalTasks = parsePrd(options.prdPath);
      const remainingCount = countIncompleteTasks(finalTasks);

      if (remainingCount > 0) {
        logWarning(`AI claimed complete but ${remainingCount} tasks remain`);
        console.log("");
        console.log(pc.yellow("==========================================="));
        console.log(pc.yellow(`  AI claimed complete but ${remainingCount} tasks remain`));
        console.log(pc.yellow("  Continuing to next iteration..."));
        console.log(pc.yellow("==========================================="));
        await sleep(config.sleepSeconds);
        continue;
      }

      // Final test run
      if (!config.skipTestVerify && testCmd) {
        console.log("");
        console.log("  Final verification: running full test suite...");
        const finalVerification = verify(testCmd);
        
        if (!finalVerification.testsPassed) {
          logError("Final verification failed");
          console.log("");
          console.log(pc.red("==========================================="));
          console.log(pc.red("  Final tests failed!"));
          console.log(pc.red("  Continuing to fix..."));
          console.log(pc.red("==========================================="));
          await sleep(config.sleepSeconds);
          continue;
        }
      }

      // Success!
      logSuccess("All tasks completed successfully!");
      console.log(pc.green("==========================================="));
      console.log(pc.green(`  All tasks complete after ${iteration} iterations!`));
      console.log(pc.green("  All tests passing!"));
      console.log(`  Log: ${logFile}`);
      console.log(pc.green("==========================================="));
      process.exit(0);
    }

    await sleep(config.sleepSeconds);
  }

  // Max iterations reached
  logWarning(`Reached max iterations (${config.maxIterations})`);
  console.log(pc.yellow("==========================================="));
  console.log(pc.yellow(`  Reached max iterations (${config.maxIterations})`));
  console.log(`  Log: ${logFile}`);
  console.log(pc.yellow("==========================================="));
  process.exit(1);
}

export async function runSingleTask(
  config: Config,
  options: RunOptions,
  task: string,
  engineOverride?: Engine
): Promise<void> {
  const projectName = basename(process.cwd());
  const logFile = join(config.logDir, `ralph-${projectName}.log`);

  // Initialize
  initLogger({ logFile, verbose: options.verbose });
  initProgress();

  // Create engine
  const engine: Engine = engineOverride ?? (
    config.engine === "claude"
      ? new ClaudeEngine(config.claudeModel)
      : new OpenCodeEngine(config.ocPrimeModel, config.ocFallModel)
  );

  // Verify engine is available
  if (!engine.isAvailable()) {
    logError(`'${engine.name}' command not found. Please install ${engine.name === "claude" ? "Claude CLI" : "OpenCode CLI"}.`);
    process.exitCode = 1;
    return;
  }

  // Detect test command
  const testCmd = config.testCmd || detectTestCommand();

  // Log session start
  logSessionStart(projectName, config.engine, getCurrentModel(config));

  // Print startup info
  console.log(`Starting Ralph (${config.engine}) - Single task mode`);
  console.log(`Using model: ${getCurrentModel(config)}`);

  if (config.engine === "opencode" && config.ocFallModel) {
    console.log(`Fallback model: ${config.ocFallModel}`);
  }

  if (config.skipCommit) {
    console.log("Commits disabled for this run");
  }

  if (config.skipTestVerify) {
    console.log(pc.yellow("  Test verification DISABLED"));
    logWarning("Test verification disabled");
  } else if (testCmd) {
    console.log(`  Test command: ${testCmd}`);
    logInfo(`Test command: ${testCmd}`);
  } else {
    console.log(pc.yellow("  No test command detected (configure TEST_CMD in ralph.env)"));
    logWarning("No test command detected");
  }

  console.log(`  Log file: ${logFile}`);
  console.log("");

  // Generate prompt
  const prompt = generateSingleTaskPrompt(task, config.skipCommit);

  // Log iteration
  logIteration(1, 1, task, engine.model);

  // Run engine (single attempt with optional fallback)
  let result = await engine.run(prompt);
  logAiOutput(result.output);
  console.log("");

  if (!result.success && result.rateLimited && engine.switchToFallback?.()) {
    result = await engine.run(prompt);
    logAiOutput(result.output);
    console.log("");
  }

  if (!result.success) {
    logError(`${engine.name} failed with exit code ${result.exitCode}`);
    process.exitCode = result.exitCode;
    return;
  }

  // Test verification gate
  if (!config.skipTestVerify && testCmd) {
    const verification = verify(testCmd);

    if (!verification.testsWritten) {
      logWarning("No tests written, single task failed");
      appendFailure(
        1,
        "No test files were created or modified",
        "You MUST write tests before the task can be completed"
      );
      process.exitCode = 1;
      return;
    }

    if (!verification.testsPassed) {
      logWarning("Tests failed, single task failed");
      appendFailure(
        1,
        "Tests failed",
        "Fix the failing tests before marking the task complete"
      );
      process.exitCode = 1;
      return;
    }

    logInfo("Verification passed");
  }

  logSuccess("Single task completed successfully!");
  console.log(pc.green("==========================================="));
  console.log(pc.green("  Single task iteration complete"));
  console.log(pc.green("  All tests passing!"));
  console.log(`  Log: ${logFile}`);
  console.log(pc.green("==========================================="));
}
