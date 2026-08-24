# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- Paginate Cloudflare Pages project requests within the API's ten-project page limit.
- Show a proper empty state after Pages or Worker deployment history finishes loading with no results.
- Write compiled binaries to the ignored `dist/` directory instead of leaving an untracked file in the project root.

### Added
- Netlify provider client (sites, per-site deploy history, account/plan) via `NETLIFY_API_KEY`.
- Cloudflare provider client (Pages projects + deployments, zones, Workers scripts, account auto-discovery) via `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`.
- Shared data layer that loads all three providers in parallel; `r` refreshes everything.
- Cross-provider dashboard: per-provider summary cards (connection, sites, failed/building, plan, last deploy), merged all-sites list, merged recent activity, and a "needs attention" feed of failed deploys.
- Dedicated provider pages: Vercel (projects, details, deployment feed), Netlify (sites, details, lazy per-site deploys, `a` opens admin), Cloudflare (Pages projects, deployments, zones, Workers, `a` opens dash).
- Enter on a dashboard site jumps to its provider page with that site pre-selected.
- Help overlay on `?` listing all keybindings; tab-style header with per-provider health dots.
- Cloudflare Zone operational details, optional Registrar expiry/renewal data, and Worker metadata with per-script deployment history.

### Changed
- Panels now draw real rounded borders with embedded titles instead of flat text headers.
- Status colors/dots understand Netlify and Cloudflare state vocabularies (`ready`, `success`, `failure`, `enqueued`, `paused`, …).
- Footer status bar is rendered once by the app shell with per-page hints and a global refresh/help/quit set.
- Cloudflare now uses focused Pages, Deployments, Zones, and Workers subviews with selected-resource details.
- Cloudflare deployment actions open the API-provided deployment URL instead of an unreliable constructed dashboard deep link.

### Removed
- The single Vercel-only dashboard view (`Sites.tsx`), superseded by the dashboard and provider pages.
- Initial StackPilot scaffold.
- Neutral OpenTUI shell and minimal CLI entrypoint.
- Versioned package metadata and release log.
- First provider-agnostic domain model (`Provider`, `Site`, `Deploy`).
- Basic site list screen with provider/status display and action hints.
- Vercel-backed project loading via `VERCEL_TOKEN`.
- Dashboard layout with boxed focusable panels, recent deploys at the bottom, failed deploys, navigation, and per-site details pane.
- Site details now include repo, stack, domains, last deploy, deployment URL, and browser-open action.
- Enter now opens a dedicated site page for deeper provider/API-specific probing.
- Current design iteration adds boxed panels, site drill-down, and open-url affordances.
- Site drill-down now surfaces deploy/domain/url panels and a usage placeholder until the API exposes a readable endpoint.
- Selected site details now refresh from the provider API so the stale list snapshot no longer drives the details pane.
- Box focus now cycles with Tab, with `o`/`g`/`d` shortcuts and a create-site scaffold page on `c`.
- Top bar now shows the Vercel billing plan/status exposed by the token.
- Number keys now jump to Dashboard/Vercel/Netlify/Cloudflare pages, and the dashboard is rendered as a compact visible grid.

## [0.1.0] - 2026-06-29

### Added
- Initial StackPilot repository and remote setup.
- First provider-agnostic terminal scaffold.
- Basic versioning and changelog structure for future releases.
