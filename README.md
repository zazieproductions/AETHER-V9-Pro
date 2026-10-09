<div align="center">

# ▲ AETHER V9 Pro

**A cinematic paranormal EMF tracker — a fully client-side instrument simulation built with React 19,
TypeScript, Canvas 2D, and the Web Audio API. No backend. No assets. Every reading synthesized, every
sound generated at runtime.**

[![CI](https://github.com/zazieproductions/AETHER-V9-Pro/actions/workflows/ci.yml/badge.svg)](https://github.com/zazieproductions/AETHER-V9-Pro/actions/workflows/ci.yml)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](tsconfig.app.json)
[![React 19.2](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](package.json)
[![Vite 7](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)](vite.config.ts)
[![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](src/index.css)
[![bundle ≈ 87 kB gzip](https://img.shields.io/badge/bundle-%E2%89%8887_kB_gzip-3C873A)](docs/performance.md#2-measured-bundle)
[![media 0 kB](https://img.shields.io/badge/media-0_kB-1F2937)](docs/decisions/0004-zero-runtime-assets.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Overview](#overview) · [Architecture](#architecture) · [Quick start](#quick-start) ·
[Documentation](#documentation) · [Engineering status](#engineering-status) · [Roadmap](#roadmap)

</div>

---

> [!NOTE]
> AETHER V9 Pro is a **work of interactive fiction**. It measures nothing real and requests no
> permissions — no microphone, no sensors, no network, no storage. It is an exercise in *diegetic
> interface design*: building a UI that behaves like a plausible piece of field hardware, complete
> with a POST boot sequence, sensor drift, calibration controls, and procedurally synthesized
> instrument audio. Every reading comes from the simulation model documented
> [here](docs/simulation-engine.md).

## Overview

The operator console of a fictional handheld ghost-hunting instrument: a magnetometer oscilloscope, a
rotating sweep radar, a multi-room sensor triangulation map, an EVP recorder, an entity field guide,
and a diagnostics bay — all driven by one simulation loop and scored by a real-time Web Audio
synthesizer.

### Why this exists

Most "fake device" UIs are static mockups. This project investigates what it takes to make a
simulated instrument feel *credible*, and the engineering turns out to be the interesting part.

- **Believable signals are harder than random ones.** Raw `Math.random()` reads as static. The EMF
  engine is a bounded random walk with regime-dependent behaviour — diffusive drift while quiet,
  impulsive spikes, asymmetric decay — so the trace settles like a physical sensor. The model is
  specified line by line in [Simulation Engine](docs/simulation-engine.md) and the reasoning is in
  [ADR-0005](docs/decisions/0005-procedural-signal-model.md).
- **Audio sells the illusion more than pixels do.** There are **zero audio assets** in this
  repository. The mains hum, Geiger crackle, radio static, alarm, boot sweep, and outbreak scream are
  all built from oscillators and one procedurally generated noise buffer, with pitch, filter cutoff,
  and click *rate* modulated live by the simulated field level
  ([Audio Synthesis](docs/audio-synthesis.md)).
- **Sustained 60 fps is an architectural property, not an optimization.** High-frequency visuals
  render to `<canvas>` inside `requestAnimationFrame` loops; React state is reserved for
  low-frequency data. The two update domains are deliberately separated so reconciliation never sits
  in the hot path ([ADR-0002](docs/decisions/0002-two-rendering-domains.md)) — including an honest
  account of the one place that rule is currently broken.

The result is a compact case study in simulation-driven UI, procedural audio, and canvas/React
interop, documented to the standard the code deserves.

## At a glance

| | |
| --- | --- |
| **Source** | 3 381 lines — 2 841 TSX, 461 TS, 79 CSS, across 12 modules |
| **Production payload** | 316 kB JS / **86.77 kB gzip**, 44.21 kB CSS / 8.13 kB gzip |
| **Media assets** | **0 bytes** — no images, audio, fonts, or icons files |
| **Runtime dependencies in the bundle** | `react`, `react-dom`, `lucide-react`, `tailwindcss` |
| **Network requests at runtime** | **none** — verified: no `fetch`, XHR, WebSocket, or storage API in `src/` |
| **Permissions requested** | **none** — the "EVP recorder" records nothing |
| **Documentation** | 12 guides + an index, 6 ADRs, and a 21-entry tech-debt register |
| **Automated tests** | none yet — [strategy and 32 written specifications](docs/testing.md) |

## Features

| Module | Description |
| --- | --- |
| **System Boot** | Cinematic POST sequence: 12 staged hardware-detection lines (LIS3MDL magnetometer, LND-712 Geiger–Müller tube, RF receiver), a progress gate, and an operator-triggered ignition that also unlocks the `AudioContext` — browsers require a user gesture. |
| **Live EMF Display** | Canvas oscilloscope of the milligauss trace, a tri-axis vector decomposition constrained so `√(x²+y²+z²)` equals the scalar reading, electric-field and RF readouts, and fluctuation-rate tracking. |
| **Radar Grid** | Rotating-sweep radar at 6.98 s per revolution with phosphor persistence; contacts carry position, velocity, intensity, and age, spawn as a function of field level, and can be frozen mid-scan. |
| **Anomaly Log** | Severity-classified event feed (LOW / MEDIUM / HIGH / CRITICAL) generated from spike detection, with filtering and a rolling haunt-probability index. |
| **Triangulation Map** | A sensor network across three preset locations (asylum ward, residence, forest cabin) with per-node EMF, thermal, and motion readings and a node inspector. |
| **EVP Recorder** | Record → demodulate → playback workflow with a live canvas waveform, progress-gated signal demodulation, and decoded spectral messages. Records nothing; requests no microphone. |
| **Entity Database** | A field guide to four entity classes with danger ratings and per-entity EMF, thermal, and RF signature profiles plus countermeasures. |
| **Diagnostics & Specs** | Sensor sensitivity calibration, ambient temperature control, an audio self-test, a fictional hardware matrix, and four accent themes. |
| **Haunting Outbreak** | A scripted 15-second crisis: violently fluctuating EMF, screen shake, glitch overlays with rotating warning text, a two-operator FM scream, and a thermal crash — then a clean return to baseline. |
| **Procedural Audio** | A singleton `AudioController` synthesizing every sound from Web Audio primitives, with master volume and mute, and graceful no-op degradation when the API is unavailable. |

## Architecture

A single-page React app with no backend and no runtime assets. State flows one way, from a central
simulation loop.

```
┌──────────────────────────────────────────────────────────────────────┐
│  App.tsx — simulation core (owner of all instrument state)           │
│                                                                      │
│  300 ms tick ──► EMF model ──► emfLevel, ambientTemp, outbreak state │
│    • auto      bounded random walk + spike/decay regimes             │
│    • manual    operator slider + sensitivity-scaled noise            │
│    • outbreak  high-amplitude sinusoid + stochastic jitter           │
└──────────────┬──────────────────────────────────┬────────────────────┘
               │ props (unidirectional)           │ setEMFLevel()
               ▼                                  ▼
  ┌───────────────────────────┐   ┌──────────────────────────────────┐
  │  Presentation (9 modules) │   │  AudioController (singleton)     │
  │  React domain ≤ 10 Hz     │   │  sawtooth hum ► resonant LPF     │
  │   readings, logs, tabs    │   │  noise buffer ► bandpass static  │
  │  Frame domain ~60 Hz      │   │  Geiger clicks, EMF-scaled rate  │
  │   3 × canvas + rAF loops  │   │  alarms · sweeps · FM scream     │
  └───────────────────────────┘   └──────────────────────────────────┘
```

Five decisions shape everything else, and each is recorded with its context, costs, and rejected
alternatives:

| Decision | Summary | ADR |
| --- | --- | --- |
| **Single source of truth** | `App.tsx` owns all 16 shared quantities; components derive locally and never write upward. Four upward channels exist in the entire app. | [0001](docs/decisions/0001-single-source-of-truth.md) |
| **Two rendering domains** | React reconciles data at ≤ 10 Hz; canvas loops own everything at frame rate, with animation state in refs. | [0002](docs/decisions/0002-two-rendering-domains.md) |
| **Audio as a service** | One module-level singleton behind an imperative intent API. Every method no-ops safely before init, so audio can never take down the UI. | [0003](docs/decisions/0003-audio-as-a-module-singleton.md) |
| **Zero runtime assets** | All sound synthesized, all imagery CSS/SVG/canvas, all icons components. 0 bytes of media shipped. | [0004](docs/decisions/0004-zero-runtime-assets.md) |
| **Procedural signal model** | A regime-dependent bounded random walk with impulsive events, not scaled noise. | [0005](docs/decisions/0005-procedural-signal-model.md) |

Full treatment — state ownership map, data flow of a single tick, module graph, lifecycle, and the
architectural tensions the design accepts — in **[docs/architecture.md](docs/architecture.md)**.

## Quick start

**Node ≥ 20.19** (22 LTS recommended). No environment variables, no database, no native toolchain.

```bash
git clone https://github.com/zazieproductions/AETHER-V9-Pro.git
cd AETHER-V9-Pro
npm ci
npm run dev          # → http://localhost:5173
```

Press **INITIALIZE SYSTEM IGNITION**, wait out the ~4.7 s POST sequence, and put on headphones — the
instrument is meant to be heard.

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check via project references (`tsc -b`), then produce a production bundle |
| `npm run typecheck` | The type gate alone, no bundle — the blocking CI step |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint across the repository — currently reports a 45-error baseline ([status](#engineering-status)) |
| `npm run lint:fix` | `eslint . --fix` — a measured no-op on today's baseline; the 35 mechanical errors are deletions a human makes ([why](docs/development.md#51-why-the-baseline-exists)) |

The build is a static bundle with no server-side requirements. Hosting recipes for Vercel, Netlify,
GitHub Pages, S3 + CloudFront, and nginx are in **[docs/deployment.md](docs/deployment.md)**.

## Documentation

Depth lives in [`docs/`](docs/README.md); this README is the entry point.

| Document | What it answers |
| --- | --- |
| [**Architecture**](docs/architecture.md) | How the system is layered, who owns which state, how a tick flows, what the lifecycle is |
| [**Simulation Engine**](docs/simulation-engine.md) | The exact mathematics of the signal model, all three regimes, the outbreak state machine, every derived quantity, and a tuning table |
| [**Audio Synthesis**](docs/audio-synthesis.md) | The Web Audio graph per voice, EMF→parameter mappings, autoplay policy, and why the scream uses two-operator FM |
| [**Components**](docs/components.md) | All nine modules: responsibility, props, state, effects, timers, canvases, cleanup status |
| [**API Reference**](docs/api.md) | `AudioController` methods, domain types, prop contracts, and the eight invariants the system maintains |
| [**Development**](docs/development.md) | Toolchain, scripts, TypeScript and ESLint configuration rationale, debugging notes, StrictMode behaviour |
| [**Testing**](docs/testing.md) | Current coverage, the seedability blocker, 32 specified tests, a proposed harness, and a manual test matrix |
| [**Performance**](docs/performance.md) | Measured bundle composition, update topology, frame budget, and four defects with fixes |
| [**Accessibility**](docs/accessibility.md) | A WCAG 2.2 AA assessment: 16 findings, computed contrast ratios, and a four-phase plan |
| [**Deployment**](docs/deployment.md) | Static hosting, base paths, caching headers, and the two artifacts that must be stripped first |
| [**Roadmap**](docs/roadmap.md) | Prioritized work in five phases, with what each item unblocks |
| [**Tech-Debt Register**](docs/tech-debt.md) | Every known defect with evidence, severity, remediation, and a verification step |
| [**Decision Records**](docs/decisions/) | Why the system is shaped this way — including what was rejected |

Also at the repository root: [CONTRIBUTING](CONTRIBUTING.md) · [CHANGELOG](CHANGELOG.md) ·
[SECURITY](SECURITY.md) · [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md) · [LICENSE](LICENSE).

## Engineering status

Stated plainly, because a portfolio repository that overstates itself is worth less than one that
does not. Full detail in the [tech-debt register](docs/tech-debt.md).

| Gate | Status | Detail |
| --- | --- | --- |
| Type-check (`tsc -b`, `strict: true`) | **Passing** | Blocks `npm run build` |
| Production build | **Passing** | 1 752 modules, ~3.2 s |
| Lint (`eslint .`) | **45 errors** | 35 mechanical, 7 design findings from `react-hooks` v7. Advisory in CI until cleared. [ADR-0006](docs/decisions/0006-ci-gating-and-the-lint-baseline.md) |
| Automated tests | **None** | No runner installed. 32 specifications written and waiting. [docs/testing.md](docs/testing.md) |
| Accessibility | **Does not conform to WCAG 2.2 AA** | 16 findings including 5 Level A failures; four-phase plan. [docs/accessibility.md](docs/accessibility.md) |
| Deployable as-is | **No** | `index.html` carries injected preview tooling that makes third-party requests. Must be stripped first. [TD-15](docs/tech-debt.md#td-15) |
| Known functional defects | **2 user-visible** | Triangulation readings are frozen ([TD-02](docs/tech-debt.md#td-02)); the radar reconciles 60×/s ([TD-01](docs/tech-debt.md#td-01)) |

The two user-visible defects are documented with reproduction steps, root cause, and fixes rather
than left for a reader to discover. That is a deliberate choice about what kind of repository this is.

## Project structure

```
AETHER-V9-Pro/
├── index.html                     # entry document
├── src/
│   ├── main.tsx                   # React 19 root (StrictMode)
│   ├── App.tsx                    # simulation core, layout, tab router, outbreak logic
│   ├── components/
│   │   ├── SystemBoot.tsx         # POST sequence & ignition gate
│   │   ├── LiveEMFDisplay.tsx     # oscilloscope + tri-axis vector (canvas)
│   │   ├── RadarGrid.tsx          # sweep radar & contact tracking (canvas)
│   │   ├── AnomalyLog.tsx         # severity-classified event feed
│   │   ├── TriangulationMap.tsx   # multi-room sensor network
│   │   ├── EVPRecorder.tsx        # record / demodulate / playback (canvas)
│   │   ├── EntityDatabase.tsx     # entity field guide
│   │   ├── Diagnostics.tsx        # calibration & self-test
│   │   └── DeviceSpecs.tsx        # spec sheet & accent themes
│   ├── utils/audio.ts             # Web Audio synthesizer (singleton service)
│   └── index.css                  # Tailwind v4 entry + global styles
├── CONTRIBUTING.md                # ground rules, workflow, conventions, definition of done
├── SECURITY.md                    # verified zero-egress properties, disclosure policy
├── CHANGELOG.md                   # Keep a Changelog — 0.1.0 is the documentation release
├── CODE_OF_CONDUCT.md             # Contributor Covenant 2.1
├── docs/                          # 12 guides + index, and 6 ADRs
├── .github/                       # CI & deploy workflows, issue & PR templates, dependabot
├── eslint.config.js               # flat config: TS + react-hooks v7 + refresh
├── tsconfig.app.json              # strict, ES2022, bundler resolution
└── vite.config.ts                 # React + Tailwind plugins
```

## Configuration and tuning

There is no runtime configuration file by design; the instrument is self-contained. Behaviour is
tuned through in-app controls and a documented set of constants.

| Control | Location | Effect |
| --- | --- | --- |
| Simulation mode | Dashboard sidebar | `auto` runs the random-walk model; `manual` hands the baseline to a slider |
| Inject EMF signal | Dashboard sidebar (manual mode) | 0.1 – 20 mG baseline |
| Sensor sensitivity | Diagnostics | 1 – 100; scales injected noise and the E-field/RF readouts |
| Ambient temperature | Diagnostics | 0 – 35 °C; overridden to 3.2 °C during an outbreak |
| Accent theme | Device Specs | Ecto-Green, Phantom-Blue, Poltergeist-Red, Aether-Violet — propagates to all nine modules |
| Volume / mute | Header | Master gain on the audio service |

The 24 constants that shape feel — tick period, regime boundary, spike probabilities, decay rate,
sweep speed, alarm threshold — are tabulated with the effect of changing each in
[Simulation Engine §8](docs/simulation-engine.md#8-tuning-reference).

## Roadmap

Five phases, sequenced so that each unblocks the next: **make the existing claims true before adding
new ones.** Full detail in [docs/roadmap.md](docs/roadmap.md).

| Phase | Theme | Headline items |
| --- | --- | --- |
| **0 — Publishable** | Remove what should not ship | Strip preview instrumentation from `index.html`; `ctx.resume()` for iOS audio; add the missing favicon; drop unused dependencies |
| **1 — Correct and quiet** | Fix what a user can observe | Unfreeze the triangulation loop; move radar physics out of React state; extract the 10 Hz clock; purify three state updaters; clear the 35 mechanical lint errors |
| **2 — Verifiable** | Make behaviour assertable | Extract `createEmfEngine(seed)` as a pure module; add Vitest with 32 specified tests; renormalize audio mappings; alarm hysteresis |
| **3 — Accessible** | Widen who can use it | Accessible names and tablist semantics; contrast and type-size floors; `prefers-reduced-motion` and a global HOLD control; a content warning and intensity setting |
| **4 — Capable** | New behaviour | Persisted settings; deep-linkable tabs; data-driven scenario timelines; session record/replay; PWA packaging |

Good first PRs — self-contained, each closing a register entry with a stated verification step — are
listed in [Roadmap §9](docs/roadmap.md#9-contributing-to-the-roadmap).

## Contributing

Issues and pull requests are welcome. The short version:

1. **Open an issue before large changes.** Simulation-model work and visual work ship separately.
2. **`npm run build` must pass.** It type-checks before bundling.
3. **Do not add to the lint baseline.** Fix what you touch.
4. **Clean up every timer and frame loop** in the effect that created it, and never call a React
   setter from inside a `requestAnimationFrame` callback.
5. **New sounds go through `AudioController`** behind a semantic method — no `AudioContext` in
   components.
6. **Keep the zero-asset rule.** No bundled audio, images, or fonts without an ADR.

Full workflow, conventions, definition of done, and commit guidance in
**[CONTRIBUTING.md](CONTRIBUTING.md)**. Participation is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security and privacy

The application performs **no network I/O, writes no storage, and requests no permissions** —
verified by static analysis of `src/`. There is no backend, no telemetry, no user data, and therefore
no data to disclose. The one exception is an artifact in `index.html` that must be removed before
deployment, and it is documented as the highest-priority item in the register.

Details, threat surface, and disclosure policy in **[SECURITY.md](SECURITY.md)**.

## License

Released under the [MIT License](LICENSE) © 2026 zazieproductions.

---

<div align="center">
<sub>▲ AETHER V9 // No spectral entities were harmed in the making of this software. None were
detected, either.</sub>
</div>
