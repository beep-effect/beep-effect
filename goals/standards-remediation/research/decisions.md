# Locked rulings — standards-remediation

Rulings are locked once the driver has personally verified the evidence
(SPEC D-C). Do not reopen without new evidence; record the new evidence here.

## R1 — dual-arity D1: static-property schema-codec exclusion (LOCKED, driver-verified 2026-07-07)

`DualArity.ts` applies `isNonHelperCallableValue` in the exported-const path
(`:964`) but never in `collectStaticPropertyCandidate` (`:1068-1134`) — the
driver read both paths directly. Schema-class codec statics
(`static decodeUnknownEffect = S.decodeUnknownEffect(this)` etc.) are flagged
only through this inconsistency; EF-18 scopes the dual law to reusable helper
combinators, which schema-derived codecs are not. **Ruling: detector bug.
Fix in P1** (apply the exclusion in the static path; widen
`SCHEMA_CALLABLE_VALUE_FACTORY_PATTERN` with Sync/Exit/Promise variants);
fixture pair mandatory. Expected prune ≈ 59 candidates.

## R2 — jsdoc J1: @example required on barrel re-exports (LOCKED, driver-verified 2026-07-07)

Driver-run count over the live inventory: 1,215 direct-export vs 797
re-export missing-@example findings. `.patterns/jsdoc-documentation.md:91-96`
states re-export declarations are graph edges — "do not add fake examples to a
barrel just to satisfy quality tooling." **Ruling: detector bug. Fix in P1**
(stop requiring `@example` on re-export declarations; keep `@category`/`@since`
behavior unchanged — measured misses there are already 0); fixture pair
mandatory. Expected prune ≈ 797 findings.

## R3 — pending P1 verification (agent-reported, NOT yet driver-verified)

- **D2**: callable 3rd param on properly-dual combinators (GraphOps `bimap` et
  al., ~13 entries) flagged because `collectCandidateDiagnostics` doesn't
  consult `hasDualSignatures(callableType, 3)`.
- **J2**: 4 phantom "packages" (`dependencies`, `devDependencies`, …) from
  `parseTopoSortOutput` (`QualityArtifactSupport.ts:456-469`) taking the first
  token of every non-`$` line.
- **J3**: multi-line `import { type X as Y }` trips
  `no-type-assertions-in-examples` because only lines *starting with* `import `
  are stripped (confirmed instance:
  `packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts:80`).

Driver must verify each in-code before the P1 lane's fix is accepted.

## R4 — crispening policy family gap (pending P1)

`SCHEMA_CRISPENING_FAMILY_PREFIXES` (`SchemaFirst.ts:634-644`) omits
`packages/shared/**` and `infra/**`; unassigned family ⇒ non-blocking ⇒ exempt
from missing-entry detection for carded rules. Close by assigning families or
defaulting unassigned→blocking.
