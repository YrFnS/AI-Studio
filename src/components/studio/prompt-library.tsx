'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Search, Star, Trash2, X, ChevronDown,
  BookmarkCheck, ArrowRight, Clock, Tag, Cpu,
  Plus, Check, AlertTriangle, Sparkles, LayoutGrid,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import * as data from '@/lib/data';
import type { SavedPrompt, PromptTemplate } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { id: 'all', label: 'All', color: '#d9ff00' },
  { id: 'portrait', label: '🧑 Portrait', color: '#f472b6' },
  { id: 'landscape', label: '🏔️ Landscape', color: '#34d399' },
  { id: 'product', label: '📦 Product', color: '#fbbf24' },
  { id: 'fantasy', label: '🏰 Fantasy', color: '#a78bfa' },
  { id: 'photography', label: '📸 Photography', color: '#38bdf8' },
  { id: 'illustration', label: '🎨 Illustration', color: '#c084fc' },
  { id: 'marketing', label: '📢 Marketing', color: '#f59e0b' },
  { id: 'ui-design', label: '🖥️ UI Design', color: '#06b6d4' },
  { id: '3d', label: '🧊 3D Art', color: '#10b981' },
  { id: 'cinematic', label: '🎬 Cinematic', color: '#ef4444' },
  { id: 'nature', label: '🌿 Nature', color: '#22c55e' },
  { id: 'architecture', label: '🏛️ Architecture', color: '#60a5fa' },
  { id: 'abstract', label: '🌀 Abstract', color: '#fb923c' },
  { id: 'character', label: '🦸 Character', color: '#e879f9' },
  { id: 'fashion', label: '👗 Fashion', color: '#f43f5e' },
  { id: 'food', label: '🍽️ Food', color: '#fb7185' },
  { id: 'other', label: 'Other', color: '#94a3b8' },
] as const;

const SORT_OPTIONS = [
  { id: 'recent', label: 'Recent' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'az', label: 'A-Z' },
  { id: 'used', label: 'Most Used' },
] as const;

// ---------------------------------------------------------------------------
// Template data — 160 curated templates across 16 categories
// ---------------------------------------------------------------------------

const TEMPLATES: PromptTemplate[] = [
  // ─── Portrait (10) ───
  { id: 't-portrait-1', title: 'Professional Headshot', prompt: 'Professional headshot of {subject}, {lighting} lighting, sharp focus, shallow depth of field, high-end portrait photography', category: 'portrait', emoji: '👔' },
  { id: 't-portrait-2', title: 'Artistic Portrait', prompt: 'Artistic portrait of {subject}, {style} style, dramatic lighting, expressive, fine art photography', category: 'portrait', emoji: '🎨' },
  { id: 't-portrait-3', title: 'Fashion Portrait', prompt: 'Fashion editorial portrait of {subject}, wearing {outfit}, studio lighting, high fashion photography, Vogue style', category: 'portrait', emoji: '📸' },
  { id: 't-portrait-4', title: 'Candid Portrait', prompt: 'Candid portrait of {subject}, natural moment, soft natural lighting, authentic expression, lifestyle photography', category: 'portrait', emoji: '😊' },
  { id: 't-portrait-5', title: 'Fantasy Portrait', prompt: 'Fantasy portrait of {subject}, {accessories}, ethereal glow, magical atmosphere, detailed face, portrait painting', category: 'portrait', emoji: '✨' },
  { id: 't-portrait-6', title: 'Corporate Headshot', prompt: 'Corporate headshot of {subject}, confident expression, neutral {background}, professional attire, soft Rembrandt lighting, business portrait', category: 'portrait', emoji: '💼' },
  { id: 't-portrait-7', title: 'Ethereal Portrait', prompt: 'Ethereal portrait of {subject}, soft backlit glow, {color} haze, dreamlike atmosphere, delicate features, fine art photography', category: 'portrait', emoji: '🌙' },
  { id: 't-portrait-8', title: 'Street Portrait', prompt: 'Street portrait of {subject}, urban {location} backdrop, natural light, environmental context, documentary portrait style', category: 'portrait', emoji: '🏙️' },
  { id: 't-portrait-9', title: 'Vintage Portrait', prompt: 'Vintage portrait of {subject}, {decade} style, sepia-toned, film grain, classic lighting, retro photography', category: 'portrait', emoji: '📷' },
  { id: 't-portrait-10', title: 'Black & White Portrait', prompt: 'Black and white portrait of {subject}, high contrast, dramatic shadows, {mood} mood, monochrome fine art photography', category: 'portrait', emoji: '🖤' },

  // ─── Landscape (10) ───
  { id: 't-landscape-1', title: 'Epic Landscape', prompt: 'Breathtaking {landscape_type} landscape, golden hour light, dramatic sky, ultra-wide shot, National Geographic quality', category: 'landscape', emoji: '🏔️' },
  { id: 't-landscape-2', title: 'Moody Landscape', prompt: 'Moody {landscape_type} scene, fog and mist, desaturated tones, atmospheric, fine art landscape', category: 'landscape', emoji: '🌫️' },
  { id: 't-landscape-3', title: 'Urban Landscape', prompt: 'Urban cityscape of {city}, twilight, city lights reflecting, long exposure, architectural photography', category: 'landscape', emoji: '🌃' },
  { id: 't-landscape-4', title: 'Seascape', prompt: 'Dramatic seascape, crashing waves, {time_of_day} light, long exposure water, coastal photography', category: 'landscape', emoji: '🌊' },
  { id: 't-landscape-5', title: 'Mountain Vista', prompt: 'Majestic mountain vista, alpine {season}, dramatic clouds, panoramic, adventure photography', category: 'landscape', emoji: '⛰️' },
  { id: 't-landscape-6', title: 'Aurora Borealis', prompt: 'Spectacular aurora borealis over {landscape}, vibrant green and {color} lights dancing across the night sky, long exposure, astrophotography', category: 'landscape', emoji: '🌌' },
  { id: 't-landscape-7', title: 'Desert Sunset', prompt: 'Vast {desert_type} desert at sunset, warm orange and magenta sky, silhouette of dunes, sweeping panorama, landscape photography', category: 'landscape', emoji: '🏜️' },
  { id: 't-landscape-8', title: 'Rainforest Canopy', prompt: 'Lush rainforest canopy from above, mist drifting through {tree_type} trees, dappled sunlight, aerial photography', category: 'landscape', emoji: '🌴' },
  { id: 't-landscape-9', title: 'Cherry Blossom Garden', prompt: 'Serene cherry blossom garden in {season}, pink petals falling, traditional {structure} in background, soft light, Japanese garden photography', category: 'landscape', emoji: '🌸' },
  { id: 't-landscape-10', title: 'Night Sky Panorama', prompt: 'Milky Way panorama over {landscape_feature}, star-filled sky, no light pollution, astrophotography, 360-degree view', category: 'landscape', emoji: '🌠' },

  // ─── Product (10) ───
  { id: 't-product-1', title: 'Product Hero', prompt: 'Premium product photography of {product}, clean white background, studio lighting, commercial quality, high detail', category: 'product', emoji: '📦' },
  { id: 't-product-2', title: 'Lifestyle Product', prompt: '{product} in lifestyle setting, natural environment, soft lighting, aspirational, commercial photography', category: 'product', emoji: '🏠' },
  { id: 't-product-3', title: 'Food Photography', prompt: 'Professional food photography of {dish}, styled plating, {lighting}, shallow depth of field, editorial quality', category: 'product', emoji: '🍽️' },
  { id: 't-product-4', title: 'Minimal Product Shot', prompt: 'Minimalist product shot of {product}, clean gradient {color} background, single soft light source, ultra sharp, e-commerce photography', category: 'product', emoji: '⬜' },
  { id: 't-product-5', title: 'Floating Product', prompt: '{product} floating in mid-air, dramatic shadows below, dark background, studio lighting, levitation product photography', category: 'product', emoji: '🎈' },
  { id: 't-product-6', title: 'Luxury Unboxing', prompt: 'Luxury unboxing scene, {product} partially revealed from {material} box, ribbon, tissue paper, warm ambient light, premium feel', category: 'product', emoji: '🎁' },
  { id: 't-product-7', title: 'Product on Water', prompt: '{product} resting on crystal-clear water surface, gentle ripples, reflections, dark water background, commercial photography', category: 'product', emoji: '💧' },
  { id: 't-product-8', title: 'Cosmetic Beauty Shot', prompt: 'Cosmetic beauty shot of {product}, soft diffused lighting, {color} accent, luxurious texture detail, beauty editorial style', category: 'product', emoji: '💄' },
  { id: 't-product-9', title: 'Tech Product Flatlay', prompt: 'Tech product flatlay, {product} surrounded by complementary accessories, top-down view, clean desk surface, modern lifestyle', category: 'product', emoji: '💻' },
  { id: 't-product-10', title: 'Jewelry Macro', prompt: 'Macro jewelry photography of {jewelry_type}, sparkling facets, dark velvet {color} background, precise focus, luxury commercial shot', category: 'product', emoji: '💎' },

  // ─── Fantasy (10) ───
  { id: 't-fantasy-1', title: 'Fantasy World', prompt: 'Epic fantasy world, {setting}, magical atmosphere, volumetric lighting, concept art, detailed matte painting', category: 'fantasy', emoji: '🏰' },
  { id: 't-fantasy-2', title: 'Creature Design', prompt: 'Fantasy creature design, {creature_type}, detailed anatomy, dramatic pose, concept art illustration', category: 'fantasy', emoji: '🐉' },
  { id: 't-fantasy-3', title: 'Magical Scene', prompt: 'Enchanted {location}, magical glow, floating particles, mystical atmosphere, fantasy illustration', category: 'fantasy', emoji: '🔮' },
  { id: 't-fantasy-4', title: "Dragon's Lair", prompt: "Ancient dragon's lair deep within {terrain}, hoard of treasure, glowing embers, massive dragon silhouette, epic fantasy art", category: 'fantasy', emoji: '🐉' },
  { id: 't-fantasy-5', title: 'Enchanted Forest', prompt: 'Enchanted {forest_type} forest, bioluminescent plants, fairy lights, misty paths, magical creatures, fantasy illustration', category: 'fantasy', emoji: '🌳' },
  { id: 't-fantasy-6', title: 'Floating Islands', prompt: 'Floating islands in the sky, {vegetation} cascading over edges, waterfalls into clouds, bridges connecting landmasses, fantasy concept art', category: 'fantasy', emoji: '🏝️' },
  { id: 't-fantasy-7', title: 'Crystal Cave', prompt: 'Massive crystal cave, towering {color} crystals, glowing from within, underground lake reflection, fantasy environment art', category: 'fantasy', emoji: '💎' },
  { id: 't-fantasy-8', title: 'Ancient Ruins', prompt: 'Ancient {civilization} ruins overgrown with {plant_life}, crumbling stone pillars, shafts of light, mysterious atmosphere, fantasy art', category: 'fantasy', emoji: '🏚️' },
  { id: 't-fantasy-9', title: 'Sky Castle', prompt: 'Majestic sky castle above the clouds, {architectural_style} design, floating platforms, sunset backdrop, epic fantasy illustration', category: 'fantasy', emoji: '🏯' },
  { id: 't-fantasy-10', title: "Wizard's Workshop", prompt: "Wizard's workshop interior, shelves of potion bottles, {magical_item} on desk, candlelight, dusty tomes, detailed fantasy illustration", category: 'fantasy', emoji: '🧙' },

  // ─── Photography (10) ───
  { id: 't-photo-1', title: 'Long Exposure', prompt: 'Long exposure photograph of {subject}, smooth motion blur, {light_source} trails, steady elements sharp, fine art photography', category: 'photography', emoji: '⏱️' },
  { id: 't-photo-2', title: 'Tilt-Shift Miniature', prompt: 'Tilt-shift miniature effect photography of {location}, selective focus creating toy-like appearance, vibrant colors, architectural details', category: 'photography', emoji: '🔬' },
  { id: 't-photo-3', title: 'Infrared Photography', prompt: 'Infrared photography of {landscape}, white foliage, surreal {color} tones, otherworldly atmosphere, experimental photography', category: 'photography', emoji: '🔴' },
  { id: 't-photo-4', title: 'Double Exposure', prompt: 'Double exposure photograph combining {subject_1} and {subject_2}, blended silhouettes, ethereal overlay, artistic photography', category: 'photography', emoji: '🎞️' },
  { id: 't-photo-5', title: 'Bokeh Portrait', prompt: 'Bokeh portrait of {subject}, {color} circular bokeh lights in background, shallow depth of field, dreamy atmosphere, lens blur', category: 'photography', emoji: '✨' },
  { id: 't-photo-6', title: 'High-Speed Freeze', prompt: 'High-speed freeze-frame photograph of {action}, water droplets suspended, ultra-fast shutter, dramatic moment captured, macro detail', category: 'photography', emoji: '⚡' },
  { id: 't-photo-7', title: 'Infrared Landscape', prompt: 'Infrared landscape photography, {terrain} with white vegetation, pink and {color} sky, surreal dreamlike quality, full spectrum', category: 'photography', emoji: '🌈' },
  { id: 't-photo-8', title: 'Film Noir', prompt: 'Film noir style photograph of {scene}, high contrast black and white, dramatic shadows, venetian blind light, mystery atmosphere', category: 'photography', emoji: '🎬' },
  { id: 't-photo-9', title: 'Tonal Portrait', prompt: 'Split-toned portrait of {subject}, {shadow_color} shadows, {highlight_color} highlights, subtle color grading, fine art photography', category: 'photography', emoji: '🎭' },
  { id: 't-photo-10', title: 'Composite Photography', prompt: 'Composite photograph blending {element_1} with {element_2}, seamless integration, surreal yet photorealistic, editorial photography', category: 'photography', emoji: '🧩' },

  // ─── Illustration (10) ───
  { id: 't-illust-1', title: 'Watercolor Painting', prompt: 'Watercolor painting of {subject}, soft washes, {color_palette} tones, visible brush strokes, wet-on-wet technique, fine art illustration', category: 'illustration', emoji: '🖌️' },
  { id: 't-illust-2', title: 'Ink Drawing', prompt: 'Detailed ink drawing of {subject}, cross-hatching, fine linework, {style} influence, black ink on cream paper, traditional illustration', category: 'illustration', emoji: '🖊️' },
  { id: 't-illust-3', title: 'Vector Art', prompt: 'Clean vector art illustration of {subject}, bold shapes, {color_scheme} palette, flat design, geometric precision, scalable graphic', category: 'illustration', emoji: '📐' },
  { id: 't-illust-4', title: 'Pop Art', prompt: 'Pop art illustration of {subject}, bold {color} and contrasting colors, halftone dots, comic book style, Warhol inspired', category: 'illustration', emoji: '💥' },
  { id: 't-illust-5', title: 'Minimalist Illustration', prompt: 'Minimalist illustration of {subject}, clean lines, limited {color_count} color palette, negative space, modern design, simple elegance', category: 'illustration', emoji: '◻️' },
  { id: 't-illust-6', title: 'Vintage Poster', prompt: 'Vintage {era} poster illustration of {subject}, retro typography, aged paper texture, {color} accent, Art Deco or Art Nouveau style', category: 'illustration', emoji: '📯' },
  { id: 't-illust-7', title: "Children's Book", prompt: "Children's book illustration of {scene}, whimsical characters, soft {color} palette, playful composition, storybook art style", category: 'illustration', emoji: '📖' },
  { id: 't-illust-8', title: 'Comic Book Panel', prompt: 'Comic book panel featuring {character}, action pose, speech bubbles, {style} inking style, dynamic composition, graphic novel art', category: 'illustration', emoji: '💬' },
  { id: 't-illust-9', title: 'Botanical Illustration', prompt: 'Detailed botanical illustration of {plant}, scientific accuracy, {color} watercolor accents, labeled parts, vintage naturalist style', category: 'illustration', emoji: '🌿' },
  { id: 't-illust-10', title: 'Map Illustration', prompt: 'Illustrated map of {location}, hand-drawn style, landmarks, {feature} highlights, decorative border, cartographic art', category: 'illustration', emoji: '🗺️' },

  // ─── Marketing (10) ───
  { id: 't-market-1', title: 'Social Media Post', prompt: 'Eye-catching social media post design for {brand}, {product} featured, modern layout, {color} accent, Instagram-ready, clean typography', category: 'marketing', emoji: '📱' },
  { id: 't-market-2', title: 'Email Banner', prompt: 'Professional email banner for {campaign}, {offer} headline, clean layout, brand colors, {style} design, responsive width', category: 'marketing', emoji: '✉️' },
  { id: 't-market-3', title: 'Ad Creative', prompt: 'High-converting ad creative for {product}, bold {headline} text, striking visual, {platform} optimized, attention-grabbing, CTA button', category: 'marketing', emoji: '📢' },
  { id: 't-market-4', title: 'Brand Story', prompt: 'Visual brand story for {brand}, showcasing {value}, lifestyle imagery, cohesive {color} palette, narrative flow, marketing campaign', category: 'marketing', emoji: '📕' },
  { id: 't-market-5', title: 'Infographic', prompt: 'Clean infographic about {topic}, data visualization, {statistic} highlight, icon set, {color_scheme} palette, easy-to-read layout', category: 'marketing', emoji: '📊' },
  { id: 't-market-6', title: 'Logo Concept', prompt: 'Logo concept design for {brand}, {industry} industry, minimalist {style}, {color} accent, scalable, modern branding, vector quality', category: 'marketing', emoji: '🎯' },
  { id: 't-market-7', title: 'Business Card', prompt: 'Elegant business card design for {profession}, {name} placeholder, {color} accent, modern typography, clean layout, double-sided', category: 'marketing', emoji: '💳' },
  { id: 't-market-8', title: 'Flyer Design', prompt: 'Event flyer for {event}, {date} headline, dynamic layout, {color} theme, eye-catching graphics, promotional design', category: 'marketing', emoji: '📃' },
  { id: 't-market-9', title: 'Presentation Slide', prompt: 'Professional presentation slide about {topic}, {key_point} highlight, clean data visualization, corporate {color} theme, modern layout', category: 'marketing', emoji: '🖥️' },
  { id: 't-market-10', title: 'App Screenshot', prompt: 'Polished app store screenshot for {app_type}, device mockup, feature callouts, {color} gradient background, marketing copy, conversion-optimized', category: 'marketing', emoji: '📲' },

  // ─── UI Design (10) ───
  { id: 't-ui-1', title: 'Landing Page', prompt: 'Modern landing page design for {product}, hero section with {headline}, clean navigation, {color} CTA buttons, responsive layout, web design mockup', category: 'ui-design', emoji: '🌐' },
  { id: 't-ui-2', title: 'Dashboard', prompt: 'Analytics dashboard UI design, {metric} widgets, data charts, sidebar navigation, {color} accent, dark mode, SaaS interface', category: 'ui-design', emoji: '📊' },
  { id: 't-ui-3', title: 'Mobile App', prompt: 'Mobile app UI design for {app_type}, onboarding screens, {feature} showcase, {color} theme, iOS/Android style, Figma quality mockup', category: 'ui-design', emoji: '📱' },
  { id: 't-ui-4', title: 'E-commerce Product Page', prompt: 'E-commerce product page UI, {product} display, image gallery, pricing, add-to-cart button, {color} accent, shopping experience design', category: 'ui-design', emoji: '🛒' },
  { id: 't-ui-5', title: 'SaaS Interface', prompt: 'SaaS application interface for {tool_type}, workspace layout, toolbar, {feature} panel, {color} theme, professional software design', category: 'ui-design', emoji: '⚙️' },
  { id: 't-ui-6', title: 'Settings Panel', prompt: 'Clean settings panel UI, {category} sections, toggle switches, dropdown menus, {color} accents, organized form layout, preference design', category: 'ui-design', emoji: '🔧' },
  { id: 't-ui-7', title: 'Chat Interface', prompt: 'Chat application UI design, message bubbles, {feature} sidebar, typing indicator, {color} theme, real-time messaging interface mockup', category: 'ui-design', emoji: '💬' },
  { id: 't-ui-8', title: 'Portfolio Website', prompt: 'Creative portfolio website design for {profession}, project grid, about section, {style} aesthetic, {color} highlights, modern web design', category: 'ui-design', emoji: '🧑‍💻' },
  { id: 't-ui-9', title: 'Blog Layout', prompt: 'Blog website layout design, {topic} featured articles, reading mode, sidebar widgets, {color} theme, editorial web design, typography-focused', category: 'ui-design', emoji: '📝' },
  { id: 't-ui-10', title: 'NFT Marketplace', prompt: 'NFT marketplace UI design, {collection} gallery, bid interface, wallet connect, {color} neon accents, dark theme, Web3 design', category: 'ui-design', emoji: '🖼️' },

  // ─── 3D Art (10) ───
  { id: 't-3d-1', title: 'Isometric Room', prompt: 'Isometric 3D room design, {room_type}, miniature furniture, soft lighting, {color} palette, low-poly aesthetic, cozy atmosphere', category: '3d', emoji: '🏠' },
  { id: 't-3d-2', title: 'Low Poly World', prompt: 'Low poly 3D world, {landscape_type}, faceted geometry, pastel {color} palette, stylized rendering, isometric perspective, game art', category: '3d', emoji: '🌍' },
  { id: 't-3d-3', title: 'Clay Render', prompt: 'Clay render 3D illustration of {subject}, matte {color} material, soft studio lighting, smooth surfaces, minimal environment, product visualization', category: '3d', emoji: '🏺' },
  { id: 't-3d-4', title: 'Wireframe Art', prompt: 'Wireframe 3D art of {subject}, visible mesh lines, {color} wireframe on dark background, technical aesthetic, generative design', category: '3d', emoji: '🔲' },
  { id: 't-3d-5', title: 'Crystal Formation', prompt: '3D crystal formation, {crystal_type} structure, refractive {color} material, volumetric light rays, subsurface scattering, photorealistic render', category: '3d', emoji: '💎' },
  { id: 't-3d-6', title: 'Abstract Geometry', prompt: 'Abstract 3D geometric composition, {shape_type} forms, metallic {color} materials, dramatic lighting, floating in space, modern art render', category: '3d', emoji: '🔷' },
  { id: 't-3d-7', title: 'Product Configurator', prompt: '3D product configurator scene, {product} with {material_option} options, rotating turntable, studio HDRI lighting, photorealistic rendering', category: '3d', emoji: '🔄' },
  { id: 't-3d-8', title: 'Architectural Viz', prompt: 'Architectural visualization of {building_type}, photorealistic materials, landscaped surroundings, {time_of_day} lighting, interior-exterior render', category: '3d', emoji: '🏗️' },
  { id: 't-3d-9', title: 'Character Model', prompt: '3D character model of {character_type}, PBR materials, {style} aesthetic, neutral pose, studio lighting, game-ready mesh quality', category: '3d', emoji: '🧍' },
  { id: 't-3d-10', title: 'Sci-Fi Environment', prompt: 'Sci-fi 3D environment, {location_type}, holographic displays, {color} neon lights, volumetric fog, futuristic architecture, Unreal Engine quality', category: '3d', emoji: '🚀' },

  // ─── Cinematic (10) ───
  { id: 't-cine-1', title: 'Movie Poster', prompt: 'Cinematic movie poster for {genre} film, {title_text}, dramatic composition, {color} color grading, Hollywood quality, key art design', category: 'cinematic', emoji: '🎬' },
  { id: 't-cine-2', title: 'Film Still', prompt: 'Cinematic film still, {scene} scene, anamorphic lens flare, {color} color grading, shallow depth of field, 35mm film quality', category: 'cinematic', emoji: '🎥' },
  { id: 't-cine-3', title: 'Action Sequence', prompt: 'Cinematic action sequence, {action_scene}, motion blur, dynamic camera angle, {color} teal-orange grading, explosive moment, thriller style', category: 'cinematic', emoji: '💥' },
  { id: 't-cine-4', title: 'Dramatic Dialogue', prompt: 'Cinematic dramatic dialogue scene, {character_1} and {character_2}, intimate close-up, Rembrandt lighting, {mood} atmosphere, film still', category: 'cinematic', emoji: '🎭' },
  { id: 't-cine-5', title: 'Chase Scene', prompt: 'Cinematic chase scene through {location}, motion blur, Dutch angle, {vehicle} pursuit, high-octane, thriller color grading, action film', category: 'cinematic', emoji: '🏎️' },
  { id: 't-cine-6', title: 'Horror Scene', prompt: 'Cinematic horror scene in {setting}, low-key lighting, {scare_element} reveal, cold blue-green color grade, tension, atmospheric film still', category: 'cinematic', emoji: '👻' },
  { id: 't-cine-7', title: 'Romantic Moment', prompt: 'Cinematic romantic moment, {couple} in {location}, golden hour backlight, lens flare, warm {color} grading, love story film still', category: 'cinematic', emoji: '❤️' },
  { id: 't-cine-8', title: 'Sci-Fi Bridge', prompt: 'Cinematic sci-fi starship bridge, {officer} at command, holographic displays, {color} ambient lighting, space opera film still', category: 'cinematic', emoji: '🚀' },
  { id: 't-cine-9', title: 'War Epic', prompt: 'Cinematic war epic scene, {battle}, sweeping wide shot, smoke and fire, desaturated {color} grade, Saving Private Ryan style, film still', category: 'cinematic', emoji: '⚔️' },
  { id: 't-cine-10', title: 'Western Saloon', prompt: 'Cinematic western saloon interior, {character} at bar, warm amber light, dust particles, {color} desaturated grade, frontier film still', category: 'cinematic', emoji: '🤠' },

  // ─── Nature (10) ───
  { id: 't-nature-1', title: 'Macro Insect', prompt: 'Macro photography of {insect}, extreme close-up, {feature} detail visible, shallow depth of field, natural lighting, wildlife photography', category: 'nature', emoji: '🦋' },
  { id: 't-nature-2', title: 'Bird in Flight', prompt: 'Bird in flight photography, {bird_species} with wings spread, {background} backdrop, fast shutter speed, wildlife action shot', category: 'nature', emoji: '🦅' },
  { id: 't-nature-3', title: 'Underwater Coral', prompt: 'Underwater coral reef photography, {coral_type} formations, tropical fish, {color} marine life, crystal-clear water, scuba photography', category: 'nature', emoji: '🐠' },
  { id: 't-nature-4', title: 'Flower Bloom', prompt: 'Flower bloom close-up, {flower_type} petals unfolding, morning dew drops, soft {color} bokeh background, botanical photography', category: 'nature', emoji: '🌺' },
  { id: 't-nature-5', title: 'Tree Rings', prompt: 'Macro photograph of tree rings cross-section, {wood_type} grain patterns, natural colors, textured detail, nature abstract photography', category: 'nature', emoji: '🌳' },
  { id: 't-nature-6', title: 'Cloud Formation', prompt: 'Dramatic cloud formation, {cloud_type} clouds, {time_of_day} light rays, vast sky, meteorological photography, atmospheric landscape', category: 'nature', emoji: '☁️' },
  { id: 't-nature-7', title: 'Mountain Stream', prompt: 'Mountain stream flowing through {terrain}, silky long exposure water, mossy rocks, dappled {lighting}, nature photography', category: 'nature', emoji: '🏞️' },
  { id: 't-nature-8', title: 'Autumn Leaves', prompt: 'Autumn leaves falling, {tree_type} foliage in {color} shades, forest floor carpet, soft light, seasonal nature photography', category: 'nature', emoji: '🍂' },
  { id: 't-nature-9', title: 'Ocean Wave', prompt: 'Powerful ocean wave crashing, {angle} perspective, water spray frozen, {color} water tones, seascape action photography', category: 'nature', emoji: '🌊' },
  { id: 't-nature-10', title: 'Desert Bloom', prompt: 'Desert bloom after rain, {flower_type} wildflowers in sandy landscape, rare desert color, soft morning light, botanical photography', category: 'nature', emoji: '🌵' },

  // ─── Architecture (10) ───
  { id: 't-arch-1', title: 'Modern Architecture', prompt: 'Modern architectural photography, {building_type}, clean lines, dramatic perspective, architectural digest quality', category: 'architecture', emoji: '🏛️' },
  { id: 't-arch-2', title: 'Interior Design', prompt: 'Luxury interior design, {room_type}, warm ambient lighting, curated details, architectural photography', category: 'architecture', emoji: '🛋️' },
  { id: 't-arch-3', title: 'Historical Building', prompt: 'Grand historical {building_type}, ornate details, {era} architecture, golden light, heritage photography', category: 'architecture', emoji: '🕌' },
  { id: 't-arch-4', title: 'Skyscraper', prompt: 'Soaring skyscraper against {sky_condition}, glass facade reflections, geometric patterns, looking up perspective, urban architecture photography', category: 'architecture', emoji: '🏙️' },
  { id: 't-arch-5', title: 'Interior Minimalist', prompt: 'Minimalist interior architecture, {space_type}, clean surfaces, negative space, natural light, Japanese-inspired, architectural photography', category: 'architecture', emoji: '⬜' },
  { id: 't-arch-6', title: 'Brutalist Architecture', prompt: 'Brutalist architecture, raw concrete {structure}, imposing forms, dramatic shadows, overcast sky, architectural photography', category: 'architecture', emoji: '🧱' },
  { id: 't-arch-7', title: 'Gothic Cathedral', prompt: 'Gothic cathedral interior, soaring {feature}, stained glass light beams, stone vaulting, sacred atmosphere, architectural photography', category: 'architecture', emoji: '⛪' },
  { id: 't-arch-8', title: 'Japanese Temple', prompt: 'Traditional Japanese {temple_type} temple, wooden structure, {season} surroundings, zen garden, cultural architecture photography', category: 'architecture', emoji: '⛩️' },
  { id: 't-arch-9', title: 'Green Building', prompt: 'Sustainable green architecture, {building_type} with living walls, solar panels, {vegetation} integration, eco-design photography', category: 'architecture', emoji: '🌱' },
  { id: 't-arch-10', title: 'Staircase Geometry', prompt: 'Architectural staircase geometry, spiraling {material} steps, rhythmic pattern, dramatic perspective, architectural abstract photography', category: 'architecture', emoji: '🌀' },

  // ─── Abstract (10) ───
  { id: 't-abstract-1', title: 'Abstract Art', prompt: 'Abstract {medium} art, {color_scheme}, flowing forms, expressive, contemporary art', category: 'abstract', emoji: '🌀' },
  { id: 't-abstract-2', title: 'Geometric Pattern', prompt: 'Geometric pattern art, {pattern_type}, precise lines, mathematical beauty, modern design', category: 'abstract', emoji: '🔷' },
  { id: 't-abstract-3', title: 'Fluid Art', prompt: 'Fluid art, {colors}, organic flowing shapes, marbled texture, alcohol ink style', category: 'abstract', emoji: '💧' },
  { id: 't-abstract-4', title: 'Fractal Art', prompt: 'Fractal art, {fractal_type} pattern, infinite self-similarity, {color} gradient, mathematical beauty, digital art, high resolution', category: 'abstract', emoji: '🔮' },
  { id: 't-abstract-5', title: 'Noise Texture', prompt: 'Abstract noise texture art, {noise_type} pattern, {color} tonal range, organic randomness, generative art, high detail', category: 'abstract', emoji: '📺' },
  { id: 't-abstract-6', title: 'Gradient Mesh', prompt: 'Smooth gradient mesh art, {color_1} to {color_2} transition, organic curves, vector-like precision, modern abstract design', category: 'abstract', emoji: '🌈' },
  { id: 't-abstract-7', title: 'Line Art', prompt: 'Continuous line art, {subject} rendered in single flowing line, minimalist, {color} on {background_color}, elegant simplicity', category: 'abstract', emoji: '〰️' },
  { id: 't-abstract-8', title: 'Dot Pattern', prompt: 'Halftone dot pattern art, {subject} formed by varying dot sizes, {color} on contrasting background, pop art influence, optical effect', category: 'abstract', emoji: '⚫' },
  { id: 't-abstract-9', title: 'Wave Form', prompt: 'Abstract wave form art, {wave_type} undulations, {color} gradient, rhythmic motion, sound visualization, digital art', category: 'abstract', emoji: '🌊' },
  { id: 't-abstract-10', title: 'Kaleidoscope', prompt: 'Kaleidoscope pattern, {element} repeated in radial symmetry, {color} vibrant palette, mesmerizing, mandala-like, digital art', category: 'abstract', emoji: '🔮' },

  // ─── Character (10) ───
  { id: 't-char-1', title: 'Character Design', prompt: 'Character design sheet, {character_type}, full body, multiple poses, concept art, clean lines', category: 'character', emoji: '🦸' },
  { id: 't-char-2', title: 'Hero Character', prompt: 'Hero character portrait, {hero_type}, dramatic pose, epic armor, fantasy art, detailed illustration', category: 'character', emoji: '⚔️' },
  { id: 't-char-3', title: 'Sci-Fi Character', prompt: 'Sci-fi character, {role}, futuristic outfit, holographic elements, cyberpunk style, detailed rendering', category: 'character', emoji: '🤖' },
  { id: 't-char-4', title: 'RPG Character', prompt: 'RPG character design, {class} class, {race} race, detailed equipment, character sheet pose, fantasy game art, inventory items', category: 'character', emoji: '🎲' },
  { id: 't-char-5', title: 'Superhero', prompt: 'Superhero character design, {power_type} abilities, dynamic flying pose, {color} costume, comic book style, powerful illustration', category: 'character', emoji: '🦸‍♂️' },
  { id: 't-char-6', title: 'Villain', prompt: 'Villain character design, {villain_type}, menacing pose, dark {color} attire, sinister expression, concept art, detailed rendering', category: 'character', emoji: '😈' },
  { id: 't-char-7', title: 'Fantasy Race', prompt: 'Fantasy race character, {race_type}, cultural attire, {environment} homeland, distinctive features, fantasy concept art, detailed illustration', category: 'character', emoji: '🧝' },
  { id: 't-char-8', title: 'Robot Character', prompt: 'Robot character design, {robot_type}, mechanical joints, {color} accent lights, personality expression, sci-fi concept art, detailed rendering', category: 'character', emoji: '🤖' },
  { id: 't-char-9', title: 'Alien Being', prompt: 'Alien being character design, {planet_origin}, non-humanoid features, {color} bioluminescence, extraterrestrial concept art, detailed illustration', category: 'character', emoji: '👽' },
  { id: 't-char-10', title: 'Monster Design', prompt: 'Monster character design, {monster_type}, terrifying anatomy, {environment} habitat, dark fantasy art, detailed creature concept', category: 'character', emoji: '👹' },

  // ─── Fashion (10) ───
  { id: 't-fashion-1', title: 'Fashion Editorial', prompt: 'High fashion editorial, {garment}, runway pose, dramatic lighting, Vogue quality photography', category: 'fashion', emoji: '👗' },
  { id: 't-fashion-2', title: 'Street Style', prompt: 'Street style fashion, {style}, urban backdrop, candid, editorial photography', category: 'fashion', emoji: '👟' },
  { id: 't-fashion-3', title: 'Avant-Garde', prompt: 'Avant-garde fashion, {concept}, artistic styling, studio lighting, fashion art photography', category: 'fashion', emoji: '🎭' },
  { id: 't-fashion-4', title: 'Runway Moment', prompt: 'High fashion runway moment, {designer} style collection, model striding, audience blur, dramatic stage lighting, fashion week photography', category: 'fashion', emoji: '👠' },
  { id: 't-fashion-5', title: 'Vintage Lookbook', prompt: 'Vintage fashion lookbook, {era} style clothing, retro setting, film grain, warm tones, editorial fashion photography', category: 'fashion', emoji: '📷' },
  { id: 't-fashion-6', title: 'Swimwear Editorial', prompt: 'Swimwear fashion editorial, {location} beach setting, golden hour light, {color} swimwear, Vogue quality, fashion photography', category: 'fashion', emoji: '👙' },
  { id: 't-fashion-7', title: 'Accessories Close-up', prompt: 'Fashion accessories close-up, {accessory_type}, luxurious materials, {color} accent, macro detail, editorial still life photography', category: 'fashion', emoji: '💍' },
  { id: 't-fashion-8', title: 'Hat Collection', prompt: 'Fashion hat collection showcase, {hat_style}, model profile, studio lighting, {color} background, millinery editorial photography', category: 'fashion', emoji: '🎩' },
  { id: 't-fashion-9', title: 'Sneaker Catalog', prompt: 'Sneaker catalog shot, {brand_style} sneaker, floating angle, {color} accent, clean background, product fashion photography', category: 'fashion', emoji: '👟' },
  { id: 't-fashion-10', title: 'Watch Macro', prompt: 'Luxury watch macro photography, {watch_type}, crystal reflection, {material} bracelet, shallow depth of field, high-end product shot', category: 'fashion', emoji: '⌚' },

  // ─── Food (10) ───
  { id: 't-food-1', title: 'Food Flatlay', prompt: 'Overhead food flatlay, {cuisine_type}, styled table setting, natural light, food styling photography', category: 'food', emoji: '🥘' },
  { id: 't-food-2', title: 'Action Food', prompt: 'Action food shot, {dish} being prepared, dynamic, steam, kitchen photography', category: 'food', emoji: '🔥' },
  { id: 't-food-3', title: 'Cooking Action', prompt: 'Dynamic cooking action shot, {ingredient} being {action}, flour dust, steam rising, kitchen energy, culinary photography', category: 'food', emoji: '👨‍🍳' },
  { id: 't-food-4', title: 'Ingredient Close-up', prompt: 'Ingredient close-up photography, {ingredient}, textured detail, {color} tones, macro lens, farm-to-table aesthetic', category: 'food', emoji: '🧄' },
  { id: 't-food-5', title: 'Beverage Splash', prompt: 'Beverage splash photography, {drink} pouring into glass, ice cubes, {fruit} garnish, freeze-frame action, commercial quality', category: 'food', emoji: '🥤' },
  { id: 't-food-6', title: 'Dessert Tower', prompt: 'Elegant dessert tower, {dessert_type} arrangement, pastel {color} palette, patisserie styling, fine dining photography', category: 'food', emoji: '🎂' },
  { id: 't-food-7', title: 'Farm to Table', prompt: 'Farm to table photography, {produce} in {setting}, rustic natural light, earthy tones, sustainable food story', category: 'food', emoji: '🌾' },
  { id: 't-food-8', title: 'Street Food', prompt: 'Vibrant street food photography, {dish} from {cuisine}, bustling market atmosphere, steam, authentic, documentary food style', category: 'food', emoji: '🌮' },
  { id: 't-food-9', title: 'Fine Dining', prompt: 'Fine dining plate presentation, {dish} with {technique}, minimalist white plate, restaurant ambiance, Michelin star quality', category: 'food', emoji: '🍷' },
  { id: 't-food-10', title: 'Cocktail Bar', prompt: 'Craft cocktail photography, {cocktail_name} in {glass_type}, garnish detail, moody bar lighting, mixology art, editorial quality', category: 'food', emoji: '🍸' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_DISPLAY_LENGTH = 100;

function truncate(text: string, max = MAX_DISPLAY_LENGTH) {
  if (text.length <= max) return text;
  return text.slice(0, max) + '...';
}

function getCategoryColor(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.color ?? '#94a3b8';
}

function getCategoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.label ?? 'Other';
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// PromptLibrary — full-featured saved prompts + template library
// ---------------------------------------------------------------------------

interface PromptLibraryProps {
  onSelectPrompt: (prompt: string) => void;
}

export function PromptLibrary({ onSelectPrompt }: PromptLibraryProps) {
  const promptLibraryOpen = useAppStore((s) => s.promptLibraryOpen);
  const setPromptLibraryOpen = useAppStore((s) => s.setPromptLibraryOpen);
  const savedPrompts = useAppStore((s) => s.savedPrompts);
  const setSavedPrompts = useAppStore((s) => s.setSavedPrompts);

  // Local state
  const [activeTab, setActiveTab] = useState<'saved' | 'templates'>('saved');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'az' | 'used'>('recent');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [templateCategory, setTemplateCategory] = useState('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Fetch saved prompts from IndexedDB
  const fetchPrompts = useCallback(async () => {
    try {
      const prompts = await data.fetchPrompts();
      setSavedPrompts(prompts.map((p) => ({
        id: p.id,
        text: p.text,
        category: p.category,
        isFavorite: p.isFavorite,
        providerName: p.providerName,
        modelName: p.modelName,
        usageCount: p.usageCount,
        createdAt: new Date(p.createdAt).toISOString(),
        updatedAt: new Date(p.updatedAt).toISOString(),
      })));
    } catch {
      // silently fail
    }
  }, [setSavedPrompts]);

  useEffect(() => {
    if (promptLibraryOpen) {
      fetchPrompts();
    }
  }, [promptLibraryOpen, fetchPrompts]);

  // Filter & sort saved prompts
  const filteredSaved = useMemo(() => {
    let list = [...savedPrompts];

    // Category filter
    if (categoryFilter !== 'all') {
      list = list.filter((p) => p.category === categoryFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.text.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.providerName && p.providerName.toLowerCase().includes(q)) ||
          (p.modelName && p.modelName.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sortBy) {
      case 'recent':
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        break;
      case 'az':
        list.sort((a, b) => a.text.localeCompare(b.text));
        break;
      case 'used':
        list.sort((a, b) => b.usageCount - a.usageCount);
        break;
    }

    return list;
  }, [savedPrompts, categoryFilter, searchQuery, sortBy]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let list = [...TEMPLATES];

    if (templateCategory !== 'all') {
      list = list.filter((t) => t.category === templateCategory);
    }

    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.prompt.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [templateCategory, templateSearch]);

  // Toggle favorite
  const handleToggleFavorite = useCallback(async (id: string, current: boolean) => {
    setSavedPrompts(
      savedPrompts.map((p) => (p.id === id ? { ...p, isFavorite: !current } : p))
    );
    try {
      await data.updatePrompt(id, { isFavorite: !current });
    } catch {
      setSavedPrompts(
        savedPrompts.map((p) => (p.id === id ? { ...p, isFavorite: current } : p))
      );
    }
  }, [savedPrompts, setSavedPrompts]);

  // Delete prompt
  const handleDelete = useCallback(async (id: string) => {
    const prev = savedPrompts;
    setSavedPrompts(savedPrompts.filter((p) => p.id !== id));
    setDeleteConfirmId(null);
    try {
      await data.deletePrompt(id);
    } catch {
      setSavedPrompts(prev);
    }
  }, [savedPrompts, setSavedPrompts]);

  // Use a saved prompt (load into textarea + increment usage)
  const handleUseSaved = useCallback(async (prompt: SavedPrompt) => {
    onSelectPrompt(prompt.text);
    setPromptLibraryOpen(false);
    try {
      await data.updatePrompt(prompt.id, { usageCount: prompt.usageCount + 1 });
    } catch {
      // silent
    }
  }, [onSelectPrompt, setPromptLibraryOpen]);

  // Use a template
  const handleUseTemplate = useCallback((template: PromptTemplate) => {
    onSelectPrompt(template.prompt);
    setPromptLibraryOpen(false);
  }, [onSelectPrompt, setPromptLibraryOpen]);

  // Save template as a saved prompt
  const handleSaveTemplate = useCallback(async (template: PromptTemplate) => {
    setSavingId(template.id);
    try {
      const newPrompt = await data.createPrompt({
        text: template.prompt,
        category: template.category,
        isFavorite: false,
      });
      setSavedPrompts([{
        id: newPrompt.id,
        text: newPrompt.text,
        category: newPrompt.category,
        isFavorite: newPrompt.isFavorite,
        usageCount: newPrompt.usageCount,
        createdAt: new Date(newPrompt.createdAt).toISOString(),
        updatedAt: new Date(newPrompt.updatedAt).toISOString(),
      }, ...savedPrompts]);
    } catch {
      // silent
    }
    setSavingId(null);
  }, [savedPrompts, setSavedPrompts]);

  // Reset search when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as 'saved' | 'templates');
    setSearchQuery('');
    setCategoryFilter('all');
  };

  // Close handler
  const handleClose = () => {
    setPromptLibraryOpen(false);
    setSearchQuery('');
    setCategoryFilter('all');
    setDeleteConfirmId(null);
    setExpandedId(null);
    setTemplateCategory('all');
    setTemplateSearch('');
  };

  return (
    <Dialog open={promptLibraryOpen} onOpenChange={(v) => { if (!v) handleClose(); else setPromptLibraryOpen(true); }}>
      <DialogContent className="glass-strong border-border/60 shadow-[0_0_40px_rgba(0,0,0,0.6)] sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-[#d9ff00]" />
            <span>Prompt Library</span>
            {savedPrompts.length > 0 && (
              <span className="rounded-full bg-[#d9ff00]/15 px-2 py-0.5 text-[10px] font-bold text-[#d9ff00]">
                {savedPrompts.length} saved
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground/60">
            Browse templates and saved prompts for your creative projects
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col flex-1 min-h-0">
          {/* Tab bar */}
          <div className="px-5 pt-3">
            <TabsList className="w-full bg-white/5 border border-border/40 h-9">
              <TabsTrigger
                value="saved"
                className="flex-1 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:border-[#d9ff00]/30 text-xs"
              >
                <BookmarkCheck className="h-3.5 w-3.5 mr-1.5" />
                Saved
                {savedPrompts.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#d9ff00]/20 px-1.5 py-px text-[9px] font-bold text-[#d9ff00]">
                    {savedPrompts.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="templates"
                className="flex-1 data-[state=active]:bg-[#d9ff00]/10 data-[state=active]:text-[#d9ff00] data-[state=active]:border-[#d9ff00]/30 text-xs"
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                Templates
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-px text-[9px] font-bold text-muted-foreground">
                  {TEMPLATES.length}
                </span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ======== SAVED TAB ======== */}
          <TabsContent value="saved" className="flex-1 min-h-0 mt-0">
            <div className="flex flex-col h-[55vh]">
              {/* Search + Sort */}
              <div className="px-5 pt-3 pb-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search saved prompts..."
                    className="w-full rounded-md bg-white/5 border border-border/40 pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/40 focus:border-[#d9ff00]/30 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Category filter pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <motion.button
                      key={cat.id}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                        categoryFilter === cat.id
                          ? 'border-[#d9ff00]/40 bg-[#d9ff00]/15 text-[#d9ff00]'
                          : 'border-border/30 bg-white/5 text-muted-foreground/70 hover:text-foreground hover:border-border/50'
                      }`}
                    >
                      {cat.label}
                    </motion.button>
                  ))}
                </div>

                {/* Sort row */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50 mr-1">Sort:</span>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSortBy(opt.id as typeof sortBy)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                        sortBy === opt.id
                          ? 'bg-[#d9ff00]/10 text-[#d9ff00]'
                          : 'text-muted-foreground/50 hover:text-foreground'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prompt list */}
              <ScrollArea className="flex-1 px-5">
                {filteredSaved.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <BookmarkCheck className="h-10 w-10 text-muted-foreground/15 mb-3" />
                    <p className="text-xs text-muted-foreground/50 text-center">
                      {savedPrompts.length === 0
                        ? 'No saved prompts yet'
                        : 'No matching prompts found'}
                    </p>
                    {savedPrompts.length === 0 && (
                      <p className="text-[10px] text-muted-foreground/30 mt-1 text-center">
                        Save prompts from your history or use templates to get started
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5 pb-4">
                    <AnimatePresence mode="popLayout">
                      {filteredSaved.map((prompt, index) => (
                        <motion.div
                          key={prompt.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ delay: index * 0.02, duration: 0.15 }}
                          className="group relative rounded-lg border border-border/30 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#d9ff00]/20 transition-all"
                        >
                          <div
                            className="flex items-start gap-2 px-3 py-2.5 cursor-pointer"
                            onClick={() => setExpandedId(expandedId === prompt.id ? null : prompt.id)}
                          >
                            {/* Favorite star */}
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.2 }}
                              whileTap={{ scale: 0.8 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(prompt.id, prompt.isFavorite);
                              }}
                              className="mt-0.5 shrink-0"
                            >
                              <Star
                                className={`h-3.5 w-3.5 transition-colors ${
                                  prompt.isFavorite
                                    ? 'fill-[#d9ff00] text-[#d9ff00]'
                                    : 'text-muted-foreground/30 hover:text-[#d9ff00]/60'
                                }`}
                              />
                            </motion.button>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors ${
                                expandedId !== prompt.id ? 'line-clamp-2' : ''
                              }`}>
                                {expandedId === prompt.id ? prompt.text : truncate(prompt.text)}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {/* Category badge */}
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-medium border"
                                  style={{
                                    color: getCategoryColor(prompt.category),
                                    borderColor: `${getCategoryColor(prompt.category)}30`,
                                    backgroundColor: `${getCategoryColor(prompt.category)}10`,
                                  }}
                                >
                                  <Tag className="h-2 w-2" />
                                  {getCategoryLabel(prompt.category)}
                                </span>

                                {/* Provider/Model */}
                                {(prompt.providerName || prompt.modelName) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-px rounded-full text-[9px] font-medium border border-border/30 bg-white/5 text-muted-foreground/60">
                                    <Cpu className="h-2 w-2" />
                                    {prompt.providerName}{prompt.modelName ? ` / ${prompt.modelName}` : ''}
                                  </span>
                                )}

                                {/* Usage count */}
                                {prompt.usageCount > 0 && (
                                  <span className="text-[9px] text-muted-foreground/40">
                                    Used {prompt.usageCount}×
                                  </span>
                                )}

                                {/* Date */}
                                <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/40">
                                  <Clock className="h-2 w-2" />
                                  {formatDate(prompt.createdAt)}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleUseSaved(prompt);
                                    }}
                                    className="rounded-md p-1 text-[#d9ff00]/60 hover:text-[#d9ff00] hover:bg-[#d9ff00]/10 transition-all"
                                  >
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </motion.button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-[10px]">Use this prompt</TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <motion.button
                                    type="button"
                                    whileHover={{ scale: 1.15 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmId(prompt.id);
                                    }}
                                    className="rounded-md p-1 text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </motion.button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-[10px]">Delete</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>

                          {/* Expanded view */}
                          <AnimatePresence>
                            {expandedId === prompt.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                              >
                                <div className="px-3 pb-2.5 pt-0 border-t border-border/20">
                                  <p className="text-[11px] text-muted-foreground/70 leading-relaxed pt-2 whitespace-pre-wrap">
                                    {prompt.text}
                                  </p>
                                  <div className="flex gap-2 mt-2">
                                    <motion.button
                                      type="button"
                                      whileHover={{ scale: 1.03 }}
                                      whileTap={{ scale: 0.97 }}
                                      onClick={() => handleUseSaved(prompt)}
                                      className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#d9ff00]/10 text-[#d9ff00] text-[10px] font-medium hover:bg-[#d9ff00]/20 transition-all"
                                    >
                                      <ArrowRight className="h-3 w-3" />
                                      Use Prompt
                                    </motion.button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Delete confirmation overlay */}
                          <AnimatePresence>
                            {deleteConfirmId === prompt.id && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 rounded-lg bg-black/80 backdrop-blur-sm flex items-center justify-center gap-3 z-10"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                                <span className="text-[10px] text-foreground">Delete?</span>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(prompt.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-muted-foreground hover:bg-white/20 transition-all"
                                >
                                  Cancel
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* ======== TEMPLATES TAB ======== */}
          <TabsContent value="templates" className="flex-1 min-h-0 mt-0">
            <div className="flex flex-col h-[55vh]">
              {/* Search + Category filter */}
              <div className="px-5 pt-3 pb-2 space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full rounded-md bg-white/5 border border-border/40 pl-8 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-[#d9ff00]/40 focus:border-[#d9ff00]/30 transition-all"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => setTemplateSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Template category pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.filter((c) => c.id !== 'other').map((cat) => (
                    <motion.button
                      key={cat.id}
                      type="button"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setTemplateCategory(templateCategory === cat.id ? 'all' : cat.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                        templateCategory === cat.id
                          ? 'border-[#d9ff00]/40 bg-[#d9ff00]/15 text-[#d9ff00]'
                          : 'border-border/30 bg-white/5 text-muted-foreground/70 hover:text-foreground hover:border-border/50'
                      }`}
                    >
                      {cat.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Template grid */}
              <ScrollArea className="flex-1 px-5">
                {filteredTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4">
                    <Sparkles className="h-10 w-10 text-muted-foreground/15 mb-3" />
                    <p className="text-xs text-muted-foreground/50 text-center">
                      No templates found
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-4">
                    <AnimatePresence mode="popLayout">
                      {filteredTemplates.map((template, index) => (
                        <motion.div
                          key={template.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.02, duration: 0.15 }}
                          className="group relative rounded-lg border border-border/30 bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#d9ff00]/20 transition-all overflow-hidden"
                        >
                          {/* Color accent top border */}
                          <div
                            className="h-0.5 w-full"
                            style={{ backgroundColor: getCategoryColor(template.category) }}
                          />

                          <div className="p-3 space-y-2">
                            {/* Header */}
                            <div className="flex items-center gap-2">
                              <span className="text-base">{template.emoji}</span>
                              <span className="text-[11px] font-semibold text-foreground flex-1 truncate">
                                {template.title}
                              </span>
                              <span
                                className="shrink-0 px-1.5 py-px rounded-full text-[8px] font-medium border"
                                style={{
                                  color: getCategoryColor(template.category),
                                  borderColor: `${getCategoryColor(template.category)}30`,
                                  backgroundColor: `${getCategoryColor(template.category)}10`,
                                }}
                              >
                                {getCategoryLabel(template.category)}
                              </span>
                            </div>

                            {/* Prompt preview */}
                            <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-3">
                              {template.prompt}
                            </p>

                            {/* Highlighted placeholders */}
                            <div className="flex flex-wrap gap-1">
                              {template.prompt.match(/\{[^}]+\}/g)?.map((ph, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-px rounded text-[8px] font-mono font-medium bg-[#d9ff00]/10 text-[#d9ff00]/80 border border-[#d9ff00]/20"
                                >
                                  {ph}
                                </span>
                              ))}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 pt-1">
                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleUseTemplate(template)}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#d9ff00]/10 text-[#d9ff00] text-[10px] font-medium hover:bg-[#d9ff00]/20 transition-all"
                              >
                                <ArrowRight className="h-3 w-3" />
                                Use Template
                              </motion.button>

                              <motion.button
                                type="button"
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleSaveTemplate(template)}
                                disabled={savingId === template.id}
                                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/5 border border-border/30 text-muted-foreground/60 text-[10px] font-medium hover:text-foreground hover:border-border/50 transition-all disabled:opacity-50"
                              >
                                {savingId === template.id ? (
                                  <Check className="h-3 w-3 text-[#d9ff00]" />
                                ) : (
                                  <Plus className="h-3 w-3" />
                                )}
                                {savingId === template.id ? 'Saved' : 'Save'}
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
