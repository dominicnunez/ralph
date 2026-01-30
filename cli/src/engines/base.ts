export interface EngineResult {
  success: boolean;
  output: string;
  exitCode: number;
  rateLimited?: boolean;
}

export interface Engine {
  name: string;
  model: string;
  
  /**
   * Check if the engine CLI is available
   */
  isAvailable(): boolean;
  
  /**
   * Run the engine with the given prompt
   */
  run(prompt: string): Promise<EngineResult>;
  
  /**
   * Switch to fallback model (if available)
   * Returns true if switch was successful
   */
  switchToFallback?(): boolean;
}

export const COMPLETE_MARKER = "<promise>COMPLETE</promise>";

export interface PromptOptions {
  skipCommit: boolean;
  btcaEnabled?: boolean;
  btcaResources?: string[];
}

/**
 * Generate btca instructions if enabled
 */
function generateBtcaInstructions(resources: string[]): string {
  if (resources.length === 0) {
    return `## Documentation Lookup (BTCA)

When working with external libraries or frameworks, look up current APIs before writing code:

\`\`\`bash
btca ask -r <resource> -q "your question"
\`\`\`

Check the docs before writing — don't rely on training data.`;
  }

  const resourceList = resources.map(r => `@${r}`).join(", ");
  const exampleResource = resources[0];
  
  return `## Documentation Lookup (BTCA)

When working with code that uses these libraries, look up current APIs:
${resourceList}

\`\`\`bash
btca ask -r ${exampleResource} -q "how to do X"
\`\`\`

Check the docs before writing — don't rely on training data.`;
}

/**
 * Generate the standard prompt for Ralph
 */
export function generatePrompt(options: PromptOptions): string {
  const { skipCommit, btcaEnabled, btcaResources } = options;
  const commitInstructions = skipCommit
    ? `- If tests PASS:
  - Update PRD.md to mark the task complete (change [ ] to [x])
  - Do NOT commit any changes in this run
  - Append what worked to progress.txt`
    : `- If tests PASS:
  - Update PRD.md to mark the task complete (change [ ] to [x])
  - Commit your changes with message: feat: [task description] (do NOT add Co-Authored-By)
  - Append what worked to progress.txt`;

  return `You are Ralph, an autonomous coding agent. Do exactly ONE task per iteration.

## Steps

1. Read PRD.md and find the first task that is NOT complete (marked [ ]).
2. Read progress.txt - check the Learnings section first for patterns from previous iterations.
3. Implement that ONE task only.
4. **CRITICAL: You MUST write tests for your implementation.**
5. **CRITICAL: You MUST run tests and ensure ALL tests pass.**

## Test Requirement (MANDATORY)

You MUST:
- Create or modify a test file (e.g., *.test.ts, *.spec.ts)
- Write at least one test for the feature you implement
- Run the full test suite
- Verify ALL tests pass before marking the task complete

If you do not write tests, the task will be rejected and you must try again.

## Only Complete If Tests Pass

${commitInstructions}

- If tests FAIL:
  - Do NOT mark the task complete
  - Do NOT commit broken code
  - Append what went wrong to progress.txt (so next iteration can learn)

## Progress Notes Format

Append to progress.txt using this format:

## Iteration [N] - [Task Name]
- What was implemented
- Test file created/modified: [filename]
- Tests written: [brief description]
- Test results: PASS/FAIL
- Files changed
- Learnings for future iterations
---

## Update AGENTS.md (If Applicable)

If you discover a reusable pattern that future work should know about:
- Check if AGENTS.md exists in the project root
- Add patterns like: 'This codebase uses X for Y' or 'Always do Z when changing W'
- Only add genuinely reusable knowledge, not task-specific details
${btcaEnabled ? `\n${generateBtcaInstructions(btcaResources || [])}` : ""}
## End Condition

After completing your task, check PRD.md:
- If ALL tasks are [x], output exactly: ${COMPLETE_MARKER}
- If tasks remain [ ], just end your response (next iteration will continue)`;
}

/**
 * Generate prompt for single-task mode
 */
export function generateSingleTaskPrompt(task: string, options: PromptOptions): string {
  const { skipCommit, btcaEnabled, btcaResources } = options;
  const commitInstructions = skipCommit
    ? `- If tests PASS:
  - Do NOT update PRD.md (single-task mode)
  - Do NOT commit any changes in this run
  - Append what worked to progress.txt`
    : `- If tests PASS:
  - Do NOT update PRD.md (single-task mode)
  - Commit your changes with message: feat: [task description] (do NOT add Co-Authored-By)
  - Append what worked to progress.txt`;

  return `You are Ralph, an autonomous coding agent. Do exactly ONE task per iteration.

## Single Task

You must complete this task:
"${task}"

## In-Memory PRD

- [ ] ${task}

Do NOT create or modify PRD.md on disk.

## Steps

1. Read progress.txt - check the Learnings section first for patterns from previous iterations.
2. Implement the single task above only.
3. **CRITICAL: You MUST write tests for your implementation.**
4. **CRITICAL: You MUST run tests and ensure ALL tests pass.**

## Test Requirement (MANDATORY)

You MUST:
- Create or modify a test file (e.g., *.test.ts, *.spec.ts)
- Write at least one test for the feature you implement
- Run the full test suite
- Verify ALL tests pass before marking the task complete

If you do not write tests, the task will be rejected and you must try again.

## Only Complete If Tests Pass

${commitInstructions}

- If tests FAIL:
  - Do NOT commit broken code
  - Append what went wrong to progress.txt (so next iteration can learn)

## Progress Notes Format

Append to progress.txt using this format:

## Iteration [N] - [Task Name]
- What was implemented
- Test file created/modified: [filename]
- Tests written: [brief description]
- Test results: PASS/FAIL
- Files changed
- Learnings for future iterations
---

## Update AGENTS.md (If Applicable)

If you discover a reusable pattern that future work should know about:
- Check if AGENTS.md exists in the project root
- Add patterns like: 'This codebase uses X for Y' or 'Always do Z when changing W'
- Only add genuinely reusable knowledge, not task-specific details
${btcaEnabled ? `\n${generateBtcaInstructions(btcaResources || [])}` : ""}
## End Condition

After completing your task, output exactly: ${COMPLETE_MARKER}`;
}
