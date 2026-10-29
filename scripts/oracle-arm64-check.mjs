#!/usr/bin/env node
/**
 * Static ARM64 lockfile check, then native smoke test on Linux ARM64.
 * Passing is necessary, not sufficient, for production ERP readiness.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const metadataOnly = process.argv.includes("--metadata-only");
if (process.argv.some((arg, i) => i > 1 && arg !== "--metadata-only")) {
  console.error("Usage: node scripts/oracle-arm64-check.mjs [--metadata-only]");
  process.exit(2);
}
const nodeVersion = readFileSync(".node-version", "utf8").trim();
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const required = [
  "node_modules/@napi-rs/canvas-linux-arm64-gnu",
  "node_modules/esbuild/node_modules/@esbuild/linux-arm64",
  "node_modules/@rolldown/binding-linux-arm64-gnu",
  "node_modules/lightningcss-linux-arm64-gnu",
  "node_modules/@tailwindcss/oxide-linux-arm64-gnu",
];
const missing = required.filter((name) => !lock.packages[name]);
if (missing.length) {
  console.error("Missing ARM64 GNU/Linux lockfile entries: " + missing.join(", "));
  process.exit(1);
}
console.log("OK: ARM64 GNU/Linux native packages are recorded in the lockfile.");
if (metadataOnly) {
  console.log("Metadata-only mode: native ARM64 runtime was not executed.");
  process.exit(0);
}
if (process.platform !== "linux" || process.arch !== "arm64") {
  console.error("Native test requires Linux ARM64; actual: " +
    process.platform + "/" + process.arch);
  process.exit(1);
}
if (process.version !== "v" + nodeVersion) {
  console.error("Use pinned Node.js " + nodeVersion + "; found " + process.version);
  process.exit(1);
}
try {
  const { createCanvas } = require("@napi-rs/canvas");
  const canvas = createCanvas(2, 2);
  canvas.getContext("2d").fillRect(0, 0, 2, 2);
  if (canvas.toBuffer("image/png").length === 0) {
    throw new Error("Canvas encoder returned an empty PNG");
  }
  const esbuild = require("esbuild");
  const result = esbuild.transformSync("const value: number = 1;", { loader: "ts" });
  if (!result.code.includes("value")) {
    throw new Error("esbuild failed to transform TypeScript");
  }
  console.log("OK: pinned Node.js, canvas native addon, and esbuild work on Linux ARM64.");
} catch (error) {
  console.error("Linux ARM64 native smoke test failed:", error);
  process.exitCode = 1;
}
