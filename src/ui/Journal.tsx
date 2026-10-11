import { useRef, useState } from 'react'
import { ACHIEVEMENTS, isUnlocked } from '../game/achievements'
import { balance, dateKey, fmtMin, levelInfo, live, ownedUnits, streak } from '../game/calc'
import { COSMETICS, DECOR, DEFAULT_AVATAR, HAIR, ITEMS, PLANTS, POTS, RARITY_COLOR, SKIN, titleFor } from '../game/data'
import { useGame } from '../game/store'
import { supabase } from '../game/supabase'
import type { Avatar } from '../game/types'
import { AvatarView } from './AvatarView'
import { ModuleStats } from './ModuleStats'
import { Sprite } from './Sprite'

function Heatmap() {
  const doc = useGame((s) => s.doc)
  const per: Record<string, number> = {}
  for (const s of live(doc.sessions)) per[dateKey(s.start)] = (per[dateKey(s.start)] ?? 0) + s.eff
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) - 7 * 17)
  const weeks = Array.from({ length: 18 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const t = new Date(monday)
      t.setDate(monday.getDate() + w * 7 + d)
      const k = dateKey(t.getTime())
      return { k, v: per[k] ?? 0, future: t > today }
    }),
  )
  const lvl = (v: number) => (v <= 0 ? 0 : v < 30 ? 1 : v < 60 ? 2 : v < 120 ? 3 : 4)
  return (
    <div className="heat">
      {weeks.map((w, i) => (
        <div key={i}>
          {w.map((d) => (
            <i key={d.k} className={`h${d.future ? 'x' : lvl(d.v)}`} title={`${d.k}: ${fmtMin(d.v)}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

function Wardrobe() {
  const doc = useGame((s) => s.doc)
  const st = useGame.getState()
  const av: Avatar = { ...DEFAULT_AVATAR, ...doc.settings.avatar }
  const owned = new Set(ownedUnits(doc).map((u) => u.itemId))
  const set = (patch: Partial<Avatar>) => st.setSettings({ avatar: { ...av, ...patch } })
  const hats = COSMETICS.filter((c) => c.slot === 'hat' && owned.has(c.id))
  const outfits = COSMETICS.filter((c) => c.slot === 'outfit' && owned.has(c.id))

  return (
    <div className="panel">
      <h3>🧑‍🌾 Your character</h3>
      <div className="wardrobe">
        <div className="avatar-stage">
          <AvatarView avatar={av} size={136} stage />
        </div>
        <div className="grow stack" style={{ gap: 8 }}>
          <div>
            <small>Skin</small>
            <div className="chips">
              {SKIN.map((c, i) => (
                <button key={c} className={`swatch ${av.skin === i ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ skin: i })} aria-label={`Skin ${i + 1}`} />
              ))}
            </div>
          </div>
          <div>
            <small>Hair</small>
            <div className="chips">
              {['Short', 'Long', 'Bun'].map((h, i) => (
                <button key={h} className={`chip ${av.hair === i ? 'on' : ''}`} onClick={() => set({ hair: i })}>{h}</button>
              ))}
            </div>
            <div className="chips" style={{ marginTop: 6 }}>
              {HAIR.map((c, i) => (
                <button key={c} className={`swatch ${av.hairColor === i ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ hairColor: i })} aria-label={`Hair colour ${i + 1}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
      <small>Hat</small>
      <div className="chips">
        <button className={`chip ${!av.hat ? 'on' : ''}`} onClick={() => set({ hat: undefined })}>None</button>
        {hats.map((h) => (
          <button key={h.id} className={`chip ${av.hat === h.id ? 'on' : ''}`} onClick={() => set({ hat: h.id })}>{h.name}</button>
        ))}
      </div>
      <small>Outfit</small>
      <div className="chips">
        <button className={`chip ${!av.outfit ? 'on' : ''}`} onClick={() => set({ outfit: undefined })}>Overalls</button>
        {outfits.map((o) => (
          <button key={o.id} className={`chip ${av.outfit === o.id ? 'on' : ''}`} onClick={() => set({ outfit: o.id })}>{o.name}</button>
        ))}
      </div>
      {hats.length + outfits.length === 0 && <p className="muted">Buy hats and outfits in the Shop → 👒 Style.</p>}
    </div>
  )
}

function Achievements() {
  const doc = useGame((s) => s.doc)
  const st = useGame.getState()
  const [showAll, setShowAll] = useState(false)
  const level = levelInfo(balance(doc, 'xp')).level
  const current = doc.settings.title ?? titleFor(level)
  const rows = ACHIEVEMENTS.map((a) => {
    const [cur, target] = a.progress(doc)
    return { a, cur: Math.min(cur, target), target, done: isUnlocked(doc, a.id) }
  }).sort((x, y) => Number(y.done) - Number(x.done) || y.cur / y.target - x.cur / x.target)
  const unlocked = rows.filter((r) => r.done).length
  const list = showAll ? rows : rows.slice(0, 6)

  return (
    <div className="panel">
      <div className="row spread">
        <h3>🏆 Achievements {unlocked}/{ACHIEVEMENTS.length}</h3>
      </div>
      <p className="muted">Each one unlocks a title. Current title: <b>{current}</b>{doc.settings.title && (
        <> · <button className="link" onClick={() => st.setSettings({ title: undefined })}>use level title</button></>
      )}</p>
      {list.map(({ a, cur, target, done }) => (
        <div key={a.id} className={`ach ${done ? 'done' : ''}`}>
          <div className="ach-icon">{done ? a.icon : '🔒'}</div>
          <div className="grow">
            <b>{a.name}</b> <small>· "{a.title}"</small>
            <small className="block">{a.desc} · +{a.gold} 🪙{a.gem ? ` +${a.gem} 💎` : ''}</small>
            {!done && target > 1 && <div className="bar thin"><span style={{ width: `${(cur / target) * 100}%` }} /></div>}
          </div>
          {done && (
            <button className={`btn small ${current === a.title ? '' : 'ghost'}`} disabled={current === a.title} onClick={() => st.setSettings({ title: a.title })}>
              {current === a.title ? 'Worn' : 'Wear'}
            </button>
          )}
        </div>
      ))}
      {rows.length > 6 && (
        <button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer' : `Show all ${rows.length}`}</button>
      )}
    </div>
  )
}

export function Journal({ email }: { email: string }) {
  const doc = useGame((s) => s.doc)
  const sync = useGame((s) => s.sync)
  const syncError = useGame((s) => s.syncError)
  const st = useGame.getState()
  const file = useRef<HTMLInputElement>(null)
  const sessions = live(doc.sessions)
  const total = sessions.reduce((t, s) => t + s.minutes, 0)
  const everOwned = new Set(live(doc.units).map((u) => u.itemId))
  const harvested = live(doc.units).filter((u) => u.harvested).length
  const all = [...PLANTS, ...POTS, ...DECOR, ...COSMETICS]

  const exportData = () => {
    const blob = new Blob([st.exportJson()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `study-valley-backup-${dateKey(Date.now())}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="stack">
      <div className="panel stats">
        <div><b>{fmtMin(total)}</b><small>studied</small></div>
        <div><b>{sessions.length}</b><small>sessions</small></div>
        <div><b>{streak(doc)}🔥</b><small>streak</small></div>
        <div><b>{harvested}</b><small>harvests</small></div>
      </div>

      <Wardrobe />
      <Achievements />

      <div className="panel">
        <h3>Study heatmap</h3>
        <Heatmap />
      </div>

      <ModuleStats />

      <div className="panel">
        <h3>Collection {all.filter((i) => everOwned.has(i.id)).length}/{all.length}</h3>
        <div className="book">
          {all.map((it) => {
            const found = everOwned.has(it.id)
            return (
              <div key={it.id} className={`book-item ${found ? '' : 'unfound'}`} title={found ? it.name : '???'}>
                <Sprite itemId={it.id} size={48} className={found ? '' : 'silhouette'} />
                <small style={{ color: it.kind === 'plant' && found ? RARITY_COLOR[it.rarity] : undefined }}>
                  {found ? ITEMS[it.id].name : '???'}
                </small>
              </div>
            )
          })}
        </div>
      </div>

      <div className="panel stack">
        <h3>Settings</h3>
        <label className="check"><input type="checkbox" checked={doc.settings.sound} onChange={(e) => st.setSettings({ sound: e.target.checked })} /> Sound effects</label>
        <label className="check"><input type="checkbox" checked={doc.settings.haptics} onChange={(e) => st.setSettings({ haptics: e.target.checked })} /> Vibration (Android)</label>
        <p className="muted">Signed in as {email}. Sync: {sync}{syncError ? ` (${syncError})` : ''}</p>
        <div className="row">
          <button className="btn small" onClick={() => void st.syncNow()}>Sync now</button>
          <button className="btn small ghost" onClick={exportData}>Export backup</button>
          <button className="btn small ghost" onClick={() => file.current?.click()}>Import</button>
          <button className="btn small red" onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const err = st.importJson(await f.text())
            st.say(err ?? 'Backup merged into your valley!')
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
