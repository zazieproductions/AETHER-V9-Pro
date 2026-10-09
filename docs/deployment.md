# Deployment

| | |
| --- | --- |
| **Audience** | Anyone publishing this application |
| **Status** | Verified against the production build at commit `102e524` (Vite 7.3.6) |
| **Companion** | [Performance §2](performance.md#2-measured-bundle) (what gets shipped) · [Testing §6](testing.md#6-manual-test-matrix) (how to verify it) |

The build output is a **static bundle with no server-side component, no API, no database, and no
runtime environment variables**. Any host that serves files can run it. The interesting parts are
the two things that must be stripped first, and the caching headers that make the immutable assets
cheap.

---

## 1. Build

```bash
npm ci
npm run build      # tsc -b  →  vite build
npm run preview    # serve dist/ locally to verify the production artifact
```

Output (measured):

```
dist/
├── index.html                     13.70 kB │ gzip:  4.70 kB   ⚠ see §6
└── assets/
    ├── index-CtyZQl8u.css         44.21 kB │ gzip:  8.13 kB
    └── index-B26N0IDF.js         316.09 kB │ gzip: 86.77 kB
```

Asset filenames are content-hashed, so every build produces cache-busting URLs automatically. Total
transfer ≈ **99.6 kB gzipped**, with zero media. Note that the CSS figure includes ≈ 2.4 kB of rules
compiled from documentation prose, because Tailwind v4 scans every text file in the project —
measured in [Performance §2.4](performance.md#24-the-stylesheet-grows-when-the-documentation-does), fixed by
[Roadmap D21](roadmap.md#2-phase-0--publishable). `npm run build` fails on any type error before Vite
runs, so a green build means a type-checked bundle.

`vite preview` binds to `localhost` by default. To verify on a phone over the local network:

```bash
npm run preview -- --host 0.0.0.0
```

## 2. Base path

[`vite.config.ts`](../vite.config.ts) sets no `base`, so the default is `/` — correct for a domain
root (`https://aether.example.com/`) and **broken for a sub-path** (`https://user.github.io/AETHER-V9-Pro/`),
where the absolute `/assets/…` URLs resolve to the wrong directory and the page loads blank.

Two ways to fix it, pick one:

```bash
# per-build, no config change
vite build --base=/AETHER-V9-Pro/
```

```ts
// or in vite.config.ts — derived so it never drifts from the repo name
export default defineConfig(async ({ mode }) => ({
  base: mode === 'production' ? '/AETHER-V9-Pro/' : '/',
  // …
}))
```

## 3. Host recipes

### 3.1 GitHub Pages

A ready-to-use workflow is committed at
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). It is triggered manually
(`workflow_dispatch`) so it cannot run — or fail — before the base path in §2 is set. To enable:

1. Set `base` to `/<repository-name>/`.
2. Repository → Settings → Pages → Source: **GitHub Actions**.
3. Actions → *Deploy to GitHub Pages* → Run workflow.

### 3.2 Vercel

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |
| Node version | 22 (`NODE_VERSION=22` env var, or `.nvmrc`) |
| Rewrite rules | none required — no client routing |

### 3.3 Netlify

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

# No SPA fallback needed: the app has a single document and no router.
[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"

[[headers]]
  for = "/index.html"
  [headers.values]
    Cache-Control = "no-cache"
```

### 3.4 S3 + CloudFront (or any object store)

```bash
aws s3 sync dist/ s3://<bucket> --delete
aws s3 cp s3://<bucket>/index.html s3://<bucket>/index.html \
  --metadata-directive REPLACE --cache-control "no-cache" \
  --content-type "text/html; charset=utf-8"
```

Set `Cache-Control: public, max-age=31536000, immutable` on `assets/*` and `no-cache` on
`index.html`; invalidate `/index.html` only. Because asset URLs are content-hashed, a deploy is
atomic from the client's perspective: the old HTML keeps pointing at the old assets until the new
HTML arrives.

### 3.5 nginx

```nginx
server {
  listen 443 ssl http2;
  root /var/www/aether;
  index index.html;

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
  }

  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  # No try_files fallback required — single document, no client-side router.
}
```

## 4. Caching strategy

| Resource | Header | Why |
| --- | --- | --- |
| `index.html` | `no-cache` | The only mutable URL; must revalidate so deploys are visible immediately |
| `assets/index-<hash>.js` | `public, max-age=31536000, immutable` | Content-hashed; a new build means a new URL |
| `assets/index-<hash>.css` | `public, max-age=31536000, immutable` | Same |
| Everything else | — | There is nothing else: no images, audio, fonts, or favicon (§5) |

Repeat visitors fetch one small HTML document and nothing else until a deploy.

## 5. Missing favicon

[`index.html`](../index.html) declares `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />`
but there is no `public/` directory and no such file, so **every page load issues a request that
404s**. Verified: `find dist -name '*favicon*'` returns nothing while the built HTML still references
it.

Fix — create `public/favicon.svg` (Vite copies `public/` verbatim to `dist/`):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#000"/>
  <path d="M16 5 L28 27 H4 Z" fill="#10b981"/>
</svg>
```

That is the ▲ mark the UI already uses, at 118 bytes. It is the one asset the
[zero-asset rule](decisions/0004-zero-runtime-assets.md) should exempt — a favicon is browser
chrome, not application content. Tracked as [TD-18](tech-debt.md).

## 6. Strip preview instrumentation before deploying

> [!CAUTION]
> **This is mandatory, not optional.** Two artifacts of the environment this project was generated in
> are committed to the repository, they ship to production, and they make third-party network
> requests on behalf of your visitors.

### 6.1 Injected scripts in `index.html`

Measured composition of the built document:

| Content | Bytes | Share |
| --- | --- | --- |
| Session recorder (`data-arena-recording`) — loads `rrweb` from a public CDN, stores events in `sessionStorage`, posts to `window.parent` | 6 303 | 46.0 % |
| Element picker (`data-element-picker`) | 6 899 | 50.4 % |
| Page-view beacon (`data-arena-views`) — `fetch()` to an external analytics endpoint | (in the above) | — |
| **Actual application shell** | **494** | **3.6 %** |

Consequences of shipping it: a third-party CDN request on load, telemetry about your visitors, a
`sessionStorage` payload that grows to hundreds of kilobytes, and 13 kB of HTML — all for tooling
that only functions inside the originating preview iframe.

**Fix:** delete every `<script data-arena-*>` and `<script data-element-picker>` block from
[`index.html`](../index.html). The application shell that must remain is:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="AETHER V9 Pro — a cinematic, fully client-side paranormal EMF instrument simulation." />
    <meta name="theme-color" content="#000000" />
    <title>AETHER V9 Pro // Paranormal EMF Tracker</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 6.2 The source-tags Vite plugin

[`vite.config.ts`](../vite.config.ts) conditionally loads `.vite-source-tags.js`, which injects
`data-source-loc="src/components/SystemBoot.tsx:61:4"` into **every JSX element** — and it runs in
production builds. The shipped bundle contains **554** such attributes (verified by counting
occurrences in `dist/assets/*.js`), disclosing the repository's file layout and line numbers to
anyone who views source, plus per-node DOM weight.

**Fix:** gate it to development.

```ts
const plugins = [react(), tailwindcss()];
if (mode === 'development') {
  try {
    const m = await import('./.vite-source-tags.js');
    plugins.push(m.sourceTags());
  } catch (err) {
    console.debug('[vite] source-tags plugin unavailable:', err);
  }
}
```

Also resolve the contradictory tracking state: `.vite-source-tags.js` is committed **and** listed in
[`.gitignore`](../.gitignore), so the ignore rule is inert. Either `git rm --cached
.vite-source-tags.js` (keep it local-only) or delete the ignore line (keep it in the repo). Doing
both is what happened. [TD-16](tech-debt.md)

### 6.3 Post-strip verification

```bash
npm run build
grep -c 'data-arena\|data-element-picker' dist/index.html   # must be 0
grep -c 'data-source-loc' dist/assets/*.js                  # must be 0
wc -c dist/index.html                                       # expect < 1 kB
```

## 7. Environment and secrets

`vite.config.ts` sets `envPrefix: ['VITE_', 'NEXT_PUBLIC_']` and additionally defines
`process.env.<KEY>` for every loaded variable. **No module in `src/` reads any environment
variable** (verified: zero occurrences of `import.meta.env` or `process.env`), so deployment
requires no environment configuration at all.

If you add one: anything exposed through `envPrefix` is **inlined into the public JavaScript bundle
at build time**. There is no server to hold a secret. Never place credentials, tokens, or keys in a
`VITE_` variable. See [SECURITY.md](../SECURITY.md).

## 8. Runtime requirements

| Requirement | Detail |
| --- | --- |
| **HTTPS** | Strongly recommended. Web Audio works over HTTP, but browsers apply stricter autoplay and storage policies on insecure origins, and every host listed above requires HTTPS anyway. |
| **JavaScript** | Required; there is no server-rendered or static fallback. The `<div id="root">` is empty until the bundle executes. |
| **Browser APIs** | `AudioContext` (or `webkitAudioContext`), Canvas 2D, `requestAnimationFrame`, ES2022. No WebGL, no Service Worker, no WebAssembly. |
| **Network** | None at runtime, once §6 is done. The deployed application makes zero requests after its own assets. It works offline, from `file://` in most browsers, or from a USB stick. |
| **Storage** | None. No cookies, no `localStorage`, no `IndexedDB` — nothing to declare in a privacy policy, and no consent banner required. |

That last property is worth preserving: it is why the privacy statement in
[SECURITY.md](../SECURITY.md) can be one sentence long.

## 9. Verification checklist

Run before announcing a deployment. Full manual matrix in [Testing §6](testing.md#6-manual-test-matrix).

**Network**
- [ ] No 404s in the console (favicon included — §5)
- [ ] No requests to any origin other than your own (§6.3)
- [ ] Total transferred ≈ 99 kB gzipped on a cold load
- [ ] `assets/*` served with `immutable`; `index.html` with `no-cache`

**Function**
- [ ] Boot gate completes and audio starts on the power-button click
- [ ] EMF trace runs for 60 s without a console error
- [ ] An outbreak triggers, runs 15 s, and resolves cleanly
- [ ] All five tabs render; each canvas animates
- [ ] Mute and volume affect every voice

**Environment**
- [ ] iOS Safari: audio audible (a `suspended` context never resumes — [TD-12](tech-debt.md); verify
      explicitly, this is the most likely production failure)
- [ ] 375 px and 320 px viewports: no horizontal page scroll, tabs scroll internally
- [ ] `prefers-reduced-motion: reduce`: currently changes nothing — expected, see
      [Accessibility §5](accessibility.md#5-remediation-plan)

## 10. Rollback

Every host above retains previous builds. Because assets are content-hashed and `index.html` is
`no-cache`, rolling back is "repoint `index.html` at the previous build" — no cache invalidation
needed beyond the document itself. For GitHub Pages, re-run the deploy workflow on the previous
commit; for S3, re-sync the prior `dist/` and invalidate `/index.html`.

There is no migration, no schema, and no server state, so a rollback is never partial.

---

**Next:** [Roadmap](roadmap.md) — what comes after the documentation.
