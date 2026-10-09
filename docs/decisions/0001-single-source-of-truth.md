# 0001. Single source of truth: the simulation lives in `App.tsx`

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Deciders** | @zazieproductions |
| **Related** | [ADR-0002](0002-two-rendering-domains.md) · [Architecture §3](../architecture.md#3-state-ownership) · [TD-11](../tech-debt.md#td-11) |

## Context

The application renders nine instrument panels that all describe the same physical fiction: a
magnetic field, its thermal side effects, and the operator's response to both. If two panels can
disagree about the current EMF level, the fiction collapses — the moment a viewer notices the radar
and the gauge telling different stories, the instrument stops being an instrument.

The alternative shapes were all available. A context provider, a store (Zustand or Redux), a custom
hook per concern, or letting each panel simulate its own readings. The scale is small: **16 state
variables**, all in one file, with exactly **four upward channels** in the entire application — one
boot callback and three lifted setters ([API §3](../api.md#3-component-prop-contracts)).

There is also an auditability argument specific to this project. The value of the codebase is that a
reader can understand the whole simulation. A 300 ms tick in one known place, with the three regimes
as three branches, is readable end-to-end in under a minute. Distributed across nine panels or
mediated by a store, the same logic requires assembling a mental model from many places.

## Decision

**`App.tsx` owns every physical quantity and every operator setting.** It is the sole writer of
shared state, the sole authority on the simulation mode, and the only module that drives continuous
audio parameters. Components receive values as props and derive only their own local visuals.

The two permitted patterns are:

1. **Read-only fan-out** — `emfLevel`, `hauntingActive`, `accentColor`. Pushed down, never written
   back.
2. **Lifted control** — state plus its setter passed together (`sensitivity`, `ambientTemp`,
   `accentColor` in `DeviceSpecs`), for controls that write an owned quantity.

No component computes a quantity another component also needs. No component calls a setter it does
not own. No state library, no context.

## Consequences

### What it buys

- **Consistency by construction.** One writer means the gauge, the radar, the log, the triangulation
  map, and the audio graph are all describing the same sample of the same tick. Divergence is not a
  risk to be managed; it is structurally impossible.
- **Auditability.** The whole simulation is one effect, 50 lines, at a known location
  ([`src/App.tsx:86-137`](../../src/App.tsx)).
- **A trivial dependency graph.** Zero inter-component imports; every edge points at `App.tsx` or at
  the audio service ([Architecture §6](../architecture.md#6-module-graph)).
- **Cheap reasoning about update timing.** One tick drives everything, so "how often does this
  change?" has one answer.

### What it costs

- **`App.tsx` is three things at once** — engine, layout, and tab router, 522 lines. The engine is
  the part worth extracting ([Roadmap F1](../roadmap.md#4-phase-2--verifiable)); doing so preserves
  this decision rather than reversing it, because the extracted module would still be the single
  writer, just a testable one.
- **Prop drilling.** `accentColor` is passed to all nine components ([TD-11](../tech-debt.md#td-11)).
  Accepted deliberately: nine props is cheaper than a context boundary, and Tailwind v4 offers a
  CSS-variable escape hatch that does not require either.
- **No memoization safety net.** Because everything re-renders when `App` re-renders, an
  over-frequent state update in the owner is expensive. This is exactly how
  [TD-17](../tech-debt.md#td-17) (a 10 Hz clock in `App`) came to dominate the render budget. The
  lesson is not "add a store" — it is "keep high-frequency state out of the owner".

### What it forbids

- A component holding a physical quantity in local state.
- Two components computing the same derived value independently.
- Introducing a state library to solve a prop-drilling inconvenience.

## Alternatives considered

| Option | Rejected because |
| --- | --- |
| **React Context for shared state** | Context propagates *values*, not write authority. The hard part here — one writer, one tick — would still have to be solved by convention, with an extra layer of indirection and a re-render surface that is worse than props for frequently changing values. |
| **Zustand / Redux / Jotai** | Sixteen variables and four upward channels. A store adds a subscription model, selectors, and devtools to solve a problem this codebase does not have. It would also make the simulation *harder* to read for a newcomer — the current shape is a plain `setInterval` and a `useState`. |
| **A `useSimulation()` hook consumed by panels** | Multiple consumers means multiple subscriptions to the same tick, and the question of who advances it. It reopens the divergence problem this ADR closes. |
| **Per-panel simulation (each panel generates its own readings)** | Fastest to write, and fatal to the premise. The panels would decorrelate within seconds, and the "one instrument" reading would be gone. This is the specific failure mode the project exists to avoid. |
| **Reducer + `useReducer` in `App`** | A reasonable *implementation* of this decision, and the natural shape once the engine is extracted. Not adopted yet because the current three-branch tick reads more directly than a reducer's action taxonomy would. |

## Verification

- `grep -rn "setEmfLevel" src/` returns exactly one call site family, in `App.tsx`.
- No file under `src/components/` imports another file under `src/components/`.
- The upward-channel count stays at four: `onBootComplete`, `setSensitivity`, `setAmbientTemp`,
  `setAccentColor`. A fifth is a signal that ownership has drifted and this ADR needs revisiting.
- [Architecture §3](../architecture.md#3-state-ownership) remains an accurate inventory of shared
  state. If a row is missing, either the table or the decision is out of date.

## Review trigger

Revisit when `App.tsx` exceeds ~800 lines, or when a second writer of a physical quantity becomes
genuinely necessary (for example a scenario engine that injects values — [Roadmap E3](../roadmap.md#6-phase-4--capable)).
The expected outcome of that review is [ADR-0007](README.md#when-to-write-one), which would keep
single-writer semantics while making the writer a pure, testable module.
