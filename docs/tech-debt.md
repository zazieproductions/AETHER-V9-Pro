# Tech-Debt Register

| | |
| --- | --- |
| **Audience** | Maintainers, reviewers, contributors picking up work |
| **Status** | Complete as of commit `102e524`, plus [TD-21](#td-21), which the `0.1.0` documentation release introduced. Every entry was reproduced or verified before being recorded. |
| **Line numbers** | Accurate at that commit. When a cited line moves, update the citation in the same PR. |

A register, not a shame list. Every entry has evidence, a severity, a remediation, and a
**verification step** — the observation that proves the fix landed. Nothing here is speculation, and
nothing here is hidden from the README.

---

## How to use this register

1. **IDs are permanent.** `TD-07` always means the probability ratchet, even after it is fixed. Fixed
   entries move to [§7 · Closed](#7-closed) with the commit that closed them. Never reuse an ID.
   Each heading carries an explicit `<a id="td-nn"></a>` anchor so that the ~70 links pointing
   here from elsewhere in the documentation survive a reworded title. **Do not delete those
   anchors** — they are the register's public linking surface. Link to an entry as
   `[TD-07](tech-debt.md#td-07)`, never as a heading slug.
2. **No new debt without an entry.** If a PR knowingly introduces a shortcut, it adds the entry in the
   same commit. This is the only rule that keeps a register accurate.
3. **Severity means what it says** — see the scale below. It is not a priority; priority lives in the
   [Roadmap](roadmap.md), which sequences these entries against feature work.
4. **Verify, don't assume.** Each entry names the observation that closes it.

| Severity | Definition |
| --- | --- |
| **Critical** | Blocks a legitimate use of the repository — e.g. deploying it publicly |
| **High** | User-visible incorrect behaviour, or a structural defect that will propagate |
| **Medium** | Correctness or maintainability risk not yet visible to a user |
| **Low** | Hygiene, consistency, or polish |

**Summary: 21 entries — 1 Critical · 4 High · 10 Medium · 6 Low.**

| ID | Title | Severity | Category |
| --- | --- | --- | --- |
| [TD-15](#td-15) | Preview instrumentation committed to `index.html` | **Critical** | Repository hygiene |
| [TD-01](#td-01) | Radar advances physics through React state, 60×/s | **High** | Performance |
| [TD-02](#td-02) | Triangulation node updates never execute | **High** | Correctness |
| [TD-03](#td-03) | Impure state updaters | **High** | Correctness |
| [TD-12](#td-12) | Audio has no teardown and never resumes a suspended context | **High** | Robustness |
| [TD-04](#td-04) | Timers not cleared on unmount | Medium | Lifecycle |
| [TD-05](#td-05) | Alarm threshold has no hysteresis | Medium | Audio |
| [TD-07](#td-07) | Haunt probability is a ratchet | Medium | Simulation model |
| [TD-10](#td-10) | No master audio bus; mute zeroes gains discontinuously | Medium | Audio architecture |
| [TD-13](#td-13) | Audio mappings calibrated for a wider domain than the engine drives | Medium | Audio |
| [TD-14](#td-14) | Sensitivity slider fires a beep per input event | Medium | UX / audio |
| [TD-16](#td-16) | `.vite-source-tags.js` is tracked *and* ignored, and runs in prod | Medium | Build |
| [TD-17](#td-17) | A 10 Hz clock in `App.tsx` re-renders the whole console | Medium | Performance |
| [TD-19](#td-19) | Zero automated test coverage | Medium | Assurance |
| [TD-21](#td-21) | Documentation prose is compiled into the production CSS | Medium | Build |
| [TD-06](#td-06) | Unused dependencies and orphan files | Low | Hygiene |
| [TD-08](#td-08) | Dead code and silently swallowed failures | Low | Hygiene |
| [TD-09](#td-09) | Documentation and comment drift | Low | Documentation |
| [TD-11](#td-11) | `accentColor` drilled through nine components | Low | Architecture |
| [TD-18](#td-18) | `favicon.svg` referenced but absent — 404 on every load | Low | Build |
| [TD-20](#td-20) | Accessibility conformance gaps | Low → tracked separately | Accessibility |

---

## 1. Lint baseline

`npm run lint` exits non-zero with **45 errors across 12 files**. The full itemization is
[Appendix A](#appendix-a--complete-eslint-baseline).

| Rule | Count | Nature |
| --- | --- | --- |
| `@typescript-eslint/no-unused-vars` | 32 | mechanical |
| `react-hooks/set-state-in-effect` | 6 | design — overlaps TD-02, TD-03 |
| `no-empty` | 3 | mechanical |
| `@typescript-eslint/no-explicit-any` | 2 | mechanical |
| `react-hooks/immutability` | 1 | design — overlaps TD-03 |
| `@typescript-eslint/ban-ts-comment` | 1 | mechanical |

**35 of 45 are mechanical** and auto-fixable or trivially deletable. The remaining 7 are the same
impure-updater and effect-body-write patterns registered as TD-02 and TD-03, surfaced by
`eslint-plugin-react-hooks` 7.1.1 — a substantially stricter ruleset than 5.x, correctly configured
here.

The gating policy (lint advisory in CI until the baseline is zero, then blocking) and its rationale
are in [ADR-0006](decisions/0006-ci-gating-and-the-lint-baseline.md). Policy for contributors: do not
add to the baseline; fix what you touch. See [Development §5](development.md#5-lint-state--read-this-before-your-first-pr).

## 2. Behavioural defects

<a id="td-01"></a>
### TD-01 — Radar advances physics through React state, 60×/s

| | |
| --- | --- |
| **Severity** | High · **Category** Performance |
| **Evidence** | [`src/components/RadarGrid.tsx:188`](../src/components/RadarGrid.tsx) (`setBlips`), [`:264`](../src/components/RadarGrid.tsx) (`setDetectedEntities`), both inside the `requestAnimationFrame` callback |

The frame loop writes React state twice per frame. Three compounding problems:

- `blips` is **never read during render** — ESLint confirms it is an unused binding. The per-frame
  write exists solely to advance a simulation that could live in a ref.
- `setDetectedEntities(detectedThisFrame.slice(0, 5))` allocates a new array every frame, so
  reference equality never holds and React can never bail out. The contact list (up to 5 cards with
  computed distance, bearing, and inline styles) is rebuilt 60×/s.
- The boundary rule mutates `blip.speedX`/`speedY` **in place on a state object**
  ([`:201-202`](../src/components/RadarGrid.tsx)) before returning a shallow copy, so the mutation
  escapes the copy.

**Impact:** ~60 of the ~80 React commits per second in the steady state
([Performance §3.2](performance.md#32-react-commits-per-second-dashboard-tab)) — roughly 75 % of all
reconciliation work in the application — for output that is never rendered. It also directly
contradicts the React/canvas boundary the architecture is built on
([ADR-0002](decisions/0002-two-rendering-domains.md)).

**Remediation:** move blip state into a `blipsRef`, mutate it freely inside the loop, draw from it,
and commit to `detectedEntities` on a 150–250 ms interval only when the derived list actually
changed. Read `emfLevel` from a ref so the loop is not rebuilt per tick. Full sequence in
[Performance §4.1](performance.md#41-defect-per-frame-react-writes-in-the-radar-loop).

**Verification:** React DevTools Profiler, 5 s recording on the Dashboard — `RadarGrid` commits drop
from ~60/s to ≤ 5/s with the sweep still animating.

---

<a id="td-02"></a>
### TD-02 — Triangulation node updates never execute

| | |
| --- | --- |
| **Severity** | High · **Category** Correctness (user-visible) |
| **Evidence** | [`src/components/TriangulationMap.tsx:64-118`](../src/components/TriangulationMap.tsx) — `setInterval(…, 1000)` with dependency array `[emfLevel, hauntingActive, selectedNode]` |

`emfLevel` changes every 300 ms in every simulation mode. The effect therefore re-runs, and its
cleanup clears the 1 000 ms interval, **before that interval's first callback can fire**. Node
readings are frozen at the values seeded by the location effect for as long as the engine ticks.

**Impact:** an entire instrument panel is inert. The Triangulation tab shows static EMF, temperature,
and motion values next to a live header readout — the most visible defect in the repository, and the
one a reviewer is most likely to notice.

**Remediation:** the interval must not depend on a value that changes faster than its own period.
Read `emfLevel` and `hauntingActive` from refs updated by a small separate effect, and depend only on
nothing (or on a stable identity):

```tsx
const emfRef = useRef(emfLevel);
useEffect(() => { emfRef.current = emfLevel; }, [emfLevel]);

useEffect(() => {
  const id = setInterval(() => setNodes(prev => stepNodes(prev, emfRef.current, hauntRef.current)), 1000);
  return () => clearInterval(id);
}, []);                                    // ← mounts once
```

**Verification:** open the Triangulation tab; node MAGNETIC LOAD values change at ~1 Hz while the
header reading changes at ~3.3 Hz. Also confirm `react-hooks/set-state-in-effect` clears for this file.

---

<a id="td-03"></a>
### TD-03 — Impure state updaters

| | |
| --- | --- |
| **Severity** | High · **Category** Correctness |
| **Evidence** | [`src/App.tsx:130`](../src/App.tsx) · [`src/components/TriangulationMap.tsx:111`](../src/components/TriangulationMap.tsx) · [`src/components/EVPRecorder.tsx:110-113`](../src/components/EVPRecorder.tsx) |

Three state updaters perform side effects, which React forbids:

| Location | Side effect inside the updater | Consequence |
| --- | --- | --- |
| `App.tsx:130` | `audioService.setEMFLevel(next)` inside `setEmfLevel(prev => …)`, which also draws random numbers | `<StrictMode>` double-invokes updaters in dev, so audio parameters are written twice per tick and the PRNG stream is consumed at 2× rate — **dev and prod traces diverge** |
| `TriangulationMap.tsx:111` | `setSelectedNode(synced)` inside `setNodes(prev => …)` | A second state write from inside an updater; double-fires under StrictMode (currently masked by TD-02, which stops the loop running at all) |
| `EVPRecorder.tsx:110-113` | `handleStopRecording()` inside `setEvpTimer(prev => …)` — a function declared *below* the effect | Runs the stop handler from an updater, possibly twice; also the source of the `react-hooks/immutability` error |

**Impact:** today the audio one is benign because `setEMFLevel` is idempotent. It is registered High
because impure updaters are the class of bug that produces "works in production, breaks in dev" and
because StrictMode's double-invocation exists precisely to surface them. The dev/prod divergence in
the random stream also makes any future trace-based test unreliable.

**Remediation:** compute the next value in a local, then perform both writes outside the updater:

```tsx
const next = advanceEmf(prevEmfRef.current, mode, rng);   // pure
prevEmfRef.current = next;
setEmfLevel(next);
audioService.setEMFLevel(next);
```

For `EVPRecorder`, replace the updater-side-effect with an effect that watches `evpTimer === 10`.
This is the same shape as the engine extraction in
[Simulation Engine §7](simulation-engine.md#7-proposed-extraction-createemfengineseed), so do both
in one pass.

**Verification:** under `<StrictMode>`, a spy on `audioService.setEMFLevel` records exactly one call
per tick. Spec [T-03](testing.md#45-regression-tests-for-the-register).

---

<a id="td-05"></a>
### TD-05 — Alarm threshold has no hysteresis

| | |
| --- | --- |
| **Severity** | Medium · **Category** Audio |
| **Evidence** | [`src/utils/audio.ts:199-202`](../src/utils/audio.ts) — `if (level >= 15.0) startAlarm(); else stopAlarm();` on every tick |

A single threshold with no dead band means a signal that oscillates around 15 mG repeatedly starts
and stops the alarm. The outbreak waveform does exactly that: its sine trough spends ≈ 29 % of each
1.26 s period below 15 mG, so `startAlarm`/`stopAlarm` cycle continuously, allocating a fresh
oscillator chain on each restart.

**Impact:** the alarm stutters instead of sustaining during the event it was designed for, and the
alarm's own cadence resets ~12×/s. Audible, and wasteful.

**Remediation:** hysteresis — engage at ≥ 15 mG, disengage below 12 mG. Two constants; behaviour is
identical for sustained signals and correct for oscillating ones.

**Verification:** spec [A4](testing.md#43-audio-mapping-specifications) over a full outbreak trace:
zero start/stop transitions after the first engagement.

---

<a id="td-07"></a>
### TD-07 — Haunt probability is a ratchet

| | |
| --- | --- |
| **Severity** | Medium · **Category** Simulation model |
| **Evidence** | [`src/components/AnomalyLog.tsx:105-129`](../src/components/AnomalyLog.tsx) |

```
p = 1 + (emf > 1.5 ? emf × 2.5 : 0) + 6 × count(HIGH|CRITICAL entries), clamped to [1, 98]
```

The count term only grows: entries are never aged out, only displaced by the 50-entry cap. After
roughly 17 HIGH/CRITICAL entries the index pins at 98 % for the rest of the session, regardless of
current conditions.

**Impact:** a metric labelled "probability" that cannot decrease is not an estimate — it is a
cumulative counter with a ceiling. A long session renders the most prominent number on the dashboard
meaningless, which undermines the credibility of every other readout.

**Remediation:** either window the count over the most recent N entries (N = 10 keeps it responsive),
or apply exponential decay per tick (`p = p·0.98 + contribution`). The windowed version is simpler
and keeps the "recent activity" semantics the label implies.

**Verification:** spec [TD-07 regression](testing.md#45-regression-tests-for-the-register) — after a
spike decays and the log goes quiet for 30 s, the index returns toward baseline.

---

<a id="td-14"></a>
### TD-14 — Sensitivity slider fires a beep per input event

| | |
| --- | --- |
| **Severity** | Medium · **Category** UX / audio |
| **Evidence** | [`src/components/Diagnostics.tsx:56-58`](../src/components/Diagnostics.tsx) — `onChange` calls `playDiagnosticBeep(true)` alongside `setSensitivity` |

`<input type="range">` fires `onChange` on every step, and the range is 1–100. Dragging across it
allocates on the order of 100 overlapping 1 800 Hz oscillators in under a second — each a fresh
3-node subgraph with its own envelope.

**Impact:** audibly harsh machine-gun stutter on a routine calibration interaction; a burst of
node allocation in the audio graph; and it teaches the operator that the instrument's feedback is
noise rather than signal.

**Remediation:** the ambient-temperature slider in the same component already omits the beep — copy
that. If confirmation feedback is wanted, fire once on `onPointerUp`/`onKeyUp`/`onChange` commit, or
debounce by ~200 ms.

**Verification:** spec [TD-14 regression](testing.md#45-regression-tests-for-the-register) — a full
slider sweep produces ≤ 1 beep.

---

<a id="td-17"></a>
### TD-17 — A 10 Hz clock in `App.tsx` re-renders the whole console

| | |
| --- | --- |
| **Severity** | Medium · **Category** Performance |
| **Evidence** | [`src/App.tsx:67-70`](../src/App.tsx) — `setInterval(…, 100)` writing `systemTime`, which lives in the same component as the engine and the entire layout. Verified: **zero** `React.memo`, `useMemo`, or `useCallback` occurrences in `src/`. |

The header clock updates a 12-character string ten times per second. Because that state lives in
`App`, and because nothing is memoized, each update re-renders every mounted panel — the EMF display,
the radar, the log, and both sidebar cards.

**Impact:** ~10 of the ~80 commits/s in the steady state
([Performance §3.2](performance.md#32-react-commits-per-second-dashboard-tab)) are caused by a clock.
With TD-01 fixed, the clock becomes the **dominant** render driver.

**Remediation:** extract a `<SystemClock />` leaf component that owns its own interval and state.
Two minutes of work, removes 10 commits/s, and makes the header's concern explicit. If further
reduction is wanted afterwards, `React.memo` on the instrument panels is then effective rather than
masked.

**Verification:** Profiler recording with the radar defect fixed — App-level commits drop to ~3.5/s
(the tick plus GPS), and the clock component commits alone at 10/s.

## 3. Lifecycle and resources

<a id="td-04"></a>
### TD-04 — Timers not cleared on unmount

| | |
| --- | --- |
| **Severity** | Medium · **Category** Lifecycle |

Five timer sites create handles that no cleanup function clears:

| Location | Timer | If the component unmounts first |
| --- | --- | --- |
| [`App.tsx:167`](../src/App.tsx) | outbreak resolution `setTimeout(…, 15000)` | fires anyway, writing state on an unmounted tree; also the only path that ends an outbreak |
| [`App.tsx:161`](../src/App.tsx) | glitch-phrase `setInterval(…, 1500)` | cleared only by the timeout above, so it also survives |
| [`EVPRecorder.tsx:150`](../src/components/EVPRecorder.tsx) | demodulation `setInterval(…, 250)` | keeps running to 100 %, calling `setState` on an unmounted component; switching tabs mid-decode leaks it |
| [`EVPRecorder.tsx:180`](../src/components/EVPRecorder.tsx) | playback `setTimeout(…, 3000)` | fires after unmount |
| [`Diagnostics.tsx:22-24`](../src/components/Diagnostics.tsx) | self-test beeps at +150/+300 ms | harmless (200 ms window) but the same pattern |
| [`SystemBoot.tsx:41-55`](../src/components/SystemBoot.tsx) | recursive POST chain | uncancellable by construction; runs to completion regardless |

**Impact:** React 19 no longer warns on unmounted-component state writes, so these are silent. They
are real leaks — the EVPRecorder ones can outlive a tab switch by 2.5 s — and the outbreak one means
an outbreak started just before unmount resolves on a tree that no longer exists.

**Remediation:** store every handle in a ref and clear it in the effect cleanup, per the convention
in [CONTRIBUTING](../CONTRIBUTING.md#4-conventions). For the outbreak, hoist the two handles into refs
so an unmount (or a future "abort outbreak" control) can cancel both. The boot chain needs a
`cancelled` flag checked at the top of `addNextLog`.

**Verification:** mount → start demodulation → switch tab → confirm no further state writes (spy on
the setter or watch the Profiler). Then trigger an outbreak and unmount within 15 s.

---

<a id="td-12"></a>
### TD-12 — Audio has no teardown and never resumes a suspended context

| | |
| --- | --- |
| **Severity** | High · **Category** Robustness |
| **Evidence** | [`src/utils/audio.ts:33-46`](../src/utils/audio.ts) (`init`), [`:100-131`](../src/utils/audio.ts) (Geiger chain), absence of any `dispose`/`suspend`/`resume` |

Three related gaps in one subsystem:

1. **No `ctx.resume()`.** If the browser creates the context `suspended` — common on iOS Safari, and
   on Chrome when the gesture is not judged sufficient — nothing is ever heard. The Geiger chain
   detects `ctx.state === 'suspended'` and parks itself on a 1 s heartbeat forever
   ([`:104-107`](../src/utils/audio.ts)), and no code path ever resumes. **This is the most likely
   cause of "no sound" in production** and is called out in the
   [deployment checklist](deployment.md#9-verification-checklist).
2. **No `dispose()`.** The context, the hum oscillator, the looping noise buffer, and the Geiger
   timeout chain live until page unload. Acceptable for a single-page instrument; unacceptable for
   any future embedding, and the reason Vite HMR stacks a second graph on top of the first
   ([Development §7.1](development.md#71-hmr-duplicates-the-audio-graph)).
3. **The Geiger chain is uncancellable.** `stopAlarm()` exists; nothing equivalent stops the click
   loop.

**Remediation:**

```ts
async init() {
  if (this.ctx) { if (this.ctx.state === 'suspended') await this.ctx.resume(); return; }
  // …create context and voices…
  if (this.ctx.state === 'suspended') await this.ctx.resume();
}

dispose() {
  if (this.geigerInterval) clearTimeout(this.geigerInterval);
  this.stopAlarm();
  this.humOsc?.stop(); this.staticBufferSource?.stop();
  void this.ctx?.close();
  this.ctx = null;
}
```

Plus `import.meta.hot?.dispose(() => audioService.dispose())` in dev.

**Verification:** on iOS Safari, audio is audible after the power-button click. In dev, editing
`audio.ts` and hot-reloading does not double the hum or the click rate.

## 4. Audio and architecture

<a id="td-10"></a>
### TD-10 — No master audio bus; mute zeroes gains discontinuously

| | |
| --- | --- |
| **Severity** | Medium · **Category** Audio architecture |
| **Evidence** | every voice connects directly to `ctx.destination`; [`src/utils/audio.ts:445-451`](../src/utils/audio.ts) (`setMute`) |

There is no `masterGain` node. `volume` is applied by multiplying each voice's gain in JavaScript,
and mute is implemented by touching the two continuous gains plus the `isMuted` guard on one-shots.

Consequences: no single point to insert a `DynamicsCompressorNode` (so simultaneous transients —
Geiger click, alarm beep, and the 3.6 s scream during an outbreak — sum unmanaged at the
destination); volume changes do not affect voices already in flight; and muting uses
`setValueAtTime(0, …)`, a **discontinuous** jump that is audible as a click.

**Remediation:** insert `masterGain → compressor → destination` in `init()`, route every voice
through `masterGain`, make `setVolume` write one `AudioParam`, and make `setMute` ramp over ~15 ms
instead of jumping. This also removes the "multiply by `this.volume`" step from every voice, which
is currently a rule contributors must remember ([Audio Synthesis §8](audio-synthesis.md#8-adding-a-sound)).

**Verification:** muting during a sustained hum produces no audible click; a spectrum view shows a
single gain stage; `setVolume(0)` silences in-flight voices.

---

<a id="td-13"></a>
### TD-13 — Audio mappings calibrated for a wider domain than the engine drives

| | |
| --- | --- |
| **Severity** | Medium · **Category** Audio / simulation coupling |
| **Evidence** | [Audio Synthesis §4.3](audio-synthesis.md#43-the-domain-mismatch-problem) |

Every EMF→audio mapping saturates between 50 and 150 mG, but the engine's realized output is
**0.2 – 43 mG**. Measured unreachable headroom: hum cutoff 49 %, static cutoff 71 %, alarm pitch
48 %, alarm interval 47 %, and the Geiger interval's fastest realized rate is ~3.3 clicks/s rather
than the 33 clicks/s the mapping implies.

**Impact:** the instrument never reaches the top of its own expressive range. The most dramatic
moment in the application — a Class V outbreak — drives the hum to 119 Hz of a possible 165 Hz and
the crackle to 3/s of a possible 33/s.

**Remediation:** renormalize the mapping denominators to the realized span (0–45 mG), and — the
better fix — export the mapping constants next to `ENGINE_CONSTANTS` when the engine is extracted, so
one table defines both the signal domain and the audio response.

**Verification:** at 43 mG the hum reaches ~160 Hz and the Geiger interval reaches ~50 ms; a unit
test asserts the two constant sets share a declared maximum.

---

<a id="td-11"></a>
### TD-11 — `accentColor` drilled through nine components

| | |
| --- | --- |
| **Severity** | Low · **Category** Architecture |
| **Evidence** | [`src/App.tsx`](../src/App.tsx) passes `accentColor` to all nine components; `DeviceSpecs` also receives the setter |

The accepted cost of not introducing a context ([ADR-0001](decisions/0001-single-source-of-truth.md)).
It is Low, but it has two sharp edges worth recording:

- Adding a tenth component or a themed sub-element means editing the prop chain.
- `accentColor` must stay **6-digit hex**, because canvas code composes alpha by string
  concatenation (`${accentColor}44`). A CSS variable, `rgb()`, or 3-digit hex would silently produce
  invalid colours in all three canvases. That constraint is undocumented in code and easy to break.

**Remediation:** Tailwind v4 makes the clean fix cheap — set `--color-accent` on the root element and
consume it as `var(--color-accent)` in CSS. Canvas still needs a concrete colour string, so either
keep the prop for the three canvas components only, or resolve the variable once via
`getComputedStyle`. This also fixes the theme/token drift in
[A11Y-16](accessibility.md#3-wcag-22-findings).

## 5. Repository, build, and hygiene

<a id="td-15"></a>
### TD-15 — Preview instrumentation committed to `index.html`

| | |
| --- | --- |
| **Severity** | **Critical** · **Category** Repository hygiene, privacy |
| **Evidence** | [`index.html`](../index.html) — three injected `<script>` blocks; measured composition of `dist/index.html`: 6 303 B session recorder + 6 899 B element picker + **494 B actual application** |

The committed entry document contains tooling from the environment the project was generated in:

| Script | Behaviour |
| --- | --- |
| `data-arena-recording` | Loads `rrweb` from a public CDN, records DOM mutations, clicks, scroll depth, cursor path, and keystrokes into `sessionStorage`, and posts the payload to `window.parent` |
| `data-arena-views` | `fetch()`es a page-view beacon — including a generated viewer id persisted in `localStorage` and the referrer domain — to an external analytics endpoint |
| `data-element-picker` | Injects a DOM inspection overlay and reports clicked elements' source locations to the parent frame |

**Impact:** deploying the repository as-is means shipping keystroke and cursor recording plus
third-party telemetry to every visitor, from a portfolio repository, with no disclosure. It also
contradicts the application's own verified property — `src/` performs **zero** network I/O and
touches no storage API ([API §4, invariant I6](api.md#4-invariants)) — because the violation lives in
the HTML document, not the source. Secondary costs: 13.2 kB of HTML, a CDN dependency, and a
`sessionStorage` payload that grows during a session.

**Remediation:** delete all three blocks. The clean 12-line replacement document, including the
`description` and `theme-color` meta tags the page should have anyway, is in
[Deployment §6.1](deployment.md#61-injected-scripts-in-indexhtml).

**Verification:** `grep -c 'data-arena\|data-element-picker' dist/index.html` → `0`; `wc -c
dist/index.html` → under 1 kB; a deployed page's network tab shows requests to your origin only.

---

<a id="td-16"></a>
### TD-16 — `.vite-source-tags.js` is tracked *and* ignored, and runs in production

| | |
| --- | --- |
| **Severity** | Medium · **Category** Build |
| **Evidence** | listed in [`.gitignore`](../.gitignore) **and** present in `git ls-files`; [`vite.config.ts:8-13`](../vite.config.ts) loads it unconditionally; **554** `data-source-loc` attributes counted in `dist/assets/*.js` |

Three problems in one file:

1. **Contradictory tracking.** A tracked file is unaffected by `.gitignore`, so the ignore rule is
   inert. Either `git rm --cached .vite-source-tags.js` (local-only tooling) or delete the ignore
   line (first-class project file). The current state communicates neither intent.
2. **It runs in production builds** — its own header comment says this is deliberate — so the shipped
   bundle carries `data-source-loc="src/components/SystemBoot.tsx:61:4"` on **every** JSX element:
   554 attributes disclosing the repository's file layout and line numbers, plus per-node DOM weight.
3. **The loader's `catch {}` is silent**, which hides genuine plugin failures behind an intentional
   one (and is one of the three `no-empty` lint errors).

**Remediation:** gate to `mode === 'development'`, log the catch at debug level, and resolve the
tracking contradiction. Patch in [Deployment §6.2](deployment.md#62-the-source-tags-vite-plugin).

**Verification:** `grep -c 'data-source-loc' dist/assets/*.js` → `0`, while `npm run dev` still emits
the attributes.

---

<a id="td-21"></a>
### TD-21 — Tailwind compiles documentation prose into the production CSS

| | |
| --- | --- |
| **Severity** | Medium · **Category** Build |
| **Introduced by** | `0.1.0`. This entry did not exist at `102e524` — writing the documentation created it |
| **Evidence** | A/B build of the same tree, with and without the 24 new Markdown files: CSS is **41 853 B** vs **44 212 B** raw (**+2 359 B**, +5.6 %) and **7 874 B** vs **8 132 B** gzipped (+258 B). Selector count 360 → 377; **17 rules** exist only in the second build |

Tailwind v4 has no `content` array. Automatic source detection scans every non-ignored text file in
the project and extracts anything that could be a class candidate — **including Markdown**. Writing
documentation therefore changed the shipped stylesheet:

| Rule now in `dist/` | The documentation token that produced it |
| --- | --- |
| `.container`, `.table`, `.contents`, `.inline`, `.visible`, `.invisible`, `.underline`, `.grow`, `.start`, `.end`, `.transform` | ordinary English words in prose, headings, and table cells |
| `.backdrop-blur`, `.py-1.5` | class names quoted while describing the layout |
| `.focus:ring`, `.focus-visible:outline`, `.focus-visible:outline-2`, `.focus-visible:outline-offset-2` | remediation snippets in [Accessibility §5](accessibility.md#5-remediation-plan) |

Three consequences, in ascending order of seriousness:

1. **2.4 kB of dead CSS ships to every visitor** — 5.6 % of the stylesheet, for rules that match no
   element in the DOM.
2. **The payload stopped being deterministic.** A new sentence may contain a utility name, so editing
   a guide can change `dist/`. A documentation-only PR can now move a number that
   [Performance §7](performance.md#7-budget) tracks as a budget.
3. **It misleads anyone reading the built CSS.** `.visible` and `.table` look like evidence that the
   application uses those classes. It does not.

This is a property of Tailwind v4's zero-config default, not a mistake in the documentation — and the
same mechanism would fire on any future non-source text file added to the repository (a `blog/`,
`CHANGELOG` prose, a design note). The fix is small.

**Remediation:** constrain the scan to files that can actually render classes. In
[`src/index.css`](../src/index.css):

```css
@import "tailwindcss" source(none);

@source "../index.html";
@source "../src";
```

`source(none)` disables automatic detection; the two directives name the only inputs that matter.
Both forms were verified against the installed `tailwindcss@4.2.1` — its CSS entry parser accepts
`source(none)`, and `@source` accepts a `not` prefix for negation (`@source not "../docs";`), with
**quoted paths required** in every case. A negation-only variant is one line, but it leaves the
coupling in place for the next text file someone adds.

**Verification:** `npm run build` reports CSS back at ≈ 41.9 kB / 7.9 kB gzip; then add the word
"container" to any guide, rebuild, and confirm the stylesheet is byte-identical. Scheduled as
[Roadmap D21](roadmap.md#2-phase-0--publishable).

---

<a id="td-06"></a>
### TD-06 — Unused dependencies and orphan files

| | |
| --- | --- |
| **Severity** | Low · **Category** Hygiene |

| Item | Evidence | Note |
| --- | --- | --- |
| `framer-motion` 12.35.0 | declared in `package.json`; **zero imports** in `src/` | Contributes 0 bytes to the bundle (never imported), but inflates install and audit surface |
| `react-router-dom` 7.18.3 | declared; **zero imports** | Also the reason there is no URL routing at all — see [API §5](api.md#5-what-is-deliberately-not-an-api) |
| `src/App.css` | **0 bytes**, imported nowhere | Delete |
| 5 unused icon imports in `App.tsx`, 12 more across components | [Appendix A](#appendix-a--complete-eslint-baseline) | `Cpu`, `Activity`, `Sparkles`, `HelpCircle`, `ShieldAlert`, … |

**Remediation:** `npm uninstall framer-motion react-router-dom`, delete `src/App.css`, run
`eslint . --fix`. If routing or animation is genuinely wanted, adopt one deliberately — the
[roadmap](roadmap.md) treats deep-linkable tabs as a feature decision, not a dependency cleanup.

**Verification:** `npm ls --depth=0` shows both packages gone; `npm run build` still passes; bundle
size unchanged (they were never in it).

---

<a id="td-08"></a>
### TD-08 — Dead code and silently swallowed failures

| | |
| --- | --- |
| **Severity** | Low · **Category** Hygiene |

| Item | Location | Note |
| --- | --- | --- |
| `hauntingTimer` / `setHauntingTimer` | [`App.tsx:53`](../src/App.tsx) | State declared, never read or written |
| `hauntingIntervalRef` | [`App.tsx:63`](../src/App.tsx) | Ref declared, never used — and it is the ref TD-04 needs |
| `currentStep` / `setCurrentStep` | [`SystemBoot.tsx:12`](../src/components/SystemBoot.tsx) | The boot chain tracks its step in a local variable instead |
| `blips` binding | [`RadarGrid.tsx:26`](../src/components/RadarGrid.tsx) | Written every frame, never read during render — see TD-01 |
| `RadarBlip.age` | [`RadarGrid.tsx:21`](../src/components/RadarGrid.tsx) | Incremented per frame, never consumed; the intended hook for contact expiry |
| `playPowerDown()` | [`audio.ts:326`](../src/utils/audio.ts) | Fully implemented 30-line voice, zero call sites |
| `getIsMuted()` | [`audio.ts:456`](../src/utils/audio.ts) | Zero call sites; mute state is duplicated in `App.tsx` |
| `humFilter.Q` | [`audio.ts:61`](../src/utils/audio.ts) | Set once to 5, never modulated — an unused expressiveness lever |
| 4 silent `catch (e)` blocks | [`audio.ts:162`](../src/utils/audio.ts), `:250`, `:376`, `:426` | Two are empty statements (lint `no-empty`). Swallowing audio errors is correct policy; swallowing them *silently* is not |

**Remediation:** delete the dead state and the unused methods — unless `playPowerDown()` is wired
into the outbreak resolution, which is the semantically correct place for it and the better outcome
([Audio Synthesis §7](audio-synthesis.md#7-dead-and-unreachable-surface)). Replace empty catches with
a single `console.debug` behind a `DEBUG_AUDIO` flag so the policy stays "never break the UI" while
becoming diagnosable.

---

<a id="td-09"></a>
### TD-09 — Documentation and comment drift

| | |
| --- | --- |
| **Severity** | Low · **Category** Documentation |
| **Status** | README drift corrected by this documentation overhaul; in-code drift remains |

| Claim | Actual | Where |
| --- | --- | --- |
| Previous README: sensitivity range 1–20 | **1–100** | [`Diagnostics.tsx:53-54`](../src/components/Diagnostics.tsx) |
| Previous README: Geiger "~2 s → ~30 ms" | mapping domain, not realized behaviour; realized fastest ≈ **306 ms** at 43 mG | [Audio Synthesis §4.3](audio-synthesis.md#43-the-domain-mismatch-problem) |
| `// Stop haunting after 12 seconds` | **15 000 ms** | [`App.tsx:166`](../src/App.tsx) vs `:174` |
| `// 10 segmented blocks` | `Array.from({ length: 15 })` | [`LiveEMFDisplay.tsx:212-213`](../src/components/LiveEMFDisplay.tsx) |
| `// 95% of the time, stay near background level (0.4 to 1.5 mG)` | a symmetric random walk with no mean reversion; the quiet band is 0.2–3.0 mG | [`App.tsx:111-112`](../src/App.tsx) |
| Boot log: `DATABASE LOADED (142 ENTITIES)` | 4 entities ship | [`SystemBoot.tsx:28`](../src/components/SystemBoot.tsx) vs [`EntityDatabase.tsx:23`](../src/components/EntityDatabase.tsx) |
| Firmware string | three variants: `AETHER_OS v4.09`, `v4.09.2-SPECTRAL`, `SPECTRAL_OS_v4.09` | `SystemBoot`, `DeviceSpecs`, `App` footer |

**Impact:** individually trivial; collectively the reason a careful reader stops trusting the
comments. The `95%` comment in particular describes a model the code does not implement.

**Remediation:** correct the three stale code comments, and hoist the firmware string and the entity
count into named constants shared by the UI surfaces that display them. Normative documentation now
lives in [docs/](README.md), which cites source rather than intent — the comments can then be reduced
to *why*, not *what*.

---

<a id="td-18"></a>
### TD-18 — `favicon.svg` referenced but absent

| | |
| --- | --- |
| **Severity** | Low · **Category** Build |
| **Evidence** | [`index.html:5`](../index.html) declares `/favicon.svg`; there is no `public/` directory; `find dist -name '*favicon*'` returns nothing |

Every page load issues a request that 404s. Fix and file contents in
[Deployment §5](deployment.md#5-missing-favicon).

---

<a id="td-19"></a>
### TD-19 — Zero automated test coverage

| | |
| --- | --- |
| **Severity** | Medium · **Category** Assurance |
| **Evidence** | no `*.test.*` or `*.spec.*` files, no `test` script, no test runner in the dependency tree |

The full analysis — why coverage is zero, what blocks it, and the 32 specifications worth writing
first — is [Testing](testing.md). Recorded here so it is visible in the same list as everything else.

---

<a id="td-20"></a>
### TD-20 — Accessibility conformance gaps

| | |
| --- | --- |
| **Severity** | Tracked separately · **Category** Accessibility |

Sixteen findings (A11Y-01 … A11Y-16), including five Level A failures, with measured contrast ratios
and a four-phase remediation plan, are in [Accessibility](accessibility.md). Not itemized here to
avoid two competing lists; this entry exists so the register is complete.

## 6. Deliberate non-issues

Recorded so they are not "fixed" by someone who has not read the reasoning:

| Looks like debt | Why it is not |
| --- | --- |
| No state management library | 16 `useState` calls in one file, 4 upward channels in the whole app. A library would add indirection without adding capability. [ADR-0001](decisions/0001-single-source-of-truth.md) |
| No code splitting | One 316 kB chunk, 87 kB gzipped, of which two-thirds is the React runtime. Splitting per tab would add requests to save ~20 kB. Revisit if the app triples. |
| `Math.random()` instead of a PRNG library | Correct for the shipped behaviour; the *inability to inject* it is the problem (TD-19, [Testing §3](testing.md#3-the-seedability-blocker)), not the generator |
| Canvas backing stores are not DPI-aware | Deliberate: fixed stores mean no resize observer and no per-frame geometry. Softness on 2× displays is the accepted trade. [Roadmap X7](roadmap.md#7-exploration) |
| Tab panels unmount instead of hiding | Bounds the work to one canvas loop at a time. The cost — lost per-tab state — is a feature decision. [Roadmap X8](roadmap.md#7-exploration) |
| No persistence | Intentional for a "handheld instrument" that powers on cold each time. [Roadmap E1](roadmap.md#6-phase-4--capable) |
| Audio singleton | Deliberate, with a real cost. [ADR-0003](decisions/0003-audio-as-a-module-singleton.md) |

## 7. Closed

| ID | Title | Closed by | Date |
| --- | --- | --- | --- |
| — | No CI, no issue or PR templates, no changelog, no contributor documentation | This documentation overhaul: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`.github/`](../.github), [`CHANGELOG.md`](../CHANGELOG.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md) | 2026-10-09 |
| — | Undocumented architecture, no ADRs, no record of known defects | [`docs/`](README.md) — 13 documents, 6 ADRs, this register | 2026-10-09 |

IDs are never reused; closed entries stay here for the audit trail.

---

## Appendix A — complete ESLint baseline

Reproduce with `npx eslint . -f json`. 45 errors, 0 warnings, at commit `102e524` with
ESLint 9.39.5, typescript-eslint 8.48.x, and eslint-plugin-react-hooks 7.1.1.

| File | Line | Rule | Message |
| --- | --- | --- | --- |
| `src/App.tsx` | 11 | `@typescript-eslint/no-unused-vars` | 'Cpu' is defined but never used. |
| `src/App.tsx` | 13 | `@typescript-eslint/no-unused-vars` | 'Activity' is defined but never used. |
| `src/App.tsx` | 16 | `@typescript-eslint/no-unused-vars` | 'Sparkles' is defined but never used. |
| `src/App.tsx` | 18 | `@typescript-eslint/no-unused-vars` | 'HelpCircle' is defined but never used. |
| `src/App.tsx` | 19 | `@typescript-eslint/no-unused-vars` | 'ShieldAlert' is defined but never used. |
| `src/App.tsx` | 53 | `@typescript-eslint/no-unused-vars` | 'hauntingTimer' is assigned a value but never used. |
| `src/App.tsx` | 53 | `@typescript-eslint/no-unused-vars` | 'setHauntingTimer' is assigned a value but never used. |
| `src/App.tsx` | 63 | `@typescript-eslint/no-unused-vars` | 'hauntingIntervalRef' is assigned a value but never used. |
| `src/App.tsx` | 297 | `@typescript-eslint/no-explicit-any` | Unexpected any. Specify a different type. |
| `src/components/AnomalyLog.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'ShieldAlert' is defined but never used. |
| `src/components/AnomalyLog.tsx` | 56 | `react-hooks/set-state-in-effect` | Error: Calling setState synchronously within an effect can trigger casca |
| `src/components/AnomalyLog.tsx` | 86 | `react-hooks/set-state-in-effect` | Error: Calling setState synchronously within an effect can trigger casca |
| `src/components/AnomalyLog.tsx` | 109 | `react-hooks/set-state-in-effect` | Error: Calling setState synchronously within an effect can trigger casca |
| `src/components/AnomalyLog.tsx` | 126 | `react-hooks/set-state-in-effect` | Error: Calling setState synchronously within an effect can trigger casca |
| `src/components/DeviceSpecs.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Sliders' is defined but never used. |
| `src/components/DeviceSpecs.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Shield' is defined but never used. |
| `src/components/DeviceSpecs.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Palette' is defined but never used. |
| `src/components/Diagnostics.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Shield' is defined but never used. |
| `src/components/Diagnostics.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Zap' is defined but never used. |
| `src/components/Diagnostics.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'AlertCircle' is defined but never used. |
| `src/components/EntityDatabase.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Sparkles' is defined but never used. |
| `src/components/EVPRecorder.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Volume2' is defined but never used. |
| `src/components/EVPRecorder.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'HelpCircle' is defined but never used. |
| `src/components/EVPRecorder.tsx` | 107 | `react-hooks/set-state-in-effect` | Error: Calling setState synchronously within an effect can trigger casca |
| `src/components/EVPRecorder.tsx` | 111 | `react-hooks/immutability` | Error: Cannot access variable before it is declared |
| `src/components/LiveEMFDisplay.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'ShieldAlert' is defined but never used. |
| `src/components/LiveEMFDisplay.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'ZapOff' is defined but never used. |
| `src/components/RadarGrid.tsx` | 26 | `@typescript-eslint/no-unused-vars` | 'blips' is assigned a value but never used. |
| `src/components/SystemBoot.tsx` | 1 | `@typescript-eslint/no-unused-vars` | 'useEffect' is defined but never used. |
| `src/components/SystemBoot.tsx` | 12 | `@typescript-eslint/no-unused-vars` | 'currentStep' is assigned a value but never used. |
| `src/components/SystemBoot.tsx` | 12 | `@typescript-eslint/no-unused-vars` | 'setCurrentStep' is assigned a value but never used. |
| `src/components/TriangulationMap.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'ShieldAlert' is defined but never used. |
| `src/components/TriangulationMap.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Radio' is defined but never used. |
| `src/components/TriangulationMap.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Landmark' is defined but never used. |
| `src/components/TriangulationMap.tsx` | 2 | `@typescript-eslint/no-unused-vars` | 'Eye' is defined but never used. |
| `src/components/TriangulationMap.tsx` | 60 | `react-hooks/set-state-in-effect` | Error: Calling setState synchronously within an effect can trigger casca |
| `src/utils/audio.ts` | 37 | `@typescript-eslint/no-explicit-any` | Unexpected any. Specify a different type. |
| `src/utils/audio.ts` | 162 | `@typescript-eslint/no-unused-vars` | 'e' is defined but never used. |
| `src/utils/audio.ts` | 250 | `@typescript-eslint/no-unused-vars` | 'e' is defined but never used. |
| `src/utils/audio.ts` | 376 | `@typescript-eslint/no-unused-vars` | 'e' is defined but never used. |
| `src/utils/audio.ts` | 376 | `no-empty` | Empty block statement. |
| `src/utils/audio.ts` | 426 | `@typescript-eslint/no-unused-vars` | 'e' is defined but never used. |
| `src/utils/audio.ts` | 426 | `no-empty` | Empty block statement. |
| `vite.config.ts` | 9 | `@typescript-eslint/ban-ts-comment` | Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do  |
| `vite.config.ts` | 12 | `no-empty` | Empty block statement. |
