# P0 Runtime Integrity

Status: **IN PROGRESS**  
Branch: `agent/p0-runtime-integrity`  
Base: `main`

## Objective

Make generation submission, polling, persistence, recovery, and cancellation deterministic before adding more providers or visual features. P0 is complete only when each request produces one durable result lifecycle, provider credentials are handled honestly, and supported asynchronous work survives local process restarts.

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

### Model Compare migration

- Moved generation ownership into `use-model-compare.ts`.
- Every slot has its own lifecycle handle and durable Gallery record.
- Immediate and asynchronous outputs are persisted.
- Changing or removing a slot cancels only that slot.
- Closing the presentation does not silently cancel provider work.

### Image Studio migration

- Primary image generation uses `startGenerationJob`.
- Removed component-owned status polling, raw provider-job state, manual queue handling, and duplicate immediate/asynchronous persistence branches.
- Lifecycle state owns queue insertion and terminal updates.
- Durable Gallery IDs continue to power Favorite and derived-generation actions.
- Provider keys are injected by the explicit client instead of being assembled in the component request body.
- Navigating away detaches ownership so startup recovery can resume the job.
- Added a visible **Cancel generation** control with idempotent local cancellation.
- Added `image-studio-lifecycle.test.ts` to prevent regression to the legacy path.

### Video Studio migration

- Primary video generation uses `startGenerationJob`.
- Removed the component-owned five-second polling loop, raw job state, manual queue path, and duplicate terminal branches.
- Immediate and asynchronous video responses share one lifecycle.
- The returned durable Gallery ID powers Favorite.
- Provider keys are injected by the explicit client.
- Navigating away or restarting the local app leaves active work recoverable.
- Added a visible **Cancel generation** control with terminal persistence and queue cleanup.
- Added `video-studio-lifecycle.test.ts`.

### Cinema Studio migration

- Primary Cinema Studio generation uses `startGenerationJob`.
- Removed its component-owned polling loop, raw provider-job state, manual queue path, and duplicate persistence branches.
- Immediate and asynchronous cinematic image results share one lifecycle and durable Gallery record.
- The lifecycle owns global queue insertion and terminal updates.
- Provider keys are injected by the explicit client.
- Navigating away detaches ownership so startup recovery can resume active work.
- Added a visible **Cancel generation** control and recovery guidance in the loading state.
- Fixed the duplicated scene-preset prompt bug: `buildCinemaSuffix` remains the single place that appends the selected scene preset.
- Added `cinema-studio-lifecycle.test.ts`, including scene-suffix regression coverage.

### Stateless asynchronous jobs

- Image, video, upscale, variation, and image-to-video routes return credential-free `aistudio-job.*` tokens.
- Tokens contain provider name, model ID, provider job ID, media kind, and token version, but never API keys.
- `/api/generate/status` decodes the token and uses the key supplied in the POST body.
- Older process-memory jobs remain temporarily compatible during migration.

### Resilient polling and recovery

- Added `src/lib/generation-poller.ts` with exponential backoff, bounded jitter, deadlines, retry limits, cancellation, and normalized terminal errors.
- Exhausted retries and terminal non-2xx payloads stop instead of polling forever.
- Added `PendingGenerationRecovery`, which scans IndexedDB and resumes older `processing` jobs with bounded concurrency.
- Recovery uses `resumeGenerationJob`; it does not maintain a second completion/failure pipeline.
- Jobs missing a provider key remain recoverable and receive a reconnect message.

### Provider and key correctness

- Replicate upscale and variation submissions use `version` rather than `model`.
- Runway image-to-video uses `X-Runway-Version` and the `gen4_turbo` identifier.
- Luma image-to-video follows its video-generation/keyframe contract.
- fal image-to-video uses an action-specific video endpoint.
- Removed the fallback that declared any sufficiently long key valid.
- Implemented bounded live checks where supported; unsupported checks report that validation is unavailable.
- Google validation sends keys through headers rather than URL parameters.

### Regression coverage

Automated coverage now includes:

- Stateless token round trips and credential exclusion.
- Malformed and oversized token rejection.
- POST-only status credential handling.
- Polling recovery, backoff, retry exhaustion, cancellation, and deadlines.
- Explicit-client key injection and pass-through behavior.
- Lifecycle immediate completion, async polling, queue ownership, failures, snapshots, cancellation, and missing-key recovery.
- Source-level migration guards for Image Studio, Video Studio, and Cinema Studio.
- Prevention of the duplicate Cinema scene suffix.

## Remaining P0 work

### Lifecycle consolidation

- Move image editing and post-generation actions—upscale, variation, improve, and image-to-video—onto lifecycle handles.
- Remove their duplicated submission, polling, persistence, and timer code.
- Add provider-side cancellation adapters where provider APIs support cancellation. Current studio cancellation is local lifecycle cancellation.
- Add a visible recovery state for jobs waiting on a missing provider key.

### Protected media

- Remove the remaining process-memory dependency from authenticated provider media streaming.
- Persist or stream completed media without exposing provider credentials.
- Define expiry and recovery behavior for protected media links.

### Typed provider operation registry

- Replace provider-wide capability flags with a typed `provider + model + operation` registry.
- Hide every model/operation combination without an executable and tested adapter.
- Separate text-to-image, image-to-image, edit, inpaint, variation, upscale, text-to-video, and image-to-video contracts.

### Input and network safety

- Add request schemas and parameter bounds to every generation route.
- Add provider request timeouts and normalized provider errors.
- Limit uploaded reference images before base64 conversion.
- Add production security headers and a tested Content Security Policy.

### Product correctness

- Repair Settings export/import so it actually serializes and restores IndexedDB data.
- Correct the API-key privacy copy in Settings.
- Fix queue `clearCompleted` so it preserves pending work.
- Make Gallery search cover all IndexedDB records rather than only the loaded page.
- Give post-generation actions an operation-compatible provider/model selector.

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
- Manual smoke tests pass with owner-supplied keys for every provider presented as verified.
