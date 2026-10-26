import { balance, bestStreak, claimed, levelInfo, live, studySessions } from './calc'
import { ITEMS, ZONES } from './data'
import type { Doc, PlantDef } from './types'

export interface Achievement {
  id: string
  name: string
  desc: string
  title: string
  icon: string
  gold: number
  gem?: number
  /** [current, target] for a progress bar */
  progress: (doc: Doc) => [number, number]
}

const totalMin = (d: Doc) => studySessions(d).reduce((t, s) => t + s.eff, 0)
const harvests = (d: Doc) => live(d.units).filter((u) => u.harvested).length
const everOwned = (d: Doc) => new Set(live(d.units).map((u) => u.itemId))
const hourOf = (ts: number) => new Date(ts).getHours()
const has = (b: boolean): [number, number] => [b ? 1 : 0, 1]

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first', icon: '🌱', name: 'First Steps', desc: 'Finish your first study session', title: 'Newcomer', gold: 25, progress: (d) => [Math.min(1, studySessions(d).length), 1] },
  { id: 'h10', icon: '📚', name: 'Warming Up', desc: 'Study for 10 hours in total', title: 'Student', gold: 100, progress: (d) => [Math.floor(totalMin(d) / 60), 10] },
  { id: 'h50', icon: '🎓', name: 'Dedicated', desc: 'Study for 50 hours in total', title: 'Scholar', gold: 300, gem: 1, progress: (d) => [Math.floor(totalMin(d) / 60), 50] },
  { id: 'h100', icon: '🏛️', name: 'Centurion', desc: 'Study for 100 hours in total', title: 'Centurion', gold: 600, gem: 2, progress: (d) => [Math.floor(totalMin(d) / 60), 100] },
  { id: 'h250', icon: '🧙', name: 'Grandmaster', desc: 'Study for 250 hours in total', title: 'Grandmaster', gold: 1500, gem: 5, progress: (d) => [Math.floor(totalMin(d) / 60), 250] },
  { id: 'streak7', icon: '🔥', name: 'Week Warrior', desc: 'Reach a 7-day streak', title: 'Streaker', gold: 150, gem: 1, progress: (d) => [bestStreak(d), 7] },
  { id: 'streak30', icon: '☄️', name: 'Unstoppable', desc: 'Reach a 30-day streak', title: 'Unstoppable', gold: 800, gem: 3, progress: (d) => [bestStreak(d), 30] },
  { id: 'marathon', icon: '🏃', name: 'Marathon', desc: 'Study 2 hours in one session', title: 'Marathoner', gold: 100, progress: (d) => has(studySessions(d).some((s) => s.minutes >= 120)) },
  { id: 'owl', icon: '🦉', name: 'Night Owl', desc: 'Start a session between 10pm and 4am', title: 'Night Owl', gold: 80, progress: (d) => has(studySessions(d).some((s) => s.source === 'timer' && (hourOf(s.start) >= 22 || hourOf(s.start) < 4))) },
  { id: 'bird', icon: '🐦', name: 'Early Bird', desc: 'Start a session between 5am and 8am', title: 'Early Bird', gold: 80, progress: (d) => has(studySessions(d).some((s) => s.source === 'timer' && hourOf(s.start) >= 5 && hourOf(s.start) < 8)) },
  { id: 'focus10', icon: '🎯', name: 'Laser Focus', desc: 'Complete 10 focus sessions', title: 'Laser Mind', gold: 200, progress: (d) => [studySessions(d).filter((s) => s.focus).length, 10] },
  { id: 'polymath', icon: '🧠', name: 'Polymath', desc: 'Study 4 different modules', title: 'Polymath', gold: 150, progress: (d) => [new Set(studySessions(d).map((s) => s.moduleId)).size, 4] },
  { id: 'harvest1', icon: '🧺', name: 'Green Thumb', desc: 'Harvest your first plant', title: 'Green Thumb', gold: 50, progress: (d) => [Math.min(1, harvests(d)), 1] },
  { id: 'harvest10', icon: '🚜', name: 'Farmer', desc: 'Harvest 10 plants', title: 'Farmer', gold: 300, gem: 1, progress: (d) => [harvests(d), 10] },
  { id: 'rare', icon: '🌸', name: 'Rare Find', desc: 'Own a rare plant', title: 'Collector', gold: 200, progress: (d) => has([...everOwned(d)].some((id) => ITEMS[id]?.kind === 'plant' && (ITEMS[id] as PlantDef).rarity === 'rare')) },
  { id: 'legend', icon: '💠', name: 'Legendary', desc: 'Own the Crystal Rose', title: 'Legend of the Valley', gold: 500, gem: 3, progress: (d) => has(everOwned(d).has('crystalrose')) },
  { id: 'curator', icon: '🖼️', name: 'Curator', desc: 'Collect 15 different items', title: 'Curator', gold: 300, progress: (d) => [everOwned(d).size, 15] },
  { id: 'lvl10', icon: '⭐', name: 'Veteran', desc: 'Reach level 10', title: 'Veteran', gold: 400, gem: 2, progress: (d) => [levelInfo(balance(d, 'xp')).level, 10] },
  { id: 'boss', icon: '⚔️', name: 'Boss Slayer', desc: 'Defeat a weekly boss', title: 'Boss Slayer', gold: 200, gem: 1, progress: (d) => has(live(d.ledger).some((e) => e.id.startsWith('boss:'))) },
  { id: 'explorer', icon: '🗺️', name: 'Explorer', desc: 'Unlock 2 new garden zones', title: 'Explorer', gold: 300, progress: (d) => [ZONES.filter((z) => z.id !== 'meadow' && claimed(d, `zone:${z.id}`)).length, 2] },
]

export const isUnlocked = (doc: Doc, id: string) => claimed(doc, `ach:${id}`)

/** Grants any newly earned achievements into the ledger. Returns their names. */
export function awardAchievements(d: Doc): string[] {
  const out: string[] = []
  const now = Date.now()
  for (const a of ACHIEVEMENTS) {
    const id = `ach:${a.id}`
    if (d.ledger[id]) continue
    const [cur, target] = a.progress(d)
    if (cur < target) continue
    d.ledger[id] = { id, cur: 'gold', delta: a.gold, reason: `Achievement: ${a.name}`, at: now, updatedAt: now }
    if (a.gem) d.ledger[`${id}:g`] = { id: `${id}:g`, cur: 'gem', delta: a.gem, reason: `Achievement: ${a.name}`, at: now, updatedAt: now }
    out.push(`${a.icon} ${a.name}`)
  }
  return out
}
