import { spawnSync } from "node:child_process";
import type { Engine, EngineResult } from "./base.js";
import { logWarning } from "../ui/logger.js";

// Patterns that indicate rate limiting
const RATE_LIMIT_PATTERNS = [
  /rate.?limit/i,
  /quota/i,
  /429/,
  /too.?many.?request/i,
  /exhausted/i,
  /overloaded/i,
  /capacity/i,
];

export class OpenCodeEngine implements Engine {
  name = "opencode";
  model: string;
  
  private primaryModel: string;
  private fallbackModel: string | undefined;
  private usingFallback = false;

  constructor(model: string = "big-pickle", fallbackModel?: string) {
    this.primaryModel = model;
    this.model = model;
    this.fallbackModel = fallbackModel;
  }

  isAvailable(): boolean {
    const result = spawnSync("which", ["opencode"], { encoding: "utf-8" });
    return result.status === 0;
  }

  async run(prompt: string): Promise<EngineResult> {
    const args = ["run", "--model", this.model, prompt];

    const result = spawnSync("opencode", args, {
      encoding: "utf-8",
      cwd: process.cwd(),
      stdio: ["inherit", "pipe", "pipe"],
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });

    const output = (result.stdout || "") + (result.stderr || "");
    
    // Stream output to console
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    // Check for rate limiting
    const rateLimited = this.isRateLimited(output);

    return {
      success: result.status === 0,
      output,
      exitCode: result.status ?? 1,
      rateLimited,
    };
  }

  /**
   * Check if output indicates rate limiting
   */
  private isRateLimited(output: string): boolean {
    return RATE_LIMIT_PATTERNS.some(pattern => pattern.test(output));
  }

  /**
   * Switch to fallback model
   */
  switchToFallback(): boolean {
    if (this.fallbackModel && !this.usingFallback) {
      logWarning(`Rate limit on ${this.model}, switching to fallback: ${this.fallbackModel}`);
      console.log("");
      console.log("===========================================");
      console.log(`  Rate limit detected on ${this.model}`);
      console.log(`  Switching to fallback: ${this.fallbackModel}`);
      console.log("===========================================");
      console.log("");
      
      this.model = this.fallbackModel;
      this.usingFallback = true;
      return true;
    }
    return false;
  }

  /**
   * Reset to primary model
   */
  resetToPrimary(): void {
    this.model = this.primaryModel;
    this.usingFallback = false;
  }

  /**
   * Check if currently using fallback
   */
  isUsingFallback(): boolean {
    return this.usingFallback;
  }
}
