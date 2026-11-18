// Root-level layout for harnesses that read the repository root (agent harnesses, 2026-11-18).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test("[H-R1] Given a Hermes tap on this repo, when it reads skills/ at the root, then the root mirror equals plugins/xentropy/skills byte for byte", () => {
  const source = join(root, "plugins/xentropy/skills");
  const mirror = join(root, "skills");
  assert.ok(existsSync(mirror), "root skills/ is missing");
  const a = files(source).map((p) => relative(source, p)).sort();
  const b = files(mirror).map((p) => relative(mirror, p)).sort();
  assert.deepEqual(b, a);
  for (const rel of a)
    assert.equal(readFileSync(join(mirror, rel), "utf8"), readFileSync(join(source, rel), "utf8"), rel);
});

test("[H-R2] Given `pi install git:github.com/xentropyai/xentropy-plugins`, when pi reads the root package.json, then it finds the pi extension and skills under pi/", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.workspaces, ["pi"]);
  assert.deepEqual(pkg.pi, { extensions: ["./pi/extensions/xentropy.ts"], skills: ["./pi/skills"] });
  for (const p of [...pkg.pi.extensions, ...pkg.pi.skills]) assert.ok(existsSync(join(root, p)), p);
  assert.equal(pkg.scripts?.postinstall, undefined, "no install scripts");
});

test("[H-R3] Given the repo test script, when CI runs it, then the Hermes and OpenClaw suites run too", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const glob of ["test/*.test.mjs", "hermes/test/*.test.mjs", "openclaw/test/*.test.mjs"])
    assert.ok(pkg.scripts.test.includes(glob), glob);
  const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
  assert.match(ci, /npm test/);
});
