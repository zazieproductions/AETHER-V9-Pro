# AETHER V9 Pro — Documentation

Engineering documentation for a client-side instrument simulation. Everything here is derived
from the source in [`src/`](../src) and verified against commit `102e524`.

> [!NOTE]
> AETHER V9 Pro is **interactive fiction**. It measures nothing real. The engineering, however,
> is real: a deterministic signal model, a runtime audio synthesizer with zero audio assets, and
> a deliberate split between React's reconciliation domain and canvas's frame domain.

---

## Reading paths

| You are… | Read in this order |
| --- | --- |
| **Evaluating the project** (recruiter, reviewer) | [README](../README.md) → [Architecture](architecture.md) → [Tech-Debt Register](tech-debt.md) → [ADRs](decisions/) |
| **Running it locally** | [README · Quick start](../README.md#quick-start) → [Development](development.md) |
| **Contributing code** | [CONTRIBUTING](../CONTRIBUTING.md) → [Development](development.md) → [Components](components.md) → [ADRs](decisions/) |
| **Working on the simulation** | [Simulation Engine](simulation-engine.md) → [ADR-0005](decisions/0005-procedural-signal-model.md) |
| **Working on sound** | [Audio Synthesis](audio-synthesis.md) → [API · AudioController](api.md#1-audiocontroller) → [ADR-0003](decisions/0003-audio-as-a-module-singleton.md) |
| **Improving performance** | [Performance](performance.md) → [ADR-0002](decisions/0002-two-rendering-domains.md) |
| **Shipping it** | [Deployment](deployment.md) → [Testing](testing.md) |

## Index

### Core

| Document | Scope |
| --- | --- |
| [Architecture](architecture.md) | System context, layering, state ownership, data flow, module graph, lifecycle |
| [Simulation Engine](simulation-engine.md) | The EMF signal model: regimes, exact mathematics, outbreak state machine, derived quantities |
| [Audio Synthesis](audio-synthesis.md) | Web Audio graph per voice, EMF→parameter mappings, autoplay policy, failure isolation |
| [Components](components.md) | Per-component reference: responsibility, props, internal state, effects, cleanup status |
| [API Reference](api.md) | `AudioController` methods, domain types, component prop contracts |

### Engineering practice

| Document | Scope |
| --- | --- |
| [Development](development.md) | Toolchain, scripts, TypeScript/ESLint configuration rationale, debugging, StrictMode |
| [Testing](testing.md) | Current coverage, test strategy, specifications worth writing first, manual test matrix |
| [Performance](performance.md) | Verified bundle metrics, frame budget, hot-path inventory, remediation |
| [Accessibility](accessibility.md) | Static conformance assessment, WCAG 2.2 findings, remediation plan |
| [Deployment](deployment.md) | Static hosting, base paths, caching, environment variables, verification checklist |

### Direction and stewardship

| Document | Scope |
| --- | --- |
| [Roadmap](roadmap.md) | Prioritized work: debt clearance, then capability |
| [Tech-Debt Register](tech-debt.md) | Every known defect and hygiene issue, with evidence, severity, and remediation |
| [Architecture Decision Records](decisions/) | Why the system is shaped the way it is — including superseded and rejected options |
| [CHANGELOG](../CHANGELOG.md) | Release history, Keep a Changelog format |
| [CONTRIBUTING](../CONTRIBUTING.md) | Workflow, conventions, definition of done |
| [SECURITY](../SECURITY.md) | Threat surface and disclosure policy |
| [CODE_OF_CONDUCT](../CODE_OF_CONDUCT.md) | Contributor Covenant 2.1, plus how this project's horror content applies to people |

## Documentation conventions

These apply to every file in `docs/` and are enforced in review.

1. **Every claim is traceable.** Behavioural statements cite source — `src/App.tsx:89`, not
   "the engine". If a document cannot point at the code, it is speculation and gets labelled as such.
2. **Verified numbers carry their provenance.** Bundle sizes, contrast ratios, and tick rates state
   how they were measured and against which commit.
3. **Defects are documented, not hidden.** Known bugs live in the [Tech-Debt Register](tech-debt.md)
   with severity and remediation. A document that describes intended behaviour which the code does
   not implement must say so explicitly.
4. **Rationale lives in ADRs.** A document explains *what* and *how*; an [ADR](decisions/) explains
   *why*, and records what was rejected.
5. **Each document names its audience and review state** in the metadata block at the top.
6. **Screenshots and diagrams** belong in `docs/assets/`, referenced by relative path. Binary
   assets are documentation-only — the application itself keeps its
   [zero-asset rule](decisions/0004-zero-runtime-assets.md).
7. **Line numbers are a snapshot.** They are accurate at the commit named in each document's
   metadata block. When a referenced line moves, update the citation in the same PR.

---

<div align="center">
<sub>▲ AETHER V9 — Documentation maintained alongside the code it describes.</sub>
</div>
