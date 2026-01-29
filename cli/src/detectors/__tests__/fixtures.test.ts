import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { NodejsDetector } from "../nodejs.js";
import { PythonDetector } from "../python.js";
import { GoDetector } from "../go.js";
import { RustDetector } from "../rust.js";
import { createRegistry } from "../registry.js";

// Get the fixtures directory path
const fixturesDir = join(import.meta.dir, "..", "__fixtures__");

/**
 * Create a registry with all detectors registered
 */
function createPopulatedRegistry() {
  const registry = createRegistry();
  registry.register(new NodejsDetector());
  registry.register(new PythonDetector());
  registry.register(new GoDetector());
  registry.register(new RustDetector());
  return registry;
}

describe("Detector Fixtures", () => {
  describe("Node.js Fixtures", () => {
    const detector = new NodejsDetector();

    describe("nodejs-sveltekit fixture", () => {
      const projectDir = join(fixturesDir, "nodejs-sveltekit");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name", async () => {
        const result = await detector.detect(projectDir);
        expect(result.detected).toBe(true);
        expect(result.project?.name).toBe("sveltekit-demo");
      });

      test("detects TypeScript language", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.language).toBe("typescript");
      });

      test("detects SvelteKit framework", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBe("sveltekit");
      });

      test("detects pnpm package manager", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.packageManager).toBe("pnpm");
      });

      test("detects test command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.test).toBe("pnpm test");
      });

      test("detects lint command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.lint).toBe("pnpm lint");
      });

      test("detects build command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.build).toBe("pnpm build");
      });

      test("has high confidence score", async () => {
        const result = await detector.detect(projectDir);
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe("nodejs-express fixture", () => {
      const projectDir = join(fixturesDir, "nodejs-express");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name", async () => {
        const result = await detector.detect(projectDir);
        expect(result.detected).toBe(true);
        expect(result.project?.name).toBe("express-api");
      });

      test("detects JavaScript language (no TypeScript)", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.language).toBe("javascript");
      });

      test("detects Express framework", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBe("express");
      });

      test("detects npm package manager (default)", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.packageManager).toBe("npm");
      });

      test("detects test command from jest", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.test).toBe("npm run test");
      });

      test("detects lint command from eslint", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.lint).toBe("npm run lint");
      });
    });
  });

  describe("Python Fixtures", () => {
    const detector = new PythonDetector();

    describe("python-fastapi fixture", () => {
      const projectDir = join(fixturesDir, "python-fastapi");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name", async () => {
        const result = await detector.detect(projectDir);
        expect(result.detected).toBe(true);
        expect(result.project?.name).toBe("fastapi-demo");
      });

      test("detects Python language", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.language).toBe("python");
      });

      test("detects FastAPI framework", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBe("fastapi");
      });

      test("detects Poetry package manager", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.packageManager).toBe("poetry");
      });

      test("detects test command with poetry run", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.test).toBe("poetry run pytest");
      });

      test("detects lint command with ruff", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.lint).toBe("poetry run ruff check .");
      });
    });

    describe("python-django fixture", () => {
      const projectDir = join(fixturesDir, "python-django");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name", async () => {
        const result = await detector.detect(projectDir);
        expect(result.detected).toBe(true);
        expect(result.project?.name).toBe("django-app");
      });

      test("detects Django framework", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBe("django");
      });

      test("detects pip package manager (no lock file)", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.packageManager).toBe("pip");
      });

      test("detects test command with pytest", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.test).toBe("pytest");
      });

      test("detects lint command with black", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.lint).toBe("black --check .");
      });
    });
  });

  describe("Go Fixtures", () => {
    const detector = new GoDetector();

    describe("go-gin fixture", () => {
      const projectDir = join(fixturesDir, "go-gin");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name from module path", async () => {
        const result = await detector.detect(projectDir);
        expect(result.detected).toBe(true);
        expect(result.project?.name).toBe("gin-api");
      });

      test("detects Go language", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.language).toBe("go");
      });

      test("detects Gin framework", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBe("gin");
      });

      test("detects go package manager", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.packageManager).toBe("go");
      });

      test("detects test command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.test).toBe("go test ./...");
      });

      test("detects lint command from .golangci.yml", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.lint).toBe("golangci-lint run");
      });

      test("detects build command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.build).toBe("go build ./...");
      });

      test("has high confidence due to framework and lint config", async () => {
        const result = await detector.detect(projectDir);
        expect(result.confidence).toBeGreaterThan(0.9);
      });
    });

    describe("go-cli fixture", () => {
      const projectDir = join(fixturesDir, "go-cli");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name from module path", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.name).toBe("cli-tool");
      });

      test("detects no framework (CLI tool)", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBeUndefined();
      });

      test("suggests golangci-lint for lint", async () => {
        const result = await detector.detect(projectDir);
        // No .golangci.yml, but should still suggest golangci-lint for projects with deps
        expect(result.commands?.lint).toBe("golangci-lint run");
      });
    });
  });

  describe("Rust Fixtures", () => {
    const detector = new RustDetector();

    describe("rust-axum fixture", () => {
      const projectDir = join(fixturesDir, "rust-axum");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name", async () => {
        const result = await detector.detect(projectDir);
        expect(result.detected).toBe(true);
        expect(result.project?.name).toBe("axum-api");
      });

      test("detects Rust language", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.language).toBe("rust");
      });

      test("detects Axum framework", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBe("axum");
      });

      test("detects cargo package manager", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.packageManager).toBe("cargo");
      });

      test("detects test command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.test).toBe("cargo test");
      });

      test("detects lint command with clippy", async () => {
        const result = await detector.detect(projectDir);
        // Has .clippy.toml, so clippy config takes precedence
        expect(result.commands?.lint).toBe("cargo clippy");
      });

      test("detects build command", async () => {
        const result = await detector.detect(projectDir);
        expect(result.commands?.build).toBe("cargo build");
      });

      test("has high confidence due to framework, lint config, and edition", async () => {
        const result = await detector.detect(projectDir);
        expect(result.confidence).toBeGreaterThan(0.95);
      });
    });

    describe("rust-cli fixture", () => {
      const projectDir = join(fixturesDir, "rust-cli");

      test("can detect the project", async () => {
        expect(await detector.canDetect(projectDir)).toBe(true);
      });

      test("detects project name", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.name).toBe("rust-cli");
      });

      test("detects no framework (CLI tool)", async () => {
        const result = await detector.detect(projectDir);
        expect(result.project?.framework).toBeUndefined();
      });

      test("detects default clippy lint command", async () => {
        const result = await detector.detect(projectDir);
        // No config files, default to cargo clippy
        expect(result.commands?.lint).toBe("cargo clippy");
      });
    });
  });

  describe("Registry with Fixtures", () => {
    test("correctly identifies SvelteKit project as Node.js", async () => {
      const registry = createPopulatedRegistry();
      const projectDir = join(fixturesDir, "nodejs-sveltekit");
      const result = await registry.detectProject(projectDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("sveltekit-demo");
      expect(result.project?.framework).toBe("sveltekit");
    });

    test("correctly identifies FastAPI project as Python", async () => {
      const registry = createPopulatedRegistry();
      const projectDir = join(fixturesDir, "python-fastapi");
      const result = await registry.detectProject(projectDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("fastapi-demo");
      expect(result.project?.framework).toBe("fastapi");
    });

    test("correctly identifies Gin project as Go", async () => {
      const registry = createPopulatedRegistry();
      const projectDir = join(fixturesDir, "go-gin");
      const result = await registry.detectProject(projectDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("gin-api");
      expect(result.project?.framework).toBe("gin");
    });

    test("correctly identifies Axum project as Rust", async () => {
      const registry = createPopulatedRegistry();
      const projectDir = join(fixturesDir, "rust-axum");
      const result = await registry.detectProject(projectDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("axum-api");
      expect(result.project?.framework).toBe("axum");
    });

    test("detectAll finds all matching projects when multiple config files exist", async () => {
      // The registry should only detect one project type per directory
      // but can run all detectors
      const registry = createPopulatedRegistry();
      const projectDir = join(fixturesDir, "nodejs-sveltekit");
      const results = await registry.detectAll(projectDir);

      // Should have at least the Node.js result
      expect(results.length).toBeGreaterThanOrEqual(1);

      // The Node.js result should be first (highest confidence)
      const nodejsResult = results.find((r) => r.project?.language === "typescript");
      expect(nodejsResult).toBeDefined();
      expect(nodejsResult?.project?.framework).toBe("sveltekit");
    });
  });
});
