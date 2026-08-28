# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.1] - 2026-08-28

### Added
- Add automated coverage across the Vercel, Netlify, and Cloudflare provider clients for request scoping, normalization, account data, encoded resource IDs, optional permissions, and API failures.

### Changed
- Refresh the Bun toolchain, terminal UI, React, and TypeScript dependencies, and keep OpenTUI updates within the tested `0.5` release line.
- Document the full keyboard controls, provider views, and current read-only operating boundary.

## [0.3.0] - 2026-08-24

### Fixed
- Run CI with the Node 24-compatible checkout action used by current GitHub-hosted runners.
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

## [0.1.0] - 2026-06-29

### Added
- Initial StackPilot repository and remote setup.
- First provider-agnostic terminal scaffold.
- Basic versioning and changelog structure for future releases.

[Unreleased]: https://github.com/MeonValleyWeb/StackPilot/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/MeonValleyWeb/StackPilot/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/MeonValleyWeb/StackPilot/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/MeonValleyWeb/StackPilot/tree/v0.1.0
