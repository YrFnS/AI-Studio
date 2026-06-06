import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, type = 'enhance' } = body;

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Build enhancement instructions based on type
    let systemPrompt = '';
    let userMessage = '';

    switch (type) {
      case 'enhance':
        systemPrompt = `You are an expert AI image prompt engineer. Your job is to take a basic image generation prompt and enhance it with rich, specific details that will produce stunning, high-quality images. Add details about:
- Lighting (natural, studio, dramatic, golden hour, neon, etc.)
- Composition (close-up, wide angle, bird's eye, symmetrical, etc.)
- Style (photorealistic, cinematic, oil painting, digital art, etc.)
- Mood/atmosphere (serene, dramatic, mystical, vibrant, etc.)
- Technical quality keywords (8k, ultra detailed, sharp focus, etc.)
- Color palette hints

Keep the enhanced prompt under 200 words. Return ONLY the enhanced prompt, nothing else.`;
        userMessage = prompt;
        break;

      case 'expand':
        systemPrompt = `You are an expert AI image prompt engineer. Expand the given prompt into a more detailed, comprehensive description. Add scene details, environment, textures, and artistic direction. Keep under 300 words. Return ONLY the expanded prompt.`;
        userMessage = prompt;
        break;

      case 'style':
        systemPrompt = `You are an expert AI image prompt engineer. Rewrite the prompt with strong artistic style direction. Add specific art movement references, technique names, and style keywords. Keep under 200 words. Return ONLY the styled prompt.`;
        userMessage = prompt;
        break;

      default:
        systemPrompt = `You are an expert AI image prompt engineer. Enhance this prompt for better AI image generation. Return ONLY the enhanced prompt.`;
        userMessage = prompt;
    }

    // Use the z-ai-web-dev-sdk for LLM
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const response = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });

    const enhancedPrompt = response.choices?.[0]?.message?.content || prompt;

    return NextResponse.json({
      originalPrompt: prompt,
      enhancedPrompt: enhancedPrompt.trim(),
      type,
    });
  } catch (error) {
    console.error('Prompt enhance error:', error);
    return NextResponse.json({ error: 'Failed to enhance prompt' }, { status: 500 });
  }
}
