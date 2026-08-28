# StackPilot

Terminal control plane for managing sites across providers.

## Status

Active, read-only multi-provider TUI with provider-specific operational detail for Vercel, Netlify, and Cloudflare.

## Features

- **[Unified dashboard](#unified-dashboard).** Review provider health, every visible site, recent deployments, and failures that need attention in one place.
- **[Provider views](#provider-views).** Inspect Vercel, Netlify, and Cloudflare resources with provider-specific project, deployment, zone, Registrar, and Worker detail.
- **[Read-only browser shortcuts](#read-only-browser-shortcuts).** Open sites, repositories, deployment inspectors, and provider dashboards without changing live infrastructure.
- **[Connection and refresh](#connection-and-refresh).** Load configured providers in parallel, keep unconfigured providers optional, and refresh all data on demand.

## Keybindings

| Key | Where | Action |
| --- | --- | --- |
| `1`–`4` | Anywhere | Switch between Dashboard, Vercel, Netlify, and Cloudflare. |
| `Tab` | Current page | Cycle the page's panels. |
| `↑` / `↓` or `j` / `k` | Current panel | Move the selection. |
| `Enter` | Dashboard | Open the selected site's provider page. |
| `o` | Dashboard/provider page | Open the selected site, domain, or deployment URL. |
| `g` | Provider page | Open the selected site's Git repository. |
| `d` | Dashboard/provider page | Open the deployment inspector or Cloudflare deployment URL. |
| `a` | Netlify/Cloudflare | Open the provider administration page. |
| `r` | Anywhere | Refresh all configured providers. |
| `?` | Anywhere | Toggle the in-app help. |
| `Esc` | Help | Close the help overlay. |
| `q` or `Ctrl+C` | Anywhere | Quit StackPilot. |

## How it works

### Unified dashboard

Each configured provider contributes a health summary, normalized site list, recent deployment activity, and failed deployments. Selecting a dashboard site and pressing `Enter` opens the matching provider view with that site selected.

### Provider views

- **Vercel:** projects, account-wide deployment history, plan information, repositories, and deployment inspectors.
- **Netlify:** sites, per-site deployment history, plan information, repositories, deployment pages, and the Netlify administration page.
- **Cloudflare:** Pages projects and deployments, Zone health, optional Registrar expiry and renewal data, Workers metadata, and per-script deployment history.

### Read-only browser shortcuts

StackPilot currently makes read-only provider API requests. It does not create, update, delete, or deploy provider resources. The `o`, `g`, `d`, and `a` shortcuts only open existing URLs in your browser.

### Connection and refresh

Configured providers load in parallel at startup. The header health indicators show loaded, loading, failed, and unconfigured providers; press `r` to refresh all configured providers without restarting the app.

## Setup

1. Copy `.env.example` to `.env`.
2. Add the tokens for the providers you use:
   - `VERCEL_TOKEN` (optionally `VERCEL_TEAM_ID` to scope to a team)
   - `NETLIFY_API_KEY` (personal access token)
   - `CLOUDFLARE_API_TOKEN` with read access to Pages, Workers Scripts, and Zone; optional Registrar read access adds registration expiry/renewal data (optionally `CLOUDFLARE_ACCOUNT_ID`; otherwise the first visible account is used)
3. Run `bun install` and `bun run dev`.

Providers without a token show as "not configured" and the rest of the app works normally.

## Development

Run the CI install, type-check, test, and build checks before opening a pull request, followed by the local dependency audit:

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
