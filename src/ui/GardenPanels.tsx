import { useGame } from '../game/store'
import {
  CORNERS, animalsIn, fmtMin, fmtRefund, inventory, isAnimal, isCorner, isPlaceable, ownedUnits, plantProgress, refundOf, slotsFor, unitInSlot,
} from '../game/calc'
import type { Slot } from '../game/calc'
import { ITEMS, RARITY_COLOR, ZONES, zoneDef } from '../game/data'
import { isTree, plantSpr } from '../game/sprites'
import type { Spr } from '../game/sprites'
import type { PlantDef, Unit } from '../game/types'
import { Sprite } from './Sprite'

export interface GardenFx {
  puff: (x: number, y: number) => void
  burst: (x: number, y: number, gold: number, spr?: Spr) => void
}

const SLOT_LABEL: Record<Slot, string> = {
  plant: 'Plot',
  floor: 'Floor',
  centre: 'Centre',
  c0: 'Back left',
  c1: 'Back right',
  c2: 'Front left',
  c3: 'Front right',
}
const SLOT_SHORT: Record<Slot, string> = { plant: 'Plot', floor: 'Floor', centre: 'Centre', c0: 'Back L', c1: 'Back R', c2: 'Front L', c3: 'Front R' }
const SLOT_ICON: Record<Slot, string> = { plant: '🌱', floor: '▦', centre: '◉', c0: '◰', c1: '◳', c2: '◱', c3: '◲' }

function groupByItem(list: Unit[]) {
  return Object.entries(
    list.reduce<Record<string, Unit[]>>((m, u) => {
      ;(m[u.itemId] ??= []).push(u)
      return m
    }, {}),
  )
}

/** the seven places on a tile: a plant plot, four small corners, the centre and the floor */
function SlotGrid(props: {
  zone: string
  x: number
  y: number
  slot: Slot
  setSlot: (s: Slot) => void
  mover?: Unit
}) {
  const doc = useGame((s) => s.doc)
  const { zone, x, y, slot, mover } = props
  const btn = (s: Slot) => {
    const u = unitInSlot(doc, zone, x, y, s)
    const fits = !mover || slotsFor(mover.itemId).includes(s)
    return (
      <button
        key={s}
        className={`slot ${slot === s ? 'on' : ''} ${u ? 'full' : ''}`}
        disabled={!fits}
        onClick={() => props.setSlot(s)}
        title={SLOT_LABEL[s]}
      >
        {u ? <Sprite itemId={u.itemId} size={30} stage={ITEMS[u.itemId].kind === 'plant' ? plantProgress(doc, u).stage : undefined} pot={u.pot} /> : <span className="slot-icon">{SLOT_ICON[s]}</span>}
        <small>{SLOT_SHORT[s]}</small>
      </button>
    )
  }
  return (
    <div className="slot-grid">
      <div className="slot-row three">
        {btn('plant')}
        {btn('centre')}
        {btn('floor')}
      </div>
      <div className="slot-row four">{CORNERS.map(btn)}</div>
    </div>
  )
}

export function TilePanel(props: {
  zone: string
  x: number
  y: number
  slot: Slot
  setSlot: (s: Slot) => void
  moving: string | null
  setMoving: (id: string | null) => void
  onClose: () => void
  fx: GardenFx
  goShop: () => void
}) {
  const doc = useGame((s) => s.doc)
  const { zone, x, y, slot, moving, fx } = props
  const { place, move, harvest, removeUnit, stash, applyPot, say } = useGame.getState()
  const unit = unitInSlot(doc, zone, x, y, slot)
  const mover = moving ? doc.units[moving] : undefined

  return (
    <div className="panel">
      <div className="row spread">
        <h3>Tile {x + 1}, {y + 1}</h3>
        <button className="link" onClick={props.onClose}>Close</button>
      </div>
      <SlotGrid zone={zone} x={x} y={y} slot={slot} setSlot={props.setSlot} mover={mover} />

      {mover ? (
        <MovePrompt
          mover={mover}
          unit={unit}
          slot={slot}
          onMove={() => {
            const err = move(mover.id, x, y, zone, slot)
            if (err) say(err)
            else {
              fx.puff(x, y)
              props.setMoving(null)
            }
          }}
          onCancel={() => props.setMoving(null)}
        />
      ) : unit ? (
        <UnitCard
          key={unit.id}
          unit={unit}
          onMove={() => props.setMoving(unit.id)}
          harvest={() => {
            const def = ITEMS[unit.itemId] as PlantDef
            fx.burst(x, y, def.harvest, plantSpr(unit.itemId, 4))
            harvest(unit.id)
          }}
          remove={() => {
            if (confirm(`Remove ${ITEMS[unit.itemId].name}? Plants can't be recovered.`)) removeUnit(unit.id)
          }}
          stash={() => stash(unit.id)}
          applyPot={(potUnitId) => {
            applyPot(unit.id, potUnitId)
            fx.puff(x, y)
          }}
        />
      ) : (
        <Picker
          slot={slot}
          goShop={props.goShop}
          onPick={(u) => {
            const err = place(u.id, x, y, zone, slot)
            if (err) say(err)
            else fx.puff(x, y)
          }}
        />
      )}
    </div>
  )
}

function MovePrompt(props: { mover: Unit; unit?: Unit; slot: Slot; onMove: () => void; onCancel: () => void }) {
  const { mover, unit, slot } = props
  const name = ITEMS[mover.itemId].name
  const fits = slotsFor(mover.itemId).includes(slot)
  const here = unit?.id === mover.id
  return (
    <div className="move-prompt stack" style={{ gap: 8 }}>
      <p>✋ Moving <b>{name}</b></p>
      {!fits ? (
        <p className="muted">{name} doesn't fit in the {SLOT_LABEL[slot].toLowerCase()} spot. Pick another one.</p>
      ) : here ? (
        <p className="muted">It's already here. Tap another tile or spot.</p>
      ) : (
        <button className="btn gold" onClick={props.onMove}>
          {unit ? `Swap with ${ITEMS[unit.itemId].name}` : `Move here`}
        </button>
      )}
      <button className="link" onClick={props.onCancel}>Cancel move</button>
    </div>
  )
}

/** what to put in an empty slot: the matching things from the bag */
function Picker(props: { slot: Slot; onPick: (u: Unit) => void; goShop: () => void }) {
  const doc = useGame((s) => s.doc)
  const bag = inventory(doc).filter((u) => isPlaceable(u.itemId))
  const fits = bag.filter((u) => slotsFor(u.itemId).includes(props.slot))
  const tooBig = props.slot !== 'centre' && isCorner(props.slot) ? bag.filter((u) => ITEMS[u.itemId].kind === 'decor' && !slotsFor(u.itemId).includes(props.slot) && slotsFor(u.itemId).includes('centre')).length : 0
  const what = props.slot === 'plant' ? 'seed or plant' : props.slot === 'floor' ? 'floor piece' : 'decoration'
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>{SLOT_LABEL[props.slot]}: empty</h4>
      {fits.length === 0 ? (
        <p className="muted">
          No {what} in your bag. <button className="link" onClick={props.goShop}>Visit the shop →</button>
        </p>
      ) : (
        <div className="grid-items">
          {groupByItem(fits).map(([id, list]) => (
            <button key={id} className="item" onClick={() => props.onPick(list[0])}>
              <Sprite itemId={id} size={44} />
              <span>{ITEMS[id].name}</span>
              <b>×{list.length}</b>
            </button>
          ))}
        </div>
      )}
      {tooBig > 0 && <p className="muted">{tooBig} bigger piece{tooBig === 1 ? '' : 's'} in your bag only fit{tooBig === 1 ? 's' : ''} in the centre.</p>}
    </div>
  )
}

/** a full refund of what the decor cost; only shown for pieces that were bought */
function RefundButton({ unitId }: { unitId: string }) {
  const doc = useGame((s) => s.doc)
  const r = refundOf(doc, unitId)
  if (!r) return null
  const name = ITEMS[doc.units[unitId].itemId].name
  return (
    <button
      className="btn small red"
      onClick={() => confirm(`Refund ${name} for ${fmtRefund(r)}? It will be removed from your valley.`) && useGame.getState().refundUnit(unitId)}
    >
      Refund {fmtRefund(r)}
    </button>
  )
}

function UnitCard(props: {
  unit: Unit
  onMove: () => void
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
      <div className="stack" style={{ gap: 8 }}>
        <h4>{def.name}</h4>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <Sprite itemId={unit.itemId} size={72} animate />
          <p className="grow">{def.blurb}</p>
        </div>
        <div className="row">
          <button className="btn small" onClick={props.onMove}>✋ Move</button>
          <button className="btn small ghost" onClick={props.stash}>Move to bag</button>
          <RefundButton unitId={unit.id} />
        </div>
      </div>
    )
  if (def.kind !== 'plant') return null
  const plant = def as PlantDef
  const p = plantProgress(doc, unit)
  const pots = inventory(doc).filter((u) => ITEMS[u.itemId].kind === 'pot')
  const stageNames = ['Seed', 'Sprout', 'Growing', 'Nearly there', 'Ready!']
  const regrowing = !!(plant.regrow && unit.cycles)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <h4>
        {plant.name} <small style={{ color: RARITY_COLOR[plant.rarity] }}>{plant.rarity}</small>
      </h4>
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
            {groupByItem(pots).map(([id, list]) => (
              <button key={id} className="item" onClick={() => props.applyPot(list[0].id)}>
                <Sprite itemId={id} size={36} />
                <span>{ITEMS[id].name}</span>
                <b>×{list.length}</b>
              </button>
            ))}
          </div>
        </>
      )}
      <div className="row">
        <button className="btn small" onClick={props.onMove}>✋ Move</button>
        <button className="btn red small" onClick={props.remove}>Remove plant</button>
      </div>
    </div>
  )
}

/** animals live in a garden and roam all of it; choose which garden each one lives in here */
export function AnimalsPanel({ zone, goShop }: { zone: string; goShop: () => void }) {
  const doc = useGame((s) => s.doc)
  const { setAnimalZone } = useGame.getState()
  const all = ownedUnits(doc).filter((u) => isAnimal(u.itemId))
  const here = animalsIn(doc, zone).length
  return (
    <div className="panel">
      <h3>🐾 Animals {all.length > 0 && <small>{here} roaming here</small>}</h3>
      {all.length === 0 ? (
        <p className="muted">
          No animals yet. They roam the whole garden and never take up a tile.{' '}
          <button className="link" onClick={goShop}>Visit the shop →</button>
        </p>
      ) : (
        all.map((u) => {
          const def = ITEMS[u.itemId]
          const inHere = u.zone === zone
          const elsewhere = u.zone && !inHere
          return (
            <div key={u.id} className="animal">
              <Sprite itemId={u.itemId} size={40} animate />
              <div className="grow">
                <b>{def.name}</b>
                <small className="block">
                  {inHere ? 'Roaming here' : elsewhere ? `In the ${zoneDef(u.zone).name}` : 'Resting in your bag'}
                </small>
              </div>
              {inHere ? (
                <button className="btn small ghost" onClick={() => setAnimalZone(u.id, null)}>Rest</button>
              ) : (
                <button className="btn small" onClick={() => setAnimalZone(u.id, zone)}>{elsewhere ? 'Bring here' : 'Let out'}</button>
              )}
              <RefundButton unitId={u.id} />
            </div>
          )
        })
      )}
      {ZONES.length > 1 && all.length > 0 && <p className="muted">Each animal lives in one garden at a time.</p>}
    </div>
  )
}
