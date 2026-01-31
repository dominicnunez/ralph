import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync, execSync } from "node:child_process";
import { tmpdir } from "node:os";

describe("ralph.sh script", () => {
  const ralphPath = join(import.meta.dir, "..", "..", "..", "ralph.sh");

  test("ralph.sh exists", () => {
    expect(existsSync(ralphPath)).toBe(true);
  });

  describe("centralized progress file variables", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("defines PROGRESS_DIR variable", () => {
      expect(content).toContain('PROGRESS_DIR="$HOME/.ralph/progress"');
    });

    test("defines PROGRESS_FILE variable with project name", () => {
      expect(content).toContain('PROGRESS_FILE="$PROGRESS_DIR/progress-${PROJECT_NAME}.log"');
    });

    test("PROGRESS_DIR is defined after LOG_FILE", () => {
      const logFilePos = content.indexOf('LOG_FILE="$LOG_DIR/ralph-${PROJECT_NAME}.log"');
      const progressDirPos = content.indexOf('PROGRESS_DIR="$HOME/.ralph/progress"');
      expect(progressDirPos).toBeGreaterThan(logFilePos);
    });

    test("PROGRESS_FILE is defined after PROGRESS_DIR", () => {
      const progressDirPos = content.indexOf('PROGRESS_DIR="$HOME/.ralph/progress"');
      const progressFilePos = content.indexOf('PROGRESS_FILE="$PROGRESS_DIR/progress-${PROJECT_NAME}.log"');
      expect(progressFilePos).toBeGreaterThan(progressDirPos);
    });

    test("PROGRESS_DIR uses $HOME for user-independent path", () => {
      // Should use $HOME so it works for any user
      expect(content).toMatch(/PROGRESS_DIR="\$HOME/);
    });

    test("PROGRESS_FILE uses PROJECT_NAME variable for per-project separation", () => {
      // Should include PROJECT_NAME to keep logs separate per project
      expect(content).toMatch(/PROGRESS_FILE=.*\$\{?PROJECT_NAME\}?/);
    });

    test("progress file location is before config section", () => {
      // Progress file should be defined near the log file, before config loading
      const progressFilePos = content.indexOf('PROGRESS_FILE=');
      const preserveEnvSection = content.indexOf("# PRESERVE ENVIRONMENT OVERRIDES BEFORE SOURCING CONFIG");
      expect(progressFilePos).toBeLessThan(preserveEnvSection);
    });
  });

  describe("setup_logging creates PROGRESS_DIR", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("setup_logging function creates PROGRESS_DIR directory", () => {
      // The setup_logging function should create PROGRESS_DIR
      expect(content).toContain('mkdir -p "$PROGRESS_DIR"');
    });

    test("PROGRESS_DIR mkdir is inside setup_logging function", () => {
      // Find setup_logging function boundaries
      const setupLoggingStart = content.indexOf("setup_logging() {");
      expect(setupLoggingStart).toBeGreaterThan(-1);
      
      // Find the closing brace (first } at start of line after setup_logging)
      const contentAfterSetup = content.substring(setupLoggingStart);
      const lines = contentAfterSetup.split('\n');
      let closingBracePos = -1;
      let charCount = 0;
      for (let i = 1; i < lines.length; i++) {
        charCount += lines[i - 1].length + 1;
        if (lines[i] === '}') {
          closingBracePos = setupLoggingStart + charCount;
          break;
        }
      }
      expect(closingBracePos).toBeGreaterThan(setupLoggingStart);
      
      // Check PROGRESS_DIR mkdir is inside the function
      const functionBody = content.substring(setupLoggingStart, closingBracePos);
      expect(functionBody).toContain('mkdir -p "$PROGRESS_DIR"');
    });

    test("PROGRESS_DIR mkdir is after LOG_DIR mkdir in setup_logging", () => {
      // Both mkdir commands should exist, with PROGRESS_DIR after LOG_DIR
      const logDirMkdir = content.indexOf('mkdir -p "$LOG_DIR"');
      const progressDirMkdir = content.indexOf('mkdir -p "$PROGRESS_DIR"');
      
      expect(logDirMkdir).toBeGreaterThan(-1);
      expect(progressDirMkdir).toBeGreaterThan(-1);
      expect(progressDirMkdir).toBeGreaterThan(logDirMkdir);
    });

    test("PROGRESS_DIR mkdir uses -p flag for nested directory creation", () => {
      // -p flag ensures parent directories are created if needed
      expect(content).toContain('mkdir -p "$PROGRESS_DIR"');
    });
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

  describe("PRD.md validation", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("checks for PRD.md file existence", () => {
      // Should have the PRD.md existence check
      expect(content).toContain('if [[ ! -f "PRD.md" ]]');
    });

    test("prints error message with pwd when PRD.md not found", () => {
      // Should display error with current directory
      expect(content).toContain('echo "Error: PRD.md not found in $(pwd)"');
    });

    test("prints helpful message about creating PRD.md", () => {
      // Should give user guidance on next steps
      expect(content).toContain("Create a PRD.md file");
    });

    test("exits with code 1 when PRD.md not found", () => {
      // The PRD.md check block should have an exit 1
      // Find the block more precisely by looking for the complete if block
      const lines = content.split('\n');
      const prdCheckStart = lines.findIndex(line => 
        line.includes('if [[ ! -f "PRD.md" ]]')
      );
      expect(prdCheckStart).toBeGreaterThan(-1);
      
      // Find the matching fi (next 'fi' at same indentation)
      let fiLine = -1;
      for (let i = prdCheckStart + 1; i < lines.length; i++) {
        if (lines[i].trim() === 'fi') {
          fiLine = i;
          break;
        }
      }
      expect(fiLine).toBeGreaterThan(prdCheckStart);
      
      // Check that exit 1 is between the if and fi
      const blockLines = lines.slice(prdCheckStart, fiLine + 1);
      const hasExit1 = blockLines.some(line => line.includes('exit 1'));
      expect(hasExit1).toBe(true);
    });

    test("PRD.md check is after engine CLI check", () => {
      // PRD.md check should come after the engine CLI availability check
      const engineCheckEnd = content.indexOf(
        "Error: 'opencode' command not found"
      );
      const prdCheck = content.indexOf('if [[ ! -f "PRD.md" ]]');
      expect(prdCheck).toBeGreaterThan(engineCheckEnd);
    });

    test("PRD.md check is before logging setup", () => {
      // PRD.md check should come before the logging functions
      const prdCheck = content.indexOf('if [[ ! -f "PRD.md" ]]');
      const loggingSection = content.indexOf("# LOGGING FUNCTIONS");
      expect(prdCheck).toBeLessThan(loggingSection);
    });
  });

  describe("PRD.md validation integration", () => {
    let testDir: string;
    const ralphPath = join(import.meta.dir, "..", "..", "..", "ralph.sh");

    beforeEach(() => {
      // Create a unique temp directory for each test
      testDir = join(
        tmpdir(),
        `ralph-prd-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
      // Clean up temp directory
      if (testDir && existsSync(testDir)) {
        rmSync(testDir, { recursive: true, force: true });
      }
    });

    test("ralph.sh exits with error when PRD.md is missing", () => {
      // Run ralph.sh in directory without PRD.md
      const result = spawnSync("bash", [ralphPath], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PATH: process.env.PATH },
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Error: PRD.md not found");
      expect(result.stderr).toContain(testDir);
    });

    test("error message includes current directory path", () => {
      const result = spawnSync("bash", [ralphPath], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PATH: process.env.PATH },
      });

      // Should show the directory where ralph was run
      expect(result.stderr).toContain(testDir);
    });

    test("error message includes guidance on creating PRD.md", () => {
      const result = spawnSync("bash", [ralphPath], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, PATH: process.env.PATH },
      });

      expect(result.stderr).toContain("Create a PRD.md file");
    });

    test("ralph.sh proceeds when PRD.md exists (fails on engine check, not PRD)", () => {
      // Create PRD.md in test directory
      writeFileSync(join(testDir, "PRD.md"), "# Test PRD\n\n- [ ] Task 1\n");

      // Run ralph.sh with an invalid ENGINE to make it fail fast at validation
      // We want to verify it passes the PRD.md check but fails elsewhere
      const result = spawnSync("bash", [ralphPath], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
        env: { 
          ...process.env, 
          PATH: process.env.PATH,
          ENGINE: "invalid_engine"  // This will fail at the ENGINE validation check
        },
      });

      // Should NOT fail with PRD.md error (it should fail on invalid ENGINE)
      expect(result.stderr).not.toContain("Error: PRD.md not found");
      // Should fail with ENGINE validation error
      expect(result.stderr).toContain("Invalid ENGINE");
      expect(result.status).toBe(1);
    });
  });
});
