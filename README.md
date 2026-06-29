# StackPilot

Terminal control plane for managing sites across providers.

## Status

New project scaffolded from the SpinUpWP TUI core. Provider-agnostic model and first adapter layer still need to be defined.

## Current Scope

- Vercel-backed site list scaffold
- Dashboard layout with boxed, focusable panels, recent deploys, failed deploys, site list, and details pane
- Basic site list view with provider and status labels
- Site details now show repo, stack, domains, last deploy, and deployment URL
- Enter opens a dedicated site page for deeper provider/API-specific detail probing
- Action hints for future create, deploy, update, and delete flows

## Setup

1. Copy `.env.example` to `.env`.
2. Add `VERCEL_TOKEN`.
3. Optionally set `VERCEL_TEAM_ID` if you want to scope requests to a team.
4. Run `bun install` and `bun run dev`.

## Working Agreement

- When a feature lands, update `README.md`, `CHANGELOG.md`, and `package.json` version together.
- Keep `CHANGELOG.md` in Keep a Changelog format under `## [Unreleased]` until a release is cut.
- Use semantic versioning for releases: feature work bumps the minor version, fixes/docs bump patch versions.

## Release Notes

The release process lives in `RELEASING.md`. Follow it for every version bump and tag.
