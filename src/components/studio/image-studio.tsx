'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  ImageIcon,
  ChevronDown,
  ChevronUp,
  Settings2,
  Download,
  Heart,
  ImagePlus,
  Loader2,
  Sparkles,
  Wand2,
  X,
  RefreshCcw,
  RefreshCw,
  Paintbrush,
  Zap,
  Upload,
  PanelLeftOpen,
  Clock,
  Palette,
  Check,
  DollarSign,
  BookOpen,
  Search,
  GitCompareArrows,
  Monitor,
  FileImage,
  Shield,
  Shuffle,
  Layers,
  Gauge,
  Cpu,
  Grid3x3,
  Camera,
  FlaskConical,
  Sun,
  Droplets,
  Dices,
  Maximize2,
  Share2,
  Eye,
  Film,
  User,
  Shirt,
  Scissors,
  Gem,
  Footprints,
  Glasses,
  UserCircle,
  Copy,
  Timer,
  Key,
  Palette as PaletteIcon,
  History,
} from 'lucide-react';

import { useAppStore } from '@/lib/store';
import * as data from '@/lib/data';
import type { GenerationQueueItem } from '@/lib/store';
import { useApiKeys } from '@/hooks/use-api-keys';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ImageEditor } from '@/components/studio/image-editor';
import { PromptHistory } from '@/components/studio/prompt-history';
import { PromptLibrary } from '@/components/studio/prompt-library';
import { SocialExportModal } from '@/components/social-export-modal';
import { ImageUpload } from '@/components/studio/image-upload';
import { ReferenceImagePicker } from '@/components/studio/reference-image-picker';
import { saveReferenceImage } from '@/lib/idb';
import { RecentBar } from '@/components/studio/recent-bar';
import { RecentGenerations } from '@/components/studio/recent-generations';
import { PromptSuggestions } from '@/components/studio/prompt-suggestions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { ModelCompare } from '@/components/studio/model-compare';
import { StyleTransferPanel } from '@/components/studio/style-transfer-panel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderModel {
  id: string;
  name: string;
  modelId: string;
  type: string;
  capabilities: string;
  description?: string;
  priceInfo?: string;
  isDefault: boolean;
}

interface Provider {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  color?: string;
  icon?: string;
  models: ProviderModel[];
}

// ---------------------------------------------------------------------------
// Aspect ratio helpers
// ---------------------------------------------------------------------------

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'] as const;

const RATIO_LABELS: Record<string, string> = {
  '1:1': 'Square',
  '16:9': 'Landscape',
  '9:16': 'Portrait',
  '4:3': 'Classic',
  '3:4': 'Tall',
  '3:2': 'Photo',
  '2:3': 'Slim',
};

// ---------------------------------------------------------------------------
// Resolution tier helpers
// ---------------------------------------------------------------------------

const RESOLUTION_TIERS = ['standard', 'hd', 'ultra'] as const;

const TIER_LABELS: Record<string, string> = {
  'standard': 'Standard',
  'hd': 'High',
  'ultra': 'Ultra HD',
};

const RESOLUTION_MAP: Record<string, Record<string, { width: number; height: number }>> = {
  '1:1': { standard: { width: 512, height: 512 }, hd: { width: 1024, height: 1024 }, ultra: { width: 2048, height: 2048 } },
  '16:9': { standard: { width: 912, height: 512 }, hd: { width: 1824, height: 1024 }, ultra: { width: 1920, height: 1080 } },
  '9:16': { standard: { width: 512, height: 912 }, hd: { width: 1024, height: 1824 }, ultra: { width: 1080, height: 1920 } },
  '4:3': { standard: { width: 684, height: 512 }, hd: { width: 1368, height: 1024 }, ultra: { width: 1440, height: 1080 } },
  '3:4': { standard: { width: 512, height: 684 }, hd: { width: 1024, height: 1368 }, ultra: { width: 1080, height: 1440 } },
  '3:2': { standard: { width: 768, height: 512 }, hd: { width: 1536, height: 1024 }, ultra: { width: 1620, height: 1080 } },
  '2:3': { standard: { width: 512, height: 768 }, hd: { width: 1024, height: 1536 }, ultra: { width: 1080, height: 1620 } },
};

// ---------------------------------------------------------------------------
// Style Presets
// ---------------------------------------------------------------------------

const STYLE_PRESETS = [
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

const SCHEDULER_OPTIONS = [
  { id: 'normal', label: 'Normal' },
  { id: 'karras', label: 'Karras' },
  { id: 'exponential', label: 'Exponential' },
  { id: 'sgmm_uniform', label: 'SGM Uniform' },
  { id: 'beta', label: 'Beta' },
] as const;

const LIGHTING_PRESETS = [
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

const COLOR_MOOD_PRESETS = [
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

const CAMERA_SHOT_PRESETS = [
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

const SUBJECT_PRESETS = [
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

const DETAIL_LEVEL_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'minimal', label: 'Minimal', emoji: '✨', suffix: ', minimalist, simple, clean, sparse details' },
  { id: 'moderate', label: 'Moderate', emoji: '🖌️', suffix: ', moderate detail, balanced complexity' },
  { id: 'high', label: 'High', emoji: '🔍', suffix: ', highly detailed, intricate, elaborate, rich textures' },
  { id: 'ultra', label: 'Ultra', emoji: '🔬', suffix: ', ultra detailed, hyper-detailed, every fine detail visible, micro-textures, 8k resolution' },
] as const;

const COMPOSITION_PRESETS = [
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

const EMOTION_PRESETS = [
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

const ERA_PRESETS = [
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

const OUTFIT_PRESETS = [
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

const HAIRSTYLE_PRESETS = [
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

const HAIR_COLOR_PRESETS = [
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

const EYE_COLOR_PRESETS = [
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

const POSE_PRESETS = [
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

const ACCESSORIES_PRESETS = [
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

const BODY_TYPE_PRESETS = [
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

const AGE_PRESETS = [
  { id: 'none', label: 'None', emoji: '⚪', suffix: '' },
  { id: 'child', label: 'Child', emoji: '👧', suffix: ', young child, kid, approximately 8 years old' },
  { id: 'teenager', label: 'Teen', emoji: '🧑', suffix: ', teenager, adolescent, approximately 16 years old' },
  { id: 'young-adult', label: 'Young Adult', emoji: '🧑\u200D💼', suffix: ', young adult, approximately 25 years old, youthful' },
  { id: 'adult', label: 'Adult', emoji: '👤', suffix: ', adult, approximately 35 years old, mature' },
  { id: 'middle-aged', label: 'Middle Age', emoji: '👨\u200D🦳', suffix: ', middle-aged, approximately 50 years old, distinguished' },
  { id: 'elderly', label: 'Elderly', emoji: '👴', suffix: ', elderly person, senior, approximately 70 years old, wise' },
  { id: 'ageless', label: 'Ageless', emoji: '✨', suffix: ', ageless appearance, timeless, eternally young, immortal look' },
] as const;

// ---------------------------------------------------------------------------
// Prompt History Hook
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Cost Estimate Badge
// ---------------------------------------------------------------------------

function CostEstimateBadge({ providerId, modelId, type, batchSize, duration }: {
  providerId: string;
  modelId: string;
  type: 'image' | 'video';
  batchSize?: number;
  duration?: number;
}) {
  const [cost, setCost] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId || !modelId) return;
    const controller = new AbortController();
    fetch('/api/cost-estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId, modelId, params: { batchSize, duration } }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setCost(data.estimatedCost || 'varies'))
      .catch(() => setCost('varies'));
    return () => controller.abort();
  }, [providerId, modelId, batchSize, duration]);

  if (!cost) return null;

  return (
    <div className="flex items-center justify-center gap-1.5">
      <DollarSign className="h-3 w-3 text-muted-foreground/60" />
      <span className="text-[10px] text-muted-foreground/60">Est. {cost}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template Browser (used in Templates dialog)
// ---------------------------------------------------------------------------

interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  prompt: string;
  style?: string;
  aspectRatio?: string;
  suggestedStylePreset?: string;
  suggestedAspectRatio?: string;
  negativePrompt?: string;
}

function TemplateBrowser({ onSelect }: { onSelect: (template: PromptTemplate) => void }) {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [categories, setCategories] = useState<{ name: string; icon: string; count: number }[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/prompt-templates${activeCategory !== 'all' ? `?category=${activeCategory}` : ''}${searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : ''}`)
      .then((res) => res.json())
      .then((data) => {
        setTemplates(data.templates || []);
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCategory, searchQuery]);

  return (
    <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full rounded-lg bg-surface border border-border/60 pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/30"
        />
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
            activeCategory === 'all'
              ? 'bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/30'
              : 'bg-surface border border-border/40 text-muted-foreground hover:text-foreground'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => setActiveCategory(cat.name)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
              activeCategory === cat.name
                ? 'bg-[#d9ff00]/10 text-[#d9ff00] border border-[#d9ff00]/30'
                : 'bg-surface border border-border/40 text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat.icon} {cat.name}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="flex-1 overflow-y-auto max-h-96 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#d9ff00]" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No templates found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {templates.map((template) => {
              const cat = categories.find((c) => c.name === template.category);
              return (
                <motion.button
                  key={template.id}
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelect(template)}
                  className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-surface p-3 text-left hover:border-[#d9ff00]/30 hover:bg-[#d9ff00]/5 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{cat?.icon || '📁'}</span>
                    <span className="text-xs font-medium text-foreground group-hover:text-[#d9ff00] transition-colors truncate">
                      {template.name}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-[10px] text-muted-foreground/80 line-clamp-1">
                      {template.description}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground/50 line-clamp-2">
                    {template.prompt}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {(template.style || template.suggestedStylePreset) && (
                      <Badge variant="secondary" className="text-[8px] w-fit bg-[#d9ff00]/5 text-[#d9ff00]/70 border-[#d9ff00]/10">
                        {template.style || template.suggestedStylePreset}
                      </Badge>
                    )}
                    {(template.aspectRatio || template.suggestedAspectRatio) && (
                      <Badge variant="secondary" className="text-[8px] w-fit bg-surface text-muted-foreground/60 border-border/30">
                        {template.aspectRatio || template.suggestedAspectRatio}
                      </Badge>
                    )}
                    {template.negativePrompt && (
                      <Badge variant="secondary" className="text-[8px] w-fit bg-red-500/5 text-red-400/60 border-red-500/10">
                        neg
                      </Badge>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Content (shared between desktop and mobile)
// ---------------------------------------------------------------------------

function SidebarContent({
  providers,
  providersLoading,
  selectedImageProvider,
  setSelectedImageProvider,
  selectedImageModel,
  setSelectedImageModel,
  selectedProviderData,
  imageModels,
  hasApiKey,
  configuredProviderIds,
  imagePrompt,
  setImagePrompt,
  imageNegativePrompt,
  setImageNegativePrompt,
  imageAspectRatio,
  setImageAspectRatio,
  imageQuality,
  setImageQuality,
  imageSteps,
  setImageSteps,
  imageGuidance,
  setImageGuidance,
  imageSeed,
  setImageSeed,
  imageBatchSize,
  setImageBatchSize,
  inputImageUrl,
  setInputImageUrl,
  isImageGenerating,
  isEnhancing,
  setIsEnhancing,
  showNegPrompt,
  setShowNegPrompt,
  activeStylePreset,
  setActiveStylePreset,
  onGenerate,
  onMobileClose,
  onCompare,
  imageResolutionTier,
  setImageResolutionTier,
  imageFormat,
  setImageFormat,
  imageStrength,
  setImageStrength,
  imageSampler,
  setImageSampler,
  imageMagicPrompt,
  setImageMagicPrompt,
  imageStyleType,
  setImageStyleType,
  imageRenderingSpeed,
  setImageRenderingSpeed,
  imageClipGuidance,
  setImageClipGuidance,
  imageTileable,
  setImageTileable,
  imagePhotoReal,
  setImagePhotoReal,
  imageAlchemy,
  setImageAlchemy,
  imageSafetyFilter,
  setImageSafetyFilter,
  imageScheduler,
  setImageScheduler,
  imageClipSkip,
  setImageClipSkip,
  imageLighting,
  setImageLighting,
  imageColorMood,
  setImageColorMood,
  imageCameraShot,
  setImageCameraShot,
  imageHiresFix,
  setImageHiresFix,
  imageHiresScale,
  setImageHiresScale,
  imageHiresSteps,
  setImageHiresSteps,
  imageHiresDenoise,
  setImageHiresDenoise,
  imageSubject,
  setImageSubject,
  imageDetailLevel,
  setImageDetailLevel,
  imageComposition,
  setImageComposition,
  imageEmotion,
  setImageEmotion,
  imageEra,
  setImageEra,
  imageOutfit,
  setImageOutfit,
  imageHairstyle,
  setImageHairstyle,
  imageHairColor,
  setImageHairColor,
  imageEyeColor,
  setImageEyeColor,
  imagePose,
  setImagePose,
  imageAccessories,
  setImageAccessories,
  imageBodyType,
  setImageBodyType,
  imageAge,
  setImageAge,
  imageOutfitDescription,
  setImageOutfitDescription,
  imageOutfitImageUrl,
  setImageOutfitImageUrl,
  onOpenRefImageHistory,
}: {
  providers: Provider[];
  providersLoading: boolean;
  selectedImageProvider: string;
  setSelectedImageProvider: (v: string) => void;
  selectedImageModel: string;
  setSelectedImageModel: (v: string) => void;
  selectedProviderData: Provider | null;
  imageModels: ProviderModel[];
  hasApiKey: boolean;
  configuredProviderIds: string[];
  imagePrompt: string;
  setImagePrompt: (v: string) => void;
  imageNegativePrompt: string;
  setImageNegativePrompt: (v: string) => void;
  imageAspectRatio: string;
  setImageAspectRatio: (v: string) => void;
  imageQuality: string;
  setImageQuality: (v: string) => void;
  imageSteps: number;
  setImageSteps: (v: number) => void;
  imageGuidance: number;
  setImageGuidance: (v: number) => void;
  imageSeed: number | null;
  setImageSeed: (v: number | null) => void;
  imageBatchSize: number;
  setImageBatchSize: (v: number) => void;
  inputImageUrl: string | null;
  setInputImageUrl: (v: string | null) => void;
  isImageGenerating: boolean;
  isEnhancing: boolean;
  setIsEnhancing: (v: boolean) => void;
  showNegPrompt: boolean;
  setShowNegPrompt: (v: boolean) => void;
  activeStylePreset: string | null;
  setActiveStylePreset: (v: string | null) => void;
  onGenerate: () => void;
  onMobileClose?: () => void;
  onCompare: () => void;
  imageResolutionTier: string;
  setImageResolutionTier: (v: string) => void;
  imageFormat: string;
  setImageFormat: (v: string) => void;
  imageStrength: number;
  setImageStrength: (v: number) => void;
  imageSampler: string;
  setImageSampler: (v: string) => void;
  imageMagicPrompt: boolean;
  setImageMagicPrompt: (v: boolean) => void;
  imageStyleType: string;
  setImageStyleType: (v: string) => void;
  imageRenderingSpeed: string;
  setImageRenderingSpeed: (v: string) => void;
  imageClipGuidance: string;
  setImageClipGuidance: (v: string) => void;
  imageTileable: boolean;
  setImageTileable: (v: boolean) => void;
  imagePhotoReal: boolean;
  setImagePhotoReal: (v: boolean) => void;
  imageAlchemy: boolean;
  setImageAlchemy: (v: boolean) => void;
  imageSafetyFilter: boolean;
  setImageSafetyFilter: (v: boolean) => void;
  imageScheduler: string;
  setImageScheduler: (v: string) => void;
  imageClipSkip: number;
  setImageClipSkip: (v: number) => void;
  imageLighting: string;
  setImageLighting: (v: string) => void;
  imageColorMood: string;
  setImageColorMood: (v: string) => void;
  imageCameraShot: string;
  setImageCameraShot: (v: string) => void;
  imageHiresFix: boolean;
  setImageHiresFix: (v: boolean) => void;
  imageHiresScale: number;
  setImageHiresScale: (v: number) => void;
  imageHiresSteps: number;
  setImageHiresSteps: (v: number) => void;
  imageHiresDenoise: number;
  setImageHiresDenoise: (v: number) => void;
  imageSubject: string;
  setImageSubject: (v: string) => void;
  imageDetailLevel: string;
  setImageDetailLevel: (v: string) => void;
  imageComposition: string;
  setImageComposition: (v: string) => void;
  imageEmotion: string;
  setImageEmotion: (v: string) => void;
  imageEra: string;
  setImageEra: (v: string) => void;
  imageOutfit: string;
  setImageOutfit: (v: string) => void;
  imageHairstyle: string;
  setImageHairstyle: (v: string) => void;
  imageHairColor: string;
  setImageHairColor: (v: string) => void;
  imageEyeColor: string;
  setImageEyeColor: (v: string) => void;
  imagePose: string;
  setImagePose: (v: string) => void;
  imageAccessories: string;
  setImageAccessories: (v: string) => void;
  imageBodyType: string;
  setImageBodyType: (v: string) => void;
  imageAge: string;
  setImageAge: (v: string) => void;
  imageOutfitDescription: string;
  setImageOutfitDescription: (v: string) => void;
  imageOutfitImageUrl: string | null;
  setImageOutfitImageUrl: (v: string | null) => void;
  onOpenRefImageHistory: () => void;
}) {
  // Subscribe to auto-enhance state for reactive UI
  const imageAutoEnhance = useAppStore((s) => s.imageAutoEnhance);
  const setImageAutoEnhance = useAppStore((s) => s.setImageAutoEnhance);
  const setPromptLibraryOpen = useAppStore((s) => s.setPromptLibraryOpen);

  // Compute the output dimensions from aspect ratio + resolution tier
  const computedDimensions = RESOLUTION_MAP[imageAspectRatio]?.[imageResolutionTier] ?? RESOLUTION_MAP['1:1']['hd'];
  const [charDetailsOpen, setCharDetailsOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(true);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [emotionOpen, setEmotionOpen] = useState(false);
  const [eraOpen, setEraOpen] = useState(false);
  const [quickPromptsOpen, setQuickPromptsOpen] = useState(true);
  const [changeOutfitOpen, setChangeOutfitOpen] = useState(false);
  const [outfitUrlInput, setOutfitUrlInput] = useState('');
  const [showOutfitUrlInput, setShowOutfitUrlInput] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  const activeCharCount = [
    imageOutfit, imageHairstyle, imageHairColor, imageEyeColor,
    imagePose, imageAccessories, imageBodyType, imageAge,
  ].filter((v) => v !== 'none').length;

  const totalActivePresets = [
    activeStylePreset ? 1 : 0,
    imageSubject !== 'none' ? 1 : 0,
    imageDetailLevel !== 'none' ? 1 : 0,
    imageComposition !== 'none' ? 1 : 0,
    imageEmotion !== 'none' ? 1 : 0,
    imageEra !== 'none' ? 1 : 0,
    activeCharCount,
    imageOutfitDescription ? 1 : 0,
    imageOutfitImageUrl ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleResetAllPresets = useCallback(() => {
    setActiveStylePreset(null);
    setImageSubject('none');
    setImageDetailLevel('none');
    setImageComposition('none');
    setImageEmotion('none');
    setImageEra('none');
    setImageOutfit('none');
    setImageHairstyle('none');
    setImageHairColor('none');
    setImageEyeColor('none');
    setImagePose('none');
    setImageAccessories('none');
    setImageBodyType('none');
    setImageAge('none');
    setImageLighting('none');
    setImageColorMood('none');
    setImageCameraShot('none');
    setImageOutfitDescription('');
    setImageOutfitImageUrl(null);
    toast.success('All presets cleared');
  }, [setActiveStylePreset, setImageSubject, setImageDetailLevel, setImageComposition, setImageEmotion, setImageEra, setImageOutfit, setImageHairstyle, setImageHairColor, setImageEyeColor, setImagePose, setImageAccessories, setImageBodyType, setImageAge, setImageLighting, setImageColorMood, setImageCameraShot, setImageOutfitDescription, setImageOutfitImageUrl]);

  return (
    <div className="flex flex-col gap-5 p-5 w-full min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#d9ff00]/10">
            <Wand2 className="h-4 w-4 text-[#d9ff00]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Image Generation</h2>
            <p className="text-xs text-muted-foreground">Configure and generate images</p>
          </div>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleResetAllPresets}
              disabled={totalActivePresets === 0}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-[#d9ff00] hover:bg-[#d9ff00]/5 transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Reset all presets to default
          </TooltipContent>
        </Tooltip>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Smart Prompt Builder Preview ----- */}
      {(() => {
        const parts: string[] = [];
        if (activeStylePreset) {
          const p = STYLE_PRESETS.find((s) => s.id === activeStylePreset);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageSubject !== 'none') {
          const p = SUBJECT_PRESETS.find((s) => s.id === imageSubject);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageDetailLevel !== 'none') {
          const p = DETAIL_LEVEL_PRESETS.find((s) => s.id === imageDetailLevel);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageComposition !== 'none') {
          const p = COMPOSITION_PRESETS.find((s) => s.id === imageComposition);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageEmotion !== 'none') {
          const p = EMOTION_PRESETS.find((s) => s.id === imageEmotion);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageEra !== 'none') {
          const p = ERA_PRESETS.find((s) => s.id === imageEra);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageLighting !== 'none') {
          const p = LIGHTING_PRESETS.find((s) => s.id === imageLighting);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageColorMood !== 'none') {
          const p = COLOR_MOOD_PRESETS.find((s) => s.id === imageColorMood);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageCameraShot !== 'none') {
          const p = CAMERA_SHOT_PRESETS.find((s) => s.id === imageCameraShot);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageOutfit !== 'none') {
          const p = OUTFIT_PRESETS.find((s) => s.id === imageOutfit);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageHairstyle !== 'none') {
          const p = HAIRSTYLE_PRESETS.find((s) => s.id === imageHairstyle);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageHairColor !== 'none') {
          const p = HAIR_COLOR_PRESETS.find((s) => s.id === imageHairColor);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageEyeColor !== 'none') {
          const p = EYE_COLOR_PRESETS.find((s) => s.id === imageEyeColor);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imagePose !== 'none') {
          const p = POSE_PRESETS.find((s) => s.id === imagePose);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageAccessories !== 'none') {
          const p = ACCESSORIES_PRESETS.find((s) => s.id === imageAccessories);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageBodyType !== 'none') {
          const p = BODY_TYPE_PRESETS.find((s) => s.id === imageBodyType);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageAge !== 'none') {
          const p = AGE_PRESETS.find((s) => s.id === imageAge);
          if (p?.suffix) parts.push(p.suffix.slice(2));
        }
        if (imageOutfitDescription) {
          parts.push(`wearing ${imageOutfitDescription}`);
        }
        if (imageOutfitImageUrl) {
          parts.push('outfit reference image');
        }
        if (parts.length === 0 && !imageAutoEnhance) return null;
        return (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-[#d9ff00]/30 bg-[#d9ff00]/5 p-3 space-y-1.5"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#d9ff00]" />
              <span className="text-[11px] font-semibold text-[#d9ff00] uppercase tracking-wider">Smart Preview</span>
              {totalActivePresets > 0 && (
                <Badge className="h-4 px-1.5 text-[8px] font-bold bg-[#d9ff00]/20 text-[#d9ff00] border-[#d9ff00]/40">
                  {totalActivePresets} ACTIVE
                </Badge>
              )}
              {imageAutoEnhance && (
                <Badge className="h-4 px-1.5 text-[8px] font-bold bg-purple-500/15 text-purple-400 border-purple-500/30">
                  ✨ AUTO-ENHANCE
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
              {imageAutoEnhance && (
                <span className="text-purple-400/80">AI-enhanced prompt</span>
              )}
              {imageAutoEnhance && parts.length > 0 && (
                <span className="text-muted-foreground/50"> + </span>
              )}
              {parts.length > 0 && (
                <>
                  <span className="text-muted-foreground/50">Your prompt + </span>
                  <span className="text-[#d9ff00]/80">{parts.join(', ')}</span>
                </>
              )}
            </p>
          </motion.div>
        );
      })()}

      {/* ----- Presets Summary Line ----- */}
      {(() => {
        const badges: { emoji: string; label: string }[] = [];
        if (activeStylePreset) {
          const p = STYLE_PRESETS.find((s) => s.id === activeStylePreset);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageSubject !== 'none') {
          const p = SUBJECT_PRESETS.find((s) => s.id === imageSubject);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageDetailLevel !== 'none') {
          const p = DETAIL_LEVEL_PRESETS.find((s) => s.id === imageDetailLevel);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageComposition !== 'none') {
          const p = COMPOSITION_PRESETS.find((s) => s.id === imageComposition);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageEmotion !== 'none') {
          const p = EMOTION_PRESETS.find((s) => s.id === imageEmotion);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageEra !== 'none') {
          const p = ERA_PRESETS.find((s) => s.id === imageEra);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageOutfit !== 'none') {
          const p = OUTFIT_PRESETS.find((s) => s.id === imageOutfit);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageHairstyle !== 'none') {
          const p = HAIRSTYLE_PRESETS.find((s) => s.id === imageHairstyle);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageHairColor !== 'none') {
          const p = HAIR_COLOR_PRESETS.find((s) => s.id === imageHairColor);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageEyeColor !== 'none') {
          const p = EYE_COLOR_PRESETS.find((s) => s.id === imageEyeColor);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imagePose !== 'none') {
          const p = POSE_PRESETS.find((s) => s.id === imagePose);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageAccessories !== 'none') {
          const p = ACCESSORIES_PRESETS.find((s) => s.id === imageAccessories);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageBodyType !== 'none') {
          const p = BODY_TYPE_PRESETS.find((s) => s.id === imageBodyType);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageAge !== 'none') {
          const p = AGE_PRESETS.find((s) => s.id === imageAge);
          if (p) badges.push({ emoji: p.emoji, label: p.label });
        }
        if (imageOutfitDescription) {
          badges.push({ emoji: '👕', label: imageOutfitDescription.length > 20 ? imageOutfitDescription.slice(0, 20) + '…' : imageOutfitDescription });
        }
        if (imageOutfitImageUrl) {
          badges.push({ emoji: '🖼️', label: 'Outfit Ref' });
        }
        if (badges.length === 0) return null;
        return (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
            {badges.map((b, i) => (
              <span key={i} className="flex items-center gap-0.5 shrink-0 rounded-full bg-[#d9ff00]/8 border border-[#d9ff00]/15 px-2 py-0.5 text-[9px] font-medium text-[#d9ff00]/80">
                <span className="text-[10px]">{b.emoji}</span>
                {b.label}
                {i < badges.length - 1 && <span className="ml-1 text-[#d9ff00]/30">•</span>}
              </span>
            ))}
          </div>
        );
      })()}

      <Separator className="opacity-40" />

      {/* ----- Model Selector ----- */}
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Provider & Model
        </Label>

        <Select value={selectedImageProvider} onValueChange={setSelectedImageProvider}>
          <SelectTrigger className="w-full bg-surface border-border/60">
            <SelectValue placeholder="Select provider…">
              {selectedProviderData ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
                  {selectedProviderData.displayName}
                </span>
              ) : 'Select provider…'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {providersLoading ? (
              <SelectItem value="__loading" disabled>Loading…</SelectItem>
            ) : (
              providers.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color || '#888' }} />
                    {p.displayName}
                    {configuredProviderIds.includes(p.id) ? (
                      <Badge variant="secondary" className="ml-auto h-4 bg-[#d9ff00]/10 text-[8px] text-[#d9ff00]">KEY</Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-auto h-4 bg-destructive/10 text-[8px] text-destructive">NO KEY</Badge>
                    )}
                  </span>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select value={selectedImageModel} onValueChange={setSelectedImageModel} disabled={!selectedImageProvider || imageModels.length === 0}>
          <SelectTrigger className="w-full bg-surface border-border/60">
            <SelectValue placeholder="Select model…" />
          </SelectTrigger>
          <SelectContent className="bg-[#1a1a1a] border-border/60">
            {imageModels.map((m) => (
              <SelectItem key={m.id} value={m.modelId}>
                <span className="flex items-center justify-between gap-2">
                  <span>{m.name}</span>
                  {m.priceInfo && <span className="text-[10px] text-muted-foreground">{m.priceInfo}</span>}
                </span>
              </SelectItem>
            ))}
            {imageModels.length === 0 && selectedImageProvider && (
              <SelectItem value="__none" disabled>No image models available</SelectItem>
            )}
          </SelectContent>
        </Select>

        {selectedImageProvider && !hasApiKey && !warningDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="warning-slide-in relative rounded-lg bg-red-500/10 border border-red-500/20 backdrop-blur-sm p-3 pr-8 text-xs text-red-400"
          >
            No API key configured for this provider. Go to Settings to add one.
            <button
              type="button"
              onClick={() => setWarningDismissed(true)}
              className="absolute top-2 right-2 text-red-400/60 hover:text-red-400 transition-colors"
              aria-label="Dismiss warning"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </div>

      <Separator className="opacity-40" />

      {/* ----- Style Presets ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setStyleOpen(!styleOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            activeStylePreset
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Palette className={`h-4 w-4 ${activeStylePreset ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${activeStylePreset ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Style Presets
            </span>
            {activeStylePreset && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                1
              </Badge>
            )}
          </div>
          {styleOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {styleOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {STYLE_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setActiveStylePreset(activeStylePreset === preset.id ? null : preset.id)}
                        className={`
                          relative flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-center transition-all
                          ${activeStylePreset === preset.id
                            ? 'border-opacity-80 bg-opacity-25'
                            : 'border-border/30 bg-surface hover:border-border/60'
                          }
                        `}
                        style={activeStylePreset === preset.id ? {
                          borderColor: `${preset.color}80`,
                          backgroundColor: `${preset.color}25`,
                          boxShadow: `0 0 16px ${preset.color}25, 0 0 4px ${preset.color}15`,
                        } : {}}
                      >
                        {activeStylePreset === preset.id && (
                          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full" style={{ backgroundColor: preset.color }}>
                            <Check className="h-2.5 w-2.5 text-background" />
                          </span>
                        )}
                        <span className="text-base">{preset.emoji}</span>
                        <span className={`text-[9px] font-medium leading-tight ${activeStylePreset === preset.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {preset.label}
                        </span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      {activeStylePreset === preset.id
                        ? `Style: ${preset.label} applied to prompt`
                        : `Apply ${preset.label} style to prompt`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Subject Presets ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setSubjectOpen(!subjectOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            imageSubject !== 'none'
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className={`h-4 w-4 ${imageSubject !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${imageSubject !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Subject
            </span>
            {imageSubject !== 'none' && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                1
              </Badge>
            )}
          </div>
          {subjectOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {subjectOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {SUBJECT_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageSubject(preset.id === imageSubject ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageSubject === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No subject modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Detail Level Presets ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setDetailOpen(!detailOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            imageDetailLevel !== 'none'
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Search className={`h-4 w-4 ${imageDetailLevel !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${imageDetailLevel !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Detail Level
            </span>
            {imageDetailLevel !== 'none' && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                1
              </Badge>
            )}
          </div>
          {detailOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {detailOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-1.5 pt-1">
                {DETAIL_LEVEL_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageDetailLevel(preset.id === imageDetailLevel ? 'none' : preset.id)}
                        className={`relative flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-center transition-all ${
                          imageDetailLevel === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[10px] font-medium">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No detail modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Composition Presets ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setCompositionOpen(!compositionOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            imageComposition !== 'none'
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Grid3x3 className={`h-4 w-4 ${imageComposition !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${imageComposition !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Composition
            </span>
            {imageComposition !== 'none' && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                1
              </Badge>
            )}
          </div>
          {compositionOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {compositionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {COMPOSITION_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageComposition(preset.id === imageComposition ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageComposition === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No composition modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Emotion Presets ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setEmotionOpen(!emotionOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            imageEmotion !== 'none'
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Heart className={`h-4 w-4 ${imageEmotion !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${imageEmotion !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Emotion
            </span>
            {imageEmotion !== 'none' && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                1
              </Badge>
            )}
          </div>
          {emotionOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {emotionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {EMOTION_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageEmotion(preset.id === imageEmotion ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageEmotion === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No emotion modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Era / Time Period Presets ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setEraOpen(!eraOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            imageEra !== 'none'
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className={`h-4 w-4 ${imageEra !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${imageEra !== 'none' ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Era / Time
            </span>
            {imageEra !== 'none' && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                1
              </Badge>
            )}
          </div>
          {eraOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {eraOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {ERA_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageEra(preset.id === imageEra ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageEra === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No era modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Character Details (Collapsible) ----- */}
      <div className="space-y-2">
        {/* Header row */}
        <button
          type="button"
          onClick={() => setCharDetailsOpen(!charDetailsOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            activeCharCount > 0
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <UserCircle className={`h-4 w-4 ${activeCharCount > 0 ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${activeCharCount > 0 ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Character Details
            </span>
            {activeCharCount > 0 && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                {activeCharCount}
              </Badge>
            )}
          </div>
          {charDetailsOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {charDetailsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >
              {/* Outfit */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Shirt className="h-2.5 w-2.5" />
                  Outfit
                </Label>
                <div className="grid grid-cols-4 gap-1">
                  {OUTFIT_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageOutfit(preset.id === imageOutfit ? 'none' : preset.id)}
                          className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                            imageOutfit === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-sm">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No outfit modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Hairstyle */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Scissors className="h-2.5 w-2.5" />
                  Hairstyle
                </Label>
                <div className="grid grid-cols-4 gap-1">
                  {HAIRSTYLE_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageHairstyle(preset.id === imageHairstyle ? 'none' : preset.id)}
                          className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                            imageHairstyle === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-sm">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No hairstyle modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Hair Color */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Gem className="h-2.5 w-2.5" />
                  Hair Color
                </Label>
                <div className="flex flex-wrap gap-1">
                  {HAIR_COLOR_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageHairColor(preset.id === imageHairColor ? 'none' : preset.id)}
                          className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-center transition-all ${
                            imageHairColor === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-xs">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No hair color modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Eye Color */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Eye className="h-2.5 w-2.5" />
                  Eye Color
                </Label>
                <div className="flex flex-wrap gap-1">
                  {EYE_COLOR_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageEyeColor(preset.id === imageEyeColor ? 'none' : preset.id)}
                          className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-center transition-all ${
                            imageEyeColor === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-xs">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No eye color modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Pose */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Footprints className="h-2.5 w-2.5" />
                  Pose
                </Label>
                <div className="grid grid-cols-4 gap-1">
                  {POSE_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImagePose(preset.id === imagePose ? 'none' : preset.id)}
                          className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                            imagePose === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-sm">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No pose modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Accessories */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Glasses className="h-2.5 w-2.5" />
                  Accessories
                </Label>
                <div className="grid grid-cols-4 gap-1">
                  {ACCESSORIES_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageAccessories(preset.id === imageAccessories ? 'none' : preset.id)}
                          className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                            imageAccessories === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-sm">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No accessory modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Body Type */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <User className="h-2.5 w-2.5" />
                  Body Type
                </Label>
                <div className="flex flex-wrap gap-1">
                  {BODY_TYPE_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageBodyType(preset.id === imageBodyType ? 'none' : preset.id)}
                          className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-center transition-all ${
                            imageBodyType === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-xs">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No body type modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Age */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Age
                </Label>
                <div className="flex flex-wrap gap-1">
                  {AGE_PRESETS.map((preset) => (
                    <Tooltip key={preset.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setImageAge(preset.id === imageAge ? 'none' : preset.id)}
                          className={`relative flex items-center gap-1 rounded-lg border px-2 py-1 text-center transition-all ${
                            imageAge === preset.id && preset.id !== 'none'
                              ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                              : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                          }`}
                        >
                          <span className="text-xs">{preset.emoji}</span>
                          <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                        {preset.id === 'none' ? 'No age modifier' : `Adds: ${preset.suffix.slice(2)}`}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Change Outfit (Virtual Try-On) ----- */}
      <div className="space-y-2">
        {/* Header row */}
        <button
          type="button"
          onClick={() => setChangeOutfitOpen(!changeOutfitOpen)}
          className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-all group ${
            (imageOutfitDescription || imageOutfitImageUrl)
              ? 'border-[#d9ff00]/30 bg-[#d9ff00]/5'
              : 'border-border/30 bg-surface hover:border-border/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shirt className={`h-4 w-4 ${(imageOutfitDescription || imageOutfitImageUrl) ? 'text-[#d9ff00]' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-medium uppercase tracking-wider transition-colors ${(imageOutfitDescription || imageOutfitImageUrl) ? 'text-[#d9ff00]' : 'text-muted-foreground group-hover:text-foreground'}`}>
              Change Outfit
            </span>
            {(imageOutfitDescription || imageOutfitImageUrl) && (
              <Badge className="h-4 min-w-[18px] px-1 text-[9px] font-bold bg-[#d9ff00]/15 text-[#d9ff00] border-[#d9ff00]/30">
                {(imageOutfitDescription ? 1 : 0) + (imageOutfitImageUrl ? 1 : 0)}
              </Badge>
            )}
          </div>
          {changeOutfitOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>

        {/* Expandable content */}
        <AnimatePresence>
          {changeOutfitOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >
              {/* Outfit Description */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Outfit Description
                </Label>
                <textarea
                  value={imageOutfitDescription}
                  onChange={(e) => setImageOutfitDescription(e.target.value)}
                  placeholder="Describe the outfit you want to change to..."
                  rows={3}
                  className="w-full rounded-lg border border-border/40 bg-surface/50 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-[#d9ff00]/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/20 resize-none transition-colors"
                />
                <p className="text-[9px] text-muted-foreground/50 leading-relaxed">
                  e.g. &quot;red evening gown with gold embroidery&quot;, &quot;casual denim jacket with white t-shirt and ripped jeans&quot;
                </p>
              </div>

              {/* Outfit Reference Image Upload */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Reference Image
                </Label>

                {imageOutfitImageUrl ? (
                  /* Thumbnail preview with remove button */
                  <div className="relative group/img rounded-lg overflow-hidden border border-border/40">
                    <img
                      src={imageOutfitImageUrl}
                      alt="Outfit reference"
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => setImageOutfitImageUrl(null)}
                        className="flex items-center gap-1 rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] text-white/80 backdrop-blur-sm">
                      🖼️ Reference attached
                    </div>
                  </div>
                ) : (
                  /* Drag-and-drop upload zone */
                  <div
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const result = ev.target?.result as string;
                            if (result) setImageOutfitImageUrl(result);
                          };
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.add('border-[#d9ff00]/50', 'bg-[#d9ff00]/5');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.remove('border-[#d9ff00]/50', 'bg-[#d9ff00]/5');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).classList.remove('border-[#d9ff00]/50', 'bg-[#d9ff00]/5');
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          if (result) setImageOutfitImageUrl(result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-2 rounded-lg border-dashed border-2 border-border/40 bg-surface/50 p-4 cursor-pointer hover:border-border/60 hover:bg-surface/80 transition-all"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#d9ff00]/10">
                      <Upload className="h-4 w-4 text-[#d9ff00]" />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-medium text-muted-foreground">Drop image here or click to browse</p>
                      <p className="text-[9px] text-muted-foreground/50">PNG, JPG, WEBP up to 10MB</p>
                    </div>
                  </div>
                )}

                {/* Or paste URL toggle */}
                {!imageOutfitImageUrl && (
                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowOutfitUrlInput(!showOutfitUrlInput)}
                      className="text-[9px] text-[#d9ff00]/70 hover:text-[#d9ff00] underline underline-offset-2 transition-colors"
                    >
                      {showOutfitUrlInput ? 'Hide URL input' : 'Or paste URL'}
                    </button>
                    {showOutfitUrlInput && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-1.5"
                      >
                        <input
                          type="url"
                          value={outfitUrlInput}
                          onChange={(e) => setOutfitUrlInput(e.target.value)}
                          placeholder="https://example.com/outfit.jpg"
                          className="flex-1 rounded-md border border-border/40 bg-surface/50 px-2 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/50 focus:border-[#d9ff00]/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/20 transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (outfitUrlInput.trim()) {
                              setImageOutfitImageUrl(outfitUrlInput.trim());
                              setOutfitUrlInput('');
                              setShowOutfitUrlInput(false);
                            }
                          }}
                          disabled={!outfitUrlInput.trim()}
                          className="rounded-md border border-[#d9ff00]/30 bg-[#d9ff00]/10 px-2 py-1 text-[10px] font-medium text-[#d9ff00] hover:bg-[#d9ff00]/20 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          Load
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview Card */}
              {(imageOutfitDescription || imageOutfitImageUrl) && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-[#d9ff00]/20 bg-[#d9ff00]/5 p-2.5 space-y-1"
                >
                  <div className="flex items-center gap-1.5">
                    <Shirt className="h-3 w-3 text-[#d9ff00]" />
                    <span className="text-[9px] font-semibold text-[#d9ff00] uppercase tracking-wider">Outfit Change</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 leading-relaxed">
                    👕 {imageOutfitDescription || 'Custom outfit'}
                    {imageOutfitImageUrl && (
                      <span className="text-[#d9ff00]/70"> + reference image attached</span>
                    )}
                  </p>
                  <p className="text-[9px] text-muted-foreground/50">
                    Will be added as &quot;wearing {imageOutfitDescription || '[reference outfit]'}&quot; to your prompt
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Quick Prompts ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setQuickPromptsOpen(!quickPromptsOpen)}
          className="flex w-full items-center justify-between rounded-lg border border-border/30 bg-surface px-3 py-2 hover:border-border/60 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">
              Quick Prompts
            </span>
          </div>
          {quickPromptsOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
        <AnimatePresence>
          {quickPromptsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-md border border-[#d9ff00]/30 bg-[#d9ff00]/5 px-2 py-1 text-[10px] font-medium text-[#d9ff00] hover:bg-[#d9ff00]/10 transition-all"
                      >
                        <BookOpen className="h-3 w-3" />
                        Templates
                      </button>
                    </DialogTrigger>
                    <DialogContent className="glass-strong sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                      <DialogHeader>
                        <DialogTitle className="text-foreground flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-[#d9ff00]" />
                          Prompt Templates Library
                        </DialogTitle>
                        <DialogDescription className="sr-only">Browse and select prompt templates for image generation</DialogDescription>
                      </DialogHeader>
                      <TemplateBrowser
                        onSelect={(template) => {
                          setImagePrompt(template.prompt);
                          if (template.suggestedStylePreset || template.style) {
                            setActiveStylePreset(
                              template.suggestedStylePreset ||
                                template.style!.toLowerCase().replace(/\s+/g, '-')
                            );
                          }
                          if (template.suggestedAspectRatio || template.aspectRatio) {
                            setImageAspectRatio(
                              template.suggestedAspectRatio || template.aspectRatio!
                            );
                          }
                          if (template.negativePrompt) {
                            setNegativePrompt(template.negativePrompt);
                          }
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '🎨 Portrait', prompt: 'A professional portrait photo of a person, studio lighting, shallow depth of field, 85mm lens, high detail' },
                    { label: '🏔️ Landscape', prompt: 'A breathtaking mountain landscape at golden hour, dramatic clouds, reflection in lake, ultra detailed, 8k' },
                    { label: '🏢 Product', prompt: 'A professional product photography shot on clean white background, soft studio lighting, commercial quality' },
                    { label: '📸 Cinematic', prompt: 'A cinematic film still, dramatic lighting, anamorphic lens flare, color graded, 35mm film grain' },
                    { label: '🎭 Fantasy', prompt: 'An epic fantasy scene, magical atmosphere, ethereal lighting, detailed environment, mystical creatures' },
                    { label: '🏙️ Architecture', prompt: 'Modern architectural photography, clean lines, dramatic perspective, golden hour lighting, ultra detailed' },
                  ].map((tmpl) => (
                    <motion.button
                      key={tmpl.label}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setImagePrompt(tmpl.prompt)}
                      className="rounded-lg border border-border/40 bg-surface px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-[#d9ff00]/30 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] transition-all card-hover-lift"
                    >
                      {tmpl.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-30" />

      {/* ----- Prompt + History ----- */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Prompt
          </Label>
          <div className="flex items-center gap-1.5">
            {/* Prompt History — Enhanced with search and clear */}
            <PromptHistory onSelectPrompt={setImagePrompt} />
            {/* Prompt Library */}
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setPromptLibraryOpen(true)}
                  className="flex items-center gap-1 rounded-md border border-border/40 bg-surface px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-[#d9ff00] hover:border-[#d9ff00]/30 transition-all"
                >
                  <BookOpen className="h-3 w-3" />
                  <span className="hidden sm:inline">Library</span>
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Saved prompts & templates
              </TooltipContent>
            </Tooltip>
            <PromptLibrary onSelectPrompt={setImagePrompt} />
            {/* AI Enhance */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                if (!imagePrompt.trim()) { toast.error('Enter a prompt first'); return; }
                setIsEnhancing(true);
                try {
                  const res = await fetch('/api/enhance-prompt', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: imagePrompt, type: 'enhance' }),
                  });
                  const data = await res.json();
                  if (data.enhancedPrompt) { setImagePrompt(data.enhancedPrompt); toast.success('Prompt enhanced with AI!'); }
                  else { toast.error(data.error || 'Enhancement failed'); }
                } catch { toast.error('Failed to enhance prompt'); }
                finally { setIsEnhancing(false); }
              }}
              disabled={isEnhancing || !imagePrompt.trim()}
              className="flex items-center gap-1 rounded-md border border-[#d9ff00]/30 bg-[#d9ff00]/5 px-2 py-1 text-[10px] font-medium text-[#d9ff00] hover:bg-[#d9ff00]/10 transition-all disabled:opacity-40"
            >
              {isEnhancing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {isEnhancing ? 'Enhancing...' : 'AI Enhance'}
            </motion.button>
            {/* Auto-Enhance Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    setImageAutoEnhance(!imageAutoEnhance);
                    toast.success(!imageAutoEnhance ? 'Auto-enhance enabled — prompts will be enhanced before generation' : 'Auto-enhance disabled');
                  }}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-all ${
                    imageAutoEnhance
                      ? 'border-[#d9ff00]/50 bg-[#d9ff00]/15 text-[#d9ff00]'
                      : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  Auto
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                {imageAutoEnhance
                  ? 'Auto-enhance is ON — every prompt will be AI-enhanced before generation'
                  : 'Turn on to automatically enhance every prompt with AI before generating'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="relative animate-fade-in-up">
          <Textarea
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            onFocus={() => setPromptFocused(true)}
            onBlur={() => setTimeout(() => setPromptFocused(false), 200)}
            placeholder="Describe the image you want to create..."
            className="min-h-[120px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30 neon-focus"
          />
          <PromptSuggestions
            partial={imagePrompt.slice(-50)}
            context="image"
            onSelect={(completion) => setImagePrompt(imagePrompt + completion)}
            visible={promptFocused}
            onClose={() => setPromptFocused(false)}
          />
        </div>
      </div>

      {/* ----- Negative Prompt (collapsible) ----- */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setShowNegPrompt(!showNegPrompt)}
          className="flex w-full items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Negative Prompt
          {showNegPrompt ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        <AnimatePresence>
          {showNegPrompt && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <Textarea
                value={imageNegativePrompt}
                onChange={(e) => setImageNegativePrompt(e.target.value)}
                placeholder="Things to avoid in the image..."
                className="min-h-[80px] resize-none bg-surface border-border/60 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-[#d9ff00]/30"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Output Size ----- */}
      <div className="space-y-3">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Monitor className="h-3 w-3" />
          Output Size
        </Label>
        <div className="grid grid-cols-4 gap-2">
          {ASPECT_RATIOS.map((ratio) => (
            <motion.button
              key={ratio}
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setImageAspectRatio(ratio)}
              className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition-all ${
                imageAspectRatio === ratio
                  ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                  : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              <span className={`inline-block rounded-sm bg-current opacity-30 ${ratio === '1:1' ? 'h-4 w-4' : ''} ${ratio === '16:9' ? 'h-2.5 w-4.5' : ''} ${ratio === '9:16' ? 'h-4.5 w-2.5' : ''} ${ratio === '4:3' ? 'h-3 w-4' : ''} ${ratio === '3:4' ? 'h-4 w-3' : ''} ${ratio === '3:2' ? 'h-3 w-4.5' : ''} ${ratio === '2:3' ? 'h-4.5 w-3' : ''}`} />
              <span className="text-[10px] font-semibold">{ratio}</span>
              <span className="text-[8px] opacity-60">{RATIO_LABELS[ratio]}</span>
            </motion.button>
          ))}
        </div>

        {/* Resolution Tier */}
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground/60">Resolution</Label>
          <div className="flex gap-1.5">
            {RESOLUTION_TIERS.map((tier) => {
              const dims = RESOLUTION_MAP[imageAspectRatio]?.[tier];
              return (
                <motion.button
                  key={tier}
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setImageResolutionTier(tier)}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-center transition-all ${
                    imageResolutionTier === tier
                      ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                      : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                  }`}
                >
                  <span className="text-xs font-medium">{TIER_LABELS[tier]}</span>
                  {dims && <span className="block text-[8px] opacity-60 font-mono">{dims.width}×{dims.height}</span>}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Computed output dimensions badge */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/50">Output:</span>
          <Badge variant="secondary" className="text-[9px] font-mono bg-[#d9ff00]/5 text-[#d9ff00]/70 border-[#d9ff00]/10 px-2 py-0.5">
            {computedDimensions.width} × {computedDimensions.height}
          </Badge>
        </div>
      </div>

      <Separator className="opacity-40" />

      {/* ----- Advanced Settings ----- */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border-border/30">
          <AccordionTrigger className="py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:no-underline hover:text-foreground">
            <span className="flex items-center gap-2"><Settings2 className="h-3.5 w-3.5" />Advanced Settings</span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pt-3 animate-slide-in-right-subtle">
            {/* Quality Selector — OpenAI models */}
            {selectedImageProvider && providers.find((p) => p.id === selectedImageProvider)?.name === 'openai' && ['gpt-image-1', 'gpt-image-2', 'dall-e-3'].includes(selectedImageModel) && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  Quality
                </Label>
                <div className="flex gap-1.5">
                  {['low', 'medium', 'high'].map((q) => (
                    <motion.button
                      key={q}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setImageQuality(q)}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                        imageQuality === q
                          ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                          : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >
                      {q}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Output Format — All providers */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <FileImage className="h-3 w-3" />
                Output Format
              </Label>
              <div className="flex gap-1.5">
                {['png', 'jpeg', 'webp'].map((fmt) => (
                  <motion.button
                    key={fmt}
                    type="button"
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setImageFormat(fmt)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium uppercase transition-all ${
                      imageFormat === fmt
                        ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                        : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >
                    {fmt}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Steps</Label>
                <span className="text-xs font-mono text-[#d9ff00]">{imageSteps}</span>
              </div>
              <Slider value={[imageSteps]} onValueChange={([v]) => setImageSteps(v)} min={1} max={50} step={1} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>50</span></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Guidance Scale</Label>
                <span className="text-xs font-mono text-[#d9ff00]">{imageGuidance}</span>
              </div>
              <Slider value={[imageGuidance]} onValueChange={([v]) => setImageGuidance(v)} min={1} max={20} step={0.5} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>20</span></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Seed</Label>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setImageSeed(Math.floor(Math.random() * 2147483647))}
                        className="flex items-center justify-center h-5 w-5 rounded border border-border/40 bg-surface text-muted-foreground hover:text-[#d9ff00] hover:border-[#d9ff00]/30 transition-all"
                      >
                        <Dices className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Randomize seed</TooltipContent>
                  </Tooltip>
                  {imageSeed !== null && (
                    <button type="button" onClick={() => setImageSeed(null)} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
                  )}
                </div>
              </div>
              <Input type="number" value={imageSeed ?? ''} onChange={(e) => { const v = e.target.value; setImageSeed(v === '' ? null : parseInt(v, 10)); }} placeholder="Random" className="bg-surface border-border/60 text-sm placeholder:text-muted-foreground/40" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Batch Size</Label>
                <span className="text-xs font-mono text-[#d9ff00]">{imageBatchSize}</span>
              </div>
              <Slider value={[imageBatchSize]} onValueChange={([v]) => setImageBatchSize(v)} min={1} max={4} step={1} className="w-full" />
              <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1</span><span>4</span></div>
            </div>

            {/* Image Strength / Denoising Strength */}
            {inputImageUrl && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    Image Strength
                  </Label>
                  <span className="text-xs font-mono text-[#d9ff00]">{imageStrength.toFixed(2)}</span>
                </div>
                <Slider value={[imageStrength]} onValueChange={([v]) => setImageStrength(v)} min={0} max={1} step={0.05} className="w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>0 (keep original)</span><span>1 (full redraw)</span></div>
              </div>
            )}

            {/* Sampler/Scheduler */}
            {['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider) && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Shuffle className="h-3 w-3" />
                  Sampler
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {['dpmpp_2m', 'dpmpp_2m_sde', 'euler', 'euler_a', 'ddim', 'dpmpp_sde', 'heun', 'lms', 'dpm2', 'dpm2_a'].map((s) => (
                    <motion.button key={s} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => setImageSampler(s)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-mono transition-all ${
                        imageSampler === s ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >{s}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Ideogram-specific options */}
            {selectedImageProvider === 'ideogram' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3" />
                    Magic Prompt
                  </Label>
                  <div className="flex gap-1.5">
                    {['ON', 'OFF'].map((v) => (
                      <motion.button key={v} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setImageMagicPrompt(v === 'ON')}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          (v === 'ON' ? imageMagicPrompt : !imageMagicPrompt) ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >{v}</motion.button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="h-3 w-3" />
                    Style Type
                  </Label>
                  <div className="flex gap-1.5">
                    {['AUTO', 'GENERAL', 'REALISTIC', 'DESIGN'].map((s) => (
                      <motion.button key={s} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setImageStyleType(s)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-all ${
                          imageStyleType === s ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >{s}</motion.button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Gauge className="h-3 w-3" />
                    Rendering Speed
                  </Label>
                  <div className="flex gap-1.5">
                    {['TURBO', 'DEFAULT', 'QUALITY'].map((s) => (
                      <motion.button key={s} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setImageRenderingSpeed(s)}
                        className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-all ${
                          imageRenderingSpeed === s ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >{s}</motion.button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Stability-specific options */}
            {selectedImageProvider === 'stability' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="h-3 w-3" />
                  CLIP Guidance
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {['NONE', 'FAST_BLUE', 'FAST_GREEN', 'SIMPLE', 'SLOW', 'SLOWER', 'SLOWEST'].map((s) => (
                    <motion.button key={s} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => setImageClipGuidance(s)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-mono transition-all ${
                        imageClipGuidance === s ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >{s}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Leonardo-specific options */}
            {selectedImageProvider === 'leonardo' && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <FlaskConical className="h-3 w-3" />
                    Alchemy
                  </Label>
                  <div className="flex gap-1.5">
                    {['ON', 'OFF'].map((v) => (
                      <motion.button key={v} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setImageAlchemy(v === 'ON')}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          (v === 'ON' ? imageAlchemy : !imageAlchemy) ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >{v}</motion.button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Camera className="h-3 w-3" />
                    PhotoReal
                  </Label>
                  <div className="flex gap-1.5">
                    {['ON', 'OFF'].map((v) => (
                      <motion.button key={v} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setImagePhotoReal(v === 'ON')}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                          (v === 'ON' ? imagePhotoReal : !imagePhotoReal) ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >{v}</motion.button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* DALL-E 3 Style */}
            {selectedImageProvider === 'openai' && selectedImageModel === 'dall-e-3' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Palette className="h-3 w-3" />
                  DALL-E Style
                </Label>
                <div className="flex gap-1.5">
                  {['vivid', 'natural'].map((s) => (
                    <motion.button key={s} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => setImageStyleType(s)}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                        imageStyleType === s ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >{s}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Safety Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Safety Filter
              </Label>
              <div className="flex gap-1.5">
                {['ON', 'OFF'].map((v) => (
                  <motion.button key={v} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                    onClick={() => setImageSafetyFilter(v === 'ON')}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                      (v === 'ON' ? imageSafetyFilter : !imageSafetyFilter) ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                    }`}
                  >{v}</motion.button>
                ))}
              </div>
            </div>

            {/* Lighting Preset */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sun className="h-3 w-3" />
                Lighting
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {LIGHTING_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageLighting(preset.id === imageLighting ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageLighting === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No lighting modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Color Mood */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Droplets className="h-3 w-3" />
                Color Mood
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_MOOD_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageColorMood(preset.id === imageColorMood ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageColorMood === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No color modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Camera Shot */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-3 w-3" />
                Camera Shot
              </Label>
              <div className="grid grid-cols-4 gap-1.5">
                {CAMERA_SHOT_PRESETS.map((preset) => (
                  <Tooltip key={preset.id}>
                    <TooltipTrigger asChild>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setImageCameraShot(preset.id === imageCameraShot ? 'none' : preset.id)}
                        className={`relative flex flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-all ${
                          imageCameraShot === preset.id && preset.id !== 'none'
                            ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                            : 'border-border/30 bg-surface text-muted-foreground hover:border-border/60'
                        }`}
                      >
                        <span className="text-sm">{preset.emoji}</span>
                        <span className="text-[8px] font-medium leading-tight">{preset.label}</span>
                      </motion.button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                      {preset.id === 'none' ? 'No camera modifier' : `Adds: ${preset.suffix.slice(2)}`}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* Scheduler / Noise Schedule */}
            {['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider) && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Film className="h-3 w-3" />
                  Scheduler
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {SCHEDULER_OPTIONS.map((s) => (
                    <motion.button key={s.id} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => setImageScheduler(s.id)}
                      className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${
                        imageScheduler === s.id ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >{s.label}</motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* CLIP Skip */}
            {['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider) && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Eye className="h-3 w-3" />
                    CLIP Skip
                  </Label>
                  <span className="text-xs font-mono text-[#d9ff00]">{imageClipSkip}</span>
                </div>
                <Slider value={[imageClipSkip]} onValueChange={([v]) => setImageClipSkip(v)} min={1} max={12} step={1} className="w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>1 (full)</span><span>12 (abstract)</span></div>
              </div>
            )}

            {/* Hi-Res Fix */}
            {['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Maximize2 className="h-3 w-3" />
                    Hi-Res Fix
                  </Label>
                  <div className="flex gap-1.5">
                    {['ON', 'OFF'].map((v) => (
                      <motion.button key={v} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                        onClick={() => setImageHiresFix(v === 'ON')}
                        className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (v === 'ON' ? imageHiresFix : !imageHiresFix) ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                        }`}
                      >{v}</motion.button>
                    ))}
                  </div>
                </div>
                {imageHiresFix && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground/60">Upscale Factor</Label>
                        <span className="text-xs font-mono text-[#d9ff00]">{imageHiresScale}x</span>
                      </div>
                      <Slider value={[imageHiresScale]} onValueChange={([v]) => setImageHiresScale(v)} min={1.5} max={4} step={0.5} className="w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground/60">Hi-Res Steps</Label>
                        <span className="text-xs font-mono text-[#d9ff00]">{imageHiresSteps}</span>
                      </div>
                      <Slider value={[imageHiresSteps]} onValueChange={([v]) => setImageHiresSteps(v)} min={5} max={50} step={1} className="w-full" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground/60">Denoise Strength</Label>
                        <span className="text-xs font-mono text-[#d9ff00]">{imageHiresDenoise.toFixed(2)}</span>
                      </div>
                      <Slider value={[imageHiresDenoise]} onValueChange={([v]) => setImageHiresDenoise(v)} min={0.1} max={1} step={0.05} className="w-full" />
                      <div className="flex justify-between text-[10px] text-muted-foreground/60"><span>0.1 (subtle)</span><span>1.0 (full)</span></div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Tileable/Seamless */}
            {selectedImageProvider === 'stability' && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Grid3x3 className="h-3 w-3" />
                  Tileable / Seamless
                </Label>
                <div className="flex gap-1.5">
                  {['ON', 'OFF'].map((v) => (
                    <motion.button key={v} type="button" whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      onClick={() => setImageTileable(v === 'ON')}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                        (v === 'ON' ? imageTileable : !imageTileable) ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]' : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
                      }`}
                    >{v}</motion.button>
                  ))}
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ----- Reference Image Upload ----- */}
      <div className="space-y-2">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference Image</Label>
        <div className="flex gap-1.5">
          <ImageUpload onUploadComplete={(url) => { setInputImageUrl(url); saveReferenceImage(url).catch(() => {}); }} onRemove={() => setInputImageUrl(null)} currentImageUrl={inputImageUrl} compact label="Upload Reference" />
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenRefImageHistory}
                  className="gap-1.5 border-border/50 bg-surface/80 hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 hover:text-[#d9ff00] text-xs h-9"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </Button>
              </motion.div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Pick from previously used reference images</TooltipContent>
          </Tooltip>
        </div>
        {inputImageUrl && (
          <div className="relative overflow-hidden rounded-lg border border-[#d9ff00]/20 bg-[#d9ff00]/5">
            <img src={inputImageUrl} alt="Reference" className="h-24 w-full object-contain bg-black/40" />
            <div className="absolute bottom-1 right-1">
              <Button variant="ghost" size="icon" onClick={() => setInputImageUrl(null)} className="h-6 w-6 bg-black/60 text-white hover:bg-destructive hover:text-white">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ----- Batch Size Selector ----- */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Grid3x3 className="h-3 w-3" />
          Batch Size
        </Label>
        <div className="flex gap-1.5">
          {[1, 2, 4].map((size) => (
            <motion.button
              key={size}
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => setImageBatchSize(size)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition-all ${
                imageBatchSize === size
                  ? 'border-[#d9ff00]/50 bg-[#d9ff00]/10 text-[#d9ff00] shadow-[0_0_12px_#d9ff0015]'
                  : 'border-border/40 bg-surface text-muted-foreground hover:border-border hover:text-foreground'
              }`}
            >
              {size}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ----- Generate + Compare Buttons ----- */}
      <div className="space-y-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={() => { onGenerate(); onMobileClose?.(); }}
                disabled={isImageGenerating || !hasApiKey || !imagePrompt.trim() || !selectedImageModel}
                className={`w-full h-12 text-base font-semibold rounded-xl transition-all relative overflow-hidden ${
                  isImageGenerating
                    ? 'bg-[#d9ff00]/20 text-[#d9ff00] cursor-wait generate-pulse-glow'
                    : !hasApiKey || !selectedImageModel
                      ? 'bg-surface text-muted-foreground cursor-not-allowed'
                      : hasApiKey && selectedImageModel && imagePrompt.trim()
                        ? 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] generate-ready-glow'
                        : 'bg-[#d9ff00] text-background hover:bg-[#c5eb00] generate-shimmer'
                }`}
              >
                {isImageGenerating ? (
                  <>
                    <span className="flex items-center gap-2 relative z-10"><Loader2 className="h-5 w-5 animate-spin" />Generating…</span>
                    <div className="generate-progress-bar" />
                  </>
                ) : (
                  <span className="flex items-center gap-2 relative z-10"><Sparkles className="h-5 w-5" />Generate</span>
                )}
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <span className="flex items-center gap-1.5">
              Generate image
              <kbd className="rounded border border-border/60 bg-surface px-1.5 py-0.5 text-[10px] font-mono">⌘Enter</kbd>
            </span>
          </TooltipContent>
        </Tooltip>
        {/* Compare button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={() => { onCompare(); onMobileClose?.(); }}
              disabled={!imagePrompt.trim()}
              className="w-full h-10 text-sm font-medium rounded-xl gap-2 border-[#d9ff00]/30 bg-[#d9ff00]/5 text-[#d9ff00] hover:bg-[#d9ff00]/10 hover:text-[#d9ff00] hover:border-[#d9ff00]/50 transition-all disabled:opacity-40"
            >
              <GitCompareArrows className="h-4 w-4" />
              Compare Models
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Generate the same prompt across 2-3 models side by side
          </TooltipContent>
        </Tooltip>
        {/* Cost estimator badge */}
        {selectedImageModel && hasApiKey && (
          <CostEstimateBadge providerId={selectedImageProvider} modelId={selectedImageModel} type="image" batchSize={imageBatchSize} duration={undefined} />
        )}
      </div>

      {!hasApiKey && selectedImageProvider && (
        <p className="text-center text-[10px] text-muted-foreground/60">Add an API key in Settings to enable generation</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImageStudio() {
  // Store ------------------------------------------------------------------
  const {
    imagePrompt,
    setImagePrompt,
    imageNegativePrompt,
    setImageNegativePrompt,
    selectedImageProvider,
    setSelectedImageProvider,
    selectedImageModel,
    setSelectedImageModel,
    imageAspectRatio,
    setImageAspectRatio,
    imageQuality,
    setImageQuality,
    imageSteps,
    setImageSteps,
    imageGuidance,
    setImageGuidance,
    imageSeed,
    setImageSeed,
    imageBatchSize,
    setImageBatchSize,
    imageResolutionTier,
    setImageResolutionTier,
    imageFormat,
    setImageFormat,
    imageStrength,
    setImageStrength,
    imageSampler,
    setImageSampler,
    imageMagicPrompt,
    setImageMagicPrompt,
    imageStyleType,
    setImageStyleType,
    imageRenderingSpeed,
    setImageRenderingSpeed,
    imageClipGuidance,
    setImageClipGuidance,
    imageTileable,
    setImageTileable,
    imagePhotoReal,
    setImagePhotoReal,
    imageAlchemy,
    setImageAlchemy,
    imageSafetyFilter,
    setImageSafetyFilter,
    imageScheduler,
    setImageScheduler,
    imageClipSkip,
    setImageClipSkip,
    imageLighting,
    setImageLighting,
    imageColorMood,
    setImageColorMood,
    imageCameraShot,
    setImageCameraShot,
    imageHiresFix,
    setImageHiresFix,
    imageHiresScale,
    setImageHiresScale,
    imageHiresSteps,
    setImageHiresSteps,
    imageHiresDenoise,
    setImageHiresDenoise,
    imageSubject,
    setImageSubject,
    imageDetailLevel,
    setImageDetailLevel,
    imageComposition,
    setImageComposition,
    imageEmotion,
    setImageEmotion,
    imageEra,
    setImageEra,
    imageOutfit,
    setImageOutfit,
    imageHairstyle,
    setImageHairstyle,
    imageHairColor,
    setImageHairColor,
    imageEyeColor,
    setImageEyeColor,
    imagePose,
    setImagePose,
    imageAccessories,
    setImageAccessories,
    imageBodyType,
    setImageBodyType,
    imageAge,
    setImageAge,
    imageOutfitDescription,
    setImageOutfitDescription,
    imageOutfitImageUrl,
    setImageOutfitImageUrl,
    inputImageUrl,
    setInputImageUrl,
    isImageGenerating,
    setIsImageGenerating,
    latestResult,
    setLatestResult,
    generationResults,
    setGenerationResults,
    selectedResultIndex,
    setSelectedResultIndex,
    providerVersion,
    generateTrigger,
    addToQueue,
    updateQueueItem,
    setIsCompareOpen,
    postGenAction,
    setPostGenAction,
    isPostGenProcessing,
    setIsPostGenProcessing,
    setPostGenResult,
    imageAutoEnhance,
    setImageAutoEnhance,
    generationDuration,
    setGenerationDuration,
    setActiveTab,
    styleTransferOpen,
    setStyleTransferOpen,
  } = useAppStore();

  // IndexedDB-backed API keys hook -------------------------------------------
  const apiKeysHook = useApiKeys();

  // Local state ------------------------------------------------------------
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [showNegPrompt, setShowNegPrompt] = useState(false);

  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [socialExportOpen, setSocialExportOpen] = useState(false);
  const [editorImage, setEditorImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [activeStylePreset, setActiveStylePreset] = useState<string | null>(null);
  const addPromptToHistory = useAppStore((s) => s.addPromptToHistory);
  const setPromptLibraryOpen = useAppStore((s) => s.setPromptLibraryOpen);
  const queueIdRef = useRef<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [refImagePickerOpen, setRefImagePickerOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postGenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postGenPollCountRef = useRef(0);
  const isMobile = useIsMobile();

  // Loading state: rotating messages & elapsed time
  const [genStartTime, setGenStartTime] = useState<number | null>(null);
  const [genElapsed, setGenElapsed] = useState(0);
  const [genMsgIndex, setGenMsgIndex] = useState(0);

  // Generation info card state
  const [infoCardVisible, setInfoCardVisible] = useState(true);
  const [infoDetailsOpen, setInfoDetailsOpen] = useState(false);
  // Track the last prompt used for generation (for copy prompt button)
  const [lastGeneratedPrompt, setLastGeneratedPrompt] = useState<string>('');
  const infoCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived ----------------------------------------------------------------
  const selectedProviderData = providers.find((p) => p.id === selectedImageProvider) ?? null;
  const imageModels = selectedProviderData?.models.filter((m) => m.type === 'image') ?? [];
  const hasApiKey = apiKeysHook.hasKey(selectedImageProvider);

  // Reference image history: select from picker
  const handleRefImageSelect = useCallback((dataUrl: string) => {
    setInputImageUrl(dataUrl);
  }, [setInputImageUrl]);

  const handleOpenRefImageHistory = useCallback(() => {
    setRefImagePickerOpen(true);
  }, []);

  // Fetch providers --------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/providers');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: Provider[] = await res.json();
        setProviders(data);

        // Auto-select first provider that has an API key
        if (!selectedImageProvider && data.length > 0) {
          const withKey = data.find((p) => apiKeysHook.hasKey(p.id));
          const pick = withKey || data[0];
          setSelectedImageProvider(pick.id);
          // Auto-select default model
          const defaultModel = pick.models.find((m) => m.isDefault && m.type === 'image');
          if (defaultModel) {
            setSelectedImageModel(defaultModel.modelId);
          } else {
            const firstImage = pick.models.find((m) => m.type === 'image');
            if (firstImage) setSelectedImageModel(firstImage.modelId);
          }
        }
      } catch {
        toast.error('Failed to load providers');
      } finally {
        setProvidersLoading(false);
      }
    }
    load();
  }, [providerVersion]);

  // When provider changes, reset model selection ---------------------------
  useEffect(() => {
    if (!selectedImageProvider || providers.length === 0) return;
    const prov = providers.find((p) => p.id === selectedImageProvider);
    if (!prov) return;
    const defaultModel = prov.models.find((m) => m.isDefault && m.type === 'image');
    if (defaultModel) {
      setSelectedImageModel(defaultModel.modelId);
    } else {
      const firstImage = prov.models.find((m) => m.type === 'image');
      if (firstImage) setSelectedImageModel(firstImage.modelId);
      else setSelectedImageModel('');
    }
  }, [selectedImageProvider, providers, setSelectedImageModel]);



  // Polling logic — sends apiKey from IndexedDB for async status checks --------
  const startPolling = useCallback(
    (generationId: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const apiKey = await apiKeysHook.getKeyForProvider(selectedImageProvider);
          const res = await fetch(`/api/generate/status?id=${generationId}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
          if (!res.ok) throw new Error('Status check failed');
          const data = await res.json();

          if (data.status === 'completed') {
            setIsImageGenerating(false);
            const allUrls = data.urls || (data.resultUrl ? [data.resultUrl] : []);
            setLatestResult(data.resultUrl || data.urls?.[0] || null);
            setGenerationResults(allUrls);
            setSelectedResultIndex(0);
            setCurrentJobId(null);
            setGenerationDuration(genStartTime ? (Date.now() - genStartTime) / 1000 : null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.resultUrl || data.urls?.[0] || undefined });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.success(allUrls.length > 1 ? `${allUrls.length} images generated successfully!` : 'Image generated successfully!');
          } else if (data.status === 'failed') {
            setIsImageGenerating(false);
            setCurrentJobId(null);
            if (queueIdRef.current) {
              updateQueueItem(queueIdRef.current, { status: 'failed' });
              queueIdRef.current = null;
            }
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            toast.error(data.error || 'Generation failed');
          }
        } catch {
          // retry next interval
        }
      }, 3000);
    },
    [setIsImageGenerating, setLatestResult, setGenerationResults, setSelectedResultIndex, setGenerationDuration, apiKeysHook, selectedImageProvider, updateQueueItem]
  );

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Generate handler -------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!selectedImageProvider) {
      toast.error('Please select a provider');
      return;
    }
    if (!selectedImageModel) {
      toast.error('Please select a model');
      return;
    }

    // Read fresh state from store (avoids stale closure issues)
    const s = useAppStore.getState();
    const currentPrompt = s.imagePrompt;
    const currentNegPrompt = s.imageNegativePrompt;
    const currentAspectRatio = s.imageAspectRatio;
    const currentResolutionTier = s.imageResolutionTier;
    const currentQuality = s.imageQuality;
    const currentFormat = s.imageFormat;
    const currentSteps = s.imageSteps;
    const currentGuidance = s.imageGuidance;
    const currentSeed = s.imageSeed;
    const currentBatchSize = s.imageBatchSize;
    const currentInputImageUrl = s.inputImageUrl;
    const currentStrength = s.imageStrength;
    const currentSampler = s.imageSampler;
    const currentMagicPrompt = s.imageMagicPrompt;
    const currentStyleType = s.imageStyleType;
    const currentRenderingSpeed = s.imageRenderingSpeed;
    const currentClipGuidance = s.imageClipGuidance;
    const currentTileable = s.imageTileable;
    const currentPhotoReal = s.imagePhotoReal;
    const currentAlchemy = s.imageAlchemy;
    const currentSafetyFilter = s.imageSafetyFilter;
    const currentLighting = s.imageLighting;
    const currentColorMood = s.imageColorMood;
    const currentCameraShot = s.imageCameraShot;
    const currentSubject = s.imageSubject;
    const currentDetailLevel = s.imageDetailLevel;
    const currentComposition = s.imageComposition;
    const currentEmotion = s.imageEmotion;
    const currentEra = s.imageEra;
    const currentOutfit = s.imageOutfit;
    const currentHairstyle = s.imageHairstyle;
    const currentHairColor = s.imageHairColor;
    const currentEyeColor = s.imageEyeColor;
    const currentPose = s.imagePose;
    const currentAccessories = s.imageAccessories;
    const currentBodyType = s.imageBodyType;
    const currentAge = s.imageAge;
    const currentScheduler = s.imageScheduler;
    const currentClipSkip = s.imageClipSkip;
    const currentHiresFix = s.imageHiresFix;
    const currentHiresScale = s.imageHiresScale;
    const currentHiresSteps = s.imageHiresSteps;
    const currentHiresDenoise = s.imageHiresDenoise;
    const currentAutoEnhance = s.imageAutoEnhance;
    const currentOutfitDescription = s.imageOutfitDescription;
    const currentOutfitImageUrl = s.imageOutfitImageUrl;

    if (!currentPrompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured for this provider. Add one in Settings.');
      return;
    }

    // Auto-enhance prompt if toggle is on
    let basePrompt = currentPrompt.trim();
    if (currentAutoEnhance) {
      try {
        setIsImageGenerating(true);
        const enhanceRes = await fetch('/api/enhance-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: basePrompt, type: 'enhance' }),
        });
        const enhanceData = await enhanceRes.json();
        if (enhanceData.enhancedPrompt) {
          basePrompt = enhanceData.enhancedPrompt;
          toast.success('Prompt auto-enhanced with AI!');
        }
      } catch {
        // If enhancement fails, proceed with original prompt
        toast.info('Auto-enhance failed, using original prompt');
      }
    }

    // Apply style preset suffix to prompt
    let finalPrompt = basePrompt;
    let finalNegPrompt = currentNegPrompt.trim();
    if (activeStylePreset) {
      const preset = STYLE_PRESETS.find((p) => p.id === activeStylePreset);
      if (preset) {
        finalPrompt += preset.suffix;
        if (preset.negSuffix) {
          finalNegPrompt = finalNegPrompt ? `${finalNegPrompt}, ${preset.negSuffix}` : preset.negSuffix;
        }
      }
    }

    // Apply lighting preset suffix
    if (currentLighting !== 'none') {
      const lightPreset = LIGHTING_PRESETS.find((p) => p.id === currentLighting);
      if (lightPreset?.suffix) finalPrompt += lightPreset.suffix;
    }
    // Apply color mood suffix
    if (currentColorMood !== 'none') {
      const moodPreset = COLOR_MOOD_PRESETS.find((p) => p.id === currentColorMood);
      if (moodPreset?.suffix) finalPrompt += moodPreset.suffix;
    }
    // Apply camera shot suffix
    if (currentCameraShot !== 'none') {
      const shotPreset = CAMERA_SHOT_PRESETS.find((p) => p.id === currentCameraShot);
      if (shotPreset?.suffix) finalPrompt += shotPreset.suffix;
    }
    // Apply subject preset suffix
    if (currentSubject !== 'none') {
      const subjectPreset = SUBJECT_PRESETS.find((p) => p.id === currentSubject);
      if (subjectPreset?.suffix) finalPrompt += subjectPreset.suffix;
    }
    // Apply detail level suffix
    if (currentDetailLevel !== 'none') {
      const detailPreset = DETAIL_LEVEL_PRESETS.find((p) => p.id === currentDetailLevel);
      if (detailPreset?.suffix) finalPrompt += detailPreset.suffix;
    }
    // Apply composition suffix
    if (currentComposition !== 'none') {
      const compPreset = COMPOSITION_PRESETS.find((p) => p.id === currentComposition);
      if (compPreset?.suffix) finalPrompt += compPreset.suffix;
    }
    // Apply emotion suffix
    if (currentEmotion !== 'none') {
      const emotionPreset = EMOTION_PRESETS.find((p) => p.id === currentEmotion);
      if (emotionPreset?.suffix) finalPrompt += emotionPreset.suffix;
    }
    // Apply era suffix
    if (currentEra !== 'none') {
      const eraPreset = ERA_PRESETS.find((p) => p.id === currentEra);
      if (eraPreset?.suffix) finalPrompt += eraPreset.suffix;
    }

    // Apply character detail presets
    if (currentOutfit !== 'none') {
      const preset = OUTFIT_PRESETS.find((p) => p.id === currentOutfit);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentHairstyle !== 'none') {
      const preset = HAIRSTYLE_PRESETS.find((p) => p.id === currentHairstyle);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentHairColor !== 'none') {
      const preset = HAIR_COLOR_PRESETS.find((p) => p.id === currentHairColor);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentEyeColor !== 'none') {
      const preset = EYE_COLOR_PRESETS.find((p) => p.id === currentEyeColor);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentPose !== 'none') {
      const preset = POSE_PRESETS.find((p) => p.id === currentPose);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentAccessories !== 'none') {
      const preset = ACCESSORIES_PRESETS.find((p) => p.id === currentAccessories);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentBodyType !== 'none') {
      const preset = BODY_TYPE_PRESETS.find((p) => p.id === currentBodyType);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }
    if (currentAge !== 'none') {
      const preset = AGE_PRESETS.find((p) => p.id === currentAge);
      if (preset?.suffix) finalPrompt += preset.suffix;
    }

    // Apply outfit change description
    if (currentOutfitDescription) {
      finalPrompt += `, wearing ${currentOutfitDescription}`;
    }

    // Save to prompt history
    addPromptToHistory(currentPrompt.trim());

    // Save the final prompt for the Copy Prompt button
    setLastGeneratedPrompt(finalPrompt);

    setIsImageGenerating(true);
    setLatestResult(null);
    setGenerationResults([]);
    setSelectedResultIndex(0);
    setCurrentJobId(null);
    setGenerationDuration(null);
    const generationStartTime = Date.now();

    // Add to generation queue
    const queueItem: GenerationQueueItem = {
      id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      prompt: currentPrompt.trim(),
      providerName: selectedProviderData?.displayName || selectedImageProvider,
      providerColor: selectedProviderData?.color || '#888',
      modelName: imageModels.find((m) => m.modelId === selectedImageModel)?.name || selectedImageModel,
      status: 'processing',
      createdAt: Date.now(),
    };
    addToQueue(queueItem);
    queueIdRef.current = queueItem.id;

    try {
      // Get API key from IndexedDB (BYOK model)
      const apiKey = await apiKeysHook.getKeyForProvider(selectedImageProvider);
      if (!apiKey) {
        toast.error('No API key configured for this provider. Add one in Settings.');
        setIsImageGenerating(false);
        return;
      }

      // Compute dimensions from aspect ratio + resolution tier
      const dimensions = RESOLUTION_MAP[currentAspectRatio]?.[currentResolutionTier] ?? RESOLUTION_MAP['1:1']['hd'];
      const computedSize = `${dimensions.width}x${dimensions.height}`;

      const isSDProvider = ['stability', 'replicate', 'fal', 'together', 'fireworks', 'huggingface'].includes(selectedImageProvider);

      const body: Record<string, unknown> = {
        providerId: selectedImageProvider,
        modelId: selectedImageModel,
        prompt: finalPrompt,
        negativePrompt: finalNegPrompt || undefined,
        aspectRatio: currentAspectRatio,
        quality: currentQuality,
        size: computedSize,
        width: dimensions.width,
        height: dimensions.height,
        output_format: currentFormat !== 'png' ? currentFormat : undefined,
        steps: currentSteps,
        guidance: currentGuidance,
        seed: currentSeed ?? undefined,
        batchSize: currentBatchSize,
        inputImageUrl: currentInputImageUrl || undefined,
        apiKey,
        strength: currentInputImageUrl ? currentStrength : undefined,
        sampler: isSDProvider ? currentSampler : undefined,
        magicPrompt: selectedImageProvider === 'ideogram' ? currentMagicPrompt : undefined,
        styleType: (selectedImageProvider === 'ideogram' || (selectedImageProvider === 'openai' && selectedImageModel === 'dall-e-3')) ? currentStyleType : undefined,
        renderingSpeed: selectedImageProvider === 'ideogram' ? currentRenderingSpeed : undefined,
        clipGuidance: selectedImageProvider === 'stability' ? currentClipGuidance : undefined,
        tileable: selectedImageProvider === 'stability' && currentTileable ? true : undefined,
        photoReal: selectedImageProvider === 'leonardo' && currentPhotoReal ? true : undefined,
        alchemy: selectedImageProvider === 'leonardo' && currentAlchemy ? true : undefined,
        safetyFilter: !currentSafetyFilter ? false : undefined,
        scheduler: isSDProvider ? currentScheduler : undefined,
        clipSkip: isSDProvider && currentClipSkip > 1 ? currentClipSkip : undefined,
        lighting: currentLighting !== 'none' ? currentLighting : undefined,
        colorMood: currentColorMood !== 'none' ? currentColorMood : undefined,
        cameraShot: currentCameraShot !== 'none' ? currentCameraShot : undefined,
        hiresFix: isSDProvider && currentHiresFix ? true : undefined,
        hiresScale: isSDProvider && currentHiresFix ? currentHiresScale : undefined,
        hiresSteps: isSDProvider && currentHiresFix ? currentHiresSteps : undefined,
        hiresDenoise: isSDProvider && currentHiresFix ? currentHiresDenoise : undefined,
        outfitImageUrl: currentOutfitImageUrl || undefined,
      };

      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      if (data.status === 'completed' && data.urls) {
        // Immediate result
        setLatestResult(data.urls[0] || null);
        setGenerationResults(data.urls);
        setSelectedResultIndex(0);
        setIsImageGenerating(false);
        setGenerationDuration((Date.now() - generationStartTime) / 1000);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'completed', resultUrl: data.urls[0] || undefined });
          queueIdRef.current = null;
        }
        toast.success(data.urls.length > 1 ? `${data.urls.length} images generated successfully!` : 'Image generated successfully!');
      } else if (data.status === 'processing' && data.id) {
        // Async – start polling
        setCurrentJobId(data.id);
        startPolling(data.id);
        toast.info('Generation in progress…');
      } else {
        setIsImageGenerating(false);
        if (queueIdRef.current) {
          updateQueueItem(queueIdRef.current, { status: 'failed' });
          queueIdRef.current = null;
        }
        toast.error('Unexpected response from server');
      }
    } catch (err) {
      setIsImageGenerating(false);
      if (queueIdRef.current) {
        updateQueueItem(queueIdRef.current, { status: 'failed' });
        queueIdRef.current = null;
      }
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    }
  }, [
    selectedImageProvider,
    selectedImageModel,
    hasApiKey,
    apiKeysHook,
    activeStylePreset,
    selectedProviderData,
    imageModels,
    setIsImageGenerating,
    setLatestResult,
    startPolling,
    addToQueue,
    updateQueueItem,
  ]);

  // Keyboard shortcut: generate on trigger
  useEffect(() => {
    if (generateTrigger > 0) {
      handleGenerate();
    }
  }, [generateTrigger, handleGenerate]);

  // Download helper --------------------------------------------------------
  const handleDownload = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `ai-studio-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      toast.success('Image downloaded');
    } catch {
      // Fallback: open in new tab
      window.open(url, '_blank');
    }
  }, []);

  // Favorite helper --------------------------------------------------------
  const handleFavorite = useCallback(async (id: string) => {
    try {
      await data.toggleGenerationFavorite(id, false);
      toast.success('Added to favorites');
    } catch {
      toast.error('Failed to favorite');
    }
  }, []);

  // Post-generation action handler -------------------------------------------
  // Derived: the currently active image URL (selected from batch or latestResult)
  const activeImageUrl = generationResults.length > 1
    ? generationResults[selectedResultIndex] || latestResult
    : latestResult;

  const handlePostGenAction = useCallback(async (action: 'upscale' | 'variation' | 'improve' | 'img2vid') => {
    if (!latestResult) {
      toast.error('No image to process');
      return;
    }
    if (!hasApiKey) {
      toast.error('No API key configured. Add one in Settings.');
      return;
    }
    if (!selectedImageProvider || !selectedImageModel) {
      toast.error('Please select a provider and model first');
      return;
    }

    setPostGenAction(action);
    setIsPostGenProcessing(true);
    setPostGenResult(null);

    try {
      const apiKey = await apiKeysHook.getKeyForProvider(selectedImageProvider);
      if (!apiKey) {
        toast.error('No API key found for this provider');
        setIsPostGenProcessing(false);
        setPostGenAction(null);
        return;
      }

      let endpoint = '';
      let body: Record<string, unknown> = {};

      switch (action) {
        case 'upscale': {
          endpoint = '/api/generate/upscale';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            upscaleFactor: 2,
            apiKey,
          };
          break;
        }
        case 'variation': {
          endpoint = '/api/generate/variations';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            prompt: imagePrompt || 'Generate a variation of this image',
            variationStrength: 0.7,
            negativePrompt: imageNegativePrompt || undefined,
            apiKey,
          };
          break;
        }
        case 'improve': {
          // "Improve" is basically a variation with low strength (keeps more of original)
          endpoint = '/api/generate/variations';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            prompt: `Enhanced, improved quality, better details, higher resolution version of: ${imagePrompt}`,
            variationStrength: 0.4,
            negativePrompt: 'low quality, blurry, distorted, deformed, ugly, bad anatomy',
            apiKey,
          };
          break;
        }
        case 'img2vid': {
          endpoint = '/api/generate/img2vid';
          body = {
            providerId: selectedImageProvider,
            modelId: selectedImageModel,
            imageUrl: activeImageUrl,
            prompt: imagePrompt || 'Animate this image',
            duration: 5,
            apiKey,
          };
          break;
        }
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `${action} failed`);

      if (data.status === 'completed' && data.urls?.[0]) {
        setLatestResult(data.urls[0]);
        setPostGenResult(data.urls[0]);
        toast.success(`${action === 'upscale' ? 'Upscaled' : action === 'variation' ? 'Variation created' : action === 'improve' ? 'Image improved' : 'Video conversion started'}!`);
      } else if (data.status === 'completed' && data.images?.[0]) {
        setLatestResult(data.images[0]);
        setPostGenResult(data.images[0]);
        toast.success(`${action === 'upscale' ? 'Upscaled' : action === 'variation' ? 'Variation created' : 'Image improved'}!`);
      } else if (data.status === 'processing' && data.id) {
        // Start polling for async result (with cleanup ref and max retries)
        toast.info('Processing… This may take a moment.');
        postGenPollCountRef.current = 0;
        const pollInterval = setInterval(async () => {
          postGenPollCountRef.current += 1;
          if (postGenPollCountRef.current > 60) { // max 3 minutes (60 * 3s)
            clearInterval(pollInterval);
            postGenPollRef.current = null;
            setIsPostGenProcessing(false);
            setPostGenAction(null);
            toast.error('Processing timed out. Check your gallery for results.');
            return;
          }
          try {
            const sr = await fetch(`/api/generate/status?id=${data.id}${apiKey ? `&apiKey=${encodeURIComponent(apiKey)}` : ''}`);
            const sd = await sr.json();
            if (sd.status === 'completed') {
              clearInterval(pollInterval);
              postGenPollRef.current = null;
              const resultUrl = sd.resultUrl || sd.urls?.[0];
              if (resultUrl) {
                setLatestResult(resultUrl);
                setPostGenResult(resultUrl);
              }
              setIsPostGenProcessing(false);
              setPostGenAction(null);
              toast.success(`${action === 'upscale' ? 'Upscaled' : action === 'variation' ? 'Variation created' : action === 'improve' ? 'Image improved' : 'Video generated'}!`);
            } else if (sd.status === 'failed') {
              clearInterval(pollInterval);
              postGenPollRef.current = null;
              setIsPostGenProcessing(false);
              setPostGenAction(null);
              toast.error(sd.error || `${action} failed`);
            }
          } catch {
            // retry next interval
          }
        }, 3000);
        postGenPollRef.current = pollInterval;
        return; // don't reset processing state yet
      } else {
        throw new Error('Unexpected response');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${action} failed`);
    }
    setIsPostGenProcessing(false);
    setPostGenAction(null);
  }, [latestResult, hasApiKey, selectedImageProvider, selectedImageModel, imagePrompt, imageNegativePrompt, apiKeysHook, setLatestResult, setPostGenAction, setIsPostGenProcessing, setPostGenResult]);

  // Cleanup post-gen polling on unmount
  useEffect(() => {
    return () => {
      if (postGenPollRef.current) {
        clearInterval(postGenPollRef.current);
        postGenPollRef.current = null;
      }
    };
  }, []);

  // Generation loading: start timer & rotate messages
  useEffect(() => {
    if (isImageGenerating) {
      setGenStartTime(Date.now());
      setGenElapsed(0);
      setGenMsgIndex(0);
    } else {
      setGenStartTime(null);
    }
  }, [isImageGenerating]);

  useEffect(() => {
    if (!isImageGenerating || !genStartTime) return;
    const interval = setInterval(() => {
      setGenElapsed(Math.floor((Date.now() - genStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isImageGenerating, genStartTime]);

  useEffect(() => {
    if (!isImageGenerating) return;
    const interval = setInterval(() => {
      setGenMsgIndex((prev) => (prev + 1) % 4);
    }, 2000);
    return () => clearInterval(interval);
  }, [isImageGenerating]);

  // Info card auto-hide when a new result appears
  useEffect(() => {
    if (latestResult) {
      setInfoCardVisible(true);
      setInfoDetailsOpen(false);
      if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
      infoCardTimerRef.current = setTimeout(() => setInfoCardVisible(false), 5000);
      return () => {
        if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
      };
    }
  }, [latestResult]);

  // ========================================================================
  // RENDER
  // ========================================================================

  // Sidebar props shared between desktop and mobile
  const sidebarProps = {
    providers,
    providersLoading,
    selectedImageProvider,
    setSelectedImageProvider,
    selectedImageModel,
    setSelectedImageModel,
    selectedProviderData,
    imageModels,
    hasApiKey,
    configuredProviderIds: apiKeysHook.configuredProviderIds,
    imagePrompt,
    setImagePrompt,
    imageNegativePrompt,
    setImageNegativePrompt,
    imageAspectRatio,
    setImageAspectRatio,
    imageQuality,
    setImageQuality,
    imageSteps,
    setImageSteps,
    imageGuidance,
    setImageGuidance,
    imageSeed,
    setImageSeed,
    imageBatchSize,
    setImageBatchSize,
    imageResolutionTier,
    setImageResolutionTier,
    imageFormat,
    setImageFormat,
    imageStrength,
    setImageStrength,
    imageSampler,
    setImageSampler,
    imageMagicPrompt,
    setImageMagicPrompt,
    imageStyleType,
    setImageStyleType,
    imageRenderingSpeed,
    setImageRenderingSpeed,
    imageClipGuidance,
    setImageClipGuidance,
    imageTileable,
    setImageTileable,
    imagePhotoReal,
    setImagePhotoReal,
    imageAlchemy,
    setImageAlchemy,
    imageSafetyFilter,
    setImageSafetyFilter,
    imageScheduler,
    setImageScheduler,
    imageClipSkip,
    setImageClipSkip,
    imageLighting,
    setImageLighting,
    imageColorMood,
    setImageColorMood,
    imageCameraShot,
    setImageCameraShot,
    imageHiresFix,
    setImageHiresFix,
    imageHiresScale,
    setImageHiresScale,
    imageHiresSteps,
    setImageHiresSteps,
    imageHiresDenoise,
    setImageHiresDenoise,
    imageSubject,
    setImageSubject,
    imageDetailLevel,
    setImageDetailLevel,
    imageComposition,
    setImageComposition,
    imageEmotion,
    setImageEmotion,
    imageEra,
    setImageEra,
    imageOutfit,
    setImageOutfit,
    imageHairstyle,
    setImageHairstyle,
    imageHairColor,
    setImageHairColor,
    imageEyeColor,
    setImageEyeColor,
    imagePose,
    setImagePose,
    imageAccessories,
    setImageAccessories,
    imageBodyType,
    setImageBodyType,
    imageAge,
    setImageAge,
    imageOutfitDescription,
    setImageOutfitDescription,
    imageOutfitImageUrl,
    setImageOutfitImageUrl,
    inputImageUrl,
    setInputImageUrl,
    isImageGenerating,
    isEnhancing,
    setIsEnhancing,
    showNegPrompt,
    setShowNegPrompt,
    activeStylePreset,
    setActiveStylePreset,
    onGenerate: handleGenerate,
    onCompare: () => setIsCompareOpen(true),
    onOpenRefImageHistory: handleOpenRefImageHistory,
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Reference Image History Picker Dialog */}
      <ReferenceImagePicker
        open={refImagePickerOpen}
        onOpenChange={setRefImagePickerOpen}
        onSelect={handleRefImageSelect}
        title="Reference Image History"
      />

      {/* ================================================================== */}
      {/* LEFT SIDEBAR – Generation Controls                                */}
      {/* ================================================================== */}

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-[380px] min-w-[380px] max-w-[380px] shrink-0 overflow-hidden border-r border-border/60">
        <ScrollArea className="h-full">
          <SidebarContent {...sidebarProps} />
        </ScrollArea>
      </aside>

      {/* Mobile sidebar - Sheet/Drawer */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="glass-strong w-[340px] p-0 border-r-0">
          <SheetTitle className="sr-only">Image Generation Controls</SheetTitle>
          <SheetDescription className="sr-only">Configure image generation settings</SheetDescription>
          <ScrollArea className="h-full">
            <SidebarContent {...sidebarProps} onMobileClose={() => setMobileSidebarOpen(false)} />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* ================================================================== */}
      {/* MAIN AREA – Results Display                                        */}
      {/* ================================================================== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar with controls toggle */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-surface/40">
          <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 border-border/60 bg-surface hover:bg-surface-hover">
                <PanelLeftOpen className="h-4 w-4" />
                Controls
              </Button>
            </SheetTrigger>
          </Sheet>
          {activeStylePreset && (
            <Badge className="gap-1 text-[10px]" style={{
              backgroundColor: `${STYLE_PRESETS.find(p => p.id === activeStylePreset)?.color}15`,
              color: STYLE_PRESETS.find(p => p.id === activeStylePreset)?.color,
              borderColor: `${STYLE_PRESETS.find(p => p.id === activeStylePreset)?.color}30`,
            }}>
              <Palette className="h-3 w-3" />
              {STYLE_PRESETS.find(p => p.id === activeStylePreset)?.label}
            </Badge>
          )}
          {selectedProviderData && (
            <Badge variant="secondary" className="ml-auto gap-1 text-[10px] bg-surface border-border text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
              {selectedProviderData.displayName}
            </Badge>
          )}
        </div>

        {/* Style preset indicator (desktop) */}
        {activeStylePreset && !isMobile && (
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 border-b border-border/30 bg-surface/20">
            <Palette className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Style:</span>
            <Badge className="gap-1 text-[10px]" style={{
              backgroundColor: `${STYLE_PRESETS.find(p => p.id === activeStylePreset)?.color}15`,
              color: STYLE_PRESETS.find(p => p.id === activeStylePreset)?.color,
              borderColor: `${STYLE_PRESETS.find(p => p.id === activeStylePreset)?.color}30`,
            }}>
              {STYLE_PRESETS.find(p => p.id === activeStylePreset)?.emoji} {STYLE_PRESETS.find(p => p.id === activeStylePreset)?.label}
            </Badge>
            <button type="button" onClick={() => setActiveStylePreset(null)} className="ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Result area */}
        <div className="flex-1 flex items-center justify-center p-4 md:p-6">
          <AnimatePresence mode="wait">
            {/* --- Onboarding Card (no API keys configured) --- */}
            {!isImageGenerating && !latestResult && apiKeysHook.configuredCount === 0 && (
              <motion.div
                key="onboarding"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="glass-card onboarding-glow rounded-2xl border border-[#d9ff00]/20 p-6 max-w-lg mx-auto text-center space-y-4"
              >
                {/* Gradient icon */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d9ff00]/20 to-[#00d4ff]/10 mx-auto">
                  <Key className="h-8 w-8 text-[#d9ff00]" />
                </div>

                <h3 className="text-xl font-bold text-foreground">Welcome to AI Studio</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  To start generating images, you&apos;ll need to add an API key from at least one AI provider.
                  We support 16 providers including OpenAI, Stability AI, and more.
                </p>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="glass rounded-lg p-3 stat-card-hover">
                    <span className="text-2xl">🎨</span>
                    <p className="text-[10px] text-muted-foreground mt-1">100+ Models</p>
                  </div>
                  <div className="glass rounded-lg p-3 stat-card-hover">
                    <span className="text-2xl">⚡</span>
                    <p className="text-[10px] text-muted-foreground mt-1">Smart Presets</p>
                  </div>
                  <div className="glass rounded-lg p-3 stat-card-hover">
                    <span className="text-2xl">🔒</span>
                    <p className="text-[10px] text-muted-foreground mt-1">BYOK Security</p>
                  </div>
                </div>

                <Button onClick={() => setActiveTab('settings')} className="gap-2 bg-[#d9ff00] text-background font-semibold hover:bg-[#c5eb00]">
                  <Settings2 className="h-4 w-4" />
                  Add API Key
                </Button>
              </motion.div>
            )}

            {/* --- Empty State --- */}
            {!isImageGenerating && !latestResult && apiKeysHook.configuredCount > 0 && (
              <motion.div
                key="empty"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-8 text-center w-full max-w-2xl relative"
              >
                {/* Animated gradient background */}
                <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-br from-[#d9ff00]/5 via-transparent to-[#d9ff00]/3 animate-empty-gradient pointer-events-none" />
                <div className="absolute inset-0 -m-8 rounded-3xl bg-gradient-to-tl from-transparent via-[#d9ff00]/2 to-[#d9ff00]/4 animate-empty-gradient pointer-events-none" style={{ animationDelay: '4s' }} />

                {/* Floating icon with pulsing glow */}
                <div className="relative z-10">
                  <div className="absolute -inset-6 rounded-full bg-[#d9ff00]/5 blur-3xl animate-empty-glow" />
                  <motion.div
                    animate={{ y: [0, -12, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    className="relative flex h-32 w-32 items-center justify-center rounded-3xl border border-[#d9ff00]/20 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-sm shadow-[0_0_40px_rgba(217,255,0,0.08)]"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Sparkles className="h-14 w-14 text-[#d9ff00]/70" />
                    </motion.div>
                  </motion.div>
                </div>

                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-foreground tracking-tight">
                    Generate your first image
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md leading-relaxed">
                    Choose a provider and model, write a prompt, and click Generate to create stunning AI images.
                  </p>
                </div>

                {/* Feature hint cards */}
                <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">🎨</span>
                      <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Smart Presets</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Customize style, lighting, mood with one click</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">📚</span>
                      <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">Prompt Library</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Save, organize, and reuse your best prompts</p>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-white/5 border border-white/10 rounded-xl p-4 text-left hover:border-[#d9ff00]/20 hover:bg-white/[0.07] transition-all group cursor-default"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">✨</span>
                      <span className="text-xs font-semibold text-foreground group-hover:text-[#d9ff00] transition-colors">AI Enhance</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 leading-relaxed">Auto-enhance prompts for stunning results</p>
                  </motion.div>
                </div>

                <div className="relative z-10 flex items-center justify-center gap-2 text-xs text-muted-foreground/50">
                  <Zap className="h-3.5 w-3.5 text-[#d9ff00]/50" />
                  <span>16 providers • 100+ models • Instant generation</span>
                </div>
              </motion.div>
            )}

            {/* --- Loading State --- */}
            {isImageGenerating && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-6 text-center w-full max-w-md"
              >
                <div className="relative flex h-32 w-32 items-center justify-center">
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-[#d9ff00]/20 animate-neon-pulse" />
                  <div className="absolute inset-3 rounded-full border-2 border-[#d9ff00]/40 animate-neon-pulse [animation-delay:0.5s]" />
                  <div className="absolute inset-6 rounded-full border-2 border-[#d9ff00]/60 animate-neon-pulse [animation-delay:1s]" />
                  <Sparkles className="h-10 w-10 text-[#d9ff00] animate-neon-pulse" />
                </div>

                <div className="space-y-3 w-full">
                  <h3 className="text-lg font-semibold text-foreground">Generating your image…</h3>

                  {/* Rotating context-aware messages */}
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={genMsgIndex}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-muted-foreground"
                    >
                      {[
                        '🎨 Crafting your vision...',
                        '✨ Adding fine details...',
                        '🖌️ Refining composition...',
                        '🔍 Enhancing quality...',
                      ][genMsgIndex]}
                    </motion.p>
                  </AnimatePresence>

                  {/* Stylized progress bar */}
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                    <div className="absolute inset-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#d9ff00] to-transparent animate-gen-progress" />
                  </div>

                  {/* Elapsed time counter */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/50">
                    <Clock className="h-3 w-3" />
                    <span>{genElapsed}s elapsed</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* --- Result State --- */}
            {!isImageGenerating && latestResult && (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex flex-col items-center gap-4 w-full max-w-3xl"
              >
                {/* Image container */}
                <div
                  className="relative w-full overflow-hidden rounded-xl border border-border/40 bg-surface shadow-2xl group"
                  onMouseEnter={() => setInfoCardVisible(true)}
                  onMouseLeave={() => {
                    if (infoCardTimerRef.current) clearTimeout(infoCardTimerRef.current);
                    infoCardTimerRef.current = setTimeout(() => {
                      if (!infoDetailsOpen) setInfoCardVisible(false);
                    }, 2000);
                  }}
                >
                  <img
                    src={activeImageUrl}
                    alt={imagePrompt}
                    className="w-full h-auto max-h-[60vh] object-contain"
                  />

                  {/* Generation Info Card overlay */}
                  <AnimatePresence>
                    {infoCardVisible && selectedProviderData && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2 }}
                        className="absolute bottom-3 right-3 max-w-[280px] sm:max-w-[320px] rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 p-3 text-left animate-info-card"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedProviderData.color || '#888' }} />
                            <span className="text-[11px] font-semibold text-white/90 truncate">{selectedProviderData.displayName}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setInfoDetailsOpen(!infoDetailsOpen)}
                            className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-md hover:bg-white/10 transition-colors"
                          >
                            {infoDetailsOpen ? (
                              <ChevronDown className="h-3 w-3 text-white/60" />
                            ) : (
                              <ChevronUp className="h-3 w-3 text-white/60" />
                            )}
                          </button>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-white/40" />
                          <span className="text-[10px] text-white/50 truncate">
                            {imageModels.find((m) => m.modelId === selectedImageModel)?.name || selectedImageModel}
                          </span>
                          {generationDuration !== null && (
                            <span className="flex items-center gap-0.5 text-[10px] text-[#d9ff00]/70 ml-auto">
                              <Timer className="h-3 w-3" />
                              {generationDuration.toFixed(1)}s
                            </span>
                          )}
                        </div>

                        {/* Expandable details */}
                        <AnimatePresence>
                          {infoDetailsOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                                {imagePrompt && (
                                  <div>
                                    <span className="text-[9px] font-medium text-[#d9ff00]/70 uppercase tracking-wider">Prompt</span>
                                    <p className="text-[10px] text-white/60 leading-relaxed line-clamp-3">{imagePrompt}</p>
                                  </div>
                                )}
                                {imageNegativePrompt && (
                                  <div>
                                    <span className="text-[9px] font-medium text-red-400/70 uppercase tracking-wider">Negative</span>
                                    <p className="text-[10px] text-white/50 leading-relaxed line-clamp-2">{imageNegativePrompt}</p>
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                  {imageAspectRatio && imageAspectRatio !== '1:1' && (
                                    <span className="text-[9px] text-white/40">{imageAspectRatio}</span>
                                  )}
                                  {imageSteps > 0 && (
                                    <span className="text-[9px] text-white/40">{imageSteps} steps</span>
                                  )}
                                  {imageGuidance > 0 && (
                                    <span className="text-[9px] text-white/40">CFG {imageGuidance}</span>
                                  )}
                                  {imageSeed !== null && imageSeed > 0 && (
                                    <span className="text-[9px] text-white/40">Seed {imageSeed}</span>
                                  )}
                                  {imageBatchSize > 1 && (
                                    <span className="text-[9px] text-white/40">×{imageBatchSize}</span>
                                  )}
                                  {activeStylePreset && (
                                    <span className="text-[9px] text-[#d9ff00]/50">{STYLE_PRESETS.find(p => p.id === activeStylePreset)?.label}</span>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Batch thumbnail grid */}
                {generationResults.length > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full rounded-xl bg-gradient-to-br from-white/[0.03] via-transparent to-[#d9ff00]/[0.02] border border-white/5 p-3"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff00]/10">
                        <Grid3x3 className="h-3 w-3 text-[#d9ff00]" />
                      </div>
                      <span className="text-[11px] font-semibold text-foreground/80">
                        {generationResults.length} images generated
                      </span>
                      <span className="text-[10px] text-muted-foreground/50 ml-1">— click to select</span>
                    </div>
                    <div className={`grid gap-2 ${
                      generationResults.length <= 2
                        ? 'grid-cols-2'
                        : generationResults.length <= 4
                          ? 'grid-cols-2 sm:grid-cols-4'
                          : 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6'
                    }`}>
                      {generationResults.map((url, idx) => (
                        <motion.button
                          key={url + idx}
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05 * idx, duration: 0.2 }}
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSelectedResultIndex(idx)}
                          className={`relative aspect-square overflow-hidden rounded-lg transition-all ${
                            selectedResultIndex === idx
                              ? 'ring-2 ring-[#d9ff00] ring-offset-2 ring-offset-background animate-selected-glow'
                              : 'border border-border/40 hover:border-[#d9ff00]/40 hover:shadow-[0_0_8px_rgba(217,255,0,0.15)]'
                          }`}
                        >
                          <img
                            src={url}
                            alt={`Result ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {/* Index badge */}
                          <span className={`absolute top-1 left-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                            selectedResultIndex === idx
                              ? 'bg-[#d9ff00] text-background'
                              : 'bg-background/80 text-muted-foreground'
                          }`}>
                            {idx + 1}
                          </span>
                          {/* Selected checkmark badge */}
                          {selectedResultIndex === idx && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#d9ff00] text-background"
                            >
                              <Check className="h-3 w-3" />
                            </motion.div>
                          )}
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Post-Generation Action Bar */}
                <div className="w-full space-y-3">
                  {/* Primary actions row */}
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(activeImageUrl)}
                      className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSocialExportOpen(true)}
                      className="gap-1.5 border-[#d9ff00]/30 bg-[#d9ff00]/5 text-[#d9ff00] hover:bg-[#d9ff00]/10 hover:border-[#d9ff00]/50"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (currentJobId) handleFavorite(currentJobId);
                        else toast.info('Added to favorites');
                      }}
                      className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                    >
                      <Heart className="h-3.5 w-3.5" />
                      Favorite
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Regenerate
                    </Button>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const promptToCopy = imagePrompt || lastGeneratedPrompt;
                            if (promptToCopy) {
                              navigator.clipboard.writeText(promptToCopy);
                              toast.success('Prompt copied to clipboard!');
                            } else {
                              toast.info('No prompt to copy');
                            }
                          }}
                          className="gap-1.5 border-border/60 bg-surface hover:bg-surface-hover"
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy Prompt
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">Copy the enhanced prompt used for generation</TooltipContent>
                    </Tooltip>
                  </div>

                  {/* Continue Customizing section */}
                  <div className="glass-strong rounded-xl border border-[#d9ff00]/20 p-3 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#d9ff00]/10">
                        <Wand2 className="h-3 w-3 text-[#d9ff00]" />
                      </div>
                      <span className="text-xs font-semibold text-[#d9ff00] uppercase tracking-wider">Continue Customizing</span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {/* Upscale */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isPostGenProcessing}
                            onClick={() => handlePostGenAction('upscale')}
                            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                          >
                            <Maximize2 className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Upscale</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Increase resolution 2x or 4x</TooltipContent>
                      </Tooltip>

                      {/* Variations */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isPostGenProcessing}
                            onClick={() => handlePostGenAction('variation')}
                            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                          >
                            <Layers className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Variations</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Create variations of this image</TooltipContent>
                      </Tooltip>

                      {/* Improve / Enhance */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isPostGenProcessing}
                            onClick={() => handlePostGenAction('improve')}
                            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                          >
                            <Sparkles className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Improve</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Enhance quality and details</TooltipContent>
                      </Tooltip>

                      {/* Image to Video */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isPostGenProcessing || !['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)}
                            onClick={() => handlePostGenAction('img2vid')}
                            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                          >
                            <Film className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">To Video</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {['runway', 'luma', 'fal', 'replicate', 'seedance'].includes(selectedImageProvider)
                            ? 'Animate this image into a video'
                            : 'Switch to a video-capable provider (Runway, Luma, Fal, Replicate) to use this'}
                        </TooltipContent>
                      </Tooltip>

                      {/* Inpaint / Edit */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isPostGenProcessing}
                            onClick={() => { setEditorImage(activeImageUrl); setShowEditor(true); }}
                            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group disabled:opacity-40"
                          >
                            <Paintbrush className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Inpaint</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Paint a mask and edit specific areas</TooltipContent>
                      </Tooltip>

                      {/* Use as Reference */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setInputImageUrl(activeImageUrl); saveReferenceImage(activeImageUrl).catch(() => {}); }}
                            className="flex flex-col items-center gap-1 rounded-lg border border-border/40 bg-surface px-2 py-2 text-center transition-all hover:border-[#d9ff00]/40 hover:bg-[#d9ff00]/5 group"
                          >
                            <ImagePlus className="h-4 w-4 text-muted-foreground group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-muted-foreground group-hover:text-[#d9ff00] transition-colors">Reference</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Use as reference for next generation</TooltipContent>
                      </Tooltip>

                      {/* Style Transfer */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setStyleTransferOpen(true)}
                            className="flex flex-col items-center gap-1 rounded-lg border border-[#d9ff00]/30 bg-[#d9ff00]/5 px-2 py-2 text-center transition-all hover:border-[#d9ff00]/60 hover:bg-[#d9ff00]/10 group"
                          >
                            <PaletteIcon className="h-4 w-4 text-[#d9ff00]/70 group-hover:text-[#d9ff00] transition-colors" />
                            <span className="text-[9px] font-medium text-[#d9ff00]/70 group-hover:text-[#d9ff00] transition-colors">Style</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Apply an artistic style and regenerate</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Processing indicator */}
                    <AnimatePresence>
                      {isPostGenProcessing && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex items-center gap-2 rounded-lg bg-[#d9ff00]/5 border border-[#d9ff00]/20 px-3 py-2"
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d9ff00]" />
                          <span className="text-[11px] text-[#d9ff00] font-medium">
                            {postGenAction === 'upscale' && 'Upscaling image…'}
                            {postGenAction === 'variation' && 'Creating variation…'}
                            {postGenAction === 'improve' && 'Enhancing image…'}
                            {postGenAction === 'img2vid' && 'Converting to video…'}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Prompt echo */}
                <p className="text-xs text-muted-foreground/60 max-w-lg text-center line-clamp-2">
                  &ldquo;{imagePrompt}&rdquo;
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Recent Generations Quick-Access Bar */}
        <RecentGenerations accentColor="#d9ff00" />
      </main>

      {/* Image Editor Overlay */}
      {showEditor && editorImage && selectedImageProvider && (
        <ImageEditor
          imageUrl={editorImage}
          onClose={() => { setShowEditor(false); setEditorImage(null); }}
          providerId={selectedImageProvider}
          onResult={(url) => {
            setLatestResult(url);
            setShowEditor(false);
            setEditorImage(null);
          }}
        />
      )}

      {/* Model Compare Dialog */}
      <ModelCompare
        defaultPrompt={imagePrompt}
        defaultNegativePrompt={imageNegativePrompt}
        defaultProviderId={selectedImageProvider}
        defaultModelId={selectedImageModel}
        onUseResult={(url) => {
          setLatestResult(url);
          toast.success('Compare result loaded');
        }}
      />

      {/* Style Transfer Panel */}
      <StyleTransferPanel />

      {/* Social Export Modal */}
      <SocialExportModal
        open={socialExportOpen}
        onOpenChange={setSocialExportOpen}
        imageUrl={activeImageUrl}
        imageName={imagePrompt.slice(0, 30) || 'generated-image'}
      />
    </div>
  );
}
