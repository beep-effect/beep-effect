# @beep/party-domain

Evidence-gated identity for people, organizations and collective agents. The domain
separates parties, identifiers, accounts, voices, source assertions and reviewed
claims, and binds its claim vocabulary to `@beep/epistemics`.

## Installation

```bash
bun add @beep/party-domain
```

## Usage

```ts
import { emailAddress } from "@beep/party-domain/Identifier"
import { partyKeyOf } from "@beep/party-domain/PartyKey"
import * as Effect from "effect/Effect"

const key = Effect.runSync(Effect.flatMap(emailAddress("Dana Example <Dana@EXAMPLE.test>"), partyKeyOf))
// pk:v1:<64 lowercase hex digits>, the same key as " dana@example.test "
```

## Public modules

| Module | Contract |
| --- | --- |
| `Identifier`, `PartyKey` | Shared normalization and deterministic v1 keys. Identifier equality is not evidence of person equality. National phones require country context. |
| `Ids`, `Party`, `Communication`, `Provenance` | Integer PartyId, slice-owned evidence ids, party/account/voice records, observations and source anchors. |
| `Proposition`, `Claim` | Slice-owned propositions and unambiguous logical keys; foundation claim envelopes, evidence signals and reviewer dispositions. |
| `Resolution` | Effective accepted claims, active vetoes before merges, numeric surviving ids, redirects and key assignments. |
| `Admission` | Purpose-specific evidence gates, including independent corroboration and source support checks. |
| `Projection`, `Hierarchy` | Selector and organization graphs, declared versus operational hierarchy, review findings and Mermaid output. |
| `ClaimEvidenceReview`, `ClaimProjection`, `Contradiction`, `ContradictionDetection`, `EdgeEndpoint`, `EvidenceVerification`, `LogicalEdgeIdentity` | Party bindings for the foundation epistemic factories. |

Time uses foundation epoch-millisecond intervals. Resolution queries supply both
knowledge time and valid time. Retractions and supersessions change the effective
view without rewriting stored evidence. A later `DistinctParty` veto can split a
previous merge; replay is deterministic for the same versions and query scope.

`Party.keys` describes associated keys, while accepted `KeyAssignment` claims
control the resolver's key lookup. Neither a matching address nor a Proposed
claim authorizes a merge. Product integrations must preserve this distinction.

The package has no storage or source-reader dependencies. See the
[slice specification](../../../goals/party-slice/SPEC.md) for the canonical-key
byte contract and complete resolution scenarios.

## Development

```bash
# Build
bun run build

# Type check
bun run check

# Test
bun run test

# Integration test
bun run test:integration

# Lint
bun run lint:fix
```

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/party-domain` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
