# Physical-device acceptance record

Status: **not performed in the cloud**. Fill a separate record for each physical device. Chromium synthetic-stream tests are not this checklist. Do not commit personal camera footage.

| Field | Result |
| --- | --- |
| Date and tester | Pending |
| Device model / webcam | Pending |
| OS and browser version | Pending |
| Commit tested | Pending |
| Actual top-level HTTPS URL | Pending; not yet deployed |
| Cold startup and model-download duration | Pending |
| Warm startup duration | Pending |
| Inference/render observations or measured timings | Pending; no FPS claim |
| Visual fitting/occlusion limitations | Pending |

Android Chrome is first; repeat on a physical desktop Chrome/webcam. iPhone Safari remains unverified until a real iPhone tester completes the record.

- [ ] First run of existing face example: sphere follows movement, Stop ends the camera. Record any baseline differences.
- [ ] Browse all categories before Start: no camera permission request.
- [ ] Cold and warm Start: grant, deny, recover permission via browser settings; actionable messages on failure.
- [ ] Select all ten effects; combine all five categories; Face paint/mask replace one another, other choices persist.
- [ ] Toggle a selected card to remove it; remove a look chip; Clear all; keyboard tabs, Enter/Space, visible focus.
- [ ] Quickly switch choices while loading. If an effect fails, retry it without losing the camera or other selections.
- [ ] Move closer/farther, turn left/right, tilt the head, leave the frame, and return. Choices persist; overlays hide on face loss.
- [ ] Check paint/mask alpha and eye openings; glasses side arms hide behind the face. Record approximate ear placement and absent rear-head occlusion.
- [ ] Check the larger star with its teal satellite versus the smaller opposite star. Camera and overlay must mirror consistently without mirroring the canvas twice.
- [ ] Rotate portrait/landscape and resize the viewport: video and graphics crop together, no stretching or drift.
- [ ] Run for five minutes; record startup, model download, rendering/inference costs, warmth, stalls, and memory behavior.
- [ ] Repeat ten Start/Stop cycles. No orphan video/loop; camera indicator ends after each Stop. Effect changes do not reopen it.
- [ ] Background the page and return: camera stops; restart is explicit and restores the look.
- [ ] Check camera unavailable/in-use, insecure origin, model-network failure, and supported-capability errors where reproducible.
- [ ] Inspect network requests: runtime/model downloads are expected; no application camera-image uploads or analytics.
- [ ] At the eventual public URL, open a fresh signed-out browser session: no app account required, camera starts, effects mix, Stop works.

After deployment, ask three unfamiliar visitors to start, combine effects, and clear the look without live instruction. Record each failure point before adding more features.

| Visitor | Start / mix / clear | Confusion or failure | Follow-up change |
| --- | --- | --- | --- |
| 1 | Pending | Pending | Pending |
| 2 | Pending | Pending | Pending |
| 3 | Pending | Pending | Pending |
