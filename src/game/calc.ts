import { GRID_H, GRID_W, ITEMS, isFloorDecor, isSmallDecor, zoneDef } from './data'
import type { Doc, Drop, Exam, ExamKind, Module, PlantDef, PotDef, Session, Stamped, Unit } from './types'

export const MIN = 60_000
export const MANUAL_DAILY_CAP = 240
export const MANUAL_RATE = 0.5
export const STREAK_MIN = 10
/** a break is a timed rest: it must run at least this long, and can be set up to the maximum */
export const BREAK_MIN = 20
export const BREAK_MAX = 45
/** breaks pay (and grow plants) at this share of study */
export const BREAK_RATE = 0.5
/** minutes of break per day that earn anything, so a timer left running can't be farmed */
export const BREAK_DAILY_CAP = 120

export const live = <T extends Stamped>(r: Record<string, T>): T[] =>
  Object.values(r).filter((x) => !x.deleted)

export const isBreak = (s: Session) => s.kind === 'break'
/** sessions that count as study: everything except breaks (those only feed plant growth) */
export const studySessions = (doc: Doc) => live(doc.sessions).filter((s) => !isBreak(s))

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

const pad = (n: number) => String(n).padStart(2, '0')
export const dateKey = (ts: number) => {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const weekKey = (ts: number) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return dateKey(d.getTime())
}

export const emptyDoc = (): Doc => ({
  v: 1,
  modules: {},
  sessions: {},
  ledger: {},
  units: {},
  settings: { sound: true, haptics: true },
  settingsAt: 0,
})

export const balance = (doc: Doc, cur: 'gold' | 'gem' | 'xp') =>
  live(doc.ledger).reduce((s, e) => (e.cur === cur ? s + e.delta : s), 0)

export const xpForLevel = (l: number) => 100 + 70 * (l - 1)
export function levelInfo(xp: number) {
  let level = 1
  let rem = xp
  while (rem >= xpForLevel(level)) {
    rem -= xpForLevel(level)
    level++
  }
  return { level, into: rem, need: xpForLevel(level) }
}

export const gardenSize = (level: number, zone = 'meadow') => {
  if (zone !== 'meadow') {
    const z = zoneDef(zone)
    return { cols: z.cols, rows: z.rows }
  }
  return {
    cols: Math.min(GRID_W, 4 + Math.floor(level / 3)),
    rows: Math.min(GRID_H, 3 + Math.floor(level / 4)),
  }
}

export const sessionEnd = (s: Session) => s.start + s.minutes * MIN

export function minutesOnDay(doc: Doc, key: string, filter?: (s: Session) => boolean) {
  return studySessions(doc)
    .filter((s) => dateKey(s.start) === key && (!filter || filter(s)))
    .reduce((t, s) => t + s.eff, 0)
}

export function streak(doc: Doc, now = Date.now()) {
  const days = new Set<string>()
  const per: Record<string, number> = {}
  for (const s of studySessions(doc)) {
    const k = dateKey(s.start)
    per[k] = (per[k] ?? 0) + s.eff
  }
  for (const [k, v] of Object.entries(per)) if (v >= STREAK_MIN) days.add(k)
  let n = 0
  let t = now
  if (!days.has(dateKey(t))) t -= 86_400_000
  while (days.has(dateKey(t))) {
    n++
    t -= 86_400_000
  }
  return n
}

export function plantProgress(doc: Doc, u: Unit) {
  const def = ITEMS[u.itemId] as PlantDef
  const speed = (u.pot ? (ITEMS[u.pot] as PotDef).speed : 1) * zoneDef(u.zone).speed
  // after a move to another garden the progress so far is banked, so the new garden's speed only applies from then on
  const since = u.growFrom ?? u.plantedAt ?? Date.now()
  // breaks grow plants too (their eff is already halved)
  const raw = live(doc.sessions)
    .filter((s) => sessionEnd(s) >= since)
    .reduce((t, s) => t + s.eff, 0)
  const minutes = (u.banked ?? 0) + raw * speed
  // a grown fruit tree only needs to grow its next crop of fruit
  const regrowing = !!(def.regrow && u.cycles)
  const need = regrowing ? def.regrow! : def.minutes
  const ratio = Math.min(1, minutes / need)
  const stage = regrowing
    ? ratio >= 1 ? 4 : 3
    : ratio >= 1 ? 4 : ratio >= 0.7 ? 3 : ratio >= 0.45 ? 2 : ratio >= 0.2 ? 1 : 0
  return { minutes, need, ratio, stage, ready: ratio >= 1, left: Math.max(0, (need - minutes) / speed) }
}

export const ownedUnits = (doc: Doc) => live(doc.units).filter((u) => !u.gone)
export const isAnimal = (itemId: string) => {
  const d = ITEMS[itemId]
  return d?.kind === 'decor' && d.cat === 'pet'
}
/** animals live in a garden (u.zone) and roam it; they never sit on a tile */
export const animalsIn = (doc: Doc, zone: string) =>
  ownedUnits(doc).filter((u) => isAnimal(u.itemId) && u.zone === zone)
/** everything not out in a garden (an animal counts as out once it has a garden) */
export const inventory = (doc: Doc) =>
  ownedUnits(doc).filter((u) => u.x === undefined && !(isAnimal(u.itemId) && u.zone))
export const placed = (doc: Doc, zone?: string) =>
  ownedUnits(doc).filter((u) => u.x !== undefined && (!zone || (u.zone ?? 'meadow') === zone))
/** goes on a tile (animals don't, they are sent to a garden instead) */
export const isPlaceable = (itemId: string) => {
  const k = ITEMS[itemId].kind
  return k === 'plant' || (k === 'decor' && !isAnimal(itemId))
}

/* ---------- tile slots: a tile holds a plant, a floor piece and decor side by side ---------- */

export type Slot = 'plant' | 'floor' | 'centre' | 'c0' | 'c1' | 'c2' | 'c3'
export const CORNERS: Slot[] = ['c0', 'c1', 'c2', 'c3']
export const isCorner = (s: Slot) => s.length === 2 && s[0] === 'c'

export function slotOf(u: Unit): Slot {
  if (ITEMS[u.itemId].kind === 'plant') return 'plant'
  if (isFloorDecor(u.itemId)) return 'floor'
  return u.q === undefined ? 'centre' : (`c${u.q}` as Slot)
}
/** which slots of a tile an item can go in */
export function slotsFor(itemId: string): Slot[] {
  if (ITEMS[itemId].kind === 'plant') return ['plant']
  if (isFloorDecor(itemId)) return ['floor']
  return isSmallDecor(itemId) ? [...CORNERS, 'centre'] : ['centre']
}
export const unitInSlot = (doc: Doc, zone: string, x: number, y: number, slot: Slot, ignore: string[] = []) =>
  placed(doc, zone).find((u) => u.x === x && u.y === y && slotOf(u) === slot && !ignore.includes(u.id))

/** null when the item can go there, otherwise why not. `ignore` is for units about to move out of the way. */
export function slotError(doc: Doc, zone: string, x: number, y: number, slot: Slot, itemId: string, ignore: string[] = []): string | null {
  if (!ownsZone(doc, zone)) return 'That garden is still locked.'
  const { cols, rows } = gardenSize(levelInfo(balance(doc, 'xp')).level, zone)
  if (x < 0 || y < 0 || x >= cols || y >= rows) return 'That land is still locked.'
  if (!slotsFor(itemId).includes(slot)) return `${ITEMS[itemId].name} doesn't fit in that spot.`
  const here = placed(doc, zone).filter((u) => u.x === x && u.y === y && !ignore.includes(u.id))
  const inSlot = (s: Slot) => here.some((u) => slotOf(u) === s)
  if (slot === 'plant' || slot === 'floor') return inSlot(slot) ? 'Something is already there.' : null
  if (slot === 'centre') return CORNERS.some(inSlot) || inSlot('centre') ? 'The corners or centre are already used.' : null
  return inSlot(slot) || inSlot('centre') ? 'Something is already there.' : null
}
export const ownsZone = (doc: Doc, id: string) => id === 'meadow' || claimed(doc, `zone:${id}`)

export function rewardFor(
  minutes: number,
  source: 'timer' | 'manual' | 'break',
  focus: boolean,
  streakDays: number,
  /** minutes of this kind already counted today, for the daily caps */
  usedToday: number,
) {
  let eff = minutes
  if (source === 'manual') {
    eff = Math.min(minutes, Math.max(0, MANUAL_DAILY_CAP - usedToday)) * MANUAL_RATE
  } else if (source === 'break') {
    eff = Math.min(minutes, Math.max(0, BREAK_DAILY_CAP - usedToday)) * BREAK_RATE
  }
  const mult = (1 + Math.min(0.5, 0.1 * streakDays)) * (focus ? 1.2 : 1)
  return { eff, gold: Math.round(eff * mult), xp: Math.round(eff * 2 * mult) }
}

export function rollDrop(eff: number, gold: number, level: number): Drop | undefined {
  if (eff < 10) return undefined
  const r = Math.random()
  if (r < 0.03) return { type: 'gem', amount: 1 }
  if (r < 0.15) {
    const pool = Object.values(ITEMS).filter(
      (i): i is PlantDef => i.kind === 'plant' && !i.gemCost && i.minLevel <= level && i.rarity !== 'rare',
    )
    if (pool.length) return { type: 'seed', itemId: pool[Math.floor(Math.random() * pool.length)].id }
  }
  if (r < 0.4) return { type: 'gold', amount: Math.max(5, Math.round(gold * 0.5)) }
  return undefined
}

/* ---------- quests ---------- */

export interface QuestDef {
  id: string
  label: string
  target: number
  reward: number
  progress: (doc: Doc, day: string) => number
}

const todays = (doc: Doc, day: string) => studySessions(doc).filter((s) => dateKey(s.start) === day)

export const QUEST_POOL: QuestDef[] = [
  { id: 'study30', label: 'Study for 30 minutes', target: 30, reward: 40, progress: (d, k) => Math.floor(todays(d, k).reduce((t, s) => t + s.eff, 0)) },
  { id: 'study60', label: 'Study for 1 hour', target: 60, reward: 80, progress: (d, k) => Math.floor(todays(d, k).reduce((t, s) => t + s.eff, 0)) },
  { id: 'modules2', label: 'Study 2 different modules', target: 2, reward: 60, progress: (d, k) => new Set(todays(d, k).map((s) => s.moduleId)).size },
  { id: 'focus', label: 'Finish a focus session', target: 1, reward: 60, progress: (d, k) => (todays(d, k).some((s) => s.focus) ? 1 : 0) },
  { id: 'sessions2', label: 'Log 2 study sessions', target: 2, reward: 45, progress: (d, k) => todays(d, k).length },
  { id: 'plant', label: 'Plant a seed', target: 1, reward: 30, progress: (d, k) => live(d.units).filter((u) => u.plantedAt && dateKey(u.plantedAt) === k).length },
]

export function dailyQuests(day: string): QuestDef[] {
  let h = 0
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const pool = [...QUEST_POOL]
  const out: QuestDef[] = []
  while (out.length < 3) {
    h = (h * 1103515245 + 12345) >>> 0
    out.push(pool.splice(h % pool.length, 1)[0])
  }
  return out
}

export const claimed = (doc: Doc, id: string) => !!doc.ledger[id] && !doc.ledger[id].deleted

export function weekMinutes(doc: Doc, wk: string, moduleId?: string) {
  return studySessions(doc)
    .filter((s) => weekKey(s.start) === wk && (!moduleId || s.moduleId === moduleId))
    .reduce((t, s) => t + s.eff, 0)
}

export const fmtMin = (m: number) => {
  m = Math.round(m)
  const h = Math.floor(m / 60)
  return h ? `${h}h ${m % 60}m` : `${m}m`
}

export function bestStreak(doc: Doc) {
  const per: Record<string, number> = {}
  for (const s of studySessions(doc)) per[dateKey(s.start)] = (per[dateKey(s.start)] ?? 0) + s.eff
  const days = Object.keys(per).filter((k) => per[k] >= STREAK_MIN).sort()
  let best = 0
  let run = 0
  let prev = 0
  for (const k of days) {
    const t = new Date(`${k}T12:00:00`).getTime()
    run = prev && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1
    prev = t
    best = Math.max(best, run)
  }
  return best
}

/* ---------- weekly boss ---------- */

export const BOSSES = [
  { name: 'Procrastination Boar', emoji: '🐗', sprite: 'boar' as const },
  { name: 'Distraction Fox', emoji: '🦊', sprite: 'fox' as const },
  { name: 'Deadline Stag', emoji: '🦌', sprite: 'deer' as const },
  { name: 'Snooze Hare', emoji: '🐇', sprite: 'hare' as const },
  { name: 'Doomscroll Grouse', emoji: '🐦', sprite: 'grouse' as const },
]

export function boss(doc: Doc, wk: string) {
  let h = 0
  for (const c of wk) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const b = BOSSES[h % BOSSES.length]
  const goal = live(doc.modules).reduce((t, m) => t + m.weeklyGoalH * 60, 0)
  const hp = Math.max(300, goal)
  const dmg = Math.min(hp, Math.floor(weekMinutes(doc, wk)))
  return { ...b, hp, dmg, defeated: dmg >= hp, reward: Math.round(hp / 60) * 40 + 100, id: `boss:${wk}` }
}

/* ---------- exam raids ---------- */

export const EXAM_KINDS: Record<ExamKind, { emoji: string; label: string }> = {
  exam: { emoji: '📝', label: 'Exam' },
  test: { emoji: '✏️', label: 'Test' },
  quiz: { emoji: '🧠', label: 'Quiz' },
}

/** a module's exams and tests; modules saved before the list existed carry one in the old fields */
export function moduleExams(m: Module): Exam[] {
  if (m.exams) return m.exams
  if (!m.examDate) return []
  return [{
    // the old reward id was `exam:<module>:<date>`, so this keeps already-claimed rewards claimed
    id: m.examDate,
    kind: 'exam',
    name: m.examName || 'Exam',
    date: m.examDate,
    goalH: m.examGoalH ?? 0,
    from: m.examFrom ?? dateKey(m.updatedAt),
  }]
}

export function examInfo(doc: Doc, m: Module, ex: Exam, now = Date.now()) {
  const noon = new Date(now)
  noon.setHours(12, 0, 0, 0)
  const daysLeft = Math.round((new Date(`${ex.date}T12:00:00`).getTime() - noon.getTime()) / 86_400_000)
  // only study between adding the exam and sitting it counts towards it
  const studied = live(doc.sessions)
    .filter((s) => s.moduleId === m.id && dateKey(s.start) >= ex.from && dateKey(s.start) <= ex.date)
    .reduce((t, s) => t + s.eff, 0)
  const goal = ex.goalH * 60
  return {
    exam: ex,
    kind: EXAM_KINDS[ex.kind ?? 'exam'],
    name: ex.name || EXAM_KINDS[ex.kind ?? 'exam'].label,
    daysLeft,
    studied,
    goal,
    perDay: daysLeft > 0 ? Math.max(0, (goal - studied) / daysLeft) : 0,
    done: goal > 0 && studied >= goal,
    reward: Math.round(ex.goalH * 20),
    id: `exam:${m.id}:${ex.id}`,
  }
}

/* ---------- per-module stats ---------- */

export function moduleStats(doc: Doc, moduleId: string, now = Date.now(), weeks = 8) {
  const list = studySessions(doc).filter((s) => s.moduleId === moduleId)
  const minutes = list.reduce((t, s) => t + s.minutes, 0)
  const eff = list.reduce((t, s) => t + s.eff, 0)
  const wk = weekKey(now)
  const thisWeek = list.filter((s) => weekKey(s.start) === wk).reduce((t, s) => t + s.minutes, 0)
  // oldest first, ending with the current week
  const perWeek: { key: string; minutes: number }[] = []
  const d = new Date(`${wk}T12:00:00`)
  for (let i = weeks - 1; i >= 0; i--) {
    const w = new Date(d)
    w.setDate(d.getDate() - 7 * i)
    const key = dateKey(w.getTime())
    perWeek.push({ key, minutes: list.filter((s) => weekKey(s.start) === key).reduce((t, s) => t + s.minutes, 0) })
  }
  return {
    minutes,
    eff,
    sessions: list.length,
    avg: list.length ? minutes / list.length : 0,
    longest: list.reduce((mx, s) => Math.max(mx, s.minutes), 0),
    days: new Set(list.map((s) => dateKey(s.start))).size,
    thisWeek,
    last: list.reduce((mx, s) => Math.max(mx, s.start), 0) || null,
    perWeek,
  }
}
