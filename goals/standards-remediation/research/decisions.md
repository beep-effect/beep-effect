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

## R3 — three more detector bugs (LOCKED, driver-verified 2026-07-07)

- **D2 (LOCKED)**: `collectCandidateDiagnostics` emits
  `third-param-not-object-like` unconditionally for every 3-param candidate
  (`DualArity.ts:852-854`) — including properly-dual combinators. Driver read
  `GraphOps.bimap` (`packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:266-279`):
  a textbook `dual(3, ...)` with both call signatures, flagged solely for its
  callable 3rd param — the `A.reduce(self, b, f)` shape Effect core itself
  uses. **Ruling: exempt the diagnostic only when the candidate has a VALID
  dual (`validSource` + matching arity) AND the 3rd param type is callable.**
  Primitive 3rd params stay flagged even on duals. 13 solo entries affected.
- **J2 (LOCKED)**: `parseTopoSortOutput` (`QualityArtifactSupport.ts:456-469`)
  takes the first whitespace token of every non-`$` line, so section lines like
  `dependencies:` become phantom packages (4 in the live inventory). **Ruling:
  intersect parsed names with discovered workspace package names.**
- **J3 (LOCKED)**: `unsafeExampleViolations`
  (`JSDocDocumentationInventory.ts:351-387`) strips only lines *starting with*
  `import ` (`:357`) before running the `as`-assertion regex (`:377`), so
  continuation lines of multi-line imports (`type X as Y,`) false-positive
  `no-type-assertions-in-examples`. Confirmed instance:
  `packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts:80`.
  **Ruling: strip complete (multi-line) import statements before the regexes.**

## R4 — crispening policy family gap (LOCKED, driver-verified 2026-07-07)

`SCHEMA_CRISPENING_FAMILY_PREFIXES` (`SchemaFirst.ts:634-644`) omits
`packages/shared/**` and `infra/**`; the doc comment (`:646-660`) calls them
"unassigned until their P1 wave assignment lands" — that assignment never
landed after crispening closed. Unassigned ⇒ `resolveSchemaCrispeningPolicyBlocking`
falls to `false` (`:682`) ⇒ carded advisories in those paths are exempt
(`isSchemaCrispeningPolicyExempt:705-718`) while the scan scope includes them.
**Ruling: assign `packages/shared/` → `apps-slices` and `infra/` → `tooling`
(both families blocking), update the doc comment, and replace the
unassigned-exempt test with assigned-not-exempt coverage.**

## R5 — jsdoc re-export exemption scope (LOCKED with R2)

Per the policy prose, re-export declarations are graph edges: exempt them from
ALL `requiredExportTags` (not only `@example`); measured `@category`/`@since`
misses on re-exports are already 0, so the observable delta is the 797
`@example` findings. Fixture: direct export still fires; re-export silent.
