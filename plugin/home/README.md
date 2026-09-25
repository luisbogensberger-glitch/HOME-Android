# HOME – Personal OS plugin

This folder contains the public plugin package for HOME. The plugin is intentionally smaller than the private mobile build: it exposes secure task and learning workflows to ChatGPT/Codex and leaves phone-level notification/accessibility experiments out of the public integration.

## Architecture

- `plugin/home/plugin.json` — portable Agent Plugins manifest.
- `plugin/home/skills/` — HOME workflow guidance for daily planning, task capture, and Tube Learning.
- `supabase/migrations/20260925143000_home_plugin.sql` — per-user tables and Row Level Security.
- `supabase/functions/home-mcp/index.ts` — Supabase-hosted reference/dev MCP implementation.
- `plugin-server/` — production public Cloudflare MCP gateway, legal/support routes, and OpenAI domain-verification challenge endpoint.
- `plugin-auth/` — dedicated HOME login, account creation, and OAuth consent frontend with its browser client bundled locally.
- Supabase Auth — OAuth 2.1 + PKCE + dynamic client registration for ChatGPT/Codex account linking.

ChatGPT/Codex provides the reasoning layer, so the public plugin does not need a separate OpenAI API key for ordinary planning or learning evaluation.

## Deploy

1. Connect the production Supabase project.
2. Switch JWT signing to ES256 or RS256.
3. Apply `supabase/migrations/20260925143000_home_plugin.sql`.
4. Enable Supabase OAuth 2.1 Server and dynamic client registration.
5. Run `.github/workflows/deploy-home-plugin.yml` after configuring its Cloudflare/Supabase GitHub secrets and variables.
6. Set the Supabase Auth Site URL to the deployed `home-personal-os-auth` Worker origin and the Authorization Path to `/oauth/consent`.
7. The public plugin MCP endpoint is the deployed `home-personal-os-plugin` Worker URL plus `/mcp`.
8. Test account linking and every tool in ChatGPT Developer Mode.
9. Create the OpenAI public-plugin draft with that MCP URL. When the portal produces its domain-verification token, rerun the deployment workflow with the token so `/.well-known/openai-apps-challenge` returns it exactly.
10. Scan tools, add the review materials from `SUBMISSION.md`, complete verified publisher details, demo recording/credentials, and submit for OpenAI review.

## Why this is the first public HOME release

A plugin avoids maintaining separate public Android and iOS experiences for the first launch, avoids sensitive phone permissions, and uses ChatGPT/Codex as the AI interaction layer. The native HOME clients can later become companion apps for widgets, offline/local features, richer calendar UI, and background device integrations.
