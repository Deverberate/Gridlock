# Factory Sim — run guide

## What this project is

Two builds share one codebase:

- **`index.html` + `src/` (the real build)** — multi-threaded: a Web Worker runs
  the entire factory simulation (ECS machines, flat-array belt lines, terrain/
  ore deposits) at fixed 60 UPS and publishes a render snapshot through a
  double-buffered `SharedArrayBuffer`. The main thread only does UI + WebGL
  (instanced sprites) and sends build commands to the worker via `postMessage`.
- **`demo.html`** — the original single-threaded reference build (same game,
  no worker). Used for parity comparisons.

`demo.html` and the `src/` build are independent entry points. `npm run dev`
serves the `src/` build at `/`; `demo.html` is also served at `/demo.html`
(no worker needed there, but SharedArrayBuffer requires the COOP/COEP headers
which the dev server already sets).

## How to run the server

Requires the COOP/COEP headers for SharedArrayBuffer — they are configured in
`vite.config.js` and mirrored by `<meta>` tags in `index.html`.

```bash
npm install        # once, after a fresh checkout
npm run dev        # Vite dev server on http://localhost:5173
```

Notes:

- Vite 8 binds `::1` (IPv6 localhost) by default, so use
  `--host 127.0.0.1` if you need an IPv4 loopback:
  `npm run dev -- --host 127.0.0.1`.
- When started with `nohup ... &` inside a shell that exits, the server may be
  reaped with its process group. To run it detached on macOS (no `setsid`),
  double-fork into a new session with Python:
  `python3 -c "import os,sys; ... os.setsid(); os.execv(...)"` — or run
  `npm run dev` in a terminal that stays open.
- `npm run build` emits `dist/`; `npx vite preview` serves the production
  bundle with the same headers.

## Reproduce-able artifacts

- No secret/env files are needed; the project has zero runtime config.
- `node_modules` is the only dependency artifact (`npm install`).
- `demo.html`, `serve.js`, `serve.mjs` are optional single-file/preview
  helpers and are not part of the build graph.
