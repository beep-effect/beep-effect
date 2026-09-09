# S7 emission v2 implementation report

Implementation and verification are complete in the `ontology-emission-v2` worktree on
`feat/ontology-s7-emission-v2`. **Commit is blocked by the active filesystem sandbox:**
Git cannot create this linked worktree's index lock in the parent checkout's read-only
Git metadata. No files were staged, no commit was created, and nothing was pushed or
published. Section 6 records the exact failure and handoff.

This work is **instrumentation FOR run-3 ratification evidence, not ratification**.
DECISIONS.md run-3 rulings 4 and 13–16, the design brief's ordering cluster, and amended
CQ-020 were read before implementation. Frozen extraction artifacts and ontology tests,
seed, CQ definitions, traceability, and historical CQ-019 carriers remain unchanged.

## 1. Emitted term table

Source lines below refer to `apps/labs/ciops/src/projection/Turtle.ts` in the current
branch working tree. There is no new commit SHA because staging was denied.

Namespaces:

- `ciops:` = `https://oip.law/ontology/ci-ops#`
- `ciops-prov:` = `https://oip.law/ontology/ci-ops-prov#`
- `rdf:` = `http://www.w3.org/1999/02/22-rdf-syntax-ns#`
- `xsd:` = `http://www.w3.org/2001/XMLSchema#`

The table includes the preserved ratified terms for a complete emission inventory.
Provisional classes are shown as the object of their emitted type assertion; no T-Box
class or property declarations are emitted.

| Spelling | Namespace | Subject type → object type or value | Datatype | Turtle.ts line | Change |
| --- | --- | --- | --- | ---: | --- |
| `ScheduleProposal` | `ciops:` | Proposal individual → this class via `rdf:type` | — | 73 | Preserved |
| `SeatRequest` | `ciops:` | Admitted or deferred request individual → this class via `rdf:type` | — | 54 | Preserved |
| `admissionChargeTokens` | `ciops:` | SeatRequest → request weight | `xsd:integer` | 52 | Preserved |
| `hasOriginKey` | `ciops:` | SeatRequest → origin key | `xsd:string` (plain Turtle string) | 53 | Preserved |
| `ScheduleStep` | `ciops-prov:` | Admitted step individual → this class via `rdf:type` | — | 85 | Preserved provisional typing |
| `hasStep` | `ciops-prov:` | ScheduleProposal → ScheduleStep | — | 81 | Preserved; no tail steps |
| `stepIndex` | `ciops-prov:` | ScheduleStep → 0-based ordinal | `xsd:integer` | 84 | Preserved engine numbering |
| `schedulesSeatRequest` | `ciops-prov:` | ScheduleStep → SeatRequest | — | 83 | Preserved; contract spelling refreshed |
| `hasScopeTag` | `ciops-prov:` | ScheduleStep → ScheduleScope value, exactly `"admission"` in v1 | `xsd:string` | 82 | Replaces the literal-valued `hasScope` spelling |
| `VerificationEpisode` | `ciops-prov:` | Bounded verification occurrence → this class via `rdf:type` | — | 98 | Added |
| `hasCurrentProposal` | `ciops-prov:` | VerificationEpisode → ScheduleProposal | — | 99 | Subject changed from the untyped scheduler singleton |
| `AdmissionProjectionSpecification` | `ciops-prov:` | Governing specification individual → this class via `rdf:type` | — | 101 | Added |
| `hasProjectionSpecification` | `ciops-prov:` | ScheduleProposal → AdmissionProjectionSpecification | — | 100 | Added on the subject CQ-020 actually joins |
| `policyDigest` | `ciops-prov:` | AdmissionProjectionSpecification → supplied policy digest | `xsd:string` | 102 | Added serialization |
| `journalPrefixDigest` | `ciops-prov:` | AdmissionProjectionSpecification → supplied journal-boundary digest/locator | `xsd:string` | 103 | Added serialization |
| `scheduledUnitRef` | `ciops-prov:` | Every SeatRequest → its scheduled unit's nonce | `xsd:string` | 91 | Added for admitted and deferred requests |
| `defersSeatRequest` | `ciops-prov:` | ScheduleProposal → deferred SeatRequest | — | 96 | Added provisional tail membership |
| `type` | `rdf:` | Individual → corresponding class IRI above | — | 54, 73, 85, 98, 101 | Existing carrier reused for new class assertions |

The retired `ciops-prov:hasScope` literal has no emission site; line 82 is its replacement.
No object-property `hasScope`, `Scope` individual, or `schedulesWorkUnit` emission was
added. The provisional header, valid-Turtle format, and lexical sorting remain intact.

## 2. Episode identity and specification identity

### Episode

`ProjectionInput` first gained a required `episodeId: S.NonEmptyString`; the service
contract documents it, the engine copies it into the schema-backed `ScheduleProposal`,
and `emitAbox` types that subject and connects it to the proposal. There is no default
that could silently collapse occurrences into one scheduler identity.

The emitted node is:

```text
ciops-prov:episode-${pnLocalSlug(episodeId)}
```

In `Replay.ts`, the exact key is:

```text
replay-${journalDigest}-${eventIndex}
```

`journalDigest` is the SHA-256 of the complete pinned journal supplied by the evidence
generator. `eventIndex` is the zero-based decoded source-event index, counting release
and eviction records as well as admissions. Each admitted boundary therefore has a
replay-stable, distinct key. The current golden generator supplies journal digest
`cf30b993a38d8a22a8fdd44cb223b831039160c3819eb42e4104a69a56c01556`.

The occurrence is one bounded **verification of a recorded grant**: reconstruct the
snapshot immediately before the identified transition, project the pending requests,
compare the first prescribed nonce with the recorded admission, and finish with a
verdict and ledger fold. It is not the scheduler's lifetime or an invented global
scheduler instance. A new event index or corpus digest identifies another corpus-scoped
verification occurrence. Replaying identical pinned input preserves the key and Turtle.
Moving the journal file does not change it; extending or changing the corpus does.
Cross-capture persistence is not claimed.

A live caller owns the bounded occurrence key and must retain it across revisions of
that occurrence's proposal. Emission returns a snapshot: consumers replace the previous
document for that episode. Appending documents cannot retract an earlier
`hasCurrentProposal` triple. The existing transactional shell still holds one latest
proposal; this change does not turn it into a persistent per-episode graph store.

### Specification

The node is content-derived using the **existing injective component encoder**, rather
than introducing a hash dependency or shortening digests:

```text
ciops-prov:specification-${join("-", map(pnLocalSlug,
  ["s7-emission/v2", policyDigest, journalPrefixDigest, "admission"]))}
```

The scope component is read from `ScheduleScope.Enum.admission`, not an independent
literal-domain declaration. An empty or fully deferred proposal still emits exactly
one specification.

- **Authority:** this S7 projection contract and the `@beep/ciops` admission engine over
  the S6 policy A-Box. Emission is evidence for the steward; it grants no vocabulary authority.
- **Version:** immutable instrumentation version `s7-emission/v2`, included in identity.
- **Applicability:** the supplied policy artifact digest, journal-boundary digest/locator,
  and admission scope. All tuple members determine identity. Episode id, proposal id,
  and projection instant do not.

`pnLocalSlug` preserves ASCII alphanumerics and percent-encodes all other UTF-8 bytes,
including hyphens; literal hyphens therefore unambiguously separate tuple components.
For well-formed UTF-8 input this avoids truncated-hash collisions and ambiguous delimiter
concatenation. The tradeoff is longer IRIs. Proposal, step, and request IRI syntax and
the existing encoder are unchanged; S8 is not pulled into this work.

Digests are serialized exactly as supplied, not recomputed or certified. In existing
replay, `journalPrefixDigest` is `${journalDigest}-${eventIndex}`: a digest-bound boundary
locator, **not a separate SHA-256 of prefix bytes**. This existing input convention is
now visible in the contract. Schema validation continues to require non-empty strings.

## 3. Deferred-tail decision and tradeoff

The tail remains **step-less**. Inspection found only charge, origin, and SeatRequest
typing on tail nodes, with no proposal relation to reuse. V2 adds exactly one
`ciops-prov:defersSeatRequest` proposal-to-request edge per tail member.

This provides explicit membership without representing a deferral as a prescribed
admission. CQ-020 continues to return only admitted steps. It does not renumber steps,
extend `stepIndex` into the tail, or add another tail-ordering predicate. The cost is one
additional provisional support edge requiring its own future governance disposition.

Every request also receives `scheduledUnitRef = request.nonce`; the engine already uses
that same nonce for admitted `ScheduleStep.scheduledUnitRef`. Positional request IRIs
remain indexed over admitted requests followed by the deferred tail.

## 4. Fixture diffs explained one by one

There were **no existing package Turtle goldens** to overwrite. One golden was added:
`apps/labs/ciops/test/fixtures/emission-v2.ttl` (37 lines, 30 triples), generated by the
current engine/emitter and compared byte-for-byte against fresh runtime output in tests.

The scenario submits three merged-preview requests with charge 5 each against the
actual decoded capacity 10. Requests `admitted-a` and `admitted-b` get steps 0 and 1;
`deferred-c` remains the tail.

The golden's deliberate differences from pre-v2 emission for that scenario are:

1. `hasScope` on the two steps becomes `hasScopeTag`, with explicit `xsd:string` typing.
2. The untyped scheduler current-proposal assertion becomes an episode-specific
   assertion plus `rdf:type ciops-prov:VerificationEpisode`.
3. The proposal gains one `hasProjectionSpecification` edge, pointing at one explicitly
   typed, content-derived `AdmissionProjectionSpecification` individual.
4. Both supplied input digests appear as `xsd:string` properties on that specification.
5. All three positional request nodes gain their nonce-valued `scheduledUnitRef` literal.
6. The tail gains one `defersSeatRequest` edge. There is no step 2 or scheduled edge to
   request 2. Ratified typing, charges, origin keys, proposal/request/step IRI syntax,
   and admitted ordinal values are preserved.

The pre-existing slash/question-mark proposal assertions in `projection.test.ts` were
updated to expect the typed episode subject; they still prove distinct escaped proposal
IRIs and deterministic re-emission. The existing
`test/fixtures/admission-journal-v2-eviction.ndjson` is byte-unchanged. All frozen S6/S7
packet artifacts, ontology fixtures, `seed.ttl`, CQ-020 sample, CQ-019 arm 3 and its
fixture are untouched.

## 5. Files changed, tests added, and verification

### Files

| File | Change |
| --- | --- |
| `apps/labs/ciops/src/projection/Schemas.ts` | Required episode identity on input and proposal; updated examples and semantics |
| `apps/labs/ciops/src/projection/CiOpsProjection.ts` | Documents identity preservation through the service boundary |
| `apps/labs/ciops/src/projection/Engine.ts` | Copies episode identity; only other edit is its example; admission algorithm and numbering unchanged |
| `apps/labs/ciops/src/projection/Replay.ts` | Derives the bounded replay occurrence key and documents it |
| `apps/labs/ciops/src/projection/Turtle.ts` | Complete bundled v2 emission and identity criteria |
| `apps/labs/ciops/test/projection.test.ts` | Updated existing assertions and four new regression tests |
| `apps/labs/ciops/test/fixtures/emission-v2.ttl` | New runtime-verified mixed admission/deferred golden |
| `apps/labs/ciops/scripts/generate-replay-evidence.ts` | Adds `--check`, printing the replay report without modifying frozen evidence |
| `apps/labs/ciops/scripts/check-emission-cq.py` | Read-only Oxigraph check of the runtime-verified golden against amended CQ-020 |
| `explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md` | The only edited exploration file; spellings, v2 behavior, authority/version/applicability, and ratification boundary |

`AboxPolicy.ts` needed no change. No package manifests, dependencies, public exports,
T-Box registrations, or frozen artifacts changed. Existing untracked `graft/` was left
untouched. The external lane report is the separately authorized handoff deliverable.

The four new package regressions cover:

- The exact v2 golden: two admitted ordinals, all nonce evidence, and one step-less tail.
- Empty and fully deferred proposals: typed episode/specification without fabricated steps.
- Episode/specification separation, delimiter-safe specification identity, different
  escaped episode keys, and quote/backslash/newline escaping in digest literals.
- Missing and empty episode identity rejected at the input schema boundary.

Existing schema-derived property tests still cover byte determinism, capacity,
request totality, priority/aging, class caps, frozen replay, eviction behavior, and the
transactional live shell. The test suite now has **17 passing tests in 2 files**.

### Verification results

| Command / check | Result and practical scope |
| --- | --- |
| `CI=true bun run beep quality package-verify @beep/ciops` | Initially stopped before compilation with a sandbox Node-spawn error; attributed environment-only and acknowledged in Yeet |
| `CI=true bun --bun run beep quality package-verify @beep/ciops` | **PASS**, audit 6.4 seconds; same package gate using Bun runtime routing; app docgen skipped by its existing configuration |
| `bun run docgen:local` | **PASS**, mode `noop`, no selected packages; consistent with the app's no-public-exports/no-docgen rule |
| `CI=true bun run test` from the app | **PASS**, 17/17 tests, 2/2 files |
| Installed Effect compiler directly, then `bun node_modules/typescript/bin/tsc -p apps/labs/ciops/tsconfig.json --noEmit` | **PASS** for both compilers; supplemental diagnosis of the initial launcher failure |
| `UV_CACHE_DIR=/tmp/ciops-emission-v2-uv UV_OFFLINE=true uv run --with pyoxigraph python explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py` | **PASS**, zero failures across 25 seed tests + 20 adversarial fixtures; original command body with writable offline-cache configuration |
| `bun run evidence:s7 --check` from the app | **PASS**, 79 decoded events, 41/41 admission matches, 38 releases, zero mismatches; one existing uniquely inferred eviction at event 66; writes no packet artifact |
| `UV_CACHE_DIR=/tmp/ciops-emission-v2-uv UV_OFFLINE=true uv run --with pyoxigraph python apps/labs/ciops/scripts/check-emission-cq.py` | **PASS**, two admitted rows at indices 0 and 1, one excluded deferred request, typed episode/specification, both string digests, all three nonce literals, two negative specification-join tests |
| `git diff --check` | **PASS** |
| Exploration path inventory | Exactly `ontology/docs/s7-projection-contract.md` changed under this worktree's `explorations/` |
| Yeet inbox | 1 acknowledged environment-only row; 0 unacknowledged rows |

The evidence note references the differential replay generator; inspection found no
existing emission-to-CQ replay checker there or in the app scripts. The new checker
fills that verification gap without editing the CQ: it reads CQ-020's actual SPARQL,
adapts the seven provisional class/property spellings and episode binding in memory,
and queries the Turtle golden that the package test matches to fresh runtime output.
Removing the specification edge or type independently yields zero rows as required.
This is emission evidence for the synthetic mixed-queue scenario, **not a claim that
all 41 replay projections were independently queried as RDF**, nor vocabulary ratification.
The packet runner remains seed/fixture proof; its existing limited S6 golden-coverage
census is unchanged.

### Friction receipts and failure attribution

These were recorded during work in this report because the packet OPPORTUNITIES ledger
is outside the explicitly authorized exploration edit boundary.

- **Environment-only, recovered:** the required uv command could not acquire a lock in
  its default read-only cache (`Could not create temporary file`). A writable empty
  cache then encountered unavailable PyPI DNS. Read-only access to the cached Oxigraph
  distribution first proved the packet script; copying only the necessary existing
  Oxigraph cache entries into a writable task-local cache allowed the required uv
  command body to pass offline, using cached Oxigraph 0.5.10 with Python 3.13. No network
  download or shared cache mutation was needed. A prepared writable/offline cache would
  prevent this setup friction.
- **Environment-only, recovered:** package dependency builds passed from cache, then
  the tsgo launcher failed before compilation with `spawnSync .../bin/node EPERM`.
  Yeet row `local-shard-26fb845c72f5` was acknowledged as environment-only. Direct
  invocation of the installed compiler proved compilation, and `bun --bun` routing
  made the complete package gate pass. A sandbox-compatible default Node launch route
  would prevent the failure. The remote-cache connection warning was nonfatal; local
  cached dependency builds completed.
- **Environment-only, recovered:** `.repos/effect` was absent. The canonical
  `scripts/setup-effect-ref.sh` linked the existing local reference checkout. The v4
  Schema/Class and Effect.fn APIs were verified there; no clone or tracked edit was needed.
- **Environment-only, nonfatal:** mise could not update its read-only tracked-config
  state when package commands started. Commands and checks still completed.
- **Introduced, fixed:** the new typed empty-episode boundary test initially used
  `decodeUnknownEffect`; the Effect compiler's TS377112 diagnostic correctly required
  `decodeEffect`. The missing-field case still uses the unknown-input decoder.
- **Introduced, fixed:** Biome requested wrapping of the new long assertion lines.
  Targeted formatting fixed it; the final package gate includes passing lint.
- **Invocation error, corrected:** a manual Vitest command combined a package root with
  a root-relative config path. The normal package test script passed.
- **Environment-only, unresolved:** named staging failed because the linked worktree's
  Git metadata is read-only. Minimal diagnostic:
  `Unable to create '<parent-checkout>/.git/worktrees/ontology-emission-v2/index.lock': Read-only file system`.
  This session exposes no escalation path. A verified session with write access to the
  linked worktree's actual Git metadata is required to finish the requested commit.

## 6. Open questions and branch commit

**No new commit exists.** Branch remains `feat/ontology-s7-emission-v2` at base HEAD
`663904610cce2a38c06b0619a8c414646b69361c`. The ten files above are uncommitted and unstaged.
Git staging by explicit filename was attempted once and failed before index creation.
No `git add -A`, push, PR, merge, branch change, or Git-metadata workaround was used.

The remaining operational step is to stage these ten paths and commit from a verified
session that can write the parent checkout's linked-worktree Git metadata. Suggested
conventional commit subject:

```text
feat(ciops): emit S7 ordering-cluster evidence v2
```

There are no unresolved implementation choices in the five-item bundle. The following
remain explicitly outside this lane and are documented for Fable's run-3 handoff:

- Steward ratification of the ordering cluster, provisional namespace, episode identity,
  specification identity, and the provisional deferred-membership support edge.
- Corpus-scoped replay identity does not establish persistence across journal captures;
  live callers remain responsible for their bounded occurrence key.
- `journalPrefixDigest` retains its current digest-plus-boundary locator semantics;
  changing it into an independently computed prefix hash would be a separate input-contract change.
- Consumers must replace an episode's current snapshot; RDF append alone does not retract
  old current-proposal assertions.
- S8 request IRI work, the seed/sample ordinal correction, CQ-019 bookkeeping, and the
  historical `schedulesWorkUnit`/object-`hasScope` decisions remain in their assigned docket.

Fable owns publication. Nothing was pushed and no PR was opened.
