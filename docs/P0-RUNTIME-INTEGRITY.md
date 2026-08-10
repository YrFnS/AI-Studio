# P0 Runtime Integrity

Status: **IN PROGRESS**  
Branch: `agent/p0-runtime-integrity`  
Base: `main`

## Objective

Make generation submission, polling, and browser persistence deterministic before adding more providers or UI features. P0 is complete only when one generation creates one durable gallery record, provider keys are handled honestly, and supported async jobs recover cleanly from local process restarts.

## Completed implementation

### Single persistence owner

- Removed `GenerationRuntimeBridge`, which globally intercepted generation requests and wrote a second set of generation records.
- Kept one explicit persistence contract for `beginGeneration`, `markGenerationProcessing`, `completeGeneration`, and `failGeneration`.
- Removed `SecureProviderFetchBridge`; AI Studio no longer replaces `window.fetch` globally.

### Explicit generation client

- Added `src/lib/generation-client.ts` as the explicit browser transport for generation submission and status checks.
- Browser generation callers import `generationFetch` directly as their local `fetch` binding, while unrelated requests continue through the native fetch implementation.
- The client reads a missing provider key from IndexedDB, injects it only into generation requests, and never persists it in server state.
- GET-style legacy status callers are converted into credential-safe POST requests inside the explicit client rather than through a global monkey patch.
- The shared status coordinator applies one retry, backoff, deadline, and terminal-error policy to current fixed-interval callers.
- Migrated the verified browser caller set:
  - `cinema-studio.tsx`
  - `image-editor-panel.tsx`
  - `image-editor.tsx`
  - `image-studio.tsx`
  - `model-compare.tsx`
  - `use-image-generate.ts`
  - `use-model-compare.ts`
  - `use-post-gen-actions.ts`
  - `video-studio.tsx`
- Added a repository coverage test that fails whenever a browser module calls `/api/generate/*` without importing the explicit client.

### Typed generation lifecycle handles

- Added `src/lib/generation-lifecycle.ts` as the higher-level owner of `begin → submit → mark processing → poll → complete/fail`.
- A handle exposes a typed result promise, immutable snapshots, subscriptions, provider job metadata, and an idempotent cancellation operation.
- Immediate and asynchronous provider responses share the same terminal path and persistence contract.
- Optional queue ports let a lifecycle own queue insertion and terminal updates without importing Zustand directly.
- External abort signals detach page ownership without marking provider work failed, allowing the next browser session to resume from IndexedDB.
- Missing keys during recovery can remain non-terminal instead of destroying an otherwise valid provider job.
- Lifecycle dependencies are injectable, so transport, polling, persistence, key lookup, time, queue behavior, and cancellation are covered without live provider calls.

### Model Compare lifecycle migration

- Model Compare now delegates stateful generation work to `use-model-compare.ts` instead of duplicating submission and interval polling inside the dialog component.
- Every comparison slot creates its own lifecycle handle and durable generation descriptor.
- Immediate and asynchronous comparison outputs are now saved to the Gallery.
- Changing a slot provider/model or removing an active slot cancels only that slot's lifecycle and records a terminal state.
- Closing or unmounting the presentation does not cancel provider work; lifecycle persistence and startup recovery retain ownership.
- The dialog component is now presentation-focused and consumes the shared hook.

### Image Studio lifecycle migration

- Primary Image Studio generation now runs through `startGenerationJob` rather than a component-owned submission and polling pipeline.
- Immediate and asynchronous results share one lifecycle completion path and produce the durable Gallery IDs consumed by favorite and parent-generation actions.
- The lifecycle owns global queue insertion and terminal queue updates through the Zustand queue port.
- Removed Image Studio's local status interval, provider-job ref, manual persistence calls, and duplicated immediate/async cleanup branches.
- Image Studio no longer places a provider key in its request body; the explicit generation client injects the matching IndexedDB key only for the local provider request.
- Navigating away detaches the page-owned lifecycle without falsely failing an active provider job, allowing startup recovery to resume it.
- Added a visible **Cancel generation** control. Local cancellation is idempotent, persists a terminal cancelled record, and updates the queue without duplicate writes.
- Added `image-studio-lifecycle.test.ts` to prevent the component-owned polling and queue path from being reintroduced.

### Stateless async jobs

- Image, video, upscale, variation, and image-to-video routes now return `aistudio-job.*` tokens.
- Tokens contain provider name, model ID, provider job ID, media kind, and token version.
- Tokens never contain API keys.
- `/api/generate/status` decodes stateless tokens and uses the key supplied in the POST body.
- Existing process-memory job IDs remain supported temporarily for backward compatibility.

### Shared resilient polling policy

- Added `src/lib/generation-poller.ts` as the common status-request and polling engine.
- Status checks use POST and mark direct resilient callers with `x-ai-studio-poll-client: resilient`.
- Added exponential backoff, bounded jitter, an overall deadline, a consecutive transport-error limit, cancellation support, and normalized terminal errors.
- Remaining fixed-interval callers may continue ticking locally, but the explicit client coordinator throttles actual status traffic according to the shared backoff policy.
- Non-2xx terminal payloads and exhausted retries are returned as normal `{ status: 'failed' }` results so existing studio loops stop instead of logging forever.

### Interrupted-job recovery

- Added `PendingGenerationRecovery`, mounted once from the root layout.
- On a fresh page session, it scans IndexedDB for older `processing` records with a provider job ID.
- Recovery now uses `resumeGenerationJob`; it no longer implements a second poll/complete/fail pipeline.
- Lifecycle handles read the matching provider key and resume polling with bounded concurrency.
- Completed jobs are persisted through the same lifecycle terminal path used by new jobs.
- Failed and timed-out recovery attempts reach a terminal failed state.
- Jobs whose provider key is missing remain recoverable and receive a clear reconnect message instead of losing provider context.
- Unmounting the page detaches recovery handles without falsely marking provider jobs failed.

### Provider contract repairs included in P0

- Replicate upscale and variation submissions use the prediction `version` field instead of `model`.
- Runway image-to-video uses `X-Runway-Version` and the `gen4_turbo` identifier.
- Luma image-to-video follows the same video-generation/keyframe contract as Video Studio.
- fal image-to-video uses an action-specific video endpoint instead of blindly submitting the selected image model.

### Honest key testing

- Removed the fallback that declared any key longer than eight characters valid.
- Added bounded live checks for providers with an implemented lightweight verification request.
- Providers without an implemented check now return an explicit `unsupported` result rather than a false success.
- Google key validation uses a request header instead of placing the key in a URL.

### Regression coverage

- Token round-trip tests cover image and video jobs.
- Tests verify extra credential fields are not serialized.
- Malformed, legacy, and oversized token inputs are rejected.
- Polling tests cover POST credential handling, transient recovery, retry exhaustion, cancellation, original-job deadlines, coordinator backoff, and terminal non-2xx normalization.
- Explicit-client tests cover native pass-through, key injection, explicit-key preservation, GET-to-POST conversion, IndexedDB key recovery, and terminal invalid requests.
- Lifecycle tests cover immediate completion, asynchronous polling, queue ownership, submission failure, idempotent cancellation, snapshot transitions, and non-terminal missing-key recovery.
- Image Studio coverage verifies lifecycle ownership, page-detachment signaling, the cancellation path, and removal of its legacy interval and manual queue path.
- The coverage test prevents a new browser generation caller from bypassing the explicit client.

## Remaining P0 work

### Generation lifecycle consolidation

- Move Video Studio, Cinema Studio, image editing, and post-generation actions onto `startGenerationJob` lifecycle handles.
- Remove their duplicated queue, persistence, completion, failure, and fixed-interval timer code after each migration.
- Connect primary Video and Cinema lifecycle handles to the global generation queue port.
- Add provider-side cancellation adapters where supported; Image Studio currently provides local lifecycle cancellation only.
- Add a visible recovery state for jobs waiting on a missing provider key.

### Protected media

- Remove the remaining process-memory dependency from authenticated provider media streaming.
- Persist or stream completed media without exposing provider credentials.
- Define expiry and recovery behavior for protected media links.

### Provider registry

- Replace provider-wide capability flags with a typed `provider + model + operation` registry.
- Hide every model/operation combination without an executable, tested adapter.
- Separate text-to-image, edit, variation, inpaint, upscale, text-to-video, and image-to-video contracts.

### Input and network safety

- Add request schemas and parameter bounds to every generation route.
- Add provider request timeouts and normalized provider errors.
- Limit uploaded video reference images before base64 conversion.
- Add production security headers and a tested Content Security Policy.

### Product correctness

- Repair Settings export/import so it actually serializes and restores IndexedDB data.
- Correct the API-key privacy copy in Settings.
- Remove the duplicate Cinema scene suffix.
- Fix queue `clearCompleted` so it preserves pending work.
- Make Gallery search cover all IndexedDB records rather than only the loaded page.
- Give post-generation actions an operation-compatible provider/model selector.

## Completion gates

P0 must not be marked complete until all of the following are evidenced:

- `bun run typecheck`
- `bun run test`
- `bun run lint`
- `bun run build:app`
- One immediate image generation produces exactly one completed gallery record.
- One async image generation survives a local server restart while polling.
- One async video generation survives a local server restart while polling.
- Failed and cancelled jobs reach terminal states without infinite polling.
- Settings never reports an untested key as valid.
- Manual smoke tests pass with owner-supplied keys for every provider presented as verified.
