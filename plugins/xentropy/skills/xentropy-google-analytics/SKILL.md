---
name: xentropy-google-analytics
description: "Describes the Google Analytics connection, which is coming soon on xentropy.ai and not yet available: once enabled it turns GA4 reports into Xentropy datasets, charts and dashboards (read-only). Use when the user asks about Google Analytics data, to explain that the connection is not available yet."
license: MIT
compatibility: "Requires the Xentropy MCP server (https://api.xentropy.ai/mcp) connected as \"xentropy\"."
metadata: {"version":"1.0.0","source":"xentropy","hermes":{"requires_toolsets":["mcp-xentropy"]},"openclaw":{"primaryEnv":"XENTROPY_API_KEY"}}
---

# Google Analytics connection

Read GA4 reports through the user's connected google-analytics integration.
Access is read-only. A report may only target a property listed in the
connection's selected resources (`connections_list` → `resources`, ids like
`properties/123`); any other property is `PERMISSION_DENIED`. If there is no
Google Analytics connection, ask the owner to open
`/connections/new?provider=google-analytics` — OAuth consent happens in the
browser, never over MCP.

## Start from a template

`data_datasets_discover {connectionId}` returns ready-made report datasets per
selected property (traffic over time, acquisition by channel, top pages, key
events, devices & countries, e-commerce revenue). Each item carries a complete
`resource.report`; pass it unchanged to `data_preview_definition` or
`data_datasets_create` with `provider: "google-analytics"`.

## Build a custom report

The owner can also build one without an agent: the Google Analytics
connection's detail page in the app has a report builder (property, searchable
dimensions and metrics with custom definitions marked, date range, a
compatibility check, then preview and save as a dataset). Suggest it when the
user would rather click than describe a report. Over MCP:

1. `analytics_metadata {connectionId, property}` (or `data_schema`) lists the
   property's dimensions and metrics, including custom definitions
   (`customEvent:*`, `customUser:*`). Use only names it returns.
2. `analytics_compatibility {connectionId, property, dimensions, metrics}`
   reports fields that cannot be combined; fix them before saving.
3. A report has `property`, up to 9 dimensions, 1–10 metrics, 1–4
   `dateRanges`, optional `dimensionFilter`/`metricFilter`, `orderBys` and a
   `limit` (default 10,000, max 50,000 rows).

## Dates and freshness

- Prefer relative dates (`28daysAgo` … `yesterday`) so live artifacts move
  forward on refresh. Absolute dates are `YYYY-MM-DD`.
- GA data settles within 24–48 hours; end ranges at `yesterday` unless the user
  asks for today. Dates use the property's time zone (see the field
  `timezone`); currency metrics carry the property currency as `unit`.

## Disclosures and limits

- Captures may carry `warnings`: `GA_THRESHOLDED` (Google withheld rows to
  protect privacy), `GA_SAMPLED` (estimates), `GA_OTHER_ROW` (rows grouped
  into "(other)") or `GA_EMPTY`. Tell the user when a chart is affected —
  never present thresholded or sampled numbers as exact.
- Quotas are per property and shared by every Xentropy instance.
  `RATE_LIMITED` means the hourly or daily quota is used up (or nearly, for
  scheduled refreshes): refreshes wait for the next hour, or midnight Pacific
  time for the daily quota, and the previous capture stays visible. Do not
  retry in a loop.
- `PROVIDER_ACCESS_DENIED` (403, not retryable) is different from quota:
  Google denied API access to the property (the account lost access, or the
  property disallows API access). The connection's health shows "property
  access denied". Do not retry or wait; ask the owner to restore the Google
  account's access to the property, then reconnect.
- `PROVIDER_QUERY_INVALID` quotes Google's validation message — usually an
  unknown or incompatible field. `PROVIDER_FILE_NOT_FOUND` means the
  property does not exist.
- `INCOMPLETE_DATA` on a large report means GA data changed while it was
  paged (10,000 rows per page; relative dates are pinned once per read and the
  row count must stay equal); retry the read.
- Several `dateRanges` add a string column `date_range`.

## Setup

This skill uses the tools of the Xentropy MCP server (`https://api.xentropy.ai/mcp`), named
here as the server names them; some agents show them with a server prefix.
Which tools are listed depends on the scopes approved for the connection, and
the `get_skill` tool returns this skill as it applies to the current
connection. How to connect an agent: https://docs.xentropy.ai/agents
