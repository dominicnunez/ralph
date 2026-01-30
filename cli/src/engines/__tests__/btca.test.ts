import { describe, expect, test } from "bun:test";
import { generatePrompt, generateSingleTaskPrompt } from "../base.js";

describe("btca integration", () => {
  test("generatePrompt includes btca when enabled with resources", () => {
    const prompt = generatePrompt({
      skipCommit: false,
      btcaEnabled: true,
      btcaResources: ["gin", "sqlx"],
    });
    expect(prompt).toContain("Documentation Lookup (BTCA)");
    expect(prompt).toContain("@gin, @sqlx");
    expect(prompt).toContain("btca ask -r gin");
  });

  test("generatePrompt includes btca without resources", () => {
    const prompt = generatePrompt({
      skipCommit: false,
      btcaEnabled: true,
      btcaResources: [],
    });
    expect(prompt).toContain("Documentation Lookup (BTCA)");
    expect(prompt).toContain("btca ask -r <resource>");
  });

  test("generatePrompt excludes btca when disabled", () => {
    const prompt = generatePrompt({
      skipCommit: false,
      btcaEnabled: false,
      btcaResources: ["gin"],
    });
    expect(prompt).not.toContain("Documentation Lookup (BTCA)");
  });

  test("generateSingleTaskPrompt includes btca when enabled", () => {
    const prompt = generateSingleTaskPrompt("add feature", {
      skipCommit: false,
      btcaEnabled: true,
      btcaResources: ["svelte"],
    });
    expect(prompt).toContain("Documentation Lookup (BTCA)");
    expect(prompt).toContain("@svelte");
  });
});
