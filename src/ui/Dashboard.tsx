import { useState } from 'react'
import { dateKey, fmtMin, studySessions, weekKey } from '../game/calc'
import { useGame } from '../game/store'

type Range = 'today' | 'week' | 'all'
const RANGES: [Range, string][] = [['today', 'Today'], ['week', 'This week'], ['all', 'All time']]
const GREY = '#8a7a66'

/** the last n days, oldest first, each noon-anchored so daylight saving never skips or repeats one */
function lastDays(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setHours(12, 0, 0, 0)
    d.setDate(d.getDate() - (n - 1 - i))
    return { key: dateKey(d.getTime()), label: d.toLocaleDateString(undefined, { weekday: 'narrow' }), full: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) }
  })
}

/** a small study dashboard: how long, and what it was spent on, today, this week or ever */
export function Dashboard() {
  const doc = useGame((s) => s.doc)
  const [range, setRange] = useState<Range>('today')
  const sessions = studySessions(doc)
  const today = dateKey(Date.now())
  const wk = weekKey(Date.now())

  const info = (id: string) => {
    const m = doc.modules[id]
    return { name: m ? `${m.emoji} ${m.name}` : 'Deleted module', color: m?.color ?? GREY }
  }

  const picked = sessions.filter((s) =>
    range === 'today' ? dateKey(s.start) === today : range === 'week' ? weekKey(s.start) === wk : true,
  )
  const per = new Map<string, { minutes: number; sessions: number }>()
  for (const s of picked) {
    const r = per.get(s.moduleId) ?? { minutes: 0, sessions: 0 }
    r.minutes += s.minutes
    r.sessions += 1
    per.set(s.moduleId, r)
  }
  const rows = [...per.entries()].map(([id, r]) => ({ id, ...r, ...info(id) })).sort((a, b) => b.minutes - a.minutes)
  const total = rows.reduce((t, r) => t + r.minutes, 0)

  const days = lastDays(7).map((d) => {
    const mine = sessions.filter((s) => dateKey(s.start) === d.key)
    const byMod = new Map<string, number>()
    for (const s of mine) byMod.set(s.moduleId, (byMod.get(s.moduleId) ?? 0) + s.minutes)
    const sum = mine.reduce((t, s) => t + s.minutes, 0)
    return { ...d, sum, segs: [...byMod.entries()].map(([id, minutes]) => ({ id, minutes, color: info(id).color })) }
  })
  const dayMax = Math.max(1, ...days.map((d) => d.sum))

  return (
    <div className="panel">
      <div className="row spread">
        <h3>📈 Study dashboard</h3>
      </div>
      <div className="chips">
        {RANGES.map(([id, label]) => (
          <button key={id} className={`chip ${range === id ? 'on' : ''}`} onClick={() => setRange(id)}>{label}</button>
        ))}
      </div>

      <div className="dash-total">
        <b>{fmtMin(total)}</b>
        <small>
          {picked.length} session{picked.length === 1 ? '' : 's'}
          {range === 'all' && sessions.length > 0 ? ` since ${new Date(Math.min(...sessions.map((s) => s.start))).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
        </small>
      </div>

      {total === 0 ? (
        <p className="muted">{range === 'today' ? 'Nothing studied yet today.' : range === 'week' ? 'Nothing studied yet this week.' : 'No study sessions yet.'}</p>
      ) : (
        <>
          <div className="split" role="img" aria-label="Split of study time by module">
            {rows.map((r) => (
              <span key={r.id} style={{ width: `${(r.minutes / total) * 100}%`, background: r.color }} title={`${r.name}: ${fmtMin(r.minutes)}`} />
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.id} className="dash-row">
              <span className="dot" style={{ background: r.color }} />
              <span className="mod-name grow">{r.name}</span>
              <b>{fmtMin(r.minutes)}</b>
              <small>{Math.round((r.minutes / total) * 100)}%</small>
            </div>
          ))}
        </>
      )}

      <small className="block" style={{ marginTop: 8 }}>Last 7 days</small>
      <div className="days">
        {days.map((d) => (
          <div key={d.key} className={d.key === today ? 'today' : ''} title={`${d.full}: ${d.sum ? fmtMin(d.sum) : 'no study'}`}>
            <small>{d.sum ? fmtMin(d.sum) : '–'}</small>
            <span className="col">
              <span className="stack-col" style={{ height: `${(d.sum / dayMax) * 100}%` }}>
                {d.segs.map((g) => (
                  <i key={g.id} style={{ flexGrow: g.minutes, background: g.color }} />
                ))}
              </span>
            </span>
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
