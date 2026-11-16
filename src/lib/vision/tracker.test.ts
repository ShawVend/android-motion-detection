import { describe, expect, it } from 'vitest'
import { ObjectTracker, IoU, median } from './tracker'
import { mergeBoxes } from './motion'
import { computeRegion } from './detector'
import type { Detection } from './detector'

const person = (x: number, score: number): Detection => ({
  box: { x, y: 100, w: 60, h: 160 },
  label: 'person',
  category: 'person',
  score,
})

describe('ObjectTracker', () => {
  it('confirms an object only after its median score passes the threshold', () => {
    const t = new ObjectTracker({ threshold: 0.7, minHits: 3 })
    expect(t.update([person(100, 0.9)]).started).toHaveLength(0)
    expect(t.update([person(105, 0.8)]).started).toHaveLength(0)
    const u = t.update([person(110, 0.75)])
    expect(u.started).toHaveLength(1)
    expect(u.tracks).toHaveLength(1)
  })

  it('ignores a single high-scoring fluke among low scores', () => {
    const t = new ObjectTracker({ threshold: 0.7, minHits: 3 })
    t.update([person(100, 0.4)])
    t.update([person(102, 0.95)])
    expect(t.update([person(104, 0.45)]).started).toHaveLength(0)
  })

  it('ends confirmed tracks after they disappear', () => {
    const t = new ObjectTracker({ threshold: 0.5, minHits: 1, maxDisappeared: 2 })
    t.update([person(100, 0.9)])
    t.update([])
    t.update([])
    expect(t.update([]).ended).toHaveLength(1)
  })
})

describe('geometry helpers', () => {
  it('computes IoU and median', () => {
    expect(IoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(1)
    expect(IoU({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 })).toBe(0)
    expect(median([0.2, 0.9, 0.5])).toBe(0.5)
  })

  it('merges overlapping motion boxes', () => {
    const merged = mergeBoxes([
      { x: 0, y: 0, w: 10, h: 10 },
      { x: 8, y: 8, w: 10, h: 10 },
      { x: 100, y: 100, w: 5, h: 5 },
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0]).toEqual({ x: 0, y: 0, w: 18, h: 18 })
  })

  it('returns a square region clamped to the frame, or null for large motion', () => {
    const r = computeRegion([{ x: 10, y: 10, w: 50, h: 80 }], 1280, 720)!
    expect(r.w).toBe(r.h)
    expect(r.x).toBeGreaterThanOrEqual(0)
    expect(computeRegion([{ x: 0, y: 0, w: 1200, h: 700 }], 1280, 720)).toBeNull()
  })
})
