# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

## [0.1.0] - 2026-06-29

### Added
- Initial StackPilot repository and remote setup.
- First provider-agnostic terminal scaffold.
- Basic versioning and changelog structure for future releases.
