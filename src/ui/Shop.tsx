import { useState } from 'react'
import { balance, inventory, levelInfo } from '../game/calc'
import { COSMETICS, DECOR, ITEMS, PLANTS, POTS, RARITY_COLOR } from '../game/data'
import { useGame } from '../game/store'
import type { ItemDef, PlantDef, PotDef } from '../game/types'
import { Sprite } from './Sprite'

type Cat = 'plant' | 'garden' | 'nature' | 'magic' | 'pet' | 'pot' | 'cosmetic'
const LISTS: Record<Cat, ItemDef[]> = {
  plant: PLANTS,
  garden: DECOR.filter((d) => d.cat === 'garden'),
  nature: DECOR.filter((d) => d.cat === 'nature'),
  magic: DECOR.filter((d) => d.cat === 'magic'),
  pet: DECOR.filter((d) => d.cat === 'pet'),
  pot: POTS,
  cosmetic: COSMETICS,
}
const CAT_LABEL: Record<Cat, string> = {
  plant: '🌱 Seeds', garden: '🏮 Garden', nature: '🌳 Nature', magic: '✨ Magic', pet: '🐾 Pets', pot: '🏺 Pots', cosmetic: '👒 Style',
}

export function Shop() {
  const doc = useGame((s) => s.doc)
  const [cat, setCat] = useState<Cat>('plant')
  const gold = balance(doc, 'gold')
  const gems = balance(doc, 'gem')
  const level = levelInfo(balance(doc, 'xp')).level
  const bag = inventory(doc)
  const count = (id: string) => bag.filter((u) => u.itemId === id).length

  return (
    <div className="stack">
      <div className="chips tabs-sub">
        {(Object.keys(LISTS) as Cat[]).map((c) => (
          <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{CAT_LABEL[c]}</button>
        ))}
      </div>
      <div className="stack">
        {LISTS[cat].map((it) => {
          const locked = level < it.minLevel
          const ownedStyle = it.kind === 'cosmetic' && count(it.id) > 0
          const affordable = gold >= it.cost && gems >= (it.gemCost ?? 0)
          return (
            <div key={it.id} className={`panel shop-item ${locked ? 'locked' : ''}`}>
              <div className="shop-art"><Sprite itemId={it.id} size={60} className={locked ? 'silhouette' : ''} /></div>
              <div className="grow">
                <h4>
                  {locked ? '???' : it.name}
                  {it.kind === 'plant' && (
                    <small style={{ color: RARITY_COLOR[(it as PlantDef).rarity], marginLeft: 6 }}>{(it as PlantDef).rarity}</small>
                  )}
                </h4>
                <p className="muted">
                  {locked ? `Unlocks at level ${it.minLevel}` : it.blurb}
                  {!locked && it.kind === 'plant' && ` · ${Math.round((it as PlantDef).minutes / 60 * 10) / 10}h to grow · sells ${(it as PlantDef).harvest}🪙${(it as PlantDef).regrow ? ' · fruits again' : ''}`}
                  {!locked && it.kind === 'pot' && ` · ×${(it as PotDef).speed}`}
                </p>
                {count(it.id) > 0 && it.kind !== 'cosmetic' && <small>In bag: {count(it.id)}</small>}
              </div>
              <button
                className={`btn small ${affordable && !locked && !ownedStyle ? 'gold' : ''}`}
                disabled={locked || ownedStyle}
                onClick={() => {
                  const err = useGame.getState().buy(it.id)
                  if (err) useGame.getState().say(err)
                  else if (it.kind === 'cosmetic') useGame.getState().say(`Bought ${it.name}! Wear it from the Journal tab.`)
                  else useGame.getState().say(`Bought ${ITEMS[it.id].name}! Find it in your garden bag.`)
                }}
              >
                {ownedStyle ? 'Owned' : it.gemCost ? `${it.gemCost} 💎` : `${it.cost} 🪙`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
