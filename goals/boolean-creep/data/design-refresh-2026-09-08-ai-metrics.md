# AI-metrics contract correction audit — 2026-09-08

## Source and scope

- checkout source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- packages/apps corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- candidate source:
  `data/sweeps/refresh-2026-09-08-r25-main-9b7553/r25-ai-metrics-contract-correction1.jsonl`
- result: all five corrected candidates are qualified Tier 2 designs
- changes are packet Markdown only; no source, test, inventory, status, Git, or
  dependency mutation

## `ai-metrics-mirror-privacy-proof`

Qualification is supported by E3/E1. `mirror.ts:521-531` documents `safe` iff
`forbiddenMatches` is empty. `privacyProofFor` at 826-849 computes the matches
and derives the boolean in the only production scan. The probe at 991-1007 is
the same safe+empty tuple and is replaced before the final manifest encode.
The unsafe reader at 1022-1023 fails before status, manifest, and pointer writes.

The whole-cluster cardinality is 4/2 after coarsening the array to
empty/nonempty. Safe+empty and unsafe+nonempty are legitimate; both mixed pairs
lack a producer, fixture, or documented meaning. Although only the safe arm can
reach disk, the unsafe arm is a supported pre-write result and must remain in
the decoded union.

Persistence is nested at `AiMetricsMirrorBundleManifest.privacyProof`
(lines 653-683), encoded at 1008-1019, and written at 1026-1031. The target is a
safe/unsafe tagged union behind a private exact legacy codec. Compatibility
covers both legitimate arms and preserves the manifest fixture at
`test/mirror.test.ts:51-69`, including the `safe` boolean, match array, and
property order.

## `ai-metrics-config-snapshot-bounds`

Qualification is supported by E3/E1. Enumeration/read stages carry an Option
reason at `config-snapshot.ts:580-754`; `makeAiMetricsConfigSnapshot` combines
them at 990 and writes `truncated: O.isSome(truncationReason)` at 991-998. The
reason LiteralKit has `max-files`, `max-total-bytes`, and `max-depth` at
234-247. Tests exercise all three at
`test/config-snapshot-bounds.test.ts:220-307`; oversize-file skipping remains a
nontruncating independent count at 310-329.

The pair is 4/2: false+missing and true+present are legitimate. No supported
producer gives true+missing or false+present meaning. The target is a
complete/truncated tagged union with required reason on the truncated arm,
behind an exact legacy codec.

The bounds report is nested at `AiMetricsConfigSnapshotResult.bounds`
(lines 497-526), read from previous JSON at 871-899, encoded at 1218-1224, and
written to snapshot-id plus `latest.json` at 1118-1160. Compatibility preserves
whole-bounds omission for legacy manifests, the default budget, optional
`truncationReason` omission, all field names/values/order, and the exact clean
encoding asserted at test lines 378-410.

## `ai-metrics-redaction-safety`

Qualification is supported by E3. `privacy.ts:689-702` is the only production
writer and derives `safeForDerivedUi` from the sum of four independent regex
counts. The independent `excludedRawTextFieldCount` is outside the cluster.

The corrected coarse cardinality is 32/16. I reproduced all 16 zero/nonzero
counter subsets through public `makeAiMetricsPrivacyCheckResult` using only
synthetic strings:

- authorization header: `Authorization: fixturevalue`
- bearer token: `Bearer fixturetoken`
- OpenAI-shaped key: `sk-fixturekey`
- assignment: `SYNTHETIC_TOKEN=fixtureassignment`

Every mask from 0 through 15 produced exactly its selected counters. Mask 0 was
safe; masks 1-15 were unsafe. No real transcript or credential was read. This
proves the four detectors are independent axes and prevents collapsing all
unsafe results to one payload-free state.

The design uses a four-value detector LiteralKit and an ordered nonempty list of
`{ detector, count: Positive }` on the unsafe tagged arm; the safe arm has no
matches. A private legacy codec reconstructs the exact four named count fields
and derives the legacy boolean. The full result is encoded by
`privacyCheckToJson` (`privacy.ts:933-942`), printed at
`AIMetrics/internal/Programs.ts:1420-1452`, and its boolean is projected into
DuckDB at `derived-storage.ts:122-142,1250-1271`. Compatibility tests cover all
16 subsets, exact JSON property order, CLI rendering, and the unchanged SQL
boolean. Mixed safety/count encodings are rejected as incoherent.

## `ai-metrics-canonical-root-kind`

Qualification is supported by E3/E1. `identity-registry.ts:588-614` derives
`isLinkedWorktree` from `probe.kind`, writes it to
`excludedFromParentSnapshot`, and includes `parentRootId` only for that branch.
Tests prove primary at 98-116 and linked at 119-143.

The full cluster is 8/2:

| kind | excluded | parent | supported |
| --- | --- | --- | --- |
| `primary-clone` | false | absent | yes |
| `linked-worktree` | true | present | yes |

The other six tuples have no supported constructor, fixture, or reader meaning.
The target uses the existing kind LiteralKit as a two-case tagged-union
discriminator: primary has no parent payload; linked requires it. A private
encoded root schema preserves the legacy boolean and optional parent key.

Roots are nested in `AiMetricsIdentityRegistry` at lines 203-217, decoded from
persisted JSON at 745-759, copied by `withFirstSeen` at 762-766, merged and
atomically written at 839-912, and round-tripped in tests at 540-575. The codec
proof preserves every root key/order, parent omission, revision omission,
registry array ordering, registry version/defaults, and hash-salt legacy
migration. It rejects all six mixed tuples.

## `ai-metrics-phoenix-sync-policy`

Qualification is supported by E3/E1. The shared
`AgentEffectivenessMutationPolicy` has eight literals at
`agent-effectiveness.ts:289-302`, but sync result writers at 3814-3855 and
3917-4019 produce exactly seven dry-run/policy pairs. The 16 representable pairs
therefore have seven supported outcomes:

1. true + `dry-run-annotation-check-failed`
2. false + `blocked-annotation-check-failed`
3. true + `dry-run-dataset-check-failed`
4. false + `blocked-dataset-check-failed`
5. true + `dry-run-no-phoenix-mutation`
6. false + `blocked-missing-confirmation-token`
7. false + `confirmed-phoenix-write`

The eighth literal, `local-only-no-phoenix-mutation`, is legitimate only for
`AgentEffectivenessAnnotationPlan` at 1266-1288 and 3321-3327. The design keeps
the shared eight-value policy and annotation plan unchanged, introduces a
seven-value Phoenix subset LiteralKit, and removes `dryRun` only from decoded
sync results. The private encoded result keeps both legacy keys and rejects the
other nine pairs.

`AgentEffectivenessPhoenixSyncResult` encodes JSON at 2012-2033 and 4604-4610.
The CLI renders both fields at
`AgentEffectiveness.command.ts:293-317`, prints the result, and only afterward
maps failed status to a controlled exit at 424-460. The plan preserves the
current failure precedence: annotation check, dataset check, dry-run success,
missing confirmation, then Phoenix writes. Existing arbitrary schema tests at
`test/agent-effectiveness-command.test.ts:118-152` currently generate
unsupported pairs; replace that generator with all seven supported policies and
arbitrary independent payloads, then add nine rejection rows. Preserve default
dry-run CLI JSON at test lines 317-345 and all write/failure tests.

## Separate Scorecard readiness/count correction

The two proposed D1 rows comparing `completionReady` with `coverageGaps` remain
D1 because coverage includes independent model-call, tool-invocation, and
always-present cost gaps (`scorecard.ts:1204-1232`). A separate correlated
cluster exists and should receive its own record(s).

`Scorecard` at `models.ts:1023-1039` stores `completionReady` together with
`taskCount`, `labelCount`, and `benchmarkRunCount`. `scorecardCompletionReady`
at `scorecard.ts:1234-1242` defines readiness as all three counts positive;
`scorecardFor` computes all four together at 1263-1280; `writeScorecard`
persists all four at 1287-1333. This is E3/E1, persisted, Tier 2, and should
target a compatibility schema that derives readiness from the counts.

The precise coarse cardinality is 16 representable / 6 legal, rather than 16/8.
The weekly report unions config ids from independent task and benchmark queries
at 1433-1453, so benchmark presence is independent. The task aggregate starts
from tasks and left-joins labels at 1055-1086, so label-positive with task-zero
cannot be produced, even if orphan label rows exist. The six possible count
presence tuples are `000`, `001`, `100`, `101`, `110`, and `111`; readiness is
true only for `111`. Schema arbitrary values do not make `010` or `011`
legitimate. Proposed metadata:

- id: `ai-metrics-scorecard-completion-readiness`
- file/symbol: `packages/tooling/library/ai-metrics/src/models.ts:1023`,
  `Scorecard`
- members: `completionReady`, `taskCount`, `labelCount`, `benchmarkRunCount`
- evidence: E3 at `scorecard.ts:1234-1242,1263-1280`; E1/persistence at
  `scorecard.ts:1287-1333`
- cardinality: representable 16, legal 6
- storage/exposure/target/tier: derived, persisted, tagged-union or count-source
  compatibility codec, Tier 2

`AgentEffectivenessScorecardSummary` at `agent-effectiveness.ts:820-838` repeats
the same four fields. Its writer at 2698-2741 copies the canonical persisted
scorecard row. The repository has one manual SQL fixture at
`test/agent-effectiveness.test.ts:74-124`; it uses supported tuple `100` with
readiness false. No documented fixture gives an incoherent readiness/count
pair meaning. Canonical DB provenance therefore supports E1 carry-through, but
the SQL row schema itself is permissive. Proposed metadata:

- id: `ai-metrics-scorecard-summary-completion-readiness`
- file/symbol:
  `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:820`,
  `AgentEffectivenessScorecardSummary`
- members: `completionReady`, `taskCount`, `labelCount`, `benchmarkRunCount`
- evidence: E1 carry-through at `agent-effectiveness.ts:2698-2741`, rooted in
  the canonical scorecard writer above
- cardinality: representable 16, legal 6
- storage/exposure/target/tier: stored, wire, tagged-union or count-source
  compatibility codec, Tier 2
- qualification caveat: explicitly reject or normalize incoherent legacy SQL
  rows only after P2 establishes the desired persisted-row compatibility policy

## Verification

Each new design has the required current-shape, cardinality, target, migration,
guard-deletion, encoded-impact, test, and risk sections. A scoped check found no
trailing whitespace or missing sections in any owned file.

`mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` reached
114 qualified live ids and failed only for three unrelated concurrently
admitted designs that were still absent: `scheduler-protocol-eviction-mode`,
`coverage-baseline-write-mode`, and `yeet-prepared-publish-commit`. The five
canonical AI-metrics ids had not yet been admitted to the live inventory when
this check ran, as requested; their files are complete for admission. No
package verification is required for packet-only Markdown.
