# 2026-09-03 — Sol (GPT-5.6, medium) adversarial review of MAP v1.1 re-entry decomposition

Lane: `codex exec -s read-only`, model gpt-5.6-sol, reasoning medium, session read-only (the report could not be written by the lane; captured from its final message). Reviewed MAP §Re-entry Decomposition + DECISIONS 2026-09-03 R1–R3 against live source at `a1652c1923`. Disposition of each finding is recorded in DECISIONS 2026-09-03 (review fold).

# Semantica re-entry decomposition — adversarial review

## Verdict

**REWORK.**

The ownership move behind R2 and the decision/facts split behind R3 are defensible. R1 is not ready for ratification: its cryptographic-verification and physical-erasure claims do not follow from the live ledger. Four of fourteen capability cells are not confirmed—three contain mismatches and one depends on unavailable external state. The proposed rules fixture also needs a new tagged fixture contract before its five case classes are representable.

## P1 findings (must-fix, with evidence)

1. **§S `Invalidated` capability: the cited identities cannot express the promised support retraction.**

   `InvalidatedEventBody` targets a `ClaimId` (`apps/labs/semantica/src/schema/Provenance.ts:70-79`), while `InferenceEvent.premises` and every `ProofDag` node use `StatementId` (`apps/labs/semantica/src/schema/Reasoning.ts:273-286`, `apps/labs/semantica/src/schema/Reasoning.ts:342-357`). No cited schema records a claim/event-to-statement support edge.

   Consequently, the claimed bricks cannot derive “every downstream inference whose premise closure includes an invalidated claim” as promised by `explorations/semantica-lab/MAP.md:203-205`, `:221`, and `:233`. Add an explicit content-addressed claim/event-to-statement lineage bridge and specify how it is rebuilt.

2. **§S `Redacted`/`Compacted` capability: retaining `(id, digest)` after removing `payload` does not verify the current hash chain.**

   A `ProvenanceEvent` requires its `body`; its id is recomputed from canonical `(prev, body)` (`apps/labs/semantica/src/schema/Provenance.ts:136-145`, `:163-183`). The stored row digest separately hashes the complete encoded event payload (`apps/labs/semantica/src/layers/LedgerLive.ts:49-56`, `:92-100`).

   Once that body/payload is absent, neither preimage can be recomputed. A retained digest is only a commitment to unavailable bytes, not proof that those bytes were the event whose id is retained. In addition, `appendEvent` checks stored-digest equality but does not verify predecessor existence, uniqueness of the head, or acyclicity (`apps/labs/semantica/src/layers/LedgerLive.ts:92-100`).

   The claim that the chain “still verifies end to end” is therefore false under the live schema (`explorations/semantica-lab/MAP.md:209-215`, `:234`). Define an actual redaction-proof or commitment scheme plus a chain-validation algorithm, or weaken the property to continuity from a trusted compacted checkpoint.

3. **R1 does not physically erase a document.**

   The proposed operation nulls an event payload (`explorations/semantica-lab/MAP.md:209-215`), but current DDL makes every payload `NOT NULL` (`apps/labs/semantica/src/layers/LedgerLive.ts:80-86`). More importantly, document-derived content is independently retained in `parse_outcomes`, `chunks`, `batches`, and `claims` (`apps/labs/semantica/src/layers/LedgerLive.ts:114-139`, `:151-185`).

   Ledger reads and RDF rebuilds consume `parse_outcomes` and `batches`, not the `Parsed`/`Chunked` event bodies (`apps/labs/semantica/src/layers/LedgerLive.ts:205-229`, `apps/labs/semantica/src/layers/RdfProjectionLive.ts:67-73`). Redacting those two events therefore neither removes the document from rebuild nor erases canonical text, evidence quotes, claims, TOAST/WAL copies, provider-cache copies, or report copies.

   Specify the complete erasure closure and its atomic rewrite/swap protocol. A `ProvenanceEventId` alone is not a sufficient erasure target.

4. **§S rebuild-identity cell cites two symbols at the wrong path.**

   `QuadDelta` is in `apps/labs/semantica/src/schema/Projection.ts:293-312`. `CrashProjectionInput` and `CrashIdentityWitness` are instead in `apps/labs/semantica/src/schema/Reasoning.ts:548-592`, contrary to the compound `src/schema/Projection.ts` citation at `explorations/semantica-lab/MAP.md:235`.

5. **R2’s claimed case-runner shapes cannot encode the proposed fixture.**

   `GEntailmentExpectation` is fixed to `g-entailment-rdfs/v1`. Its cases contain only `asserted`, `expectedDerived`, and `proofs`; the witness contains only derived statements and inference events (`apps/labs/semantica/src/schema/Reasoning.ts:478-514`, `:516-545`).

   These shapes have no fields or variants for:

   - a user rule program;
   - an invalidated input;
   - a before/after retraction diff;
   - a depth or fan-out budget;
   - an `InferenceTruncated` fact;
   - a conflict expectation.

   `ConflictWitness` also connects two `ClaimId`s (`apps/labs/semantica/src/schema/Evidence.ts:847-858`), while reasoner conclusions are `StatementId`s (`apps/labs/semantica/src/schema/Reasoning.ts:351-357`). Thus `explorations/semantica-lab/MAP.md:251-257` overstates the reuse.

   Define a schema-first `g-entailment-rules/v1` tagged case/expectation/witness family before fixing the case count.

6. **R-d and R-e lack coherent independent-oracle semantics as written.**

   A result truncated at a declared boundary cannot simultaneously equal EYE’s untruncated closure (`explorations/semantica-lab/MAP.md:267`). R-d needs two separate expectations: EYE’s complete closure and a deterministic budget-prefix/truncation witness.

   EYE can independently establish that two triples are derivable, but it cannot produce the lab’s application-level `ConflictWitness`, whose endpoints and basis are claim-domain data (`apps/labs/semantica/src/schema/Evidence.ts:847-858`). R-e must separate EYE derivability gold from lab-owned conflict classification.

7. **The proposal misstates S8 and silently multiplies S1’s breaker budget.**

   S8 rejects EYE’s selected premise set as the oracle specification; it still requires each local `InferenceEvent` to validate against its own premises and rule (`explorations/semantica-lab/DECISIONS.md:381-387`). The P-S1 kill clause instead says any need for premise-set identity is forbidden (`explorations/semantica-lab/MAP.md:221`). That would kill the truth-maintenance mechanism the spike needs.

   S1 buys another **candidate** after a failed candidate (`explorations/semantica-lab/DECISIONS.md:314-320`). It does not grant “first probe plus one retry each” to all three storage probes (`explorations/semantica-lab/MAP.md:217-223`). Rewrite both statements without enlarging the ratified breaker.

8. **R3 follows the latest atlas decision, but the formal Current-law verdict map still contradicts it.**

   The Current-law Atlas-writes row says positive row values are unblocked and belong to this re-entry (`explorations/semantica-lab/DECISIONS.md:25`). P5 says the same (`goals/semantica-canary/history/p5-atlas-sync.md:7-13`).

   The adjacent Current-law Verdict map nevertheless says atlas rows may write “today only final park/drop” (`explorations/semantica-lab/DECISIONS.md:30-37`), while R3 proposes positive values (`explorations/semantica-lab/MAP.md:297-305`). Ratification must amend that stale cell so Current law is internally coherent.

   B1 otherwise forbids nothing currently in scope: the matching canary passed, and R3 writes row-level `adopt|adapt|already-have` values—not family `pick-one|bundle` verdicts or sheet winners.

## P2 findings (should-fix)

- **R1 overstates the uniformity of the live ledger.** The seven tables carry digest-checked JSON payloads, but not every primary key is the digest of its complete row. For example, `parse_outcomes.id` is the document id while its digest covers `LedgerDocumentSnapshot` (`apps/labs/semantica/src/layers/LedgerLive.ts:80-86`, `:114-127`). Say “digest-checked payload rows,” not seven uniformly content-addressed tables.

- **PGlite byte reclamation is a valid spike question, not an established capability.** This checkout pins PGlite 0.5.8 (`package.json:48`) and exposes durable Node/Bun `dataDir` storage (`packages/drivers/pglite/src/PgliteClient.service.ts:59-76`, `:126-132`). PostgreSQL documents that plain `VACUUM` normally makes space reusable internally, whereas `VACUUM FULL` rewrites relations and can return space to the operating system. [PostgreSQL VACUUM documentation](https://www.postgresql.org/docs/current/sql-vacuum.html)

  PGlite documents NodeFS persistence but gives no equivalent byte-reclamation guarantee. [PGlite filesystem documentation](https://pglite.dev/docs/filesystems)

  No `VACUUM`, `VACUUM FULL`, compaction, or size-reclamation path/test exists in the cited driver or lab. Name the exact SQL variant, close/checkpoint boundary, WAL/TOAST accounting, and filesystem metric. Copy-to-fresh-`dataDir` remains the conservatively specified fallback.

- **Qualify the rule-language claim.** `StatementPattern` permits a constant or variable in subject, predicate, and object positions, and `RdfsRule` permits a non-empty positive body with one triple head (`apps/labs/semantica/src/schema/Reasoning.ts:54-86`, `:107-116`). That can express positive, function-free, single-head RDF-triple production rules over user IRIs.

  It is not general Datalog:

  - variables are limited to nine predefined names;
  - there is no schema-level range-restriction check;
  - negation, strata, built-ins, and actions are absent;
  - the live engine hardcodes `RDFS_RULES` instead of accepting a rule program (`apps/labs/semantica/src/layers/ReasonerLive.ts:156-180`);
  - an unbound head is rejected only during execution (`apps/labs/semantica/src/layers/ReasonerLive.ts:116-125`).

  Widen and brand rule/variable ids, enforce safe heads in the schema, and narrow the prose to the positive triple-rule fragment.

- **The five fixture classes are unevenly defensible.** Join and recursion are sound positive-rule coverage. R-c’s EYE run over `(asserted − retracted)` is a useful recomputation oracle, but it does not itself test incremental truth maintenance. R-d and R-e need the P1 separation above.

  Omitting negation from `gold/v1` is defensible: the workload contract asks for approximately twenty production-rule cases, not negation specifically (`explorations/semantica-lab/research/workload-contract.md:39-47`), and the current pattern language has no negated atom. Record it as an unsupported language feature. Restricted EYE accepting negation would not, by itself, make the lab’s rule schema support it.

- **R2’s fixture-as-P1 move is otherwise consistent with A6, S1, and E8.** It removes an ownerless prerequisite, remains engine-free, and supplies the ablation corpus A6 requires (`explorations/semantica-lab/DECISIONS.md:201-205`, `explorations/semantica-lab/research/adhd-reasoning.md:125-133`). Treat fixture construction as prerequisite evidence rather than a candidate attempt; apply S1/E8 when an actual slate candidate runs.

- **R3 is lawful only if package existence is not treated as a verdict.** A9 requires repo-owned decision evidence (`explorations/semantica-lab/DECISIONS.md:212-215`), and D7 says incumbency is not quality (`explorations/semantica-lab/DECISIONS.md:93-97`). Every `already-have` row needs a dated, row-specific decision—not merely an existing `@beep/*` counterpart.

  Freeze the exact row inventory before calling the lane bounded. Also clarify that “zero schema” means zero **Notion** schema changes because `atlas-verdicts/v1` is itself NET-NEW (`explorations/semantica-lab/MAP.md:297-305`).

  O3/M4 otherwise support the verdict/facts split and keep template work, IR row-fill, and module analyses outside this goal (`explorations/semantica-lab/DECISIONS.md:293-297`, `:472-476`). O3’s version trigger remains unverified, but its atlas-edit-need alternative has fired.

## Confirmed cells (count)

**10/14 whole capability cells confirmed. Partially correct cells are not counted.**

| Section | Confirmed cell | Evidence |
| --- | --- | --- |
| §S | File-backed ledger | `packages/drivers/pglite/src/PgliteClient.service.ts:59-76`; `apps/labs/semantica/src/layers/LedgerLive.ts:257-267`; `apps/labs/semantica/src/schema/Telemetry.ts:30-48` |
| §S | Bitemporal/lifecycle borrow-shapes | `explorations/semantica-lab/research/effect-ontology-map.md:102-105`, `:148-149`; `packages/foundation/modeling/rdf/src/Prov.ts:272-284` |
| §S | Upstream shape being inverted | `explorations/semantica-lab/research/grounding-semantica-repo.md:76-79` |
| §R | P-R1 already-have | `apps/labs/semantica/src/schema/Reasoning.ts:342-357`, `:399-425`; `explorations/semantica-lab/DECISIONS.md:705-722` |
| §R | P-R2 already-have | `apps/labs/semantica/src/schema/Reasoning.ts:107-116`; `apps/labs/semantica/src/layers/ReasonerLive.ts:247-315` |
| §R | P-R3 already-have | `apps/labs/semantica/src/schema/Evidence.ts:727-732`, `:920-925`; `apps/labs/semantica/src/layers/LedgerLive.ts:151-195` |
| §A | Sync method | `goals/semantica-canary/history/p5-atlas-sync.md:15-25` |
| §A | Verdict domain | `explorations/semantica-lab/DECISIONS.md:67-70`; `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:730-770` |
| §A | Tracked evidence precedent | `explorations/semantica-lab/research/SOURCES.md:37-48`; the 725-row inventory is present |
| §A | Historical IR extractor | `explorations/semantica-lab/research/SOURCES.md:103-105`; all three paths exist at `fd560ca8e5`; fail-closed/output-digest evidence at `explorations/semantica-lab/research/ir-extraction-report.md:8-16` |

Not counted:

- §S `Invalidated`: identity-domain mismatch.
- §S `Redacted`/`Compacted`: verification claim is unsound.
- §S rebuild witness: wrong symbol paths.
- §A Notion read/write: unavailable external state.

## Unverified claims

- **PGlite reclaim:** whether PGlite 0.5.8 under Bun/NodeFS successfully executes `VACUUM FULL`, synchronizes the rewritten relation and WAL files, measurably shrinks the complete `dataDir`, and survives SIGKILL as exactly pre- or post-state. PostgreSQL’s behavior does not prove the PGlite WASM/VFS outcome.

- **Notion capability cell:** this review session exposes no Notion client. The claimed Claude plugin availability, Codex OAuth recovery, and `--approve-for-me` write path could not be live-verified. P5 proves the previous method and previous writes, not current authentication (`goals/semantica-canary/history/p5-atlas-sync.md:15-25`, `:55-60`).

- **Regenerable storage fixture:** the committed C2 archive confirms report digest `2a2089ea…`, but the archived directory contains reports, telemetry, a checksum manifest, and a crash log—not a ledger or provider cache (`goals/semantica-canary/history/p4-c2-r2.md:24`; `goals/semantica-canary/history/c2/SHA256SUMS:1-5`). Prove cache-only ledger regeneration before describing the fixture as available.

- **External/version state:** semantica 0.6.7+ was explicitly not polled, and the v3 archive’s absence is a dated workstation observation rather than checkout-verifiable current state (`explorations/semantica-lab/DECISIONS.md:781-805`). Neither should be presented as current beyond that dated scope.