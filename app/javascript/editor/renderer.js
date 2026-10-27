import { HEADER } from "editor/frames"

const FRAME_HEIGHT = 8
const FRAME_WIDTH = (FRAME_HEIGHT * 16) / 9
const FONTS = [
  `"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`,
  `"Latin Modern Math", "STIX Two Math", "Cambria Math", "Times New Roman", serif`,
  `ui-monospace, "SF Mono", Menlo, Consolas, monospace`,
]
const FONT_STYLE = ["", "italic ", ""]

function rgba(r, g, b, a) {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`
}

// Draws baked frames to a 2D canvas, in Manim's coordinate system.
export class Renderer {
  scale = 1 // device px per Manim unit
  dpr = 1
  widthCache = new Map()

  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext("2d", { alpha: false })
  }

  resize(cssWidth, cssHeight) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    this.canvas.width = Math.round(cssWidth * this.dpr)
    this.canvas.height = Math.round(cssHeight * this.dpr)
    this.scale = this.canvas.width / FRAME_WIDTH
  }

  toUnits() {
    const s = this.scale
    this.ctx.setTransform(s, 0, 0, -s, this.canvas.width / 2, this.canvas.height / 2)
  }

  // Canvas-pixel coords of a Manim point.
  px(x, y) {
    return [x * this.scale + this.canvas.width / 2, -y * this.scale + this.canvas.height / 2]
  }

  *items(frame) {
    let o = 0
    while (o < frame.length) {
      const n = frame[o + 2]
      yield { kind: frame[o], line: frame[o + 1], offset: o + HEADER, n }
      o += HEADER + n * 2
    }
  }

  tracePath(target, f, off, n) {
    let sx = 0, sy = 0, px = 0, py = 0
    for (let i = 0; i + 3 < n; i += 4) {
      const o = off + i * 2
      const x0 = f[o], y0 = f[o + 1]
      if (i === 0 || Math.abs(x0 - px) > 1e-4 || Math.abs(y0 - py) > 1e-4) {
        if (i > 0 && Math.abs(px - sx) < 1e-4 && Math.abs(py - sy) < 1e-4) target.closePath()
        target.moveTo(x0, y0)
        sx = x0
        sy = y0
      }
      target.bezierCurveTo(f[o + 2], f[o + 3], f[o + 4], f[o + 5], f[o + 6], f[o + 7])
      px = f[o + 6]
      py = f[o + 7]
    }
    if (n >= 4 && Math.abs(px - sx) < 1e-4 && Math.abs(py - sy) < 1e-4) target.closePath()
  }

  draw(frame, strings, background, hl) {
    const { ctx } = this
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = background
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    if (!frame) return
    ctx.lineJoin = "round"
    ctx.lineCap = "round"
    const overlays = []
    for (const it of this.items(frame)) {
      const h = it.offset - HEADER
      if (it.kind === 1) this.drawText(frame, h, it, strings)
      else {
        this.toUnits()
        ctx.beginPath()
        this.tracePath(ctx, frame, it.offset, it.n)
        if (frame[h + 11] > 0) {
          ctx.fillStyle = rgba(frame[h + 8], frame[h + 9], frame[h + 10], frame[h + 11])
          ctx.fill("evenodd")
        }
        if (frame[h + 6] > 0 && frame[h + 7] > 0) {
          ctx.strokeStyle = rgba(frame[h + 3], frame[h + 4], frame[h + 5], frame[h + 6])
          ctx.lineWidth = frame[h + 7] * 0.01
          ctx.stroke()
        }
      }
      if (it.line && (it.line === hl.hoverLine || it.line === hl.cursorLine)) overlays.push(it)
    }
    for (const it of overlays) this.drawOverlay(frame, it, it.line === hl.hoverLine)
  }

  textMetrics(frame, it) {
    const o = it.offset
    const [ulx, uly] = this.px(frame[o], frame[o + 1])
    const [urx, ury] = this.px(frame[o + 2], frame[o + 3])
    const [dlx, dly] = this.px(frame[o + 6], frame[o + 7])
    const w = Math.hypot(urx - ulx, ury - uly)
    const h = Math.hypot(dlx - ulx, dly - uly)
    const angle = Math.atan2(ury - uly, urx - ulx)
    const cx = (urx + dlx) / 2
    const cy = (ury + dly) / 2
    return { w, h, angle, cx, cy }
  }

  measure(text, font) {
    const key = font + "|" + text
    let w = this.widthCache.get(key)
    if (w === undefined) {
      this.ctx.font = `${FONT_STYLE[font]}100px ${FONTS[font]}`
      w = this.ctx.measureText(text).width / 100
      if (this.widthCache.size > 5000) this.widthCache.clear()
      this.widthCache.set(key, w)
    }
    return w
  }

  drawText(frame, h, it, strings) {
    const { ctx } = this
    const text = strings[frame[h + 12]] ?? ""
    const reveal = frame[h + 13]
    const font = frame[h + 14] | 0
    const m = this.textMetrics(frame, it)
    if (m.w < 0.5 || m.h < 0.5) return
    const lines = text.split("\n")
    const em = m.h / (1 + 1.25 * (lines.length - 1))
    const natural = Math.max(...lines.map((l) => this.measure(l, font))) * em || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.save()
    ctx.translate(m.cx, m.cy)
    ctx.rotate(m.angle)
    if (reveal < 1) {
      ctx.beginPath()
      ctx.rect(-m.w / 2, -m.h / 2 - em, m.w * reveal, m.h + 2 * em)
      ctx.clip()
    }
    ctx.scale(m.w / natural, 1)
    ctx.font = `${FONT_STYLE[font]}${em}px ${FONTS[font]}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillStyle = rgba(frame[h + 8], frame[h + 9], frame[h + 10], frame[h + 11])
    lines.forEach((l, i) => ctx.fillText(l, 0, -m.h / 2 + em / 2 + i * em * 1.25))
    ctx.restore()
  }

  drawOverlay(frame, it, strong) {
    const { ctx } = this
    ctx.save()
    ctx.setLineDash(strong ? [] : [6 * this.dpr, 5 * this.dpr])
    ctx.strokeStyle = strong ? "rgba(244, 211, 69, 0.95)" : "rgba(244, 211, 69, 0.55)"
    if (it.kind === 1) {
      const m = this.textMetrics(frame, it)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.translate(m.cx, m.cy)
      ctx.rotate(m.angle)
      ctx.lineWidth = 1.5 * this.dpr
      ctx.strokeRect(-m.w / 2 - 4, -m.h / 2 - 4, m.w + 8, m.h + 8)
    } else {
      this.toUnits()
      ctx.beginPath()
      this.tracePath(ctx, frame, it.offset, it.n)
      ctx.lineWidth = ((strong ? 2.5 : 1.5) * this.dpr) / this.scale
      ctx.setLineDash(strong ? [] : [(6 * this.dpr) / this.scale, (5 * this.dpr) / this.scale])
      ctx.stroke()
    }
    ctx.restore()
  }

  // Source line of the topmost item under a CSS-pixel position, or null.
  hitTest(frame, cssX, cssY) {
    if (!frame) return null
    const x = cssX * this.dpr
    const y = cssY * this.dpr
    const { ctx } = this
    const all = [...this.items(frame)]
    for (let i = all.length - 1; i >= 0; i--) {
      const it = all[i]
      if (!it.line) continue
      const h = it.offset - HEADER
      if (it.kind === 1) {
        const m = this.textMetrics(frame, it)
        const dx = x - m.cx, dy = y - m.cy
        const lx = dx * Math.cos(-m.angle) - dy * Math.sin(-m.angle)
        const ly = dx * Math.sin(-m.angle) + dy * Math.cos(-m.angle)
        if (Math.abs(lx) <= m.w / 2 + 4 && Math.abs(ly) <= m.h / 2 + 4) return it.line
        continue
      }
      const path = new Path2D()
      this.tracePath(path, frame, it.offset, it.n)
      this.toUnits()
      if (frame[h + 11] > 0.05 && ctx.isPointInPath(path, x, y, "evenodd")) return it.line
      ctx.lineWidth = Math.max(frame[h + 7] * 0.01, (10 * this.dpr) / this.scale)
      if (frame[h + 6] > 0.05 && ctx.isPointInStroke(path, x, y)) return it.line
    }
    return null
  }
}
