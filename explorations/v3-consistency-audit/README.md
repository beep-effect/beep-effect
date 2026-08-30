# v3 Consistency Audit — Migrate the Uniformity, Not the Architecture

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

v3 (`beep-effect4`, archived 2026-02-22) was uniform by habit: one author,
one scaffold, `<Concept>/<Concept>.<role>.ts` everywhere in the domain tier,
`export * as` barrels, `RepoLive` 39/39. v4's architecture is better
(hexagonal slices, use-cases/ports, family/kind grammar, boundary arrows) but
its module consistency, namespacing and collocation lag: the doctrine, the
CLI's canonical proof (`architecture-lab`) and the eight live slices speak
three grammars, and nothing mechanical checks any of them. Agents writing
slices in parallel keep gates, not habits. This packet inventories v3's
uniformity patterns with counts from both checkouts, grades each one
codified / drifted / missing against v4 doctrine **and** code, and recommends
how each becomes a gate — without relitigating v4's boundaries or the
PascalCase decision.

## Next Open Question

None — graduated 2026-08-30. The work lives in
[`goals/slice-topology-audit`](../../goals/slice-topology-audit/README.md)
(provides `architecture/slice-audit`; amendments PR → `audit` command +
baseline PR → gate PR) and
[`goals/canonical-proof-reconciliation`](../../goals/canonical-proof-reconciliation/README.md)
(requires it; manifest + lab PR, then one codemod PR per slice). The nine
DEFERRED measurement rows ratify in the audit packet's P0 with the recommended
answers in `DECISIONS.md`. The three gated follow-ons in `MAP.md`
(`family-anchor-audit`, `move-concept-codemod`, `contract-test-lens`) reopen
this packet at `decompose` when their gates fire.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) — machine state.
2. `README.md` — this file.
3. [`synthesis/00-convention-inventory.md`](./synthesis/00-convention-inventory.md)
   — **the deliverable table**: 110 rows, all Codex-verified (105 on
   2026-08-29/30, the 5 operator-addendum rows on 2026-08-30), pattern → v3 evidence →
   v4 status → enforcement today, with a status rollup, top drift clusters,
   and decision coverage. Read first.
4. [`synthesis/40-recommendations-ranked.md`](./synthesis/40-recommendations-ranked.md)
   — R1–R12, each with its enforcement mechanism, the pressure test of the
   brief's leading hypothesis, and the deferred rows. Read second.
5. [`synthesis/30-assessment.md`](./synthesis/30-assessment.md) — likes,
   dislikes, what v4 must protect, the brief's hypotheses graded.
6. [`DECISIONS.md`](./DECISIONS.md) — the constraints from the brief, the
   16-decision align grill, and the deferred rows.
7. [`BRIEF.md`](./BRIEF.md) / [`MAP.md`](./MAP.md) — the shaped pitch and the
   two-goal decomposition.
8. [`RESEARCH.md`](./RESEARCH.md) — index of all `synthesis/` artifacts and
   how they were built and verified.
9. [`synthesis/90-completeness-critique.md`](./synthesis/90-completeness-critique.md)
   — what the critic found; every blocking and should-fix item is resolved
   in the files above (see Trail).

## Trail

- 2026-08-30 (graduated): **Operator ratified all seven sub-choices and
  accepted the brief.** `DECISIONS.md` gained the ratification entry (with
  rejected options); manifest `openQuestions` shrank to the nine DEFERRED
  measurement rows. Both goal packets scaffolded from
  `beep goals bootstrap --plan --json` payloads (`initiative-manifest/v2`,
  `provides`/`requires` capability edge), `SPEC.md`/`PLAN.md`/`GOAL.md`
  seeded from `BRIEF.md` + `MAP.md` + `DECISIONS.md` by back-link,
  `research/SOURCES.md` carried with the capability-gate bricks in §4,
  manifests cross-linked (`links.goals` here, `provenance.exploration`
  there). Status → `graduated`; atlas regenerated.
- 2026-08-30 (gate): **Definition-of-ready checked; capability cites
  corrected.** Codex verified the five addendum rows (BN-22/23 confirmed;
  BN-20/21/24 corrected: deep imports 724, namespace imports 115, kind-barrel
  4, v3 `.Model` consumers 364, v4 `.Table` sites 81, `Handler`/`Wrapper`
  240) and the counts were propagated. A 19-agent Workflow gate then verified
  every `MAP.md` cite (8/9 confirmed; the `TemplateRetarget.ts` range is
  L139-184 path pass + L186-262 body pass, not L146-171), refuted four of
  five NET-NEW marks with existing bricks (`resolveWorkspaceDirs`,
  `internal/ratchet`, `CiLane.ts` registry, `@beep/schema/Fn` + the govinfo
  `contracts/Search` precedent), and failed point 4 on six uncited
  components — all six now cite or are marked NET-NEW in `MAP.md`. One new
  deferred choice (`audit lane host`). BRIEF's appetite reworded as a budget.
  `beep goals bootstrap --plan --json` compiles clean plans for both slugs
  with `requires: architecture/slice-audit` as the dependency edge.
- 2026-08-30 (later): **Operator addenda folded in.** Two conventions the
  first pass under-captured: (1) v3's role-named members under the concept
  namespace (`Account.Model` / `.Repo` / `.RepoLive` / `.Entity` 39/39;
  consumer `.Model` 364) — v4 kept it only in `shared` (`User.Model` 4/4) and
  tables (`Table` 23/32), consumers bypass namespaces 724:115, and the
  generator retargets by substring; (2) v3's per-operation `Contract`
  (`Payload`/`Success`/`Failure`) + `Handler` semantics (72 contracts, 120
  handler pairs) — v4 has the slots, 0 members. Rows `BN-20`–`BN-24` added to
  `22` and `00` (110 rows; rollup 29/18/17/4/24/18), likes L10–L11 and two
  graded hypotheses in `30`, R6a/R6b in `40`, the grammar block and
  amendments in `BRIEF`, sequencing and a risk in `MAP`, two locked
  decisions + six deferred sub-choices in `DECISIONS`. effect v4 `Rpc.make`
  option key is `error` (not `failure`) — recorded so the template does not
  transcribe it wrong. Codex verification of the five rows: BN-22/23
  confirmed; BN-20/21/24 corrected (deep imports 881→724, namespace imports
  179→115, kind-barrel 5→4, v3 consumer `.Model` 407→364, v4 `.Table`
  sites 174→81, v3 `Handler`/`Wrapper` 246→240) and propagated to `30`,
  `40`, `BRIEF`, `MAP`, `DECISIONS`, `RESEARCH`.
- 2026-08-30: **Verified, consolidated, critiqued, reconciled.** Six Codex
  verification jobs (evidence recount + doctrine reading) re-ran every row of
  `20`–`25` against both checkouts: 32 confirmed, 65 corrected, 8 added, with
  a `## Verification log` per file. Consolidation wrote `00` (105 rows: 29
  codified · 18 codified-but-drifted · 14 drifted · 2 missing · 24 v4-only ·
  18 not-worth-porting; 10 decision-tagged drift clusters; decision coverage
  for all 16 grill entries). The completeness critique (`90`) raised 3
  blocking + 6 should-fix + 2 nice items; all are applied: seven uncovered
  rows and two proof-file roles are DEFERRED with recommendations
  (`DECISIONS.md`) and given terminal mechanisms (`40`), the first-vertical-
  slice acceptance is file-level (≥14 findings, `MAP.md`), R3 names its
  client/ui targets, `30`/`40` numbers match the verified tables,
  `collectPackageSourceRoots` is marked a NET-NEW extraction (it is private),
  the three estimates in `40` are labelled UNMEASURED, and `12`/`13`/`15`
  carry post-verification notes. Atlas regenerated (`beep explore atlas
  --write && --check`).
- 2026-08-29: **Opened, researched, aligned, shaped, decomposed in one
  session.** Inline scout falsified two of the brief's hypotheses (v3's
  "near-1:1" test ratio is by LOC, 0.28 by file; v3's `{concept}.{role}.ts`
  grammar held in domain entity folders, not the 1163 single-segment files
  elsewhere) and found the CLI's own proof diverging from doctrine on nine
  names. Workflow fan-out (31 agents planned) produced six inventories
  (`10`–`15`) and six pattern-family tables (`20`–`25`) before the Fable
  session limit killed the verifier/assessment/synthesis stages; verification
  and consolidation were re-routed to Codex (`codex exec`, effort medium) per
  the routing doctrine, assessment and ranking written by the orchestrating
  session. `/grilling` align: 16 decisions locked (see `DECISIONS.md`),
  frontier empty. `BRIEF.md` + `MAP.md` written; stage `decompose`. Mid-session
  `main` fast-forwarded `3435c24f94` → `2c0c8eb046` (no slice packages
  touched; census valid). Stopped before graduation by decision.
