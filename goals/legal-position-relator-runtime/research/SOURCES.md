# Legal Position Relator Runtime — Sources & Provenance

<!--
The provenance ledger an implementing agent reads to trace every decision back
to its origin. Inherited at graduate (2026-08-06) from the source exploration;
the exploration's ledger is the PRIMARY copy — this file reproduces the corpus
for implementation convenience and must not drift ahead of it.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk; otherwise cite the section that carries the claim.
- Licenses are load-bearing: copyleft upstream is CLEAN-ROOM only; permissive
  may be ported WITH attribution; missing/unverified LICENSE ⇒ reference only.
- Registered in ops/manifest.json `researchReports[]` + `currentSourceOfTruth[]`;
  `provenance.exploration` ↔ source exploration `links.goals`.
-->

- **Source exploration:** `explorations/legal-position-relator-runtime` —
  primary ledger:
  [`explorations/legal-position-relator-runtime/research/SOURCES.md`](../../../explorations/legal-position-relator-runtime/research/SOURCES.md).
- **Provenance:** second wedge of the `legal-patent-kg-deepening` campaign's
  signed-off routing matrix — the "Legal positions, relators, and authorized
  transitions" cluster (primary) plus the carried "Legal contradiction scope,
  priority, and correction deltas" cluster (re-routed 2026-08-04,
  compose-don't-widen), wave P1. Parent nugget ledger
  [`nugget-catalog.json`](../../../explorations/legal-patent-kg-deepening/research/nugget-catalog.json)
  — this goal consumes nuggets `T1-F1`, `T1-F2`, `T1-F7`, `T1-F9`, `T4-F6`,
  `P100`, `R25` (primary) and `T1-F3`, `T3-F9`, `T4-F8` (carried).

## 1. Mined source corpus

Inherited by reference from the parent campaign — the nuggets' distillates live
in `explorations/legal-patent-kg-deepening/research/mined/` (see each nugget's
distillate list in the exploration's
[`CAPTURE.md`](../../../explorations/legal-position-relator-runtime/CAPTURE.md)).
No new corpus was mined for this goal; links, not copies.

**How these inform implementation:**

- `T1-F1` is the correlativity invariant, but only after Lane B's correction:
  correlative (cross-party) and opposite (same-party) are **distinct** axes, and
  the opposite derivation is unsound over `kind` alone — it must range over
  `(kind, content)` with act/omission polarity. This is why `LegalActContent`
  exists and why polarity lives inside it.
- `T1-F2` is why the relator is an identity-bearing aggregate rather than a
  widened edge: UFO-L's correlated moments as "essential and inseparable parts"
  of one relator is the strongest support for storing one relation and deriving
  views.
- `T1-F9` becomes the relator's required-field set, with two Lane B corrections
  applied: `result` moves off the standing position onto the exercise event, and
  grounding events are a lineage reference rather than a scalar.
- `T1-F7` is the void-vs-penalised distinction — the two independent recorded
  axes that eFLINT's uniform violation rule would collapse.
- `T4-F6` is the Party–Role split; role multiplicity is the mechanism by which
  principle collisions arise.
- `T1-F3` / `T3-F9` / `T4-F8` are the carried contradiction cluster:
  `LegalScopeContext`, typed `PriorityBasis`, the four legal verdict families,
  and the caller-owned `CorrectionDelta` — all composed over the live triage
  contract without widening it.
- `P100` (FLINT act/fact frames, precondition → create/terminate) verified
  2026-08-05 as **verified-with-correction**: the frames check out verbatim, but
  "transition semantics over Hohfeldian relators" is false as written — FLINT
  models act frames *instead of* positions, and its maintainers point at Griffo
  et al. for the relation modelling this goal needs. Beep-fit passes for the
  frame/slot/precondition shape only; eFLINT's execution semantics are excluded.
- `R25` (`flint-ontology` executable artifacts) verified 2026-08-05 as
  **verified**, all four gates passing on the real repository.

Both verdicts were promoted to `adopt` in the parent ledger on 2026-08-06.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| `flint-ontology` — TNO GitLab (`normativesystems/knowledge-modeling/flint-ontology`, © TNO 2022, v1.0.0 dated 2025-12-03). **The repo is on GitLab, not GitHub.** | Top-level **Apache-2.0** | port-with-attribution | Frame/slot/precondition shape, source-reference-per-element discipline, the in-scope subset of the 22 competency queries. Follow the live Graphiti attribution precedent (`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:16-25`). |
| `flint-ontology/shacl/` | **MPL-2.0** | **clean-room re-expression only** | The hard/advisory severity split as a *concept*. MPL §1.4 scope is **file-level, not novelty-level**: anything taken from either `shacl/*.ttl` file is clean-room re-expressed regardless of novelty — no copying of shape text, SPARQL constraint bodies, or file structure — and the derivation is recorded here. The pre-existing `ShaclSeverity` in `@beep/semantic-web` narrows what this goal *wants* from `shacl/`; it does not narrow the obligation. |

No vendoring. `flint-ontology` is this goal's single code donor. Full
per-portion discipline table: exploration
[`research/02-position-relator-legal-frame.md`](../../../explorations/legal-position-relator-runtime/research/02-position-relator-legal-frame.md)
§3.

### Clean-room / attribution record (rung 2)

Recorded 2026-08-07 as the rung-2 domain schemas landed. The repository-level
notice for the Apache-2.0 portion is the new `## TNO (flint-ontology) —
Apache-2.0 material` section of [`THIRD_PARTY_NOTICES.md`](../../../THIRD_PARTY_NOTICES.md).

**Ported with attribution (top-level Apache-2.0).** Three shipped files carry
the TNO notice header, in the live Graphiti style
(`packages/epistemic/domain/src/entities/EdgeVersion/EdgeVersion.model.ts:16-25`):

- `packages/law-practice/domain/src/values/NormSourceReference/NormSourceReference.model.ts`
  — the source-reference-per-element discipline.
- `packages/law-practice/domain/src/entities/ActFrame/ActFrame.model.ts` and
  `.../ActFrame/ActFrame.values.ts` — the frame/slot/precondition shape and the
  `creates`/`terminates` pair.

What was **not** taken: eFLINT's execution semantics (the P100 correction).
Nothing evaluates a precondition, fires a transition, or derives a violation.
The positions a frame names are this goal's own Hohfeldian kind-and-content
pairs, `derivationKind` is a non-empty **set** rather than a single act type,
and preconditions carry an explicit present/absent polarity so a negative
operative fact is first-class.

**Clean-room re-expression (MPL-2.0 `flint-ontology/shacl/`).** The
hard/advisory severity split shipped as `CorrectionSeverity` in
`packages/law-practice/domain/src/entities/CorrectionDelta/CorrectionDelta.values.ts`
is a re-expression of a **concept only**. Neither `shacl/*.ttl` file was
consulted or copied during authoring: no shape text, no SPARQL constraint
bodies, and no file structure. MPL §1.4's scope is file-level rather than
novelty-level, so this record is made regardless of how unremarkable a
two-member severity vocabulary is. The file carries a header stating the same.
Consistent with the SPEC's Non-Goals, no executable validation shape ships:
severity is a recorded field on a transcribed report, and the live
three-member `ShaclSeverity` in `@beep/semantic-web` is neither adopted nor
imported.

## 3. External research sources

The UFO-L and FLINT/eFLINT **papers** are cited, never vendored. Only the CEUR
demo paper is CC BY 4.0; CALCULEMUS, the ILLC thesis, and the eFLINT arXiv
author-version carry no reuse licence — **no figures or extended passages may be
copied into repo docs** (Lane B §2.5, §9).

The full per-URL ledger with access dates is exploration
[`research/02-position-relator-legal-frame.md`](../../../explorations/legal-position-relator-runtime/research/02-position-relator-legal-frame.md)
§9, with failed and unverifiable fetches recorded in its §8
(NOT FOUND / NOT VERIFIED) rather than papered over. Source families:

- Hohfeld 1913 + 1917, from Yale's own repository (`openyls.law.yale.edu`);
  public domain. The `digitalcommons.law.yale.edu` host does not exist and
  `elischolar.library.yale.edu` returns 403 — both recorded. Wikisource was used
  only as an independent cross-check of the Hohfeld tables.
- Published FLINT / eFLINT papers (van Doesburg & van Engers and successors).
- Published UFO-L papers (Griffo, Almeida, Guizzardi).
- The TNO `flint-ontology` GitLab repository (§2 above).

Every citation in the lane file was actually opened.

## 4. In-repo capability references

Verified by exploration Lane A on 2026-08-05
([`research/01-repo-surfaces.md`](../../../explorations/legal-position-relator-runtime/research/01-repo-surfaces.md)),
then **re-verified against `main` on 2026-08-06** by a four-lane Opus panel
after the candor sibling's implementation (PR #575) merged; the decompose-stage
capability table with current anchors and inline DRIFT notes is the
exploration's
[`MAP.md`](../../../explorations/legal-position-relator-runtime/MAP.md).
Re-verify at P0 before relying on any anchor.

- `@beep/schema` — `LiteralKit`
  (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:747`,
  barrel `src/index.ts:285`) — reuse, LIVE SOURCE. Standing law for every
  string-literal vocabulary.
- `@beep/shared-domain` — the `Principal` five-member tagged union
  (`packages/shared/domain/src/entity/Principal.ts:244`), `BaseEntity` actor
  provenance (`.../entity/BaseEntity.ts:82`, `:88`, persisted `:108-110`,
  `:128-130`), and the `identity/LawPractice.ts` id factory (`:12`, with four
  candor-era registrations at `:217`, `:304`, `:338`, `:371`) — reuse +
  registration, LIVE SOURCE.
- `@beep/law-practice-domain` — `LegalClient`, `LegalContact`, `Matter` as the
  party-likes referenced, never re-minted. **Load-bearing caveat:** these are
  fixture-thin (three or four domain fields, single-member literal domains) and
  link to each other by `legalClientFixtureKey` **text, not an EntityId foreign
  key**. No design may assume entity-ref edges between law parties.
- `@beep/law-practice-use-cases` / `@beep/law-practice-server` — the in-slice
  append-only precedent trio landed by PR #575: `CandorRecord.ports.ts` (no
  update, no delete; shape `:190`, service `:282`), the drizzle repo/layer in
  `server/src/CandorRecord/`, and the `Context.Service`-tag-lives-in-`*.ports.ts`
  convention (`CandorPolicy.ports.ts:243`) — PRECEDENT, in-slice.
- `packages/_internal/db-admin` plus the proof oracle's manifest, which lives in
  the CLI tooling package at
  `packages/tooling/tool/cli/src/commands/Architecture/internal/AcceptedProofManifest.ts`
  (**not** under `db-admin`) — the law-practice migration lane, opened by
  `20260806031625_law_practice_candor_gate` with its PGlite proof and three
  manifest entries for that lane (`:808`, `:814`, `:874`) — PRECEDENT to clone;
  this goal is **not** the first mover (SPEC decision 11).
- `@beep/epistemic-domain` / `@beep/epistemic-use-cases` — `EdgeVersion`'s
  `supersedesId` lineage posture, `SymmetricEdgeRelation`'s `pickOptions` + `S.is`
  subdomain derivation, `orderEndpoints`' canonicalisation, the `ExecutionLedger`
  ports, and the live five-operation `ContradictionTriageRepository` contract
  (`ContradictionTriage.ports.ts:374-395`) — **patterns, not imports**, except
  the triage contract, whose consumption shape is a P0 decision. Note `submit`
  exists only on the repository port (no RPC, no service-facade method).
- `@beep/semantic-web` — `ShaclSeverity`
  (`packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:49`)
  is live with three members; the `CorrectionDelta` **contract** vocabulary
  stays at two (hard/advisory) and never adopts the three-member model.
- SPEC CONTRACT only (compose-only, never fork or amend):
  `goals/epistemic-contradiction-triage` (**landed-but-unverified** — P2 Verify
  in progress), `goals/semantic-foundation`,
  `goals/agentic-professional-runtime`. `goals/patent-citation-candor-gate` is a
  stable precedent reference, never a dependency.
- **NET-NEW** (zero source symbols, re-confirmed 2026-08-06):
  `HohfeldPosition`, `LegalActContent`, the correlative and opposite
  derivations, `Party`, `LegalRole`, `LegalPositionRelator`,
  `LegalScopeContext`, `LegalPositionRelatorPolicy`, and rung 2's
  `PowerExercise`/`ActFrame`, `SlotCorrespondence` (follow-on), `CorrectionDelta`,
  `PriorityBasis`. The derivations were challenged adversarially at decompose:
  five live inverse-flavoured surfaces exist and all five are the wrong shape —
  see `MAP.md`'s "Why every live analogue is rejected" row.

## 5. Cross-links & provenance

- Source exploration packet:
  [`explorations/legal-position-relator-runtime/`](../../../explorations/legal-position-relator-runtime/README.md)
  — BRIEF (approved 2026-08-06), DECISIONS (the ten-entry binding log seeded
  into `SPEC.md`), MAP (decompose surface with the current capability anchors),
  RESEARCH + both lanes.
- Parent campaign:
  [`explorations/legal-patent-kg-deepening/`](../../../explorations/legal-patent-kg-deepening/README.md)
  (routing seed, nugget ledger, campaign DECISIONS, HANDOFF).
- Sibling wedge (graduated and implemented):
  `goals/patent-citation-candor-gate` — the precedent for package home, entity-id
  registration, the append-only durability trio, the migration lane, and the
  owner ruling that deferring a cross-slice consultation with recorded evidence
  beats claiming an unprovable one.
- Composed goal SPECs: `goals/epistemic-contradiction-triage`,
  `goals/semantic-foundation`, `goals/agentic-professional-runtime`; bounded
  exception evidence in `goals/law-practice-office-action-spike/SPEC.md:258`.
- This goal's decision log lives in [`SPEC.md`](../SPEC.md), seeded from the
  exploration's DECISIONS at graduate — back-links, not copies.
