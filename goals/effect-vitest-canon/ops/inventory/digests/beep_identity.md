# @beep/identity — P1 wave001 digest

Source audit complete for all 12 assigned test files and 48 file/lens pairs. P2 remains gated. There are **59 judgment/open rows: 22 actionable and 37 coverage-only**. No blocker-severity finding, exception, fix SHA, waiver or detector resolution was added. **Historical artifact rejection:** original public decoding accepted all 22 numeric-ID findings but rejected all 37 charter-required NONE rows. Those truthful coverage IDs were retained; the correction and successful revalidation are recorded below.

| Lens | Rows | Actionable | Coverage | Major | Minor | Info |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| resource | 12 | 1 | 11 | 1 | 0 | 11 |
| flake | 12 | 0 | 12 | 0 | 0 | 12 |
| property | 19 | 12 | 7 | 10 | 2 | 7 |
| observability | 16 | 9 | 7 | 9 | 0 | 7 |

The retained detector JSONL has 31 candidates: EV001 9, EV002 1, EV003 1, EV006 4, EV007 9, EV011 7. These counts are separate from judgment counts. A coverage-only row means no additional lens residue; it does not waive existing detector candidates.

## Top ten files by judgment-row count

- `PnLocal.test.ts` — 10 rows.
- `Curie.test.ts` — 7 rows.
- `Fibered.test.ts` — 6 rows.
- `AnnoteError.test.ts` — 4 rows.
- `Identity.test.ts` — 4 rows.
- `IdentityRegistry.test.ts` — 4 rows.
- `IriBinding.test.ts` — 4 rows.
- `OntologyEntrypoints.test.ts` — 4 rows.
- `TaggedError.equivalence.test.ts` — 4 rows.
- `TemplateGuards.test.ts` — 4 rows.

The other two tied four-row files are Vocab.test.ts and shape-stable.test.ts. Exact full-file ranges and hashes are in the private wave001 read-receipts.json.

## Layer topology and MemoryFileSystem

IdentityRegistry.layerLocal is Layer.effect constructing three immutable HashMap indexes. The resolve helper builds the same successful layer separately for each resolution: three encodings in the first case, plus the missing-reference case. The bridged entry uses its own local registry. Share successful lookups only after scope review. Three conflict cases deliberately construct invalid layers and assert the conflict encoding/key. Moving these layers to it.layer suite acquisition would apply Effect.orDie and lose the typed-error subject. L-RES-05 records this boundary beyond EV003's syntactic wrapper recommendation; Root must choose a reviewed test-owned acquisition scope, not automatically waive or move it.

Other fixtures are local schemas/composers or immutable Fibered metadata. No filesystem subject, native handle, container, server, database, MemoryFileSystem candidate or seed/fault/inspect demand was found. External-looking ontology IRIs are strings, not I/O.

## Property and failure evidence

Ten L-PROP-03 rows cover nine manual checkEffect calls plus PnLocal's existing it.prop: none passes native runs/seed options. Preserve generator/operand coverage and effective default floors with explicit fcRuns options; native properties do not inherit a global floor. Nine L-OBS-01 rows identify the direct runner's missing adapter assertion-normalization/shrinking path and the _tag-only loss of exhaustion/replay diagnostics. These are additional semantic reasons, not copies of EV007.

Curie's Constant(coreCurieCases) repeats an already exhaustive deterministic traversal; retain whole-registry coverage while reviewing whether an additional property varies anything. PnLocal's production arbitrary annotations select only 5/4/4 fixed local/prefix/escaped literals. Its generated codec laws do not explore the broader Unicode/position/length grammar. Any P2 generator change must be a reviewed production annotation change preserving the schema, explicit examples, bounded generation and shrinking; no permissive test-only substitute.

Other tests preserve literal compile-time contracts, metadata ownership, error equivalence, guard errors and export compatibility. They should not acquire Effect services solely to create a migration. Compiler proof remains necessary for expectTypeOf and ts-expect-error sentinels.

## History, timing and limits

30-day hosted-history attribution and package baseline timing remain pending Root enrichment. No claim of no historical failures is made. A partial 30-failure slice is not complete 30-day evidence. No tests, package proofs, compiler checks or timings were run here. Planned timing runtime is Node 22.22.3, Bun 1.4.2 and Vitest 4.1.11 with Effect/@effect/vitest rc113; this is not a fresh peer-compatibility proof. The normal check's 90 inherited-main findings remain unchanged.

## Proposed internal P2 order

Scope: separate registry success fixtures from acquisition-failure subjects. Assertions: preserve exact payloads, failure keys, matchers and negative polarity while reviewing EV006. Property: migrate registrations with floors, review the constant-only law and PN production generators. Flake: incorporate Root's completed history and timings; no retry/timeout increase is proposed. Observability: preserve shrink/replay/error details through the accepted registrar, then prove package behavior. Order remains scope → assertions → property → flake → observability; no P2 implementation is authorized by this digest.

## Root evidence enrichment — 2026-09-11

The [accepted Node command baseline](../timings/baseline/beep_identity.json) records
110 test registrations across 12 reported files. Reporter duration is
682.431 ms; the separately measured whole command took
1.016 seconds. [Context and slowest files](../timings/context/baseline/beep_identity.json)
retain exact input hashes, assertion statuses, worker settings, limits and load.
This is the frozen starting-main Node22.22.3/Bun1.4.2/Vitest4.1.11 cohort,
without a workstation-load adjustment. It does not replace package or compiler
proof. Census file representation does not establish that skipped/todo
registrations executed.

The [frozen hosted summary](../hosted-history-summary.json) maps
9 observations across 3 jobs to this package;
categories: coverage-ratchet: 9. The window is 2026-08-12T23:06:31Z through
2026-09-11T23:06:31Z. These are historical observations, not a current-source
or flakiness diagnosis. The full collection has 21 inaccessible logs and one
unresolved downloaded-job cause; zero mapped observations would not prove zero
failures. Job links and historical source heads remain in the summary.

The source audit's original schema-rejection receipt remains historical evidence.
The inventory contract correction now passes full strict validation across all
1,122 census files, including the required NONE rows. This supersedes the original
schema-acceptance blocker above. P1 corrections and Benjamin's acknowledgement
remain pending; see the [current review record](../../../research/2026-09-16-p1-independent-review.md).
