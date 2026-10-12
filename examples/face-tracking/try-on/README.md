# Face Try-On Playground

An additive, live-only MindAR reference application: ten original effects, one selection per category, no account, capture, recording, microphone, backend, or analytics. Browse before enabling the camera. Tap an effect again to remove it, or use **Clear all**. Stopping the camera preserves the look.

## Run it

From the repository root, use Node 22+ and the checked-in lockfile:

```sh
npm ci --ignore-scripts
npm run dev:try-on
```

Open `http://localhost:4173`. The browser needs a secure context for camera access: localhost is allowed, plain HTTP on a LAN IP is not. For phone development, use a trusted HTTPS tunnel or a trusted local certificate. `npm run dev:try-on -- --mode https` enables Vite's development certificate; a self-signed certificate alone is not a guarantee your phone trusts the origin. Use an actual top-level browser tab, not an embedded preview with blocked camera permissions.

The browser-only workflow skips the existing native `canvas` install script. This is sufficient for the playground and the library bundles. It does **not** validate the native Node image-target compiler; install/build native canvas separately if using that compiler. The cloud baseline's native download was blocked; no runtime/dependency modernization was needed. Library engine requirements and existing build commands are unchanged.

```sh
npm run build:try-on       # Only this example → dist-try-on/
npm run preview:try-on     # Serve that build at localhost:4173
npm run test:try-on        # Node catalog, selection, loading, resource, session tests
npx playwright install chromium
npm run test:try-on:browser
npm run test:try-on:production # Build first; failure-path static integration test
TRY_ON_NETWORK=1 npm run test:try-on:production # Also fetch real pinned MediaPipe runtime/model
npm run build             # Existing image/face/Three.js/A-Frame library bundles
npm run build-dev         # Existing development bundles and examples
```

On Linux, Playwright may require `npx playwright install --with-deps chromium`. The test server binds to loopback to work in containers without network-interface enumeration. Browser tests own and stop their server; do not run a second server on port 4173 at the same time.

If an isolated browser cannot trust a configured development proxy, the optional integration test accepts `TRY_ON_BROWSER_PROXY` and `TRY_ON_NETWORK_BRIDGE=1`. The bridge uses Playwright's Node request transport with the environment's trusted CA and fulfills only runtime/model downloads. This is test-only, does not disable TLS validation, and does not prove direct browser connectivity at a deployed URL. See the recorded result in `VALIDATION.md`.

`dist-try-on` is a portable static directory with relative asset URLs. Upload **only its contents** to an HTTPS static host; do not publish the source checkout or unrelated examples. No Site, credentials, access-control change, or deployment is created by these commands. The intended later host is public Sites with no sign-in. Verify the actual top-level URL and camera permission after deployment; a successful upload is insufficient.

## How the pieces fit

| File | Responsibility |
| --- | --- |
| `catalog.js` | Stable IDs, categories, original thumbnail/credit references, authored placement, selection rules |
| `effect-manager.js` | On-demand creation, session cache, category replacement, retry, latest-selection-wins |
| `effects.js` / `resources.js` | Original Three.js geometry and canvas textures; explicit ownership/disposal |
| `session.js` | Startup, permission/error states, start/stop serialization, teardown |
| `app.js` / `style.css` | DOM controls, responsive layout, keyboard tabs/focus, tracking status |

The picker is ordinary DOM. An effect selection changes a preference; it does not request a camera. After the first explicit **Start camera**, the app imports the existing face adapter and attaches effects. One MindAR controller performs inference. One Three.js rendering loop draws transparent graphics above the video. Losing the face hides anchors/meshes, while selections remain intact. No new frame-processing API is introduced.

Stop ends tracks, inference, and rendering. Restart reuses the model and authored effect resources. Final teardown detaches roots, removes resize/visibility listeners, closes the MediaPipe model, and releases application-owned materials, textures, and geometries. When the page is hidden, the app stops; returning requires an explicit restart. A pending browser camera permission prompt cannot be programmatically dismissed: cancel waits for the native request to settle, then releases any late stream.

## Add an effect without changing camera code

1. Choose an existing category. Add a unique catalog entry using `entry(...)`, with a plain label, original SVG thumbnail in `assets/`, provenance in `credits`, and a rendering `kind`. Any third-party asset needs its own established license and attribution.
2. For an accessory, author `placement.anchors` (landmark indices) and `offset`. An anchor's coordinate system follows face rotation and translation; **one local unit is approximately the estimated face width**, not a meter. `root.position` is face-relative translation, mesh/group scale controls size, and `rotation` uses radians. Defaults are approximate, not fit measurements.
3. Add the `kind` branch in `createEffect`. Create a group beneath an existing anchor. Use `resources.own` for every owned geometry/material/texture, and `resources.attach` for every root. Sharing a material within that handle is safe because ownership uses a set. Wrap loading in the factory promise; the manager already prevents an older result from becoming active and disposes results that arrive after teardown. A failed factory must clean partial resources, then throw for the effect-specific retry.
4. For face paint, use `adapter.addFaceMesh()` and an original alpha texture. `faceTexture` maps canvas pixels through MindAR's UV coordinates; canvas y is `1 - v`. Draw transparent regions around eyes/mouth instead of painting an opaque rectangular plane. Face paint and masks replace one another in the **Face** category.
5. Extend the catalog tests intentionally (v0.1 asserts exactly ten), add meaningful rendering/ownership checks for the new geometry, then run the build and browser suite. Finally perform the movement/occlusion checks on a real device. Do not treat a synthetic screenshot as fitting evidence.

The catalog is an internal application contract, not a public SDK or universal effect-file format. v0.1 assets are generated on demand, so there is no third-party model loader or model-download cache. The manager caches the created handles for the session and also supports async factories when an established-license asset is added later.

## Short learning milestones

- **Landmark placement:** the existing `../three.html` puts a sphere at landmark 1. Move that sphere in x/y/z, change its scale, and rotate it to see the difference between face-relative placement and camera pixels. Its radius `0.5` is roughly half the estimated face width.
- **DOM versus graphics:** trace `star-cheeks` from a button through `SelectionStore`, `EffectManager`, and `createEffect` to anchors 50 and 280. The smaller star and teal satellite are deliberately asymmetric: they catch double mirroring. MindAR mirrors the input used for inference and the video; the overlay canvas is not mirrored a second time.
- **Surface versus anchor:** compare paint with glasses. A UV-mapped surface deforms with the facial mesh; an accessory follows the rigid face pose at a landmark. The existing face geometry is also drawn depth-only, before accessories. It hides parts behind the face without drawing a colored mask. There is no complete head/ear occluder.
- **Lifecycle versus performance:** model loading, inference, rendering, and layout are different costs. OpenCV temporary Mats are WASM allocations and need explicit deletion on both success and failure. Measure startup and steady-state behavior on the recorded Android device before tuning quality; DPR is initially capped at 2.

## Privacy, credits, and evidence

Frames and face estimates remain inside the browser; this app does not identify people or upload images. Starting tracking downloads the MediaPipe **0.10.9** WASM runtime from jsDelivr and Google's **version 1** float16 face-landmarker model. These are ordinary download requests; this is not a fully offline app. Three.js **0.136.0**, MindAR, and MediaPipe JS are bundled from the lockfile; no `latest` runtime URLs are added. No external requests are needed merely to browse effects.

Read [CREDITS.md](CREDITS.md), [VALIDATION.md](VALIDATION.md), and [DEVICE-CHECKLIST.md](DEVICE-CHECKLIST.md). The in-app About section exposes privacy, credits, and honest platform limits. Android Chrome and desktop Chrome are intended physical-test targets. iPhone Safari is provisional. The cloud suite uses a synthetic camera and simulated MediaPipe landmarks; physical accuracy, fitting, five-minute performance, and real-phone orientation have not been established by those checks.

The static bundle is deliberately additive. Existing image tracking, A-Frame integration, and library builds remain separate. Remaining work is real-device tuning/measurement, public URL acceptance, and the three-person adoption check; future capture, uploads, fitting controls, LiveKit, and AI remain out of scope.
