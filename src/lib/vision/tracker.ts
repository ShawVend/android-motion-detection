/**
 * Object tracker + false-positive filter, adapted from Frigate's
 * `CentroidTracker` (frigate/track/centroid_tracker.py) and the
 * "true positive" logic in frigate/object_processing.py:
 *
 *  - detections are matched to existing tracks by IoU, falling back to
 *    centroid distance (greedy, best match first)
 *  - each track keeps a rolling history of scores; an object only becomes a
 *    confirmed event when the *median* of that history reaches `threshold`
 *    (Frigate default 0.7) — single-frame flukes are ignored
 *  - tracks that go unseen for `maxDisappeared` updates are dropped and the
 *    event ends
 */
import type { Box } from './motion'
import type { Category, Detection } from './detector'

export type Track = {
  id: number
  category: Category
  label: string
  box: Box
  scores: number[]
  topScore: number
  hits: number
  disappeared: number
  confirmed: boolean
  firstSeen: number
  lastSeen: number
}

export type TrackerConfig = {
  threshold: number
  maxDisappeared: number
  historySize: number
  minHits: number
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  threshold: 0.65,
  maxDisappeared: 12,
  historySize: 10,
  minHits: 3,
}

export type TrackerUpdate = {
  tracks: Track[]
  /** Tracks that became confirmed this update — create an event for these. */
  started: Track[]
  /** Confirmed tracks that disappeared this update. */
  ended: Track[]
}

export class ObjectTracker {
  config: TrackerConfig
  private tracks = new Map<number, Track>()
  private nextId = 1

  constructor(config: Partial<TrackerConfig> = {}) {
    this.config = { ...DEFAULT_TRACKER_CONFIG, ...config }
  }

  get active() {
    return [...this.tracks.values()]
  }

  clear() {
    this.tracks.clear()
  }

  update(detections: Detection[], now = Date.now()): TrackerUpdate {
    const cfg = this.config
    const started: Track[] = []
    const ended: Track[] = []
    const tracks = [...this.tracks.values()]

    // candidate pairs, scored by IoU (or inverse normalised distance)
    const pairs: { t: Track; d: number; s: number }[] = []
    detections.forEach((det, di) => {
      for (const t of tracks) {
        if (t.category !== det.category) continue
        const iou = IoU(t.box, det.box)
        const dist = centroidDistance(t.box, det.box)
        const reach = Math.max(t.box.w, t.box.h, det.box.w, det.box.h)
        const s = iou > 0 ? 1 + iou : dist < reach ? 1 - dist / reach : 0
        if (s > 0) pairs.push({ t, d: di, s })
      }
    })
    pairs.sort((a, b) => b.s - a.s)
    const usedT = new Set<number>()
    const usedD = new Set<number>()
    for (const p of pairs) {
      if (usedT.has(p.t.id) || usedD.has(p.d)) continue
      usedT.add(p.t.id)
      usedD.add(p.d)
      const det = detections[p.d]
      const t = p.t
      t.box = smoothBox(t.box, det.box)
      t.label = det.label
      t.scores.push(det.score)
      if (t.scores.length > cfg.historySize) t.scores.shift()
      t.topScore = Math.max(t.topScore, det.score)
      t.hits++
      t.disappeared = 0
      t.lastSeen = now
    }

    // new tracks
    detections.forEach((det, di) => {
      if (usedD.has(di)) return
      const t: Track = {
        id: this.nextId++,
        category: det.category,
        label: det.label,
        box: det.box,
        scores: [det.score],
        topScore: det.score,
        hits: 1,
        disappeared: 0,
        confirmed: false,
        firstSeen: now,
        lastSeen: now,
      }
      this.tracks.set(t.id, t)
      usedT.add(t.id)
    })

    // ageing + confirmation
    for (const t of this.tracks.values()) {
      if (!usedT.has(t.id)) {
        t.disappeared++
        if (t.disappeared > cfg.maxDisappeared) {
          this.tracks.delete(t.id)
          if (t.confirmed) ended.push(t)
          continue
        }
      }
      if (
        !t.confirmed &&
        t.hits >= cfg.minHits &&
        median(t.scores) >= cfg.threshold
      ) {
        t.confirmed = true
        started.push(t)
      }
    }

    return { tracks: [...this.tracks.values()], started, ended }
  }
}

function smoothBox(a: Box, b: Box, k = 0.6): Box {
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    w: a.w + (b.w - a.w) * k,
    h: a.h + (b.h - a.h) * k,
  }
}

export function IoU(a: Box, b: Box) {
  const x0 = Math.max(a.x, b.x)
  const y0 = Math.max(a.y, b.y)
  const x1 = Math.min(a.x + a.w, b.x + b.w)
  const y1 = Math.min(a.y + a.h, b.y + b.h)
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0)
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

function centroidDistance(a: Box, b: Box) {
  const dx = a.x + a.w / 2 - (b.x + b.w / 2)
  const dy = a.y + a.h / 2 - (b.y + b.h / 2)
  return Math.hypot(dx, dy)
}

export function median(v: number[]) {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
