# HOME – Personal OS plugin

This folder contains the public plugin package for HOME. The plugin is intentionally smaller than the private mobile build: it exposes secure task and learning workflows to ChatGPT/Codex and leaves phone-level notification/accessibility experiments out of the public integration.

## Architecture

- `plugin/home/plugin.json` — portable Agent Plugins manifest.
- `plugin/home/skills/` — HOME workflow guidance for daily planning, task capture, and Tube Learning.
- `supabase/migrations/20260925143000_home_plugin.sql` — per-user tables and Row Level Security.
- `supabase/functions/home-mcp/index.ts` — authenticated Streamable HTTP MCP server.
- Supabase Auth — OAuth 2.1 + PKCE + dynamic client registration for ChatGPT/Codex account linking.

ChatGPT/Codex provides the reasoning layer, so the public plugin does not need a separate OpenAI API key for ordinary planning or learning evaluation.

## Deploy

1. Create or connect the production Supabase project.
2. Switch JWT signing to ES256 or RS256.
3. Apply the HOME migration.
4. Enable Supabase OAuth 2.1 Server and dynamic client registration.
5. Configure the production Site URL and `/oauth/consent` authorization route.
6. Deploy `home-mcp` with gateway JWT verification disabled; the function performs MCP OAuth discovery and user-token verification itself.
7. The production MCP URL will be `https://<project-ref>.supabase.co/functions/v1/home-mcp`.
8. Test the endpoint with MCP Inspector and then ChatGPT Developer Mode.
9. Complete the public listing materials in `SUBMISSION.md`, host final HTTPS privacy/terms/support pages, verify the publisher identity and domain in OpenAI Platform, and submit through the plugin submission portal.

## Why this is the first public HOME release

A plugin avoids maintaining separate public Android and iOS experiences for the first launch, avoids sensitive phone permissions, and uses the ChatGPT/Codex host as the AI interaction layer. The native HOME clients can later become companion apps for widgets, offline/local features, richer calendar UI, and background device integrations.
