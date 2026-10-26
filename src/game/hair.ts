import { HAIR } from './data'
import type { Avatar, HairSpec } from './types'

/*
 * Modular hair for the pixel character. A hairstyle is four independent choices:
 *   cut     what covers the head itself (crop, spikes, mohawk, afro...)
 *   fringe  the hair that falls over the forehead
 *   back    hair hanging down behind and over the shoulders
 *   tail    ponytails, pigtails, buns and braids
 * Each is painted procedurally on three layers: behind the body, on the head, over the body.
 * Coordinates are relative to the head's top-left pixel. The head is 13 wide facing front or back
 * and 12 wide in profile; side views are designed facing left and mirrored for facing right.
 */

export const CUTS = ['Bald', 'Buzz', 'Short', 'Medium', 'Full', 'Spiky', 'Mohawk', 'Afro']
export const FRINGES = ['None', 'Blunt', 'Side-swept', 'Curtains', 'Heavy', 'Wispy']
export const BACKS = ['None', 'Bob', 'Shoulder', 'Long', 'Waist']
export const TAILS = ['None', 'Ponytail', 'High pony', 'Pigtails', 'Top bun', 'Low bun', 'Twin buns', 'Braid', 'Twin braids']

const S = (cut: number, fringe: number, back: number, tail: number): HairSpec => ({ cut, fringe, back, tail })

/** the first three keep the meaning old saves gave them (short, long, bun) */
export const HAIR_PRESETS: { name: string; spec: HairSpec }[] = [
  { name: 'Short', spec: S(2, 0, 0, 0) },
  { name: 'Long', spec: S(3, 3, 3, 0) },
  { name: 'Bun', spec: S(2, 0, 0, 4) },
  { name: 'Bob', spec: S(3, 1, 1, 0) },
  { name: 'Pixie', spec: S(2, 2, 0, 0) },
  { name: 'Wavy', spec: S(4, 2, 2, 0) },
  { name: 'Ponytail', spec: S(3, 2, 0, 1) },
  { name: 'High pony', spec: S(2, 1, 0, 2) },
  { name: 'Pigtails', spec: S(3, 1, 0, 3) },
  { name: 'Twin buns', spec: S(2, 1, 0, 6) },
  { name: 'Braid', spec: S(3, 3, 0, 7) },
  { name: 'Twin braids', spec: S(3, 1, 0, 8) },
  { name: 'Messy bun', spec: S(3, 5, 0, 4) },
  { name: 'Low bun', spec: S(3, 3, 0, 5) },
  { name: 'Curtains', spec: S(3, 3, 2, 0) },
  { name: 'Waist long', spec: S(4, 1, 4, 0) },
  { name: 'Buzz', spec: S(1, 0, 0, 0) },
  { name: 'Spiky', spec: S(5, 0, 0, 0) },
  { name: 'Mohawk', spec: S(6, 0, 0, 0) },
  { name: 'Afro', spec: S(7, 0, 0, 0) },
  { name: 'Bald', spec: S(0, 0, 0, 0) },
]

export const specOf = (av: Avatar): HairSpec => av.hairSpec ?? (HAIR_PRESETS[av.hair] ?? HAIR_PRESETS[0]).spec
export const sameSpec = (a: HairSpec, b: HairSpec) => a.cut === b.cut && a.fringe === b.fringe && a.back === b.back && a.tail === b.tail

/* ---------------- colour ---------------- */

const hex3 = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`
const mix = (a: string, b: string, t: number) => {
  const x = hex3(a)
  const y = hex3(b)
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}

/** hand-tuned ramps for the original six colours so old avatars look exactly as before */
const LEGACY_RAMPS: Record<string, string[]> = {
  '#3a2616': ['#5c4030', '#47301f', '#382416', '#2a1a0f', '#1c1009'],
  '#6b3a1a': ['#a8683a', '#8a522a', '#6b3a1a', '#552c12', '#3c1d0a'],
  '#c9892a': ['#f2c062', '#dea446', '#c9892a', '#a66c1c', '#7a4c12'],
  '#e8d070': ['#fff3b8', '#f6e294', '#e8d070', '#c9ac4c', '#9a7f30'],
  '#c94a4a': ['#f28a6a', '#de6a52', '#c94a4a', '#a23636', '#742424'],
  '#7a5cd6': ['#c2a8ff', '#a084f0', '#7a5cd6', '#5c40b0', '#3e2a80'],
}

/** five shades from highlight (0) to outline (4) */
export function hairRamp(base: string): string[] {
  const b = base.toLowerCase()
  return LEGACY_RAMPS[b] ?? [mix(b, '#ffffff', 0.4), mix(b, '#ffffff', 0.2), b, mix(b, '#000000', 0.24), mix(b, '#000000', 0.52)]
}

export const hairColorOf = (av: Avatar) => av.hairHex ?? HAIR[av.hairColor] ?? HAIR[0]
export const validHex = (s: string | undefined): s is string => !!s && /^#[0-9a-f]{6}$/i.test(s)

/* ---------------- what covers the head ---------------- */

interface CutParams {
  /** last row fully covered across the top of the head */
  top: number
  /** hair beside the face (sideburns) down to this row */
  side: number
  /** profile: the back of the head is covered down to this row */
  rear: number
  /** seen from behind: covered down to this row */
  back: number
}
const CUT_PARAMS: CutParams[] = [
  { top: -1, side: -1, rear: -1, back: -1 }, // bald
  { top: 2, side: -1, rear: 5, back: 7 }, // buzz
  { top: 4, side: 7, rear: 8, back: 9 }, // short
  { top: 4, side: 9, rear: 9, back: 10 }, // medium
  { top: 5, side: 10, rear: 10, back: 11 }, // full
  { top: 3, side: 6, rear: 7, back: 8 }, // spiky
  { top: 4, side: -1, rear: -1, back: 10 }, // mohawk (strip only)
  { top: 5, side: 8, rear: 9, back: 10 }, // afro
]
const MOHAWK = 6

/** is head pixel (x, y) hair? dir: 0 front, 1 facing left, 2 facing right, 3 back. w is the head width. */
export function hairCovers(dir: number, x: number, y: number, w: number, spec: HairSpec): boolean {
  const p = CUT_PARAMS[spec.cut] ?? CUT_PARAMS[2]
  if (p.top < 0) return false
  if (dir === 2) return hairCovers(1, w - 1 - x, y, w, spec)
  const f = spec.fringe
  const top = f ? Math.max(p.top, 4) : p.top

  if (spec.cut === MOHAWK) {
    if (dir === 3) return y <= p.back && x >= 4 && x <= w - 5
    return dir === 0 ? y <= 4 && x >= 4 && x <= 8 : y <= 4 && x >= 3 && x <= 9
  }
  if (dir === 3) return y <= p.back
  if (dir === 0) {
    if (y <= top) return true
    if (y === 5 && (f === 1 || f === 4)) return true
    if (y === 5 && f === 2) return x <= 9
    if (y === 5 && f === 3) return x <= 4 || x >= 8
    if (y === 5 && f === 5) return x % 3 !== 1
    if (y === 6 && f === 4) return true
    if (y === 6 && f === 2) return x <= 5
    if (y === 6 && f === 3) return x <= 3 || x >= 9
    if (y === 6 && f === 5) return x === 1 || x === 4 || x === 8 || x === 11
    return y >= 5 && y <= p.side && (x <= 1 || x >= w - 2)
  }
  // profile, facing left: the face is on the left, the back of the head on the right
  if (y <= top) return true
  if (x >= 7 && y <= p.rear) return true
  if (y === 5 && (f === 1 || f === 4 || f === 2)) return true
  if (y === 5 && f === 3) return x >= 4
  if (y === 5 && f === 5) return x % 3 !== 0
  if (y === 6 && f === 4) return x >= 1
  if (y === 6 && f === 2) return x >= 3
  if (y === 6 && f === 3) return x >= 5
  if (y === 6 && f === 5) return x === 4 || x === 8
  return false
}

/* ---------------- everything that hangs off the head ---------------- */

export interface HairPt {
  x: number
  y: number
  /** 0 highlight .. 4 outline, or TIE for a hair tie */
  s: number
  /** 0 at the roots to 1 at the ends, used for an ombre tip */
  t: number
  /** the top edge touches the head, so it isn't outlined */
  nt?: boolean
}
export const TIE = 9
export interface HairLayers {
  back: HairPt[]
  front: HairPt[]
}

const tex = (x: number, y: number) => ((x * 2 + (y >> 2)) % 5 === 0 ? 1 : (x + 3 * y) % 7 === 0 ? 3 : 2)

class Painter {
  pts: HairPt[] = []
  /** a filled rectangle; t runs from t0 at the first row to t1 at the last */
  rect(x0: number, y0: number, x1: number, y1: number, t0 = 0, t1 = 0, nt = false) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const t = y1 === y0 ? t0 : t0 + ((y - y0) / (y1 - y0)) * (t1 - t0)
        this.pts.push({ x, y, s: tex(x, y), t, nt: nt && y === y0 })
      }
  }
  /** a vertical strand that is wide at the top and narrows towards the end */
  strand(cx: number, y0: number, y1: number, half: (y: number) => [number, number], nt = false) {
    for (let y = y0; y <= y1; y++) {
      const [l, r] = half(y)
      this.rect(cx + l, y, cx + r, y, (y - y0) / Math.max(1, y1 - y0), (y - y0) / Math.max(1, y1 - y0), nt && y === y0)
    }
  }
  /** a braid: light and dark strands crossing */
  plait(x0: number, y0: number, x1: number, y1: number, tMax = 1) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) this.pts.push({ x, y, s: (x + (y >> 1)) % 2 ? 1 : 3, t: ((y - y0) / Math.max(1, y1 - y0)) * tMax })
  }
  tie(x0: number, y: number, x1 = x0) {
    for (let x = x0; x <= x1; x++) this.pts.push({ x, y, s: TIE, t: 0 })
  }
  fill(rows: [number, number, number][], t = 0) {
    for (const [y, x0, x1] of rows) this.rect(x0, y, x1, y, t, t)
  }
  /** an ellipse, for puffs */
  ellipse(cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.pts.push({ x, y, s: tex(x, y), t: 0 })
  }
}

/** darken the silhouette edge so the hair reads against whatever is behind it */
function outline(pts: HairPt[]) {
  const at = new Set(pts.map((p) => `${p.x},${p.y}`))
  const has = (x: number, y: number) => at.has(`${x},${y}`)
  for (const p of pts) {
    if (p.s === TIE) continue
    const ends = !has(p.x, p.y + 1) || (!has(p.x, p.y - 1) && !p.nt)
    if (ends) p.s = 4
    else if (!has(p.x - 1, p.y) || !has(p.x + 1, p.y)) p.s = 3
  }
}
/** later points win where shapes overlap */
function dedupe(pts: HairPt[]) {
  const m = new Map<string, HairPt>()
  for (const p of pts) m.set(`${p.x},${p.y}`, p)
  return [...m.values()]
}
function seal(pts: HairPt[]) {
  const out = dedupe(pts)
  outline(out)
  return out
}

const LAST_ROW = [0, 11, 14, 17, 20]

function backHair(dir: number, spec: HairSpec, back: Painter, front: Painter) {
  const L = LAST_ROW[spec.back] ?? 0
  if (!L || spec.cut === 0) return
  const bob = spec.back === 1
  if (dir === 0) {
    // hair behind the shoulders, then locks falling over them
    for (let y = 4; y <= L; y++) {
      const w = bob || y > L - 2 ? 1 : 2
      back.rect(-w, y, 0, y, y / L, y / L)
      back.rect(12, y, 12 + w, y, y / L, y / L)
    }
    if (!bob) {
      for (let y = 8; y <= L; y++) {
        const taper = y > L - 2 ? 1 : 0
        const r = y < 11 ? 1 : 2
        front.rect(0 + taper, y, r, y, y / L, y / L, y === 8)
        front.rect(12 - r, y, 12 - taper, y, y / L, y / L, y === 8)
      }
    }
  } else if (dir === 3) {
    for (let y = 7; y <= L; y++) {
      const shrink = Math.max(0, y - (L - 3))
      front.rect(-1 + shrink, y, 13 - shrink, y, y / L, y / L, y === 7)
    }
  } else {
    for (let y = 4; y <= L; y++) {
      const shrink = Math.max(0, y - (L - 3))
      back.rect(9, y, 13 - shrink, y, y / L, y / L)
    }
    if (!bob) {
      for (let y = 9; y <= L; y++) {
        const shrink = Math.max(0, y - (L - 3))
        front.rect(8, y, 11 - shrink, y, y / L, y / L, y === 9)
      }
    } else {
      front.rect(8, 7, 11, 11, 0.2, 1, true)
    }
  }
}

function tails(dir: number, spec: HairSpec, back: Painter, front: Painter) {
  const side = dir === 1 // profile (already mirrored by the caller)
  switch (spec.tail) {
    case 1: // ponytail
      if (dir === 3) {
        front.strand(6, 4, 16, (y) => (y < 11 ? [-2, 2] : y < 14 ? [-1, 1] : [-1, 0]))
        front.tie(5, 3, 7)
      } else if (dir === 0) back.rect(5, -1, 7, -1)
      else {
        front.fill([[3, 11, 12], [4, 11, 13], [5, 12, 14], [6, 13, 14], [7, 13, 14], [8, 13, 14], [9, 13, 14], [10, 13, 14], [11, 13, 14], [12, 13, 13], [13, 13, 13]], 0.3)
        front.tie(10, 3, 11)
      }
      break
    case 2: // high ponytail
      if (dir === 3) {
        front.strand(6, 0, 13, (y) => (y < 8 ? [-2, 2] : y < 11 ? [-1, 1] : [-1, 0]))
        front.rect(5, -2, 7, -1)
        front.tie(5, 0, 7)
      } else if (dir === 0) {
        back.rect(5, -2, 7, -2)
        back.rect(4, -1, 8, -1)
      } else {
        back.fill([[-2, 9, 11], [-1, 9, 12], [0, 11, 13], [1, 12, 14], [2, 12, 14], [3, 13, 14], [4, 13, 14], [5, 13, 14], [6, 13, 14], [7, 13, 14], [8, 13, 14], [9, 13, 14], [10, 13, 13], [11, 13, 13]], 0.2)
        back.tie(9, 0, 10)
      }
      break
    case 3: // pigtails
      if (dir === 1) {
        back.fill([[5, 11, 13], [6, 11, 13], [7, 11, 13], [8, 11, 13], [9, 11, 13], [10, 11, 13], [11, 12, 13], [12, 12, 13]], 0.3)
        back.tie(10, 5, 12)
      } else {
        for (const [a, b] of [[-3, -1], [13, 15]]) {
          for (let y = 6; y <= 13; y++) back.rect(y > 11 ? a + 1 : a, y, y > 11 ? b : b, y, (y - 6) / 7, (y - 6) / 7)
          back.tie(a, 5, b)
        }
      }
      break
    case 4: // top bun
      if (side) {
        front.fill([[-5, 8, 10], [-4, 7, 11], [-3, 7, 11], [-2, 7, 11], [-1, 8, 10]])
        front.tie(8, -1, 10)
      } else {
        front.fill([[-5, 5, 7], [-4, 4, 8], [-3, 4, 8], [-2, 4, 8]])
        front.tie(5, -1, 7)
      }
      break
    case 5: // low bun
      if (dir === 3) front.fill([[8, 4, 8], [9, 3, 9], [10, 3, 9], [11, 3, 9], [12, 4, 8]])
      else if (side) front.fill([[7, 9, 11], [8, 8, 12], [9, 8, 12], [10, 8, 12], [11, 9, 11]])
      break
    case 6: // twin buns
      if (side) {
        front.fill([[-3, 7, 9], [-2, 6, 10], [-1, 6, 10], [0, 6, 10], [1, 7, 9]])
      } else {
        front.fill([[-3, 1, 2], [-2, 0, 3], [-1, 0, 3], [0, 0, 3], [1, 1, 2]])
        front.fill([[-3, 10, 11], [-2, 9, 12], [-1, 9, 12], [0, 9, 12], [1, 10, 11]])
      }
      break
    case 7: // braid
      if (dir === 3) {
        front.plait(5, 4, 7, 16)
        front.tie(5, 3, 7)
        front.tie(5, 17, 7)
      } else if (side) {
        back.plait(10, 4, 12, 15)
        back.tie(10, 3, 11)
        back.tie(10, 16, 12)
      }
      break
    case 8: // twin braids
      if (side) {
        back.plait(11, 5, 13, 14)
        back.tie(11, 4, 12)
        back.tie(11, 15, 13)
      } else {
        for (const [a, b] of [[-3, -1], [13, 15]]) {
          back.plait(a, 5, b, 14)
          back.tie(a, 4, b)
          back.tie(a, 15, b)
        }
      }
      break
  }
}

function crown(dir: number, spec: HairSpec, back: Painter, front: Painter) {
  const side = dir === 1
  if (spec.cut === 5) {
    // spikes
    const spikes: [number, number][] = side ? [[2, 2], [4, 3], [6, 4], [8, 3], [10, 2]] : [[1, 2], [3, 3], [6, 4], [9, 3], [11, 2]]
    for (const [cx, h] of spikes) {
      front.rect(cx - 1, -1, cx + 1, -1, 0, 0, true)
      for (let i = 1; i < h; i++) front.rect(cx - (h - i > 2 ? 1 : 0), -1 - i, cx + (h - i > 2 ? 1 : 0), -1 - i)
    }
  } else if (spec.cut === MOHAWK) {
    if (side) front.fill([[-3, 5, 7], [-2, 4, 8], [-1, 3, 9]])
    else front.fill([[-4, 6, 6], [-3, 5, 7], [-2, 5, 7], [-1, 5, 7]])
  } else if (spec.cut === 7) {
    back.ellipse(side ? 7 : 6, 4, side ? 7.5 : 8.5, 7.5)
  }
}

/** the pieces of hair beyond the head itself, for one facing direction */
export function hairOverhang(dir: number, spec: HairSpec): HairLayers {
  const back = new Painter()
  const front = new Painter()
  const d = dir === 2 ? 1 : dir
  if (spec.cut !== 0) {
    backHair(d, spec, back, front)
    crown(d, spec, back, front)
  }
  tails(d, spec, back, front)
  return { back: seal(back.pts), front: seal(front.pts) }
}
