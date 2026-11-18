# Sharing and publication

Sharing needs the opt-in `artifacts:share` scope and publication needs
`artifacts:publish`; neither is part of the standard agent connection, which
covers create, edit, export (`artifacts:render`) and saved datasets
(`data:write`). Without the scope these tools are not listed. Check
`artifacts_capabilities.actions.share` / `.publish` first; if false and the
user explicitly asked to share or publish, tell them to reconnect Xentropy and
approve that scope (or use a key that holds it).

## Share links

`artifacts_share_create({artifactId, revisionId?, fileIds?, expiresInDays,
allowSource, allowRemix, allowEmbed, richPreview, idempotencyKey})` creates an
expiring unlisted bearer link. The response carries the secret URL once —
`url: {appOrigin}/share/{token}` — and only the hash is stored. Listing shares
(`artifacts_shares_list`) shows metadata and expiry state but can never
recover the secret. Revoke with `artifacts_share_revoke`; revocation stops
future delivery but cannot recall external copies.

Remixing requires explicit source access (`allowRemix` implies
`allowSource`).

## Publication

`artifacts_publish({artifactId, slug, title, ...})` publishes selected frozen
outputs to the public gallery. The slug must be unique and URL-safe; conflicts
return `SLUG_TAKEN`. The public view is served at
`/api/v1/public/artifacts/{slug}` with files at
`/api/v1/public/artifacts/{slug}/files/{fileId}`, and oEmbed discovery at
`/api/oembed`. `artifacts_unpublish` requires the current
`expectedPublicationId` when one exists.

Publication is public and indexed discovery. Review title, description,
attribution, license and selected files before publishing, and only on
explicit user instruction.
