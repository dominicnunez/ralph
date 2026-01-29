import { createInterface } from "node:readline";
import {
  createRegistry,
  NodejsDetector,
  PythonDetector,
  GoDetector,
  RustDetector,
} from "../../detectors/index.js";
import {
  detectionToConfig,
  configToYaml,
  configExists,
  writeConfig,
  getConfigPath,
} from "../../config/generator.js";
import { logInfo, logSuccess, logError, logWarning } from "../../ui/logger.js";
import type { DetectionResult } from "../../detectors/types.js";

export interface InitOptions {
  force?: boolean;
  yes?: boolean;
}

export interface InitResult {
  success: boolean;
  path?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Prompt user for confirmation
 */
async function confirm(message: string, defaultYes = false): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const suffix = defaultYes ? "[Y/n]" : "[y/N]";

  return new Promise((resolve) => {
    rl.question(`${message} ${suffix} `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      if (normalized === "") {
        resolve(defaultYes);
      } else {
        resolve(normalized === "y" || normalized === "yes");
      }
    });
  });
}

/**
 * Create a registry with all detectors
 */
function createDetectorRegistry() {
  const registry = createRegistry();
  registry.register(new NodejsDetector());
  registry.register(new PythonDetector());
  registry.register(new GoDetector());
  registry.register(new RustDetector());
  return registry;
}

/**
 * Display detection results to the user
 */
function displayDetectionResult(result: DetectionResult): void {
  if (!result.detected || !result.project) {
    logWarning("Could not detect project type.");
    return;
  }

  logInfo("");
  logInfo("Detected project:");
  logInfo(`  Name:       ${result.project.name}`);
  logInfo(`  Language:   ${result.project.language}`);
  if (result.project.framework) {
    logInfo(`  Framework:  ${result.project.framework}`);
  }
  if (result.project.packageManager) {
    logInfo(`  Package Manager: ${result.project.packageManager}`);
  }

  if (result.commands) {
    logInfo("");
    logInfo("Detected commands:");
    if (result.commands.test) {
      logInfo(`  Test:  ${result.commands.test}`);
    }
    if (result.commands.lint) {
      logInfo(`  Lint:  ${result.commands.lint}`);
    }
    if (result.commands.build) {
      logInfo(`  Build: ${result.commands.build}`);
    }
  }

  logInfo("");
  logInfo(`Confidence: ${Math.round(result.confidence * 100)}%`);
}

/**
 * Display the config that will be generated
 */
function displayConfigPreview(result: DetectionResult): void {
  const config = detectionToConfig(result);
  if (!config) {
    return;
  }

  logInfo("");
  logInfo("Config preview:");
  logInfo("---");
  const yaml = configToYaml(config);
  for (const line of yaml.split("\n")) {
    logInfo(line);
  }
  logInfo("---");
}

/**
 * Run the init command
 */
export async function runInit(
  projectPath: string,
  options: InitOptions = {}
): Promise<InitResult> {
  const configPath = getConfigPath(projectPath);
  const exists = configExists(projectPath);

  // Check for existing config
  if (exists && !options.force) {
    if (options.yes) {
      // In non-interactive mode, don't overwrite unless --force
      return {
        success: false,
        path: configPath,
        error: "Config file already exists. Use --force to overwrite.",
        skipped: true,
      };
    }

    logWarning(`Config already exists at ${configPath}`);
    const shouldOverwrite = await confirm("Overwrite existing config?", false);
    if (!shouldOverwrite) {
      logInfo("Aborted. No changes made.");
      return {
        success: false,
        path: configPath,
        skipped: true,
      };
    }
  }

  // Detect project
  logInfo("Detecting project...");
  const registry = createDetectorRegistry();
  const result = await registry.detectProject(projectPath);

  if (!result.detected) {
    logError("Could not detect project type.");
    logInfo("Supported projects: Node.js, Python, Go, Rust");
    return {
      success: false,
      error: "Could not detect project type",
    };
  }

  // Display detection results
  displayDetectionResult(result);
  displayConfigPreview(result);

  // Confirm before writing
  if (!options.yes) {
    const shouldWrite = await confirm("Create config file?", true);
    if (!shouldWrite) {
      logInfo("Aborted. No changes made.");
      return {
        success: false,
        skipped: true,
      };
    }
  }

  // Write config
  const config = detectionToConfig(result);
  if (!config) {
    return {
      success: false,
      error: "Failed to generate config from detection result",
    };
  }

  const writeResult = writeConfig(projectPath, config, options.force || exists);

  if (writeResult.success) {
    logSuccess(`Config created at ${writeResult.path}`);
    return {
      success: true,
      path: writeResult.path,
    };
  } else {
    logError(`Failed to write config: ${writeResult.error}`);
    return {
      success: false,
      path: writeResult.path,
      error: writeResult.error,
    };
  }
}

/**
 * Run init in non-interactive mode (for testing)
 * Skips all prompts and uses default behavior
 */
export async function runInitNonInteractive(
  projectPath: string,
  options: { force?: boolean } = {}
): Promise<InitResult> {
  return runInit(projectPath, { ...options, yes: true });
}
