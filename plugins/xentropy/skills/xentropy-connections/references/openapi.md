## OpenAPI

Reads JSON from selected GET operations of an OpenAPI 3.0, 3.1 or 3.2
specification. Legacy REST JSON connections still read, but new ones are
refused (`OPENAPI_REQUIRED`): use OpenAPI.

- `connections_create {configuration: {type: "openapi", name, headers,
  openapi: {specUrl, operations, serverUrl?, securityArm?, bindings}},
  idempotencyKey}`. The server fetches the specification (HTTPS, ≤32 MiB, no
  redirects) and stores only the selected operations and their schemas
  (≤1 MiB). An inline `openapi.document` (≤1 MiB) also works.
- `securityArm`: `"anonymous"` or the scheme name(s) (`a+b`); every header
  that arm requires must be in `headers`, injected from the secret
  environment.
- A binding is `{operationId, collectionPath?, pagination?, fields?, accept?,
  completeCollection?}`. `fields` are dotted paths (≤6 segments, ≤100), e.g.
  `user.login`; objects/arrays become JSON text. Default: top-level scalars
  plus first-level object scalars.

Pagination `kind` (each may add `sizeParam` + `pageSize` 1–1000):
- `cursor` / `offset`: `nextPath` + `parameter`; ends on null/empty.
- `next-link`: `nextPath` holds the next URL.
- `link-header`: RFC 8288 `rel="next"`; ends without a next link
  (`linkQueryOnly` follows only its query).
- `page-number`: `pageParam`, `sizeParam`, `pageSize`; a short page ends
  only with `totalPath` or `completeCollection: true`.
- `last-item-cursor`: `cursorParam`, `itemCursorPath`, `hasMorePath`
  (boolean on every page).
Without pagination a single response is complete only with
`completeCollection: true`.

Presets (defaults only, still validated): GitHub (`link-header`,
`per_page` 100, `X-GitHub-Api-Version: 2022-11-28`; e.g.
`issues/list-for-repo`), Stripe (`bearerAuth`, collection `data`,
`last-item-cursor` `starting_after`/`id`/`has_more`, `Stripe-Version` from
the spec; `GetCustomers`, `GetCharges`, `GetInvoices`), Docker Hub
(`bearerAuth`, collection `results`, `next-link` `next`, total `count`).
Prefer read-only tokens (Stripe restricted keys).

Reading: `data_datasets_discover {connectionId}` lists bound operations with
fields, parameters and `complete`. Previews read at most 2 pages.
- Budgets: Free 50 / Pro 500 pages, 120 s, 5 MiB, 50,000 rows.
- `RATE_LIMITED` (429, or 403 with `x-ratelimit-remaining: 0` /
  `Retry-After`) carries `details.retryAt`: wait, never loop.
- `INCOMPLETE_DATA` means completeness could not be proven (missing
  termination field, cycle, page budget): fix the binding, do not present
  partial rows.
- `SCHEMA_CHANGED`: the response drifted from the stored schema; re-import.
- `PROVIDER_UNAVAILABLE` carries `details.httpStatus`.
- `VALIDATION_EXPIRED`: the connection changed mid-read; retry.
