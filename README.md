# AI Studio

AI Studio is a local-first, multi-provider workspace for AI image and video generation. It runs as a Next.js application, stores user data in the browser, and lets each user connect providers with their own API keys through the Settings UI.

## Architecture at a glance

- **No external database** — there is no PostgreSQL, SQLite, Prisma, Supabase, or hosted database requirement.
- **UI-managed provider keys** — users add and remove keys from the web interface; provider keys are not configured through `.env` files.
- **Browser persistence** — keys, generations, prompts, collections, reference images, custom model definitions, and downloaded protected media are stored in IndexedDB.
- **Explicit generation client** — every browser module that submits or polls generation work imports the shared client directly; AI Studio does not replace `window.fetch` globally.
- **Typed generation lifecycle** — primary studios, model comparison, editing, and derived actions share one submit, poll, persist, queue, cancellation, and recovery contract.
- **Authoritative operation registry** — every executable provider/model/operation combination declares its owning route, adapter, and verification level. Raw catalog capability labels cannot make a model executable.
- **Strict route schemas** — generation routes reject malformed, oversized, unknown, or out-of-range input before provider contact.
- **Bounded provider transport** — provider submissions and status checks have deadlines, bounded error reads, and normalized public errors.
- **Safe image ingestion** — reference images have one 10 MB binary limit, strict image types, HTTPS-only remote fetching, redirect limits, and private-network blocking.
- **Restart-safe protected media** — authenticated provider outputs use credential-free descriptors, POST-only retrieval, and locally persisted Blobs rather than process-memory tokens.
- **Versioned local backup** — Settings can export and restore non-key IndexedDB data, reference images, prompts, collections, custom/discovered definitions, and downloaded media assets.
- **Production browser hardening** — a Content Security Policy and security headers are applied through the Next.js configuration.
- **No persistent server-side credentials** — provider keys are not written to a server database or configuration file.
- **Stateless async polling** — long-running jobs return credential-free tokens containing only provider job metadata; polling sends the locally stored key in a POST body.

## Features

- **Image Studio** — text-to-image, registered image-to-image models, editing, inpainting, variations, upscaling, style controls, and advanced parameters
- **Video Studio** — text-to-video and image-to-video through registered provider adapters
- **Cinema Studio** — camera, lens, focal length, aperture, film stock, color grade, lighting, and scene presets
- **Gallery** — full IndexedDB search, favorites, timeline views, metadata, collections, and locally persisted protected outputs
- **Local backup and restore** — versioned non-key backups with replace or merge restore modes and downloaded media assets
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
- IndexedDB for metadata and generated media persistence
- Zod for route contracts and parameter bounds
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
- Downloaded protected image or video Blobs
- Prompt history and saved prompts
- Collections and collection membership
- Reference images and thumbnails
- Custom model definitions and cached model discovery results

Clearing this site's browser storage removes this locally persisted data, including downloaded protected outputs.

### Sent during generation and polling

Every browser generation caller imports `generationFetch` from `src/lib/generation-client.ts`. The client reads the selected provider key from IndexedDB when the caller did not already supply it, sends the request to the local Next.js route, and leaves unrelated network requests untouched. No global fetch monkey patch is installed.

`src/lib/generation-lifecycle.ts` owns the durable lifecycle for new and interrupted work: creation, submission, asynchronous polling, queue updates, completion or failure persistence, local cancellation, page detachment, recovery, and protected-media finalization. Immediate provider results and asynchronous jobs use the same terminal path.

`src/lib/generation-registry.ts` is the executable source of truth. A model must have a contract for the exact operation and route before it can appear in generation selectors or reach a provider. Each contract records an adapter ID and one of three verification levels:

- `adapter-implemented` — code exists and automated contract coverage passes
- `contract-reviewed` — the adapter has also been checked against provider documentation
- `live-verified` — an owner-supplied-key smoke test has been recorded

No contract is promoted to `live-verified` without manual evidence.

For editing and derived actions, `src/lib/generation-operation.ts` consumes these registry contracts and builds the dedicated edit, upscale, variation, or image-to-video request. The request body remains credential-free until the explicit client injects the matching locally stored provider key.

When a user starts a generation, the local route first parses the body through the operation-specific Zod schema in `src/lib/server/generation-request.ts`. The parser enforces content type, total body size, required fields, strict unknown-field rejection, and parameter bounds. The route then calls `requireModelOperation` before contacting the selected provider.

Provider calls use `src/lib/server/provider-request.ts`. Generation submissions have a 120-second deadline, status checks have a 20-second deadline, and provider error bodies are read only up to 8 KB. Authentication, quota, rejected-request, timeout, network, unavailable, and invalid-response failures are normalized. Raw provider response text is not returned to the browser.

For asynchronous providers, the submission route returns a stateless token containing the provider name, model ID, provider job ID, and media kind. The token never includes the provider API key. Each status request is a POST that supplies the token and reads the provider key again from IndexedDB. This allows polling to continue after the local Next.js process restarts without storing provider credentials in process memory.

The shared polling coordinator applies bounded retry, backoff, deadline, cancellation, and terminal-error behavior. `PendingGenerationRecovery` scans IndexedDB after a new page session and resumes older processing jobs through the same polling and persistence path.

## Local backup and restore

Settings → Transfer exports a versioned JSON backup directly in the browser. It includes non-key IndexedDB metadata, prompts, collections, reference images, custom and discovered model definitions, and downloaded media Blobs encoded for transfer. API keys are deliberately excluded and remain in their separate, explicitly warned plain-text key export flow.

Restore supports two modes:

- **Replace** clears non-key AI Studio stores before restoring the backup.
- **Merge** keeps unrelated local records and replaces records that share the same IndexedDB key.

Both modes preserve stored API keys. Large downloaded videos can produce large backup files because the media is included in the browser-generated JSON.

## Protected media flow

Some providers return authenticated media rather than a public result URL. AI Studio handles those outputs without server-side credential storage or process-memory tokens:

1. The status route returns a credential-free descriptor containing the provider and provider job ID.
2. The browser reloads the matching key from IndexedDB and sends the descriptor and key to `/api/generate/media` in a POST body.
3. The media route rechecks the completed provider operation, accepts only trusted provider media hosts, and streams the file through bounded transport.
4. The browser validates the response and stores the resulting Blob in the IndexedDB `mediaAssets` store.
5. The generation record stores only the local asset ID, MIME type, and byte size.
6. Gallery reads recreate session-scoped `blob:` URLs from the locally stored asset after reload or restart.

The media key is never placed in a URL, the protected provider URL is never exposed to the browser, and deleting a generation also deletes its stored media asset. The current local asset ceiling is 512 MB per protected output.

## Reference image handling

Reference images are limited to 10 MB of decoded binary data and must be PNG, JPEG, WebP, or GIF.

Browser upload flows validate type and size before `FileReader` or base64 conversion. The local upload route repeats those checks before returning a data URL.

Remote image inputs must:

- use HTTPS,
- contain no URL credentials,
- resolve only to public addresses,
- remain below the redirect and timeout limits,
- return image content,
- and stream no more than 10 MB.

This prevents provider adapters from becoming an unrestricted server-side URL fetcher.

## Security headers

`src/lib/security-headers.ts` is applied to every route through `next.config.ts`.

Production includes:

- Content Security Policy
- HTTP Strict Transport Security
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- strict referrer policy
- restrictive permissions policy
- Cross-Origin Opener Policy
- disabled DNS prefetching
- disabled `X-Powered-By`

The production CSP blocks object embedding and framing, restricts base URIs and form actions, and does not permit `unsafe-eval`. Development permits the evaluator required by the Next.js development runtime.

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
│   │   ├── generate/             # Validated submission, polling, protected media, editing, and derived routes
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
    ├── generation-lifecycle.ts   # Submit, poll, persist, queue, cancel, resume, and media finalization
    ├── generation-operation.ts   # Derived-action planning from registry contracts
    ├── generation-poller.ts      # Shared resilient polling policy
    ├── generation-registry.ts    # Provider/model/operation/route/adapter source of truth
    ├── protected-media.ts        # Credential-free protected-media descriptors and limits
    ├── protected-media-client.ts # POST-only authenticated media retrieval
    ├── reference-image-limits.ts # Shared browser and server image limits
    ├── security-headers.ts       # CSP and production browser hardening
    ├── server/
    │   ├── generation-request.ts # Zod schemas and bounded request parsing
    │   ├── generation-response.ts # Normalized public route errors
    │   ├── image-input.ts        # SSRF-safe, size-bounded image loading
    │   ├── provider-request.ts   # Provider deadlines, bounded streaming, and error normalization
    │   └── replicate.ts          # Official-model and version routing
    ├── idb.ts                    # Browser metadata and media-asset persistence
    └── providers-data.ts         # Static provider and model definitions
```

## Reference sources and notices

The project was informed by several public prompt collections and creative-studio projects. See [SOURCES.md](SOURCES.md) for the reference history and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for their licenses and attribution notes.

The repository's own project license should be declared separately by the repository owner; third-party licenses do not automatically license AI Studio itself.
