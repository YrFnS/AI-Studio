import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// In-memory cache for prompt suggestions (avoids excessive LLM calls)
// ---------------------------------------------------------------------------

const suggestionCache = new Map<string, { suggestions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 200;

function getCachedSuggestions(key: string): string[] | null {
  const entry = suggestionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    suggestionCache.delete(key);
    return null;
  }
  return entry.suggestions;
}

function setCachedSuggestions(key: string, suggestions: string[]): void {
  // Evict oldest entries if cache is too large
  if (suggestionCache.size >= MAX_CACHE_SIZE) {
    const oldest = Array.from(suggestionCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );
    for (let i = 0; i < Math.ceil(MAX_CACHE_SIZE / 4); i++) {
      suggestionCache.delete(oldest[i][0]);
    }
  }
  suggestionCache.set(key, { suggestions, timestamp: Date.now() });
}

// ---------------------------------------------------------------------------
// Fallback suggestions when the LLM is unavailable
// ---------------------------------------------------------------------------

function getFallbackSuggestions(partial: string, context: string): string[] {
  const lower = partial.toLowerCase();
  const imageKeywords: Record<string, string[]> = {
    portrait: ['professional studio lighting, shallow depth of field', 'candid expression, natural skin texture', 'dramatic rim lighting, high contrast', 'soft window light, warm tones'],
    landscape: ['golden hour, dramatic sky, vast panorama', 'misty mountains, reflective lake, dawn', 'sunset over ocean, silhouette, long exposure', 'aerial view, lush forests, winding river'],
    cyberpunk: ['neon lights, rain-soaked streets, holographic ads', 'futuristic cityscape, flying cars, dark atmosphere', 'cybernetic character, glowing implants, rain', 'blade runner aesthetic, purple haze, towering skyscrapers'],
    fantasy: ['enchanted forest, bioluminescent mushrooms, mystical', 'dragon soaring over medieval castle, epic', 'elven queen in crystal throne room, ethereal', 'magical portal, swirling energy, ancient ruins'],
    abstract: ['flowing liquid metal, iridescent colors', 'geometric patterns, bold contrast, minimalist', 'fractal explosion, vivid gradients, cosmic', 'organic forms merging with technology, surreal'],
    product: ['clean white background, professional studio lighting', 'lifestyle shot, natural setting, warm tones', 'dramatic spotlight, dark background, luxury feel', 'flat lay, overhead view, minimalist composition'],
    anime: ['vibrant cel shading, dynamic action pose', 'peaceful cherry blossom scene, soft colors', 'mechanical suit design, intricate details', 'school setting, golden afternoon light, slice of life'],
    cinematic: ['dramatic dutch angle, anamorphic lens flare', 'silhouette against burning sunset, epic scale', 'close-up reaction shot, shallow depth of field', 'tracking shot through neon-lit corridor'],
    nature: ['macro shot, dewdrops on leaf, morning light', 'wild animal in natural habitat, telephoto lens', 'underwater coral reef, sun rays penetrating', 'arctic landscape, northern lights, snow'],
    food: ['overhead flat lay, rustic wooden table, warm', 'steaming dish, dramatic side lighting', 'fresh ingredients scattered, garden setting', 'chef plating action shot, professional kitchen'],
  };

  const videoKeywords: Record<string, string[]> = {
    walk: ['slowly walking through fog, mysterious atmosphere', 'walking in rain, cinematic tracking shot', 'strolling through cherry blossoms, peaceful'],
    fly: ['drone shot soaring over mountains, sweeping', 'camera flying through clouds, dramatic reveal', 'aerial flyover of city at night, sparkling lights'],
    dance: ['elegant ballet performance, spotlight, slow motion', 'energetic street dance, urban setting, dynamic', 'flowing contemporary dance, silk fabric, ethereal'],
    timelapse: ['city skyline day to night, bustling traffic', 'flowers blooming in garden, seasons changing', 'clouds rolling over mountain peaks, dramatic'],
  };

  // Try to match keywords
  const allKeywords = context === 'video' ? videoKeywords : imageKeywords;
  for (const [keyword, suggestions] of Object.entries(allKeywords)) {
    if (lower.includes(keyword)) {
      return suggestions.slice(0, 6);
    }
  }

  // Generic suggestions based on context
  if (context === 'video') {
    return [
      'cinematic tracking shot, slow motion, dramatic lighting',
      'timelapse of sunset over city skyline, 4K',
      'drone flyover of landscape, sweeping camera motion',
      'close-up detail shot, shallow depth of field, film grain',
      'slow pan across scene, atmospheric fog, moody colors',
      'dynamic camera movement, smooth transitions, professional',
    ];
  }

  return [
    'highly detailed, professional quality, 8K resolution',
    'dramatic lighting, cinematic composition, sharp focus',
    'vibrant colors, rich textures, masterpiece quality',
    'ethereal atmosphere, soft glow, dreamlike quality',
    'photorealistic, natural lighting, ultra detailed',
    'artistic interpretation, bold style, striking composition',
  ];
}

// ---------------------------------------------------------------------------
// GET /api/prompt-suggestions?partial=...&context=image|video
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const partial = searchParams.get('partial')?.trim() || '';
    const context = searchParams.get('context') || 'image'; // 'image' | 'video'

    if (partial.length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    // Check cache first
    const cacheKey = `${context}:${partial.toLowerCase()}`;
    const cached = getCachedSuggestions(cacheKey);
    if (cached) {
      return NextResponse.json({ suggestions: cached });
    }

    // Try LLM generation with timeout
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const systemPrompt = `You are a creative AI prompt completion assistant for ${context === 'video' ? 'video' : 'image'} generation. 
Given a partial prompt, suggest 6 short, creative completions. Each suggestion should be 5-15 words and append naturally to the user's text. Be specific, vivid, and varied in style/mood. Do NOT repeat the user's text - only provide the completion part.

Rules:
- Return ONLY a JSON array of strings, no other text
- Each string is a completion that follows naturally after the user's partial prompt
- Make suggestions diverse: different moods, styles, compositions, lighting
- Keep each completion between 5-15 words
- Be creative and specific, avoid generic phrases
- Focus on visual details: lighting, composition, mood, style, colors, atmosphere`;

      const response = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Complete this ${context} prompt: "${partial}"` },
        ],
        thinking: { type: 'disabled' },
      });

      const content = response.choices?.[0]?.message?.content || '';
      
      // Parse the JSON array from the response
      let suggestions: string[] = [];
      try {
        // Try to extract JSON array from the response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // If JSON parsing fails, try to split by newlines
        suggestions = content
          .split('\n')
          .map((line: string) => line.replace(/^[\d\-\.\)\]\s]+/, '').trim())
          .filter((line: string) => line.length > 0 && line.length <= 80);
      }

      // Validate and clean suggestions
      suggestions = suggestions
        .filter((s: string) => typeof s === 'string' && s.trim().length > 0)
        .map((s: string) => s.trim().replace(/^["']|["']$/g, ''))
        .filter((s: string) => s.length >= 3 && s.length <= 80)
        .slice(0, 8);

      // If we got fewer than 3 suggestions, supplement with fallbacks
      if (suggestions.length < 3) {
        const fallbacks = getFallbackSuggestions(partial, context);
        for (const fb of fallbacks) {
          if (suggestions.length >= 6) break;
          if (!suggestions.some((s) => s.toLowerCase() === fb.toLowerCase())) {
            suggestions.push(fb);
          }
        }
      }

      // Cache the results
      setCachedSuggestions(cacheKey, suggestions);

      return NextResponse.json({ suggestions });
    } catch {
      // LLM failed, use fallback suggestions
      const suggestions = getFallbackSuggestions(partial, context);
      setCachedSuggestions(cacheKey, suggestions);
      return NextResponse.json({ suggestions });
    }
  } catch (error) {
    console.error('Prompt suggestions error:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
