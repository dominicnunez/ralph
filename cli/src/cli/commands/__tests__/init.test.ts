import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runInitNonInteractive } from "../init.js";

describe("init command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "init-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("runInitNonInteractive", () => {
    it("should detect Node.js project and create config", async () => {
      // Create a basic Node.js project
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "test-project",
          scripts: {
            test: "vitest",
            lint: "eslint .",
            build: "tsc",
          },
          devDependencies: {
            vitest: "^1.0.0",
            eslint: "^8.0.0",
            typescript: "^5.0.0",
          },
        })
      );

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(true);
      expect(result.path).toBe(join(tempDir, ".ralph", "config.yaml"));
      expect(existsSync(result.path!)).toBe(true);

      const content = readFileSync(result.path!, "utf-8");
      expect(content).toContain("name: test-project");
      expect(content).toContain("language: typescript");
      expect(content).toContain("test: npm run test");
      expect(content).toContain("lint: npm run lint");
      expect(content).toContain("build: npm run build");
    });

    it("should detect Python project and create config", async () => {
      // Create a basic Python project with PEP 621 style dependencies
      writeFileSync(
        join(tempDir, "pyproject.toml"),
        `[project]
name = "my-python-app"
dependencies = [
  "fastapi>=0.100.0",
]

[tool.pytest.ini_options]
testpaths = ["tests"]
`
      );

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(true);
      expect(existsSync(result.path!)).toBe(true);

      const content = readFileSync(result.path!, "utf-8");
      expect(content).toContain("name: my-python-app");
      expect(content).toContain("language: python");
      expect(content).toContain("framework: fastapi");
      expect(content).toContain("test: pytest");
    });

    it("should detect Go project and create config", async () => {
      // Create a basic Go project
      writeFileSync(
        join(tempDir, "go.mod"),
        `module github.com/example/my-go-service

go 1.21

require github.com/gin-gonic/gin v1.9.0
`
      );

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(true);
      expect(existsSync(result.path!)).toBe(true);

      const content = readFileSync(result.path!, "utf-8");
      expect(content).toContain("name: my-go-service");
      expect(content).toContain("language: go");
      expect(content).toContain("framework: gin");
      expect(content).toContain("test: go test ./...");
      expect(content).toContain("build: go build ./...");
    });

    it("should detect Rust project and create config", async () => {
      // Create a basic Rust project
      writeFileSync(
        join(tempDir, "Cargo.toml"),
        `[package]
name = "my-rust-app"
edition = "2021"

[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
`
      );

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(true);
      expect(existsSync(result.path!)).toBe(true);

      const content = readFileSync(result.path!, "utf-8");
      expect(content).toContain("name: my-rust-app");
      expect(content).toContain("language: rust");
      expect(content).toContain("framework: axum");
      expect(content).toContain("test: cargo test");
      expect(content).toContain("lint: cargo clippy");
      expect(content).toContain("build: cargo build");
    });

    it("should fail for unrecognized project types", async () => {
      // Empty directory - no project files
      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Could not detect project type");
    });

    it("should not overwrite existing config by default", async () => {
      // Create a Node.js project
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test-project" })
      );

      // Create existing config
      const configDir = join(tempDir, ".ralph");
      mkdirSync(configDir);
      writeFileSync(join(configDir, "config.yaml"), "# existing config");

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.error).toContain("already exists");

      // Original config should be unchanged
      const content = readFileSync(join(configDir, "config.yaml"), "utf-8");
      expect(content).toBe("# existing config");
    });

    it("should overwrite existing config with --force", async () => {
      // Create a Node.js project
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test-project" })
      );

      // Create existing config
      const configDir = join(tempDir, ".ralph");
      mkdirSync(configDir);
      writeFileSync(join(configDir, "config.yaml"), "# existing config");

      const result = await runInitNonInteractive(tempDir, { force: true });

      expect(result.success).toBe(true);

      // Config should be overwritten
      const content = readFileSync(join(configDir, "config.yaml"), "utf-8");
      expect(content).toContain("name: test-project");
      expect(content).not.toBe("# existing config");
    });

    it("should create .ralph directory if it doesn't exist", async () => {
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test-project" })
      );

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(true);
      expect(existsSync(join(tempDir, ".ralph"))).toBe(true);
      expect(existsSync(join(tempDir, ".ralph", "config.yaml"))).toBe(true);
    });

    it("should handle SvelteKit project with pnpm", async () => {
      // Create a SvelteKit project
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({
          name: "my-sveltekit-app",
          scripts: {
            dev: "vite dev",
            build: "vite build",
            test: "vitest",
            lint: "eslint .",
          },
          devDependencies: {
            "@sveltejs/kit": "^2.0.0",
            svelte: "^4.0.0",
            vitest: "^1.0.0",
            eslint: "^8.0.0",
            typescript: "^5.0.0",
          },
        })
      );

      // Add pnpm lockfile
      writeFileSync(join(tempDir, "pnpm-lock.yaml"), "lockfileVersion: 9.0");

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(true);
      const content = readFileSync(result.path!, "utf-8");
      expect(content).toContain("name: my-sveltekit-app");
      expect(content).toContain("language: typescript");
      expect(content).toContain("framework: sveltekit");
      expect(content).toContain("test: pnpm test");
      expect(content).toContain("lint: pnpm lint");
      expect(content).toContain("build: pnpm build");
    });

    it("should return path in result even on failure", async () => {
      // Create a Node.js project
      writeFileSync(
        join(tempDir, "package.json"),
        JSON.stringify({ name: "test-project" })
      );

      // Create existing config
      const configDir = join(tempDir, ".ralph");
      mkdirSync(configDir);
      writeFileSync(join(configDir, "config.yaml"), "# existing config");

      const result = await runInitNonInteractive(tempDir);

      expect(result.success).toBe(false);
      expect(result.path).toBe(join(tempDir, ".ralph", "config.yaml"));
    });
  });
});

describe("parseArgs --init", () => {
  it("should parse --init flag", async () => {
    const { parseArgs } = await import("../../args.js");
    const { options } = parseArgs(["node", "sfs", "--init"]);
    expect(options.init).toBe(true);
  });

  it("should parse --init with --force", async () => {
    const { parseArgs } = await import("../../args.js");
    const { options } = parseArgs(["node", "sfs", "--init", "--force"]);
    expect(options.init).toBe(true);
    expect(options.force).toBe(true);
  });

  it("should parse --init with -y", async () => {
    const { parseArgs } = await import("../../args.js");
    const { options } = parseArgs(["node", "sfs", "--init", "-y"]);
    expect(options.init).toBe(true);
    expect(options.yes).toBe(true);
  });

  it("should parse --init with --yes", async () => {
    const { parseArgs } = await import("../../args.js");
    const { options } = parseArgs(["node", "sfs", "--init", "--yes"]);
    expect(options.init).toBe(true);
    expect(options.yes).toBe(true);
  });

  it("should parse --init with --force and --yes", async () => {
    const { parseArgs } = await import("../../args.js");
    const { options } = parseArgs(["node", "sfs", "--init", "--force", "-y"]);
    expect(options.init).toBe(true);
    expect(options.force).toBe(true);
    expect(options.yes).toBe(true);
  });

  it("should not set init when not provided", async () => {
    const { parseArgs } = await import("../../args.js");
    const { options } = parseArgs(["node", "sfs"]);
    expect(options.init).toBeUndefined();
  });
});
