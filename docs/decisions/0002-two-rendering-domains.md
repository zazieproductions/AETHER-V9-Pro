# 0002. Two rendering domains: React for data, canvas for frames

| | |
| --- | --- |
| **Status** | Accepted — one violation recorded ([TD-01](../tech-debt.md#td-01)) |
| **Date** | 2026-10-09 |
| **Deciders** | @zazieproductions |
| **Related** | [Architecture §5](../architecture.md#5-two-rendering-domains) · [Performance §3-4](../performance.md#3-runtime-update-topology) |

## Context

Three surfaces must animate at display refresh rate: an oscilloscope trace, a rotating radar sweep
with moving contacts, and an EVP waveform. Everything else — readings, logs, lists, tabs, settings —
changes at most a few times per second.

Mixing the two in one domain fails in both directions:

- **Animating through React state** means a reconciliation per frame. At 60 fps that is 60 commits/s
  of a subtree whose only output is pixels, and the DOM is not where those pixels are going anyway.
- **Animating through the DOM** (CSS transforms on divs, `style` writes per frame) forces layout and
  paint work that a canvas blit avoids, and cannot express a 280-point stroked path with a phosphor
  trail at all.

The engine tick is 300 ms ([ADR-0001](0001-single-source-of-truth.md)), which is 3.3 Hz — two orders
of magnitude below the frame rate. That gap is the whole opportunity: the two cadences can be
serviced by two different mechanisms, each doing what it is cheap at.

## Decision

**Split the render surface by update rate, and never let a frame-rate value pass through React
state.**

| Domain | Cadence | Owns | Storage | Output |
| --- | --- | --- | --- | --- |
| **React** | 100 ms – 5 s, event-driven | readings, logs, tabs, settings, selection | `useState` | DOM |
| **Frame** | ~16.7 ms | sweep angle, waveform phase, contact position, trail decay | `useRef` inside the drawing effect | Canvas 2D |

Rules that follow:

1. Anything animating faster than the tick is drawn to `<canvas>` inside a `requestAnimationFrame`
   loop, with its animation state in refs.
2. **A frame loop must not call a React setter.** If the DOM genuinely needs a per-frame value,
   commit it on a coarse interval (150–250 ms) and only when it changed.
3. **A frame loop's dependency array contains only things that change on user action** — accent
   colour, a freeze toggle, a mode flag. Anything that changes on the tick is read from a ref, so the
   loop is created once rather than rebuilt every tick.
4. Motion trails come from a translucent fill (`rgba(0,0,0,α)`) rather than `clearRect`, so
   persistence costs one fill call and no sample history.

## Consequences

### What it buys

- **Reconciliation is off the hot path.** The design target is ~10 commits/s of genuinely new
  information, against ~80 measured today — the excess is entirely the violation below.
- **A stable frame loop.** No per-tick closure churn, no captured-value staleness, no risk of a
  re-created loop dropping a frame.
- **The trail technique.** Phosphor persistence for one fill call per frame instead of an array of
  past samples to allocate, walk, and draw.
- **Audio and visuals stay decoupled.** Audio parameters are set on the tick and interpolate on the
  audio thread; pixels advance on the frame clock. Neither waits for the other, and the gap is below
  perceptual threshold ([Architecture §4](../architecture.md#4-data-flow-of-one-tick)).

### What it costs

- **Two mental models in one component.** A contributor editing `RadarGrid` must know which values
  live in refs and which in state, and why. This is the reason rule 3 is stated as a rule rather
  than left as taste.
- **Refs are invisible to React DevTools.** Frame-loop state does not appear in the component
  inspector, so debugging animation means breakpoints, not the profiler.
- **Duplicated truth for values the DOM also needs.** The radar's contact list is derived twice —
  once for pixels, once for DOM — and keeping them consistent is the contributor's job. They already
  disagree in one respect: the DOM list shows contacts the sweep has not illuminated
  ([Components §5](../components.md#5-radargrid)).

### What it forbids

- `setState` inside a `requestAnimationFrame` callback.
- Per-frame DOM writes for animated values.
- A frame-loop effect that depends on a tick-rate value.

## The recorded violation

[`RadarGrid`](../../src/components/RadarGrid.tsx) breaks rules 2 and 3. Its frame loop calls
`setBlips` (`:188`) to advance contact physics and `setDetectedEntities` (`:264`) to rebuild the DOM
contact list, on every frame; and `blips` is never read during render, so ~60 of the ~80 React
commits per second in the steady state produce no rendered output. The loop also mutates
`blip.speedX`/`speedY` in place on a state object (`:201-202`).

This is recorded in the ADR rather than quietly fixed or quietly ignored, because it is the clearest
possible demonstration of what the decision is for: **the cost of violating it is measurable, and it
is paid 60 times a second.** Status stays "Accepted"; the contradiction is
[TD-01](../tech-debt.md#td-01), with the remediation sequence in
[Performance §4.1](../performance.md#41-defect-per-frame-react-writes-in-the-radar-loop).

`LiveEMFDisplay` and `EVPRecorder` keep rule 2 but break rule 3 — their loops depend on `emfLevel`,
so they are rebuilt 3.3×/s ([TD-01](../tech-debt.md#td-01) family, see
[Performance §4.2](../performance.md#42-defect-frame-loops-rebuild-on-every-tick)). `RadarGrid` is
the only loop that gets rule 3 right, and it is the one that gets rule 2 wrong.

## Alternatives considered

| Option | Rejected because |
| --- | --- |
| **Everything in React state** | 60 commits/s minimum, with the DOM doing nothing useful with them. This is what `RadarGrid` accidentally implements, and the measurement is the argument. |
| **CSS animations for the sweep and waveform** | A rotating sweep could be CSS. A 280-point path with per-frame noise, a contact cloud with individual physics, and a phosphor trail cannot. Mixing CSS and canvas for sibling elements would also make the trail and the sweep disagree visually. |
| **SVG for the radar** | Reasonable at 8 contacts, but every position update becomes a DOM attribute write plus a style recalculation, and the trail effect requires either a filter or a decaying history. Canvas does both for one fill and one arc per contact. |
| **WebGL** | Enormous capability, no need. The bottleneck in this application is React reconciliation, not fill rate ([Performance §4](../performance.md#4-known-defects)). Revisit only for a fundamentally denser visualization. |
| **An animation library (Framer Motion)** | It is already a declared dependency and is imported nowhere ([TD-06](../tech-debt.md#td-06)). A spring/DOM animation library addresses transitions, not a continuous instrument trace, and would add ~30 kB gzipped to solve a problem `requestAnimationFrame` solves for free. |
| **A fixed 60 Hz `setInterval` instead of rAF** | Loses vsync alignment, keeps running in background tabs, and drifts under load. rAF is the correct primitive and pauses automatically when the tab is hidden — which also means the instrument stops burning CPU when nobody is looking. |

## Verification

- `grep -rn "setBlips\|setDetectedEntities" src/components/RadarGrid.tsx` returns no hits inside the
  `requestAnimationFrame` callback (currently fails — that is TD-01).
- React DevTools Profiler, 5 s on the Dashboard: ≤ 15 commits/s at steady state.
- Each canvas effect's dependency array contains no tick-rate value.
- The three canvases still animate after a tick-rate change (e.g. setting the engine to 1 000 ms),
  which proves they are not tick-driven.
