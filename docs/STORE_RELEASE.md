# Veqrya Store Release v1

Status: implementation branch for public Android + iOS distribution. The private/personal build on `main` remains separate.

## Current architecture

Veqrya uses one account-isolated data plane across the mobile apps and AI connectors:

1. **Veqrya mobile app** — native Android/iOS shell, bundled reviewed UI assets, local cache and a per-user Supabase Auth session. Android protects session material with Android Keystore; iOS uses Keychain.
2. **Supabase** — Auth plus the shared `home_*` application tables. Row Level Security restricts every row to `auth.uid() = user_id`.
3. **Veqrya mobile API** — Supabase Edge Function `veqrya-mobile-api`. It preserves the existing mobile REST contract while reading and writing the same Supabase rows used by the AI connector.
4. **AI connector** — ChatGPT connects through the Veqrya MCP/plugin path and uses the same Veqrya account. The mobile app does not ask users to paste an OpenAI/Anthropic/Gemini API key and Veqrya does not fund model usage by default.

Production mobile API base:

`https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/veqrya-mobile-api`

Public technical checks:

- `/health` — service status
- `/privacy` — pre-release privacy baseline
- `/delete-account` — deletion instructions

Authenticated routes include the current mobile compatibility contract:

- `GET /api/snapshot`
- `GET /v1/snapshot`
- `GET|POST /api/tasks`
- `PATCH|DELETE /api/tasks/:id`
- `POST /api/cards`
- `POST /api/attempts`
- `POST /api/activity`
- `DELETE /api/account`

`POST /api/review-sentence` deliberately does **not** bill an AI model through the publisher. The app keeps its local learning-feedback fallback; AI-assisted reasoning is connected through the user's AI surface instead.

## Shared data model

The mobile app and ChatGPT connector use the same Supabase tables:

- `home_profiles`
- `home_tasks`
- `home_learning_cards`
- `home_learning_attempts`
- `home_activity`

All exposed tables have RLS enabled and owner-only policies. Store clients receive only a public Supabase client key plus their own user session. The Supabase service-role key is never embedded in Android or iOS.

Account deletion is performed server-side by the Veqrya mobile API. The application rows use foreign keys to `auth.users` with cascading deletion where applicable.

## AI connections

### ChatGPT

ChatGPT is the first connector. The Store apps now expose an **AI connections** entry. The user opens ChatGPT and connects the Veqrya connector with the same Veqrya account; both surfaces then operate on the same RLS-isolated data.

Public availability still depends on completing the OpenAI plugin submission/review. Until approval, the app must not claim that the connector is publicly listed.

### Claude / Gemini

These are intentionally shown only as planned providers. Do not add client-side provider API-key fields as a shortcut. A future provider integration should use an approved OAuth/connector architecture or another design that does not expose reusable provider secrets in the app binary or ordinary app storage.

## Store-build differences from the private build

- Public brand: **Veqrya**.
- Bundle/package identity prepared as `com.veqrya.app`.
- No shared `HOME_TOKEN`.
- No WhatsApp Accessibility Service or notification scraping.
- No remotely downloaded executable JavaScript in Store artifacts.
- Tube feed and reviewed adaptive UI code are bundled into the submitted binary.
- Android WebView universal file-origin access remains disabled.
- Account deletion is available in-app.
- AI model usage is not paid through a publisher-owned API key by default.

## Android / Google Play

`.github/workflows/build-store-android.yml` builds the Store source and validates Android API 36. For a signed release AAB configure:

- `HOME_STORE_API_URL` = the Veqrya mobile API base above
- `HOME_SUPABASE_URL` = the production Supabase project URL
- `HOME_SUPABASE_ANON_KEY` = the project's public client key
- Android upload-keystore secrets referenced by the workflow

Only the signed `Veqrya-store-release-aab` artifact belongs in Google Play. Do not publish the private debug APK.

## iOS / Apple App Store

`ios/HOMEStore` is a SwiftUI + WKWebView client generated with XcodeGen. It uses the same Veqrya account/mobile API, stores the user session in Keychain, supports task sync, EventKit calendar access, AI-connections UI, privacy/deletion links and in-app account deletion.

`.github/workflows/validate-store-ios.yml` builds an unsigned simulator target. A distributable App Store archive still requires the user's Apple Developer team/signing setup and App Store Connect record.

## Submission gates still requiring real publisher input

Before either public Store submission:

- Replace the privacy baseline with the real controller/developer legal identity, postal address, monitored privacy/support contact, exact data categories, purposes/lawful bases, retention periods, processors/subprocessors and transfer information for the actual launch regions.
- Complete Google Play Data safety and Apple App Privacy from the **actual release builds**.
- Verify in-app and external account deletion end-to-end with a disposable test account.
- Complete the ChatGPT plugin publisher identity, review account, domain challenge and final submission separately.
- Run Store pre-launch/TestFlight testing, dependency/security checks and crash testing on release artifacts.

This branch reduces technical and Store-policy risk; it is not a legal guarantee.
