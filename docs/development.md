# Development Guide

| | |
| --- | --- |
| **Audience** | Contributors setting up, building, or debugging locally |
| **Status** | Every command and version below was executed and verified on Node 22.22.3 / npm 10.9.8 at commit `102e524` |
| **Companion** | [CONTRIBUTING](../CONTRIBUTING.md) (workflow) · [Testing](testing.md) · [Performance](performance.md) |

---

## 1. Environment

| Requirement | Version | Why |
| --- | --- | --- |
| **Node.js** | ≥ 20.19 (22 LTS recommended) | Vite 7 dropped Node 18; it requires 20.19+ or 22.12+ |
| **npm** | ≥ 10 | `package-lock.json` v3 is committed; `npm ci` is the supported install path |
| **Browser** | Any current Chrome / Firefox / Safari / Edge | Web Audio + Canvas 2D are the only platform requirements |

No native toolchain, no Docker, no database, no environment variables required. `npm ci && npm run dev`
is the entire setup.

## 2. Install and run

```bash
git clone https://github.com/zazieproductions/AETHER-V9-Pro.git
cd AETHER-V9-Pro
npm ci          # 203 packages, ~6 s on a warm cache
npm run dev     # Vite dev server, HMR, http://localhost:5173
```

Then press **INITIALIZE SYSTEM IGNITION** and wait out the ~4.7 s POST sequence. Headphones are the
intended condition — half the design is audio.

## 3. Scripts

| Command | What it actually runs | Verified result |
| --- | --- | --- |
| `npm run dev` | `vite` | dev server + HMR |
| `npm run build` | `tsc -b && vite build` | ✓ passes — type-checks via project references, then bundles. 1 752 modules, ~3.1 s |
| `npm run preview` | `vite preview` | serves `dist/` for production verification |
| `npm run typecheck` | `tsc -b --pretty false` | ✓ passes — the type gate in isolation, without bundling. This is the blocking CI gate |
| `npm run lint` | `eslint .` | ✗ **fails today — 45 errors**, see §5 |
| `npm run lint:fix` | `eslint . --fix` | **A measured no-op on today's baseline** — **45 errors before, 45 after, zero files modified**. None of the five rules involved ships a fixer (§5.1). Kept for rules that do |

> [!IMPORTANT]
> `npm run build` runs `tsc -b` **first**, so a type error fails the build before Vite is invoked.
> Types are a hard gate. Lint is not — `eslint .` is a separate script, and it is currently red.
> The asymmetry is the single most important thing to know about working in this repository; see §5.

## 4. Toolchain

Resolved versions from the committed lockfile (`npm ls --depth=0`):

| Layer | Package | Version | Notes |
| --- | --- | --- | --- |
| UI | `react` / `react-dom` | 19.2.7 | `StrictMode` enabled at the root |
| Build | `vite` | 7.3.6 | dev server, HMR, production bundler |
| Build | `@vitejs/plugin-react` | 5.1.1 | Babel-based Fast Refresh |
| Styling | `tailwindcss` + `@tailwindcss/vite` | 4.2.1 | **v4**: CSS-first config, no `tailwind.config.js` |
| Icons | `lucide-react` | 0.577.0 | the only UI dependency actually imported |
| Types | `typescript` | 5.9.3 | `strict: true` |
| Lint | `eslint` | 9.39.5 | flat config |
| Lint | `typescript-eslint` | 8.48.x | |
| Lint | `eslint-plugin-react-hooks` | **7.1.1** | the compiler-era ruleset — see §5.1 |
| Lint | `eslint-plugin-react-refresh` | 0.4.24 | HMR boundary hygiene |

Declared but **imported nowhere**: `framer-motion` 12.35.0 and `react-router-dom` 7.18.3. They do not
reach the bundle (nothing imports them, so tree-shaking never sees them) but they do inflate the
install and the dependency-audit surface. [TD-06](tech-debt.md).

### 4.1 Tailwind v4 specifics

There is no `tailwind.config.js`, and there should not be one. Tailwind 4 is configured entirely in
CSS: [`src/index.css`](../src/index.css) opens with `@import "tailwindcss"`, which pulls in the
engine, the preflight, and the theme. Custom work lives in the same file as plain CSS — two
`@keyframes`-free utility classes for scrollbars, one `shake` keyframe, and cross-browser range-input
styling.

Consequences worth knowing:

- **Theme values are CSS variables**, so `accentColor` could become `--color-accent` and drop out of
  the prop graph entirely. That is the clean fix for the drilling noted in
  [Architecture §8](architecture.md#8-architectural-tensions).
- **Arbitrary values are used heavily** (`text-[9px]`, `bg-[length:100%_4px,3px_100%]`,
  `shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]`). They compile to real CSS, but they bypass the type
  scale — which is why the accessibility findings in [Accessibility §3](accessibility.md#3-wcag-22-findings)
  are about hard-coded pixel sizes.
- **Source detection is automatic — and indiscriminate.** There is no `content` array: Tailwind scans
  every non-ignored text file in the project, **Markdown included**. Writing documentation therefore
  adds rules to the production stylesheet; `0.1.0` added 2.4 kB this way. Measured and attributed in
  [Performance §2.4](performance.md#24-the-stylesheet-grows-when-the-documentation-does), remediation in [TD-21](tech-debt.md#td-21).
- The panel treatment (`border-zinc-900 bg-zinc-950/80 rounded-lg shadow-[inset…]`) is repeated in
  all nine components as a literal class string. Extracting it into a `@utility panel` block would
  remove ~9 duplications.

## 5. Lint state — read this before your first PR

`eslint .` reports **45 errors across 12 files**. This is a real baseline, not a hypothetical one,
and it is documented in full in the [Tech-Debt Register](tech-debt.md#1-lint-baseline).

| Rule | Count | Nature |
| --- | --- | --- |
| `@typescript-eslint/no-unused-vars` | 32 | mechanical — unused icon imports, dead state, empty `catch (e)` bindings |
| `react-hooks/set-state-in-effect` | 6 | design — `setState` called synchronously in an effect body |
| `no-empty` | 3 | mechanical — empty `catch {}` blocks |
| `@typescript-eslint/no-explicit-any` | 2 | one `as any` on a tab id, one `webkitAudioContext` cast |
| `react-hooks/immutability` | 1 | design — a function used before its declaration inside an effect |
| `@typescript-eslint/ban-ts-comment` | 1 | mechanical — `@ts-ignore` in `vite.config.ts` |

Distribution by file: `App.tsx` 9 · `audio.ts` 7 · `AnomalyLog.tsx` 5 · `TriangulationMap.tsx` 5 ·
`EVPRecorder.tsx` 4 · `DeviceSpecs.tsx` 3 · `Diagnostics.tsx` 3 · `SystemBoot.tsx` 3 ·
`LiveEMFDisplay.tsx` 2 · `vite.config.ts` 2 · `EntityDatabase.tsx` 1 · `RadarGrid.tsx` 1.

### 5.1 Why the baseline exists

`eslint-plugin-react-hooks` **7.x** is a substantially stricter ruleset than the 5.x series most
React codebases still run. It ships rules derived from the React Compiler's requirements —
`set-state-in-effect`, `immutability`, and friends — which flag patterns that were idiomatic in
hand-written effect code. Adopting v7 without a remediation pass is what produced this baseline; the
plugin is correctly configured, and the findings are largely legitimate.

Of the 45, **35 are mechanical** (unused bindings, empty catches, the `@ts-ignore`) — mechanical for a
*human*, not for a tool. `npx eslint . --fix` was run against a copy of this tree and changed nothing:
**45 errors before, 45 after, zero files modified**. None of `no-unused-vars`, `no-empty`, `no-explicit-any`, or `ban-ts-comment` ships a fixer; they
emit *suggestions*, which `--fix` does not apply. Budget ten minutes of deletion and judgement, not a
flag. The remaining **7 are design
findings** that overlap almost exactly with the behavioural defects in the register — the same
impure updaters and effect-body state writes that cause [TD-02](tech-debt.md) and [TD-03](tech-debt.md).

### 5.2 Policy

1. **Do not add to the baseline.** A PR that introduces a new lint error does not merge.
2. **Fix what you touch.** If your diff edits a file with existing errors, clear that file.
3. **Mechanical fixes ship separately from behavioural ones.** The 35 mechanical errors are one PR;
   the 7 design findings are individual PRs, each with a test.
4. **CI runs lint in advisory mode until the baseline is zero**, then it becomes blocking. The
   reasoning and the switch-over criteria are in
   [ADR-0006](decisions/0006-ci-gating-and-the-lint-baseline.md).

### 5.3 A cheaper gate for 32 of them

[`tsconfig.node.json`](../tsconfig.node.json) enables `noUnusedLocals` and `noUnusedParameters`;
[`tsconfig.app.json`](../tsconfig.app.json) does not. Enabling both in the app config moves
detection of unused bindings from lint time to **type-check time**, i.e. into `npm run build`, which
is already blocking. That is strictly better than an advisory lint rule, and it costs two lines:

```jsonc
// tsconfig.app.json → compilerOptions
"noUnusedLocals": true,
"noUnusedParameters": true
```

Do this **after** clearing the mechanical baseline, or `npm run build` goes red immediately.

## 6. TypeScript configuration

Three files, wired as project references:

```
tsconfig.json  (solution: files: [], references → app, node)
   ├── tsconfig.app.json    → src/**     DOM-facing, ES2022
   └── tsconfig.node.json   → vite.config.ts   Node-facing, ES2023, stricter
```

`tsc -b` builds both in dependency order. Splitting them is what allows the app to target the DOM
lib while the build config targets Node — the standard Vite arrangement, and worth keeping.

| Option | App | Node | Rationale |
| --- | --- | --- | --- |
| `target` | ES2022 | ES2023 | matches the browser floor and the Node floor respectively |
| `lib` | ES2022, DOM, DOM.Iterable | ES2023 | the app needs DOM types; the config needs Node types |
| `moduleResolution` | `bundler` | `bundler` | Vite resolves; extensionless imports allowed |
| `strict` | ✓ | ✓ | non-negotiable |
| `noEmit` | ✓ | ✓ | Vite emits; `tsc` only checks |
| `jsx` | `react-jsx` | — | automatic runtime; no `import React` needed (but see below) |
| `noFallthroughCasesInSwitch` | ✓ | ✓ | the severity/danger switches in `AnomalyLog` and `EntityDatabase` rely on it |
| `useDefineForClassFields` | ✓ | — | `AudioController` is the only class; semantics match the ES standard |
| `verbatimModuleSyntax` | — | ✓ | app config is more permissive here |
| `noUnusedLocals` / `noUnusedParameters` | **—** | ✓ | see §5.3 |
| `types` | `vite/client`, `node` | `node` | `node` is present **only** for `NodeJS.Timeout` |

### 6.1 The `NodeJS.Timeout` smell

Browser code in `App.tsx`, `audio.ts`, and `EVPRecorder.tsx` types its timer handles as
`NodeJS.Timeout`. That is why `@types/node` is a dev dependency and `"node"` is in the app config's
`types` array — a Node namespace reaching into a DOM-only bundle. The correct DOM type is
`ReturnType<typeof setInterval>`, which resolves to `number` in a DOM lib and keeps `@types/node` out
of the app project entirely. Low risk, small diff, and it removes a config-level dependency.

### 6.2 `import React` under the automatic runtime

`jsx: "react-jsx"` means React does not need importing for JSX. Every component nonetheless opens
with `import React, { … } from 'react'` — used in `EntityDatabase` for the `React.ReactNode` type and
in every file for `React.FC`. `SystemBoot.tsx` imports `useEffect` and never uses it (one of the 45).
Harmless, but if you prefer `Props`-typed function declarations over `React.FC`, the default imports
can go.

## 7. Debugging notes

Things that cost the next person an hour, written down.

### 7.1 HMR duplicates the audio graph

`audioService` is a module-level singleton with no teardown
([ADR-0003](decisions/0003-audio-as-a-module-singleton.md)). When Vite hot-replaces
`utils/audio.ts`, the new module creates a **second** `AudioController` while the first one's
`AudioContext`, hum oscillator, looping noise buffer, and Geiger timeout chain are still running.
Symptom: the hum doubles in level and Geiger clicks arrive at twice the rate, getting worse with
each edit.

**Workaround: full page reload after editing `audio.ts`.** A real fix is a `dispose()` plus an
`import.meta.hot?.dispose()` hook in dev — [TD-12](tech-debt.md).

### 7.2 `<StrictMode>` changes behaviour here

[`src/main.tsx`](../src/main.tsx) wraps the app in `StrictMode`, which in development double-invokes
render functions, effect setups, and **state updater functions**. Three places in this codebase have
impure updaters, so dev and prod genuinely differ:

| Location | Impurity | Dev-only symptom |
| --- | --- | --- |
| [`App.tsx:130`](../src/App.tsx) | `audioService.setEMFLevel()` called inside the `setEmfLevel` updater | audio parameters written twice per tick; the random stream consumed at 2× rate |
| [`TriangulationMap.tsx:111`](../src/components/TriangulationMap.tsx) | `setSelectedNode()` called inside the `setNodes` updater | double state write (masked today by [TD-02](tech-debt.md), which stops the loop running at all) |
| [`EVPRecorder.tsx:110-113`](../src/components/EVPRecorder.tsx) | `handleStopRecording()` called inside the timer updater | the stop handler may run twice |

When a trace or a timing behaves differently in dev than in a production build, look here first.

### 7.3 Freezing the simulation

To inspect any visual state without the engine fighting you: switch to **MANUAL** mode and set
sensitivity to 1. Noise becomes ±0.015 mG, so the reading is effectively pinned to the slider value
— which makes threshold behaviour (severity colours at 2.5 / 10 mG, the alarm at 15 mG, radar spawns
above 12 mG, log classification above 5 mG) testable by dragging one control.

### 7.4 Inspecting the audio graph

There is no debug hook today. The cheapest one, dev-only:

```ts
// src/main.tsx — guarded so it never reaches a production bundle
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__aether = { audioService };
}
```

That exposes `currentEMF`, `volume`, `isMuted`, and the live node references, and lets you drive
`audioService.setEMFLevel(43)` from the console to hear the outbreak mapping without waiting for an
outbreak. Chrome DevTools → three-dot menu → **More tools → Audio context** also shows the live graph.

### 7.5 Canvas debugging

Each canvas has a fixed backing store (280×110, 300×300, 320×120) scaled by CSS to `w-full h-full`.
The backing store is **not** DPI-aware, so on a 2× display the traces are visibly soft. That is a
known fidelity limit, not a bug — the fix (size the store from `devicePixelRatio` and scale the
context) is [Roadmap X7](roadmap.md#7-exploration). To inspect a single frame, set a breakpoint inside the render
callback and check "Pause on `requestAnimationFrame`" in the Chrome Sources panel.

### 7.6 Reproducing the two visible defects

| Defect | Steps |
| --- | --- |
| Triangulation readings frozen ([TD-02](tech-debt.md)) | Boot → **Triangulation Node** tab → watch a node's MAGNETIC LOAD next to the header EMF reading. The header moves every 300 ms; the node never does. |
| Radar reconciles per frame ([TD-01](tech-debt.md)) | Boot → Dashboard → React DevTools Profiler → record 5 s → the `RadarGrid` subtree commits ~60×/s while the sweep animates. |

## 8. Environment variables

[`vite.config.ts`](../vite.config.ts) sets `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` and additionally
re-exposes every loaded variable as a `process.env.*` define. **No module in `src/` reads any
environment variable** (verified: zero occurrences of `import.meta.env` and `process.env`).

So the configuration is inert plumbing today. Two notes if you use it:

- `NEXT_PUBLIC_` is a Next.js convention with no meaning in Vite; it is carried here for
  compatibility with tooling that expects it.
- Anything exposed this way is **inlined into the public bundle**. Never put a secret in a `VITE_`
  variable. See [SECURITY.md](../SECURITY.md).

## 9. The `.vite-source-tags.js` plugin

[`vite.config.ts`](../vite.config.ts) dynamically imports an optional local plugin and pushes it into
the plugin list inside a `try/catch`:

```ts
try {
  const m = await import('./.vite-source-tags.js');
  plugins.push(m.sourceTags());
} catch {}
```

The plugin uses Babel (already a transitive dependency of `@vitejs/plugin-react`) to add
`data-source-loc="path:line:col"` to every JSX element, so an external element-picker can map a
rendered DOM node back to source. It is a **development-environment affordance**, and it is safe to
be absent — hence the `try/catch` and hence the file being listed in `.gitignore`.

> [!WARNING]
> Three things are wrong with how this is currently wired:
> 1. **It is active in production builds.** Its own header comment says so, and the shipped bundle
>    contains **554** `data-source-loc` attributes carrying source paths and line numbers
>    (`src/components/SystemBoot.tsx:61:4`). That is DOM weight and source-structure disclosure in a
>    deployed artifact. See [Deployment §6](deployment.md#6-strip-preview-instrumentation-before-deploying).
> 2. **The file is committed *and* gitignored.** `.gitignore` lists `.vite-source-tags.js`, but the
>    file is tracked, so the ignore rule has no effect. Either untrack it (`git rm --cached`) or
>    remove the ignore line — the current state is contradictory. [TD-16](tech-debt.md)
> 3. **The `catch {}` is silent** — an ESLint `no-empty` error, and it hides genuine plugin failures
>    behind an intentional one. Log at debug level in dev.

## 10. Repository layout

```
AETHER-V9-Pro/
├── index.html                  # entry document — ⚠ contains injected preview tooling (TD-15)
├── package.json                # scripts, deps, metadata
├── vite.config.ts              # React + Tailwind + optional source-tags plugin, env passthrough
├── tsconfig.json               # solution file → project references
├── tsconfig.app.json           # src/** — strict, ES2022, DOM
├── tsconfig.node.json          # vite.config.ts — strict + unused checks, ES2023
├── eslint.config.js            # flat config: js + ts-eslint + react-hooks v7 + react-refresh
├── .editorconfig               # whitespace and encoding rules, shared across editors
├── .vite-source-tags.js        # optional dev plugin — tracked AND ignored (TD-16)
├── src/
│   ├── main.tsx                # createRoot + StrictMode          10 lines
│   ├── App.tsx                 # engine, shell, tab router        522 lines
│   ├── index.css               # Tailwind v4 entry + custom CSS    79 lines
│   ├── App.css                 # empty, imported nowhere — delete (TD-06)
│   ├── components/             # 9 modules                       2 309 lines
│   └── utils/audio.ts          # AudioController singleton        461 lines
├── README.md                   # entry point — what it is, how to run it, where the depth is
├── CONTRIBUTING.md             # ground rules, workflow, conventions, definition of done
├── CODE_OF_CONDUCT.md          # Contributor Covenant 2.1, plus a note on this project's content
├── SECURITY.md                 # reporting path, verified zero-egress properties, known issues
├── CHANGELOG.md                # Keep a Changelog format — 0.1.0 is the documentation release
├── LICENSE                     # MIT
├── docs/                       # this documentation set — index + 12 guides
│   └── decisions/              # architecture decision records, ADR-0001 … ADR-0006
└── .github/                    # CI and deploy workflows, issue and PR templates, dependabot
```

Total: **3 381 lines of source** — 2 841 TSX, 461 TS, 79 CSS.

---

**Next:** [Testing](testing.md) — what is covered, what is not, and the shortest path to a real suite.
