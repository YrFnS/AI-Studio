# AI Studio

AI Studio is a local-first, multi-provider workspace for AI image and video generation. It runs as a Next.js application, stores user data in the browser, and lets each user connect providers with their own API keys through the Settings UI.

## Architecture at a glance

- **No external database** — there is no PostgreSQL, SQLite, Prisma, Supabase, or hosted database requirement.
- **UI-managed provider keys** — users add and remove keys from the web interface; provider keys are not configured through `.env` files.
- **Browser persistence** — keys, generations, prompts, collections, reference images, and custom models are stored in IndexedDB.
- **Explicit generation client** — every browser module that submits or polls generation work imports the shared client directly; AI Studio does not replace `window.fetch` globally.
- **Typed generation lifecycle** — primary studios, model comparison, editing, and derived actions share one submit, poll, persist, queue, cancellation, and recovery contract.
- **Operation-aware routing** — edit, inpaint, upscale, variation, improve, and image-to-video actions resolve a currently declared compatible provider/model target before submission instead of reusing the current model blindly. P0 still tracks contract-by-contract verification of those declarations.
- **Local provider proxy** — Next.js routes running on the same machine translate requests to each provider's API format.
- **No persistent server-side credentials** — provider keys are not written to a server database or configuration file.
- **Stateless async polling** — long-running jobs return credential-free tokens containing only provider job metadata; polling sends the locally stored key in a POST body.

## Features

- **Image Studio** — text-to-image, image-to-image, editing, inpainting, variations, upscaling, style controls, and advanced parameters
- **Video Studio** — text-to-video and image-to-video through supported provider adapters
- **Cinema Studio** — camera, lens, focal length, aperture, film stock, color grade, lighting, and scene presets
- **Gallery** — search, favorites, timeline views, metadata, and collections
- **Prompt tools** — history, templates, suggestions, quick starters, and a structured prompt builder
- **Model comparison** — run supported image models side by side
- **Custom and discovered models** — combine the built-in catalog with locally saved and dynamically discovered entries
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
- Custom models and cached model discovery results

Clearing this site's browser storage removes this locally persisted data.

### Sent during generation and polling

Every browser generation caller imports `generationFetch` from `src/lib/generation-client.ts`. The client reads the selected provider key from IndexedDB when the caller did not already supply it, sends the request to the local Next.js route, and leaves unrelated network requests untouched. No global fetch monkey patch is installed.

`src/lib/generation-lifecycle.ts` owns the durable lifecycle for new work and interrupted work: creation, submission, asynchronous polling, queue updates, completion or failure persistence, local cancellation, page detachment, and recovery. Immediate provider results and asynchronous jobs therefore use the same terminal path.

For editing and derived actions, `src/lib/generation-operation.ts` selects a declared compatible operation target and builds the dedicated edit, upscale, variation, or image-to-video request. The request body remains credential-free until the explicit client injects the matching locally stored provider key. Image-to-video can select a connected video provider rather than sending an image model identifier to a video endpoint. These rules are provisional until each model/operation pair completes the P0 live-contract verification gate.

When a user starts a generation, the local Next.js route calls the selected provider. The key is used for that request but is not persisted in a server-side database.

For asynchronous providers, the submission route returns a stateless token containing the provider name, model ID, provider job ID, and media kind. The token never includes the provider API key. Each status request is a POST that supplies the token and reads the provider key again from IndexedDB. This allows polling to continue after the local Next.js process restarts without storing provider credentials in process memory.

The shared polling coordinator applies bounded retry, backoff, deadline, cancellation, and terminal-error behavior. `PendingGenerationRecovery` scans IndexedDB after a new page session and resumes older processing jobs through the same polling and persistence path.

Some authenticated provider outputs still use short-lived protected-media tokens so the browser can stream the result without exposing the provider key. Restarting the local process invalidates those temporary protected-media links; eliminating that remaining process-memory dependency is tracked in `docs/P0-RUNTIME-INTEGRITY.md`.

## Provider support

The provider endpoint exposes only model/provider combinations that have a matching executable adapter. The catalog can still contain additional definitions for future work, but unsupported combinations are hidden from generation selectors.

The verified video catalog currently includes:

- Replicate — Seedance 2.0
- fal — Seedance 2.0 and Seedance 2.0 Fast
- Runway — Gen-4.5 and Gen-4 Turbo
- Luma — Ray 2 and Ray 2 Flash
- Google AI Studio — Veo 3.1 and Veo 3.1 Fast

Image support includes the providers implemented in `src/app/api/generate/handlers.ts` and filtered by `src/lib/provider-capabilities.ts`.

Operation-aware editing and derived actions currently use the compatibility rules in `src/lib/generation-operation.ts`. P0 tracks the remaining work to verify those rules against live provider contracts and promote them into the authoritative registry used by every model selector and generation route.

## Project structure

```text
src/
├── app/
│   ├── api/
│   │   ├── generate/             # Provider submission, polling, editing, and media proxy routes
│   │   ├── keys/                 # Provider-key connection tests
│   │   ├── models/               # Model catalog and discovery endpoints
│   │   ├── prompt-suggestions/   # Prompt assistance
│   │   ├── prompt-templates/     # Curated templates
│   │   └── providers/            # Executable provider/model listing
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
    ├── generation-operation.ts   # Provisional operation-aware provider/model request planning
    ├── generation-poller.ts      # Shared resilient polling policy
    ├── idb.ts                    # Browser persistence
    ├── provider-capabilities.ts  # Executable adapter matrix
    ├── providers-data.ts         # Static provider and model definitions
    ├── server-generation-store.ts # Temporary compatibility for legacy jobs
    └── server-media-store.ts     # Temporary authenticated-media proxy context
```

## Reference sources and notices

The project was informed by several public prompt collections and creative-studio projects. See [SOURCES.md](SOURCES.md) for the reference history and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for their licenses and attribution notes.

The repository's own project license should be declared separately by the repository owner; third-party licenses do not automatically license AI Studio itself.
