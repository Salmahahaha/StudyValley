import { useEffect, useState } from 'react'
import { EXAM_KINDS, MANUAL_DAILY_CAP, dateKey, fmtMin, live, moduleExams, placed, plantProgress, uid, weekKey, weekMinutes } from '../game/calc'
import { ITEMS, MODULE_COLORS, MODULE_EMOJI } from '../game/data'
import { useGame } from '../game/store'
import type { Exam, ExamKind, Module } from '../game/types'
import { Sprite } from './Sprite'

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (s: number) => `${s >= 3600 ? `${Math.floor(s / 3600)}:` : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    const vis = () => setNow(Date.now())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [active])
  return now
}

export function Study() {
  const doc = useGame((s) => s.doc)
  const timer = useGame((s) => s.timer)
  const st = useGame.getState()
  const modules = live(doc.modules)
  const [moduleId, setModuleId] = useState<string>('')
  const [editing, setEditing] = useState<Module | 'new' | null>(modules.length === 0 ? 'new' : null)
  const [mode, setMode] = useState<number | null>(null)
  const now = useNow(!!timer)

  const activeId = modules.find((m) => m.id === moduleId)?.id ?? modules[0]?.id ?? ''
  const tm = timer ? doc.modules[timer.moduleId] : null
  const elapsed = timer ? Math.max(0, Math.floor((now - timer.start) / 1000)) : 0
  const done = !!timer && timer.focusMin !== null && elapsed >= timer.focusMin * 60

  useEffect(() => {
    if (done) useGame.getState().stopTimer()
  }, [done])

  const wk = weekKey(Date.now())
  const teaser = placed(doc)
    .filter((u) => ITEMS[u.itemId].kind === 'plant')
    .map((u) => ({ u, p: plantProgress(doc, u) }))
    .filter((x) => !x.p.ready)
    .sort((a, b) => b.p.ratio - a.p.ratio)[0]

  if (editing)
    return (
      <ModuleForm
        initial={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSave={(m, id) => {
          if (id) st.updateModule(id, m)
          else setModuleId(st.addModule(m))
          setEditing(null)
        }}
        onDelete={(id) => {
          if (confirm('Delete this module? Past sessions stay in your totals.')) {
            st.deleteModule(id)
            setEditing(null)
          }
        }}
      />
    )

  return (
    <div className="stack">
      {timer && tm ? (
        <div className="panel center timer-card" style={{ borderColor: tm.color }}>
          <p className="muted">{tm.emoji} {tm.name} · {timer.focusMin ? `Focus ${timer.focusMin}m` : 'Free study'}</p>
          <div className="clock">
            {timer.focusMin ? clock(Math.max(0, timer.focusMin * 60 - elapsed)) : clock(elapsed)}
          </div>
          {timer.focusMin && (
            <div className="bar"><span style={{ width: `${Math.min(100, (elapsed / (timer.focusMin * 60)) * 100)}%` }} /></div>
          )}
          {teaser && (
            <div className="teaser">
              <Sprite itemId={teaser.u.itemId} stage={teaser.p.stage} pot={teaser.u.pot} size={40} />
              <span>
                Your {ITEMS[teaser.u.itemId].name} needs {fmtMin(teaser.p.left)} more to bloom
              </span>
            </div>
          )}
          <div className="row">
            <button className="btn gold" onClick={st.stopTimer}>Finish &amp; collect</button>
            <button className="btn ghost" onClick={() => confirm('Discard this session without rewards?') && st.cancelTimer()}>
              Discard
            </button>
          </div>
        </div>
      ) : (
        <div className="panel">
          <h3>Start studying</h3>
          <div className="chips">
            {modules.map((m) => (
              <button
                key={m.id}
                className={`chip ${m.id === activeId ? 'on' : ''}`}
                style={{ '--c': m.color } as React.CSSProperties}
                onClick={() => setModuleId(m.id)}
              >
                {m.emoji} {m.name}
              </button>
            ))}
            <button className="chip" onClick={() => setEditing('new')}>＋ Module</button>
          </div>
          <div className="chips">
            {([null, 25, 50, 90] as const).map((m) => (
              <button key={String(m)} className={`chip ${mode === m ? 'on' : ''}`} onClick={() => setMode(m)}>
                {m === null ? '⏱ Free' : `🎯 Focus ${m}m`}
              </button>
            ))}
          </div>
          <p className="muted">{mode ? 'Finish the full block for +20% rewards.' : 'Stop whenever you like.'}</p>
          <button className="btn gold big" disabled={!activeId} onClick={() => st.startTimer(activeId, mode)}>
            ▶ Start
          </button>
        </div>
      )}

      {!timer && <ManualLog moduleId={activeId} />}

      {modules.length > 0 && (
        <div className="panel">
          <h3>Weekly goals</h3>
          {modules.map((m) => {
            const mins = weekMinutes(doc, wk, m.id)
            const goal = m.weeklyGoalH * 60
            return (
              <div key={m.id} className="mod-row">
                <button className="link mod-name" onClick={() => setEditing(m)}>{m.emoji} {m.name} ✎</button>
                <div className="bar"><span style={{ width: `${goal ? Math.min(100, (mins / goal) * 100) : 0}%`, background: m.color }} /></div>
                <small>{fmtMin(mins)} / {m.weeklyGoalH}h</small>
              </div>
            )
          })}
        </div>
      )}

      <Recent />
    </div>
  )
}

function ManualLog({ moduleId }: { moduleId: string }) {
  const [open, setOpen] = useState(false)
  const [mins, setMins] = useState(60)
  const [day, setDay] = useState(dateKey(Date.now()))
  const [note, setNote] = useState('')
  if (!moduleId) return null
  return (
    <div className="panel">
      <div className="row spread">
        <h3>Log past study</h3>
        <button className="link" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <>
          <p className="muted">Manual logs earn 50% rewards, up to {MANUAL_DAILY_CAP / 60}h a day. Timer sessions earn full rewards.</p>
          <div className="row">
            <label className="grow">Minutes
              <input type="number" min={1} max={600} value={mins} onChange={(e) => setMins(Number(e.target.value))} />
            </label>
            <label className="grow">Date
              <input type="date" max={dateKey(Date.now())} value={day} onChange={(e) => setDay(e.target.value)} />
            </label>
          </div>
          <label>Note (optional)
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chapter 4 practice problems" />
          </label>
          <button
            className="btn"
            disabled={!(mins >= 1) || !day}
            onClick={() => {
              useGame.getState().logManual(moduleId, Math.round(mins), day, note || undefined)
              setNote('')
            }}
          >
            Log session
          </button>
        </>
      )}
    </div>
  )
}

function Recent() {
  const doc = useGame((s) => s.doc)
  const list = live(doc.sessions).sort((a, b) => b.start - a.start).slice(0, 8)
  if (!list.length) return null
  return (
    <div className="panel">
      <h3>Recent sessions</h3>
      {list.map((s) => {
        const m = doc.modules[s.moduleId]
        return (
          <div key={s.id} className="sess">
            <span className="dot" style={{ background: m?.color ?? '#888' }} />
            <div className="grow">
              <b>{m ? `${m.emoji} ${m.name}` : 'Deleted module'}</b>
              <small>
                {new Date(s.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
                {fmtMin(s.minutes)}{s.source === 'manual' ? ' · logged' : s.focus ? ' · focus ✓' : ''}
                {s.note ? ` · ${s.note}` : ''}
              </small>
            </div>
            <button className="link" onClick={() => confirm('Delete this session and its rewards?') && useGame.getState().deleteSession(s.id)}>✕</button>
          </div>
        )
      })}
    </div>
  )
}

function ModuleForm(props: {
  initial: Module | null
  onCancel: () => void
  onSave: (m: Omit<Module, 'id' | 'updatedAt' | 'deleted'>, id?: string) => void
  onDelete: (id: string) => void
}) {
  const { initial } = props
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? MODULE_EMOJI[0])
  const [color, setColor] = useState(initial?.color ?? MODULE_COLORS[0])
  const [goal, setGoal] = useState(initial?.weeklyGoalH ?? 5)
  const [exams, setExams] = useState<Exam[]>(() => (initial ? moduleExams(initial) : []))
  const savedIds = new Set(initial ? moduleExams(initial).map((x) => x.id) : [])
  const today = dateKey(Date.now())
  const patchExam = (id: string, patch: Partial<Exam>) => setExams(exams.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const save = () => {
    // an entry with no date can't count down, so it is dropped
    const cleaned = exams
      .filter((x) => x.date)
      .map((x) => ({ ...x, name: x.name.trim() || EXAM_KINDS[x.kind].label, goalH: Math.max(1, x.goalH || 1) }))
      .sort((a, z) => a.date.localeCompare(z.date))
    props.onSave(
      {
        name: name.trim(), emoji, color, weeklyGoalH: Math.max(0, goal),
        exams: cleaned,
        examName: undefined, examDate: undefined, examGoalH: undefined, examFrom: undefined,
      },
      initial?.id,
    )
  }
  return (
    <div className="panel stack">
      <h3>{initial ? 'Edit module' : 'New module'}</h3>
      <label>Name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Linear Algebra" maxLength={40} />
      </label>
      <div>
        <small>Icon</small>
        <div className="chips">
          {MODULE_EMOJI.map((e) => (
            <button key={e} className={`chip ${e === emoji ? 'on' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div>
        <small>Colour</small>
        <div className="chips">
          {MODULE_COLORS.map((c) => (
            <button key={c} className={`swatch ${c === color ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
          ))}
        </div>
      </div>
      <label>Weekly goal (hours)
        <input type="number" min={0} max={80} value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
      </label>
      <p className="muted">Hit your weekly goal for a bonus of {Math.max(0, goal) * 30} 🪙 and a 💎.</p>
      <fieldset className="exam-fields">
        <legend>📝 Exams &amp; tests (optional)</legend>
        {exams.length === 0 && <p className="muted">Add as many as you like. Each one gets its own countdown and prep reward.</p>}
        {exams.map((x) => (
          <div key={x.id} className="exam-card">
            <div className="chips">
              {(Object.keys(EXAM_KINDS) as ExamKind[]).map((k) => (
                <button key={k} className={`chip ${x.kind === k ? 'on' : ''}`} onClick={() => patchExam(x.id, { kind: k })}>
                  {EXAM_KINDS[k].emoji} {EXAM_KINDS[k].label}
                </button>
              ))}
            </div>
            <label>Name
              <input value={x.name} onChange={(e) => patchExam(x.id, { name: e.target.value })} placeholder={`e.g. ${x.kind === 'exam' ? 'Final exam' : x.kind === 'test' ? 'Test 1' : 'Quiz 2'}`} maxLength={40} />
            </label>
            <div className="row">
              <label className="grow">Date
                <input type="date" min={savedIds.has(x.id) ? undefined : today} value={x.date} onChange={(e) => patchExam(x.id, { date: e.target.value })} />
              </label>
              <label className="grow">Prep goal (hours)
                <input type="number" min={1} max={500} value={x.goalH} onChange={(e) => patchExam(x.id, { goalH: Number(e.target.value) })} />
              </label>
            </div>
            <p className="muted">
              {x.date
                ? `Study ${Math.max(1, x.goalH || 1)}h on this module before then to win ${Math.round(Math.max(1, x.goalH || 1) * 20)} 🪙 and a 💎. `
                : 'Pick a date, or it won’t be saved. '}
              <button className="link" onClick={() => setExams(exams.filter((e) => e.id !== x.id))}>Remove</button>
            </p>
          </div>
        ))}
        <button className="btn small ghost" onClick={() => setExams([...exams, { id: uid(), kind: 'exam', name: '', date: '', goalH: 20, from: today }])}>
          ＋ Add exam or test
        </button>
        {exams.length > 1 && <small>Study time counts towards every exam it falls before, so one session can help several.</small>}
      </fieldset>
      <div className="row">
        <button className="btn" disabled={!name.trim()} onClick={save}>
          Save
        </button>
        <button className="btn ghost" onClick={props.onCancel}>Cancel</button>
        {initial && <button className="btn red" onClick={() => props.onDelete(initial.id)}>Delete</button>}
      </div>
    </div>
  )
}

