import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("ralph.sh script", () => {
  const ralphPath = join(import.meta.dir, "..", "..", "..", "ralph.sh");

  test("ralph.sh exists", () => {
    expect(existsSync(ralphPath)).toBe(true);
  });

  describe("PTY wrapper for OpenCode", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("run_opencode function uses script PTY wrapper", () => {
      // Should use script command to provide pseudo-TTY
      expect(content).toContain('script -q /dev/null -c "opencode run');
    });

    test("run_opencode function preserves model variable", () => {
      // Should use the CURRENT_OC_PRIME_MODEL variable
      expect(content).toContain('$CURRENT_OC_PRIME_MODEL');
    });

    test("run_opencode function preserves prompt variable", () => {
      // Should pass the PROMPT variable
      expect(content).toContain('$PROMPT');
    });

    test("has comment explaining why PTY wrapper is needed", () => {
      // Should have explanatory comment
      expect(content).toContain("OpenCode requires a PTY to function");
      expect(content).toContain("pseudo-TTY wrapper");
    });

    test("mentions non-interactive environments in comment", () => {
      // Should explain when this is needed
      expect(content).toMatch(/cron|background.?process|piped|non-interactive/i);
    });

    test("script command uses quiet mode (-q)", () => {
      // -q flag suppresses "Script started" message
      expect(content).toContain("script -q");
    });

    test("script command uses /dev/null for typescript output", () => {
      // /dev/null means don't save the typescript file
      expect(content).toContain("script -q /dev/null");
    });

    test("script command uses -c flag for command execution", () => {
      // -c runs command instead of interactive shell
      expect(content).toContain('-c "opencode');
    });

    test("run_opencode function is properly defined", () => {
      // Should be a bash function
      expect(content).toMatch(/run_opencode\s*\(\)\s*\{/);
    });

    test("variables are properly quoted in script command", () => {
      // Variables should be escaped/quoted for shell safety
      expect(content).toContain('\\"$CURRENT_OC_PRIME_MODEL\\"');
      expect(content).toContain('\\"$PROMPT\\"');
    });
  });

  describe("run_claude function for comparison", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("run_claude does NOT use PTY wrapper (Claude CLI handles this)", () => {
      // Claude CLI doesn't need PTY wrapper
      expect(content).toMatch(/run_claude\s*\(\)\s*\{[^}]*claude --model/);
      // And it shouldn't have script wrapper
      const claudeSection = content.match(/run_claude\s*\(\)\s*\{[^}]*\}/);
      expect(claudeSection).not.toBeNull();
      expect(claudeSection![0]).not.toContain("script -q");
    });
  });
});
