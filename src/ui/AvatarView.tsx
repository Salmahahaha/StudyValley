import { useEffect, useRef } from 'react'
import { avatarShadow, avatarSpr, drawSpr, portraitSpr } from '../game/sprites'
import type { Avatar } from '../game/types'
import { paintSpr } from './Sprite'
import { useAtlas } from './useAtlas'

/**
 * The player's character. As a small portrait by default; with `stage`, a
 * little stage where she walks in place and turns to show off the outfit.
 */
export function AvatarView({ avatar, size = 48, stage = false }: { avatar: Avatar; size?: number; stage?: boolean }) {
  const ok = useAtlas()
  const ref = useRef<HTMLCanvasElement>(null)
  const key = JSON.stringify(avatar)
  useEffect(() => {
    const cv = ref.current
    if (!ok || !cv) return
    if (!stage) {
      paintSpr(cv, portraitSpr(avatar), size)
      return
    }
    const W = 32
    const H = 34
    cv.width = W
    cv.height = H
    cv.style.width = `${W * Math.floor(size / H)}px`
    cv.style.height = `${H * Math.floor(size / H)}px`
    const c = cv.getContext('2d')!
    c.imageSmoothingEnabled = false
    let raf = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      const t = ms / 1000
      const dir = [0, 3, 1, 2][Math.floor(t / 2.2) % 4]
      const walking = t % 2.2 < 1.6
      c.clearRect(0, 0, W, H)
      drawSpr(c, avatarShadow(), 16, 30)
      drawSpr(c, avatarSpr(avatar, walking, dir, t), 16, 31)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, key, size, stage])
  return (
    <span className="sprite-box" style={{ width: size, height: size }}>
      <canvas ref={ref} className="sprite" />
    </span>
  )
}
