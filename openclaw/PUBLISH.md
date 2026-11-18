# Publishing the `xentropy` skill to ClawHub (owner steps)

Nothing has been published. This host has no ClawHub credentials (D-2), and publishing is an owner action.

## Before publishing

1. Use the ClawHub account reserved for Xentropy under D-2, signed in with the GitHub account that owns or belongs to `xentropyai`. ClawHub only lets "a GitHub account old enough to pass the upload gate" publish; the minimum age is not documented, so reserve the account early.
2. From a clean checkout of `xentropyai/xentropy-plugins` at the commit you are releasing, check the skill:

   ```
   node openclaw/build-skill.mjs          # regenerate from the generated xentropy-artifacts skill
   git diff --exit-code openclaw/skills    # no drift
   node --test "openclaw/test/*.test.mjs"  # frontmatter, no-scripts rule, https URLs
   ```

3. Read `openclaw/skills/xentropy/SKILL.md` once more. It must stay a single text file: no scripts, no install steps for the agent, and the only commands are the user setup commands (`openclaw mcp add ...`, `openclaw mcp login xentropy`).

## Publish

```
clawhub login
clawhub skill publish ./openclaw/skills/xentropy --slug xentropy --version 1.0.0
```

Optional flags: `--name "Xentropy"` (display name) and `--changelog "First release"`.

ClawHub then runs its automated checks (the skill page shows VirusTotal, ClawScan and static-analysis results). A scan-held or blocked release disappears from the public catalog and install surfaces and stays visible to you in the dashboard. If it is held, read the finding, fix the text, and publish a new patch version; do not ask users to bypass the hold.

After it is live:

- Install it on a test Gateway as its ClawHub page describes and run the P7 live test: `openclaw mcp add ...`, `openclaw mcp login xentropy`, one read call, one write call. Record whether the Gateway registered with DCR (CIMD is not mentioned in OpenClaw's docs) in the API logs.
- Link the ClawHub page from https://docs.xentropy.ai/agents/clients/openclaw.
- For updates, bump `metadata.version` in `openclaw/build-skill.mjs`, rebuild and publish with a new `--version`.

## Typosquat note

ClawHub has a history of malicious skills (the ClawHavoc campaign and later incidents) that impersonate popular names and tell the agent to run install commands. To protect users:

- Publish the bare slug `xentropy` first, before announcing the skill anywhere.
- Consider also holding obvious lookalikes (`xentropy-ai`, `xentropyai`, `xentropy-mcp`) as unlisted placeholders that point to the real slug, if ClawHub's rules allow it.
- Our skill never runs code. Any skill using the Xentropy name that runs `curl`, `npx`, shell pipes or installers, or asks for an API key in chat, is not ours: report it from the ClawHub page (signed-in users can report skills) and say so on the docs page.
- The real MCP endpoint is only `https://api.xentropy.ai/mcp`; a skill pointing anywhere else is not ours.
