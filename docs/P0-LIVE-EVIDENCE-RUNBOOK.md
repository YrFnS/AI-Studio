# P0 Live Evidence Runbook

Status: **READY FOR OWNER-KEY EXECUTION**  
Branch: `agent/p0-runtime-integrity`  
PR: `#4`

## Purpose

The P0 implementation is covered by automated tests, but provider behavior, billing-side cancellation, and real process restart recovery require live jobs started by the repository owner.

Settings → **Evidence** provides a local evidence lab that:

- creates a checkpoint tied to one durable generation ID,
- remembers the provider job ID and status present at checkpoint time,
- inspects the complete IndexedDB generation set,
- detects duplicate records for the same provider job,
- confirms protected-media Blob persistence,
- requires explicit acknowledgement for facts the browser cannot observe,
- and exports a credential-free JSON evidence packet.

The evidence lab never asks for or exports provider API keys.

## Safety rules

1. Enter provider keys only in AI Studio Settings.
2. Never paste provider keys into evidence notes, screenshots, issues, pull requests, or chat.
3. Use the smallest and cheapest provider configuration that still exercises the intended contract.
4. Do not mark a provider-side cancellation as passed until the provider dashboard or status endpoint confirms the job is stopped or already terminal.
5. Do not promote a contract to `live-verified` from a successful API-key connection test alone. A real media-generation result is required.

## Preparation

Run the final automated validation first:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run build:app
```

The focused evidence-lab regression suite can also be run independently:

```bash
bun run evidence:check
```

Then start the app:

```bash
bun run dev
```

Open Settings → API Keys and connect only the providers required for the current evidence session.

## Gate 1 — Immediate image integrity

Goal: prove one immediate image request creates exactly one completed Gallery record.

1. Generate one image with a provider/model that returns an immediate result.
2. Open Settings → Evidence.
3. Select **Immediate image integrity**.
4. Select the completed generation record.
5. Create the checkpoint, then select **Verify now**.

The automatic checks require:

- the generation record exists,
- provider and model match,
- the result is a completed image,
- a durable result is present,
- and no second record references the same provider job ID.

Immediate providers do not always return a provider job ID. In that case, the verifier correlates records by provider, model, media type, prompt, parent generation, and a five-second creation window so duplicate or unintended batch persistence still fails this gate.

## Gate 2 — Asynchronous image restart recovery

Goal: prove one asynchronous image job survives a local-server restart.

1. Start an asynchronous image generation.
2. While its Gallery record is still `processing`, open Settings → Evidence.
3. Select **Async image restart recovery** and create a checkpoint.
4. Stop the local AI Studio server process.
5. Start the server again with the same browser storage and app origin.
6. Reload the page and allow Pending Generation Recovery to resume the job.
7. Return to Settings → Evidence.
8. Check the manual restart confirmation and select **Verify now** after completion.

The evidence lab checks that:

- the checkpoint was captured while processing,
- verification occurred in a new browser runtime,
- the same provider job ID was retained,
- the same durable generation ID completed,
- and no duplicate provider-job record was created.

## Gate 3 — Asynchronous video restart recovery

Repeat Gate 2 with a registered asynchronous video model. Select **Async video restart recovery** and ensure the chosen generation record is a video.

Do not use a completed record when creating the checkpoint. The checkpoint must capture a real processing state and provider job ID before restart.

## Gate 4 — Protected-media restart and reopen

Goal: prove authenticated Google/Veo media is persisted locally and does not depend on process memory after completion.

1. Start a Google/Veo video generation.
2. Create a **Protected media restart** checkpoint while the generation is processing.
3. Restart the local server and reload the page.
4. Allow the generation to finish and protected media to download.
5. Reload once more after completion.
6. Confirm the video opens in Gallery.
7. Check the manual restart confirmation and select **Verify now**.

The automatic checks require:

- a completed video generation,
- the original provider job ID,
- a `mediaAssetId` on the generation record,
- a non-empty Blob in IndexedDB,
- and a recreated local `blob:` URL.

## Gate 5 — Real provider cancellation

Run this gate separately for Replicate, fal, Runway, and Luma where credits and provider state permit.

1. Start a job that remains processing long enough to cancel.
2. Cancel it from AI Studio.
3. In the provider dashboard or official status endpoint, confirm whether the job stopped or was already terminal.
4. Open Settings → Evidence and create a **Provider cancellation** checkpoint for that generation.
5. Select the observed cancellation outcome.
6. Check the provider terminal confirmation only after external confirmation.
7. Select **Verify now**.

Passing outcomes are:

- `requested`, with provider-side terminal confirmation; or
- `already-terminal`, with provider-side terminal confirmation.

`local-only`, `unsupported`, and `failed` are useful diagnostic evidence but do not pass the remote cancellation gate.

## Gate 6 — Provider/model/operation contract smoke test

Use this for every static or locally reviewed contract selected for real use.

1. Generate media through the exact provider, model, operation, and route being reviewed.
2. Select **Live contract smoke test**.
3. Select the generation and operation.
4. Record non-secret observations in notes.
5. Confirm that the provider accepted the documented request and returned the expected media kind.
6. Select **Verify now**.

A passing local evidence record does not automatically edit the source registry. Use its exported evidence packet during code review before changing a contract to `live-verified`.

## Exporting evidence

Select **Export packet** in Settings → Evidence.

The JSON packet contains:

- gate and status,
- provider and model IDs,
- operation,
- local generation and provider job IDs,
- timestamps,
- automatic check results,
- and operator notes.

It declares `includesApiKeys: false` and rejects notes that resemble API keys or authorization headers.

Store the packet with the release evidence. Review it before attaching it to a pull request because notes may still contain non-secret customer or prompt context entered by the operator.

## Promotion rule

A contract may be promoted to `live-verified` only when:

- the matching contract smoke evidence passes,
- the returned media is usable,
- no duplicate durable record exists,
- provider/model/operation/route identifiers match the source contract,
- and the evidence packet is reviewed in the code change that performs the promotion.

Failed contracts must be hidden, revoked, or repaired rather than documented as working.

## Final P0 audit

P0 can be marked complete only after:

- all automated checks pass,
- required live gates have passing evidence,
- failed jobs terminate without infinite polling,
- cancellation messaging matches provider reality,
- protected media reopens after restart,
- Settings does not claim untested keys or contracts are verified,
- no contract is labeled `live-verified` without reviewed evidence,
- and draft PR #4 contains the final evidence summary.
