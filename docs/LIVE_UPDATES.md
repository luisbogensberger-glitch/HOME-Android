# V-Brain 17: update and observation contract

The Android package remains `com.luis.home`. Install the signed v17 APK over the existing app once; do not uninstall it. Preserve the established signing key. The build fails if that key is unavailable instead of silently creating an incompatible one.

## Full interface releases

1. Edit the existing UI sources under `sync-overlay/app/src/main/assets` or the explicitly included `home-runtime` modules. `scripts/build_live_release.py` declares the single ordered module set. Never re-enable the legacy remote-extension loader in this host.
2. Run `python3 scripts/build_live_release.py` and `python3 scripts/verify_release.py`.
3. Commit the edited sources together with `home-runtime/live-app.html` and `home-runtime/live-release.json`.
4. Publish that exact source state on `main`. Keep the manifest and HTML hash consistent. The native host checks approximately every minute in the foreground and at resume, stages the whole document and applies at an idle home screen. It does not interrupt typing or a reader.
5. The native host uses the same `file:///android_asset/index.html` base URL for bundled and remote documents. SharedPreferences, encrypted token and WebView storage persist. Download failures retain the existing version. Missing runtime health acknowledgement triggers rollback to the previous healthy release.

The release can replace HTML, JavaScript, styles, images and interactions within existing native capabilities. New Android permissions or native integrations need another signed APK.

## Private data and controls

The authenticated HOME Worker remains the source of tasks. Private learning and behavior are mirrored into Supabase. Never put notes, sentences, personal notification text, credentials or raw telemetry into this public repository.

- `home_learning_stream`: complete answers and actual review status.
- `home_behavior_stream`: `runtime_ready`, `runtime_heartbeat`, `private_text_field`, app interaction and reminder outcomes. Check `source_created_at`, not only mirror time.
- `home_task_stream`: current task snapshots, including notes and structured links.
- `vbrain_device_commands`: existing authenticated device inbox. The v17 host polls on foreground heartbeat and an Android background job. Android can defer background polling; it is not an instant FCM push service.

A private `ui_patch` command contains a partial adaptive config. It is stored privately on the device and merged after public defaults; include an explicit empty/false value to clear a previous field. A private `notification` command supports `title`, `body`, `target` (`home`, `todos`, `calendar`, `tube`, `gym`), optional `taskId`, and epoch-millisecond `atMillis`. Use a finite `expires_at` on the command. Commands are acknowledged only after native persistence. `notification_delivered` means an OS notification was posted; `notification_opened` means it was tapped. Neither means its task was completed.

Reminders are limited to two daily, quiet 22:00–08:00 in device local time, persisted and restored after reboot. Taps route to the target, snooze delays an hour, completed task reminders are suppressed. Notification permission is still required. Ordinary Android alarms are approximate.

## Evidence and verification

An upload or green build is not proof that the phone installed or loaded it. Require a private `runtime_ready`/`runtime_heartbeat` with nativeVersion 17 and the expected manifest version before claiming a device update. The app connection panel shows loaded version, last update check, pending writes and last backend acknowledgement.

CI validates the exact APK's UI hash, browser interactions, and a real Android WebView instrumented test for native Back, full UI activation, storage continuity and failed-update rollback. Browser/native tests use isolated synthetic data without production credentials. Preserve the v8 brain, one working Gym card, stable home layout and local-first drafts.
