import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectTestCommand } from "../verification.js";

describe("tasks/verification", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = mkdtempSync(join(tmpdir(), "ralph-verification-test-"));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("detectTestCommand", () => {
    test("returns undefined when no config files exist", () => {
      expect(detectTestCommand()).toBeUndefined();
    });

    test("detects npm test from package.json", () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ scripts: { test: "jest" } })
      );
      expect(detectTestCommand()).toBe("npm test");
    });

    test("detects bun test when bun.lockb exists", () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ scripts: { test: "bun test" } })
      );
      writeFileSync(join(tempDir, "bun.lockb"), "");
      expect(detectTestCommand()).toBe("bun test");
    });

    test("detects pnpm test when pnpm-lock.yaml exists", () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ scripts: { test: "vitest" } })
      );
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "");
      expect(detectTestCommand()).toBe("pnpm test");
    });

    test("detects yarn test when yarn.lock exists", () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ scripts: { test: "jest" } })
      );
      writeFileSync(join(tempDir, "yarn.lock"), "");
      expect(detectTestCommand()).toBe("yarn test");
    });

    test("detects vitest from config file", () => {
      writeFileSync(join(tempDir, "vitest.config.ts"), "export default {}");
      expect(detectTestCommand()).toBe("npx vitest run");
    });

    test("detects vitest from js config file", () => {
      writeFileSync(join(tempDir, "vitest.config.js"), "module.exports = {}");
      expect(detectTestCommand()).toBe("npx vitest run");
    });

    test("detects jest from config file", () => {
      writeFileSync(join(tempDir, "jest.config.ts"), "export default {}");
      expect(detectTestCommand()).toBe("npx jest");
    });

    test("detects jest from js config file", () => {
      writeFileSync(join(tempDir, "jest.config.js"), "module.exports = {}");
      expect(detectTestCommand()).toBe("npx jest");
    });

    test("detects pytest from pytest.ini", () => {
      writeFileSync(join(tempDir, "pytest.ini"), "[pytest]");
      expect(detectTestCommand()).toBe("pytest");
    });

    test("detects pytest from pyproject.toml", () => {
      writeFileSync(join(tempDir, "pyproject.toml"), "[tool.pytest]");
      expect(detectTestCommand()).toBe("pytest");
    });

    test("detects go test from go.mod", () => {
      writeFileSync(join(tempDir, "go.mod"), "module example.com/test");
      expect(detectTestCommand()).toBe("go test ./...");
    });

    test("detects cargo test from Cargo.toml", () => {
      writeFileSync(join(tempDir, "Cargo.toml"), "[package]");
      expect(detectTestCommand()).toBe("cargo test");
    });

    test("package.json takes precedence over config files", () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ scripts: { test: "custom test" } })
      );
      writeFileSync(join(tempDir, "vitest.config.ts"), "export default {}");
      expect(detectTestCommand()).toBe("npm test");
    });

    test("returns undefined for package.json without test script", () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ scripts: { build: "tsc" } })
      );
      expect(detectTestCommand()).toBeUndefined();
    });

    test("handles malformed package.json gracefully", () => {
      writeFileSync(join(tempDir, "package.json"), "not valid json");
      expect(detectTestCommand()).toBeUndefined();
    });
  });
});
