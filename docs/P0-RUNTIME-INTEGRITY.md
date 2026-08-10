# P0 Runtime Integrity

Status: **IN PROGRESS**  
Branch: `agent/p0-runtime-integrity`  
Base: `main`

## Objective

Make generation submission, polling, and browser persistence deterministic before adding more providers or UI features. P0 is complete only when one generation creates one durable gallery record, provider keys are handled honestly, and supported async jobs recover cleanly from local process restarts.

## Completed in the first implementation slice

### Single persistence owner

- Removed `GenerationRuntimeBridge`, which globally intercepted generation requests and wrote a second set of generation records.
- Kept the explicit persistence lifecycle already used by Image, Video, and Cinema Studio: `beginGeneration`, `markGenerationProcessing`, `completeGeneration`, and `failGeneration`.
- Retained `SecureProviderFetchBridge` only as a temporary compatibility layer for key injection and legacy GET-to-POST status conversion.

### Stateless async jobs

- Image, video, upscale, variation, and image-to-video routes now return `aistudio-job.*` tokens.
- Tokens contain provider name, model ID, provider job ID, media kind, and token version.
- Tokens never contain API keys.
- `/api/generate/status` decodes stateless tokens and uses the key supplied in the POST body.
- Existing process-memory job IDs remain supported temporarily for backward compatibility.

### Provider contract repairs included in this slice

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

## Remaining P0 work

### Generation client consolidation

- Replace duplicated Image, Video, Cinema, Compare, and post-generation polling code with one explicit generation client.
- Remove `SecureProviderFetchBridge` after the final legacy caller is migrated.
- Add bounded polling with backoff, deadline, cancellation, offline recovery, and retry limits.
- Resume pending jobs from IndexedDB after reload.

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
