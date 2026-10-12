# Cloud validation — 2026-10-12

Base: `fb5db87b1e5076ba86fde82101955da70b629a1c`, upstream `master`; cloud clone initially clean. The owner's existing fork `muddlebee/mind-ar-js` has the same base. No upstream push, merge, public Site, or deployment is performed by this implementation.

## Baseline and build

- Environment: Linux cloud container, Node **24.19.0**, npm **11.9.0**, Chromium **141.0.7390.37** (Playwright **1.56.1**), synthetic media devices and software WebGL.
- Unmodified production library build passed before core changes: image tracking, face tracking, Three.js, and both A-Frame bundles. No existing repository tests or PR template were present.
- `npm ci` hit a policy-blocked GitHub download during the existing native `canvas` installation. `npm ci --ignore-scripts` succeeded and the browser/library builds work without that native addon. Native Node canvas/compiler behavior is unverified.
- Lockfile runtime versions preserved: MediaPipe **0.10.9**, Vite **5.0.11**, Three.js **0.136.0**. Three.js is now explicitly pinned as a demo development dependency; Playwright is the only new test tooling. Existing package versions were not upgraded or pruned.
- Final `npm run build`, `npm run build-dev`, and `npm run build:try-on` pass. `dist-try-on` contains only the playground and its license notices; no legacy models or other examples are copied. Vite reports large face-runtime/Three.js chunks; model/WASM network downloads are additional. No measured optimization or device FPS claim is made.
- The seven current static files (HTML, CSS/JS bundles, and notices; approximately 2.74 MB before compression) have identical SHA-256 hashes across repeated builds with unchanged inputs. No synthetic test adapter is present in production bundles. Generated QA files are ignored and are not part of the repository changes.

## Automated evidence

| Check | Result and boundary |
| --- | --- |
| `npm run test:try-on` | **11 passed**: catalog, category isolation, replacement, removal, Clear all, invalid IDs, immutable state, async latest-wins, retry, owned resource disposal, serialized session |
| `npm run test:try-on:browser` | **15 passed** in Chromium: all ten effects, actual WebGL pixels, real synthetic MediaStream tracks, keyboard/focus, responsive crop, reduced motion, DPR cap, failure/retry, ten start/stop cycles, late camera/model cancellation, stale inference guard, loss/reacquisition |
| GPU lifecycle | Geometry/texture counts stable after every cached effect's first draw; final teardown reaches **0 geometries / 0 textures**. Tracks are `ended`, video/canvases are removed, model is closed. No camera/model reopen on effect changes |
| OpenCV ownership | **50** synthetic-pose estimates release all observed temporary Mats; controlled `solvePnP` failure also releases them |
| Production download-failure integration | Passed against the compiled static app, with the actual adapter and a deliberately aborted pinned WASM download. Error is actionable, camera is released, picker remains usable; no test adapter is shipped |
| Actual MediaPipe runtime/model integration | **Passed on synthetic video**, with the real 0.10.9 WASM and Google's version 1 model. A test-only Node request bridge used the cloud environment's trusted CA/proxy; browser TLS validation was not disabled. Recorded startup **26,895 ms** is for this container/transport, not a device benchmark |
| Direct cloud-browser external transport | Could not establish direct downloads: jsDelivr `vision_wasm_internal.js` returned `net::ERR_EMPTY_RESPONSE`; configured proxy then returned `net::ERR_CERT_AUTHORITY_INVALID` in the fresh Chromium profile. The successful bridged check does not establish direct deployed-origin connectivity |
| Network observation | Browsing does not fetch model/WASM or request camera. Runtime integration observed GET downloads, with no application camera-image POSTs. No analytics/backend added |

The fixture is enabled only by Vite **test mode**. It replaces MediaPipe landmark output with a projection of the existing canonical geometry. The camera is Chromium's generated color/test pattern, not a human face. Three.js, the face adapter, controller loop, estimator, video playback, and WebGL resources remain real. `try-on-artifacts/synthetic-*.png` are generated, ignored QA screenshots; they show synthetic video and do not prove face fitting.

The separate production integration uses **no simulated detector**. It runs the actual pinned MediaPipe runtime on the generated video pattern (no detected human face), confirming model initialization, video processing, camera-ready state, and Stop. The optional trusted transport bridge affects test downloads only and is absent from the application.

## Why core changes were necessary

The current face adapter swallowed camera errors and used an async Promise executor for AR startup, which could leave startup unsettled on model failure. It did not remove its bound resize listener or close the model. Stopping did not cancel a pending processing callback, allowing stale detections/duplicate loops on rapid restart. The estimator allocated OpenCV Mats every frame without deleting them.

The changes preserve the detection algorithm and comments: propagate actionable errors, serialize startup, guard/cancel late results, retain one reusable helper, add teardown, release temporary Mats on success/failure, and update video dimensions on resize. Optional camera/face callbacks and a configurable pixel-ratio cap serve this example. Its UI owns the effect cache and GPU assets. The existing Three.js face example resumes its render loop after camera switching because Stop now releases the loop.

## Acceptance still pending

Implementation and automated cloud verification are ready for review. Milestones 1, 3, and 4 retain their physical-camera fitting/movement/performance gates. Milestone 5 is **not complete**: public deployment, top-level Android HTTPS validation, and the three-person adoption check remain separate actions.

Complete [DEVICE-CHECKLIST.md](DEVICE-CHECKLIST.md) on the owner's Android phone and a physical desktop webcam. iPhone Safari remains provisional. No physical Android/iPhone test, real-world fit, identity selection among multiple faces, five-minute device performance, or FPS result is claimed. There is approximate facial depth occlusion, not complete head/ear occlusion. No photo capture, recording, AI, LiveKit, uploads, fitting sliders, or broad engine modernization is included.
