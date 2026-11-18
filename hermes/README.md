# Xentropy for Hermes Agent

Hermes Agent (NousResearch) connects to Xentropy's hosted MCP server at `https://api.xentropy.ai/mcp`. There is no Hermes plugin code to install: you add the server to your config, sign in, and optionally install the Xentropy skills.

| File | What it is |
| --- | --- |
| `config.example.yaml` | `mcp_servers.xentropy` for `~/.hermes/config.yaml`: OAuth (default) and a headless API key variant |
| `optional-mcps/xentropy/manifest.yaml` | Draft entry for the Hermes MCP catalog (`hermes mcp install xentropy`), see `PR.md` |
| `plugin-catalog/xentropy.yaml` | Draft entry for the Hermes plugin catalog (the portable package in `plugins/xentropy`), see `PR.md` |
| `PR.md` | Upstream PR title, body and the owner's steps |
| `check.mjs`, `test/` | Checks for these drafts: `node --test "hermes/test/*.test.mjs"` |

## 1. Connect (OAuth)

Add this to `~/.hermes/config.yaml`:

```yaml
mcp_servers:
  xentropy:
    url: https://api.xentropy.ai/mcp
    auth: oauth
```

or let Hermes write it:

```
hermes mcp add xentropy --url https://api.xentropy.ai/mcp --auth oauth
```

Then sign in once and start a new session (or run `/reload-mcp`):

```
hermes mcp login xentropy
```

Hermes opens the Xentropy consent page in your browser. It identifies itself with its Client ID Metadata Document first and falls back to Dynamic Client Registration; the callback is a loopback port in 27890-27894, which Xentropy accepts. Over SSH, follow the callback instructions Hermes prints. Device-code login (`--flow device`) is not available for Xentropy yet; use the API key variant below on hosts without a browser.

The tools appear as `mcp_xentropy_<tool>` (for example `mcp_xentropy_artifacts_create`) in the toolset `mcp-xentropy`. Which tools are listed depends on the scopes you approve. Sharing and publishing need extra scopes that are only requested when you ask for them.

## 2. Headless hosts (API key)

1. Create a key with the **Agent** preset at https://xentropy.ai/settings/api-keys.
2. Put it in `~/.hermes/.env`: `XENTROPY_API_KEY=xak_EXAMPLE` (your real key, never in `config.yaml`).
3. Use the header variant from `config.example.yaml`:

```yaml
mcp_servers:
  xentropy:
    url: https://api.xentropy.ai/mcp
    headers:
      Authorization: "Bearer ${XENTROPY_API_KEY}"
    trust: untrusted
```

`trust: untrusted` makes Hermes ask before every call that is not annotated read-only (Once, Session or Always per tool). In cron and other unattended runs such calls fail closed, so an unattended key should carry read-only scopes, or narrow the server with `tools.include`.

## 3. Skills

The Xentropy skills (`xentropy-artifacts`, `xentropy-dashboards`, `xentropy-connections`, `xentropy-artifact-studio`, `xentropy-google-sheets`, `xentropy-google-drive`, `xentropy-google-analytics`) declare `metadata.hermes.requires_toolsets: [mcp-xentropy]`, so Hermes shows them only once the server above is connected under the name `xentropy`.

### From the website (`well-known:`)

Xentropy serves a skills index at `https://xentropy.ai/.well-known/skills/index.json` (the app origin, not docs or api). Hermes identifiers for this source must contain `/.well-known/skills/`:

```
hermes skills search https://xentropy.ai --source well-known
hermes skills install well-known:https://xentropy.ai/.well-known/skills/xentropy-artifacts
hermes skills install well-known:https://xentropy.ai/.well-known/skills/xentropy-dashboards
```

Status: the route is implemented on the monorepo branch `feat/harness-skills` (commit 61c187f5) and is not deployed yet.

### From GitHub (tap)

```
hermes skills tap add xentropyai/xentropy-plugins
```

A Hermes tap reads skills from `skills/` at the repository root (the `path` default in `skills/.hub/taps.json`; `hermes skills tap add` has no option to change it). This repo keeps the skills in `plugins/xentropy/skills/`, so the tap finds nothing until the repo also has a root-level `skills/` (see the cross-stream request in the stream D report). Until then, install a skill by its repo path:

```
hermes skills install xentropyai/xentropy-plugins/plugins/xentropy/skills/xentropy-artifacts
```

Both GitHub routes need the repository to be public. Installs from either source are security-scanned and get the `community` trust level.

## 4. Catalog listings

Two upstream listings are drafted here; neither is submitted. `PR.md` explains why the plugin catalog entry is the likelier one to be accepted.

- MCP catalog: `hermes mcp install xentropy`, with a pre-checked tool list (reads plus core writes; deletes, sharing, publishing and Google writes unchecked).
- Plugin catalog: `hermes plugins install xentropy` installs the portable package from `plugins/xentropy` (server and skills). Its skills are then named `xentropy:xentropy-artifacts` and so on. OAuth still needs the `hermes mcp add ... --auth oauth` step above.
