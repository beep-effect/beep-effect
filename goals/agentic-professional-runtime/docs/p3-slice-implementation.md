# P3 Slice Implementation

## Purpose

P3 converts the deterministic runtime data-loop proof into executable package
topology without adding persistence, UI, real connectors, or real LLM calls.

## Implemented Topology

The first real slice packages are:

- `@beep/shared-domain`
- `@beep/workspace-domain`
- `@beep/epistemic-domain`
- `@beep/agents-domain`
- `@beep/agents-use-cases`
- `@beep/law-practice-domain`

The package-local proof harness is:

- `packages/agents/use-cases/test/ProfessionalRuntime.test.ts`

## Boundary Shape

- Shared-domain owns the canonical organization, user, and membership language.
  Slice domain packages define schema-first models with repo-native positive
  integer entity IDs.
- Readable fixture keys remain in the proof harness mapping layer.
- `@beep/agents-use-cases/public` exposes the SDK-facing context
  packet and candidate output-set contracts.
- `@beep/agents-use-cases/proof` exposes the deterministic fixture
  runner; `/test` re-exports it for package tests.
- The Law package remains context-only in this paired-fixture proof; the
  dormant wealth scenario is fixture data, not a package.
- The proof harness composes both fixture scenarios at the agents use-cases
  test boundary without a dormant wealth package.

## Executable Proof

The package test runs both P2 fixture scenarios:

```sh
bun run --filter=@beep/agents-use-cases test
```

The test proves:

- fixture seeds decode into domain models
- readable fixture keys map to repo-native entity IDs
- normalized email artifacts decode into workspace models
- deterministic agent output matches the expected claim, task, draft, approval,
  and context-packet snapshots
- candidate outputs decode into workspace and epistemic models

## Deferred

- Drizzle or PGlite tables
- production repositories
- real email connector execution
- real LLM extraction in the paired deterministic runtime fixture
- native review UI
- tenancy lifecycle use-cases, repositories, and adapters
