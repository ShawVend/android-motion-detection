# Santinela: motion detection with people and car recognition

Santinela turns an Android phone into a smart CCTV camera. It watches the phone camera, detects motion, and recognizes **people** and **vehicles** (car, truck, bus, motorcycle) in real time. Each event is saved with a snapshot, a time and a confidence score, and can trigger a sound or vibration alert.

It ships as an installable web app (PWA). On Android, open it in Chrome and choose **Add to Home screen**. It then opens full-screen like a native app and keeps the screen on while it monitors. All video analysis happens on the phone, and no frames are uploaded.

The interface is in Romanian.

## How detection works

The pipeline is adapted from the open-source NVR [Frigate](https://github.com/blakeblackshear/frigate) (MIT), ported from Python/OpenCV to TypeScript:

1. **Motion detection** (`src/lib/vision/motion.ts`): the frame is downscaled and converted to grayscale with contrast normalization. It is blurred and then compared with a running-average background. The difference is thresholded and dilated, and the result is grouped into connected regions. Sudden whole-frame changes (lights turning on, auto-exposure) reset the background.
2. **Region selection** (`computeRegion` in `src/lib/vision/detector.ts`): the motion boxes and the boxes of objects already being tracked are merged into one padded square region. The neural network only runs on that region, and only while something is moving or being tracked.
3. **Object detection**: TensorFlow.js [COCO-SSD](https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd) (MobileNet v2, Apache 2.0). It uses the same COCO labels as Frigate's default model.
4. **Tracking and false-positive filter** (`src/lib/vision/tracker.ts`): detections are matched to tracks by IoU and centroid distance. An alert only fires when the **median** of a track's recent scores passes the confidence threshold, as in Frigate's "true positive" logic.

## Tech stack

TanStack Start (React 19), Vite, Tailwind CSS 4, TensorFlow.js + COCO-SSD, deployed on Netlify.

## Run locally

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # unit tests for tracker / geometry helpers
```

Browsers only allow camera access over HTTPS or on `localhost`. To test on a phone, use the Netlify deploy URL.

## Possible next steps

- Detection zones / motion masks drawn on screen (the motion detector already accepts ignore boxes)
- Push notifications or remote viewing from a second device
- Optional cloud backup of event snapshots
- A native Android wrapper (Trusted Web Activity) for Play Store distribution
