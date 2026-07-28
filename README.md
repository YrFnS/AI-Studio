# AI Studio

Multi-provider AI image and video generation studio built with Next.js. It includes image editing, prompt management, provider/model configuration, and a browser-local gallery.

## Features

- **Image Generation** — Text-to-image, image-to-image, variations, upscaling, and style controls
- **Video Generation** — Text-to-video and image-to-video across supported providers
- **Cinema Studio** — Cinematic presets for cameras, lenses, lighting, film stocks, and color grading
- **Gallery** — Search, favorite, organize, and delete generated media
- **Collections** — Group generations into named browser-local collections
- **Prompt Management** — Prompt history, templates, suggestions, and a smart prompt builder
- **Model Comparison** — Run supported models side by side
- **Multi-Provider Support** — Static provider catalogs plus dynamic model discovery where provider APIs support it
- **BYOK API Keys** — Store provider credentials in the browser and use them through same-origin API routes
- **Settings Export/Import** — Back up and restore browser-local configuration
- **Keyboard Shortcuts** — Navigation and generation shortcuts throughout the studio

## Tech Stack

- **Framework:** Next.js 16 with the App Router and standalone output
- **Language:** TypeScript
- **UI:** React 19, Tailwind CSS 4, and shadcn/ui primitives
- **State:** Zustand
- **Storage:** IndexedDB for keys, generations, prompts, collections, and model metadata
- **Animations:** Framer Motion
- **Package Manager:** Bun

No server-side application database is required.

## Prerequisites

- Bun 1.3 or newer
- Node.js 18 or newer for supporting tooling

## Installation

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

There is no database migration or `DATABASE_URL` configuration step. Browser data is created automatically in IndexedDB when the application starts.

## Provider Setup

1. Open **Settings** in the application.
2. Add an API key for each provider you plan to use.
3. Test the key where provider validation is available.
4. Select a supported provider and model in Image Studio, Video Studio, or Cinema Studio.

API keys are stored in IndexedDB. When a generation is requested, the selected key is sent to this application's same-origin Next.js API route, which then calls the provider. Polling requests send keys in request headers rather than URL query strings.

Do not deploy the application behind infrastructure that logs sensitive request headers or bodies without appropriate redaction.

## Validation

```bash
bun run typecheck
bun run test
bun run lint
bun run check
```

`bun run build` runs the validation suite before producing the standalone Next.js build.

## Production Build

```bash
bun run build
bun run start
```

The build copies static and public assets into `.next/standalone` so the standalone server can be deployed directly.

## Project Structure

```text
├── src/
│   ├── app/
│   │   ├── api/                    # Provider and generation API routes
│   │   ├── layout.tsx              # Root layout
│   │   ├── template.tsx            # Client runtime bridge
│   │   └── page.tsx                # Main studio shell
│   ├── components/
│   │   ├── studio/                 # Image, video, cinema, gallery, and settings UI
│   │   ├── ui/                     # shadcn/ui components
│   │   └── generation-runtime-bridge.tsx
│   ├── hooks/                      # Client hooks
│   └── lib/
│       ├── idb.ts                  # IndexedDB persistence
│       ├── data.ts                 # Client data service
│       ├── providers-data.ts       # Provider/model definitions
│       ├── generation-job.ts       # Opaque async job metadata
│       └── server/                 # Server-only input validation helpers
├── public/
├── bun.lock
├── next.config.ts
└── package.json
```

## Data Architecture

The following data is stored locally in the current browser profile:

- Provider API keys
- Generation records and result URLs/data
- Prompt history and saved prompts
- Collections and collection memberships
- Uploaded reference images and thumbnails
- Custom models and discovered-model cache entries

Generated media hosted by third-party providers can expire. The gallery stores the returned URL or data URL; it does not automatically copy every remote provider asset into durable object storage.

Clearing browser site data removes the local AI Studio workspace.

## Security Notes

- Async provider jobs use an opaque application job token containing the provider, model, and provider job ID.
- Polling accepts API keys through a request header and disables caching.
- Server-side image ingestion permits bounded HTTPS image responses and blocks local, private, and reserved network addresses.
- Unsupported provider/action combinations fail explicitly instead of falling back to another provider API.

## License

No license file is currently published. All rights are reserved unless the repository owner adds an explicit license.
