import { boss, claimed, dailyQuests, dateKey, examInfo, fmtMin, live, moduleExams, streak, weekKey, weekMinutes } from '../game/calc'
import { useEffect, useRef } from 'react'
import { useGame } from '../game/store'
import { bossSpr, drawSpr } from '../game/sprites'
import type { BossKind } from '../game/sprites'
import { useAtlas } from './useAtlas'

/** the weekly boss, idling menacingly (or knocked out once beaten) */
function BossView({ kind, defeated }: { kind: BossKind; defeated: boolean }) {
  const ok = useAtlas()
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!ok || !cv) return
    const c = cv.getContext('2d')!
    c.imageSmoothingEnabled = false
    let raf = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      c.clearRect(0, 0, 32, 32)
      drawSpr(c, bossSpr(kind, ms / 1000, defeated), 16, 29)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ok, kind, defeated])
  return <canvas ref={ref} width={32} height={32} className="sprite boss-canvas" />
}

export function Quests() {
  const doc = useGame((s) => s.doc)
  const st = useGame.getState()
  const day = dateKey(Date.now())
  const wk = weekKey(Date.now())
  const qs = dailyQuests(day)
  const allClaimed = qs.every((q) => claimed(doc, `quest:${day}:${q.id}`))
  const chestOpen = claimed(doc, `chest:${day}`)
  const n = streak(doc)
  const modules = live(doc.modules)
  const b = boss(doc, wk)
  const bossClaimed = claimed(doc, b.id)
  // upcoming ones, plus finished-but-unclaimed ones; missed ones drop off
  const exams = modules
    .flatMap((m) => moduleExams(m).map((ex) => ({ m, e: examInfo(doc, m, ex) })))
    .filter(({ e }) => e.daysLeft >= 0 || (e.done && !claimed(doc, e.id)))
    .sort((a, z) => a.e.daysLeft - z.e.daysLeft)

  return (
    <div className="stack">
      <div className="panel center">
        <div className="flame">🔥</div>
        <p className="big">{n} day streak</p>
        <p className="muted">
          {n === 0 ? 'Study 10+ minutes today to start one.' : `+${Math.min(50, n * 10)}% gold and XP on every session. Bonus gems at 7, 14 and 30 days.`}
        </p>
      </div>

      <div className={`panel boss ${b.defeated ? 'beaten' : ''}`}>
        <div className="row spread">
          <h3>⚔️ Weekly boss</h3>
          <small>resets Monday</small>
        </div>
        <div className="boss-body">
          <div className="boss-stage"><BossView kind={b.sprite} defeated={b.defeated} /></div>
          <div className="grow">
            <b>{b.name}</b>
            <div className="bar hp"><span style={{ width: `${100 - (b.dmg / b.hp) * 100}%` }} /></div>
            <small>{b.defeated ? 'Defeated!' : `HP ${fmtMin(b.hp - b.dmg)} left · every minute you study this week is a hit`}</small>
          </div>
        </div>
        <button className={`btn ${b.defeated && !bossClaimed ? 'gold pulse' : ''}`} disabled={!b.defeated || bossClaimed} onClick={st.claimBoss}>
          {bossClaimed ? '✓ Loot claimed' : `Loot: +${b.reward} 🪙 +2 💎`}
        </button>
      </div>

      <div className="panel">
        <h3>Daily quests</h3>
        {qs.map((q) => {
          const prog = Math.min(q.target, q.progress(doc, day))
          const done = prog >= q.target
          const got = claimed(doc, `quest:${day}:${q.id}`)
          return (
            <div key={q.id} className="quest">
              <div className="grow">
                <b>{q.label}</b>
                <div className="bar"><span style={{ width: `${(prog / q.target) * 100}%` }} /></div>
                <small>{prog} / {q.target}</small>
              </div>
              <button className={`btn small ${done && !got ? 'gold' : ''}`} disabled={!done || got} onClick={() => st.claimQuest(day, q.id)}>
                {got ? '✓' : `+${q.reward} 🪙`}
              </button>
            </div>
          )
        })}
        <button className={`btn big ${allClaimed && !chestOpen ? 'gold pulse' : ''}`} disabled={!allClaimed || chestOpen} onClick={() => st.openChest(day)}>
          {chestOpen ? '🎁 Chest opened today' : allClaimed ? '🎁 Open daily chest!' : '🎁 Claim all 3 quests to unlock the chest'}
        </button>
      </div>

      <div className="panel">
        <h3>📝 Exam &amp; test raids</h3>
        {exams.length === 0 && <p className="muted">Add exams or tests to a module (Study tab → tap a module's name) to start countdowns.</p>}
        {exams.map(({ m, e }) => {
          const got = claimed(doc, e.id)
          return (
            <div key={e.id} className="quest">
              <div className="grow">
                <b>{e.kind.emoji} {e.name} · {m.emoji} {m.name}</b>
                <div className="bar"><span style={{ width: `${e.goal ? Math.min(100, (e.studied / e.goal) * 100) : 0}%`, background: m.color }} /></div>
                <small>
                  {e.daysLeft > 0 ? `${e.daysLeft} day${e.daysLeft === 1 ? '' : 's'} left` : e.daysLeft === 0 ? 'Today! Good luck 🍀' : 'Exam passed'}
                  {' · '}{fmtMin(e.studied)} / {fmtMin(e.goal)}
                  {!e.done && e.daysLeft > 0 ? ` · ~${fmtMin(e.perDay)}/day to hit your goal` : ''}
                </small>
              </div>
              <button className={`btn small ${e.done && !got ? 'gold' : ''}`} disabled={!e.done || got} onClick={() => st.claimExam(m.id, e.exam.id)}>
                {got ? '✓' : `+${e.reward} 🪙 +1 💎`}
              </button>
            </div>
          )
        })}
      </div>

      <div className="panel">
        <h3>Weekly goals</h3>
        {modules.length === 0 && <p className="muted">Add a module on the Study tab to set a goal.</p>}
        {modules.map((m) => {
          const mins = weekMinutes(doc, wk, m.id)
          const goal = m.weeklyGoalH * 60
          const got = claimed(doc, `weekly:${wk}:${m.id}`)
          const done = goal > 0 && mins >= goal
          return (
            <div key={m.id} className="quest">
              <div className="grow">
                <b>{m.emoji} {m.name}</b>
                <div className="bar"><span style={{ width: `${goal ? Math.min(100, (mins / goal) * 100) : 0}%`, background: m.color }} /></div>
                <small>{fmtMin(mins)} / {m.weeklyGoalH}h</small>
              </div>
              <button className={`btn small ${done && !got ? 'gold' : ''}`} disabled={!done || got} onClick={() => st.claimWeekly(m.id)}>
                {got ? '✓' : `+${m.weeklyGoalH * 30} 🪙 +1 💎`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
