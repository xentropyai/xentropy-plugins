// The ClawHub skill rules for openclaw/skills/xentropy (stream D).
//
// No-scripts rule (ClawHub scans skills, and users distrust skills that run install commands):
// 1. The skill folder holds SKILL.md and optional references/*.md only: no scripts, binaries or archives.
// 2. Shell code blocks (bash, sh, console, powershell, ...) and "$ " prompt lines may appear only in the
//    section headed SETUP_HEADING, which addresses the user, not the agent.
// 3. Every command line in those blocks must be one of ALLOWED_COMMANDS: configuring and signing in to
//    the Xentropy MCP server. Nothing that downloads, installs or executes other code.
// 4. Nowhere in the skill (prose or inline code included): FORBIDDEN patterns such as curl, wget, npx,
//    package installs, pipes into a shell, eval or chmod +x.
// 5. metadata.openclaw sets primaryEnv XENTROPY_API_KEY and no requires/install/always, so OAuth users
//    (who have no key) still see the skill and nothing is installed on load.
import { parseFrontmatter } from "../scripts/validate.mjs";

export const SETUP_HEADING = "## Setup (for the user, not the agent)";
const SHELL_LANG = /^\s*```\s*(bash|sh|shell|zsh|console|powershell|ps1|pwsh|cmd|bat|fish)\b/i;
export const ALLOWED_COMMANDS = [
  /^openclaw mcp add xentropy --url https:\/\/api\.xentropy\.ai\/mcp --transport streamable-http --auth oauth$/,
  /^openclaw mcp login xentropy$/,
  /^openclaw mcp logout xentropy$/,
];
export const FORBIDDEN = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bnpx\b/i,
  /\b(npm|pnpm|yarn|bun)\s+(i|install|add|exec|dlx|x)\b/i,
  /\bpipx?\s+install\b/i,
  /\buvx?\b/,
  /\bbrew\s+install\b/i,
  /\|\s*(sudo\s+)?(ba|z|da)?sh\b/i,
  /\b(ba|z)?sh\s+-c\b/i,
  /\beval\s*[("'$`]/i,
  /\bchmod\s+\+?[0-7]*x/i,
  /\bbase64\s+(-d|--decode)\b/i,
  /\b(iex|Invoke-Expression|Invoke-WebRequest|iwr)\b/i,
  /\bclawhub\s+(install|skill\s+install)\b/i,
];

/** The skill text without the user setup section (from SETUP_HEADING to the next "## " or the end). */
export function stripSetup(text) {
  const start = text.indexOf(SETUP_HEADING);
  if (start < 0) return text;
  const next = text.indexOf("\n## ", start + SETUP_HEADING.length);
  return (text.slice(0, start) + (next < 0 ? "" : text.slice(next + 1))).replace(/\n+$/, "\n");
}

/** Errors for the ClawHub skill text and its file list (paths relative to the skill folder). */
export function checkOpenClawSkill(text, files) {
  const e = [];
  for (const f of files) if (f !== "SKILL.md" && !/^references\/[a-z0-9-]+\.md$/.test(f)) e.push(`unexpected file ${f} (the skill ships no scripts)`);
  const { data, body } = parseFrontmatter(text);
  const oc = data?.metadata?.openclaw;
  if (!oc) e.push("metadata.openclaw missing");
  else {
    if (oc.primaryEnv !== "XENTROPY_API_KEY") e.push("metadata.openclaw.primaryEnv must be XENTROPY_API_KEY");
    for (const key of ["requires", "install", "always"]) if (oc[key] !== undefined) e.push(`metadata.openclaw.${key} not allowed (OAuth users have no key; nothing installs)`);
  }
  if (!text.includes(SETUP_HEADING)) e.push(`missing "${SETUP_HEADING}"`);

  const outside = stripSetup(body);
  if (new RegExp(SHELL_LANG.source, "im").test(outside) || /^\s*\$ /m.test(outside))
    e.push("shell code block outside the setup section");

  const start = body.indexOf(SETUP_HEADING);
  if (start >= 0) {
    const next = body.indexOf("\n## ", start + SETUP_HEADING.length);
    const setup = body.slice(start, next < 0 ? undefined : next);
    for (const m of setup.matchAll(/^\s*```([^\n]*)\n([\s\S]*?)^\s*```/gm)) {
      if (!SHELL_LANG.test("```" + m[1])) continue;
      for (const raw of m[2].split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        if (!ALLOWED_COMMANDS.some((re) => re.test(line))) e.push(`"${line}" is not an allowed setup command`);
      }
    }
  }
  for (const re of FORBIDDEN) {
    const hit = text.match(re);
    if (hit) e.push(`forbidden pattern "${hit[0]}" (no install or execution instructions)`);
  }
  return e;
}
