#!/usr/bin/env node
// Regenerates plugins/xentropy/skills from the Xentropy monorepo skills corpus.
// Usage: node scripts/sync-skills.mjs <path-to-monorepo> [--check]
// Runs the monorepo exporter (packages/skills/scripts/export-skill-md.ts, needs its node_modules)
// with --out pointing here. --check fails without writing when the committed skills are stale.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const monorepo = args.find((a) => !a.startsWith("--"));
if (!monorepo) {
  console.error("usage: node scripts/sync-skills.mjs <path-to-monorepo> [--check]");
  process.exit(2);
}
const root = resolve(monorepo);
const exporter = join(root, "packages/skills/scripts/export-skill-md.ts");
if (!existsSync(exporter)) {
  console.error(`${exporter} not found: is ${root} the Xentropy monorepo?`);
  process.exit(2);
}
const out = join(dirname(fileURLToPath(import.meta.url)), "../plugins/xentropy/skills");
const result = spawnSync(
  process.execPath,
  ["--import", "tsx", exporter, "--out", out, ...(args.includes("--check") ? ["--check"] : [])],
  { cwd: join(root, "packages/skills"), stdio: "inherit" },
);
if (result.status !== 0 || args.includes("--check")) process.exit(result.status ?? 1);
// Hermes taps read skills/ at the repository root; keep an identical mirror (test/root-layout.test.mjs).
const mirror = join(dirname(fileURLToPath(import.meta.url)), "../skills");
rmSync(mirror, { recursive: true, force: true });
cpSync(out, mirror, { recursive: true });
