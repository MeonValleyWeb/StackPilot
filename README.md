# StackPilot

Terminal control plane for managing sites across providers.

## Status

Active multi-provider TUI with provider-specific operational detail for Vercel, Netlify, and Cloudflare.

## Current Scope

- Three provider integrations: Vercel (projects + account-wide deployments + plan), Netlify (sites + per-site deploy history + plan), Cloudflare (Pages projects + deployment detail, zone health, Registrar expiry when permitted, Workers metadata + deployment history)
- Cross-provider dashboard: summary card per provider (connection health, site/failed/building counts, plan, last deploy), merged all-sites list, merged recent activity, and a "needs attention" feed of failed deploys
- Dedicated page per provider with selected-resource details and deployment history; Cloudflare adds focused Pages, Deployments, Zones, and Workers subviews
- All providers load in parallel at startup; `r` refreshes everything
- Navigation: number keys `1`–`4` switch pages, Tab cycles panels, `↑↓`/`j k` move, Enter on a dashboard site jumps to its provider page
- Actions: `o` opens the site URL, `g` the repo, `d` the deploy inspector/logs, `a` the provider admin page (Netlify/Cloudflare), `?` shows a help overlay
- Header shows per-provider health dots (green loaded / amber loading / red error / dim unconfigured)

## Setup

1. Copy `.env.example` to `.env`.
2. Add the tokens for the providers you use:
   - `VERCEL_TOKEN` (optionally `VERCEL_TEAM_ID` to scope to a team)
   - `NETLIFY_API_KEY` (personal access token)
   - `CLOUDFLARE_API_TOKEN` with read access to Pages, Workers Scripts, and Zone; optional Registrar read access adds registration expiry/renewal data (optionally `CLOUDFLARE_ACCOUNT_ID`; otherwise the first visible account is used)
3. Run `bun install` and `bun run dev`.

Providers without a token show as "not configured" and the rest of the app works normally.

## Development

Run the same checks used by CI before opening a pull request:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run build:binary
bun audit
```

The compiled executable is written to `dist/stackpilot`.

## Working Agreement

- When a feature lands, update `README.md`, `CHANGELOG.md`, and `package.json` version together.
- Keep `CHANGELOG.md` in Keep a Changelog format under `## [Unreleased]` until a release is cut.
- Use semantic versioning for releases: feature work bumps the minor version, fixes/docs bump patch versions.

## Release Notes

The release process lives in `RELEASING.md`. Follow it for every version bump and tag.
