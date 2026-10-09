# Audio Synthesis

| | |
| --- | --- |
| **Audience** | Contributors touching `src/utils/audio.ts`, or adding any sound |
| **Status** | Accurate as of commit `102e524` |
| **Primary source** | [`src/utils/audio.ts`](../src/utils/audio.ts) — 461 lines, one class, one exported singleton |
| **Companion** | [API · AudioController](api.md#1-audiocontroller) · [ADR-0003](decisions/0003-audio-as-a-module-singleton.md) · [ADR-0004](decisions/0004-zero-runtime-assets.md) |

**There are no audio files in this repository.** Every sound — the mains hum, the Geiger crackle,
the radio static, the alarm, the boot sweep, the outbreak scream — is synthesized at runtime from
`OscillatorNode`s and one procedurally generated noise buffer. This document specifies the graph,
the parameter mappings, and where those mappings disagree with the signal they are driven by.

---

## 1. Why synthesize

| Alternative | Rejected because |
| --- | --- |
| Sampled SFX (`.mp3`/`.wav`) | Assets to license, host, version, and preload. A 30-click Geiger loop either repeats audibly or costs megabytes. |
| Pre-rendered stems per EMF level | Cannot respond continuously. The whole point is that pitch, cutoff, and click *rate* track a live scalar. |
| Web Audio synthesis | Zero bytes shipped, continuous parameter control, and the sound is defined by ~200 lines that a reader can audit. |

The decision is recorded in [ADR-0004](decisions/0004-zero-runtime-assets.md). The practical
consequence: the production bundle contains **no media of any kind** — see the measured numbers in
[Performance §2](performance.md#2-measured-bundle).

## 2. Graph topology

```
                                  AudioController (module singleton)
                                                │
                            init() ── first user gesture only ──┐
                                                                ▼
                                                          AudioContext
                                                                │
   CONTINUOUS VOICES (created once, modulated forever)          │
   ─────────────────────────────────────────────────────────    │
   humOsc [sawtooth]                                            │
     55 Hz ──► humFilter [lowpass Q=5] ──► humGain ─────────────┤
                 120 Hz                        0.02             │
                                                                │
   staticBufferSource [2 s white noise, loop]                   │
     ──► staticFilter [bandpass Q=1] ──► staticGain ────────────┤
            1000 Hz                       0.005                 │
                                                                │
   ONE-SHOT VOICES (fresh subgraph per event, then GC'd)        │
   ─────────────────────────────────────────────────────────    │
   Geiger click  [triangle] ─► [bandpass 1500] ─► [gain] ───────┤
   alarm beep    [sine]     ────────────────────► [gain] ───────┤
   diag. beep    [sine]     ────────────────────► [gain] ───────┤
   power-up      [sawtooth] ─► [lowpass] ─► [gain] ─────────────┤
                 [sine ×3 gated tones] ─► [gain] ───────────────┤
   power-down    [sawtooth] ─► [lowpass] ─► [gain] ─────────────┤   (never invoked)
   scream        [sawtooth] ◄─FM─ [sine LFO] ─► [peaking Q=8]   │
                                            ─► [gain] ─────────┤
                                                                ▼
                                                        ctx.destination
```

> [!IMPORTANT]
> **There is no master bus.** Every voice connects directly to `ctx.destination`, and `volume` is
> applied by multiplying each voice's gain in JavaScript. Three consequences:
> 1. Muting requires touching each voice individually (`setMute` zeroes the two continuous gains
>    and stops the alarm; one-shots are suppressed by the `isMuted` guard at creation).
> 2. There is no single point to insert a `DynamicsCompressorNode`, so simultaneous transients
>    (click + alarm beep + scream) sum unmanaged at the destination.
> 3. Volume changes do not affect voices already in flight — they take effect from the next
>    scheduled event.
>
> Inserting a `masterGain → compressor → destination` bus is a small, high-value change. Tracked as
> [TD-10](tech-debt.md).

### 2.1 Continuous vs one-shot

Two distinct lifetime strategies, chosen deliberately:

| | Continuous (hum, static) | One-shot (click, beep, alarm, scream, sweeps) |
| --- | --- | --- |
| Node lifetime | Page lifetime | 20 ms – 3.6 s |
| Parameter change | `setTargetAtTime(value, t, τ)` — exponential approach on the audio thread | `setValueAtTime` / `exponentialRampToValueAtTime` — scheduled envelope |
| Allocation | Once, in `init()` | Per event; released when the source stops |
| Why | Modulated ~3.3×/s; must never click or re-trigger | Short, percussive, envelope-shaped |

`setTargetAtTime` with τ = 0.1–0.3 s is the reason the 300 ms tick granularity is inaudible: the
audio thread interpolates between ticks, so a stepped scalar arrives as a smooth glide.

### 2.2 The noise buffer

[`src/utils/audio.ts:78-96`](../src/utils/audio.ts) generates **2 seconds** of mono white noise
(`Math.random() * 2 - 1`) once, and loops it forever through a bandpass. Looping a 2 s buffer is
inaudible here because the bandpass is narrow (Q = 1) and the level is low (≤ 0.028); widening the
filter or raising the gain would expose the loop point, at which case the buffer should be
lengthened or replaced with a `ScriptProcessor`-free noise generator.

## 3. Initialization and the autoplay contract

```
constructor()          → does nothing (no AudioContext yet)
init()                 → idempotent: if (this.ctx) return
                          new (window.AudioContext || window.webkitAudioContext)()
                          setupEMFHum() · setupEVPStatic() · startGeigerClicks()
                          try/catch → on failure logs and leaves ctx === null
any public method      → first statement: if (!this.ctx || this.isMuted) return
```

Two invariants follow, and they are what make audio failure non-fatal:

1. **`init()` is called from exactly one place** — the boot screen's power button handler
   ([`src/components/SystemBoot.tsx:37`](../src/components/SystemBoot.tsx)) — which is a real user
   gesture, satisfying browser autoplay policy.
2. **Every method is safe before `init()`** and safe when the API is missing. `ctx === null`
   short-circuits all of them. Audio is therefore strictly optional: the instrument is fully
   functional with the Web Audio API absent, blocked, or throwing.

> [!WARNING]
> **`init()` never calls `ctx.resume()`.** If the browser creates the context in the `suspended`
> state (Safari, and Chrome when the gesture is not judged sufficient), nothing is ever heard: the
> Geiger chain detects `ctx.state === 'suspended'` and idles on a 1 s heartbeat forever
> ([`:103-107`](../src/utils/audio.ts)), and no code path ever resumes. The fix is two lines in
> `init()`. Tracked as [TD-12](tech-debt.md).

## 4. Parameter mappings

All continuous modulation flows through one entry point, `setEMFLevel(level)`, called once per
engine tick from [`src/App.tsx`](../src/App.tsx) — the audio graph has exactly one writer.

### 4.1 EMF → continuous voice parameters

| Parameter | Formula | τ | Saturates at |
| --- | --- | --- | --- |
| Hum oscillator freq | `55 + min(1.5·emf, 110)` Hz | 0.1 s | 73.3 mG |
| Hum lowpass cutoff | `120 + min(8·emf, 800)` Hz | 0.1 s | 100 mG |
| Hum gain | `(0.015 + min(emf/200, 0.06)) · volume` | 0.1 s | 12 mG |
| Static bandpass freq | `800 + min(20·emf, 3000)` Hz | 0.2 s | 150 mG |
| Static gain | `(0.003 + min(emf/500, 0.025)) · volume` | 0.2 s | 12.5 mG |
| Alarm engage | `emf ≥ 15` start, else stop | — | — |

### 4.2 EMF → one-shot voice parameters

| Voice | Parameter | Formula | Saturates at |
| --- | --- | --- | --- |
| Geiger click | interval | `2000 − min(emf/50, 1)·1970` ms, then `× U(0.8, 1.2)` | 50 mG |
| Geiger click | interval (emf ≤ 0.5) | `U(1000, 4000)` ms | — |
| Geiger click | start freq | `800 + min(10·emf, 1000)` Hz → exp ramp to 100 Hz in 15 ms | 100 mG |
| Geiger click | gain | `0.08 · volume · U(0.6, 1.0)` | — |
| Alarm beep | pitch | `1200 + min(15·(emf − 15), 800)` Hz | 68.3 mG |
| Alarm beep | interval | `max(150, 450 − 5·(emf − 15))` ms | 75 mG |

### 4.3 The domain-mismatch problem

Every mapping above is calibrated for an input domain of roughly **0 – 50 mG** (some for 0 – 150).
The engine's realized domain, per [Simulation Engine §3.2](simulation-engine.md#32-emergent-statistics)
and [§5.1](simulation-engine.md#51-outbreak-signal), is **0.2 – 43 mG**. The upper portion of each
mapping is therefore unreachable:

| Parameter | Designed span | Realized span | Unreachable |
| --- | --- | --- | --- |
| Hum frequency | 55 → 165 Hz | 55.3 → **119.5 Hz** | 28 % |
| Hum cutoff | 120 → 920 Hz | 121.6 → **464 Hz** | 49 % |
| Hum gain | 0.015 → 0.075 | 0.0151 → **0.075** (saturated from 12 mG) | saturation is reached, then flat |
| Static cutoff | 800 → 3800 Hz | 804 → **1660 Hz** | 71 % |
| Geiger interval | 2000 → **30 ms** | 1960 → **306 ms** | the fastest realized rate is ≈ 3.3 clicks/s, not 33 |
| Alarm pitch | 1200 → 2000 Hz | 1200 → **1620 Hz** | 48 % |
| Alarm interval | 450 → 150 ms | 450 → **310 ms** | 47 % |

> [!NOTE]
> This is why the previous README's "~2 s → ~30 ms" Geiger figure is misleading: it describes the
> mapping's *domain*, not the instrument's *behaviour*. The realized fastest crackle is roughly
> 3 clicks per second at the peak of an outbreak.
>
> The mappings are not wrong — they are simply scaled for a wider instrument than the simulation
> drives. Two coherent fixes: renormalize the denominators to the realized 0–45 mG span, or (better)
> export the mapping constants alongside `ENGINE_CONSTANTS` when the engine is extracted
> ([Simulation Engine §7](simulation-engine.md#7-proposed-extraction-createemfengineseed)) so one
> table defines both. Tracked as [TD-13](tech-debt.md).

## 5. Voice design notes

### 5.1 Mains hum — why a sawtooth through a resonant lowpass

A 55 Hz sawtooth (A1) carries harmonics at 110, 165, 220 Hz… A lowpass at 120 Hz with **Q = 5**
puts a resonant peak right at the cutoff, so the second harmonic is emphasized rather than removed.
That is the "electrical machinery" timbre: fundamental plus one bright edge. Opening the cutoff
toward 464 Hz as EMF rises admits harmonics 3–4, which is perceived as the machine "straining" —
the brightness change does the semantic work that a volume change could not.

### 5.2 Geiger click — 15 ms is the whole sound

```
triangle @ 800–1230 Hz ─► bandpass 1500 Hz ─► gain
                                                 ├ setValueAtTime(0.048–0.08 · volume)
                                                 └ exponentialRampToValueAtTime(1e-4, +15 ms)
osc.frequency: exponentialRamp → 100 Hz over the same 15 ms
osc.stop(+20 ms)
```

The pitch drop and the amplitude decay run over the *same* 15 ms. The result is a broadband
transient with a downward chirp — perceptually a "tick" rather than a "tone", which is what a real
GM tube's discharge sounds like through a speaker. The ±20 % gain jitter and ±20 % interval jitter
are both essential: without them the crackle sounds like a metronome within about four clicks.

### 5.3 Outbreak scream — two-operator FM

```
modOsc [sine]  8 Hz ──linear──► 25 Hz over 2 s
     │
     └─► modGain (50) ──► baseOsc.frequency      ← frequency modulation
baseOsc [sawtooth] 120 Hz ──linear──► 80 Hz @1.5 s ──exp──► 40 Hz @3.0 s
     │
     └─► filter [peaking Q=8]  500 ──exp──► 2000 Hz @1.5 s ──exp──► 300 Hz @3.0 s
              │
              └─► mainGain  1e-3 ──exp──► 0.12·vol @0.5 s ──exp──► 0.08·vol @1.8 s ──exp──► 1e-4 @3.5 s
                     │
                     └─► ctx.destination          both oscillators stop @3.6 s
```

Modulation index β = deviation / modulator frequency = 50/8 → **6.25** at onset, falling to 50/25 →
**2.0** at 2 s. β ≫ 1 produces a dense inharmonic sideband spectrum — the "growl". As the modulator
accelerates and β falls, the spectrum collapses toward the carrier, which reads as the sound
"losing its voice". Combined with the carrier gliding 120 → 40 Hz and the peaking filter sweeping
up then down, three independent motions overlap so the ear never locks onto a repeating pattern.
This is the most deliberately designed voice in the file.

> [!NOTE]
> `playHauntingScream()` is semantically overloaded: it fires for the outbreak
> ([`src/App.tsx:143`](../src/App.tsx)) **and** as the sting when an EVP decode succeeds
> ([`src/components/EVPRecorder.tsx:170`](../src/components/EVPRecorder.tsx)). The same 3.6 s sound
> therefore means "crisis" in one context and "whisper found" in another. Splitting it into
> `playOutbreakScream()` and a shorter `playWhisperSting()` would make the intent legible.

### 5.4 Boot sweep — two layers, one gesture

`playPowerUp()` runs a 30 → 220 Hz sawtooth through a lowpass sweeping 80 → 800 Hz (the "capacitor
bank charging"), while a second oscillator fires three gated sine tones at 1000/1500/2000 Hz at
+0.3/+0.5/+0.7 s (the "self-test passing"). Layering a rising body under discrete confirmations is
what makes a 1.6 s effect feel like a machine booting rather than a jingle.

### 5.5 Diagnostic beep — the most-used voice

10 call sites, more than any other method. Two variants share one signature:

| `success` | Waveform | Frequency | Duration |
| --- | --- | --- | --- |
| `true` | sine | 1800 Hz fixed | 100 ms (gain decay 80 ms) |
| `false` | sine | 400 → 250 Hz linear over 250 ms | 350 ms (gain decay 300 ms) |

The descending variant is used for the outbreak's wind-down
([`src/App.tsx:173`](../src/App.tsx)), where the comment calls it a "winding down tone" — the
intended `playPowerDown()` was never wired up. See §7.

## 6. Scheduling and the Geiger loop

The Geiger chain is a **self-rescheduling `setTimeout`**, not a `setInterval`
([`:100-131`](../src/utils/audio.ts)):

```
clickLoop():
   if (isMuted || !ctx || ctx.state === 'suspended')  → schedule clickLoop in 1000 ms; return
   playClickSound()
   interval ← f(currentEMF) · U(0.8, 1.2)
   schedule clickLoop in `interval` ms
```

`setTimeout` is required because the period is *recomputed every iteration* — a `setInterval` could
only ever hold one rate. The 1 s branch is a heartbeat: while muted or suspended the chain stays
alive so it can resume without an explicit restart.

**The chain is never cancelled.** `stopAlarm()` exists; there is no equivalent for the Geiger
timer, and no `dispose()` on the controller. Bounded in production (page-lifetime singleton), but
it means Vite HMR stacks a second chain on top of the first — audible as doubling click rate after
a hot reload. Workaround in [Development §7](development.md#7-debugging-notes); fix tracked as
[TD-12](tech-debt.md).

**Alarm scheduling** is the same pattern with an explicit stop: `startAlarm()` guards on
`isAlarmPlaying`, and `stopAlarm()` clears the pending timeout. Because `setEMFLevel` calls
start/stop on every tick based on a single 15 mG threshold, an outbreak's sine trough tears the
alarm down and rebuilds it ~12 times per second — see
[Simulation Engine §5.2](simulation-engine.md#52-emergent-artifact-alarm-stutter). Hysteresis fixes it.

## 7. Dead and unreachable surface

| Member | State | Note |
| --- | --- | --- |
| `playPowerDown()` | **never called** | Fully implemented 30-line voice; the outbreak uses `playDiagnosticBeep(false)` instead |
| `getIsMuted()` | **never called** | Mute state is duplicated in `App.tsx` as `isMuted` |
| `humFilter.Q` | set once (5), never modulated | Resonance is a free expressiveness lever currently unused |
| 4 `catch (e)` blocks | swallow silently | 2 are empty statements (ESLint `no-empty`); see [TD-08](tech-debt.md) |

Either wire `playPowerDown()` into the outbreak resolution (it is the semantically correct sound for
"the field collapsing") or delete it. Documented rather than quietly removed because it is good code
that a future contributor will otherwise re-derive.

## 8. Adding a sound

The contract, enforced in review (see [CONTRIBUTING](../CONTRIBUTING.md#4-conventions)):

1. **Add a semantic method to `AudioController`** — `playX()` for one-shots, `setY()` for
   continuous state. Never construct an `AudioContext` or nodes inside a component.
2. **Guard first**: `if (!this.ctx || this.isMuted) return;`
3. **Wrap synthesis in `try/catch`**, and log — do not leave an empty block.
4. **Scale every gain by `this.volume`.** There is no master bus (§2).
5. **Stop every oscillator you start.** An unstopped oscillator is a permanent voice.
6. **Use `exponentialRampToValueAtTime` for decays, never to exactly 0** (it throws); the file's
   convention is `1e-4`.
7. **Prefer `setTargetAtTime` for anything driven by the tick**, so 300 ms steps stay inaudible.
8. If the voice is continuous, **give it a teardown path** — the missing `dispose()` is
   [TD-12](tech-debt.md), and adding another unstoppable voice makes it worse.

---

**Next:** [Components](components.md) — the presentation layer that consumes all of this.
