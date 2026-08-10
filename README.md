# AI Studio

AI Studio is a local-first, multi-provider workspace for AI image and video generation. It runs as a Next.js application, stores user data in the browser, and lets each user connect providers with their own API keys through the Settings UI.

## Architecture at a glance

- **No external database** — there is no PostgreSQL, SQLite, Prisma, Supabase, or hosted database requirement.
- **UI-managed provider keys** — users add and remove keys from the web interface; provider keys are not configured through `.env` files.
- **Browser persistence** — keys, generations, prompts, collections, reference images, and custom model definitions are stored in IndexedDB.
- **Explicit generation client** — every browser module that submits or polls generation work imports the shared client directly; AI Studio does not replace `window.fetch` globally.
- **Typed generation lifecycle** — primary studios, model comparison, editing, and derived actions share one submit, poll, persist, queue, cancellation, and recovery contract.
- **Authoritative operation registry** — every executable provider/model/operation combination declares its owning route, adapter, and verification level. Raw catalog capability labels cannot make a model executable.
- **Operation-aware selectors** — text-to-image, image-to-image, edit, inpaint, variation, upscale, text-to-video, and image-to-video each expose only models registered for that exact operation.
- **Local provider proxy** — Next.js routes running on the same machine translate requests to each provider's API format.
- **No persistent server-side credentials** — provider keys are not written to a server database or configuration file.
- **Stateless async polling** — long-running jobs return credential-free tokens containing only provider job metadata; polling sends the locally stored key in a POST body.

## Features

- **Image Studio** — text-to-image, registered image-to-image models, editing, inpainting, variations, upscaling, style controls, and advanced parameters
- **Video Studio** — text-to-video and image-to-video through registered provider adapters
- **Cinema Studio** — camera, lens, focal length, aperture, film stock, color grade, lighting, and scene presets
- **Gallery** — search, favorites, timeline views, metadata, and collections
- **Prompt tools** — history, templates, suggestions, quick starters, and a structured prompt builder
- **Model comparison** — run supported image models side by side
- **Custom and discovered model definitions** — save local definitions for review; they are not executable until an operation contract is registered
- **Generation queue** — monitor asynchronous work without blocking the studio
- **Keyboard shortcuts** — fast navigation and generation controls

## Tech stack

- Next.js 16 with the App Router and standalone output
- React 19 and TypeScript
- Tailwind CSS 4 and shadcn/ui with Radix primitives
- Zustand for application state
- IndexedDB for local persistence
- Framer Motion for interface animation
- Bun for dependency management and scripts

## Requirements

- Bun 1.3 or newer
- Node.js 18 or newer for supporting tooling

## Run locally

```bash
bun install
bun run dev
```

Open `http://localhost:3000`, go to **Settings → API Keys**, and add a key for the provider you plan to use.

No database setup, migration command, `DATABASE_URL`, or provider-key environment variable is required.

## Production build

```bash
bun run typecheck
bun run test
bun run lint
bun run build
bun run start
```

To run all validation steps together:

```bash
bun run check
```

## Data and credential flow

### Stored in IndexedDB

- Provider API keys and optional labels
- Generation history and result metadata
- Prompt history and saved prompts
- Collections and collection membership
- Reference images and thumbnails
- Custom model definitions and cached model discovery results

Clearing this site's browser storage removes this locally persisted data.

### Sent during generation and polling

Every browser generation caller imports `generationFetch` from `src/lib/generation-client.ts`. The client reads the selected provider key from IndexedDB when the caller did not already supply it, sends the request to the local Next.js route, and leaves unrelated network requests untouched. No global fetch monkey patch is installed.

`src/lib/generation-lifecycle.ts` owns the durable lifecycle for new work and interrupted work: creation, submission, asynchronous polling, queue updates, completion or failure persistence, local cancellation, page detachment, and recovery. Immediate provider results and asynchronous jobs therefore use the same terminal path.

`src/lib/generation-registry.ts` is the executable source of truth. A model must have a contract for the exact operation and route before it can appear in generation selectors or reach a provider. Each contract records an adapter ID and one of three verification levels:

- `adapter-implemented` — code exists and automated contract coverage passes
- `contract-reviewed` — the adapter has also been checked against provider documentation
- `live-verified` — an owner-supplied-key smoke test has been recorded

No contract is promoted to `live-verified` without manual evidence.

For editing and derived actions, `src/lib/generation-operation.ts` consumes these registry contracts and builds the dedicated edit, upscale, variation, or image-to-video request. The request body remains credential-free until the explicit client injects the matching locally stored provider key. Image-to-video selects a connected video model registered for that operation rather than sending an image model identifier to a video endpoint.

When a user starts a generation, the local Next.js route calls `requireModelOperation` before contacting the selected provider. Unsupported models, operations, or route combinations fail locally with a clear error.

For asynchronous providers, the submission route returns a stateless token containing the provider name, model ID, provider job ID, and media kind. The token never includes the provider API key. Each status request is a POST that supplies the token and reads the provider key again from IndexedDB. This allows polling to continue after the local Next.js process restarts without storing provider credentials in process memory.

The shared polling coordinator applies bounded retry, backoff, deadline, cancellation, and terminal-error behavior. `PendingGenerationRecovery` scans IndexedDB after a new page session and resumes older processing jobs through the same polling and persistence path.

Some authenticated provider outputs still use short-lived protected-media tokens so the browser can stream the result without exposing the provider key. Restarting the local process invalidates those temporary protected-media links; eliminating that remaining process-memory dependency is tracked in `docs/P0-RUNTIME-INTEGRITY.md`.

## Provider support

`/api/providers` filters the static catalog through the authoritative registry. A catalog entry may remain available for future work or settings metadata without being exposed as an executable model.

The currently registered video model families include:

- Replicate — Seedance 2.0
- fal — Seedance 2.0 and Seedance 2.0 Fast
- Runway — Gen-4.5 and Gen-4 Turbo, with operation-specific availability
- Luma — Ray 2 and Ray 2 Flash
- Google AI Studio — Veo 3.1 and Veo 3.1 Fast

Image, editing, variation, and upscale support is defined per model in `src/lib/generation-registry.ts`, not by provider-wide capability flags. The live-verification state for each contract remains part of the P0 completion gate.

Custom or dynamically discovered models are never merged directly into Image, Video, or Cinema generation selectors. A reviewed registry entry and executable adapter are required first.

## Project structure

```text
src/
├── app/
│   ├── api/
│   │   ├── generate/             # Registry-validated submission, polling, editing, and media routes
│   │   ├── keys/                 # Provider-key connection tests
│   │   ├── models/               # Model catalog and discovery endpoints
│   │   ├── prompt-suggestions/   # Prompt assistance
│   │   ├── prompt-templates/     # Curated templates
│   │   └── providers/            # Registry-filtered provider/model listing
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── pending-generation-recovery.tsx
│   ├── studio/                   # Studios, editors, lifecycle hooks, gallery, and settings
│   └── ui/                       # Shared shadcn/Radix components
├── hooks/
└── lib/
    ├── generation-client.ts      # Explicit browser transport and key injection
    ├── generation-job.ts         # Credential-free stateless async job tokens
    ├── generation-lifecycle.ts   # Submit, poll, persist, queue, cancel, and resume lifecycle
    ├── generation-operation.ts   # Derived-action planning from registry contracts
    ├── generation-poller.ts      # Shared resilient polling policy
    ├── generation-registry.ts    # Provider/model/operation/route/adapter source of truth
    ├── idb.ts                    # Browser persistence
    ├── provider-capabilities.ts  # Provider media-kind summary derived from the registry
    ├── providers-data.ts         # Static provider and model definitions
    ├── server/replicate.ts       # Official-model and immutable-version Replicate routing
    ├── server-generation-store.ts # Temporary compatibility for legacy jobs
    └── server-media-store.ts     # Temporary authenticated-media proxy context
```

## Reference sources and notices

The project was informed by several public prompt collections and creative-studio projects. See [SOURCES.md](SOURCES.md) for the reference history and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for their licenses and attribution notes.

The repository's own project license should be declared separately by the repository owner; third-party licenses do not automatically license AI Studio itself.
