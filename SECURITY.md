# Security Policy

| | |
| --- | --- |
| **Scope** | A client-side static web application. No backend, no accounts, no user data, no server-side execution. |
| **Last reviewed** | 2026-10-09, at commit `102e524` |
| **Related** | [Deployment](docs/deployment.md) · [Tech-Debt Register](docs/tech-debt.md) · [Accessibility](docs/accessibility.md) |

This policy is short because the attack surface is short — and because the claims in it were verified
rather than assumed. Where this repository does have a security-relevant problem, it is named below
with a severity and a fix, not omitted.

---

## 1. Reporting a vulnerability

**Please do not open a public issue for a security report.**

Contact the maintainer privately through GitHub — via the "Report a vulnerability" option on the
repository's *Security → Advisories* tab, or a direct message to
[`@zazieproductions`](https://github.com/zazieproductions). A dedicated security email address will be
published here once one exists; until then GitHub's private advisory channel is the intended route.

You can expect:

| | |
| --- | --- |
| Acknowledgement | within 7 days |
| Initial assessment | within 14 days |
| Credit | in the [CHANGELOG](CHANGELOG.md) and the advisory, unless you ask not to be named |

Coordinated disclosure is appreciated and will not be met with legal posturing. This is an MIT-licensed
portfolio project.

## 2. Supported versions

| Version | Supported | Notes |
| --- | --- | --- |
| `0.1.x` | ✓ | Current. Documentation and repository infrastructure |
| `0.0.x` | ✗ | Pre-documentation snapshot; no security fixes will be back-ported separately |

There are no releases tagged yet — see [CHANGELOG](CHANGELOG.md) for the version history and
[Roadmap Phase 0](docs/roadmap.md#2-phase-0--publishable) for what must land before the first
published deployment.

## 3. Verified security properties

Every row below was checked against the source at the commit named above. Reproduce with the commands
in §6.

| Property | Status |
| --- | --- |
| Network egress from application code | **None.** Zero occurrences of `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, or `importScripts` in `src/` |
| External URLs referenced in `src/` | **None** |
| Persistent storage | **None.** Zero occurrences of `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, or the Cache API |
| Device permissions requested | **None.** No `getUserMedia`, no `MediaRecorder`, no `geolocation`, no `DeviceMotion`/`DeviceOrientation`, no Notification or Clipboard API. The component named "EVP Recorder" records nothing — see [Components §8](docs/components.md#8-evprecorder) |
| Worker / service worker | None |
| Dangerous sinks | **None.** Zero occurrences of `dangerouslySetInnerHTML`, `eval`, `new Function`, `innerHTML`, `document.write`, or `javascript:` URLs |
| Dynamic `href` / `src` attributes | **None** — no attribute is populated from a variable, so there is no URL-injection sink |
| User-supplied text rendered into the DOM | **None.** The application has no free-text input at all; every input is a range slider or a `<select>` over a fixed literal list, and every displayed string comes from a hard-coded pool |
| Authentication / authorization surface | None — there are no accounts and no privileged operations |
| Secrets in the bundle | None. No environment variable is read by any module in `src/` ([Development §8](docs/development.md#8-environment-variables)) |
| Runtime third-party requests | **None, once [§4.1](#41-critical--injected-preview-instrumentation) is remediated** |
| Post-install scripts in the dependency tree | 2 of 203 packages — `esbuild` and `fsevents`, both standard Vite toolchain |

The practical consequence: **the deployed application makes no requests after loading its own three
files, collects nothing, and can be served from an air-gapped host.** There is no user data to breach,
no session to hijack, and no injection sink to exploit.

> [!NOTE]
> The absence of an XSS surface is a property of the current design — no free-text input, no dynamic
> attributes, no HTML sinks. It is **not** a reason to skip escaping if that ever changes. Adding a
> text input (a log comment field, an operator name, a scenario editor) introduces one; review
> [Roadmap E3](docs/roadmap.md#6-phase-4--capable) with that in mind.

## 4. Known security-relevant issues

### 4.1 CRITICAL — injected preview instrumentation

| | |
| --- | --- |
| **ID** | [TD-15](docs/tech-debt.md#td-15) |
| **Location** | [`index.html`](index.html) — three `<script>` blocks |
| **Severity** | Critical for any deployment; none for local development |

The committed entry document contains tooling injected by the environment the project was generated
in:

| Script | Behaviour |
| --- | --- |
| `data-arena-recording` | Loads `rrweb` from a public CDN, records DOM mutations, **clicks, scroll depth, cursor path, and keystrokes** into `sessionStorage`, and posts the payload to `window.parent` |
| `data-arena-views` | `fetch()`es a page-view beacon to an external analytics endpoint, including a generated viewer id persisted in `localStorage` and the referrer domain |
| `data-element-picker` | Injects a DOM inspection overlay and reports the source location of clicked elements to the parent frame |

If deployed as-is, this means **keystroke and cursor telemetry about your visitors, sent to a
third party, from your domain, with no disclosure and no consent mechanism.** It also contradicts
every property in §3 — because the violation lives in the HTML document, not in `src/`, which is
exactly why the static analysis in §3 is scoped to `src/` and why this entry exists.

Measured cost: 13 202 of the 13 696 bytes in the built `dist/index.html`
([Performance §2.2](docs/performance.md#22-the-html-artifact-is-96--not-application)).

**Fix:** delete all three blocks. A clean 12-line replacement document, including the `description`
and `theme-color` meta tags the page should have anyway, is in
[Deployment §6.1](docs/deployment.md#61-injected-scripts-in-indexhtml). This is the first item in
[Roadmap Phase 0](docs/roadmap.md#2-phase-0--publishable).

### 4.2 MEDIUM — source-structure disclosure in the production bundle

| | |
| --- | --- |
| **ID** | [TD-16](docs/tech-debt.md#td-16) |
| **Location** | [`.vite-source-tags.js`](.vite-source-tags.js), loaded from [`vite.config.ts`](vite.config.ts) |

The optional Vite plugin injects `data-source-loc="src/components/SystemBoot.tsx:61:4"` into every
JSX element, and it runs in production builds: **554** such attributes are present in the shipped
JavaScript. This discloses the repository's file layout and line numbers to anyone viewing source, and
adds DOM weight to every node.

Not remotely exploitable, and the information is largely public anyway (the repository is open
source). It is nonetheless build-tooling metadata that does not belong in a deployed artifact.

**Fix:** gate the plugin to `mode === 'development'` —
patch in [Deployment §6.2](docs/deployment.md#62-the-source-tags-vite-plugin). The same file is both
committed and listed in `.gitignore`, which should be resolved at the same time.

### 4.3 LOW — environment variables are inlined into the public bundle

[`vite.config.ts`](vite.config.ts) sets `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` and additionally
defines `process.env.<KEY>` for every loaded variable. Nothing in `src/` reads them today, so there
is nothing exposed. **If that changes: any variable matching those prefixes is embedded in the
JavaScript served to every visitor.** There is no server to hold a secret. Never place a token, key,
or credential in a `VITE_` variable — see [Deployment §7](docs/deployment.md#7-environment-and-secrets).

### 4.4 LOW — no integrity metadata on the CDN dependency

Consequence of §4.1: the injected recorder loads `rrweb` from a public CDN with no
Subresource Integrity attribute. Removing the script removes the issue; it is recorded because it is
the kind of thing a supply-chain review should catch. After remediation the application loads **no**
third-party resources, so SRI is not applicable anywhere.

## 5. Supply chain

| Control | Status |
| --- | --- |
| Lockfile | `package-lock.json` committed; `npm ci` is the documented install path |
| Automated updates | [`.github/dependabot.yml`](.github/dependabot.yml) — weekly, npm and GitHub Actions, grouped minor/patch |
| CI | Type-check and build gate every PR ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) |
| Audit | Advisory step in [`ci.yml`](.github/workflows/ci.yml) — `npm audit --omit=dev` reported into the job summary. Current state measured in [§5.1](#51-advisory-state-at-010-measured) |
| Runtime dependencies | 4 actually imported (`react`, `react-dom`, `lucide-react`, `tailwindcss`); 2 declared but unused and scheduled for removal ([TD-06](docs/tech-debt.md#td-06)) |
| Native / install-script packages | `esbuild`, `fsevents` — both Vite toolchain, both dev-only |

Dependency additions require a reason in the PR description. The project's default posture is
zero-dependency: the entire audio engine is ~460 lines of raw Web Audio, and the icon set is the only
UI library.

### 5.1 Advisory state at `0.1.0` (measured)

`npm audit` against the committed lockfile reports **4 high-severity advisories, 0 critical, 0
moderate, 0 low** — every one of them in a *transitive* dependency, and every one with a published
fix:

| Package | Advisory class | Reaches the tree via | In `dist/assets/*.js`? |
| --- | --- | --- | --- |
| `brace-expansion` 1.1.16 | DoS — unbounded expansion length → OOM crash | `eslint → minimatch`; `typescript-eslint → typescript-estree` | **No** (0 hits) |
| `browserslist` 4.28.6 | DoS — unbounded cache growth → OOM | `@vitejs/plugin-react → @babel/core` | **No** (0 hits) |
| `js-yaml` 4.3.0 | Quadratic CPU in `!!omap` resolution | `eslint → @eslint/eslintrc` | **No** (0 hits) |
| `source-map-js` 1.2.1 | Event-loop DoS via indexed section offsets | `@tailwindcss/vite → @tailwindcss/node`; `vite → postcss` | **No** (0 hits) |

All four are **build-machine exposures, not visitor exposures**. None is imported by `src/`, none
appears in the shipped bundle, and the application makes no network request at runtime ([§3](#3-verified-security-properties)).
The realistic harm is a pathological input crashing a CI runner or a developer's build — not anything
reaching a browser.

Two things are stated plainly rather than rounded off:

1. **`npm audit --omit=dev` still reports 1 high** (`source-map-js`), because `tailwindcss` and
   `@tailwindcss/vite` are declared in `dependencies` rather than `devDependencies`. For a private,
   never-published package the placement is cosmetic — but it makes the production-tree audit signal
   misleading, since Tailwind is a build-time CSS compiler that ships no JavaScript. Moving both is a
   two-line change and would make `--omit=dev` mean what it says.
2. **GitHub reported 5 open Dependabot alerts** on the default branch (3 high, 2 moderate) when this
   branch was pushed. The credentials available to this documentation pass cannot enumerate them —
   `GET /repos/{owner}/{repo}/dependabot/alerts` returns `403` — so the two counts are *not*
   reconciled here, and this section should not be read as a complete alert list. The Dependabot
   configuration added in `0.1.0` will open PRs for them.

**Remediation:** `npm audit fix` resolves all four; re-verify with `npm run build` and the commands in
[§6](#6-reproducing-the-3-claims). Tracked as [TD-22](docs/tech-debt.md#td-22) and scheduled as
[Roadmap D22](docs/roadmap.md#2-phase-0--publishable).

## 6. Reproducing the §3 claims

```bash
# no network egress, no storage, no permissions, no dangerous sinks in application code
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|importScripts" src/
grep -rnE "localStorage|sessionStorage|indexedDB|document\.cookie|caches\." src/
grep -rnE "getUserMedia|MediaRecorder|geolocation|DeviceMotion|Notification\." src/
grep -rnE "dangerouslySetInnerHTML|eval\(|new Function|innerHTML|document\.write" src/
grep -rnoE "https?://[^\"' )]*" src/

# the two known issues, in the built artifact
npm run build
grep -c 'data-arena\|data-element-picker' dist/index.html   # currently 2 → must become 0
grep -o 'data-source-loc' dist/assets/*.js | wc -l          # currently 554 → must become 0

# install-script packages
node -e "const l=require('./package-lock.json');console.log(Object.entries(l.packages).filter(([,v])=>v.hasInstallScript).map(([k])=>k))"
```

## 7. User safety (non-technical)

Security policies usually stop at the technical surface. This application has one non-technical risk
worth stating in the same document, because it can cause real harm:

**The outbreak event is a designed jump scare.** It combines a full-viewport red flash, a 0.5 s
screen shake, a 3.6 s synthesized scream at up to 0.12 gain, and rotating phrases including
"GET OUT", "HE IS BEHIND YOU", and "RUN" — triggered by one button, with no warning and no way to
soften it.

| Risk | Mitigation status |
| --- | --- |
| Photosensitivity | Assessed: no element flashes faster than ~1 Hz, so the WCAG 3 Hz threshold is not exceeded. **Static analysis only** — confirm with PEAT or the Trace analyzer before public deployment ([Accessibility §3](docs/accessibility.md#3-wcag-22-findings)) |
| Vestibular / motion sensitivity | **Unmitigated.** No `prefers-reduced-motion` handling exists. [A11Y-10](docs/accessibility.md#3-wcag-22-findings), [Roadmap A3](docs/roadmap.md#5-phase-3--accessible) |
| Startle / anxiety, and harm to viewers with trauma histories | **Unmitigated.** No content warning, no intensity setting. [A11Y-15](docs/accessibility.md#3-wcag-22-findings), [Roadmap A5](docs/roadmap.md#5-phase-3--accessible) |
| Hearing | Partially mitigated: a mute control and a volume slider exist, audio never starts before a user gesture, and the boot screen carries an explicit audio warning |

If you deploy this publicly, add the content warning and the reduced-intensity mode first. They are
[Roadmap Phase 3](docs/roadmap.md#5-phase-3--accessible) items, and they are the difference between a
horror prop and something that can be shared responsibly.

## 8. Disclaimer

AETHER V9 Pro is interactive fiction. It detects nothing, measures nothing, and makes no claim about
the paranormal. It requests no permissions and cannot observe its environment. Any resemblance to
actual field equipment is deliberate at the level of part numbers and entirely fictional at the level
of capability — see [Components §11](docs/components.md#11-devicespecs).
