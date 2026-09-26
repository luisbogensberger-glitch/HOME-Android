# Veqrya Privacy Policy

_Last updated: 26 September 2026_

Veqrya is a personal productivity and learning service that can be used through ChatGPT/Codex and through Veqrya mobile clients.

## Controller

Before public release, replace this section with the verified publisher's legal name, postal address, privacy contact email, and any other controller information required in the launch jurisdictions. Do not publish this draft with placeholder controller information.

## Data Veqrya processes

Depending on the features a user chooses to use, Veqrya may process:

- account identifiers and authentication information handled through Supabase Auth;
- tasks, notes, task status, due times, areas, and priorities that the user chooses to store;
- learning cards, reflections, feedback, and optional learning scores that the user chooses to store;
- profile settings needed to provide the service, such as timezone preferences;
- minimal technical logs needed for security, reliability, abuse prevention, and debugging.

The public Veqrya plugin does not require precise device location, contacts, SMS, WhatsApp content, Android Accessibility data, or notification scraping. The public Store builds likewise exclude the private Android WhatsApp Accessibility and notification-listener experiments.

## How the data is used

Veqrya uses stored data to provide actions the user requests, such as listing tasks, creating or updating a task, planning from stored information, and saving learning progress. ChatGPT/Codex provides the conversational reasoning layer and may send information required for a selected Veqrya tool call to Veqrya's MCP server.

The Android and iOS Veqrya apps and the ChatGPT connector use the same account-isolated Supabase data plane when the user signs in with the same Veqrya account.

Veqrya does not sell personal data.

## AI services

Veqrya does not require users to paste a reusable OpenAI, Anthropic, or Google AI API key into the mobile app for the first public release. ChatGPT/Codex reasoning is provided through the user's OpenAI surface and remains subject to the user's applicable OpenAI terms and privacy controls. Additional AI-provider integrations must be described here before they are enabled publicly.

## Service providers

The current technical design uses Supabase for authentication, database storage, Row Level Security, serverless functions, and OAuth 2.1 identity services, and uses Vercel for the stable public MCP/plugin gateway. ChatGPT/Codex is operated by OpenAI. Before release, this section must be completed with the exact production processors/subprocessors, processing regions, contracts, and international-transfer mechanisms actually used.

## Retention

Veqrya data should be retained only for as long as needed to provide the service or meet applicable legal obligations. Before public release, this policy must state concrete retention periods or objective retention criteria for account data, application data, backups, security logs, and deletion requests.

## User controls and deletion

Users can disconnect the Veqrya plugin from ChatGPT/Codex and can sign out of the mobile app. The mobile app includes an account-deletion action backed by the Veqrya server-side deletion flow. The production service must also publish a monitored support/privacy contact and a usable external deletion-request route before Store submission.

The current technical deletion instructions are available from the Veqrya mobile API at `/delete-account`; final public policy text must use the production public URL selected for launch.

## Security

Veqrya uses authenticated access and per-user database policies designed to prevent one user from accessing another user's rows. The current production data model uses owner-only Row Level Security. Production systems should continue to use encrypted transport, asymmetric token signing, least-privilege credentials, secret management, rate limits, dependency updates, and security monitoring.

## Children

The public Veqrya service is not intended to knowingly collect personal data from children where parental consent or another special authorization would be required by applicable law. The final age eligibility wording must match the actual launch regions and Store declarations.

## Changes

Material changes to this policy will be reflected by updating the date above and, where required, notifying users through the service.

## Contact

Before public release, add the monitored privacy contact and verified publisher/controller identity here. Do not invent or infer these details.
