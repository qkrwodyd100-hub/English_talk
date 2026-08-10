# English Talk session API contract — v1

Status: proposed server contract; the MVP uses browser `localStorage` and the zero-credential mock in `src/contracts/local-session-api.mjs`.

Base URL (phase 2): `/api/v1`. Content type: `application/json`. All successful session and feedback responses include `contractVersion: "v1"`.

## Canonical session JSON

```json
{
  "contractVersion": "v1",
  "id": "ses_01H...",
  "storage": "local",
  "scenarioId": "coffee-order",
  "title": "Ordering coffee",
  "createdAt": "2026-08-10T08:01:00.000Z",
  "updatedAt": "2026-08-10T08:01:00.000Z",
  "turns": [
    { "speaker": "learner", "text": "Can I get a latte?", "occurredAt": "2026-08-10T08:00:00.000Z" }
  ]
}
```

`speaker` is `learner` or `coach`. A session ID is 1–128 characters. A session has 1–100 turns; each text is 1–2,000 characters, `scenarioId` is 1–80 characters, and `title` is 1–120 characters. All timestamps are ISO-8601 UTC date-times. Client fields outside the documented shape must be ignored rather than persisted.

## Routes

### `POST /sessions`

Request body: `scenarioId`, `title`, and `turns`. Response: `201` and the canonical session. The client supplies no user ID, storage mode, timestamps, or session ID.

### `GET /sessions/{sessionId}`

Response: `200` and the canonical session. `404 SESSION_NOT_FOUND` if the caller cannot access it. A future authenticated server must not distinguish another user's session from a missing session.

### `GET /sessions?cursor=&limit=`

Response `200`:

```json
{ "items": [/* canonical sessions */], "nextCursor": null }
```

Default limit is 20; maximum is 100. Results are sorted by `updatedAt` descending. MVP localStorage may return all local sessions, but must preserve this sort order.

### `POST /sessions/{sessionId}/feedback` (optional)

Empty request body. Response `200`:

```json
{
  "contractVersion": "v1",
  "sessionId": "ses_01H...",
  "generator": "local-rule",
  "providerCallMade": false,
  "summary": "Saved 1 local conversation turn.",
  "suggestions": []
}
```

The MVP always returns deterministic `local-rule` feedback. A `generator: "provider"` response is phase 2 only and requires the provider gate below.

### `POST /sessions/import` (optional)

Request:

```json
{
  "source": "manual-paste",
  "scenarioId": "imported-transcript",
  "title": "Imported transcript",
  "turns": [/* canonical turns */]
}
```

Allowed sources are `manual-paste` and `local-file` only. URLs, cloud shares, audio media, and provider-origin imports are rejected in MVP. Response: `201` and the canonical session.

### `DELETE /sessions/{sessionId}` (phase 2 required before remote storage)

Response: `204`. It must erase the primary record and schedule verified deletion from all application-controlled replicas/backups under the published retention policy. Local MVP deletion is a browser-localStorage operation, not a network route.

## Error envelope

All API errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "turns must contain 1 to 100 entries.",
    "details": [{ "field": "turns", "reason": "invalid_length" }]
  }
}
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `SESSION_NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429), and `PROVIDER_UNAVAILABLE` (503). Never include secrets, provider diagnostic bodies, transcript text, or user identifiers in an error.

## Compatibility and client fallback

Additive optional fields are allowed in `v1`; clients must ignore unknown fields. Breaking changes require a new versioned base path and `contractVersion`. During the transition, the client tries the selected API version once, treats network failures, `503`, and unknown versions as unavailable, and continues with localStorage without retry loops or transcript loss. Do not silently migrate local sessions to remote storage: request explicit user consent and show what will be sent.

## Privacy, retention, and provider gate

- Store only scenario metadata, a user-entered title, and text turns necessary for the selected feature. Do not store account identifiers in the session payload, raw audio, device fingerprints, IP-derived data, or provider prompts/responses by default.
- Local MVP data stays in the browser until the user clears/deletes it. It is not synced, logged, or sent remotely.
- Before remote storage, publish a retention period, provide per-session and account-wide deletion, authenticate deletion, and avoid transcript content in application logs/analytics.
- Before AI/STT/TTS/auth/sync, require server-only secrets, explicit opt-in consent, per-user usage/cost caps, authenticated rate limits, a deletion API, and tested provider-outage fallback to text-only local mode. No browser API key or direct provider call is permitted.
