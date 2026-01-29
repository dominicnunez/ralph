import { BaseDetector } from "./base.js";
import type { DetectionResult, Language, DetectedCommands } from "./types.js";

/**
 * Parsed Cargo.toml information
 */
interface CargoToml {
  name?: string;
  edition?: string;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

/**
 * Framework detection result
 */
interface FrameworkDetection {
  name: string;
  confidence: number;
}

/**
 * Rust project detector
 * Detects Rust projects by parsing Cargo.toml
 */
export class RustDetector extends BaseDetector {
  readonly name = "rust";
  readonly languages: Language[] = ["rust"];

  /**
   * Known frameworks and their detection signatures (crate names)
   */
  private readonly frameworkSignatures: Record<string, string[]> = {
    actix: ["actix-web", "actix-rt"],
    axum: ["axum"],
    rocket: ["rocket"],
    warp: ["warp"],
    tide: ["tide"],
    hyper: ["hyper"],
    tokio: ["tokio"],
  };

  /**
   * Framework detection priority (more specific first)
   */
  private readonly frameworkPriority = [
    "actix",
    "axum",
    "rocket",
    "warp",
    "tide",
    "hyper",
    "tokio",
  ];

  async canDetect(projectPath: string): Promise<boolean> {
    return this.fileExists(projectPath, "Cargo.toml");
  }

  async detect(projectPath: string): Promise<DetectionResult> {
    const cargoToml = await this.parseCargoToml(projectPath);
    if (!cargoToml) {
      return this.notDetected();
    }

    const allDeps = this.getAllDependencies(cargoToml);
    const framework = this.detectFramework(allDeps);
    const commands = this.detectCommands(projectPath);

    let confidence = 0.8; // Base confidence for Cargo.toml
    if (framework) confidence += 0.1;
    if (commands.lint) confidence += 0.05;
    if (cargoToml.edition) confidence += 0.05; // Has explicit Rust edition

    return {
      detected: true,
      confidence: Math.min(confidence, 1),
      project: {
        name: cargoToml.name || "unnamed-project",
        language: "rust",
        framework: framework?.name,
        packageManager: "cargo",
      },
      commands,
    };
  }

  /**
   * Parse Cargo.toml file
   * Uses a simple TOML parser for the fields we care about
   */
  private async parseCargoToml(projectPath: string): Promise<CargoToml | null> {
    const content = await this.readTextFile(projectPath, "Cargo.toml");
    if (!content) {
      return null;
    }

    try {
      return this.parseCargoTomlContent(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse Cargo.toml content
   * Simple TOML parser that handles the fields we need
   */
  private parseCargoTomlContent(content: string): CargoToml {
    const result: CargoToml = {};
    const lines = content.split("\n");
    let currentSection = "";
    const dependencies: Record<string, unknown> = {};
    const devDependencies: Record<string, unknown> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip empty lines and comments
      if (!line || line.startsWith("#")) {
        continue;
      }

      // Handle section headers
      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].toLowerCase();
        continue;
      }

      // Handle key-value pairs
      const kvMatch = line.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        let value = kvMatch[2].trim();

        // Remove quotes from string values
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        // Handle inline tables like { version = "1.0", features = ["full"] }
        if (value.startsWith("{")) {
          // For dependencies, just mark as present
          if (currentSection === "dependencies") {
            dependencies[key] = true;
          } else if (
            currentSection === "dev-dependencies" ||
            currentSection === "dev_dependencies"
          ) {
            devDependencies[key] = true;
          }
          continue;
        }

        // Store based on section
        if (currentSection === "package") {
          if (key === "name") {
            result.name = value;
          } else if (key === "edition") {
            result.edition = value;
          }
        } else if (currentSection === "dependencies") {
          dependencies[key] = value;
        } else if (
          currentSection === "dev-dependencies" ||
          currentSection === "dev_dependencies"
        ) {
          devDependencies[key] = value;
        }
      }
    }

    if (Object.keys(dependencies).length > 0) {
      result.dependencies = dependencies;
    }
    if (Object.keys(devDependencies).length > 0) {
      result.devDependencies = devDependencies;
    }

    return result;
  }

  /**
   * Get all dependencies (both regular and dev) as a list of crate names
   */
  private getAllDependencies(cargoToml: CargoToml): string[] {
    const deps = new Set<string>();

    if (cargoToml.dependencies) {
      for (const dep of Object.keys(cargoToml.dependencies)) {
        deps.add(dep.toLowerCase());
      }
    }

    if (cargoToml.devDependencies) {
      for (const dep of Object.keys(cargoToml.devDependencies)) {
        deps.add(dep.toLowerCase());
      }
    }

    return Array.from(deps);
  }

  /**
   * Detect framework from dependencies
   */
  detectFramework(deps: string[]): FrameworkDetection | null {
    const normalizedDeps = deps.map((d) => d.toLowerCase());

    // Check frameworks in priority order
    for (const framework of this.frameworkPriority) {
      const signatures = this.frameworkSignatures[framework];
      if (signatures.some((sig) => normalizedDeps.includes(sig.toLowerCase()))) {
        return {
          name: framework,
          confidence: 0.9,
        };
      }
    }

    return null;
  }

  /**
   * Detect commands for Rust project
   */
  detectCommands(projectPath: string): DetectedCommands {
    const commands: DetectedCommands = {};

    // cargo test is always available
    commands.test = "cargo test";

    // cargo build is always available
    commands.build = "cargo build";

    // Check for clippy configuration or rustfmt
    // Clippy is the standard Rust linter
    if (
      this.fileExists(projectPath, ".clippy.toml") ||
      this.fileExists(projectPath, "clippy.toml")
    ) {
      commands.lint = "cargo clippy";
    } else if (this.fileExists(projectPath, "rustfmt.toml")) {
      // Has rustfmt config, suggest both clippy and fmt
      commands.lint = "cargo clippy && cargo fmt --check";
    } else {
      // Default to clippy for all Rust projects
      commands.lint = "cargo clippy";
    }

    return commands;
  }
}
