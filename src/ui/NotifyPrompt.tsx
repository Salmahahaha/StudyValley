import { useState } from 'react'
import { askNotify, notifyNow, notifyState } from '../game/notify'

/** the one place notifications get switched on; `quiet` hides the hints when there is nothing to do */
export function NotifyPrompt({ quiet = false }: { quiet?: boolean }) {
  const [state, setState] = useState(notifyState())
  const [sent, setSent] = useState(false)

  if (state === 'unsupported')
    return quiet ? null : (
      <p className="muted">Notifications aren't available here. On an iPhone, add the app to your Home Screen first, then open it from there.</p>
    )
  if (state === 'granted')
    return quiet ? null : (
      <div className="row">
        <small>🔔 You'll get a notification when a timer ends.</small>
        <button
          className="btn small ghost"
          disabled={sent}
          onClick={() => {
            setSent(true)
            setTimeout(() => {
              void notifyNow('Study Valley', 'This is what a finished session looks like. 🌱')
              setSent(false)
            }, 5000)
          }}
        >
          {sent ? 'Sending in 5s…' : 'Send a test'}
        </button>
      </div>
    )
  if (state === 'denied')
    return quiet ? null : <p className="muted">🔕 Notifications are blocked. Allow them for this site in your browser or phone settings.</p>
  return (
    <div className="row">
      <small>Want a ping when a focus session or break ends?</small>
      <button className="btn small" onClick={() => void askNotify().then(setState)}>🔔 Turn on notifications</button>
    </div>
  )
}
