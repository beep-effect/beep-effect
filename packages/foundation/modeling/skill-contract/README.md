# @beep/skill-contract

Schema models for typed agent-work contracts. The kernel defines the
`SkillContract` aggregate, audited fail-closed gates, a cumulative four-rung
evidence ladder, bounded-recovery receipt shapes, SLSA-VSA-shaped gate summaries,
and evaluator-only opaque completion proof.

## Current consumers

- `@beep/repo-cli` uses the gate model for the QA judge's
  `cited-artifact-exists` rule while preserving its existing command output.

## Attribution

The fail-closed evaluation and audit-record discipline follow Microsoft's
Agent Control Specification under the MIT license. Receipt field names align
with the in-toto Attestation Framework under Apache-2.0. This package ports
contract shapes only; it does not include upstream evaluators or signing code.

## Installation

```bash
bun add @beep/skill-contract
```

## Usage

```ts
import { LiteralKit } from "@beep/schema/LiteralKit"
import {
  AlwaysGateApplicability,
  GateDeclaration,
  GateEvidenceRequirement,
  EvidencePredicateType,
  makeGateId
} from "@beep/skill-contract"

const QaGateId = makeGateId(LiteralKit(["cited-artifact-exists"]))

const gate = GateDeclaration.make({
  applicability: AlwaysGateApplicability.make({}),
  evidence: GateEvidenceRequirement.make({
    predicateType: EvidencePredicateType.make("https://example.test/evidence/cited-artifact-exists/v1")
  }),
  id: QaGateId.make("cited-artifact-exists"),
  remediationOwner: "qa",
  severity: "blocking"
})
```

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

Unit tests stay outside `test/integration`; package integration tests live under `test/integration` and use `bun run test:integration`. Tests import package source through `@beep/skill-contract` or other `@beep/*` aliases. Use relative imports only for local helpers, fixtures, and snapshots.

## License

MIT
