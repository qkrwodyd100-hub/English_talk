# ADR 0001: Local-first versioned session boundary

- Status: accepted for MVP
- Date: 2026-08-10

## Context

The MVP is a text-first English conversation demo. It must work without a server, login, provider credential, microphone upload, or remote persistence. The chosen client is Vite + React + TypeScript, so it needs a small typed boundary that remains usable when a server is introduced.

## Decision

- Persist sessions in browser `localStorage` first, using the `v1` shape in `src/contracts/session-contract.ts`.
- Keep the contract explicit for `create`, `get`, `list`, optional feedback, and optional local transcript import.
- Use the executable `createLocalSessionApi` mock only as a no-network contract adapter. It stores data in memory and makes no provider call.
- Do not ship provider SDKs, credentials, authentication, database access, or remote transcript/audio transfer in the MVP.

## Consequences

The frontend can depend on stable model fields now. A future Node/TypeScript API should implement the same routes and error envelope, increment `contractVersion` for breaking changes, and retain client-side fallback to localStorage when the API is unavailable.

## Deferred provider gate

Before real AI/STT/TTS/auth/sync is enabled, require all of: server-only secrets, explicit per-feature user consent, cost/usage caps, authenticated rate limits, a tested deletion API, provider outage fallback to local text mode, and retention documentation. No provider key may be loaded in browser code.
