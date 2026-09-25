# HOME – Personal OS plugin

This folder contains the public plugin package for HOME. The plugin is intentionally smaller than the private mobile build: it exposes secure task and learning workflows to ChatGPT/Codex and leaves phone-level notification/accessibility experiments out of the public integration.

## Live architecture

- `plugin/home/plugin.json` — portable Agent Plugins manifest.
- `plugin/home/.mcp.json` — production MCP connection for the public plugin.
- `plugin/home/skills/` — HOME workflow guidance for daily planning, task capture, and Tube Learning.
- `supabase/migrations/20260925143000_home_plugin.sql` — per-user tables and Row Level Security.
- `supabase/functions/home-mcp/index.ts` — authenticated HOME MCP implementation and source of truth for HOME tools.
- Supabase Auth — OAuth 2.1 + PKCE + dynamic client registration for ChatGPT/Codex account linking.
- Supabase `home-auth` Edge Function — production login/account-creation/OAuth-consent UI.
- Vercel `home-personal-os-plugin` — stable public plugin host, website/legal routes, OAuth Protected Resource Metadata, `/mcp` proxy, and OpenAI domain-verification challenge route.

Production host:

`https://home-personal-os-plugin-luisbogensberger-9259.vercel.app`

Production MCP URL:

`https://home-personal-os-plugin-luisbogensberger-9259.vercel.app/mcp`

ChatGPT/Codex provides the reasoning layer, so the public plugin does not need a separate OpenAI API key for ordinary planning or learning evaluation.

## Production state

Completed:

1. HOME Supabase project created in `eu-west-2`.
2. HOME task/learning schema and Row Level Security applied.
3. Supabase OAuth 2.1 Server enabled.
4. Dynamic OAuth client registration enabled.
5. Authorization Path set to `/oauth/consent`.
6. Production HTTPS consent UI deployed.
7. OAuth discovery verified, including authorization, token, JWKS, dynamic-registration, and PKCE metadata.
8. HOME MCP Edge Function deployed.
9. Public Vercel gateway deployed and Vercel Authentication disabled for production access.
10. Public website and OAuth Protected Resource Metadata are reachable.
11. Plugin manifest now points at the Vercel production host.

Before public directory submission:

1. Confirm production JWT signing is asymmetric (ES256 or RS256).
2. Validate the complete MCP OAuth flow and tools with ChatGPT Developer Mode / MCP Inspector.
3. Create and seed a dedicated OpenAI reviewer demo account.
4. Create the OpenAI `With MCP` submission draft.
5. Put the portal-provided verification token at `/.well-known/openai-apps-challenge` and verify the domain.
6. Complete the real publisher/legal/support identity and policy attestations.
7. Scan tools, attach the five positive and three negative tests in `SUBMISSION.md`, provide demo credentials/material, and submit for OpenAI review.

## Why this is the first public HOME release

A plugin avoids maintaining separate public Android and iOS experiences for the first launch, avoids sensitive phone permissions, and uses ChatGPT/Codex as the AI interaction layer. The native HOME clients can later become companion apps for widgets, offline/local features, richer calendar UI, and background device integrations.
