# Legal Patent KG Deepening — Handoff Runbook

> **For a Claude Code / Codex session rooted at the beep-effect checkout.**
> This packet is the bridge from the verified campaign into the repo's
> `explorations/` → `goals/` pipeline. Re-ground first; do not shape from this
> seed without Benjamin's explicit sign-off.

## What this is

Artifact map, one line per operational file or retained source family:

- `README.md` — packet status, stage, and cold-session resume point.
- `CAPTURE.md` — append-only campaign intake and original research brief.
- `DECISIONS.md` — locked campaign design, stopping point, and PR cadence.
- `RESEARCH.md` — operating plan, standing repo bricks, and constraints.
- `research/00-catalog.md` — human-readable corpus and dedupe catalog.
- `research/00-catalog.json` — machine form of the source catalog.
- `research/00-inventory.json` — source inventory used by the mining passes.
- `research/01-repo-triage.md` — human-readable repository triage.
- `research/01-repo-triage.json` — machine form of repository triage.
- `research/mined/*` — per-source distillates retained as campaign provenance.
- `research/10-track-legal-core.md` — verified `T1-F1`–`T1-F10` synthesis.
- `research/11-track-patent-kg.md` — verified `T2-F1`–`T2-F10` synthesis.
- `research/12-track-graphrag.md` — verified `T3-F1`–`T3-F10` synthesis.
- `research/13-track-patent-llm.md` — `T4-F1`–`T4-F8` plus `T4-R1`,`T4-R2`.
- `research/14-addendum-new-items.md` — unverified `P100`,`P101`,`R25`.
- `research/20-adhd-integration.md` — wide set, traps, grills, and `ADHD-1`–`ADHD-3`.
- `research/SOURCES.md` — provenance and license ledger.
- `research/nugget-catalog.json` — 46-row routed machine ledger.
- `ROUTING-SEED.md` — grounded nine-cluster starting matrix.
- `routing-seed.json` — machine form of the routing matrix.
- `BRIEF.md` — existing stage template; **do not shape before sign-off**.
- `MAP.md` — existing stage template; **do not decompose before sign-off**.
- `ops/manifest.json` — authoritative packet stage/status state.
- `assets/README.md` — third-party asset handling contract.
- `HANDOFF.md` — this next-session runbook.

## Mission

Convert the campaign gold into the fuzzy-front-end pipeline with
**reconciliation first: nothing lost, nothing duplicated**.

Every ledger row (`T1-F1`–`T4-F8`, `T4-R1`,`T4-R2`, `P100`,`P101`,`R25`,
`ADHD-1`–`ADHD-3`) must remain traceable through a routed cluster, an existing
owner or approved proposed slug, and its eventual packet evidence.

## Hard constraints

1. Never silently re-litigate wave-1 or `goals/semantic-foundation`; challenges are named align branches, not implementation shortcuts.
2. The `[remo1]`/`[remo2]`/`[remo3]` grills are DECIDED (2026-08-01 reconciliation, see `DECISIONS.md`); apply the resolved boundaries — schema-level invariants with SHACL only via the semantic-foundation M4 gate, rows-first MatterProjection with no persistent graph store, and episode ledgers as product records with Cognee as lossy projection. Do not re-open them without a new grill.
3. Routing is SIGNED OFF (2026-08-01): shaping may proceed wedge-by-wedge starting with `patent-citation-candor-gate`, each new packet walking capture → research → align before its BRIEF; wedges beyond the approved four slugs still need Benjamin's routing approval.
4. Do not scaffold outside the approved wedge order, and do not change another packet's state without its own routing approval.
5. Keep `P100`, `P101`, and `R25` `unverified-addendum`; verify before adoption.
6. Keep `T4-R1` and `T4-R2` as rejected evidence; do not resurrect them as gaps.
7. Do not rebuild `TaxonomySeed`, `EdgeVersion`, `TextAnchor`, `EvidenceSpan`, `ClaimGate`, runtime draft/gate contracts, USPTO drift handling, or weighted RRF.
8. Keep legal vocabulary in a legal consumer domain; do not widen completed generic epistemic goals because their substrate is reusable.
9. `main` is PR-only; use the normal PR workflow and never merge unless Benjamin asks.
10. Preserve unrelated dirty and untracked work. No packet-wide cleanup.

## Next phase — reconciliation gate, then per-wedge `/explore`

### Phase 1 — re-ground and approve — ✅ COMPLETE (2026-08-01)

The reconciliation grill ran 2026-08-01 and Benjamin SIGNED OFF the matrix as
amended: all three `grill[...]` branches resolved without supersession,
promotion-gates cluster merged into `patent-drafting-episode-ledger` (four
proposed slugs remain), first wedge = `patent-citation-candor-gate`. Full
Q/A/rationale: [`DECISIONS.md`](./DECISIONS.md) (five 2026-08-01
reconciliation entries); amendments:
[`ROUTING-SEED.md`](./ROUTING-SEED.md) § Reconciliation amendments;
clarifying memory entry:
`standards/memory-architecture/04-decision-log.md`. Proceed to Phase 2
starting with `patent-citation-candor-gate`.

Original Phase 1 steps (retained for provenance):

1. Read the ledger and both routing seeds; confirm all 46 IDs occur exactly once.
2. Re-run cited live-tree searches; attribute drift before changing a route.
3. Present nine clusters, five proposed slugs, and three `grill[...]` branches to Benjamin; stop for approval.
4. If a route changes, update both forms and preserve displaced rationale.

### Phase 2 — per approved wedge — STARTED 2026-08-04

The first wedge is COMPLETE: `explorations/patent-citation-candor-gate`
walked capture → research → align → shape → decompose and GRADUATED
2026-08-04 into `goals/patent-citation-candor-gate` (graduation PR #560
merged 2026-08-05). The second wedge is at ALIGN-COMPLETE:
`explorations/legal-position-relator-runtime` (opened 2026-08-05 on
Benjamin's call), seeded from the positions/relators cluster plus the
carried contradiction-semantics cluster (re-routed 2026-08-04 — compose,
don't widen; see [`ROUTING-SEED.md`](./ROUTING-SEED.md) § Phase-2
amendments); its research lanes, synthesis, review gate 1, and all six
align branches closed by 2026-08-06, with the record landed via PR #573.
Phase shape remains sequential: `patent-drafting-episode-ledger` and the
FunctionalUnit extension into `explorations/uspto-patent-driver-depth` stay
queued on Benjamin's call.

Run the standard six `/explore` stages plus two review gates:

`capture → research → [review gate 1] → align → shape → decompose → graduate → [review gate 2]`

1. **capture** — scaffold only an approved slug; seed append-only `CAPTURE.md` with IDs, claims, distillates, and rationale.
2. **research** — re-ground external evidence and live capabilities; mark gaps `NOT FOUND`; update sources.
3. **review gate 1** — critique `RESEARCH.md` for unsupported claims, missed owners, license errors, and decision drift.
4. **align** — pre-draft one material question and recommendation; `/grill-with-docs` with Benjamin; record answer or deferral.
5. **shape** — after align/sign-off, draft problem, appetite, sketch, rabbit holes, and no-gos in `BRIEF.md`.
6. **decompose** — write `MAP.md` with goals, dependencies, first slice, and existing-capability or NET-NEW cites.
7. **graduate** — only after the four-point gate; scaffold approved goals and cross-link manifests.
8. **review gate 2** — critique each graduated `SPEC.md`; fold required fixes before quality proof or publication.

For `attach-existing` / `extend-goal` routes, append only after approval and
preserve the owning packet's manifest, stage, and source-ledger conventions.
For `dup-skip`, record the negative disposition and create nothing.

## Open questions still requiring align

1. ~~`[T1-F1,T1-F2,T1-F9]` Full Hohfeld scheme+bimap+relator in V1, or scheme-first?~~ RESOLVED 2026-08-06 (relator-wedge align): scheme + simple relator — see that packet's `DECISIONS.md`.
2. ~~`[T1-F3,T3-F9]` Re-scope contradiction triage for legal semantics, or split?~~ RESOLVED 2026-08-04 (phase-2 grill): compose, don't widen — rides with `legal-position-relator-runtime`; the triage SPEC is not amended.
3. `[T1-F4]` Is `goals/law-docketing-patent-spine` sufficient procedure ownership?
4. `[T1-F8]` Should UFO-L become a versioned donor-alignment model?
5. `[T2-F1,T2-F10]` Where does `FunctionalUnit` live, and what clean-room verb seed ships?
6. `[T2-F3,T2-F6,T2-F7]` One qualified-assertion protocol, or separate schemas?
7. `[T2-F1,T1-F3]` Does `CompatibilityAssessment` reuse triage evidence?
8. `[T3-F1,T3-F2]` One applicability value and one change-event family, or splits?
9. `[T3-F3]` Which LegalRuleML subset and legal package earn a donor profile?
10. `[T3-F6]` P054 Expression or P055 Work for temporal-version identity?
11. `[T3-F4,T3-F7]` Smallest retrieval API/answer annex and first locator families?
12. `[T3-F5]` Which independent benchmark avoids LKG-gold circularity?
13. `[T3-F8]` What reviewed state machine promotes quarantined phrases?
14. `[T3-F10,T4-F7,ADHD-3]` What raw fallback, episode set, and rebuild proof?
15. `[T4-F1,T4-F2,T4-F3,ADHD-2]` Which artifacts, support schema, and attorney gates?
16. `[T4-F4]` When should routing be learned, fixed, human, or fallback?
17. `[T4-F5,T4-F6]` Which owner and Party–Role/position states remain generic? — the `T4-F6` half RESOLVED 2026-08-06 (relator-wedge align): Party–Role split composing the shared `Principal`, agents runtime untouched; the `T4-F5` half stays with the `legal-rule-time-identity` cluster.
18. ~~`[T4-F8]` What generic correction-delta shape keeps ODRL caller-owned?~~ RESOLVED 2026-08-06 (relator-wedge align): the full Lane B shape, caller-owned — see that packet's `DECISIONS.md`.

## First action

Phase 1 is complete and signed off (2026-08-01 reconciliation grill), the
first Phase 2 wedge is GRADUATED (goal packet live on main), and the second
wedge is at ALIGN-COMPLETE (2026-08-06, record landed via PR #573). First
action is now to RESUME `explorations/legal-position-relator-runtime` where
its `README.md` Next Open Question points: draft `BRIEF.md` inside the six
closed align boundaries and iterate it with Benjamin to approval. Do not
re-scaffold the packet or re-run its completed research/align stages. Goal
graduation and merges still require Benjamin's explicit ask.
