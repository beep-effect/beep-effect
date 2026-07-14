# Agentic Professional Runtime Plan

## Current Plan

- Keep [SPEC.md](./SPEC.md) as the authoritative product/runtime contract.
- Treat [docs/](./docs) as the durable product, data model, and architecture
  breakdown.
- Use [ops/manifest.json](./ops/manifest.json) as the machine-readable routing
  and status source.
- Treat [history/sources.md](./history/sources.md) as the source inventory, not
  as a replacement for the spec.

## Phase Order

| Phase | Status | Purpose | Exit Criteria |
|---|---|---|---|
| P0 | Complete | Bootstrap this initiative packet. | Root docs, product docs, data docs, architecture map, source inventory, and manifest exist. |
| P1 | Pending | Tighten product interviews. | Law and Todox product docs contain concrete workflows, target users, non-goals, and open questions with owner labels. |
| P2 | Complete | Specify the runtime data-loop proof. | One synthetic Law fixture and one synthetic Wealth fixture can be traced through ingest -> claim/evidence -> task/approval -> SDK context. |
| P3 | Complete | Convert the runtime proof into slice implementation plan. | Slice package names, role packages, public/server exports, and test surfaces are executable through the agents use-cases package proof. |
| P4 | Pending | Native first-run onboarding design. | First-run app flow covers dependency checks, local runtime bootstrap, user credentials, client connection, and workspace seed. |

## P2 Outputs

- [docs/runtime-data-loop.md](./docs/runtime-data-loop.md)
- [docs/runtime-fixture-catalog.md](./docs/runtime-fixture-catalog.md)
- [docs/sdk-context-packet-contract.md](./docs/sdk-context-packet-contract.md)
- [docs/approval-and-autonomy-policy.md](./docs/approval-and-autonomy-policy.md)
- [docs/runtime-proof-slice-map.md](./docs/runtime-proof-slice-map.md)
- [history/decision-log.md](./history/decision-log.md)
- [fixtures/runtime-data-loop](./fixtures/runtime-data-loop)

Validate the fixture packet with:

```sh
node goals/agentic-professional-runtime/fixtures/runtime-data-loop/validate-fixtures.mjs
```

## P3 Outputs

- [docs/p3-slice-implementation.md](./docs/p3-slice-implementation.md)
- `packages/shared/domain`
- `packages/workspace/domain`
- `packages/epistemic/domain`
- `packages/agents/domain`
- `packages/agents/use-cases`
- `packages/law-practice/domain`
- `packages/agents/use-cases/test/ProfessionalRuntime.test.ts`

Validate the executable proof with:

```sh
bun run --filter=@beep/agents-use-cases test
```

## Next Implementation Target

The active law-practice vertical has graduated beyond the rung-0 fixed
candidate set: the live workflow invokes `@beep/langextract` over an injected
LLM, preserves span-bearing `GroundedExtraction[]` into `IrToLaw`, and tests
missing and unaligned required extraction outputs.

The next tracked implementation rung is multi-reference section 103 plus
section 101/112 handling. Keep deterministic test mode, synthetic/public
fixtures, and the privilege wall while broadening extraction targets, mapping,
and review behavior.

The broader runtime P4 remains native first-run onboarding and local runtime
bootstrap design:

- dependency checks for git, Node/Bun, and Python
- Claude Desktop and OpenClaw setup guidance
- MCP configuration
- local workspace seeding
- credential and connector setup boundaries

## Follow-Up Work

- Keep P3 persistence-free until the contract test stays stable.
- Keep Notion source pages as evidence until their relevant content is
  synthesized into repo docs.
- Promote shared-kernel concepts only with promotion records and at least two
  product consumers.
