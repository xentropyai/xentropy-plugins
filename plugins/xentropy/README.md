# Xentropy plugin

Xentropy turns your data into charts, tables and dashboards that you can inspect, refresh and share. This plugin connects your assistant to the Xentropy MCP server at `https://api.xentropy.ai/mcp` and adds Xentropy skills for building charts and dashboards, working with datasets and connecting data sources.

## Install (Claude Code)

```bash
claude plugin marketplace add xentropyai/xentropy-plugins
claude plugin install xentropy@xentropy
```

Then sign in: run `/mcp`, choose **plugin:xentropy:xentropy** and **Authenticate**, or run `claude mcp login plugin:xentropy:xentropy`. Sign in to Xentropy and approve the requested permissions. No API key is needed.

## Install (Codex)

```bash
codex plugin marketplace add xentropyai/xentropy-plugins
```

Then open `/plugins` and install Xentropy.

## Help

- Setup guides for every assistant: https://docs.xentropy.ai/agents
- Privacy policy: https://xentropy.ai/privacy
- Support: https://xentropy.ai/legal#contact
