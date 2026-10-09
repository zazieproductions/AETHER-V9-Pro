# 0004. Zero runtime assets: synthesize everything

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Deciders** | @zazieproductions |
| **Related** | [Audio Synthesis §1](../audio-synthesis.md#1-why-synthesize) · [Performance §2](../performance.md#2-measured-bundle) · [Deployment §5](../deployment.md#5-missing-favicon) |

## Context

A convincing instrument needs a lot of surface: sound for a hum, a crackle, static, alarms, a boot
sweep and a scream; imagery for a CRT overlay, glows, an icon set, a floorplan, a radar face; and
type. The conventional route is assets — audio files, images, a webfont — which means sourcing,
licensing, hosting, versioning, preloading, and a payload that grows with every addition.

Two facts made the alternative attractive. First, the sounds needed are *parametric*: their pitch,
brightness, and rate are functions of a live scalar. A sample cannot do that; a set of samples could
only approximate it, at the cost of audible repetition or a large payload. Second, the visual
language is almost entirely procedural already — a scanline overlay is two gradients, a glow is a
radial gradient, a radar face is four arcs.

The measured result of holding the line: **0 bytes of media** in the production bundle, and
≈ **99 kB gzipped** total for the entire application ([Performance §2](../performance.md#2-measured-bundle)).

## Decision

**The application ships no media.** Every sound is synthesized at runtime from Web Audio primitives;
every image is CSS, inline SVG, or canvas; icons come from `lucide-react` as components; type is the
system monospace stack.

Concretely:

| Need | Solution instead of an asset |
| --- | --- |
| Mains hum, static, Geiger clicks, alarms, sweeps, scream | Oscillators, one procedurally generated 2 s noise buffer, filters, and gain envelopes ([Audio Synthesis](../audio-synthesis.md)) |
| CRT scanlines | Two layered `linear-gradient`s with `background-size: 100% 4px, 3px 100%` |
| Ambient glow, corner blooms | `radial-gradient` tinted with `accentColor` |
| Radar face, sweep, contacts, trails | Canvas arcs, a radial gradient wedge, translucent-fill persistence |
| Oscilloscope and EVP waveforms | Canvas paths computed per frame |
| Floorplan | Inline `<svg viewBox="0 0 100 100">`, tinted by `accentColor` |
| Icons | 39 `lucide-react` components, tree-shaken to 9.5 kB |
| Type | `font-mono` — the system monospace stack, no webfont |

**One documented exception:** `favicon.svg` should exist ([Deployment §5](../deployment.md#5-missing-favicon)).
A favicon is browser chrome, not application content, and its absence causes a 404 on every load. It
is referenced today but missing — [TD-18](../tech-debt.md#td-18).

## Consequences

### What it buys

- **Nothing to load, decode, or wait for.** No layout shift from late images, no font swap, no
  audio-buffer fetch, no preload hints to manage. First paint is the whole experience.
- **Continuous control.** Every sonic parameter is an `AudioParam`, so the field level modulates
  pitch, cutoff, gain, and click *rate* smoothly. Sampled audio could only crossfade between
  pre-baked states.
- **Audibility of the model.** Because the sound is generated from the same scalar as the visuals,
  the audio *is* a readout. A contributor can hear the simulation misbehave before seeing it.
- **A tiny, self-contained deployable.** 99 kB, no media, no network requests at runtime — it works
  offline and from any static host ([Deployment §8](../deployment.md#8-runtime-requirements)).
- **No licensing surface.** Nothing to attribute, no asset provenance to track, no licence review.
- **The code is the specification.** A reader can audit exactly what a sound is in ~30 lines, instead
  of inferring it from a waveform.

### What it costs

- **Synthesis skill is a prerequisite.** Contributing a sound means knowing what a bandpass Q does.
  Mitigated by the recipe in [Audio Synthesis §8](../audio-synthesis.md#8-adding-a-sound).
- **Visual fidelity ceilings.** Canvas 2D cannot do what a texture can — no grain, no scanline
  variance, no film damage. The CRT effect is a gradient and reads as a *suggestion* of a CRT.
- **CPU instead of bandwidth.** Per-frame path construction and `shadowBlur` are real work
  ([Performance §4.4](../performance.md#44-shadowblur-is-the-most-expensive-call-in-the-loops)). On a
  low-end phone that trade is not free, whereas a PNG would be.
- **Non-deterministic visuals.** Waveforms contain `Math.random()` terms by design, which is why
  pixel-output testing is explicitly out of scope ([Testing §5.4](../testing.md#54-what-not-to-test)).
- **System-font inconsistency.** Monospace metrics differ across platforms, so 8 px type is 8 px of
  *whatever* the platform provides. This compounds the accessibility finding
  [A11Y-09](../accessibility.md#3-wcag-22-findings).

### What it forbids

- Adding an audio file, image, or webfont to the bundle without amending this ADR.
- Reaching for an asset where a gradient or a canvas path would do.
- CDN-hosted media or third-party embeds.

## Alternatives considered

| Option | Rejected because |
| --- | --- |
| **Sampled SFX (`.mp3` / `.wav`)** | Cannot respond continuously to a live scalar. A 30-click Geiger loop either repeats audibly within seconds or costs megabytes; the same objection applies to hum and static. |
| **Pre-rendered stems per EMF band, crossfaded** | The classic game-audio answer, and it would work. Rejected on granularity: five bands is audibly steppy for a sweep from 0.2 to 43 mG, and it multiplies the payload by the number of bands. |
| **A webfont (e.g. a terminal face)** | The aesthetic gain is real; the cost is a render-blocking request, a FOUT, and 20–80 kB for a look the system monospace stack approximates well. |
| **SVG/PNG sprites for icons** | `lucide-react` already tree-shakes to 9.5 kB for 39 icons and scales with `currentColor`, which is what makes accent theming work. A sprite sheet would be larger and harder to tint. |
| **CSS-only visuals, no canvas** | Cannot express a 280-point noisy trace with phosphor persistence, or a contact cloud with individual physics. The three canvases exist because CSS genuinely cannot do those three things. |
| **WebGL shaders for everything** | Capable of far more, at the cost of a dependency or several hundred lines of GLSL, and the current bottleneck is React reconciliation rather than fill rate. Revisit only for a fundamentally denser visualization ([Roadmap X2](../roadmap.md#7-exploration)). |

## Verification

- `find dist -type f | grep -Ev '\.(html|js|css)$'` returns nothing after a build.
- `grep -rn "url(" src/*.css src/**/*.tsx` finds no asset references (only gradients).
- Total media in the bundle is 0 kB; gzipped transfer stays ≈ 99 kB.
- The application runs with the network disabled after first load.

## Review trigger

Revisit if a specific visual genuinely cannot be achieved procedurally and its absence is costing the
design — the honest candidates are film grain and a distinctive display face. Either addition should
be a new ADR that amends this one, with a measured payload cost, not a quiet exception.
