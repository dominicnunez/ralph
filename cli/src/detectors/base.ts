import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Detector, DetectionResult, Language } from "./types.js";

/**
 * Abstract base class for language detectors with common utilities
 */
export abstract class BaseDetector implements Detector {
  abstract readonly name: string;
  abstract readonly languages: Language[];

  abstract canDetect(projectPath: string): Promise<boolean>;
  abstract detect(projectPath: string): Promise<DetectionResult>;

  /**
   * Check if a file exists in the project directory
   */
  protected fileExists(projectPath: string, filename: string): boolean {
    return existsSync(join(projectPath, filename));
  }

  /**
   * Read and parse a JSON file from the project directory
   * @returns Parsed JSON or null if file doesn't exist or is invalid
   */
  protected async readJsonFile<T>(
    projectPath: string,
    filename: string
  ): Promise<T | null> {
    const filePath = join(projectPath, filename);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  /**
   * Read a text file from the project directory
   * @returns File content or null if file doesn't exist
   */
  protected async readTextFile(
    projectPath: string,
    filename: string
  ): Promise<string | null> {
    const filePath = join(projectPath, filename);
    if (!existsSync(filePath)) {
      return null;
    }

    try {
      return await readFile(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Create a "not detected" result
   */
  protected notDetected(): DetectionResult {
    return {
      detected: false,
      confidence: 0,
    };
  }
}
