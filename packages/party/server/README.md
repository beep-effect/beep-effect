# @beep/party-server



Memory-ledger implementation, generic ingestion and evidence-review workflows.
All source integration preserves the distinction between observed identifiers
and accepted identity claims.

## Public modules

| Module | Behavior |
| --- | --- |
| `Ledger` | `PartyLedgerMemory` implements atomic append batches, immutable history, effective knowledge bounds and instance-local integer allocation. |
| `ContactEvidence` | Normalizes common cards, maps Graph contacts, consumes `ContactSource` and appends sourced Proposed claims. |
| `MailIndex` | Adapts validated mail header records with explicit child content identity, preserving delegation, source anchors and parser hazards. |
| `MailCensus` | Immutable census accumulation, count-only summaries, identifier spans and bounded pairing evidence. |
| `IdentityEvidence` | Mailbox components, collision classification, source-separated card candidates and Proposed alias-pairing claims. |
| `OrgEvidence` | Review-only organization-domain and temporal-overlap leads, preserving missing-evidence uncertainty. |
| `ReviewLoop` | Canonical case sealing, explicit reviewer decisions, partition validation and scoped cross-case conflict evaluation. |

```ts
import { PartyLedgerMemory } from "@beep/party-server/Ledger"
import { PartyLedger } from "@beep/party-use-cases/Ledger"
import * as Effect from "effect/Effect"

const snapshot = Effect.gen(function* () {
  const ledger = yield* PartyLedger
  return yield* ledger.snapshot
}).pipe(Effect.provide(PartyLedgerMemory))
```

Ingestion requires source identity and provenance. The child mail message's
content id is supplied separately from its parent archive id. Bad identifiers
produce data-quality issues; a display name never becomes an identity key.
National phone numbers need explicit country context. Shared-address flags
preserve representation without guessing personal authorship.

Review decisions carry a reviewer, review time, validity interval, activity and
source anchor. `decisionClaims` constructs candidates after validating the case;
`applyReviews` evaluates the complete review set at the requested times. Only
settled results emit evidence for publication. Stale, invalid, tied-conflicting
or out-of-scope decisions remain visible as review outcomes.

The ledger is memory-only. Restarting it does not preserve integer allocation or
evidence. Equal canonical identifiers do not accept a person merge, and contact
or pairing proposals require later review. There is no persistence, browser UI
or private corpus reader in this package.

The executable synthetic workflows and page compatibility adapter remain in
[scratchpad/party](../../../scratchpad/party/README.md). The review page itself
is outside this package.

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/party-server` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
