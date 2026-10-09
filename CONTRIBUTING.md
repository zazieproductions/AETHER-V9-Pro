# Contributing to AETHER V9 Pro

Thank you for your interest. This guide covers the workflow, the conventions that are actually
enforced in review, and the recipes for the four changes people most often want to make.

AETHER V9 Pro is a **work of interactive fiction** — a simulated instrument that measures nothing
real. That framing matters for contributions: the goal is not accuracy about magnetometers, it is
*coherence*. A change that makes the simulation more internally consistent is an improvement even
when it makes it less physically true, and a change that breaks the coherence between panels, sound,
and readouts is a regression even when it is technically better.

| Start here | |
| --- | --- |
| Setting up and running | [Development](docs/development.md) |
| How the system is shaped | [Architecture](docs/architecture.md) |
| Why it is shaped that way | [Decision Records](docs/decisions/) |
| Known defects, with fixes | [Tech-Debt Register](docs/tech-debt.md) |
| What to work on next | [Roadmap](docs/roadmap.md) |
| Conduct | [Code of Conduct](CODE_OF_CONDUCT.md) |

---

## 1. Ground rules

1. **Be kind, be specific, assume competence.** Enforced by the [Code of Conduct](CODE_OF_CONDUCT.md).
2. **One concern per PR.** Simulation-model changes and visual changes ship separately; so do
   mechanical lint fixes and behavioural fixes. Small, reviewable diffs are the norm here.
3. **Do not add to the lint baseline.** The repository currently reports 45 ESLint errors
   ([register §1](docs/tech-debt.md#1-lint-baseline)). Yours must not be number 46. If you touch a
   file with existing errors, clear that file.
4. **Document defects you choose not to fix.** If your PR works around something, add or update a
   register entry. Hidden debt is the only unacceptable outcome.
5. **No assets.** No audio files, images, or webfonts without an ADR amending
   [ADR-0004](docs/decisions/0004-zero-runtime-assets.md). Icons come from `lucide-react`; effects
   come from CSS and canvas.
6. **Your contributions are MIT-licensed.** By submitting a PR you agree to the
   [license](LICENSE). No CLA, no DCO sign-off required.
7. **AI-assisted contributions are fine** and should be labelled as such in the PR description. The
   standard is the same: verified claims, cited sources, and code you can explain in review.

## 2. Finding work

| If you want… | Look at |
| --- | --- |
| A first PR, self-contained | [Roadmap §9](docs/roadmap.md#9-contributing-to-the-roadmap) — 14 items, each closing a register entry with a stated verification step |
| Something with real impact | Phase 0 and Phase 1 of the [Roadmap](docs/roadmap.md) |
| A defect with a diagnosis already written | The [register](docs/tech-debt.md) — every entry has evidence, remediation, and how to verify the fix |
| A specific test to write | [Testing §4](docs/testing.md#4-specifications-worth-writing-first) — 32 specifications, blocked on the engine extraction |
| Documentation work | Any document whose citations have drifted, or a new [ADR](docs/decisions/README.md#when-to-write-one) |
| To propose something new | Open an issue first |

## 3. Workflow

### 3.1 Before you write code

- **Small, well-scoped fixes** (anything marked **S** in the roadmap, any register entry with a
  stated remediation): go straight to a PR.
- **Anything structural** — a new module, a change to the simulation model, a new dependency, a
  refactor touching more than ~3 files: **open an issue first** describing the approach. Ten minutes
  of alignment saves a rewritten PR.

### 3.2 Branch, commit, PR

```bash
git clone https://github.com/zazieproductions/AETHER-V9-Pro.git
cd AETHER-V9-Pro
npm ci
git checkout -b fix/triangulation-interval-starvation   # see naming below
npm run dev
```

**Branch naming** — `type/short-imperative-description`:

| Prefix | Use |
| --- | --- |
| `fix/` | a defect, ideally referencing a `TD-nn` id |
| `feat/` | new behaviour |
| `docs/` | documentation only |
| `refactor/` | no behaviour change |
| `perf/` | measurable performance change |
| `a11y/` | accessibility remediation |
| `chore/` | tooling, CI, dependencies |

**Commits** follow [Conventional Commits](https://www.conventionalcommits.org/), with scopes drawn
from the module list:

```
fix(triangulation): mount the node interval once and read EMF from a ref

The effect depended on `emfLevel`, which changes every 300 ms, so the
1000 ms interval was cleared before its first callback fired and node
readings never updated.

Closes TD-02
```

Scopes: `engine`, `audio`, `radar`, `emf`, `log`, `triangulation`, `evp`, `entities`, `diagnostics`,
`specs`, `boot`, `shell`, `docs`, `ci`, `deps`, `build`.

### 3.3 Verify locally before pushing

| Command | Must pass? |
| --- | --- |
| `npm run typecheck` | **Yes** — strict, no exceptions |
| `npm run build` | **Yes** — type-checks again, then bundles |
| `npm run lint` | Must not get **worse** than the 45-error baseline |
| `npm test` | Once tests exist; **yes** |
| The relevant rows of the [manual matrix](docs/testing.md#6-manual-test-matrix) | **Yes** for any UI change |

For changes to the simulation or audio, also do the two checks that no test currently covers:

- Watch a full spike cycle in auto mode for 60 s and confirm the trace still settles.
- Trigger an outbreak and confirm it resolves cleanly at 15 s.

### 3.4 Open the pull request

Use the [template](.github/PULL_REQUEST_TEMPLATE.md). The things that get a PR merged fastest:

- **A short description of the change and why**, not what the diff already says.
- **A link to the issue or `TD-nn` id** it closes.
- **Verification evidence.** For a performance change, before/after Profiler numbers. For a defect
  fix, the register entry's verification step, observed. For a visual change, a screenshot or a
  screen recording.
- **Under ~400 changed lines.** Larger work is welcome but should be split, or preceded by an issue.
- **Documentation updated in the same PR** if behaviour changed — including line-number citations,
  which drift. See §6.

Pull requests are squashed on merge; the squash message becomes the commit of record, so the PR title
should be a valid Conventional Commit.

## 4. Conventions

These are enforced in review. Each one has a reason; the reason is usually a defect that already
happened.

### 4.1 Structure

| Rule | Why |
| --- | --- |
| One component per file, named export, explicit `Props` interface, no default export | Consistency; `react-refresh` needs named exports for reliable HMR |
| Components never import other components | Keeps the render tree readable in one place and every module independently mountable ([ADR-0001](docs/decisions/0001-single-source-of-truth.md)) |
| Physical quantities and operator settings live in `App.tsx` | Single source of truth; divergence between panels destroys the premise |
| Purely visual state stays local to the component that renders it | Selection, hover, progress, and scroll position are not shared facts |
| Domain records are named interfaces, not anonymous shapes | `LogEntry`, `SensorNode`, `RadarBlip`, `Entity` — see [API §2](docs/api.md#2-domain-types) |

### 4.2 Effects and lifecycle

| Rule | Why |
| --- | --- |
| **Every** `setInterval`, `setTimeout`, `requestAnimationFrame`, and audio node created in an effect is torn down in that effect's cleanup | Five existing exceptions are all registered as [TD-04](docs/tech-debt.md#td-04). Do not add a sixth. |
| Never call a React setter from inside a `requestAnimationFrame` callback | The core invariant of [ADR-0002](docs/decisions/0002-two-rendering-domains.md); violating it costs ~60 reconciliations/s ([TD-01](docs/tech-debt.md#td-01)) |
| **State updaters must be pure** — no side effects, no other `setState`, no function calls that do either | `<StrictMode>` double-invokes updaters; impurity means dev and prod genuinely differ ([TD-03](docs/tech-debt.md#td-03)) |
| An interval's dependency array must not contain a value that changes faster than its own period | This exact mistake freezes an entire panel ([TD-02](docs/tech-debt.md#td-02)) |
| A frame loop's deps contain only user-action values; tick-rate values are read from refs | Otherwise the loop is rebuilt every tick ([Performance §4.2](docs/performance.md#42-defect-frame-loops-rebuild-on-every-tick)) |

### 4.3 Canvas

| Rule | Why |
| --- | --- |
| Animation state lives in `useRef`, not `useState` | Frame-domain state must not trigger reconciliation |
| Clear with a translucent fill (`rgba(0,0,0,α)`), not `clearRect` | That is the phosphor trail; α is the persistence constant |
| Reset `shadowBlur` to 0 after using it | It is a context-wide setting, and it is one of the most expensive 2D operations ([Performance §4.4](docs/performance.md#44-shadowblur-is-the-most-expensive-call-in-the-loops)) |
| Do not allocate gradients or arrays per frame if they can be cached | See the per-frame allocation table in [Performance §4.3](docs/performance.md#43-per-frame-allocations-in-the-draw-loops) |
| `accentColor` must stay a 6-digit hex string | Canvas alpha is composed by string concatenation (`${accentColor}44`); a 3-digit hex, `rgb()`, or CSS variable silently produces invalid colours ([API §3.1](docs/api.md#31-prop-semantics)) |

### 4.4 Audio

| Rule | Why |
| --- | --- |
| New sounds go in `AudioController` behind a semantic method (`playX`, `setY`) | Components must not construct an `AudioContext` ([ADR-0003](docs/decisions/0003-audio-as-a-module-singleton.md)) |
| Guard first: `if (!this.ctx \|\| this.isMuted) return;` | The invariant that audio can never break the UI |
| Wrap synthesis in `try/catch` — and log, don't leave an empty block | Empty catches are three of the 45 lint errors |
| Scale every gain by `this.volume` | There is no master bus ([TD-10](docs/tech-debt.md#td-10)) |
| Stop every oscillator you start | An unstopped oscillator is a permanent voice |
| Use `exponentialRampToValueAtTime` for decays, never to exactly `0` | It throws; the file's convention is `1e-4` |
| Use `setTargetAtTime` for anything driven by the 300 ms tick | It is what makes 300 ms steps inaudible as steps |

### 4.5 Styling

| Rule | Why |
| --- | --- |
| Tailwind v4, CSS-first — do not add a `tailwind.config.js` | v4 is configured in [`src/index.css`](src/index.css); a JS config is the v3 pattern |
| Accept `accentColor` if the component renders any chrome | Theming is universal across all nine modules |
| Keep text at ≥ 10 px where possible | 8 px and 9 px type is the largest single accessibility problem ([A11Y-09](docs/accessibility.md#3-wcag-22-findings)) |
| Prefer `slate-400` over `slate-500`/`slate-600` for text on panels | `slate-500` computes to 4.22:1 and `slate-600` to 2.66:1 on the panel surface — both fail AA ([A11Y-08](docs/accessibility.md#3-wcag-22-findings)) |
| Label every control | The codebase currently has **zero** `aria-*` attributes, zero `<label>` elements, and zero `role` attributes. Do not extend that. |

### 4.6 TypeScript

| Rule | Why |
| --- | --- |
| No `any` without a comment explaining why | Two exist today; both are lint errors |
| Prefer `ReturnType<typeof setInterval>` over `NodeJS.Timeout` in browser code | `NodeJS.Timeout` is why `@types/node` is in the app project at all ([Development §6.1](docs/development.md#61-the-nodejstimeout-smell)) |
| Do not import `React` unless you use the namespace | `jsx: "react-jsx"` makes it unnecessary |
| Union types for closed sets | `'LOW' \| 'MEDIUM' \| 'HIGH' \| 'CRITICAL'`, not `string` |

## 5. Definition of done

A change is complete when:

- [ ] `npm run typecheck` and `npm run build` pass.
- [ ] `npm run lint` reports no new errors, and fewer if the change touched a file with existing ones.
- [ ] Every timer, listener, and frame loop introduced is torn down.
- [ ] No React setter is called from a frame callback or from inside a state updater.
- [ ] New controls have accessible names; new text meets the contrast and size floors in §4.5.
- [ ] Behaviour changes are reflected in [`docs/`](docs/README.md) **in the same PR**, including
      line-number citations.
- [ ] A register entry is closed, updated, or added as appropriate — and if closed, moved to
      [§7 Closed](docs/tech-debt.md#7-closed) with the PR reference.
- [ ] A test is added, or a specification is written in [Testing §4](docs/testing.md#4-specifications-worth-writing-first)
      explaining what should be asserted once the harness exists.
- [ ] The PR description states how the change was verified.

## 6. Documentation standards

Documentation is held to the same standard as code, because in this repository it is load-bearing.

1. **Every claim is traceable.** Cite `src/App.tsx:89`, not "the engine". Link to a register entry
   by its stable ID — `docs/tech-debt.md#td-07` — never by a heading slug.
2. **Numbers carry their provenance.** Measured, derived, or estimated — say which, and say how.
   See the status lines at the top of [Performance](docs/performance.md) and
   [Accessibility](docs/accessibility.md).
3. **Defects are documented, not hidden.** If a document describes intended behaviour the code does
   not implement, it must say so and link the register entry.
4. **Rationale goes in an ADR**, not in a guide. Documents explain *what* and *how*;
   [ADRs](docs/decisions/) explain *why* and record what was rejected.
5. **Update citations when lines move.** Line numbers are snapshots; if your diff shifts them, fix
   the references in the same PR.
6. **Do not restate the README in `docs/`.** The README is the entry point; the docs are the depth.
   Duplication guarantees drift.
7. **Prose is a build input here.** Tailwind v4 scans every text file in the repository, so a
   utility-shaped word in a guide compiles into the production CSS — the documentation release added
   2.4 kB ([TD-21](docs/tech-debt.md#td-21)). Do not avoid plain English for that reason. Do
   re-measure [Performance §2](docs/performance.md#2-measured-bundle) if your PR moves a number, and
   say so in the description.

## 7. Recipes

### 7.1 Adding a component

```
1. src/components/NewModule.tsx — named export, explicit Props interface, accept accentColor.
2. Take physical quantities as props. If a value must be shared, it belongs in App.tsx first.
3. Mount it in App.tsx under the right tab. Never import it from another component.
4. Local visual state only; shared state via lifted setter pairs if the operator controls it.
5. Timers and frame loops: cleanup in the same effect, and obey §4.2.
6. Label its controls; use ≥10px text on panels.
7. Add a row to docs/components.md §1 and a section describing it.
8. Add its props to the contract table in docs/api.md §3.
```

### 7.2 Adding a sound

```
1. Add a semantic method to AudioController — playX() for one-shots, setY() for continuous state.
2. Guard: if (!this.ctx || this.isMuted) return;
3. Build the subgraph; scale every gain by this.volume; stop every oscillator you start.
4. Wrap in try/catch and log — never leave an empty block.
5. Call it from a component as an intent. Do not touch the graph from a component.
6. Document the voice in docs/audio-synthesis.md §5 and the method in docs/api.md §1.4.
```

### 7.3 Changing simulation behaviour

```
1. Read docs/simulation-engine.md first — the constants table in §8 is probably all you need.
2. If the change is structural, open an issue: the model is the project's core claim.
3. Change constants, not shape, unless the shape is the point.
4. Check the downstream derivations: audio mappings (§4), log severity (§6.3), radar spawns (§6.4),
   node readings (§6.5), and the field guide's class bands all read from the same thresholds.
5. Update the tuning table and the emergent-statistics table if either changed.
6. Describe the audible and visible difference in the PR — reviewers will want to feel it.
```

### 7.4 Adding an ADR

```
1. Confirm it meets the bar: hard to reverse, surprising to a competent reader, or likely to be
   re-litigated. Any one is enough. (docs/decisions/README.md#when-to-write-one)
2. Copy the template from docs/decisions/README.md#template. Number sequentially; never reuse one.
3. Include rejected alternatives with specific reasons — that section is the most valuable one.
4. Include a Verification section: the observation that shows the decision is still honoured.
5. Link it from the index, and from any document whose guidance it changes.
```

## 8. Issue labels

The taxonomy below is what the templates and triage assume. Maintainers: create these in the
repository settings so they resolve.

| Label | Meaning |
| --- | --- |
| `bug` | Behaviour contradicts the documentation or the register |
| `defect:TD-nn` | Maps to a register entry |
| `enhancement` | New behaviour |
| `documentation` | Docs only |
| `accessibility` | Any A11Y-nn finding |
| `performance` | Frame budget, bundle, or reconciliation |
| `audio` | Synthesis or the audio service |
| `simulation` | The signal model or a derived quantity |
| `good first issue` | Self-contained, with a stated verification step |
| `help wanted` | Maintainer cannot get to it soon |
| `needs design` | Blocked on a decision — likely needs an ADR |
| `wontfix` | Rejected, with the reason in the closing comment |
| `security` | Should not be public — see [SECURITY.md](SECURITY.md) |

## 9. Review

Reviews focus on, in order: **correctness of the model**, **lifecycle hygiene** (§4.2), **the
React/canvas boundary**, **accessible names and contrast**, and **whether the documentation was
updated**. Style is settled by ESLint and Prettier-free convention; it is not what review is for.

Expect specific, referenced comments — a file, a line, and a reason. Offer the same. If a reviewer
cites a convention that is not written down here, that is a documentation bug: the fix is to add it to
this file, not to remember it.

## 10. Recognition

Contributors are credited in the release notes for every change. Substantive contributions — a
register entry closed, a new module, an ADR — are named in the [CHANGELOG](CHANGELOG.md).

---

**Thank you.** A small repository that documents itself honestly is rarer than a large one that does
not. Keeping that property is the contribution.
