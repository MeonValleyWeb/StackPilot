# StackPilot

Terminal control plane for managing sites across providers.

## Status

New project scaffolded from the SpinUpWP TUI core. Provider-agnostic model and first adapter layer still need to be defined.

## Current Scope

- Provider-agnostic `Site` model scaffold
- Basic site list view with provider and status labels
- Action hints for future create, deploy, update, and delete flows

## Working Agreement

- When a feature lands, update `README.md`, `CHANGELOG.md`, and `package.json` version together.
- Keep `CHANGELOG.md` in Keep a Changelog format under `## [Unreleased]` until a release is cut.
- Use semantic versioning for releases: feature work bumps the minor version, fixes/docs bump patch versions.

## Release Notes

The release process lives in `RELEASING.md`. Follow it for every version bump and tag.
