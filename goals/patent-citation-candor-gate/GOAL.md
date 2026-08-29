# GOAL: land the patent citation candor gate

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: filing promotion in the law-practice slice is blocked by a derived,
fail-closed `CandorPolicy` predicate until every current AI-discovered
`PatentCitationEvent` carries an attorney `CandorDisposition` bound to its
exact observation version — never computing legal judgment.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/patent-citation-candor-gate/README.md`
- `goals/patent-citation-candor-gate/SPEC.md`
- `goals/patent-citation-candor-gate/PLAN.md`
- `goals/patent-citation-candor-gate/ops/manifest.json`
- `goals/patent-citation-candor-gate/research/SOURCES.md`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the cross-slice rules in
`standards/ARCHITECTURE.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `packages/law-practice/domain`, `packages/law-practice/use-cases`, and
  the two EntityId registrations in
  `packages/shared/domain/src/identity/LawPractice`; rung 2 adds
  `law-practice/tables`, `law-practice/server`, and the slice's first
  db-admin migration (+ PGlite test + `AcceptedProofManifest`).
- Out: the agents slice's vocabularies, `PriorArtReference`
  migration/rewrite, the three active citation/prosecution goal SPECs,
  epistemic packages, any new package, any computed legal judgment or stored
  closure state (full list: SPEC Non-Goals).

Workflow:

1. P0: re-verify live surfaces (`research/SOURCES.md` §4) and make the final
   gate-shape pick (emitted events preferred vs a promoted `shared/use-cases`
   contract — SPEC decision 7); record it in the SPEC decision log.
2. P1 (rung 1): schema → `Context.Service` contract → implementation, in that
   order. Write `CandorPolicy.test.ts` failing first, then make it green over
   in-memory/test-only layers. Budget circuit-breaker: drop
   `PatentFragmentLocator` before anything else; never the
   observation-version binding or fail-closed semantics.
3. P2 (rung 2): durable ports/repo/layer on the `ExecutionLedger` precedent,
   the db-admin migration lane, append-only IDS fact records, and the live
   filing-promotion consultation. P2 never starts before P1's test is green.
4. Preserve unrelated user/worktree changes; keep decisions tied to evidence.
5. Update packet evidence/status as readiness changes.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (gated criteria only when
      their owning goals have landed).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/patent-citation-candor-gate/GOAL.md)" -le 4000
jq . goals/patent-citation-candor-gate/ops/manifest.json
git diff --check -- goals/patent-citation-candor-gate
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it — and stop if the
lawful cross-slice gate shape would require a forbidden slice-to-slice import.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
