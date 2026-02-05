import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';

const RALPH_SH = '/home/kai/pets/ralph/ralph.sh';

describe('Task 4: Progress File Logging', () => {
  const script = readFileSync(RALPH_SH, 'utf-8');

  describe('Code Structure', () => {
    it('should have pre-flight baseline section', () => {
      expect(script).toContain('# PRE-FLIGHT TEST BASELINE');
    });

    it('should extract failing tests when baseline has failures', () => {
      expect(script).toContain('failing_tests=$(extract_failing_tests "$baseline_output")');
    });

    it('should log pre-flight baseline section to progress file', () => {
      expect(script).toContain('## Pre-flight Test Baseline - $(date');
    });
  });

  describe('Failing Test Names Extraction', () => {
    it('should call extract_failing_tests with baseline output', () => {
      const match = script.match(/failing_tests=\$\(extract_failing_tests ["']?\$baseline_output["']?\)/);
      expect(match).toBeTruthy();
      expect(match).toHaveLength(1);
    });

    it('should have section for failing tests in progress file', () => {
      expect(script).toContain('### Failing Tests:');
    });

    it('should iterate over failing tests and log each one', () => {
      // Check for the loop that logs individual tests
      const loopPattern = /echo "\$failing_tests" \| while IFS= read -r test; do/;
      expect(script).toMatch(loopPattern);
    });

    it('should format failing tests as bullet points', () => {
      // Check that each test is logged with "  - " prefix
      const bulletPattern = /echo "  - \$test" >> ["']?\$PROGRESS_FILE["']?/;
      expect(script).toMatch(bulletPattern);
    });

    it('should handle case when no test names can be parsed', () => {
      expect(script).toContain('(Unable to parse test names - check output below)');
    });

    it('should check if failing_tests is non-empty before logging', () => {
      const ifPattern = /if \[\[ -n ["']?\$failing_tests["']? \]\]; then/;
      expect(script).toMatch(ifPattern);
    });
  });

  describe('Progress File Message Format', () => {
    it('should include exit code in progress file', () => {
      expect(script).toContain('- Exit code: $baseline_exit_code');
    });

    it('should include status message about pre-existing failures', () => {
      expect(script).toContain('- Status: Pre-existing test failures detected');
    });

    it('should include message that failures will not block PRD work', () => {
      expect(script).toContain('**These will not block PRD work.**');
    });

    it('should include "Attempting auto-fix first" message', () => {
      expect(script).toContain('Attempting auto-fix first.');
    });

    it('should combine both messages in one line', () => {
      // Check that the key message includes both parts
      expect(script).toContain('**These will not block PRD work.** Attempting auto-fix first.');
    });

    it('should still include baseline test output section', () => {
      expect(script).toContain('### Baseline Test Output (last 50 lines):');
    });

    it('should wrap baseline output in code blocks', () => {
      const codeBlockPattern = /echo "\\`\\`\\`" >> ["']?\$PROGRESS_FILE["']?/g;
      const matches = script.match(codeBlockPattern);
      expect(matches).toBeTruthy();
      expect(matches!.length).toBeGreaterThanOrEqual(2); // Opening and closing code blocks
    });
  });

  describe('Integration with Pre-flight Section', () => {
    it('should only extract failing tests when baseline has failures', () => {
      // The extraction should be in the else block (when exit code != 0)
      const lines = script.split('\n');
      let inFailureBlock = false;
      let foundExtraction = false;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('if [[ $baseline_exit_code -eq 0 ]]')) {
          inFailureBlock = false;
        } else if (lines[i].includes('else') && i > 0 && lines[i - 1].includes('Pre-flight baseline: All tests passing')) {
          inFailureBlock = true;
        }

        if (inFailureBlock && lines[i].includes('failing_tests=$(extract_failing_tests')) {
          foundExtraction = true;
          break;
        }
      }

      expect(foundExtraction).toBe(true);
    });

    it('should log to progress file only when tests are failing', () => {
      // Check that progress file logging happens in the failure branch
      const lines = script.split('\n');
      let foundProgressLog = false;
      let afterFailureBranch = false;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Pre-flight baseline: Tests failing')) {
          afterFailureBranch = true;
        }

        if (afterFailureBranch && lines[i].includes('## Pre-flight Test Baseline')) {
          foundProgressLog = true;
          break;
        }

        // Should not find it in the success branch
        if (lines[i].includes('Pre-flight baseline: All tests passing')) {
          afterFailureBranch = false;
        }
      }

      expect(foundProgressLog).toBe(true);
    });

    it('should use extract_failing_tests function that already exists', () => {
      // Verify the function is defined
      expect(script).toContain('extract_failing_tests() {');
    });
  });

  describe('Task 4 Requirements Verification', () => {
    it('should log pre-existing failures clearly to progress file', () => {
      expect(script).toContain('Pre-existing test failures detected');
    });

    it('should include a list of failing tests', () => {
      expect(script).toContain('### Failing Tests:');
      expect(script).toMatch(/echo "\$failing_tests" \| while IFS= read -r test; do/);
    });

    it('should state that failures will not block PRD work', () => {
      expect(script).toContain('will not block PRD work');
    });

    it('should mention attempting auto-fix first', () => {
      expect(script).toContain('Attempting auto-fix first');
    });

    it('should log this information at session start (pre-flight section)', () => {
      // Find the pre-flight section
      const preFlightIndex = script.indexOf('# PRE-FLIGHT TEST BASELINE');
      const autoFixIndex = script.indexOf('# AUTO-FIX PRE-EXISTING TEST FAILURES');

      expect(preFlightIndex).toBeGreaterThan(-1);
      expect(autoFixIndex).toBeGreaterThan(preFlightIndex);

      // Verify the progress file logging is in the pre-flight section
      const progressLogIndex = script.indexOf('## Pre-flight Test Baseline');
      expect(progressLogIndex).toBeGreaterThan(preFlightIndex);
      expect(progressLogIndex).toBeLessThan(autoFixIndex);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty failing_tests gracefully', () => {
      expect(script).toContain('if [[ -n "$failing_tests" ]]; then');
      expect(script).toContain('else');
      expect(script).toContain('(Unable to parse test names - check output below)');
    });

    it('should preserve original baseline output logging', () => {
      // The last 50 lines should still be logged
      expect(script).toContain('echo "$baseline_output" | tail -50 >> "$PROGRESS_FILE"');
    });

    it('should maintain proper markdown formatting', () => {
      expect(script).toContain('### Failing Tests:');
      expect(script).toContain('### Baseline Test Output (last 50 lines):');
      expect(script).toContain('---');
    });

    it('should properly close the while loop', () => {
      const loopPattern = /echo "\$failing_tests" \| while IFS= read -r test; do\s+echo "  - \$test" >> ["']?\$PROGRESS_FILE["']?\s+done/s;
      expect(script).toMatch(loopPattern);
    });
  });

  describe('Format Consistency', () => {
    it('should maintain consistent indentation in progress file entries', () => {
      // All test items should be indented with "  - "
      expect(script).toContain('  - $test');
    });

    it('should use bold markdown for important messages', () => {
      expect(script).toContain('**These will not block PRD work.**');
    });

    it('should separate sections with blank lines', () => {
      // Check for empty line before and after failing tests section
      const sectionPattern = /echo "" >> ["']?\$PROGRESS_FILE["']?\s+echo "### Failing Tests:" >>/;
      expect(script).toMatch(sectionPattern);
    });

    it('should end with standard separator', () => {
      expect(script).toContain('echo "---" >> "$PROGRESS_FILE"');
    });
  });
});
