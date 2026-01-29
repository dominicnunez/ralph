import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NodejsDetector } from "../nodejs.js";

describe("NodejsDetector", () => {
  let testDir: string;
  let detector: NodejsDetector;

  beforeEach(() => {
    testDir = join(tmpdir(), `nodejs-detector-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    detector = new NodejsDetector();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("canDetect", () => {
    test("returns true when package.json exists", async () => {
      writeFileSync(join(testDir, "package.json"), JSON.stringify({ name: "test" }));
      expect(await detector.canDetect(testDir)).toBe(true);
    });

    test("returns false when package.json does not exist", async () => {
      expect(await detector.canDetect(testDir)).toBe(false);
    });
  });

  describe("detect", () => {
    test("returns not detected when package.json is missing", async () => {
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("returns not detected when package.json is invalid JSON", async () => {
      writeFileSync(join(testDir, "package.json"), "invalid json");
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(false);
    });

    test("detects basic project with name", async () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({ name: "my-app" })
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-app");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test("uses 'unnamed-project' when name is missing", async () => {
      writeFileSync(join(testDir, "package.json"), JSON.stringify({}));
      const result = await detector.detect(testDir);
      expect(result.project?.name).toBe("unnamed-project");
    });
  });

  describe("detectPackageManager", () => {
    test("detects bun from bun.lockb", () => {
      writeFileSync(join(testDir, "bun.lockb"), "");
      expect(detector.detectPackageManager(testDir)).toBe("bun");
    });

    test("detects pnpm from pnpm-lock.yaml", () => {
      writeFileSync(join(testDir, "pnpm-lock.yaml"), "");
      expect(detector.detectPackageManager(testDir)).toBe("pnpm");
    });

    test("detects yarn from yarn.lock", () => {
      writeFileSync(join(testDir, "yarn.lock"), "");
      expect(detector.detectPackageManager(testDir)).toBe("yarn");
    });

    test("defaults to npm when no lock file", () => {
      expect(detector.detectPackageManager(testDir)).toBe("npm");
    });

    test("prioritizes bun over other lock files", () => {
      writeFileSync(join(testDir, "bun.lockb"), "");
      writeFileSync(join(testDir, "package-lock.json"), "");
      writeFileSync(join(testDir, "yarn.lock"), "");
      expect(detector.detectPackageManager(testDir)).toBe("bun");
    });
  });

  describe("detectFramework", () => {
    test("detects Next.js", () => {
      const result = detector.detectFramework({
        dependencies: { next: "14.0.0", react: "18.0.0" },
      });
      expect(result?.name).toBe("next");
    });

    test("detects SvelteKit", () => {
      const result = detector.detectFramework({
        devDependencies: { "@sveltejs/kit": "2.0.0", svelte: "4.0.0" },
      });
      expect(result?.name).toBe("sveltekit");
    });

    test("detects Svelte (without Kit)", () => {
      const result = detector.detectFramework({
        devDependencies: { svelte: "4.0.0" },
      });
      expect(result?.name).toBe("svelte");
    });

    test("detects React", () => {
      const result = detector.detectFramework({
        dependencies: { react: "18.0.0" },
      });
      expect(result?.name).toBe("react");
    });

    test("detects Vue", () => {
      const result = detector.detectFramework({
        dependencies: { vue: "3.0.0" },
      });
      expect(result?.name).toBe("vue");
    });

    test("detects Express", () => {
      const result = detector.detectFramework({
        dependencies: { express: "4.0.0" },
      });
      expect(result?.name).toBe("express");
    });

    test("detects NestJS", () => {
      const result = detector.detectFramework({
        dependencies: { "@nestjs/core": "10.0.0" },
      });
      expect(result?.name).toBe("nestjs");
    });

    test("detects Nuxt", () => {
      const result = detector.detectFramework({
        dependencies: { nuxt: "3.0.0" },
      });
      expect(result?.name).toBe("nuxt");
    });

    test("detects Fastify", () => {
      const result = detector.detectFramework({
        dependencies: { fastify: "4.0.0" },
      });
      expect(result?.name).toBe("fastify");
    });

    test("returns null when no framework detected", () => {
      const result = detector.detectFramework({
        dependencies: { lodash: "4.0.0" },
      });
      expect(result).toBeNull();
    });

    test("prioritizes SvelteKit over Svelte", () => {
      const result = detector.detectFramework({
        devDependencies: { "@sveltejs/kit": "2.0.0", svelte: "4.0.0" },
      });
      expect(result?.name).toBe("sveltekit");
    });
  });

  describe("detectLanguage", () => {
    test("detects TypeScript from devDependencies", () => {
      writeFileSync(join(testDir, "package.json"), "{}");
      const result = detector.detectLanguage(testDir, {
        devDependencies: { typescript: "5.0.0" },
      });
      expect(result).toBe("typescript");
    });

    test("detects TypeScript from dependencies", () => {
      writeFileSync(join(testDir, "package.json"), "{}");
      const result = detector.detectLanguage(testDir, {
        dependencies: { typescript: "5.0.0" },
      });
      expect(result).toBe("typescript");
    });

    test("detects TypeScript from tsconfig.json", () => {
      writeFileSync(join(testDir, "tsconfig.json"), "{}");
      const result = detector.detectLanguage(testDir, {});
      expect(result).toBe("typescript");
    });

    test("defaults to JavaScript when no TypeScript indicators", () => {
      const result = detector.detectLanguage(testDir, {});
      expect(result).toBe("javascript");
    });
  });

  describe("detectCommands", () => {
    test("detects test command from scripts", () => {
      const result = detector.detectCommands(
        { scripts: { test: "vitest" } },
        "npm"
      );
      expect(result.test).toBe("npm run test");
    });

    test("ignores default npm test script", () => {
      const result = detector.detectCommands(
        { scripts: { test: 'echo "Error: no test specified" && exit 1' } },
        "npm"
      );
      expect(result.test).toBeUndefined();
    });

    test("detects vitest from dependencies", () => {
      const result = detector.detectCommands(
        { devDependencies: { vitest: "1.0.0" } },
        "npm"
      );
      expect(result.test).toBe("npx vitest");
    });

    test("detects jest from dependencies", () => {
      const result = detector.detectCommands(
        { devDependencies: { jest: "29.0.0" } },
        "npm"
      );
      expect(result.test).toBe("npx jest");
    });

    test("detects bun test", () => {
      const result = detector.detectCommands(
        { devDependencies: { bun: "1.0.0" } },
        "bun"
      );
      expect(result.test).toBe("bun test");
    });

    test("detects lint command from scripts", () => {
      const result = detector.detectCommands(
        { scripts: { lint: "eslint ." } },
        "npm"
      );
      expect(result.lint).toBe("npm run lint");
    });

    test("detects eslint from dependencies", () => {
      const result = detector.detectCommands(
        { devDependencies: { eslint: "8.0.0" } },
        "npm"
      );
      expect(result.lint).toBe("npx eslint .");
    });

    test("detects biome from @biomejs/biome", () => {
      const result = detector.detectCommands(
        { devDependencies: { "@biomejs/biome": "1.0.0" } },
        "npm"
      );
      expect(result.lint).toBe("npx biome check");
    });

    test("detects build command from scripts", () => {
      const result = detector.detectCommands(
        { scripts: { build: "tsc" } },
        "npm"
      );
      expect(result.build).toBe("npm run build");
    });

    test("uses correct run command for pnpm", () => {
      const result = detector.detectCommands(
        { scripts: { test: "vitest", lint: "eslint", build: "tsc" } },
        "pnpm"
      );
      expect(result.test).toBe("pnpm test");
      expect(result.lint).toBe("pnpm lint");
      expect(result.build).toBe("pnpm build");
    });

    test("uses correct run command for yarn", () => {
      const result = detector.detectCommands(
        { scripts: { test: "vitest" } },
        "yarn"
      );
      expect(result.test).toBe("yarn test");
    });

    test("uses correct run command for bun", () => {
      const result = detector.detectCommands(
        { scripts: { test: "vitest" } },
        "bun"
      );
      expect(result.test).toBe("bun run test");
    });
  });

  describe("full detection integration", () => {
    test("detects complete TypeScript/SvelteKit project with pnpm", async () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          name: "my-sveltekit-app",
          scripts: {
            test: "vitest",
            lint: "eslint .",
            build: "vite build",
          },
          devDependencies: {
            "@sveltejs/kit": "2.0.0",
            svelte: "4.0.0",
            typescript: "5.0.0",
            vitest: "1.0.0",
            eslint: "8.0.0",
          },
        })
      );
      writeFileSync(join(testDir, "pnpm-lock.yaml"), "");
      writeFileSync(join(testDir, "tsconfig.json"), "{}");

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-sveltekit-app");
      expect(result.project?.language).toBe("typescript");
      expect(result.project?.framework).toBe("sveltekit");
      expect(result.project?.packageManager).toBe("pnpm");
      expect(result.commands?.test).toBe("pnpm test");
      expect(result.commands?.lint).toBe("pnpm lint");
      expect(result.commands?.build).toBe("pnpm build");
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    test("detects JavaScript/Express project with npm", async () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          name: "my-express-api",
          scripts: {
            test: "jest",
          },
          dependencies: {
            express: "4.18.0",
          },
          devDependencies: {
            jest: "29.0.0",
          },
        })
      );

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-express-api");
      expect(result.project?.language).toBe("javascript");
      expect(result.project?.framework).toBe("express");
      expect(result.project?.packageManager).toBe("npm");
      expect(result.commands?.test).toBe("npm run test");
    });

    test("detects Next.js project with bun", async () => {
      writeFileSync(
        join(testDir, "package.json"),
        JSON.stringify({
          name: "my-next-app",
          scripts: {
            build: "next build",
            lint: "next lint",
          },
          dependencies: {
            next: "14.0.0",
            react: "18.0.0",
            "react-dom": "18.0.0",
          },
          devDependencies: {
            typescript: "5.0.0",
          },
        })
      );
      writeFileSync(join(testDir, "bun.lockb"), "");

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-next-app");
      expect(result.project?.language).toBe("typescript");
      expect(result.project?.framework).toBe("next");
      expect(result.project?.packageManager).toBe("bun");
      expect(result.commands?.build).toBe("bun run build");
      expect(result.commands?.lint).toBe("bun run lint");
    });
  });
});
