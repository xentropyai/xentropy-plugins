// Stream D (Hermes). Run: node --test "hermes/test/*.test.mjs" "openclaw/test/*.test.mjs"
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml } from "./yaml-subset.mjs";
import { MCP_URL } from "../../scripts/validate.mjs";
import {
  DOCS_URL,
  SKILLS_ORIGIN,
  insecureUrls,
  uncommentBlock,
  validateHermesManifest,
  validatePluginCatalogEntry,
} from "../check.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const hermes = join(here, "..");
const repo = join(hermes, "..");
const read = (p) => readFileSync(join(hermes, p), "utf8");
const fixture = JSON.parse(readFileSync(join(here, "fixtures/xentropy-tools.json"), "utf8"));
const skillNames = readdirSync(join(repo, "plugins/xentropy/skills"));

/** PyYAML's safe_load, the loader Hermes uses (hermes_yaml), when python3 has it; else undefined. */
function pyYaml(text) {
  const r = spawnSync("python3", ["-I", "-c", "import sys,json,yaml;print(json.dumps(yaml.safe_load(sys.stdin.read())))"], { input: text, encoding: "utf8" });
  return r.status === 0 ? JSON.parse(r.stdout) : undefined;
}
const parseBoth = (text) => {
  const ours = parseYaml(text);
  const py = pyYaml(text);
  if (py !== undefined) assert.deepEqual(ours, py, "subset parser and PyYAML disagree");
  return ours;
};

describe("Hermes optional-mcps manifest (H-D P6)", () => {
  const manifest = () => parseBoth(read("optional-mcps/xentropy/manifest.yaml"));

  it("[H-D1] Given the manifest draft, When parsed as YAML and checked with the upstream catalog rules, Then it is valid", () => {
    assert.deepEqual(validateHermesManifest(manifest(), fixture.tools), []);
  });

  it("[H-D2] Given default_enabled, When compared with the Xentropy tool snapshot, Then every tool exists, none is destructive, and reads plus core writes are on", () => {
    const enabled = manifest().tools.default_enabled;
    for (const name of enabled) assert.ok(fixture.tools[name], `${name} is not a Xentropy tool`);
    assert.equal(new Set(enabled).size, enabled.length, "duplicates");
    for (const name of enabled) assert.equal(fixture.tools[name].destructiveHint, false, `${name} is destructive`);
    for (const core of ["artifacts_list", "artifacts_get", "data_preview", "connections_list", "get_skill", "artifacts_create", "artifacts_update", "artifacts_export", "dashboards_create"])
      assert.ok(enabled.includes(core), `missing core tool ${core}`);
    assert.ok(!enabled.some((n) => n.startsWith("data_plan")), "data plans are feature-gated");
  });

  it("[H-D3] Given every Hermes file, When URLs are listed, Then the endpoint and source are exact and only loopback uses http", () => {
    const m = manifest();
    assert.equal(m.transport.url, MCP_URL);
    assert.equal(m.source, DOCS_URL);
    for (const f of ["optional-mcps/xentropy/manifest.yaml", "plugin-catalog/xentropy.yaml", "config.example.yaml", "README.md", "PR.md"])
      assert.deepEqual(insecureUrls(read(f)), [], f);
  });

  it("[H-D4] Given broken manifests, When checked, Then each upstream rule reports", () => {
    const good = manifest();
    const cases = [
      [{ ...good, manifest_version: 2 }, "manifest_version"],
      [{ ...good, name: "x entropy" }, "name"],
      [{ ...good, description: " " }, "description"],
      [{ ...good, transport: { type: "http" } }, "transport.url"],
      [{ ...good, transport: { type: "sse", url: MCP_URL } }, "transport.type"],
      [{ ...good, auth: { type: "oauth", oauth: { client_secret: "x", foo: 1 } } }, "auth.oauth"],
      [{ ...good, tools: { default_enabled: ["artifacts_list"], default_excluded: ["x"] } }, "mutually exclusive"],
      [{ ...good, tools: { default_enabled: ["artifacts_list", "made_up_tool"] } }, "made_up_tool"],
      [{ ...good, tools: { default_enabled: ["artifacts_delete"] } }, "destructive"],
      [{ ...good, suggest: { keywords: [""] } }, "suggest.keywords"],
      [{ ...good, suggest: {} }, "suggest"],
    ];
    for (const [bad, needle] of cases) {
      const text = validateHermesManifest(bad, fixture.tools).join("\n");
      assert.ok(text.includes(needle), `missing "${needle}" in: ${text}`);
    }
  });
});

describe("Hermes config example (H-D P6)", () => {
  const text = () => read("config.example.yaml");

  it("[H-D5] Given the OAuth variant, When parsed, Then mcp_servers.xentropy has the url and auth oauth and no headers", () => {
    const server = parseBoth(text()).mcp_servers.xentropy;
    assert.equal(server.url, MCP_URL);
    assert.equal(server.auth, "oauth");
    assert.equal(server.headers, undefined);
  });

  it("[H-D6] Given the commented header variant, When uncommented, Then it sends Bearer ${XENTROPY_API_KEY} with trust untrusted and no literal key", () => {
    const block = uncommentBlock(text(), "header variant");
    const server = parseBoth(block).mcp_servers.xentropy;
    assert.equal(server.url, MCP_URL);
    assert.equal(server.headers.Authorization, "Bearer ${XENTROPY_API_KEY}");
    assert.equal(server.trust, "untrusted");
    assert.equal(server.auth, undefined);
    assert.doesNotMatch(text(), /xak_(?!EXAMPLE)[A-Za-z0-9]/);
  });
});

describe("Hermes README and PR (H-D P6)", () => {
  it("[H-D7] Given the README, When read, Then it covers login, the well-known index on the web origin and the tap layout", () => {
    const readme = read("README.md");
    assert.match(readme, /hermes mcp login xentropy/);
    assert.ok(readme.includes(`${SKILLS_ORIGIN}/.well-known/skills/index.json`));
    const installs = [...readme.matchAll(/well-known:(https:\/\/\S+?)(?=[`\s)])/g)].map((m) => m[1]);
    assert.ok(installs.length > 0, "no well-known install example");
    for (const url of installs) {
      assert.ok(url.startsWith(`${SKILLS_ORIGIN}/.well-known/skills/`), `Hermes needs /.well-known/skills/ in the identifier: ${url}`);
      assert.ok(skillNames.includes(url.split("/").pop()), `unknown skill in ${url}`);
    }
    assert.match(readme, /tap add xentropyai\/xentropy-plugins/);
    assert.match(readme, /`skills\/`/);
  });

  it("[H-D8] Given PR.md, When read, Then it has a conventional title, the catalog-closed warning and owner steps", () => {
    const pr = read("PR.md");
    assert.match(pr, /feat\(optional-mcps\): add Xentropy/);
    assert.match(pr, /takes no new entries/);
    assert.match(pr, /plugin-catalog\/xentropy\.yaml/);
    assert.match(pr, /## Owner steps/);
  });

  it("[H-D9] Given the plugin-catalog draft, When parsed, Then it points at the portable package and pins nothing yet", () => {
    const entry = parseBoth(read("plugin-catalog/xentropy.yaml"));
    assert.deepEqual(validatePluginCatalogEntry(entry, repo), []);
    const bad = validatePluginCatalogEntry({ ...entry, sha: "main", subdir: "../x", tier: "verified" }, repo).join("\n");
    for (const needle of ["sha", "subdir", "tier"]) assert.ok(bad.includes(needle), `missing ${needle}: ${bad}`);
    assert.ok(existsSync(join(repo, entry.subdir, "plugin.json")));
  });
});
