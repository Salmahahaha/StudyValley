import { useEffect, useRef } from 'react'
import { iconSpr } from '../game/sprites'
import type { Spr } from '../game/sprites'
import { useAtlas } from './useAtlas'

/** paints a sprite crisp, scaled by whole numbers where it fits */
export function paintSpr(cv: HTMLCanvasElement, s: Spr, size: number) {
  cv.width = s.w
  cv.height = s.h
  const c = cv.getContext('2d')!
  c.imageSmoothingEnabled = false
  c.clearRect(0, 0, s.w, s.h)
  c.drawImage(s.img, s.x, s.y, s.w, s.h, 0, 0, s.w, s.h)
  const fit = Math.min(size / s.w, size / s.h)
  const k = fit >= 2 ? Math.min(3, Math.floor(fit)) : fit
  cv.style.width = `${s.w * k}px`
  cv.style.height = `${s.h * k}px`
}

interface Props {
  itemId: string
  size?: number
  /** when set, draws the plant at this growth stage instead of the shop icon */
  stage?: number
  pot?: string
  className?: string
  animate?: boolean
}

export function Sprite({ itemId, size = 48, stage, pot, className, animate }: Props) {
  const ok = useAtlas()
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!ok || !cv) return
    paintSpr(cv, iconSpr(itemId, stage, pot, 0), size)
    if (!animate) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 100) return
      last = t
      paintSpr(cv, iconSpr(itemId, stage, pot, t / 1000), size)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ok, itemId, stage, pot, size, animate])
  return (
    <span className={`sprite-box ${className ?? ''}`} style={{ width: size, height: size }}>
      <canvas ref={ref} className="sprite" />
    </span>
  )
}
