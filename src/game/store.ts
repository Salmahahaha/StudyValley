import { create } from 'zustand'
import {
  MIN, STREAK_MIN, balance, boss, claimed, dailyQuests, dateKey, emptyDoc, examInfo, gardenSize, inventory,
  levelInfo, live, minutesOnDay, moduleExams, ownsZone, placed, plantProgress, rewardFor, rollDrop, streak, uid, weekKey,
  weekMinutes,
} from './calc'
import { ITEMS, zoneDef } from './data'
import { awardAchievements } from './achievements'
import { configureFeedback, sfx } from './audio'
import { loadLocal, mergeDocs, saveLocal, syncDoc, timerKey } from './sync'
import type {
  ActiveTimer, Doc, Drop, LedgerEntry, Module, PlantDef, RewardSummary, Settings, Unit,
} from './types'

type SyncState = 'idle' | 'syncing' | 'ok' | 'offline' | 'error'

interface ChestResult {
  gold: number
  gem: number
  itemId?: string
}

interface State {
  userId: string | null
  doc: Doc
  timer: ActiveTimer | null
  sync: SyncState
  syncError: string
  reward: RewardSummary | null
  chest: ChestResult | null
  toast: string | null

  init: (userId: string) => void
  reset: () => void
  syncNow: () => Promise<void>
  dismissReward: () => void
  dismissChest: () => void
  say: (msg: string) => void

  addModule: (m: Omit<Module, 'id' | 'updatedAt' | 'deleted'>) => string
  updateModule: (id: string, patch: Partial<Module>) => void
  deleteModule: (id: string) => void

  startTimer: (moduleId: string, focusMin: number | null) => void
  stopTimer: () => void
  cancelTimer: () => void
  logManual: (moduleId: string, minutes: number, day: string, note?: string) => void
  deleteSession: (id: string) => void

  buy: (itemId: string) => string | null
  place: (unitId: string, x: number, y: number, zone: string) => string | null
  stash: (unitId: string) => void
  removeUnit: (unitId: string) => void
  applyPot: (plantUnitId: string, potUnitId: string) => void
  harvest: (unitId: string) => void

  claimQuest: (day: string, questId: string) => void
  openChest: (day: string) => void
  claimWeekly: (moduleId: string) => void
  claimBoss: () => void
  claimExam: (moduleId: string, examId: string) => void
  buyZone: (zoneId: string) => string | null

  setSettings: (patch: Partial<Settings>) => void
  exportJson: () => string
  importJson: (text: string) => string | null
}

const cloneDoc = (d: Doc): Doc => ({
  ...d,
  modules: { ...d.modules },
  sessions: { ...d.sessions },
  ledger: { ...d.ledger },
  units: { ...d.units },
})

function addLedger(d: Doc, id: string, cur: LedgerEntry['cur'], delta: number, reason: string, at = Date.now()) {
  if (!delta) return
  d.ledger[id] = { id, cur, delta, reason, at, updatedAt: Date.now() }
}

function addUnit(d: Doc, itemId: string, id: string = uid()) {
  d.units[id] = { id, itemId, acquiredAt: Date.now(), updatedAt: Date.now() }
  return id
}

const STREAK_REWARDS: Record<number, { gold?: number; gem?: number }> = {
  3: { gold: 50 }, 7: { gem: 1 }, 14: { gem: 1, gold: 200 }, 30: { gem: 3 }, 60: { gem: 3 }, 100: { gem: 5 },
}

let syncTimeout: ReturnType<typeof setTimeout> | undefined
let toastTimeout: ReturnType<typeof setTimeout> | undefined

export const useGame = create<State>()((set, get) => {
  const commit = (fn: (d: Doc) => void) => {
    const { userId, doc } = get()
    const next = cloneDoc(doc)
    fn(next)
    const earned = awardAchievements(next)
    set({ doc: next })
    if (userId) saveLocal(userId, next)
    clearTimeout(syncTimeout)
    syncTimeout = setTimeout(() => void get().syncNow(), 1500)
    if (earned.length) {
      // let any reward popup land first, then celebrate
      setTimeout(() => {
        get().say(`🏆 Achievement unlocked: ${earned.join(', ')}`)
        sfx('levelup', 60)
      }, 700)
    }
  }

  const saveTimer = (t: ActiveTimer | null) => {
    const { userId } = get()
    set({ timer: t })
    if (!userId) return
    try {
      if (t) localStorage.setItem(timerKey(userId), JSON.stringify(t))
      else localStorage.removeItem(timerKey(userId))
    } catch {
      /* ignore */
    }
  }

  const finishSession = (moduleId: string, start: number, minutes: number, source: 'timer' | 'manual', focus: boolean, note?: string) => {
    const before = get().doc
    const now = Date.now()
    const day = dateKey(start)
    const manualToday = live(before.sessions)
      .filter((s) => s.source === 'manual' && dateKey(s.start) === day)
      .reduce((t, s) => t + s.minutes, 0)
    const streakBefore = streak(before)
    const levelBefore = levelInfo(balance(before, 'xp')).level
    const r = rewardFor(minutes, source, focus, streakBefore, manualToday)
    const drop: Drop | undefined = rollDrop(r.eff, r.gold, levelBefore)
    const id = uid()
    let bonusGold = 0
    let toast: string | null = null

    commit((d) => {
      d.sessions[id] = { id, moduleId, start, minutes, eff: r.eff, source, focus, note, drop, updatedAt: now }
      addLedger(d, `${id}:gold`, 'gold', r.gold, 'Study session', now)
      addLedger(d, `${id}:xp`, 'xp', r.xp, 'Study session', now)
      if (drop?.type === 'gold') {
        bonusGold = drop.amount ?? 0
        addLedger(d, `${id}:bonus`, 'gold', bonusGold, 'Lucky find', now)
      }
      if (drop?.type === 'gem') addLedger(d, `${id}:gem`, 'gem', drop.amount ?? 1, 'Lucky gem', now)
      if (drop?.type === 'seed' && drop.itemId) addUnit(d, drop.itemId, `${id}:drop`)

      const n = streak(d)
      const sr = STREAK_REWARDS[n]
      if (sr && r.eff >= STREAK_MIN) {
        const kid = `streak:${n}:${dateKey(now)}`
        if (!d.ledger[kid] && !d.ledger[`${kid}:g`]) {
          addLedger(d, kid, 'gold', sr.gold ?? 0, `${n}-day streak`, now)
          addLedger(d, `${kid}:g`, 'gem', sr.gem ?? 0, `${n}-day streak`, now)
          toast = `🔥 ${n}-day streak bonus!`
        }
      }
    })

    const after = get().doc
    const levelAfter = levelInfo(balance(after, 'xp')).level
    const summary: RewardSummary = {
      minutes, gold: r.gold, xp: r.xp, bonusGold, drop, focusDone: focus,
      streak: streak(after), levelBefore, levelAfter,
    }
    set({ reward: summary })
    sfx(levelAfter > levelBefore ? 'levelup' : drop ? 'chest' : 'coin', 30)
    if (toast) get().say(toast)
  }

  return {
    userId: null,
    doc: emptyDoc(),
    timer: null,
    sync: 'idle',
    syncError: '',
    reward: null,
    chest: null,
    toast: null,

    init: (userId) => {
      const doc = loadLocal(userId)
      let timer: ActiveTimer | null = null
      try {
        const raw = localStorage.getItem(timerKey(userId))
        if (raw) timer = JSON.parse(raw)
      } catch {
        /* ignore */
      }
      configureFeedback(doc.settings.sound, doc.settings.haptics)
      set({ userId, doc, timer })
      void get().syncNow()
    },

    reset: () => {
      clearTimeout(syncTimeout)
      set({ userId: null, doc: emptyDoc(), timer: null, sync: 'idle', reward: null, chest: null })
    },

    syncNow: async () => {
      const { userId, doc } = get()
      if (!userId || userId === 'demo') return
      set({ sync: 'syncing' })
      try {
        const remote = await syncDoc(userId, doc)
        const merged = mergeDocs(get().doc, remote)
        set({ doc: merged, sync: 'ok', syncError: '' })
        saveLocal(userId, merged)
        configureFeedback(merged.settings.sound, merged.settings.haptics)
      } catch (e) {
        const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Sync failed'
        set({ sync: navigator.onLine ? 'error' : 'offline', syncError: msg })
      }
    },

    dismissReward: () => set({ reward: null }),
    dismissChest: () => set({ chest: null }),
    say: (msg) => {
      clearTimeout(toastTimeout)
      set({ toast: msg })
      toastTimeout = setTimeout(() => set({ toast: null }), 2600)
    },

    addModule: (m) => {
      const id = uid()
      commit((d) => {
        d.modules[id] = { id, ...m, updatedAt: Date.now() }
      })
      return id
    },
    updateModule: (id, patch) =>
      commit((d) => {
        d.modules[id] = { ...d.modules[id], ...patch, id, updatedAt: Date.now() }
      }),
    deleteModule: (id) =>
      commit((d) => {
        d.modules[id] = { ...d.modules[id], deleted: true, updatedAt: Date.now() }
      }),

    startTimer: (moduleId, focusMin) => {
      saveTimer({ moduleId, start: Date.now(), focusMin })
      sfx('tap', 15)
    },
    stopTimer: () => {
      const t = get().timer
      if (!t) return
      const elapsedMin = (Date.now() - t.start) / MIN
      const completed = t.focusMin !== null && elapsedMin >= t.focusMin
      const minutes = completed ? (t.focusMin as number) : Math.min(360, Math.floor(elapsedMin))
      saveTimer(null)
      if (minutes < 1) {
        get().say('Under a minute, so nothing counted. Try again!')
        sfx('nope')
        return
      }
      finishSession(t.moduleId, t.start, minutes, 'timer', completed)
    },
    cancelTimer: () => saveTimer(null),
    logManual: (moduleId, minutes, day, note) => {
      const today = dateKey(Date.now())
      const start = day === today ? Date.now() - minutes * MIN : new Date(`${day}T12:00:00`).getTime()
      finishSession(moduleId, start, minutes, 'manual', false, note)
    },
    deleteSession: (id) =>
      commit((d) => {
        const now = Date.now()
        if (d.sessions[id]) d.sessions[id] = { ...d.sessions[id], deleted: true, updatedAt: now }
        for (const k of Object.keys(d.ledger)) {
          if (k.startsWith(`${id}:`)) d.ledger[k] = { ...d.ledger[k], deleted: true, updatedAt: now }
        }
        const dropUnit = d.units[`${id}:drop`]
        if (dropUnit) d.units[`${id}:drop`] = { ...dropUnit, deleted: true, updatedAt: now }
      }),

    buy: (itemId) => {
      const item = ITEMS[itemId]
      const { doc } = get()
      const level = levelInfo(balance(doc, 'xp')).level
      if (level < item.minLevel) return `Unlocks at level ${item.minLevel}`
      const gem = item.gemCost ?? 0
      if (balance(doc, 'gold') < item.cost) return 'Not enough gold. Keep studying!'
      if (balance(doc, 'gem') < gem) return 'Not enough gems.'
      const id = uid()
      commit((d) => {
        addUnit(d, itemId, id)
        addLedger(d, `buy:${id}`, 'gold', -item.cost, `Bought ${item.name}`)
        addLedger(d, `buy:${id}:g`, 'gem', -gem, `Bought ${item.name}`)
      })
      sfx('coin', 20)
      return null
    },

    place: (unitId, x, y, zone) => {
      const { doc } = get()
      const u = doc.units[unitId]
      const { cols, rows } = gardenSize(levelInfo(balance(doc, 'xp')).level, zone)
      if (x >= cols || y >= rows) return 'That land is still locked.'
      if (placed(doc, zone).some((p) => p.x === x && p.y === y)) return 'Something is already there.'
      commit((d) => {
        const next: Unit = { ...u, x, y, zone, updatedAt: Date.now() }
        if (ITEMS[u.itemId].kind === 'plant') next.plantedAt = Date.now()
        d.units[unitId] = next
      })
      sfx('plant', 20)
      return null
    },
    stash: (unitId) =>
      commit((d) => {
        const { x: _x, y: _y, zone: _z, ...rest } = d.units[unitId]
        d.units[unitId] = { ...rest, updatedAt: Date.now() }
      }),
    removeUnit: (unitId) =>
      commit((d) => {
        d.units[unitId] = { ...d.units[unitId], gone: true, updatedAt: Date.now() }
      }),
    applyPot: (plantUnitId, potUnitId) => {
      commit((d) => {
        const pot = d.units[potUnitId]
        d.units[plantUnitId] = { ...d.units[plantUnitId], pot: pot.itemId, updatedAt: Date.now() }
        d.units[potUnitId] = { ...pot, gone: true, updatedAt: Date.now() }
      })
      sfx('plant', 20)
    },
    harvest: (unitId) => {
      const { doc } = get()
      const u = doc.units[unitId]
      const def = ITEMS[u.itemId] as PlantDef
      if (!plantProgress(doc, u).ready) return
      const cycle = u.cycles ?? 0
      const lid = cycle ? `harvest:${unitId}:${cycle}` : `harvest:${unitId}`
      commit((d) => {
        const now = Date.now()
        d.units[unitId] = def.regrow
          ? { ...u, cycles: cycle + 1, plantedAt: now, harvested: true, updatedAt: now }
          : { ...u, gone: true, harvested: true, updatedAt: now }
        addLedger(d, lid, 'gold', def.harvest, `Harvested ${def.name}`)
        addLedger(d, `${lid}:g`, 'gem', def.harvestGems ?? 0, `Harvested ${def.name}`)
      })
      sfx('bloom', 40)
      get().say(`Harvested ${def.name}: +${def.harvest} 🪙${def.harvestGems ? ` +${def.harvestGems} 💎` : ''}`)
    },

    claimQuest: (day, questId) => {
      const q = dailyQuests(day).find((x) => x.id === questId)
      const { doc } = get()
      const id = `quest:${day}:${questId}`
      if (!q || claimed(doc, id) || q.progress(doc, day) < q.target) return
      commit((d) => addLedger(d, id, 'gold', q.reward, `Quest: ${q.label}`))
      sfx('coin', 20)
    },
    openChest: (day) => {
      const { doc } = get()
      const id = `chest:${day}`
      const qs = dailyQuests(day)
      if (claimed(doc, id) || !qs.every((q) => claimed(doc, `quest:${day}:${q.id}`))) return
      const level = levelInfo(balance(doc, 'xp')).level
      const gold = 80 + Math.floor(Math.random() * 121)
      const gem = Math.random() < 0.15 ? 1 : 0
      let itemId: string | undefined
      if (Math.random() < 0.25) {
        const pool = Object.values(ITEMS).filter(
          (i) => i.kind !== 'pot' && !i.gemCost && i.minLevel <= level && !(i.kind === 'plant' && i.rarity === 'rare'),
        )
        if (pool.length) itemId = pool[Math.floor(Math.random() * pool.length)].id
      }
      commit((d) => {
        addLedger(d, id, 'gold', gold, 'Daily chest')
        addLedger(d, `${id}:g`, 'gem', gem, 'Daily chest')
        if (itemId) addUnit(d, itemId, `${id}:item`)
      })
      set({ chest: { gold, gem, itemId } })
      sfx('chest', 50)
    },
    claimWeekly: (moduleId) => {
      const { doc } = get()
      const m = doc.modules[moduleId]
      const wk = weekKey(Date.now())
      const id = `weekly:${wk}:${moduleId}`
      if (!m || claimed(doc, id) || weekMinutes(doc, wk, moduleId) < m.weeklyGoalH * 60) return
      commit((d) => {
        addLedger(d, id, 'gold', m.weeklyGoalH * 30, `Weekly goal: ${m.name}`)
        addLedger(d, `${id}:g`, 'gem', 1, `Weekly goal: ${m.name}`)
      })
      sfx('bloom', 60)
      get().say(`Weekly goal done: +${m.weeklyGoalH * 30} 🪙 +1 💎`)
    },

    claimBoss: () => {
      const { doc } = get()
      const b = boss(doc, weekKey(Date.now()))
      if (!b.defeated || claimed(doc, b.id)) return
      commit((d) => {
        addLedger(d, b.id, 'gold', b.reward, `Defeated ${b.name}`)
        addLedger(d, `${b.id}:g`, 'gem', 2, `Defeated ${b.name}`)
      })
      sfx('levelup', 80)
      get().say(`⚔️ ${b.name} defeated! +${b.reward} 🪙 +2 💎`)
    },
    claimExam: (moduleId, examId) => {
      const { doc } = get()
      const m = doc.modules[moduleId]
      const ex = m && moduleExams(m).find((x) => x.id === examId)
      const e = m && ex && examInfo(doc, m, ex)
      if (!e || !e.done || claimed(doc, e.id)) return
      commit((d) => {
        addLedger(d, e.id, 'gold', e.reward, `Prep: ${e.name} (${m.name})`)
        addLedger(d, `${e.id}:g`, 'gem', 1, `Prep: ${e.name} (${m.name})`)
      })
      sfx('bloom', 60)
      get().say(`${e.kind.emoji} ${e.name} prep complete! +${e.reward} 🪙 +1 💎`)
    },
    buyZone: (zoneId) => {
      const { doc } = get()
      const z = zoneDef(zoneId)
      if (ownsZone(doc, zoneId)) return null
      if (levelInfo(balance(doc, 'xp')).level < z.minLevel) return `Unlocks at level ${z.minLevel}`
      if (balance(doc, 'gold') < z.cost) return 'Not enough gold yet.'
      if (balance(doc, 'gem') < (z.gemCost ?? 0)) return 'Not enough gems yet.'
      commit((d) => {
        const now = Date.now()
        const paidInGems = !!z.gemCost
        d.ledger[`zone:${zoneId}`] = {
          id: `zone:${zoneId}`, cur: paidInGems ? 'gem' : 'gold', delta: -(paidInGems ? z.gemCost ?? 0 : z.cost),
          reason: `Unlocked ${z.name}`, at: now, updatedAt: now,
        }
      })
      sfx('chest', 80)
      get().say(`${z.emoji} ${z.name} unlocked!`)
      return null
    },

    setSettings: (patch) => {
      commit((d) => {
        d.settings = { ...d.settings, ...patch }
        d.settingsAt = Date.now()
      })
      const s = get().doc.settings
      configureFeedback(s.sound, s.haptics)
    },
    exportJson: () => JSON.stringify(get().doc),
    importJson: (text) => {
      try {
        const parsed = JSON.parse(text)
        if (!parsed || parsed.v !== 1) return 'That does not look like a Study Valley backup.'
        commit((d) => {
          const m = mergeDocs(d, parsed)
          Object.assign(d, m)
        })
        return null
      } catch {
        return 'Could not read that file.'
      }
    },
  }
})

export const selectors = {
  gold: (s: State) => balance(s.doc, 'gold'),
  gems: (s: State) => balance(s.doc, 'gem'),
  xp: (s: State) => balance(s.doc, 'xp'),
}

export { inventory, minutesOnDay }
