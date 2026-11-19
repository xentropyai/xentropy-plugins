// Copy accuracy guard (web-copy plan R1-5). Public copy in this repo must not claim what the
// product does not do: Google Analytics is coming soon (not an available source), sources are not
// "all read-only", there is no "REST" claim, no MP4/Motion export, and Cursor / VS Code are never
// named as clients (owner decision D-17). Plugin metadata descriptions carry the category line.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "evidence"]);
const TEXT = /\.(md|mdx|json|ya?ml|mjs|js|ts|txt|example|feature|toml)$/;
const SELF = join("test", "copy.test.mjs");
// Skill files generated from the Xentropy monorepo corpus (sync-skills / build-skill). Their
// technical wording ("REST JSON" legacy connection type) is owned upstream.
const GENERATED = [["skills"], ["plugins", "xentropy", "skills"], ["pi", "skills"], ["openclaw", "skills"]].map(
  (p) => p.join(sep) + sep,
);
const isGenerated = (rel) => GENERATED.some((p) => rel.startsWith(p));
const isGaSkill = (rel) => rel.split(sep).includes("xentropy-google-analytics");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (TEXT.test(name) || name === "LICENSE") out.push(relative(root, full));
  }
  return out;
}
const files = walk(root).filter((f) => f !== SELF);
const lines = files.flatMap((file) =>
  readFileSync(join(root, file), "utf8")
    .split("\n")
    .map((text, i) => ({ file, line: i + 1, text })),
);
const hits = (re, filter = () => true) =>
  lines.filter((l) => filter(l.file) && re.test(l.text)).map((l) => `${l.file}:${l.line}: ${l.text.trim()}`);

const CATEGORY = "Xentropy is the analytics workspace for AI agents.";

describe("copy accuracy (web-copy R1-5)", () => {
  it("no file outside the Google Analytics skill lists Google Analytics as an available source", () => {
    const bad = lines
      .filter((l) => !isGaSkill(l.file) && /Google Analytics/.test(l.text) && !/coming soon/i.test(l.text))
      .map((l) => `${l.file}:${l.line}: ${l.text.trim()}`);
    assert.deepEqual(bad, []);
  });

  it("the Google Analytics skill description says it is coming soon", () => {
    const skills = files.filter((f) => isGaSkill(f) && f.endsWith("SKILL.md"));
    assert.ok(skills.length >= 2, "expected the GA skill in skills/ and plugins/xentropy/skills/");
    for (const f of skills) {
      const desc = readFileSync(join(root, f), "utf8").match(/^description:\s*(.+)$/m)?.[1] ?? "";
      assert.match(desc, /coming soon/, `${f}: description must say "coming soon"`);
    }
  });

  it('hand-written files never say "every source is read-only"', () => {
    assert.deepEqual(hits(/every source is read-only/i, (f) => !isGenerated(f)), []);
  });

  it(
    'generated skills never say "every source is read-only"',
    { todo: "upstream: xentropy-connections skill in the monorepo packages/skills still says it; fix there, then sync" },
    () => {
      assert.deepEqual(hits(/every source is read-only/i, isGenerated), []);
    },
  );

  it('hand-written files make no "REST" claim', () => {
    assert.deepEqual(hits(/\bREST\b/, (f) => !isGenerated(f)), []);
  });

  it("no file names Cursor or VS Code as a client (case-sensitive; nextCursor is fine)", () => {
    assert.deepEqual(hits(/\bCursor\b|\bVS ?Code\b|Visual Studio Code/), []);
  });

  it("no file claims MP4 or Motion export", () => {
    assert.deepEqual(hits(/\bMP4\b|\bMotion\b/), []);
  });

  it("plugin metadata descriptions start with the category line", () => {
    const json = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
    const descs = {
      "plugins/xentropy/plugin.json": json("plugins/xentropy/plugin.json").description,
      "plugins/xentropy/.claude-plugin/plugin.json": json("plugins/xentropy/.claude-plugin/plugin.json").description,
      ".claude-plugin/marketplace.json#plugins[xentropy]": json(".claude-plugin/marketplace.json").plugins.find(
        (p) => p.name === "xentropy",
      ).description,
    };
    const yaml = readFileSync(join(root, "hermes/plugin-catalog/xentropy.yaml"), "utf8");
    const block = yaml.match(/^description: >-\n((?: {2}.*\n)+)/m)?.[1] ?? "";
    descs["hermes/plugin-catalog/xentropy.yaml"] = block.split("\n").map((s) => s.trim()).join(" ").trim();
    for (const [where, d] of Object.entries(descs)) assert.ok(String(d).startsWith(CATEGORY), `${where}: ${d}`);
  });
});
