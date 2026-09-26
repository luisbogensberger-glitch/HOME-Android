# Veqrya Store Metadata v1

Prepared for Google Play and Apple App Store. This file contains only product copy and release-review notes; publisher identity, postal address, support email, legal controller details, pricing, and availability countries must be entered by the verified publisher before submission.

## Product identity

- App name: **Veqrya**
- Bundle / package: `com.veqrya.app`
- Primary category: **Productivity**
- Secondary category: **Education**
- Version: `1.0.0`
- Public positioning: personal execution and learning layer

## Apple App Store

### Subtitle

**Plan. Learn. Execute.**

### Promotional text

Veqrya turns tasks, daily planning, learning and connected AI workflows into one calm personal operating layer.

### Description

Veqrya brings your daily execution and learning into one focused place.

Capture and organize tasks, plan your day from what actually matters, review your schedule, and use Tube Learning for short, deliberate learning sessions. Veqrya is designed to stay simple on the surface while your personal system becomes more useful over time.

Key features:
- Tasks with status, notes, priorities and optional due times
- Daily planning built from your current Veqrya data
- Calendar access for a clearer view of your day
- Tube Learning cards, recall and reflection
- Secure Veqrya account with cross-device data
- In-app account deletion
- AI connections designed to use the same Veqrya account and data layer

Veqrya does not require you to paste reusable AI-provider API keys into the first public mobile release. Public AI-provider availability depends on the relevant provider's integration and review process.

### Keywords

`productivity,tasks,planner,learning,focus,calendar,study,personal,organizer,AI`

### App Review notes

Veqrya is a productivity and learning app backed by Supabase Auth and per-user Row Level Security. The submitted build excludes the private Android WhatsApp Accessibility and notification-listener experiments and does not download executable JavaScript after review. The reviewed web UI is bundled in the submitted binary.

The app supports account creation/sign-in, task and learning data sync, calendar access where the user grants permission, privacy/support links, and in-app account deletion.

AI connections are surfaced as integrations. Do not represent an AI provider as publicly available until that provider's integration has actually passed its own review and is publicly accessible.

### Screenshot order

1. Home dashboard — three primary Veqrya cards / daily overview
2. Tasks — clean task list and detail view
3. Calendar — focused daily/weekly calendar view
4. Tube Learning — learning card + quiz/reflection
5. AI Connections — provider connection screen
6. Account / privacy — secure account and deletion controls

Suggested screenshot captions:
- **Your day, in one view**
- **Turn plans into action**
- **See what matters next**
- **Replace scrolling with learning**
- **Connect your AI workflow**
- **Your data. Your account.**

## Google Play

### Short description

**Tasks, planning, calendar and deliberate learning in one personal system.**

### Full description

Veqrya is a personal execution and learning system built to keep everyday planning simple.

Use Veqrya to capture tasks, organize priorities, plan your day, review your calendar and learn in short focused sessions through Tube Learning. Your Veqrya account keeps supported data available across your devices and connected Veqrya integrations.

Features include:
- Task capture, notes, priorities and completion
- Daily planning from your current tasks
- Calendar views
- Tube Learning cards and reflection
- Secure account-based sync
- In-app account deletion
- AI connection architecture using the same Veqrya account and data layer

The public Store build excludes private notification scraping and Android Accessibility experiments. Veqrya does not require a reusable AI-provider API key to be pasted into the first public mobile release.

### Suggested tags

- Productivity
- Planner
- Task management
- Education
- Personal organization

## Data-safety / privacy preparation

Final declarations must be generated from the actual release binaries and final backend configuration. Current expected data categories include:

- Account identifiers / email for authentication
- User-created tasks and task notes
- Optional task due times, priorities and areas
- Learning cards, reflections and progress
- App settings such as timezone preferences
- Minimal technical logs required for security and reliability
- Calendar data only when the user grants the relevant platform permission and uses calendar features

Current public Store builds are designed not to collect WhatsApp content, SMS, contacts, precise location, Android Accessibility data, or notification contents.

Before submission, verify each Store privacy question against the final binary and production processors rather than copying this section blindly.

## Release fields that still require publisher input

- Verified developer / seller identity
- Support email and support URL
- Privacy contact and controller identity
- Postal address where required
- Countries / regions of availability
- App price / monetization choice
- Age rating questionnaire
- Final privacy policy and terms URLs
- Apple Developer Team ID / signing
- Google Play developer account / upload signing setup
- App Store Connect and Play Console records

Do not invent these fields from repository data or user profile information.
