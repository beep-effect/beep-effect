# @beep/epistemic-server

Server tier for the epistemic slice.

`EpistemicServerLive` is the dependency-free composition: the `ClaimGate` wired
over the bounded `@beep/semantic-web` SHACL engine, the `ClaimLifecycle`
transition, the `ClaimGateOutcomeResolver`, an in-memory disposition repository,
and an empty contradiction repository, with `ShaclValidationServiceLive`
provided once at the merge boundary.

`EpistemicServerDrizzleLive` is the same surface backed by Postgres, plus the
bitemporal `EdgeAuthorityRepository`. It requires `PostgresDrizzle`. The edge
authority has no in-memory variant on purpose: its guarantees — a locked head, a
guarded metadata-only close, and the exclusion constraint that refuses a second
open head — belong to the database.

`EpistemicServerRpcLive` and `EpistemicServerDrizzleRpcLive` add the
contradiction-triage application service and RPC handlers. The application
binding supplies the authenticated reviewer, trusted organization/source scope,
and a `SourceTextResolver`.

## Foundation-mediated source-text coupling

`@beep/epistemic-server` consumes the product-neutral
`@beep/file-processing/SourceText` resolver port. The initial provider is
`@beep/workspace-server/SourceText`; the professional desktop runtime is the
binding site for the provider, file-processing service, workspace vault store,
authenticated triage scope, and epistemic server Layer.

Import the composed layers from `@beep/epistemic-server/layer`, and the
repository adapters from `@beep/epistemic-server/EdgeAuthority` and
`@beep/epistemic-server/ClaimDisposition`.
