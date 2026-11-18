---
description: Create a Xentropy chart from your data
argument-hint: "<what to chart, and from which data>"
---

Create a Xentropy chart for this request: $ARGUMENTS

Follow the xentropy-artifacts skill. Find the data first: an existing dataset
(`data_datasets_list`), a connection (`connections_list`), or rows the user gave
inline. Check `artifacts_capabilities` for the chart types, preview the data with
`data_preview` or `data_preview_definition`, then create the chart with
`artifacts_create` and a new `idempotencyKey`. Reply with the chart's title,
its link and a one-line summary of what it shows. If no data matches the
request, ask the user which source to use instead of inventing numbers.
