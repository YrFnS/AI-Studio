# P0 Reviewed Model Registration

Status: **IMPLEMENTED — LIVE EVIDENCE STILL REQUIRED**  
Branch: `agent/p0-runtime-integrity`

## Purpose

Custom and provider-discovered model definitions are useful metadata, but model names and capability labels do not prove that AI Studio’s request and response adapter is compatible with a model.

This workflow keeps every custom or discovered model non-executable until a user explicitly reviews it against a bounded adapter profile. It prevents raw discovery results, manual capability overrides, and imported backups from silently bypassing the authoritative provider/model/operation registry.

## Candidate lifecycle

A custom or discovered model follows this lifecycle:

```text
candidate metadata
→ draft review
→ approved contract-reviewed registration
→ executable selector entry
→ optional live-provider evidence
→ live-verified or revoked
```

Supported registration states are:

- `draft` — review metadata may be saved, but the model is not executable.
- `approved` — the local documentation review passed and the model can use the selected bounded adapter profile.
- `revoked` — selector and generation access are removed while the review record is retained.
- `rejected` — the candidate was reviewed and intentionally rejected.

Local approval records `contract-reviewed`; it never automatically grants `live-verified`.

## Review requirements

Settings → **Review** requires:

1. A custom or discovered candidate not already owned by the shipped static registry.
2. A source-defined adapter profile matching the provider and media type.
3. A model identifier accepted by that profile’s bounded identifier rule.
4. An HTTPS provider-documentation URL.
5. Meaningful notes describing the reviewed endpoint, request fields, response shape, and relevant limits.
6. Explicit acknowledgement that the provider documentation matches the selected profile.

Providers or operations without a bounded adapter profile remain metadata-only. A user cannot create an arbitrary endpoint, route, header, request shape, or adapter ID from the UI.

## Runtime enforcement

Approval is not trusted solely because it exists in IndexedDB.

For a locally approved model:

1. The explicit generation client loads only `approved` registrations.
2. It adds the matching registration to the exact provider/model/operation request.
3. The operation-specific Zod schema validates the registration structure.
4. `requireModelOperation` confirms that the model is not attempting to shadow a shipped catalog entry.
5. The server validates provider, model ID, operation, route, adapter profile, model-ID rule, documentation evidence, acknowledgement, and verification state.
6. Only then can the existing bounded provider adapter run.

Draft, revoked, rejected, malformed, mismatched, or unsupported registrations fail before provider contact.

## Static registry precedence

The shipped source registry remains authoritative.

A local registration cannot:

- Replace a shipped model contract.
- Add another operation to a shipped model.
- Change a shipped route or adapter.
- Promote a contract to `live-verified` without passing evidence.
- Expose a provider for which no safe local adapter profile exists.

Changes to static models continue through normal source review and automated test coverage.

## IndexedDB and backup behavior

IndexedDB version 7 adds the `modelRegistrations` store with indexes for source, provider, model, status, and update time.

Normal local backups include review records but exclude API keys. Replace and merge restore therefore preserve the registration lifecycle without making keys part of the backup.

Deleting a custom candidate removes registrations owned by that candidate. Approved discovered registrations remain manageable even when the temporary discovery cache expires, so selector access can still be reviewed or revoked.

## Selector behavior

`/api/providers` remains registry-filtered on the server. In the browser, the explicit generation client adds locally approved registrations to this safe static result.

If IndexedDB review metadata cannot be read, AI Studio falls back to the already filtered static provider catalog. Local review failure cannot break all provider selectors.

Approved models expose only the operation contracts granted by their reviewed profiles. Static models with the same ID always win.

## Current bounded profiles

The first reviewed profiles cover generic model-ID contracts whose adapters already accept a model identifier without provider-specific source changes:

- Replicate prediction text-to-image.
- Replicate prediction image-to-image when documentation confirms `image` and `strength` inputs.
- fal queue text-to-image.
- fal queue image-to-image when documentation confirms `image_url` and `strength` inputs.
- Together images text-to-image.
- Fireworks images text-to-image.
- Ideogram generate text-to-image.
- Hugging Face inference text-to-image.
- AI/ML API images text-to-image.
- Google AI Studio image generation for documented `gemini-*` or `imagen-*` image models.
- Black Forest Labs model-endpoint text-to-image for documented `flux-*` endpoints.

Profiles are intentionally conservative. For example, OpenAI custom model registration is not enabled because the current adapter has model-specific behavior that should be expanded through source review rather than a broad local pattern.

## Automated evidence

Automated tests cover:

- Candidate drafts remaining inert.
- Documentation, notes, and acknowledgement requirements.
- Unsafe and profile-incompatible model ID rejection.
- Provider/model/operation/route binding.
- Static registry precedence.
- Approved-only selector decoration.
- Draft and revoked exclusion.
- Browser request evidence injection.
- Strict server revalidation on every generation route.
- IndexedDB version and registration-store ownership.
- Backup inclusion without API-key inclusion.
- Review availability after discovery-cache expiry.
- Static-catalog fallback when review metadata is unavailable.
- Removal of temporary write-enabled migration automation.

The implementation passes:

```text
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run build:app
```

## Remaining evidence

P0 still requires owner-key live testing before any registration is promoted to `live-verified`.

For each locally approved model selected for real use, record:

- Provider and exact model ID.
- Operation and route.
- Test date.
- Request parameters used.
- Provider result or failure.
- Whether the result persisted exactly once.
- Any provider-specific limits discovered.
- Decision to promote, revoke, repair, or keep as `contract-reviewed`.
