# Simulation Engine

| | |
| --- | --- |
| **Audience** | Contributors touching `App.tsx`, `LiveEMFDisplay.tsx`, `AnomalyLog.tsx`, `TriangulationMap.tsx`, `RadarGrid.tsx` |
| **Status** | Accurate as of commit `102e524`. All constants transcribed from source, not from intent. |
| **Primary source** | [`src/App.tsx:86-137`](../src/App.tsx) (engine loop) · [`src/components/LiveEMFDisplay.tsx:27-72`](../src/components/LiveEMFDisplay.tsx) (derived fields) |
| **Companion** | [ADR-0005 · Procedural signal model](decisions/0005-procedural-signal-model.md) |

The engine is the reason the instrument reads as hardware rather than as a random-number
demo. This document specifies it exactly — including where the implementation departs from
physical plausibility, and where it departs from its own comments.

---

## 1. Scope

The engine produces **one authoritative scalar**: `emfLevel`, in milligauss, updated every 300 ms.
Every other quantity in the application is either

- an **operator setting** (sensitivity, ambient temperature, mode, theme, volume), or
- a **derivation** computed downstream from `emfLevel` (axis vector, electric field, RF, fluctuation
  rate, log severity, haunt probability, radar contacts, node readings, audio parameters).

That fan-out is why the engine is small and why [extracting it into a pure module](#7-proposed-extraction-createemfengineseed)
is the highest-value refactor available.

## 2. The tick loop

One `setInterval` at 300 ms ([`src/App.tsx:89`](../src/App.tsx)), gated on `isBooted`, re-created
whenever `simulationMode`, `manualEMF`, `sensitivity`, or `hauntingActive` changes. Three mutually
exclusive branches, evaluated in this order:

```
tick()
 ├─ hauntingActive?          ──► OUTBREAK branch     (§5)
 ├─ simulationMode==='manual'──► MANUAL branch       (§4)
 └─ else                     ──► AUTO branch         (§3)
                                        │
                                        ▼
                                 audioService.setEMFLevel(next)
```

### 2.1 Tick-rate rationale

| Constraint | Value | Effect |
| --- | --- | --- |
| Perceptual "live" threshold | ≲ 500 ms | 300 ms reads as an instrument polling, not as a UI updating |
| React reconciliation budget | ≪ 16.7 ms | 3.3 renders/s is free; even a full console re-render costs well under a frame |
| Audio smoothing constant | 0.1–0.2 s (`setTargetAtTime`) | Audio interpolates between ticks, so 300 ms steps are inaudible as steps |
| Derived-field sampler | 150 ms | Subsamples the tick 2:1, so `dE/dt` sees intermediate values |

The tick and the frame loop are deliberately **not** the same clock. Nothing in the engine runs at
60 Hz; see [ADR-0002](decisions/0002-two-rendering-domains.md).

## 3. AUTO regime — the bounded random walk

Transcribed from [`src/App.tsx:106-133`](../src/App.tsx). `U(a,b)` denotes a uniform draw.

```
next ← prev

if prev < 3.0 mG                        ── QUIET BAND
    next ← next + U(-0.2, +0.2)                    diffusive step, μ = 0, σ ≈ 0.1155
    with p = 0.03:  next ← U(5.0, 13.0)            moderate spike (overwrites the step)

else                                    ── ELEVATED BAND
    next ← next − U(0.3, 0.8)                      decay, μ = −0.55 per tick
    with p = 0.10:  next ← U(12.0, 22.0)           high spike (overwrites the decay)

next ← clamp(next, 0.2, 95.0)
```

### 3.1 Why this shape

Four properties were designed for, and each maps to a specific line:

| Property | Mechanism | Why raw `Math.random()` fails |
| --- | --- | --- |
| **Autocorrelation** | `next` is a function of `prev` | Independent samples have no memory, so the trace looks like static, not like a settling sensor |
| **Asymmetry** | Rise is a *jump* (one tick), fall is a *decay* (0.3–0.8 mG/tick) | Real magnetometer spikes are impulsive; symmetric noise reads as fake |
| **Non-periodicity** | Two independent spike processes with coprime-ish probabilities (3 %, 10 %) | A sine or a modulo counter produces a visible beat |
| **Boundedness** | Clamp to `[0.2, 95]` plus regime-dependent direction | A pure walk diverges; the 3.0 mG threshold makes the elevated band self-draining |

### 3.2 Emergent statistics

Derived from the transition rules above (3.33 ticks/s):

| Quantity | Value | Derivation |
| --- | --- | --- |
| Quiet-band diffusion | σ ≈ 0.1155 mG/tick | `U(-0.2, 0.2)` has σ = 0.4/√12 |
| Median time to reach 3.0 mG from 0.8 mG by diffusion alone | ≈ 360 ticks ≈ 110 s | first-passage ≈ (Δ/σ)² steps |
| Moderate spike rate | ≈ 1 per 10 s | p = 0.03 per tick × 3.33 ticks/s |
| Decay time from a 13 mG spike back under 3.0 mG | ≈ 18–33 ticks (5.5–10 s) | 10 mG at 0.3–0.55 mG/tick |
| Cascade probability (spike → re-spike before decay) | ≈ 10 %/tick while elevated | geometric; mean 10 ticks elevated before re-spike |
| P(reaching the 15 mG alarm threshold) | 0 from a moderate spike; **0.70** from a high spike | `U(5,13)` never exceeds 15; `U(12,22)` exceeds 15 on 70 % of its range |
| Practical ceiling | 22 mG | The 95 mG clamp is unreachable in AUTO |

> [!NOTE]
> Diffusion alone almost never produces an interesting trace on a human timescale — the median
> diffusive crossing of the 3.0 mG boundary is nearly two minutes. **The 3 % spike process is what
> the operator actually sees.** The walk exists to make the baseline look alive between spikes, not
> to generate them. If you tune the walk step upward to "make it more active", you will get a
> drifting baseline and lose the quiet-band stillness that makes spikes legible.

### 3.3 Known impurity

`audioService.setEMFLevel(next)` is called **inside the `setEmfLevel` updater function**
([`src/App.tsx:130`](../src/App.tsx)). A state updater must be pure; this one draws random numbers
and performs a side effect. Consequences:

- Under `<StrictMode>` (enabled in [`src/main.tsx:7`](../src/main.tsx)) React double-invokes
  updaters in development, so the audio parameter is written twice per tick and the random stream
  is consumed at 2× rate — **dev and prod traces diverge**.
- The impurity is invisible today because `setEMFLevel` is idempotent for audio. It becomes a real
  bug the moment anyone adds a second side effect.

Remediation: compute `next` in a local, call `audioService.setEMFLevel(next)` after
`setEmfLevel(next)`. Tracked as [TD-03](tech-debt.md).

## 4. MANUAL regime

[`src/App.tsx:100-105`](../src/App.tsx).

```
noise  ← U(-0.15, +0.15) × (sensitivity / 10)
next   ← max(0.1, manualEMF + noise)
```

| Control | Range | Source |
| --- | --- | --- |
| `manualEMF` | 0.1 – 20.0 mG, step 0.1 | sidebar slider, [`src/App.tsx:439-448`](../src/App.tsx) |
| `sensitivity` | **1 – 100**, integer | Diagnostics slider, [`src/components/Diagnostics.tsx:53-54`](../src/components/Diagnostics.tsx) |

Resulting noise amplitude: ±0.015 mG at sensitivity 1, ±0.15 mG at the default 10, ±1.5 mG at 100.

> [!IMPORTANT]
> `sensitivity` is a **noise gain**, not a signal gain. It scales the injected jitter only; it never
> scales the operator's commanded baseline. The label ("SENSOR SENSITIVITY GAIN") implies otherwise.
> Note also that the previous README documented this control as 1–20; the shipped range is 1–100.
> Corrected here and in [TD-09](tech-debt.md).

`manualEMF` is capped at 20 mG, so manual mode can reach the 15 mG alarm threshold and the
CRITICAL log severity, but cannot reach the AUTO band's 22 mG ceiling.

## 5. The outbreak state machine

A scripted 15-second crisis event, triggered by the operator
([`src/App.tsx:140-175`](../src/App.tsx)). Re-entrant: the procedure returns early if
`hauntingActive` is already true, and the button is disabled for the duration.

```
        ┌──────────┐   TRIGGER SPECTRAL OUTBREAK   ┌────────────────────────────┐
        │  IDLE    ├──────────────────────────────►│  ACTIVE                    │
        └──────────┘                               │                            │
              ▲                                    │  hauntingActive  = true    │
              │                                    │  isScreenShaking = true    │
              │                                    │  ambientTemp     = 3.2 °C  │
              │                                    │  playHauntingScream()      │
              │                                    │  EMF: §5.1                 │
              │                                    │  glitch phrase every 1.5 s │
              │        t = 15 s (single timeout)   │  radar: +4 Class V blips   │
              └────────────────────────────────────┤  log: CRITICAL breach entry│
                                                   │  haunt probability → 99.8 %│
                                                   │  audio alarm: continuous   │
                                                   └────────────────────────────┘
              on resolution: hauntingActive=false · shake off · glitchText=null
                             ambientTemp=18.5 °C · playDiagnosticBeep(false)
                             Class V blips filtered out of the radar
```

### 5.1 Outbreak signal

```
next ← max(10, 25.0 + 12.0·sin(0.005·t_ms) + U(0, 6))
```

| Property | Value |
| --- | --- |
| Sinusoid period | 2π / 0.005 ms ≈ **1.26 s** |
| Deterministic component | 25 ± 12 → [13, 37] mG |
| Stochastic component | U(0, 6) → +0 to +6 mG |
| Realized range | **13 – 43 mG**, mean ≈ 28 mG |
| Floor at 10 mG | inert — the minimum realized value is 13 |

Unlike the AUTO regime, this is **not** a random walk: it is a deterministic carrier plus additive
jitter. That is the correct choice for a scripted event — the escalation should be shaped, and the
sine gives the overlay, the audio, and the radar a shared rhythm to lock onto.

### 5.2 Emergent artifact: alarm stutter

`AudioController.setEMFLevel` starts the alarm at ≥ 15 mG and **stops it below 15 mG**
([`src/utils/audio.ts:200-202`](../src/utils/audio.ts)). During an outbreak the sine trough
spends ≈ 29 % of each 1.26 s period below 15 mG (`12·sin θ < −10 − U(0,6)`), so the alarm
repeatedly tears down and restarts instead of sustaining.

Audibly this reads as a stuttering klaxon rather than a continuous one — arguably in keeping with
the event, but it is unintentional, and it means `startAlarm`/`stopAlarm` cycle ~12×/s of
oscillator allocation during the trough. Hysteresis (start at 15, stop at 12) is the fix.
Tracked as [TD-05](tech-debt.md).

### 5.3 Timing drift

The inline comment reads `// Stop haunting after 12 seconds`; the `setTimeout` is `15000`
([`src/App.tsx:166`](../src/App.tsx) vs `:174`). **The shipped duration is 15 s.** The comment is wrong
and the resolution timeout is not cancelled on unmount ([TD-04](tech-debt.md)).

## 6. Derived quantities

The engine emits one scalar; four subsystems derive everything else. This section is the
specification of those derivations, because they are what the operator actually reads.

### 6.1 Tri-axis vector decomposition

[`src/components/LiveEMFDisplay.tsx:39-45`](../src/components/LiveEMFDisplay.tsx), sampled at
150 ms.

```
rX ← U(0.3, 0.7)
rY ← U(0.2, 0.5)
rZ ← √( max(0, 1 − rX² − rY²) )

x ← emf·rX      y ← emf·rY      z ← emf·rZ        (each rounded to 2 dp)
```

The ratios are drawn from a sphere-sector parameterization, so by construction
`√(x² + y² + z²) = emf` — the displayed components are consistent with the displayed scalar, which
is the detail a technically literate viewer checks first.

Two properties of the chosen ranges are worth recording:

- `rX² + rY² ≤ 0.49 + 0.25 = 0.74 < 1`, so the `max(0, …)` guard **can never trip**. It is
  defensive, not functional.
- `rZ ∈ [0.51, 0.93]` always, so the vertical component systematically dominates. This is a
  deliberate-feeling bias (field sources below/above the operator) but it is an artifact of the
  range constants, not a modeled effect.

**Dead-band exception:** when `emf ≤ 0.2 mG` the component returns the constant
`{x: 0.1, y: 0.1, z: 0.1}` ([`:29-35`](../src/components/LiveEMFDisplay.tsx)), whose magnitude is
0.173 mG — the norm invariant is broken in the dead band. Cosmetic, but it is the one place the
decomposition is inconsistent with the scalar.

### 6.2 Electric field, RF, and fluctuation rate

| Quantity | Formula | Range at defaults | Source |
| --- | --- | --- | --- |
| Electric field | `emf × U(1.2, 2.0) × sensitivity` V/m | 12 – 20 V/m | [`:54`](../src/components/LiveEMFDisplay.tsx) |
| RF (outbreak) | `U(20, 100) × sensitivity` mW/m² | 200 – 1 000 | [`:59`](../src/components/LiveEMFDisplay.tsx) |
| RF (emf > 15) | `U(5, 30) × sensitivity` mW/m² | 50 – 300 | [`:61`](../src/components/LiveEMFDisplay.tsx) |
| RF (quiet) | `U(0.01, 1.51)` mW/m² | 0.01 – 1.51 | [`:62`](../src/components/LiveEMFDisplay.tsx) |
| Fluctuation rate | `\|emf_t − emf_{t−1}\|` over a 150 ms sample | — | [`:66-68`](../src/components/LiveEMFDisplay.tsx) |
| Microtesla readout | `emf / 10` µT | — | [`:198`](../src/components/LiveEMFDisplay.tsx) |

Assessment, stated plainly:

- **The µT conversion is physically correct.** 1 mG = 0.1 µT, so `emf/10` is right. It is the only
  unit conversion in the codebase that survives scrutiny, and it should stay.
- **The fluctuation rate is mislabelled.** It is `|Δemf|` per 150 ms sample, displayed as `mG/s`.
  The true rate is 6.67× the displayed value. Either divide by 0.15 or relabel as `mG/sample`.
- **The electric field is dimensionally incoherent at high sensitivity.** A 1 mG reading at
  sensitivity 100 displays 120–200 V/m. `sensitivity` should scale displayed noise, not physical
  magnitude.
- **RF applies `sensitivity` in two of three branches.** The quiet branch omits it, so raising
  sensitivity discontinuously jumps the RF readout when crossing the 15 mG threshold.

### 6.3 Anomaly log and haunt probability

[`src/components/AnomalyLog.tsx:53-129`](../src/components/AnomalyLog.tsx). Evaluated on every
`emfLevel` change (~3.3 Hz).

| Threshold | Severity | Type |
| --- | --- | --- |
| > 15 mG | `CRITICAL` | Spectral Breach |
| > 10 mG | `HIGH` | Poltergeist Spike |
| > 5 mG | `MEDIUM` | Anomalous Wave |
| ≤ 5 mG | — (no entry) | — |

Entry fields: timestamp (`toLocaleTimeString`), EMF snapshot, duration `U(1.5, 5.5)` s, and a
message drawn uniformly from a pool of five. Retention: newest-first, capped at **50**.

**Rate limiting.** If the newest entry already has the same severity, the candidate is dropped with
p = 0.6 ([`:88`](../src/components/AnomalyLog.tsx)). Combined with the 3.3 Hz evaluation rate this
is what stops a sustained spike from flooding the terminal.

**Haunt probability index** ([`:105-129`](../src/components/AnomalyLog.tsx)):

```
p ← 1
if emf > 1.5:  p ← p + emf × 2.5
p ← p + 6 × count(entries where severity ∈ {HIGH, CRITICAL})
p ← clamp(round(p), 1, 98)          ; outbreak override: p ← 99.8
```

> [!WARNING]
> This index is a **ratchet**. The severity-count term only grows — entries are never aged out,
> only pushed off by the 50-entry cap — so after ~17 HIGH/CRITICAL entries the index pins at 98 %
> for the rest of the session regardless of current conditions. A probability estimate that cannot
> decrease is not an estimate. Remediation (decay the count, or window it over the last N entries)
> is tracked as [TD-07](tech-debt.md).

### 6.4 Radar contacts

[`src/components/RadarGrid.tsx:90-111`](../src/components/RadarGrid.tsx).

| Parameter | Rule |
| --- | --- |
| Spawn condition | `emf > 12 mG` ∧ ¬outbreak ∧ `U(0,1) < 0.2`, evaluated per tick |
| Spawn rate while elevated | ≈ 0.67 contacts/s |
| Population cap | 8 (`prev.slice(-7)` then append) |
| Intensity | `min(emf/30, 1)` |
| Radius | `4 + emf/5` px |
| Pulse rate | `2 + emf/10` |
| Velocity | `U(-0.002, 0.002)` per axis per frame |
| Boundary | at r > 0.9 → reposition to r = 0.88, velocity reversed and scaled by `U(0.8, 1.2)` |
| Outbreak injection | +4 contacts, intensity `U(0.8, 1.0)`, velocity ±0.005, type `Class V Apparition`; removed when the outbreak resolves |

Sweep and detection geometry:

| Quantity | Value |
| --- | --- |
| Sweep rate | 0.015 rad/frame → 0.9 rad/s → **6.98 s per revolution** at 60 fps |
| Outbreak sweep rate | 0.04 rad/frame → 2.4 rad/s → **2.62 s per revolution** |
| Illumination window | \|Δθ\| < 0.1 rad → ≈ 7 frames ≈ 110 ms per revolution |
| Range scale | normalized radius × **15 m** |
| Bearing | `atan2(y, x)` in degrees, mod 360 |

> [!WARNING]
> Blip physics are advanced by calling `setBlips` **inside the `requestAnimationFrame` callback**,
> and the boundary rule mutates `blip.speedX`/`speedY` in place on a state object
> ([`:201-202`](../src/components/RadarGrid.tsx)). The `blips` array is never read during render —
> ESLint reports it as an unused binding — so this is per-frame React reconciliation that produces
> no rendered output. Full analysis and fix in [Performance §4.1](performance.md#41-defect-per-frame-react-writes-in-the-radar-loop).

### 6.5 Triangulation nodes

[`src/components/TriangulationMap.tsx:64-118`](../src/components/TriangulationMap.tsx). Three
preset locations, 4/3/3 nodes respectively, each typed `EMF`, `TEMP`, or `MOTION`.

| Node type | Quiet rule | Elevated rule (emf > 5 / > 8) | Outbreak |
| --- | --- | --- | --- |
| `EMF` | `U(0.4, 1.2)` | `emf × U(0.6, 1.0)` | `U(15, 25)` |
| `TEMP` | `temp + U(-0.2, 0.2)` | `temp + U(-0.2, 0.2) − 0.2` | `max(1, temp − U(0.5, 1.3))` |
| `MOTION` | `P(trigger) = 0.03` | `P(trigger) = 0.3` | `P(trigger) = 0.7` |

> [!CAUTION]
> **This loop does not run.** The effect's dependency array is `[emfLevel, hauntingActive,
> selectedNode]`, and `emfLevel` changes every 300 ms — so the cleanup clears the 1 000 ms interval
> before its first callback fires. Node readings are therefore **frozen at their initial values**
> for as long as the engine ticks. Reproduce: open the Triangulation tab and compare a node's
> magnetic load against the header EMF reading — the header moves, the node does not.
> This is the most user-visible defect in the repository. Evidence and fix in
> [TD-02](tech-debt.md); the general pattern is described in
> [CONTRIBUTING §4.2](../CONTRIBUTING.md#42-effects-and-lifecycle).

`TEMP` also has no mean reversion: during sustained elevated EMF it drifts downward without bound
(−0.2 °C per 1 s tick), so a long session leaves the node reading implausibly cold. The outbreak
branch floors at 1 °C; the quiet branch has no floor.

## 7. Proposed extraction: `createEmfEngine(seed)`

The engine is pure except for two things: `Math.random()` and the audio side effect. Removing both
makes it testable and reproducible, which unblocks the entire test strategy in
[Testing §3](testing.md#3-the-seedability-blocker). Target shape:

```ts
// src/simulation/emfEngine.ts  (proposed — not yet implemented)
export type EngineMode = 'auto' | 'manual' | 'outbreak';

export interface EngineInput {
  mode: EngineMode;
  manualEMF: number;      // mG, used in 'manual'
  sensitivity: number;    // 1–100, noise gain
}

export interface EngineState {
  readonly emf: number;   // mG, clamped [0.2, 95]
  readonly tick: number;  // monotonic tick counter
}

export interface EmfEngine {
  /** Advance one 300 ms tick. Pure: same (state, input, rng) → same result. */
  step(input: EngineInput): EngineState;
  /** Force the scripted crisis event for `durationMs`. */
  beginOutbreak(durationMs?: number): void;
  readonly state: EngineState;
}

export function createEmfEngine(rng: () => number = Math.random, seedState?: EngineState): EmfEngine;
```

Design constraints for the extraction:

1. **Inject the RNG.** `step` must not call `Math.random` directly; the factory takes `rng`. A
   seeded PRNG (mulberry32 is enough — 10 lines) makes traces replayable.
2. **Keep the tick pure.** Audio, React state, and DOM stay out. `App.tsx` calls
   `audioService.setEMFLevel(engine.state.emf)` *after* `step`, fixing [TD-03](tech-debt.md) as a
   side effect of the move.
3. **Freeze the constants.** Export them as a named object (`ENGINE_CONSTANTS`) so tests assert
   against the same values the UI uses, and so the [tuning table](#8-tuning-reference) has one
   source of truth.
4. **Preserve the regime boundaries exactly.** `3.0`, `0.03`, `0.10`, `0.2`/`95` are load-bearing;
   a behaviour-preserving refactor must reproduce the same distributions. The tests in
   [Testing §4.1](testing.md#41-engine-specifications) are written against those numbers.

## 8. Tuning reference

Every constant that shapes feel, in one table. Change these, not the surrounding code.

| Constant | Value | Location | Turning it up does |
| --- | --- | --- | --- |
| Tick period | 300 ms | `App.tsx:134` | Faster trace, more renders; below ~150 ms the walk becomes jittery rather than alive |
| Quiet-band step | ±0.2 mG | `App.tsx:114` | Baseline drifts visibly; spikes lose contrast |
| Quiet-band threshold | 3.0 mG | `App.tsx:112` | Widens the still band; too high and spikes decay before they register |
| Moderate spike p | 0.03 | `App.tsx:116` | More frequent events; above ~0.08 the log saturates and the ratchet in §6.3 pins |
| Moderate spike range | 5 – 13 mG | `App.tsx:117` | Crosses the 15 mG alarm threshold above ~15 |
| Decay step | 0.3 – 0.8 mG | `App.tsx:121` | Slower decay = longer, more menacing excursions |
| High spike p | 0.10 | `App.tsx:123` | Cascade frequency; drives alarm duty cycle |
| High spike range | 12 – 22 mG | `App.tsx:124` | Upper bound sets the practical ceiling |
| Clamp | 0.2 – 95 mG | `App.tsx:129` | Defensive only; unreachable at current ranges |
| Manual noise gain | ±0.15 × sens/10 | `App.tsx:102` | Sensor-noise realism in manual mode |
| Outbreak carrier | 25 ± 12 mG @ 1.26 s | `App.tsx:92-94` | Crisis intensity and rhythm |
| Outbreak duration | 15 s | `App.tsx:174` | Escalation window; the 12 s comment is stale |
| Glitch rotation | 1.5 s / 6 phrases | `App.tsx:151-164` | Overlay text cadence |
| Derived-field sample | 150 ms | `LiveEMFDisplay.tsx:69` | Readout responsiveness; below ~100 ms the numbers become unreadable |
| Log retention | 50 entries | `AnomalyLog.tsx:92` | History depth; interacts with the probability ratchet |
| Log dedupe p | 0.6 | `AnomalyLog.tsx:88` | Terminal noise floor |
| Radar spawn p | 0.2 (emf > 12) | `RadarGrid.tsx:91` | Contact density |
| Radar cap | 8 contacts | `RadarGrid.tsx:105-108` | Above ~12 the labels overlap |
| Sweep rate | 0.015 rad/frame | `RadarGrid.tsx:160` | Revolution period; raise with the outbreak multiplier |
| Alarm threshold | 15 mG | `audio.ts:199-202` | See the hysteresis note in §5.2 |

---

**Next:** [Audio Synthesis](audio-synthesis.md) — how the same scalar drives the sound.
