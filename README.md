# AI Studio

Multi-provider AI image and video generation studio built with Next.js, featuring editing capabilities, prompt management, and a gallery system.

## Features

- **Image Generation** — Text-to-image, image-to-image, inpainting, variations, upscaling, style transfer
- **Video Generation** — Text-to-video and image-to-video with multiple providers
- **Cinema Studio** — Advanced cinematic generation with presets and lighting controls
- **Gallery** — Browse, search, favorite, and organize generations into collections
- **Prompt Management** — Prompt history, suggestions, templates, and a smart prompt builder
- **Model Comparison** — Generate with multiple models side-by-side
- **Multi-Provider Support** — 16+ providers (OpenAI, Stability AI, Replicate, Fal.ai, and more)
- **API Key Management** — Store and manage keys for multiple providers
- **Settings Export/Import** — Backup and restore your configuration
- **Keyboard Shortcuts** — Full keyboard navigation support

## Tech Stack

- **Framework:** Next.js 16 (App Router, standalone output)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **State:** Zustand
- **Storage:** IndexedDB (client-side, BYOK model)
- **No server-side database required
- **Animations:** Framer Motion
- **Package Manager:** Bun

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- Node.js >= 18 (for some tooling)

### Installation

```bash
# Install dependencies
bun install

# Set up the database
bun run db:push

# Start the dev server
bun run dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=file:./db/custom.db
```


### Production Build

```bash
bun run build
bun run start
```

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   │   ├── collections/    # Collection CRUD
│   │   │   ├── generate/       # Image/video generation endpoints
│   │   │   ├── gallery/        # Gallery listing & timeline
│   │   │   ├── keys/           # API key management
│   │   │   ├── models/         # Model discovery & listing
│   │   │   ├── prompts/        # Prompt history CRUD
│   │   │   ├── prompt-suggestions/
│   │   │   ├── prompt-templates/
│   │   │   ├── providers/      # Provider listing
│   │   │   ├── seed/           # Database seeding
│   │   │   ├── settings/       # Export/import settings
│   │   │   └── stats/          # Usage statistics
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main page
│   ├── components/
│   │   ├── studio/             # Main studio components
│   │   │   ├── image-studio.*  # Image generation studio
│   │   │   ├── video-studio.*  # Video generation studio
│   │   │   ├── cinema-studio.* # Cinema studio
│   │   │   ├── gallery.*       # Gallery components
│   │   │   ├── settings.*      # Settings panel
│   │   │   └── ...             # Shared studio components
│   │   ├── ui/                 # shadcn/ui components
│   │   └── *.tsx               # Shared components
│   ├── hooks/                  # Custom React hooks
│   └── lib/                    # Utilities, store, DB client
├── prisma/
│   └── schema.prisma           # Database schema
├── public/                     # Static assets
├── db/                         # SQLite database (gitignored)
└── package.json
```

## Data Architecture

All data is stored client-side in IndexedDB — no server-side database needed:

- **API Keys** — Stored in IndexedDB (BYOK model, keys never leave the browser)
- **Generations** — Generation history with prompts, params, results, and parent-child branching
- **Collections** — User-created collections for organizing generations
- **Prompts** — Saved prompt history with categories and favorites
- **Reference Images** — Uploaded reference images with thumbnails
- **Providers & Models** — Static definitions in `src/lib/providers-data.ts`

## License

Private project.
