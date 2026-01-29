import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GoDetector } from "../go.js";

describe("GoDetector", () => {
  let testDir: string;
  let detector: GoDetector;

  beforeEach(() => {
    testDir = join(tmpdir(), `go-detector-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    detector = new GoDetector();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("canDetect", () => {
    test("returns true when go.mod exists", async () => {
      writeFileSync(join(testDir, "go.mod"), "module example.com/myapp\n");
      expect(await detector.canDetect(testDir)).toBe(true);
    });

    test("returns false when go.mod does not exist", async () => {
      expect(await detector.canDetect(testDir)).toBe(false);
    });

    test("returns false for empty directory", async () => {
      expect(await detector.canDetect(testDir)).toBe(false);
    });
  });

  describe("detect", () => {
    test("returns not detected when go.mod is missing", async () => {
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("detects basic project from go.mod", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module github.com/user/myapp

go 1.21
`
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("myapp");
      expect(result.project?.language).toBe("go");
      expect(result.project?.packageManager).toBe("go");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test("extracts module name from full path", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        "module github.com/organization/project-name\n"
      );
      const result = await detector.detect(testDir);
      expect(result.project?.name).toBe("project-name");
    });

    test("handles simple module names", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\n");
      const result = await detector.detect(testDir);
      expect(result.project?.name).toBe("myapp");
    });

    test("uses unnamed-project when module is missing", async () => {
      writeFileSync(join(testDir, "go.mod"), "go 1.21\n");
      const result = await detector.detect(testDir);
      expect(result.project?.name).toBe("unnamed-project");
    });

    test("parses go version", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp

go 1.22.1
`
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      // Go version increases confidence
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("go.mod parsing", () => {
    test("parses single-line require", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp

require github.com/gin-gonic/gin v1.9.1
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("gin");
    });

    test("parses require block", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/stretchr/testify v1.8.4
)
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("gin");
    });

    test("ignores comments", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
// This is a comment
go 1.21

require (
	// Another comment
	github.com/gofiber/fiber/v2 v2.50.0
)
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("fiber");
    });

    test("handles mixed require styles", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp

require github.com/labstack/echo/v4 v4.11.0

require (
	github.com/stretchr/testify v1.8.4
)
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("echo");
    });
  });

  describe("detectFramework", () => {
    test("detects Gin framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/gin-gonic/gin v1.9.1
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("gin");
    });

    test("detects Echo framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/labstack/echo/v4 v4.11.0
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("echo");
    });

    test("detects Fiber framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/gofiber/fiber/v2 v2.50.0
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("fiber");
    });

    test("detects Chi framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/go-chi/chi/v5 v5.0.10
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("chi");
    });

    test("detects Gorilla Mux framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/gorilla/mux v1.8.0
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("gorilla");
    });

    test("detects Beego framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/beego/beego/v2 v2.0.0
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("beego");
    });

    test("detects Iris framework", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/kataras/iris/v12 v12.2.0
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("iris");
    });

    test("returns null when no framework is detected", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/stretchr/testify v1.8.4
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBeUndefined();
    });

    test("framework detection respects priority (gin before others)", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require (
	github.com/gorilla/mux v1.8.0
	github.com/gin-gonic/gin v1.9.1
)
`
      );
      const result = await detector.detect(testDir);
      // Gin has higher priority than Gorilla
      expect(result.project?.framework).toBe("gin");
    });
  });

  describe("detectCommands", () => {
    test("always includes go test command", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.test).toBe("go test ./...");
    });

    test("always includes go build command", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.build).toBe("go build ./...");
    });

    test("detects golangci-lint from .golangci.yml", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\nrequire github.com/gin-gonic/gin v1.9.1\n");
      writeFileSync(join(testDir, ".golangci.yml"), "linters:\n  enable:\n    - gofmt\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("golangci-lint run");
    });

    test("detects golangci-lint from .golangci.yaml", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\nrequire github.com/gin-gonic/gin v1.9.1\n");
      writeFileSync(join(testDir, ".golangci.yaml"), "linters:\n  enable:\n    - gofmt\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("golangci-lint run");
    });

    test("detects golangci-lint from .golangci.toml", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\nrequire github.com/gin-gonic/gin v1.9.1\n");
      writeFileSync(join(testDir, ".golangci.toml"), "[linters]\nenable = ['gofmt']\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("golangci-lint run");
    });

    test("detects golangci-lint from .golangci.json", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\nrequire github.com/gin-gonic/gin v1.9.1\n");
      writeFileSync(join(testDir, ".golangci.json"), '{"linters":{"enable":["gofmt"]}}');
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("golangci-lint run");
    });

    test("suggests golangci-lint for projects with dependencies", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module myapp
require github.com/gin-gonic/gin v1.9.1
`
      );
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("golangci-lint run");
    });

    test("no lint command for minimal projects without config", async () => {
      writeFileSync(join(testDir, "go.mod"), "module myapp\n");
      const result = await detector.detect(testDir);
      // No dependencies means no suggested linter
      expect(result.commands?.lint).toBeUndefined();
    });
  });

  describe("integration tests", () => {
    test("full Gin API project", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module github.com/myorg/gin-api

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/stretchr/testify v1.8.4
	gorm.io/gorm v1.25.5
)
`
      );
      writeFileSync(join(testDir, ".golangci.yml"), "linters:\n  enable:\n    - gofmt\n");

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("gin-api");
      expect(result.project?.language).toBe("go");
      expect(result.project?.framework).toBe("gin");
      expect(result.project?.packageManager).toBe("go");
      expect(result.commands?.test).toBe("go test ./...");
      expect(result.commands?.lint).toBe("golangci-lint run");
      expect(result.commands?.build).toBe("go build ./...");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    test("full Echo API project", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module github.com/myorg/echo-service

go 1.22

require (
	github.com/labstack/echo/v4 v4.11.3
	github.com/lib/pq v1.10.9
)
`
      );

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("echo-service");
      expect(result.project?.language).toBe("go");
      expect(result.project?.framework).toBe("echo");
      expect(result.commands?.test).toBe("go test ./...");
      expect(result.commands?.build).toBe("go build ./...");
    });

    test("full Fiber microservice project", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module github.com/myorg/fiber-ms

go 1.21

require (
	github.com/gofiber/fiber/v2 v2.50.0
	github.com/redis/go-redis/v9 v9.3.0
)
`
      );
      writeFileSync(join(testDir, ".golangci.yaml"), "run:\n  timeout: 5m\n");

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("fiber-ms");
      expect(result.project?.framework).toBe("fiber");
      expect(result.commands?.lint).toBe("golangci-lint run");
    });

    test("minimal Go project (no framework)", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module mycli

go 1.20
`
      );

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("mycli");
      expect(result.project?.language).toBe("go");
      expect(result.project?.framework).toBeUndefined();
      expect(result.commands?.test).toBe("go test ./...");
      expect(result.commands?.build).toBe("go build ./...");
    });

    test("library project with multiple dependencies", async () => {
      writeFileSync(
        join(testDir, "go.mod"),
        `module github.com/myorg/go-utils

go 1.21

require (
	github.com/stretchr/testify v1.8.4
	golang.org/x/sync v0.5.0
	golang.org/x/text v0.14.0
)
`
      );

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("go-utils");
      expect(result.project?.framework).toBeUndefined();
      expect(result.commands?.test).toBe("go test ./...");
      // Has dependencies, so suggests golangci-lint
      expect(result.commands?.lint).toBe("golangci-lint run");
    });
  });

  describe("detectFramework method directly", () => {
    test("returns correct framework for gin", () => {
      const result = detector.detectFramework(["github.com/gin-gonic/gin"]);
      expect(result?.name).toBe("gin");
      expect(result?.confidence).toBe(0.9);
    });

    test("returns correct framework for echo with version suffix", () => {
      const result = detector.detectFramework(["github.com/labstack/echo/v4"]);
      expect(result?.name).toBe("echo");
    });

    test("returns correct framework for fiber with version suffix", () => {
      const result = detector.detectFramework(["github.com/gofiber/fiber/v2"]);
      expect(result?.name).toBe("fiber");
    });

    test("returns null for no matching framework", () => {
      const result = detector.detectFramework(["github.com/stretchr/testify"]);
      expect(result).toBeNull();
    });

    test("returns null for empty deps", () => {
      const result = detector.detectFramework([]);
      expect(result).toBeNull();
    });
  });
});
