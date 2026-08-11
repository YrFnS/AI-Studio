# P0 Product-Correctness Evidence

Status: **IMPLEMENTED — LIVE EVIDENCE STILL PENDING**  
Branch: `agent/p0-runtime-integrity`  
Pull request: #4

## Implemented scope

The product-correctness slice completes the remaining local data and browsing fixes in P0:

- Browser-native, versioned backup and restore for non-key IndexedDB data.
- Backup coverage for generations, prompts, collections, collection membership, reference images, custom and discovered model definitions, and generated media assets.
- Separate API-key transfer flow; normal backups reject unexpected key material.
- Replace and merge restore modes that preserve existing provider keys.
- Media validation for decoded size, declared size, base64 integrity, and supported image/video MIME types.
- Accurate Settings privacy wording describing IndexedDB storage and same-origin POST forwarding to the running AI Studio instance.
- Queue cleanup that removes only terminal entries and preserves `pending` and `processing` work.
- Gallery search across the complete filtered IndexedDB dataset before pagination.
- Search coverage for prompt, negative prompt, provider, model, media type, and generation status.
- Debounced Gallery search with stale-response protection.
- Removal of placeholder Settings export/import routes that did not serialize local browser data.

## Automated validation

The one-time migration workflow applied the exact checksum-verified bundle and passed:

- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build:app`

The workflow removed its migration archive, chunk files, runner scripts, and write-enabled workflow before committing the validated source changes.

Permanent regression tests cover:

- Backup format parsing and version enforcement.
- API-key exclusion.
- Blob serialization and restoration.
- Replace and merge behavior.
- Queue terminal-entry cleanup.
- Full-dataset Gallery search.
- Product-correctness source ownership and removal of placeholder routes.

## Remaining evidence

This slice does not close the live P0 gates. P0 still requires owner-supplied-key evidence for provider contracts, cancellation, asynchronous image/video restart recovery, and authenticated protected-media restart/reopen behavior.
