# StackPilot

Terminal control plane for managing sites across providers.

## Status

New project scaffolded from the SpinUpWP TUI core. Provider-agnostic model and first adapter layer still need to be defined.

## Current Scope

- Three provider integrations: Vercel (projects + account-wide deployments + plan), Netlify (sites + per-site deploy history + plan), Cloudflare (Pages projects + deployments, zones, Workers scripts)
- Cross-provider dashboard: summary card per provider (connection health, site/failed/building counts, plan, last deploy), merged all-sites list, merged recent activity, and a "needs attention" feed of failed deploys
- Dedicated page per provider with a sites list, details pane (status, repo, branch, stack, domains, URL, last deploy), and deployment history for the selected site
- All providers load in parallel at startup; `r` refreshes everything
- Navigation: number keys `1`–`4` switch pages, Tab cycles panels, `↑↓`/`j k` move, Enter on a dashboard site jumps to its provider page
- Actions: `o` opens the site URL, `g` the repo, `d` the deploy inspector/logs, `a` the provider admin page (Netlify/Cloudflare), `?` shows a help overlay
- Header shows per-provider health dots (green loaded / amber loading / red error / dim unconfigured)

## Setup

1. Copy `.env.example` to `.env`.
2. Add the tokens for the providers you use:
   - `VERCEL_TOKEN` (optionally `VERCEL_TEAM_ID` to scope to a team)
   - `NETLIFY_API_KEY` (personal access token)
   - `CLOUDFLARE_API_TOKEN` with read access to Pages, Workers Scripts, and Zone (optionally `CLOUDFLARE_ACCOUNT_ID`; otherwise the first visible account is used)
3. Run `bun install` and `bun run dev`.

Providers without a token show as "not configured" and the rest of the app works normally.

## Working Agreement

- When a feature lands, update `README.md`, `CHANGELOG.md`, and `package.json` version together.
- Keep `CHANGELOG.md` in Keep a Changelog format under `## [Unreleased]` until a release is cut.
- Use semantic versioning for releases: feature work bumps the minor version, fixes/docs bump patch versions.

## Release Notes

The release process lives in `RELEASING.md`. Follow it for every version bump and tag.
