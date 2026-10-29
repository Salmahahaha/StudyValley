import { useEffect, useMemo, useRef, useState } from 'react'
import {
  animalsIn, balance, gardenSize, inventory, isAnimal, isCorner, levelInfo, ownedUnits, ownsZone, placed, plantProgress,
  slotOf, slotsFor, unitInSlot,
} from '../game/calc'
import type { Slot } from '../game/calc'
import { DEFAULT_AVATAR, ITEMS, ZONES, zoneDef } from '../game/data'
import {
  BAND, GH, GLOW, GW, T, avatarShadow, avatarSpr, bandProps, decorSpr, drawSpr, fenceProps, groundCanvas, isTree, petSpr,
  plantSpr, potSpr, seedOf, soilSpr,
} from '../game/sprites'
import type { Spr } from '../game/sprites'
import { useGame } from '../game/store'
import type { Avatar, PlantDef, Unit } from '../game/types'
import { AnimalsPanel, TilePanel } from './GardenPanels'
import { useAtlas } from './useAtlas'

interface Drawn {
  u: Unit
  stage: number
  ready: boolean
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  kind: 'spark' | 'dust' | 'text' | 'sprite'
  col?: string
  text?: string
  spr?: Spr
}

type Light = 'clock' | 'day' | 'night'
const LIGHT: Record<string, Light> = { meadow: 'clock', grove: 'clock', greenhouse: 'day', sky: 'day', cave: 'night' }

const hash01 = (n: number) => {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

type Box = [number, number, number, number]

/** a deterministic stroll: walk to a new spot near home, pause, repeat */
function wander(seed: number, t: number, home: { x: number; y: number }, box: Box, speed: number, seg = 8) {
  const k = Math.floor(t / seg)
  const u = t - k * seg
  const spot = (n: number) => ({
    x: Math.min(box[2], Math.max(box[0], home.x + (hash01(seed + n * 7919) - 0.5) * 90)),
    y: Math.min(box[3], Math.max(box[1], home.y + (hash01(seed + n * 104729) - 0.5) * 60)),
  })
  return walk(spot(k), spot(k + 1), u, speed)
}

/** an animal's stroll across the whole garden: pick a spot anywhere in the box, walk there, rest, repeat */
function roam(seed: number, t: number, box: Box, speed: number, seg = 12) {
  const k = Math.floor(t / seg)
  const u = t - k * seg
  const spot = (n: number) => ({
    x: box[0] + hash01(seed + n * 7919) * (box[2] - box[0]),
    y: box[1] + hash01(seed + n * 104729) * (box[3] - box[1]),
  })
  return walk(spot(k), spot(k + 1), u, speed, seg - 3)
}

function walk(a: { x: number; y: number }, b: { x: number; y: number }, u: number, speed: number, maxDur = Infinity) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  // a long way across the garden is covered at a brisker pace instead of overrunning the pause
  const dur = Math.min(maxDur, Math.hypot(dx, dy) / speed)
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0
  if (u < dur) {
    const f = u / dur
    return { x: a.x + dx * f, y: a.y + dy * f, moving: true, dir }
  }
  return { x: b.x, y: b.y, moving: false, dir: dir === 1 ? 0 : dir }
}

/** where a small decoration stands inside its tile: feet position by slot */
function standAt(u: Unit, sl: Slot) {
  const x = u.x ?? 0
  const y = u.y ?? 0
  if (isCorner(sl)) {
    const q = Number(sl[1])
    return { cx: x * T + 8 + 16 * (q % 2), by: BAND + y * T + 14 + 14 * (q >> 1) }
  }
  return { cx: x * T + T / 2, by: BAND + y * T + 27 }
}

const wideScreen = () => window.matchMedia('(min-width: 900px)').matches

type Tile = { x: number; y: number }
const uniqTiles = (tiles: Tile[]) => tiles.filter((t, i) => tiles.findIndex((o) => o.x === t.x && o.y === t.y) === i)
const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export function Garden({ goStudy, goShop }: { goStudy: () => void; goShop: () => void }) {
  const doc = useGame((s) => s.doc)
  const { move, say, buyZone, harvestAll, moveMany } = useGame.getState()
  const atlas = useAtlas()
  const level = levelInfo(balance(doc, 'xp')).level
  const [zone, setZone] = useState('meadow')
  const { cols, rows } = gardenSize(level, zone)
  const [sel, setSel] = useState<{ x: number; y: number } | null>(null)
  const [slot, setSlot] = useState<Slot>('plant')
  /** the unit being picked up and moved to another tile or garden */
  const [moving, setMoving] = useState<string | null>(null)
  const avatar: Avatar = doc.settings.avatar ?? DEFAULT_AVATAR
  const showCanvas = ownsZone(doc, zone)
  const side = useRef<HTMLElement>(null)

  const drawn = useMemo<Drawn[]>(
    () =>
      placed(doc, zone).map((u) => {
        if (ITEMS[u.itemId].kind !== 'plant') return { u, stage: 4, ready: false }
        const p = plantProgress(doc, u)
        return { u, stage: p.stage, ready: p.ready }
      }),
    [doc, zone],
  )
  const animals = useMemo(() => animalsIn(doc, zone), [doc, zone])
  const movingUnit = moving ? doc.units[moving] : undefined
  // a unit that got removed or harvested mid-move can't be moved any more
  const mover = movingUnit && !movingUnit.gone && !movingUnit.deleted ? movingUnit : undefined
  const movingAt = mover && mover.x !== undefined && (mover.zone ?? 'meadow') === zone ? { x: mover.x, y: mover.y ?? 0, slot: slotOf(mover) } : null

  /** several things picked together (Shift/Ctrl-click, or Select multiple) so they can be moved as one block */
  const [group, setGroup] = useState<string[]>([])
  const [groupMoving, setGroupMoving] = useState(false)
  const groupUnits = group
    .map((id) => doc.units[id])
    .filter((u): u is Unit => !!u && !u.gone && !u.deleted && u.x !== undefined && u.y !== undefined)
  const groupTiles = uniqTiles(groupUnits.filter((u) => (u.zone ?? 'meadow') === zone).map((u) => ({ x: u.x as number, y: u.y as number })))
  /** the first thing picked is the anchor: it lands on the tile you drop on, and the rest keep their places around it */
  const anchor = groupUnits[0]
  const shifted = (to: Tile) =>
    anchor ? uniqTiles(groupUnits.map((u) => ({ x: (u.x as number) + to.x - (anchor.x as number), y: (u.y as number) + to.y - (anchor.y as number) }))) : []
  const groupPreview = groupMoving && sel ? shifted(sel).filter((t) => t.x >= 0 && t.y >= 0 && t.x < cols && t.y < rows) : []
  const readyHere = drawn.filter((d) => d.ready)
  const readyGold = readyHere.reduce((t, d) => t + (ITEMS[d.u.itemId] as PlantDef).harvest, 0)

  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const parts = useRef<Particle[]>([])
  const view = useRef({ drawn, animals, cols, rows, sel, slot, movingAt, groupTiles, groupPreview, zone, avatar, atlas })
  const redraw = useRef<(() => void) | null>(null)
  useEffect(() => {
    view.current = { drawn, animals, cols, rows, sel, slot, movingAt, groupTiles, groupPreview, zone, avatar, atlas }
    redraw.current?.()
  })

  // on a phone the panel sits under the garden, so bring it into view when a tile is picked
  const selKey = sel ? `${sel.x},${sel.y}` : ''
  useEffect(() => {
    if (selKey && !wideScreen()) side.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selKey])

  useEffect(() => {
    const canvas = cv.current
    const box = wrap.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')!
    let k = 1
    let raf = 0
    let last = 0

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const avail = box.clientWidth * dpr
      let fit = avail / GW
      // with a side panel there is room to spare across but not down, so keep the whole garden on screen
      if (wideScreen()) fit = Math.min(fit, ((window.innerHeight - 270) * dpr) / GH)
      const whole = Math.floor(fit)
      k = whole >= 3 ? whole : fit
      canvas.width = Math.round(GW * k)
      canvas.height = Math.round(GH * k)
      canvas.style.width = `${(GW * k) / dpr}px`
      canvas.style.height = `${(GH * k) / dpr}px`
      redraw.current?.()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)
    window.addEventListener('resize', resize)

    const glow = (x: number, y: number, rad: number, rgb: string, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
      g.addColorStop(0, `rgba(${rgb},${a})`)
      g.addColorStop(1, `rgba(${rgb},0)`)
      ctx.fillStyle = g
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
    }
    const px = (x: number, y: number, col: string, s = 1) => {
      ctx.fillStyle = col
      ctx.fillRect(Math.round(x), Math.round(y), s, s)
    }

    const render = (ms: number) => {
      const v = view.current
      const t = ms / 1000
      ctx.setTransform(k, 0, 0, k, 0, 0)
      ctx.imageSmoothingEnabled = false
      if (!v.atlas) {
        ctx.fillStyle = '#5a8a42'
        ctx.fillRect(0, 0, GW, GH)
        return
      }
      ctx.drawImage(groundCanvas(v.zone, v.cols, v.rows), 0, 0)

      // floor pieces (paths) lie flat on the ground, under everything else
      for (const { u } of v.drawn) {
        if (slotOf(u) === 'floor') drawSpr(ctx, decorSpr(u.itemId), (u.x ?? 0) * T + T / 2, BAND + (u.y ?? 0) * T + 31)
      }

      // everything that stands on the ground, painted back to front
      const scene: { y: number; draw: () => void }[] = []
      for (const p of [...bandProps(v.zone), ...fenceProps(v.zone, v.cols, v.rows)]) {
        const s = p.s(t)
        scene.push({ y: p.y, draw: () => drawSpr(ctx, s, p.x, p.y, p.flip) })
      }
      const roamBox: Box = [10, BAND + 10, v.cols * T - 10, BAND + v.rows * T - 4]
      const lights: { x: number; y: number; rgb: string; r: number }[] = []

      for (const { u, stage, ready } of v.drawn) {
        const sl = slotOf(u)
        if (sl === 'floor') continue
        const { cx, by } = standAt(u, sl)
        const def = ITEMS[u.itemId]
        if (GLOW[u.itemId] && (def.kind !== 'plant' || stage === 4)) lights.push({ x: cx, y: by - 12, rgb: GLOW[u.itemId], r: def.kind === 'plant' ? 22 : 34 })
        if (u.pot && GLOW[u.pot]) lights.push({ x: cx, y: by - 4, rgb: GLOW[u.pot], r: 14 })
        if (def.kind === 'plant') {
          const s = plantSpr(u.itemId, stage)
          const bounce = ready && Math.floor(t * 1.6 + cx) % 3 === 0 ? 1 : 0
          scene.push({
            y: by,
            draw: () => {
              if (u.pot) {
                const ps = potSpr(u.pot)
                drawSpr(ctx, ps, cx, by + 1)
                drawSpr(ctx, s, cx, by + 1 - ps.h + 4 - bounce)
              } else if (isTree(u.itemId)) {
                drawSpr(ctx, s, cx, by + 3 - bounce)
              } else {
                drawSpr(ctx, soilSpr(), cx, by - 3)
                drawSpr(ctx, s, cx, by - 1 - bounce)
              }
              if (ready) {
                for (let i = 0; i < 3; i++) {
                  const ph = (t * 1.3 + i * 0.37 + cx * 0.01) % 1
                  const sx = cx - 9 + ((i * 7 + Math.floor(t * 1.3 + i)) % 18)
                  const sy = by - 10 - ph * 16
                  const col = ph < 0.5 ? '#fff6b0' : '#ffe066'
                  px(sx, sy, col)
                  if (ph < 0.3) {
                    px(sx - 1, sy, col)
                    px(sx + 1, sy, col)
                    px(sx, sy - 1, col)
                    px(sx, sy + 1, col)
                  }
                }
              }
            },
          })
        } else {
          const s = decorSpr(u.itemId, t + (u.x ?? 0) * 0.7 + (u.y ?? 0) * 0.3)
          scene.push({ y: by, draw: () => drawSpr(ctx, s, cx, by + 2) })
        }
      }

      // animals live in the garden, not on a tile, and wander all over it
      for (const a of v.animals) {
        const seed = seedOf(a.id)
        const tt = t + hash01(seed) * 50
        if (a.itemId === 'cat') {
          // the cat pops out of the grass somewhere new each time
          const n = Math.floor(tt / 16)
          const x = roamBox[0] + hash01(seed + n * 977) * (roamBox[2] - roamBox[0])
          const y = roamBox[1] + hash01(seed + n * 1301) * (roamBox[3] - roamBox[1])
          const s = decorSpr('cat', tt)
          scene.push({ y, draw: () => drawSpr(ctx, s, x, y + 2) })
          continue
        }
        const w = roam(seed, tt, roamBox, a.itemId === 'chick' ? 14 : 20)
        const s = petSpr(a.itemId, w.moving, w.dir, t)
        scene.push({ y: w.y, draw: () => drawSpr(ctx, s, w.x, w.y) })
      }

      // the player strolls about their land
      const me = wander(42, t, { x: (v.cols * T) / 2, y: BAND + v.rows * T - 18 }, roamBox, 18, 9)
      scene.push({
        y: me.y,
        draw: () => {
          drawSpr(ctx, avatarShadow(), me.x, me.y)
          drawSpr(ctx, avatarSpr(v.avatar, me.moving, me.dir, t), me.x, me.y + 1)
        },
      })

      scene.sort((a, b) => a.y - b.y)
      for (const s of scene) s.draw()

      // lighting
      const mode = LIGHT[v.zone] ?? 'clock'
      const now = new Date()
      const hour = now.getHours() + now.getMinutes() / 60
      const night = mode === 'night' || (mode === 'clock' && (hour >= 20.5 || hour < 5))
      const dusk = mode === 'clock' && hour >= 18 && hour < 20.5
      const dawn = mode === 'clock' && hour >= 5 && hour < 7
      if (night) {
        ctx.fillStyle = v.zone === 'cave' ? 'rgba(20,14,60,.28)' : 'rgba(18,24,78,.42)'
        ctx.fillRect(0, 0, GW, GH)
      } else if (dusk) {
        ctx.fillStyle = `rgba(255,120,60,${0.06 + ((hour - 18) / 2.5) * 0.16})`
        ctx.fillRect(0, 0, GW, GH)
      } else if (dawn) {
        ctx.fillStyle = 'rgba(255,170,120,.12)'
        ctx.fillRect(0, 0, GW, GH)
      }
      if (night || dusk) {
        ctx.globalCompositeOperation = 'lighter'
        for (const l of lights) glow(l.x, l.y, l.r, l.rgb, night ? 0.5 : 0.3)
        ctx.globalCompositeOperation = 'source-over'
      }

      // ambient life
      if (night || dusk || v.zone === 'cave') {
        for (let i = 0; i < 10; i++) {
          const a = (Math.sin(t * 1.7 + i * 2) + 1) / 2
          if (a < 0.2) continue
          const fx = GW / 2 + Math.sin(t * 0.31 + i * 1.7) * (GW / 2.2)
          const fy = GH / 2 + Math.cos(t * 0.27 + i * 2.3) * (GH / 2.4)
          const rgb = v.zone === 'cave' ? '127,233,255' : '233,255,122'
          ctx.globalCompositeOperation = 'lighter'
          glow(fx, fy, 5, rgb, 0.45 * a)
          ctx.globalCompositeOperation = 'source-over'
          px(fx, fy, v.zone === 'cave' ? '#d6fbff' : '#fbffd0')
        }
      } else {
        // a pair of butterflies
        for (let i = 0; i < 2; i++) {
          const bx = GW / 2 + Math.sin(t * 0.21 + i * 3) * (GW / 2.3)
          const by = GH / 2 + Math.sin(t * 0.53 + i) * 40 + Math.cos(t * 0.23 + i * 2) * 50
          const open = Math.floor(t * 8 + i) % 2 === 0
          const col = i ? '#ffd23f' : '#ff9ec8'
          px(bx, by, '#3a2a3a')
          px(bx, by + 1, '#3a2a3a')
          if (open) {
            px(bx - 2, by - 1, col, 2)
            px(bx + 1, by - 1, col, 2)
            px(bx - 1, by + 1, col)
            px(bx + 1, by + 1, col)
          } else {
            px(bx - 1, by - 1, col)
            px(bx + 1, by - 1, col)
          }
        }
        if (v.zone === 'grove') {
          for (let i = 0; i < 6; i++) {
            const fall = (t * 12 + i * 37) % (GH + 20)
            const lx = (i * 53 + Math.sin(t + i) * 14) % GW
            px(lx, fall - 10, i % 2 ? '#c98a3a' : '#a8642a', 2)
          }
        }
      }
      if (v.zone === 'sky') {
        for (let i = 0; i < 3; i++) {
          const cx = ((t * (4 + i * 2) + i * 120) % (GW + 80)) - 40
          const cy = 12 + i * 9
          ctx.fillStyle = 'rgba(255,255,255,.85)'
          ctx.fillRect(Math.round(cx), cy, 22, 4)
          ctx.fillRect(Math.round(cx) + 5, cy - 3, 12, 3)
        }
      }

      // particles
      const ps = parts.current
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        const age = t - p.born
        if (age > p.life) {
          ps.splice(i, 1)
          continue
        }
        const f = age / p.life
        const x = p.x + p.vx * age
        const y = p.y + p.vy * age + (p.kind === 'spark' || p.kind === 'dust' ? 40 * age * age : 0)
        ctx.globalAlpha = Math.max(0, 1 - f * f)
        if (p.kind === 'text') {
          ctx.font = '700 9px Fredoka, sans-serif'
          ctx.textAlign = 'center'
          ctx.fillStyle = '#3a2200'
          ctx.fillText(p.text!, Math.round(x) + 1, Math.round(y) + 1)
          ctx.fillStyle = p.col ?? '#ffe066'
          ctx.fillText(p.text!, Math.round(x), Math.round(y))
        } else if (p.kind === 'sprite' && p.spr) {
          drawSpr(ctx, p.spr, x, y)
        } else px(x, y, p.col ?? '#fff', p.kind === 'spark' && f < 0.3 ? 2 : 1)
        ctx.globalAlpha = 1
      }

      // RPG-style cursor: four bouncing corner brackets round a tile or one corner of it
      const bracket = (x0: number, y0: number, size: number, o: number, inner: string) => {
        const corner = (x: number, y: number, fx: number, fy: number) => {
          ctx.fillStyle = '#2e1c14'
          ctx.fillRect(fx > 0 ? x : x - 5, fy > 0 ? y : y - 2, 6, 3)
          ctx.fillRect(fx > 0 ? x : x - 2, fy > 0 ? y : y - 5, 3, 6)
          ctx.fillStyle = inner
          ctx.fillRect(fx > 0 ? x + 1 : x - 4, fy > 0 ? y + 1 : y - 1, 4, 1)
          ctx.fillRect(fx > 0 ? x + 1 : x - 1, fy > 0 ? y + 1 : y - 4, 1, 4)
        }
        corner(x0 + 1 - o, y0 + 1 - o, 1, 1)
        corner(x0 + size - 1 + o, y0 + 1 - o, -1, 1)
        corner(x0 + 1 - o, y0 + size - 1 + o, 1, -1)
        corner(x0 + size - 1 + o, y0 + size - 1 + o, -1, -1)
      }
      const o = Math.floor(t * 3) % 2
      if (v.movingAt) {
        const m = v.movingAt
        const x0 = m.x * T + (isCorner(m.slot) ? (Number(m.slot[1]) % 2) * 16 : 0)
        const y0 = BAND + m.y * T + (isCorner(m.slot) ? (Number(m.slot[1]) >> 1) * 16 : 0)
        ctx.fillStyle = 'rgba(255,214,90,.28)'
        ctx.fillRect(x0, y0, isCorner(m.slot) ? 16 : T, isCorner(m.slot) ? 16 : T)
        bracket(x0, y0, isCorner(m.slot) ? 16 : T, o, '#ffd23f')
      }
      for (const g of v.groupPreview) {
        ctx.fillStyle = 'rgba(255,214,90,.25)'
        ctx.fillRect(g.x * T, BAND + g.y * T, T, T)
        bracket(g.x * T, BAND + g.y * T, T, o, '#ffd23f')
      }
      for (const g of v.groupTiles) {
        ctx.fillStyle = 'rgba(110,200,255,.3)'
        ctx.fillRect(g.x * T, BAND + g.y * T, T, T)
        bracket(g.x * T, BAND + g.y * T, T, o, '#7fd0ff')
      }
      if (v.sel) {
        const x0 = v.sel.x * T
        const y0 = BAND + v.sel.y * T
        if (isCorner(v.slot)) {
          const q = Number(v.slot[1])
          ctx.fillStyle = 'rgba(255,255,255,.3)'
          ctx.fillRect(x0 + (q % 2) * 16, y0 + (q >> 1) * 16, 16, 16)
        }
        bracket(x0, y0, T, o, '#ffffff')
      }
    }

    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame)
      if (ms - last < 40) return
      last = ms
      render(ms)
    }
    redraw.current = () => render(performance.now())
    raf = requestAnimationFrame(frame)
    redraw.current()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('resize', resize)
      redraw.current = null
    }
  }, [showCanvas])

  const burst = (tx: number, ty: number, gold: number, spr?: Spr) => {
    const t = performance.now() / 1000
    const x = tx * T + T / 2
    const y = BAND + ty * T + 14
    const cols = ['#ffe066', '#fff6b0', '#ffffff', '#f2b632']
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const sp = 20 + hash01(i * 31 + Math.floor(t)) * 30
      parts.current.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, born: t, life: 0.9, kind: 'spark', col: cols[i % 4] })
    }
    if (spr) parts.current.push({ x, y: y + 12, vx: 0, vy: -26, born: t, life: 1.1, kind: 'sprite', spr })
    parts.current.push({ x, y: y - 8, vx: 0, vy: -18, born: t, life: 1.6, kind: 'text', text: `+${gold}`, col: '#ffe066' })
  }
  const puff = (tx: number, ty: number) => {
    const t = performance.now() / 1000
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI
      parts.current.push({ x: tx * T + 16, y: BAND + ty * T + 26, vx: Math.cos(a) * 22, vy: Math.sin(a) * 18, born: t, life: 0.6, kind: 'dust', col: i % 2 ? '#9a6a45' : '#c4a27a' })
    }
  }

  /** the slot to start on when a tile is picked: what is already there, else the plant plot */
  const startSlot = (x: number, y: number): Slot => {
    const here = placed(doc, zone).filter((u) => u.x === x && u.y === y)
    if (here.some((u) => slotOf(u) === 'plant')) return 'plant'
    return here[0] ? slotOf(here[0]) : 'plant'
  }
  /** while moving something, the first spot on this tile it can go in */
  const moveSlot = (m: Unit, x: number, y: number): Slot => {
    const opts = slotsFor(m.itemId)
    return opts.find((s) => !unitInSlot(doc, zone, x, y, s)) ?? opts[0]
  }

  /** plants have one plot per tile, so a tap is enough: move there, or swap with the plant that's there */
  const dropPlant = (x: number, y: number) => {
    if (!mover) return
    const err = move(mover.id, x, y, zone, 'plant')
    if (err) say(err)
    else {
      puff(x, y)
      setMoving(null)
      setSel({ x, y })
      setSlot('plant')
    }
  }
  /** adds everything on a tile to the group, or (unless `add`) takes it back out when it is all in already */
  const pickTile = (x: number, y: number, add = false) => {
    const ids = placed(doc, zone).filter((u) => u.x === x && u.y === y).map((u) => u.id)
    if (!ids.length) {
      if (!add) say('Nothing on that tile to pick')
      return
    }
    setGroup((g) => (!add && ids.every((id) => g.includes(id)) ? g.filter((id) => !ids.includes(id)) : [...g, ...ids.filter((id) => !g.includes(id))]))
  }
  const dropGroup = (x: number, y: number) => {
    if (!anchor) return setGroupMoving(false)
    const tiles = shifted({ x, y })
    const err = moveMany(group, x - (anchor.x as number), y - (anchor.y as number), zone)
    if (err) return say(err)
    tiles.forEach((t) => puff(t.x, t.y))
    setGroup([])
    setGroupMoving(false)
    setSel({ x, y })
    setSlot(startSlot(x, y))
  }
  const startGroupMove = () => {
    setMoving(null)
    setGroupMoving(true)
  }
  const clearGroup = () => {
    setGroup([])
    setGroupMoving(false)
  }
  const doHarvestAll = () => {
    readyHere.forEach(({ u }) => burst(u.x ?? 0, u.y ?? 0, (ITEMS[u.itemId] as PlantDef).harvest, plantSpr(u.itemId, 4)))
    harvestAll(zone)
  }

  /** the cursor moves one tile at a time with the arrow keys; Shift also picks each tile it lands on */
  const goTo = (x: number, y: number, extend = false) => {
    if (extend) {
      if (sel && group.length === 0) pickTile(sel.x, sel.y, true)
      pickTile(x, y, true)
    }
    // the key handler reads this ref, so keep it current for fast repeated presses that land before a re-render
    keys.current.sel = { x, y }
    setSel({ x, y })
    setSlot(mover ? moveSlot(mover, x, y) : startSlot(x, y))
  }
  const keys = useRef({ showCanvas, sel, cols, rows, goTo, dropPlant, dropGroup, mover, groupMoving, group, moving })
  useEffect(() => {
    keys.current = { showCanvas, sel, cols, rows, goTo, dropPlant, dropGroup, mover, groupMoving, group, moving }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      const k = keys.current
      if (e.key === 'Escape') {
        if (k.groupMoving) setGroupMoving(false)
        else if (k.group.length) setGroup([])
        else if (k.moving) setMoving(null)
        else setSel(null)
        return
      }
      if (!k.showCanvas || e.ctrlKey || e.metaKey || e.altKey) return
      const dir = ARROWS[e.key]
      if (dir) {
        e.preventDefault()
        if (!k.sel) return k.goTo(0, 0)
        k.goTo(Math.min(k.cols - 1, Math.max(0, k.sel.x + dir[0])), Math.min(k.rows - 1, Math.max(0, k.sel.y + dir[1])), e.shiftKey)
      } else if (e.key === 'Enter' && k.sel && el?.tagName !== 'BUTTON') {
        if (k.groupMoving) k.dropGroup(k.sel.x, k.sel.y)
        else if (k.mover && ITEMS[k.mover.itemId].kind === 'plant') k.dropPlant(k.sel.x, k.sel.y)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const lx = ((e.clientX - r.left) / r.width) * GW
    const ly = ((e.clientY - r.top) / r.height) * GH
    if (ly < BAND) return
    const x = Math.floor(lx / T)
    const y = Math.floor((ly - BAND) / T)
    if (x >= cols || y >= rows) {
      if (zone === 'meadow') {
        const need = [...Array(40).keys()].map((i) => i + 1).find((l) => {
          const g = gardenSize(l)
          return x < g.cols && y < g.rows
        })
        say(`🔒 Reach level ${need ?? '?'} to unlock this land`)
      } else say(`That's beyond the edge of the ${zoneDef(zone).name}`)
      setSel(null)
      return
    }
    if (groupMoving) {
      setSel({ x, y })
      dropGroup(x, y)
      return
    }
    if (!mover && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      // the tile already selected counts as the first pick, so select one, then Ctrl-click the others
      if (group.length === 0 && sel && !(sel.x === x && sel.y === y)) pickTile(sel.x, sel.y, true)
      pickTile(x, y)
      setSel({ x, y })
      return
    }
    if (mover) {
      if (ITEMS[mover.itemId].kind === 'plant') {
        dropPlant(x, y)
      } else {
        setSel({ x, y })
        setSlot(moveSlot(mover, x, y))
      }
      return
    }
    if (sel?.x === x && sel?.y === y) {
      setSel(null)
      return
    }
    setSel({ x, y })
    setSlot(startSlot(x, y))
  }

  const z = zoneDef(zone)
  const ownsAnimals = ownedUnits(doc).some((u) => isAnimal(u.itemId))
  const nothingYet = showCanvas && placed(doc).length === 0 && !ownsAnimals && inventory(doc).length === 0

  return (
    <div className="garden-layout">
      <div className="garden-main stack">
        <div className="chips zones">
          {ZONES.map((zd) => {
            const owned = ownsZone(doc, zd.id)
            return (
              <button
                key={zd.id}
                className={`chip ${zone === zd.id ? 'on' : ''} ${owned ? '' : 'locked-chip'}`}
                onClick={() => { setZone(zd.id); setSel(null) }}
              >
                {owned ? zd.emoji : '🔒'} {zd.name}
              </button>
            )
          })}
        </div>

        {!showCanvas ? (
          <div className="panel center zone-lock">
            <p className="big">{z.emoji} {z.name}</p>
            <p>{z.blurb}</p>
            <p className="muted">Requires level {z.minLevel}{level < z.minLevel ? ` (you're level ${level})` : ''}</p>
            <button
              className="btn gold"
              disabled={level < z.minLevel}
              onClick={() => { const err = buyZone(zone); if (err) say(err) }}
            >
              Unlock for {z.gemCost ? `${z.gemCost} 💎` : `${z.cost.toLocaleString()} 🪙`}
            </button>
          </div>
        ) : (
          <>
            {readyHere.length > 0 && (
              <div className="row garden-tools">
                <button className="btn gold small pulse" onClick={doHarvestAll}>
                  🧺 Harvest all ({readyHere.length}) +{readyGold} 🪙
                </button>
              </div>
            )}
            <div ref={wrap} className="garden-wrap">
              <canvas ref={cv} className="garden" onPointerDown={tap} />
            </div>
            {z.speed > 1 && <p className="zone-note">{z.emoji} Plants here grow {Math.round((z.speed - 1) * 100)}% faster</p>}
          </>
        )}
      </div>

      <aside ref={side} className="garden-side stack">
        {mover && (
          <div className="panel move-banner">
            <p>✋ Moving <b>{ITEMS[mover.itemId].name}</b>. {ITEMS[mover.itemId].kind === 'plant' ? 'Tap a tile to put it there' : 'Tap a tile, then a spot on it'}. You can switch gardens too.</p>
            <button className="link" onClick={() => setMoving(null)}>Cancel</button>
          </div>
        )}

        {showCanvas && (groupMoving || groupUnits.length > 0) && (
          <div className="panel move-banner stack" style={{ gap: 8 }}>
            {groupMoving ? (
              <p>✋ Moving <b>{groupUnits.length}</b> picked item{groupUnits.length === 1 ? '' : 's'}. Tap a tile (or move with the arrow keys and press Enter): the first one you picked lands there and the rest keep their layout.</p>
            ) : groupUnits.length > 0 ? (
              <p>☑ <b>{groupUnits.length}</b> picked{groupUnits.some((u) => (u.zone ?? 'meadow') !== zone) ? ` (${groupUnits.filter((u) => (u.zone ?? 'meadow') === zone).length} in this garden)` : ''}. Ctrl/Shift-click more tiles to add or remove them.</p>
            ) : null}
            <div className="row">
              {groupMoving ? (
                <button className="btn small ghost" onClick={() => setGroupMoving(false)}>Cancel move</button>
              ) : (
                groupUnits.length > 0 && <button className="btn small gold" onClick={startGroupMove}>✋ Move together</button>
              )}
              <button className="btn small ghost" onClick={clearGroup}>Clear</button>
            </div>
          </div>
        )}

        {showCanvas && sel && !groupMoving && (
          <TilePanel
            zone={zone}
            x={sel.x}
            y={sel.y}
            slot={slot}
            setSlot={setSlot}
            moving={mover?.id ?? null}
            setMoving={setMoving}
            onClose={() => setSel(null)}
            fx={{ puff, burst }}
            goShop={goShop}
          />
        )}

        {showCanvas && !sel && !groupMoving && (
          <div className="panel">
            {nothingYet ? (
              <>
                <p className="big">Your garden is empty 🌿</p>
                <p>Grab some seeds from the shop, plant them, then study to make them grow.</p>
                <div className="row">
                  <button className="btn gold" onClick={goShop}>Visit shop</button>
                  <button className="btn" onClick={goStudy}>Start studying</button>
                </div>
              </>
            ) : (
              <>
                <h3>🌿 Your garden</h3>
                <p className="muted">
                  Tap a tile to plant or decorate it. Every tile has a plot for a plant plus corners, a centre and a floor for decorations, so you can mix them.
                  Tap a plant or decoration, then ✋ Move to rearrange. Arrow keys walk the cursor tile to tile; hold Shift while tapping or arrowing to pick several things and move them together.
                </p>
              </>
            )}
          </div>
        )}

        {showCanvas && <AnimalsPanel zone={zone} goShop={goShop} />}
      </aside>
    </div>
  )
}
