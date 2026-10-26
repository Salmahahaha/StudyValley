import { DEFAULT_AVATAR, GRID_H, GRID_W, ITEMS } from './data'
import { TIE, hairColorOf, hairCovers, hairOverhang, hairRamp, specOf, validHex } from './hair'
import type { HairPt } from './hair'
import type { Avatar, PotDef } from './types'

/*
 * Pixel-art atlas. Most art comes from CraftPix packs (public/sprites, see
 * scripts/import-assets.mjs); pots, lanterns, the pond, fences and the magic
 * flowers are painted here pixel by pixel to match that style.
 * All coordinates are source pixels; the garden is scaled up by whole numbers.
 */

export const T = 32 // garden tile, in source pixels
export const BAND = 40 // scenery strip above the plots
export const GW = GRID_W * T
export const GH = BAND + GRID_H * T

type C = CanvasRenderingContext2D
type Src = HTMLImageElement | HTMLCanvasElement
export interface Spr {
  img: Src
  x: number
  y: number
  w: number
  h: number
  /** anchor (the "feet") inside the rect */
  ax: number
  ay: number
}

/* ---------------- loading ---------------- */

const FILES = [
  'plants', 'exterior', 'trees', 'cat', 'grass_details',
  'girl_walk_body', 'girl_walk_head', 'girl_idle_body', 'girl_idle_head', 'girl_shadow',
  'chick', 'piglet', 'lamb', 'sheep', 'rooster', 'calf',
  'fox_walk', 'fox_idle', 'hare_walk', 'hare_idle', 'deer_walk', 'deer_idle',
  'boar_idle', 'boar_death', 'fox_death', 'deer_death', 'hare_death', 'grouse_idle', 'grouse_death',
  'f_luminous', 'f_lightballs', 'f_willow', 'f_swirl', 'f_white', 'f_bluegreen', 'f_idol_deer',
  'f_idol_wolf', 'f_gazebo', 'f_ent', 'f_chanterelles', 'f_beige_mushroom',
  'r_frost', 'r_frost_small', 'r_ember', 'r_mossy', 'r_quartz',
] as const
type File = (typeof FILES)[number]

const IMG: Partial<Record<File, HTMLImageElement>> = {}
let ready = false
const subs = new Set<() => void>()

export const atlasReady: Promise<void> = Promise.all(
  FILES.map(
    (f) =>
      new Promise<void>((res) => {
        const i = new Image()
        i.onload = () => {
          IMG[f] = i
          res()
        }
        i.onerror = () => res()
        i.src = `${import.meta.env.BASE_URL}sprites/${f}.png`
      }),
  ),
).then(() => {
  ready = true
  subs.forEach((fn) => fn())
})
export const isAtlasReady = () => ready
export function subscribeAtlas(fn: () => void) {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

const blank = (() => {
  const c = document.createElement('canvas')
  c.width = c.height = 1
  return c
})()
const img = (f: File): Src => IMG[f] ?? blank

function canvas(w: number, h: number): [HTMLCanvasElement, C] {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  return [c, ctx]
}

const memo = new Map<string, unknown>()
function cached<V>(key: string, make: () => V): V {
  if (!ready) return make()
  if (!memo.has(key)) memo.set(key, make())
  return memo.get(key) as V
}

const pixelCache = new Map<Src, ImageData>()
function pixels(src: Src): ImageData {
  let d = pixelCache.get(src)
  if (!d) {
    const [, c] = canvas(src.width, src.height)
    c.drawImage(src, 0, 0)
    d = c.getImageData(0, 0, src.width, src.height)
    if (ready) pixelCache.set(src, d)
  }
  return d
}

/* ---------------- sprite primitives ---------------- */

const spr = (f: File | Src, x: number, y: number, w: number, h: number, ax = Math.floor(w / 2), ay = h - 1): Spr => ({
  img: typeof f === 'string' ? img(f) : f,
  x, y, w, h, ax, ay,
})

/** opaque bounding box of a region */
function bbox(src: Src, x0 = 0, y0 = 0, w = src.width, h = src.height) {
  const d = pixels(src)
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++)
      if (d.data[(y * d.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  if (maxX < 0) return { x: x0, y: y0, w: 1, h: 1 }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/** whole image trimmed to its pixels, anchored bottom-centre */
const trim = (f: File): Spr =>
  cached(`trim:${f}`, () => {
    const b = bbox(img(f))
    return spr(f, b.x, b.y, b.w, b.h)
  })

export function drawSpr(c: C, s: Spr, x: number, y: number, flip = false) {
  const dy = Math.round(y - s.ay)
  if (!flip) {
    c.drawImage(s.img, s.x, s.y, s.w, s.h, Math.round(x - s.ax), dy, s.w, s.h)
    return
  }
  c.save()
  c.translate(Math.round(x), 0)
  c.scale(-1, 1)
  c.drawImage(s.img, s.x, s.y, s.w, s.h, -s.ax - 1, dy, s.w, s.h)
  c.restore()
}

/** paint a sprite into its own canvas so it can be recoloured or composed */
function bake(s: Spr, pad = 0): [HTMLCanvasElement, C] {
  const [cv, c] = canvas(s.w + pad * 2, s.h + pad * 2)
  c.drawImage(s.img, s.x, s.y, s.w, s.h, pad, pad, s.w, s.h)
  return [cv, c]
}

type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
function hsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return { h: 0, s: 0, l }
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return { h, s, l }
}
const pick = (ramp: string[], t: number) => hex(ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(t * ramp.length)))])

/** copy a sprite with a per-pixel colour mapping */
function recolor(key: string, s: Spr, fn: (r: number, g: number, b: number, x: number, y: number) => RGB | null, pad = 0): Spr {
  return cached(`rc:${key}`, () => {
    const [cv, c] = bake(s, pad)
    const d = c.getImageData(0, 0, cv.width, cv.height)
    for (let y = 0; y < cv.height; y++)
      for (let x = 0; x < cv.width; x++) {
        const k = (y * cv.width + x) * 4
        if (d.data[k + 3] < 10) continue
        const out = fn(d.data[k], d.data[k + 1], d.data[k + 2], x, y)
        if (out) [d.data[k], d.data[k + 1], d.data[k + 2]] = out
      }
    c.putImageData(d, 0, 0)
    return spr(cv, 0, 0, cv.width, cv.height, s.ax + pad, s.ay + pad)
  })
}

/* tiny pixel painter for the hand-made pieces */
function painter(w: number, h: number, draw: (p: (x: number, y: number, col: string) => void, r: (x: number, y: number, w: number, h: number, col: string) => void, c: C) => void, ax = Math.floor(w / 2), ay = h - 1): Spr {
  const [cv, c] = canvas(w, h)
  const r = (x: number, y: number, ww: number, hh: number, col: string) => {
    c.fillStyle = col
    c.fillRect(x, y, ww, hh)
  }
  const p = (x: number, y: number, col: string) => r(x, y, 1, 1, col)
  draw(p, r, c)
  return spr(cv, 0, 0, w, h, ax, ay)
}

/** draw a little bitmap (rows of palette characters, '.' transparent) */
function bitmap(rows: string[], pal: Record<string, string>): Spr {
  return painter(rows[0].length, rows.length, (p) => {
    rows.forEach((row, y) => [...row].forEach((ch, x) => ch !== '.' && pal[ch] && p(x, y, pal[ch])))
  })
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const seedOf = (s: string) => {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/* ---------------- plants ---------------- */

const CROP_ROWS: Record<string, [number, number]> = {
  grapes: [9, 45], chili: [96, 125], cauliflower: [138, 154], lettuce: [217, 232],
  cucumber: [240, 268], pumpkin: [288, 314], pineapple: [327, 351], wheat: [353, 380], sunflower: [396, 429],
}
/** growth stage 1..4 -> sheet column (col 2 is the ripe one, col 3 a leafy in-between) */
const CROP_COL = [0, 0, 1, 3, 2]
const cropSpr = (row: string, col: number) => {
  const [t, b] = CROP_ROWS[row]
  return spr('plants', col * 32, t, 32, b - t + 1)
}
const HOLE = () => spr('plants', 100, 371, 22, 10)

const TREE_RECTS: Record<string, [number, number, number, number][]> = {
  plumtree: [[134, 54, 17, 20], [161, 42, 27, 36], [202, 29, 38, 51], [261, 14, 52, 66], [325, 14, 52, 66]],
  lemontree: [[135, 119, 14, 20], [163, 108, 23, 33], [204, 96, 35, 47], [264, 82, 48, 62], [328, 82, 48, 62]],
  appletree: [[135, 180, 14, 22], [161, 172, 28, 32], [204, 162, 38, 44], [263, 149, 48, 59], [327, 149, 48, 59]],
  bananapalm: [[135, 263, 16, 20], [161, 254, 29, 30], [207, 236, 31, 49], [263, 219, 50, 69], [327, 219, 50, 69]],
  coconutpalm: [[135, 341, 15, 21], [161, 331, 29, 33], [207, 319, 33, 48], [260, 298, 53, 70], [324, 298, 53, 70]],
}
export const isTree = (id: string) => id in TREE_RECTS

const CARROT: [number, number, number, number][] = [[148, 385, 7, 11], [161, 380, 12, 16], [161, 380, 12, 16], [176, 370, 14, 26]]

const MOON = ['#3d5aa8', '#6f8fe0', '#a9c4ff', '#dfe9ff', '#ffffff']
const MOON_CORE = ['#141a44', '#24306e', '#3b4fa0']
function moonflower(stage: number): Spr {
  const base = cropSpr('sunflower', CROP_COL[stage])
  return recolor(`moon:${stage}`, base, (r, g, b) => {
    const { h, s, l } = hsl(r, g, b)
    if (h > 32 && h < 70 && s > 0.35 && l > 0.3) return pick(MOON, (l - 0.3) / 0.6)
    if (h < 40 && l < 0.42 && s > 0.15) return pick(MOON_CORE, l / 0.42)
    return null
  })
}

const TEAL = ['#123c3e', '#1d5e5c', '#2c8580', '#4fb3a6', '#8fe0cf']
const ROSE = ['#6a1f6e', '#a8329a', '#e05cc6', '#ff9be6', '#ffe0fa']
function crystalRose(stage: number): Spr {
  const col = stage === 4 ? 2 : CROP_COL[stage]
  const base = cropSpr('cauliflower', col)
  return recolor(`crystal:${stage}`, base, (r, g, b) => {
    const { h, s, l } = hsl(r, g, b)
    if (h > 60 && h < 170 && s > 0.15) return pick(TEAL, l / 0.75)
    if (stage === 4 && s < 0.25 && l > 0.55) return pick(ROSE, (l - 0.55) / 0.45)
    return null
  })
}

/** sprite for a plant at a growth stage */
export function plantSpr(itemId: string, stage: number): Spr {
  return cached(`plant:${itemId}:${stage}`, () => {
    if (TREE_RECTS[itemId]) {
      const [x, y, w, h] = TREE_RECTS[itemId][stage]
      return spr('plants', x, y, w, h)
    }
    if (stage === 0) return HOLE()
    if (itemId === 'carrot') {
      const [x, y, w, h] = CARROT[stage - 1]
      return spr('plants', x, y, w, h)
    }
    if (itemId === 'moonflower') return moonflower(stage)
    if (itemId === 'crystalrose') return crystalRose(stage)
    const row = CROP_ROWS[itemId] ? itemId : 'lettuce'
    const col = (row === 'wheat' || row === 'sunflower') && stage === 3 ? 1 : CROP_COL[stage]
    return cropSpr(row, col)
  })
}

/* ---------------- pots & soil ---------------- */

const shadeHex = (h: string, amt: number) => {
  const [r, g, b] = hex(h)
  const t = amt < 0 ? 0 : 255
  const f = (v: number) => Math.round((t - v) * Math.abs(amt) + v).toString(16).padStart(2, '0')
  return `#${f(r)}${f(g)}${f(b)}`
}

export const potSpr = (potId: string): Spr =>
  cached(`pot:${potId}`, () => {
    const pot = ITEMS[potId] as PotDef
    const out = '#3b2418'
    return painter(20, 14, (p, r) => {
      const body = pot.color
      for (let y = 4; y < 13; y++) {
        const inset = Math.floor((y - 4) / 3)
        const x0 = 3 + inset
        const x1 = 16 - inset
        r(x0, y, x1 - x0 + 1, 1, body)
        p(x0, y, out)
        p(x1, y, out)
        p(x0 + 1, y, shadeHex(body, 0.25))
        r(x1 - 2, y, 2, 1, shadeHex(body, -0.25))
      }
      r(6, 13, 8, 1, out)
      r(1, 1, 18, 3, pot.rim)
      r(1, 0, 18, 1, out)
      r(0, 1, 1, 3, out)
      r(19, 1, 1, 3, out)
      r(1, 4, 18, 1, out)
      r(2, 1, 16, 1, shadeHex(pot.rim, 0.3))
      r(15, 2, 3, 2, shadeHex(pot.rim, -0.25))
      r(3, 1, 14, 1, '#4a2c18')
      if (pot.id === 'painted') for (let x = 5; x <= 14; x += 3) p(x, 7, '#ffffff')
      if (pot.id === 'glowing') {
        p(7, 7, '#e6dcff'); p(8, 8, '#e6dcff'); p(9, 7, '#e6dcff'); p(10, 8, '#e6dcff'); p(11, 7, '#e6dcff')
      }
      if (pot.id === 'golden') {
        p(12, 6, '#fff7c2'); p(11, 7, '#fff7c2'); p(13, 7, '#fff7c2'); p(12, 8, '#fff7c2')
      }
      if (pot.id === 'crystalpot') {
        r(6, 5, 1, 6, '#c4f6ff'); r(11, 5, 1, 5, '#c4f6ff'); p(13, 6, '#ffffff')
      }
    })
  })

/** a tilled plot that crops sit in */
export const soilSpr = (): Spr =>
  cached('soil', () => {
    const r = rng(11)
    return painter(28, 13, (p) => {
      for (let y = 0; y < 13; y++)
        for (let x = 0; x < 28; x++) {
          const dx = (x - 13.5) / 13.5
          const dy = (y - 6) / 6.3
          const d = dx * dx + dy * dy
          if (d > 1) continue
          let col = d > 0.78 ? '#5c3a22' : y % 3 === 1 ? '#87583a' : '#74492e'
          if (d <= 0.78 && r() < 0.08) col = '#5c3a22'
          if (d <= 0.78 && y % 3 === 1 && r() < 0.15) col = '#9a6a45'
          p(x, y, col)
        }
    }, 14, 7)
  })

/* ---------------- hand-painted decor ---------------- */

const OUT = '#2e1c14'
const WOOD = ['#5e3a24', '#7a4c2e', '#9a6640', '#b98252']

const lantern = () =>
  bitmap(
    [
      '....oooo....',
      '...oddddo...',
      '..oddddddo..',
      '..oyyyyyyo..',
      '..oyWWWWyo..',
      '..oyWWWWyo..',
      '..oyyWWyyo..',
      '..oyyyyyyo..',
      '..oddddddo..',
      '...oddddo...',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '.....dd.....',
      '....dddd....',
      '...odddddo..',
      '..ssssssss..',
    ],
    { o: OUT, d: '#3a3a46', y: '#f2a93a', W: '#fff2b0', s: 'rgba(30,40,20,.35)' },
  )

const bench = () =>
  painter(30, 20, (p, r) => {
    r(3, 18, 25, 2, 'rgba(30,40,20,.3)')
    for (const x of [3, 25]) {
      r(x, 2, 2, 17, OUT)
      r(x, 3, 1, 15, '#4a4a56')
    }
    const plank = (y: number) => {
      r(1, y, 28, 4, OUT)
      r(2, y + 1, 26, 2, WOOD[2])
      r(2, y + 1, 26, 1, WOOD[3])
      for (let x = 6; x < 27; x += 7) p(x, y + 2, WOOD[1])
    }
    plank(2)
    plank(6)
    plank(11)
    r(2, 15, 26, 2, WOOD[1])
    r(1, 15, 1, 2, OUT)
    r(28, 15, 1, 2, OUT)
  })

const fairyLights = () =>
  painter(32, 24, (p, r) => {
    for (const x of [1, 29]) {
      r(x, 3, 2, 20, OUT)
      r(x, 4, 1, 18, WOOD[2])
    }
    r(0, 22, 32, 2, 'rgba(30,40,20,.25)')
    const cols = ['#ff6b6b', '#ffd23f', '#6bd6ff', '#7fe27a', '#ff9ec8']
    let last = 0
    for (let x = 2; x < 30; x++) {
      const y = 5 + Math.round(Math.sin(((x - 2) / 27) * Math.PI) * 6)
      p(x, y, '#3a3a2a')
      if (x > 3 && x - last >= 4 && x < 29) {
        last = x
        const c = cols[(x / 4) % cols.length | 0]
        p(x, y + 1, OUT)
        r(x - 1, y + 2, 3, 2, c)
        p(x, y + 2, '#ffffff')
      }
    }
  })

const pond = () =>
  painter(32, 24, (p) => {
    const r = rng(5)
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 32; x++) {
        const d = ((x - 15.5) / 15.5) ** 2 + ((y - 12) / 11) ** 2
        if (d > 1) continue
        if (d > 0.78) p(x, y, r() < 0.5 ? '#8d938c' : '#a9b0a6')
        else if (d > 0.68) p(x, y, '#2a6f9a')
        else p(x, y, y < 9 ? '#4a9cd0' : y < 16 ? '#3f8cc2' : '#357db0')
      }
    for (const [x, y] of [[8, 8], [9, 8], [10, 8], [20, 16], [21, 16]]) p(x, y, '#bfe6ff')
    // lily pads + a flower
    for (const [cx, cy] of [[20, 10], [11, 15]])
      for (let y = -2; y <= 2; y++)
        for (let x = -3; x <= 3; x++) if (x * x / 9 + y * y / 4 <= 1 && !(x === 1 && y < 0)) p(cx + x, cy + y, y < 0 ? '#5aa83a' : '#3f8a2c')
    p(20, 9, '#ff9ec8'); p(21, 9, '#ffc6de'); p(20, 8, '#ff9ec8')
    for (const x of [3, 4, 27]) for (let y = 2; y < 8; y++) p(x, y, '#5a8a3a')
    p(3, 2, '#7a4a2a'); p(3, 3, '#7a4a2a')
  })

const fence = () =>
  painter(32, 22, (p, r) => {
    r(0, 20, 32, 2, 'rgba(30,40,20,.3)')
    const rail = (y: number) => {
      r(0, y, 32, 4, OUT)
      r(0, y + 1, 32, 2, WOOD[2])
      r(0, y + 1, 32, 1, WOOD[3])
    }
    rail(6)
    rail(13)
    for (const x of [2, 14, 26]) {
      r(x, 1, 5, 20, OUT)
      r(x + 1, 2, 3, 18, WOOD[2])
      r(x + 1, 2, 1, 18, WOOD[3])
      r(x + 3, 2, 1, 18, WOOD[1])
      p(x + 2, 0, OUT)
      p(x + 2, 1, WOOD[3])
    }
  })

const cobble = () =>
  painter(32, 32, (p, r) => {
    const rnd = rng(3)
    r(0, 0, 32, 32, '#7f7462')
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) {
        const ox = gx * 8 + (gy % 2 ? 4 : 0)
        const oy = gy * 8
        const col = ['#c9bea6', '#bdb198', '#d2c8b2', '#b3a68c'][Math.floor(rnd() * 4)]
        for (let y = 1; y < 7; y++)
          for (let x = 1; x < 7; x++) {
            if ((x === 1 || x === 6) && (y === 1 || y === 6)) continue
            const X = (ox + x) % 32
            p(X, oy + y, y === 1 ? '#e2d9c6' : y >= 5 ? '#9c8f76' : x === 6 ? '#ab9e84' : col)
          }
        if (rnd() < 0.4) p((ox + 2 + Math.floor(rnd() * 3)) % 32, oy + 3, '#8fa86a')
      }
  }, 16, 31)

const wildflowers = () =>
  cached('wildflowers', () => {
    const [cv, c] = canvas(32, 24)
    const pieces: [number, number, number, number, number, number][] = [
      [146, 774, 12, 18, 2, 4], [160, 771, 16, 11, 14, 12], [146, 774, 12, 18, 18, 2], [192, 768, 16, 16, 8, 8],
    ]
    for (const [x, y, w, h, dx, dy] of pieces) c.drawImage(img('exterior'), x, y, w, h, dx, dy, w, h)
    return spr(cv, 0, 0, 32, 24)
  })

/* ---------------- decor & pets ---------------- */

const ext = (x: number, y: number, w: number, h: number) => spr('exterior', x, y, w, h)

/** union bbox of an animated column so every frame shares an anchor */
function treeAnim(x0: number, x1: number) {
  return cached(`treeanim:${x0}`, () => {
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0
    for (let f = 0; f < 13; f++) {
      const b = bbox(img('trees'), x0, f * 80, x1 - x0, 80)
      minX = Math.min(minX, b.x)
      maxX = Math.max(maxX, b.x + b.w)
      minY = Math.min(minY, b.y - f * 80)
      maxY = Math.max(maxY, b.y - f * 80 + b.h)
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  })
}
const TREE_COLS: Record<string, [number, number]> = { oak: [64, 128], orchard: [260, 318], leafy: [446, 520] }

interface PetSheet {
  walk: File
  idle: File
  cell: number
  walkFrames: number
  idleFrames: number
  idleRow0: number
}
const farm = (f: File, cell = 32): PetSheet => ({ walk: f, idle: f, cell, walkFrames: 6, idleFrames: 4, idleRow0: 4 })
const hunt = (w: File, i: File, frames: number): PetSheet => ({ walk: w, idle: i, cell: 32, walkFrames: frames, idleFrames: 4, idleRow0: 0 })
export const PETS: Record<string, PetSheet> = {
  chick: farm('chick', 16),
  piglet: farm('piglet'),
  lamb: farm('lamb'),
  sheep: farm('sheep'),
  rooster: farm('rooster'),
  calf: farm('calf', 64),
  hare: hunt('hare_walk', 'hare_idle', 5),
  fox: hunt('fox_walk', 'fox_idle', 6),
  deer: hunt('deer_walk', 'deer_idle', 6),
}
export const isPet = (id: string) => id in PETS

/** feet line inside a cell, measured once per sheet */
const cellFeet = (f: File, cell: number) =>
  cached(`feet:${f}`, () => {
    const b = bbox(img(f), 0, 0, cell, cell)
    return b.y + b.h - 2
  })

/** dir: 0 down, 1 up, 2 left, 3 right */
export function petSpr(id: string, moving: boolean, dir: number, t: number): Spr {
  const p = PETS[id]
  const file = moving ? p.walk : p.idle
  const frames = moving ? p.walkFrames : p.idleFrames
  const row = (moving ? 0 : p.idleRow0) + dir
  const fps = moving ? 9 : 4
  const f = Math.floor(t * fps) % frames
  return spr(file, f * p.cell, row * p.cell, p.cell, p.cell, p.cell / 2, cellFeet(file, p.cell))
}

/** the garden cat pops out of the grass, sits, then hides again */
function catSpr(t: number): Spr {
  const cycle = 16
  const u = t % cycle
  let row: number
  if (u < 3) row = Math.floor((u / 3) * 9) + 9
  else if (u < 12) row = 17
  else if (u < 13.5) row = 17 - Math.floor(((u - 12) / 1.5) * 9)
  else row = 8 - Math.min(8, Math.floor(((u - 13.5) / 2.5) * 9))
  const col = Math.floor(t * 4) % 3
  return spr('cat', col * 32, row * 32, 32, 32, 16, 28)
}

const DECOR_ART: Record<string, () => Spr> = {
  path: cobble,
  fence,
  flowers: wildflowers,
  lantern,
  bench,
  fairylights: fairyLights,
  pond,
  crates: () => ext(119, 464, 25, 37),
  scarecrow: () => ext(4, 547, 52, 56),
  well: () => ext(48, 498, 38, 38),
  bush: () => ext(198, 358, 36, 37),
  fernclump: () => ext(6, 455, 36, 34),
  mushrooms: () => ext(69, 595, 24, 25),
  toadstool: () => ext(64, 548, 32, 41),
  log: () => ext(88, 630, 36, 22),
  stump: () => ext(165, 635, 37, 28),
  boulder: () => ext(132, 672, 38, 45),
  cairn: () => ext(178, 729, 29, 30),
  shrub: () => ext(3, 610, 43, 43),
  chanterelles: () => trim('f_chanterelles'),
  glowshroom: () => trim('f_beige_mushroom'),
  whitetree: () => trim('f_white'),
  bluegreen: () => trim('f_bluegreen'),
  willow: () => trim('f_willow'),
  swirl: () => trim('f_swirl'),
  lightballs: () => trim('f_lightballs'),
  luminous: () => trim('f_luminous'),
  idoldeer: () => trim('f_idol_deer'),
  idolwolf: () => trim('f_idol_wolf'),
  gazebo: () => trim('f_gazebo'),
  ent: () => trim('f_ent'),
  frost: () => trim('r_frost'),
  ember: () => trim('r_ember'),
  quartz: () => trim('r_quartz'),
  mossrock: () => trim('r_mossy'),
}

/** decor sprite at time t (some decor is animated) */
export function decorSpr(id: string, t = 0): Spr {
  if (id === 'cat') return catSpr(t)
  if (TREE_COLS[id]) {
    const b = treeAnim(...TREE_COLS[id])
    const frame = Math.floor(t * 6) % 13
    return spr('trees', b.x, b.y + frame * 80, b.w, b.h)
  }
  if (PETS[id]) return petSpr(id, false, 0, t)
  return cached(`decor:${id}`, () => (DECOR_ART[id] ?? cobble)())
}

/** colour of the soft light some things give off at night */
export const GLOW: Record<string, string> = {
  lantern: '255,214,120', fairylights: '255,230,150', luminous: '150,240,220', lightballs: '255,230,140',
  moonflower: '170,200,255', crystalrose: '255,150,230', frost: '170,230,255', ember: '255,150,70',
  glowshroom: '200,255,170', crystalpot: '170,240,255',
}

/* ---------------- character ---------------- */

const BASE_SKIN = ['#ffca96', '#e9b38e', '#c08a7b', '#a5746c', '#7e5655'].map(hex)
const SKIN_RAMPS = [
  ['#ffe2c8', '#f7cfae', '#e0ae90', '#c48d78', '#9a6a5c'],
  ['#ffca96', '#e9b38e', '#c08a7b', '#a5746c', '#7e5655'],
  ['#efb680', '#d89c6a', '#b67a56', '#946048', '#6e4535'],
  ['#c68a5c', '#aa7049', '#8a573b', '#6e4330', '#502f22'],
  ['#946042', '#7c4e34', '#643d29', '#4e2e1f', '#362015'],
]
const OUTLINE = hex('#59312e')
const HAIR_TIE = hex('#f2c94c')

interface OutfitPal {
  top: string[]
  legs: string[]
  shoes: string[]
  bib?: string[]
  belt?: string
  trim?: string
  cape?: string[]
  longTop?: boolean
}
const OUTFITS: Record<string, OutfitPal> = {
  overalls: { top: ['#fff6e0', '#efe4c8', '#d8c9a8', '#b8a684', '#8f7d60'], bib: ['#7fa8e0', '#5a86c8', '#4a6fa5', '#3a5682', '#2a3e60'], legs: ['#7fa8e0', '#5a86c8', '#4a6fa5', '#3a5682', '#2a3e60'], shoes: ['#8a5a30', '#6b4226', '#55331c', '#3e2414', '#2a180c'] },
  tunic: { top: ['#8fc0ff', '#5f9ae8', '#3f78c4', '#2e5c9c', '#1f4070'], legs: ['#a8784a', '#8a5f38', '#6b4a2a', '#52381f', '#3a2714'], shoes: ['#6b4226', '#55331c', '#3e2414', '#2a180c', '#1c1008'], belt: '#5a3a1e', trim: '#f2c94c' },
  cloak: { top: ['#ff8a7a', '#e05a50', '#c43f3f', '#962e30', '#6a1f22'], legs: ['#a8784a', '#8a5f38', '#6b4a2a', '#52381f', '#3a2714'], shoes: ['#55331c', '#3e2414', '#2a180c', '#1c1008', '#120a04'], cape: ['#c43f3f', '#962e30', '#7a1f22', '#5a1418', '#3e0c10'], trim: '#f2c94c' },
  robe: { top: ['#b8a0f0', '#8f72d8', '#6a4ca8', '#4f3884', '#36265c'], legs: ['#b8a0f0', '#8f72d8', '#6a4ca8', '#4f3884', '#36265c'], shoes: ['#3e2a60', '#2e1f48', '#201534', '#150d24', '#0c0716'], trim: '#f2c94c', longTop: true },
  armor: { top: ['#fff0a0', '#f2c94c', '#d6a52a', '#a67a1c', '#6e4e10'], legs: ['#d8dde8', '#aab2c4', '#8890a4', '#646a7c', '#444858'], shoes: ['#646a7c', '#444858', '#2e3140', '#1e2030', '#12141e'], belt: '#6e4e10' },
}

const HATS: Record<string, { rows: string[]; pal: Record<string, string>; dy: number }> = {
  strawhat: {
    rows: ['....ooooo....', '...obbbbbo...', '...orrrrro...', '.oobbbbbbboo.', 'obbhbbbbbbbbo', '.ooooooooooo.'],
    pal: { o: '#7a5a20', b: '#e5c76b', h: '#fbe7a0', r: '#c43f3f' },
    dy: 3,
  },
  flowercrown: {
    rows: ['.p.y.w.p.y.', 'gpgygwgpgyg', '.g.g.g.g.g.'],
    pal: { p: '#ff9ec8', y: '#ffd23f', w: '#ffffff', g: '#4a9a3c' },
    dy: 2,
  },
  catears: {
    rows: ['o.........o', 'oo.......oo', 'opo.....opo', 'oppo...oppo'],
    pal: { o: '#2e2e3a', p: '#ff9ec8' },
    dy: 3,
  },
  wizardhat: {
    rows: ['.......oo....', '......opo....', '.....oppo....', '....opppyo...', '....oppppo...', '...opppppo...', '...oyyyyyyo..', 'oopppppppppoo', 'ooooooooooooo'],
    pal: { o: '#2a1a4a', p: '#5a3fa8', y: '#ffd23f' },
    dy: 3,
  },
  crown: {
    rows: ['y...y...y', 'yy.yry.yy', 'yyyyyyyyy', 'ybyyryyby', 'ooooooooo'],
    pal: { y: '#f2c94c', r: '#e8505b', b: '#4fd0e8', o: '#a67a1c' },
    dy: 2,
  },
}

function nearestLevel(r: number, g: number, b: number) {
  let best = -1
  let bd = 1e9
  BASE_SKIN.forEach(([R, G, B], i) => {
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2
    if (d < bd) {
      bd = d
      best = i
    }
  })
  return bd < 900 ? best : -1
}
const isOutline = (r: number, g: number, b: number) => (r - OUTLINE[0]) ** 2 + (g - OUTLINE[1]) ** 2 + (b - OUTLINE[2]) ** 2 < 500

/**
 * Builds a recoloured sprite sheet (64px cells, rows = down/left/right/up)
 * with the player's skin, hair and clothes painted onto the base character.
 * `first` paints only the first frame facing front, which is all a portrait needs.
 */
function buildCharacter(av: Avatar, anim: 'walk' | 'idle', first = false): HTMLCanvasElement {
  const body = img(anim === 'walk' ? 'girl_walk_body' : 'girl_idle_body')
  const head = img(anim === 'walk' ? 'girl_walk_head' : 'girl_idle_head')
  const W = body.width
  const H = body.height
  // a portrait only needs the first 64px cell, so it gets a canvas that size
  const OW = first ? 64 : W
  const OH = first ? 64 : H
  const [cv, c] = canvas(OW, OH)
  const skin = SKIN_RAMPS[av.skin] ?? SKIN_RAMPS[1]
  const ramp = hairRamp(hairColorOf(av))
  const tipRamp = validHex(av.hairTip) ? hairRamp(av.hairTip) : null
  const spec = specOf(av)
  const o = OUTFITS[av.outfit ?? 'overalls'] ?? OUTFITS.overalls
  const B = pixels(body)
  const Hd = pixels(head)
  // behind the body, body and head, over the body
  const [cvBack, cBack] = canvas(OW, OH)
  const [cvMain, cMain] = canvas(OW, OH)
  const [cvFront, cFront] = canvas(OW, OH)
  const outBack = cBack.createImageData(OW, OH)
  const out = cMain.createImageData(OW, OH)
  const outFront = cFront.createImageData(OW, OH)
  const paint = (img: ImageData, x: number, y: number, rgb: RGB) => {
    if (x < 0 || y < 0 || x >= OW || y >= OH) return
    const k = (y * OW + x) * 4
    img.data[k] = rgb[0]
    img.data[k + 1] = rgb[1]
    img.data[k + 2] = rgb[2]
    img.data[k + 3] = 255
  }
  const put = (x: number, y: number, rgb: RGB) => paint(out, x, y, rgb)
  const hairOutline = hex(ramp[4])
  const plot = (img: ImageData, pts: HairPt[], ox: number, oy: number, mirrorW: number) => {
    for (const p of pts) {
      const rgb = p.s === TIE ? HAIR_TIE : hex(((tipRamp && p.t > 0.5 ? tipRamp : ramp))[p.s])
      paint(img, ox + (mirrorW ? mirrorW - 1 - p.x : p.x), oy + p.y, rgb)
    }
  }

  const rows = first ? 1 : H / 64
  const cols = first ? 1 : W / 64
  for (let cy = 0; cy < rows; cy++)
    for (let cx = 0; cx < cols; cx++) {
      const dir = cy // 0 down, 1 left, 2 right, 3 up
      const bb = bbox(body, cx * 64, cy * 64, 64, 64)
      const hb = bbox(head, cx * 64, cy * 64, 64, 64)

      // body: clothes by height band, skin for the hands
      for (let y = bb.y; y < bb.y + bb.h; y++) {
        const rel = (y - bb.y) / bb.h
        let rowMin = 99, rowMax = -1
        for (let x = bb.x; x < bb.x + bb.w; x++)
          if (B.data[(y * W + x) * 4 + 3] > 10) {
            rowMin = Math.min(rowMin, x)
            rowMax = Math.max(rowMax, x)
          }
        for (let x = bb.x; x < bb.x + bb.w; x++) {
          const k = (y * W + x) * 4
          if (B.data[k + 3] < 10) continue
          const r = B.data[k], g = B.data[k + 1], b = B.data[k + 2]
          if (isOutline(r, g, b)) {
            put(x, y, OUTLINE)
            continue
          }
          const lv = nearestLevel(r, g, b)
          if (lv < 0) {
            put(x, y, [r, g, b])
            continue
          }
          const nx = (x - bb.x) / bb.w
          const hand = rel > 0.38 && rel < 0.56 && (x === rowMin || x === rowMax) && dir !== 3
          let rp: string[]
          if (hand) rp = skin
          else if (rel < (o.longTop ? 0.86 : 0.52)) {
            rp = o.top
            if (o.bib && rel > 0.22 && nx > 0.28 && nx < 0.72 && dir !== 3) rp = o.bib
            if (o.cape && dir === 3) rp = o.cape
            if (o.belt && Math.abs(rel - 0.47) < 0.05) {
              put(x, y, hex(o.belt))
              continue
            }
            if (o.trim && dir === 0 && Math.abs(nx - 0.5) < 0.09 && rel > 0.1) {
              put(x, y, hex(o.trim))
              continue
            }
          } else if (rel < 0.86) rp = o.cape && dir === 3 && rel < 0.75 ? o.cape : o.legs
          else rp = o.shoes
          put(x, y, hex(rp[lv]))
        }
      }

      // head: skin, with hair painted over whatever the cut covers
      for (let y = hb.y; y < hb.y + hb.h; y++)
        for (let x = hb.x; x < hb.x + hb.w; x++) {
          const k = (y * W + x) * 4
          if (Hd.data[k + 3] < 10) continue
          const r = Hd.data[k], g = Hd.data[k + 1], b = Hd.data[k + 2]
          const hair = hairCovers(dir, x - hb.x, y - hb.y, hb.w, spec)
          const outline = isOutline(r, g, b)
          const lv = nearestLevel(r, g, b)
          if (hair && (lv >= 0 || outline)) put(x, y, outline ? hairOutline : hex(ramp[Math.min(4, lv + 1)]))
          else if (outline) put(x, y, OUTLINE)
          else if (lv >= 0) put(x, y, hex(skin[lv]))
          else put(x, y, [r, g, b])
        }
      // a small highlight so the crown reads as hair
      if (spec.cut > 0 && dir !== 3) {
        put(hb.x + Math.round(hb.w * 0.35), hb.y + 2, hex(ramp[0]))
        put(hb.x + Math.round(hb.w * 0.35) + 1, hb.y + 2, hex(ramp[0]))
      }

      // everything that hangs off the head, behind and in front of the body
      const lay = hairOverhang(dir, spec)
      const mirror = dir === 2 ? hb.w : 0
      plot(outBack, lay.back, hb.x, hb.y, mirror)
      plot(outFront, lay.front, hb.x, hb.y, mirror)
    }
  cBack.putImageData(outBack, 0, 0)
  cMain.putImageData(out, 0, 0)
  cFront.putImageData(outFront, 0, 0)
  c.drawImage(cvBack, 0, 0)
  c.drawImage(cvMain, 0, 0)
  c.drawImage(cvFront, 0, 0)

  // hats sit on top of everything
  const hat = av.hat && HATS[av.hat]
  if (hat) {
    const hs = bitmap(hat.rows, hat.pal)
    for (let cy = 0; cy < rows; cy++)
      for (let cx = 0; cx < cols; cx++) {
        const hb = bbox(head, cx * 64, cy * 64, 64, 64)
        const centre = hb.x + Math.floor(hb.w / 2) + (cy === 1 ? 1 : cy === 2 ? -1 : 0)
        c.drawImage(hs.img, centre - Math.floor(hs.w / 2), hb.y - hs.h + hat.dy)
      }
  }
  return cv
}

/** everything about an avatar that changes how it is drawn, as a cache key */
const avatarKey = (av: Avatar) => {
  const s = specOf(av)
  return [av.skin, s.cut, s.fringe, s.back, s.tail, hairColorOf(av), validHex(av.hairTip) ? av.hairTip : '', av.hat ?? '', av.outfit ?? ''].join(':')
}

export const charSheet = (av: Avatar, anim: 'walk' | 'idle') =>
  cached(`char:${anim}:${avatarKey(av)}`, () => buildCharacter(av, anim))

/** dir: 0 down, 1 up, 2 left, 3 right (same as pets) */
export function avatarSpr(av: Avatar, moving: boolean, dir: number, t: number): Spr {
  const sheet = charSheet(av, moving ? 'walk' : 'idle')
  const row = [0, 3, 1, 2][dir]
  const frames = moving ? 6 : 12
  const f = Math.floor(t * (moving ? 10 : 6)) % frames
  return spr(sheet, f * 64, row * 64, 64, 64, 31, 43)
}
export const avatarShadow = () => spr('girl_shadow', 8, 8, 15, 7, 7, 3)

/* ---------------- bosses ---------------- */

export type BossKind = 'boar' | 'fox' | 'deer' | 'hare' | 'grouse'
const BOSS_FILES: Record<BossKind, [File, File, number]> = {
  boar: ['boar_idle', 'boar_death', 6],
  fox: ['fox_idle', 'fox_death', 6],
  deer: ['deer_idle', 'deer_death', 7],
  hare: ['hare_idle', 'hare_death', 6],
  grouse: ['grouse_idle', 'grouse_death', 6],
}
export function bossSpr(kind: BossKind, t: number, defeated: boolean): Spr {
  const [idle, death, n] = BOSS_FILES[kind]
  if (defeated) return spr(death, (n - 1) * 32, 0, 32, 32, 16, 28)
  return spr(idle, (Math.floor(t * 5) % 4) * 32, 0, 32, 32, 16, 28)
}

/* ---------------- ground ---------------- */

interface Decal {
  x: number
  y: number
  w: number
  h: number
}
const decals = () =>
  cached('decals', () => {
    const src = img('grass_details')
    const d = pixels(src)
    const seen = new Uint8Array(d.width * d.height)
    const out: { tuft: Decal[]; pebble: Decal[] } = { tuft: [], pebble: [] }
    for (let y = 0; y < d.height; y++)
      for (let x = 0; x < d.width; x++) {
        const k = y * d.width + x
        if (seen[k] || d.data[k * 4 + 3] < 10) continue
        let x0 = x, y0 = y, x1 = x, y1 = y, n = 0
        const st = [k]
        seen[k] = 1
        while (st.length) {
          const q = st.pop()!
          const qx = q % d.width
          const qy = (q - qx) / d.width
          n++
          x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const nx = qx + dx, ny = qy + dy
              if (nx < 0 || ny < 0 || nx >= d.width || ny >= d.height) continue
              const nk = ny * d.width + nx
              if (!seen[nk] && d.data[nk * 4 + 3] > 10) {
                seen[nk] = 1
                st.push(nk)
              }
            }
        }
        if (n < 8) continue
        const dec = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
        ;(y0 < 130 ? out.pebble : out.tuft).push(dec)
      }
    return out
  })

interface ZoneLook {
  base: string[]
  tufts: number
  pebbles: number
}
const LOOKS: Record<string, ZoneLook> = {
  meadow: { base: ['#76a950', '#6b9d49', '#80b357', '#8abd5f'], tufts: 80, pebbles: 14 },
  grove: { base: ['#4a8450', '#41774a', '#538f56', '#3a6b43'], tufts: 70, pebbles: 10 },
  cave: { base: ['#45435c', '#3c3a52', '#4f4d68', '#353348'], tufts: 0, pebbles: 26 },
  sky: { base: ['#e6f2fb', '#d8eaf8', '#f2f8fd', '#cfe3f4'], tufts: 0, pebbles: 0 },
  greenhouse: { base: ['#b48a5a', '#a67c4e', '#c29866', '#946c42'], tufts: 0, pebbles: 0 },
}

function paintBase(c: C, zone: string, w: number, h: number, r: () => number) {
  const L = LOOKS[zone] ?? LOOKS.meadow
  c.fillStyle = L.base[0]
  c.fillRect(0, 0, w, h)
  if (zone === 'greenhouse') {
    for (let y = 0; y < h; y += 8) {
      const off = (y / 8) % 2 ? 16 : 0
      for (let x = -off; x < w; x += 32) {
        const tone = L.base[Math.floor(r() * 3)]
        c.fillStyle = tone
        c.fillRect(x, y, 32, 8)
        c.fillStyle = '#7a5634'
        c.fillRect(x, y + 7, 32, 1)
        c.fillRect(x + 31, y, 1, 8)
        c.fillStyle = shadeHex(tone, 0.12)
        c.fillRect(x, y, 31, 1)
        c.fillStyle = shadeHex(tone, -0.12)
        for (let g = 0; g < 3; g++) c.fillRect(x + 3 + Math.floor(r() * 26), y + 2 + Math.floor(r() * 4), 4 + Math.floor(r() * 5), 1)
        c.fillStyle = '#5a3e26'
        c.fillRect(x + 2, y + 3, 1, 1)
        c.fillRect(x + 28, y + 3, 1, 1)
      }
    }
    return
  }
  // organic patches from value noise, banded into a few shades with a
  // pixel-dithered edge, the way hand-painted pixel grass is shaded
  const lattice = (ix: number, iy: number, s: number) => {
    let hsh = Math.imul(ix * 374761393 + iy * 668265263 + s, 1274126177)
    hsh ^= hsh >>> 15
    return ((hsh >>> 0) % 10007) / 10007
  }
  const smooth = (v: number) => v * v * (3 - 2 * v)
  const noise = (x: number, y: number, cell: number, s: number) => {
    const gx = x / cell
    const gy = y / cell
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    const fx = smooth(gx - ix)
    const fy = smooth(gy - iy)
    const a = lattice(ix, iy, s) + (lattice(ix + 1, iy, s) - lattice(ix, iy, s)) * fx
    const b = lattice(ix, iy + 1, s) + (lattice(ix + 1, iy + 1, s) - lattice(ix, iy + 1, s)) * fx
    return a + (b - a) * fy
  }
  const ramp = [...L.base].sort((p, q) => hsl(...hex(p)).l - hsl(...hex(q)).l)
  const seed = Math.floor(r() * 1e6)
  const bayer = [0, 0.5, 0.75, 0.25]
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = noise(x, y, 26, seed) * 0.7 + noise(x, y, 9, seed + 7) * 0.3
      const q = Math.max(0, Math.min(ramp.length - 1, Math.floor(n * ramp.length + (bayer[(x % 2) + (y % 2) * 2] - 0.5) * 0.45)))
      c.fillStyle = ramp[q]
      c.fillRect(x, y, 1, 1)
    }
  // single-pixel flecks for texture
  for (let i = 0; i < (w * h) / 40; i++) {
    c.fillStyle = r() < 0.5 ? ramp[0] : ramp[ramp.length - 1]
    c.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1)
  }
  if (zone === 'sky') {
    for (let i = 0; i < 26; i++) {
      const cx = Math.floor(r() * w)
      const cy = Math.floor(r() * h)
      const s = 3 + Math.floor(r() * 5)
      for (let y = -s; y <= s; y++)
        for (let x = -s * 2; x <= s * 2; x++) {
          const d = (x / (s * 2)) ** 2 + (y / s) ** 2
          if (d > 1) continue
          c.fillStyle = y > s * 0.4 ? '#c6dcef' : '#ffffff'
          c.fillRect(cx + x, cy + y, 1, 1)
        }
    }
  }
  if (zone === 'cave') {
    c.fillStyle = '#2a283a'
    for (let i = 0; i < 30; i++) {
      let x = Math.floor(r() * w)
      let y = Math.floor(r() * h)
      for (let k = 0; k < 8; k++) {
        c.fillRect(x, y, 1, 1)
        x += Math.floor(r() * 3) - 1
        y += r() < 0.5 ? 1 : 0
      }
    }
    for (let i = 0; i < 50; i++) {
      c.fillStyle = r() < 0.5 ? '#7fe9ff' : '#c9a8ff'
      c.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1, 1)
    }
  }
  const D = decals()
  const src = img('grass_details')
  for (let i = 0; i < L.tufts && D.tuft.length; i++) {
    const d = D.tuft[Math.floor(r() * D.tuft.length)]
    c.drawImage(src, d.x, d.y, d.w, d.h, Math.floor(r() * w), Math.floor(r() * h), d.w, d.h)
  }
  for (let i = 0; i < L.pebbles && D.pebble.length; i++) {
    const d = D.pebble[Math.floor(r() * D.pebble.length)]
    if (zone === 'cave') c.globalAlpha = 0.55
    c.drawImage(src, d.x, d.y, d.w, d.h, Math.floor(r() * w), Math.floor(r() * h), d.w, d.h)
    c.globalAlpha = 1
  }
}

/** scenery strip: things that sit behind the plots */
export interface Prop {
  s: (t: number) => Spr
  x: number
  y: number
  flip?: boolean
}
export function bandProps(zone: string): Prop[] {
  const at = (id: string, x: number, y: number, flip = false): Prop => ({ s: (t) => decorSpr(id, t + x * 0.37), x, y, flip })
  switch (zone) {
    case 'grove':
      return [at('willow', 18, 40), at('leafy', 62, 38), at('swirl', 112, 40), at('oak', 160, 38, true), at('bluegreen', 204, 40), at('leafy', 244, 38, true)]
    case 'cave':
      return [at('frost', 20, 40), at('mossrock', 66, 38), at('ember', 116, 40), at('quartz', 168, 38), at('frost', 222, 40)]
    case 'greenhouse':
      return []
    case 'sky':
      return []
    default:
      return [at('oak', 14, 38), at('orchard', 58, 36), at('bush', 100, 36), at('leafy', 142, 38, true), at('shrub', 186, 36), at('oak', 236, 38, true)]
  }
}

function paintBand(c: C, zone: string, r: () => number) {
  if (zone === 'greenhouse') {
    c.fillStyle = '#6a8a72'
    c.fillRect(0, 0, GW, BAND)
    for (let x = 0; x < GW; x += 32) {
      c.fillStyle = '#cfe8e0'
      c.fillRect(x + 2, 4, 28, 26)
      c.fillStyle = '#e8f6f2'
      c.fillRect(x + 4, 6, 10, 10)
      c.fillRect(x + 17, 6, 11, 10)
      c.fillRect(x + 4, 18, 10, 10)
      c.fillRect(x + 17, 18, 11, 10)
      c.fillStyle = '#ffffff'
      c.fillRect(x + 5, 7, 3, 1)
      c.fillRect(x + 18, 7, 3, 1)
      c.fillStyle = '#4a6a52'
      c.fillRect(x, 0, 2, BAND)
    }
    c.fillStyle = '#7a5634'
    c.fillRect(0, 30, GW, 10)
    c.fillStyle = '#946c42'
    c.fillRect(0, 30, GW, 2)
    for (let x = 6; x < GW; x += 22) {
      const s = plantSpr(['lettuce', 'chili', 'cauliflower', 'carrot', 'sunflower'][Math.floor(r() * 5)], 4)
      drawSpr(c, potSpr(['clay', 'painted'][Math.floor(r() * 2)]), x + 6, 39)
      drawSpr(c, s, x + 6, 31)
    }
    return
  }
  if (zone === 'sky') {
    const g = c.createLinearGradient(0, 0, 0, BAND)
    g.addColorStop(0, '#9fd0f5')
    g.addColorStop(1, '#d8ecfb')
    c.fillStyle = g
    c.fillRect(0, 0, GW, BAND)
    for (let i = 0; i < 9; i++) {
      const cx = 10 + i * 30 + Math.floor(r() * 10)
      const cy = 24 + Math.floor(r() * 10)
      const s = 6 + Math.floor(r() * 5)
      for (let y = -s; y <= s; y++)
        for (let x = -s * 2; x <= s * 2; x++) {
          if ((x / (s * 2)) ** 2 + (y / s) ** 2 > 1) continue
          c.fillStyle = y > s * 0.3 ? '#cfe2f3' : '#ffffff'
          c.fillRect(cx + x, cy + y, 1, 1)
        }
    }
    return
  }
  // grassy band a shade darker so the plots read as a clearing
  c.fillStyle = 'rgba(0,0,0,.12)'
  c.fillRect(0, 0, GW, BAND)
}

function paintLocked(c: C, zone: string, cols: number, rows: number, r: () => number) {
  const ux = cols * T
  const uy = BAND + rows * T
  const tint: Record<string, string> = {
    meadow: 'rgba(20,40,20,.45)', grove: 'rgba(10,25,15,.5)', greenhouse: 'rgba(40,25,12,.5)',
    cave: 'rgba(8,6,20,.6)', sky: 'rgba(90,120,160,.35)',
  }
  const wild = zone === 'meadow' || zone === 'grove'
  const D = decals()
  for (let ty = 0; ty < GRID_H; ty++)
    for (let tx = 0; tx < GRID_W; tx++) {
      if (tx < cols && ty < rows) continue
      const X = tx * T
      const Y = BAND + ty * T
      if (wild) {
        for (let k = 0; k < 6 && D.tuft.length; k++) {
          const d = D.tuft[Math.floor(r() * D.tuft.length)]
          c.drawImage(img('grass_details'), d.x, d.y, d.w, d.h, X + Math.floor(r() * 26), Y + Math.floor(r() * 26), d.w, d.h)
        }
      }
    }
  c.fillStyle = tint[zone] ?? tint.meadow
  c.fillRect(ux, BAND, GW - ux, GH - BAND)
  c.fillRect(0, uy, ux, GH - uy)
  const wildProps: Record<string, (() => Spr)[]> = {
    meadow: [() => decorSpr('bush'), () => decorSpr('shrub'), () => decorSpr('fernclump'), () => decorSpr('bush')],
    grove: [() => decorSpr('bush'), () => decorSpr('shrub'), () => decorSpr('fernclump'), () => decorSpr('chanterelles')],
    cave: [() => trim('r_frost_small'), () => decorSpr('mossrock'), () => trim('r_frost_small'), () => decorSpr('cairn')],
    greenhouse: [() => decorSpr('crates'), () => potSpr('clay'), () => potSpr('painted')],
  }
  const props = wildProps[zone]
  if (props) {
    for (let ty = 0; ty < GRID_H; ty++)
      for (let tx = 0; tx < GRID_W; tx++) {
        if (tx < cols && ty < rows) continue
        if (r() < 0.45) {
          const s = props[Math.floor(r() * props.length)]()
          c.globalAlpha = 0.8
          drawSpr(c, s, tx * T + 16 + Math.floor(r() * 8 - 4), BAND + ty * T + 30)
          c.globalAlpha = 1
        }
      }
  }
  // the boundary: a ledge on the ground in most zones. On grass it is a real fence, drawn with the
  // other props (see fenceProps) so the plants and animals inside stand behind it.
  if (!wild) {
    const ledge = zone === 'sky' ? '#ffffff' : zone === 'cave' ? '#6a6888' : '#7a5634'
    c.fillStyle = ledge
    if (rows < GRID_H) c.fillRect(0, uy - 2, ux, 3)
    if (cols < GRID_W) c.fillRect(ux - 1, BAND, 3, uy - BAND)
  }
}

const fencePost = () =>
  painter(5, 6, (_p, r) => {
    r(0, 0, 5, 6, OUT)
    r(1, 0, 3, 5, WOOD[2])
    r(1, 0, 1, 5, WOOD[3])
  }, 2, 5)

/**
 * The fence along the edge of the unlocked land on grassy zones. These are scene props sorted by their
 * feet like everything else, so anything growing inside the garden is drawn behind the fence.
 */
export function fenceProps(zone: string, cols: number, rows: number): Prop[] {
  if (zone !== 'meadow' && zone !== 'grove') return []
  const out: Prop[] = []
  const ux = cols * T
  const uy = BAND + rows * T
  if (rows < GRID_H) {
    // sits just below the last row, so the plants stand right behind its top edge
    for (let x = 0; x < ux; x += 32) out.push({ s: () => decorSpr('fence'), x: x + 16, y: uy + 13 })
  }
  if (cols < GRID_W) {
    for (let y = BAND; y < uy; y += 6) out.push({ s: () => cached('fencepost', fencePost), x: ux - 1, y: y + 5 })
  }
  return out
}

/** whole static floor for a zone: band, ground, plot marks and locked land. Cached. */
export const groundCanvas = (zone: string, cols: number, rows: number) =>
  cached(`ground:${zone}:${cols}:${rows}`, () => {
    const [cv, c] = canvas(GW, GH)
    const r = rng(seedOf(`ground-${zone}`))
    paintBase(c, zone, GW, GH, r)
    paintBand(c, zone, rng(seedOf(`band-${zone}`)))
    // little corner marks so the plots still read as tiles
    c.fillStyle = zone === 'cave' ? 'rgba(255,255,255,.12)' : zone === 'sky' ? 'rgba(80,120,170,.25)' : 'rgba(255,255,255,.22)'
    for (let ty = 0; ty <= rows; ty++)
      for (let tx = 0; tx <= cols; tx++) {
        const x = tx * T
        const y = BAND + ty * T
        c.fillRect(x - 1, y, 3, 1)
        c.fillRect(x, y - 1, 1, 3)
      }
    paintLocked(c, zone, cols, rows, rng(seedOf(`wild-${zone}`)))
    return cv
  })

/* ---------------- icons for the UI ---------------- */

/** crop a sprite to its visible pixels (keeps the anchor relative to the new rect) */
function tight(s: Spr): Spr {
  const b = bbox(s.img, s.x, s.y, s.w, s.h)
  return { img: s.img, x: b.x, y: b.y, w: b.w, h: b.h, ax: s.ax - (b.x - s.x), ay: s.ay - (b.y - s.y) }
}

/** a compact standalone image of an item (or plant stage), cropped to its pixels */
export function iconSpr(itemId: string, stage?: number, pot?: string, t = 0): Spr {
  const s = rawIcon(itemId, stage, pot, t)
  const animated = PETS[itemId] || itemId === 'cat' || TREE_COLS[itemId]
  return animated ? tight(s) : cached(`tight:${itemId}:${stage}:${pot}`, () => tight(s))
}

function rawIcon(itemId: string, stage?: number, pot?: string, t = 0): Spr {
  const it = ITEMS[itemId]
  if (!it) return spr(blank, 0, 0, 1, 1)
  if (it.kind === 'cosmetic') {
    const av: Avatar = { ...DEFAULT_AVATAR, [it.slot]: it.id }
    return portraitSpr(av)
  }
  if (it.kind === 'pot') return potSpr(itemId)
  if (it.kind === 'plant') {
    const st = stage ?? 4
    if (!pot) return plantSpr(itemId, st)
    return cached(`potted:${itemId}:${st}:${pot}`, () => {
      const ps = potSpr(pot)
      const pl = plantSpr(itemId, st)
      const w = Math.max(ps.w, pl.w)
      const h = pl.h + ps.h - 3
      const [cv, c] = canvas(w, h)
      drawSpr(c, ps, Math.floor(w / 2), h - 1)
      drawSpr(c, pl, Math.floor(w / 2), h - ps.h + 3)
      return spr(cv, 0, 0, w, h)
    })
  }
  if (PETS[itemId]) return petSpr(itemId, false, 3, t)
  return decorSpr(itemId, t)
}

/** head-and-shoulders crop of the avatar for the HUD */
export const portraitSpr = (av: Avatar): Spr =>
  cached(`portrait:${avatarKey(av)}`, () => {
    const sheet = buildCharacter(av, 'idle', true)
    const b = bbox(sheet, 0, 0, 64, 64)
    return spr(sheet, b.x - 1, b.y - 1, b.w + 2, b.h + 2)
  })
