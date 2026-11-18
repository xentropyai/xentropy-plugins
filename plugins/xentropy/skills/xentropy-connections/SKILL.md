---
name: xentropy-connections
description: "Connects and reads the user's data sources (PostgreSQL, OpenAPI, Google Sheets, Google Drive, Google Analytics) as Xentropy datasets. Use when the user wants to connect a data source to Xentropy, see what a connection offers, preview or save data as a dataset, or recover from a connection or data error."
license: MIT
compatibility: "Requires the Xentropy MCP server (https://api.xentropy.ai/mcp) connected as \"xentropy\"."
metadata: {"version":"1.0.0","source":"xentropy","hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"primaryEnv":"XENTROPY_API_KEY"}}
---

# Connections

Discover, create and read the user's data sources. Every source is read-only.

## Kinds

| Provider id | Source | Set up as |
| --- | --- | --- |
| `postgres` | PostgreSQL database (selected tables/views) | Credential connection (password) |
| `openapi` | GET operations of an OpenAPI spec | Credential connection |
| `google-sheets` | Google Sheets spreadsheets | Owner consent in the browser |
| `google-drive` | Google Drive CSV/JSON files | Owner consent in the browser |
| `google-analytics` | Google Analytics reports | Owner consent in the browser |
| `raw` | Inline rows or CSV | Dataset definition only |

`http-json` (REST JSON) is legacy: existing connections read, new ones are
refused. The table lists only the kinds this deployment enables; call
`data_providers_list` for live availability and use only available providers.
`PROVIDER_DISABLED` (422) means off on this deployment; do not retry.
`FEATURE_DISABLED` (422, `details.feature`) means a deployment feature is switched off;
do not retry.
`CONNECTION_DISABLED` (409, `details.connectionId`) means the owner disabled that connection; ask
them to re-enable it in the app. `RECONNECT_REQUIRED` means its credentials expired or were revoked.

## Discover

- `connections_list` — the user's connections, most recently updated first:
  type, status, health, `updatedAt` and selected resources, paged with
  `nextCursor` (limit 1–50). Use only connections with
  status `connected`; `disabled` ones were disconnected and must be
  reconnected in the app.
- `data_datasets_discover {connectionId}` — what a connection offers (for
  example selected relations, bucket objects with format hints, API operations
  with fields, or report templates).

## Create

- `connections_create {configuration, idempotencyKey}` verifies and saves a
  credential connection; reuse the key on retry. Machine keys need
  `connections:manage` and no connection allowlist. Inject passwords, secret
  keys and headers from the client's secret environment programmatically;
  never ask for them or paste them into chat. The result is redacted metadata
  only. For Google kinds it returns `status: "action_required"` with `links.authorize` for the owner to open.

Security is fixed, not configurable: TLS is always verified (a private CA can
be added as `tlsCA`), hosts must resolve to public addresses (private ranges
are refused, the address is pinned against DNS rebinding), redirects are never
followed, and reads are read-only in code as well as at the source. Owners
allowlist Xentropy's egress IPs in their firewalls.

## Per-kind guides

Read the guide for a kind before connecting or reading it:

- [Databases (PostgreSQL)](references/databases.md)
- [OpenAPI](references/openapi.md)

## Use data

- `data_schema {definition}` — typed fields without saving.
- `data_preview_definition {definition}` — up to 100 rows of an unsaved
  definition after its declarative filters, groups and aggregates
  (`count`, `count_distinct`, `sum`, `min`, `max`, `mean`).
  `query.limit` keeps the first N rows after `sort`.
- `data_datasets_bind {definition, idempotencyKey}` — bind a connection
  resource (no query) as a reusable dataset with inferred fields.
- `data_datasets_create {definition, idempotencyKey}` — save a definition
  (raw rows, uploads, or a resource with a query). Requires `data:write`;
  source reads also need `connections:read` or the kind's read scope
  (`postgres:read`, `http:read`, …).
- `data_datasets_list` / `data_datasets_get` / `data_preview` — saved
  datasets and the first 100 rows of the current capture, with `rowCount`,
  `matchedRows` and `complete` (never present a truncated total as complete).
- `data_datasets_delete {datasetId, expectedVersion, permanent: true,
  idempotencyKey}` — only on the user's explicit intent; fails
  `DATASET_IN_USE` (`details.live`, `details.trashed`) while a live
  artifact's current revision reads it. Trashed artifacts that read it are
  detached (`detachedTrashedArtifacts`): they still restore, but refresh and
  export fail `SOURCE_MISSING` until `artifacts_update` gives them a new source.

Datasets bridge connections and artifacts: bind them into a chart or table
with `mode: "live"` (refreshable) or `mode: "snapshot"`. See the artifacts
skill.

## Limits and recovery

- Every read is bounded (100 fields, 50,000 rows, 5 MiB) and is complete or
  fails; there are no silent truncations.
- `PROVIDER_UNAVAILABLE` (503, `details.provider`, `details.stage`):
  retryable; retry later.
- `RATE_LIMITED` (429, `details.retryAt`): wait until then; scheduled
  refreshes defer automatically.
- Stage-coded errors (`*_DNS`, `*_NETWORK_POLICY`, `*_TCP`, `*_TLS`,
  `*_AUTH`, `*_PERMISSION`) need the owner to fix the source, then
  replace the connection's configuration in the app (an omitted secret is kept
  only for the same destination and identity). Do not retry unchanged.
- `INCOMPLETE_DATA` / `LIMIT_EXCEEDED`: narrow the source (a view, prefix,
  glob or query); never stitch partial reads together.
- `SOURCE_CHANGED`: the object or file changed during or after the saved
  revision; retry, or read the current revision.
- `CONNECTION_TYPE_UNSUPPORTED`: this deployment cannot read the stored kind;
  recreate the connection.
- A failed refresh keeps the previous capture; tell the user the data is stale.

## Hygiene

- Resources are selected per connection; reads fail closed
  (`PERMISSION_DENIED`) when a resource is deselected mid-flight.
- Connection creation is denied for connection-allowlisted keys and never
  broadens an existing allowlist. Existing keys gain no new scopes.

## Setup

This skill uses the tools of the Xentropy MCP server (`https://api.xentropy.ai/mcp`), named
here as the server names them; some agents show them with a server prefix.
Which tools are listed depends on the scopes approved for the connection, and
the `get_skill` tool returns this skill as it applies to the current
connection. How to connect an agent: https://docs.xentropy.ai/agents
