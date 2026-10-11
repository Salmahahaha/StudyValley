import { useState } from 'react'
import { claimed, examInfo, fmtMin, live, moduleExams, moduleStats } from '../game/calc'
import { useGame } from '../game/store'

const fmtDay = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const ago = (ts: number) => {
  const d = Math.round((new Date().setHours(12, 0, 0, 0) - new Date(ts).setHours(12, 0, 0, 0)) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

/** every module's lifetime totals, with a tap-to-open breakdown */
export function ModuleStats() {
  const doc = useGame((s) => s.doc)
  const [open, setOpen] = useState<string | null>(null)
  const rows = live(doc.modules)
    .map((m) => ({ m, s: moduleStats(doc, m.id) }))
    .sort((a, b) => b.s.minutes - a.s.minutes)
  const max = Math.max(1, ...rows.map((r) => r.s.minutes))
  const total = rows.reduce((t, r) => t + r.s.minutes, 0)

  return (
    <div className="panel">
      <h3>📊 Time per module</h3>
      {rows.length === 0 && <p className="muted">No modules yet.</p>}
      {rows.length > 0 && <p className="muted">Total time you've spent on each module. Tap one for the breakdown.</p>}
      {rows.map(({ m, s }) => {
        const isOpen = open === m.id
        const weekMax = Math.max(1, ...s.perWeek.map((w) => w.minutes))
        const exams = moduleExams(m).map((ex) => examInfo(doc, m, ex)).sort((a, z) => a.exam.date.localeCompare(z.exam.date))
        return (
          <div key={m.id} className="mstat">
            <button className="mstat-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}>
              <span className="mstat-title">
                <span className="mod-name">{m.emoji} {m.name}</span>
                <b>{fmtMin(s.minutes)}</b>
              </span>
              <span className="bar"><span style={{ width: `${(s.minutes / max) * 100}%`, background: m.color }} /></span>
              <small>
                {s.sessions} session{s.sessions === 1 ? '' : 's'}
                {total > 0 ? ` · ${Math.round((s.minutes / total) * 100)}% of all study` : ''}
                {isOpen ? ' ▲' : ' ▼'}
              </small>
            </button>
            {isOpen && (
              <div className="mstat-body">
                <div className="mstat-grid">
                  <div><b>{fmtMin(s.thisWeek)}</b><small>this week</small></div>
                  <div><b>{s.days}</b><small>days studied</small></div>
                  <div><b>{fmtMin(s.avg)}</b><small>avg session</small></div>
                  <div><b>{fmtMin(s.longest)}</b><small>longest</small></div>
                </div>
                <small>Last studied: {s.last ? `${fmtDay(s.last)} (${ago(s.last)})` : 'not yet'}</small>
                {Math.round(s.eff) !== Math.round(s.minutes) && (
                  <small>{fmtMin(s.eff)} of that counts towards goals and exams (logged-by-hand time counts half).</small>
                )}
                <div>
                  <small>Last 8 weeks</small>
                  <div className="weeks">
                    {s.perWeek.map((w) => (
                      <div key={w.key} title={`Week of ${w.key}: ${fmtMin(w.minutes)}`}>
                        <i style={{ height: `${w.minutes ? Math.max(6, (w.minutes / weekMax) * 100) : 0}%`, background: m.color }} />
                      </div>
                    ))}
                  </div>
                </div>
                {exams.length > 0 && (
                  <div>
                    <small>Exams &amp; tests</small>
                    {exams.map((e) => {
                      const status = claimed(doc, e.id)
                        ? 'prep reward claimed'
                        : e.done ? 'goal reached' : e.daysLeft < 0 ? 'missed goal' : `${fmtMin(e.studied)} / ${fmtMin(e.goal)}`
                      return (
                        <div key={e.id} className="mstat-exam">
                          <span>{e.kind.emoji} {e.name}</span>
                          <small>
                            {e.exam.date} · {e.daysLeft > 0 ? `${e.daysLeft}d left` : e.daysLeft === 0 ? 'today' : 'passed'} · {status}
                          </small>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
