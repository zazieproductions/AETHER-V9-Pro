<!--
Title format: a valid Conventional Commit — PRs are squash-merged, so the title
becomes the commit of record. e.g. "fix(radar): purge contacts outside the sweep radius"
See CONTRIBUTING.md §3.4.
-->

## Summary

<!-- What changed, in two or three sentences. Explain the *why*; the diff already shows the *what*. -->

## Motivation

<!-- Link the issue, the roadmap ID (D/F/E/A/X-nn), or the register entry (TD-nn) this closes. -->

Closes #
Register entry: `TD-__` · Roadmap: `__`

## Verification

<!-- How was this checked? Be specific — this is the section reviewers read first.
     Paste commands and their output where it is short. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] `npm run lint` reports no **new** errors (baseline: 45 — [tech-debt §1](../docs/tech-debt.md#1-lint-baseline))

Evidence:

```console
$
```

<!--
Performance change  → before/after numbers from the Profiler or a bundle report.
Defect fix          → the register entry's verification step, observed.
Visual change       → a screenshot or recording.
Audio change        → say what was listened to, on which output device.
-->

## Definition of done

<!-- Full list and rationale: CONTRIBUTING.md §5 -->

- [ ] Every timer, listener, and frame loop I introduced is torn down.
- [ ] No React setter is called from a frame callback or from inside a state updater.
- [ ] New controls have accessible names; new text meets the contrast and size floors in
      [CONTRIBUTING §4.5](../CONTRIBUTING.md#45-styling).
- [ ] Behaviour changes are reflected in [`docs/`](../docs/README.md) **in this PR**, including
      line-number citations I re-verified.
- [ ] The register is updated: entry closed and moved to
      [tech-debt §7](../docs/tech-debt.md#7-closed), amended, or added.
- [ ] A test is added, or a specification written in
      [Testing §4](../docs/testing.md#4-specifications-worth-writing-first) for when the harness lands.
- [ ] Not applicable — I changed documentation only, or none of the above applies (explain below).

## Notes for reviewers

<!-- Anything subtle: a deliberate trade-off, an ADR this implements or contradicts, a follow-up you
     did not do here, or a known limitation. Also flag sensory-heavy behaviour changes — flashing,
     sudden audio, screen shake — so reviewers are not caught off guard. -->

---

<sub>Reviewer checklist is in [CONTRIBUTING §9](../CONTRIBUTING.md#9-review). Ground rules for what
is in scope are in [CONTRIBUTING §1](../CONTRIBUTING.md#1-ground-rules).</sub>
