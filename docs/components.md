# Component Reference

| | |
| --- | --- |
| **Audience** | Anyone adding, changing, or reviewing a component |
| **Status** | Accurate as of commit `102e524` |
| **Companion** | [API Reference](api.md) (prop and type contracts) · [Architecture §3](architecture.md#3-state-ownership) (who owns what) |

Nine components in [`src/components/`](../src/components), plus the application shell in
[`src/App.tsx`](../src/App.tsx). Every one follows the same contract: **named export, explicit
`Props` interface, no default export, no inter-component imports.**

---

## 1. At a glance

| Component | Lines | Props | Local state | Effects | Timers | Canvas | Audio | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SystemBoot` | 201 | 2 | 5 | 0 | 1 chain | — | `init`, `playPowerUp` | ⚠ uncancellable chain |
| `LiveEMFDisplay` | 349 | 4 | 4 | 2 | 150 ms | 280×110 | — | ✓ (effect churns) |
| `RadarGrid` | 425 | 3 | 3 | 4 | — | 300×300 | — | ✓ (but per-frame setState) |
| `AnomalyLog` | 285 | 3 | 3 | 4 | — | — | — | ✓ |
| `TriangulationMap` | 292 | 3 | 3 | 2 | 1 s | — | — | ✓ (interval starved) |
| `EVPRecorder` | 302 | 1 | 7 | 2 | 1 s + 250 ms + 3 s | 320×120 | 3 methods | ⚠ 2 timers leak |
| `EntityDatabase` | 195 | 1 | 1 | 0 | — | — | — | n/a (static) |
| `Diagnostics` | 162 | 5 | 0 | 0 | 2 × `setTimeout` | — | `playDiagnosticBeep` | ⚠ uncleared |
| `DeviceSpecs` | 98 | 2 | 0 | 0 | — | — | — | n/a (static) |
| `App` (shell) | 522 | — | 16 | 4 | 100 ms, 5 s, 300 ms, 1.5 s, 15 s | — | 4 methods | ⚠ outbreak timers |

**2 841 lines of TSX, 3 381 lines of source total** (including 461 lines of audio and 79 of CSS).

Legend: ✓ correct teardown · ⚠ documented defect, see the [Tech-Debt Register](tech-debt.md) ·
— none present.

## 2. Application shell — `App.tsx`

| | |
| --- | --- |
| **Responsibility** | Simulation engine, layout, tab router, header/footer chrome, outbreak orchestration |
| **State** | 16 variables — the complete list is in [Architecture §3](architecture.md#3-state-ownership) |
| **Effects** | clock + GPS (100 ms / 5 s), simulation tick (300 ms), mute sync, volume sync |
| **Renders** | boot gate *or* console: header → tab bar → 4-column grid (3 content + 1 sidebar) → footer |

Layout is a Tailwind grid: `xl:grid-cols-4`, with the tab content taking `xl:col-span-3` and a
persistent sidebar (`GHOST_SIMULATOR_CORE` + `EMF_REFERENCE_INDEX`) taking the fourth column. Below
`xl` the sidebar stacks under the content. Tabs are **conditionally mounted**, not hidden — switching
tabs unmounts the previous panel, so per-tab state (log entries, radar contacts, EVP progress) is
**lost on navigation**. That is a deliberate trade (only one canvas loop runs at a time) with a real
UX cost; see [Roadmap X8](roadmap.md#7-exploration).

Decorative layers, all pure CSS, stacked by `z-index`:

| Layer | z | Implementation |
| --- | --- | --- |
| CRT scanlines | 50 | two layered `linear-gradient`s at `100% 4px` and `3px 100%` — no image, no SVG |
| Outbreak overlay | 40 | fixed red border + `animate-pulse` + glitch phrase |
| Header / nav / footer | 30 | `bg-zinc-950/80 backdrop-blur-md` |
| Content | 20 | main grid |
| Ambient glow | 0 | `radial-gradient` tinted by `accentColor`, red during an outbreak |

The scanline overlay is the clearest example of the
[zero-asset rule](decisions/0004-zero-runtime-assets.md): a CRT effect built from two gradients and
a background-size, costing 0 bytes and no decoding.

> [!NOTE]
> The root container carries `select-none`, which blocks text selection across the entire
> application. It reinforces the "this is hardware, not a webpage" reading, and it is an
> accessibility problem. Both facts are recorded in [Accessibility §3](accessibility.md#3-wcag-22-findings).

## 3. `SystemBoot`

| | |
| --- | --- |
| **Props** | `onBootComplete: () => void`, `accentColor: string` |
| **State** | `logs: string[]`, `isPoweringOn`, `isBooted` (local), `progress`, `currentStep` (**dead**) |
| **Audio** | `init()` + `playPowerUp()` on the power-button click |
| **Timers** | recursive `setTimeout` chain, 12 steps, 3.70 s total + 1.0 s dwell |

The render gate for the whole application: `App` returns `<SystemBoot>` while `isBooted === false`,
so nothing else mounts — and no engine timer runs — until the operator acts.

The POST script is data, not code: a 12-entry array of `{ log, delay }`
([`:17-30`](../src/components/SystemBoot.tsx)) drives the chain, so re-pacing the boot is a data
edit. Total gate time ≈ 4.7 s.

```
power click ──► audioService.init()      [first user gesture → AudioContext permitted]
            ──► audioService.playPowerUp()
            ──► addNextLog() recursively:
                  append logs[step] · progress = round((step+1)/12 × 100)
                  setTimeout(step+1, bootSteps[step].delay)
            ──► after step 12: isBooted(local) = true
            ──► +1.0 s: onBootComplete()
```

Two fidelity notes worth knowing before you touch this component:

- **Timestamps are rendered, not recorded.** Each log line prints
  `new Date().toLocaleTimeString()` at render time ([`:146`](../src/components/SystemBoot.tsx)), so
  all twelve lines display the *current* clock and every line's timestamp changes on each
  re-render. Capturing the time when the step is appended would make the POST log read as a real
  log.
- **The chain cannot be cancelled.** No timer handle is retained, so the sequence runs to
  completion even if the component unmounts mid-boot ([TD-04](tech-debt.md)).

## 4. `LiveEMFDisplay`

| | |
| --- | --- |
| **Props** | `emfLevel`, `sensitivity`, `hauntingActive`, `accentColor` |
| **State** | `magneticVector {x,y,z}`, `electricField`, `rfField`, `fluctuationRate` |
| **Refs** | `canvasRef`, `prevEMFRef` (last EMF sample), `waveOffsetRef` (frame-loop phase) |
| **Effects** | derived-field sampler (150 ms), canvas frame loop |

Three panels in a `md:grid-cols-3`: the primary gauge, the tri-axis decomposition, and the
oscilloscope with auxiliary E-field/RF readouts. Full derivation maths in
[Simulation Engine §6.1-6.2](simulation-engine.md#61-tri-axis-vector-decomposition).

**Severity colouring** — three thresholds, applied consistently to text, border, and the segment bar:

| EMF | Text | Border | Label |
| --- | --- | --- | --- |
| < 2.5 mG | `emerald-500` | `emerald-500/20` | SAFE / BACKGROUND |
| < 10.0 mG | `amber-500` | `amber-500/30` | ANOMALOUS ACTIVITY |
| ≥ 10.0 mG | `red-500` | `red-500/40 animate-pulse` | CRITICAL OUTBREAK |

**Segment bar:** 15 segments, each lighting at `(i+1) × 1.5 mG`, spanning 0–22.5 mG
([`:213-229`](../src/components/LiveEMFDisplay.tsx)). The inline comment says "10 segmented
blocks"; the code renders 15. The 22.5 mG ceiling is deliberate — it matches the AUTO regime's
22 mG practical maximum, so the bar can just barely fill.

**Oscilloscope:** the frame loop composes a carrier with an optional high-frequency overlay:

```
amp  ← min(emf × 1.5, height/2.2)          phase ← hauntingActive ? +0.25 : +0.08 per frame
freq ← 0.03 + min(emf × 0.002, 0.1)
y(x) ← h/2 + sin(x·freq + phase)·amp
       + [emf > 5]  sin(x·0.2 + phase·3)·amp·0.2  +  U(-0.5,0.5)·emf·0.2
```

The amplitude is clamped to `height/2.2` so the trace can never leave the viewport at 43 mG, and
the noise term only appears above 5 mG — below that the wave is clean, which is what makes spike
onset legible. Three HUD strings are drawn onto the canvas rather than the DOM (`SWEEP`, `GAIN`,
`TRIG`), keeping the frame loop's output self-contained.

> [!WARNING]
> The frame loop's dependency array is `[emfLevel, sensitivity, hauntingActive, accentColor]`, and
> `emfLevel` changes every 300 ms — so the loop is torn down and rebuilt 3.3×/s
> ([`:156`](../src/components/LiveEMFDisplay.tsx)). The phase is preserved in `waveOffsetRef`, so
> the visual result is correct; the cost is a `cancelAnimationFrame` + closure allocation + first
> frame of a fresh context every tick. Reading `emfLevel` from a ref updated by a separate effect
> would let the loop mount once. See [Performance §4.2](performance.md#42-defect-frame-loops-rebuild-on-every-tick).

## 5. `RadarGrid`

| | |
| --- | --- |
| **Props** | `emfLevel`, `hauntingActive`, `accentColor` |
| **State** | `blips: RadarBlip[]`, `isScanning`, `detectedEntities: RadarBlip[]` |
| **Refs** | `canvasRef`, `angleRef` (sweep angle), `blipIdRef` (monotonic id) |
| **Effects** | seed contacts, outbreak inject/purge, spike spawn, frame loop |

A 300×300 canvas clipped to a circle, plus a DOM contact list and two status tiles. Contact physics
and spawn rules: [Simulation Engine §6.4](simulation-engine.md#64-radar-contacts).

**Four layers per frame**, in paint order: translucent-black fill (trail) → range rings and
crosshairs → sweep line + radial-gradient trail wedge → contacts → centre pip → outer bezel.

**Sweep illumination.** A contact is drawn only when the sweep has just passed it:
`|θ_sweep − θ_blip| < 0.1 rad`, ≈ 7 frames ≈ 110 ms of the 6.98 s revolution. Because the canvas
clears with `rgba(0,0,0,0.15)` rather than `clearRect`, the contact then decays exponentially over
~15 frames — the phosphor persistence that makes it read as a radar rather than as dots.

**FREEZE / SWEEP.** Toggling `isScanning` stops the sweep angle from advancing and forces
`isSwept = true`, so all contacts render continuously. Note precisely what freezes: the *beam*, not
the *contacts* — blip physics keep integrating, so targets keep drifting while the sweep is held.

> [!WARNING]
> Two defects live in the frame loop, both documented with fixes:
> 1. `setBlips` ([`:188`](../src/components/RadarGrid.tsx)) and `setDetectedEntities`
>    ([`:264`](../src/components/RadarGrid.tsx)) run **every frame**. `blips` is never read during
>    render (ESLint flags it as an unused binding), so the reconciliation produces nothing —
>    [TD-01](tech-debt.md), [Performance §4.1](performance.md#41-defect-per-frame-react-writes-in-the-radar-loop).
> 2. The boundary rule mutates `blip.speedX`/`speedY` **in place on a state object**
>    ([`:201-202`](../src/components/RadarGrid.tsx)) before returning a shallow copy — the mutation
>    escapes the copy, which is what `react-hooks/immutability` reports.

One behavioural inconsistency worth knowing: the DOM contact list is populated from *all* contacts
inside r < 0.9 ([`:244-246`](../src/components/RadarGrid.tsx)), independent of whether the sweep
illuminated them. So the list shows contacts the screen has not yet painted. Gating the list on the
same `isSwept` test would make the two agree.

## 6. `AnomalyLog`

| | |
| --- | --- |
| **Props** | `emfLevel`, `hauntingActive`, `accentColor` |
| **State** | `logs: LogEntry[]`, `hauntProbability`, `filterSeverity` |
| **Exports** | `LogEntry` — the only domain type exported from a component |
| **Effects** | seed 3 entries, spike→entry, outbreak entry, probability recompute |

Severity classification, dedupe, and the probability index are specified in
[Simulation Engine §6.3](simulation-engine.md#63-anomaly-log-and-haunt-probability).

Seeded with three back-dated entries (−5 min, −3 min, −1 min) so the terminal is never empty on
first paint — a small thing that does a lot of work for believability.

Controls: five filter chips (`ALL` / `LOW` / `MEDIUM` / `HIGH` / `CRITICAL`) filtering the rendered
list only, and **Clear Terminal**, which empties all 50 retained entries with no confirmation and no
undo. Because the haunt probability depends on the count of HIGH/CRITICAL entries, clearing the
terminal also resets the index — an emergent coupling between a UI affordance and a derived metric.

> [!NOTE]
> Two readouts in the threat-assessment card are **static literals**, not live values: tracker
> uptime `00:14:52:09` ([`:223`](../src/components/AnomalyLog.tsx)) and buffer state
> `100% SECURE`. They are set dressing. If either is ever wired to real state, uptime should derive
> from the boot timestamp.
>
> Entry ids use `Math.random().toString()` ([`:77`](../src/components/AnomalyLog.tsx)). Collision
> probability across 50 entries is negligible but nonzero, and a collision means duplicate React
> keys. A counter ref (the pattern `RadarGrid` already uses with `blipIdRef`) is strictly better.

## 7. `TriangulationMap`

| | |
| --- | --- |
| **Props** | `emfLevel`, `hauntingActive`, `accentColor` |
| **State** | `selectedLocation`, `nodes: SensorNode[]`, `selectedNode` |
| **Effects** | location → node initialization, 1 s fluctuation loop (**starved**) |

Three preset locations with 4 / 3 / 3 nodes; each node is typed `EMF`, `TEMP`, or `MOTION` and
positioned by percentage on an SVG floorplan. Rules in
[Simulation Engine §6.5](simulation-engine.md#65-triangulation-nodes).

The floorplan is inline SVG with `viewBox="0 0 100 100"` and `preserveAspectRatio="none"` — an outer
wall rect plus four dashed dividers, tinted with `accentColor` at 25 % opacity. Node markers are real
`<button>` elements, so they are keyboard-focusable and clickable without extra work; marker colour
encodes state (motion → red `animate-ping`, EMF > 10 → red, > 2.5 → amber, else emerald).

> [!CAUTION]
> The fluctuation loop **never runs**: its dependency array `[emfLevel, hauntingActive,
> selectedNode]` changes every 300 ms while the interval period is 1 000 ms, so cleanup always wins.
> Node readings are frozen at their seeded values. This is the most user-visible defect in the
> repository — [TD-02](tech-debt.md).
>
> A second defect sits inside the same loop: `setSelectedNode` is called from within the
> `setNodes` updater ([`:111`](../src/components/TriangulationMap.tsx)), i.e. a side effect inside a
> state updater. `<StrictMode>` double-invokes updaters, so this fires twice per tick in development.

The location `<select>` ([`:131`](../src/components/TriangulationMap.tsx)) has no associated label —
the `MapPin` icon beside it is not a label. See [Accessibility §3](accessibility.md#3-wcag-22-findings).

## 8. `EVPRecorder`

| | |
| --- | --- |
| **Props** | `accentColor` only — the sole instrument module **not** driven by `emfLevel` |
| **State** | `isRecording`, `isDemodulating`, `hasRecording`, `playbackActive`, `decryptedMessage`, `demodulateProgress`, `evpTimer` |
| **Audio** | `setEVPActive`, `playDiagnosticBeep`, `playHauntingScream` |
| **Canvas** | 320×120 waveform |

### 8.1 Workflow

```
   IDLE ──RECORD EVP──► RECORDING ──STOP (or 10 s cap)──► RECORDED
    ▲                        │                                │
    │                        │                     DEMODULATE │  PLAYBACK
    │                        ▼                                ▼        ▼
    │               (auto-stop at evpTimer = 10)        DEMODULATING  PLAYING (3 s)
    │                                                   250 ms × 10        │
    │                                                        │             │
    │                                            p = 0.75    │   p = 0.25  │
    │                                                ▼       ▼             │
    │                                     phrase from pool   "NO COHERENT  │
    │                                     + whisper sting     SPECTRUM     │
    │                                                │        FOUND"       │
    └────────────────────────────────────────────────┴─────────────────────┘
                              (RECORD resets message + hasRecording)
```

| Stage | Duration | Mechanism |
| --- | --- | --- |
| Record | up to 10 s | 1 s interval, auto-stop at 10 ([`:107-116`](../src/components/EVPRecorder.tsx)) |
| Demodulate | 2.5 s | 250 ms interval, progress += 10 ([`:150-172`](../src/components/EVPRecorder.tsx)) |
| Decode | — | `p = 0.75` message from an 8-phrase pool, else static-only string |
| Playback | 3 s | single `setTimeout` ([`:180-183`](../src/components/EVPRecorder.tsx)) |

Button enablement is a genuine state machine, enforced by `disabled` props: DEMODULATE and PLAYBACK
require `hasRecording` and are blocked during recording, demodulation, or playback; RECORD is blocked
during demodulation or playback.

> [!IMPORTANT]
> **Nothing is recorded.** There is no `getUserMedia`, no `MediaRecorder`, no `AudioWorklet` — the
> application never requests microphone access (verified: zero occurrences in `src/`).
> `hasRecording` is a boolean flag, and the "recording" is a waveform animation driven by
> `isRecording`. This is the honest reading of the diegesis: the EVP recorder is a *prop*, and the
> privacy implications are nil. Stated explicitly in [SECURITY.md](../SECURITY.md) because a
> component named "recorder" invites the opposite assumption.

The waveform has three visual modes ([`:56-77`](../src/components/EVPRecorder.tsx)): recording
(amp 30, freq 0.08, per-pixel jitter), playback (amp 25, two summed sinusoids + jitter), and standby
(amp 5, near-flat noise). Phase advance is 0.3/frame while recording and 0.05/frame otherwise.

Two defects: the demodulation interval and the playback timeout are not cleared on unmount, so
switching tabs mid-decode leaves a timer calling `setState` on an unmounted component
([TD-04](tech-debt.md)); and the record timer's updater calls `handleStopRecording` — a function
declared *below* the effect — from inside a state updater
([`:110-113`](../src/components/EVPRecorder.tsx)), which is what `react-hooks/immutability` reports.

## 9. `EntityDatabase`

| | |
| --- | --- |
| **Props** | `accentColor` |
| **State** | `selectedEntity: string` (by name) |
| **Effects / timers / audio** | none — the only fully static component |

A master–detail field guide over a four-entry `Entity[]` literal: an index list on the left, a
profile inspector on the right. Selection is by `name` with a `|| entities[0]` fallback
([`:86`](../src/components/EntityDatabase.tsx)), so an unmatched name degrades gracefully rather
than throwing.

| Entity | Class | Danger | EMF profile | Thermal | RF |
| --- | --- | --- | --- | --- | --- |
| Spirit | I Residual Apparition | LOW | 2.5 – 5.0 mG [stable] | 12 – 15 °C slow drift | low static |
| Wraith | II Poltergeist Breed | MEDIUM | 5.0 – 10.0 mG [fluctuating] | 5 – 8 °C cold spots | EVP whispers @ 1200 Hz |
| Poltergeist | III Kinetic Manifestation | HIGH | 10.0 – 18.0 mG [X/Y spikes] | < 3 °C | white-noise bursts |
| Oni | IV Demonic Apparition | EXTREME | 18.0+ mG [saturated tri-axis] | < 0 °C | screaming EVP |

> [!NOTE]
> The class bands in this table are the same thresholds the engine uses for log severity
> (>5 / >10 / >15 mG) and the sidebar's `EMF_REFERENCE_INDEX`. That alignment is intentional: the
> field guide is documentation for the simulation's own classification logic. If you change a
> threshold in [Simulation Engine §6.3](simulation-engine.md#63-anomaly-log-and-haunt-probability),
> change it here and in the sidebar too.
>
> Diegetic inconsistency, for the record: the boot log announces a database of **142 entities**
> ([`SystemBoot.tsx:28`](../src/components/SystemBoot.tsx)); four ship.

## 10. `Diagnostics`

| | |
| --- | --- |
| **Props** | `sensitivity` + setter, `ambientTemp` + setter, `accentColor` — the only lifted-control pair besides `DeviceSpecs` |
| **State / effects** | none |
| **Audio** | `playDiagnosticBeep` on self-test and on every sensitivity change |

Two calibration sliders and a self-test button on the left; a static environment/health panel on the
right.

| Control | Range | Step | Notes |
| --- | --- | --- | --- |
| Sensor sensitivity gain | **1 – 100** | 1 | Scales manual-mode noise ([Simulation Engine §4](simulation-engine.md#4-manual-regime)) and the E-field/RF readouts. Fires a beep **per input event** |
| Ambient baseline temp | 0 – 35 °C | 0.1 | Cosmetic: read back only in this panel; overridden to 3.2 °C during an outbreak and restored to 18.5 °C after |
| Run sensor self-test | — | — | three beeps at 0 / 150 / 300 ms via `setTimeout` ([`:21-25`](../src/components/Diagnostics.tsx)) |

Static readouts (all literals, none derived): infrasound `17.4 Hz`, cold-spot index (derived from
`ambientTemp < 10` — this one *is* live), magnetometer `100% OK`, Geiger tube `ACTIVE // OK`, RF core
`TUNED`, micro-barometer `1013.2 hPa`.

> [!WARNING]
> `playDiagnosticBeep(true)` is wired to the sensitivity slider's `onChange`
> ([`:56-58`](../src/components/Diagnostics.tsx)). A range input fires `onChange` on every step, so
> dragging across the 1–100 range allocates ~100 overlapping 1 800 Hz oscillators in under a second.
> It is audible as a harsh machine-gun stutter. Debounce it, move it to `onPointerUp`/`onChange`
> commit, or drop the beep for continuous controls. [TD-14](tech-debt.md).
>
> The ambient-temperature slider correctly omits the beep — that is the pattern to copy.

## 11. `DeviceSpecs`

| | |
| --- | --- |
| **Props** | `accentColor` + setter |
| **State / effects / audio** | none |

A fictional hardware matrix and the theme selector. Four themes
([`:10-15`](../src/components/DeviceSpecs.tsx)):

| Theme | Hex | |
| --- | --- | --- |
| Ecto-Green | `#10b981` | default; Tailwind `emerald-500` |
| Phantom-Blue | `#06b6d4` | `cyan-500` |
| Poltergeist-Red | `#ef4444` | `red-500` — identical to the outbreak alarm colour, so the theme loses its warning contrast |
| Aether-Violet | `#a855f7` | `purple-500` |

`accentColor` propagates to all nine components: canvas strokes and shadows, SVG floorplan strokes,
segment-bar glows, icon tints, progress fills, and radial ambient gradients. It is passed as a hex
string and used directly in `rgba`/`shadow` template literals — which works because the canvas code
appends alpha hex pairs (`${accentColor}44`), a convention that only holds for 6-digit hex. Any
future theme value must stay 6-digit hex, or every canvas alpha composite breaks.

Spec sheet, for the record: `MODEL AETHER-V9 PRO` · `FIRMWARE v4.09.2-SPECTRAL` ·
`MAGNETOMETER LIS3MDL Tri-axis` · `GEIGER TUBE LND-712 Core` · `SPECTRAL RANGE 0.1 Hz – 18.4 GHz`.

> [!NOTE]
> Both part numbers are real devices — the ST LIS3MDL magnetometer and the LND 712 Geiger–Müller
> tube — which is exactly why they were chosen: real components make fictional performance claims
> land. For accuracy's sake, neither supports the stated range; the LIS3MDL's full scale tops out at
> ±16 gauss and it has no RF capability whatsoever.
>
> The firmware string appears in three variants across the UI — `AETHER_OS v4.09` (boot),
> `v4.09.2-SPECTRAL` (specs), `SPECTRAL_OS_v4.09` (footer). Harmless, but it is the kind of detail a
> careful viewer notices. Consolidating it into one constant is a two-line change.

## 12. Adding a component

The checklist that follows from everything above:

1. **Named export, explicit `Props` interface**, one component per file in `src/components/`.
2. **Accept `accentColor`** if it renders any chrome — theming is universal.
3. **Take physical quantities as props.** Never compute a shared quantity locally; if it needs to be
   shared, it belongs in `App.tsx` ([ADR-0001](decisions/0001-single-source-of-truth.md)).
4. **Mount it in `App.tsx`** under the right tab. Do not import it from another component.
5. **Clean up every timer and frame loop in the same effect that created it** — the existing
   exceptions are all registered as [TD-04](tech-debt.md); do not add to them.
6. **Never call a React setter from inside a `requestAnimationFrame` callback**
   ([ADR-0002](decisions/0002-two-rendering-domains.md)). Accumulate in refs; commit at coarse
   intervals only if the DOM genuinely needs the value.
7. **Never call `setState` from inside another `setState` updater.** Updaters must be pure.
8. **Route sound through `audioService`** with a semantic method
   ([Audio Synthesis §8](audio-synthesis.md#8-adding-a-sound)). No `AudioContext` in components.
9. **Label your controls.** `<button>` needs text or `aria-label`; `<select>` and `<input>` need an
   associated `<label>` or `aria-label`. The current count of ARIA attributes in the codebase is
   zero — see [Accessibility](accessibility.md).
10. **Add no assets.** Icons from `lucide-react`, effects from CSS and canvas
    ([ADR-0004](decisions/0004-zero-runtime-assets.md)).

---

**Next:** [API Reference](api.md) — the contracts these components implement.
