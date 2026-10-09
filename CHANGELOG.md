# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> [!NOTE]
> **On the history before 0.1.0.** The public repository was created from a single squashed snapshot,
> and the working clone is shallow — there is no commit-by-commit record of the application's
> development to reconstruct. Rather than invent one, `0.0.0` below describes the snapshot as it
> stood, and detailed provenance for that snapshot's known issues lives in the
> [Tech-Debt Register](docs/tech-debt.md). Every entry from `0.1.0` onward is a real, dated change.

---

## [Unreleased]

Nothing staged. Work in progress is tracked in the [Roadmap](docs/roadmap.md), not here; entries
appear in this file when they land.

## [0.1.0] — 2026-10-09

The documentation and repository-infrastructure overhaul. **No application behaviour changed** in
this release: no runtime source file under `src/` was modified. Everything here is documentation,
metadata, or CI.

### Added

**Documentation** — a thirteen-document engineering set under [`docs/`](docs/README.md), replacing a
single README that mixed overview, architecture, and conventions:

- [`docs/architecture.md`](docs/architecture.md) — layering, state ownership map, data flow of one
  tick, module graph, lifecycle, and the architectural tensions the design accepts.
- [`docs/simulation-engine.md`](docs/simulation-engine.md) — the signal model specified exactly:
  all three regimes, emergent statistics derived from the transition rules, the outbreak state
  machine, every derived quantity, and a 24-constant tuning table.
- [`docs/audio-synthesis.md`](docs/audio-synthesis.md) — the Web Audio graph per voice, all
  EMF→parameter mappings with their saturation points, autoplay-policy handling, and voice design
  notes.
- [`docs/components.md`](docs/components.md) — a reference for all nine components plus the shell:
  responsibility, props, state, effects, timers, canvas, and cleanup status.
- [`docs/api.md`](docs/api.md) — the internal contract surface: `AudioController` methods, four
  domain types, prop contracts, and eight system invariants.
- [`docs/development.md`](docs/development.md) — verified toolchain, script behaviour, TypeScript and
  ESLint configuration rationale, StrictMode consequences, and debugging notes.
- [`docs/testing.md`](docs/testing.md) — current coverage, the structural blockers, 32 specified
  tests, a proposed Vitest harness, and a 29-step manual test matrix.
- [`docs/performance.md`](docs/performance.md) — measured bundle composition and update topology,
  with four defects analysed and costed.
- [`docs/accessibility.md`](docs/accessibility.md) — a WCAG 2.2 AA assessment: 16 findings, contrast
  ratios computed from the compiled Tailwind v4 tokens, and a four-phase remediation plan.
- [`docs/deployment.md`](docs/deployment.md) — hosting recipes for five platforms, caching strategy,
  and the two artifacts that must be stripped before publishing.
- [`docs/roadmap.md`](docs/roadmap.md) — five phases sequenced by what each unblocks.
- [`docs/tech-debt.md`](docs/tech-debt.md) — a 22-entry register, each with evidence, severity,
  remediation, and a verification step, plus the complete 45-item lint baseline as an appendix.
- [`docs/decisions/`](docs/decisions/) — six Architecture Decision Records covering single-source
  state ownership, the React/canvas split, the audio singleton, zero runtime assets, the procedural
  signal model, and the CI gating policy — each with context, costs, rejected alternatives, and
  verification.

**Repository infrastructure:**

- [`.github/workflows/ci.yml`](.github/workflows/ci.yml) — typecheck, build, advisory lint, and an
  advisory `npm audit --omit=dev`, on Node 20 and 22 for every pull request and push to `main`, with
  the ESLint report uploaded as an artifact and the error count compared against the recorded
  baseline.
- [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) — a manual-dispatch GitHub Pages
  deployment.
- [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE) — structured bug-report and feature-request
  forms, plus a config that routes security reports away from the public tracker.
- [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) — a checklist covering the
  project's actual conventions.
- [`.github/dependabot.yml`](.github/dependabot.yml) — weekly npm and GitHub Actions updates.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — workflow, conventions with rationale, definition of done,
  and guides for adding a component, a sound, a simulation behaviour, or an ADR.
- [`SECURITY.md`](SECURITY.md) — threat surface, verified privacy properties, supply-chain policy,
  and a disclosure channel.
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor Covenant 2.1.
- [`.editorconfig`](.editorconfig) — consistent indentation, line endings, and trailing whitespace.

### Changed

- **`README.md` rewritten** as an entry point rather than a monolith: an at-a-glance table of
  measured facts, a five-decision architecture summary linking to the ADRs, a documentation index,
  and an explicit engineering-status section.
- **`package.json` metadata** — version `0.0.0` → `0.1.0`, plus `repository`, `homepage`, `bugs`,
  `keywords`, `engines`, and `author` fields so the manifest describes the project accurately.
- **Scripts** — added `typecheck` (`tsc -b --pretty false`), which is the blocking CI gate, and
  `lint:fix` (`eslint . --fix`). Worth recording: `--fix` is a **measured no-op** on this baseline —
  45 errors before and after, zero files modified — because none of the five rules involved ships a
  fixer. The 35 "mechanical" errors are deletions a human makes. The script stays for rules that do
  have fixers.
- **The production CSS grew by 2.4 kB as a side effect of this release.** Tailwind v4 has no `content`
  array: it scans every non-ignored text file in the project, so documentation prose is a stylesheet
  input. Measured by A/B build against the pristine snapshot — 41.85 kB → **44.21 kB** raw, 7.87 kB →
  **8.13 kB** gzipped, 360 → 377 selectors, 17 of which match no element in the DOM (`.container`,
  `.table`, `.visible`, `.backdrop-blur`, …). Recorded as [TD-21](docs/tech-debt.md#td-21) with the
  fix scheduled as roadmap **D21**. Stated here because a documentation release that changes the
  payload is exactly the kind of thing release notes should admit.

### Fixed

- **Documentation drift corrected.** The previous README documented the sensitivity control as
  1–20; the shipped range is **1–100**
  ([`Diagnostics.tsx:53-54`](src/components/Diagnostics.tsx)). It also described the Geiger click
  mapping as "~2 s → ~30 ms", which is the mapping's *domain* rather than its realized behaviour —
  the fastest realized rate is ≈ 3.3 clicks/s at the 43 mG outbreak peak
  ([Audio Synthesis §4.3](docs/audio-synthesis.md#43-the-domain-mismatch-problem)). Both corrected,
  and the underlying code comments are registered as [TD-09](docs/tech-debt.md#td-09).
- **Claims verified before being restated.** Every behavioural statement in the new documentation is
  cited to a source line, and every number is either measured (bundle sizes, contrast ratios, lint
  counts, timer periods) or explicitly labelled as derived or estimated.

### Known issues at this release

Recorded here so the release notes are not misleading. Full detail in the
[Tech-Debt Register](docs/tech-debt.md).

| Severity | Issue |
| --- | --- |
| **Critical** | `index.html` carries injected preview tooling — a session recorder, an element picker, and an analytics beacon — that makes third-party requests. **Must be stripped before any public deployment** ([TD-15](docs/tech-debt.md#td-15), [Deployment §6](docs/deployment.md#6-strip-preview-instrumentation-before-deploying)) |
| High | Triangulation node readings never update — the interval is torn down before it fires ([TD-02](docs/tech-debt.md#td-02)) |
| High | The radar advances contact physics through React state 60×/s ([TD-01](docs/tech-debt.md#td-01)) |
| High | Three impure state updaters cause dev/prod divergence under `StrictMode` ([TD-03](docs/tech-debt.md#td-03)) |
| High | Audio never resumes a suspended `AudioContext` — silence on iOS Safari ([TD-12](docs/tech-debt.md#td-12)) |
| Medium | `npm run lint` reports 45 errors; CI runs it in advisory mode until cleared ([ADR-0006](docs/decisions/0006-ci-gating-and-the-lint-baseline.md)) |
| Medium | No automated tests ([TD-19](docs/tech-debt.md#td-19), [Testing](docs/testing.md)) |
| Medium | Does not conform to WCAG 2.2 AA — 16 findings ([TD-20](docs/tech-debt.md#td-20), [Accessibility](docs/accessibility.md)) |
| Medium | Documentation prose compiles into the production CSS — 2.4 kB of rules that match nothing ([TD-21](docs/tech-debt.md#td-21), [Performance §2.4](docs/performance.md#24-the-stylesheet-grows-when-the-documentation-does)) |
| Medium | `npm audit` reports 4 high-severity advisories in transitive build dependencies — build-machine exposure only, none present in the shipped bundle. GitHub separately reports 5 open Dependabot alerts ([TD-22](docs/tech-debt.md#td-22), [SECURITY §5.1](SECURITY.md#51-advisory-state-at-010-measured)) |

## [0.0.0] — initial snapshot

The application as it stood before this documentation pass. Recorded descriptively, since no
incremental history exists for it.

### Present

- A React 19 + TypeScript + Vite 7 + Tailwind CSS 4 single-page application: 3 381 lines of source
  across 12 modules, building to 316 kB JS (86.77 kB gzipped) and 41.85 kB CSS (7.87 kB gzipped),
  with zero media assets.
- **Simulation core** in `App.tsx`: a 300 ms tick with three regimes — an auto-mode bounded random
  walk with two spike processes, a manual mode with sensitivity-scaled noise, and a scripted
  15-second outbreak driven by a 25 ± 12 mG sinusoid.
- **Nine instrument modules**: boot sequence, live EMF display with tri-axis vector decomposition,
  sweep radar, anomaly log with a haunt-probability index, triangulation map across three preset
  locations, EVP recorder, entity field guide, diagnostics, and device specifications with four
  accent themes.
- **A Web Audio synthesizer** (`utils/audio.ts`, 461 lines) generating a resonant-lowpass sawtooth
  hum, a bandpassed looping noise floor, EMF-rate-scaled Geiger clicks, an alarm above 15 mG, a
  two-layer boot sweep, a descending diagnostic beep, and a two-operator FM scream — with no audio
  assets and graceful degradation when the API is unavailable.
- **Three canvas render loops** with phosphor-persistence trails, driven by
  `requestAnimationFrame`.
- Strict TypeScript (`strict: true`, project references), ESLint 9 flat config with
  `typescript-eslint` and `eslint-plugin-react-hooks` 7.1.1, and an MIT licence.

### Absent

- Automated tests, CI, issue and PR templates, changelog, contributor guide, security policy, and
  code of conduct — all added in 0.1.0.
- Any documentation beyond the README.
- `public/favicon.svg`, despite being referenced by `index.html`.

---

[Unreleased]: https://github.com/zazieproductions/AETHER-V9-Pro/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zazieproductions/AETHER-V9-Pro/releases/tag/v0.1.0
[0.0.0]: https://github.com/zazieproductions/AETHER-V9-Pro/tree/102e524c086c25e2e3c0ac1efc2548bdb2d2330c
