/**
 * Detected project information
 */
export interface DetectedProject {
  /** Project name (from package.json, go.mod, Cargo.toml, etc.) */
  name: string;
  /** Primary programming language */
  language: Language;
  /** Detected framework (if any) */
  framework?: string;
  /** Package manager used (npm, pnpm, yarn, bun, pip, cargo, etc.) */
  packageManager?: string;
}

/**
 * Detected commands for the project
 */
export interface DetectedCommands {
  /** Command to run tests */
  test?: string;
  /** Command to run linter */
  lint?: string;
  /** Command to build the project */
  build?: string;
}

/**
 * Complete detection result from a language detector
 */
export interface DetectionResult {
  /** Whether detection was successful */
  detected: boolean;
  /** Project information */
  project?: DetectedProject;
  /** Detected commands */
  commands?: DetectedCommands;
  /** Confidence score (0-1) for the detection */
  confidence: number;
}

/**
 * Supported programming languages
 */
export type Language = "typescript" | "javascript" | "python" | "go" | "rust";

/**
 * Base interface for language detectors
 */
export interface Detector {
  /** Name of the detector (e.g., "nodejs", "python") */
  readonly name: string;

  /** Languages this detector handles */
  readonly languages: Language[];

  /**
   * Check if this detector can handle the project in the given directory
   * @param projectPath - Path to the project root
   * @returns true if the detector can analyze this project
   */
  canDetect(projectPath: string): Promise<boolean>;

  /**
   * Detect project settings from the given directory
   * @param projectPath - Path to the project root
   * @returns Detection result with project info and commands
   */
  detect(projectPath: string): Promise<DetectionResult>;
}
