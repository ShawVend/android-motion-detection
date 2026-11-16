import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  ArrowLeft,
  Camera,
  Car,
  Download,
  Footprints,
  LoaderCircle,
  Play,
  Settings2,
  Shield,
  ShieldOff,
  Square,
  SwitchCamera,
  Trash,
  X,
} from 'lucide-react'
import {
  DEFAULT_SETTINGS,
  KIND_COLORS,
  useSentinel,
  type EventKind,
  type SentinelEvent,
  type Settings,
} from '@/lib/vision/useSentinel'
import { Switch } from '@/components/ui/switch'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/monitor')({
  head: () => ({ meta: [{ title: 'Monitorizare · Santinela' }] }),
  component: Monitor,
})

const SETTINGS_KEY = 'santinela.settings.v1'

function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
    } catch {
      /* ignore */
    }
  }, [])
  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  return [settings, update] as const
}

type Filter = 'all' | EventKind

function Monitor() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [settings, update] = useSettings()
  const s = useSentinel(videoRef, overlayRef, settings)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [open, setOpen] = useState<SentinelEvent | null>(null)
  const clock = useClock()

  const counts = useMemo(() => {
    const c = { person: 0, car: 0, motion: 0 }
    for (const e of s.events) c[e.kind]++
    return c
  }, [s.events])
  const shown =
    filter === 'all' ? s.events : s.events.filter((e) => e.kind === filter)

  const running = s.status === 'running'
  const busy = s.status === 'starting' || s.status === 'loading-model'

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:flex-row">
      {/* CAMERA COLUMN */}
      <div className="flex flex-col lg:min-w-0 lg:flex-1">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            <img src="/icon.svg" alt="" className="size-6" />
            <span className="font-display font-bold text-foreground">
              Santinela
            </span>
          </Link>
          <button
            onClick={() => setSettingsOpen(true)}
            className="grid size-10 place-items-center rounded-full border border-border hover:bg-secondary"
            aria-label="Setări"
          >
            <Settings2 className="size-5" />
          </button>
        </div>

        <div className="relative mx-auto w-full flex-1 bg-black lg:min-h-0">
          <div className="relative aspect-[3/4] w-full sm:aspect-video lg:absolute lg:inset-0 lg:aspect-auto">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 h-full w-full object-contain"
            />
            <canvas
              ref={overlayRef}
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
            <div className="scanlines pointer-events-none absolute inset-0" />

            {/* HUD top */}
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 font-mono text-[11px] text-white">
              <div className="flex flex-col gap-1.5">
                <span
                  className={cn(
                    'flex items-center gap-1.5 rounded bg-black/60 px-2 py-1',
                  )}
                >
                  <span
                    className={cn(
                      'size-2 rounded-full',
                      running ? 'animate-rec bg-accent' : 'bg-white/40',
                    )}
                  />
                  {running ? 'LIVE' : busy ? 'PORNIRE…' : 'OPRIT'} · CAM{' '}
                  {s.facing === 'environment' ? 'SPATE' : 'FAȚĂ'}
                </span>
                {running && (
                  <span
                    className={cn(
                      'flex items-center gap-1.5 rounded px-2 py-1',
                      s.armed
                        ? 'bg-primary/90 text-primary-foreground'
                        : 'bg-black/60',
                    )}
                  >
                    {s.armed ? (
                      <Shield className="size-3" />
                    ) : (
                      <ShieldOff className="size-3" />
                    )}
                    {s.armed ? 'ARMAT' : 'DEZARMAT'}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="rounded bg-black/60 px-2 py-1">{clock}</span>
                {running && (
                  <span className="rounded bg-black/60 px-2 py-1 text-white/70">
                    {s.stats.fps.toFixed(0)} FPS · AI{' '}
                    {s.stats.detectMs.toFixed(0)}ms
                  </span>
                )}
              </div>
            </div>

            {/* HUD bottom */}
            {running && (
              <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end gap-2 p-3 font-mono text-[11px]">
                <LiveChip
                  active={s.stats.people > 0}
                  color={KIND_COLORS.person}
                  icon={<Footprints className="size-3" />}
                  text={`${s.stats.people} ${s.stats.people === 1 ? 'PERSOANĂ' : 'PERSOANE'}`}
                />
                <LiveChip
                  active={s.stats.cars > 0}
                  color={KIND_COLORS.car}
                  icon={<Car className="size-3" />}
                  text={`${s.stats.cars} ${s.stats.cars === 1 ? 'VEHICUL' : 'VEHICULE'}`}
                />
                <div className="ml-auto flex min-w-28 flex-col gap-1 rounded bg-black/60 px-2 py-1 text-white">
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1">
                      <Activity className="size-3" />
                      {s.stats.calibrating ? 'CALIBRARE' : 'MIȘCARE'}
                    </span>
                    <span>{(s.stats.motion * 100).toFixed(1)}%</span>
                  </span>
                  <span className="h-1 overflow-hidden rounded bg-white/15">
                    <span
                      className="block h-full bg-[#ffb02e] transition-[width]"
                      style={{
                        width: `${Math.min(100, s.stats.motion * 400)}%`,
                      }}
                    />
                  </span>
                </div>
              </div>
            )}

            {/* idle / error state */}
            {!running && (
              <div className="grid-bg absolute inset-0 grid place-items-center p-6 text-center">
                <div className="max-w-xs">
                  {busy ? (
                    <>
                      <LoaderCircle className="mx-auto size-10 animate-spin text-primary" />
                      <p className="mt-4 font-display text-lg font-bold">
                        {s.status === 'starting'
                          ? 'Pornesc camera…'
                          : 'Încarc modelul AI…'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.status === 'loading-model'
                          ? 'Prima pornire descarcă ~5–15 MB. Apoi modelul rămâne în cache.'
                          : 'Permite accesul la cameră dacă ți se cere.'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto grid size-16 place-items-center rounded-full border border-primary/40 bg-primary/10">
                        <Camera className="size-7 text-primary" />
                      </div>
                      <p className="mt-4 font-display text-xl font-bold">
                        {s.status === 'error'
                          ? 'Camera nu a pornit'
                          : 'Gata de supraveghere'}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {s.error ??
                          'Fixează telefonul cu vedere spre zona urmărită, apoi apasă Pornește.'}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center justify-center gap-3 border-b border-border px-4 py-4 lg:border-b-0">
          <RoundButton
            label="Schimbă camera"
            onClick={s.switchCamera}
            disabled={busy}
          >
            <SwitchCamera className="size-5" />
          </RoundButton>
          {running || busy ? (
            <button
              onClick={s.stop}
              className="inline-flex h-14 min-w-40 items-center justify-center gap-2 rounded-full bg-destructive px-6 font-semibold text-destructive-foreground transition hover:brightness-110"
            >
              <Square className="size-4 fill-current" /> Oprește
            </button>
          ) : (
            <button
              onClick={() => s.start()}
              className="inline-flex h-14 min-w-40 items-center justify-center gap-2 rounded-full bg-primary px-6 font-semibold text-primary-foreground transition hover:brightness-110"
            >
              <Play className="size-4 fill-current" /> Pornește
            </button>
          )}
          <RoundButton
            label={s.armed ? 'Dezarmează alertele' : 'Armează alertele'}
            onClick={() => s.setArmed(!s.armed)}
            active={s.armed}
          >
            {s.armed ? (
              <Shield className="size-5" />
            ) : (
              <ShieldOff className="size-5" />
            )}
          </RoundButton>
        </div>
      </div>

      {/* EVENTS COLUMN */}
      <aside className="flex flex-col lg:w-[380px] lg:border-l lg:border-border">
        <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
          <Stat
            label="Persoane"
            value={counts.person}
            color={KIND_COLORS.person}
          />
          <Stat label="Vehicule" value={counts.car} color={KIND_COLORS.car} />
          <Stat
            label="Mișcare"
            value={counts.motion}
            color={KIND_COLORS.motion}
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-3">
          {(
            [
              ['all', 'Toate'],
              ['person', 'Persoane'],
              ['car', 'Vehicule'],
              ['motion', 'Mișcare'],
            ] as [Filter, string][]
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                'whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition',
                filter === k
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {l}
            </button>
          ))}
          {s.events.length > 0 && (
            <button
              onClick={s.clearEvents}
              className="ml-auto inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash className="size-3.5" /> Șterge
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-8 lg:pb-4">
          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {running
                ? 'Niciun eveniment încă. Evenimentele apar aici cu captură și oră.'
                : 'Pornește monitorizarea ca să înregistrezi evenimente.'}
            </div>
          ) : (
            <ul className="space-y-2">
              {shown.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => setOpen(e)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2 text-left transition hover:border-primary/50"
                  >
                    {e.snapshot ? (
                      <img
                        src={e.snapshot}
                        alt=""
                        className="h-14 w-20 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-14 w-20 shrink-0 rounded-md bg-muted" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: KIND_COLORS[e.kind] }}
                        />
                        <span className="font-semibold">{e.label}</span>
                        {e.trackId && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            #{e.trackId}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {new Date(e.time).toLocaleTimeString('ro-RO')} ·{' '}
                        {e.kind === 'motion'
                          ? `${(e.score * 100).toFixed(1)}% cadru`
                          : `${Math.round(e.score * 100)}% încredere`}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Capturile rămân doar pe acest dispozitiv, până închizi pagina.
          </p>
        </div>
      </aside>

      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        update={update}
      />

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden" showCloseButton={false}>
          {open && (
            <>
              <img src={open.snapshot} alt={open.label} className="w-full" />
              <div className="flex items-center justify-between gap-3 p-4">
                <div>
                  <DialogTitle className="font-display">{open.label}</DialogTitle>
                  <DialogDescription className="font-mono text-xs">
                    {new Date(open.time).toLocaleString('ro-RO')}
                  </DialogDescription>
                </div>
                <div className="flex gap-2">
                  <a
                    href={open.snapshot}
                    download={`santinela-${open.kind}-${open.time}.jpg`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                  >
                    <Download className="size-4" /> Salvează
                  </a>
                  <button
                    onClick={() => {
                      s.removeEvent(open.id)
                      setOpen(null)
                    }}
                    className="grid size-9 place-items-center rounded-full border border-border hover:text-destructive"
                    aria-label="Șterge evenimentul"
                  >
                    <Trash className="size-4" />
                  </button>
                  <button
                    onClick={() => setOpen(null)}
                    className="grid size-9 place-items-center rounded-full border border-border"
                    aria-label="Închide"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function useClock() {
  const [now, setNow] = useState('')
  useEffect(() => {
    const f = () => setNow(new Date().toLocaleTimeString('ro-RO'))
    f()
    const id = setInterval(f, 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function LiveChip({
  active,
  color,
  icon,
  text,
}: {
  active: boolean
  color: string
  icon: React.ReactNode
  text: string
}) {
  return (
    <span
      className="flex items-center gap-1.5 rounded px-2 py-1 font-bold transition"
      style={
        active
          ? { background: color, color: '#0b0f0c' }
          : { background: 'rgba(0,0,0,.6)', color: 'rgba(255,255,255,.7)' }
      }
    >
      {icon}
      {text}
    </span>
  )
}

function Stat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="size-1.5 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold">{value}</div>
    </div>
  )
}

function RoundButton({
  children,
  label,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid size-12 place-items-center rounded-full border transition disabled:opacity-40',
        active
          ? 'border-primary/60 bg-primary/15 text-primary'
          : 'border-border hover:bg-secondary',
      )}
    >
      {children}
    </button>
  )
}

function SettingsSheet({
  open,
  onOpenChange,
  settings,
  update,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  settings: Settings
  update: (p: Partial<Settings>) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-xl">Setări detecție</SheetTitle>
          <SheetDescription>
            Modificările se aplică imediat și se păstrează pe telefon.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-7 px-4 pb-10">
          <Group title="Mișcare">
            <Range
              label="Sensibilitate"
              hint="Cât de mică poate fi o schimbare de pixel ca să conteze."
              value={settings.sensitivity}
              min={1}
              max={100}
              format={(v) => `${v}`}
              onChange={(v) => update({ sensitivity: v })}
            />
            <Range
              label="Suprafață minimă"
              hint="Ignoră mișcările mai mici (frunze, insecte, zgomot)."
              value={settings.minArea}
              min={1}
              max={40}
              format={(v) => `${(v / 10).toFixed(1)}%`}
              onChange={(v) => update({ minArea: v })}
            />
            <Toggle
              label="Înregistrează mișcare simplă"
              hint="Captură și când nu e recunoscut niciun obiect (max. 1 la 15 s)."
              checked={settings.recordMotion}
              onChange={(v) => update({ recordMotion: v })}
            />
            <Toggle
              label="Afișează masca de mișcare"
              hint="Colorează pixelii detectați. Util la reglaje."
              checked={settings.showMask}
              onChange={(v) => update({ showMask: v })}
            />
          </Group>

          <Group title="Obiecte (AI)">
            <Toggle
              label="Detectează persoane"
              checked={settings.detectPeople}
              onChange={(v) => update({ detectPeople: v })}
            />
            <Toggle
              label="Detectează vehicule"
              hint="Mașini, camioane, autobuze, motociclete."
              checked={settings.detectCars}
              onChange={(v) => update({ detectCars: v })}
            />
            <Range
              label="Prag de încredere"
              hint="Media scorurilor necesară pentru alertă. Mai mare înseamnă mai puține alarme false."
              value={Math.round(settings.confidence * 100)}
              min={40}
              max={90}
              format={(v) => `${v}%`}
              onChange={(v) => update({ confidence: v / 100 })}
            />
            <div>
              <div className="mb-2 text-sm font-medium">Model</div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ['lite_mobilenet_v2', 'Rapid', 'Recomandat pe telefon'],
                    ['mobilenet_v2', 'Precis', 'Mai lent, mai exact'],
                  ] as const
                ).map(([k, t, d]) => (
                  <button
                    key={k}
                    onClick={() => update({ model: k })}
                    className={cn(
                      'rounded-xl border p-3 text-left transition',
                      settings.model === k
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-secondary',
                    )}
                  >
                    <div className="font-semibold">{t}</div>
                    <div className="text-xs text-muted-foreground">{d}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Schimbarea modelului se aplică la următoarea pornire.
              </p>
            </div>
          </Group>

          <Group title="Alerte">
            <Toggle
              label="Semnal sonor"
              checked={settings.sound}
              onChange={(v) => update({ sound: v })}
            />
            <Toggle
              label="Vibrație"
              checked={settings.vibrate}
              onChange={(v) => update({ vibrate: v })}
            />
          </Group>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-primary">
        {title}
      </h3>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </label>
  )
}

function Range({
  label,
  hint,
  value,
  min,
  max,
  format,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  format: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm text-primary">{format(value)}</span>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <input
        type="range"
        className="range mt-3 w-full"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
