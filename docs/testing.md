# Testing

| | |
| --- | --- |
| **Audience** | Contributors, reviewers assessing engineering maturity |
| **Status** | Honest as of commit `102e524`: **there are no automated tests.** This document specifies the strategy and the shortest credible path to a suite. |
| **Companion** | [Simulation Engine](simulation-engine.md) (the specification the tests assert against) · [Roadmap F1–F2](roadmap.md#4-phase-2--verifiable) |

---

## 1. Current state

| Layer | Status | Evidence |
| --- | --- | --- |
| Unit | **none** | no `*.test.*` / `*.spec.*` files in the repository |
| Component | **none** | no testing library installed |
| Integration / E2E | **none** | no Playwright, Cypress, or Puppeteer |
| Static analysis | **partial** | `tsc -b` under `strict: true` passes and gates the build; `eslint .` reports 45 errors ([Development §5](development.md#5-lint-state--read-this-before-your-first-pr)) |
| Manual | undocumented until now | the matrix in §6 is the first written record |

There is no `test` script in `package.json` and no test runner in the dependency tree. This is the
largest single gap between how the code is written and how a production codebase would be maintained,
and it is stated plainly rather than papered over: the specification in
[Simulation Engine](simulation-engine.md) is currently enforced by nothing but reading the code.

## 2. Why coverage is zero (structural, not attitudinal)

The codebase is not hard to test by accident. Three structural properties make it so, and all three
are fixable:

| Blocker | Detail | Fix |
| --- | --- | --- |
| **No pure exports** | The engine is inline in a `setInterval` callback inside `App.tsx`. Derived quantities are inline in component effects. There is no function to call. | Extract `createEmfEngine()` — [Simulation Engine §7](simulation-engine.md#7-proposed-extraction-createemfengineseed) |
| **Non-determinism** | `Math.random()` is called directly in 8 modules. No trace is reproducible, so no assertion about a trace can be written. | Inject an RNG — [§3](#3-the-seedability-blocker) |
| **Singleton with no teardown** | `audioService` holds a live `AudioContext` and cannot be reset between tests; `jsdom` has no Web Audio implementation at all. | Interface + fake — [§5.2](#52-audio-fake) |

## 3. The seedability blocker

This is the one refactor that unlocks everything else, so it is worth being concrete.

Today:

```ts
// inline in App.tsx, inside setInterval, inside a component
if (Math.random() < 0.03) { next = 5.0 + Math.random() * 8.0; }
```

There is no way to assert anything about that except by running it many times and hoping. With an
injected RNG:

```ts
// pure, deterministic, callable from a test
const engine = createEmfEngine(mulberry32(0xC0FFEE));
const trace = Array.from({ length: 1000 }, () => engine.step({ mode: 'auto', manualEMF: 0, sensitivity: 10 }).emf);
```

A ~10-line seeded PRNG is enough — no dependency needed:

```ts
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

Determinism buys three separate things, in ascending order of value: reproducible bug reports
("seed 4711 produces the stuck log"), golden-trace regression tests, and statistical assertions
that actually hold instead of flaking.

## 4. Specifications worth writing first

Ordered by (risk × ease). Every assertion below is transcribed from
[Simulation Engine](simulation-engine.md), which is the normative reference.

### 4.1 Engine specifications

| # | Test | Assertion | Why it matters |
| --- | --- | --- | --- |
| U1 | AUTO output is always in range | `∀ tick: 0.2 ≤ emf ≤ 95` over 10 000 ticks, any seed | The clamp is the only thing between the walk and an unbounded trace |
| U2 | Quiet band is quiet | starting at 0.8 mG with spikes disabled, `p95 < 3.0` over 1 000 ticks | Guards the stillness that makes spikes legible ([§3.2](simulation-engine.md#32-emergent-statistics)) |
| U3 | Elevated band always decays | with spikes disabled, from 20 mG, `emf < 3.0` within 60 ticks | A trace that cannot come down is a stuck instrument |
| U4 | Spike rates match the model | over 100 000 ticks, moderate-spike frequency within ±10 % of 3 %/tick | The constants in the tuning table are load-bearing |
| U5 | Determinism | two engines with the same seed produce identical traces | Proves the injection works; prerequisite for every other test |
| U6 | MANUAL is baseline + bounded noise | `|emf − manualEMF| ≤ 0.15 × sensitivity/10` for all ticks | The only hard bound in manual mode |
| U7 | MANUAL floor | `emf ≥ 0.1` even at `manualEMF = 0.1`, `sensitivity = 100` | The `Math.max` is the whole guarantee |
| U8 | Outbreak envelope | during an outbreak, `13 ≤ emf ≤ 43` and the period is ≈1.26 s | The scripted event must stay scripted |
| U9 | Outbreak is non-reentrant | calling `beginOutbreak()` twice yields one event | Invariant I7 ([API §4](api.md#4-invariants)) |
| U10 | Outbreak terminates | `emf` returns to the AUTO band within one tick of the duration elapsing | The instrument must recover cleanly |

### 4.2 Derived-quantity specifications

| # | Test | Assertion | Why |
| --- | --- | --- | --- |
| D1 | Vector norm is preserved | `√(x²+y²+z²) ≈ emf` within rounding, for `emf > 0.2` | Invariant I3 — the detail a technical viewer checks first |
| D2 | `ratioZ` is always real | `rX² + rY² ≤ 0.74 < 1` for all draws | Proves the `max(0, …)` guard is unreachable ([§6.1](simulation-engine.md#61-tri-axis-vector-decomposition)) |
| D3 | Dead band documented behaviour | at `emf ≤ 0.2`, the vector is `{0.1, 0.1, 0.1}` — norm 0.173 ≠ emf | Pins the known inconsistency so a fix is a deliberate change |
| D4 | µT conversion | `µT === emf / 10` exactly | The one physically correct conversion in the app; it must not regress |
| D5 | Severity classification | `>15 → CRITICAL`, `>10 → HIGH`, `>5 → MEDIUM`, `≤5 → none`, at every boundary | Thresholds are duplicated in three UI surfaces ([Components §9](components.md#9-entitydatabase)) |
| D6 | Log retention | never exceeds 50 entries | The only memory bound on the log |
| D7 | Probability bounds | `1 ≤ p ≤ 98`, or exactly `99.8` during an outbreak | Guards the clamp |
| D8 | Radar population | never exceeds 8 contacts | Memory and legibility bound |
| D9 | Radar contact stays in bounds | `‖(x, y)‖ ≤ 0.9` after the boundary rule | The reflection rule is the only containment |

D8 and D9 are pure functions of the current physics code and can be tested **today** if the boundary
rule is lifted out of the frame loop into an exported `advanceBlip(blip): RadarBlip`. That is a
20-line change and the cheapest real coverage available.

### 4.3 Audio-mapping specifications

The mappings in [Audio Synthesis §4](audio-synthesis.md#4-parameter-mappings) are arithmetic and
purely testable once extracted from the class:

| # | Test | Assertion |
| --- | --- | --- |
| A1 | Hum frequency | `f(emf) === 55 + min(1.5·emf, 110)`, saturating at 73.3 mG |
| A2 | Geiger interval | `interval(50) === 30 ms`, `interval(0.5) === 2000 ms`, monotonic non-increasing |
| A3 | Geiger jitter | result always within `[0.8×, 1.2×]` of the mapped interval |
| A4 | Alarm hysteresis | after the [TD-05](tech-debt.md) fix: engage at ≥15, disengage at <12, and **no** engage/disengage cycling over an outbreak trace |
| A5 | Gain scaling | every voice gain is proportional to `volume`; `volume = 0` silences all |

A4 is the most valuable test in the file: it converts a subtle emergent defect
([Simulation Engine §5.2](simulation-engine.md#52-emergent-artifact-alarm-stutter)) into a
regression guard.

### 4.4 Component specifications

Worth writing once a runner exists, in descending value:

| # | Test | Assertion |
| --- | --- | --- |
| C1 | `EVPRecorder` state machine | DEMODULATE and PLAYBACK are disabled without a recording; RECORD is disabled during decode |
| C2 | `EVPRecorder` decode | with a stubbed RNG, `p = 0.75` yields a pool phrase and `p = 0.25` yields the static-only string |
| C3 | `AnomalyLog` filtering | each severity chip filters correctly; `ALL` shows everything; Clear empties the list |
| C4 | `TriangulationMap` location switch | changing location replaces all nodes and re-seeds `selectedNode` |
| C5 | `DeviceSpecs` theming | selecting a theme calls `setAccentColor` with the exact hex |
| C6 | `SystemBoot` POST | 12 lines are appended in order with fake timers; `onBootComplete` fires once, ~1 s after the last |
| C7 | `App` boot gate | nothing but `SystemBoot` is mounted before `isBooted` |
| C8 | `App` outbreak | the button is disabled while active; temperature drops to 3.2 °C and restores to 18.5 °C |

C6 and C8 require `vi.useFakeTimers()`, which also makes the 4.7 s boot gate and the 15 s outbreak
testable in milliseconds.

### 4.5 Regression tests for the register

Each behavioural defect should land with a failing test first:

| Defect | Test that fails before the fix |
| --- | --- |
| [TD-02](tech-debt.md) triangulation starvation | with `emfLevel` changing every 300 ms, node readings **do** update at least once per second |
| [TD-01](tech-debt.md) per-frame React writes | rendering `RadarGrid` and advancing 60 frames produces **zero** commits after the initial mount |
| [TD-03](tech-debt.md) impure updaters | `audioService.setEMFLevel` is called exactly once per tick under `StrictMode` |
| [TD-07](tech-debt.md) probability ratchet | after a spike decays and the log is quiet, the index **decreases** |
| [TD-14](tech-debt.md) beep storm | dragging sensitivity across its full range fires ≤ 1 confirmation sound |

## 5. Proposed harness

### 5.1 Runner and configuration

Vitest, because it shares Vite's transform pipeline — the same `vite.config.ts`, the same Tailwind
plugin, the same JSX handling, no second build system to maintain.

```ts
// vitest.config.ts (proposed)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: { provider: 'v8', include: ['src/**'], exclude: ['src/test/**', 'src/**/*.test.*'] },
  },
});
```

```jsonc
// package.json scripts (proposed)
"test":        "vitest run",
"test:watch":  "vitest",
"test:coverage": "vitest run --coverage"
```

Dev dependencies to add: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`,
`jsdom`, `@vitest/coverage-v8`.

### 5.2 Audio fake

`jsdom` implements no Web Audio API, and `AudioController` constructs nodes eagerly. Two options:

1. **Extract the mappings** (§4.3) into pure functions and test those — no DOM, no audio, no fake.
   This covers every arithmetic claim in [Audio Synthesis §4](audio-synthesis.md#4-parameter-mappings)
   and is the recommended first step.
2. **Stub the graph** for behavioural tests: a `setup.ts` that installs a minimal
   `window.AudioContext` mock recording `setTargetAtTime` / `setValueAtTime` calls, so a test can
   assert "the hum frequency was scheduled to 119.5 Hz" without any DSP.

Option 1 gets the value; option 2 gets the integration. Do 1 first.

### 5.3 Canvas

`jsdom` has no 2D context. Either install the `canvas` package (native build, slows CI) or stub
`HTMLCanvasElement.prototype.getContext` with a recording mock and assert the *call sequence*
("a 280-point path was stroked with `accentColor`"), not the pixels. For this application the call
sequence is the useful assertion — pixel output is intentionally non-deterministic (it contains
`Math.random()` terms by design).

### 5.4 What not to test

Deliberately out of scope, with reasons:

| Not tested | Why |
| --- | --- |
| Canvas pixel output | Non-deterministic by design; visual regressions belong in a screenshot-diff tool if ever needed |
| Audio timbre | Requires human ears or DSP analysis; the mappings (§4.3) are the testable proxy |
| Tailwind class strings | Testing that a class string equals a literal is a change-detector, not a test |
| The diegesis | Whether "GET OUT" is scary enough is a design question |

## 6. Manual test matrix

Until automation exists, this is the test suite. It is also the checklist to run before any
deployment ([Deployment §7](deployment.md#9-verification-checklist)).

### 6.1 Smoke

| # | Step | Expected |
| --- | --- | --- |
| S1 | Load the app | Black POST screen, power button visible, no console errors |
| S2 | Click **INITIALIZE SYSTEM IGNITION** | Rising sweep sound; 12 log lines appear in order; progress reaches 100 % |
| S3 | Wait ~1 s after the last line | Console mounts: header, 5 tabs, dashboard, sidebar |
| S4 | Observe the EMF reading for 60 s | Value moves continuously; occasional spikes to 5–13 mG; returns to baseline |
| S5 | Listen | Continuous low hum; irregular Geiger clicks (~1 per 1–2 s at baseline) |
| S6 | Wait for a spike above 10 mG | Hum brightens and rises in pitch; click rate increases; an anomaly log entry appears |
| S7 | Click **TRIGGER SPECTRAL OUTBREAK** | Scream; red overlay; screen shake; rotating glitch text; EMF 13–43 mG; temperature reads 3.2 °C; button disabled |
| S8 | Wait 15 s | Clean return: overlay gone, shake stops, temperature 18.5 °C, descending beep, EMF back to baseline |
| S9 | Trigger an outbreak twice quickly | Second click is ignored / button disabled — one event only |

### 6.2 Per-tab

| # | Tab | Expected |
| --- | --- | --- |
| T1 | Dashboard | Oscilloscope animates; radar sweeps ~1 revolution / 7 s; log accumulates |
| T2 | Dashboard → **FREEZE** | Sweep line stops; contacts remain visible; label flips to **SWEEP** |
| T3 | Triangulation Node | Floorplan renders; 4 nodes for Ward B; clicking a node updates the inspector — **readings do not fluctuate (known defect [TD-02](tech-debt.md))** |
| T4 | Triangulation → change location | Node count and labels change (3 nodes for the other two) |
| T5 | EVP Recorder → RECORD | Red waveform, `REC 0:0n / 0:10` counter, static audio intensifies |
| T6 | EVP → wait 10 s | Recording auto-stops |
| T7 | EVP → DEMODULATE | Progress 0→100 % over ~2.5 s, then a phrase (~75 %) or the static-only string |
| T8 | EVP → PLAYBACK | Waveform animates for ~3 s, controls disabled meanwhile |
| T9 | Field Guide | Four entities; selecting one updates the profile; danger colours differ |
| T10 | Diagnostics → sensitivity | Value updates; **dragging produces a rapid beep storm (known defect [TD-14](tech-debt.md))** |
| T11 | Diagnostics → self-test | Three ascending beeps at ~150 ms spacing |
| T12 | Specs → each theme | Accent colour changes across every mounted surface, including canvas strokes |

### 6.3 Global controls

| # | Step | Expected |
| --- | --- | --- |
| G1 | Mute | All sound stops immediately; icon turns red; slider disabled |
| G2 | Unmute | Sound returns at the previous level |
| G3 | Volume to 0, then up | Continuous voices scale; one-shots from the next event onward |
| G4 | MANUAL mode | Engine follows the slider; noise scales with sensitivity |
| G5 | MANUAL at 15+ mG | Alarm beeps engage; log classifies CRITICAL; probability pins high |
| G6 | Resize to 375 px wide | Tabs scroll horizontally; sidebar stacks below content; no horizontal page scroll |
| G7 | Reload | Fresh boot gate; **no settings persist** (by design — [Roadmap E1](roadmap.md#6-phase-4--capable)) |

### 6.4 Cross-environment

| Environment | Specific risk |
| --- | --- |
| Safari (macOS / iOS) | `webkitAudioContext` fallback; contexts frequently start `suspended` → **silence**, since `init()` never calls `resume()` ([TD-12](tech-debt.md)) |
| Firefox | `AudioContext` timing; range-input styling |
| Chrome / Edge | Reference environment |
| iOS Safari | Autoplay requires the gesture path; `backdrop-blur` cost; canvas at 2× DPI |
| Low-end Android | `shadowBlur` cost in the radar loop ([Performance §4.4](performance.md#44-shadowblur-is-the-most-expensive-call-in-the-loops)) |
| `prefers-reduced-motion: reduce` | **Nothing changes today** — no media query exists. [Accessibility §3](accessibility.md#3-wcag-22-findings) |

## 7. Coverage policy (proposed)

Targets that mean something for this codebase, rather than a blanket percentage:

| Area | Target | Rationale |
| --- | --- | --- |
| `src/simulation/**` (post-extraction) | **100 % statements** | Small, pure, and the whole believability of the app rests on it |
| Audio mapping functions | **100 %** | Pure arithmetic, 15 functions |
| Derived-quantity helpers | **≥ 90 %** | Pure once extracted |
| Components | **≥ 50 %**, behaviour only | State machines and event handlers; not class strings |
| `AudioController` graph wiring | smoke only | Requires a stub; low marginal value |
| Overall | report, do not gate initially | A gate on a codebase at 0 % only encourages gaming |

CI integration: run `test` alongside `typecheck` and `build` from the moment the first spec lands.
The gating policy and the reasoning are in
[ADR-0006](decisions/0006-ci-gating-and-the-lint-baseline.md).

---

**Next:** [Accessibility](accessibility.md).
