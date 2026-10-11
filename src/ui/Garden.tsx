import { useEffect, useMemo, useRef, useState } from 'react'
import {
  balance, fmtMin, gardenSize, inventory, isPlaceable, levelInfo, ownsZone, placed, plantProgress,
} from '../game/calc'
import { DEFAULT_AVATAR, ITEMS, RARITY_COLOR, ZONES, zoneDef } from '../game/data'
import {
  BAND, GH, GLOW, GW, T, avatarShadow, avatarSpr, bandProps, decorSpr, drawSpr, groundCanvas, isPet, isTree,
  petSpr, plantSpr, potSpr, seedOf, soilSpr,
} from '../game/sprites'
import type { Spr } from '../game/sprites'
import { useGame } from '../game/store'
import type { Avatar, PlantDef, Unit } from '../game/types'
import { Sprite } from './Sprite'
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

/** a deterministic stroll: walk to a new spot near home, pause, repeat */
function wander(seed: number, t: number, home: { x: number; y: number }, box: [number, number, number, number], speed: number, seg = 8) {
  const k = Math.floor(t / seg)
  const u = t - k * seg
  const spot = (n: number) => ({
    x: Math.min(box[2], Math.max(box[0], home.x + (hash01(seed + n * 7919) - 0.5) * 90)),
    y: Math.min(box[3], Math.max(box[1], home.y + (hash01(seed + n * 104729) - 0.5) * 60)),
  })
  const a = spot(k)
  const b = spot(k + 1)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dur = Math.hypot(dx, dy) / speed
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0
  if (u < dur) {
    const f = u / dur
    return { x: a.x + dx * f, y: a.y + dy * f, moving: true, dir }
  }
  return { x: b.x, y: b.y, moving: false, dir: dir === 1 ? 0 : dir }
}

export function Garden({ goStudy, goShop }: { goStudy: () => void; goShop: () => void }) {
  const doc = useGame((s) => s.doc)
  const { place, stash, removeUnit, harvest, applyPot, say, buyZone } = useGame.getState()
  const atlas = useAtlas()
  const level = levelInfo(balance(doc, 'xp')).level
  const [zone, setZone] = useState('meadow')
  const { cols, rows } = gardenSize(level, zone)
  const [sel, setSel] = useState<{ x: number; y: number } | null>(null)
  const avatar: Avatar = doc.settings.avatar ?? DEFAULT_AVATAR
  const showCanvas = ownsZone(doc, zone)

  const drawn = useMemo<Drawn[]>(
    () =>
      placed(doc, zone).map((u) => {
        if (ITEMS[u.itemId].kind !== 'plant') return { u, stage: 4, ready: false }
        const p = plantProgress(doc, u)
        return { u, stage: p.stage, ready: p.ready }
      }),
    [doc, zone],
  )

  const wrap = useRef<HTMLDivElement>(null)
  const cv = useRef<HTMLCanvasElement>(null)
  const parts = useRef<Particle[]>([])
  const view = useRef({ drawn, cols, rows, sel, zone, avatar, atlas })
  const redraw = useRef<(() => void) | null>(null)
  useEffect(() => {
    view.current = { drawn, cols, rows, sel, zone, avatar, atlas }
    redraw.current?.()
  })

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
      const whole = Math.floor(avail / GW)
      k = whole >= 3 ? whole : avail / GW
      canvas.width = Math.round(GW * k)
      canvas.height = Math.round(GH * k)
      canvas.style.width = `${(GW * k) / dpr}px`
      canvas.style.height = `${(GH * k) / dpr}px`
      redraw.current?.()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(box)

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

      // everything that stands on the ground, painted back to front
      const scene: { y: number; draw: () => void }[] = []
      for (const p of bandProps(v.zone)) {
        const s = p.s(t)
        scene.push({ y: p.y, draw: () => drawSpr(ctx, s, p.x, p.y, p.flip) })
      }
      const box: [number, number, number, number] = [10, BAND + 10, v.cols * T - 10, BAND + v.rows * T - 4]
      const lights: { x: number; y: number; rgb: string; r: number }[] = []

      for (const { u, stage, ready } of v.drawn) {
        const cx = (u.x ?? 0) * T + T / 2
        const by = BAND + (u.y ?? 0) * T + 27
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
        } else if (isPet(u.itemId)) {
          const home = { x: cx, y: by }
          const w = wander(seedOf(u.id), t + hash01(seedOf(u.id)) * 50, home, box, u.itemId === 'chick' ? 14 : 20)
          const s = petSpr(u.itemId, w.moving, w.dir, t)
          scene.push({ y: w.y, draw: () => drawSpr(ctx, s, w.x, w.y) })
        } else {
          const s = decorSpr(u.itemId, t + (u.x ?? 0) * 0.7)
          scene.push({ y: by, draw: () => drawSpr(ctx, s, cx, by + 2) })
        }
      }

      // the player strolls about their land
      const me = wander(42, t, { x: (v.cols * T) / 2, y: BAND + v.rows * T - 18 }, box, 18, 9)
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

      // RPG-style selection cursor: four bouncing corner brackets
      if (v.sel) {
        const x0 = v.sel.x * T
        const y0 = BAND + v.sel.y * T
        const o = Math.floor(t * 3) % 2
        const corner = (x: number, y: number, fx: number, fy: number) => {
          ctx.fillStyle = '#2e1c14'
          ctx.fillRect(fx > 0 ? x : x - 5, fy > 0 ? y : y - 2, 6, 3)
          ctx.fillRect(fx > 0 ? x : x - 2, fy > 0 ? y : y - 5, 3, 6)
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(fx > 0 ? x + 1 : x - 4, fy > 0 ? y + 1 : y - 1, 4, 1)
          ctx.fillRect(fx > 0 ? x + 1 : x - 1, fy > 0 ? y + 1 : y - 4, 1, 4)
        }
        corner(x0 + 1 - o, y0 + 1 - o, 1, 1)
        corner(x0 + T - 1 + o, y0 + 1 - o, -1, 1)
        corner(x0 + 1 - o, y0 + T - 1 + o, 1, -1)
        corner(x0 + T - 1 + o, y0 + T - 1 + o, -1, -1)
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
    setSel(sel?.x === x && sel?.y === y ? null : { x, y })
  }

  const unitAt = sel ? placed(doc, zone).find((u) => u.x === sel.x && u.y === sel.y) : undefined
  const bag = inventory(doc).filter((u) => isPlaceable(u.itemId))
  const z = zoneDef(zone)

  return (
    <div className="stack">
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
          <div ref={wrap} className="garden-wrap">
            <canvas ref={cv} className="garden" onPointerDown={tap} />
          </div>
          {z.speed > 1 && <p className="zone-note">{z.emoji} Plants here grow {Math.round((z.speed - 1) * 100)}% faster</p>}
        </>
      )}

      {showCanvas && !sel && placed(doc).length === 0 && (
        <div className="panel center">
          <p className="big">Your garden is empty 🌿</p>
          <p>Grab some seeds from the shop, plant them, then study to make them grow.</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn gold" onClick={goShop}>Visit shop</button>
            <button className="btn" onClick={goStudy}>Start studying</button>
          </div>
        </div>
      )}

      {sel && !unitAt && (
        <div className="panel">
          <div className="row spread">
            <h3>Empty plot</h3>
            <button className="link" onClick={() => setSel(null)}>Close</button>
          </div>
          {bag.length === 0 ? (
            <p>Nothing in your bag to place. <button className="link" onClick={goShop}>Visit the shop →</button></p>
          ) : (
            <div className="grid-items">
              {Object.entries(
                bag.reduce<Record<string, Unit[]>>((m, u) => {
                  ;(m[u.itemId] ??= []).push(u)
                  return m
                }, {}),
              ).map(([id, list]) => (
                <button
                  key={id}
                  className="item"
                  onClick={() => {
                    const err = place(list[0].id, sel.x, sel.y, zone)
                    if (err) say(err)
                    else {
                      puff(sel.x, sel.y)
                      setSel(null)
                    }
                  }}
                >
                  <Sprite itemId={id} size={44} />
                  <span>{ITEMS[id].name}</span>
                  <b>×{list.length}</b>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {sel && unitAt && (
        <TileInfo
          key={unitAt.id}
          unit={unitAt}
          onClose={() => setSel(null)}
          harvest={() => {
            const def = ITEMS[unitAt.itemId] as PlantDef
            burst(sel.x, sel.y, def.harvest, plantSpr(unitAt.itemId, 4))
            harvest(unitAt.id)
            setSel(null)
          }}
          remove={() => {
            if (confirm(`Remove ${ITEMS[unitAt.itemId].name}? Plants can't be recovered.`)) { removeUnit(unitAt.id); setSel(null) }
          }}
          stash={() => { stash(unitAt.id); setSel(null) }}
          applyPot={(potUnitId) => { applyPot(unitAt.id, potUnitId); puff(sel.x, sel.y) }}
        />
      )}
    </div>
  )
}

function TileInfo(props: {
  unit: Unit
  onClose: () => void
  harvest: () => void
  remove: () => void
  stash: () => void
  applyPot: (potUnitId: string) => void
}) {
  const doc = useGame((s) => s.doc)
  const { unit } = props
  const def = ITEMS[unit.itemId]
  if (def.kind === 'decor')
    return (
      <div className="panel">
        <div className="row spread">
          <h3>{def.name}</h3>
          <button className="link" onClick={props.onClose}>Close</button>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Sprite itemId={unit.itemId} size={72} animate />
          <p className="grow">{def.blurb}</p>
        </div>
        <button className="btn ghost" onClick={props.stash}>Move back to bag</button>
      </div>
    )
  if (def.kind !== 'plant') return null
  const plant = def as PlantDef
  const p = plantProgress(doc, unit)
  const pots = inventory(doc).filter((u) => ITEMS[u.itemId].kind === 'pot')
  const stageNames = ['Seed', 'Sprout', 'Growing', 'Nearly there', 'Ready!']
  const regrowing = !!(plant.regrow && unit.cycles)
  return (
    <div className="panel">
      <div className="row spread">
        <h3>
          {plant.name} <small style={{ color: RARITY_COLOR[plant.rarity] }}>{plant.rarity}</small>
        </h3>
        <button className="link" onClick={props.onClose}>Close</button>
      </div>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <Sprite itemId={unit.itemId} stage={p.stage} pot={unit.pot} size={80} />
        <div className="grow">
          <p>{regrowing && !p.ready ? 'Growing new fruit' : stageNames[p.stage]}{unit.pot ? ` · ${ITEMS[unit.pot].name}` : ''}</p>
          <div className="bar"><span style={{ width: `${p.ratio * 100}%` }} /></div>
          <p className="muted">
            {p.ready ? 'Ready to harvest!' : `${fmtMin(p.left)} of study until ${regrowing ? 'the next crop' : 'harvest'}`}
          </p>
          {plant.regrow && <p className="muted">🌳 Keeps fruiting after each harvest</p>}
        </div>
      </div>
      {p.ready && (
        <button className="btn gold" onClick={props.harvest}>
          Harvest +{plant.harvest} 🪙{plant.harvestGems ? ` +${plant.harvestGems} 💎` : ''}
        </button>
      )}
      {pots.length > 0 && !isTree(unit.itemId) && (
        <>
          <h4>Repot</h4>
          <div className="grid-items">
            {Object.entries(
              pots.reduce<Record<string, Unit[]>>((m, u) => {
                ;(m[u.itemId] ??= []).push(u)
                return m
              }, {}),
            ).map(([id, list]) => (
              <button key={id} className="item" onClick={() => props.applyPot(list[0].id)}>
                <Sprite itemId={id} size={36} />
                <span>{ITEMS[id].name}</span>
                <b>×{list.length}</b>
              </button>
            ))}
          </div>
        </>
      )}
      <button className="btn red small" onClick={props.remove}>Remove plant</button>
    </div>
  )
}
