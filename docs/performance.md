# Performance

| | |
| --- | --- |
| **Audience** | Contributors changing rendering, animation, or the bundle |
| **Status** | All bundle figures **measured** at commit `102e524` (Vite 7.3.6, Node 22.22.3). All runtime figures are **structural counts derived from source** — no browser profiling has been performed. The distinction is marked throughout. |
| **Companion** | [ADR-0002 · Two rendering domains](decisions/0002-two-rendering-domains.md) · [Tech-Debt Register](tech-debt.md) |

---

## 1. What "fast" means here

The application has no data fetching, no route transitions, and no persistence. Its performance
profile is therefore almost entirely **sustained frame rate under a continuous update loop** — a
different problem from a typical web app, where the concern is time-to-interactive. Two numbers
matter:

| Budget | Target | Governs |
| --- | --- | --- |
| Frame budget | 16.7 ms at 60 fps | canvas work + React commits per frame |
| Initial payload | < 100 kB gzipped, no media | bundle size |

The second is met. The first is met in practice but with roughly **5× more React work than the
design requires**, for reasons quantified in §4.

## 2. Measured bundle

`npm run build` output, verbatim:

```
vite v7.3.6 building client environment for production...
✓ 1752 modules transformed.
dist/index.html                  13.70 kB │ gzip:  4.70 kB
dist/assets/index-CtyZQl8u.css   44.21 kB │ gzip:  8.13 kB
dist/assets/index-B26N0IDF.js   316.09 kB │ gzip: 86.77 kB
✓ built in 3.22s
```

| Artifact | Raw | Gzip | Notes |
| --- | --- | --- | --- |
| JS (single chunk) | 316.09 kB | **86.77 kB** | no code splitting; one entry, one chunk |
| CSS | 44.21 kB | **8.13 kB** | Tailwind v4, utilities emitted on demand — ⚠ includes 2.4 kB compiled from documentation prose, see §2.4 |
| HTML | 13.70 kB | 4.70 kB | ⚠ see §2.2 — only 494 bytes of this is the application |
| **Total transferred** | — | **≈ 99.6 kB** | under the 100 kB budget, with zero media — 0.4 kB of headroom |
| Media | **0 kB** | **0 kB** | no images, no audio, no fonts, no favicon — [ADR-0004](decisions/0004-zero-runtime-assets.md) |

Build: 1 752 modules transformed in **3.22 s** cold-cache (±0.2 s between runs); install is 203
packages, ~6 s warm.

> [!WARNING]
> The CSS figures above are **not** the figures the application alone produces. Tailwind v4 scans every
> text file in the project, so the documentation is part of the stylesheet's input. The difference is
> measured and attributed in [§2.4](#24-the-stylesheet-grows-when-the-documentation-does); the fix is [Roadmap D21](roadmap.md#2-phase-0--publishable).


### 2.1 Composition

Attribution from an esbuild metafile (minified, CSS excluded, 282.9 kB total). esbuild and Rollup
minify differently, so treat the **proportions** as indicative and the §2 totals as authoritative.

| Module | Minified | Share |
| --- | --- | --- |
| `react-dom` | 176.1 kB | **62.2 %** |
| `src/components/*` (9 files) | 64.3 kB | 22.7 % |
| `src/App.tsx` | 13.5 kB | 4.8 % |
| `lucide-react` (39 icons) | 9.5 kB | 3.4 % |
| `src/utils/audio.ts` | 8.3 kB | 2.9 % |
| `react` | 7.5 kB | 2.6 % |
| `scheduler` | 3.6 kB | 1.3 % |
| `src/main.tsx` | 0.2 kB | 0.1 % |
| **React runtime subtotal** | **187.2 kB** | **66.1 %** |
| **Application subtotal** | **86.3 kB** | **30.5 %** |

Two-thirds of the payload is the React runtime; the entire simulation, nine components, and the
audio synthesizer together are 86 kB. **`framer-motion` and `react-router-dom` contribute exactly
0 bytes** — they are declared dependencies that nothing imports, so the bundler never sees them
([TD-06](tech-debt.md)). They cost install time and audit surface, not bytes.

Per-file application weights:

| File | Source lines | Minified | B/line |
| --- | --- | --- | --- |
| `App.tsx` | 522 | 13.47 kB | 26 |
| `LiveEMFDisplay.tsx` | 349 | 9.44 kB | 28 |
| `RadarGrid.tsx` | 425 | 8.31 kB | 20 |
| `utils/audio.ts` | 461 | 8.30 kB | 18 |
| `TriangulationMap.tsx` | 292 | 8.29 kB | 28 |
| `AnomalyLog.tsx` | 285 | 8.10 kB | 28 |
| `SystemBoot.tsx` | 201 | 7.92 kB | 39 |
| `EVPRecorder.tsx` | 302 | 6.80 kB | 23 |
| `EntityDatabase.tsx` | 195 | 6.37 kB | 33 |
| `Diagnostics.tsx` | 162 | 5.54 kB | 34 |
| `DeviceSpecs.tsx` | 98 | 3.55 kB | 36 |

> [!NOTE]
> 26–39 bytes per source line is high for minified output, and the reason is not logic — it is
> **Tailwind class strings**. They are string literals, so minification cannot shorten them, and the
> panel treatment (`border border-zinc-900 bg-zinc-950/80 rounded-lg p-4 flex flex-col h-full
> shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] font-mono`) is duplicated almost verbatim across all nine
> components. Extracting it into a Tailwind v4 `@utility panel` block would remove the duplication
> from **both** the JS (≈2–3 kB) and the CSS. `SystemBoot` has the worst ratio (39 B/line) because
> its decorative HUD layers are almost entirely class strings.

### 2.2 The HTML artifact is 96 % not-application

Measured byte composition of `dist/index.html`:

| Content | Bytes | Share |
| --- | --- | --- |
| Injected preview instrumentation (session recorder) | 6 303 | 46.0 % |
| Injected element-picker script | 6 899 | 50.4 % |
| **Application shell** (`<div id="root">` + module script + meta) | **494** | **3.6 %** |

These scripts are artifacts of the environment the project was generated in, they load a
third-party CDN at runtime, and they ship source-structure metadata into production. They must be
stripped before deployment — [Deployment §6](deployment.md#6-strip-preview-instrumentation-before-deploying),
[TD-15](tech-debt.md). The clean document is ~0.5 kB.

### 2.3 Source-path metadata in the JS bundle

The optional `.vite-source-tags.js` plugin runs in production builds and the shipped JS contains
**554** `data-source-loc="src/components/SystemBoot.tsx:61:4"`-style attributes — one per JSX
element. Cost: DOM attribute weight on every node plus disclosure of the repository's file layout.
Disable it for production builds; see [Development §9](development.md#9-the-vite-source-tagsjs-plugin).

### 2.4 The stylesheet grows when the documentation does

Tailwind v4 detects source files automatically — there is no `content` array — and "automatically"
means every non-ignored text file in the project, **Markdown included**. The `0.1.0` documentation
release therefore changed the production CSS:

| Build | Markdown files in tree | CSS raw | CSS gzip | Selectors emitted |
| --- | --- | --- | --- | --- |
| Pristine snapshot (`102e524`) | 1 | 41.85 kB | 7.87 kB | 360 |
| This tree (`0.1.0`) | 25 | **44.21 kB** | **8.13 kB** | **377** |

Same `npm run build`, same environment, same `src/`; the only difference between the two trees is the
documentation. Seventeen rules exist because their names appear in prose — `.container`, `.table`,
`.contents`, `.inline`, `.visible`, `.invisible`, `.underline`, `.grow`, `.start`, `.end`,
`.transform`, `.backdrop-blur`, `.py-1.5`, `.focus:ring`, and three `.focus-visible:outline-*`
variants. **None of them match an element in the DOM.**

Two consequences for anyone working here:

- **A documentation PR can move a budget line.** If you add prose containing a utility-shaped word,
  re-measure [§7](#7-budget) — the payload is a function of the docs until D21 lands.
- **The fix is small and scheduled.** One `source(none)` plus two `@source` directives:
  [TD-21](tech-debt.md#td-21) carries the verified syntax and the verification step.

## 3. Runtime update topology

Structural counts, derived from the source. These are exact; their *timing* implications are not
measured (§5 explains how to measure them).

### 3.1 Timers and wakeups

| Source | Period | Wakeups/s | Causes a React commit? |
| --- | --- | --- | --- |
| Header clock ([`App.tsx:67`](../src/App.tsx)) | 100 ms | **10.0** | yes — App subtree, i.e. everything mounted |
| Derived-field sampler ([`LiveEMFDisplay.tsx:28`](../src/components/LiveEMFDisplay.tsx)) | 150 ms | 6.7 | yes — one subtree |
| Simulation tick ([`App.tsx:89`](../src/App.tsx)) | 300 ms | 3.3 | yes — App subtree |
| GPS jitter ([`App.tsx:72`](../src/App.tsx)) | 5 s | 0.2 | yes — App subtree |
| Node fluctuation ([`TriangulationMap.tsx:66`](../src/components/TriangulationMap.tsx)) | 1 s | **0** | starved — [TD-02](tech-debt.md) |
| Geiger chain ([`audio.ts:100`](../src/utils/audio.ts)) | 0.3–4 s | ≈ 3.3 peak | no — audio thread only |

### 3.2 React commits per second, Dashboard tab

React auto-batches updates issued within one `requestAnimationFrame` callback, so two `setState`
calls in one frame produce one commit.

| Driver | Commits/s | Subtree |
| --- | --- | --- |
| `RadarGrid` frame loop ([TD-01](tech-debt.md)) | **60** | radar panel + up to 5 contact cards |
| Header clock ([TD-17](tech-debt.md)) | 10 | **entire console** |
| Derived-field sampler | 6.7 | EMF display |
| Simulation tick | 3.3 | entire console |
| GPS jitter | 0.2 | entire console |
| **Total** | **≈ 80** | |

Of those ~80 commits/s, roughly **10 are informationally required** (the simulation tick and the
derived-field sampler). ~60 exist because the radar advances its physics through React state, and
~10 because a 12-character clock string lives in the same component as the simulation engine.

**Nothing in the codebase is memoized** — verified: zero occurrences of `React.memo`, `useMemo`, or
`useCallback` across `src/`. So every App commit walks the full mounted subtree. At the Dashboard
tab that is `LiveEMFDisplay` + `RadarGrid` + `AnomalyLog` plus the two sidebar panels, ~13.5 times
per second.

Both amplifiers are cheap to fix, and neither requires memoization:

1. **Move radar physics into a ref** ([Performance §4.1](#41-defect-per-frame-react-writes-in-the-radar-loop)) — removes ~60 commits/s.
2. **Move the clock into its own leaf component** — removes ~10 commits/s and, more importantly,
   stops a 10 Hz string update from re-rendering the instrument.

That takes the steady state from ~80 commits/s to ~10, an **8× reduction**, with no behavioural
change.

## 4. Known defects

### 4.1 Defect: per-frame React writes in the radar loop

[`src/components/RadarGrid.tsx:188`](../src/components/RadarGrid.tsx) and
[`:264`](../src/components/RadarGrid.tsx). The `requestAnimationFrame` callback calls `setBlips`
(advancing physics) and `setDetectedEntities` (rebuilding the contact list) on **every frame**.

Why it is worse than it looks:

- `blips` is **never read during render** — ESLint reports it as an unused binding. The entire
  per-frame `setBlips` exists to advance physics that could live in a ref.
- `setDetectedEntities(detectedThisFrame.slice(0, 5))` allocates a **new array every frame**, so
  reference equality never holds and React can never bail out. The contact list DOM (up to 5 cards,
  each with computed distance, bearing, and an inline-style energy bar) is rebuilt 60×/s.
- Inside the same updater, the boundary rule **mutates `blip.speedX`/`speedY` in place**
  ([`:201-202`](../src/components/RadarGrid.tsx)) before returning a shallow copy — the mutation
  escapes the copy. This is the `react-hooks/immutability` finding, and it means the "previous"
  state object is not actually immutable.

Fix, in order:

```
1. Move blip physics into a `blipsRef: RadarBlip[]`. Mutate freely; it is a frame-local simulation.
2. Draw from the ref inside the same loop. Zero React involvement per frame.
3. Commit to `detectedEntities` on a coarse interval (150–250 ms) *only if the derived list changed*
   — compare ids and rounded distance/bearing, and skip the write when they are equal.
4. Keep `isScanning`, `hauntingActive`, and `accentColor` as effect deps; read `emfLevel` from a ref
   updated by a small effect, so the loop is not rebuilt per tick.
```

Steps 1–3 remove ~60 commits/s. Step 4 also fixes §4.2 for this component.

### 4.2 Defect: frame loops rebuild on every tick

All three canvas effects list values that change on the tick in their dependency arrays, so each
loop is torn down and re-created rather than running continuously:

| Component | Effect deps | Rebuild rate |
| --- | --- | --- |
| `LiveEMFDisplay` ([`:156`](../src/components/LiveEMFDisplay.tsx)) | `emfLevel, sensitivity, hauntingActive, accentColor` | **3.3×/s** |
| `EVPRecorder` ([`:102`](../src/components/EVPRecorder.tsx)) | `isRecording, isDemodulating, playbackActive, demodulateProgress, accentColor` | 4×/s during decode |
| `RadarGrid` ([`:287`](../src/components/RadarGrid.tsx)) | `accentColor, isScanning, hauntingActive` | ✓ stable |

Each rebuild is `cancelAnimationFrame` + a fresh closure + a fresh context lookup, and the first
frame of the new loop paints before the next one is scheduled. Visually correct — `LiveEMFDisplay`
preserves phase in `waveOffsetRef` — but it is churn, and it makes the loop's captured `emfLevel`
always one tick stale at best.

`RadarGrid` already has the right shape: its deps are all low-frequency, and it reads the changing
value (`emfLevel`) only in a *separate* spawn effect. Copy that pattern: **the draw loop should
depend only on things that change on user action; anything that changes on the tick is read from a
ref.**

### 4.3 Per-frame allocations in the draw loops

Small, but they are per-frame and free to remove:

| Allocation | Location | Rate | Fix |
| --- | --- | --- | --- |
| `ctx.createRadialGradient(…)` | [`RadarGrid.tsx:173`](../src/components/RadarGrid.tsx) | 60/s | Cache; it depends only on centre, radius, and `accentColor` |
| New `RadarBlip[]` from `.map()` | `RadarGrid.tsx:188` | 60/s | Removed by the ref refactor (§4.1) |
| `detectedThisFrame.slice(0, 5)` | `RadarGrid.tsx:264` | 60/s | Same |
| Two template-literal rgba strings per blip | `RadarGrid.tsx:225`, `:238` | up to 480/s | Precompute per accent colour |

### 4.4 `shadowBlur` is the most expensive call in the loops

Canvas `shadowBlur` forces a blur pass over the drawn geometry; it is consistently one of the
costliest 2D-context operations, and this codebase uses it in the hot path:

| Site | Blur | Frequency |
| --- | --- | --- |
| `RadarGrid` contact halo ([`:223`](../src/components/RadarGrid.tsx)) | 10 | per contact per frame — up to **480 blurred fills/s** during an outbreak |
| `LiveEMFDisplay` trace ([`:111`](../src/components/LiveEMFDisplay.tsx)) | 4 | once per frame, over a 280-point path |

Both are also set-then-reset (`shadowBlur = 0`) around the draw, which is correct hygiene but does
not avoid the cost. Two cheaper routes, in order of effort:

1. **Pre-render the glow sprite once** to an offscreen canvas per contact size, then `drawImage` it.
   A blurred circle becomes a bitmap blit — typically an order of magnitude cheaper.
2. **Fake the bloom with a radial gradient fill** (transparent at the rim), which the radar already
   does for the sweep wedge.

Whether this matters depends entirely on the GPU; it is the first thing to check if the radar drops
frames on integrated graphics. Measure before optimizing (§5).

## 5. How to measure what this document does not

No browser profiling has been done for these figures. To turn §3–§4 into measurements:

| Question | Tool | Procedure |
| --- | --- | --- |
| Actual commits/s and their cost | React DevTools → Profiler | Record 5 s on the Dashboard, enable "why did this render". Expect `RadarGrid` dominating until §4.1 lands. |
| Frame time distribution | Chrome Performance panel | Record 10 s; check the Frames track for anything over 16.7 ms and correlate with the outbreak window. |
| Long tasks | `PerformanceObserver` on `longtask` | Add temporarily in `main.tsx`; anything > 50 ms during an outbreak is worth a look. |
| GPU vs CPU bound | Chrome tracing, `gpu` category | Distinguishes §4.4 (`shadowBlur`) from §4.1 (React). |
| Bundle attribution | `rollup-plugin-visualizer` | Exact per-module bytes for the Rollup build; §2.1 uses esbuild as a proxy. |
| Regression guard | CI size check | [CI](../.github/workflows/ci.yml) prints the artifact sizes into its job summary on every run. The *failing* gate — abort above ~95 kB gzipped JS — is [Roadmap F3](roadmap.md#4-phase-2--verifiable). |

## 6. What is already right

Recorded so it is not accidentally optimized away:

- **Canvas for anything above ~10 Hz, DOM for everything below.** The three frame-looped surfaces
  (oscilloscope, radar, EVP waveform) are exactly the three that need 60 fps. Readouts, logs, and
  lists are DOM. [ADR-0002](decisions/0002-two-rendering-domains.md).
- **Translucent-fill trails instead of history buffers.** `rgba(0,0,0,α)` per frame gives phosphor
  persistence for one fill call, with no array of past samples to allocate or walk.
- **Fixed-size canvas backing stores** (280×110, 300×300, 320×120) scaled by CSS. No resize
  observers, no per-frame geometry recalculation. (Cost: not DPI-aware — [Roadmap X7](roadmap.md#7-exploration).)
- **Bounded collections everywhere.** Log capped at 50, contacts at 8, the DOM contact list at 5.
  There is no unbounded array in the application, so a long session does not grow the heap.
- **Zero media.** Nothing to decode, no layout shift from late-loading images, no font swap. The
  monospace stack is system-provided.
- **Tab panels unmount rather than hide**, so at most one canvas loop is ever running for the
  content column. (Trade-off: per-tab state is lost on navigation — [Roadmap X8](roadmap.md#7-exploration).)
- **Audio parameter changes use `setTargetAtTime`**, which runs on the audio thread. The 300 ms tick
  granularity costs zero main-thread time and is inaudible as stepping.
- **One-shot audio voices are allocated per event and released when the source stops** — ~6.5
  voices/s at the peak of an outbreak, ~18 nodes/s. No pooling needed at that rate.

## 7. Budget

| Metric | Now | Budget | Status |
| --- | --- | --- | --- |
| JS, gzipped | 86.77 kB | ≤ 95 kB | ✓ |
| CSS, gzipped | 8.13 kB | ≤ 12 kB | ✓ — but 0.26 kB of it is documentation prose (§2.4) |
| HTML, gzipped | 4.70 kB | ≤ 1.5 kB | ✗ injected tooling ([TD-15](tech-debt.md)) |
| Media | 0 kB | 0 kB | ✓ |
| React commits/s, steady state | ≈ 80 | ≤ 15 | ✗ [TD-01](tech-debt.md), [TD-17](tech-debt.md) |
| Per-frame allocations in draw loops | ≥ 4 | 0 | ✗ §4.3 |
| Long tasks (> 50 ms) | unmeasured | 0 | ? measure per §5 |
| Build time | 3.22 s | ≤ 15 s | ✓ |

The payload budget is met with room to spare. The runtime budget is not, and the two defects that
break it are both localized and both documented with fixes.

---

**Next:** [Accessibility](accessibility.md) — the other place where the current state is honest
work-in-progress rather than done.
