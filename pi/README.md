# @xentropy/pi

Xentropy for the [pi coding agent](https://pi.dev). It gives pi the Xentropy MCP tools (artifacts, dashboards, data sources) and the Xentropy skills.

Built and tested against `@earendil-works/pi-coding-agent` 1.5.2 on Node.js 22.19 or later.

## What it does

- On every session start, it connects to the Xentropy MCP server (`https://api.xentropy.ai/mcp`) with your API key and lists its tools.
  - It registers each tool in pi as `xentropy_<tool>`, for example `xentropy_artifacts_list`.
  - Tools are listed again on each new, resumed or reloaded session. New server tools appear; withdrawn ones are hidden.
- It passes each tool's MCP annotations (`readOnlyHint`, `destructiveHint`, …) to pi, so permission extensions can gate calls.
  - The description of a tool that may change or delete data starts with "Changes or deletes data."
- Tool results keep text and images. Other content, such as audio and resource links, becomes a short text note. A server error reaches the model as an error result.
- It adds two commands:
  - `/xentropy-status` shows the server, the connection state, the tool count and the auth mode. It never shows the key.
  - `/xentropy-login` shows the setup steps below.
- It includes the skill `xentropy-artifact-studio`.

## Install

From npm (after `@xentropy/pi` is published):

```bash
pi install npm:@xentropy/pi
```

Try it for one run without saving it in settings:

```bash
pi -e npm:@xentropy/pi
```

From a local checkout of this repository:

```bash
pi install ./pi        # or: pi -e ./pi
```

### Installing from git

`pi install git:github.com/xentropyai/xentropy-plugins` does **not** work yet.

- pi clones the repository and runs `npm install` only at the repository root. It reads the `pi` manifest from the root `package.json` or from root `extensions/` and `skills/` folders.
- A git source cannot name a subdirectory such as `pi/` (pi 1.5.2, `parseGitUrl` in `dist/utils/git.js`).
- This package lives in `pi/`, so a git install finds nothing to load.

Proposed fix, in the repository root:

- Add a root `package.json`: `{"private": true, "workspaces": ["pi"], "pi": {"extensions": ["./pi/extensions/xentropy.ts"], "skills": ["./pi/skills"]}}`.
- The root `npm install` then installs this package's dependencies, and pi loads the extension and the skills from `pi/`.

Until that lands, use npm or a local checkout.

## Set up

1. Create an API key at https://xentropy.ai/settings/api-keys.
   - Choose the **Agent** preset. It matches what an OAuth connection can save: reading and authoring artifacts and dashboards, export (`artifacts:render`) and saved datasets (`data:write`).
   - Sharing, publishing and permanent deletion (`artifacts:share`, `artifacts:publish`, `artifacts:delete`, `dashboards:delete`) are separate opt-ins. Leave them off unless pi needs them.
   - For read-only use, grant only `artifacts:read` and `dashboards:read`, plus any data scopes you need.
2. Export the key in the shell that starts pi. Keep it out of files that are committed or shared.

   ```bash
   export XENTROPY_API_KEY=xak_...
   # Optional, for a non-production server. It must be https; plain http works only for localhost.
   export XENTROPY_MCP_URL=https://api.xentropy.ai/mcp
   ```

3. Start pi, or run `/reload` in a running session. Then check `/xentropy-status`.

With no key set, the extension registers no tools and shows a one-line hint at session start.

pi has no secrets store for extensions, so the key comes from the environment. The extension sends it only as `Authorization: Bearer <key>` to the configured server.

## Security

- **pi extensions run with your full user permissions.** Review this package's source before installing it, as you would for any pi package. It is MIT licensed and has no install scripts.
- The extension reads only `XENTROPY_API_KEY` and `XENTROPY_MCP_URL`. It talks only to the configured server and never writes the key to disk, to the session or to the screen.
- Tool calls act on your Xentropy workspace with the key's scopes. Use a key with only the scopes you need, and revoke it at https://xentropy.ai/settings/api-keys when you stop using it.
- To confirm calls before they change data, add a permission extension that checks `annotations` (see "Tool Exposure" in pi's `docs/extensions.md`).

## Alternatives without this package

### pi's built-in MCP support

pi 1.5 connects to MCP servers itself (pi's `docs/mcp.md`). This path has not yet been tested live against Xentropy.

With OAuth (no API key; pi identifies itself with its Client ID Metadata Document, which Xentropy accepts):

```bash
pi mcp add xentropy --url https://api.xentropy.ai/mcp --exposure direct
pi mcp login xentropy
```

With an API key:

```bash
pi mcp add xentropy --url https://api.xentropy.ai/mcp --bearer-token-env-var XENTROPY_API_KEY --exposure direct
```

Notes on this path:

- Tools are then named `mcp__xentropy__<tool>`.
- Without `--exposure direct`, they are reached through pi's `codemode` tool.
- Use either this or `@xentropy/pi`, not both, or every tool appears twice.
- The skills in this package are not installed this way.

### pi-mcp-adapter (community, unverified)

The community `pi-mcp-adapter` extension replaces pi's built-in `/mcp` support. It reads `~/.pi/agent/mcp.json` in the common `mcpServers` format:

```json
{
  "mcpServers": {
    "xentropy": {
      "url": "https://api.xentropy.ai/mcp",
      "headers": { "Authorization": "Bearer ${XENTROPY_API_KEY}" }
    }
  }
}
```

Xentropy does not maintain `pi-mcp-adapter`, and this configuration has not been verified against its current README. pi 1.5's built-in support uses the same file, so prefer the built-in path above.

## Development

```bash
npm install --ignore-scripts
npm test             # node:test against an in-process stub MCP server
npm run typecheck    # tsc against pi's published types
node --import tsx tests/smoke/sdk-smoke.ts /tmp/pi-smoke-agent   # loads the package into a real pi SDK session
```

`scripts/sync-skills.mjs <source-dir>` copies generated skills into `skills/` with a `xentropy-` prefix. It is a stub until the shared skill generator lands.

## License

MIT
