---
name: xentropy-google-drive
description: "Lists, downloads, uploads and manages files through a Google Drive connection in Xentropy and binds CSV or JSON files as datasets. Use when the user wants to chart or manage a CSV or JSON file stored in Google Drive through Xentropy."
license: MIT
compatibility: "Requires the Xentropy MCP server (https://api.xentropy.ai/mcp) connected as \"xentropy\"."
metadata: {"version":"1.0.0","source":"xentropy","hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"primaryEnv":"XENTROPY_API_KEY"}}
---

# Google Drive connection

Operate files through the user's connected google-drive integration. Every
call addresses a connection by `connectionId` (from `connections_list`) and a
`fileId` from that connection's selected resources.

## Discover

- `drive_list {connectionId, pageSize?, pageToken?}` — paginated file listing.
- `drive_metadata {connectionId, fileId}` — name, mimeType, size.

## Read

- `drive_download {connectionId, fileId}` — base64 bytes; CSV, JSON and plain
  text are the formats the data module can bind.
- `drive_export {connectionId, fileId, mimeType}` — export a Google-native
  file into a concrete format.

- `drive_upload {connectionId, name, mimeType, base64}`,
  `drive_create {connectionId, name, mimeType, base64?}`,
  `drive_update {connectionId, fileId, name?, base64?, mimeType?}` — manage
  files. Uploads are visible in the user's Drive; confirm intent before
  overwriting.

## Dataset workflow

1. `drive_download` a CSV or JSON file and inspect its shape.
2. Define the dataset over the Drive file resource, then bind it into an
   artifact with `mode: "live"` (re-downloads on refresh) or
   `mode: "snapshot"` (frozen capture).
3. Only CSV, JSON and text files can back datasets; other mime types fail
   validation with a clear message.

Large files are bounded by the dataset limits (5 MiB, 50,000 rows, 100
columns); prefer snapshots for big historical files and live bindings for
files that legitimately change.

## Setup

This skill uses the tools of the Xentropy MCP server (`https://api.xentropy.ai/mcp`), named
here as the server names them; some agents show them with a server prefix.
Which tools are listed depends on the scopes approved for the connection, and
the `get_skill` tool returns this skill as it applies to the current
connection. How to connect an agent: https://docs.xentropy.ai/agents
