import { useGame } from '../game/store'
import { ITEMS } from '../game/data'
import { titleFor } from '../game/data'
import { fmtMin } from '../game/calc'
import { Sprite } from './Sprite'

export function RewardModal() {
  const r = useGame((s) => s.reward)
  const dismiss = useGame((s) => s.dismissReward)
  if (!r) return null
  const lvl = r.levelAfter > r.levelBefore
  return (
    <div className="overlay" onClick={dismiss}>
      <div className="panel modal pop" onClick={(e) => e.stopPropagation()}>
        <h2>{r.kind === 'break' ? '☕ Break complete!' : r.focusDone ? '🎯 Focus complete!' : '✨ Session complete!'}</h2>
        <p className="muted">{fmtMin(r.minutes)} of {r.kind === 'break' ? 'rest' : 'study'}</p>
        <div className="loot">
          <div className="loot-item" style={{ animationDelay: '.1s' }}>+{r.gold} 🪙</div>
          <div className="loot-item" style={{ animationDelay: '.3s' }}>+{r.xp} XP</div>
        </div>
        {r.kind === 'break' && <p className="muted">Breaks pay half. Now back to it when you're ready!</p>}
        {r.streak > 1 && <p>🔥 {r.streak}-day streak boosting your rewards</p>}
        {r.drop && (
          <div className="drop" style={{ animationDelay: '.6s' }}>
            <p className="big">🎁 Lucky find!</p>
            {r.drop.type === 'gold' && <p>+{r.drop.amount} bonus 🪙</p>}
            {r.drop.type === 'gem' && <p>+1 💎 gem!</p>}
            {r.drop.type === 'seed' && r.drop.itemId && (
              <div className="center">
                <Sprite itemId={r.drop.itemId} size={64} />
                <p>{ITEMS[r.drop.itemId].name} seed, added to your bag</p>
              </div>
            )}
          </div>
        )}
        {lvl && (
          <div className="levelup">
            ⬆ LEVEL {r.levelAfter}! You are now a {titleFor(r.levelAfter)}.
            <small>New shop items and garden land may have unlocked.</small>
          </div>
        )}
        <button className="btn gold" onClick={dismiss}>Collect</button>
      </div>
    </div>
  )
}

export function ChestModal() {
  const c = useGame((s) => s.chest)
  const dismiss = useGame((s) => s.dismissChest)
  if (!c) return null
  return (
    <div className="overlay" onClick={dismiss}>
      <div className="panel modal pop" onClick={(e) => e.stopPropagation()}>
        <div className="chest">🎁</div>
        <h2>Daily chest!</h2>
        <div className="loot">
          <div className="loot-item">+{c.gold} 🪙</div>
          {c.gem > 0 && <div className="loot-item" style={{ animationDelay: '.3s' }}>+{c.gem} 💎</div>}
        </div>
        {c.itemId && (
          <div className="drop" style={{ animationDelay: '.5s' }}>
            <Sprite itemId={c.itemId} size={64} />
            <p>Bonus: {ITEMS[c.itemId].name}!</p>
          </div>
        )}
        <button className="btn gold" onClick={dismiss}>Nice!</button>
      </div>
    </div>
  )
}
