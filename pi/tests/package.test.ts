// [H-C14] Package manifest rules for a pi package published to npm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const HOST_PROVIDED = [
  "@earendil-works/pi-ai",
  "@earendil-works/pi-agent-core",
  "@earendil-works/pi-coding-agent",
  "@earendil-works/pi-tui",
  "typebox",
];

test("[H-C14] Given package.json, Then it is a safe, discoverable pi package", () => {
  assert.equal(pkg.name, "@xentropy/pi");
  assert.equal(pkg.license, "MIT");
  assert.ok(pkg.keywords.includes("pi-package"));
  assert.equal(pkg.engines.node, ">=22.19.0");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/xentropy.ts"]);
  assert.deepEqual(pkg.pi.skills, ["./skills"]);
  assert.equal(pkg.publishConfig.provenance, true);
  assert.ok(Array.isArray(pkg.files) && pkg.files.length > 0, "files allow-list");
  for (const s of ["preinstall", "install", "postinstall", "prepare", "prepublish", "preprepare", "postprepare"]) {
    assert.ok(!(s in (pkg.scripts ?? {})), `no ${s} script`);
  }
  for (const host of HOST_PROVIDED) {
    assert.ok(!(host in (pkg.dependencies ?? {})), `${host} must not be a dependency`);
  }
  assert.equal(pkg.peerDependencies["@earendil-works/pi-coding-agent"], "*");
  assert.ok(pkg.dependencies["@modelcontextprotocol/sdk"]);
  for (const f of ["README.md", "CHANGELOG.md", "LICENSE", "extensions/xentropy.ts", "scripts/sync-skills.mjs"]) {
    assert.ok(existsSync(join(root, f)), `${f} exists`);
  }
});

test("[H-C15] Given skills/, Then each skill folder has a SKILL.md whose name matches the folder", () => {
  const dirs = readdirSync(join(root, "skills"), { withFileTypes: true }).filter((d) => d.isDirectory());
  assert.ok(dirs.length >= 1);
  for (const d of dirs) {
    const text = readFileSync(join(root, "skills", d.name, "SKILL.md"), "utf8");
    const name = /^---\n[\s\S]*?^name:\s*(\S+)\s*$/m.exec(text)?.[1];
    assert.equal(name, d.name);
    assert.match(d.name, /^[a-z0-9-]{1,64}$/);
    assert.match(text, /^description:\s*\S/m);
  }
});
