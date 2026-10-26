export interface Stamped {
  updatedAt: number
  deleted?: boolean
}

export type ExamKind = 'exam' | 'test' | 'quiz'

export interface Exam {
  /** stable across edits, so rescheduling never lets a reward be claimed twice */
  id: string
  kind: ExamKind
  name: string
  /** YYYY-MM-DD */
  date: string
  goalH: number
  /** day the prep goal started counting (YYYY-MM-DD) */
  from: string
}

export interface Module extends Stamped {
  id: string
  name: string
  emoji: string
  color: string
  weeklyGoalH: number
  exams?: Exam[]
  /** legacy single-exam fields, read as one exam until the module is next saved */
  examName?: string
  examDate?: string
  examGoalH?: number
  examFrom?: string
}

export interface Drop {
  type: 'gold' | 'seed' | 'gem'
  amount?: number
  itemId?: string
}

export interface Session extends Stamped {
  id: string
  moduleId: string
  start: number
  minutes: number
  /** minutes that count towards rewards and growth (manual logs are discounted) */
  eff: number
  source: 'timer' | 'manual'
  focus: boolean
  note?: string
  drop?: Drop
  /** a rest session: half rewards, and kept out of study stats. Missing means study. */
  kind?: 'study' | 'break'
}

export interface LedgerEntry extends Stamped {
  id: string
  cur: 'gold' | 'gem' | 'xp'
  delta: number
  reason: string
  at: number
}

export interface Unit extends Stamped {
  id: string
  itemId: string
  acquiredAt: number
  x?: number
  y?: number
  plantedAt?: number
  /** how many times a fruit tree has been harvested */
  cycles?: number
  zone?: string
  /** corner of the tile (0 back-left, 1 back-right, 2 front-left, 3 front-right) for small decor; missing means the centre */
  q?: number
  /** growth minutes already earned before the plant was moved to another garden */
  banked?: number
  /** when growth started counting again after such a move */
  growFrom?: number
  pot?: string
  gone?: boolean
  harvested?: boolean
}

export interface HairSpec {
  cut: number
  fringe: number
  back: number
  tail: number
}

export interface Avatar {
  skin: number
  /** hairstyle preset */
  hair: number
  hairColor: number
  /** fine-tuned hair that overrides the preset */
  hairSpec?: HairSpec
  /** custom hair colour (#rrggbb) that overrides hairColor */
  hairHex?: string
  /** colour of the hair ends, for an ombre */
  hairTip?: string
  hat?: string
  outfit?: string
}

export interface Settings {
  sound: boolean
  haptics: boolean
  title?: string
  avatar?: Avatar
}

export interface Doc {
  v: 1
  modules: Record<string, Module>
  sessions: Record<string, Session>
  ledger: Record<string, LedgerEntry>
  units: Record<string, Unit>
  settings: Settings
  settingsAt: number
}

export interface ActiveTimer {
  moduleId: string
  start: number
  focusMin: number | null
  /** a break has no module and always runs for a set time */
  kind?: 'break'
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export interface PlantDef {
  kind: 'plant'
  id: string
  name: string
  blurb: string
  rarity: Rarity
  cost: number
  gemCost?: number
  minLevel: number
  minutes: number
  harvest: number
  harvestGems?: number
  /** fruit trees keep growing fruit: minutes of study for each new crop */
  regrow?: number
}
export interface PotDef {
  kind: 'pot'
  id: string
  name: string
  blurb: string
  cost: number
  gemCost?: number
  minLevel: number
  speed: number
  color: string
  rim: string
}
export interface DecorDef {
  kind: 'decor'
  cat: 'garden' | 'nature' | 'magic' | 'pet'
  id: string
  name: string
  blurb: string
  cost: number
  gemCost?: number
  minLevel: number
}
export interface CosmeticDef {
  kind: 'cosmetic'
  id: string
  slot: 'hat' | 'outfit'
  name: string
  blurb: string
  cost: number
  gemCost?: number
  minLevel: number
  color: string
  color2: string
}
export type ItemDef = PlantDef | PotDef | DecorDef | CosmeticDef

export interface ZoneDef {
  id: string
  name: string
  emoji: string
  blurb: string
  minLevel: number
  cost: number
  gemCost?: number
  cols: number
  rows: number
  speed: number
}

export interface RewardSummary {
  kind?: 'break'
  minutes: number
  gold: number
  xp: number
  bonusGold: number
  drop?: Drop
  focusDone: boolean
  streak: number
  levelBefore: number
  levelAfter: number
}
