# OpenClaw native plugin: deferred

`openclaw.plugin.json` is **not** drafted. The design (DESIGN_AND_PLAN.md §3.3, "Later") makes an `@xentropy/openclaw` plugin conditional on remote MCP servers being supported in plugin manifests, and the docs do not confirm that.

What docs.openclaw.ai says (read 2026-11-18):

- `plugins/manifest`: `mcpServers` is an optional `Record<string, object>`, "Static MCP server definitions contributed while this plugin is enabled". Relative command arguments and working directories resolve from the plugin root, and an operator `mcp.servers` entry with the same name overrides or disables it. Required manifest fields are `id` and `configSchema`.
- `plugins/manifest/surfaces` ("MCP server reference"): the only example is a local process (`"transport": "stdio"`, `"command"`, `"args"`). It does not mention `url`, `streamable-http`, `headers` or `auth: "oauth"` for plugin-declared servers, and it does not say whether they are rejected or ignored.
- `tools/mcp`: remote `url` + `transport: "streamable-http"` + `auth: "oauth"` is documented for the operator's own `mcp.servers` only. It mentions plugin-declared shared OAuth servers in passing, without a schema.

Shipping a manifest whose remote `mcpServers` entry might be ignored would give users a plugin that installs cleanly and then has no Xentropy tools. Until this is confirmed, OpenClaw users get the same result from the ClawHub skill plus one `openclaw mcp add` command (see `../skills/xentropy/SKILL.md`).

To revisit:

1. Confirm in the OpenClaw source or docs that a plugin `mcpServers` entry accepts `url`, `transport: "streamable-http"` and `auth: "oauth"`, and that `openclaw mcp login <name>` works for a plugin-declared server.
2. Then draft `openclaw.plugin.json` with `id: "xentropy"`, an empty `configSchema`, `skills: ["skills"]` and `mcpServers.xentropy` = `{ "url": "https://api.xentropy.ai/mcp", "transport": "streamable-http", "auth": "oauth" }`, plus a test like H-D15.
3. Alternatively, OpenClaw reads Claude and Codex bundle layouts; check whether `plugins/xentropy` (with `.mcp.json`/`mcp.json`) installs as-is, which would make a native manifest unnecessary.
