# V-Brain hourly adaptation (Host 18 / One UI v25)

The existing **Adaptive HOME Runtime** ChatGPT automation runs hourly in Europe/London. Every run must first treat [`VBRAIN_PRODUCT_CONTRACT.md`](./VBRAIN_PRODUCT_CONTRACT.md) as a regression contract: preserve working capabilities and act only on a verified gap, failure, or evidence-supported improvement. The goal is cumulative improvement over months, not recurring redesign.

It reads the private Supabase streams `home_behavior_stream`, `home_learning_stream`, and `home_task_stream`. It should inspect `source_created_at` for behavior and learning events, `source_updated_at` for task snapshots, and confirm recent `runtime_ready`/`live_ui_applied` before attributing an outcome to a release. A scheduled run is not proof that the phone was online or accepted an update.

The phone queues its own V-Brain events and privately syncs through the authenticated HOME Worker. It does not grant unrestricted access to other phone apps. Typed task notes and Tube sentences are private; never copy them to public GitHub commits, issues, workflow logs, or `ui-live-v25.json`.

## Delivery paths

- **Brain context:** Use a private `brain_context` device command for durable structured goals/preferences/capabilities. Extend prior context instead of replacing it with a smaller summary. Chat-derived context is provenance-bearing context, not behavioural proof.
- **Personal adaptation:** Send a private `ui_patch` command containing `liveUi.baseline` for accepted, lasting changes and optionally `liveUi.experiment` for a trial. The native host stores it in `vbrainPrivatePatch` across releases. The experiment overrides only the surfaces it names and requires an `id` and `expiresAt` no more than seven days ahead; when it expires, the accepted baseline returns. The command's own `expires_at` is only a delivery deadline, not the lifetime of the baseline. One UI merges at most two Home modules and one module per screen after public defaults. Allowed modules are `card` or `button`, with a stable `id`, `title`, optional `kicker` and `text`, and an optional route action to `home`, `todos`, `tube`, `gym`, or `calendar`. Keep the four Home cards and the user's manual order intact. Preserve the whole accumulated patch, including `brainContext`, when sending another command. New modules appear on the next foreground command check, normally within seconds while the app is open; Android background jobs can be deferred.
- **Generic layout or code change:** Edit `sync-overlay/app/src/main/assets/vbrain-one-ui-v25.js`, regenerate `home-runtime/live-app.html` and `live-release.json`, run `scripts/verify_release.py` and the browser test, then publish both files together. The Host checks the verified release and applies it on an idle Home screen. Purely declarative public UI in `home-runtime/ui-live-v25.json` is polled around every two seconds while foregrounded, but must never contain private observations.

Do not use `adaptive-ui.json` for One UI v25. The old daily workflow is manual only because that file is no longer loaded by the shipping runtime.

## Evidence and guardrails

`screen_card_impression` is recorded after half a core Home card stays visible for 600 ms; `ui_press_card` records an actual opening. They share `visitId`, `route`, and `position`. `screen_personal_module_impression` and `ui_press_personal_module` share `visitId` and module `id` to compare a personal module with its baseline. Compute a click rate as distinct visit/item pairs with an opening divided by distinct pairs with an impression in the same complete observation window. Do not treat generic `ui_press` rows labeled `control` as a card click. Compare more than one visit and meaningful completions/dwell before changing the interface. A session with no interaction is evidence, not an error.

Dwell, foreground/background, genuine completion, ignored exposures, manual Home swaps and reminder outcomes are all useful evidence. Never infer unrestricted phone activity from V-Brain telemetry: absence of captured evidence may mean the app was offline, the permission/path was unavailable, or no event occurred.

Keep a private decision history in `public.vbrain_ui_decisions`: record a proposed experiment with aggregated evidence and a hypothesis, mark activation only after device confirmation, and later record whether it was kept or reverted. After enough observation across days, promote a beneficial experiment into `liveUi.baseline`; that accepted baseline stays until evidence supports another change. Review weekly and monthly outcomes, including task completion, learning follow-through and manual rearrangements, rather than endlessly cycling visuals. Do not put raw notes, Tube sentences or personal text in the public repository or workflow logs.

When a useful change is justified, make a small reversible trial; otherwise leave the UI stable. Do not replace the core Home layout or overwrite an in-progress input. `private_ui_applied` acknowledges rendering by the UI (including `mode: baseline` or `experiment`), `device_command_applied` acknowledges native storage, and `live_ui_applied` acknowledges public declarative UI. None alone proves that a task was completed or that a learning answer was reviewed.

## Semantic learning fallback

The app persists a Tube attempt before optional AI review, so learning evidence survives reviewer outages. On each automation run:

1. inspect `home_learning_stream` for attempts that are not actually reviewed;
2. evaluate the stored prompt/reflection/quiz evidence privately with the automation model;
3. write a concise structured `semantic_review` and set `review_status='reviewed'` only after the write succeeds;
4. include an `assessmentValid` signal;
5. mark explicit delivery tests, system tests and prompt/card mismatch complaints as `assessmentValid=false` so they do not lower inferred ability;
6. use only valid reviews for longitudinal knowledge/ability inference.

This fallback must not enable paid API services or billing. Repeated prompt/card mismatch is a Tube product-quality defect and should drive a question-quality fix rather than a learner penalty.

## External context

The Android notification listener can process WhatsApp/WhatsApp Business and Gmail notifications when the user has actually enabled notification access. The Android Calendar provider is available only when calendar permission is granted. Treat notification snippets as incomplete evidence.

If Gmail or Google Calendar connectors are available to the automation, they may privately reconcile important actions and timing. Connector access in ChatGPT is not the same as access in the Android app. Deduplicate before creating/enriching tasks, and do not turn newsletters, routine FYI mail or ordinary conversation into tasks.

## Command hygiene

Expired `pending` device commands should be cancelled rather than left looking deliverable. Before sending a new personal patch, inspect active/recent commands, deduplicate, and preserve durable fields. A new command must have a finite delivery expiry. Do not report a queued command as live until `device_command_applied` (and, for UI changes, `private_ui_applied`) confirms the relevant payload on the phone.
