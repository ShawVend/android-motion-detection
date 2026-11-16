import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BellRing,
  Camera,
  Car,
  Cpu,
  Download,
  Footprints,
  Code,
  ScanEye,
  ShieldCheck,
  Smartphone,
  AudioWaveform,
} from 'lucide-react'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-content items-center justify-between px-5 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" className="size-8" />
            <span className="font-display text-lg font-bold tracking-tight">
              Santinela
            </span>
          </Link>
          <Link
            to="/monitor"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            <Camera className="size-4" /> Deschide camera
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="grid-bg relative overflow-hidden border-b border-border/60">
        <div className="mx-auto grid max-w-content items-center gap-12 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-xs uppercase tracking-widest text-primary">
              <span className="size-1.5 animate-rec rounded-full bg-accent" />
              Supraveghere pe dispozitiv
            </p>
            <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight md:text-7xl">
              Telefonul tău Android,
              <br />
              <span className="text-primary">cameră CCTV</span> inteligentă.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              Santinela detectează mișcarea prin camera telefonului și
              recunoaște <strong className="text-foreground">oameni</strong> și{' '}
              <strong className="text-foreground">mașini</strong> în timp
              real. Totul rulează local, în telefon. Imaginile nu pleacă
              nicăieri.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                to="/monitor"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-semibold text-primary-foreground transition hover:brightness-110"
              >
                Pornește monitorizarea
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#instalare"
                className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3.5 font-semibold transition hover:bg-secondary"
              >
                <Download className="size-4" /> Instalează pe Android
              </a>
            </div>
          </div>
          <HeroViewfinder />
        </div>
      </section>

      {/* PIPELINE */}
      <section className="mx-auto max-w-content px-5 py-20">
        <p className="font-mono text-xs uppercase tracking-widest text-primary">
          Cum funcționează
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">
          Același flux ca la un NVR profesionist, adaptat pentru telefon.
        </h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
          {[
            {
              n: '01',
              icon: AudioWaveform,
              t: 'Detecție de mișcare',
              d: 'Cadrul e micșorat, transformat în tonuri de gri și comparat cu un fundal mediu care se adaptează în timp. Schimbările bruște de lumină sunt ignorate automat.',
            },
            {
              n: '02',
              icon: ScanEye,
              t: 'Regiuni de interes',
              d: 'Zonele în mișcare sunt grupate într-o regiune pătrată. Rețeaua neuronală analizează doar acea zonă, deci merge rapid și pe telefoane modeste.',
            },
            {
              n: '03',
              icon: Cpu,
              t: 'Oameni și mașini',
              d: 'Modelul COCO-SSD (MobileNet v2) clasifică ce se mișcă: persoană, mașină, camion, autobuz sau motocicletă.',
            },
            {
              n: '04',
              icon: BellRing,
              t: 'Urmărire și alertă',
              d: 'Fiecare obiect e urmărit între cadre. Alerta pornește doar când media scorurilor trece pragul, deci alarmele false sunt rare.',
            },
          ].map((s) => (
            <div key={s.n} className="bg-card p-6">
              <div className="flex items-center justify-between">
                <s.icon className="size-6 text-primary" />
                <span className="font-mono text-xs text-muted-foreground">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-6 font-display text-lg font-bold">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-y border-border/60 bg-card/40">
        <div className="mx-auto grid max-w-content gap-10 px-5 py-20 md:grid-cols-3">
          <Feature
            icon={Footprints}
            title="Detecție persoane"
            text="Afișează fiecare persoană cu un cadru și un ID de urmărire, salvează o captură și emite un semnal sonor."
          />
          <Feature
            icon={Car}
            title="Detecție vehicule"
            text="Mașini, camioane, autobuze și motociclete, grupate ca „vehicul”. Poți porni sau opri separat fiecare tip."
          />
          <Feature
            icon={ShieldCheck}
            title="Privat din start"
            text="Fără cont și fără cloud. Analiza video rulează în telefon cu TensorFlow.js, iar capturile rămân pe dispozitiv."
          />
        </div>
      </section>

      {/* INSTALL */}
      <section
        id="instalare"
        className="mx-auto grid max-w-content gap-12 px-5 py-20 md:grid-cols-2"
      >
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-primary">
            Instalare
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight md:text-4xl">
            Aplicație pe ecranul principal, în 10 secunde.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Santinela se instalează ca aplicație web (PWA). Se deschide pe tot
            ecranul, ca o aplicație nativă, și ține ecranul aprins cât timp
            monitorizează.
          </p>
        </div>
        <ol className="space-y-4">
          {[
            'Deschide această pagină în Chrome pe telefonul Android.',
            'Apasă meniul ⋮ și alege „Adaugă pe ecranul de pornire” / „Instalează aplicația”.',
            'Pornește Santinela din ecranul principal și permite accesul la cameră.',
            'Fixează telefonul (pe un suport, cu încărcătorul conectat) și apasă „Pornește”.',
          ].map((step, i) => (
            <li
              key={i}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary font-mono text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-1">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* CREDITS */}
      <section className="border-t border-border/60">
        <div className="mx-auto max-w-content px-5 py-14">
          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <Code className="mt-1 size-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-display font-bold">
                  Construită pe cod open-source
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  Algoritmul de mișcare, selecția regiunilor și filtrul de
                  alarme false sunt adaptate după{' '}
                  <a
                    className="text-foreground underline underline-offset-4"
                    href="https://github.com/blakeblackshear/frigate"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Frigate NVR
                  </a>{' '}
                  (MIT). Detecția de obiecte folosește{' '}
                  <a
                    className="text-foreground underline underline-offset-4"
                    href="https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd"
                    target="_blank"
                    rel="noreferrer"
                  >
                    TensorFlow.js COCO-SSD
                  </a>{' '}
                  (Apache 2.0).
                </p>
              </div>
            </div>
            <Link
              to="/monitor"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-foreground"
            >
              <Smartphone className="size-4" /> Încearcă acum
            </Link>
          </div>
          <p className="mt-8 text-center font-mono text-xs text-muted-foreground">
            Santinela · detecție mișcare, oameni și vehicule
          </p>
        </div>
      </section>
    </div>
  )
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  text: string
}) {
  return (
    <div>
      <div className="grid size-11 place-items-center rounded-xl border border-primary/30 bg-primary/10">
        <Icon className="size-5 text-primary" />
      </div>
      <h3 className="mt-5 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{text}</p>
    </div>
  )
}

function HeroViewfinder() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[2rem] border-[10px] border-[#1b211c] bg-[#0d130f] shadow-2xl shadow-primary/10">
        {/* stylised night scene */}
        <svg
          viewBox="0 0 300 400"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#16201a" />
              <stop offset="1" stopColor="#0b100d" />
            </linearGradient>
            <radialGradient id="lamp" cx=".5" cy="0" r="1">
              <stop offset="0" stopColor="#d9ffb0" stopOpacity=".25" />
              <stop offset="1" stopColor="#d9ffb0" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="300" height="400" fill="url(#sky)" />
          <rect x="0" y="120" width="70" height="150" fill="#111813" />
          <rect x="230" y="90" width="70" height="180" fill="#111813" />
          <rect x="12" y="140" width="12" height="16" fill="#2a3a20" />
          <rect x="40" y="170" width="12" height="16" fill="#3d5a22" />
          <rect x="250" y="120" width="12" height="16" fill="#2a3a20" />
          <path d="M0 270 L300 270 L300 400 L0 400Z" fill="#141b16" />
          <path d="M120 270 L180 270 L300 400 L0 400Z" fill="#18201a" />
          <path
            d="M148 290 L152 290 L156 320 L144 320Z M145 340 L155 340 L160 380 L140 380Z"
            fill="#2a3a20"
          />
          <rect x="196" y="40" width="4" height="230" fill="#1f2a21" />
          <ellipse cx="198" cy="60" rx="90" ry="160" fill="url(#lamp)" />
          {/* car */}
          <g transform="translate(168 262)">
            <rect x="0" y="16" width="112" height="30" rx="8" fill="#26332a" />
            <path d="M18 18 L36 0 L80 0 L98 18Z" fill="#1f2a22" />
            <circle cx="24" cy="46" r="10" fill="#0b0f0c" />
            <circle cx="88" cy="46" r="10" fill="#0b0f0c" />
            <rect x="104" y="24" width="8" height="6" fill="#ffe9a8" />
          </g>
          {/* person */}
          <g transform="translate(70 196)" fill="#2f3f33">
            <circle cx="20" cy="10" r="10" />
            <path d="M6 24 Q20 18 34 24 L36 74 L4 74Z" />
            <rect x="8" y="72" width="9" height="44" />
            <rect x="23" y="72" width="9" height="44" />
          </g>
        </svg>

        <div className="scanlines absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-1/3 animate-sweep bg-gradient-to-b from-transparent via-primary/10 to-transparent" />

        {/* detection boxes */}
        <DetBox
          className="left-[21%] top-[47%] h-[31%] w-[17%]"
          color="#b6ff3b"
          label="PERSOANĂ 91% #3"
        />
        <DetBox
          className="left-[55%] top-[64%] h-[17%] w-[39%]"
          color="#38d9ff"
          label="MAȘINĂ 84% #7"
        />
        <div className="absolute left-[16%] top-[44%] h-[38%] w-[28%] rounded-sm border-2 border-dashed border-[#ffb02e]/70" />

        {/* HUD */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 font-mono text-[10px] text-white/80">
          <span className="flex items-center gap-1.5 rounded bg-black/50 px-2 py-1">
            <span className="size-1.5 animate-rec rounded-full bg-accent" /> REC
            · CAM 01
          </span>
          <span className="rounded bg-black/50 px-2 py-1">22:41:07</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex gap-2 p-3 font-mono text-[10px]">
          <span className="rounded bg-primary px-2 py-1 font-bold text-primary-foreground">
            1 PERSOANĂ
          </span>
          <span className="rounded bg-[#38d9ff] px-2 py-1 font-bold text-[#0b0f0c]">
            1 VEHICUL
          </span>
          <span className="ml-auto rounded bg-black/50 px-2 py-1 text-white/80">
            MIȘCARE 3.4%
          </span>
        </div>
      </div>
    </div>
  )
}

function DetBox({
  className,
  color,
  label,
}: {
  className: string
  color: string
  label: string
}) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ boxShadow: `inset 0 0 0 1px ${color}80` }}
    >
      {['left-0 top-0 border-l-2 border-t-2', 'right-0 top-0 border-r-2 border-t-2', 'bottom-0 left-0 border-b-2 border-l-2', 'bottom-0 right-0 border-b-2 border-r-2'].map(
        (c) => (
          <span
            key={c}
            className={`absolute size-3 ${c}`}
            style={{ borderColor: color }}
          />
        ),
      )}
      <span
        className="absolute -top-5 left-0 whitespace-nowrap px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#0b0f0c]"
        style={{ background: color }}
      >
        {label}
      </span>
    </div>
  )
}
