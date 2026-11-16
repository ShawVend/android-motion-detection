import { useCallback, useEffect, useRef, useState } from 'react'
import { MotionDetector, type Box } from './motion'
import {
  computeRegion,
  detectObjects,
  loadModel,
  type Category,
  type Detection,
  type ModelVariant,
} from './detector'
import { ObjectTracker, type Track } from './tracker'

export type Settings = {
  /** 1–100, mapped to Frigate's pixel threshold (higher = more sensitive). */
  sensitivity: number
  /** Minimum motion region size, % of frame ×100. */
  minArea: number
  detectPeople: boolean
  detectCars: boolean
  /** Median confidence needed to confirm an object (0–1). */
  confidence: number
  sound: boolean
  vibrate: boolean
  showMask: boolean
  recordMotion: boolean
  model: ModelVariant
}

export const DEFAULT_SETTINGS: Settings = {
  sensitivity: 60,
  minArea: 4,
  detectPeople: true,
  detectCars: true,
  confidence: 0.6,
  sound: true,
  vibrate: true,
  showMask: false,
  recordMotion: true,
  model: 'lite_mobilenet_v2',
}

export type EventKind = Category | 'motion'

export type SentinelEvent = {
  id: string
  kind: EventKind
  label: string
  score: number
  time: number
  snapshot: string
  trackId?: number
}

export type Status =
  | 'idle'
  | 'starting'
  | 'loading-model'
  | 'running'
  | 'error'

export type Stats = {
  fps: number
  detectMs: number
  motion: number
  calibrating: boolean
  people: number
  cars: number
  motionActive: boolean
}

const MOTION_INTERVAL = 90
const DETECT_INTERVAL = 220
const MOTION_EVENT_COOLDOWN = 15000
const MAX_EVENTS = 120

const COLORS: Record<EventKind, string> = {
  person: '#b6ff3b',
  car: '#38d9ff',
  motion: '#ffb02e',
}

export const KIND_COLORS = COLORS

export function useSentinel(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  overlayRef: React.RefObject<HTMLCanvasElement | null>,
  settings: Settings,
) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<SentinelEvent[]>([])
  const [armed, setArmed] = useState(true)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [stats, setStats] = useState<Stats>({
    fps: 0,
    detectMs: 0,
    motion: 0,
    calibrating: false,
    people: 0,
    cars: 0,
    motionActive: false,
  })

  const settingsRef = useRef(settings)
  const armedRef = useRef(armed)
  useEffect(() => {
    settingsRef.current = settings
    armedRef.current = armed
  }, [settings, armed])

  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const motionRef = useRef(new MotionDetector())
  const trackerRef = useRef(new ObjectTracker())
  const audioRef = useRef<AudioContext | null>(null)
  const wakeRef = useRef<WakeLockSentinel | null>(null)

  // apply settings to detector/tracker live
  useEffect(() => {
    motionRef.current.update({
      // sensitivity 1..100 → threshold 60..8
      threshold: Math.round(60 - (settings.sensitivity / 100) * 52),
      contourArea: Math.max(
        4,
        Math.round(
          (settings.minArea / 1000) * motionRef.current.config.frameHeight ** 2,
        ),
      ),
    })
    trackerRef.current.config.threshold = settings.confidence
  }, [settings.sensitivity, settings.minArea, settings.confidence])

  const beep = useCallback((kind: EventKind) => {
    const ctx = audioRef.current
    if (!ctx) return
    const now = ctx.currentTime
    const tones = kind === 'person' ? [880, 1320] : kind === 'car' ? [660, 990] : [520]
    tones.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'square'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, now + i * 0.16)
      g.gain.exponentialRampToValueAtTime(0.18, now + i * 0.16 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.14)
      o.connect(g).connect(ctx.destination)
      o.start(now + i * 0.16)
      o.stop(now + i * 0.16 + 0.15)
    })
  }, [])

  const snapshot = useCallback(
    (box: Box | null, kind: EventKind, caption: string) => {
      const video = videoRef.current
      if (!video || !video.videoWidth) return ''
      const w = 480
      const h = Math.round((video.videoHeight / video.videoWidth) * w)
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')!
      ctx.drawImage(video, 0, 0, w, h)
      const s = w / video.videoWidth
      if (box) {
        ctx.strokeStyle = COLORS[kind]
        ctx.lineWidth = 3
        ctx.strokeRect(box.x * s, box.y * s, box.w * s, box.h * s)
      }
      ctx.fillStyle = 'rgba(0,0,0,.6)'
      ctx.fillRect(0, h - 22, w, 22)
      ctx.fillStyle = '#fff'
      ctx.font = '12px monospace'
      ctx.fillText(
        `${new Date().toLocaleString('ro-RO')}  ·  ${caption}`,
        8,
        h - 7,
      )
      return c.toDataURL('image/jpeg', 0.78)
    },
    [videoRef],
  )

  const pushEvent = useCallback(
    (e: Omit<SentinelEvent, 'id' | 'time'>) => {
      setEvents((prev) =>
        [
          { ...e, id: crypto.randomUUID(), time: Date.now() },
          ...prev,
        ].slice(0, MAX_EVENTS),
      )
      if (!armedRef.current) return
      const s = settingsRef.current
      if (s.sound) beep(e.kind)
      if (s.vibrate && 'vibrate' in navigator)
        navigator.vibrate(e.kind === 'motion' ? 120 : [180, 80, 180])
    },
    [beep],
  )

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
    trackerRef.current.clear()
    motionRef.current.reset()
    const o = overlayRef.current
    o?.getContext('2d')?.clearRect(0, 0, o.width, o.height)
    setStatus('idle')
  }, [overlayRef])

  const start = useCallback(
    async (facingMode: 'environment' | 'user' = facing) => {
      setError(null)
      setStatus('starting')
      try {
        if (!audioRef.current) {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext
          if (AC) audioRef.current = new AC()
        }
        audioRef.current?.resume().catch(() => {})
        streamRef.current?.getTracks().forEach((t) => t.stop())
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        setFacing(facingMode)
        try {
          wakeRef.current = (await navigator.wakeLock?.request('screen')) ?? null
        } catch {
          /* wake lock is optional */
        }
        setStatus('loading-model')
        const model = await loadModel(settingsRef.current.model)
        setStatus('running')
        runLoop(model)
      } catch (err) {
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Accesul la cameră a fost refuzat. Permite camera din setările browserului.'
            : err instanceof Error
              ? err.message
              : 'Nu am putut porni camera.'
        setError(msg)
        setStatus('error')
        streamRef.current?.getTracks().forEach((t) => t.stop())
      }
    },
    // runLoop is stable via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [facing, videoRef],
  )

  function runLoop(model: Awaited<ReturnType<typeof loadModel>>) {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    let lastMotion = 0
    let lastDetect = 0
    let detecting = false
    let lastMotionEvent = 0
    let frames = 0
    let fpsT = performance.now()
    let fps = 0
    let detectMs = 0
    let motionBoxes: Box[] = []
    let mask: { data: Uint8Array; w: number; h: number } | null = null
    let motionScore = 0
    let calibrating = false
    let lastStats = 0
    let motionHold = 0

    const tick = (t: number) => {
      rafRef.current = requestAnimationFrame(tick)
      const video = videoRef.current
      const overlay = overlayRef.current
      if (!video || !overlay || video.readyState < 2 || !video.videoWidth)
        return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (overlay.width !== vw || overlay.height !== vh) {
        overlay.width = vw
        overlay.height = vh
      }
      const s = settingsRef.current

      // --- motion stage ---
      if (t - lastMotion >= MOTION_INTERVAL) {
        lastMotion = t
        frames++
        const r = motionRef.current.detect(video, vw, vh)
        motionBoxes = r.boxes
        motionScore = r.score
        calibrating = r.calibrating
        mask = { data: r.mask, w: r.maskWidth, h: r.maskHeight }
        if (motionBoxes.length) motionHold = t
      }
      if (t - fpsT > 1000) {
        fps = (frames * 1000) / (t - fpsT)
        frames = 0
        fpsT = t
      }

      // --- object stage (only when there is motion or something tracked) ---
      const wanted: Category[] = []
      if (s.detectPeople) wanted.push('person')
      if (s.detectCars) wanted.push('car')
      if (!wanted.length && trackerRef.current.active.length)
        trackerRef.current.clear()
      const tracked = trackerRef.current.active
      const recentMotion = t - motionHold < 1500
      if (
        !detecting &&
        wanted.length &&
        t - lastDetect >= DETECT_INTERVAL &&
        (recentMotion || tracked.length)
      ) {
        detecting = true
        lastDetect = t
        const region = computeRegion(
          [...motionBoxes, ...tracked.map((tr) => tr.box)],
          vw,
          vh,
        )
        const t0 = performance.now()
        detectObjects(model, video, region, 0.35)
          .then((dets: Detection[]) => {
            detectMs = performance.now() - t0
            const filtered = dets.filter((d) => wanted.includes(d.category))
            const u = trackerRef.current.update(filtered)
            for (const tr of u.started) {
              const name = tr.category === 'person' ? 'Persoană' : labelRo(tr.label)
              pushEvent({
                kind: tr.category,
                label: name,
                score: Math.max(...tr.scores),
                trackId: tr.id,
                snapshot: snapshot(
                  tr.box,
                  tr.category,
                  `${name} ${Math.round(tr.topScore * 100)}%`,
                ),
              })
            }
          })
          .catch(() => {})
          .finally(() => {
            detecting = false
          })
      }

      // motion-only events (no confirmed object on screen)
      if (
        s.recordMotion &&
        motionBoxes.length &&
        !calibrating &&
        motionScore > 0.01 &&
        t - lastMotionEvent > MOTION_EVENT_COOLDOWN &&
        !trackerRef.current.active.some((tr) => tr.confirmed)
      ) {
        lastMotionEvent = t
        const big = motionBoxes.reduce((a, b) => (a.w * a.h > b.w * b.h ? a : b))
        pushEvent({
          kind: 'motion',
          label: 'Mișcare',
          score: motionScore,
          snapshot: snapshot(big, 'motion', `Mișcare ${(motionScore * 100).toFixed(1)}%`),
        })
      }

      draw(overlay, motionBoxes, trackerRef.current.active, s.showMask ? mask : null)

      if (t - lastStats > 250) {
        lastStats = t
        const act = trackerRef.current.active.filter(
          (tr) => tr.confirmed && tr.disappeared < 3,
        )
        setStats({
          fps,
          detectMs,
          motion: motionScore,
          calibrating,
          people: act.filter((a) => a.category === 'person').length,
          cars: act.filter((a) => a.category === 'car').length,
          motionActive: motionBoxes.length > 0,
        })
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const switchCamera = useCallback(() => {
    const next = facing === 'environment' ? 'user' : 'environment'
    motionRef.current.reset()
    trackerRef.current.clear()
    if (status === 'running' || status === 'loading-model') start(next)
    else setFacing(next)
  }, [facing, start, status])

  useEffect(() => () => stop(), [stop])

  // Re-acquire wake lock when returning to the tab
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState === 'visible' && streamRef.current) {
        try {
          wakeRef.current = (await navigator.wakeLock?.request('screen')) ?? null
        } catch {
          /* ignore */
        }
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  return {
    status,
    error,
    stats,
    events,
    armed,
    setArmed,
    facing,
    start,
    stop,
    switchCamera,
    clearEvents: () => setEvents([]),
    removeEvent: (id: string) =>
      setEvents((prev) => prev.filter((e) => e.id !== id)),
  }
}

export function labelRo(label: string) {
  switch (label) {
    case 'person':
      return 'Persoană'
    case 'car':
      return 'Mașină'
    case 'truck':
      return 'Camion'
    case 'bus':
      return 'Autobuz'
    case 'motorcycle':
      return 'Motocicletă'
    default:
      return label
  }
}

function draw(
  canvas: HTMLCanvasElement,
  motion: Box[],
  tracks: Track[],
  mask: { data: Uint8Array; w: number; h: number } | null,
) {
  const ctx = canvas.getContext('2d')!
  const { width: W, height: H } = canvas
  ctx.clearRect(0, 0, W, H)
  const lw = Math.max(2, W / 400)

  if (mask) {
    const sx = W / mask.w
    const sy = H / mask.h
    ctx.fillStyle = 'rgba(255,90,54,.35)'
    for (let y = 0; y < mask.h; y++)
      for (let x = 0; x < mask.w; x++)
        if (mask.data[y * mask.w + x])
          ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy))
  }

  ctx.setLineDash([lw * 3, lw * 2])
  ctx.lineWidth = lw
  ctx.strokeStyle = 'rgba(255,176,46,.85)'
  for (const b of motion) ctx.strokeRect(b.x, b.y, b.w, b.h)
  ctx.setLineDash([])

  const fs = Math.max(14, W / 50)
  ctx.font = `600 ${fs}px "JetBrains Mono", monospace`
  for (const tr of tracks) {
    if (tr.disappeared > 3) continue
    const col = COLORS[tr.category]
    const { x, y, w, h } = tr.box
    ctx.globalAlpha = tr.confirmed ? 1 : 0.45
    ctx.strokeStyle = col
    ctx.lineWidth = lw * 1.5
    // corner brackets
    const c = Math.min(w, h) * 0.22
    ctx.beginPath()
    ctx.moveTo(x, y + c)
    ctx.lineTo(x, y)
    ctx.lineTo(x + c, y)
    ctx.moveTo(x + w - c, y)
    ctx.lineTo(x + w, y)
    ctx.lineTo(x + w, y + c)
    ctx.moveTo(x + w, y + h - c)
    ctx.lineTo(x + w, y + h)
    ctx.lineTo(x + w - c, y + h)
    ctx.moveTo(x + c, y + h)
    ctx.lineTo(x, y + h)
    ctx.lineTo(x, y + h - c)
    ctx.stroke()
    ctx.lineWidth = lw * 0.5
    ctx.strokeRect(x, y, w, h)
    const text = `${labelRo(tr.label).toUpperCase()} ${Math.round(
      (tr.scores[tr.scores.length - 1] ?? 0) * 100,
    )}% #${tr.id}`
    const tw = ctx.measureText(text).width + fs * 0.6
    const ty = y > fs * 1.6 ? y - fs * 1.5 : y
    ctx.fillStyle = col
    ctx.fillRect(x, ty, tw, fs * 1.4)
    ctx.fillStyle = '#0b0f0c'
    ctx.fillText(text, x + fs * 0.3, ty + fs * 1.05)
    ctx.globalAlpha = 1
  }
}
