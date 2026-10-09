# Roadmap

| | |
| --- | --- |
| **Audience** | Maintainers, contributors looking for work, reviewers assessing direction |
| **Status** | Current as of 2026-10-09. Nothing here is committed to a date. |
| **Companion** | [Tech-Debt Register](tech-debt.md) (the defect detail behind every D-item) · [Testing](testing.md) |

Sequencing principle: **make the existing claims true before adding new ones.** The application
already does something interesting; the priority is to make it verifiable, deployable, and usable by
more people — then to extend it. Each item names what it unblocks, because most of the value here is
in the ordering rather than in any single change.

---

## 1. How to read this

| Prefix | Meaning |
| --- | --- |
| **D** | Debt clearance — closes a [register](tech-debt.md) entry |
| **F** | Foundation — capability that other items depend on |
| **E** | Enhancement — new behaviour |
| **A** | Accessibility — closes an `A11Y-nn` finding in [Accessibility](accessibility.md#3-wcag-22-findings) |
| **L** | Lint baseline — see [Register §1](tech-debt.md#1-lint-baseline) and [ADR-0006](decisions/0006-ci-gating-and-the-lint-baseline.md) |
| **X** | Exploration — worth investigating, not committed |

Effort is a rough order of magnitude for someone who has read the docs: **S** < half a day ·
**M** ≈ 1–3 days · **L** > a week.

## 2. Phase 0 — Publishable

Blocking anything being shown to a real audience. All of this is small; none of it is optional.

| ID | Item | Ref | Effort | Unblocks |
| --- | --- | --- | --- | --- |
| **D15** | Strip the injected preview instrumentation from `index.html` — session recorder, element picker, analytics beacon | [TD-15](tech-debt.md#td-15) | S | Any public deployment; the privacy claim in [SECURITY](../SECURITY.md) |
| **D16** | Gate `.vite-source-tags.js` to development; resolve the tracked-and-ignored contradiction | [TD-16](tech-debt.md#td-16) | S | A clean production bundle (554 source-location attributes removed) |
| **D18** | Add `public/favicon.svg` | [TD-18](tech-debt.md#td-18) | S | A 404 on every page load |
| **D12** | `ctx.resume()` in `init()`; add `dispose()`; make the Geiger chain cancellable | [TD-12](tech-debt.md#td-12) | S | **Audio on iOS Safari** — the most likely "it's broken" report |
| **D06** | Remove `framer-motion` and `react-router-dom`; delete the empty `src/App.css` | [TD-06](tech-debt.md#td-06) | S | A dependency list that means what it says |
| **D21** | Scope Tailwind's source detection to `index.html` and `src/` so documentation prose stops compiling into the shipped CSS | [TD-21](tech-debt.md#td-21) | S | A deterministic stylesheet; 2.4 kB of dead CSS removed |

Phase 0 is roughly a day of work and takes the repository from "impressive demo with an asterisk" to
"safe to link from a résumé".

## 3. Phase 1 — Correct and quiet

Fixing what a user can observe, and removing the two defects that dominate runtime cost.

| ID | Item | Ref | Effort | Unblocks |
| --- | --- | --- | --- | --- |
| **D02** | Make the triangulation loop actually run: read tick values from refs, mount the interval once | [TD-02](tech-debt.md#td-02) | S | A whole inert instrument panel |
| **D01** | Move radar physics into a ref; commit to `detectedEntities` on a coarse interval only when changed | [TD-01](tech-debt.md#td-01) | M | ~60 of ~80 React commits/s; validates [ADR-0002](decisions/0002-two-rendering-domains.md) |
| **D17** | Extract `<SystemClock />` from `App.tsx` | [TD-17](tech-debt.md#td-17) | S | The remaining render amplifier; makes `React.memo` worthwhile afterwards |
| **D03** | Purify the three state updaters (audio side effect, nested `setSelectedNode`, `handleStopRecording`) | [TD-03](tech-debt.md#td-03) | M | Deterministic dev/prod parity; prerequisite for F1 tests |
| **D04** | Clear every timer on unmount, including the outbreak pair and the EVP decode/playback | [TD-04](tech-debt.md#td-04) | S | Leaks that outlive a tab switch |
| **D14** | Stop the sensitivity slider from firing a beep per step | [TD-14](tech-debt.md#td-14) | S | A routine interaction that currently sounds broken |
| **L35** | Clear the 35 mechanical lint errors; enable `noUnusedLocals`/`noUnusedParameters` in `tsconfig.app.json` | [Register §1](tech-debt.md#1-lint-baseline) | S | A blocking lint gate ([ADR-0006](decisions/0006-ci-gating-and-the-lint-baseline.md)) |

**Exit criterion for Phase 1:** every panel visibly live, `eslint .` exits 0, lint becomes blocking
in CI, and the Profiler shows ≤ 15 commits/s at steady state.

## 4. Phase 2 — Verifiable

The foundation work. F1 is the highest-leverage change in this entire roadmap: it converts the
simulation from "code you read" into "behaviour you can assert".

| ID | Item | Ref | Effort | Unblocks |
| --- | --- | --- | --- | --- |
| **F1** | Extract `createEmfEngine(rng)` into `src/simulation/` — pure, seeded, constants exported | [Simulation Engine §7](simulation-engine.md#7-proposed-extraction-createemfengineseed) | M | Every engine test; reproducible bug reports; golden-trace regression; D03 and D13 fall out of it |
| **F2** | Add Vitest + Testing Library; write U1–U10, D1–D9, A1–A5 | [Testing §4](testing.md#4-specifications-worth-writing-first) | M | A real `npm test`; CI coverage; confidence for every later change |
| **F3** | Make lint blocking; add a bundle-size budget check (fail above ~95 kB gzipped JS) | [ADR-0006](decisions/0006-ci-gating-and-the-lint-baseline.md) | S | A regression guard on payload |
| **F4** | Consolidate domain types into `src/types.ts`; model entity profiles as data, not strings | [API §2](api.md#2-domain-types) | S | Tests that assert the field guide agrees with the engine's thresholds |
| **D13** | Renormalize the audio mappings to the realized 0–45 mG span, sharing constants with F1 | [TD-13](tech-debt.md#td-13) | M | The instrument reaching the top of its own expressive range |
| **D05** | Alarm hysteresis (engage ≥ 15, disengage < 12) | [TD-05](tech-debt.md#td-05) | S | A sustained klaxon during an outbreak instead of a stutter |
| **D07** | Window or decay the haunt-probability count | [TD-07](tech-debt.md#td-07) | S | A probability that can go down |
| **D10** | Insert a master gain + compressor bus; ramp mute instead of jumping | [TD-10](tech-debt.md#td-10) | M | One-point volume, headroom management, clickless mute |

## 5. Phase 3 — Accessible

The application currently does not conform to WCAG 2.2 AA; the findings and the four-phase plan are
in [Accessibility](accessibility.md). Sequenced here because the phases have a natural dependency
order.

| ID | Item | Ref | Effort |
| --- | --- | --- | --- |
| **A1** | Names and semantics: `aria-label` on icon-only controls, real `<label>`s, `role="tablist"` tabs, an `h1`, visible focus rings | [A11Y-01/02/03/05/11](accessibility.md#3-wcag-22-findings) | M |
| **A2** | Contrast and type: `slate-600`→`slate-500`, `slate-500`→`slate-400` on panels; raise the 8 px/9 px floor; ≥ 24 px hit areas; scope `select-none` to chrome | [A11Y-08/09/12/14](accessibility.md#3-wcag-22-findings) | M |
| **A3** | Motion and timing: honour `prefers-reduced-motion` (CSS **and** the canvas loops), add a global HOLD control, make the EVP timers extendable | [A11Y-07/10/13](accessibility.md#3-wcag-22-findings) | M |
| **A4** | Announcements: `aria-live="polite"` on the log and decode result, `role="alert"` on the outbreak, threshold-crossing announcements — explicitly *not* on the 10 Hz clock | [A11Y-06](accessibility.md#3-wcag-22-findings) | S |
| **A5** | Content warning and an intensity setting: disable or soften the outbreak (no shake, no scream, no "GET OUT"/"RUN") | [A11Y-15](accessibility.md#3-wcag-22-findings) | M |
| **A6** | Fix the Tailwind v3→v4 theme drift by deriving accent colours from v4 tokens | [A11Y-16](accessibility.md#3-wcag-22-findings) | S |
| **A7** | Verify: full keyboard pass, NVDA + VoiceOver pass, axe-core in CI, PEAT photosensitivity analysis of the outbreak | [Accessibility §5 Phase 4](accessibility.md#5-remediation-plan) | M |

A5 is the item that changes who can use this at all. A3's global HOLD also satisfies WCAG 2.2.2 for
the entire application with one control, and gives every user a way to read a value without chasing
it — the highest ratio of accessibility value to effort in the roadmap.

## 6. Phase 4 — Capable

New behaviour, only once the above holds.

| ID | Item | Sketch | Effort |
| --- | --- | --- | --- |
| **E1** | Persist operator settings | Theme, volume, sensitivity, mode → `localStorage` behind a small `settings.ts` module. Would be the application's first storage write, so it needs a privacy note in [SECURITY](../SECURITY.md) | S |
| **E2** | Deep-linkable tabs | Either adopt the already-declared `react-router-dom`, or write the tab into `location.hash` — the latter is ~20 lines and keeps the zero-dependency property. Restores browser back and shareable URLs | M |
| **E3** | Data-driven scenarios | Replace the single hard-coded outbreak with a scenario format: a timeline of `{ at, emf, temp, phrase, audio }` events loaded from a TS data module. Turns the outbreak into one instance of a general capability, and makes the field guide's four entity classes playable | L |
| **E4** | Session recording and replay | Once F1 lands, a seed plus the operator's inputs fully determines a session. Record both, replay any trace — a debugging tool and a shareable "you had to see this" artifact | M |
| **E5** | PWA packaging | Manifest, service worker, standalone display mode, install prompt. The zero-asset property makes this unusually easy: there is nothing to precache beyond JS and CSS. Pairs naturally with E4 | M |
| **E6** | Entity population to match the diegesis | The boot log claims 142 entities; four ship. Either correct the log or make it true — E3's data format is the natural home | M |

## 7. Exploration

Explicitly uncommitted. Recorded because they are plausible and it is useful to have thought about
them.

| ID | Idea | Why it might not happen |
| --- | --- | --- |
| **X1** | `DeviceMotion`/`DeviceOrientation` as an input in manual mode | Turns the phone into the instrument — compelling, but requires permission prompts and HTTPS, which breaks the zero-prompt property |
| **X2** | WebGL shader for the field visualization | Would look better and cost more; the canvas 2D loops are not the bottleneck — React is (D01) |
| **X3** | Web Worker for the simulation | The tick is 3.3 Hz and costs microseconds. A worker would add message-passing complexity to solve a problem that does not exist |
| **X4** | Real magnetometer via WebUSB/WebHID | Genuinely possible on Chrome/Android, and would make this a real instrument rather than a simulated one — which is a different project with different claims. Worth knowing it is one API away |
| **X5** | Multiplayer sessions over WebRTC | Two operators, one haunting. Enormous scope increase for a portfolio artifact |
| **X6** | Component library extraction (`Panel`, `Readout`, `SegmentBar`) | The nine components share a visual language that is currently duplicated as class strings. Worth doing if a second project reuses it; premature otherwise |
| **X7** | DPI-aware canvas backing stores | Size each store from `devicePixelRatio` and scale the context; traces stop looking soft on 2× displays. Costs a resize observer and per-frame geometry that the fixed-store design deliberately avoids ([Development §7.5](development.md#75-canvas-debugging)) |
| **X8** | Preserve per-tab state across navigation | Mount panels once and toggle visibility, or lift log/contact/EVP state into `App.tsx`. Both break the "only one canvas loop runs at a time" property that the current unmount-on-switch design buys ([Components §2](components.md#2-application-shell--apptsx)) |

## 8. Explicitly out of scope

Stating these prevents recurring conversations:

- **A backend.** The client-only property is the design, not a limitation. Nothing in the roadmap
  requires a server, and [Deployment](deployment.md) depends on that.
- **Real measurement.** The application does not claim to detect anything and will not start to. The
  disclosure at the top of the [README](../README.md) is load-bearing.
- **A state management library.** Four upward channels do not justify one
  ([ADR-0001](decisions/0001-single-source-of-truth.md)).
- **Asset-based audio.** Synthesis is the point ([ADR-0004](decisions/0004-zero-runtime-assets.md)).
- **Internationalization.** All diegetic text is English; there is no i18n layer and none is planned.
  If A5's content warning ships, it should be written to be translatable.

## 9. Contributing to the roadmap

Pick any item marked **S** that does not depend on another — D15, D16, D18, D12, D06, D21, D02,
D17, D04, D14, L35, D05, D07, A4, A6 are all self-contained and each closes a register entry with a stated
verification step. That is the fastest useful first PR to this repository.

Larger items (F1, D01, E3) should start as an issue describing the approach before code, per
[CONTRIBUTING](../CONTRIBUTING.md#3-workflow).

---

**Back to:** [Documentation index](README.md) · [README](../README.md)
