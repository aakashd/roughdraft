# 0004: CLI Server State Model

## Context

The CLI starts or reuses a local server so `roughdraft open <file.md>` works without manual process management.

## Decision

The server state file records the managed background process, port, URL, and start time. The CLI should reuse healthy managed servers, recover from stale state, and avoid claiming ownership of unrelated processes unless explicitly requested.

## Consequences

State handling must remain deterministic and testable. Stale-write protection and local-file boundary checks belong in the core server path.

## What This Explicitly Does Not Mean

The state file is not a project database, collaboration backend, sync system, or persistent document model.

## Clarification (2026-04-30): Remote Document Sessions

Remote document mode (see `docs/plans/2026-04-30-001-feat-remote-document-mode-plan.md`) introduces in-memory session state on the server: a map of registered remote-document sessions, each holding a CLI-supplied markdown file's bytes for the lifetime of the SSE connection.

This state is **deliberately not persisted in the state file**. Sessions live only in the running server process and are evicted on disconnect or server restart. The state file's role — managed background process, port, URL, start time — is unchanged. Treating remote-document sessions as transient in-memory state preserves the boundary above: the state file does not become a document model just because the server now hosts other machines' edits.
