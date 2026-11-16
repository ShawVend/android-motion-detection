/**
 * Object detection stage — mirrors Frigate's approach of running the
 * detector only on *regions* around motion (frigate/util/object.py
 * `get_cluster_region` / `calculate_region`) instead of the whole frame on
 * every tick. Runs TensorFlow.js COCO-SSD (MobileNet v2) on-device; it uses
 * the same COCO label map as Frigate's default SSD model.
 */
import type { Box } from './motion'

export type Category = 'person' | 'car'

/** COCO labels we keep, grouped the way a CCTV user thinks about them. */
export const LABEL_MAP: Record<string, Category> = {
  person: 'person',
  car: 'car',
  truck: 'car',
  bus: 'car',
  motorcycle: 'car',
}

export type Detection = {
  box: Box
  label: string
  category: Category
  score: number
}

type CocoModel = {
  detect: (
    img: HTMLCanvasElement | HTMLVideoElement,
    maxNumBoxes?: number,
    minScore?: number,
  ) => Promise<
    { bbox: [number, number, number, number]; class: string; score: number }[]
  >
}

const modelCache = new Map<string, Promise<CocoModel>>()

export type ModelVariant = 'lite_mobilenet_v2' | 'mobilenet_v2'

export function loadModel(base: ModelVariant = 'lite_mobilenet_v2') {
  let modelPromise = modelCache.get(base)
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import('@tensorflow/tfjs')
      const ok = await tf.setBackend('webgl').catch(() => false)
      if (!ok) await tf.setBackend('cpu')
      await tf.ready()
      const coco = await import('@tensorflow-models/coco-ssd')
      return (await coco.load({ base })) as unknown as CocoModel
    })()
    modelCache.set(base, modelPromise)
    modelPromise.catch(() => modelCache.delete(base))
  }
  return modelPromise
}

const REGION_MIN = 320 // Frigate's default model input size

/**
 * Build one square region that covers every box of interest, padded and
 * clamped to the frame — the browser equivalent of Frigate's region
 * calculation. Returns null when the full frame is the better choice.
 */
export function computeRegion(
  boxes: Box[],
  frameW: number,
  frameH: number,
): Box | null {
  if (!boxes.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const b of boxes) {
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.w)
    y1 = Math.max(y1, b.y + b.h)
  }
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  // Frigate multiplies the cluster size by 1.2–1.5 so objects aren't clipped
  let size = Math.max(x1 - x0, y1 - y0) * 1.5
  size = Math.max(size, Math.min(REGION_MIN, frameW, frameH))
  if (size >= Math.min(frameW, frameH) * 0.9) return null
  let x = cx - size / 2
  let y = cy - size / 2
  x = Math.max(0, Math.min(frameW - size, x))
  y = Math.max(0, Math.min(frameH - size, y))
  return { x, y, w: size, h: size }
}

let regionCanvas: HTMLCanvasElement | null = null

export async function detectObjects(
  model: CocoModel,
  video: HTMLVideoElement,
  region: Box | null,
  minScore: number,
): Promise<Detection[]> {
  const fw = video.videoWidth
  const fh = video.videoHeight
  let input: HTMLCanvasElement | HTMLVideoElement = video
  let ox = 0
  let oy = 0
  let scale = 1
  if (region) {
    if (!regionCanvas) regionCanvas = document.createElement('canvas')
    const side = Math.min(REGION_MIN * 1.5, region.w)
    regionCanvas.width = side
    regionCanvas.height = side
    regionCanvas
      .getContext('2d')!
      .drawImage(video, region.x, region.y, region.w, region.h, 0, 0, side, side)
    input = regionCanvas
    ox = region.x
    oy = region.y
    scale = region.w / side
  }
  const raw = await model.detect(input, 20, minScore)
  const out: Detection[] = []
  for (const r of raw) {
    const category = LABEL_MAP[r.class]
    if (!category) continue
    const [bx, by, bw, bh] = r.bbox
    out.push({
      label: r.class,
      category,
      score: r.score,
      box: {
        x: Math.max(0, ox + bx * scale),
        y: Math.max(0, oy + by * scale),
        w: Math.min(fw, bw * scale),
        h: Math.min(fh, bh * scale),
      },
    })
  }
  return out
}
