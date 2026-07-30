# @beep/epistemic-server

Server tier for the epistemic slice.

`EpistemicServerLive` is the dependency-free composition: the `ClaimGate` wired
over the bounded `@beep/semantic-web` SHACL engine, the `ClaimLifecycle`
transition, the `ClaimGateOutcomeResolver`, and an in-memory disposition
repository, with `ShaclValidationServiceLive` provided once at the merge
boundary.

`EpistemicServerDrizzleLive` is the same surface backed by Postgres, plus the
bitemporal `EdgeAuthorityRepository`. It requires `PostgresDrizzle`. The edge
authority has no in-memory variant on purpose: its guarantees — a locked head, a
guarded metadata-only close, and the exclusion constraint that refuses a second
open head — belong to the database.

Import the composed layers from `@beep/epistemic-server/layer`, and the
repository adapters from `@beep/epistemic-server/EdgeAuthority` and
`@beep/epistemic-server/ClaimDisposition`.
