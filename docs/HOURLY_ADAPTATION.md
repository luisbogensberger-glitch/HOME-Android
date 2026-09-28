# V-Brain hourly adaptation (Host 18 / One UI v25)

The existing **Adaptive HOME Runtime** ChatGPT automation runs hourly in Europe/London. It reads the private Supabase streams `home_behavior_stream`, `home_learning_stream`, and `home_task_stream`. It should inspect `source_created_at` for behavior and learning events, `source_updated_at` for task snapshots, and confirm recent `runtime_ready`/`live_ui_applied` before attributing an outcome to a release. A scheduled run is not proof that the phone was online or accepted an update.

The phone queues its own V-Brain events and privately syncs through the authenticated HOME Worker. It does not grant unrestricted access to other phone apps. Typed task notes and Tube sentences are private; never copy them to public GitHub commits, issues, workflow logs, or `ui-live-v25.json`.

## Delivery paths

- **Small personal adjustment:** Send a short lived `ui_patch` device command with a `liveUi` object. The native host stores it in `vbrainPrivatePatch`; One UI merges at most two Home modules and one module per screen after the public configuration. `liveUi.expiresAt` is required and cannot exceed seven days ahead. Allowed modules are `card` or `button`, with a stable `id`, `title`, optional `kicker` and `text`, and an optional route action to `home`, `todos`, `tube`, `gym`, or `calendar`. Keep the four Home cards and the user's manual order intact. Preserve any existing `brainContext` or other private patch fields when sending a new command. New modules appear on the next foreground command check, normally within seconds while the app is open; Android background jobs can be deferred.
- **Generic layout or code change:** Edit `sync-overlay/app/src/main/assets/vbrain-one-ui-v25.js`, regenerate `home-runtime/live-app.html` and `live-release.json`, run `scripts/verify_release.py` and the browser test, then publish both files together. The Host checks the verified release and applies it on an idle Home screen. Purely declarative public UI in `home-runtime/ui-live-v25.json` is polled around every two seconds while foregrounded, but must never contain private observations.

Do not use `adaptive-ui.json` for One UI v25. The old daily workflow is manual only because that file is no longer loaded by the shipping runtime.

## Evidence and guardrails

`screen_card_impression` is recorded after half a core Home card stays visible for 600 ms; `ui_press_card` records an actual opening. They share `visitId`, `route`, and `position`. Compute the card click rate as distinct `(visitId, route)` pairs with an opening divided by distinct pairs with an impression, over the same complete observation window. Do not treat generic `ui_press` rows labeled `control` as a card click. Compare more than one visit and meaningful completions/dwell before changing the interface. A session with no interaction is evidence, not an error.

When a useful change is justified, make a small reversible adjustment with a finite expiry; otherwise leave the UI stable. Do not replace the core Home layout or overwrite an in-progress input. `private_ui_applied` acknowledges rendering by the UI, `device_command_applied` acknowledges native storage, and `live_ui_applied` acknowledges public declarative UI. None alone proves that a task was completed or that a learning answer was reviewed.
