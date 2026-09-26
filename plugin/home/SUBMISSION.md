# Veqrya public plugin submission

## Product shape

Veqrya v1 is a skills + authenticated remote MCP plugin. ChatGPT/Codex provides the reasoning layer; Veqrya stores only the signed-in user's Veqrya data and performs explicit tool actions.

This public integration is intentionally narrower than the standalone Veqrya mobile app. The plugin focuses on task capture, daily planning, and deliberate learning. Device-level features such as notification scraping, Android Accessibility Service, widgets, and background phone automation are not part of the public plugin.

## Production endpoints

- **Website:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/
- **MCP:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/mcp
- **OAuth protected-resource metadata:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/.well-known/oauth-protected-resource
- **OAuth authorization server:** https://skgmgxthymnzubbobqxu.supabase.co/auth/v1
- **OAuth consent UI:** https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-auth/oauth/consent
- **OIDC UserInfo:** https://skgmgxthymnzubbobqxu.supabase.co/auth/v1/oauth/userinfo
- **Support:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/support
- **Privacy:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/privacy
- **Terms:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/terms
- **OpenAI domain challenge:** https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/.well-known/openai-apps-challenge

The OpenAI challenge route intentionally returns 404 until the submission portal provides the exact verification token. The existing Vercel MCP origin remains stable during the Veqrya rebrand so an eventual published integration does not depend on an avoidable origin change.

## Listing draft

- **Name:** Veqrya – Personal OS
- **Short description:** Turn ChatGPT into a personal execution layer for tasks, daily planning, and deliberate learning.
- **Category:** Productivity
- **Long description:** Veqrya keeps a private task and learning layer behind ChatGPT. Capture actionable to-dos, review what is open, build a realistic daily plan, mark work complete, and save short learning cards and recall attempts. Each account is isolated with Supabase Auth and Row Level Security.
- **Default prompt:** Plan my day from my Veqrya tasks and tell me the single best next action.

## Starter prompts

1. `Plan my day from my Veqrya tasks.`
2. `Add “Research societies” to my Veqrya tasks and put the details in the note.`
3. `What are my open Veqrya tasks right now?`
4. `Give me a five-minute Tube Learning session from one of my active Veqrya learning cards.`
5. `I finished the UCL merchandising task — mark it complete.`

## Required positive review tests

Exactly five positive cases for the submission portal:

1. **Read tasks** — Prompt: `What do I still need to do?` Expected: calls `list_tasks` or `get_home_snapshot`, returns only the demo user's Veqrya tasks.
2. **Create task** — Prompt: `Add “Book dentist appointment” to Veqrya.` Expected: calls `create_task` once with a concise title; no invented due date.
3. **Complete task** — Prompt: `I finished the dentist task. Mark it done.` Expected: resolves the existing task and calls `complete_task`; does not delete it.
4. **Daily plan** — Prompt: `Plan my day from Veqrya.` Expected: reads Veqrya data before planning and produces a realistically small prioritized plan without changing task state.
5. **Learning** — Prompt: `Quiz me on one of my Veqrya learning cards and save my attempt after I answer.` Expected: reads an active card, asks for recall/application, evaluates the answer, then calls `save_learning_attempt` only after the user's response.

## Required negative review tests

Exactly three negative cases for the submission portal:

1. **No silent writes** — Prompt: `What should I do today?` Expected: reads Veqrya data but does not create, complete, archive, or delete tasks.
2. **No invented deadline** — Prompt: `Add “Call Alex” to Veqrya.` Expected: creates the task without a due time because none was supplied.
3. **No unrelated activation** — Prompt: `Explain photosynthesis.` Expected: Veqrya tools are not required unless the user explicitly asks to save the explanation or use Tube Learning.

## Tool safety annotations

- Read tools: `readOnlyHint=true`, `openWorldHint=false`, `destructiveHint=false`.
- Create/update/complete tools: non-read-only, non-open-world, non-destructive.
- Delete tools, when exposed, must set `destructiveHint=true` and must be used only for explicit deletion requests.

## Authentication

The production server uses Supabase Auth as an OAuth 2.1 authorization server with PKCE and dynamic client registration. Vercel is the stable public MCP host and publishes OAuth Protected Resource Metadata that points clients to the Supabase authorization server. Supabase Row Level Security isolates each signed-in user's data.

Verified production state:

1. OAuth 2.1 server enabled.
2. Dynamic client registration enabled.
3. Authorization path is `/oauth/consent`.
4. Production Veqrya consent UI is HTTPS-hosted and implements login, `getAuthorizationDetails`, approve, deny, and secure redirects for the supplied `authorization_id`.
5. OAuth/OIDC discovery publishes authorization, token, UserInfo, JWKS, dynamic-registration, response-type, grant-type, and PKCE metadata.
6. Supabase JWT signing is asymmetric **ES256**, with an `EC` / `P-256` signing key in public JWKS.
7. Vercel production deployment is public rather than protected by Vercel Authentication.
8. Unauthenticated `/mcp` requests return **401 Unauthorized**.
9. Protected Resource Metadata is published on the same Vercel origin and identifies the Vercel `/mcp` resource plus the Supabase OAuth authorization server.
10. OAuth `openid email profile` scopes and the UserInfo endpoint support the identity information needed by compatible clients without exposing a reusable service credential.

Before public review:

1. Create a fully featured demo reviewer account with sample Veqrya data and no inaccessible 2FA or confirmation blocker.
2. Validate the complete interactive OAuth flow and tool scan in ChatGPT Developer Mode / MCP Inspector.
3. Create the OpenAI `With MCP` submission draft for the production MCP URL.
4. Insert the exact OpenAI domain-verification token at `/.well-known/openai-apps-challenge` and verify the domain.
5. Complete publisher identity verification and final legal/support identity fields; do not invent them.
6. Submit only after the authenticated reviewer flow and final review materials are validated.

## Data handling

- Per-user rows are protected with Row Level Security and `auth.uid()` ownership checks.
- Veqrya does not need its own OpenAI API key for plugin reasoning; ChatGPT/Codex performs reasoning and calls Veqrya tools.
- Tool inputs and results contain only the data needed for the active workflow.
- No Android notification/Accessibility/WhatsApp scraping is exposed through the public plugin.
- Production logging must not store access tokens or unnecessary raw personal content.

## Release notes draft

Initial public submission of Veqrya – Personal OS. Adds authenticated per-user task management, daily-planning workflows, and deliberate-learning workflows through a remote MCP server backed by Supabase Auth and Row Level Security. The public plugin intentionally excludes device-level notification and Accessibility integrations from the private mobile build.
