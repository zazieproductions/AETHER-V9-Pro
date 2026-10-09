# 0006. CI gating and the lint baseline

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Deciders** | @zazieproductions |
| **Related** | [Tech-Debt Register §1](../tech-debt.md#1-lint-baseline) · [Development §5](../development.md#5-lint-state--read-this-before-your-first-pr) · [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |

## Context

Before this documentation pass the repository had **no CI at all** — no workflow, no checks, no
templates, no changelog. The README nonetheless told contributors: "Run `npm run lint` and
`npm run build` locally; both must pass."

That instruction was impossible to follow. Verified at commit `102e524`:

| Gate | Result |
| --- | --- |
| `npm run build` (`tsc -b && vite build`) | ✓ passes |
| `npm run lint` (`eslint .`) | ✗ **45 errors across 12 files** |

Adding CI naively would produce a permanently red check on every PR. Adding CI with lint removed
would silently drop the gate the project claims to have. Both outcomes are worse than the honest
third option, and both are common.

The composition of the baseline matters to the decision. Of the 45 errors, **35 are mechanical** —
unused icon imports, dead state bindings, empty `catch` blocks, one `@ts-ignore`. Mechanical for a
*human*: `eslint . --fix` changes nothing here (45 errors before and after, zero files modified),
because none of those rules ships a fixer. The other **7 are
design findings** from `eslint-plugin-react-hooks` 7.1.1, a substantially stricter ruleset than the
5.x series most React code runs, and they overlap almost exactly with real behavioural defects
already in the register ([TD-02](../tech-debt.md#td-02), [TD-03](../tech-debt.md#td-03)). The plugin
is correctly configured; the code has not caught up to it.

## Decision

**CI gates on what is true today, reports on what is not yet, and ratchets.**

Three jobs in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), on every pull request and
push to `main`:

| Job | Step | Blocking? |
| --- | --- | --- |
| **quality** | `npm ci` | — |
| | `npm run typecheck` (`tsc -b`) | **yes** |
| | `npm run build` | **yes** |
| | `npm run lint` | **no** — `continue-on-error: true`, with the baseline stated in the job name |
| | Preview-instrumentation check (guards [TD-15](../tech-debt.md#td-15), [TD-16](../tech-debt.md#td-16)) | **no** — advisory warning |
| | Dependency audit, production tree (`npm audit --omit=dev`) | **no** — advisory warning, count written to the job summary. The tree carries 4 transitive advisories today ([TD-22](../tech-debt.md#td-22)) |
| **report** | Upload the ESLint JSON output as a build artifact | no |
| | Count errors and compare against the recorded baseline of 45 | **yes, on regression only** — fails if the count exceeds the baseline |
| **deploy** (separate workflow) | Same instrumentation check, plus a `--base` build | **yes** — refuses to ship preview tooling |

The lint job is explicitly named *"lint (advisory — 45-error baseline, see ADR-0006)"* so that
anyone reading a check run understands the state without opening a file.

**Ratchet rule:** the baseline number may only decrease. When it reaches zero, the
`continue-on-error` is removed in the same PR, and lint becomes blocking permanently. That PR is
[Roadmap F3](../roadmap.md#4-phase-2--verifiable).

Contributor policy, in [CONTRIBUTING](../../CONTRIBUTING.md):

1. Do not add to the baseline. A PR introducing a new error does not merge.
2. Fix what you touch — if your diff edits a file with existing errors, clear that file.
3. Mechanical fixes ship separately from behavioural fixes.

## Consequences

### What it buys

- **A green CI that means something.** Type-checking and building are enforced from day one, so no PR
  can break compilation — the failure mode that actually blocks reviewers.
- **Honesty about state.** The check name, the ADR, the register, and the README all say the same
  thing: 45 known errors, itemized, with a plan. Nobody discovers this by accident.
- **A ratchet with a defined end.** The path from advisory to blocking is one number reaching zero,
  not a judgement call.
- **Visibility without blocking.** The artifact and the count mean regressions in the baseline are
  observable on every PR even while the gate is soft.
- **Cheap insurance on the rest.** The same workflow runs on Node 20 and 22, which catches the
  runtime-floor claim in [Development §1](../development.md#1-environment) being wrong.

### What it costs

- **A red-looking lint step on every run.** Mitigated by the job name and the ADR link, but a
  reviewer skimming checks may still read it as failure. This is the deliberate trade: a visible
  known-failing advisory beats an invisible missing gate.
- **The baseline can rot.** If the count is not checked, new errors hide inside the 45. The ratchet
  step exists for this reason and must not be removed — it is the one blocking lint mechanism, and it
  only ever fires on a regression.
- **Two workflows, two policies for the same check.** The instrumentation check warns in CI and
  blocks deployment. Defensible but subtle: CI describes the repository as it is, while the deploy
  workflow describes what may be published. Worth stating explicitly so the asymmetry is not read as
  an oversight.
- **Two policies to explain.** "Build must pass, lint should not get worse" is more nuanced than
  "everything must pass", and nuance costs onboarding time.
- **CI minutes on a project with no tests yet.** Small, but nonzero — the workflow runs twice per PR
  (two Node versions).

### What it forbids

- Silently removing the lint step to make CI green.
- Raising the baseline count.
- Adding `eslint-disable` comments to suppress findings without a register entry.
- Merging a PR that introduces a new lint error, however small.

## Alternatives considered

| Option | Rejected because |
| --- | --- |
| **Blocking lint from day one** | Every PR fails a check that the PR did not cause. Contributors learn to ignore red checks, which is worse than not having them — and the first genuine type error then gets merged past a wall of noise. |
| **No CI at all (the pre-`0.1.0` state)** | The README's contribution instruction stays impossible to satisfy, and nothing prevents a PR from breaking the build. |
| **Fix all 45 errors first, then add CI** | The right end state, and it is [Roadmap L35 + F3](../roadmap.md#3-phase-1--correct-and-quiet). Rejected as a *sequencing* choice: the 7 design findings are entangled with behavioural defects that need tests, and tests need the engine extraction ([F1](../roadmap.md#4-phase-2--verifiable)). Blocking CI on that chain would delay every guarantee by weeks. CI now, ratchet later. |
| **Weaken the ESLint config (downgrade the rules to `warn`)** | Would make the gate green by making the standard lower. The `react-hooks` v7 findings are largely legitimate; suppressing them loses the signal that identifies TD-02 and TD-03. |
| **Remove `eslint-plugin-react-hooks` v7 and pin v5** | Same objection — it discards a real upgrade to avoid dealing with what it found. |
| **`eslint --max-warnings` with a numeric budget** | Close, and arguably cleaner: it encodes the ratchet in the tool rather than in a shell step. Not adopted because the current findings are *errors*, not warnings, so the budget mechanism does not apply without downgrading them — which is the previous option. Worth reconsidering if the remaining baseline is converted to warnings. |
| **Per-file `eslint-disable` with TODO comments** | Distributes the debt into 12 files as suppressions instead of centralizing it in one register. Suppressions are invisible to a reader of the register; the register is invisible to nobody. |

## Verification

- CI runs on every PR and on pushes to `main`, and the typecheck and build steps are blocking — they
  fail the job. Marking the `quality` job a **required status check** is a separate step in
  *Settings → Branches* that only a repository administrator can perform, and it is not yet done.
- The lint step appears with `(advisory …)` in its name and does not fail the run.
- The reported error count is ≤ 45 and non-increasing across PRs.
- The README, [Development §5](../development.md#5-lint-state--read-this-before-your-first-pr), and
  this ADR state the same number. If they diverge, the register is stale.
- When the count reaches zero: `continue-on-error` removed, the job renamed to `lint`, and this ADR's
  status amended to note that the ratchet completed.

## Review trigger

Revisit when the first test suite lands ([Roadmap F2](../roadmap.md#4-phase-2--verifiable)) — the
`test` step joins the blocking set at that point — or when the baseline reaches zero and the gate
hardens.
