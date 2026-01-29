import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { RustDetector } from "../rust.js";

describe("RustDetector", () => {
  let testDir: string;
  let detector: RustDetector;

  beforeEach(() => {
    testDir = join(tmpdir(), `rust-detector-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    detector = new RustDetector();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("canDetect", () => {
    test("returns true when Cargo.toml exists", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      expect(await detector.canDetect(testDir)).toBe(true);
    });

    test("returns false when Cargo.toml does not exist", async () => {
      expect(await detector.canDetect(testDir)).toBe(false);
    });

    test("returns false for empty directory", async () => {
      expect(await detector.canDetect(testDir)).toBe(false);
    });
  });

  describe("detect", () => {
    test("returns not detected when Cargo.toml is missing", async () => {
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("detects basic project from Cargo.toml", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"
version = "0.1.0"
edition = "2021"
`
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("myapp");
      expect(result.project?.language).toBe("rust");
      expect(result.project?.packageManager).toBe("cargo");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    test("uses unnamed-project when name is missing", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
version = "0.1.0"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.name).toBe("unnamed-project");
    });

    test("parses edition", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"
edition = "2021"
`
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      // Edition increases confidence
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe("Cargo.toml parsing", () => {
    test("parses simple dependencies", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
serde = "1.0"
tokio = "1.0"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("tokio");
    });

    test("parses inline table dependencies", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
actix-web = { version = "4.0", features = ["openssl"] }
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("actix");
    });

    test("parses dev-dependencies", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dev-dependencies]
tokio-test = "0.4"
axum = "0.6"
`
      );
      const result = await detector.detect(testDir);
      // axum from dev-dependencies should be detected
      expect(result.project?.framework).toBe("axum");
    });

    test("handles underscore in dev_dependencies", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dev_dependencies]
rocket = "0.5"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("rocket");
    });

    test("ignores comments", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"
# This is a comment

[dependencies]
# Another comment
warp = "0.3"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("warp");
    });
  });

  describe("detectFramework", () => {
    test("detects Actix framework", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
actix-web = "4.0"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("actix");
    });

    test("detects Actix from actix-rt", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
actix-rt = "2.0"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("actix");
    });

    test("detects Axum framework", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
axum = "0.6"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("axum");
    });

    test("detects Rocket framework", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
rocket = "0.5"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("rocket");
    });

    test("detects Warp framework", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
warp = "0.3"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("warp");
    });

    test("detects Tide framework", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
tide = "0.16"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("tide");
    });

    test("detects Hyper framework", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
hyper = "0.14"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("hyper");
    });

    test("detects Tokio runtime", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
tokio = "1.0"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("tokio");
    });

    test("returns null when no framework is detected", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
serde = "1.0"
`
      );
      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBeUndefined();
    });

    test("framework detection respects priority (actix before tokio)", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
tokio = "1.0"
actix-web = "4.0"
`
      );
      const result = await detector.detect(testDir);
      // Actix has higher priority than Tokio
      expect(result.project?.framework).toBe("actix");
    });

    test("framework detection respects priority (axum before hyper)", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "myapp"

[dependencies]
hyper = "0.14"
axum = "0.6"
`
      );
      const result = await detector.detect(testDir);
      // Axum has higher priority than Hyper
      expect(result.project?.framework).toBe("axum");
    });
  });

  describe("detectCommands", () => {
    test("always includes cargo test command", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      const result = await detector.detect(testDir);
      expect(result.commands?.test).toBe("cargo test");
    });

    test("always includes cargo build command", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      const result = await detector.detect(testDir);
      expect(result.commands?.build).toBe("cargo build");
    });

    test("detects clippy from .clippy.toml", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      writeFileSync(
        join(testDir, ".clippy.toml"),
        "cognitive-complexity-threshold = 30\n"
      );
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("cargo clippy");
    });

    test("detects clippy from clippy.toml", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      writeFileSync(join(testDir, "clippy.toml"), "msrv = '1.60'\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("cargo clippy");
    });

    test("includes fmt check when rustfmt.toml exists", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      writeFileSync(join(testDir, "rustfmt.toml"), "max_width = 100\n");
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("cargo clippy && cargo fmt --check");
    });

    test("defaults to cargo clippy for projects without config", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        '[package]\nname = "myapp"\n'
      );
      const result = await detector.detect(testDir);
      expect(result.commands?.lint).toBe("cargo clippy");
    });
  });

  describe("integration tests", () => {
    test("full Actix web API project", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "actix-api"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4.4"
actix-rt = "2.9"
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1.0", features = ["full"] }

[dev-dependencies]
actix-web = { version = "4.4", features = ["test"] }
`
      );
      writeFileSync(join(testDir, ".clippy.toml"), "");

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("actix-api");
      expect(result.project?.language).toBe("rust");
      expect(result.project?.framework).toBe("actix");
      expect(result.project?.packageManager).toBe("cargo");
      expect(result.commands?.test).toBe("cargo test");
      expect(result.commands?.lint).toBe("cargo clippy");
      expect(result.commands?.build).toBe("cargo build");
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    test("full Axum web service project", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "axum-service"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.6"
tokio = { version = "1.0", features = ["full"] }
tower = "0.4"
`
      );

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("axum-service");
      expect(result.project?.language).toBe("rust");
      expect(result.project?.framework).toBe("axum");
      expect(result.commands?.test).toBe("cargo test");
      expect(result.commands?.build).toBe("cargo build");
    });

    test("full Rocket web application project", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "rocket-app"
version = "0.1.0"
edition = "2021"

[dependencies]
rocket = "0.5"
serde = "1.0"
`
      );
      writeFileSync(join(testDir, "rustfmt.toml"), "max_width = 120\n");

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("rocket-app");
      expect(result.project?.framework).toBe("rocket");
      expect(result.commands?.lint).toBe("cargo clippy && cargo fmt --check");
    });

    test("minimal Rust project (no framework)", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "mycli"
version = "0.1.0"
edition = "2021"

[dependencies]
clap = "4.0"
`
      );

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("mycli");
      expect(result.project?.language).toBe("rust");
      expect(result.project?.framework).toBeUndefined();
      expect(result.commands?.test).toBe("cargo test");
      expect(result.commands?.build).toBe("cargo build");
      expect(result.commands?.lint).toBe("cargo clippy");
    });

    test("library project with multiple dependencies", async () => {
      writeFileSync(
        join(testDir, "Cargo.toml"),
        `[package]
name = "rust-utils"
version = "0.1.0"
edition = "2021"

[dependencies]
serde = { version = "1.0", features = ["derive"] }
thiserror = "1.0"
anyhow = "1.0"

[dev-dependencies]
criterion = "0.5"
proptest = "1.0"
`
      );

      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("rust-utils");
      expect(result.project?.framework).toBeUndefined();
      expect(result.commands?.test).toBe("cargo test");
      expect(result.commands?.lint).toBe("cargo clippy");
    });
  });

  describe("detectFramework method directly", () => {
    test("returns correct framework for actix-web", () => {
      const result = detector.detectFramework(["actix-web"]);
      expect(result?.name).toBe("actix");
      expect(result?.confidence).toBe(0.9);
    });

    test("returns correct framework for axum", () => {
      const result = detector.detectFramework(["axum"]);
      expect(result?.name).toBe("axum");
    });

    test("returns correct framework for rocket", () => {
      const result = detector.detectFramework(["rocket"]);
      expect(result?.name).toBe("rocket");
    });

    test("returns null for no matching framework", () => {
      const result = detector.detectFramework(["serde", "clap"]);
      expect(result).toBeNull();
    });

    test("returns null for empty deps", () => {
      const result = detector.detectFramework([]);
      expect(result).toBeNull();
    });

    test("handles case insensitivity", () => {
      const result = detector.detectFramework(["ACTIX-WEB"]);
      expect(result?.name).toBe("actix");
    });
  });
});
