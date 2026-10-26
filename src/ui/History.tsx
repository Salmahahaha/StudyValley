import { useState } from 'react'
import { dateKey, fmtMin, isBreak, live } from '../game/calc'
import { useGame } from '../game/store'
import type { Session } from '../game/types'

const PREVIEW = 8
const PAGE = 40

const fmtDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtClock = (ts: number) => new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

function Row({ s, full }: { s: Session; full: boolean }) {
  const doc = useGame((st) => st.doc)
  const m = doc.modules[s.moduleId]
  const rest = isBreak(s)
  return (
    <div className="sess">
      <span className="dot" style={{ background: rest ? '#c9a46a' : m?.color ?? '#888' }} />
      <div className="grow">
        <b>{rest ? '☕ Break' : m ? `${m.emoji} ${m.name}` : 'Deleted module'}</b>
        <small>
          {full
            ? s.source === 'manual' ? 'Logged by hand' : fmtClock(s.start)
            : new Date(s.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {' · '}{fmtMin(s.minutes)}{s.source === 'manual' && !full ? ' · logged' : s.focus ? ' · focus ✓' : ''}
          {s.note ? ` · ${s.note}` : ''}
        </small>
      </div>
      <button className="link" aria-label="Delete session" onClick={() => confirm('Delete this session and its rewards?') && useGame.getState().deleteSession(s.id)}>✕</button>
    </div>
  )
}

/** the latest few sessions, with an optional full history grouped by day and filterable by module */
export function History() {
  const doc = useGame((s) => s.doc)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(PAGE)
  const all = live(doc.sessions).sort((a, b) => b.start - a.start)
  if (!all.length) return null

  if (!open)
    return (
      <div className="panel">
        <h3>Recent sessions</h3>
        {all.slice(0, PREVIEW).map((s) => <Row key={s.id} s={s} full={false} />)}
        {all.length > PREVIEW && (
          <button className="link" onClick={() => setOpen(true)}>See full history ({all.length} sessions)</button>
        )}
      </div>
    )

  // modules (and breaks) that have at least one session, so there are no empty filters
  const ids = [...new Set(all.map((s) => (isBreak(s) ? 'break' : s.moduleId)))]
  const active = ids.includes(filter) ? filter : 'all'
  const list = active === 'all' ? all : all.filter((s) => (active === 'break' ? isBreak(s) : s.moduleId === active))
  const page = list.slice(0, shown)
  const studied = list.filter((s) => !isBreak(s)).reduce((t, s) => t + s.minutes, 0)

  const groups: { key: string; items: Session[] }[] = []
  for (const s of page) {
    const k = dateKey(s.start)
    const last = groups[groups.length - 1]
    if (last?.key === k) last.items.push(s)
    else groups.push({ key: k, items: [s] })
  }
  // the day total counts every session that day (not just the ones on this page)
  const dayTotal = (key: string) =>
    list.filter((s) => !isBreak(s) && dateKey(s.start) === key).reduce((t, s) => t + s.minutes, 0)

  return (
    <div className="panel">
      <div className="row spread">
        <h3>Session history</h3>
        <button className="link" onClick={() => { setOpen(false); setShown(PAGE) }}>Show less</button>
      </div>
      <div className="chips">
        <button className={`chip ${active === 'all' ? 'on' : ''}`} onClick={() => { setFilter('all'); setShown(PAGE) }}>All</button>
        {ids.map((id) => {
          const m = doc.modules[id]
          return (
            <button
              key={id}
              className={`chip ${active === id ? 'on' : ''}`}
              style={{ '--c': id === 'break' ? '#c9a46a' : m?.color } as React.CSSProperties}
              onClick={() => { setFilter(id); setShown(PAGE) }}
            >
              {id === 'break' ? '☕ Breaks' : m ? `${m.emoji} ${m.name}` : 'Deleted module'}
            </button>
          )
        })}
      </div>
      <p className="muted">{list.length} session{list.length === 1 ? '' : 's'}{active !== 'break' ? ` · ${fmtMin(studied)} studied` : ''}</p>
      {groups.map((g) => (
        <div key={g.key} className="hist-day">
          <div className="hist-head">
            <b>{fmtDay(g.key)}</b>
            {active !== 'break' && <small>{fmtMin(dayTotal(g.key))}</small>}
          </div>
          {g.items.map((s) => <Row key={s.id} s={s} full />)}
        </div>
      ))}
      {list.length > shown && (
        <button className="btn small ghost" onClick={() => setShown(shown + PAGE)}>Show older ({list.length - shown} more)</button>
      )}
    </div>
  )
}
