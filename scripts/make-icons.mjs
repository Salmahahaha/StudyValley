// Generates the PWA icons as pixel art. Run: node scripts/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync, crc32 } from 'node:zlib'

const GRID = [
  '................',
  '................',
  '....ll....rr....',
  '...llLL..rrRR...',
  '...lLLLllrRRR...',
  '....LLLLLRRR....',
  '.....LLsRRR.....',
  '......ssss......',
  '.......ss.......',
  '..pppppppppppp..',
  '...oooooooooo...',
  '...oOoooooooo...',
  '....oooooooo....',
  '....oooooooo....',
  '.....oooooo.....',
  '................',
]
const PAL = {
  '.': [108, 176, 74], l: [126, 208, 122], L: [47, 122, 47], s: [58, 140, 50],
  r: [255, 158, 200], R: [232, 80, 91], p: [224, 138, 82], o: [201, 112, 62], O: [224, 150, 100],
}

function png(size) {
  const scale = Math.floor(size / 16)
  const off = Math.floor((size - scale * 16) / 2)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const gx = Math.min(15, Math.max(0, Math.floor((x - off) / scale)))
      const gy = Math.min(15, Math.max(0, Math.floor((y - off) / scale)))
      const [r, g, b] = PAL[GRID[gy][gx]]
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', png(192))
writeFileSync('public/icon-512.png', png(512))
writeFileSync('public/apple-touch-icon.png', png(180))
console.log('icons written')
