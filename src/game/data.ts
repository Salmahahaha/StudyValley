import type { CosmeticDef, DecorDef, ItemDef, PlantDef, PotDef, ZoneDef } from './types'

const P = (id: string, name: string, blurb: string, rarity: PlantDef['rarity'], cost: number, minLevel: number, minutes: number, harvest: number, extra: Partial<PlantDef> = {}): PlantDef =>
  ({ kind: 'plant', id, name, blurb, rarity, cost, minLevel, minutes, harvest, ...extra })

const plants: PlantDef[] = [
  P('carrot', 'Carrot', 'Quick and crunchy. A perfect first crop.', 'common', 25, 1, 40, 50),
  P('wheat', 'Wheat', 'Golden waves for a golden mind.', 'common', 35, 1, 60, 75),
  P('lettuce', 'Lettuce', 'Crisp, leafy and very forgiving.', 'common', 45, 1, 75, 95),
  P('cauliflower', 'Cauliflower', 'A cloud you can grow.', 'common', 70, 2, 100, 135),
  P('sunflower', 'Sunflower', 'Turns its face to every study session.', 'common', 90, 2, 120, 170),
  P('chili', 'Chili Pepper', 'Spicy motivation in a pod.', 'uncommon', 140, 3, 180, 250),
  P('cucumber', 'Cucumber', 'Cool as you are under exam pressure.', 'uncommon', 160, 3, 200, 280),
  P('pumpkin', 'Pumpkin', 'Grows big if you put the hours in.', 'uncommon', 220, 4, 300, 420),
  P('grapes', 'Grapevine', 'Patience, then purple glory.', 'uncommon', 280, 5, 360, 520),
  P('pineapple', 'Pineapple', 'Tough outside, sweet reward inside.', 'uncommon', 320, 5, 400, 600),
  P('appletree', 'Apple Tree', 'Fruits again and again once grown.', 'rare', 500, 6, 600, 900, { harvestGems: 1, regrow: 240 }),
  P('lemontree', 'Lemon Tree', 'Zesty fruit on repeat.', 'rare', 600, 7, 700, 1050, { harvestGems: 1, regrow: 280 }),
  P('plumtree', 'Plum Tree', 'Deep purple plums, season after season.', 'rare', 700, 8, 800, 1200, { harvestGems: 1, regrow: 320 }),
  P('bananapalm', 'Banana Palm', 'A taste of the tropics.', 'rare', 800, 9, 900, 1400, { harvestGems: 2, regrow: 360 }),
  P('coconutpalm', 'Coconut Palm', 'The tallest, proudest palm.', 'rare', 950, 10, 1000, 1650, { harvestGems: 2, regrow: 400 }),
  P('moonflower', 'Moonflower', 'Petals spun from moonlight. Glows at night.', 'rare', 900, 10, 900, 1900, { harvestGems: 2 }),
  P('crystalrose', 'Crystal Rose', 'Legend says it only grows for the truly dedicated.', 'legendary', 0, 12, 2400, 6000, { gemCost: 12, harvestGems: 3 }),
]

const pots: PotDef[] = [
  { kind: 'pot', id: 'clay', name: 'Clay Pot', blurb: '+5% growth speed', cost: 40, minLevel: 1, speed: 1.05, color: '#c9703e', rim: '#e08a52' },
  { kind: 'pot', id: 'painted', name: 'Painted Pot', blurb: '+15% growth speed', cost: 120, minLevel: 2, speed: 1.15, color: '#4aa8c8', rim: '#7fd0e8' },
  { kind: 'pot', id: 'glowing', name: 'Glowing Pot', blurb: '+30% growth speed', cost: 350, minLevel: 5, speed: 1.3, color: '#7a5cd6', rim: '#b79cff' },
  { kind: 'pot', id: 'golden', name: 'Golden Pot', blurb: '+50% growth speed', cost: 900, minLevel: 8, speed: 1.5, color: '#e0a82a', rim: '#ffe27a' },
  { kind: 'pot', id: 'crystalpot', name: 'Crystal Pot', blurb: '+100% growth speed', cost: 0, gemCost: 5, minLevel: 10, speed: 2, color: '#59d3e8', rim: '#c4f6ff' },
]

const D = (cat: DecorDef['cat'], id: string, name: string, blurb: string, cost: number, minLevel: number, gemCost?: number): DecorDef =>
  ({ kind: 'decor', cat, id, name, blurb, cost, minLevel, ...(gemCost ? { gemCost } : {}) })

const decor: DecorDef[] = [
  D('garden', 'path', 'Cobble Path', 'Pale stones for a tidy walkway.', 15, 1),
  D('garden', 'fence', 'Wooden Fence', 'Keeps the bunnies out. Mostly.', 25, 1),
  D('garden', 'flowers', 'Wildflowers', 'A splash of colour between plots.', 30, 1),
  D('garden', 'lantern', 'Lantern', 'Glows warmly when the sun goes down.', 60, 2),
  D('garden', 'crates', 'Harvest Crates', 'Proof of a hard day\'s work.', 80, 2),
  D('garden', 'bench', 'Garden Bench', 'For well-earned breaks.', 120, 3),
  D('garden', 'fairylights', 'Fairy Lights', 'Twinkles all evening long.', 150, 4),
  D('garden', 'scarecrow', 'Pumpkin Scarecrow', 'Guardian of the garden. Slightly spooky.', 180, 4),
  D('garden', 'pond', 'Lily Pond', 'Ripples, reeds and a pink water lily.', 250, 5),
  D('garden', 'well', 'Wishing Well', 'Toss in a coin before your exam.', 320, 6),
  D('nature', 'bush', 'Round Bush', 'Soft, green and very huggable.', 40, 1),
  D('nature', 'fernclump', 'Fern Clump', 'Wild ferns from the forest edge.', 45, 1),
  D('nature', 'stump', 'Old Stump', 'A cosy perch for a reading break.', 60, 2),
  D('nature', 'log', 'Mossy Log', 'Home to at least four beetles.', 70, 2),
  D('nature', 'shrub', 'Evergreen Shrub', 'Green all year round.', 70, 2),
  D('nature', 'mushrooms', 'Toadstool Ring', "Don't step in the middle.", 90, 3),
  D('nature', 'cairn', 'Blue Cairn', 'Stacked with care, stone by stone.', 90, 3),
  D('nature', 'boulder', 'Boulder', 'Immovable, like your focus.', 110, 3),
  D('nature', 'toadstool', 'Giant Toadstool', 'Big enough to shelter a frog.', 140, 4),
  D('nature', 'oak', 'Oak Tree', 'Sways gently in the breeze.', 300, 5),
  D('nature', 'leafy', 'Leafy Tree', 'A thick canopy of rustling leaves.', 340, 6),
  D('nature', 'orchard', 'Orchard Tree', 'Heavy with shiny red apples.', 380, 6),
  D('magic', 'chanterelles', 'Chanterelles', 'Golden forest mushrooms.', 120, 4),
  D('magic', 'mossrock', 'Mossy Rock', 'Ancient and soft with moss.', 150, 4),
  D('magic', 'glowshroom', 'Elder Mushroom', 'An old, wise mushroom that hums at night.', 200, 5),
  D('magic', 'quartz', 'Quartz Boulder', 'Gleaming white stone.', 300, 7),
  D('magic', 'ember', 'Ember Rocks', 'Warm to the touch. Glows at night.', 350, 8),
  D('magic', 'frost', 'Frost Crystals', 'Never melts. Sparkles in the dark.', 400, 9),
  D('magic', 'whitetree', 'Ghost Tree', 'Pale branches that whisper.', 500, 7),
  D('magic', 'bluegreen', 'Bubble Tree', 'Round, teal and bouncy-looking.', 550, 7),
  D('magic', 'willow', 'Weeping Willow', 'Long fronds that sweep the ground.', 650, 8),
  D('magic', 'swirl', 'Swirlwood', 'Grew in spirals. Nobody knows why.', 700, 8),
  D('magic', 'lightballs', 'Lantern Tree', 'Glowing orbs bloom on its branches.', 0, 9, 3),
  D('magic', 'luminous', 'Luminous Tree', 'Shimmers softly all night.', 0, 10, 4),
  D('magic', 'idoldeer', 'Deer Idol', 'A forest spirit carved in living wood.', 0, 11, 5),
  D('magic', 'idolwolf', 'Wolf Idol', 'Guards the grove with quiet eyes.', 0, 11, 5),
  D('magic', 'gazebo', 'Living Gazebo', 'A shelter woven from growing vines.', 0, 12, 8),
  D('magic', 'ent', 'Ent Guardian', 'An old tree spirit who likes your study habits.', 0, 13, 10),
  D('pet', 'chick', 'Chick', 'Peeps encouragingly while you work.', 120, 2),
  D('pet', 'hare', 'Bunny', 'Hops around your plots.', 180, 3),
  D('pet', 'rooster', 'Rooster', 'Your morning study alarm.', 200, 4),
  D('pet', 'piglet', 'Piglet', 'Snuffles happily in the soil.', 240, 4),
  D('pet', 'lamb', 'Lamb', 'Soft, sleepy and loyal.', 300, 5),
  D('pet', 'sheep', 'Fluffy Sheep', 'A walking cloud.', 360, 6),
  D('pet', 'cat', 'Garden Cat', 'Pops out of the grass to check on you.', 500, 6),
  D('pet', 'fox', 'Fox', 'Curious, clever, a little bit sly.', 450, 7),
  D('pet', 'calf', 'Calf', 'Big eyes, bigger heart.', 520, 8),
  D('pet', 'deer', 'Deer', 'A gentle visitor from the woods.', 0, 10, 4),
]

/** ids from older versions of the game, mapped to their replacements */
export const LEGACY_IDS: Record<string, string> = {
  daisy: 'carrot', tulip: 'wheat', fern: 'lettuce', lavender: 'chili', cherry: 'appletree', lotus: 'pumpkin',
}

const cosmetics: CosmeticDef[] = [
  { kind: 'cosmetic', id: 'strawhat', slot: 'hat', name: 'Straw Hat', blurb: 'Classic gardener look.', cost: 80, minLevel: 1, color: '#e5c76b', color2: '#c9a43a' },
  { kind: 'cosmetic', id: 'flowercrown', slot: 'hat', name: 'Flower Crown', blurb: 'Blooms wherever you go.', cost: 150, minLevel: 2, color: '#ff9ec8', color2: '#ffd23f' },
  { kind: 'cosmetic', id: 'catears', slot: 'hat', name: 'Cat Ears', blurb: 'Purr-fect focus.', cost: 250, minLevel: 3, color: '#3a3a4a', color2: '#ff9ec8' },
  { kind: 'cosmetic', id: 'wizardhat', slot: 'hat', name: 'Wizard Hat', blurb: 'Arcane study powers.', cost: 300, minLevel: 4, color: '#5a3fa8', color2: '#ffd23f' },
  { kind: 'cosmetic', id: 'crown', slot: 'hat', name: 'Golden Crown', blurb: 'For valley royalty.', cost: 0, gemCost: 3, minLevel: 8, color: '#f2b632', color2: '#e8505b' },
  { kind: 'cosmetic', id: 'tunic', slot: 'outfit', name: 'Blue Tunic', blurb: 'Adventurer ready.', cost: 100, minLevel: 1, color: '#3f78c4', color2: '#e5c76b' },
  { kind: 'cosmetic', id: 'cloak', slot: 'outfit', name: 'Red Cloak', blurb: 'Dramatic and warm.', cost: 250, minLevel: 3, color: '#c43f3f', color2: '#7a1f1f' },
  { kind: 'cosmetic', id: 'robe', slot: 'outfit', name: 'Scholar Robe', blurb: 'Looks very wise.', cost: 400, minLevel: 5, color: '#6a4ca8', color2: '#f2b632' },
  { kind: 'cosmetic', id: 'armor', slot: 'outfit', name: 'Golden Armour', blurb: 'Slays exams.', cost: 900, minLevel: 8, color: '#d6a52a', color2: '#fff0a0' },
]

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
  [...plants, ...pots, ...decor, ...cosmetics].map((i) => [i.id, i]),
)
export const COSMETICS = cosmetics

export const ZONES: ZoneDef[] = [
  { id: 'meadow', name: 'Meadow', emoji: '🌼', blurb: 'Where it all begins. Grows with your level.', minLevel: 1, cost: 0, cols: 8, rows: 6, speed: 1 },
  { id: 'grove', name: 'Mossy Grove', emoji: '🌲', blurb: 'Shady and calm. Plants grow 10% faster.', minLevel: 7, cost: 1500, cols: 6, rows: 4, speed: 1.1 },
  { id: 'greenhouse', name: 'Greenhouse', emoji: '🏡', blurb: 'Warm all year. Plants grow 20% faster.', minLevel: 9, cost: 3000, cols: 8, rows: 5, speed: 1.2 },
  { id: 'cave', name: 'Crystal Cave', emoji: '💎', blurb: 'Glowing and mysterious. Plants grow 30% faster.', minLevel: 11, cost: 5000, cols: 6, rows: 6, speed: 1.3 },
  { id: 'sky', name: 'Sky Garden', emoji: '☁️', blurb: 'Above the clouds. Plants grow 50% faster.', minLevel: 13, cost: 0, gemCost: 15, cols: 8, rows: 6, speed: 1.5 },
]
export const zoneDef = (id?: string) => ZONES.find((z) => z.id === (id ?? 'meadow')) ?? ZONES[0]

export const SKIN = ['#f6d2b0', '#e8b78a', '#c98f5f', '#9b6a41', '#6b4528']
/** the first six are the originals, so saved avatars keep their colour */
export const HAIR = [
  '#3a2616', '#6b3a1a', '#c9892a', '#e8d070', '#c94a4a', '#7a5cd6',
  '#17141a', '#8a3a24', '#e08a3a', '#d6d8e2', '#f6f1e4', '#ec7fb2', '#4a9fd8', '#3fb58a', '#27306e',
]
export const DEFAULT_AVATAR = { skin: 1, hair: 0, hairColor: 0 }
/** decor that is small enough to sit in a corner of a tile next to a plant; everything else takes the tile centre */
const SMALL_DECOR = new Set([
  'flowers', 'lantern', 'crates', 'bench', 'fairylights', 'fence', 'pond', 'mushrooms', 'cairn', 'toadstool',
  'chanterelles', 'bush', 'fernclump', 'stump', 'log',
])
export const isSmallDecor = (id: string) => SMALL_DECOR.has(id)
/** laid flat on the ground, under everything else on the tile */
export const isFloorDecor = (id: string) => id === 'path'
export const PLANTS = plants
export const POTS = pots
export const DECOR = decor

export const MODULE_COLORS = ['#e06c75', '#e5a24a', '#d9c23c', '#6aa84f', '#4aa8c8', '#6a7be0', '#a26ae0', '#e06ab0']
export const MODULE_EMOJI = ['📘', '🧮', '🧪', '⚖️', '💻', '📜', '🧠', '🎨', '🧬', '🌍', '🎵', '📈']

export const GRID_W = 8
export const GRID_H = 6

const TITLES = ['Seedling', 'Sprout', 'Apprentice', 'Gardener', 'Scholar', 'Herbalist', 'Grove Keeper', 'Sage', 'Archdruid', 'Legend']
export const titleFor = (level: number) => TITLES[Math.min(TITLES.length - 1, Math.floor((level - 1) / 2))]

export const RARITY_COLOR: Record<string, string> = {
  common: '#9aa5a0',
  uncommon: '#4fb36a',
  rare: '#4a8de0',
  legendary: '#e0a82a',
}
