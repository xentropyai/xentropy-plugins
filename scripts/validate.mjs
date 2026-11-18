#!/usr/bin/env node
// Shape checks for every manifest in this repo and the agentskills.io rules for every skill.
// Usage: node scripts/validate.mjs [repoRoot]   (exit 1 and one line per error on failure)
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MCP_URL = "https://api.xentropy.ai/mcp";
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const SHELL_FENCE = /^```\s*(bash|sh|shell|zsh|console|powershell|ps1|cmd|bat)\b/im;
const PREFIXED_TOOL = /\bmcp__[a-z0-9_-]+|\bmcp_xentropy_[a-z0-9_]+/i;
/** Real-looking credentials; the documented placeholders (xak_EXAMPLE…) are allowed. */
const SECRET = /\b(xak_(?!EXAMPLE)[A-Za-z0-9_-]{8,}|xmo_[A-Za-z0-9_-]{8,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,})/;

const readJson = (file, errors) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${file}: ${existsSync(file) ? "invalid JSON" : "missing"}`);
    return undefined;
  }
};
const isHttps = (v) => typeof v === "string" && /^https:\/\/[^\s]+$/.test(v);

/** Reads the frontmatter the skills exporter writes (scalars and one-line JSON/quoted values). */
export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return { data: undefined, body: text };
  const data = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z][a-z0-9_-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if (/^["{[]/.test(value)) {
      try {
        value = JSON.parse(value);
      } catch {
        /* keep the raw text */
      }
    }
    data[kv[1]] = value;
  }
  return { data, body: text.slice(m[0].length) };
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name === ".git" || e.name === "node_modules" || e.name === "dist"
      ? []
      : e.isDirectory()
        ? walk(join(dir, e.name))
        : [join(dir, e.name)],
  );
}

/** agentskills.io and Xentropy portability rules for one skills directory. */
export function validateSkills(skillsDir) {
  const errors = [];
  if (!existsSync(skillsDir)) return [`${skillsDir}: missing skills directory`];
  const dirs = readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  if (dirs.length === 0) errors.push(`${skillsDir}: no skills`);
  for (const { name: dir } of dirs) {
    const root = join(skillsDir, dir);
    const file = join(root, "SKILL.md");
    if (!existsSync(file)) {
      errors.push(`${dir}: missing SKILL.md`);
      continue;
    }
    const { data, body } = parseFrontmatter(readFileSync(file, "utf8"));
    if (!data) {
      errors.push(`${dir}: no frontmatter`);
      continue;
    }
    const name = String(data.name ?? "");
    const description = String(data.description ?? "");
    if (!NAME.test(name) || name.length > 64) errors.push(`${dir}: name must be lowercase letters, digits and single hyphens, at most 64 characters`);
    if (name !== dir) errors.push(`${dir}: name ${name} does not match folder`);
    if (/claude|anthropic/.test(name)) errors.push(`${dir}: name must not contain "claude" or "anthropic"`);
    if (!description || description.length > 1024) errors.push(`${dir}: description must be 1-1024 characters`);
    if (data.license !== "MIT") errors.push(`${dir}: license must be MIT`);
    const metadata = data.metadata;
    if (typeof metadata !== "object" || metadata === null) errors.push(`${dir}: metadata must be a one-line JSON object`);
    else {
      if (!metadata.hermes?.requires_toolsets?.includes("mcp-xentropy")) errors.push(`${dir}: metadata.hermes.requires_toolsets must include mcp-xentropy`);
      if (metadata.openclaw?.requires?.env) errors.push(`${dir}: metadata.openclaw.requires.env would hide the skill from OAuth users`);
    }
    for (const path of walk(root)) {
      const rel = relative(root, path);
      if (rel !== "SKILL.md" && !/^references\/[a-z0-9-]+\.md$/.test(rel)) errors.push(`${dir}: unexpected file ${rel} (skills ship no scripts)`);
      const text = rel === "SKILL.md" ? body : readFileSync(path, "utf8");
      if (SHELL_FENCE.test(text) || /^\s*\$ /m.test(text)) errors.push(`${dir}: shell code block in ${rel}`);
      if (PREFIXED_TOOL.test(text)) errors.push(`${dir}: harness-prefixed tool name in ${rel}`);
    }
    for (const m of body.matchAll(/\]\((references\/[^)]+)\)/g))
      if (!existsSync(join(root, m[1]))) errors.push(`${dir}: broken link ${m[1]}`);
  }
  return errors;
}

/** Every check for the repo; returns error strings (empty = valid). */
export function validateRepo(repo) {
  const errors = [];
  const pluginDir = join(repo, "plugins/xentropy");

  // Claude Code plugin manifest.
  const claude = readJson(join(pluginDir, ".claude-plugin/plugin.json"), errors);
  if (claude) {
    if (claude.name !== "xentropy") errors.push(".claude-plugin/plugin.json: name must be xentropy");
    if (/^(claude|anthropic)-/.test(claude.name ?? "")) errors.push(".claude-plugin/plugin.json: reserved name prefix");
    if (!SEMVER.test(claude.version ?? "")) errors.push(".claude-plugin/plugin.json: version must be semver");
    for (const key of ["homepage", "documentationUrl", "supportUrl", "privacyPolicyUrl", "termsOfServiceUrl"])
      if (!isHttps(claude[key])) errors.push(`.claude-plugin/plugin.json: ${key} must be an https URL`);
    if (!claude.icon || !existsSync(join(pluginDir, claude.icon))) errors.push(".claude-plugin/plugin.json: icon file missing");
    if (!claude.description) errors.push(".claude-plugin/plugin.json: description missing");
  }

  // Portable (OpenAI / agent-plugins.org) manifest.
  const portable = readJson(join(pluginDir, "plugin.json"), errors);
  if (portable) {
    if (portable.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") errors.push("plugin.json: $schema");
    if (portable.name !== "xentropy") errors.push("plugin.json: name must be xentropy");
    if (claude && portable.version !== claude.version) errors.push("plugin.json: version differs from .claude-plugin/plugin.json");
    if (claude && portable.description !== claude.description) errors.push("plugin.json: description differs from .claude-plugin/plugin.json");
  }

  // Claude Code MCP config: OAuth only (no headers, no user_config, which claude.ai chat ignores).
  const dotMcp = readJson(join(pluginDir, ".mcp.json"), errors);
  const claudeServer = dotMcp?.mcpServers?.xentropy;
  if (dotMcp) {
    if (Object.keys(dotMcp.mcpServers ?? {}).join() !== "xentropy") errors.push(".mcp.json: exactly one server, xentropy");
    if (claudeServer?.type !== "http") errors.push('.mcp.json: type must be "http" (a url-only entry is treated as stdio)');
    if (claudeServer?.url !== MCP_URL) errors.push(`.mcp.json: url must be ${MCP_URL}`);
    if (claudeServer?.headers) errors.push(".mcp.json: no headers in the OAuth bundle");
    if (JSON.stringify(dotMcp).includes("${user_config")) errors.push(".mcp.json: ${user_config} breaks claude.ai chat");
  }

  // OpenAI MCP config.
  const mcp = readJson(join(pluginDir, "mcp.json"), errors);
  const openaiServer = mcp?.mcpServers?.xentropy;
  if (mcp) {
    if (mcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") errors.push("mcp.json: $schema");
    if (openaiServer?.type !== "streamable-http") errors.push('mcp.json: type must be "streamable-http"');
    if (openaiServer?.url !== MCP_URL) errors.push(`mcp.json: url must be ${MCP_URL}`);
    const auth = openaiServer?.extensions?.["com.openai"]?.auth;
    if (auth?.type !== "oauth" || auth?.client?.mode !== "cimd") errors.push("mcp.json: com.openai auth must be oauth with client mode cimd");
    if (openaiServer?.headers) errors.push("mcp.json: no headers (the OpenAI directory accepts OAuth only)");
  }

  // OpenAI display metadata.
  const yamlFile = join(pluginDir, "agents/openai.yaml");
  if (!existsSync(yamlFile)) errors.push("agents/openai.yaml: missing");
  else {
    const yaml = readFileSync(yamlFile, "utf8");
    if (!/^\s+display_name: "Xentropy"$/m.test(yaml)) errors.push("agents/openai.yaml: interface.display_name");
    if (!/^\s+allow_implicit_invocation: (true|false)$/m.test(yaml)) errors.push("agents/openai.yaml: policy.allow_implicit_invocation");
    for (const m of yaml.matchAll(/icon_\w+: "(\.\/[^"]+)"/g))
      if (!existsSync(join(pluginDir, m[1]))) errors.push(`agents/openai.yaml: ${m[1]} missing`);
  }

  // Things the vendors refuse in a bundle.
  for (const banned of ["hooks", "bin", ".app.json"])
    if (existsSync(join(pluginDir, banned))) errors.push(`plugins/xentropy/${banned}: not allowed (claude.ai refuses bin/, OpenAI refuses hooks and .app.json)`);

  // Commands.
  const commands = join(pluginDir, "commands");
  for (const file of existsSync(commands) ? readdirSync(commands) : []) {
    const { data, body } = parseFrontmatter(readFileSync(join(commands, file), "utf8"));
    if (!file.endsWith(".md") || !data?.description) errors.push(`commands/${file}: needs a description`);
    if (SHELL_FENCE.test(body) || /!`/.test(body)) errors.push(`commands/${file}: no shell execution in commands`);
  }

  // Marketplaces.
  const claudeMarket = readJson(join(repo, ".claude-plugin/marketplace.json"), errors);
  if (claudeMarket) {
    if (claudeMarket.name !== "xentropy" || !claudeMarket.owner?.name) errors.push(".claude-plugin/marketplace.json: name and owner.name");
    for (const p of claudeMarket.plugins ?? []) {
      if (typeof p.source !== "string" || !existsSync(join(repo, p.source, ".claude-plugin/plugin.json")))
        errors.push(`.claude-plugin/marketplace.json: ${p.name} source has no .claude-plugin/plugin.json`);
    }
    if (!(claudeMarket.plugins ?? []).some((p) => p.name === "xentropy")) errors.push(".claude-plugin/marketplace.json: xentropy plugin missing");
  }
  const agentsMarket = readJson(join(repo, ".agents/plugins/marketplace.json"), errors);
  if (agentsMarket) {
    if (agentsMarket.name !== "xentropy") errors.push(".agents/plugins/marketplace.json: name");
    for (const p of agentsMarket.plugins ?? []) {
      if (p.source?.source !== "local" || !existsSync(join(repo, p.source?.path ?? "/nonexistent", "plugin.json")))
        errors.push(`.agents/plugins/marketplace.json: ${p.name} source must be local with a plugin.json`);
      if (p.policy?.authentication !== "ON_INSTALL") errors.push(`.agents/plugins/marketplace.json: ${p.name} policy.authentication must be ON_INSTALL`);
      if (!p.policy?.installation) errors.push(`.agents/plugins/marketplace.json: ${p.name} policy.installation missing`);
      if (!p.category) errors.push(`.agents/plugins/marketplace.json: ${p.name} category missing`);
    }
  }

  // Skills.
  errors.push(...validateSkills(join(pluginDir, "skills")).map((e) => `skills/${e}`));

  // Secrets anywhere in tracked-looking files.
  for (const file of walk(repo)) {
    if (/\.(png|jpe?g|gif|ico|zip)$/.test(file)) continue;
    if (statSync(file).size > 2_000_000) continue;
    const hit = readFileSync(file, "utf8").match(SECRET);
    if (hit) errors.push(`${relative(repo, file)}: looks like a credential (${hit[0].slice(0, 6)}…)`);
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = resolve(process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), ".."));
  const errors = validateRepo(repo);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exit(1);
  }
  console.log("xentropy-plugins: all manifests and skills valid");
}
