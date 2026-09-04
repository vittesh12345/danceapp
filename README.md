# Tempo — AI Dance Coach 🕺

A browser-based AI dance coach that **watches you dance through your camera** and tells you
exactly what to fix: *"Lift your right arm higher — 18° too low"*, *"Bend your knees more — stay
low"*, *"You're ≈0.3 s behind the beat"*.

Pick a move → learn it from the animated demonstration → turn the camera on → dance → get live
corrections → review a full technique report → watch your scores improve over time.

## Running it

```bash
npm install   # also copies the MediaPipe WASM runtime into public/ (postinstall)
npm run dev   # open http://localhost:5173
```

`npm run build` produces a static production bundle in `dist/`.

## Publishing (free)

The app is a fully static site, so free hosting is easy. **GitHub Pages is already wired up**:
merging to `main` triggers `.github/workflows/deploy.yml`, which builds the app and publishes it
to `https://<your-username>.github.io/danceapp/` over HTTPS (required for camera access). The
first run auto-enables Pages; if GitHub refuses, enable it once under
**Settings → Pages → Source: GitHub Actions** and re-run the workflow.

Other free options that work as-is (all serve `dist/` with HTTPS):

- **Cloudflare Pages / Netlify / Vercel** — connect the repo, set build command `npm run build`,
  output directory `dist`. These serve from the domain root, so don't set `BASE_PATH`.

## Install it as an app (PWA)

Tempo is a Progressive Web App: once it's served over HTTPS, open it on your phone and use
**Add to Home Screen** (Android/Chrome offers "Install app"; iOS Safari: Share → Add to Home
Screen). It launches full-screen with its own icon, and a service worker (`public/sw.js`) caches
the app shell, pose model and WASM runtime so it keeps working offline after the first visit.
For native app stores later, the same codebase can be wrapped with Capacitor — but stores charge
developer fees, so the PWA is the free route.

The pose model (`public/models/pose_landmarker_lite.task`) is committed to the repo, so
**everything runs on-device**: no camera frame, landmark, or score ever leaves the browser.
If the local model/WASM files are missing, the app falls back to loading them from the
official CDNs at runtime.

No camera handy? Every move has a **demo mode** — a simulated dancer with realistic human
imperfection is fed through the *exact same* analysis pipeline, so you can see live coaching,
scoring and reports immediately.

## How it works

### Computer vision (real, on-device)

`src/pose/mediapipeSource.ts` runs **MediaPipe Pose Landmarker** (BlazePose GHUM) via
WebAssembly/WebGL in `VIDEO` mode on the webcam feed. 13 of its 33 landmarks (nose, shoulders,
elbows, wrists, hips, knees, ankles) are kept, mirrored into "selfie space", and smoothed with a
**One-Euro filter** (`smoothing.ts`) — adaptive smoothing that kills jitter at rest while staying
responsive during fast movement.

Every pose is then **body-normalized** (`geometry.ts`): translated so the mid-hip is the origin
and scaled so 1 unit = torso length. Body size, camera distance and position in frame therefore
don't affect any comparison.

### Reference moves

Moves are authored as **joint-angle keyframes on musical counts** (`src/reference/moves.ts`) —
e.g. "count 3: right upper arm 85° out, forearm 85°, torso lean 12°". A tiny forward-kinematics
model (`builder.ts`) turns each keyframe into a full-body pose in the same normalized space, and
`sampler.ts` interpolates between keyframes with beat-hitting easing. The animated instructor
avatar, the ghost overlay, and the comparison targets are all rendered/derived from this single
source of truth.

This is deliberately the same shape of data a future "record an instructor" pipeline would
produce: run the pose estimator over instructor footage, reduce it to features per beat, keyframe
it. Nothing downstream would change.

### Movement comparison

Both the user's pose and the reference pose are reduced by **one shared measurement function**
(`src/analysis/features.ts`) to a 14-dimensional feature vector: signed arm/forearm/thigh line
angles, elbow/knee interior angles, torso lean, shoulder tilt, stance width and weight shift.
Comparison is a per-feature difference with per-feature tolerances and weights (plus per-move
`focus` multipliers, so Disco Point cares more about arm lines and Groove Bounce about knees).

**Timing is separated from technique** (`timing.ts`): a rolling window of user features is
cross-correlated against the choreography over ±0.8 s to find the clock offset that best aligns
them. That offset is reported as timing feedback ("≈0.3 s late") *and* subtracted before
technique scoring, so being late doesn't double-count as bad form.

### Coaching feedback

`feedback.ts` turns feature errors into at most **one headline + one secondary cue** at a time.
Messages are specific and directional ("Step your left foot out wider — 14° too far in"), with
hysteresis (a correction stays up until it's actually fixed), cooldowns (no nagging), and praise
when you're in the pocket. Optional spoken coaching (Web Speech) and a beat-accurate WebAudio
metronome round out the instructor feel.

The overlay makes corrections visual: a ghost of the target pose anchored to *your* body,
joints tinted red by positional error, and dashed arrows pointing from your joint to where it
should be.

### Post-session analysis

`session.ts` accumulates per-feature error integrals, per-count scores, timing offsets and a
score timeline, and produces the report: overall/technique/timing/consistency scores, strongest
and weakest body areas, per-count bar chart with the worst two-count window called out, a
practice plan, and deltas vs. your previous session. History persists in `localStorage`
(`state/progressStore.ts`) and feeds the Progress screen's charts and personal bests.

## What's real vs. simulated

| Component | Status |
| --- | --- |
| Pose estimation (camera) | **Real** — MediaPipe BlazePose, on-device WASM/WebGL |
| Normalization, features, comparison, timing, scoring, feedback, reports | **Real** — same code path for camera and demo |
| Reference choreography | **Authored data** — hand-tuned joint-angle keyframes (4 moves), not captured from a real instructor yet |
| Demo mode dancer | **Simulated** — reference choreography + human-like lag/bias/noise, clearly labeled in the UI |
| Coaching language | **Rule-based templates** over measured errors (no LLM) |

## Architecture

```
src/
  pose/        PoseSource interface, MediaPipe impl, simulated impl, smoothing, normalization
  reference/   move data model, FK builder, sampler, move library
  analysis/    features, comparison, timing, feedback engine, session orchestration
  audio/       metronome, speech coaching
  state/       localStorage progress store
  components/  React UI (screens, canvas renderers, charts)
```

The UI only talks to `PoseSource` and `CoachSession`; pose detection, comparison logic and
feedback rules are all independently replaceable. Adding a move is adding one object to
`moves.ts`.

## Where this could go next

- **Captured references**: run the same pose pipeline over instructor video to generate
  keyframes; add a dev "record a move" screen.
- **3D**: BlazePose already outputs world z — extending features to 3D would catch
  forward/backward errors the current 2D projection can't see.
- **Learned scoring**: the per-frame feature vectors + reports are exactly the training data a
  ranking/critique model would need; the rule engine is one module (`feedback.ts`) to swap.
- **Choreography sequencing**: chain moves into routines with per-section reports.
- Music playback with beat tracking instead of a metronome.
