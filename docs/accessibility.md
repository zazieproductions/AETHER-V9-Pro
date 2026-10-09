# Accessibility

| | |
| --- | --- |
| **Audience** | Contributors, reviewers, anyone deploying this publicly |
| **Status** | **Work in progress — the application does not currently conform to WCAG 2.2 AA.** This is a static-analysis assessment of the source, not an audited conformance report; no assistive-technology testing has been performed. |
| **Target** | WCAG 2.2 Level AA |
| **Method** | Source inspection, computed contrast ratios from the compiled CSS, and API-usage counts. Every figure below states how it was obtained. |

This document exists to be accurate rather than flattering. A diegetic instrument UI makes
deliberate visual choices — near-black panels, 8 px monospace labels, constant motion, colour-coded
severity — that are in direct tension with conformance. Those choices are worth keeping; they are
also worth making *available*, so the plan here is mostly about adding an escape hatch rather than
redesigning the aesthetic.

---

## 1. Summary

| Area | State |
| --- | --- |
| Keyboard operability | **Good** — every control is a native `button`, `input`, or `select` |
| Semantics and landmarks | **Partial** — `header`/`nav`/`main`/`footer` present; no `h1` in the console; tabs are not a tablist |
| Accessible names | **Absent** — 0 `aria-*` attributes, 0 `role` attributes, 0 `<label>` elements, 0 `alt` attributes in the entire codebase |
| Text contrast | **Mixed** — primary text passes AAA; muted label text fails AA |
| Non-text contrast | **Passing** — all four accent themes exceed 3:1 on black |
| Text size | **Failing in practice** — 136 uses of 8 px, 9 px, and 10 px type |
| Motion | **No opt-out** — 37 concurrent animations, no `prefers-reduced-motion` handling |
| Auto-updating content | **Failing** — no global pause mechanism (WCAG 2.2.2) |
| Live announcements | **Absent** — no `aria-live`; state changes are silent to screen readers |
| Audio control | **Present but unnamed** — a mute toggle exists and is icon-only |
| Sensory load | **High** — a scripted jump-scare event with strobing overlay, screen shake, and a synthesized scream |

Counts verified by `grep` across `src/`: `aria-` → **0**, `role=` → **0**, `<label` → **0**,
`alt=` → **0**, `prefers-reduced-motion` → **0**, `focus-visible`/`focus:ring` → **0**.

## 2. What already works

Recorded first, because it is real and should not be regressed:

| ✓ | Detail | Criterion |
| --- | --- | --- |
| Native interactive elements | All controls are `<button>`, `<input type="range">`, or `<select>` — no `div onClick`. Keyboard focus, activation, and form semantics come free. | 2.1.1 Keyboard |
| Landmark regions | `<header>`, `<nav>`, `<main>`, `<footer>` in [`App.tsx:225-509`](../src/App.tsx) | 1.3.1, 2.4.1 |
| Document language | `<html lang="en">` | 3.1.1 |
| Zoom permitted | `viewport` sets `width=device-width, initial-scale=1.0` with **no** `user-scalable=no` or `maximum-scale` | 1.4.4 |
| Severity is not colour-only | Log entries pair a colour badge with the literal text `LOW`/`MEDIUM`/`HIGH`/`CRITICAL`; the entity guide pairs colour with `danger` text; theme swatches are labelled | 1.4.1 Use of Color |
| A mute control exists | Header toggle stops all sound; audio never starts before a user gesture | 1.4.2 Audio Control |
| Radar data has a text mirror | The canvas is accompanied by a DOM contact list with name, type, distance, bearing, and energy — so the radar's *information* is not canvas-only | 1.1.1 (partial) |
| Focus outlines mostly intact | Tailwind preflight does not strip default focus rings, and only one control opts out | 2.4.7 (partial) |

## 3. WCAG 2.2 findings

Severity: **A** = Level A failure (blocking) · **AA** = Level AA failure (target level) ·
**AAA** = Level AAA (aspirational) · **UX** = not a criterion failure, but a real barrier.

| ID | Criterion | Sev | Finding | Evidence |
| --- | --- | --- | --- | --- |
| **A11Y-01** | 1.3.1 Info and Relationships | A | The five-tab navigation is a row of `<button>`s with no `role="tablist"`/`"tab"`/`"tabpanel"`, no `aria-selected`, and no `aria-controls`. Assistive tech announces five generic buttons and cannot convey that they are mutually exclusive views. | [`App.tsx:284-317`](../src/App.tsx) |
| **A11Y-02** | 4.1.2 Name, Role, Value | A | Icon-only buttons have no accessible name: the mute toggle renders `<VolumeX>`/`<Volume2>` with no text and no `aria-label`. It announces as "button". | [`App.tsx:251-256`](../src/App.tsx) |
| **A11Y-03** | 3.3.2 / 4.1.2 Labels or Instructions | A | No `<label>` element exists in the codebase. The volume slider, the manual-EMF slider, sensitivity, ambient temperature, and the location `<select>` all rely on adjacent styled `<span>`s that are not programmatically associated. | 0 occurrences of `<label` in `src/` |
| **A11Y-04** | 1.1.1 Non-text Content | A | Two of the three canvases convey information with no text alternative: the oscilloscope (waveform shape, sweep/gain/trigger state) and the EVP waveform (recording vs standby vs playback). They have no `aria-label`, no fallback content, and no visually-hidden equivalent. | [`LiveEMFDisplay.tsx:321-326`](../src/components/LiveEMFDisplay.tsx), [`EVPRecorder.tsx:203-208`](../src/components/EVPRecorder.tsx) |
| **A11Y-05** | 2.4.6 Headings and Labels | AA | The console has **no `h1`** and no headings at all — the only `h1` is on the boot screen and the only `h2` is the outbreak overlay. Panel titles are styled `<span>`s, so there is no navigable document structure. | [`SystemBoot.tsx:97`](../src/components/SystemBoot.tsx), [`App.tsx:213`](../src/App.tsx) |
| **A11Y-06** | 4.1.3 Status Messages | AA | Nothing is announced. New anomaly log entries, EMF threshold crossings, the outbreak alert, EVP decode results, and node selection changes all update the DOM silently. | 0 `aria-live` regions |
| **A11Y-07** | 2.2.2 Pause, Stop, Hide | A | The instrument updates continuously and automatically — the clock at 10 Hz, the simulation at 3.3 Hz, three canvas animations at 60 fps — for far longer than 5 seconds, with **no mechanism to pause, stop, or hide it**. The radar's FREEZE button pauses one sweep, not the content. | [`App.tsx:67`](../src/App.tsx), [`App.tsx:89`](../src/App.tsx) |
| **A11Y-08** | 1.4.3 Contrast (Minimum) | AA | Muted label text fails AA. Computed from the compiled Tailwind v4 tokens against the effective panel background (`zinc-950` at 80 % over black ≈ `#070709`): **`slate-500` → 4.22:1** (needs 4.5), **`slate-600` → 2.66:1** (fails AA and AA-large). These are the most-used text colours in the app — section labels, units, timestamps, hints. | see §4 |
| **A11Y-09** | 1.4.4 Resize Text | AA | 136 text elements use hard-coded pixel sizes — **53 × 8 px**, **36 × 9 px**, **46 × 10 px**, 1 × 11 px. Browser zoom does scale these, so the criterion is technically met, but 8 px monospace is below the readability floor for most users and px units ignore the user's font-size preference. | `grep -o 'text-\[[0-9]*px\]' src/` |
| **A11Y-10** | 2.3.3 Animation from Interactions | AAA | No `prefers-reduced-motion` handling exists. 37 elements animate concurrently (27 `animate-pulse`, 4 `animate-bounce`, 3 `animate-ping`, 2 `animate-spin`), plus three 60 fps canvas loops, plus a 0.5 s infinite screen shake during an outbreak. | 0 occurrences of `prefers-reduced-motion` |
| **A11Y-11** | 2.4.7 Focus Visible | AA | One control explicitly removes its focus ring: the location `<select>` uses `focus:outline-none` and replaces it with a border-colour change only, which is not a visible focus indicator for keyboard users. No `focus-visible` styles exist anywhere to compensate. | [`TriangulationMap.tsx:134`](../src/components/TriangulationMap.tsx) |
| **A11Y-12** | 2.5.8 Target Size (Minimum) | AA | Several controls are under 24 × 24 CSS px: the log severity filter chips (`text-[8px] px-2 py-0.5` ≈ 16 px tall), the AUTO/MANUAL mode toggles, and the header volume slider (4 px track, 14 px thumb). The radar node markers (`w-7 h-7` = 28 px) do pass. | [`AnomalyLog.tsx:233-247`](../src/components/AnomalyLog.tsx), [`App.tsx:400-431`](../src/App.tsx) |
| **A11Y-13** | 2.2.1 Timing Adjustable | A | Three interactions impose a time limit the user cannot extend: recording auto-stops at 10 s, demodulation runs an unpausable 2.5 s, and the outbreak resolves itself after 15 s. | [`EVPRecorder.tsx:110`](../src/components/EVPRecorder.tsx), [`App.tsx:174`](../src/App.tsx) |
| **A11Y-14** | — (UX) | UX | `select-none` on the root container blocks text selection across the whole application, so no readout can be copied or passed to a screen magnifier's text mode. | [`App.tsx:196`](../src/App.tsx) |
| **A11Y-15** | — (UX) | UX | **Sensory load of the outbreak event.** A full-viewport red border, pulsing overlay, 0.5 s screen shake, rotating phrases including "GET OUT", "HE IS BEHIND YOU", and "RUN", plus a 3.6 s synthesized scream at up to 0.12 gain — triggered by a single button with no warning and no way to soften it. | [`App.tsx:140-175`](../src/App.tsx), [`audio.ts:380-434`](../src/utils/audio.ts) |
| **A11Y-16** | — (design system) | UX | The four accent themes are hard-coded **Tailwind v3** hex values, but the CSS utilities now compile to **Tailwind v4** OKLCH tokens. The two no longer agree: theme "Ecto-Green" is `#10b981` inline while `bg-emerald-500` renders as `#00bc7d`. Two visibly different greens appear on the same panel. | §4.2 |

> [!NOTE]
> **On flashing (2.3.1 Three Flashes or Below Threshold).** This was checked specifically, because a
> strobing red overlay is the obvious photosensitivity risk. The fastest animation in the application
> is `animate-bounce`/`animate-ping` at a 1 s cycle and `animate-pulse` at a 2 s cycle; the screen
> shake is a transform, not a luminance flash. **No element flashes more than ~1 time per second, so
> the 3 Hz general-flash threshold is not exceeded** and 2.3.1 is likely satisfied. The real concern
> is A11Y-15 (vestibular and startle load) and A11Y-10 (no motion opt-out), not flash frequency.
> This is a static assessment — it should be confirmed with the
> [PEAT](https://www.essensys.com/) or Trace photosensitivity analyzer before any public deployment.

## 4. Contrast, measured

### 4.1 Method

Tailwind v4 defines its palette in OKLCH, not hex. The token values were extracted from the
**compiled production CSS** (`dist/assets/index-*.css`), converted OKLCH → OKLab → linear sRGB, and
run through the WCAG 2.x relative-luminance formula. Backgrounds were composited in gamma space to
model the actual layered surfaces: root `#000000`, panel `bg-zinc-950/80` → `#070709`, chip
`bg-zinc-900/40` over panel → `#0e0e10`.

### 4.2 Text contrast on the panel surface

| Foreground | On `#000` | On panel `#070709` | AA 4.5:1 | AAA 7:1 | Used for |
| --- | --- | --- | --- | --- | --- |
| `white` | 21.00 | 20.10 | ✓ | ✓ | primary readings |
| `slate-300` | 14.15 | 13.54 | ✓ | ✓ | body text |
| `slate-400` | 7.99 | 7.65 | ✓ | ✓ | secondary text |
| **`slate-500`** | 4.41 | **4.22** | **✗** | ✗ | section labels, units, bearings |
| **`slate-600`** | 2.78 | **2.66** | **✗** | ✗ | timestamps, hints, decorative labels |
| `emerald-500` | 8.36 | 8.00 | ✓ | ✓ | SAFE status |
| `amber-500` | 9.73 | 9.32 | ✓ | ✓ | ANOMALOUS status |
| `yellow-500` | 10.91 | 10.44 | ✓ | ✓ | MEDIUM severity |
| `red-500` | 5.50 | 5.26 | ✓ | ✗ | CRITICAL status |
| `red-400` | 7.31 | 7.00 | ✓ | ✓ | outbreak text |
| `sky-400` | 9.57 | 9.16 | ✓ | ✓ | thermal readings |
| `purple-500` | 5.19 | 4.97 | ✓ | ✗ | SPECTRAL OUTBREAK band |

The accent themes, as inline hex on black — all pass the 3:1 non-text threshold (1.4.11):

| Theme | Hex | On `#000` |
| --- | --- | --- |
| Ecto-Green | `#10b981` | 8.28 |
| Phantom-Blue | `#06b6d4` | 8.65 |
| Poltergeist-Red | `#ef4444` | 5.58 |
| Aether-Violet | `#a855f7` | 5.31 |

**Conclusion:** the palette is fine. The two failures are `slate-500` and `slate-600`, which between
them account for most of the small label text in the application. Both are one step away from
passing: `slate-500` → `slate-400` (7.65:1) and `slate-600` → `slate-500` on the root black (4.41:1)
or `slate-400` on the panel. A single find-and-replace closes A11Y-08.

> [!IMPORTANT]
> Note the theme/token drift in A11Y-16: `#10b981` (inline, Tailwind v3 emerald-500) vs `#00bc7d`
> (compiled, Tailwind v4 emerald-500) — a ΔE large enough to see side by side. The same drift
> applies to `red-500` (`#ef4444` → `#fb2c36`), `amber-500` (`#f59e0b` → `#fe9a00`), and
> `purple-500` (`#a855f7` → `#ad46ff`). Fix by deriving the theme list from the v4 tokens
> (`var(--color-emerald-500)`) instead of hard-coding hex — which also removes the 6-digit-hex
> constraint that the canvas alpha-composition convention currently imposes
> ([API §3.1](api.md#31-prop-semantics)).

## 5. Remediation plan

Sequenced by (impact ÷ effort). None of these require abandoning the aesthetic.

### Phase 1 — Names and semantics (A-level failures, ~1 day)

Closes A11Y-01, A11Y-02, A11Y-03, A11Y-05, A11Y-11.

1. `aria-label` on every icon-only control: mute, FREEZE/SWEEP, node markers, theme swatches.
2. Wrap each slider in a `<label>` or add `aria-labelledby` pointing at the existing caption span —
   the visual design does not change.
3. Convert the tab bar to `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls`, and
   the content region to `role="tabpanel"`. Arrow-key navigation comes with the pattern.
4. Add a visually-hidden `<h1>` to the console (`AETHER V9 — Operator Console`) and promote panel
   titles to `<h2>`. The existing `<span>` styling can stay via `className`.
5. Replace `focus:outline-none` on the location select with an explicit
   `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` using the accent
   colour, and adopt the same ring globally.

### Phase 2 — Contrast, targets, and selection (~half a day)

Closes A11Y-08, A11Y-09 (partially), A11Y-12, A11Y-14.

6. `slate-600` → `slate-500` on the root black; `slate-500` → `slate-400` on panels.
7. Raise the floor on type: 8 px → 10 px, 9 px → 11 px. This is the single most impactful change for
   low-vision users and the one most likely to require layout adjustment — do it panel by panel.
8. Give the filter chips and mode toggles a minimum 24 px hit area (`py-1.5` or a transparent
   pseudo-element expansion; the visual size can stay small).
9. Scope `select-none` to the decorative chrome instead of the root, so readouts can be selected.

### Phase 3 — Motion, timing, and announcements (~1–2 days)

Closes A11Y-06, A11Y-07, A11Y-10, A11Y-13, A11Y-15.

10. **Honour `prefers-reduced-motion`** — one media query in `index.css` disabling `animate-*` and
    the shake keyframe, plus a guard that stops the canvas loops from advancing phase:
    ```css
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
    ```
    The canvas loops need the same treatment in JS (`matchMedia` check → freeze the sweep and draw a
    static trace), because CSS cannot reach them.
11. **Add a global HOLD control** in the header that stops the simulation tick, the canvas loops, and
    the audio modulation — a single mechanism satisfying 2.2.2 for the whole application. It also
    gives every user a way to read a value without chasing it.
12. **Announce selectively.** `aria-live="polite"` on the anomaly log container and on the EVP decode
    result; `role="alert"` on the outbreak overlay. Explicitly **do not** put a live region on the EMF
    readout or the clock — at 3.3 Hz and 10 Hz they would make a screen reader unusable. Instead,
    announce threshold *crossings* ("EMF has exceeded 10 milligauss — anomalous activity") from the
    same place the log classifies severity.
13. **Add a content warning and an intensity setting.** A first-run notice that the application
    contains sudden loud audio, flashing overlays, screen shake, and jump-scare text, with an
    option to disable the outbreak event entirely or run it in a subdued variant (no shake, no
    scream, no "GET OUT"/"RUN" phrasing). This is the difference between a horror prop and something
    that can be shared in public.
14. Make the EVP timers user-extendable, or at minimum pausable.

### Phase 4 — Verify

15. Full keyboard pass: tab through the boot gate, all five tabs, every control, in both directions,
    with the focus ring visible at each stop.
16. Screen-reader pass (NVDA + Firefox, VoiceOver + Safari) covering the boot sequence, one spike,
    and one outbreak.
17. Automated checks in CI: `@axe-core/react` in dev, or a Playwright + `@axe-core/playwright` run
    asserting zero A/AA violations on the boot screen and the dashboard. Wire into the
    [CI workflow](../.github/workflows/ci.yml) once [Testing §5](testing.md#5-proposed-harness) lands.
18. Photosensitivity analysis (PEAT or Trace) on the outbreak event, since A11Y-15 is the highest-risk
    interaction in the product.

## 6. Conformance statement (draft)

Not publishable until Phases 1–3 land. The intended wording, so the target is explicit:

> AETHER V9 Pro partially conforms to WCAG 2.2 Level AA. Known exceptions: the outbreak event
> includes sudden loud audio, screen shake, and high-intensity visual overlays; a reduced-intensity
> mode is available in Diagnostics. Canvas waveform displays provide textual equivalents for
> threshold state but not for waveform shape.

Publishing that honestly, with the exceptions named, is worth more than claiming conformance this
codebase does not have.

---

**Next:** [Deployment](deployment.md).
