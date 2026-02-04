import { join, basename } from "node:path";
import type { Config } from "../../config/loader.js";
import { getCurrentModel } from "../../config/loader.js";
import { ClaudeEngine } from "../../engines/claude.js";
import { OpenCodeEngine } from "../../engines/opencode.js";
import { COMPLETE_MARKER, generatePrompt, generateSingleTaskPrompt, generateFixTestsPrompt, type Engine } from "../../engines/base.js";
import { parsePrd, getFirstIncompleteTask, countIncompleteTasks, allTasksComplete } from "../../tasks/parser.js";
import { appendFailure, initProgress, getProgressFile } from "../../tasks/progress.js";
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

/**
 * Handle soft rate limit with exponential backoff
 * Returns true if should retry, false if should give up
 */
async function handleSoftRateLimit(
  attempt: number,
  maxRetries: number,
  baseWait: number
): Promise<boolean> {
  if (attempt >= maxRetries) {
    logWarning(`Soft rate limit: exhausted ${maxRetries} retries`);
    console.log(`⚠️  Soft rate limit persisted after ${maxRetries} retries`);
    return false;
  }

  // Exponential backoff: baseWait * 2^attempt (e.g., 30s, 60s, 120s)
  const waitTime = baseWait * Math.pow(2, attempt);

  console.log("");
  console.log("───────────────────────────────────────────────────────────────");
  console.log(`  ⏳ Soft rate limit detected (attempt ${attempt + 1}/${maxRetries})`);
  console.log(`  Waiting ${waitTime}s before retry...`);
  console.log("───────────────────────────────────────────────────────────────");
  logInfo(`Soft rate limit: waiting ${waitTime}s (attempt ${attempt + 1}/${maxRetries})`);

  await sleep(waitTime);
  return true;
}

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
  const progressFile = getProgressFile(projectName, config.progressDir);
  
  // Initialize
  initLogger({ logFile, verbose: options.verbose });
  initProgress(config.progressDir, progressFile);
  
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
  const prompt = generatePrompt({
    skipCommit: config.skipCommit,
    btcaEnabled: config.btcaEnabled,
    btcaResources: config.btcaResources,
    progressFile,
  });
  
  // Main loop
  let iteration = 0;
  let consecutiveFailures = 0;
  let softLimitRetries = 0;
  let lastFailedTask = "";
  let testFailureMode = false;
  let lastTestOutput = "";

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

    // Log iteration with fix mode indicator
    logIteration(iteration, config.maxIterations, taskName, engine.model);
    if (testFailureMode) {
      console.log(pc.yellow("  Mode: FIX TESTS"));
    }

    // Get the appropriate prompt (normal or fix-tests)
    const currentPrompt = testFailureMode && lastTestOutput
      ? generateFixTestsPrompt({
          testOutput: lastTestOutput,
          skipCommit: config.skipCommit,
          progressFile,
        })
      : prompt;

    // Run engine
    const result = await engine.run(currentPrompt);
    logAiOutput(result.output);
    console.log("");

    // Handle rate limits (OpenCode only) - hard vs soft distinction
    if (config.engine === "opencode") {
      // Hard rate limit: quota/billing - immediate fallback
      if (result.hardRateLimited) {
        logWarning("Hard rate limit detected (quota/billing)");
        console.log("🚫 Hard rate limit: quota or billing issue");
        softLimitRetries = 0; // Reset soft counter

        if (engine.switchToFallback?.()) {
          iteration--;
          continue;
        } else {
          logError("Hard rate limit and no fallback available");
          console.log("❌ Hard rate limit and no fallback available");
          process.exit(1);
        }
      }

      // Soft rate limit: temporary cooldown - retry first
      if (result.softRateLimited) {
        logWarning("Soft rate limit detected (temporary cooldown)");
        
        if (await handleSoftRateLimit(softLimitRetries, config.softLimitRetries, config.softLimitWait)) {
          softLimitRetries++;
          iteration--; // Retry same iteration
          continue;
        } else {
          // Retries exhausted, try fallback
          softLimitRetries = 0;
          if (engine.switchToFallback?.()) {
            iteration--;
            continue;
          } else {
            logError("Soft rate limit persisted, no fallback available");
            console.log("❌ Rate limit persisted after retries, no fallback available");
            process.exit(1);
          }
        }
      }

      // Reset soft limit counter on successful iteration
      softLimitRetries = 0;
    }

    // Handle non-rate-limit errors
    if (!result.success) {
      logError(`${engine.name} failed with exit code ${result.exitCode}`);
      process.exit(result.exitCode);
    }

    // Test verification gate
    if (!config.skipTestVerify && testCmd) {
      const verification = verify(testCmd);
      
      if (!verification.testsWritten) {
        // Only increment if same task is failing
        if (taskName !== lastFailedTask) {
          consecutiveFailures = 1;
          lastFailedTask = taskName;
          logInfo("Task changed, resetting failure counter");
        } else {
          consecutiveFailures++;
        }
        
        logWarning(`No tests written, iteration failed (${consecutiveFailures}/${config.maxConsecutiveFailures})`);
        
        appendFailure(
          progressFile,
          iteration,
          "No test files were created or modified",
          "You MUST write tests before the task can be completed"
        );

        if (consecutiveFailures >= config.maxConsecutiveFailures) {
          logError(`Too many consecutive failures on task '${taskName}', stopping`);
          console.log(pc.red("  Too many consecutive failures on this task"));
          console.log(pc.red("  Manual intervention required"));
          console.log(`  Check log: ${logFile}`);
          process.exit(1);
        }

        console.log(`  Verification failed (${consecutiveFailures}/${config.maxConsecutiveFailures})`);
        console.log("  Continuing to next iteration to fix...");
        await sleep(config.sleepSeconds);
        continue;
      }

      if (!verification.testsPassed) {
        // Only increment if same task is failing
        if (taskName !== lastFailedTask) {
          consecutiveFailures = 1;
          lastFailedTask = taskName;
          logInfo("Task changed, resetting failure counter");
        } else {
          consecutiveFailures++;
        }
        
        logWarning(`Tests failed, iteration failed (${consecutiveFailures}/${config.maxConsecutiveFailures})`);
        
        // Set test failure mode and capture test output
        testFailureMode = true;
        lastTestOutput = verification.testOutput || "";
        
        appendFailure(
          progressFile,
          iteration,
          "Tests failed",
          "Fix the failing tests before marking the task complete",
          verification.testOutput
        );

        if (consecutiveFailures >= config.maxConsecutiveFailures) {
          logError(`Too many consecutive failures on task '${taskName}', stopping`);
          console.log(pc.red("  Too many consecutive failures on this task"));
          console.log(pc.red("  Manual intervention required"));
          console.log(`  Check log: ${logFile}`);
          process.exit(1);
        }

        console.log(`  Verification failed (${consecutiveFailures}/${config.maxConsecutiveFailures})`);
        console.log("  Continuing to next iteration to fix...");
        console.log(pc.yellow("  Next iteration will use fix-tests prompt with test output"));
        await sleep(config.sleepSeconds);
        continue;
      }

      // Reset failure counter and test failure mode on success
      consecutiveFailures = 0;
      lastFailedTask = "";
      testFailureMode = false;
      lastTestOutput = "";
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
  const progressFile = getProgressFile(projectName, config.progressDir);

  // Initialize
  initLogger({ logFile, verbose: options.verbose });
  initProgress(config.progressDir, progressFile);

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
  const prompt = generateSingleTaskPrompt(task, {
    skipCommit: config.skipCommit,
    btcaEnabled: config.btcaEnabled,
    btcaResources: config.btcaResources,
    progressFile,
  });

  // Log iteration
  logIteration(1, 1, task, engine.model);

  // Run engine with rate limit handling
  let result = await engine.run(prompt);
  logAiOutput(result.output);
  console.log("");

  // Handle rate limits (OpenCode only)
  if (config.engine === "opencode" && (result.hardRateLimited || result.softRateLimited)) {
    let softLimitRetries = 0;

    while (result.softRateLimited || result.hardRateLimited) {
      if (result.hardRateLimited) {
        // Hard rate limit: immediate fallback
        logWarning("Hard rate limit detected (quota/billing)");
        if (engine.switchToFallback?.()) {
          result = await engine.run(prompt);
          logAiOutput(result.output);
          console.log("");
          break;
        } else {
          logError("Hard rate limit and no fallback available");
          process.exitCode = 1;
          return;
        }
      }

      if (result.softRateLimited) {
        // Soft rate limit: retry with backoff
        if (await handleSoftRateLimit(softLimitRetries, config.softLimitRetries, config.softLimitWait)) {
          softLimitRetries++;
          result = await engine.run(prompt);
          logAiOutput(result.output);
          console.log("");
        } else {
          // Retries exhausted, try fallback
          if (engine.switchToFallback?.()) {
            result = await engine.run(prompt);
            logAiOutput(result.output);
            console.log("");
            break;
          } else {
            logError("Soft rate limit persisted, no fallback available");
            process.exitCode = 1;
            return;
          }
        }
      }
    }
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
        progressFile,
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
        progressFile,
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
