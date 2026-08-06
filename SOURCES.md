# Reference Sources

This file records public projects and collections consulted while designing AI Studio. It is intended as a durable provenance log, not as a claim that every referenced idea or file was copied into this repository.

## Primary references confirmed by the project owner

### YouMind OpenLab — Awesome GPT Image 2 Prompts

- Repository: https://github.com/YouMind-OpenLab/awesome-gpt-image-2
- Reference areas: prompt taxonomy, use-case categories, visual-style categories, subject categories, generated examples, gallery browsing, search, and reusable prompt structures
- Upstream license: CC BY 4.0, as declared by the upstream repository

### YouMind OpenLab — Awesome Nano Banana Pro Prompts

- Repository: https://github.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts
- Reference areas: prompt-library organization, multimodal editing examples, category browsing, reusable prompt variables, and gallery-oriented presentation
- Upstream license: CC BY 4.0, as declared by the upstream repository

### ClabstreamTeam — Open Higgsfield AI

- Repository: https://github.com/ClabstreamTeam/Open-Higgsfield-AI
- Reference areas: creative-studio workflow, image/video/cinema navigation, dark studio interface, API-key setup, generation history, prompt tools, camera controls, and asynchronous provider jobs
- Upstream licensing note: `packages/studio/package.json` declares MIT for the reusable studio package. Individual files or other portions of the repository should still be checked before reuse.

## Related sources reviewed during the repository audit

### YouMind OpenLab — Awesome Seedance 2 Prompts

- Repository: https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts
- Reference areas: video-prompt structure, scene timing, camera movement, consistency instructions, video gallery playback, and video-specific discovery
- Upstream license: CC BY 4.0, as declared by the upstream repository

### Other related YouMind OpenLab collections

These repositories belong to the same prompt-collection ecosystem and were reviewed as adjacent references. They are recorded here so future maintainers can distinguish the broader research set from confirmed direct sources:

- https://github.com/YouMind-OpenLab/awesome-seedream-4.5
- https://github.com/YouMind-OpenLab/awesome-gpt-image-1.5
- https://github.com/YouMind-OpenLab/awesome-gemini-3-prompts
- https://github.com/YouMind-OpenLab/awesome-grok-imagine-prompts

Their presence in this list does not assert that content was directly imported into AI Studio.

## How references should be used

1. Prefer original implementation and original wording.
2. When adapting licensed content, preserve the upstream attribution and comply with its license.
3. Do not copy generated images, screenshots, prompts, or code unless the upstream license permits the intended use.
4. Record newly consulted repositories in this file before merging substantial inspired or adapted work.
5. Put license-specific attribution in `THIRD_PARTY_NOTICES.md` when content is distributed with AI Studio.

## Current relationship to AI Studio

AI Studio is a separate local-first, multi-provider application. Its IndexedDB persistence, provider adapter layer, local job-token polling, protected media proxy, custom-model workflow, gallery collections, and React/shadcn implementation are maintained in this repository.
