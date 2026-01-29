// Types
export type {
  Detector,
  DetectedProject,
  DetectedCommands,
  DetectionResult,
  Language,
} from "./types.js";

// Base class
export { BaseDetector } from "./base.js";

// Registry
export { DetectorRegistry, createRegistry } from "./registry.js";

// Detectors
export { NodejsDetector } from "./nodejs.js";
export { PythonDetector } from "./python.js";
export { GoDetector } from "./go.js";
export { RustDetector } from "./rust.js";
