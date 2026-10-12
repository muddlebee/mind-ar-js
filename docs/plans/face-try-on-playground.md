# Face Try-On Playground — v0.1 Plan

Status: implementation authorized by the owner on 2026-10-12. Cloud implementation and automated verification are ready for review. Physical-device acceptance and public deployment are pending; build success alone does not complete them. No merge is authorized.

This is a separate first-release plan. It replaces shared image annotations and LiveKit as the immediate project direction, without deleting the earlier research or raw `plan.md`.

## 1. What we are building

A playful, camera-first website where anyone can try face paint, a mask, stickers, and accessories in their browser. A visitor opens a public HTTPS link, starts their camera, and mixes effects without installing an app or signing in.

The project has two purposes:
- **Usability and adoption:** provide a working, understandable demonstration other developers can run and extend.
- **Hands-on learning:** work through face landmarks, mesh UVs, 3D placement, occlusion, asset loading, and browser-camera lifecycle in small, verifiable milestones.

### Confirmed decisions

- Playful, colorful, camera-first design rather than an ecommerce storefront or technical dashboard.
- Combine effects, with one selection per category.
- Live preview only. No photo capture, recording, or sharing files in v0.1.
- Public hosted access: anyone with the link, no sign-in.
- No LiveKit, remote participants, voice agent, or AI generation.
- Android Chrome is the first physical-device validation target; the owner can test on Android. Desktop Chrome is also in scope. iPhone Safari remains provisional until a real iPhone tester verifies it.

This is a visual try-on, not a measurement tool or a guarantee of real-world fit. Track one face at a time; do not promise stable identity selection when several people enter the frame.

## 2. User experience and effect catalog

### Main flow

1. Open the page and browse effect thumbnails without granting camera access.
2. Read a short privacy explanation and press **Start camera**.
3. See distinct loading, permission, camera-ready, and face-tracking states.
4. Choose effects from the category strip. Effects follow the face as the person moves.
5. Tap a selected effect again to remove it, replace it with another in that category, or use **Clear all**.
6. Use **Stop camera** to release the camera; starting again restores the selected look without creating a second processing loop.

### Starter catalog: ten effects

| Category | Effects | Rendering approach |
| --- | --- | --- |
| Face | Color-pop face paint; carnival-style eye mask | Original transparent textures mapped onto the face mesh |
| Stickers | Star cheeks; heart cheeks | Original graphics attached to face landmarks; each preset may place a pair |
| Eyewear | Round glasses; pixel shades | 3D geometry/models positioned around the eyes and nose |
| Headwear | Crown; party hat | 3D geometry/models attached above the forehead |
| Earrings | Hoops; drop earrings | Paired 3D accessories attached at side-face landmarks |

Paint and masks intentionally share the Face category. They replace one another rather than competing for the same face surface. Selections in other categories remain active.

Use original procedural geometry and original graphics where practical. Existing glasses, party-hat, and earring models may be reused only with their included attribution requirements preserved. Do not assume that every bundled asset has the repository's MIT license. Exclude unclear-license models and SparkAR face-mask/head-occluder assets from the new demo unless their reuse is separately established. Use MindAR's existing face geometry for initial depth-only facial occlusion; do not promise complete back-of-head occlusion or physically accurate ear placement.

### Layout and interaction

- Mobile: camera stage dominates, with thumb-friendly category tabs, a horizontal effect picker, and clearly visible camera/reset controls.
- Desktop: large camera stage alongside a compact browsing panel using the same categories and selection rules.
- Use a warm neutral interface with a small, bright accent palette; let the effects supply most of the color.
- Provide illustrated thumbnails and plain names, selected/loading/error indicators, keyboard operation, visible focus, readable contrast, and reduced-motion support.
- Keep the camera functional if an individual asset fails; show an effect-specific retry instead of a blank stage.
- No fitting sliders, uploads, search, accounts, or saved looks in the first version. Author suitable per-effect defaults instead.

## 3. Technical approach

### Reuse the current engine

- Build an additive example with vanilla JavaScript, CSS, Three.js, and the existing MindAR face adapter. Do not introduce React or rewrite the tracking engine for this demo.
- Put the example under `examples/face-tracking/try-on/`, with a dedicated Vite entry and static output directory `dist-try-on/`.
- Add `dev:try-on`, `build:try-on`, `preview:try-on`, and `test:try-on` scripts. Preserve current library builds and existing examples.
- Existing camera video plus transparent WebGL rendering is sufficient for live preview. Do not implement the previously proposed composited-video pipeline, frame-processing API, or generic media-session layer.
- Verify the current dependency baseline before upgrading. Limit package and core changes to demonstrated blockers for this example; do not combine the demo with a broad modernization effort.

### Keep the application modular, not framework-sized

Use four small responsibilities:
1. **Catalog and selection state:** stable effect IDs, category, label, thumbnail, credits, asset references, and authored placement.
2. **Effect factories:** create or load each effect, attach it to the appropriate mesh/anchor, and dispose owned resources.
3. **Camera/session controller:** wrap startup, tracking status, stop/restart, failures, and teardown.
4. **UI:** display catalog state and invoke camera/selection actions.

The effect catalog is an internal application contract, not a new universal effect-file format or public SDK. Document how to add one effect without changing the camera or tracking code.

### Important behavior

- Request the front-facing camera only after an explicit Start action. Do not request microphone permission.
- Use one tracking session for the whole page. Effect changes must not request the camera or reload the tracking model.
- Load 3D assets on demand, reuse loaded assets during the session, and ensure an older loading request cannot replace a newer selection.
- Treat effect selection as a user preference independent of tracking visibility. When no face is detected, hide effects; when it returns, restore the same selected effects.
- Keep face paint/masks correctly alpha-blended, and use depth-only facial geometry where appropriate so accessories do not simply draw over the face when it turns.
- Preserve a consistent mirrored self-preview across camera, paint, stickers, and 3D objects. Test an asymmetric sticker to catch double mirroring.
- Handle orientation/viewport changes without stretching the face or detaching effects. Cap renderer pixel ratio at 2 initially and measure actual performance before adding quality controls.
- Make stop/restart and teardown safe. Release application-owned camera tracks, rendering loops, listeners, model resources, geometries, materials, and textures when their lifetime ends. Make only the minimal additive core lifecycle repairs required to support this.
- Show actionable states for denied permission, insecure context, unavailable/in-use camera, unsupported capabilities, and model/asset loading failures. Do not fall back to an unrelated demo image while implying the camera is working.

### Privacy and hosting

- Face inference and effect rendering run in the browser; the application does not upload camera frames or identify the person.
- Do not add analytics, recording, or backend storage. Document model/WASM download requests separately from camera processing; do not claim fully offline operation.
- Host effect assets with the static application and retain an accessible credits page/section. Pin runtime dependencies rather than loading `latest`.
- Default hosting target for the later implementation is a public static Sites deployment over HTTPS, with the repository remaining the source of the demo. Keep the static artifact portable to other hosts.
- Verify camera access at the actual top-level deployed URL, not only inside an embedded preview. A successful upload alone does not establish that the AR demo works.
- Plan creation does not create a Site, change access controls, publish the repo, or deploy anything. Those actions belong to the later implementation request.

## 4. Guided implementation milestones

### Milestone 1 — Make the existing face tracking understandable

Run the current face-tracking example on desktop and the owner's Android phone. Establish a reproducible install/build and document any baseline problems before introducing the new interface.

**Done when:** the camera starts, a face-attached object follows movement, and the camera stops correctly on the tested devices.

**Learning exercise:** attach one simple shape to a landmark and explain how translation, scale, rotation, and face-relative coordinates affect its placement.

### Milestone 2 — Build the camera-first playground with two real effects

Implement the responsive shell, stateful category picker, camera controls, and loading/error states. Integrate one sticker and one eyewear effect to prove mixing works before producing the whole catalog.

**Done when:** both effects can be independently selected, replaced, or removed without restarting the camera, and the page remains usable with permission denied.

**Learning exercise:** distinguish ordinary DOM UI from Three.js content and trace a selected effect from catalog entry to face anchor.

### Milestone 3 — Complete the ten-effect catalog

Add the remaining effects, original UV textures, asset credits, and facial occlusion. Tune each preset using a consistent set of face movements. Prefer simple assets that render reliably to elaborate but unstable visuals.

**Done when:** all five categories can be combined; Face selections replace one another; loss/reacquisition preserves the user's selections; failed effect loading does not break the camera.

**Learning exercise:** create one face-paint texture and compare a surface-following mesh effect with a landmark-attached sticker or accessory.

### Milestone 4 — Test lifecycle, responsiveness, and real-device behavior

Finish automated checks and Android testing. Measure startup/model-load time and steady-state rendering/processing behavior on the recorded device. Fix observed usability and reliability problems rather than pursuing unmeasured optimizations.

**Done when:** the verification checklist below passes on desktop Chrome and the tested Android phone; unsupported/unverified platforms are honestly labelled.

**Learning exercise:** identify the largest measured bottleneck and distinguish model inference, asset loading, rendering, and layout costs.

### Milestone 5 — Publish the public demo and a developer walkthrough

Build the static artifact, verify it locally, deploy with public no-sign-in access, and test the actual HTTPS URL on Android. Include setup commands, asset credits, known limitations, and a short guide to adding an effect.

**Done when:** a new visitor can open the URL, start their camera, mix effects, and stop the camera without developer assistance. Do not mark this complete based solely on build/deployment success.

**Learning exercise:** add one original effect by following only the published contributor guide.

## 5. Verification and acceptance

### Automated checks

- Use Node's built-in test runner for pure catalog and selection logic; use browser automation for DOM, WebGL, and lifecycle behavior.
- Verify category isolation, one active effect per category, toggle-to-remove, Clear all, invalid IDs, and latest-selection-wins loading behavior.
- Verify UI keyboard/focus behavior, responsive layouts, permission/error states, and repeatable start/stop.
- Exercise cleanup and effect replacement with observable resource ownership; avoid tests that only assert mocked functions were called.
- Use controlled fixtures or simulated pose data to test rendering/state where a physical camera is unavailable. Such tests do not establish real face-tracking accuracy.
- Keep automated screenshots to synthetic or explicitly consented fixtures. Do not commit personal camera footage.

### Manual Android and desktop checklist

- Cold start and warm start; grant, deny, and recover camera permission.
- Select every effect; combine all categories; quickly change selections while assets load.
- Move closer/farther, turn left/right, tilt the head, leave the frame, and return.
- Rotate the phone and check portrait/landscape layout and alignment.
- Run for five minutes; repeat ten start/stop cycles; background and resume the page.
- Confirm the camera stops when requested and that effect switching does not reopen it.
- Check paint/mask alignment and transparency, accessory occlusion, and an asymmetric sticker's orientation.
- Open the public URL in a fresh browser session with no account signed in.
- Inspect network behavior to confirm there are no application camera-image uploads.

Record device models, OS/browser versions, measured performance, and known visual limitations. Do not claim universal support, guaranteed FPS, accurate physical fit, or verified iPhone compatibility without the relevant evidence.

### Small adoption check

Ask three people unfamiliar with the project to open the public page, start the camera, combine effects, and clear them without live instruction. Record the failure points and improve the onboarding before expanding the feature list.

## 6. Explicitly later

Photo capture is the first candidate after the live demo: it will require correctly combining camera pixels and graphics. Other candidates are more effects, adjustable fitting, animation/expression triggers, and optional developer diagnostics.

LiveKit, AI-agent commands, image-target collaboration, multiple-face tracking, body/hand wearables, a visual editor, arbitrary asset uploads, and a marketplace remain separate future decisions—not hidden requirements of this plan.

## Implementation record

- Cloud base: `fb5db87b1e5076ba86fde82101955da70b629a1c` (upstream `master`, verified 2026-10-12), matching the planning checkout. Clean tracked state on acquisition.
- No repository `AGENTS.md` or pull-request template was present at this base. Existing README development instructions were inspected.
- Branch: `feat/face-try-on-playground`; upstream `master` will not be pushed or merged.
- Cloud verification and physical-device results are recorded separately in the example's `VALIDATION.md`.
