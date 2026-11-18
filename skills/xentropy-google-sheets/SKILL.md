---
name: xentropy-google-sheets
description: "Reads, creates and updates spreadsheets through a Google Sheets connection in Xentropy and binds ranges as datasets. Use when the user wants to chart, read or write a Google Sheets spreadsheet through Xentropy."
license: MIT
compatibility: "Requires the Xentropy MCP server (https://api.xentropy.ai/mcp) connected as \"xentropy\"."
metadata: {"version":"1.0.0","source":"xentropy","hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"primaryEnv":"XENTROPY_API_KEY"}}
---

# Google Sheets connection

Operate spreadsheets through the user's connected google-sheets integration.
Every call addresses a connection by `connectionId` (from `connections_list`)
and a `fileId` from that connection's selected resources.

## Read

- `sheets_metadata {connectionId, fileId}` — spreadsheet shape and sheet titles.
- `sheets_read {connectionId, fileId, range}` — cell values for an explicit A1
  rectangle. Ranges are bounded: at most 100 columns and 10,000 cells per
  request, always a rectangle (never unbounded columns). Read separate ranges
  for a larger sheet.

## Write

- `sheets_create {connectionId, title}` — new spreadsheet.
- `sheets_update {connectionId, fileId, range, values}` — overwrite cells;
  `values` is a 2-D array of strings, numbers, booleans or nulls; a null or
  `""` cell clears that cell. Every write returns `updatedRows`,
  `updatedColumns` and `updatedCells`; a `NO_CELLS_WRITTEN` warning means
  nothing changed, so read the range back before reporting success.
- `sheets_append {connectionId, fileId, range, values}` — append rows after
  the range.

Writes to the user's spreadsheets are visible to collaborators; confirm intent
before overwriting ranges.

## Dataset workflow

When a sheet feeds a chart or table:

1. Read the range and check the header row: dataset field selection requires a
   unique, non-empty header of strings.
2. Use `data_preview_definition` to refine a provider definition, then
   `data_datasets_create` to save it, or pass `source: {definition, mode}`
   directly to `artifacts_create`. A saved dataset can bind into an artifact with `mode: "live"` (re-reads on
   refresh) or `mode: "snapshot"` (frozen capture).
3. If a column used by a live artifact is renamed or removed in the sheet,
   refresh fails with `SCHEMA_CHANGED` — re-check the header rather than
   retrying blindly. A field that never existed is `VALIDATION_FAILED` with
   the offending `issues[].path`.
4. A file ID that is not among the connection's selected resources is
   `PERMISSION_DENIED`, whether or not the file exists.

## Setup

This skill uses the tools of the Xentropy MCP server (`https://api.xentropy.ai/mcp`), named
here as the server names them; some agents show them with a server prefix.
Which tools are listed depends on the scopes approved for the connection, and
the `get_skill` tool returns this skill as it applies to the current
connection. How to connect an agent: https://docs.xentropy.ai/agents
