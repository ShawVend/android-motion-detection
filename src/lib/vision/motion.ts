/**
 * Motion detector adapted from Frigate NVR's `ImprovedMotionDetector`
 * (frigate/motion/improved_motion.py, MIT licence).
 *
 * Pipeline per frame — same stages as Frigate, ported from OpenCV/numpy to
 * plain typed arrays so it runs in the browser without native code:
 *   1. downscale the frame to a small working resolution (Frigate: `frame_height`)
 *   2. convert to grayscale + optional contrast normalisation
 *   3. blur (Frigate uses a Gaussian; we use a separable box blur)
 *   4. diff against a running-average background (`frame_alpha`)
 *   5. threshold the diff (`threshold`, default 30)
 *   6. dilate the mask to merge nearby pixels
 *   7. extract connected regions and drop those under `contour_area`
 *   8. if most of the frame changed at once (lightning, auto-exposure, camera
 *      bump) treat it as a calibration event and reset the background
 *      (Frigate: `lightning_threshold`).
 */

export type Box = { x: number; y: number; w: number; h: number }

export type MotionConfig = {
  /** Working height in pixels. Frigate default: 100. */
  frameHeight: number
  /** Per-pixel diff threshold (0–255). Lower = more sensitive. Frigate: 30. */
  threshold: number
  /** Minimum region area in working-resolution pixels. Frigate: 10. */
  contourArea: number
  /** Background learning rate. Frigate: 0.01. */
  frameAlpha: number
  /** Fraction of frame changed that triggers recalibration. Frigate: 0.8. */
  lightningThreshold: number
  /** Stretch histogram before diffing — helps in low light. */
  improveContrast: boolean
}

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  frameHeight: 120,
  threshold: 30,
  contourArea: 12,
  frameAlpha: 0.02,
  lightningThreshold: 0.8,
  improveContrast: true,
}

export type MotionResult = {
  /** Motion regions in source-frame pixel coordinates. */
  boxes: Box[]
  /** Fraction (0–1) of working pixels flagged as moving. */
  score: number
  /** True when the background was reset this frame. */
  calibrating: boolean
  /** Working-resolution mask, useful for a debug overlay. */
  mask: Uint8Array
  maskWidth: number
  maskHeight: number
}

export class MotionDetector {
  config: MotionConfig
  private ctx:
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null = null
  private w = 0
  private h = 0
  private gray = new Float32Array(0)
  private blurTmp = new Float32Array(0)
  private avg: Float32Array | null = null
  private mask = new Uint8Array(0)
  private dilated = new Uint8Array(0)
  private labels = new Int32Array(0)
  private calibrationFrames = 0

  constructor(config: Partial<MotionConfig> = {}) {
    this.config = { ...DEFAULT_MOTION_CONFIG, ...config }
  }

  update(config: Partial<MotionConfig>) {
    const resize =
      config.frameHeight !== undefined &&
      config.frameHeight !== this.config.frameHeight
    this.config = { ...this.config, ...config }
    if (resize) this.reset()
  }

  reset() {
    this.avg = null
    this.w = 0
    this.h = 0
  }

  private ensureBuffers(srcW: number, srcH: number) {
    const h = Math.round(this.config.frameHeight)
    const w = Math.max(1, Math.round((srcW / srcH) * h))
    if (w === this.w && h === this.h && this.ctx) return
    this.w = w
    this.h = h
    if (typeof OffscreenCanvas !== 'undefined') {
      const c = new OffscreenCanvas(w, h)
      this.ctx = c.getContext('2d', { willReadFrequently: true })
    } else {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      this.ctx = c.getContext('2d', { willReadFrequently: true })
    }
    const n = w * h
    this.gray = new Float32Array(n)
    this.blurTmp = new Float32Array(n)
    this.mask = new Uint8Array(n)
    this.dilated = new Uint8Array(n)
    this.labels = new Int32Array(n)
    this.avg = null
  }

  detect(
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    /** Optional ignore mask regions in source coords (Frigate "motion masks"). */
    ignore: Box[] = [],
  ): MotionResult {
    this.ensureBuffers(srcW, srcH)
    const { w, h } = this
    const ctx = this.ctx!
    const cfg = this.config
    ctx.drawImage(source, 0, 0, w, h)
    const px = ctx.getImageData(0, 0, w, h).data
    const n = w * h
    const gray = this.gray

    // 2. grayscale (BT.601 luma, same weights as cv2.COLOR_BGR2GRAY)
    let min = 255
    let max = 0
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const v = 0.299 * px[j] + 0.587 * px[j + 1] + 0.114 * px[j + 2]
      gray[i] = v
      if (v < min) min = v
      if (v > max) max = v
    }
    if (cfg.improveContrast && max - min > 8) {
      // Frigate uses cv2.normalize with percentile clipping; min/max stretch
      // is a cheap approximation that gives the same benefit at night.
      const scale = 255 / (max - min)
      for (let i = 0; i < n; i++) gray[i] = (gray[i] - min) * scale
    }

    // apply ignore masks by flattening those pixels to the background later
    const sx = w / srcW
    const sy = h / srcH

    // 3. blur
    boxBlur(gray, this.blurTmp, w, h, 2)

    // 4. running-average background
    if (!this.avg) {
      this.avg = Float32Array.from(gray)
      this.calibrationFrames = 5
    }
    const avg = this.avg
    const mask = this.mask
    const t = cfg.threshold
    let changed = 0
    for (let i = 0; i < n; i++) {
      const d = Math.abs(gray[i] - avg[i])
      const m = d > t ? 1 : 0
      mask[i] = m
      changed += m
    }
    for (const b of ignore) {
      const x0 = Math.max(0, Math.floor(b.x * sx))
      const y0 = Math.max(0, Math.floor(b.y * sy))
      const x1 = Math.min(w, Math.ceil((b.x + b.w) * sx))
      const y1 = Math.min(h, Math.ceil((b.y + b.h) * sy))
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          changed -= mask[y * w + x]
          mask[y * w + x] = 0
        }
    }

    const score = changed / n
    let calibrating = false
    if (this.calibrationFrames > 0 || score > cfg.lightningThreshold) {
      // 8. lightning / exposure jump → re-learn background quickly
      calibrating = true
      this.calibrationFrames = Math.max(0, this.calibrationFrames - 1)
      if (score > cfg.lightningThreshold) this.calibrationFrames = 3
      avg.set(gray)
      mask.fill(0)
      return {
        boxes: [],
        score: 0,
        calibrating,
        mask,
        maskWidth: w,
        maskHeight: h,
      }
    }

    // update background (cv2.accumulateWeighted)
    const a = cfg.frameAlpha
    for (let i = 0; i < n; i++) avg[i] = avg[i] * (1 - a) + gray[i] * a

    // 6. dilate (3x3, 2 iterations — Frigate uses iterations=1 on a larger kernel)
    dilate(mask, this.dilated, w, h)
    dilate(this.dilated, mask, w, h)

    // 7. connected components → bounding boxes
    const regions = connectedBoxes(mask, this.labels, w, h, cfg.contourArea)
    const boxes = mergeBoxes(regions, 2).map((b) => ({
      x: b.x / sx,
      y: b.y / sy,
      w: b.w / sx,
      h: b.h / sy,
    }))

    return { boxes, score, calibrating, mask, maskWidth: w, maskHeight: h }
  }
}

function boxBlur(
  data: Float32Array,
  tmp: Float32Array,
  w: number,
  h: number,
  r: number,
) {
  const norm = 1 / (2 * r + 1)
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let x = -r; x <= r; x++) acc += data[row + clamp(x, 0, w - 1)]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc * norm
      acc +=
        data[row + clamp(x + r + 1, 0, w - 1)] -
        data[row + clamp(x - r, 0, w - 1)]
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[clamp(y, 0, h - 1) * w + x]
    for (let y = 0; y < h; y++) {
      data[y * w + x] = acc * norm
      acc +=
        tmp[clamp(y + r + 1, 0, h - 1) * w + x] -
        tmp[clamp(y - r, 0, h - 1) * w + x]
    }
  }
}

function dilate(src: Uint8Array, dst: Uint8Array, w: number, h: number) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0
      for (let dy = -1; dy <= 1 && !v; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx >= 0 && xx < w && src[yy * w + xx]) {
            v = 1
            break
          }
        }
      }
      dst[y * w + x] = v
    }
  }
}

function connectedBoxes(
  mask: Uint8Array,
  labels: Int32Array,
  w: number,
  h: number,
  minArea: number,
): Box[] {
  labels.fill(0)
  const boxes: Box[] = []
  const stack: number[] = []
  let label = 0
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue
    label++
    let area = 0
    let x0 = w
    let y0 = h
    let x1 = 0
    let y1 = 0
    stack.push(i)
    labels[i] = label
    while (stack.length) {
      const p = stack.pop()!
      const px = p % w
      const py = (p - px) / w
      area++
      if (px < x0) x0 = px
      if (px > x1) x1 = px
      if (py < y0) y0 = py
      if (py > y1) y1 = py
      const nb = [
        px > 0 ? p - 1 : -1,
        px < w - 1 ? p + 1 : -1,
        py > 0 ? p - w : -1,
        py < h - 1 ? p + w : -1,
      ]
      for (const q of nb) {
        if (q >= 0 && mask[q] && !labels[q]) {
          labels[q] = label
          stack.push(q)
        }
      }
    }
    if (area >= minArea)
      boxes.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 })
  }
  return boxes
}

/** Merge overlapping / touching boxes (Frigate merges motion boxes before region selection). */
export function mergeBoxes(boxes: Box[], pad = 0): Box[] {
  const out = boxes.map((b) => ({ ...b }))
  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i]
        const b = out[j]
        if (
          a.x - pad <= b.x + b.w &&
          b.x - pad <= a.x + a.w &&
          a.y - pad <= b.y + b.h &&
          b.y - pad <= a.y + a.h
        ) {
          const x = Math.min(a.x, b.x)
          const y = Math.min(a.y, b.y)
          out[i] = {
            x,
            y,
            w: Math.max(a.x + a.w, b.x + b.w) - x,
            h: Math.max(a.y + a.h, b.y + b.h) - y,
          }
          out.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }
  return out
}

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}
