import { describe, test, expect } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, execSync } from "node:child_process";

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

  describe("PTY wrapper works in non-TTY environment", () => {
    test("script command is available on the system", () => {
      // Verify script command exists (required for PTY wrapper)
      const result = spawnSync("which", ["script"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toContain("script");
    });

    test("script -q /dev/null -c works in non-TTY environment", () => {
      // Run a simple command through the script wrapper in a non-TTY context
      // By using spawnSync without inheriting stdio, we simulate a non-TTY environment
      const result = spawnSync(
        "script",
        ["-q", "/dev/null", "-c", 'echo "test output"'],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("test output");
    });

    test("script wrapper provides TTY to child process in non-TTY context", () => {
      // Verify that script provides a TTY to the child process
      // The `tty` command returns the TTY device name or "not a tty" if no TTY
      const result = spawnSync("script", ["-q", "/dev/null", "-c", "tty"], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      expect(result.status).toBe(0);
      // When script provides a PTY, tty should return a device path (e.g., /dev/pts/X)
      // and NOT "not a tty"
      expect(result.stdout.trim()).not.toContain("not a tty");
      expect(result.stdout.trim()).toMatch(/\/dev\/(pts\/|tty)/);
    });

    test("without script wrapper, child process has no TTY in non-TTY context", () => {
      // Verify that without script wrapper, there is no TTY
      // This shows why the wrapper is needed
      const result = spawnSync("tty", [], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      // In non-TTY context (pipes for stdio), tty returns "not a tty"
      expect(result.stdout.trim()).toContain("not a tty");
    });

    test("script command with -e returns child exit status", () => {
      // Test that script with -e/--return flag passes through exit status
      // Note: The default `script -q /dev/null -c` does NOT preserve exit status
      // But opencode uses other means to indicate success/failure (output)
      const successResult = spawnSync(
        "script",
        ["-q", "-e", "/dev/null", "-c", "exit 0"],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      expect(successResult.status).toBe(0);

      const failResult = spawnSync(
        "script",
        ["-q", "-e", "/dev/null", "-c", "exit 42"],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      expect(failResult.status).toBe(42);
    })

    test("script wrapper without -e always returns 0 (opencode uses output for status)", () => {
      // Without -e flag, script always returns 0
      // This is acceptable because opencode communicates via output, not exit codes
      const result = spawnSync(
        "script",
        ["-q", "/dev/null", "-c", "exit 1"],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      // Script without -e returns 0 regardless of child exit
      expect(result.status).toBe(0);
    });

    test("script wrapper handles variable expansion correctly", () => {
      // Verify that shell variables are properly expanded within script -c
      const result = spawnSync(
        "bash",
        [
          "-c",
          'TEST_VAR="hello world" && script -q /dev/null -c "echo \\"$TEST_VAR\\""',
        ],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("hello world");
    });

    test("script wrapper handles special characters in variables", () => {
      // Verify that variables with special characters are properly handled
      const result = spawnSync(
        "bash",
        [
          "-c",
          'SPECIAL_VAR="test with spaces and \\"quotes\\"" && script -q /dev/null -c "echo \\"$SPECIAL_VAR\\""',
        ],
        {
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        }
      );
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("test with spaces");
    });

    test("run_opencode function can be extracted and syntax-checked", () => {
      // Extract the run_opencode function and verify it's valid bash
      const content = readFileSync(
        join(import.meta.dir, "..", "..", "..", "ralph.sh"),
        "utf-8"
      );

      // Extract the run_opencode function
      const match = content.match(
        /run_opencode\s*\(\)\s*\{[\s\S]*?^}/m
      );
      expect(match).not.toBeNull();

      // Create a test script that defines and calls run_opencode with mock variables
      const testScript = `
        #!/bin/bash
        CURRENT_OC_PRIME_MODEL="test-model"
        PROMPT="test prompt"
        
        # Mock opencode command
        opencode() {
          echo "opencode called with: $@"
        }
        export -f opencode
        
        ${match![0]}
        
        # Just check syntax by defining the function
        type run_opencode
      `;

      const result = spawnSync("bash", ["-c", testScript], {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("run_opencode is a function");
    });
  });
});
