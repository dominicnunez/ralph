import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  detectionToConfig,
  configToYaml,
  yamlEscape,
  getConfigPath,
  configExists,
  writeConfig,
  generateAndWriteConfig,
  type GeneratedConfig,
} from "../generator.js";
import type { DetectionResult } from "../../detectors/types.js";

describe("Config Generator", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `ralph-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("detectionToConfig", () => {
    test("returns null for non-detected result", () => {
      const result: DetectionResult = {
        detected: false,
        confidence: 0,
      };
      expect(detectionToConfig(result)).toBeNull();
    });

    test("returns null when project is missing", () => {
      const result: DetectionResult = {
        detected: true,
        confidence: 0.8,
      };
      expect(detectionToConfig(result)).toBeNull();
    });

    test("converts basic detection result", () => {
      const result: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: {
          name: "my-app",
          language: "typescript",
        },
      };

      const config = detectionToConfig(result);
      expect(config).not.toBeNull();
      expect(config!.project.name).toBe("my-app");
      expect(config!.project.language).toBe("typescript");
      expect(config!.project.framework).toBeUndefined();
      expect(config!.commands).toEqual({});
      expect(config!.rules).toEqual([]);
    });

    test("includes framework when present", () => {
      const result: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: {
          name: "my-app",
          language: "typescript",
          framework: "sveltekit",
        },
      };

      const config = detectionToConfig(result);
      expect(config!.project.framework).toBe("sveltekit");
    });

    test("includes commands when present", () => {
      const result: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: {
          name: "my-app",
          language: "typescript",
        },
        commands: {
          test: "npm test",
          lint: "npm run lint",
          build: "npm run build",
        },
      };

      const config = detectionToConfig(result);
      expect(config!.commands.test).toBe("npm test");
      expect(config!.commands.lint).toBe("npm run lint");
      expect(config!.commands.build).toBe("npm run build");
    });

    test("handles partial commands", () => {
      const result: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: {
          name: "my-app",
          language: "go",
        },
        commands: {
          test: "go test ./...",
          // lint and build not present
        },
      };

      const config = detectionToConfig(result);
      expect(config!.commands.test).toBe("go test ./...");
      expect(config!.commands.lint).toBeUndefined();
      expect(config!.commands.build).toBeUndefined();
    });
  });

  describe("yamlEscape", () => {
    test("returns simple strings unchanged", () => {
      expect(yamlEscape("hello")).toBe("hello");
      expect(yamlEscape("my-app")).toBe("my-app");
      expect(yamlEscape("npm test")).toBe("npm test");
    });

    test("quotes empty strings", () => {
      expect(yamlEscape("")).toBe('""');
    });

    test("quotes strings starting with special characters", () => {
      expect(yamlEscape("&anchor")).toBe('"&anchor"');
      expect(yamlEscape("*alias")).toBe('"*alias"');
      expect(yamlEscape("!tag")).toBe('"!tag"');
      expect(yamlEscape("-item")).toBe('"-item"');
      expect(yamlEscape("#comment")).toBe('"#comment"');
    });

    test("quotes strings with colon-space", () => {
      expect(yamlEscape("key: value")).toBe('"key: value"');
    });

    test("quotes strings with leading/trailing whitespace", () => {
      expect(yamlEscape(" leading")).toBe('" leading"');
      expect(yamlEscape("trailing ")).toBe('"trailing "');
    });

    test("quotes and escapes strings with quotes", () => {
      expect(yamlEscape('say "hello"')).toBe('"say \\"hello\\""');
      expect(yamlEscape("it's")).toBe('"it\'s"');
    });

    test("quotes YAML keywords", () => {
      expect(yamlEscape("true")).toBe('"true"');
      expect(yamlEscape("false")).toBe('"false"');
      expect(yamlEscape("null")).toBe('"null"');
      expect(yamlEscape("yes")).toBe('"yes"');
      expect(yamlEscape("no")).toBe('"no"');
    });

    test("escapes newlines", () => {
      expect(yamlEscape("line1\nline2")).toBe('"line1\\nline2"');
    });

    test("escapes backslashes", () => {
      expect(yamlEscape("path\\to\\file")).toBe('"path\\\\to\\\\file"');
    });
  });

  describe("configToYaml", () => {
    test("generates basic YAML", () => {
      const config: GeneratedConfig = {
        project: {
          name: "my-app",
          language: "typescript",
        },
        commands: {},
        rules: [],
      };

      const yaml = configToYaml(config);
      expect(yaml).toContain("# .ralph/config.yaml (generated by sfs --init)");
      expect(yaml).toContain("project:");
      expect(yaml).toContain("  name: my-app");
      expect(yaml).toContain("  language: typescript");
      expect(yaml).toContain("rules: []");
    });

    test("includes framework when present", () => {
      const config: GeneratedConfig = {
        project: {
          name: "my-app",
          language: "typescript",
          framework: "sveltekit",
        },
        commands: {},
        rules: [],
      };

      const yaml = configToYaml(config);
      expect(yaml).toContain("  framework: sveltekit");
    });

    test("includes commands when present", () => {
      const config: GeneratedConfig = {
        project: {
          name: "my-app",
          language: "typescript",
        },
        commands: {
          test: "npm test",
          lint: "npm run lint",
          build: "npm run build",
        },
        rules: [],
      };

      const yaml = configToYaml(config);
      expect(yaml).toContain("commands:");
      expect(yaml).toContain("  test: npm test");
      expect(yaml).toContain("  lint: npm run lint");
      expect(yaml).toContain("  build: npm run build");
    });

    test("adds comment when no commands detected", () => {
      const config: GeneratedConfig = {
        project: {
          name: "my-app",
          language: "go",
        },
        commands: {},
        rules: [],
      };

      const yaml = configToYaml(config);
      expect(yaml).toContain("  # No commands detected - add manually");
    });

    test("includes rules section with comment", () => {
      const config: GeneratedConfig = {
        project: {
          name: "my-app",
          language: "rust",
        },
        commands: {},
        rules: [],
      };

      const yaml = configToYaml(config);
      expect(yaml).toContain("# Add project-specific rules below:");
      expect(yaml).toContain("rules: []");
    });

    test("escapes special values in YAML", () => {
      const config: GeneratedConfig = {
        project: {
          name: "my: special-app",
          language: "typescript",
        },
        commands: {
          test: 'echo "testing"',
        },
        rules: [],
      };

      const yaml = configToYaml(config);
      expect(yaml).toContain('"my: special-app"');
      expect(yaml).toContain('"echo \\"testing\\""');
    });
  });

  describe("getConfigPath", () => {
    test("returns correct path", () => {
      expect(getConfigPath("/home/user/project")).toBe(
        "/home/user/project/.ralph/config.yaml"
      );
    });

    test("handles paths without trailing slash", () => {
      expect(getConfigPath("/project")).toBe("/project/.ralph/config.yaml");
    });
  });

  describe("configExists", () => {
    test("returns false when config does not exist", () => {
      expect(configExists(tempDir)).toBe(false);
    });

    test("returns true when config exists", () => {
      const configDir = join(tempDir, ".ralph");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "config.yaml"), "test", "utf-8");

      expect(configExists(tempDir)).toBe(true);
    });
  });

  describe("writeConfig", () => {
    const sampleConfig: GeneratedConfig = {
      project: {
        name: "test-app",
        language: "typescript",
        framework: "sveltekit",
      },
      commands: {
        test: "npm test",
        lint: "npm run lint",
        build: "npm run build",
      },
      rules: [],
    };

    test("creates .ralph directory and config file", () => {
      const result = writeConfig(tempDir, sampleConfig);

      expect(result.success).toBe(true);
      expect(result.overwritten).toBe(false);
      expect(existsSync(join(tempDir, ".ralph"))).toBe(true);
      expect(existsSync(join(tempDir, ".ralph", "config.yaml"))).toBe(true);
    });

    test("writes valid YAML content", () => {
      writeConfig(tempDir, sampleConfig);

      const content = readFileSync(
        join(tempDir, ".ralph", "config.yaml"),
        "utf-8"
      );
      expect(content).toContain("name: test-app");
      expect(content).toContain("language: typescript");
      expect(content).toContain("framework: sveltekit");
      expect(content).toContain("test: npm test");
    });

    test("fails when config exists and overwrite is false", () => {
      // Create existing config
      const configDir = join(tempDir, ".ralph");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "config.yaml"), "existing", "utf-8");

      const result = writeConfig(tempDir, sampleConfig, false);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already exists");
      expect(result.overwritten).toBe(false);

      // Original content should be preserved
      const content = readFileSync(join(configDir, "config.yaml"), "utf-8");
      expect(content).toBe("existing");
    });

    test("overwrites when overwrite is true", () => {
      // Create existing config
      const configDir = join(tempDir, ".ralph");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(join(configDir, "config.yaml"), "existing", "utf-8");

      const result = writeConfig(tempDir, sampleConfig, true);

      expect(result.success).toBe(true);
      expect(result.overwritten).toBe(true);

      // Content should be new
      const content = readFileSync(join(configDir, "config.yaml"), "utf-8");
      expect(content).toContain("name: test-app");
    });

    test("returns correct path in result", () => {
      const result = writeConfig(tempDir, sampleConfig);
      expect(result.path).toBe(join(tempDir, ".ralph", "config.yaml"));
    });
  });

  describe("generateAndWriteConfig", () => {
    test("converts detection and writes config", () => {
      const detection: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: {
          name: "detected-app",
          language: "python",
          framework: "fastapi",
        },
        commands: {
          test: "pytest",
          lint: "ruff check .",
        },
      };

      const result = generateAndWriteConfig(tempDir, detection);

      expect(result.success).toBe(true);

      const content = readFileSync(
        join(tempDir, ".ralph", "config.yaml"),
        "utf-8"
      );
      expect(content).toContain("name: detected-app");
      expect(content).toContain("language: python");
      expect(content).toContain("framework: fastapi");
      expect(content).toContain("test: pytest");
      expect(content).toContain("lint: ruff check .");
    });

    test("fails for invalid detection result", () => {
      const detection: DetectionResult = {
        detected: false,
        confidence: 0,
      };

      const result = generateAndWriteConfig(tempDir, detection);

      expect(result.success).toBe(false);
      expect(result.error).toContain("invalid or empty");
    });

    test("respects overwrite flag", () => {
      // First write
      const detection: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: { name: "app1", language: "go" },
      };
      generateAndWriteConfig(tempDir, detection);

      // Second write without overwrite
      const detection2: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: { name: "app2", language: "rust" },
      };
      const result = generateAndWriteConfig(tempDir, detection2, false);

      expect(result.success).toBe(false);

      // With overwrite
      const result2 = generateAndWriteConfig(tempDir, detection2, true);
      expect(result2.success).toBe(true);

      const content = readFileSync(
        join(tempDir, ".ralph", "config.yaml"),
        "utf-8"
      );
      expect(content).toContain("name: app2");
    });
  });

  describe("Full integration", () => {
    test("generates correct YAML for Node.js SvelteKit project", () => {
      const detection: DetectionResult = {
        detected: true,
        confidence: 0.95,
        project: {
          name: "my-sveltekit-app",
          language: "typescript",
          framework: "sveltekit",
          packageManager: "pnpm",
        },
        commands: {
          test: "pnpm vitest",
          lint: "pnpm eslint",
          build: "pnpm build",
        },
      };

      generateAndWriteConfig(tempDir, detection);

      const content = readFileSync(
        join(tempDir, ".ralph", "config.yaml"),
        "utf-8"
      );

      // Verify structure matches PRD example
      expect(content).toContain("# .ralph/config.yaml (generated by sfs --init)");
      expect(content).toContain("project:");
      expect(content).toContain("  name: my-sveltekit-app");
      expect(content).toContain("  language: typescript");
      expect(content).toContain("  framework: sveltekit");
      expect(content).toContain("commands:");
      expect(content).toContain("  test: pnpm vitest");
      expect(content).toContain("  lint: pnpm eslint");
      expect(content).toContain("  build: pnpm build");
      expect(content).toContain("rules: []");
    });

    test("generates correct YAML for Rust actix project", () => {
      const detection: DetectionResult = {
        detected: true,
        confidence: 0.9,
        project: {
          name: "rust-api",
          language: "rust",
          framework: "actix",
          packageManager: "cargo",
        },
        commands: {
          test: "cargo test",
          lint: "cargo clippy",
          build: "cargo build",
        },
      };

      generateAndWriteConfig(tempDir, detection);

      const content = readFileSync(
        join(tempDir, ".ralph", "config.yaml"),
        "utf-8"
      );

      expect(content).toContain("name: rust-api");
      expect(content).toContain("language: rust");
      expect(content).toContain("framework: actix");
      expect(content).toContain("test: cargo test");
      expect(content).toContain("lint: cargo clippy");
      expect(content).toContain("build: cargo build");
    });

    test("generates correct YAML for Go gin project", () => {
      const detection: DetectionResult = {
        detected: true,
        confidence: 0.85,
        project: {
          name: "go-api",
          language: "go",
          framework: "gin",
          packageManager: "go",
        },
        commands: {
          test: "go test ./...",
          lint: "golangci-lint run",
          build: "go build ./...",
        },
      };

      generateAndWriteConfig(tempDir, detection);

      const content = readFileSync(
        join(tempDir, ".ralph", "config.yaml"),
        "utf-8"
      );

      expect(content).toContain("name: go-api");
      expect(content).toContain("language: go");
      expect(content).toContain("framework: gin");
      expect(content).toContain("test: go test ./...");
      expect(content).toContain("lint: golangci-lint run");
      expect(content).toContain("build: go build ./...");
    });
  });
});
