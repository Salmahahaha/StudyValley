let ctx: AudioContext | null = null
let soundOn = true
let hapticsOn = true

export function configureFeedback(sound: boolean, haptics: boolean) {
  soundOn = sound
  hapticsOn = haptics
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.05) {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  g.gain.setValueAtTime(vol, ctx.currentTime + start)
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur)
  o.connect(g).connect(ctx.destination)
  o.start(ctx.currentTime + start)
  o.stop(ctx.currentTime + start + dur)
}

const SEQ: Record<string, [number, number, number][]> = {
  tap: [[520, 0, 0.06]],
  coin: [[988, 0, 0.07], [1319, 0.07, 0.14]],
  plant: [[330, 0, 0.08], [440, 0.08, 0.08], [554, 0.16, 0.12]],
  chest: [[392, 0, 0.1], [494, 0.1, 0.1], [587, 0.2, 0.1], [784, 0.3, 0.25]],
  levelup: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.35]],
  bloom: [[659, 0, 0.1], [784, 0.1, 0.1], [988, 0.2, 0.1], [1319, 0.3, 0.3]],
  nope: [[200, 0, 0.15]],
}

export function sfx(name: keyof typeof SEQ, buzz = 0) {
  if (hapticsOn && buzz && 'vibrate' in navigator && navigator.userActivation?.hasBeenActive) navigator.vibrate(buzz)
  if (!soundOn) return
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    for (const [f, s, d] of SEQ[name]) tone(f, s, d)
  } catch {
    /* audio unavailable */
  }
}
