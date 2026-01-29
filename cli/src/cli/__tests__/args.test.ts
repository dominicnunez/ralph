import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseArgs } from "../args.js";

describe("parseArgs single task detection", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "sfs-args-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should treat non-directory positional arg as single task", () => {
    const { options } = parseArgs(["node", "sfs", "add dark mode toggle"]);
    expect(options.singleTask).toBe("add dark mode toggle");
  });

  it("should not set singleTask for directory positional arg", () => {
    const { options } = parseArgs(["node", "sfs", tempDir]);
    expect(options.singleTask).toBeUndefined();
  });

  it("should leave singleTask undefined when no positional args", () => {
    const { options } = parseArgs(["node", "sfs"]);
    expect(options.singleTask).toBeUndefined();
  });
});
