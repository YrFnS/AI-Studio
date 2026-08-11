# P0 Runtime Integrity

Status: **IN PROGRESS**  
Branch: `agent/p0-runtime-integrity`  
Base: `main`

## Objective

Make generation submission, provider routing, polling, persistence, cancellation, recovery, protected-output storage, and request handling deterministic before adding more providers or visual features.

P0 is complete only when each request has one durable lifecycle, every exposed provider/model/operation has an executable and evidenced contract, credentials are handled honestly, and supported asynchronous work survives page and local-server restarts.

## Completed implementation

### One persistence and transport path

- Removed the duplicate `GenerationRuntimeBridge` persistence path.
- Removed global `window.fetch` replacement.
- Added `src/lib/generation-client.ts` as the explicit browser transport for generation, polling, protected-media, and cancellation requests.
- Provider keys are read from IndexedDB and added only to same-origin POST bodies when required.
- Added source coverage that rejects browser generation callers which bypass the explicit client.

### One typed generation lifecycle

- Added `src/lib/generation-lifecycle.ts` as the owner of:

  `begin → submit → mark processing → poll → finalize media → complete/fail/cancel`

- Immediate and asynchronous results share one terminal persistence path.
- Queue state is connected through a small port rather than coupled directly to Zustand.
- Lifecycle handles provide immutable snapshots, result promises, provider-job metadata, durable Gallery IDs, page detachment, interrupted-job recovery, and idempotent cancellation.
- Protected output download and local persistence finish before a lifecycle reaches `completed`.

### Generation surfaces migrated

- Model Compare gives every slot its own lifecycle handle and durable record.
- Image Studio, Video Studio, and Cinema Studio no longer own raw provider jobs, polling intervals, manual queue updates, or duplicate persistence branches.
- Image Editor and Editor Controls share `use-editor-generation.ts`.
- Upscale, variation, improve, edit, inpaint, and image-to-video use typed lifecycle handles, dedicated routes, durable parent relationships, and visible cancellation.
- Cinema scene-preset text is appended once.

### Authoritative provider/model/operation registry

- Added `src/lib/generation-registry.ts` as the executable source of truth.
- Registered operations distinguish text-to-image, image-to-image, edit, inpaint, variation, upscale, text-to-video, and image-to-video.
- Every contract owns an operation, route, adapter ID, and evidence level: `adapter-implemented`, `contract-reviewed`, or `live-verified`.
- `/api/providers` filters the raw catalog through the registry; capability labels cannot expose an operation by themselves.
- Generation routes enforce the matching contract before provider contact.
- Image, Video, and Cinema selectors react to the active operation and reset incompatible selections.
- Arbitrary custom or discovered models cannot bypass registry review.
- IndexedDB version 7 stores draft, approved, revoked, and rejected local model-registration records.
- Settings → Review keeps custom and discovered definitions inert until they are mapped to a source-defined bounded adapter profile.
- Approval requires an HTTPS documentation URL, meaningful review notes, and explicit acknowledgement; it records `contract-reviewed`, never automatic live verification.
- The explicit generation client exposes only approved registrations and attaches the matching evidence to the exact provider/model/operation request.
- Generation routes revalidate the registration, adapter profile, model-ID rule, operation, and route before provider contact.
- Static catalog entries cannot be shadowed or broadened by local approval, and providers without a bounded profile remain metadata-only.
- Approved records remain manageable after discovery-cache expiry and can be revoked from selector access.
- No contract is labeled `live-verified` without an owner-key smoke test.

### Adapter correctness

- Removed false generic OpenAI, Replicate, and fal upscale/variation adapters.
- Stability upscale uses its registered conservative-upscale contract.
- Stability SD3 image-to-image sends explicit mode, mapped model, source image, and transformation strength.
- Replicate official models use the official-model prediction endpoint; immutable references use the version endpoint.
- Runway, Luma, and fal image-to-video use dedicated operation contracts and exact model routing.
- Provider-key tests no longer report arbitrary long strings as valid.

### Strict request and network safety

- Added strict Zod contracts for image, video, edit, upscale, variation, image-to-video, status, protected-media, and cancellation requests.
- Unknown, malformed, oversized, empty, or out-of-range input fails before provider contact.
- Request bodies are streamed with route-specific limits before JSON parsing.
- Added bounded provider transport with submission, status, cancellation, and media-transfer deadlines.
- Provider error bodies are read only to a bounded diagnostic limit.
- Authentication, quota, rejection, unavailable, timeout, network, and invalid-response failures are normalized without exposing raw upstream bodies to the browser.
- Browser and server image input share one 10 MB PNG/JPEG/WebP/GIF policy.
- Remote image input requires HTTPS, rejects URL credentials, blocks private and reserved networks, caps redirects, and streams with deadline and byte limits.

### Production browser hardening

- Added Content Security Policy, HSTS, `nosniff`, frame denial, strict referrer policy, restrictive permissions policy, Cross-Origin Opener Policy, and disabled DNS prefetching.
- Production excludes `unsafe-eval`; development permits it only for the Next.js development runtime.
- Disabled `X-Powered-By`.

### Stateless asynchronous jobs and recovery

- Migrated asynchronous routes return credential-free `aistudio-job.*` tokens.
- Tokens contain provider job metadata but never API keys.
- Status polling uses POST and reloads the provider key from IndexedDB.
- Shared polling provides exponential backoff, bounded jitter, deadlines, retry limits, cancellation, and normalized terminal failures.
- Startup recovery scans older IndexedDB `processing` records and resumes them through the same lifecycle.
- Older process-memory generation jobs remain temporarily compatible while legacy records age out.

### Stateless protected media and durable local assets

- Removed process-memory protected-media tokens and the tokenized media route.
- Google/Veo completion returns a credential-free descriptor containing provider ID, provider job ID, media kind, and descriptor version.
- Added POST-only `/api/generate/media`; keys stay in the request body and provider media URLs never reach the browser.
- The route rechecks the provider operation, accepts only trusted Google media hosts, validates type, and streams with a five-minute deadline and 512 MB ceiling.
- IndexedDB version 6 adds a separate `mediaAssets` Blob store.
- Generation metadata stores only local asset ID, MIME type, and byte size.
- Gallery reads recreate session-scoped `blob:` URLs after reload or local-server restart.
- Deletion and clear-all remove matching media assets and revoke cached object URLs.

### Provider-side cancellation

- Added strict POST-only `/api/generate/cancel` handling.
- Stateless job tokens are decoded server-side; provider API keys remain in the POST body.
- Added remote cancellation adapters for:
  - Replicate prediction cancellation,
  - fal queue-request cancellation,
  - Runway task deletion/cancellation,
  - and Luma generation deletion as the provider stop request.
- Already terminal or missing provider jobs are treated idempotently.
- Unsupported providers use an honest local-only outcome rather than claiming provider execution stopped.
- Remote cancellation is attempted once per lifecycle; the local poller aborts immediately, then the final remote outcome is persisted.
- Queue entries show whether remote cancellation was requested, already terminal, unsupported, local-only, or failed.
- Successful cancellation responses are consumed so bounded provider deadline timers release immediately.

### Visible missing-key recovery

- Interrupted jobs without a provider key now produce a persistent recovery panel instead of only an IndexedDB error string.
- The panel lists blocked jobs and can:
  - open Provider Settings,
  - retry recovery,
  - automatically rescan after a key is saved or removed,
  - and stop tracking a selected job with honest remote-versus-local messaging.
- Reconnecting a key triggers a new recovery scan through the store provider version.
- Missing-key jobs remain `processing` until resumed or explicitly stopped.

### Product correctness

- Replaced the placeholder Settings transfer APIs with a browser-native, versioned local backup format.
- Backups include generations, prompts, collections, collection membership, reference images, custom/discovered model definitions, reviewed model registrations, and downloaded IndexedDB media assets.
- API keys are explicitly excluded from local data backups and remain in the separate plain-text key transfer flow.
- Restore supports replace and merge modes; both preserve stored API keys.
- Corrected Settings privacy copy to explain that keys are stored in IndexedDB, sent in same-origin POST bodies to this AI Studio instance when required, and not persisted in a server-side database or configuration file.
- Queue cleanup now preserves both pending and processing work while removing terminal completed and failed entries.
- Gallery search now runs across the complete filtered IndexedDB result set before pagination and matches prompt, negative prompt, provider, model, type, and status metadata.
- Added stale-search response protection so an older IndexedDB request cannot overwrite a newer query.

### Regression coverage

Automated coverage includes:

- lifecycle, persistence, queue, recovery, cancellation, and explicit-client ownership,
- stateless job and protected-media descriptor credential exclusion,
- POST-only status, media, and cancellation credentials,
- cancellation adapter endpoint and method ownership,
- exactly-once cancellation race handling,
- local-only behavior for unsupported providers,
- visible missing-key recovery controls and key-triggered rescans,
- polling retry/deadline behavior,
- registry, route, reviewed-registration profile, selector decoration, and server revalidation ownership,
- Replicate official-model/version routing,
- strict request parsing and byte limits,
- provider error and timeout normalization,
- insecure image-input rejection and pre-`FileReader` limits,
- CSP and security-header wiring,
- protected-media finalization and IndexedDB Blob persistence,
- binary media pass-through without response cloning,
- and removal of temporary write-capable migration automation.

## Remaining P0 work

### Live contract verification

- Run owner-supplied-key smoke tests for every registered provider/model/operation, including locally approved contracts selected for real use.
- Promote only evidenced contracts to `live-verified`.
- Hide, revoke, or repair contracts that fail live verification.
- Run real provider-side cancellation checks for Replicate, fal, Runway, and Luma; automated tests currently verify the documented HTTP contracts without spending provider credits.

### Required live evidence

- One immediate image request creates exactly one completed Gallery record.
- One asynchronous image job survives a local-server restart while polling.
- One asynchronous video job survives a local-server restart while polling.
- One authenticated protected-media video survives a local-server restart and reopens from IndexedDB.
- Supported cancellation adapters stop real provider jobs where provider state permits cancellation.

## Completion gates

P0 must not be marked complete until all of the following are evidenced:

- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build:app`
- required live image, video, protected-media, and cancellation checks,
- failed and cancelled jobs reaching terminal states without infinite polling,
- Settings never reporting an untested key as valid,
- and every contract presented as `live-verified` having owner-key evidence.
