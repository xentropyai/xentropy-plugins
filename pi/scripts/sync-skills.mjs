#!/usr/bin/env node
// Stub: copies generated Xentropy skills into pi/skills/.
//
// Usage: node scripts/sync-skills.mjs <source-dir>
//
// <source-dir> holds one folder per skill, each with a SKILL.md (for example the
// output of the plugins repo skill generator, owned by the skills stream). Each
// skill is copied as skills/xentropy-<name>/ unless its name already starts with
// "xentropy-", and the frontmatter `name:` is rewritten to match the folder.
//
// This is a placeholder until the skills stream lands its generator; it only
// copies Markdown files and never runs code from the source.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = process.argv[2];
if (!source) {
  console.error("usage: node scripts/sync-skills.mjs <source-dir>");
  process.exit(2);
}
const src = resolve(source);
if (!existsSync(src) || !statSync(src).isDirectory()) {
  console.error(`not a directory: ${src}`);
  process.exit(2);
}

const target = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");
let count = 0;
for (const entry of readdirSync(src, { withFileTypes: true })) {
  if (!entry.isDirectory() || !existsSync(join(src, entry.name, "SKILL.md"))) continue;
  const name = entry.name.startsWith("xentropy-") ? entry.name : `xentropy-${entry.name}`;
  const out = join(target, name);
  rmSync(out, { recursive: true, force: true });
  cpSync(join(src, entry.name), out, { recursive: true, filter: (p) => statSync(p).isDirectory() || p.endsWith(".md") });
  const skillPath = join(out, "SKILL.md");
  writeFileSync(skillPath, readFileSync(skillPath, "utf8").replace(/^name:\s*\S+\s*$/m, `name: ${name}`));
  count++;
}
console.log(`synced ${count} skill(s) into ${target}`);
