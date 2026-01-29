import type { Detector, DetectionResult } from "./types.js";

/**
 * Registry for managing and running language detectors
 */
export class DetectorRegistry {
  private detectors: Detector[] = [];

  /**
   * Register a detector
   */
  register(detector: Detector): void {
    this.detectors.push(detector);
  }

  /**
   * Get all registered detectors
   */
  getDetectors(): readonly Detector[] {
    return this.detectors;
  }

  /**
   * Run all detectors and return the best match
   * @param projectPath - Path to the project root
   * @returns Best detection result, or a "not detected" result if no detector matches
   */
  async detectProject(projectPath: string): Promise<DetectionResult> {
    const results: DetectionResult[] = [];

    for (const detector of this.detectors) {
      if (await detector.canDetect(projectPath)) {
        const result = await detector.detect(projectPath);
        if (result.detected) {
          results.push(result);
        }
      }
    }

    // Return the result with highest confidence
    if (results.length === 0) {
      return {
        detected: false,
        confidence: 0,
      };
    }

    return results.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );
  }

  /**
   * Run all applicable detectors and return all results (for multi-language projects)
   * @param projectPath - Path to the project root
   * @returns All successful detection results
   */
  async detectAll(projectPath: string): Promise<DetectionResult[]> {
    const results: DetectionResult[] = [];

    for (const detector of this.detectors) {
      if (await detector.canDetect(projectPath)) {
        const result = await detector.detect(projectPath);
        if (result.detected) {
          results.push(result);
        }
      }
    }

    // Sort by confidence (highest first)
    return results.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * Create a new detector registry
 */
export function createRegistry(): DetectorRegistry {
  return new DetectorRegistry();
}
