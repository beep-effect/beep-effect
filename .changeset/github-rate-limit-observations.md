---
"@beep/github": minor
---

Report every GitHub response's rate-limit headers to an optional
`RateLimitSink`. `RateLimitSnapshot` gains `resource` (a new
`GitHubRateLimitResource` literal set, defaulting to `unknown`) and `used`.
The transport now emits one `RateLimitObservation` per HTTP attempt, carrying
the caller's opaque `budgetLabel`, the derived credential kind and a
rate-limit outcome (`ok`, `not-modified`, `rate-limited`, `secondary-limited`,
`error`). Successful GraphQL responses are observed too. The sink is a
`Context.Reference` whose default drops observations. Its calls are bounded
to 250 ms and never fail a request. `GitHubClientOptions` gains `budgetLabel`
and `credential`, and `GitHubAppOptions` gains `budgetLabel`; all are optional.
