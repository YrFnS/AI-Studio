// ---------------------------------------------------------------------------
// Preset data constants for Image Studio
// Extracted from image-studio.tsx for maintainability
// ---------------------------------------------------------------------------

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;

export const RATIO_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '4:3': 'Classic',
  '3:4': 'Tall',
  '3:2': 'Photo',
  '2:3': 'Slim',
};

export const RESOLUTION_TIERS = ['standard', 'hd', 'ultra'] as const;

export const TIER_LABELS: Record<string, string> = {
  'standard': 'Standard',
  'hd': 'High',
  'ultra': 'Ultra HD',
};

export const RESOLUTION_MAP: Record<string, Record<string, { width: number; height: number }>> = {
  '1:1': { standard: { width: 512, height: 512 }, hd: { width: 1024, height: 1024 }, ultra: { width: 2048, height: 2048 } },
  '16:9': { standard: { width: 912, height: 512 }, hd: { width: 1824, height: 1024 }, ultra: { width: 1920, height: 1080 } },
  '9:16': { standard: { width: 512, height: 912 }, hd: { width: 1024, height: 1824 }, ultra: { width: 1080, height: 1920 } },
  '4:3': { standard: { width: 684, height: 512 }, hd: { width: 1368, height: 1024 }, ultra: { width: 1440, height: 1080 } },
  '3:4': { standard: { width: 512, height: 684 }, hd: { width: 1024, height: 1368 }, ultra: { width: 1080, height: 1440 } },
  '3:2': { standard: { width: 768, height: 512 }, hd: { width: 1536, height: 1024 }, ultra: { width: 1620, height: 1080 } },
  '2:3': { standard: { width: 512, height: 768 }, hd: { width: 1024, height: 1536 }, ultra: { width: 1080, height: 1620 } },
};

export const STYLE_PRESETS = [
  {
    id: 'photorealistic',
    label: 'Photorealistic',
    emoji: '📷',
    color: '#d9ff00',
    suffix: ', photorealistic, ultra detailed, 8k, DSLR quality, sharp focus, professional photography',
    negSuffix: 'cartoon, anime, painting, illustration, low quality, blurry',
  },
  {
    id: 'anime',
    label: 'Anime',
    emoji: '🌸',
    color: '#ff6b9d',
    suffix: ', anime style, vibrant colors, detailed illustration, studio ghibli inspired, high quality anime art',
    negSuffix: 'photorealistic, photo, realistic, 3d render, low quality',
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    emoji: '🎬',
    color: '#00d4ff',
    suffix: ', cinematic still, dramatic lighting, film grain, anamorphic lens, color graded, movie scene, 35mm',
    negSuffix: 'cartoon, anime, low quality, flat lighting',
  },
  {
    id: 'oil-painting',
    label: 'Oil Painting',
    emoji: '🎨',
    color: '#fb923c',
    suffix: ', oil painting style, thick brushstrokes, canvas texture, rich colors, masterpiece painting, classical art',
    negSuffix: 'photo, photorealistic, digital art, 3d render',
  },
  {
    id: 'digital-art',
    label: 'Digital Art',
    emoji: '💻',
    color: '#c084fc',
    suffix: ', digital art, concept art, detailed illustration, trending on artstation, vibrant, high quality',
    negSuffix: 'photo, realistic, blurry, low quality',
  },
  {
    id: 'watercolor',
    label: 'Watercolor',
    emoji: '🖌️',
    color: '#34d399',
    suffix: ', watercolor painting style, soft edges, flowing colors, paper texture, delicate washes, artistic',
    negSuffix: 'photo, photorealistic, digital, sharp edges, 3d render',
  },
  {
    id: '3d-render',
    label: '3D Render',
    emoji: '🧊',
    color: '#60a5fa',
    suffix: ', 3d render, octane render, unreal engine, ray tracing, volumetric lighting, highly detailed, studio lighting',
    negSuffix: 'photo, 2d, flat, sketch, painting',
  },
  {
    id: 'pixel-art',
    label: 'Pixel Art',
    emoji: '👾',
    color: '#f472b6',
    suffix: ', pixel art style, 16-bit, retro game aesthetic, clean pixels, limited color palette, nostalgic',
    negSuffix: 'photorealistic, photo, realistic, blurry, high resolution',
  },
  {
    id: 'comic',
    label: 'Comic Book',
    emoji: '💥',
    color: '#fbbf24',
    suffix: ', comic book style, bold outlines, vibrant colors, action poses, halftone dots, speech bubbles, dynamic composition',
    negSuffix: 'photorealistic, photo, realistic, muted colors, blurry',
  },
  {
    id: 'isometric',
    label: 'Isometric',
    emoji: '🏗️',
    color: '#38bdf8',
    suffix: ', isometric view, 3D isometric illustration, clean design, pastel colors, miniature world, detailed tiny elements',
    negSuffix: 'photo, realistic, perspective, blurry, messy',
  },
  {
    id: 'line-art',
    label: 'Line Art',
    emoji: '✏️',
    color: '#a3a3a3',
    suffix: ', line art, clean lines, minimal, black and white outline drawing, detailed pen sketch, technical illustration',
    negSuffix: 'color, painted, photorealistic, 3d, shaded',
  },
  {
    id: 'sticker',
    label: 'Sticker',
    emoji: '🏷️',
    color: '#fb7185',
    suffix: ', sticker design, die-cut sticker, bold outlines, white border, flat colors, cute illustration, vector style',
    negSuffix: 'photorealistic, photo, realistic, 3d render, complex background',
  },
  {
    id: 'poster',
    label: 'Poster Art',
    emoji: '🖼️',
    color: '#a78bfa',
    suffix: ', poster art style, bold graphic design, strong composition, vintage poster, flat design, striking typography layout',
    negSuffix: 'photo, photorealistic, 3d render, blurry, subtle',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    emoji: '📻',
    color: '#d97706',
    suffix: ', vintage style, retro aesthetic, aged texture, muted warm tones, nostalgic, film grain, old photograph',
    negSuffix: 'modern, neon, sharp, digital, clean',
  },
] as const;

export const SCHEDULER_OPTIONS = [
  { id: 'normal', label: 'Normal' },
  { id: 'karras', label: 'Karras' },
  { id: 'exponential', label: 'Exponential' },
  { id: 'sgmm_uniform', label: 'SGM Uniform' },
  { id: 'beta', label: 'Beta' },
] as const;

export const LIGHTING_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'dramatic', label: 'Dramatic', emoji: '🎭', suffix: ', dramatic lighting, strong shadows, high contrast' },
  { id: 'studio', label: 'Studio', emoji: '💡', suffix: ', professional studio lighting, soft box, three-point lighting' },
  { id: 'natural', label: 'Natural', emoji: '🌤️', suffix: ', natural lighting, soft daylight, ambient illumination' },
  { id: 'neon', label: 'Neon', emoji: '💜', suffix: ', neon lighting, glowing neon signs, vibrant electric light, cyberpunk atmosphere' },
  { id: 'golden-hour', label: 'Golden Hour', emoji: '🌅', suffix: ', golden hour lighting, warm sunset glow, long shadows, amber tones' },
  { id: 'low-key', label: 'Low Key', emoji: '🌑', suffix: ', low key lighting, dark moody atmosphere, deep shadows, minimal fill light' },
  { id: 'high-key', label: 'High Key', emoji: '☁️', suffix: ', high key lighting, bright even illumination, minimal shadows, airy feel' },
  { id: 'backlit', label: 'Backlit', emoji: '✨', suffix: ', backlit silhouette, rim lighting, glowing edges, lens flare' },
  { id: 'rembrandt', label: 'Rembrandt', emoji: '🖼️', suffix: ', Rembrandt lighting, classic triangle of light on cheek, chiaroscuro' },
  { id: 'butterfly', label: 'Butterfly', emoji: '🦋', suffix: ', butterfly lighting, overhead light source, symmetrical shadows under features' },
  { id: 'volumetric', label: 'Volumetric', emoji: '🌫️', suffix: ', volumetric lighting, god rays, light shafts, atmospheric haze' },
] as const;

export const COLOR_MOOD_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'warm', label: 'Warm', emoji: '🔥', suffix: ', warm color palette, amber and orange tones, cozy atmosphere' },
  { id: 'cool', label: 'Cool', emoji: '❄️', suffix: ', cool color palette, blue and teal tones, calm atmosphere' },
  { id: 'monochrome', label: 'Mono', emoji: '⬛', suffix: ', monochrome color palette, black and white, grayscale' },
  { id: 'vibrant', label: 'Vibrant', emoji: '🌈', suffix: ', vibrant saturated colors, bold color contrast, high chroma' },
  { id: 'muted', label: 'Muted', emoji: '🌫️', suffix: ', muted desaturated colors, subtle tones, understated palette' },
  { id: 'pastel', label: 'Pastel', emoji: '🍬', suffix: ', pastel color palette, soft light colors, gentle tones' },
  { id: 'cinematic', label: 'Cinematic', emoji: '🎬', suffix: ', cinematic color grading, teal and orange, film look, color graded' },
  { id: 'earth', label: 'Earth', emoji: '🌿', suffix: ', earth tone colors, browns and greens, natural palette' },
  { id: 'neon-glow', label: 'Neon', emoji: '⚡', suffix: ', neon color palette, electric pink and cyan, synthwave colors' },
  { id: 'vintage-film', label: 'Vintage', emoji: '📼', suffix: ', vintage film color, faded colors, slight color shift, analog feel' },
] as const;

export const CAMERA_SHOT_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'extreme-closeup', label: 'Extreme CU', emoji: '🔍', suffix: ', extreme close-up shot, macro detail, filling the frame' },
  { id: 'closeup', label: 'Close-up', emoji: '👤', suffix: ', close-up shot, face and shoulders, intimate framing' },
  { id: 'medium', label: 'Medium', emoji: '🧍', suffix: ', medium shot, waist up, balanced framing' },
  { id: 'wide', label: 'Wide', emoji: '🏔️', suffix: ', wide shot, full body with environment, establishing shot' },
  { id: 'ultra-wide', label: 'Ultra Wide', emoji: '🌍', suffix: ', ultra wide panoramic shot, expansive view, sweeping landscape' },
  { id: 'birds-eye', label: "Bird's Eye", emoji: '🦅', suffix: ", bird's eye view, top-down perspective, overhead shot" },
  { id: 'low-angle', label: 'Low Angle', emoji: '⬆️', suffix: ', low angle shot, looking upward, powerful perspective' },
  { id: 'dutch', label: 'Dutch', emoji: '↗️', suffix: ', dutch angle, tilted camera, dynamic diagonal composition' },
  { id: 'over-shoulder', label: 'OTS', emoji: '🗣️', suffix: ', over-the-shoulder shot, depth and perspective, cinematic framing' },
  { id: 'portrait', label: 'Portrait', emoji: '📸', suffix: ', portrait framing, shallow depth of field, bokeh background, 85mm lens' },
] as const;

export const SUBJECT_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'person', label: 'Person', emoji: '👤', suffix: ', a person, human subject, detailed face' },
  { id: 'animal', label: 'Animal', emoji: '🦁', suffix: ', an animal, wildlife, creature' },
  { id: 'landscape', label: 'Landscape', emoji: '🏔️', suffix: ', a landscape, nature scenery, vast environment' },
  { id: 'cityscape', label: 'Cityscape', emoji: '🏙️', suffix: ', a cityscape, urban environment, architecture' },
  { id: 'food', label: 'Food', emoji: '🍕', suffix: ', food photography, delicious meal, culinary' },
  { id: 'product', label: 'Product', emoji: '📦', suffix: ', product photography, commercial shot, clean background' },
  { id: 'vehicle', label: 'Vehicle', emoji: '🚗', suffix: ', a vehicle, automotive, transportation' },
  { id: 'fantasy', label: 'Fantasy', emoji: '🐉', suffix: ', fantasy creature, mythical being, magical' },
  { id: 'interior', label: 'Interior', emoji: '🏠', suffix: ', interior design, room, indoor space' },
  { id: 'abstract', label: 'Abstract', emoji: '🌀', suffix: ', abstract art, non-representational, shapes and forms' },
  { id: 'nature', label: 'Nature', emoji: '🌿', suffix: ', nature, plants, flowers, botanical' },
] as const;

export const DETAIL_LEVEL_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'minimal', label: 'Minimal', emoji: '✨', suffix: ', minimalist, simple, clean, sparse details' },
  { id: 'moderate', label: 'Moderate', emoji: '🖌️', suffix: ', moderate detail, balanced complexity' },
  { id: 'high', label: 'High', emoji: '🔍', suffix: ', highly detailed, intricate, elaborate, rich textures' },
  { id: 'ultra', label: 'Ultra', emoji: '🔬', suffix: ', ultra detailed, hyper-detailed, every fine detail visible, micro-textures, 8k resolution' },
] as const;

export const COMPOSITION_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'rule-of-thirds', label: 'Rule of Thirds', emoji: '三分', suffix: ', rule of thirds composition, well-balanced framing' },
  { id: 'centered', label: 'Centered', emoji: '🎯', suffix: ', centered composition, symmetrical, focused center' },
  { id: 'golden-ratio', label: 'Golden Ratio', emoji: '🌀', suffix: ', golden ratio composition, spiral framing, harmonious' },
  { id: 'leading-lines', label: 'Leading Lines', emoji: '📏', suffix: ', leading lines composition, perspective depth, directional flow' },
  { id: 'symmetry', label: 'Symmetry', emoji: '⚖️', suffix: ', perfect symmetry, mirrored composition, balanced' },
  { id: 'frame-in-frame', label: 'Frame in Frame', emoji: '🖼️', suffix: ', frame within frame composition, layered depth, portal effect' },
  { id: 'negative-space', label: 'Neg. Space', emoji: '🔲', suffix: ', negative space composition, minimal, lots of empty space, subject isolated' },
  { id: 'diagonal', label: 'Diagonal', emoji: '↗️', suffix: ', diagonal composition, dynamic angle, energetic' },
] as const;

export const EMOTION_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'happy', label: 'Happy', emoji: '😊', suffix: ', happy, joyful, cheerful, warm feeling' },
  { id: 'melancholic', label: 'Melancholic', emoji: '🌧️', suffix: ', melancholic, sad, wistful, pensive mood' },
  { id: 'dramatic', label: 'Dramatic', emoji: '🎭', suffix: ', dramatic, intense, powerful, theatrical' },
  { id: 'serene', label: 'Serene', emoji: '🧘', suffix: ', serene, calm, peaceful, tranquil, meditative' },
  { id: 'mysterious', label: 'Mysterious', emoji: '🌑', suffix: ', mysterious, enigmatic, secretive, shadowy' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡', suffix: ', energetic, vibrant, dynamic, action-packed' },
  { id: 'romantic', label: 'Romantic', emoji: '💕', suffix: ', romantic, dreamy, love, tender, soft' },
  { id: 'eerie', label: 'Eerie', emoji: '👁️', suffix: ', eerie, unsettling, creepy, uncanny' },
  { id: 'epic', label: 'Epic', emoji: '⚔️', suffix: ', epic, grand, heroic, monumental, awe-inspiring' },
] as const;

export const ERA_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'ancient', label: 'Ancient', emoji: '🏛️', suffix: ', ancient era, classical antiquity, historical' },
  { id: 'medieval', label: 'Medieval', emoji: '⚔️', suffix: ', medieval period, knights, castles, gothic' },
  { id: 'renaissance', label: 'Renaissance', emoji: '🎨', suffix: ', renaissance era, classical art, ornate, baroque' },
  { id: 'victorian', label: 'Victorian', emoji: '🎩', suffix: ', victorian era, 1800s, steampunk, ornate' },
  { id: '1920s', label: '1920s', emoji: '🍸', suffix: ', 1920s art deco, jazz age, gatsby era, roaring twenties' },
  { id: '1950s', label: '1950s', emoji: '📻', suffix: ', 1950s mid-century, retro, vintage americana' },
  { id: '1970s', label: '1970s', emoji: '🪩', suffix: ', 1970s, disco era, groovy, vintage, warm tones' },
  { id: '1990s', label: '1990s', emoji: '📺', suffix: ', 1990s, grunge, early digital, y2k aesthetic' },
  { id: 'cyberpunk', label: 'Cyberpunk', emoji: '🌃', suffix: ', cyberpunk future, neon, high-tech, dystopian' },
  { id: 'futuristic', label: 'Futuristic', emoji: '🚀', suffix: ', far future, sci-fi, advanced technology, sleek' },
] as const;

export const OUTFIT_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'casual', label: 'Casual', emoji: '👕', suffix: ', wearing casual clothes, t-shirt and jeans, relaxed outfit' },
  { id: 'formal', label: 'Formal', emoji: '🤵', suffix: ', wearing formal attire, tailored suit, elegant clothing' },
  { id: 'streetwear', label: 'Streetwear', emoji: '🧢', suffix: ', wearing streetwear, urban fashion, trendy oversized clothes, sneakers' },
  { id: 'fantasy-armor', label: 'Armor', emoji: '⚔️', suffix: ', wearing fantasy armor, ornate plate armor, battle-worn, epic pauldrons' },
  { id: 'sci-fi-suit', label: 'Sci-Fi', emoji: '🚀', suffix: ', wearing futuristic sci-fi suit, sleek bodysuit, high-tech clothing, glowing accents' },
  { id: 'traditional', label: 'Traditional', emoji: '👘', suffix: ', wearing traditional cultural clothing, elegant traditional garments, heritage dress' },
  { id: 'royal', label: 'Royal', emoji: '👑', suffix: ', wearing royal robes, regal attire, crown jewels, ornate cape, luxurious fabric' },
  { id: 'gothic', label: 'Gothic', emoji: '🦇', suffix: ', wearing gothic clothing, dark Victorian dress, lace and velvet, corset, dark elegant' },
  { id: 'athletic', label: 'Athletic', emoji: '🏃', suffix: ', wearing athletic sportswear, fitted gym clothes, running shoes, activewear' },
  { id: 'winter', label: 'Winter', emoji: '🧥', suffix: ', wearing winter clothing, warm coat, scarf, knit sweater, cold weather outfit' },
  { id: 'swimwear', label: 'Swimwear', emoji: '👙', suffix: ', wearing swimwear, beach outfit, summer clothing, poolside attire' },
  { id: 'business', label: 'Business', emoji: '💼', suffix: ', wearing business professional attire, blazer, dress shirt, corporate look' },
  { id: 'bohemian', label: 'Boho', emoji: '🌸', suffix: ', wearing bohemian style, flowing fabrics, layered jewelry, free-spirited fashion' },
  { id: 'military', label: 'Military', emoji: '🎖️', suffix: ', wearing military uniform, camo fatigues, tactical gear, combat boots' },
  { id: 'pirate', label: 'Pirate', emoji: '🏴\u200D☠️', suffix: ', wearing pirate outfit, tricorn hat, long coat, boots, swashbuckler attire' },
] as const;

export const HAIRSTYLE_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'long-straight', label: 'Long Straight', emoji: '👩', suffix: ', long straight hair, flowing hair, sleek and smooth' },
  { id: 'long-wavy', label: 'Long Wavy', emoji: '🌊', suffix: ', long wavy hair, beach waves, flowing loose waves' },
  { id: 'long-curly', label: 'Long Curly', emoji: '🌀', suffix: ', long curly hair, voluminous curls, spiral curls' },
  { id: 'short-bob', label: 'Bob', emoji: '💇', suffix: ', short bob haircut, sleek bob, chin-length hair' },
  { id: 'pixie', label: 'Pixie', emoji: '✂️', suffix: ', pixie cut, very short cropped hair, edgy short style' },
  { id: 'ponytail', label: 'Ponytail', emoji: '🎀', suffix: ', ponytail, hair pulled back, sleek ponytail' },
  { id: 'braided', label: 'Braided', emoji: '🪢', suffix: ', braided hair, intricate braids, plaited hairstyle' },
  { id: 'dreadlocks', label: 'Dreadlocks', emoji: '🦁', suffix: ', dreadlocks, locs, long matted hair' },
  { id: 'bun', label: 'Bun', emoji: '🧅', suffix: ', hair in a bun, topknot, elegant updo' },
  { id: 'mohawk', label: 'Mohawk', emoji: '🦅', suffix: ', mohawk hairstyle, shaved sides, spiked center strip' },
  { id: 'undercut', label: 'Undercut', emoji: '💈', suffix: ', undercut hairstyle, shaved sides, longer on top' },
  { id: 'afro', label: 'Afro', emoji: '🌑', suffix: ', afro hairstyle, big natural afro, voluminous rounded hair' },
  { id: 'twin-tails', label: 'Twin Tails', emoji: '🎐', suffix: ', twin tails, pigtails, two ponytails, double buns' },
  { id: 'messy', label: 'Messy', emoji: '💨', suffix: ', messy hair, tousled bedhead, effortlessly messy style' },
  { id: 'slicked', label: 'Slicked', emoji: '💧', suffix: ', slicked back hair, wet look, gel-styled, smooth and polished' },
] as const;

export const HAIR_COLOR_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'blonde', label: 'Blonde', emoji: '💛', suffix: ', blonde hair, golden blonde' },
  { id: 'brunette', label: 'Brunette', emoji: '🤎', suffix: ', brunette hair, dark brown hair' },
  { id: 'black', label: 'Black', emoji: '🖤', suffix: ', black hair, raven black hair, jet black' },
  { id: 'red', label: 'Red', emoji: '❤️', suffix: ', red hair, fiery red hair, ginger' },
  { id: 'silver', label: 'Silver', emoji: '🩶', suffix: ', silver white hair, platinum hair, metallic silver' },
  { id: 'pink', label: 'Pink', emoji: '🩷', suffix: ', pink hair, pastel pink, cotton candy pink' },
  { id: 'blue', label: 'Blue', emoji: '💙', suffix: ', blue hair, vibrant blue, electric blue hair' },
  { id: 'purple', label: 'Purple', emoji: '💜', suffix: ', purple hair, violet hair, lavender hair' },
  { id: 'green', label: 'Green', emoji: '💚', suffix: ', green hair, emerald green, forest green hair' },
  { id: 'orange', label: 'Orange', emoji: '🧡', suffix: ', orange hair, tangerine hair, warm copper' },
  { id: 'ombre', label: 'Ombré', emoji: '🌈', suffix: ', ombré hair, gradient hair color, two-tone hair' },
] as const;

export const EYE_COLOR_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'blue', label: 'Blue', emoji: '🔵', suffix: ', blue eyes, striking blue eyes' },
  { id: 'green', label: 'Green', emoji: '🟢', suffix: ', green eyes, emerald green eyes' },
  { id: 'brown', label: 'Brown', emoji: '🟤', suffix: ', brown eyes, warm brown eyes' },
  { id: 'hazel', label: 'Hazel', emoji: '🟫', suffix: ', hazel eyes, amber hazel eyes' },
  { id: 'gray', label: 'Gray', emoji: '⚪', suffix: ', gray eyes, steel gray eyes' },
  { id: 'red', label: 'Red', emoji: '🔴', suffix: ', red eyes, crimson eyes, glowing red eyes' },
  { id: 'gold', label: 'Gold', emoji: '🟡', suffix: ', golden eyes, amber eyes, glowing gold eyes' },
  { id: 'purple', label: 'Purple', emoji: '🟣', suffix: ', purple eyes, violet eyes, amethyst eyes' },
  { id: 'heterochromia', label: 'Heterochromia', emoji: '👁️', suffix: ', heterochromia eyes, different colored eyes, one blue one green eye' },
] as const;

export const POSE_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'standing', label: 'Standing', emoji: '🧍', suffix: ', standing pose, full body standing, upright posture' },
  { id: 'sitting', label: 'Sitting', emoji: '🪑', suffix: ', sitting pose, seated position, relaxed sitting' },
  { id: 'walking', label: 'Walking', emoji: '🚶', suffix: ', walking pose, mid-stride, dynamic walking motion' },
  { id: 'running', label: 'Running', emoji: '🏃', suffix: ', running pose, action shot, dynamic sprint' },
  { id: 'fighting', label: 'Fighting', emoji: '🥊', suffix: ', fighting pose, combat stance, dynamic action pose' },
  { id: 'dancing', label: 'Dancing', emoji: '💃', suffix: ', dancing pose, graceful movement, mid-dance' },
  { id: 'meditating', label: 'Meditating', emoji: '🧘', suffix: ', meditation pose, lotus position, peaceful and centered' },
  { id: 'leaning', label: 'Leaning', emoji: '🏗️', suffix: ', leaning against wall, casual lean, relaxed posture' },
  { id: 'kneeling', label: 'Kneeling', emoji: '🧎', suffix: ', kneeling pose, one knee down, reverent position' },
  { id: 'jumping', label: 'Jumping', emoji: '⬆️', suffix: ', jumping pose, mid-air leap, dynamic airborne pose' },
  { id: 'lying', label: 'Lying', emoji: '🛌', suffix: ', lying down, reclining pose, resting position' },
  { id: 'crossed-arms', label: 'Arms Crossed', emoji: '🙅', suffix: ', arms crossed pose, confident stance, crossed arms' },
  { id: 'looking-back', label: 'Looking Back', emoji: '🔙', suffix: ', looking back over shoulder, turned head, rear glance' },
  { id: 'hero', label: 'Hero', emoji: '🦸', suffix: ', heroic pose, power stance, fists on hips, cape flowing' },
] as const;

export const ACCESSORIES_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'glasses', label: 'Glasses', emoji: '👓', suffix: ', wearing glasses, spectacles' },
  { id: 'sunglasses', label: 'Sunglasses', emoji: '🕶️', suffix: ', wearing sunglasses, shades, dark lenses' },
  { id: 'hat', label: 'Hat', emoji: '🎩', suffix: ', wearing a stylish hat, headwear' },
  { id: 'crown', label: 'Crown', emoji: '👑', suffix: ', wearing a crown, royal tiara, jeweled headpiece' },
  { id: 'scarf', label: 'Scarf', emoji: '🧣', suffix: ', wearing a scarf, wrapped scarf, neckwear' },
  { id: 'jewelry', label: 'Jewelry', emoji: '💎', suffix: ', wearing fine jewelry, earrings, necklace, bracelets' },
  { id: 'wings', label: 'Wings', emoji: '🪽', suffix: ', with wings, angelic wings, feathered wings' },
  { id: 'horns', label: 'Horns', emoji: '😈', suffix: ', with horns, demon horns, curved horns on head' },
  { id: 'halo', label: 'Halo', emoji: '😇', suffix: ', with a glowing halo, divine halo, angelic ring' },
  { id: 'mask', label: 'Mask', emoji: '🎭', suffix: ', wearing a mask, ornate mask, face covering' },
  { id: 'cape', label: 'Cape', emoji: '🦸', suffix: ', wearing a cape, flowing cloak, dramatic cape' },
  { id: 'weapon', label: 'Weapon', emoji: '⚔️', suffix: ', holding a weapon, sword, armed, wielding blade' },
  { id: 'backpack', label: 'Backpack', emoji: '🎒', suffix: ', wearing a backpack, adventurer gear, travel bag' },
  { id: 'flower', label: 'Flower', emoji: '🌺', suffix: ', holding a flower, floral accessory, flower in hair' },
] as const;

export const BODY_TYPE_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'slim', label: 'Slim', emoji: '🌿', suffix: ', slim body type, slender figure, lean build' },
  { id: 'athletic', label: 'Athletic', emoji: '💪', suffix: ', athletic body type, fit and toned, muscular definition' },
  { id: 'muscular', label: 'Muscular', emoji: '🏋️', suffix: ', muscular body type, heavily built, powerful physique, broad shoulders' },
  { id: 'curvy', label: 'Curvy', emoji: '⏳', suffix: ', curvy body type, hourglass figure, full-figured' },
  { id: 'petite', label: 'Petite', emoji: '🧚', suffix: ', petite body type, small and delicate frame, diminutive' },
  { id: 'tall', label: 'Tall', emoji: '🦒', suffix: ', tall and statuesque, towering figure, imposing height' },
  { id: 'child', label: 'Child', emoji: '👶', suffix: ', child, young person, small frame, youthful appearance' },
  { id: 'elderly', label: 'Elderly', emoji: '👴', suffix: ', elderly person, aged, distinguished silver-haired, weathered features' },
] as const;

export const AGE_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'child', label: 'Child', emoji: '👧', suffix: ', young child, kid, approximately 8 years old' },
  { id: 'teenager', label: 'Teen', emoji: '🧑', suffix: ', teenager, adolescent, approximately 16 years old' },
  { id: 'young-adult', label: 'Young Adult', emoji: '🧑\u200D💼', suffix: ', young adult, approximately 25 years old, youthful' },
  { id: 'adult', label: 'Adult', emoji: '👤', suffix: ', adult, approximately 35 years old, mature' },
  { id: 'middle-aged', label: 'Middle Age', emoji: '👨\u200D🦳', suffix: ', middle-aged, approximately 50 years old, distinguished' },
  { id: 'elderly', label: 'Elderly', emoji: '👴', suffix: ', elderly person, senior, approximately 70 years old, wise' },
  { id: 'ageless', label: 'Ageless', emoji: '✨', suffix: ', ageless appearance, timeless, eternally young, immortal look' },
] as const;
