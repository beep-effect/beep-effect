# GOAL: ship the reusable epistemic claim-lifecycle gate

Repo: `beep-effect` (this checkout).

Outcome: the epistemic slice graduates from domain-only to minimum-viable
(domain + use-cases + server) with a four-state `ClaimLifecycle`, the SHACL
`ClaimGate`, the pure `ClaimProjection`, and the ported `EvidenceSpan`
char-offsets on `Evidence`. Zero IP-law vocabulary. Build this FIRST.

This is a compact `/goal` launcher. Treat the packet files as the contract:

- `goals/epistemic-claim-lifecycle-gate/README.md`
- `goals/epistemic-claim-lifecycle-gate/SPEC.md`
- `goals/epistemic-claim-lifecycle-gate/PLAN.md`
- `goals/epistemic-claim-lifecycle-gate/ops/manifest.json`

Read those, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`, and the
authority `goals/agentic-professional-runtime/SPEC.md`. Higher repo standards
outrank packet prose. Decomposition source of truth:
`explorations/atlas-synthesis/MAP.md` (Packet A).

Scope:

- In: `packages/epistemic/domain` (extend `ClaimLifecycle.model.ts`,
  `Evidence.model.ts`; add gate/projection value schemas); new tiers
  `packages/epistemic/use-cases` (`ClaimGate`, `ClaimLifecycle` transition,
  `ClaimProjection`) and `packages/epistemic/server` (thin Layer surface).
- Out: IP-law vocabulary, IR->law mapping, loop wiring, fixtures (owned by
  `law-practice-office-action-spike`); FalkorDB, v3 GraphRAG/extraction port
  (port ONLY `EvidenceSpan`), real GraphRAG ask, 7-source ontology grounding.

BINDING SEQUENCING (no exceptions): P0 schema -> P1 `Context.Service` contract
(ports/interfaces, typed, no impl) -> P2 implementation -> P3 verify. Extract
helpers only AFTER schema + contract are fixed. Forbidden: loose helpers composed
into a service at the end. Role order: `.model.ts`/`.errors.ts` ->
`.ports.ts`/`.service.ts` -> `.repo.ts`.

Key constraints (SPEC.md is normative):

- `ClaimLifecycle` -> four-state union `candidate -> shape_valid ->
  consistency_checked -> admitted` (today `LiteralKit(["candidate"])`) +
  transition value objects + typed errors.
- `Evidence` gains `startChar`/`endChar`/`quote`/`confidence` (today two string
  refs); reuse `@beep/semantic-web/evidence` selector shape as reference only.
- `ClaimGate` is thin composition over the HAVE bounded `ShaclValidationService`
  (targetClass/minCount/maxCount/datatype), not a new engine; returns a typed
  admitted/rejected verdict driving the transition.
- FEDERATION INVARIANT (type-level): authority single-owner/local; projection is
  `(authority: ReadonlyArray<CandidateClaim>) => ClaimProjectionView`, read-only,
  rebuildable — never a central write.
- Tests boot only epistemic Layers; gate on no NEW `@beep/schema` Bun failures.

Workflow: inspect referenced files; make the smallest change satisfying
`SPEC.md` in phase order; preserve unrelated worktree changes; tie decisions to
file/test/command evidence; update packet status as readiness changes. At P3
Close, write a closeout reflection to
`history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
`bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (each phase gates the next).
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/epistemic-claim-lifecycle-gate/GOAL.md)" -le 4000
jq . goals/epistemic-claim-lifecycle-gate/ops/manifest.json
git diff --check -- goals/epistemic-claim-lifecycle-gate
bun run check --filter @beep/epistemic-domain
```

Stop and report before changing public API, schema beyond named scope, data
migration, auth, infra, dependencies, lockfiles, or generated files unless
`SPEC.md` requires it; or if the bounded SHACL subset cannot express the claim
shape (surface evidence, do not extend the engine).

Done only when acceptance passes and verification is complete, or a blocker is
reported with evidence.
