## RATIFIED-CONFLICT

1. **BLOCKING — On-demand replay cannot reproduce a historical authority cut from the current repository.**
   A3 promises byte-identical reconstruction using the original `knownAt` ([DECISIONS.md:45-50](explorations/epistemic-belief-view-revision/DECISIONS.md:45); [03-view-composition-and-revision.md:61-64](explorations/epistemic-belief-view-revision/research/03-view-composition-and-revision.md:61)). But `recordedAt` is supplied by the caller and persisted verbatim, with no commit-sequence or ingestion-watermark constraint ([EdgeAuthority.repo.ts:98-129](packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts:98)). A row committed tomorrow with `recordedAt <= oldKnownAt` will appear when that old cut is replayed, although it was absent originally. The authority-cut digest detects the difference but cannot reconstruct the original set. Ratified on-demand replay requires a stable ingestion watermark/snapshot identity or enforcement preventing backdated transaction time.

## Replay and canonicalization

2. **BLOCKING — “Byte-identical” has no byte encoding to test.**
   The MAP requires an identical key and object ([MAP.md:26-35](explorations/epistemic-belief-view-revision/MAP.md:26)), while the BRIEF merely says “digest” and “canonically ordered” ([BRIEF.md:32-35](explorations/epistemic-belief-view-revision/BRIEF.md:32)). None of the five documents defines:

   - the encoded revision schema;
   - canonical object-key and nested-record ordering;
   - number/date/`Option` representation;
   - digest algorithm and domain separator;
   - encoding-version migration;
   - whether “object” means encoded bytes or structural equality.

   This matters because an `EdgeVersion` contains arbitrary JSONB `fact` values ([EdgeVersion.model.ts:117-131](packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:117)). The cited precedent proves only structural equality ([ClaimProjection.ts:71-104](packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts:71)). By contrast, the live logical-edge key explicitly specifies versioning, escaping, qualifier ordering, and component order ([LogicalEdgeIdentity.model.ts:296-392](packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:296)). The first-slice replay acceptance test is therefore unverifiable as written.

3. **BLOCKING — An immutable policy label does not preserve executable policy behavior.**
   Policies are ordinary code rather than a retained rules representation ([BRIEF.md:50-55](explorations/epistemic-belief-view-revision/BRIEF.md:50)), yet deltas must recompute an old revision using its original policy inputs ([DECISIONS.md:45-50](explorations/epistemic-belief-view-revision/DECISIONS.md:45)). Nothing requires an append-only registry of old executable implementations, identifies code by artifact digest, or defines what happens after deployment removes policy revision P1. Retaining `"P1"` is useless if only P2’s code remains.

## Scope-wide read

4. **BLOCKING — “All lineages” is unbounded, unpaginated, and unsupported by the live index layout.**
   The proposed operation returns every matching lineage ([MAP.md:11-14](explorations/epistemic-belief-view-revision/MAP.md:11); [BRIEF.md:44-48](explorations/epistemic-belief-view-revision/BRIEF.md:44)). No maximum matter size, cursor, streaming contract, memory limit, timeout, or overload result exists. Worse, the migration drops the `org_id` index, while the surviving as-of index starts with `logical_key`; neither supports an organization/matter-wide temporal scan ([migration.sql:6-7](packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql:6); [migration.sql:38-44](packages/_internal/db-admin/drizzle/20260813143745_baseline-functions/migration.sql:38)). At scale this becomes a full-table scan followed by unbounded decoding, grouping, sorting, and hashing.

5. **MAJOR — Pagination cannot simply be added without breaking cut consistency.**
   The live read is one statement for one `logicalKey` ([EdgeAuthority.repo.ts:415-426](packages/epistemic/server/src/EdgeAuthority/EdgeAuthority.repo.ts:415)). A paginated replacement would need stable ordering plus one repeatable-read snapshot or watermark across all pages; offset pagination under concurrent inserts can duplicate or omit rows. The artifact specifies none of these. The existing triage list demonstrates that this repository normally makes paging explicit and caps pages at 100 ([ContradictionTriage.commands.ts:180-207](packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.commands.ts:180); [ContradictionTriage.repo.ts:675-714](packages/epistemic/server/src/ContradictionTriage/ContradictionTriage.repo.ts:675)).

6. **MAJOR — “Org/matter scope” has no set semantics.**
   `matterScope` is optional and partitions identity ([LogicalEdgeIdentity.model.ts:279-289](packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:279)). The documents never say whether a request for matter M returns:

   - only `matterScope = M`;
   - M plus organization-wide rows where `matterScope` is absent;
   - every row in the organization, with matter filtering delegated to policy.

   These produce different authority cuts and revision keys. “All open lineages for an org/matter” is not executable until this is fixed.

## Policy-input closure

7. **BLOCKING — “Every policy input is as-of queryable or excluded” is prose, not an enforceable boundary.**
   The constraint appears in [MAP.md:40-45](explorations/epistemic-belief-view-revision/MAP.md:40) and [BRIEF.md:60-62](explorations/epistemic-belief-view-revision/BRIEF.md:60), but policies are unrestricted code. There is no closed `PolicyInputSnapshot` schema, pure function contract, permitted-service set, lint rule, or test proving absence of clock/current-state/network dependencies. The cited `ClaimProjection` precedent actually has such a closed pure `Fn` boundary ([ClaimProjection.ts:43-50](packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts:43)); the belief policy does not.

8. **BLOCKING — The revision digest omits non-authority policy-input state while claiming every semantic input changes the revision.**
   Research defines the digest from request, policy revision, authority-cut digest, and results ([03-view-composition-and-revision.md:24-35](explorations/epistemic-belief-view-revision/research/03-view-composition-and-revision.md:24)). It then says a changed assessment or disposition must produce a new revision ([03-view-composition-and-revision.md:43-48](explorations/epistemic-belief-view-revision/research/03-view-composition-and-revision.md:43)). If an assessment changes but the selected edge and emitted reason remain the same, every listed digest input remains unchanged. Two distinct policy-input snapshots therefore alias to one revision key. A canonical digest of the complete policy-input cut is missing.

9. **MAJOR — The first slice claims unresolved-contradiction handling without a viable untouched triage read.**
   The MAP requires `unresolved-contradiction` abstention while declaring triage unchanged ([MAP.md:26-38](explorations/epistemic-belief-view-revision/MAP.md:26)). The existing paginated list summary contains no left/right edge IDs or logical keys ([ContradictionTriage.ports.ts:142-170](packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.ports.ts:142)). Obtaining them requires paging every candidate and then issuing `getExpanded` per candidate. That creates an unbounded N+1 read with no common snapshot. Either a batch/scope triage read is another server-side addition, or the “only authority-surface change” scope is false.

10. **MAJOR — The BRIEF names policy-input types that do not exist in production code.**
    It says the view consumes `SemanticStance`, `AnchorVerificationResult`, and `SourceAuthorityAssessment` ([BRIEF.md:39-43](explorations/epistemic-belief-view-revision/BRIEF.md:39)). A repo-wide production search returned **0 definitions** for all three; occurrences exist only in this exploration’s prose. Yet the MAP’s NET-NEW inventory does not include creating them ([MAP.md:11-14](explorations/epistemic-belief-view-revision/MAP.md:11)). This is hidden domain-model scope, not live capability reuse.

## Typed delta across policy revisions

11. **BLOCKING — The four delta verbs are not total over two valid revisions.**
    The output union itself carries selected reasons and abstention reasons ([BRIEF.md:27-31](explorations/epistemic-belief-view-revision/BRIEF.md:27)), but the delta only admits `selected`, `replaced`, `abstained`, and `resumed` ([BRIEF.md:36-38](explorations/epistemic-belief-view-revision/BRIEF.md:36)). It cannot represent:

   - selected edge unchanged but selected reasons changed;
   - abstention retained but reason changed;
   - a contention set disappearing;
   - split/merge behavior across future key versions.

   Policy revisions are expressly allowed to change vocabulary ([DECISIONS.md:39-43](explorations/epistemic-belief-view-revision/DECISIONS.md:39)), making the first two cases unavoidable.

12. **MAJOR — Cross-policy deltas have no comparability or attribution rule.**
    Recomputing each endpoint under its original policy is possible only after fixing policy retention, but “replaced” then does not mean authority replaced anything—it may mean only that P2 ranks differently from P1. No delta schema records `fromPolicyRevision`, `toPolicyRevision`, key-version compatibility, or whether cross-policy comparison is permitted. The current wording silently conflates authority evolution with evaluator evolution ([DECISIONS.md:45-50](explorations/epistemic-belief-view-revision/DECISIONS.md:45); [03-view-composition-and-revision.md:55-59](explorations/epistemic-belief-view-revision/research/03-view-composition-and-revision.md:55)).

## Ratified contention dimensions

No material findings against the stated live identity fields: `evidenceScope`, matter, organization, qualifiers, relation, and endpoints are all present in `LogicalEdgeIdentity` ([LogicalEdgeIdentity.model.ts:277-290](packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:277)).


