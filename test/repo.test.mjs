import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRepo, validateSkills } from "../scripts/validate.mjs";
import { buildOpenAiZip, includeInOpenAiZip, openAiZipEntries, zipEntryNames } from "../scripts/build-openai-zip.mjs";

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(repo, "plugins/xentropy");
const scratch = () => mkdtempSync(join(tmpdir(), "xentropy-plugins-"));

describe("xentropy-plugins repo (H-B P3/P4)", () => {
  it("[H-B20] Given the repo, When validated, Then every manifest and skill passes", () => {
    assert.deepEqual(validateRepo(repo), []);
  });

  it("[H-B21] Given broken manifests, When validated, Then each rule reports", () => {
    const dir = scratch();
    try {
      cpSync(repo, dir, { recursive: true, filter: (src) => !src.includes(`${repo}/.git`) && !src.includes("/dist") });
      const p = join(dir, "plugins/xentropy");
      writeFileSync(join(p, ".mcp.json"), JSON.stringify({ mcpServers: { xentropy: { url: "https://api.xentropy.ai/mcp", headers: { Authorization: "Bearer ${user_config.api_key}" } } } }));
      const mcp = JSON.parse(readFileSync(join(p, "mcp.json"), "utf8"));
      mcp.mcpServers.xentropy.extensions["com.openai"].auth.client.mode = "dcr";
      writeFileSync(join(p, "mcp.json"), JSON.stringify(mcp));
      mkdirSync(join(p, "hooks"));
      writeFileSync(join(p, "hooks/hooks.json"), "{}");
      writeFileSync(join(p, "notes.txt"), "key " + "xak_" + "live1234abcd5678");
      const text = validateRepo(dir).join("\n");
      for (const needle of [
        '.mcp.json: type must be "http"',
        ".mcp.json: no headers",
        ".mcp.json: ${user_config}",
        "mcp.json: com.openai auth must be oauth with client mode cimd",
        "plugins/xentropy/hooks: not allowed",
        "notes.txt: looks like a credential",
      ])
        assert.ok(text.includes(needle), `missing: ${needle}\n${text}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("[H-B22] Given bad skills, When validated, Then the agentskills rules fail", () => {
    const dir = scratch();
    try {
      const write = (folder, fm, body = "# X\n") => {
        mkdirSync(join(dir, folder), { recursive: true });
        writeFileSync(join(dir, folder, "SKILL.md"), `---\n${fm}\n---\n\n${body}`);
      };
      const meta = 'license: MIT\nmetadata: {"hermes":{"requires_toolsets":["mcp-xentropy"]}}';
      write("Upper", `name: Upper\ndescription: "Does x. Use when y."\n${meta}`);
      write("xentropy-claude-x", `name: xentropy-claude-x\ndescription: "Does x."\n${meta}`);
      write("xentropy-shell", `name: xentropy-shell\ndescription: "Does x."\n${meta}`, "```bash\nnpm i\n```\n");
      write("xentropy-env", `name: xentropy-env\ndescription: "Does x."\nlicense: MIT\nmetadata: {"hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"requires":{"env":["XENTROPY_API_KEY"]}}}`);
      mkdirSync(join(dir, "xentropy-script/scripts"), { recursive: true });
      write("xentropy-script", `name: xentropy-script\ndescription: "Does x."\n${meta}`);
      writeFileSync(join(dir, "xentropy-script/scripts/run.sh"), "echo hi\n");
      const text = validateSkills(dir).join("\n");
      for (const needle of [
        "Upper: name must be lowercase",
        'xentropy-claude-x: name must not contain "claude"',
        "xentropy-shell: shell code block",
        "xentropy-env: metadata.openclaw.requires.env",
        "xentropy-script: unexpected file scripts/run.sh",
      ])
        assert.ok(text.includes(needle), `missing: ${needle}\n${text}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("[H-B23] Given the plugin folder, When the OpenAI zip is built, Then it holds the portable manifests and skills but no Claude dotfiles, hooks or .app.json", () => {
    const dir = scratch();
    try {
      const out = join(dir, "xentropy-openai.zip");
      const entries = buildOpenAiZip(plugin, out);
      const names = zipEntryNames(readFileSync(out));
      assert.deepEqual(names, entries);
      for (const required of ["plugin.json", "mcp.json", "agents/openai.yaml", "assets/icon.png", "skills/xentropy-artifacts/SKILL.md"])
        assert.ok(names.includes(required), required);
      for (const name of names) {
        assert.ok(!name.split("/").some((p) => p.startsWith(".")), name);
        assert.ok(!name.startsWith("hooks/") && !name.endsWith(".app.json"), name);
      }
      const again = join(dir, "again.zip");
      buildOpenAiZip(plugin, again);
      assert.ok(readFileSync(out).equals(readFileSync(again)), "zip is deterministic");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("[H-B24] Given excluded paths, When filtered, Then hooks, .app.json and dotfiles are dropped", () => {
    for (const p of ["hooks/hooks.json", ".app.json", ".mcp.json", ".claude-plugin/plugin.json", "skills/.DS_Store", "bin/x"])
      assert.equal(includeInOpenAiZip(p), false, p);
    for (const p of ["plugin.json", "mcp.json", "commands/chart.md", "skills/xentropy-artifacts/SKILL.md"])
      assert.equal(includeInOpenAiZip(p), true, p);
    assert.ok(openAiZipEntries(plugin).length > 5);
  });
});
