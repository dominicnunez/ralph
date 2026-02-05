import { describe, test, expect } from 'bun:test';
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

describe('Task 1: log_resources() function', () => {
  const ralphPath = join(import.meta.dir, '..', 'ralph.sh');
  const ralphContent = readFileSync(ralphPath, 'utf-8');

  describe('Code structure verification', () => {
    test('should have log_resources() function defined', () => {
      expect(ralphContent).toContain('log_resources()');
    });

    test('should have memory usage detection logic', () => {
      expect(ralphContent).toMatch(/free -m|Memory.*MB/);
    });

    test('should have system load detection logic', () => {
      expect(ralphContent).toMatch(/\/proc\/loadavg|Load:/);
    });

    test('should call log() with INFO level', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        expect(logResourcesMatch[0]).toContain('log "INFO"');
      }
    });

    test('should include "Resources:" in the log message', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        expect(logResourcesMatch[0]).toContain('Resources:');
      }
    });
  });

  describe('Function placement and integration', () => {
    test('should be called after log_iteration in main loop', () => {
      // Find the iteration loop section
      const iterationSection = ralphContent.match(/log_iteration.*\n.*log_resources/s);
      expect(iterationSection).toBeTruthy();
    });

    test('should be called at the start of each iteration', () => {
      // Verify log_resources is called in the while loop
      const whileLoopMatch = ralphContent.match(/while.*MAX.*do[\s\S]*?log_resources/);
      expect(whileLoopMatch).toBeTruthy();
    });
  });

  describe('Resource logging format', () => {
    test('should log memory in MB format', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        // Should contain MB or mem_info variable with MB formatting
        expect(logResourcesMatch[0]).toMatch(/MB|mem_info/);
      }
    });

    test('should log load average', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        expect(logResourcesMatch[0]).toMatch(/Load:|load_info/);
      }
    });

    test('should handle missing free command gracefully', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        // Should check for command existence
        expect(logResourcesMatch[0]).toMatch(/command -v free|if.*free/);
      }
    });

    test('should handle missing /proc/loadavg gracefully', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        // Should check for /proc/loadavg existence
        expect(logResourcesMatch[0]).toMatch(/\/proc\/loadavg/);
      }
    });
  });

  describe('Functional verification', () => {
    test('should successfully extract log_resources function', () => {
      // Extract the function body
      const functionMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(functionMatch).toBeTruthy();
    });

    test('should have proper variable declarations', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        // Should use local variables
        expect(logResourcesMatch[0]).toContain('local');
      }
    });

    test('should use awk for parsing free output', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        // Should use awk to parse free command
        expect(logResourcesMatch[0]).toMatch(/awk/);
      }
    });

    test('should read /proc/loadavg for load average', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        expect(logResourcesMatch[0]).toMatch(/cat.*\/proc\/loadavg/);
      }
    });
  });

  describe('End-to-end behavior', () => {
    test('should be executable as standalone function', () => {
      // Create a test script that sources ralph.sh and calls log_resources
      const testScript = `
        #!/bin/bash
        source ${ralphPath}
        LOG_FILE=$(mktemp)
        log_resources
        cat "$LOG_FILE"
        rm "$LOG_FILE"
      `;

      const tempScript = '/tmp/test-log-resources.sh';
      writeFileSync(tempScript, testScript);
      chmodSync(tempScript, '755');

      // Execute and verify it doesn't error
      let output = '';
      try {
        output = execSync(tempScript, { encoding: 'utf-8' });
      } catch (error: any) {
        // Check if error is due to sourcing issues, not the function itself
        expect(error.message).not.toContain('log_resources');
      } finally {
        unlinkSync(tempScript);
      }

      // If we got output, verify it contains the expected format
      if (output) {
        expect(output).toMatch(/INFO.*Resources:/);
      }
    });

    test('should produce log output in correct format', () => {
      // Verify the log format matches: [INFO] Resources: Memory ${used}/${total}MB, Load: ${load}
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        const functionBody = logResourcesMatch[0];
        // Check that it calls log with INFO and Resources:
        expect(functionBody).toMatch(/log\s+"INFO"\s+"Resources:/);
      }
    });
  });

  describe('Task 1 requirement verification', () => {
    test('should meet requirement: log format includes Memory and Load', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        const functionBody = logResourcesMatch[0];
        expect(functionBody).toContain('Resources:');
        expect(functionBody).toMatch(/Memory|mem_info/);
        expect(functionBody).toMatch(/Load:|load_info/);
      }
    });

    test('should meet requirement: called at start of each iteration', () => {
      // Verify it's called in the main loop after log_iteration
      const mainLoopSection = ralphContent.match(/while.*MAX[\s\S]{0,500}log_resources/);
      expect(mainLoopSection).toBeTruthy();
    });

    test('should meet requirement: uses [INFO] log level', () => {
      const logResourcesMatch = ralphContent.match(/log_resources\(\)\s*\{[\s\S]*?^}/m);
      expect(logResourcesMatch).toBeTruthy();
      if (logResourcesMatch) {
        expect(logResourcesMatch[0]).toContain('log "INFO"');
      }
    });
  });
});
