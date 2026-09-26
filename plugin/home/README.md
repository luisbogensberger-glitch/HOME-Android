# Veqrya – Personal OS plugin

This folder contains the public plugin package for Veqrya. The plugin is intentionally smaller than the private mobile build: it exposes secure task and learning workflows to ChatGPT/Codex and leaves phone-level notification/accessibility experiments out of the public integration.

## Live architecture

- `plugin/home/plugin.json` — portable Agent Plugins manifest for Veqrya.
- `plugin/home/.mcp.json` — production MCP connection for the public plugin.
- `plugin/home/skills/` — Veqrya workflow guidance for daily planning, task capture, and Tube Learning.
- `supabase/migrations/20260925143000_home_plugin.sql` — per-user tables and Row Level Security.
- `supabase/functions/home-mcp/index.ts` — authenticated MCP implementation and source of truth for task/learning tools.
- Supabase Auth — OAuth 2.1 + PKCE + dynamic client registration for ChatGPT/Codex account linking.
- Supabase `home-auth` Edge Function — production Veqrya login/OAuth-consent UI.
- Vercel `home-personal-os-plugin` — stable public plugin host, website/legal routes, OAuth Protected Resource Metadata, `/mcp` proxy, and OpenAI domain-verification challenge route.

The Vercel project keeps its existing technical name during the Veqrya rebrand. The public product name is Veqrya.

Production host:

`https://home-personal-os-plugin.vercel.app`

Production MCP URL:

`https://home-personal-os-plugin.vercel.app/mcp`

OAuth consent UI:

`https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/home-auth/oauth/consent`

ChatGPT/Codex provides the reasoning layer, so the public plugin does not require a separate publisher-owned OpenAI API key for ordinary planning or learning evaluation.

## Production state

Completed:

1. Production Supabase project is live in `eu-west-2`.
2. Task/learning schema and owner-only Row Level Security are applied.
3. Supabase OAuth 2.1 Server is enabled.
4. Dynamic OAuth client registration is enabled.
5. Authorization Path is `/oauth/consent`.
6. Production HTTPS Veqrya consent UI is deployed.
7. OAuth/OIDC discovery is available, including authorization, token, UserInfo, JWKS, dynamic-registration, and PKCE metadata.
8. JWT signing is asymmetric ES256 / EC P-256.
9. MCP Edge Function is deployed.
10. Public Vercel gateway is deployed and Vercel Authentication is disabled for production access.
11. Veqrya homepage, privacy, terms and support routes are live.
12. OAuth Protected Resource Metadata is reachable.
13. Unauthenticated `/mcp` access returns 401 and advertises the protected-resource metadata endpoint.
14. Production-contract CI validates the live public surface and currently passes.
15. The plugin manifest is Veqrya-branded and points to the current production host.

Before public directory submission:

1. Validate the complete MCP OAuth flow and tools with ChatGPT Developer Mode / MCP Inspector.
2. Create and seed a dedicated OpenAI reviewer demo account with accessible credentials and no blocking MFA/confirmation step.
3. Create the OpenAI `With MCP` submission draft.
4. Put the portal-provided verification token at `/.well-known/openai-apps-challenge` and verify the domain.
5. Complete the real publisher/legal/support identity and policy attestations.
6. Scan tools, attach the five positive and three negative tests in `SUBMISSION.md`, provide demo credentials/material, and submit only after final validation.

## Mobile relationship

The public Android and iOS Veqrya clients use the same Supabase account-isolated data plane as the ChatGPT connector. A user who connects ChatGPT with the same Veqrya account sees the same task and learning data while Row Level Security keeps other users' rows inaccessible.

The mobile clients do not ask users to paste reusable AI-provider API keys into the app. Claude and Gemini are planned connectors rather than simulated integrations.
