# Example PRD - Math CLI

A simple command-line calculator to demonstrate Ralph's workflow.

## Tasks

- [ ] Initialize TypeScript project with Vitest for testing
- [ ] Create main entry point with argument parsing
- [ ] Implement add command with tests
- [ ] Implement subtract command with tests
- [ ] Implement multiply command with tests
- [ ] Implement divide command with tests (handle divide by zero)
- [ ] Add help command showing all available operations
- [ ] Add input validation with helpful error messages

---

## Writing Good Tasks

### Keep Tasks Atomic

Ralph spawns a fresh AI instance for each task with no memory of previous work. Each task must be completable in ONE context window (~10 min of work).

**Right-sized tasks:**
- Add a single function with its tests
- Create one component or module
- Add one CLI command
- Fix one specific bug

**Too big (split these up):**

| Too Big | Split Into |
|---------|-----------|
| "Build the CLI" | Entry point, each command separately |
| "Add all math operations" | One task per operation |
| "Add tests" | Tests should be part of each feature task |

**Rule of thumb:** If you can't describe the change in 2-3 sentences, it's too big.

### Order by Dependencies

Tasks run top-to-bottom. Earlier tasks must NOT depend on later ones.

**Correct order:**
1. Project setup / configuration
2. Core utilities / shared code
3. Features that use the core
4. Polish / documentation

### Include Tests in Each Task

Ralph verifies that test files are created/modified for each task. Don't create separate "add tests" tasks - include testing as part of each feature task.

**Good:**
```
- [ ] Implement add command with tests
```

**Bad:**
```
- [ ] Implement add command
- [ ] Write tests for add command
```

---

## Usage

Run Ralph on this PRD:

```bash
# Using npm CLI
sfs --prd example-prd.md

# Using bash script (copy to PRD.md first)
cp example-prd.md PRD.md
./ralph.sh
```

## Notes

- Tasks are marked complete automatically (`- [x]`) when tests pass
- Ralph verifies test files were created/modified each iteration
- If tests fail, the task is retried until passing
- Progress is logged to `~/.ralph/logs/ralph-<project>.log`
- See `ralph.env.example` for configuration options
