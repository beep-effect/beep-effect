# Run-3 lane brief — S7 emission v2 (bundled instrumentation PR)

Lane: Codex (`gpt-6-astra`, xhigh). Orchestrator: Fable. Steward: Benjamin.
Rulings implemented: **13** (one bundled emission PR), **4** (VerificationEpisode gets
grounded), **14** (stepIndex 0-based), **15** (nonce evidence rides, S8 stays out), **16**
(legacy terms untouched) from `DECISIONS.md` § "2026-09-03 — run-3 corpora design grill".
Design input: `research/run3-corpora-design-brief.md` §3 (ordering cluster) — its line refs
may be stale; re-derive from this checkout.

Framing that must appear in the contract doc verbatim in spirit: this PR is
**instrumentation FOR run-3 ratification evidence, not ratification** (the contract's own
§6 boundary: no vocabulary ratification happens in the emission).

## Outcome required

The deployed S7 projection emits everything the amended CQ-020 ordering cluster needs to
be evidenced at run 3, on branch `feat/ontology-s7-emission-v2` in this worktree. Commit on
the branch. **Do not push. Do not open a PR.** Fable publishes.

## The bundle (all five, together)

Package: `@beep/ciops` (`apps/labs/ciops/src/projection/*` — `Turtle.ts`, `Schemas.ts`,
`Engine.ts`, `AboxPolicy.ts`, `CiOpsProjection.ts`, `Replay.ts`; tests and fixtures under
`apps/labs/ciops/test/`). Keep the emission's existing namespace convention for ordering
terms (`ciops-prov:`) — the `ciops-prov:` namespace re-proposal rides the cluster at the
run; do not silently switch to `ciops:`.

1. **Scope literal rename.** The literal-valued `ciops-prov:hasScope` collides with the
   object property `hasScope` (no-punning split). Rename the literal emission to
   `ciops-prov:hasScopeTag` (xsd:string; v1 domain is exactly the `ScheduleScope`
   `LiteralKit` members, today `"admission"`). Do NOT add an object-property `hasScope` or
   a `Scope` class (Ruling 16).
2. **Typed AdmissionProjectionSpecification individual + edge.** Emit one
   `ciops-prov:AdmissionProjectionSpecification` individual per projection and a
   `ciops-prov:hasProjectionSpecification` edge to it from the proposal (or the episode —
   pick the subject the amended CQ-020 query text actually joins on; read
   `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml`
   CQ-020 first and match it). Its node identity must be content-derived and
   replay-stable (e.g. sha12 over policyDigest ‖ journalPrefixDigest ‖ scope ‖ contract
   version). Write the identity criteria (authority / version / applicability) into the
   contract doc.
3. **Digest serialization.** `policyDigest` and `journalPrefixDigest` become datatype
   properties on that specification individual (they never reach the Turtle today).
4. **Typed episode subject (Ruling 4).** `hasCurrentProposal` currently hangs off an
   invented, untyped `ciops-prov:scheduler` singleton. Introduce an episode identity in
   `ProjectionInput` (schema-first: add the field to the schema, then thread it) and emit a
   typed `ciops-prov:VerificationEpisode` individual as the `hasCurrentProposal` subject.
   Identity must be deterministic across replays (the replay evidence in
   `research/s7-replay-evidence.md` is the standard — identical input ⇒ identical Turtle).
   State in the report exactly what the episode id is derived from and why it is an
   episode (a bounded verification occurrence), not a scheduler singleton in disguise.
5. **Deferred-tail decision.** Deferred-tail SeatRequests are emitted with no step
   referencing them; CQ-020 sees admitted steps only, which is by design. Fable's
   recommendation: keep them STEP-LESS (do not renumber or extend `stepIndex` across the
   tail) and attach each to its proposal through ONE explicit provisional edge (e.g.
   `ciops-prov:defersSeatRequest` proposal → request) so they are not dangling nodes;
   document it in the contract as provisional instrumentation. If an existing emitted
   relation already links tail requests to the proposal, reuse it and add nothing. Report
   which you did and the tradeoff you saw.

Riders that land in the same PR:

- **Ruling 14:** `stepIndex` stays 0-based as the engine emits it. Do not change the engine.
  Do NOT edit `seed.ttl` or the CQ-020 sample answer — those fixes belong to the run-3
  docket (packet work), not this PR.
- **Ruling 15:** carry the scheduled unit's `nonce` (`scheduledUnitRef`) on every emitted
  SeatRequest node as a datatype property alongside the positional node id. Do NOT change
  IRI syntax (S8 is out of scope).
- **Ruling 16:** leave `schedulesWorkUnit` in CQ-019 arm 3 and its fixture untouched.
- **Contract refresh:** `explorations/beep-ci-operational-ontology/ontology/docs/s7-projection-contract.md`
  is stale on two spellings (`schedulesWorkUnit` → `schedulesSeatRequest`; `hasScope` →
  `hasScopeTag`). Refresh it to describe the v2 emission: the new individuals, edges,
  datatype properties, the episode identity criteria, the deferred-tail edge, the nonce
  carrier, and the explicit "instrumentation, not ratification" sentence. This is the ONLY
  file under `explorations/` you may edit.

## Do not touch

- Anything under `explorations/**/extraction/**` (frozen: `s6/PREDICATES.yaml`,
  `s7/**`, `run2-fleet/`, `etl_fleet_corpus.py`) — registration of the `ciops-prov:`
  spellings happens at run-3 ratification, not here.
- `ontology/tests/**`, `seed.ttl`, `competency-questions.yaml`, `traceability-matrix.csv`.
- The engine's step numbering.

## Design order and code law

Schema → service contract → implementation. Effect v4 only (validate against
`.repos/effect`). `Effect.fn` / `Effect.fnUntraced`. `effect/HashMap` and friends, never
`Set`/`Map`. `LiteralKit` for literal domains. JSDoc on exports with `**Example** (Title)`,
never `@example`. Update golden Turtle fixtures deliberately (explain each diff in the
report); replay determinism must hold.

## Verification before handoff

```sh
CI=true bun run beep quality package-verify @beep/ciops
bun run docgen:local
cd <repo> && uv run --with pyoxigraph python \
  explorations/beep-ci-operational-ontology/research/scripts/run_cq_suite.py
```

The CQ suite runs against the packet seed, not the emission, so it must stay at zero
failures untouched; also locate and run any existing emission→CQ replay check referenced
by `research/s7-replay-evidence.md` and include its result. Attribute every red
(introduced / inherited / unrelated / environment-only) before touching it.

## Report

Write `<s5-checkout>/explorations/beep-ci-operational-ontology/research/run3-lanes/emission-v2-report.md`
(the directory is a writable `--add-dir`). Contents, in order:

1. Term table: every emitted class/property touched or added — spelling, namespace,
   subject/object types, datatype, source line in `Turtle.ts` on your branch.
2. Episode identity derivation and the specification identity derivation.
3. Deferred-tail decision taken and why.
4. Fixture diffs explained one by one.
5. Files changed, tests added, verification output summaries.
6. Open questions; the commit SHA(s) on `feat/ontology-s7-emission-v2`.

## Hard rules

- Never `git add -A`; stage by name. Never push / PR / merge / force.
- Public repo: no absolute home paths or machine ids in committed files.
- Commit message conventional, e.g. `feat(ciops): emit the S7 ordering-cluster evidence (emission v2)`,
  body lines wrapped under 100 characters.
