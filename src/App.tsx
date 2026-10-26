import { useEffect, useState } from 'react'
import type { Session as AuthSession } from '@supabase/supabase-js'
import { supabase } from './game/supabase'
import { selectors, useGame } from './game/store'
import { levelInfo, xpForLevel } from './game/calc'
import { DEFAULT_AVATAR, titleFor } from './game/data'
import { AvatarView } from './ui/AvatarView'
import { Auth } from './ui/Auth'
import { Garden } from './ui/Garden'
import { Study } from './ui/Study'
import { Shop } from './ui/Shop'
import { Quests } from './ui/Quests'
import { Journal } from './ui/Journal'
import { ChestModal, RewardModal } from './ui/Modals'
import { useTimerAlarm } from './ui/useTimerAlarm'

type Tab = 'garden' | 'study' | 'shop' | 'quests' | 'journal'
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'garden', icon: '🌱', label: 'Garden' },
  { id: 'study', icon: '📖', label: 'Study' },
  { id: 'shop', icon: '🛒', label: 'Shop' },
  { id: 'quests', icon: '📜', label: 'Quests' },
  { id: 'journal', icon: '🏆', label: 'Journal' },
]

function Hud() {
  const gold = useGame(selectors.gold)
  const gems = useGame(selectors.gems)
  const xp = useGame(selectors.xp)
  const sync = useGame((s) => s.sync)
  const syncNow = useGame((s) => s.syncNow)
  const settings = useGame((s) => s.doc.settings)
  const { level, into, need } = levelInfo(xp)
  const dot = { ok: '🟢', syncing: '🟡', idle: '⚪', offline: '🟠', error: '🔴' }[sync]
  return (
    <header className="hud panel">
      <div className="hud-top">
        <div className="who">
          <AvatarView avatar={settings.avatar ?? DEFAULT_AVATAR} size={40} />
          <div>
            <div className="lvl">Lv {level}</div>
            <div className="title">{settings.title ?? titleFor(level)}</div>
          </div>
        </div>
        <button className="sync" onClick={() => void syncNow()} title="Tap to sync now">
          {dot} {sync === 'ok' ? 'Synced' : sync === 'syncing' ? 'Syncing' : sync === 'offline' ? 'Offline' : sync === 'error' ? 'Sync issue' : ''}
        </button>
      </div>
      <div className="bar xp" title={`${into} / ${need} XP`}>
        <span style={{ width: `${(into / (need || xpForLevel(level))) * 100}%` }} />
      </div>
      <div className="coins">
        <span className="coin" title="Gold"><span>🪙</span><b>{gold.toLocaleString()}</b><small>gold</small></span>
        <span className="coin" title="Gems"><span>💎</span><b>{gems.toLocaleString()}</b><small>gems</small></span>
      </div>
    </header>
  )
}

const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo')

export default function App() {
  const [auth, setAuth] = useState<AuthSession | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('garden')
  const init = useGame((s) => s.init)
  const reset = useGame((s) => s.reset)
  const syncNow = useGame((s) => s.syncNow)
  const toast = useGame((s) => s.toast)
  const userId = auth?.user.id
  useTimerAlarm()

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setAuth(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setAuth(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (DEMO) init('demo')
    else if (userId) init(userId)
    else if (auth === null) reset()
  }, [userId, auth, init, reset])

  useEffect(() => {
    const onVisible = () => document.visibilityState === 'visible' && void syncNow()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [syncNow])

  if (!DEMO && auth === undefined) return <div className="boot">🌱 Loading…</div>
  if (!DEMO && !auth) return <Auth />

  return (
    <div className={`app ${tab === 'garden' ? 'wide' : ''}`}>
      <Hud />
      <main>
        {tab === 'garden' && <Garden goStudy={() => setTab('study')} goShop={() => setTab('shop')} />}
        {tab === 'study' && <Study />}
        {tab === 'shop' && <Shop />}
        {tab === 'quests' && <Quests />}
        {tab === 'journal' && <Journal email={auth?.user.email ?? 'demo (not synced)'} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ti">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
      <RewardModal />
      <ChestModal />
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
