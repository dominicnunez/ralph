import { BaseDetector } from "./base.js";
import type { DetectionResult, Language, DetectedCommands } from "./types.js";

/**
 * Pyproject.toml structure (partial)
 */
interface PyprojectToml {
  project?: {
    name?: string;
    dependencies?: string[];
  };
  tool?: {
    poetry?: {
      name?: string;
      dependencies?: Record<string, string | { version?: string }>;
      group?: Record<string, { dependencies?: Record<string, string | { version?: string }> }>;
    };
    ruff?: object;
    black?: object;
    pytest?: object;
  };
  "build-system"?: {
    requires?: string[];
    "build-backend"?: string;
  };
}

/**
 * Setup.py extracted info
 */
interface SetupPyInfo {
  name?: string;
  packages?: string[];
}

/**
 * Supported package managers for Python projects
 */
type PythonPackageManager = "pip" | "poetry" | "uv" | "pipenv" | "conda";

/**
 * Framework detection result
 */
interface FrameworkDetection {
  name: string;
  confidence: number;
}

/**
 * Python project detector
 * Detects Python projects by parsing pyproject.toml, setup.py, or requirements.txt
 */
export class PythonDetector extends BaseDetector {
  readonly name = "python";
  readonly languages: Language[] = ["python"];

  /**
   * Known frameworks and their detection signatures (package names)
   */
  private readonly frameworkSignatures: Record<string, string[]> = {
    fastapi: ["fastapi"],
    django: ["django"],
    flask: ["flask"],
    starlette: ["starlette"],
    tornado: ["tornado"],
    aiohttp: ["aiohttp"],
    pyramid: ["pyramid"],
    sanic: ["sanic"],
  };

  /**
   * Known test frameworks
   */
  private readonly testFrameworks = ["pytest", "unittest", "nose", "nose2"];

  /**
   * Known linters/formatters
   */
  private readonly linters: Record<string, string> = {
    ruff: "ruff check .",
    black: "black --check .",
    flake8: "flake8",
    pylint: "pylint",
    mypy: "mypy .",
  };

  async canDetect(projectPath: string): Promise<boolean> {
    return (
      this.fileExists(projectPath, "pyproject.toml") ||
      this.fileExists(projectPath, "setup.py") ||
      this.fileExists(projectPath, "requirements.txt")
    );
  }

  async detect(projectPath: string): Promise<DetectionResult> {
    // Try pyproject.toml first (modern Python projects)
    const pyproject = await this.parsePyprojectToml(projectPath);
    if (pyproject) {
      return this.detectFromPyproject(projectPath, pyproject);
    }

    // Try setup.py (legacy projects)
    const setupPy = await this.parseSetupPy(projectPath);
    if (setupPy) {
      return this.detectFromSetupPy(projectPath, setupPy);
    }

    // Fall back to requirements.txt
    const requirements = await this.readTextFile(projectPath, "requirements.txt");
    if (requirements) {
      return this.detectFromRequirements(projectPath, requirements);
    }

    return this.notDetected();
  }

  /**
   * Parse pyproject.toml file using simple TOML parsing
   */
  private async parsePyprojectToml(projectPath: string): Promise<PyprojectToml | null> {
    const content = await this.readTextFile(projectPath, "pyproject.toml");
    if (!content) {
      return null;
    }

    try {
      return this.parseToml(content) as PyprojectToml;
    } catch {
      return null;
    }
  }

  /**
   * Simple TOML parser for pyproject.toml
   * Handles basic TOML structure needed for project detection
   */
  private parseToml(content: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let currentSection: string[] = [];
    
    const lines = content.split("\n");
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip comments and empty lines
      if (line.startsWith("#") || line === "") {
        i++;
        continue;
      }
      
      // Handle section headers [section] or [section.subsection]
      const sectionMatch = line.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].split(".");
        // Initialize nested objects
        let obj = result;
        for (const part of currentSection) {
          if (!(part in obj)) {
            obj[part] = {};
          }
          obj = obj[part] as Record<string, unknown>;
        }
        i++;
        continue;
      }
      
      // Handle key = value pairs
      const kvMatch = line.match(/^([^=]+)=(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        let value = kvMatch[2].trim();
        
        // Handle multi-line arrays
        if (value.startsWith("[") && !value.endsWith("]")) {
          // Collect lines until we find the closing bracket
          let arrayContent = value;
          i++;
          while (i < lines.length) {
            const nextLine = lines[i].trim();
            arrayContent += " " + nextLine;
            if (nextLine.endsWith("]") || nextLine === "]") {
              break;
            }
            i++;
          }
          value = arrayContent;
        }
        
        // Navigate to current section
        let obj = result;
        for (const part of currentSection) {
          obj = obj[part] as Record<string, unknown>;
        }
        
        // Parse value
        obj[key] = this.parseTomlValue(value);
      }
      
      i++;
    }
    
    return result;
  }

  /**
   * Parse a TOML value
   */
  private parseTomlValue(value: string): unknown {
    // String values (single or double quoted)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Array values
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      if (inner === "") return [];
      return inner.split(",").map(item => {
        const trimmed = item.trim();
        if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
            (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
          return trimmed.slice(1, -1);
        }
        return trimmed;
      });
    }
    
    // Boolean values
    if (value === "true") return true;
    if (value === "false") return false;
    
    // Number values
    const num = Number(value);
    if (!isNaN(num)) return num;
    
    // Return as string
    return value;
  }

  /**
   * Extract info from setup.py
   */
  private async parseSetupPy(projectPath: string): Promise<SetupPyInfo | null> {
    const content = await this.readTextFile(projectPath, "setup.py");
    if (!content) {
      return null;
    }

    const info: SetupPyInfo = {};

    // Extract name from setup() call
    const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) {
      info.name = nameMatch[1];
    }

    // Extract packages
    const packagesMatch = content.match(/packages\s*=\s*\[([^\]]+)\]/);
    if (packagesMatch) {
      info.packages = packagesMatch[1]
        .split(",")
        .map(p => p.trim().replace(/["']/g, ""))
        .filter(p => p);
    }

    return Object.keys(info).length > 0 ? info : null;
  }

  /**
   * Detect from pyproject.toml
   */
  private async detectFromPyproject(
    projectPath: string,
    pyproject: PyprojectToml
  ): Promise<DetectionResult> {
    const packageManager = this.detectPackageManager(projectPath, pyproject);
    const name = this.extractProjectName(pyproject);
    const allDeps = this.extractAllDependencies(pyproject, projectPath);
    const framework = this.detectFramework(allDeps);
    const commands = this.detectCommands(allDeps, pyproject, packageManager);

    let confidence = 0.7; // Base confidence for pyproject.toml
    if (framework) confidence += 0.15;
    if (commands.test) confidence += 0.1;
    if (commands.lint) confidence += 0.05;

    return {
      detected: true,
      confidence: Math.min(confidence, 1),
      project: {
        name: name || "unnamed-project",
        language: "python",
        framework: framework?.name,
        packageManager,
      },
      commands,
    };
  }

  /**
   * Detect from setup.py
   */
  private async detectFromSetupPy(
    projectPath: string,
    setupPy: SetupPyInfo
  ): Promise<DetectionResult> {
    const requirements = await this.readTextFile(projectPath, "requirements.txt");
    const allDeps = requirements ? this.parseRequirements(requirements) : [];
    const packageManager = this.detectPackageManagerFromFiles(projectPath);
    const framework = this.detectFramework(allDeps);
    const commands = this.detectCommandsBasic(allDeps, packageManager);

    let confidence = 0.6; // Base confidence for setup.py
    if (framework) confidence += 0.15;
    if (commands.test) confidence += 0.1;

    return {
      detected: true,
      confidence: Math.min(confidence, 1),
      project: {
        name: setupPy.name || "unnamed-project",
        language: "python",
        framework: framework?.name,
        packageManager,
      },
      commands,
    };
  }

  /**
   * Detect from requirements.txt only
   */
  private detectFromRequirements(
    projectPath: string,
    requirements: string
  ): DetectionResult {
    const allDeps = this.parseRequirements(requirements);
    const packageManager = this.detectPackageManagerFromFiles(projectPath);
    const framework = this.detectFramework(allDeps);
    const commands = this.detectCommandsBasic(allDeps, packageManager);

    let confidence = 0.5; // Base confidence for requirements.txt only
    if (framework) confidence += 0.15;
    if (commands.test) confidence += 0.1;

    return {
      detected: true,
      confidence: Math.min(confidence, 1),
      project: {
        name: this.extractProjectNameFromPath(projectPath),
        language: "python",
        framework: framework?.name,
        packageManager,
      },
      commands,
    };
  }

  /**
   * Extract project name from pyproject.toml
   */
  private extractProjectName(pyproject: PyprojectToml): string | undefined {
    // PEP 621 style
    if (pyproject.project?.name) {
      return pyproject.project.name;
    }
    // Poetry style
    if (pyproject.tool?.poetry?.name) {
      return pyproject.tool.poetry.name;
    }
    return undefined;
  }

  /**
   * Extract project name from directory path
   */
  private extractProjectNameFromPath(projectPath: string): string {
    const parts = projectPath.split("/").filter(Boolean);
    return parts[parts.length - 1] || "unnamed-project";
  }

  /**
   * Extract all dependencies from pyproject.toml
   */
  private extractAllDependencies(pyproject: PyprojectToml, projectPath: string): string[] {
    const deps: Set<string> = new Set();

    // PEP 621 style dependencies
    if (pyproject.project?.dependencies) {
      for (const dep of pyproject.project.dependencies) {
        const name = this.extractPackageName(dep);
        if (name) deps.add(name.toLowerCase());
      }
    }

    // Poetry style dependencies
    if (pyproject.tool?.poetry?.dependencies) {
      for (const dep of Object.keys(pyproject.tool.poetry.dependencies)) {
        if (dep !== "python") {
          deps.add(dep.toLowerCase());
        }
      }
    }

    // Poetry dev dependencies (group.dev.dependencies)
    if (pyproject.tool?.poetry?.group?.dev?.dependencies) {
      for (const dep of Object.keys(pyproject.tool.poetry.group.dev.dependencies)) {
        deps.add(dep.toLowerCase());
      }
    }

    // Check for tool configurations that indicate dependencies
    if (pyproject.tool?.ruff) deps.add("ruff");
    if (pyproject.tool?.black) deps.add("black");
    if (pyproject.tool?.pytest) deps.add("pytest");

    // Also check requirements.txt if present
    const requirementsPath = `${projectPath}/requirements.txt`;
    // Note: We can't do async reads here, but we've already read pyproject.toml
    
    return Array.from(deps);
  }

  /**
   * Parse requirements.txt content
   */
  private parseRequirements(content: string): string[] {
    const deps: string[] = [];
    
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      // Skip comments, empty lines, and -r includes
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
        continue;
      }
      
      const name = this.extractPackageName(trimmed);
      if (name) {
        deps.push(name.toLowerCase());
      }
    }
    
    return deps;
  }

  /**
   * Extract package name from dependency string (handles version specifiers)
   */
  private extractPackageName(dep: string): string | null {
    // Handle version specifiers like "flask>=2.0" or "django[async]~=4.0"
    const match = dep.match(/^([a-zA-Z0-9_-]+)(?:\[.*\])?(?:[<>=~!].*)?\s*$/);
    return match ? match[1] : null;
  }

  /**
   * Detect package manager from pyproject.toml
   */
  detectPackageManager(projectPath: string, pyproject: PyprojectToml): PythonPackageManager {
    // Check for Poetry
    if (pyproject.tool?.poetry || 
        pyproject["build-system"]?.["build-backend"]?.includes("poetry")) {
      return "poetry";
    }

    // Check for uv (uv.lock file)
    if (this.fileExists(projectPath, "uv.lock")) {
      return "uv";
    }

    // Check for Pipenv (Pipfile)
    if (this.fileExists(projectPath, "Pipfile")) {
      return "pipenv";
    }

    // Check for Conda (environment.yml)
    if (this.fileExists(projectPath, "environment.yml") ||
        this.fileExists(projectPath, "environment.yaml")) {
      return "conda";
    }

    // Default to pip
    return "pip";
  }

  /**
   * Detect package manager from files only (no pyproject.toml)
   */
  private detectPackageManagerFromFiles(projectPath: string): PythonPackageManager {
    if (this.fileExists(projectPath, "poetry.lock")) {
      return "poetry";
    }
    if (this.fileExists(projectPath, "uv.lock")) {
      return "uv";
    }
    if (this.fileExists(projectPath, "Pipfile")) {
      return "pipenv";
    }
    if (this.fileExists(projectPath, "environment.yml") ||
        this.fileExists(projectPath, "environment.yaml")) {
      return "conda";
    }
    return "pip";
  }

  /**
   * Detect framework from dependencies
   */
  detectFramework(deps: string[]): FrameworkDetection | null {
    // Check frameworks in priority order (more specific first)
    const frameworkOrder = [
      "fastapi", // FastAPI is built on Starlette, check first
      "django",
      "flask",
      "starlette",
      "tornado",
      "aiohttp",
      "pyramid",
      "sanic",
    ];

    for (const framework of frameworkOrder) {
      const signatures = this.frameworkSignatures[framework];
      if (signatures.some(sig => deps.includes(sig.toLowerCase()))) {
        return {
          name: framework,
          confidence: 0.9,
        };
      }
    }

    return null;
  }

  /**
   * Detect commands from dependencies and pyproject.toml
   */
  detectCommands(
    deps: string[],
    pyproject: PyprojectToml,
    packageManager: PythonPackageManager
  ): DetectedCommands {
    const commands: DetectedCommands = {};
    const runPrefix = this.getRunPrefix(packageManager);

    // Detect test command
    if (deps.includes("pytest") || pyproject.tool?.pytest) {
      commands.test = `${runPrefix}pytest`;
    } else if (deps.some(d => this.testFrameworks.includes(d))) {
      commands.test = `${runPrefix}python -m unittest discover`;
    }

    // Detect lint command (prioritize ruff as modern choice)
    for (const [linter, cmd] of Object.entries(this.linters)) {
      if (deps.includes(linter) || (pyproject.tool && linter in pyproject.tool)) {
        commands.lint = `${runPrefix}${cmd}`;
        break;
      }
    }

    return commands;
  }

  /**
   * Detect commands from dependencies only (basic detection)
   */
  private detectCommandsBasic(
    deps: string[],
    packageManager: PythonPackageManager
  ): DetectedCommands {
    const commands: DetectedCommands = {};
    const runPrefix = this.getRunPrefix(packageManager);

    // Detect test command
    if (deps.includes("pytest")) {
      commands.test = `${runPrefix}pytest`;
    }

    // Detect lint command
    for (const [linter, cmd] of Object.entries(this.linters)) {
      if (deps.includes(linter)) {
        commands.lint = `${runPrefix}${cmd}`;
        break;
      }
    }

    return commands;
  }

  /**
   * Get the run prefix for the package manager
   */
  private getRunPrefix(packageManager: PythonPackageManager): string {
    switch (packageManager) {
      case "poetry":
        return "poetry run ";
      case "pipenv":
        return "pipenv run ";
      case "uv":
        return "uv run ";
      case "conda":
        return "conda run ";
      case "pip":
      default:
        return "";
    }
  }
}
