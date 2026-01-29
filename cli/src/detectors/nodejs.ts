import { existsSync } from "node:fs";
import { join } from "node:path";
import { BaseDetector } from "./base.js";
import type { DetectionResult, Language, DetectedCommands } from "./types.js";

/**
 * Package.json structure (partial)
 */
interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Supported package managers for Node.js projects
 */
type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/**
 * Framework detection result
 */
interface FrameworkDetection {
  name: string;
  confidence: number;
}

/**
 * Node.js project detector
 * Detects Node.js/TypeScript/JavaScript projects by parsing package.json
 */
export class NodejsDetector extends BaseDetector {
  readonly name = "nodejs";
  readonly languages: Language[] = ["typescript", "javascript"];

  /**
   * Known frameworks and their detection signatures
   */
  private readonly frameworkSignatures: Record<
    string,
    { deps: string[]; devDeps: string[] }
  > = {
    next: { deps: ["next"], devDeps: [] },
    sveltekit: { deps: ["@sveltejs/kit"], devDeps: ["@sveltejs/kit"] },
    svelte: { deps: ["svelte"], devDeps: ["svelte"] },
    react: { deps: ["react"], devDeps: [] },
    vue: { deps: ["vue"], devDeps: [] },
    express: { deps: ["express"], devDeps: [] },
    fastify: { deps: ["fastify"], devDeps: [] },
    nestjs: { deps: ["@nestjs/core"], devDeps: [] },
    nuxt: { deps: ["nuxt"], devDeps: [] },
  };

  /**
   * Known test frameworks
   */
  private readonly testFrameworks = [
    "vitest",
    "jest",
    "mocha",
    "ava",
    "tap",
    "bun",
  ];

  /**
   * Known linters
   */
  private readonly linters = [
    "eslint",
    "biome",
    "@biomejs/biome",
    "prettier",
    "oxlint",
  ];

  async canDetect(projectPath: string): Promise<boolean> {
    return this.fileExists(projectPath, "package.json");
  }

  async detect(projectPath: string): Promise<DetectionResult> {
    const packageJson = await this.readJsonFile<PackageJson>(
      projectPath,
      "package.json"
    );

    if (!packageJson) {
      return this.notDetected();
    }

    const packageManager = this.detectPackageManager(projectPath);
    const framework = this.detectFramework(packageJson);
    const language = this.detectLanguage(projectPath, packageJson);
    const commands = this.detectCommands(packageJson, packageManager);

    // Calculate confidence based on how much we detected
    let confidence = 0.6; // Base confidence for having package.json
    if (framework) confidence += 0.2;
    if (commands.test) confidence += 0.1;
    if (commands.lint) confidence += 0.05;
    if (commands.build) confidence += 0.05;

    return {
      detected: true,
      confidence: Math.min(confidence, 1),
      project: {
        name: packageJson.name || "unnamed-project",
        language,
        framework: framework?.name,
        packageManager,
      },
      commands,
    };
  }

  /**
   * Detect the package manager based on lock files
   */
  detectPackageManager(projectPath: string): PackageManager {
    // Check lock files in priority order
    if (existsSync(join(projectPath, "bun.lockb"))) {
      return "bun";
    }
    if (existsSync(join(projectPath, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (existsSync(join(projectPath, "yarn.lock"))) {
      return "yarn";
    }
    // Default to npm
    return "npm";
  }

  /**
   * Detect the primary framework used in the project
   */
  detectFramework(packageJson: PackageJson): FrameworkDetection | null {
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    const allDeps = { ...deps, ...devDeps };

    // Check frameworks in order of specificity (more specific first)
    const frameworkOrder = [
      "sveltekit",
      "next",
      "nuxt",
      "nestjs",
      "svelte",
      "react",
      "vue",
      "express",
      "fastify",
    ];

    for (const framework of frameworkOrder) {
      const signature = this.frameworkSignatures[framework];
      if (!signature) continue;

      const hasDep = signature.deps.some((dep) => dep in allDeps);
      const hasDevDep = signature.devDeps.some((dep) => dep in allDeps);

      if (hasDep || hasDevDep) {
        return {
          name: framework,
          confidence: hasDep ? 0.9 : 0.7,
        };
      }
    }

    return null;
  }

  /**
   * Detect if the project uses TypeScript or JavaScript
   */
  detectLanguage(projectPath: string, packageJson: PackageJson): Language {
    const devDeps = packageJson.devDependencies || {};
    const deps = packageJson.dependencies || {};

    // Check for TypeScript dependency
    if ("typescript" in devDeps || "typescript" in deps) {
      return "typescript";
    }

    // Check for tsconfig.json
    if (this.fileExists(projectPath, "tsconfig.json")) {
      return "typescript";
    }

    return "javascript";
  }

  /**
   * Detect test, lint, and build commands from scripts
   */
  detectCommands(
    packageJson: PackageJson,
    packageManager: PackageManager
  ): DetectedCommands {
    const scripts = packageJson.scripts || {};
    const deps = packageJson.dependencies || {};
    const devDeps = packageJson.devDependencies || {};
    const allDeps = { ...deps, ...devDeps };

    const commands: DetectedCommands = {};
    const runCmd = this.getRunCommand(packageManager);

    // Detect test command
    if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
      commands.test = `${runCmd} test`;
    } else {
      // Check for test framework binaries
      for (const testFw of this.testFrameworks) {
        if (testFw in allDeps) {
          if (testFw === "bun") {
            commands.test = "bun test";
          } else if (testFw === "vitest") {
            commands.test = `${runCmd === "npm run" ? "npx" : packageManager} vitest`;
          } else if (testFw === "jest") {
            commands.test = `${runCmd === "npm run" ? "npx" : packageManager} jest`;
          } else {
            commands.test = `${runCmd} test`;
          }
          break;
        }
      }
    }

    // Detect lint command
    if (scripts.lint) {
      commands.lint = `${runCmd} lint`;
    } else {
      // Check for linter binaries
      for (const linter of this.linters) {
        if (linter in allDeps) {
          const linterBin = linter === "@biomejs/biome" ? "biome" : linter;
          if (linterBin === "eslint") {
            commands.lint = `${runCmd === "npm run" ? "npx" : packageManager} eslint .`;
          } else if (linterBin === "biome") {
            commands.lint = `${runCmd === "npm run" ? "npx" : packageManager} biome check`;
          }
          break;
        }
      }
    }

    // Detect build command
    if (scripts.build) {
      commands.build = `${runCmd} build`;
    }

    return commands;
  }

  /**
   * Get the appropriate run command for the package manager
   */
  private getRunCommand(packageManager: PackageManager): string {
    switch (packageManager) {
      case "bun":
        return "bun run";
      case "pnpm":
        return "pnpm";
      case "yarn":
        return "yarn";
      case "npm":
      default:
        return "npm run";
    }
  }
}
