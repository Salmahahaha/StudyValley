import { useEffect } from 'react'
import { MIN } from '../game/calc'
import { notifyNow } from '../game/notify'
import { useGame } from '../game/store'

/**
 * Ends a timed session (focus block or break) the moment its time is up, on whichever tab you are on,
 * and sends a notification if the app is out of sight. Needs the page to still be running: a phone that
 * has frozen the app will catch up the next time it is opened.
 */
export function useTimerAlarm() {
  const timer = useGame((s) => s.timer)
  useEffect(() => {
    if (!timer || timer.focusMin === null) return
    const endAt = timer.start + timer.focusMin * MIN
    let fired = false
    const fire = () => {
      if (fired || Date.now() < endAt) return
      fired = true
      const st = useGame.getState()
      if (document.visibilityState !== 'visible') {
        const m = st.doc.modules[timer.moduleId]
        if (timer.kind === 'break') void notifyNow('Break over ☕', 'Rested enough? Come back and collect your reward.')
        else void notifyNow('Time is up! 🎯', `${timer.focusMin}m focus${m ? ` on ${m.name}` : ''} done. Come and collect your reward.`)
      }
      st.stopTimer()
    }
    const wake = setTimeout(fire, Math.max(0, endAt - Date.now()) + 50)
    // background tabs throttle timeouts, so also check when the app comes back and on a slow poll
    const poll = setInterval(fire, 5000)
    document.addEventListener('visibilitychange', fire)
    return () => {
      clearTimeout(wake)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', fire)
    }
  }, [timer])
}
