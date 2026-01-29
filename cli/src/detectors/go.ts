import { BaseDetector } from "./base.js";
import type { DetectionResult, Language, DetectedCommands } from "./types.js";

/**
 * Parsed go.mod information
 */
interface GoMod {
  module?: string;
  go?: string;
  require?: GoRequire[];
}

/**
 * A require directive in go.mod
 */
interface GoRequire {
  path: string;
  version: string;
}

/**
 * Framework detection result
 */
interface FrameworkDetection {
  name: string;
  confidence: number;
}

/**
 * Go project detector
 * Detects Go projects by parsing go.mod
 */
export class GoDetector extends BaseDetector {
  readonly name = "go";
  readonly languages: Language[] = ["go"];

  /**
   * Known frameworks and their detection signatures (module paths)
   */
  private readonly frameworkSignatures: Record<string, string[]> = {
    gin: ["github.com/gin-gonic/gin"],
    echo: ["github.com/labstack/echo"],
    fiber: ["github.com/gofiber/fiber"],
    chi: ["github.com/go-chi/chi"],
    gorilla: ["github.com/gorilla/mux"],
    beego: ["github.com/beego/beego"],
    iris: ["github.com/kataras/iris"],
  };

  /**
   * Known linter modules
   */
  private readonly linterModules: Record<string, string> = {
    "github.com/golangci/golangci-lint": "golangci-lint run",
    "honnef.co/go/tools": "staticcheck ./...",
  };

  async canDetect(projectPath: string): Promise<boolean> {
    return this.fileExists(projectPath, "go.mod");
  }

  async detect(projectPath: string): Promise<DetectionResult> {
    const goMod = await this.parseGoMod(projectPath);
    if (!goMod) {
      return this.notDetected();
    }

    const name = this.extractModuleName(goMod.module);
    const deps = goMod.require?.map(r => r.path) || [];
    const framework = this.detectFramework(deps);
    const commands = this.detectCommands(projectPath, deps);

    let confidence = 0.8; // Base confidence for go.mod
    if (framework) confidence += 0.1;
    if (commands.lint) confidence += 0.05;
    if (goMod.go) confidence += 0.05; // Has explicit Go version

    return {
      detected: true,
      confidence: Math.min(confidence, 1),
      project: {
        name: name || "unnamed-project",
        language: "go",
        framework: framework?.name,
        packageManager: "go", // Go modules
      },
      commands,
    };
  }

  /**
   * Parse go.mod file
   */
  private async parseGoMod(projectPath: string): Promise<GoMod | null> {
    const content = await this.readTextFile(projectPath, "go.mod");
    if (!content) {
      return null;
    }

    try {
      return this.parseGoModContent(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse go.mod content
   */
  private parseGoModContent(content: string): GoMod {
    const result: GoMod = {};
    const lines = content.split("\n");
    let inRequireBlock = false;
    const requires: GoRequire[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith("//")) {
        continue;
      }

      // Handle module directive
      const moduleMatch = trimmed.match(/^module\s+(.+)$/);
      if (moduleMatch) {
        result.module = moduleMatch[1].trim();
        continue;
      }

      // Handle go version directive
      const goMatch = trimmed.match(/^go\s+(\d+\.\d+(?:\.\d+)?)$/);
      if (goMatch) {
        result.go = goMatch[1];
        continue;
      }

      // Handle require block start
      if (trimmed === "require (") {
        inRequireBlock = true;
        continue;
      }

      // Handle require block end
      if (trimmed === ")") {
        inRequireBlock = false;
        continue;
      }

      // Handle single-line require
      const singleRequireMatch = trimmed.match(/^require\s+(\S+)\s+(\S+)/);
      if (singleRequireMatch) {
        requires.push({
          path: singleRequireMatch[1],
          version: singleRequireMatch[2],
        });
        continue;
      }

      // Handle require block entries
      if (inRequireBlock) {
        const requireMatch = trimmed.match(/^(\S+)\s+(\S+)/);
        if (requireMatch) {
          requires.push({
            path: requireMatch[1],
            version: requireMatch[2],
          });
        }
      }
    }

    if (requires.length > 0) {
      result.require = requires;
    }

    return result;
  }

  /**
   * Extract project name from module path
   * e.g., "github.com/user/project" -> "project"
   */
  private extractModuleName(modulePath: string | undefined): string | undefined {
    if (!modulePath) {
      return undefined;
    }

    const parts = modulePath.split("/");
    return parts[parts.length - 1];
  }

  /**
   * Detect framework from dependencies
   */
  detectFramework(deps: string[]): FrameworkDetection | null {
    // Check frameworks in priority order
    const frameworkOrder = [
      "gin",
      "echo",
      "fiber",
      "chi",
      "gorilla",
      "beego",
      "iris",
    ];

    for (const framework of frameworkOrder) {
      const signatures = this.frameworkSignatures[framework];
      // Check if any dependency starts with the signature (handles version suffixes)
      if (signatures.some(sig => deps.some(dep => dep.startsWith(sig)))) {
        return {
          name: framework,
          confidence: 0.9,
        };
      }
    }

    return null;
  }

  /**
   * Detect commands for Go project
   */
  detectCommands(projectPath: string, deps: string[]): DetectedCommands {
    const commands: DetectedCommands = {};

    // Go test is always available
    commands.test = "go test ./...";

    // Go build is always available
    commands.build = "go build ./...";

    // Detect lint command
    // Check for golangci-lint config files first
    if (
      this.fileExists(projectPath, ".golangci.yml") ||
      this.fileExists(projectPath, ".golangci.yaml") ||
      this.fileExists(projectPath, ".golangci.toml") ||
      this.fileExists(projectPath, ".golangci.json")
    ) {
      commands.lint = "golangci-lint run";
    } else {
      // Check dependencies for linters
      for (const [modulePath, cmd] of Object.entries(this.linterModules)) {
        if (deps.some(dep => dep.startsWith(modulePath))) {
          commands.lint = cmd;
          break;
        }
      }

      // Default to golangci-lint if no specific linter found but project has dependencies
      // (suggesting it's a real project, not just a script)
      if (!commands.lint && deps.length > 0) {
        commands.lint = "golangci-lint run";
      }
    }

    return commands;
  }
}
