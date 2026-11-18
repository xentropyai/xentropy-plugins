# Xentropy plugins

Official Xentropy integrations for AI agent harnesses: Claude (Claude Code, claude.ai, Cowork), OpenAI (Codex, ChatGPT), pi, Hermes Agent and OpenClaw.

Every integration connects to the Xentropy remote MCP server at `https://api.xentropy.ai/mcp`. Sign in with OAuth, or use a scoped API key where OAuth is unavailable. Connection guides: https://docs.xentropy.ai/agents

## Layout

| Path | What it is |
| --- | --- |
| `plugins/xentropy/` | One plugin folder for Claude and OpenAI: `.claude-plugin/plugin.json` + `.mcp.json` (Claude), `plugin.json` + `mcp.json` + `agents/openai.yaml` (OpenAI), `skills/`, `commands/`, `assets/` |
| `.claude-plugin/marketplace.json` | Claude Code marketplace |
| `.agents/plugins/marketplace.json` | Codex marketplace |
| `plugins/xentropy/skills/` | Generated from the Xentropy skills corpus. Do not edit by hand; run `scripts/sync-skills.mjs` |

## Claude Code

```
claude plugin marketplace add xentropyai/xentropy-plugins
claude plugin install xentropy@xentropy
```

Or inside a session:

```
/plugin install xentropy --marketplace xentropyai/xentropy-plugins
```

Then sign in with `/mcp` (or `claude mcp login xentropy`). The plugin adds the Xentropy MCP server (OAuth; no API key is stored), the `xentropy-*` skills and the `/xentropy:chart` command.

## claude.ai and Cowork

Add Xentropy as a custom connector with the URL `https://api.xentropy.ai/mcp` and sign in. The skills in `plugins/xentropy/skills/` can be uploaded as skills.

## OpenAI Codex

```
codex plugin marketplace add xentropyai/xentropy-plugins
```

Then open `/plugins` and install Xentropy. Without the plugin, add the server to `~/.codex/config.toml`:

```toml
[mcp_servers.xentropy]
url = "https://api.xentropy.ai/mcp"
```

and sign in with `codex mcp login xentropy`. For headless use (`codex exec`, CI), add `bearer_token_env_var = "XENTROPY_API_KEY"` to that table and put a scoped API key from https://xentropy.ai/settings/api-keys in that environment variable. Codex reads skills from `.agents/skills` and `~/.agents/skills`.

## ChatGPT

Xentropy for ChatGPT is distributed through the ChatGPT app directory (listing pending). The upload is built by `scripts/build-openai-zip.mjs`.

## pi, Hermes Agent and OpenClaw

See https://docs.xentropy.ai/agents. Hermes can install the skills from the index at `https://xentropy.ai/.well-known/skills/index.json`.

## Development

Requires Node 22.2 or later; there are no dependencies.

```
node scripts/validate.mjs                                  # manifests, skill rules, credential scan
node --test test/*.test.mjs                                # repo tests
node scripts/build-openai-zip.mjs                          # dist/xentropy-openai.zip
node scripts/sync-skills.mjs /path/to/xentropy-monorepo    # regenerate plugins/xentropy/skills
claude plugin validate --strict plugins/xentropy           # when the claude CLI is installed
```

## License

MIT, see `LICENSE`.
