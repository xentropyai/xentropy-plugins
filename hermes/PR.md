# Hermes upstream PR (D-8): draft

Status: **draft, not opened.** D-8 says the PR opens after the P6 live test, from the owner's GitHub account, after review. Nothing here has been sent to GitHub.

## Read this first: the MCP catalog takes no new entries

The D-8 plan targets `optional-mcps/`. Upstream history read on 2026-11-18 shows maintainers stopped merging new entries there:

- `3fe172b0fa` (2026-10-29): "chore(catalog): drop the optional-mcps entry; Runa lists as a plugin (the MCP catalog takes no new entries)".
- `781693e5e6` (2026-11-13): "chore(optional-mcps): drop MeetStream MCP entry from this PR".
- `f7b1cf106a` (2026-11-17): "chore(optional-mcps): drop Bitquery MCP entry, keep the plugin entry".

Vendors with a hosted MCP server are now listed in **`plugin-catalog/`** as a Portable Agent Plugins v1 package (`plugin.json` + `mcp.json` + `skills/`). `plugin-catalog/runa.yaml` is the closest precedent: hosted Streamable HTTP with OAuth 2.1 plus bundled skills.

Recommendation: open **PR B** (plugin catalog). Keep PR A (`optional-mcps/xentropy/manifest.yaml`) as the fallback if a maintainer asks for a catalog MCP entry. Both drafts are in this folder and pass the upstream loader rules as mirrored in `hermes/check.mjs`.

## PR B (recommended): plugin catalog

**Title:** `feat(plugin-catalog): add xentropy`

**File:** `plugin-catalog/xentropy.yaml` (copy of `hermes/plugin-catalog/xentropy.yaml`, with `sha` set).

**Body:**

> Adds Xentropy to the plugin catalog. Xentropy builds charts, tables and dashboards from the user's own connected data (PostgreSQL, OpenAPI, Google Sheets, Google Drive, Google Analytics).
>
> - **Package:** Portable Agent Plugins v1 at `plugins/xentropy` in https://github.com/xentropyai/xentropy-plugins (`plugin.json`, `mcp.json`, `skills/`). No Python, no executables, no hooks.
> - **Hermes surfaces:** one Streamable HTTP MCP server (`xentropy` → `https://api.xentropy.ai/mcp`) and seven read-only skills that declare `metadata.hermes.requires_toolsets: [mcp-xentropy]`.
> - **Auth:** OAuth 2.1 with PKCE (S256), public clients only. Supports Client ID Metadata Documents (Hermes's CIMD document is accepted) and Dynamic Client Registration; loopback callbacks are allowed. As with Runa, the user enables OAuth with `hermes mcp add xentropy --url https://api.xentropy.ai/mcp --auth oauth`. Headless hosts use a scoped API key in `~/.hermes/.env`.
> - **Disclosure (rule 13):** hosted-only connector with no local code; every tool call goes to api.xentropy.ai, signed in as the user. Rows read from the user's connected sources enter the session context and so reach the user's model provider. Write tools change Xentropy artifacts, dashboards and datasets; Google Sheets/Drive writes, share links and public publishing need opt-in OAuth scopes. Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`), so `trust: untrusted` prompts on every write. Tool results from third-party sources are marked untrusted. No telemetry in the package.
> - **Validation:** `hermes plugins validate <checkout>/plugins/xentropy --install-deps` at the pinned commit: _paste result_.
> - **Live test:** _paste the P6 result: `hermes mcp login xentropy`, a tool call, skill install_.

## PR A (fallback): MCP catalog

**Title:** `feat(optional-mcps): add Xentropy hosted MCP (OAuth)`

**File:** `optional-mcps/xentropy/manifest.yaml` (copy of `hermes/optional-mcps/xentropy/manifest.yaml`).

**Body:**

> Adds Xentropy's vendor-hosted MCP server (`https://api.xentropy.ai/mcp`, stateless Streamable HTTP) to the catalog.
>
> - **Auth:** native MCP OAuth 2.1 (no `provider:`): RFC 9728 protected-resource metadata, PKCE S256, public clients, CIMD and DCR. Hermes's `mcp_oauth_manager` handles it; verified with `hermes mcp login xentropy` on _version_.
> - **default_enabled:** 39 tools: every read tool plus the core non-destructive writes (create, update, refresh, export, trash and restore of artifacts; dashboard create and restore; dataset create and bind). Left unchecked: deletes, share links, public publishing, Google Sheets and Drive writes, new connections, uploads, refresh schedules and the feature-gated data-plan tools. None of the pre-checked tools has `destructiveHint: true`.
> - **suggest:** keyword `xentropy`, host `xentropy.ai`.
> - **Docs:** https://docs.xentropy.ai/agents/clients/hermes

## Owner steps

1. Run the P6 live test on a Hermes 0.23.x install: `hermes mcp add xentropy --url https://api.xentropy.ai/mcp --auth oauth`, `hermes mcp login xentropy`, one read and one write call, and `hermes skills install well-known:https://xentropy.ai/.well-known/skills/xentropy-artifacts` once that route is deployed. Record which client registration Hermes used (CIMD or DCR) in the API logs.
2. Make `xentropyai/xentropy-plugins` public (D-1, after the secret scan), then pick the commit to pin: `git rev-parse HEAD` on `main`.
3. In a local clone of that commit, with Hermes installed: `hermes plugins validate plugins/xentropy --install-deps`. Fix any failure. Read every warning; the `com.openai` extension in `mcp.json` may be reported as an unknown key, which current Hermes ignores (hence `requires_hermes: ">=0.23.0"`; lower it only if the validator confirms an older floor).
4. From your own GitHub account: fork `NousResearch/hermes-agent`, create a branch, add `plugin-catalog/xentropy.yaml` with the real `sha`, commit with the title above, push to your fork and open the PR against `main` with the body above (fill in the two _paste_ lines). The catalog rules accept submissions from the plugin repo's owner, so open it as a member of `xentropyai`.
5. Wait for the catalog CI job; answer review. If a maintainer asks for the MCP catalog instead, submit PR A the same way.
6. After merge: update https://docs.xentropy.ai/agents/clients/hermes with `hermes plugins install xentropy`.
