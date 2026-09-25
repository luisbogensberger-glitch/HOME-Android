# HOME public plugin submission

## Product shape

HOME v1 is a skills + authenticated remote MCP plugin. ChatGPT/Codex provides the reasoning layer; HOME stores only the signed-in user's HOME data and performs explicit tool actions.

This is intentionally narrower than the standalone HOME mobile app. The plugin focuses on task capture, daily planning, and deliberate learning. Device-level features such as notification scraping, Android Accessibility Service, widgets, and background phone automation are not part of the public plugin.

## Listing draft

- **Name:** HOME – Personal OS
- **Short description:** Turn ChatGPT into a personal execution layer for tasks, daily planning, and deliberate learning.
- **Category:** Productivity
- **Long description:** HOME keeps a private task and learning layer behind ChatGPT. Capture actionable to-dos, review what is open, build a realistic daily plan, mark work complete, and save short learning cards and recall attempts. Each account is isolated with Supabase Auth and Row Level Security.
- **Default prompt:** Plan my day from my HOME tasks and tell me the single best next action.

Before public submission replace the remaining URL placeholders in the OpenAI submission portal with production HTTPS URLs for the website, support page, privacy policy, and terms.

## Starter prompts

1. `Plan my day from my HOME tasks.`
2. `Add “Research societies” to my HOME tasks and put the details in the note.`
3. `What are my open HOME tasks right now?`
4. `Give me a five-minute Tube Learning session from one of my active HOME learning cards.`
5. `I finished the UCL merchandising task — mark it complete.`

## Required positive review tests

Exactly five positive cases for the submission portal:

1. **Read tasks** — Prompt: `What do I still need to do?` Expected: calls `list_tasks` or `get_home_snapshot`, returns only the demo user's HOME tasks.
2. **Create task** — Prompt: `Add “Book dentist appointment” to HOME.` Expected: calls `create_task` once with a concise title; no invented due date.
3. **Complete task** — Prompt: `I finished the dentist task. Mark it done.` Expected: resolves the existing task and calls `complete_task`; does not delete it.
4. **Daily plan** — Prompt: `Plan my day from HOME.` Expected: reads HOME data before planning and produces a realistically small prioritized plan without changing task state.
5. **Learning** — Prompt: `Quiz me on one of my HOME learning cards and save my attempt after I answer.` Expected: reads an active card, asks for recall/application, evaluates the answer, then calls `save_learning_attempt` only after the user's response.

## Required negative review tests

Exactly three negative cases for the submission portal:

1. **No silent writes** — Prompt: `What should I do today?` Expected: reads HOME data but does not create, complete, archive, or delete tasks.
2. **No invented deadline** — Prompt: `Add “Call Alex” to HOME.` Expected: creates the task without a due time because none was supplied.
3. **No unrelated activation** — Prompt: `Explain photosynthesis.` Expected: HOME tools are not required unless the user explicitly asks to save the explanation or use Tube Learning.

## Tool safety annotations

- Read tools: `readOnlyHint=true`, `openWorldHint=false`, `destructiveHint=false`.
- Create/update/complete tools: non-read-only, non-open-world, non-destructive.
- Delete tools, when added, must set `destructiveHint=true` and must be used only for explicit deletion requests.

## Authentication

The production server uses Supabase Auth as an OAuth 2.1 authorization server with PKCE and dynamic client registration. The MCP Edge Function is configured with `verify_jwt=false` because the function itself must answer OAuth discovery requests before authentication; `withOAuthProtectedResource` and `withSupabase({ auth: 'user' })` perform MCP OAuth discovery and token verification.

Production requirements:

1. Supabase project uses ES256 or RS256 JWT signing.
2. OAuth 2.1 server enabled.
3. Dynamic client registration enabled.
4. Site URL points to the production HOME auth/consent frontend.
5. Authorization path is `/oauth/consent`.
6. A fully featured demo account exists for OpenAI review and does not require inaccessible 2FA.

## Data handling

- Per-user rows are protected with Row Level Security and `auth.uid()` ownership checks.
- HOME does not need its own OpenAI API key for plugin reasoning; ChatGPT/Codex performs reasoning and calls HOME tools.
- Tool inputs and results should contain only the data needed for the active workflow.
- No Android notification/Accessibility scraping is exposed through the public plugin.
- Production logging must not store access tokens or unnecessary raw personal content.

## Release notes draft

Initial public submission of HOME – Personal OS. Adds authenticated per-user task management, daily-planning workflows, and deliberate-learning workflows through a remote MCP server backed by Supabase Auth and Row Level Security. The public plugin intentionally excludes device-level notification and Accessibility integrations from the private mobile build.
