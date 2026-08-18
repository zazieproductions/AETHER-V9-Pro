<div align="center">

# ▲ AETHER V9 Pro

**A cinematic paranormal EMF tracker — a fully client-side hardware instrument simulation built with React, TypeScript, and the Web Audio API.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](tsconfig.app.json)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](package.json)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](vite.config.ts)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[Overview](#overview) · [Features](#features) · [Architecture](#architecture) · [Getting Started](#getting-started) · [Configuration](#configuration--tuning) · [Development](#development) · [Roadmap](#roadmap)

</div>

---

> [!NOTE]
> AETHER V9 Pro is a **work of interactive fiction**. It does not measure anything real. It is an exercise in *diegetic interface design* — building a UI that behaves like a plausible piece of field hardware, complete with a POST boot sequence, sensor drift, calibration controls, and procedurally synthesized instrument audio. Every "reading" is produced by a deterministic simulation loop described below.

## Overview

AETHER V9 Pro renders the operator console of a fictional handheld ghost-hunting instrument: a magnetometer HUD, a rotating sweep radar, a multi-room sensor triangulation map, an EVP (Electronic Voice Phenomenon) recorder, an entity field guide, and a diagnostics panel — all driven by a single simulation engine and scored by a real-time Web Audio synthesizer.

### Why this exists

Most "fake device" UIs on the web are static mockups. This project explores what it takes to make a simulated instrument feel *credible*, and the engineering questions turn out to be genuinely interesting:

- **Believable signals are harder than random ones.** Raw `Math.random()` reads as noise. The EMF engine instead uses a bounded random walk with regime-dependent behavior — quiet drift near baseline, probabilistic spikes, and asymmetric decay — so the trace looks like a physical sensor settling rather than static.
- **Audio sells the illusion more than pixels do.** All sound is synthesized at runtime from oscillators and noise buffers via the Web Audio API. There are **zero audio assets** in the repository: the EMF hum, Geiger clicks, EVP static, alarms, boot sweeps, and the outbreak scream are all built from primitive nodes, with parameters (click rate, hum pitch, filter cutoff) modulated live by the simulated EMF level.
- **Sustained 60 fps matters.** High-frequency visuals (radar sweep, oscilloscope, EVP waveform) render to `<canvas>` inside `requestAnimationFrame` loops, while React state is reserved for low-frequency data (readings, logs, tabs). The two update domains are deliberately separated so the DOM diff never sits in the hot path.

The result is a compact case study in simulation-driven UI, procedural audio, and canvas/React interop — packaged as something you can hand to a friend in a dark room.

## Features

| Module | Description |
| --- | --- |
| **System Boot** (`SystemBoot`) | Cinematic POST sequence with staged hardware-detection logs (magnetometer, Geiger–Müller tube, RF receiver), a progress gate, and an operator-triggered power-on that also unlocks the `AudioContext` (browsers require a user gesture). |
| **Live EMF Display** (`LiveEMFDisplay`) | Canvas oscilloscope of the milligauss trace, plus a derived X/Y/Z magnetic vector decomposition (components constrained so `√(x²+y²+z²)` matches the scalar reading), electric-field and RF readouts, and fluctuation-rate tracking. |
| **Radar Grid** (`RadarGrid`) | Rotating-sweep radar rendered with `requestAnimationFrame`; contact blips carry position, velocity, intensity, and age, spawn as a function of EMF level, and can be paused mid-scan. |
| **Anomaly Log** (`AnomalyLog`) | Severity-classified event feed (LOW / MEDIUM / HIGH / CRITICAL) generated from EMF spike detection, with severity filtering and a rolling haunt-probability estimate. |
| **Triangulation Map** (`TriangulationMap`) | Multi-room sensor network across three preset locations (asylum ward, residence, forest cabin); per-node EMF/temperature/motion readings with node inspection. |
| **EVP Recorder** (`EVPRecorder`) | Record → demodulate → playback workflow with a live canvas waveform, progress-gated "signal demodulation," and decoded spectral messages. |
| **Entity Database** (`EntityDatabase`) | Field guide of entity classes with danger ratings and per-entity EMF, thermal, and RF signature profiles plus countermeasures. |
| **Diagnostics & Device Specs** (`Diagnostics`, `DeviceSpecs`) | Sensor sensitivity calibration, ambient temperature control, self-test routine with audio feedback, fictional hardware/firmware spec sheet, and four selectable accent themes. |
| **Haunting Outbreak** | A scripted 15-second crisis event: violently fluctuating EMF, screen shake, glitch overlays with rotating warning text, a synthesized ring-modulated scream, and an ambient temperature crash — followed by a clean return to baseline. |
| **Procedural Audio** (`utils/audio.ts`) | Singleton `AudioController` synthesizing every sound from Web Audio primitives, with global volume/mute and graceful no-op degradation when the API is unavailable. |

## Architecture

The application is a single-page React app with **no backend, no network calls, and no runtime assets** beyond the bundle itself. State flows in one direction from a central simulation loop.

```
┌─────────────────────────────────────────────────────────────────┐
│  App.tsx — simulation engine (owner of all instrument state)    │
│                                                                 │
│  300 ms tick ──► EMF model ──► emfLevel, ambientTemp, events    │
│   • auto mode: bounded random walk + spike/decay regimes        │
│   • manual mode: operator slider + sensitivity-scaled noise     │
│   • outbreak mode: high-amplitude sinusoid + stochastic jitter  │
└───────────────┬───────────────────────────────┬─────────────────┘
                │ props (unidirectional)        │ setEMFLevel()
                ▼                               ▼
   ┌────────────────────────┐      ┌──────────────────────────────┐
   │  Presentation layer    │      │  AudioController (singleton) │
   │  RadarGrid ── canvas   │      │  55 Hz sawtooth hum ► LPF    │
   │  LiveEMFDisplay ── ″   │      │  noise buffer ► BPF (static) │
   │  EVPRecorder ── ″      │      │  Geiger clicks (EMF-scaled   │
   │  AnomalyLog, Map,      │      │  rate: ~2 s ► ~30 ms)        │
   │  FieldGuide, Diags     │      │  alarms · sweeps · scream    │
   └────────────────────────┘      └──────────────────────────────┘
```

### Design decisions

- **Single source of truth.** `App.tsx` owns every physical quantity (EMF, temperature, GPS drift, outbreak state) and pushes values down as props. Components derive their local visuals from those inputs; none of them mutates shared state upward. This keeps the simulation auditable in one file.
- **Two rendering domains.** React reconciles the structural UI (tabs, logs, readouts, ~300 ms cadence). Anything animating faster than that — sweep angle, waveform phase, blip motion — lives in `useRef`-held state inside `requestAnimationFrame` loops that draw directly to canvas. Animation frames never trigger reconciliation.
- **Audio as a service, not a component.** `AudioController` is a module-level singleton behind a small imperative API (`setEMFLevel`, `setEVPActive`, `playPowerUp`, `setVolume`, `setMute`, …). Components fire intents; the controller owns the audio graph, envelope scheduling, and teardown. Initialization is deferred to the first user gesture to satisfy browser autoplay policy, and every synthesis path is wrapped so audio failure can never take down the UI.
- **Strictness by default.** The codebase compiles under `strict: true` with `noFallthroughCasesInSwitch`, and lints under the flat ESLint config with `typescript-eslint`, `react-hooks`, and `react-refresh` rules. Every component has an explicit typed props interface; domain records (`LogEntry`, `SensorNode`, `RadarBlip`, `Entity`) are modeled as named interfaces rather than anonymous shapes.
- **Zero-asset discipline.** All imagery is CSS (the CRT scanline overlay is two layered gradients), all audio is synthesized, and icons come from `lucide-react`. The production build is just code.

## Project Structure

```
AETHER-V9-Pro/
├── index.html                     # Entry document
├── src/
│   ├── main.tsx                   # React 19 root (StrictMode)
│   ├── App.tsx                    # Simulation engine, layout, tab router, outbreak logic
│   ├── components/
│   │   ├── SystemBoot.tsx         # POST sequence & power-on gate
│   │   ├── LiveEMFDisplay.tsx     # Oscilloscope + vector decomposition (canvas)
│   │   ├── RadarGrid.tsx          # Sweep radar & contact tracking (canvas)
│   │   ├── AnomalyLog.tsx         # Severity-classified event feed
│   │   ├── TriangulationMap.tsx   # Multi-room sensor network
│   │   ├── EVPRecorder.tsx        # Record/demodulate/playback workflow (canvas)
│   │   ├── EntityDatabase.tsx     # Entity field guide
│   │   ├── Diagnostics.tsx        # Calibration & self-test controls
│   │   └── DeviceSpecs.tsx        # Spec sheet & accent themes
│   ├── utils/
│   │   └── audio.ts               # Web Audio synthesizer (singleton service)
│   ├── index.css                  # Tailwind entry + global styles
│   └── App.css
├── eslint.config.js               # Flat config: TS + hooks + refresh rules
├── tsconfig.app.json              # strict, ES2022, bundler resolution
└── vite.config.ts                 # React + Tailwind plugins, env passthrough
```

## Getting Started

### Prerequisites

- **Node.js ≥ 20** (any runtime supported by Vite 7)
- npm (a `package-lock.json` is committed; use `npm ci` for reproducible installs)

### Installation

```bash
git clone https://github.com/zazieproductions/AETHER-V9-Pro.git
cd AETHER-V9-Pro
npm ci
npm run dev
```

Open the printed URL (default `http://localhost:5173`), press **IGNITE SYSTEM** once the POST completes, and put on headphones — the instrument is meant to be heard.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server with HMR. |
| `npm run build` | Type-check via project references (`tsc -b`), then produce a production bundle. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint across the repository. |

The build is a static bundle with no server-side requirements — the `dist/` output deploys to any static host (Vercel, Netlify, GitHub Pages, an S3 bucket).

## Configuration & Tuning

There is no runtime configuration file by design; the instrument is self-contained. Behavior is tuned through in-app controls and a small set of documented constants.

### In-app controls

| Control | Location | Effect |
| --- | --- | --- |
| Simulation mode (`auto` / `manual`) | Dashboard sidebar | Auto runs the random-walk model; manual hands the EMF baseline to a slider. |
| Sensitivity (1–20) | Diagnostics | Scales injected sensor noise in manual mode. |
| Ambient temperature | Diagnostics | Adjusts the thermal readout (crashed automatically during outbreaks). |
| Accent theme | Device Specs | Ecto-Green, Phantom-Blue, Poltergeist-Red, or Aether-Violet; propagates to every module. |
| Volume / mute | Header | Master gain on the audio service; mute also suspends the Geiger loop. |

### Simulation constants (in `App.tsx`)

| Constant | Value | Rationale |
| --- | --- | --- |
| Engine tick | `300 ms` | Fast enough for a live-feeling trace; slow enough that React reconciliation stays trivial. |
| Baseline band | `0.4–1.5 mG` | Fictional "background radiation" regime. |
| Spike probability | `3 %` / tick (quiet), `10 %` (elevated) | Produces irregular, non-periodic events. |
| Reading clamp | `0.2–95 mG` | Keeps the trace inside instrument range. |
| Outbreak duration | `15 s` | Long enough to escalate, short enough not to overstay. |
| Geiger click interval | `~2 s → ~30 ms` | Mapped from EMF level, capped at 50 mG, with ±20 % jitter so the crackle never sounds mechanical. |

## Development

### Code quality

- **TypeScript strict mode** across the app (`tsconfig.app.json`), with separate project references for app and tooling configs; `npm run build` fails on type errors before bundling.
- **ESLint 9 flat config** combining `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks` (exhaustive-deps enforcement matters here — nearly every component owns intervals or animation loops), and `eslint-plugin-react-refresh`.
- **Lifecycle hygiene.** Every `setInterval`, `setTimeout`, `requestAnimationFrame`, and audio node created in an effect is torn down in that effect's cleanup. If you add a loop, add its cleanup in the same commit.

### Conventions for contributors

- One component per file, named export, explicit `Props` interface.
- Physical quantities stay in `App.tsx`; purely visual state stays local to the component that renders it.
- Canvas hot paths must not call React setters per frame — accumulate in refs, commit to state at coarse intervals if the DOM needs the value.
- New sounds belong in `AudioController` behind a semantic method (`playX`, `setY`), never as ad-hoc `AudioContext` usage inside components.
- Keep the zero-asset rule: no bundled audio files or images without prior discussion.

## Roadmap

Planned work, roughly in priority order. Items here are aspirations, not shipped features.

- [ ] Extract the EMF model from `App.tsx` into a pure, seedable module (`createEmfEngine(seed)`) so traces are reproducible and unit-testable.
- [ ] Add Vitest coverage for the simulation regimes (baseline walk bounds, spike/decay transitions, clamping) and the Geiger interval mapping.
- [ ] CI workflow: lint + typecheck + test + build on pull requests.
- [ ] Reduced-motion and audio-off accessibility mode (respect `prefers-reduced-motion`, replace shake/glitch with subdued cues).
- [ ] Persist operator settings (theme, volume, sensitivity) to `localStorage`.
- [ ] Scenario scripting — data-driven haunting timelines instead of the single hard-coded outbreak.
- [ ] PWA packaging for fullscreen "handheld device" installs.

## Contributing

Issues and pull requests are welcome. To keep review fast:

1. Open an issue describing the change before large PRs.
2. Run `npm run lint` and `npm run build` locally; both must pass.
3. Follow the conventions above — particularly effect cleanup and the React/canvas boundary.
4. Keep PRs focused; simulation-model changes and visual changes should ship separately.

## License

Released under the [MIT License](LICENSE).

---

<div align="center">
<sub>▲ AETHER V9 // No spectral entities were harmed in the making of this software. None were detected, either.</sub>
</div>
