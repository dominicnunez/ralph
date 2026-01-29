import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("README documentation", () => {
  const readmePath = join(import.meta.dir, "..", "..", "..", "README.md");

  test("README.md exists", () => {
    expect(existsSync(readmePath)).toBe(true);
  });

  describe("--init documentation", () => {
    const content = readFileSync(readmePath, "utf-8");

    test("documents --init flag in CLI Usage section", () => {
      expect(content).toContain("sfs --init");
    });

    test("has Project Initialization section", () => {
      expect(content).toContain("## Project Initialization");
    });

    test("documents supported languages", () => {
      expect(content).toContain("| Node.js | package.json");
      expect(content).toContain("| Python | pyproject.toml");
      expect(content).toContain("| Go | go.mod");
      expect(content).toContain("| Rust | Cargo.toml");
    });

    test("documents detected frameworks for Node.js", () => {
      expect(content).toContain("SvelteKit");
      expect(content).toContain("Next.js");
      expect(content).toContain("React");
      expect(content).toContain("Express");
    });

    test("documents detected frameworks for Python", () => {
      expect(content).toContain("FastAPI");
      expect(content).toContain("Django");
      expect(content).toContain("Flask");
    });

    test("documents detected frameworks for Go", () => {
      expect(content).toContain("Gin");
      expect(content).toContain("Echo");
      expect(content).toContain("Fiber");
    });

    test("documents detected frameworks for Rust", () => {
      expect(content).toContain("Actix");
      expect(content).toContain("Axum");
      expect(content).toContain("Rocket");
    });

    test("documents init options", () => {
      expect(content).toContain("sfs --init -y");
      expect(content).toContain("sfs --init --force");
    });

    test("shows example config output", () => {
      expect(content).toContain("# .ralph/config.yaml");
      expect(content).toContain("project:");
      expect(content).toContain("commands:");
    });

    test("explains what init command does", () => {
      expect(content).toContain("Detect your project's language and framework");
      expect(content).toContain("Find your package manager");
      expect(content).toContain("Identify test, lint, and build commands");
    });
  });
});
