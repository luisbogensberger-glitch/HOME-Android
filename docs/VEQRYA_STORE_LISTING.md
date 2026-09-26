# Veqrya Store Listing Draft

_Pre-release metadata baseline — 26 September 2026_

This file is copy-ready for App Store Connect and Google Play Console, but the release must not be submitted until the final legal identity, privacy disclosures, signing, screenshots, and end-to-end account deletion tests are complete.

## Core positioning

**Public app name:** Veqrya

**One-line product definition:** An adaptive personal execution and learning layer for tasks, daily planning, calendar context, and deliberate learning.

**Primary category:** Productivity

**Secondary positioning:** Education / deliberate learning

The release copy must describe only functionality present in the submitted Store build. ChatGPT connection may be described as available only after the Veqrya ChatGPT connector has completed its own OpenAI publication/review path.

---

## Apple App Store

Apple currently limits the app name to 30 characters and allows localized product-page metadata. Final field limits must be rechecked in App Store Connect immediately before submission.

### Name

`Veqrya`

### Subtitle

`Your adaptive personal OS`

### Promotional text

`Bring tasks, planning and deliberate learning into one focused personal system that stays organized around you.`

### Description

`Veqrya is a focused personal execution and learning system built to turn plans into action without filling your day with noise.

CAPTURE WHAT MATTERS
Keep actionable tasks in one place, add useful context to each task, and mark work complete without losing the history behind it.

PLAN FROM REAL CONTEXT
See your current priorities alongside calendar context and build a realistic view of what deserves attention next.

LEARN IN SHORT, ACTIVE SESSIONS
Tube Learning turns spare moments into compact learning sessions with recall, application and reflection instead of passive scrolling.

ONE ACCOUNT, ONE DATA LAYER
Your Veqrya account keeps your tasks and learning data separated from other users. Supported Veqrya clients use the same account-isolated data layer.

AI CONNECTIONS
Veqrya is designed to work with supported AI connectors. The mobile app does not require you to paste a reusable AI-provider API key into ordinary app settings, and Veqrya does not fund model usage through a publisher-owned model key by default.

Veqrya is designed for personal organization and learning. It is not a substitute for professional medical, legal, financial or emergency advice.`

### Keywords

Keep the final keyword string within Apple's current 100-character keyword limit. Draft:

`productivity,tasks,planner,learning,focus,todo,calendar,personal os,study,habits`

### Support URL

**Required before submission:** public monitored Veqrya support page.

Do not use a placeholder contact in the final listing.

### Privacy Policy URL

**Required before submission:** final Veqrya privacy policy containing the verified controller/publisher identity and actual launch disclosures.

### Marketing URL

Optional. Prefer the public Veqrya product page once the Vercel public site has been rebranded from the old HOME wording.

### App Review notes draft

`Veqrya is a multi-user productivity and learning app. Reviewers can create a Veqrya account with email/password or use the dedicated review account supplied in App Store Connect.

Core review flow:
1. Sign in.
2. Open To-Dos and create a task.
3. Open that task to view/edit its stored details.
4. Mark the task complete and verify it moves to completed/archive state.
5. Open Calendar and grant calendar access if desired. Calendar permission is optional and used only to display the user's own device calendar context.
6. Open Tube Learning and complete a short learning interaction.
7. Open the account menu to see privacy/deletion controls and the AI-connections screen.
8. Account deletion is available in-app and permanently deletes the Veqrya account and associated Veqrya application data through the server-side deletion flow.

The public Store build does not contain WhatsApp Accessibility Service, notification scraping, or remotely downloaded executable JavaScript.`

### App Privacy preparation

Declare from the actual release build, not assumptions. Current technical design includes account identifiers, user-entered tasks/notes, learning content/progress, and minimal service/security logs. Calendar data is requested through EventKit only when the user grants access; final App Privacy answers must reflect exactly whether any calendar information leaves the device in the submitted build.

---

## Google Play

Google currently limits the app name to 30 characters, short description to 80 characters, and full description to 4,000 characters.

### App name

`Veqrya`

### Short description

`Tasks, planning and deliberate learning in one adaptive personal system.`

### Full description

`Veqrya brings tasks, daily planning and deliberate learning into one focused personal system.

CAPTURE ACTIONABLE TASKS
Save what you need to do, keep useful context with each task, update details, and move completed work out of the active list without losing structure.

PLAN WITH LESS NOISE
Use your current task list and optional calendar context to understand what matters now instead of maintaining several disconnected systems.

TURN SPARE MOMENTS INTO LEARNING
Tube Learning replaces passive scrolling with short, active sessions. Read one compact idea, test recall or application, and keep meaningful learning progress.

KEEP YOUR DATA ACCOUNT-ISOLATED
Veqrya uses authenticated accounts and per-user database access policies so one user's tasks and learning records are separated from another user's data.

CONNECT SUPPORTED AI SURFACES
Veqrya is designed to connect with supported AI experiences while keeping the Veqrya data layer separate. The mobile app does not require users to paste reusable AI-provider API keys into ordinary settings, and model usage is not billed through a publisher-owned AI key by default.

PUBLIC STORE BUILD
The public Android build intentionally excludes the private prototype's WhatsApp Accessibility and notification-listener experiments and does not load remotely hosted executable JavaScript.

Veqrya is a productivity and learning tool, not professional medical, legal, financial or emergency advice.`

### Data safety preparation

Complete Google Play Data safety from the exact production artifact. Current expected categories to verify include:

- Account information used for authentication.
- User-generated task titles, notes, priorities and due information.
- User-generated learning cards, reflections and learning progress.
- App activity / diagnostic data only to the extent actually collected in the release environment.
- Calendar access only if and as used by the submitted Android build.

Do not declare data as collected/shared solely because a permission exists; inspect the release behavior and production logging first. Conversely, do not omit server-side data merely because it was entered voluntarily by the user.

### Content rating / App content

Complete the Play Console questionnaire from the actual functionality. The current public build contains productivity and educational content and does not intentionally include gambling, sexual content, controlled substances, or user-to-user social posting features.

---

## Screenshot plan

Use screenshots from the final signed/release-equivalent builds rather than design mockups that show unavailable functions.

1. **Home** — Veqrya landing screen with the three main areas.
2. **Calendar** — clean daily calendar context.
3. **To-Dos** — active task list.
4. **Task detail** — notes/details/links structure.
5. **Tube Learning** — card selection and compact learning view.
6. **Learning quiz** — active recall interaction.
7. **Account / AI connections** — Veqrya account controls and supported/planned connector states, with planned providers clearly labelled as planned.

Avoid showing personal production data, real email addresses, API keys, tokens, or unpublished claims in Store screenshots.

## Release blockers

- Apple Developer membership/team + signing and App Store Connect app record.
- Google Play developer account + release signing configuration.
- Final public privacy policy and terms with verified legal publisher/controller identity and monitored contacts.
- Final support URL.
- Final Store screenshots from release-equivalent builds.
- Apple App Privacy and Google Play Data safety completed from actual release behavior.
- Disposable-account end-to-end test: sign-up/sign-in, task sync, learning sync, sign-out, account deletion.
- TestFlight / Play internal or closed testing before public production release.
- ChatGPT connector must not be advertised as publicly available until its separate OpenAI review/publication is complete.

## Current official metadata references

- Apple App Store product page: https://developer.apple.com/app-store/product-page/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple App Store Connect localization reference: https://developer.apple.com/help/app-store-connect/reference/app-information/app-store-localizations/
- Google Play app setup/store listing: https://support.google.com/googleplay/android-developer/answer/9859152?hl=en
- Google Play listing best practices: https://support.google.com/googleplay/android-developer/answer/13393723?hl=en
- Google Play Data safety: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
