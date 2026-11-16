# AGENTS.md

## Project overview

Santinela is a PWA that turns an Android phone into a CCTV camera. It does on-device motion detection plus person and vehicle detection. The UI is in Romanian. There is no backend: all processing runs in the browser, and events and snapshots live in React state (in memory) on purpose, for privacy. Only the user's settings are kept in `localStorage`.

## Architecture

```
src/
├── lib/vision/
│   ├── motion.ts        # Frigate-style motion detector (grayscale → blur → running-avg diff → threshold → dilate → connected boxes, lightning reset)
│   ├── detector.ts      # TF.js COCO-SSD loader (dynamic import, cached per model variant), region selection, label → category map
│   ├── tracker.ts       # IoU/centroid tracker, median-score confirmation (Frigate true-positive logic)
│   ├── tracker.test.ts  # unit tests for tracker + geometry
│   └── useSentinel.ts   # React hook: camera stream, rAF loop, motion/detect scheduling, events, alerts (WebAudio + vibrate), wake lock, overlay drawing
├── routes/
│   ├── __root.tsx       # HTML shell (lang="ro", dark theme, manifest, fonts)
│   ├── index.tsx        # landing page
│   └── monitor.tsx      # live camera screen, event list, settings sheet, snapshot dialog
public/manifest.webmanifest, public/icon.svg  # PWA install
```

## Conventions and non-obvious decisions

- **TensorFlow must stay client-only.** `@tensorflow/tfjs` and `coco-ssd` are only imported dynamically inside `loadModel()`, so SSR never loads them. Model weights download from Google's CDN on the first start.
- Motion runs every ~90 ms and object detection every ~220 ms at most, never overlapping. Detection only runs when there was motion in the last 1.5 s or something is being tracked.
- Settings flow into the running loop through refs (`settingsRef`, `armedRef`), so the camera never restarts when a setting changes. A model change applies on the next start.
- Colors: person `#b6ff3b` (lime, also the theme primary), vehicle `#38d9ff`, motion `#ffb02e`. Defined once in `KIND_COLORS`.
- Lucide v1 has no brand icons and some renamed ones (`LoaderCircle`, not `Loader2`).
- When porting more Frigate features (zones, masks, stationary objects), keep the comments that point to the Frigate source module.
