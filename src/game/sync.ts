import { supabase } from './supabase'
import { emptyDoc } from './calc'
import { ITEMS, LEGACY_IDS } from './data'
import type { Doc, Stamped } from './types'

function mergeMap<T extends Stamped>(a: Record<string, T> = {}, b: Record<string, T> = {}) {
  const out: Record<string, T> = { ...a }
  for (const [id, item] of Object.entries(b)) {
    if (!out[id] || item.updatedAt > out[id].updatedAt) out[id] = item
  }
  return out
}

/** rewrite item ids from older versions so every unit points at a real item */
export function migrate(doc: Doc): Doc {
  let changed = false
  const units = { ...doc.units }
  for (const [id, u] of Object.entries(units)) {
    let itemId = LEGACY_IDS[u.itemId] ?? u.itemId
    const pot = u.pot && ITEMS[u.pot] ? u.pot : undefined
    if (!ITEMS[itemId]) itemId = 'carrot'
    if (itemId !== u.itemId || pot !== u.pot) {
      units[id] = { ...u, itemId, pot }
      changed = true
    }
  }
  return changed ? { ...doc, units } : doc
}

export function mergeDocs(a: Doc, b?: Partial<Doc> | null): Doc {
  if (!b) return migrate(a)
  const settings = (b.settingsAt ?? 0) > a.settingsAt && b.settings ? b.settings : a.settings
  return migrate({
    v: 1,
    modules: mergeMap(a.modules, b.modules),
    sessions: mergeMap(a.sessions, b.sessions),
    ledger: mergeMap(a.ledger, b.ledger),
    units: mergeMap(a.units, b.units),
    settings,
    settingsAt: Math.max(a.settingsAt, b.settingsAt ?? 0),
  })
}

/** pull remote, merge with local, push merged. Returns the merged doc. */
export async function syncDoc(userId: string, local: Doc): Promise<Doc> {
  const { data, error } = await supabase
    .from('game_state')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  const merged = mergeDocs(local, data?.data as Partial<Doc> | undefined)
  const { error: upErr } = await supabase
    .from('game_state')
    .upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() })
  if (upErr) throw upErr
  return merged
}

const key = (userId: string) => `studyvalley:doc:${userId}`
export const timerKey = (userId: string) => `studyvalley:timer:${userId}`

export function loadLocal(userId: string): Doc {
  try {
    const raw = localStorage.getItem(key(userId))
    if (raw) return mergeDocs(emptyDoc(), JSON.parse(raw))
  } catch {
    /* ignore corrupt or blocked storage */
  }
  return emptyDoc()
}

export function saveLocal(userId: string, doc: Doc) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(doc))
  } catch {
    /* storage full or blocked */
  }
}
