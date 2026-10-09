# 0003. Audio as a module-level singleton service

| | |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-10-09 |
| **Deciders** | @zazieproductions |
| **Related** | [Audio Synthesis](../audio-synthesis.md) · [API §1](../api.md#1-audiocontroller) · [TD-10](../tech-debt.md#td-10) · [TD-12](../tech-debt.md#td-12) |

## Context

Sound carries more of the illusion than pixels do. The instrument needs a continuous, always-running
layer — a mains hum whose pitch and brightness track the field, a bandpassed noise floor, a Geiger
crackle whose *rate* is the reading — plus discrete one-shots for user actions.

Three properties of the Web Audio API constrain the design:

1. **Autoplay policy.** An `AudioContext` cannot be started before a real user gesture. The
   application's boot screen exists partly to supply one
   ([`SystemBoot.tsx:37`](../../src/components/SystemBoot.tsx)).
2. **Continuous sources are expensive to recreate.** An oscillator plus filter plus gain is cheap;
   creating and starting them 3.3 times a second to follow the tick is not, and restarting them
   would produce audible discontinuities where smooth modulation is wanted.
3. **The graph must outlive any component.** The hum runs from power-on to page unload. Components
   mount and unmount as tabs change; the audio graph must not.

There is also a failure-mode requirement. Audio is decoration. If the API is missing, blocked, or
throws, the instrument must still work — a hard failure in the audio layer taking down the UI would
be an unacceptable trade for a sound effect.

## Decision

**Audio is a module-level singleton behind a small imperative API.** [`src/utils/audio.ts`](../../src/utils/audio.ts)
declares `AudioController`, exports exactly one instance as `audioService`, and does not export the
class — so a second instance cannot be constructed by accident.

Components fire **intents**, never graph operations:

- `init()` — from the first user gesture only, idempotent
- `setEMFLevel(mG)` — continuous modulation, called only by the engine loop
- `setEVPActive(bool)` / `setVolume(n)` / `setMute(bool)` — continuous state
- `playPowerUp()` / `playDiagnosticBeep(success)` / `playHauntingScream()` — discrete events

Every method's first statement guards on `!this.ctx || this.isMuted`, and every synthesis path is
wrapped in `try/catch`. The controller owns the graph, the envelope scheduling, the two voice
lifetimes (continuous vs one-shot), and mute/volume.

## Consequences

### What it buys

- **One graph, one lifetime.** The context and its two continuous sources are created once and
  modulated forever, which is what makes `setTargetAtTime` smoothing work across a 300 ms tick
  without discontinuities.
- **Total failure isolation.** Before `init()`, and if the API is absent or throws, every method is a
  silent no-op. Audio cannot break the UI. This is the single most valuable property in the design.
- **Single writer for the primary modulation source.** `setEMFLevel` is called from one place, so the
  audio graph's response to the field is deterministic and auditable.
- **A semantic vocabulary.** `playDiagnosticBeep(false)` says what it means at the call site. Ten
  call sites use it and none of them construct an oscillator.
- **Autoplay compliance in one line.** The gesture requirement is satisfied at exactly one location
  instead of being a concern scattered across components.

### What it costs

- **No teardown.** There is no `dispose()` or `suspend()`, so the context, the hum oscillator, the
  looping noise buffer, and the Geiger timeout chain live until page unload. For a single-page
  instrument the page *is* the process, so this is tolerable — but it is a real cost in development,
  where Vite HMR creates a second singleton while the first graph keeps playing
  ([Development §7.1](../development.md#71-hmr-duplicates-the-audio-graph)). [TD-12](../tech-debt.md#td-12).
- **A suspended context is never resumed.** `init()` does not call `ctx.resume()`, so on browsers
  that create contexts suspended — iOS Safari prominently — the application is silent and the Geiger
  chain parks itself on a 1 s heartbeat forever. This is the most likely production failure mode.
  [TD-12](../tech-debt.md#td-12).
- **Untestable without a fake.** A singleton holding live audio nodes cannot be reset between tests,
  and `jsdom` implements no Web Audio API. The mitigation is to extract the mappings as pure
  functions and test those ([Testing §5.2](../testing.md#52-audio-fake)).
- **Hidden global state.** `currentEMF`, `volume`, and `isMuted` are duplicated between the
  controller and `App.tsx`. They are kept in sync by two effects; nothing enforces it.
- **No master bus.** Because each voice connects straight to `ctx.destination`, volume is applied by
  multiplication in JS, muting is per-voice, and there is nowhere to put a compressor.
  [TD-10](../tech-debt.md#td-10).

### What it forbids

- Constructing an `AudioContext`, oscillator, or gain node inside a component.
- Any component other than `App.tsx` calling `setEMFLevel`.
- A second audio module or a second controller instance.
- Letting an audio failure propagate — every synthesis path stays wrapped.

## Alternatives considered

| Option | Rejected because |
| --- | --- |
| **An `AudioProvider` React context** | The graph would be tied to a component's lifetime, which is exactly what it must not be. Context also invites per-render value objects and re-renders for a subsystem that should be invisible to reconciliation. |
| **A `useAudio()` hook** | Hooks re-run with their component. A continuous hum that survives tab changes cannot live in a hook without a ref-based escape hatch that amounts to a singleton anyway — with more ceremony. |
| **A class instantiated in `App` and passed down as a prop** | Workable, and arguably cleaner for testing. Rejected because it adds a prop to all nine components to serve the four that use it, and the instance would still have to outlive tab switches. The singleton gets the same lifetime guarantee with less plumbing. |
| **Per-component audio (each panel owns its sounds)** | Guaranteed graph duplication: two hums, two Geiger chains, two notions of the current EMF level. Also violates [ADR-0001](0001-single-source-of-truth.md) in the audio domain. |
| **A declarative "audio scene graph" in JSX** | Elegant in principle, and a poor fit here: the interesting behaviour is *scheduled parameter automation over time*, which is imperative by nature. Declarative descriptions would still compile down to `setTargetAtTime` calls. |
| **Pre-rendered audio assets** | Rejected on asset grounds — see [ADR-0004](0004-zero-runtime-assets.md). |
| **A library (Tone.js, Howler)** | Tone.js is a genuinely good fit for this kind of synthesis and would remove ~200 lines. Rejected because the raw Web Audio code is short, fully auditable, dependency-free, and *is* part of what the project demonstrates. Howler is a playback library and does not address synthesis at all. |

## Verification

- `grep -rn "new AudioContext\|createOscillator\|createGain" src/components/` returns nothing —
  components contain no graph construction.
- `grep -rn "setEMFLevel" src/` shows exactly one non-definition call site, in `App.tsx`.
- `grep -c "export class AudioController" src/utils/audio.ts` is `0` — the class is not exported.
- Removing Web Audio support (or throwing from the constructor) leaves the UI fully functional.
- Muting silences every voice, including one-shots triggered afterwards.

## Review trigger

Revisit if audio needs a teardown path for embedding (an iframe or a component library), if a second
continuous instrument is added, or if [TD-10](../tech-debt.md#td-10) (master bus) lands — the latter
amends this ADR rather than superseding it, and would be recorded as
[ADR-0008](README.md#when-to-write-one).
