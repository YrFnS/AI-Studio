# P0 Runtime Integrity

Status: **IN PROGRESS**  
Branch: `agent/p0-runtime-integrity`  
Base: `main`

## Objective

Make generation submission, polling, persistence, recovery, cancellation, provider routing, and request handling deterministic before adding more providers or visual features.

P0 is complete only when:

- each request produces one durable lifecycle,
- every exposed provider/model/operation has an executable contract,
- provider credentials are handled honestly,
- malformed and oversized requests fail before provider contact,
- supported asynchronous work survives local process restarts,
- and every contract presented as verified has real evidence.

## Completed implementation

### Single persistence owner

- Removed `GenerationRuntimeBridge`, which could write duplicate generation records and leave orphaned `processing` entries.
- Removed `SecureProviderFetchBridge`; AI Studio no longer replaces `window.fetch` globally.
- Kept one explicit browser persistence contract through `beginGeneration`, `markGenerationProcessing`, `completeGeneration`, and `failGeneration`.

### Explicit generation transport

- Added `src/lib/generation-client.ts` for browser generation submission and status requests.
- Generation callers import `generationFetch` explicitly; unrelated requests continue through native fetch.
- The client reads missing provider keys from IndexedDB and injects them only into local generation requests.
- Legacy GET-style status calls are converted to credential-safe POST requests.
- Source coverage fails when a new browser caller uses `/api/generate/*` without the explicit client.

### Typed generation lifecycle

- Added `src/lib/generation-lifecycle.ts` as the owner of:

  `begin → submit → mark processing → poll → complete/fail`

- Lifecycle handles expose a result promise, immutable snapshots, subscriptions, provider-job metadata, and idempotent cancellation.
- Immediate and asynchronous responses use the same terminal persistence path.
- Optional queue ports connect lifecycle state to Zustand without coupling lifecycle infrastructure to the store.
- Page aborts detach ownership without falsely failing provider work, allowing IndexedDB recovery.
- Missing keys during recovery can remain non-terminal and recoverable.
- Transport, polling, persistence, key lookup, queue behavior, time, and cancellation are injectable for deterministic tests.
- Edit responses using an `images` array are normalized into the same result contract as `urls` and `resultUrl` responses.

### Generation surfaces migrated

- **Model Compare**: each slot has an isolated lifecycle handle and durable Gallery record.
- **Image Studio**: removed component-owned provider jobs, polling, queue handling, and duplicate persistence branches.
- **Video Studio**: immediate and asynchronous video work now share one lifecycle and Gallery ID.
- **Cinema Studio**: moved to the shared lifecycle and removed duplicated scene-preset prompt text.
- **Image Editor and Editor Controls**: share `use-editor-generation.ts`; neither polls locally nor places provider keys in URLs.
- **Derived actions**: upscale, variation, improve, edit, inpaint, and image-to-video use typed lifecycle handles, dedicated routes, durable parent relationships, and visible local cancellation.
- Navigating away detaches local ownership so startup recovery can resume supported work.

### Authoritative provider, model, and operation registry

- Added `src/lib/generation-registry.ts` as the executable source of truth.
- Every exposed model operation declares:
  - the exact operation,
  - its owning route,
  - its adapter identifier,
  - and one verification level: `adapter-implemented`, `contract-reviewed`, or `live-verified`.
- The registry distinguishes:
  - text-to-image,
  - image-to-image,
  - edit,
  - inpaint,
  - variation,
  - upscale,
  - text-to-video,
  - and image-to-video.
- `/api/providers` decorates and filters the raw catalog through the registry. Catalog capability strings cannot expose an operation by themselves.
- Providers without registered executable models disappear from generation selectors.
- Image, Video, and Cinema selectors filter by the active operation and reset stale incompatible selections.
- Image, Video, and Cinema no longer merge arbitrary IndexedDB custom models into executable selectors.
- Generation routes call `requireModelOperation` before provider contact.
- `generation-operation.ts` consumes registry contracts rather than trusting legacy capability strings.
- No operation is marked `live-verified` without an owner-supplied-key smoke test.

### Adapter correctness

- Removed false generic OpenAI, Replicate, and fal upscale or variation adapters.
- Stability upscale uses the registered synchronous conservative-upscale adapter.
- Stability SD3 image-to-image sends explicit image mode, model mapping, source image, and transformation strength.
- Replicate official `owner/name` models use the official-model endpoint, while immutable version references use the version endpoint.
- Runway, Luma, and fal image-to-video keep dedicated operation contracts and exact model routing.
- Provider-key checks no longer declare arbitrary sufficiently long keys valid.
- Google key validation uses headers rather than URL parameters.

### Stateless asynchronous jobs and resilient recovery

- Asynchronous routes return credential-free `aistudio-job.*` tokens containing provider job metadata but never API keys.
- `/api/generate/status` receives the locally stored provider key in a POST body.
- Added `src/lib/generation-poller.ts` with exponential backoff, bounded jitter, deadlines, retry limits, cancellation, and normalized terminal failures.
- Exhausted retries and permanent provider responses terminate instead of polling forever.
- `PendingGenerationRecovery` scans IndexedDB and resumes older `processing` records through the same lifecycle pipeline.
- Jobs waiting on a missing provider key remain recoverable.
- Older process-memory jobs remain temporarily compatible during migration.

### Generation route and network safety

- Added `src/lib/server/generation-request.ts` with strict Zod schemas for image, video, edit, upscale, variation, image-to-video, and status requests.
- Unknown fields are rejected rather than forwarded to provider adapters.
- Prompt, provider, model, key, duration, aspect ratio, batch, seed, dimensions, inference settings, and operation parameters are bounded.
- Request bodies are read with streamed byte limits before JSON parsing:
  - image generation: 30 MB,
  - video generation: 45 MB,
  - edit: 30 MB,
  - single-image derived operations: 15 MB,
  - status polling: 128 KB.
- Invalid content types, malformed JSON, empty requests, oversized requests, and invalid parameters receive structured no-store errors.
- Added `src/lib/server/provider-request.ts` as the bounded provider transport:
  - submission deadline: 120 seconds,
  - status deadline: 20 seconds,
  - provider error-body read limit: 8 KB,
  - normalized authentication, quota, rejection, unavailable, timeout, network, and invalid-response failures.
- Raw provider response text is retained only for bounded server-side diagnostics and is never echoed to the browser.
- Added `src/lib/server/generation-response.ts` as the shared public error owner for request, registry, image-input, provider, and internal failures.
- All generation submission and polling routes use the shared parser, response layer, and bounded provider transport.
- Edit source images and masks now use the same SSRF- and size-safe image loader as other image operations.

### Reference-image safety

- Added `src/lib/reference-image-limits.ts` with one 10 MB binary limit and a PNG, JPEG, WebP, and GIF allowlist.
- Image Studio, Video Studio, outfit-reference uploads, and the reusable image uploader validate files before `FileReader` and base64 conversion.
- `/api/upload` checks declared request size, file type, file size, and decoded byte size before returning a data URL.
- Remote image loading:
  - accepts HTTPS only,
  - rejects URL credentials,
  - resolves DNS and blocks private or reserved addresses,
  - caps redirects,
  - enforces a 15-second fetch deadline,
  - streams with a 10 MB response limit,
  - and rejects non-image content.

### Production security headers and CSP

- Added `src/lib/security-headers.ts` and wired it through `next.config.ts` for every path.
- Production headers include:
  - Content Security Policy,
  - HTTP Strict Transport Security,
  - `X-Content-Type-Options: nosniff`,
  - `X-Frame-Options: DENY`,
  - strict referrer policy,
  - restrictive permissions policy,
  - Cross-Origin Opener Policy,
  - and disabled DNS prefetching.
- The CSP blocks objects and framing, restricts base URIs and form submissions, and allows only the image, media, worker, and connection sources required by a local multi-provider studio.
- Production excludes `unsafe-eval`; development permits it for the Next.js development runtime.
- The framework-identifying `X-Powered-By` header is disabled.

### Regression coverage

Automated coverage now includes:

- stateless token round trips and credential exclusion,
- malformed and oversized token rejection,
- POST-only status credentials,
- polling recovery, backoff, retry exhaustion, cancellation, and deadlines,
- explicit-client key injection and pass-through behavior,
- lifecycle immediate completion, asynchronous polling, queue ownership, failure, cancellation, and missing-key recovery,
- per-model operation and route ownership,
- registry filtering and custom-model bypass prevention,
- official Replicate model routing versus immutable version routing,
- route-level rejection for unsupported operations,
- strict request parsing and unknown-field rejection,
- malformed JSON and request-size enforcement,
- insecure image-input rejection,
- pre-`FileReader` reference-image limits,
- provider authentication, quota, timeout, network, and malformed-response normalization,
- shared provider-transport coverage across all generation callers,
- edit-route image-loader ownership,
- production and development CSP differences,
- security-header wiring,
- and removal of temporary write-capable migration automation.

The permanent branch passes the repository validation pipeline:

- `bun install --frozen-lockfile`
- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build:app`

External Vercel checks are tracked separately because account build-rate limits can prevent a deployment check even when the standalone production build succeeds.

## Remaining P0 work

### Registry verification and extension workflow

- Run owner-supplied-key smoke tests for every model/operation marked `adapter-implemented` or `contract-reviewed`.
- Promote only evidenced contracts to `live-verified`.
- Hide or repair any contract that fails live verification.
- Define the reviewed registration workflow that permits custom and discovered models to become executable without bypassing the registry.

### Cancellation and recovery experience

- Add provider-side cancellation adapters where provider APIs support cancellation. Current controls stop the local lifecycle and persist a terminal cancellation, but may not stop provider execution or billing.
- Add a visible recovery state for jobs waiting on a missing provider key.

### Protected media

- Remove the remaining process-memory dependency from authenticated provider media streaming.
- Persist or stream completed media without exposing provider credentials.
- Define expiry and recovery behavior for protected media links.

### Product correctness

- Repair Settings export/import so it serializes and restores IndexedDB data.
- Correct the API-key privacy copy in Settings.
- Fix queue `clearCompleted` so it preserves pending work.
- Make Gallery search cover all IndexedDB records rather than only the loaded page.

## Completion gates

P0 must not be marked complete until all of the following are evidenced:

- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build:app`
- One immediate image request produces exactly one completed Gallery record.
- One asynchronous image job survives a local server restart while polling.
- One asynchronous video job survives a local server restart while polling.
- Failed and cancelled jobs reach terminal states without infinite polling.
- Settings never reports an untested key as valid.
- Manual smoke tests pass with owner-supplied keys for every provider/model/operation presented as `live-verified`.
