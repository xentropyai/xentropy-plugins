# R1-5 plugin repo copy accuracy (branch copy/accuracy, not pushed)

## Changed
- `test/copy.test.mjs` (new): GA only in `xentropy-google-analytics/` unless the line says "coming soon"; GA skill description (skills/ and plugins/xentropy/skills/) contains "coming soon"; no "every source is read-only"; no `\bREST\b`; case-sensitive no `Cursor` / `VS Code` / `Visual Studio Code` (`nextCursor` passes); no `MP4` / `Motion`; plugin metadata descriptions start with "Xentropy is the analytics workspace for AI agents."
- Skills synced with `node scripts/sync-skills.mjs /root/xentropy/ui-wc-release` (ui tag web-copy-r1): connections description drops GA, connections table marks GA "coming soon on xentropy.ai, not yet available", GA skill description "Describes the Google Analytics connection, which is coming soon ...". `--check` reports up to date. openclaw/pi skill copies unchanged (built from other skills; H-D14 green).
- `hermes/plugin-catalog/xentropy.yaml`: description starts with the category line, GA removed from the source list.
- `hermes/PR.md`: PR body sentence aligned (category line, GA removed).
- `plugins/xentropy/plugin.json`, `plugins/xentropy/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` plugin entry: description = "Xentropy is the analytics workspace for AI agents. Create data-backed charts, tables and dashboards from your own data through the Xentropy remote MCP server." (validator requires the two plugin.json descriptions equal; it does).

## Results
- red.log: 3 failures (GA listed in hermes yaml/PR.md/connections skill; GA description lacks "coming soon"; category line missing).
- green.log: copy test 7 pass + 1 todo; `npm test` 32 pass / 0 fail / 1 todo; `npm run validate` valid; `hermes/check.mjs` exit 0; sync `--check` up to date.

## Deviations / open items
- Upstream: the generated `xentropy-connections` skill still says "Every source is read-only." (ui `packages/skills`, not owned here). Hand-editing generated files would break the sync contract, so that check for generated skills is a `todo` test (reports, does not fail). Fix in the monorepo, re-sync, then drop `todo`.
- "REST" check covers hand-written files only. Generated skill references use it technically ("Legacy REST JSON connections", "REST tile read", egress IP API) — not a product claim; owned upstream.
- GA skill test requires "coming soon" anywhere in the description (validator needs a third-person verb first), not a "Coming soon" prefix as the plan text says.
- `evidence/` is in `.gitignore` and commit 31512e4 moved QA evidence out before the repo goes public. These logs were force-added because the task requires them on the branch; drop or move them to the monorepo before any push.
- `hermes/optional-mcps/xentropy/manifest.yaml` description left as is (accurate, MCP catalog entry, not plugin metadata).
