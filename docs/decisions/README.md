# Architecture Decision Records

An ADR records a decision that shapes the system, the context that forced it, what was rejected, and
what it costs. They are written when the decision is made and **are not revised afterwards** — a
change of direction gets a new ADR that supersedes the old one, so the reasoning history survives.

This matters most for a small project, where the temptation is to skip the ceremony. The decisions
here are exactly the ones a new contributor would otherwise undo by accident: why the simulation
lives in one file, why canvas and React are kept apart, why audio is a singleton, why there are no
assets, and why the lint gate is advisory.

## Index

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-single-source-of-truth.md) | Single source of truth: the simulation lives in `App.tsx` | Accepted | 2026-10-09 |
| [0002](0002-two-rendering-domains.md) | Two rendering domains: React for data, canvas for frames | Accepted — one violation recorded | 2026-10-09 |
| [0003](0003-audio-as-a-module-singleton.md) | Audio as a module-level singleton service | Accepted | 2026-10-09 |
| [0004](0004-zero-runtime-assets.md) | Zero runtime assets: synthesize everything | Accepted | 2026-10-09 |
| [0005](0005-procedural-signal-model.md) | Procedural signal model over independent random sampling | Accepted | 2026-10-09 |
| [0006](0006-ci-gating-and-the-lint-baseline.md) | CI gating and the lint baseline | Accepted | 2026-10-09 |

## Status values

| Status | Meaning |
| --- | --- |
| **Proposed** | Under discussion; not yet binding |
| **Accepted** | Binding. Code that contradicts it is a defect. |
| **Accepted — violation recorded** | Binding, with a known contradiction tracked in the [register](../tech-debt.md) rather than hidden |
| **Deprecated** | No longer applies; retained for history |
| **Superseded by NNNN** | Replaced; the successor records what changed and why |

## Format

Each ADR follows the same skeleton — short enough to read in two minutes, structured enough to
argue with:

```markdown
# NNNN. Title

| Status | Date | Deciders | Related |

## Context          — the forces at play, with evidence
## Decision        — the choice, stated imperatively
## Consequences    — what it buys, what it costs, what it forbids
## Alternatives    — what was rejected, and the specific reason
## Verification    — how to tell the decision is still being honoured
```

## When to write one

Write an ADR when a decision is **(a)** hard to reverse, **(b)** surprising to a competent reader, or
**(c)** likely to be re-litigated. Any one of the three is enough. Do not write one for a local
implementation choice that a code comment can carry.

Proposals for the next ADRs, based on work in the [roadmap](../roadmap.md):

| Candidate | Triggered by |
| --- | --- |
| 0007. The simulation as a pure, seeded module | [Roadmap F1](../roadmap.md#4-phase-2--verifiable) — will supersede part of 0001 |
| 0008. A master audio bus | [Roadmap D10](../roadmap.md#4-phase-2--verifiable) — amends 0003 |
| 0009. Motion and intensity as a first-class setting | [Roadmap A3/A5](../roadmap.md#5-phase-3--accessible) |
| 0010. Scenario data format | [Roadmap E3](../roadmap.md#6-phase-4--capable) |

## Template

```markdown
# NNNN. Short, active-voice title

| | |
| --- | --- |
| **Status** | Proposed |
| **Date** | YYYY-MM-DD |
| **Deciders** | @handle |
| **Related** | [ADR-NNNN](0000-….md), [TD-NN](../tech-debt.md#td-nn) |

## Context

What is true, what is changing, and why a decision is needed now. Cite evidence —
`src/…:line`, measured numbers, a defect ID. Two to six paragraphs.

## Decision

One paragraph, imperative mood: "We will …". Followed by the specifics if needed.

## Consequences

### What it buys
### What it costs
### What it forbids

## Alternatives considered

| Option | Rejected because |
| --- | --- |

## Verification

The observation or test that shows the decision is still being honoured.
```

---

**Back to:** [Documentation index](../README.md)
