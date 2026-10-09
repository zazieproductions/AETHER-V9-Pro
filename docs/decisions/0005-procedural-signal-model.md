# 0005. Procedural signal model over independent random sampling

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Deciders** | @zazieproductions |
| **Related** | [Simulation Engine](../simulation-engine.md) · [Roadmap F1](../roadmap.md#4-phase-2--verifiable) · [Testing §3](../testing.md#3-the-seedability-blocker) |

## Context

The whole premise is that the trace looks like a physical sensor rather than like a random number
generator. That is a harder problem than it appears, because the failure mode is subtle: `Math.random()`
scaled into a plausible range produces values that are individually fine and collectively obviously
fake. Three things give it away:

1. **No memory.** Successive samples are independent, so the trace has no trajectory. Real
   magnetometer readings settle, drift, and ring down.
2. **Symmetry.** Independent noise rises and falls at the same rate. Real transients are impulsive —
   fast up, slow down.
3. **Uniform activity.** Noise is equally busy everywhere, so nothing reads as an *event*. A
   believable instrument is mostly quiet, and quiet in a way that makes the exceptions legible.

There is also a second, less obvious requirement: the model must be **legible to a reader**. Part of
this project's value is that someone can open `App.tsx` and understand exactly why the trace behaves
the way it does. That argues against importing a signal-processing library or a noise model whose
behaviour is not visible in the source.

## Decision

**Model the signal as a bounded, regime-dependent random walk with impulsive events — not as scaled
noise.** Concretely, in [Simulation Engine §3](../simulation-engine.md#3-auto-regime--the-bounded-random-walk):

```
if prev < 3.0 mG   (QUIET)     next ← prev + U(-0.2, +0.2)         ; p = 0.03 → next ← U(5, 13)
else               (ELEVATED)  next ← prev − U(0.3, 0.8)           ; p = 0.10 → next ← U(12, 22)
next ← clamp(next, 0.2, 95)
```

Four mechanisms, each answering one of the failure modes above:

| Mechanism | Answers |
| --- | --- |
| `next` is a function of `prev` | No memory → autocorrelated trajectory |
| Rise is a jump, fall is a decay | Symmetry → impulsive transients with ring-down |
| A 3.0 mG regime boundary that drains upward excursions | Uniform activity → stillness as the default state |
| Two independent spike processes (3 %, 10 %) | Periodicity → irregular, non-beating events |

**The scripted outbreak deliberately uses a different model**: a deterministic 25 ± 12 mG sinusoid at
a 1.26 s period plus additive jitter ([§5.1](../simulation-engine.md#51-outbreak-signal)). A
crisis event should be *shaped*, not sampled — the sine gives the overlay, the audio, and the radar a
shared rhythm to lock onto, which a random walk could not provide.

## Consequences

### What it buys

- **Believability from five lines.** The emergent statistics — a spike roughly every 10 s, a 5–10 s
  ring-down, occasional cascades — are documented and derived in
  [§3.2](../simulation-engine.md#32-emergent-statistics), and they are what makes the instrument
  feel like it is measuring something.
- **Legibility.** A reader can hold the entire model in their head. The tuning table
  ([§8](../simulation-engine.md#8-tuning-reference)) maps each constant to the feeling it controls.
- **One scalar drives everything.** Because the model emits a single authoritative value, all nine
  panels and the whole audio graph are consistent by construction
  ([ADR-0001](0001-single-source-of-truth.md)).
- **Cheap.** Three `Math.random()` calls per tick, 3.3 times a second. No buffers, no DSP, no
  per-frame cost.
- **Tunable by feel.** Every constant has an interpretable effect, so shaping the instrument is a
  matter of changing numbers and listening.

### What it costs

- **No physical grounding.** The model is not a magnetometer. It has no 1/f noise, no sensor noise
  floor, no temperature coefficient, no hysteresis, no aliasing. The fiction is coherent, not
  accurate — which is fine for interactive fiction and would be disqualifying for an instrument.
- **Not reproducible.** `Math.random()` is called directly in eight modules, so no trace can be
  replayed. That is the sole reason the project has no engine tests:
  [Testing §3](../testing.md#3-the-seedability-blocker).
- **Statistical properties must be derived by hand.** There is no closed-form output distribution;
  the numbers in §3.2 came from reasoning about the transition rules, and they should be confirmed
  empirically once the model is seedable.
- **The clamp does no work.** The 95 mG ceiling is unreachable at current constants (practical
  maximum 22 mG in AUTO, 43 mG in outbreak). It is defensive code that looks like a spec.
- **Two models to keep coherent.** The walk and the scripted sinusoid have different shapes, ranges,
  and rates. A future scenario system ([Roadmap E3](../roadmap.md#6-phase-4--capable)) needs to
  reconcile them rather than add a third.

### What it forbids

- Independent per-sample noise for the primary reading (`emf = base + Math.random() * n`).
- A sine or modulo-driven "activity cycle" — the beat is visible within seconds.
- Per-panel signal generation. Panels derive; only the engine generates.

## Alternatives considered

| Option | Rejected because |
| --- | --- |
| **Scaled `Math.random()`** | The thing this ADR exists to avoid: no memory, symmetric, uniformly busy. |
| **Perlin / simplex noise** | Genuinely good at smooth continuous variation, and the obvious choice for terrain or clouds. Wrong here: it produces *smooth* traces, and the interesting behaviour is impulsive. A smooth 1 mG wander with no events reads as a broken sensor. It would also mean a dependency or ~100 lines of gradient-noise code for a 3.3 Hz signal. |
| **Pink / 1-f noise** | The physically correct model for sensor drift, and a real improvement to the quiet band. Rejected on legibility: generating it needs either a filter bank or an FFT-based method, and the result is harder to tune by feel. A strong candidate if the quiet band ever needs to feel more alive — it could replace the uniform walk step without touching the spike processes. |
| **A Markov chain over discrete states** | Explicit states would make severity classification trivial and testing easy. Rejected because discretizing the reading shows: the big counter would step between levels instead of sweeping, and the sweep is most of the effect. |
| **Ornstein–Uhlenbeck (mean-reverting) process** | The *correct* answer for a settling sensor, and better than the current walk in one specific respect — the quiet band has no mean reversion today, so it diffuses until it crosses the regime boundary. Rejected as premature: it needs a drift coefficient, a mean, and a time constant, all of which must be tuned by someone who knows what they mean. The regime boundary gets 80 % of the perceptual benefit for one comparison. **Revisit if the baseline ever feels wrong.** |
| **A physics simulation (dipoles, inverse-square falloff)** | Would let contacts have real positions and the reading fall off with distance — genuinely compelling. Rejected on scope: it is a different project, and its output would be *less* controllable for a scripted horror beat, which is what the outbreak needs. |
| **Driving the model from recorded real EMF data** | There is no such thing to record; and a fixed recording would loop audibly and remove the operator's ability to inject a signal. |

## Verification

- The engine remains the only generator: `grep -rn "Math.random" src/` shows derived quantities and
  panel-local variation, but no second source of the primary reading.
- The regime constants in [§8](../simulation-engine.md#8-tuning-reference) match the code.
- Once [Roadmap F1](../roadmap.md#4-phase-2--verifiable) lands, specs U1–U10
  ([Testing §4.1](../testing.md#41-engine-specifications)) assert the emergent statistics rather than
  leaving them as claims in a document. Until then, the empirical claims in §3.2 are reasoned, not
  measured — and labelled as such.

## Review trigger

Revisit when the engine is extracted ([F1](../roadmap.md#4-phase-2--verifiable)): that is the moment
to consider an Ornstein–Uhlenbeck quiet band and a seeded RNG, and to replace the hand-derived
statistics with measured ones. Both changes preserve this decision — impulsive events over smooth
noise, one generator, legible constants — while fixing its two real weaknesses.
