import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BaseDetector } from "../base.js";
import { DetectorRegistry, createRegistry } from "../registry.js";
import type { DetectionResult, Language } from "../types.js";

// Test implementation of BaseDetector
class MockDetector extends BaseDetector {
  readonly name = "mock";
  readonly languages: Language[] = ["typescript"];

  constructor(
    private shouldDetect: boolean = true,
    private resultConfidence: number = 0.8
  ) {
    super();
  }

  async canDetect(projectPath: string): Promise<boolean> {
    return this.shouldDetect && this.fileExists(projectPath, "mock.json");
  }

  async detect(projectPath: string): Promise<DetectionResult> {
    if (!this.shouldDetect) {
      return this.notDetected();
    }

    const mockJson = await this.readJsonFile<{ name: string }>(
      projectPath,
      "mock.json"
    );

    if (!mockJson) {
      return this.notDetected();
    }

    return {
      detected: true,
      confidence: this.resultConfidence,
      project: {
        name: mockJson.name,
        language: "typescript",
        framework: "mock-framework",
      },
      commands: {
        test: "mock test",
        lint: "mock lint",
        build: "mock build",
      },
    };
  }
}

describe("BaseDetector", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `detector-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  test("fileExists returns true for existing file", () => {
    writeFileSync(join(testDir, "existing.txt"), "content");
    const detector = new MockDetector();
    expect(detector["fileExists"](testDir, "existing.txt")).toBe(true);
  });

  test("fileExists returns false for non-existing file", () => {
    const detector = new MockDetector();
    expect(detector["fileExists"](testDir, "nonexistent.txt")).toBe(false);
  });

  test("readJsonFile parses valid JSON", async () => {
    writeFileSync(
      join(testDir, "test.json"),
      JSON.stringify({ key: "value" })
    );
    const detector = new MockDetector();
    const result = await detector["readJsonFile"]<{ key: string }>(
      testDir,
      "test.json"
    );
    expect(result).toEqual({ key: "value" });
  });

  test("readJsonFile returns null for invalid JSON", async () => {
    writeFileSync(join(testDir, "invalid.json"), "not json");
    const detector = new MockDetector();
    const result = await detector["readJsonFile"](testDir, "invalid.json");
    expect(result).toBeNull();
  });

  test("readJsonFile returns null for non-existing file", async () => {
    const detector = new MockDetector();
    const result = await detector["readJsonFile"](testDir, "missing.json");
    expect(result).toBeNull();
  });

  test("readTextFile reads file content", async () => {
    writeFileSync(join(testDir, "test.txt"), "hello world");
    const detector = new MockDetector();
    const result = await detector["readTextFile"](testDir, "test.txt");
    expect(result).toBe("hello world");
  });

  test("readTextFile returns null for non-existing file", async () => {
    const detector = new MockDetector();
    const result = await detector["readTextFile"](testDir, "missing.txt");
    expect(result).toBeNull();
  });

  test("notDetected returns proper result", () => {
    const detector = new MockDetector();
    const result = detector["notDetected"]();
    expect(result).toEqual({
      detected: false,
      confidence: 0,
    });
  });
});

describe("DetectorRegistry", () => {
  let testDir: string;
  let registry: DetectorRegistry;

  beforeEach(() => {
    testDir = join(tmpdir(), `registry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    registry = createRegistry();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test("register adds detector to registry", () => {
    const detector = new MockDetector();
    registry.register(detector);
    expect(registry.getDetectors()).toHaveLength(1);
    expect(registry.getDetectors()[0]).toBe(detector);
  });

  test("detectProject returns not detected when no detectors match", async () => {
    const detector = new MockDetector();
    registry.register(detector);

    const result = await registry.detectProject(testDir);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  test("detectProject returns result from matching detector", async () => {
    writeFileSync(
      join(testDir, "mock.json"),
      JSON.stringify({ name: "test-project" })
    );

    const detector = new MockDetector();
    registry.register(detector);

    const result = await registry.detectProject(testDir);
    expect(result.detected).toBe(true);
    expect(result.project?.name).toBe("test-project");
    expect(result.confidence).toBe(0.8);
  });

  test("detectProject returns highest confidence result", async () => {
    writeFileSync(
      join(testDir, "mock.json"),
      JSON.stringify({ name: "test-project" })
    );

    const lowConfidence = new MockDetector(true, 0.5);
    const highConfidence = new MockDetector(true, 0.9);

    registry.register(lowConfidence);
    registry.register(highConfidence);

    const result = await registry.detectProject(testDir);
    expect(result.confidence).toBe(0.9);
  });

  test("detectAll returns all successful detections", async () => {
    writeFileSync(
      join(testDir, "mock.json"),
      JSON.stringify({ name: "test-project" })
    );

    const detector1 = new MockDetector(true, 0.7);
    const detector2 = new MockDetector(true, 0.9);

    registry.register(detector1);
    registry.register(detector2);

    const results = await registry.detectAll(testDir);
    expect(results).toHaveLength(2);
    // Should be sorted by confidence (highest first)
    expect(results[0].confidence).toBe(0.9);
    expect(results[1].confidence).toBe(0.7);
  });

  test("detectAll returns empty array when no detectors match", async () => {
    const detector = new MockDetector();
    registry.register(detector);

    const results = await registry.detectAll(testDir);
    expect(results).toHaveLength(0);
  });
});

describe("createRegistry", () => {
  test("creates new empty registry", () => {
    const registry = createRegistry();
    expect(registry).toBeInstanceOf(DetectorRegistry);
    expect(registry.getDetectors()).toHaveLength(0);
  });
});
