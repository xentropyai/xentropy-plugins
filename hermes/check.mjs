// Checks for the Hermes drafts (stream D). The manifest rules mirror hermes_cli/mcp_catalog.py
// `_parse_manifest` in NousResearch/hermes-agent (main, read 2026-11-18), plus Xentropy's own rules
// for default_enabled. The plugin-catalog rules mirror plugin-catalog/README.md "Entry schema".
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { MCP_URL } from "../scripts/validate.mjs";

export const DOCS_URL = "https://docs.xentropy.ai/agents/clients/hermes";
/** The web origin that serves /.well-known/skills (stream B, apps/web, harness S8). */
export const SKILLS_ORIGIN = "https://xentropy.ai";
const MANIFEST_OAUTH_KEYS = new Set(["client_id", "client_secret", "redirect_host", "redirect_port", "scope"]);
const isMap = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
const strList = (v, nonEmpty = false) => Array.isArray(v) && v.every((s) => typeof s === "string" && (!nonEmpty || s.trim()));

/** Errors for an optional-mcps manifest; `tools` is the Xentropy tool snapshot {name: hints}. */
export function validateHermesManifest(m, tools) {
  const e = [];
  if (!isMap(m)) return ["manifest must be a mapping"];
  if (m.manifest_version !== 1) e.push(`manifest_version ${m.manifest_version} unsupported (Hermes understands 1)`);
  if (typeof m.name !== "string" || !/^[A-Za-z0-9_-]+$/.test(m.name)) e.push("invalid or missing 'name'");
  if (!String(m.description ?? "").trim()) e.push("'description' required");
  const t = m.transport;
  if (!isMap(t) || !["stdio", "http"].includes(t.type)) e.push("transport.type must be 'stdio' or 'http'");
  else if (t.type === "http" && !t.url) e.push("http transport requires transport.url");
  const a = m.auth ?? { type: "none" };
  if (!isMap(a) || !["api_key", "oauth", "none"].includes(a.type ?? "none")) e.push("auth.type must be 'api_key'|'oauth'|'none'");
  else if (a.oauth !== undefined) {
    if (a.type !== "oauth") e.push("auth.oauth is only valid with auth.type 'oauth'");
    if (!isMap(a.oauth) || Object.keys(a.oauth).some((k) => !MANIFEST_OAUTH_KEYS.has(k)))
      e.push(`auth.oauth allows ${[...MANIFEST_OAUTH_KEYS].join(", ")} only`);
  }
  const tl = m.tools ?? {};
  if (!isMap(tl)) e.push("'tools' must be a mapping");
  else {
    for (const key of ["default_enabled", "default_excluded"])
      if (tl[key] !== undefined && !strList(tl[key])) e.push(`tools.${key} must be a list of strings`);
    if (tl.default_enabled !== undefined && tl.default_excluded !== undefined)
      e.push("tools.default_enabled and tools.default_excluded are mutually exclusive");
    // Xentropy rules: real tool names, nothing destructive pre-checked.
    for (const name of strList(tl.default_enabled) ? tl.default_enabled : []) {
      if (!tools[name]) e.push(`tools.default_enabled: ${name} is not a Xentropy tool`);
      else if (tools[name].destructiveHint) e.push(`tools.default_enabled: ${name} is destructive`);
    }
  }
  if (m.suggest !== undefined) {
    const s = m.suggest;
    if (!isMap(s)) e.push("'suggest' must be a mapping");
    else {
      if (!strList(s.keywords ?? [], true)) e.push("suggest.keywords must be a list of non-empty strings");
      if (!strList(s.hosts ?? [], true)) e.push("suggest.hosts must be a list of non-empty strings");
      if (!(s.keywords ?? []).length && !(s.hosts ?? []).length && !(s.applications ?? []).length)
        e.push("'suggest' requires at least one keyword, host or application");
    }
  }
  if (m.post_install !== undefined && typeof m.post_install !== "string") e.push("post_install must be a string");
  // Xentropy rules: the exact endpoint and docs page.
  if (t?.url !== undefined && t.url !== MCP_URL) e.push(`transport.url must be ${MCP_URL}`);
  if (m.source !== DOCS_URL) e.push(`source must be ${DOCS_URL}`);
  return e;
}

/** Errors for the plugin-catalog draft (plugin-catalog/README.md "Entry schema"); `repo` is this checkout. */
export function validatePluginCatalogEntry(p, repo) {
  const e = [];
  if (!isMap(p)) return ["entry must be a mapping"];
  if (typeof p.name !== "string" || !/^[a-z0-9_-]{1,64}$/.test(p.name)) e.push("name must match [a-z0-9_-]{1,64}");
  if (p.repo !== "https://github.com/xentropyai/xentropy-plugins") e.push("repo must be https://github.com/xentropyai/xentropy-plugins");
  // A draft carries a placeholder that upstream's loader rejects, so it cannot be merged unpinned by accident.
  if (!(/^[0-9a-f]{40}$/.test(String(p.sha)) || p.sha === "REPLACE_WITH_40_HEX_COMMIT_SHA")) e.push("sha must be a 40-hex commit or the placeholder");
  const sub = String(p.subdir ?? "");
  if (!/^[A-Za-z0-9._/-]+$/.test(sub) || isAbsolute(sub) || sub.split("/").some((s) => s === ".." || s === "." || s === ""))
    e.push("subdir must be a plain relative path");
  else if (!existsSync(join(repo, sub, "plugin.json")) || !existsSync(join(repo, sub, "mcp.json"))) e.push("subdir has no portable plugin.json + mcp.json");
  if (!String(p.description ?? "").trim()) e.push("description required");
  if (p.tier !== "community") e.push("tier must be community (only Nous sets official or verified)");
  if (!/^>=\d+\.\d+(\.\d+)?$/.test(String(p.requires_hermes ?? ""))) e.push('requires_hermes must be a SemVer floor like ">=0.23.0"');
  if (!/^\d+\.\d+\.\d+$/.test(String(p.version ?? ""))) e.push("version must be a quoted semver label");
  const caps = p.capabilities;
  if (!isMap(caps) || ["provides_tools", "provides_hooks", "provides_middleware", "requires_env"].some((k) => !Array.isArray(caps[k])))
    e.push("capabilities must list provides_tools, provides_hooks, provides_middleware and requires_env");
  return e;
}

/** URLs that are not https, except http on loopback (OAuth callbacks). */
export function insecureUrls(text) {
  return [...text.matchAll(/\b(?:https?|ftp|ws):\/\/[^\s"'`)<>\]]+/g)]
    .map((m) => m[0])
    .filter((u) => !u.startsWith("https://") && !/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])([:/]|$)/.test(u));
}

/**
 * The lines between `# BEGIN <label>` and `# END <label>` with one leading `# ` removed, i.e. the
 * commented alternative a user would uncomment.
 */
export function uncommentBlock(text, label) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `# BEGIN ${label}`);
  const end = lines.findIndex((l) => l.trim() === `# END ${label}`);
  if (start < 0 || end <= start) throw new Error(`no "# BEGIN ${label}" ... "# END ${label}" block`);
  return lines.slice(start + 1, end).map((l) => l.replace(/^# ?/, "")).join("\n");
}
