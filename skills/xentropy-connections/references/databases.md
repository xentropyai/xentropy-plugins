## Databases (PostgreSQL)

The engine is the connection `type` (`postgres`); the console groups them under one "Database" entry. Each reads
only the relations selected on the connection, over TLS that is always
verified (no "disable TLS" or "trust server certificate" option exists). Hosts
must be public; private and reserved addresses are refused
(`*_NETWORK_POLICY`). The owner creates a dedicated read-only principal (the
console form shows the SQL) and allows Xentropy's egress IPs (REST
`GET /api/v1/data/providers` → `egressIps`) in the database firewall or
network policy.

- PostgreSQL: CONNECT, USAGE on the schema, SELECT; reads run in
  `BEGIN READ ONLY`; host rules live in `pg_hba.conf`.

- PostgreSQL: `connections_create {configuration: {type: "postgres", name,
  host, port (5432), database, user, password, tlsCA?, relations:
  [{schema, table}]}, idempotencyKey}`.
- At least one relation is required (≤100); saving probes each (a zero-row
  SELECT), so a missing grant fails by name.

Reading:
- `data_datasets_discover {connectionId}` lists the selected relations;
  `data_schema` returns typed fields. Bind with resource
  `{schema, table}`.
- Types: integers/floats → number; `bigint`/`numeric`/`DECIMAL`/money
  beyond 15 digits or with a scale → decimal (exact string); `date` → date;
  zone-aware timestamps → datetime UTC; zone-less ones → datetime in the
  connection's `timeZone`; `TINYINT(1)`/`bit` → boolean. JSON columns
  flatten object columns to `col.key` fields (≤4 levels); binary and spatial
  types are excluded.
- Limits: 50,000 rows, 5 MiB and 100 fields per read; 25 s statement budget,
  30 s read deadline. A larger relation fails `INCOMPLETE_DATA`: ask the owner
  for a bounded view, never page around it. Over budget is
  `BUDGET_EXCEEDED`. PostgreSQL filters on `timestamp without time zone` columns fail `TIMEZONE_REQUIRED`.
- Stage errors (`POSTGRES_<STAGE>`), in the order they are checked:
  `DNS` (hostname or account), `NETWORK_POLICY` (private
  address), `TCP` (port/firewall/egress IPs), `TLS` (enable TLS, paste the
  CA, certificate must name the host), `AUTH` (password, host rule,
  database, Entra tenant/client/secret, or the key not registered),
  `PERMISSION` (grant SELECT or deselect). These need the owner to fix the source or replace the
  configuration; do not retry unchanged.
