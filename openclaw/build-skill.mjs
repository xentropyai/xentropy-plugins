#!/usr/bin/env node
// Builds openclaw/skills/xentropy/SKILL.md for ClawHub from the generated xentropy-artifacts skill
// (plugins/xentropy/skills, owned by the skills export) plus openclaw/skill-setup.md.
// Usage: node openclaw/build-skill.mjs   (the H-D14 test fails when the committed file drifts)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTMATTER = [
  "---",
  "name: xentropy",
  'description: "Creates, edits, refreshes, exports, shares and publishes data-backed charts and tables (artifacts) from the user\'s own data with the Xentropy MCP server, and tells the user how to connect it in OpenClaw. Use when the user wants a chart, graph or table built from their own data, or wants to change, export, share or publish a Xentropy artifact."',
  "license: MIT",
  'compatibility: "Requires the Xentropy MCP server (https://api.xentropy.ai/mcp) connected in OpenClaw as \\"xentropy\\" (streamable-http)."',
  'metadata: {"version":"1.0.0","source":"xentropy","hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"primaryEnv":"XENTROPY_API_KEY","homepage":"https://docs.xentropy.ai/agents/clients/openclaw"}}',
  "---",
].join("\n");

export function buildOpenClawSkill(repo) {
  const source = readFileSync(join(repo, "plugins/xentropy/skills/xentropy-artifacts/SKILL.md"), "utf8");
  const body = source.replace(/^---\n[\s\S]*?\n---\n/, "");
  // The generated skill ends with a harness-neutral "## Setup"; the OpenClaw one replaces it.
  const core = body.replace(/\n## Setup\n[\s\S]*$/, "\n").replace(/\n+$/, "\n");
  const setup = readFileSync(join(repo, "openclaw/skill-setup.md"), "utf8").replace(/\n+$/, "\n");
  return `${FRONTMATTER}\n${core}\n${setup}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
  writeFileSync(join(repo, "openclaw/skills/xentropy/SKILL.md"), buildOpenClawSkill(repo));
  console.log("wrote openclaw/skills/xentropy/SKILL.md");
}
