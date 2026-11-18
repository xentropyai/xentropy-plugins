# Tool workflows

## Create a chart from raw data

```json
{"idempotencyKey":"create-01","title":"Monthly revenue","kind":"chart",
 "spec":{"schemaVersion":1,"type":"bar","x":"month","y":["value"]},
 "source":{"raw":{"csv":"month,value\nJan,1\nFeb,2\n"}}}
```

## Create a live-bound chart from a dataset

```json
{"idempotencyKey":"create-live-01","title":"Sales","kind":"chart",
 "spec":{"schemaVersion":1,"type":"line","x":"month","y":["value"]},
 "source":{"dataset":{"datasetId":"DATASET_UUID","mode":"live"}}}
```

`artifacts_refresh({artifactId, idempotencyKey})` then re-materializes the
source into a new revision.

## Create a table and export csv

```json
{"idempotencyKey":"create-table-01","title":"Sales table","kind":"table",
 "spec":{"schemaVersion":1,"columns":[{"fieldId":"month"},{"fieldId":"value"}],
         "sort":{"fieldId":"value","direction":"desc"},"limit":100},
 "source":{"raw":{"csv":"month,value\nJan,1\nFeb,2\n"}}}
```

`artifacts_export({artifactId, format:"csv", idempotencyKey})` completes
inline for csv/json; for png/svg poll `artifacts_jobs_get` until completed,
then `artifacts_output_get({fileId, thumbnail:true})`.

## Update an artifact

1. `artifacts_get({artifactId})` returns `artifact`, `revision`, materialization
   preview and files.
2. Send `artifacts_update` with the returned `artifact.version`:

```json
{"artifactId":"RETURNED_ARTIFACT_ID","expectedVersion":RETURNED_VERSION,
 "idempotencyKey":"title-update-01","metadata":{"title":"A clear new title"}}
```

Metadata is a patch: only the keys you send change (`tags: []` clears tags).
Metadata-only updates add no revision but increment `version`. Spec-only
updates reuse the materialization; include `source` to bind different data
(this re-materializes). A stale version returns `VERSION_CONFLICT` with
`details.currentVersion` and `details.headRevisionId`: re-read, then reapply.

## Recovery

- `VALIDATION_FAILED`: correct the indicated paths and retry with a new key.
- `VERSION_CONFLICT`: re-read the head, compare intent, then reapply against
  the current revision.
- `IDEMPOTENCY_CONFLICT`: the key was reused with a different body. Preserve
  the original key/body for delivery retries; use a new key for a new action.
- 429/503: retryable; back off and retry with the same key for mutations.
- Revoked/expired credential: reconnect with a valid scoped credential. Never
  ask for a plaintext secret in chat.
