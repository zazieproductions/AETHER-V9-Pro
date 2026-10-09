# API Reference

| | |
| --- | --- |
| **Audience** | Contributors integrating with the audio service or adding components |
| **Status** | Accurate as of commit `102e524` |
| **Companion** | [Audio Synthesis](audio-synthesis.md) · [Components](components.md) |

This application exposes **no HTTP API, no public package entry point, and no plugin surface**. It
is `private: true` and ships as a static bundle. What follows is the *internal* contract surface —
the boundaries a contributor actually codes against: the audio service, the domain types, and the
component prop contracts.

---

## 1. `AudioController`

[`src/utils/audio.ts`](../src/utils/audio.ts) declares the class and exports one instance:

```ts
export const audioService = new AudioController();   // module-level singleton
```

Import it directly — `import { audioService } from '../utils/audio'`. The class itself is not
exported, so it cannot be instantiated a second time; that is deliberate
([ADR-0003](decisions/0003-audio-as-a-module-singleton.md)).

### 1.1 Universal contract

| Rule | Detail |
| --- | --- |
| **Safe before init** | Every method's first statement is `if (!this.ctx …) return`. Calling anything before `init()` is a silent no-op. |
| **Safe without the API** | If `new AudioContext()` throws, `init()` logs and leaves `ctx === null`. Every method then no-ops forever. Audio can never break the UI. |
| **Mute is a hard gate** | Every method also returns early when `isMuted` is true, except `setMute` and `setVolume`. |
| **Idempotent init** | `if (this.ctx) return` — repeated `init()` calls do nothing. |
| **Single writer** | `setEMFLevel` is called only from the engine loop in `App.tsx`. Do not add callers. |
| **No teardown** | There is no `dispose()`/`suspend()`. The context and two continuous sources live until page unload. [TD-12](tech-debt.md) |
| **Volume is per-voice** | No master bus; `volume` multiplies each voice's gain in JS. [TD-10](tech-debt.md) |

### 1.2 Lifecycle

#### `init(): void`

Creates the `AudioContext` (with `webkitAudioContext` fallback), then builds the two continuous
voices and starts the Geiger chain.

| | |
| --- | --- |
| **Must be called from** | a real user gesture — browser autoplay policy |
| **Only caller** | [`SystemBoot.tsx:37`](../src/components/SystemBoot.tsx), in the power-button handler |
| **Side effects** | 1 `AudioContext`, 2 oscillators/noise sources started, 1 timeout chain |
| **Throws** | never — wrapped in `try/catch` |
| **Known gap** | does not call `ctx.resume()`; a context created `suspended` never plays ([TD-12](tech-debt.md)) |

### 1.3 Continuous modulation

#### `setEMFLevel(level: number): void`

The primary modulation entry point. `level` is milligauss; no clamping is applied, so out-of-range
values saturate the mappings rather than throwing.

| Target | Mapping | Time constant |
| --- | --- | --- |
| `humOsc.frequency` | `55 + min(1.5·level, 110)` Hz | 0.1 s |
| `humFilter.frequency` | `120 + min(8·level, 800)` Hz | 0.1 s |
| `humGain.gain` | `(0.015 + min(level/200, 0.06)) · volume` | 0.1 s |
| `staticFilter.frequency` | `800 + min(20·level, 3000)` Hz | 0.2 s |
| `staticGain.gain` | `(0.003 + min(level/500, 0.025)) · volume` | 0.2 s |
| alarm | `level ≥ 15` → `startAlarm()`, else `stopAlarm()` | — |

Stores `level` in `currentEMF`, which the Geiger and alarm loops read on their next iteration.
Called ~3.3×/s from the engine; ~5×/s during an outbreak is not possible — the tick is the only
writer, so the rate is the tick rate.

#### `setEVPActive(active: boolean): void`

Reconfigures the static voice for the EVP workflow.

| `active` | Gain | Filter | Q | τ |
| --- | --- | --- | --- | --- |
| `true` | `0.12 · volume` | 1200 Hz | **12.0** (narrow "tuning" resonance) | 0.1 s |
| `false` | recomputed from `currentEMF` | 1000 Hz | 1.0 | 0.3 s |

Callers: `EVPRecorder` on record start/stop, demodulate start/stop, and playback start/stop — six
call sites, always paired. An unpaired `true` leaves the static voice loud indefinitely, so any new
caller must guarantee the matching `false` on every exit path, including component unmount.

### 1.4 Discrete voices

| Method | Signature | Duration | Envelope peak | Callers |
| --- | --- | --- | --- | --- |
| `playPowerUp()` | `() => void` | 1.6 s | `0.12 · volume` | 1 — boot gesture |
| `playPowerDown()` | `() => void` | 0.9 s | `0.10 · volume` | **0 — dead code** |
| `playDiagnosticBeep()` | `(success?: boolean) => void` | 0.1 s / 0.35 s | `0.05 · volume` | 10 |
| `playHauntingScream()` | `() => void` | 3.6 s | `0.12 · volume` | 2 — outbreak, EVP decode |
| `getIsMuted()` | `() => boolean` | — | — | **0 — dead code** |

`playDiagnosticBeep(success = true)` is the UI confirmation voice: a fixed 1 800 Hz pip for success,
a 400 → 250 Hz descending ramp for failure. It is used for tab switches, mode toggles, self-test
steps, sensitivity changes, record stops, and decode completion — and for the outbreak's wind-down,
where the descending variant stands in for the unwired `playPowerDown()`.

Internal voices (private, driven automatically): `playClickSound()` from the Geiger chain, and the
alarm beep loop from `startAlarm()` / `stopAlarm()`.

### 1.5 Transport

| Method | Behaviour |
| --- | --- |
| `setVolume(vol: number)` | Stores `volume`; immediately re-applies it to the hum and static gains (τ = 0.1 s). Does not affect voices already in flight. No clamping — pass 0–1. |
| `setMute(muted: boolean)` | Stores `isMuted`. On `true`: stops the alarm and hard-zeroes both continuous gains via `setValueAtTime(0, …)`. On `false`: calls `setEMFLevel(currentEMF)` to restore them. |

> [!WARNING]
> `setMute(true)` zeroes gains with `setValueAtTime`, a **discontinuous** jump to silence, which is
> audible as a click on the output. A 10–20 ms `linearRampToValueAtTime` to zero removes it. The
> Geiger chain is unaffected by muting except through its own `isMuted` guard, which parks it on a
> 1 s heartbeat. [TD-10](tech-debt.md)

## 2. Domain types

Four record types model the domain. Only one is exported today; the recommendation is to move all
four into `src/types.ts` (see [Roadmap F4](roadmap.md#4-phase-2--verifiable)).

### 2.1 `LogEntry` — exported

[`src/components/AnomalyLog.tsx:10-18`](../src/components/AnomalyLog.tsx)

```ts
export interface LogEntry {
  id: string;                                          // Math.random().toString() — see note
  timestamp: string;                                   // toLocaleTimeString(), capture time
  emf: number;                                         // mG, 2 dp snapshot at classification
  duration: string;                                    // e.g. "3.4s" — U(1.5, 5.5)
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type: string;                                        // "Spectral Breach" | "Poltergeist Spike" | …
  message: string;                                     // from a 5-entry pool
}
```

`severity` is a closed union; `type` and `message` are open strings. `duration` is a formatted
string, not a number — it is display-ready and not meant to be computed with.

### 2.2 `RadarBlip` — module-local

[`src/components/RadarGrid.tsx:10-22`](../src/components/RadarGrid.tsx)

```ts
interface RadarBlip {
  id: number;              // monotonic, from blipIdRef
  x: number;               // normalized −1…1 relative to centre
  y: number;               // normalized −1…1
  intensity: number;       // 0…1 → alpha, energy %, underline width
  size: number;            // px radius at pulse = 1
  speedX: number;          // normalized units per frame
  speedY: number;
  pulseSpeed: number;      // multiplier on the 0.003 rad/ms pulse oscillator
  name: string;            // display label, e.g. "ANOMALY_09"
  type: string;            // "Residual EMF" | "Kinetic Energy" | "High RF Burst" | "Class V Apparition"
  age: number;             // frames since spawn — incremented, never read
}
```

`type === 'Class V Apparition'` is **load-bearing**: the outbreak purge filters on exactly that
string ([`:85`](../src/components/RadarGrid.tsx)). Changing the label silently breaks outbreak
cleanup. `age` is incremented every frame and never consumed — it is the intended hook for
contact expiry, which is not implemented.

### 2.3 `SensorNode` — module-local

[`src/components/TriangulationMap.tsx:10-19`](../src/components/TriangulationMap.tsx)

```ts
interface SensorNode {
  id: string;                       // "N1"…"N4", unique within a location
  name: string;                     // "NODE_01_EMF"
  room: string;                     // "Intensive Care"
  x: number;                        // % from left edge of the floorplan
  y: number;                        // % from top edge
  emf: number;                      // mG, 2 dp
  temp: number;                     // °C, 1 dp
  motion: boolean;
  type: 'EMF' | 'TEMP' | 'MOTION';  // selects which field the fluctuation loop drives
}
```

`id` is reused across locations (`N1` exists in all three), so it is a key within a location only.
Since a location change replaces the whole array, that is safe today — but it means `selectedNode`
must be re-seeded on location change, which the code does.

### 2.4 `Entity` — module-local

[`src/components/EntityDatabase.tsx:8-18`](../src/components/EntityDatabase.tsx)

```ts
interface Entity {
  name: string;                       // selection key
  class: string;                      // "Class I Residual Apparition"
  danger: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  emfProfile: string;                 // display string, not a range
  tempProfile: string;
  rfProfile: string;
  behaviors: string[];
  countermeasure: string;
  icon: React.ReactNode;              // JSX in a data record
}
```

Two notes. `icon: React.ReactNode` makes this a data-plus-view hybrid — fine for a static four-entry
guide, but it blocks moving the array to a JSON/TS data module. And the profiles are pre-formatted
strings (`"2.5 - 5.0 mG [Stable]"`), so they cannot be validated against the engine's actual
thresholds; modelling them as `{ min, max, note }` would let a test assert the alignment documented
in [Components §9](components.md#9-entitydatabase).

## 3. Component prop contracts

All nine components are `React.FC<Props>` with a named export. `accentColor` is universal.

| Component | Props | Upward channels |
| --- | --- | --- |
| `SystemBoot` | `onBootComplete: () => void`, `accentColor: string` | `onBootComplete()` |
| `LiveEMFDisplay` | `emfLevel: number`, `sensitivity: number`, `hauntingActive: boolean`, `accentColor: string` | — |
| `RadarGrid` | `emfLevel`, `hauntingActive`, `accentColor` | — |
| `AnomalyLog` | `emfLevel`, `hauntingActive`, `accentColor` | — |
| `TriangulationMap` | `emfLevel`, `hauntingActive`, `accentColor` | — |
| `EVPRecorder` | `accentColor` | — |
| `EntityDatabase` | `accentColor` | — |
| `Diagnostics` | `sensitivity`, `setSensitivity: (s: number) => void`, `ambientTemp`, `setAmbientTemp: (t: number) => void`, `accentColor` | 2 setters |
| `DeviceSpecs` | `accentColor`, `setAccentColor: (color: string) => void` | 1 setter |

Only four upward channels exist in the entire application: one boot callback and three lifted
setters. Everything else flows down. That is the measurable expression of
[ADR-0001](decisions/0001-single-source-of-truth.md).

### 3.1 Prop semantics

| Prop | Contract |
| --- | --- |
| `emfLevel` | milligauss, clamped `[0.2, 95]` by the producer. Components may assume it is finite and in range; they must not mutate it. Threshold behaviour is specified per component, not centrally. |
| `hauntingActive` | "a scripted crisis event is in progress". Consumers use it to switch to their extreme variant. It is a **mode flag**, not a magnitude — magnitude still arrives via `emfLevel`. |
| `sensitivity` | integer 1–100. A *noise gain*: it scales injected jitter and the E-field/RF readouts. It never scales `emfLevel` itself. |
| `accentColor` | 6-digit CSS hex. Canvas code composes alpha by string concatenation (`${accentColor}44`), so **3-digit hex, `rgb()`, and CSS variables will all silently produce invalid colours**. |
| `setSensitivity` / `setAmbientTemp` / `setAccentColor` | React state setters lifted from `App.tsx`. Call with a plain value; they are not batched or validated by the callee. |
| `onBootComplete` | Called exactly once, ~1 s after the POST sequence finishes. Must be safe to call during a render commit (it is invoked from a `setTimeout`). |

## 4. Invariants

Guarantees the system maintains, and that a change must not break:

| # | Invariant | Enforced by |
| --- | --- | --- |
| I1 | Exactly one writer of `emfLevel` | the engine effect in `App.tsx`; no component calls `setEmfLevel` |
| I2 | `emfLevel ∈ [0.2, 95]` mG in AUTO/MANUAL, `[13, 43]` in outbreak | the clamp at [`App.tsx:129`](../src/App.tsx) |
| I3 | `√(x² + y² + z²) = emfLevel` for the displayed tri-axis vector | the sphere-sector parameterization ([Simulation Engine §6.1](simulation-engine.md#61-tri-axis-vector-decomposition)); broken only in the ≤ 0.2 mG dead band |
| I4 | Audio state never diverges from simulation state by more than one tick | both are written in the same tick body |
| I5 | No `AudioContext` exists before the first user gesture | `init()` is only called from the power-button handler |
| I6 | The application performs no network I/O and touches no storage API | verified: zero occurrences of `fetch`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`, `getUserMedia` in `src/` |
| I7 | The outbreak is non-reentrant and self-terminating | early return on `hauntingActive`; single 15 s timeout |
| I8 | Every component is independently mountable | zero inter-component imports |

> [!IMPORTANT]
> **Invariant I6 has one exception, and it is not in `src/`.** The committed
> [`index.html`](../index.html) contains platform-injected instrumentation — an rrweb session
> recorder loaded from a public CDN, a page-view beacon, and an element-picker script. These are
> preview-tooling artifacts from the environment the app was generated in, they make real network
> requests, and they must be stripped before any deployment. Highest-priority item in the register:
> [TD-15](tech-debt.md).

## 5. What is deliberately *not* an API

| Absent | Why |
| --- | --- |
| Persistence | No `localStorage`. Settings reset on reload. Planned: [Roadmap E1](roadmap.md#6-phase-4--capable) |
| URL routing | `react-router-dom` is a declared dependency but imported nowhere; tabs are local state. The URL therefore never reflects the active tab, so deep links and browser back are unsupported. [TD-06](tech-debt.md) |
| Scenario scripting | The outbreak is hard-coded in `App.tsx`. Planned: [Roadmap E3](roadmap.md#6-phase-4--capable) |
| Configuration file | No runtime config by design; tuning constants are documented in [Simulation Engine §8](simulation-engine.md#8-tuning-reference) |
| Telemetry | None. No analytics, no error reporting, no crash visibility. |
| Test surface | No exported pure functions. Everything is inside components or the singleton, which is precisely what [Roadmap F1](roadmap.md#4-phase-2--verifiable) exists to change. |

---

**Next:** [Development](development.md) — the toolchain that builds all of this.
