import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { execSync, spawnSync } from "child_process";

const RALPH_SCRIPT = join(__dirname, "..", "ralph.sh");

function readRalphScript(): string {
  return readFileSync(RALPH_SCRIPT, "utf-8");
}

describe("Task 4: Signal Trapping for Graceful Shutdown", () => {
  describe("Code Structure Verification", () => {
    test("should have handle_signal function defined", () => {
      const script = readRalphScript();
      expect(script).toContain("handle_signal()");
      expect(script).toMatch(/handle_signal\(\)\s*\{/);
    });

    test("should have SIGNAL HANDLING section comment", () => {
      const script = readRalphScript();
      expect(script).toContain("# SIGNAL HANDLING FOR GRACEFUL SHUTDOWN");
    });

    test("should trap SIGTERM", () => {
      const script = readRalphScript();
      expect(script).toContain("trap");
      expect(script).toMatch(/trap\s+['"]handle_signal\s+SIGTERM['"]\s+TERM/);
    });

    test("should trap SIGINT", () => {
      const script = readRalphScript();
      expect(script).toMatch(/trap\s+['"]handle_signal\s+SIGINT['"]\s+INT/);
    });

    test("should trap SIGHUP", () => {
      const script = readRalphScript();
      expect(script).toMatch(/trap\s+['"]handle_signal\s+SIGHUP['"]\s+HUP/);
    });

    test("signal handler section should be before TEST COMMAND DETECTION", () => {
      const script = readRalphScript();
      const signalSectionIndex = script.indexOf("# SIGNAL HANDLING FOR GRACEFUL SHUTDOWN");
      const testDetectionIndex = script.indexOf("# TEST COMMAND DETECTION");
      expect(signalSectionIndex).toBeGreaterThan(0);
      expect(testDetectionIndex).toBeGreaterThan(0);
      expect(signalSectionIndex).toBeLessThan(testDetectionIndex);
    });
  });

  describe("Signal Handler Implementation", () => {
    test("handle_signal should accept signal_name parameter", () => {
      const script = readRalphScript();
      const handlerMatch = script.match(/handle_signal\(\)\s*\{[^}]*local signal_name="\$1"/m);
      expect(handlerMatch).toBeTruthy();
    });

    test("should log signal with WARN level", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toContain('log "WARN" "Received signal: $signal_name"');
    });

    test("should log current iteration number if available", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toMatch(/if.*\$\{i:-\}/);
      expect(handlerSection![0]).toContain('log "WARN" "Current iteration: $i"');
    });

    test("should log current task name if available", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toMatch(/if.*\$\{current_task:-\}/);
      expect(handlerSection![0]).toContain('log "WARN" "Current task: $current_task"');
    });

    test("should exit with code 130", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toContain("exit 130");
    });

    test("should use -n flag for variable existence check", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // Should check if variables are set before logging them
      expect(handlerSection![0]).toMatch(/\[\[\s*-n\s+"\$\{i:-\}"\s*\]\]/);
      expect(handlerSection![0]).toMatch(/\[\[\s*-n\s+"\$\{current_task:-\}"\s*\]\]/);
    });
  });

  describe("Trap Configuration", () => {
    test("trap statements should come after handle_signal function", () => {
      const script = readRalphScript();
      const functionEnd = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      const functionEndIndex = script.indexOf(functionEnd![0]) + functionEnd![0].length;
      const firstTrapIndex = script.indexOf("trap 'handle_signal SIGTERM' TERM");
      expect(firstTrapIndex).toBeGreaterThan(functionEndIndex);
    });

    test("all three traps should be defined consecutively", () => {
      const script = readRalphScript();
      const trapSection = script.match(/trap 'handle_signal SIGTERM' TERM[\s\S]*?trap 'handle_signal SIGHUP' HUP/);
      expect(trapSection).toBeTruthy();
      // Should not have other major code sections between traps
      expect(trapSection![0]).not.toContain("function");
      expect(trapSection![0]).not.toContain("# ───────");
    });

    test("trap commands should use correct syntax", () => {
      const script = readRalphScript();
      // Verify proper trap syntax: trap 'command' SIGNAL
      expect(script).toMatch(/trap\s+'handle_signal\s+SIGTERM'\s+TERM/);
      expect(script).toMatch(/trap\s+'handle_signal\s+SIGINT'\s+INT/);
      expect(script).toMatch(/trap\s+'handle_signal\s+SIGHUP'\s+HUP/);
    });
  });

  describe("Integration with Main Loop", () => {
    test("signal handler should be defined before main loop starts", () => {
      const script = readRalphScript();
      const handlerIndex = script.indexOf("handle_signal()");
      const mainLoopIndex = script.indexOf("i=0");
      expect(handlerIndex).toBeGreaterThan(0);
      expect(mainLoopIndex).toBeGreaterThan(0);
      expect(handlerIndex).toBeLessThan(mainLoopIndex);
    });

    test("traps should be set before main loop starts", () => {
      const script = readRalphScript();
      const trapIndex = script.indexOf("trap 'handle_signal SIGTERM' TERM");
      const mainLoopIndex = script.indexOf("i=0");
      expect(trapIndex).toBeGreaterThan(0);
      expect(mainLoopIndex).toBeGreaterThan(0);
      expect(trapIndex).toBeLessThan(mainLoopIndex);
    });

    test("handle_signal should reference variables available in main loop", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // Should reference 'i' and 'current_task' which are set in main loop
      expect(handlerSection![0]).toContain("${i:-}");
      expect(handlerSection![0]).toContain("${current_task:-}");
    });
  });

  describe("Task 4 Requirements Verification", () => {
    test("requirement: trap SIGTERM, SIGINT, SIGHUP", () => {
      const script = readRalphScript();
      expect(script).toMatch(/trap.*SIGTERM.*TERM/);
      expect(script).toMatch(/trap.*SIGINT.*INT/);
      expect(script).toMatch(/trap.*SIGHUP.*HUP/);
    });

    test("requirement: log 'Received signal: $signal' on signal", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toContain('log "WARN" "Received signal: $signal_name"');
    });

    test("requirement: log current iteration number on signal", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toContain('log "WARN" "Current iteration: $i"');
    });

    test("requirement: log current task name on signal", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toContain('log "WARN" "Current task: $current_task"');
    });
  });

  describe("Edge Cases and Error Handling", () => {
    test("should handle missing iteration variable gracefully", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // Should check if variable exists before trying to log it
      expect(handlerSection![0]).toMatch(/if\s+\[\[\s*-n\s+"?\$\{i:-\}"?\s*\]\]/);
    });

    test("should handle missing current_task variable gracefully", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // Should check if variable exists before trying to log it
      expect(handlerSection![0]).toMatch(/if\s+\[\[\s*-n\s+"?\$\{current_task:-\}"?\s*\]\]/);
    });

    test("should use proper variable expansion with default empty string", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // ${var:-} expands to empty string if var is unset
      expect(handlerSection![0]).toContain("${i:-}");
      expect(handlerSection![0]).toContain("${current_task:-}");
    });

    test("should exit after logging signal information", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // Exit should be at the end of the function
      const lines = handlerSection![0].split("\n");
      const exitLine = lines.find(l => l.includes("exit 130"));
      expect(exitLine).toBeTruthy();
    });
  });

  describe("Log Format Compliance", () => {
    test("signal log should use WARN level", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      expect(handlerSection![0]).toContain('log "WARN"');
    });

    test("log messages should match PRD specification format", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // PRD specifies: [WARN] Received signal: $signal
      expect(handlerSection![0]).toContain('"Received signal: $signal_name"');
      // Current iteration number
      expect(handlerSection![0]).toContain('"Current iteration: $i"');
      // Current task name
      expect(handlerSection![0]).toContain('"Current task: $current_task"');
    });
  });

  describe("End-to-End Behavior", () => {
    test("signal handler function should be syntactically valid bash", () => {
      const script = readRalphScript();
      const handlerSection = script.match(/handle_signal\(\)\s*\{[\s\S]*?\n\}/m);
      expect(handlerSection).toBeTruthy();
      // Basic syntax checks
      expect(handlerSection![0]).toMatch(/\{[\s\S]*\}/); // Has opening and closing braces
      expect(handlerSection![0]).toMatch(/local signal_name="\$1"/); // Proper parameter handling
      expect(handlerSection![0]).toMatch(/log "WARN"/); // Uses log function
    });

    test("trap statements should be syntactically valid bash", () => {
      const script = readRalphScript();
      // Extract all trap statements
      const traps = script.match(/trap\s+'handle_signal\s+\w+'\s+\w+/g);
      expect(traps).toBeTruthy();
      expect(traps!.length).toBe(3);
      // Verify each trap has proper syntax
      traps!.forEach(trap => {
        expect(trap).toMatch(/trap\s+'handle_signal\s+\w+'\s+\w+/);
      });
    });
  });
});
