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

  describe("COMMIT_INSTRUCTIONS uses $PROGRESS_FILE", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("COMMIT_INSTRUCTIONS with SKIP_COMMIT uses $PROGRESS_FILE instead of progress.txt", () => {
      // Find the SKIP_COMMIT=1 COMMIT_INSTRUCTIONS block
      const skipCommitBlock = content.match(/if \[\[ "\$SKIP_COMMIT" == "1" \]\]; then[\s\S]*?^fi$/m);
      expect(skipCommitBlock).not.toBeNull();
      const block = skipCommitBlock![0];
      
      // Should use $PROGRESS_FILE, not progress.txt
      expect(block).toContain("$PROGRESS_FILE");
      expect(block).not.toContain("progress.txt");
    });

    test("COMMIT_INSTRUCTIONS without SKIP_COMMIT uses $PROGRESS_FILE instead of progress.txt", () => {
      // Find the else block for COMMIT_INSTRUCTIONS
      const elseBlockMatch = content.match(/else\s+COMMIT_INSTRUCTIONS=\$\(cat <<EOF[\s\S]*?EOF\s*\)/);
      expect(elseBlockMatch).not.toBeNull();
      const elseBlock = elseBlockMatch![0];
      
      // Should use $PROGRESS_FILE, not progress.txt
      expect(elseBlock).toContain("$PROGRESS_FILE");
      expect(elseBlock).not.toContain("progress.txt");
    });

    test("COMMIT_INSTRUCTIONS heredoc uses unquoted EOF for variable expansion", () => {
      // Both COMMIT_INSTRUCTIONS should use <<EOF (not <<'EOF') to allow variable expansion
      // Find lines containing COMMIT_INSTRUCTIONS= and check heredoc style
      const lines = content.split('\n');
      const commitInstructionsLines = lines.filter(line => 
        line.includes('COMMIT_INSTRUCTIONS=$(cat <<')
      );
      
      // Should have exactly 2 COMMIT_INSTRUCTIONS assignments
      expect(commitInstructionsLines.length).toBe(2);
      
      // Neither should use single-quoted EOF which prevents variable expansion
      for (const line of commitInstructionsLines) {
        expect(line).toContain('<<EOF');
        expect(line).not.toContain("<<'EOF'");
      }
    });

    test("COMMIT_INSTRUCTIONS contains 'Append what worked to' instruction", () => {
      // Both variants should instruct appending to progress file
      const skipCommitBlock = content.match(/if \[\[ "\$SKIP_COMMIT" == "1" \]\]; then[\s\S]*?^else$/m);
      expect(skipCommitBlock).not.toBeNull();
      expect(skipCommitBlock![0]).toContain("Append what worked to");
      
      const elseBlock = content.match(/else\s+COMMIT_INSTRUCTIONS=\$\(cat <<EOF[\s\S]*?EOF\s*\)/);
      expect(elseBlock).not.toBeNull();
      expect(elseBlock![0]).toContain("Append what worked to");
    });
  });

  describe("PROMPT uses $PROGRESS_FILE", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("PROMPT references $PROGRESS_FILE instead of progress.txt for reading", () => {
      // Find the PROMPT heredoc block
      const promptMatch = content.match(/PROMPT=\$\(cat <<EOF[\s\S]*?^EOF\s*\)/m);
      expect(promptMatch).not.toBeNull();
      const prompt = promptMatch![0];
      
      // The "Read progress.txt" line should now be "Read $PROGRESS_FILE"
      expect(prompt).toContain("Read $PROGRESS_FILE");
      expect(prompt).not.toContain("Read progress.txt");
    });

    test("PROMPT references $PROGRESS_FILE instead of progress.txt for failure logging", () => {
      const promptMatch = content.match(/PROMPT=\$\(cat <<EOF[\s\S]*?^EOF\s*\)/m);
      expect(promptMatch).not.toBeNull();
      const prompt = promptMatch![0];
      
      // The "Append what went wrong to progress.txt" line should use $PROGRESS_FILE
      expect(prompt).toContain("Append what went wrong to $PROGRESS_FILE");
      expect(prompt).not.toContain("Append what went wrong to progress.txt");
    });

    test("PROMPT references $PROGRESS_FILE instead of progress.txt in format section", () => {
      const promptMatch = content.match(/PROMPT=\$\(cat <<EOF[\s\S]*?^EOF\s*\)/m);
      expect(promptMatch).not.toBeNull();
      const prompt = promptMatch![0];
      
      // The "Append to progress.txt" line should use $PROGRESS_FILE
      expect(prompt).toContain("Append to $PROGRESS_FILE");
      expect(prompt).not.toContain("Append to progress.txt");
    });

    test("PROMPT heredoc uses unquoted EOF for variable expansion", () => {
      // Find the PROMPT assignment line
      const lines = content.split('\n');
      const promptLine = lines.find(line => line.includes('PROMPT=$(cat <<'));
      
      expect(promptLine).toBeDefined();
      expect(promptLine).toContain('<<EOF');
      expect(promptLine).not.toContain("<<'EOF'");
    });

    test("PROMPT does not contain any progress.txt references", () => {
      const promptMatch = content.match(/PROMPT=\$\(cat <<EOF[\s\S]*?^EOF\s*\)/m);
      expect(promptMatch).not.toBeNull();
      const prompt = promptMatch![0];
      
      // No references to progress.txt should remain in PROMPT
      expect(prompt).not.toContain("progress.txt");
    });
  });

  describe("test verification failure blocks use $PROGRESS_FILE", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("no tests written block appends to $PROGRESS_FILE", () => {
      // Find the block that handles "no test files written" case
      // This block contains "No test files were created or modified"
      const noTestsBlock = content.match(/# Append to progress file so AI knows[\s\S]*?echo "---" >> "\$PROGRESS_FILE"/);
      expect(noTestsBlock).not.toBeNull();
      
      // All echo lines should use $PROGRESS_FILE
      const block = noTestsBlock![0];
      expect(block).toContain('>> "$PROGRESS_FILE"');
      expect(block).not.toContain('>> progress.txt');
    });

    test("tests failed block appends to $PROGRESS_FILE", () => {
      // Find the second block that handles "tests failed" case
      // This block contains "Tests failed"
      const testFailedBlocks = content.match(/# Append to progress file so AI knows[\s\S]*?echo "---" >> "\$PROGRESS_FILE"/g);
      expect(testFailedBlocks).not.toBeNull();
      expect(testFailedBlocks!.length).toBe(2); // Two failure blocks
      
      // Both blocks should use $PROGRESS_FILE
      for (const block of testFailedBlocks!) {
        expect(block).toContain('>> "$PROGRESS_FILE"');
        expect(block).not.toContain('>> progress.txt');
      }
    });

    test("failure blocks have updated comments (progress file, not progress.txt)", () => {
      // The comments should say "progress file" not "progress.txt"
      expect(content).toContain("# Append to progress file so AI knows");
      expect(content).not.toContain("# Append to progress.txt so AI knows");
    });

    test("no tests written block contains correct failure reason", () => {
      // Find the first failure block
      const noTestsBlockMatch = content.match(/if ! verify_tests_written[\s\S]*?fi\s+fi/);
      expect(noTestsBlockMatch).not.toBeNull();
      const block = noTestsBlockMatch![0];
      
      // Should contain the reason for failure
      expect(block).toContain("No test files were created or modified");
      expect(block).toContain("You MUST write tests");
    });

    test("tests failed block contains correct failure reason", () => {
      // Find the tests failed block
      const testsFailedMatch = content.match(/if ! run_tests "\$DETECTED_TEST_CMD"[\s\S]*?fi\s+fi/);
      expect(testsFailedMatch).not.toBeNull();
      const block = testsFailedMatch![0];
      
      // Should contain the reason for failure
      expect(block).toContain("Tests failed");
      expect(block).toContain("Fix the failing tests");
    });

    test("no progress.txt references remain in test verification section", () => {
      // Find the entire test verification section
      const testVerifySection = content.match(/# TEST VERIFICATION GATE[\s\S]*?# COMPLETION CHECK/);
      expect(testVerifySection).not.toBeNull();
      
      // Should not have any progress.txt references
      expect(testVerifySection![0]).not.toContain('progress.txt');
    });
  });

  describe("is_rate_limited function", () => {
    const content = readFileSync(ralphPath, "utf-8");
    
    // Extract the is_rate_limited function from ralph.sh for testing
    const extractFunction = (): string => {
      const funcMatch = content.match(/is_rate_limited\s*\(\)\s*\{[^}]+\}/);
      if (!funcMatch) throw new Error("Could not extract is_rate_limited function");
      return funcMatch[0];
    };

    // Helper to test if a message triggers rate limit detection
    const testRateLimited = (message: string): boolean => {
      const func = extractFunction();
      const result = spawnSync(
        "bash",
        ["-c", `${func}\nis_rate_limited "${message}"`],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
      );
      return result.status === 0;
    };

    test("detects 'rate limit' in output", () => {
      expect(testRateLimited("rate limit exceeded")).toBe(true);
    });

    test("detects 'rate-limit' with hyphen in output", () => {
      expect(testRateLimited("Error: rate-limit hit")).toBe(true);
    });

    test("detects 'quota exceeded' in output", () => {
      expect(testRateLimited("quota exceeded")).toBe(true);
    });

    test("detects 'quota reached' in output", () => {
      expect(testRateLimited("API quota reached")).toBe(true);
    });

    test("detects 'quota exhausted' in output", () => {
      expect(testRateLimited("quota exhausted")).toBe(true);
    });

    test("detects 'quota-exceeded' with hyphen in output", () => {
      expect(testRateLimited("Error: quota-exceeded")).toBe(true);
    });

    test("detects '429' error code in output", () => {
      expect(testRateLimited("HTTP 429 Too Many Requests")).toBe(true);
    });

    test("detects 'too many requests' in output", () => {
      expect(testRateLimited("Error: too many requests")).toBe(true);
    });

    test("detects 'too-many-requests' with hyphens in output", () => {
      expect(testRateLimited("Error: too-many-requests")).toBe(true);
    });

    test("detects 'over capacity' in output", () => {
      expect(testRateLimited("Server is over capacity")).toBe(true);
    });

    test("detects 'over-capacity' with hyphen in output", () => {
      expect(testRateLimited("Error: over-capacity")).toBe(true);
    });

    test("detects 'at capacity' in output", () => {
      expect(testRateLimited("Server at capacity")).toBe(true);
    });

    test("detects 'at-capacity' with hyphen in output", () => {
      expect(testRateLimited("Error: at-capacity")).toBe(true);
    });

    test("detects 'not included in your plan' in output", () => {
      expect(testRateLimited("Usage not included in your plan")).toBe(true);
    });

    test("detects 'not included in plan' in output", () => {
      expect(testRateLimited("This feature not included in plan")).toBe(true);
    });

    test("detects 'not-included-in-plan' with hyphens in output", () => {
      expect(testRateLimited("Error: not-included-in-plan")).toBe(true);
    });

    test("detects 'not-included-in-your' with hyphens in output", () => {
      expect(testRateLimited("Error: not-included-in-your-subscription")).toBe(true);
    });

    test("returns false for normal output without rate limit indicators", () => {
      expect(testRateLimited("Task completed successfully")).toBe(false);
    });

    test("is case-insensitive (detects RATE LIMIT, Rate Limit, etc.)", () => {
      expect(testRateLimited("RATE LIMIT exceeded")).toBe(true);
      expect(testRateLimited("NOT INCLUDED IN YOUR PLAN")).toBe(true);
      expect(testRateLimited("QUOTA EXCEEDED")).toBe(true);
      expect(testRateLimited("AT CAPACITY")).toBe(true);
    });

    test("grep regex includes 'not.?included.?in.?(your|plan)' pattern", () => {
      // Verify the regex pattern in the source code
      expect(content).toContain("not.?included.?in.?(your|plan)");
    });

    test("is_rate_limited function contains all expected patterns", () => {
      // Extract the function and verify it has all patterns
      const funcMatch = content.match(/is_rate_limited\s*\(\)\s*\{[^}]+\}/);
      expect(funcMatch).not.toBeNull();
      const func = funcMatch![0];
      
      // Core patterns
      expect(func).toContain("rate.?limit");
      expect(func).toContain("429");
      expect(func).toContain("too.?many.?request");
      
      // More specific patterns to avoid false positives
      expect(func).toContain("quota.?(exceeded|reached|exhausted)");
      expect(func).toContain("over.?capacity");
      expect(func).toContain("(^|[^a-z])at.?capacity");
      expect(func).toContain("not.?included.?in.?(your|plan)");
    });

    // False positive prevention tests - these should NOT trigger rate limiting
    describe("false positive prevention", () => {
      test("does NOT detect standalone 'capacity' in normal output", () => {
        expect(testRateLimited("The system has 100GB capacity")).toBe(false);
        expect(testRateLimited("Full capacity mode enabled")).toBe(false);
      });

      test("does NOT detect standalone 'quota' in normal output", () => {
        expect(testRateLimited("Your quota is 500 requests")).toBe(false);
        expect(testRateLimited("Quota: 1000")).toBe(false);
      });

      test("does NOT detect standalone 'exhausted' in normal output", () => {
        expect(testRateLimited("All options exhausted in the search")).toBe(false);
      });

      test("does NOT detect standalone 'overloaded' in normal output", () => {
        expect(testRateLimited("The function is overloaded with parameters")).toBe(false);
      });

      test("does NOT detect standalone 'not included' without plan context", () => {
        expect(testRateLimited("This feature is not included")).toBe(false);
        expect(testRateLimited("Error: not-included")).toBe(false);
      });

      test("does NOT detect 'capacity' in variable names or code", () => {
        expect(testRateLimited("const maxCapacity = 100")).toBe(false);
        expect(testRateLimited("calculateCapacity(items)")).toBe(false);
      });
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

  describe("rate limit check after error handling (exit code 0)", () => {
    const content = readFileSync(join(import.meta.dir, "..", "..", "..", "ralph.sh"), "utf-8");

    test("rate limit check exists after the error handling block", () => {
      // Find the error handling block that ends with checking exit_code -ne 0
      const errorHandlingMatch = content.match(
        /if \[\[ \$exit_code -ne 0 \]\][\s\S]*?fi\s*\n/g
      );
      expect(errorHandlingMatch).not.toBeNull();
      
      // The next block after error handling should check for rate limiting when exit code is 0
      const afterErrorHandling = content.indexOf("fi\n", content.indexOf("if [[ $exit_code -ne 0 ]]"));
      const nextSection = content.slice(afterErrorHandling, afterErrorHandling + 500);
      
      // Should have a comment explaining the check
      expect(nextSection).toContain("Check for rate limiting even when exit code is 0");
    });

    test("rate limit check for exit code 0 uses is_rate_limited function", () => {
      // Find the section after the first error handling block
      const afterErrorHandling = content.indexOf("fi\n", content.indexOf("if [[ $exit_code -ne 0 ]]"));
      const nextSection = content.slice(afterErrorHandling, afterErrorHandling + 600);
      
      // Should check ENGINE is opencode and call is_rate_limited
      expect(nextSection).toMatch(/if \[\[ "\$ENGINE" == "opencode" \]\] && is_rate_limited "\$result"/);
    });

    test("rate limit check for exit code 0 calls switch_to_fallback", () => {
      // Find the section with the exit code 0 rate limit check
      const checkMatch = content.match(
        /# Check for rate limiting even when exit code is 0[\s\S]*?fi\n/
      );
      expect(checkMatch).not.toBeNull();
      const checkBlock = checkMatch![0];
      
      expect(checkBlock).toContain("switch_to_fallback");
    });

    test("rate limit check for exit code 0 decrements iteration counter on fallback success", () => {
      const checkMatch = content.match(
        /# Check for rate limiting even when exit code is 0[\s\S]*?fi\n/
      );
      expect(checkMatch).not.toBeNull();
      const checkBlock = checkMatch![0];
      
      // Should decrement i and continue the loop
      expect(checkBlock).toContain("((--i))");
      expect(checkBlock).toContain("continue");
    });

    test("rate limit check for exit code 0 exits with error when no fallback available", () => {
      const checkMatch = content.match(
        /# Check for rate limiting even when exit code is 0[\s\S]*?fi\n/
      );
      expect(checkMatch).not.toBeNull();
      const checkBlock = checkMatch![0];
      
      // Should exit 1 when no fallback
      expect(checkBlock).toContain("exit 1");
      expect(checkBlock).toContain("Rate limit and no fallback available");
    });

    test("rate limit check for exit code 0 logs warning about exit code being 0", () => {
      const checkMatch = content.match(
        /# Check for rate limiting even when exit code is 0[\s\S]*?fi\n/
      );
      expect(checkMatch).not.toBeNull();
      const checkBlock = checkMatch![0];
      
      // Should log that exit code was 0
      expect(checkBlock).toMatch(/log "WARN".*exit code was 0/);
    });

    test("rate limit check for exit code 0 is placed before TEST VERIFICATION GATE", () => {
      // The rate limit check should be before the test verification section
      const rateLimitCheckPos = content.indexOf("Check for rate limiting even when exit code is 0");
      const testVerificationPos = content.indexOf("TEST VERIFICATION GATE");
      
      expect(rateLimitCheckPos).toBeGreaterThan(0);
      expect(testVerificationPos).toBeGreaterThan(0);
      expect(rateLimitCheckPos).toBeLessThan(testVerificationPos);
    });

    test("rate limit check for exit code 0 has explanatory comment", () => {
      const checkMatch = content.match(
        /# Check for rate limiting even when exit code is 0[\s\S]*?fi\n/
      );
      expect(checkMatch).not.toBeNull();
      const checkBlock = checkMatch![0];
      
      // Should explain why this check is needed
      expect(checkBlock).toContain("Some rate limit messages appear in output without causing a non-zero exit");
    });
  });

  describe("archive naming", () => {
    const content = readFileSync(ralphPath, "utf-8");

    test("title extraction uses awk to limit to first 3 words", () => {
      // Should use awk to extract only first 3 words from the title
      expect(content).toContain("awk '{print $1, $2, $3}'");
    });

    test("title extraction collapses multiple dashes", () => {
      // Should use sed to collapse multiple consecutive dashes
      expect(content).toContain("sed 's/--*/-/g'");
    });

    test("archive title pipeline extracts first 3 words before transformations", () => {
      // The awk command should come before tr commands to limit word count early
      const awkPos = content.indexOf("awk '{print $1, $2, $3}'");
      const trLowerPos = content.indexOf("tr '[:upper:]' '[:lower:]'");
      expect(awkPos).toBeGreaterThan(-1);
      expect(trLowerPos).toBeGreaterThan(-1);
      expect(awkPos).toBeLessThan(trLowerPos);
    });

    test("archive title pipeline collapses dashes after other transformations", () => {
      // The sed command to collapse dashes should come at the end
      const trCdPos = content.indexOf("tr -cd '[:alnum:]-'");
      const sedDashPos = content.indexOf("sed 's/--*/-/g'");
      expect(trCdPos).toBeGreaterThan(-1);
      expect(sedDashPos).toBeGreaterThan(-1);
      expect(sedDashPos).toBeGreaterThan(trCdPos);
    });

    test("full archive naming pipeline is correct", () => {
      // The complete pipeline should be: sed -> awk -> tr lower -> tr dash -> tr clean -> sed collapse
      expect(content).toContain(
        "title=$(head -1 PRD.md | sed 's/^#\\s*//' | awk '{print $1, $2, $3}' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-' | sed 's/--*/-/g')"
      );
    });
  });
});
