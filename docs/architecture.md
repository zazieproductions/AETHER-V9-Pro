# Architecture

| | |
| --- | --- |
| **Audience** | Contributors, reviewers |
| **Status** | Accurate as of commit `102e524` |
| **Companion documents** | [Simulation Engine](simulation-engine.md) · [Components](components.md) · [ADR-0001](decisions/0001-single-source-of-truth.md) · [ADR-0002](decisions/0002-two-rendering-domains.md) |

---

## 1. System context

AETHER V9 Pro is a single-page application with **no backend, no network calls, no persistent
storage, and no runtime assets**. The browser is the whole system.

```
                    ┌──────────────────────────────────────────┐
                    │              Browser (client)            │
                    │                                          │
   Operator ──────► │   React 19 SPA  ──►  Canvas 2D (×3)      │
   (input, gesture) │        │                                 │
                    │        └────────►  Web Audio API         │
                    │                     (synthesis, output)  │
                    └──────────────────────────────────────────┘
                                     │
                                     ╳  no network egress, no storage writes
```

Two consequences shape every other decision:

- **All content is generated at runtime.** Signal values come from the simulation model
  ([simulation-engine.md](simulation-engine.md)); all sound is synthesized from oscillator and
  noise-buffer primitives ([audio-synthesis.md](audio-synthesis.md)); all imagery is CSS, SVG, or
  canvas. There is no `public/` directory and no media in the bundle. See
  [ADR-0004](decisions/0004-zero-runtime-assets.md).
- **The first user gesture is architecturally load-bearing.** Browser autoplay policy forbids
  starting an `AudioContext` before a gesture. The boot screen's power button is therefore not
  decoration — it is the audio subsystem's initialization trigger
  ([`src/components/SystemBoot.tsx:37`](../src/components/SystemBoot.tsx)). See
  [ADR-0003](decisions/0003-audio-as-a-module-singleton.md).

## 2. Layers

Three layers, one direction of dependency.

```
┌───────────────────────────────────────────────────────────────────────────┐
│  L3  PRESENTATION                                                         │
│      9 components in src/components/                                      │
│      Reads props → renders DOM + canvas. Owns only local visual state.    │
│      3 of 9 may issue imperative audio intents (SystemBoot, Diagnostics,  │
│      EVPRecorder).                                                        │
├───────────────────────────────────────────────────────────────────────────┤
│  L2  SIMULATION CORE                                                      │
│      App.tsx — 16 state variables, 4 effects, 1 event procedure           │
│      Owns every physical quantity and operator setting.                   │
│      Sole writer of shared state; sole authority on the outbreak machine. │
├───────────────────────────────────────────────────────────────────────────┤
│  L1  SERVICES                                                             │
│      utils/audio.ts — AudioController singleton                           │
│      Owns the Web Audio graph, envelope scheduling, and mute/volume gain. │
│      Stateless with respect to the simulation: it is *told* the EMF level.│
└───────────────────────────────────────────────────────────────────────────┘
```

Dependency rule: **L3 → L2 (via props only), L2 → L1 (via method calls), L3 → L1 (via method calls
for discrete sound effects).** Nothing in L1 or L2 imports from L3. Nothing calls upward.

> [!IMPORTANT]
> The L3 → L1 edge is intentional and narrow. Components may fire *discrete, user-initiated*
> sounds (`playDiagnosticBeep`, `setEVPActive`). They may **not** drive continuous parameters —
> `setEMFLevel` is called exclusively from the simulation loop in `App.tsx`, so the audio graph has
> exactly one writer for its primary modulation source.

## 3. State ownership

Every piece of shared state lives in `App.tsx`. This is the single most important structural fact
about the codebase; see [ADR-0001](decisions/0001-single-source-of-truth.md).

| State | Type | Initial | Written by | Read by | Cadence |
| --- | --- | --- | --- | --- | --- |
| `isBooted` | `boolean` | `false` | boot callback | root render gate | once |
| `activeTab` | 5-member union | `'dashboard'` | tab bar | layout router | on click |
| `emfLevel` | `number` (mG) | `0.8` | simulation tick | 4 components + audio | 300 ms |
| `sensitivity` | `number` 1–100 | `10` | Diagnostics slider | LiveEMFDisplay, engine noise | on input |
| `ambientTemp` | `number` (°C) | `19.5` | Diagnostics slider, outbreak | Diagnostics only | on input |
| `accentColor` | CSS hex | `'#10b981'` | DeviceSpecs | **all 9 components** | on click |
| `volume` | `number` 0–1 | `0.5` | header slider | audio service | on input |
| `isMuted` | `boolean` | `false` | header toggle | audio service | on click |
| `simulationMode` | `'auto' \| 'manual'` | `'auto'` | sidebar toggle | engine branch | on click |
| `manualEMF` | `number` 0.1–20 | `1.2` | sidebar slider | engine (manual branch) | on input |
| `hauntingActive` | `boolean` | `false` | outbreak procedure | 4 components + audio | 2×/event |
| `isScreenShaking` | `boolean` | `false` | outbreak procedure | root class | 2×/event |
| `glitchText` | `string \| null` | `null` | outbreak rotation | overlay | 1.5 s (during event) |
| `systemTime` | `string` | `''` | clock interval | header | 100 ms |
| `gpsCoords` | `string` | NYC | jitter interval | header | 5 s |
| `hauntingTimer` | `number` | `0` | — | — | **dead** ([TD-08](tech-debt.md)) |

Derived, component-local state (not shared, deliberately): radar blips, anomaly log entries,
triangulation node readings, EVP progress, entity selection. Each is a *view* over the shared
quantities, computed where it is rendered.

### Propagation shape

```
                          App.tsx (state owner)
                                   │
        ┌──────────┬──────────┬────┴─────┬───────────┬──────────┐
        ▼          ▼          ▼          ▼           ▼          ▼
   LiveEMFDisplay RadarGrid AnomalyLog Triangulation EVPRecorder Diagnostics
   emfLevel       emfLevel  emfLevel   emfLevel      accentColor sensitivity ↕
   sensitivity    haunting  haunting   haunting                  ambientTemp ↕
   haunting       accent    accent     accent
   accent
                                   DeviceSpecs (accentColor ↕)
                                   EntityDatabase (accentColor)
                                   SystemBoot (accentColor, onBootComplete ↑)

   ↕ = two-way: the value is lifted (state + setter pair passed down)
   ↑ = callback into the owner
```

Two propagation patterns, and only two:

1. **Read-only fan-out** — `emfLevel`, `hauntingActive`, `accentColor`. Pushed down, never written
   back. Six of nine components receive `accentColor`; this is prop drilling, and it is the
   accepted cost of not introducing a theme context. Tracked as [TD-11](tech-debt.md).
2. **Lifted control** — `sensitivity`, `ambientTemp`, `accentColor` (in DeviceSpecs). The owner
   passes state *and* its setter; the child renders the control. Chosen over callbacks so the
   simulation loop can read the current value without an extra indirection.

## 4. Data flow of one tick

The complete path a single EMF sample takes, at 300 ms cadence:

```
 setInterval (300 ms)                                     src/App.tsx:89
      │
      ├─ branch on hauntingActive / simulationMode
      │      auto    → bounded random walk + spike/decay regimes
      │      manual  → slider baseline + sensitivity-scaled noise
      │      outbreak→ high-amplitude sinusoid + stochastic jitter
      │
      ├─ clamp to [0.2, 95] mG
      │
      ├─► setEmfLevel(next)          ── React state ──┐
      │                                                │
      └─► audioService.setEMFLevel(next)               │
                 │                                     ▼
                 ├─ hum osc freq  55→165 Hz   ┌──────────────────────────┐
                 ├─ hum LPF cutoff 120→920 Hz │ props fan out to:        │
                 ├─ hum gain (EMF-scaled)     │  LiveEMFDisplay → canvas │
                 ├─ static bandpass 800→3800Hz│  RadarGrid      → canvas │
                 ├─ static gain               │  AnomalyLog     → DOM    │
                 └─ alarm start/stop @ 15 mG  │  TriangulationMap → DOM  │
                                              └──────────────────────────┘
                                                         │
                                              canvas work happens in
                                              requestAnimationFrame loops
                                              that read the *latest props*
                                              via effect closure or ref
```

Note the ordering: `setEmfLevel` and `audioService.setEMFLevel` are called in the same tick, but
they land in **different update domains**. The audio parameter changes take effect on the audio
thread's clock immediately (`setTargetAtTime`); the React change takes effect at the next
reconciliation. This is why the sound and the pixels never need to be synchronized explicitly —
audio leads, visuals follow, and the gap is below perceptual threshold. See
[ADR-0002](decisions/0002-two-rendering-domains.md).

## 5. Two rendering domains

The performance-critical invariant of the system.

| | React domain | Frame domain |
| --- | --- | --- |
| **Cadence** | 100 ms – 5 s, event-driven | ~16.7 ms (`requestAnimationFrame`) |
| **Owns** | readings, logs, tabs, settings | sweep angle, waveform phase, blip position, trail decay |
| **Storage** | `useState` in `App.tsx` and children | `useRef` inside the drawing effect |
| **Output** | DOM (Tailwind classes, inline styles) | Canvas 2D |
| **Cost model** | reconciliation + layout | fill/stroke calls + compositing |

Three canvases, each with its own frame loop:

| Canvas | Component | Backing store | Loop deps | Per-frame work |
| --- | --- | --- | --- | --- |
| Oscilloscope | `LiveEMFDisplay` | 280 × 110 | `emfLevel, sensitivity, hauntingActive, accentColor` | 1 clear + grid + 280-point path |
| Radar | `RadarGrid` | 300 × 300 | `accentColor, isScanning, hauntingActive` | 1 clear + 4 arcs + sweep + N blips |
| EVP waveform | `EVPRecorder` | 320 × 120 | `isRecording, isDemodulating, playbackActive, demodulateProgress, accentColor` | 1 clear + 320-point path |

Motion trails are produced by filling with a translucent black rectangle instead of calling
`clearRect` — `rgba(0,0,0,0.2)` for the oscilloscope and EVP waveform, `rgba(0,0,0,0.15)` for the
radar. The alpha is the decay constant: lower values give longer phosphor persistence. This is
one fill call instead of a history buffer, and it is the reason the traces look like a CRT.

> [!WARNING]
> **This invariant is currently violated in one place.** `RadarGrid` calls `setBlips` and
> `setDetectedEntities` from inside its `requestAnimationFrame` loop
> ([`src/components/RadarGrid.tsx:188`](../src/components/RadarGrid.tsx), `:264`), which forces a
> React reconciliation on every frame — the exact coupling ADR-0002 exists to prevent. It works,
> but it is the single largest performance defect in the codebase. Evidence, measurement, and the
> fix are in [Performance §4](performance.md#4-known-defects) and [TD-01](tech-debt.md).

## 6. Module graph

Verified import edges (`npm ls` equivalent, from static analysis of `src/`):

```
main.tsx ──► index.css ──► tailwindcss
    │
    └──► App.tsx ──┬──► utils/audio.ts            (audioService singleton)
                   ├──► components/SystemBoot.tsx ────► utils/audio.ts
                   ├──► components/LiveEMFDisplay.tsx
                   ├──► components/RadarGrid.tsx
                   ├──► components/AnomalyLog.tsx
                   ├──► components/TriangulationMap.tsx
                   ├──► components/EVPRecorder.tsx ───► utils/audio.ts
                   ├──► components/EntityDatabase.tsx
                   ├──► components/Diagnostics.tsx ───► utils/audio.ts
                   └──► components/DeviceSpecs.tsx

external: react, react-dom, lucide-react, tailwindcss
```

Observations worth recording:

- **Zero inter-component imports.** Components are siblings, never parents. All composition happens
  in `App.tsx`, which makes the render tree trivially readable and each component independently
  mountable.
- **Four modules touch audio** (`App`, `SystemBoot`, `EVPRecorder`, `Diagnostics`); five are pure
  presentation. The audio-aware ones are exactly those with a user-initiated sonic affordance.
- **`lucide-react` is the only non-React UI dependency actually imported.** `framer-motion` and
  `react-router-dom` are declared in `package.json` but imported nowhere — see
  [TD-06](tech-debt.md).
- **No cycles, no barrel files, no re-exports.** Every import resolves to a concrete module path.

## 7. Lifecycle

### 7.1 Boot

```
mount ──► SystemBoot (render gate: isBooted === false)
              │
              ▼  operator clicks power button  [first user gesture]
          audioService.init()            creates AudioContext
              │                          ├─ setupEMFHum()     osc → LPF → gain → out
              │                          ├─ setupEVPStatic()  noise buffer → BPF → gain → out
              │                          └─ startGeigerClicks()  self-rescheduling setTimeout
              ▼
          audioService.playPowerUp()     1.6 s two-layer sweep
              │
              ▼
          12 staged POST log lines       200–400 ms each, 3.70 s total
          progress = (step+1)/12 × 100
              │
              ▼
          setIsBooted (local) ──► after 1.0 s dwell ──► onBootComplete()
              │
              ▼
          App: isBooted = true ──► SystemBoot unmounts, console mounts
              │
              ▼
          simulation effect starts (dep: isBooted)   300 ms tick
          clock effect (100 ms) + GPS effect (5 s) already running since mount
```

The POST sequence is a `setTimeout` chain, not an interval — each step schedules the next with its
own delay ([`src/components/SystemBoot.tsx:41-55`](../src/components/SystemBoot.tsx)). This lets
the pacing vary per line (hardware detection reads slower than kernel init) at the cost of the
chain being uncancellable; see [TD-04](tech-debt.md).

### 7.2 Steady state

Six concurrent timers: five `setInterval`s and one self-rescheduling `setTimeout` chain.

| Timer | Owner | Period | Cleared on |
| --- | --- | --- | --- |
| Clock | `App.tsx:67` | 100 ms | unmount |
| GPS jitter | `App.tsx:72` | 5 s | unmount |
| Simulation tick | `App.tsx:89` | 300 ms | unmount or dep change |
| Derived-field sampler | `LiveEMFDisplay.tsx:28` | 150 ms | unmount or dep change |
| Node fluctuation | `TriangulationMap.tsx:66` | 1 s | unmount or dep change — **starved**, see [TD-02](tech-debt.md) |
| Geiger click chain | `audio.ts:100` | 30 ms – 4 s, EMF-dependent | never (page-lifetime singleton) |

Plus three `requestAnimationFrame` loops while their tabs are mounted, all correctly cancelled in
their effect cleanup.

### 7.3 Outbreak

A scripted 15-second crisis event. Full state machine in
[Simulation Engine §5](simulation-engine.md#5-the-outbreak-state-machine).

### 7.4 Teardown

There is no teardown path. The `AudioController` exposes no `dispose()` or `suspend()`, so the
`AudioContext`, the two continuous source nodes (hum oscillator, looping noise buffer), and the
Geiger timeout chain live until page unload. For a single-page instrument this is acceptable —
the page *is* the process. It matters in exactly one situation: Vite HMR re-executes the module,
creating a second singleton while the first context keeps running. Documented with a workaround in
[Development §7](development.md#7-debugging-notes).

## 8. Architectural tensions

Recorded honestly, because pretending they do not exist is worse than owning them.

| Tension | Current resolution | Cost |
| --- | --- | --- |
| `App.tsx` is simultaneously engine, layout, and router (522 lines) | Kept together; engine logic isolated in one effect | Extracting the engine is the top roadmap item — it blocks unit testing ([Roadmap F1](roadmap.md#4-phase-2--verifiable)) |
| `accentColor` drilled into 9 components | Explicit props, no context | One extra prop per component; a theme addition touches all 9 ([TD-11](tech-debt.md)) |
| No state library | 16 `useState` calls in one file | Fine at this scale; the file is the ceiling |
| Simulation is not seedable | `Math.random()` throughout | Traces are not reproducible, so they are not unit-testable ([Testing §3](testing.md#3-the-seedability-blocker)) |
| Audio is a singleton | Module-level instance, imperative API | No teardown, HMR duplication, untestable without mocking ([ADR-0003](decisions/0003-audio-as-a-module-singleton.md)) |
| Continuous auto-updating content | No global pause control | A WCAG 2.2.2 conformance gap ([Accessibility §3](accessibility.md#3-wcag-22-findings)) |

---

**Next:** [Simulation Engine](simulation-engine.md) — how the signal is actually generated.
