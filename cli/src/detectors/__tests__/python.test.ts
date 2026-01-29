import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PythonDetector } from "../python.js";

describe("PythonDetector", () => {
  let testDir: string;
  let detector: PythonDetector;

  beforeEach(() => {
    testDir = join(tmpdir(), `python-detector-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    detector = new PythonDetector();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("canDetect", () => {
    test("returns true when pyproject.toml exists", async () => {
      writeFileSync(join(testDir, "pyproject.toml"), "[project]\nname = 'test'");
      expect(await detector.canDetect(testDir)).toBe(true);
    });

    test("returns true when setup.py exists", async () => {
      writeFileSync(join(testDir, "setup.py"), "from setuptools import setup\nsetup(name='test')");
      expect(await detector.canDetect(testDir)).toBe(true);
    });

    test("returns true when requirements.txt exists", async () => {
      writeFileSync(join(testDir, "requirements.txt"), "flask>=2.0");
      expect(await detector.canDetect(testDir)).toBe(true);
    });

    test("returns false when no Python files exist", async () => {
      expect(await detector.canDetect(testDir)).toBe(false);
    });
  });

  describe("detect", () => {
    test("returns not detected when no Python files exist", async () => {
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    test("detects basic project from pyproject.toml", async () => {
      writeFileSync(
        join(testDir, "pyproject.toml"),
        `[project]
name = "my-python-app"
`
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-python-app");
      expect(result.project?.language).toBe("python");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    test("detects project from setup.py", async () => {
      writeFileSync(
        join(testDir, "setup.py"),
        `from setuptools import setup
setup(
    name='my-legacy-app',
    packages=['myapp'],
)
`
      );
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-legacy-app");
      expect(result.project?.language).toBe("python");
    });

    test("detects project from requirements.txt only", async () => {
      writeFileSync(join(testDir, "requirements.txt"), "flask>=2.0\nrequests\n");
      const result = await detector.detect(testDir);
      expect(result.detected).toBe(true);
      expect(result.project?.language).toBe("python");
      expect(result.project?.framework).toBe("flask");
    });

    test("uses unnamed-project when name is missing", async () => {
      writeFileSync(join(testDir, "pyproject.toml"), "[project]\n");
      const result = await detector.detect(testDir);
      expect(result.project?.name).toBe("unnamed-project");
    });
  });

  describe("detectPackageManager", () => {
    test("detects poetry from pyproject.toml", () => {
      writeFileSync(join(testDir, "pyproject.toml"), "[tool.poetry]\nname = 'test'");
      const pyproject = { tool: { poetry: { name: "test" } } };
      expect(detector.detectPackageManager(testDir, pyproject)).toBe("poetry");
    });

    test("detects poetry from build-backend", () => {
      const pyproject = {
        "build-system": { "build-backend": "poetry.core.masonry.api" },
      };
      expect(detector.detectPackageManager(testDir, pyproject)).toBe("poetry");
    });

    test("detects uv from uv.lock", () => {
      writeFileSync(join(testDir, "uv.lock"), "");
      expect(detector.detectPackageManager(testDir, {})).toBe("uv");
    });

    test("detects pipenv from Pipfile", () => {
      writeFileSync(join(testDir, "Pipfile"), "");
      expect(detector.detectPackageManager(testDir, {})).toBe("pipenv");
    });

    test("detects conda from environment.yml", () => {
      writeFileSync(join(testDir, "environment.yml"), "");
      expect(detector.detectPackageManager(testDir, {})).toBe("conda");
    });

    test("detects conda from environment.yaml", () => {
      writeFileSync(join(testDir, "environment.yaml"), "");
      expect(detector.detectPackageManager(testDir, {})).toBe("conda");
    });

    test("defaults to pip when no package manager files", () => {
      expect(detector.detectPackageManager(testDir, {})).toBe("pip");
    });
  });

  describe("detectFramework", () => {
    test("detects FastAPI", () => {
      const result = detector.detectFramework(["fastapi", "uvicorn"]);
      expect(result?.name).toBe("fastapi");
    });

    test("detects Django", () => {
      const result = detector.detectFramework(["django"]);
      expect(result?.name).toBe("django");
    });

    test("detects Flask", () => {
      const result = detector.detectFramework(["flask"]);
      expect(result?.name).toBe("flask");
    });

    test("detects Starlette", () => {
      const result = detector.detectFramework(["starlette"]);
      expect(result?.name).toBe("starlette");
    });

    test("detects Tornado", () => {
      const result = detector.detectFramework(["tornado"]);
      expect(result?.name).toBe("tornado");
    });

    test("detects aiohttp", () => {
      const result = detector.detectFramework(["aiohttp"]);
      expect(result?.name).toBe("aiohttp");
    });

    test("detects Pyramid", () => {
      const result = detector.detectFramework(["pyramid"]);
      expect(result?.name).toBe("pyramid");
    });

    test("detects Sanic", () => {
      const result = detector.detectFramework(["sanic"]);
      expect(result?.name).toBe("sanic");
    });

    test("returns null when no framework detected", () => {
      const result = detector.detectFramework(["requests", "numpy"]);
      expect(result).toBeNull();
    });

    test("prioritizes FastAPI over Starlette", () => {
      const result = detector.detectFramework(["fastapi", "starlette"]);
      expect(result?.name).toBe("fastapi");
    });
  });

  describe("detectCommands", () => {
    test("detects pytest from dependencies", () => {
      const result = detector.detectCommands(["pytest"], {}, "pip");
      expect(result.test).toBe("pytest");
    });

    test("detects pytest from pyproject.toml tool config", () => {
      const pyproject = { tool: { pytest: {} } };
      const result = detector.detectCommands([], pyproject, "pip");
      expect(result.test).toBe("pytest");
    });

    test("detects unittest when pytest not present", () => {
      const result = detector.detectCommands(["unittest"], {}, "pip");
      expect(result.test).toBe("python -m unittest discover");
    });

    test("detects ruff linter", () => {
      const result = detector.detectCommands(["ruff"], {}, "pip");
      expect(result.lint).toBe("ruff check .");
    });

    test("detects ruff from pyproject.toml tool config", () => {
      const pyproject = { tool: { ruff: {} } };
      const result = detector.detectCommands([], pyproject, "pip");
      expect(result.lint).toBe("ruff check .");
    });

    test("detects black linter", () => {
      const result = detector.detectCommands(["black"], {}, "pip");
      expect(result.lint).toBe("black --check .");
    });

    test("detects flake8 linter", () => {
      const result = detector.detectCommands(["flake8"], {}, "pip");
      expect(result.lint).toBe("flake8");
    });

    test("uses poetry run prefix", () => {
      const result = detector.detectCommands(["pytest", "ruff"], {}, "poetry");
      expect(result.test).toBe("poetry run pytest");
      expect(result.lint).toBe("poetry run ruff check .");
    });

    test("uses pipenv run prefix", () => {
      const result = detector.detectCommands(["pytest"], {}, "pipenv");
      expect(result.test).toBe("pipenv run pytest");
    });

    test("uses uv run prefix", () => {
      const result = detector.detectCommands(["pytest"], {}, "uv");
      expect(result.test).toBe("uv run pytest");
    });

    test("uses conda run prefix", () => {
      const result = detector.detectCommands(["pytest"], {}, "conda");
      expect(result.test).toBe("conda run pytest");
    });
  });

  describe("full detection integration", () => {
    test("detects complete FastAPI project with poetry", async () => {
      writeFileSync(
        join(testDir, "pyproject.toml"),
        `[tool.poetry]
name = "my-fastapi-app"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.100.0"
uvicorn = "^0.22.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0.0"
ruff = "^0.1.0"

[tool.pytest]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
`
      );
      writeFileSync(join(testDir, "poetry.lock"), "");

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-fastapi-app");
      expect(result.project?.language).toBe("python");
      expect(result.project?.framework).toBe("fastapi");
      expect(result.project?.packageManager).toBe("poetry");
      expect(result.commands?.test).toBe("poetry run pytest");
      expect(result.commands?.lint).toBe("poetry run ruff check .");
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    test("detects Django project with pip", async () => {
      writeFileSync(
        join(testDir, "pyproject.toml"),
        `[project]
name = "my-django-app"
dependencies = [
    "django>=4.0",
    "psycopg2-binary",
]

[project.optional-dependencies]
dev = [
    "pytest",
    "flake8",
]
`
      );

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("my-django-app");
      expect(result.project?.language).toBe("python");
      expect(result.project?.framework).toBe("django");
      expect(result.project?.packageManager).toBe("pip");
    });

    test("detects Flask project from requirements.txt", async () => {
      writeFileSync(
        join(testDir, "requirements.txt"),
        `flask>=2.0
gunicorn
pytest
ruff
`
      );

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.language).toBe("python");
      expect(result.project?.framework).toBe("flask");
      expect(result.project?.packageManager).toBe("pip");
      expect(result.commands?.test).toBe("pytest");
      expect(result.commands?.lint).toBe("ruff check .");
    });

    test("detects legacy setup.py project with requirements.txt", async () => {
      writeFileSync(
        join(testDir, "setup.py"),
        `from setuptools import setup

setup(
    name='legacy-flask-app',
    version='1.0.0',
    packages=['myapp'],
    install_requires=[
        'flask',
    ],
)
`
      );
      writeFileSync(
        join(testDir, "requirements.txt"),
        `flask>=1.0
pytest
black
`
      );

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.name).toBe("legacy-flask-app");
      expect(result.project?.framework).toBe("flask");
      expect(result.commands?.test).toBe("pytest");
      expect(result.commands?.lint).toBe("black --check .");
    });

    test("detects uv-managed project", async () => {
      writeFileSync(
        join(testDir, "pyproject.toml"),
        `[project]
name = "my-uv-app"
dependencies = ["fastapi"]
`
      );
      writeFileSync(join(testDir, "uv.lock"), "");

      const result = await detector.detect(testDir);

      expect(result.detected).toBe(true);
      expect(result.project?.packageManager).toBe("uv");
    });
  });

  describe("requirements.txt parsing", () => {
    test("parses simple requirements", async () => {
      writeFileSync(
        join(testDir, "requirements.txt"),
        `flask
requests>=2.0
`
      );

      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("flask");
    });

    test("ignores comments and empty lines", async () => {
      writeFileSync(
        join(testDir, "requirements.txt"),
        `# This is a comment
flask

# Another comment
pytest
`
      );

      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("flask");
      expect(result.commands?.test).toBe("pytest");
    });

    test("ignores -r includes", async () => {
      writeFileSync(
        join(testDir, "requirements.txt"),
        `-r base.txt
flask
`
      );

      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("flask");
    });

    test("handles version specifiers correctly", async () => {
      writeFileSync(
        join(testDir, "requirements.txt"),
        `fastapi>=0.100.0,<1.0.0
django[async]~=4.0
pytest>7.0
`
      );

      const result = await detector.detect(testDir);
      expect(result.project?.framework).toBe("fastapi");
    });
  });
});
