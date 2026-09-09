# Architecture Grill: Durable Cache Surfaces

Research date: 2026-09-04. This is a read-only placement review against the
repo's binding architecture doctrine and current exported symbols. It narrows
where a graduated implementation may begin; it does not authorize that
implementation.

## Question under grill

Should the first implementation slice create a dedicated cache package, or
should it extend the existing tooling, policy, evidence, and infrastructure
homes until a reusable boundary is demonstrated?

## Binding doctrine

The current architecture establishes these constraints:

- repository operations, generators, policy enforcement, and CLI workflows are
  `tooling`, with repo-wide orchestration implemented in `tooling/tool`;
- the canonical repo CLI is `@beep/repo-cli`, and an earned command group uses
  `<Group>.command.ts`, `<Group>.schemas.ts`, `<Group>.errors.ts`,
  `<Group>.service.ts`, and a curated `index.ts` as its concerns grow;
- declarative governance/configuration belongs in a `tooling/policy-pack`;
- a tooling package may compose a driver only through a narrow,
  product-neutral operational adapter;
- a `drivers/*` package owns a reusable external engine or service boundary,
  not repo policy or orchestration;
- technical failures are translated at the consuming boundary rather than
  leaked through public operational results;
- telemetry must be typed, bounded, low-cardinality, and free of secrets, raw
  request bodies, or artifact/log payloads.

Primary doctrine:

- [`standards/ARCHITECTURE.md`](../../../standards/ARCHITECTURE.md)
  (tooling dependency matrix, operational adapters, canonical file roles);
- [`standards/architecture/03-driver-boundaries.md`](../../../standards/architecture/03-driver-boundaries.md);
- [`standards/architecture/06-configuration-boundaries.md`](../../../standards/architecture/06-configuration-boundaries.md);
- [`standards/architecture/09-errors-across-boundaries.md`](../../../standards/architecture/09-errors-across-boundaries.md);
- [`standards/architecture/12-observability.md`](../../../standards/architecture/12-observability.md);
- [`standards/architecture/DECISIONS.md`](../../../standards/architecture/DECISIONS.md)
  (tooling-to-driver exception and declarative policy placement).

## Existing bricks

| Existing surface | Reusable contract | Appropriate extension |
| --- | --- | --- |
| [`@beep/repo-cli/commands/Cache`](../../../packages/tooling/tool/cli/src/commands/Cache/index.ts) | Cache dashboard, warmer, restoration probe, typed cache reports and command error | Qualification compiler, shadow runner, conformance commands, bounded renderers, and operational result schemas |
| [`TurboCache.ts`](../../../packages/tooling/tool/cli/src/internal/cli/TurboCache.ts) | Pure fail-closed local/read posture and secret-safe environment-source model | Reuse for local/CI posture classification; do not duplicate credential logic in a new package |
| [`@beep/repo-configs`](../../../packages/tooling/policy-pack/repo-configs/src/index.ts) | Canonical declarative repo policy pack already consumed by `@beep/repo-cli`; generated allowlist projection is precedent | Reviewed qualification policy and generated enforcement projection behind an explicit `@beep/repo-configs/cache` facade |
| [`@beep/skill-contract`](../../../packages/foundation/modeling/skill-contract/src/EvidenceReceipt.ts) | Generic `EvidenceDigest`, `EvidenceSubject`, and `EvidenceReceipt` primitives | Reuse generic digest/subject/receipt vocabulary where semantics match; keep cache-specific predicates and lifecycle states out of this generic package |
| [`@beep/test-utils` conformance ledger](../../../packages/tooling/test-kit/test-utils/src/ConformanceLedger/ConformanceLedger.test-kit.ts) | Package-owned conformance-ledger validation pattern | Reuse patterns or generic helpers only after semantic fit is proven; do not reinterpret package-document conformance as Remote Cache protocol conformance |
| [`@beep/repo-cli/commands/Quality`](../../../packages/tooling/tool/cli/src/commands/Quality) | Machine-readable lane facts and blocking quality policy | Invoke the cache audit as an advisory/blocking lane and carry compact receipt references, without owning qualification transitions |
| [`@beep/repo-cli/commands/Ci`](../../../packages/tooling/tool/cli/src/commands/Ci) | Hosted Turbo-summary presentation | Render qualified/cache outcomes; do not make CI presentation the conformance authority |
| [`infra/lambda/turbo-cache`](../../../infra/lambda/turbo-cache/src) and [`CiTurboCache.ts`](../../../infra/src/CiTurboCache.ts) | Current API Gateway, auth, Lambda, IAM, S3, and deployment boundary | Backend tag carriage, tenant binding, structured backend events, and disposable-lab deployment topology |
| Yeet proof modules | Exact proof and lane-reuse authorities owned by adjacent goals | Consume cache qualification/receipt facts through an explicit bridge; do not merge proof semantics into cache state |

## Recommended placement

Use the existing homes for the first vertical slice:

1. **`@beep/repo-configs/cache` owns pure reviewed policy.** It owns state
   literals, qualification entries, reason codes, evidence requirements,
   approved profiles, and the immutable enforcement projection. It does not
   run experiments, processes, or filesystem orchestration.
2. **`@beep/repo-cli/commands/Cache` owns the operational domain.** Split the
   current group into earned role files as implementation arrives. It owns
   cache-specific discovery, qualification experiments, transition checks,
   conformance runs, receipts, projection materialization/drift checks, and the
   harness that invokes exact Turbo binaries.
3. **Quality enforces, CI renders, and Yeet consumes.** These groups use curated
   Cache/config facades. None becomes the qualification-state writer, and cache
   evidence never substitutes for Yeet proof facts or required hosted status.
4. **The incumbent infra package owns server/runtime adaptation.** Keep token
   capability, tenant binding, opaque tag transport, backend events, storage,
   and deployment wiring beside the actual cache service. The lab may deploy
   multiple engines behind the same Beep policy boundary.
5. **Reuse generic evidence primitives without donating cache semantics.** A
   cache receipt may refer to `EvidenceDigest`/`EvidenceSubject`, but
   `@beep/skill-contract` does not become the cache domain.
6. **Exchange versioned JSON at the isolated Lambda seam.** The standalone
   Lambda has its own lock/build boundary; do not couple it to the repo CLI to
   share TypeScript implementation.

`turbo.json` cannot import a TypeScript projection. The Cache/Quality audit must
therefore verify that materialized `cache`, `inputs`, `env`, `outputs`, and
persistence settings agree with the reviewed projection. Configuration alone
must never promote a computation.

## Promotion trigger for a new package

A new `tooling/library` or `drivers/*` package is earned only when the first
slice demonstrates a stable contract with at least two independent production
consumers that cannot depend on `@beep/repo-cli` or exchange the versioned JSON
contract cleanly.

- Promote pure cache-policy/protocol models to a `tooling/library` when they
  are repo-operational and shared by multiple tools.
- Create a `drivers/*` package only when Beep needs a reusable client wrapper
  around an external Remote Cache service independently of the Turbo binary
  and independently of the infra server adapter.
- Run `bun run beep create-package` and the architecture checks if either
  trigger is met; do not hand-create a package.

The only known pressure toward an early package is compile-time sharing with
the standalone Lambda. A generated, versioned JSON Schema/OpenAPI contract is
the narrower first choice. If multiple deployed producers later require one
executable pure TypeScript contract, the least-wrong candidate would be a
small `tooling/library` with no CLI, filesystem, network, Pulumi, Quality, or
Yeet imports.

## Rejected or deferred placements

- **New foundation cache model now:** rejected. Cache qualification and rollout
  are repo-operational policy, not general application substrate.
- **New Remote Cache driver now:** deferred. The planned harness can exercise
  exact Turbo clients and wire receipts without inventing a second client API.
- **Put all schemas in `@beep/skill-contract`:** rejected. Its generic evidence
  vocabulary is reusable, but cache qualification states and protocol verdicts
  are a separate domain.
- **Put the conformance runner in Lambda/infra:** rejected. Infra owns the
  deployed boundary; the repo tool owns repeatable experiments and comparison.
- **Put the conformance runner in CI:** rejected. CI owns presentation and
  hosted execution, not the protocol/experiment authority.
- **Share repo-cli TS source directly with Lambda:** rejected. It breaks the
  isolated deployment boundary and hides the versioned contract.

## Alignment choice at the research snapshot

The evidence supports locking “existing homes first” for shaping, with a
measurable promotion trigger rather than a permanent ban on extraction. The
alternative is to reserve a dedicated `tooling/library` package immediately,
accepting a broader public API and package-migration surface before the first
consumer contract has been proven.

On 2026-09-08 the user directed the session to continue. Shaping now uses the
existing-home recommendation as its working decision; see
[`DECISIONS.md`](../DECISIONS.md). The user then approved the complete
[brief](../BRIEF.md) and [goal map](../MAP.md), and the four implementation
packets graduated on 2026-09-08.
