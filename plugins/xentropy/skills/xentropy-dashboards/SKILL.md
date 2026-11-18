---
name: xentropy-dashboards
description: "Composes Xentropy artifacts into dashboards with a consistent theme, cadence and freshness labels, using the Xentropy MCP tools. Use when the user asks for a dashboard, report page or overview that combines several charts or tables, or wants to edit, trash or restore a Xentropy dashboard."
license: MIT
compatibility: "Requires the Xentropy MCP server (https://api.xentropy.ai/mcp) connected as \"xentropy\"."
metadata: {"version":"1.0.0","source":"xentropy","hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"primaryEnv":"XENTROPY_API_KEY"}}
---

# Dashboards

A dashboard is a private saved grid of artifact references. Discover with
`dashboards_capabilities`; read the exact document schema and limits.
Dashboard read/write scopes manage composition; artifact read/write scopes
are independently required for chart/table content. Restricted dashboard keys
are read-only. Provider access is required only for content operations that read
that provider, never to render an authorized saved materialization.
Limits: `limits.tilesPerDocument` (100) caps the tiles in one document.
`limits.tilesPerRead` (8) caps only one REST tile read
(GET /dashboards/:id/tiles); it never limits create or update.

## Compose and maintain

1. `dashboards_list` searches the entire authorized collection; follow cursors.
2. `dashboards_get` returns the complete document, current version, references,
   resolved revisions and independent capture times, without raw artifact data.
3. Inventory `artifacts_list` and inspect `artifacts_get`.
   Create missing chart/table content with `artifacts_create`; edit shared
   content with `artifacts_update` and the artifact's current expectedVersion.
4. Compose schemaVersion 1 with stable UUID tile IDs. Each tile references an
   artifactId and binding {mode:"head"} or {mode:"revision",revisionId}.
   Every tile needs one nonoverlapping integer placement in a 12-column grid.
   Keep tiles in layout reading order (y, x, tileId). No arbitrary code/URLs.
5. `dashboards_create` saves title, optional description and document (or
   an empty grid). `dashboards_update` saves metadata or a COMPLETE replacement
   document with expectedVersion. Include every retained tile and placement.
6. Re-get to verify saved layout and tile states. Report the dashboard route
   /dashboards/{id} and any unavailable tiles. Use artifact exports only when
   actual output inspection is needed, not to compose the grid.

## Consistency and honest data

Use a unique stable idempotencyKey per mutation and reuse it only for identical
retries. On VERSION_CONFLICT, re-get, reconcile with the new version and use a
new key. Never overwrite an unseen layout. Old retries return their original
saved version; re-get before another edit.

A head binding follows saved artifact revisions; it does not refresh a provider.
A pinned binding freezes revision data/spec, not permissions or mutable title.
Each tile shows its own capturedAt: never imply all tiles refreshed together.
Align units, time windows and palette deliberately; preserve zero and missing
values honestly. Editing a shared artifact affects all head-bound uses. For
independent content, create a separate artifact. Removing a tile only detaches
it and never trashes/deletes the artifact.

## Remove a dashboard

Only when the user asks. `dashboards_trash` with the current expectedVersion
hides it from the default list (re-trashing is a no-op); `dashboards_get` still
reads it with trashedAt, edits return INVALID_STATE; `dashboards_restore` undoes
it (find it with `dashboards_list` trashed:true).
`dashboards_delete` is permanent and only works on a trashed dashboard with
permanent:true; confirm explicit intent first.
None of these touch the referenced artifacts.

Artifact writes and dashboard saves are separate operations. If attachment
fails after artifact creation, retain/report/reuse that private artifact; never
automatically delete it or claim this workflow is one transaction.

## Setup

This skill uses the tools of the Xentropy MCP server (`https://api.xentropy.ai/mcp`), named
here as the server names them; some agents show them with a server prefix.
Which tools are listed depends on the scopes approved for the connection, and
the `get_skill` tool returns this skill as it applies to the current
connection. How to connect an agent: https://docs.xentropy.ai/agents
